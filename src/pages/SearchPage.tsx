import { useState, useCallback, useMemo } from "react"
import { 
  Search, 
  Filter, 
  X,
  AlertTriangle,
  Plane,
  Ship,
  Building,
  Clock,
  MapPin,
  FileText,
  ChevronDown,
  ChevronRight,
  Tag,
  User
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface SearchResult {
  id: string
  type: "threat" | "case" | "entity" | "report"
  title: string
  description: string
  severity?: string
  status?: string
  timestamp: Date
  location?: { lat: number; lng: number }
  source?: string
}

interface SearchFilters {
  types: string[]
  severity: string[]
  status: string[]
  dateRange: { start: Date | null; end: Date | null }
  location: { bounds: any; radius: number } | null
}

interface SearchInterfaceProps {
  className?: string
  onResultClick?: (result: SearchResult) => void
}

const MOCK_RESULTS: SearchResult[] = [
  {
    id: "THREAT-001",
    type: "threat",
    title: "Unknown Aircraft Incursion",
    description: "Unidentified aircraft entered restricted airspace near LA",
    severity: "critical",
    status: "new",
    timestamp: new Date(Date.now() - 300000),
    location: { lat: 34.0522, lng: -118.2437 },
    source: "ADS-B",
  },
  {
    id: "THREAT-002",
    type: "threat",
    title: "GPS Interference Detected",
    description: "GPS jamming detected in Eastern Mediterranean",
    severity: "high",
    status: "investigating",
    timestamp: new Date(Date.now() - 3600000),
    location: { lat: 35.0, lng: 32.0 },
    source: "SIGINT",
  },
  {
    id: "CASE-001",
    type: "case",
    title: "Aircraft Tracking Anomaly",
    description: "Investigation into suspicious flight patterns",
    status: "open",
    timestamp: new Date(Date.now() - 86400000),
  },
  {
    id: "ENTITY-001",
    type: "entity",
    title: "MV OCEAN PRIDE",
    description: "Commercial vessel, flagged for investigation",
    severity: "medium",
    timestamp: new Date(Date.now() - 7200000),
    location: { lat: 25.7617, lng: -80.1918 },
  },
  {
    id: "REPORT-001",
    type: "report",
    title: "Daily Threat Assessment",
    description: "Daily intelligence brief for region",
    timestamp: new Date(Date.now() - 43200000),
  },
]

const TYPE_CONFIG = {
  threat: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/20" },
  case: { icon: FileText, color: "text-cyan-400", bg: "bg-cyan-500/20" },
  entity: { icon: Plane, color: "text-blue-400", bg: "bg-blue-500/20" },
  report: { icon: FileText, color: "text-purple-400", bg: "bg-purple-500/20" },
}

const SEVERITY_COLORS = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-green-500 text-white",
}

export function SearchInterface({ className, onResultClick }: SearchInterfaceProps) {
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<SearchFilters>({
    types: ["threat", "case", "entity", "report"],
    severity: [],
    status: [],
    dateRange: { start: null, end: null },
    location: null,
  })
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "Unknown aircraft",
    "GPS jamming",
    "Mediterranean",
  ])

  const filteredResults = useMemo(() => {
    let results = MOCK_RESULTS
    
    if (query) {
      const q = query.toLowerCase()
      results = results.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      )
    }
    
    if (filters.types.length > 0 && filters.types.length < 4) {
      results = results.filter(r => filters.types.includes(r.type))
    }
    
    if (filters.severity.length > 0) {
      results = results.filter(r => 
        r.severity && filters.severity.includes(r.severity)
      )
    }
    
    return results
  }, [query, filters])

  const toggleTypeFilter = (type: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type]
    }))
  }

  const toggleSeverityFilter = (severity: string) => {
    setFilters(prev => ({
      ...prev,
      severity: prev.severity.includes(severity)
        ? prev.severity.filter(s => s !== severity)
        : [...prev.severity, severity]
    }))
  }

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result)
    onResultClick?.(result)
  }

  const clearFilters = () => {
    setFilters({
      types: ["threat", "case", "entity", "report"],
      severity: [],
      status: [],
      dateRange: { start: null, end: null },
      location: null,
    })
  }

  return (
    <div className={cn("h-full flex flex-col bg-slate-950", className)}>
      <div className="p-4 border-b border-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search incidents, entities, reports..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-20 bg-slate-900 border-slate-700"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-slate-500 hover:text-slate-300" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={cn(
              "flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors",
              isFiltersOpen ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-400"
            )}
          >
            <Filter className="h-3 w-3" />
            Filters
            <ChevronDown className={cn("h-3 w-3 transition-transform", isFiltersOpen && "rotate-180")} />
          </button>
          
          <div className="flex gap-1">
            {Object.entries(TYPE_CONFIG).map(([type, config]) => (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-xs font-mono capitalize transition-colors",
                  filters.types.includes(type)
                    ? config.color
                    : "text-slate-500"
                )}
              >
                {type}
              </button>
            ))}
          </div>
          
          {(filters.severity.length > 0 || filters.types.length < 4) && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          )}
        </div>
        
        {isFiltersOpen && (
          <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <div>
              <div className="text-xs text-slate-500 mb-2">Severity</div>
              <div className="flex gap-2">
                {["critical", "high", "medium", "low"].map(sev => (
                  <button
                    key={sev}
                    onClick={() => toggleSeverityFilter(sev)}
                    className={cn(
                      "px-2 py-1 text-xs font-mono rounded capitalize",
                      filters.severity.includes(sev)
                        ? SEVERITY_COLORS[sev as keyof typeof SEVERITY_COLORS]
                        : "bg-slate-800 text-slate-500"
                    )}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <div className="text-xs text-slate-500 mb-2">Date Range</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Last 24h</Button>
                <Button variant="outline" size="sm">7 days</Button>
                <Button variant="outline" size="sm">30 days</Button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {!query && !filters.severity.length && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-500 mb-2">RECENT SEARCHES</div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(search)}
                      className="px-3 py-1 rounded bg-slate-900 border border-slate-800 text-sm text-slate-400 hover:border-cyan-500/30"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-slate-500 mb-2">QUICK FILTERS</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setFilters(prev => ({...prev, severity: ["critical"]}))}>
                    <AlertTriangle className="h-3 w-3 mr-1 text-red-400" />
                    Critical Threats
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setFilters(prev => ({...prev, types: ["case"], status: ["open"]}))}>
                    <FileText className="h-3 w-3 mr-1 text-cyan-400" />
                    Open Cases
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {query && filteredResults.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Search className="h-12 w-12 mb-4" />
              <div>No results found for "{query}"</div>
              <div className="text-sm mt-1">Try different keywords or adjust filters</div>
            </div>
          )}
          
          {filteredResults.length > 0 && (
            <div className="space-y-2">
              {filteredResults.map(result => {
                const config = TYPE_CONFIG[result.type as keyof typeof TYPE_CONFIG]
                const Icon = config?.icon
                
                return (
                  <div
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      "p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer transition-all hover:border-cyan-500/30",
                      selectedResult?.id === result.id && "border-cyan-500 bg-cyan-500/5"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded", config?.bg)}>
                          <Icon className={cn("h-4 w-4", config?.color)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-200">{result.title}</span>
                            {result.severity && (
                              <span className={cn("px-2 py-0.5 text-xs font-mono rounded", SEVERITY_COLORS[result.severity as keyof typeof SEVERITY_COLORS])}>
                                {result.severity}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 mt-1">{result.description}</div>
                          <div className="flex gap-3 mt-2 text-xs text-slate-500">
                            <span className="font-mono">{result.id}</span>
                            {result.timestamp && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(result.timestamp)}
                              </span>
                            )}
                            {result.source && (
                              <Badge variant="outline" className="text-[10px]">{result.source}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        {selectedResult && (
          <div className="w-80 border-l border-slate-800 p-4">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">Type</div>
                <Badge className={TYPE_CONFIG[selectedResult.type as keyof typeof TYPE_CONFIG]?.color}>
                  {selectedResult.type}
                </Badge>
              </div>
              
              <div>
                <div className="text-xs text-slate-500 mb-1">ID</div>
                <div className="font-mono text-cyan-400">{selectedResult.id}</div>
              </div>
              
              <div>
                <div className="text-xs text-slate-500 mb-1">Title</div>
                <div className="text-slate-200">{selectedResult.title}</div>
              </div>
              
              <div>
                <div className="text-xs text-slate-500 mb-1">Description</div>
                <div className="text-sm text-slate-400">{selectedResult.description}</div>
              </div>
              
              {selectedResult.location && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Location</div>
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3 text-cyan-400" />
                    {selectedResult.location.lat.toFixed(4)}, {selectedResult.location.lng.toFixed(4)}
                  </div>
                </div>
              )}
              
              {selectedResult.severity && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Severity</div>
                  <Badge className={SEVERITY_COLORS[selectedResult.severity as keyof typeof SEVERITY_COLORS]}>
                    {selectedResult.severity}
                  </Badge>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  View Details
                </Button>
                {selectedResult.type === "threat" && (
                  <Button variant="outline" size="sm" className="flex-1">
                    Create Case
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  if (diff < 60000) return "Just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

export default SearchInterface