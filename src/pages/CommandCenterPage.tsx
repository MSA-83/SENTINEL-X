import { useState } from "react"
import { ThreatMap } from "@/components/map/ThreatMap"
import { LiveFeed } from "@/components/feed/LiveFeed"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { 
  Map, 
  List, 
  SplitSquareHorizontal,
  Layers,
  Settings,
  Download,
  Share2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CommandCenterPageProps {
  className?: string
}

export function CommandCenterPage({ className }: CommandCenterPageProps) {
  const [viewMode, setViewMode] = useState<"split" | "map" | "feed">("split")
  const [selectedThreat, setSelectedThreat] = useState<any>(null)
  
  return (
    <div className={cn("h-screen flex flex-col bg-slate-950", className)}>
      {/* Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl font-bold tracking-wider text-cyan-400">
            COMMAND CENTER
          </h1>
          <div className="h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-slate-400">Live</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            <Button
              variant={viewMode === "map" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("map")}
            >
              <Map className="h-4 w-4 mr-1" />
              Map
            </Button>
            <Button
              variant={viewMode === "feed" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("feed")}
            >
              <List className="h-4 w-4 mr-1" />
              Feed
            </Button>
            <Button
              variant={viewMode === "split" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("split")}
            >
              <SplitSquareHorizontal className="h-4 w-4 mr-1" />
              Split
            </Button>
          </div>
          
          <div className="h-6 w-px bg-slate-700 mx-2" />
          
          <Button variant="ghost" size="sm">
            <Layers className="h-4 w-4 mr-1" />
            Layers
          </Button>
          <Button variant="ghost" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="ghost" size="sm">
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map View */}
        {(viewMode === "map" || viewMode === "split") && (
          <div className={cn(
            "relative",
            viewMode === "split" ? "w-2/3 border-r border-slate-800" : "w-full"
          )}>
            <ThreatMap 
              onThreatClick={(threat) => setSelectedThreat(threat)}
            />
            
            {/* Map Legend */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-3">
              <div className="text-xs font-mono text-slate-500 mb-2">SEVERITY LEGEND</div>
              <div className="space-y-1">
                {[
                  { color: "bg-red-500", label: "Critical" },
                  { color: "bg-orange-500", label: "High" },
                  { color: "bg-yellow-500", label: "Medium" },
                  { color: "bg-green-500", label: "Low" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", item.color)} />
                    <span className="text-xs text-slate-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Feed View */}
        {(viewMode === "feed" || viewMode === "split") && (
          <div className={cn(
            viewMode === "split" ? "w-1/3" : "w-full"
          )}>
            <LiveFeed 
              onItemClick={(item) => setSelectedThreat(item)}
            />
          </div>
        )}
      </div>
      
      {/* Selected Threat Panel */}
      {selectedThreat && (
        <div className="h-48 border-t border-slate-800 bg-slate-900 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 text-xs font-mono uppercase bg-red-500/20 text-red-400 rounded">
                  {selectedThreat.severity}
                </span>
                <span className="text-sm text-slate-500">
                  {selectedThreat.timestamp?.toLocaleString()}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white">
                {selectedThreat.title}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {selectedThreat.description}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setSelectedThreat(null)}>
              Close
            </Button>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm">
              Create Case
            </Button>
            <Button variant="outline" size="sm">
              Add to Watch List
            </Button>
            <Button variant="outline" size="sm">
              Share Intel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CommandCenterPage