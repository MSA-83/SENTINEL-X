"""
SENTINEL-X Performance Monitoring
FPS, memory, network monitoring
"""
import { useState, useEffect, useCallback, useRef } from "react"

export interface PerformanceMetrics {
  fps: number
  memory: number | null
  networkLatency: number | null
  renderTime: number
}

export interface SlowQuery {
  name: string
  duration: number
  timestamp: number
}

// FPS Monitor
export function useFPS(): number {
  const [fps, setFPS] = useState(60)
  const frames = useRef(0)
  const lastTime = useRef(performance.now())
  const rafRef = useRef<number>()

  useEffect(() => {
    const measureFPS = () => {
      frames.current++
      const now = performance.now()
      const elapsed = now - lastTime.current

      if (elapsed >= 1000) {
        setFPS(Math.round((frames.current * 1000) / elapsed))
        frames.current = 0
        lastTime.current = now
      }

      rafRef.current = requestAnimationFrame(measureFPS)
    }

    rafRef.current = requestAnimationFrame(measureFPS)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return fps
}

// Memory usage (Chrome only)
export function useMemory(): number | null {
  const [memory, setMemory] = useState<number | null>(null)

  useEffect(() => {
    if (!performance.memory) {
      return
    }

    const measureMemory = () => {
      setMemory(performance.memory.usedJSHeapSize)
    }

    measureMemory()
    const interval = setInterval(measureMemory, 5000)

    return () => clearInterval(interval)
  }, [])

  return memory
}

// Network latency
export function useNetworkLatency(): number | null {
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    const measureLatency = async () => {
      const start = performance.now()
      try {
        await fetch("/api/health", { method: "HEAD" })
      } catch {
        // Fallback - measure DNS resolution
        const dnsStart = performance.now()
        await fetch(location.origin, { method: "HEAD" })
        setLatency(performance.now() - dnsStart)
      }
    }

    measureLatency()
    const interval = setInterval(measureLatency, 30000)

    return () => clearInterval(interval)
  }, [])

  return latency
}

// Render time tracking
export function useRenderTime(): number {
  const [renderTime, setRenderTime] = useState(0)
  const startTime = useRef(performance.now())

  useEffect(() => {
    setRenderTime(performance.now() - startTime.current)
  })

  return renderTime
}

// Performance monitor component
export function PerformanceMonitor({
  className,
  showDetails = false,
}: {
  className?: string
  showDetails?: boolean
}) {
  const fps = useFPS()
  const memory = useMemory()
  const latency = useNetworkLatency()

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return "text-green-400"
    if (fps >= 30) return "text-yellow-400"
    return "text-red-400"
  }

  const formatMemory = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const formatLatency = (ms: number) => {
    if (ms < 100) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span>FPS:</span>
          <span className={getFPSColor(fps)}>{fps}</span>
        </div>

        {showDetails && memory && (
          <div className="flex items-center gap-1">
            <span>Memory:</span>
            <span className="text-slate-400">{formatMemory(memory)}</span>
          </div>
        )}

        {showDetails && latency !== null && (
          <div className="flex items-center gap-1">
            <span>Latency:</span>
            <span className="text-slate-400">{formatLatency(latency)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Slow query logger
class PerformanceLogger {
  private queries: SlowQuery[] = []
  private maxQueries = 100

  logQuery(name: string, duration: number) {
    this.queries.push({
      name,
      duration,
      timestamp: Date.now(),
    })

    if (this.queries.length > this.maxQueries) {
      this.queries.shift()
    }
  }

  getSlowQueries(threshold = 1000): SlowQuery[] {
    return this.queries.filter((q) => q.duration > threshold)
  }

  getAverageDuration(name: string): number {
    const relevant = this.queries.filter((q) => q.name === name)
    if (relevant.length === 0) return 0

    const total = relevant.reduce((sum, q) => sum + q.duration, 0)
    return total / relevant.length
  }

  clear() {
    this.queries = []
  }
}

export const performanceLogger = new PerformanceLogger()

// Performance decorator
export function withPerformanceTracking<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    const start = performance.now()
    try {
      return fn(...args)
    } finally {
      const duration = performance.now() - start
      performanceLogger.logQuery(name, duration)
    }
  }) as T
}

// Metric collector for analytics
export function collectMetrics(): PerformanceMetrics {
  return {
    fps: 60,
    memory: performance.memory?.usedJSHeapSize ?? null,
    networkLatency: null,
    renderTime: 0,
  }
}