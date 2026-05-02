"""
SENTINEL-X Performance Hooks
useDebounce, useThrottle, useMemoCompare, etc.
"""
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useCallback, useRef } from "react"

// Debounce hook - delay value updates
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// Throttle hook - limit function calls
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(0)
  
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastRun.current >= delay) {
      lastRun.current = now
      callback(...args)
    }
  }, [callback, delay]) as T
}

// Debounce async function
export function useDebouncedCallback<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()
  
  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(async () => {
      await callback(...args)
    }, delay)
  }, [delay, ...deps]) as T
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return debouncedCallback
}

// Memo compare hook - only re-render if value changed
export function useMemoCompare<T>(
  factory: () => T,
  compare: (a: T, b: T) => boolean
): T {
  const previousRef = useRef<T>()
  const current = factory()
  
  if (previousRef.current === undefined) {
    previousRef.current = current
  } else if (!compare(previousRef.current, current)) {
    previousRef.current = current
  }
  
  return previousRef.current
}

// Interval hook with pause support
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay)
      return () => clearInterval(id)
    }
  }, [delay])
}

// Previous value hook
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}

// Toggle boolean hook
export function useToggle(initialValue = false): [boolean, () => void] {
  const [value, setValue] = useState(initialValue)
  const toggle = useCallback(() => setValue(v => !v), [])
  return [value, toggle]
}

// Toggle with setValue
export function useToggleAdvanced(initialValue = false): [boolean, () => void, (v: boolean) => void] {
  const [value, setValue] = useState(initialValue)
  const toggle = useCallback(() => setValue(v => !v), [])
  return [value, toggle, setValue]
}

// Multiple state hook
export function useMultiState<T extends string | number>(
  initialValue: T[]
): [
  T[],
  (value: T) => void,
  (value: T) => void,
  (value: T) => boolean,
  () => void
] {
  const [state, setState] = useState<T[]>(initialValue)

  const add = useCallback((value: T) => {
    setState(prev => [...prev, value])
  }, [])

  const remove = useCallback((value: T) => {
    setState(prev => prev.filter(v => v !== value))
  }, [])

  const has = useCallback((value: T) => {
    return state.includes(value)
  }, [state])

  const clear = useCallback(() => {
    setState([])
  }, [])

  return [state, add, remove, has, clear]
}

// Async state hook
export function useAsyncState<T, E = Error>(
  initialValue: T | null = null
): [
  T | null,
  E | null,
  boolean,
  (promise: Promise<T>) => Promise<void>,
  () => void
] {
  const [data, setData] = useState<T | null>(initialValue)
  const [error, setError] = useState<E | null>(null)
  const [loading, setLoading] = useState(false)

  const execute = useCallback(async (promise: Promise<T>) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await promise
      setData(result)
    } catch (e) {
      setError(e as E)
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setData(initialValue)
    setError(null)
    setLoading(false)
  }, [initialValue])

  return [data, error, loading, execute, reset]
}

// Request animation frame hook
export function useAnimationFrame(callback: (deltaTime: number) => void) {
  const frameRef = useRef(0)
  const previousTimeRef = useRef(performance.now())

  useEffect(() => {
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - previousTimeRef.current
      previousTimeRef.current = currentTime
      callback(deltaTime)
      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameRef.current)
    }
  }, [callback])
}

// Local storage hook with sync
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(error)
    }
  }, [key, storedValue])

  return [storedValue, setValue]
}

// Session storage hook
export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.sessionStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(error)
    }
  }, [key, storedValue])

  return [storedValue, setValue]
}

// Infinite scroll hook
export function useInfiniteScroll(
  callback: () => void,
  options: { threshold: number } = { threshold: 100 }
) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const listRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    if (node) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            callback()
          }
        },
        { rootMargin: `${options.threshold}px` }
      )
      observerRef.current.observe(node)
    }
  }, [callback, options.threshold])

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  return listRef
}

// Window size hook
export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return size
}

// Online status hook
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return online
}

// Media query hook
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    typeof window !== "undefined"
      ? window.matchMedia(query).matches
      : false
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [query])

  return matches
}

// Click outside hook
export function useClickOutside<T extends HTMLElement>(
  callback: () => void
): React.RefObject<T> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback()
      }
    }

    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [callback])

  return ref
}

// Copy to clipboard hook
export function useCopyToClipboard(): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [])

  return [copied, copy]
}