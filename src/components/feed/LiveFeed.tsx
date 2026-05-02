import { useState, useEffect } from "react"
import { 
  AlertTriangle, 
  Filter, 
  Search, 
  Bell, 
  BellOff,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  ChevronRight
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Severity config
const SEVERITY_CONFIG = {
  critical: {
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    pulse: true,
    icon: AlertTriangle,
  },
  high: {
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    pulse: false,
    icon: AlertTriangle,
  },
  medium: {
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    pulse: false,
    icon: AlertTriangle,
  },
  low: {
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    pulse: false,
    icon: AlertTriangle,
  },
  info: {
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    pulse: false,
    icon: AlertTriangle,
  },
}

interface FeedItem {
  id: string
  title: string
  description?: string
  severity: keyof typeof SEVERITY_CONFIG
  status: "active" | "acknowledged" | "resolved"
  timestamp: Date
  location?: string
  source?: string
  coordinates?: { lat: number; lng: number }
}

// Mock data
const MOCK_FEED: FeedItem[] = [
  {
    id: "1",
    title: "Unknown Military Aircraft Detected",
    description: "Unidentified aircraft entering restricted airspace at high altitude",
    severity: "critical",
    status: "active",
    timestamp: new Date(),
    location: "New York, USA",
    source: "ADS-B",
    coordinates: { lat: 40.7128, lng: -74.006 },
  },
  {
    id: "2",
    title: "GPS Jamming Activity",
    description: "Multiple aircraft experiencing signal degradation",
    severity: "high",
    status: "active",
    timestamp: new Date(Date.now() - 300000),
    location: "Eastern Mediterranean",
    source: "FlightAware",
  },
  {
    id: "3",
    title: "Suspicious Vessel Movement",
    description: "Vessel deviating from standard shipping lanes",
    severity: "medium",
    status: "acknowledged",
    timestamp: new Date(Date.now() - 1800000),
    location: "South China Sea",
    source: "MarineTraffic",
  },
  {
    id: "4",
    title: "Communications Intercept",
    description: "Unusual radio transmissions detected",
    severity: "medium",
    status: "resolved",
    timestamp: new Date(Date.now() - 3600000),
    location: "Black Sea",
    source: "OpenRTX",
  },
  {
    id: "5",
    title: "Radar Anomaly",
    description: "Ghost aircraft on secondary radar",
    severity: "low",
    status: "active",
    timestamp: new Date(Date.now() - 7200000),
    location: "North Atlantic",
    source: "AirNav",
  },
]

interface LiveFeedProps {
  className?: string
  maxItems?: number
  onItemClick?: (item: FeedItem) => void
}

export function LiveFeed({ className, maxItems = 50, onItemClick }: LiveFeedProps) {
  const [items, setItems] = useState<FeedItem[]>(MOCK_FEED)
  const [filter, setFilter] = useState<string>("")
  const [severityFilter, setSeverityFilter] = useState<string[]>(["critical", "high", "medium", "low"])
  const [statusFilter, setStatusFilter] = useState<string[]>(["active", "acknowledged", "resolved"])
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  // Filter items
  const filteredItems = items
    .filter(item => {
      if (filter && !item.title.toLowerCase().includes(filter.toLowerCase())) {
        return false
      }
      if (!severityFilter.includes(item.severity)) {
        return false
      }
      if (!statusFilter.includes(item.status)) {
        return false
      }
      return true
    })
    .slice(0, maxItems)

  // Status icon
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "active":
        return <Bell className="h-4 w-4 text-red-400" />
      case "acknowledged":
        return <Clock className="h-4 w-4 text-yellow-400" />
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-400" />
      default:
        return null
    }
  }

  return (
    <div className={cn("flex flex-col h-full bg-slate-900", className)}>
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>
            <h2 className="font-display text-lg font-bold text-cyan-400">
              LIVE INTELLIGENCE
            </h2>
            <Badge variant="outline" className="ml-2">
              {filteredItems.length} events
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? (
              <Bell className="h-4 w-4 text-cyan-400" />
            ) : (
              <BellOff className="h-4 w-4 text-slate-500" />
            )}
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search threats..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 bg-slate-800 border-slate-700"
          />
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Severity */}
          <div className="flex gap-1">
            {(["critical", "high", "medium", "low"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(prev => 
                  prev.includes(sev) 
                    ? prev.filter(s => s !== sev)
                    : [...prev, sev]
                )}
                className={cn(
                  "px-2 py-1 text-xs rounded font-mono uppercase transition-colors",
                  severityFilter.includes(sev)
                    ? SEVERITY_CONFIG[sev].color
                    : "bg-slate-800 text-slate-500"
                )}
              >
                {sev}
              </button>
            ))}
          </div>
          <span className="text-slate-600">|</span>
          {/* Status */}
          {(["active", "acknowledged", "resolved"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(prev =>
                prev.includes(status)
                  ? prev.filter(s => s !== status)
                  : [...prev, status]
              )}
              className={cn(
                "px-2 py-1 text-xs rounded font-mono capitalize transition-colors",
                statusFilter.includes(status)
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "bg-slate-800 text-slate-500"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
      
      {/* Feed Items */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const config = SEVERITY_CONFIG[item.severity]
          const Icon = config.icon
          
          return (
            <div
              key={item.id}
              onClick={() => onItemClick?.(item)}
              className={cn(
                "p-4 border-b border-slate-800 cursor-pointer transition-colors hover:bg-slate-800/50",
                item.status === "active" && "border-l-2 border-l-red-500"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn("p-2 rounded-lg", config.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "px-1.5 py-0.5 text-xs font-mono uppercase rounded",
                      config.color
                    )}>
                      {item.severity}
                    </span>
                    <StatusIcon status={item.status} />
                    <span className="text-xs text-slate-500 font-mono">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-slate-200 truncate">
                    {item.title}
                  </h3>
                  
                  {item.description && (
                    <p className="text-sm text-slate-400 line-clamp-2 mt-1">
                      {item.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.location}
                      </span>
                    )}
                    {item.source && (
                      <span className="font-mono">{item.source}</span>
                    )}
                  </div>
                </div>
                
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </div>
            </div>
          )
        })}
        
        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p>No threats match your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return "Just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

export default LiveFeed