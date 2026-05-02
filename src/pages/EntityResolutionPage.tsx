import { useState } from "react"
import { 
  Search, 
  Filter,
  Plus,
  Globe,
  Ship,
  Plane,
  Building,
  Network,
  AlertTriangle,
  Clock,
  ChevronRight,
  MoreHorizontal,
  MapPin,
  Radio,
  Anchor
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const MOCK_ENTITIES = [
  {
    id: "ENT-001",
    type: "aircraft",
    name: "Unknown-2024-A892",
    callsign: "XYZ123",
    classification: "unknown",
    lastSeen: new Date(Date.now() - 300000),
    location: { lat: 34.0522, lng: -118.2437 },
    source: "ADS-B",
    risk: "critical",
    linkedCases: 3,
  },
  {
    id: "ENT-002",
    type: "vessel",
    name: "MV OCEAN PRIDE",
    callsign: "VROX",
    classification: "commercial",
    lastSeen: new Date(Date.now() - 3600000),
    location: { lat: 25.7617, lng: -80.1918 },
    source: "AIS",
    risk: "low",
    linkedCases: 1,
  },
  {
    id: "ENT-003",
    type: "aircraft",
    name: "IL-76TD",
    callsign: "RA-XXXXX",
    classification: "military",
    lastSeen: new Date(Date.now() - 7200000),
    location: { lat: 41.9028, lng: 12.4964 },
    source: "OSINT",
    risk: "medium",
    linkedCases: 0,
  },
  {
    id: "ENT-004",
    type: "facility",
    name: "Naval Base",
    callsign: null,
    classification: "military",
    lastSeen: new Date(),
    location: { lat: 51.5074, lng: -0.1278 },
    source: "GEOINT",
    risk: "low",
    linkedCases: 2,
  },
  {
    id: "ENT-005",
    type: "signal",
    name: "HF-5678KHZ",
    callsign: null,
    classification: "electronic",
    lastSeen: new Date(Date.now() - 1800000),
    location: { lat: 48.8566, lng: 2.3522 },
    source: "SIGINT",
    risk: "high",
    linkedCases: 4,
  },
]

const TYPE_CONFIG = {
  aircraft: { icon: Plane, color: "text-cyan-400" },
  vessel: { icon: Ship, color: "text-blue-400" },
  facility: { icon: Building, color: "text-purple-400" },
  signal: { icon: Radio, color: "text-orange-400" },
}

const RISK_CONFIG = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-green-500 text-white",
}

interface EntityResolutionPageProps {
  className?: string
}

export function EntityResolutionPage({ className }: EntityResolutionPageProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string[]>(["aircraft", "vessel", "facility", "signal"])
  const [selectedEntity, setSelectedEntity] = useState<typeof MOCK_ENTITIES[0] | null>(null)

  const filteredEntities = MOCK_ENTITIES.filter(e => {
    if (searchQuery && !e.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (!typeFilter.includes(e.type)) return false
    return true
  })

  return (
    <div className={cn("h-screen flex flex-col bg-slate-950", className)}>
      <header className="h-14 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl font-bold tracking-wider text-cyan-400">
            ENTITY RESOLUTION
          </h1>
          <Badge variant="outline">{filteredEntities.length} entities</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
          <Button size="sm" className="bg-cyan-500 hover:bg-cyan-600">
            <Plus className="h-4 w-4 mr-1" />
            New Entity
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700"
              />
            </div>
            <div className="flex gap-2 mt-3">
              {Object.keys(TYPE_CONFIG).map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(prev => 
                    prev.includes(type) 
                      ? prev.filter(t => t !== type)
                      : [...prev, type]
                  )}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full font-mono capitalize flex items-center gap-1 transition-colors",
                    typeFilter.includes(type)
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "bg-slate-800 text-slate-500"
                  )}
                >
                  {TYPE_CONFIG[type as keyof typeof TYPE_CONFIG].icon && 
                    React.createElement(TYPE_CONFIG[type as keyof typeof TYPE_CONFIG].icon, { className: "h-3 w-3" })}
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-2">
            {filteredEntities.map(entity => {
              const TypeIcon = TYPE_CONFIG[entity.type as keyof typeof TYPE_CONFIG].icon
              return (
                <div
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                  className={cn(
                    "p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer transition-all hover:border-cyan-500/30",
                    selectedEntity?.id === entity.id && "border-cyan-500 bg-cyan-500/5"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg bg-slate-800",
                        TYPE_CONFIG[entity.type as keyof typeof TYPE_CONFIG].color
                      )}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-200">{entity.name}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {entity.callsign || entity.id}
                        </div>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 text-xs font-mono rounded",
                      RISK_CONFIG[entity.risk as keyof typeof RISK_CONFIG]
                    )}>
                      {entity.risk.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {entity.location.lat.toFixed(2)}, {entity.location.lng.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(entity.lastSeen)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {entity.source}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          {selectedEntity ? (
            <>
              <div className="p-4 border-b border-slate-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-lg bg-slate-800",
                      TYPE_CONFIG[selectedEntity.type as keyof typeof TYPE_CONFIG].color
                    )}>
                      {React.createElement(TYPE_CONFIG[selectedEntity.type as keyof typeof TYPE_CONFIG].icon, { className: "h-5 w-5" })}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {selectedEntity.name}
                      </h2>
                      <div className="text-sm text-slate-500 font-mono">
                        {selectedEntity.callsign || selectedEntity.id}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-4">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-400">Entity Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500">Classification</div>
                      <div className="capitalize">{selectedEntity.classification}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Data Source</div>
                      <Badge variant="outline">{selectedEntity.source}</Badge>
                    </div>
                    <div>
                      <div className="text-slate-500">Last Seen</div>
                      <div>{formatDate(selectedEntity.lastSeen)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Linked Cases</div>
                      <Badge>{selectedEntity.linkedCases}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-400">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="p-2 rounded bg-slate-800 text-sm">
                      <div className="text-slate-300">Position update</div>
                      <div className="text-xs text-slate-500">2h ago</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800 text-sm">
                      <div className="text-slate-300">Signal detected</div>
                      <div className="text-xs text-slate-500">5h ago</div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    Track Entity
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Link to Case
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Select an entity to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(date: Date): string {
  const diff = Date.now() - date.getTime()
  if (diff < 60000) return "Just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

export default EntityResolutionPage