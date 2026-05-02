"""
SENTINEL-X React Hooks
Data fetching hooks for the frontend
"""
import { useState, useEffect, useCallback, useRef } from "react"
import { useRevalidator } from "@remix-run/react"

interface FetchState<T> {
  data: T | null
  error: Error | null
  isLoading: boolean
  isRefetching: boolean
}

interface UseFetchOptions {
  enabled?: boolean
  refetchInterval?: number
  retryCount?: number
  retryDelay?: number
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

type FetchFunction<T, Args extends any[] = any[]> = (...args: Args) => Promise<T>

export function useFetch<T>(
  key: string | string[],
  fetchFn: FetchFunction<T>,
  options: UseFetchOptions = {}
): FetchState<T> & { refetch: () => Promise<void> } {
  const {
    enabled = true,
    refetchInterval,
    retryCount = 3,
    retryDelay = 1000,
    onSuccess,
    onError,
  } = options

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefetching, setIsRefetching] = useState(false)
  
  const retryAttempt = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout>()

  const fetch = useCallback(async () => {
    if (!enabled) return
    
    try {
      if (data === null) {
        setIsLoading(true)
      } else {
        setIsRefetching(true)
      }
      
      const result = await fetchFn()
      setData(result)
      setError(null)
      retryAttempt.current = 0
      
      if (onSuccess) onSuccess(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      
      if (onError) onError(error)
      
      if (retryAttempt.current < retryCount) {
        retryAttempt.current++
        setTimeout(fetch, retryDelay * retryAttempt.current)
      }
    } finally {
      setIsLoading(false)
      setIsRefetching(false)
    }
  }, [enabled, fetchFn, retryCount, retryDelay, data === null, onSuccess, onError])

  useEffect(() => {
    fetch()
    
    if (refetchInterval) {
      intervalRef.current = setInterval(fetch, refetchInterval)
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [key.join(","), fetch])

  return { data, error, isLoading, isRefetching, refetch: fetch }
}


export function usePaginatedFetch<T>(
  key: string | string[],
  fetchFn: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
  initialPage = 1,
  initialLimit = 20
) {
  const [items, setItems] = useState<T[]>([])
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return
    
    setIsLoading(true)
    try {
      const result = await fetchFn(page + 1, limit)
      setItems(prev => [...prev, ...result.data])
      setTotal(result.total)
      setHasMore(result.hasMore)
      setPage(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [fetchFn, page, limit, hasMore, isLoading])

  const refresh = useCallback(async () => {
    setItems([])
    setPage(initialPage)
    setIsLoading(true)
    try {
      const result = await fetchFn(initialPage, limit)
      setItems(result.data)
      setTotal(result.total)
      setHasMore(result.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [fetchFn, initialPage, limit])

  return {
    items,
    page,
    limit,
    setLimit,
    total,
    hasMore,
    isLoading,
    error,
    loadMore,
    refresh,
  }
}


export function useMutation<T, Args extends any[] = any[]>(
  mutationFn: FetchFunction<T, Args>,
  options: {
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
  } = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isPending, setIsPending] = useState(false)

  const mutate = useCallback(async (...args: Args) => {
    setIsPending(true)
    setError(null)
    
    try {
      const result = await mutationFn(...args)
      setData(result)
      if (options.onSuccess) options.onSuccess(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      if (options.onError) options.onError(error)
      throw error
    } finally {
      setIsPending(false)
    }
  }, [mutationFn, options])

  return { mutate, data, error, isPending }
}


export function useRealtime(threatApi: any, onThreat: (threat: any) => void) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const eventSourceRef = useRef<EventSource | null>()

  useEffect(() => {
    if (!threatApi) return

    const connect = () => {
      try {
        const eventSource = new EventSource(`${threatApi}/realtime/threats`)
        eventSource.onmessage = (event) => {
          const threat = JSON.parse(event.data)
          onThreat(threat)
          setLastUpdate(new Date())
        }
        eventSource.onopen = () => setIsConnected(true)
        eventSource.onerror = () => {
          setIsConnected(false)
          setTimeout(connect, 5000)
        }
        eventSourceRef.current = eventSource
      } catch {
        setIsConnected(false)
      }
    }

    connect()

    return () => {
      eventSourceRef.current?.close()
    }
  }, [threatApi, onThreat])

  return { isConnected, lastUpdate }
}


export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}


export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (err) {
      console.error(err)
    }
  }, [key, storedValue])

  return [storedValue, setValue] as const
}


export function useMapBounds() {
  const [bounds, setBounds] = useState({
    north: 90,
    south: -90,
    east: 180,
    west: -180,
  })

  const updateBounds = useCallback((map: any) => {
    if (!map) return
    const b = map.getBounds()
    setBounds({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    })
  }, [])

  return { bounds, updateBounds }
}