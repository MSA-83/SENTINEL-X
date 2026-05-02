import { useState, useEffect, useMemo, useCallback } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from "react-leaflet"
import { Icon, divIcon } from "leaflet"
import { AlertTriangle, Filter, Layers, ZoomIn, ZoomOut, Target, Timer, Navigation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import "leaflet/dist/leaflet.css"

// Fix Leaflet marker icons
delete (Icon.Default.prototype as any)._getIconUrl
Icon.Default.mergeOptions!

// Severity colors
const SEVERITY_COLORS = {
  critical: "#ff2d55",
  high: "#ff6600",
  medium: "#ff9500",
  low: "#39ff14",
  info: "#00f5ff",
}

// Mock threat data
const MOCK_THREATS = [
  {
    id: "1",
    title: "Unknown Military Aircraft",
    severity: "critical" as const,
    lat: 40.7128,
    lng: -74.006,
    type: "aircraft",
    timestamp: new Date(),
  },
  {
    id: "2",
    title: "GPS Jamming Detected",
    severity: "high" as const,
    lat: 34.0522,
    lng: -118.2437,
    type: "jamming",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: "3",
    title: "Suspicious Vessel",
    severity: "medium" as const,
    lat: 51.5074,
    lng: -0.1278,
    type: "vessel",
    timestamp: new Date(Date.now() - 7200000),
  },
  {
    id: "4",
    title: "Radiosonde Anomaly",
    severity: "low" as const,
    lat: 48.8566,
    lng: 2.3522,
    type: "radiosonde",
    timestamp: new Date(Date.now() - 10800000),
  },
]

// Motion trail data
const MOTION_TRAILS = [
  [
    [40.7, -74.0],
    [40.71, -74.01],
    [40.72, -74.02],
    [40.73, -74.03],
  ],
  [
    [34.0, -118.2],
    [34.01, -118.21],
    [34.02, -118.22],
  ],
]

interface ThreatMapProps {
  className?: string
  onThreatClick?: (threat: any) => void
}

export function ThreatMap({ className, onThreatClick }: ThreatMapProps) {
  const [threats] = useState(MOCK_THREATS)
  const [selectedThreat, setSelectedThreat] = useState<any>(null)
  const [filters, setFilters] = useState({
    critical: true,
    high: true,
    medium: true,
    low: true,
  })
  const [showTrails, setShowTrails] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [clustering, setClustering] = useState(true)
  const [zoom, setZoom] = useState(4)

  // Filter threats
  const filteredThreats = useMemo(() => {
    return threats.filter((t) => filters[t.severity])
  }, [threats, filters])

  // Custom marker icon
  const createMarker = useCallback((severity: string) => {
    return divIcon({
      className: "",
      html: `
        <div class="relative">
          <div class="w-4 h-4 rounded-full border-2 border-white shadow-lg"
               style="background: ${SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]};
                      box-shadow: 0 0 10px ${SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]}">
          </div>
          ${severity === "critical" ? `
            <div class="absolute inset-0 rounded-full animate-ping"
                 style="background: ${SEVERITY_COLORS[severity]}">
            </div>
          ` : ""}
        </div>
      `,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })
  }, [])

  return (
    <div className={cn("relative w-full h-full bg-slate-950", className)}>
      {/* Map Container */}
      <MapContainer
        center={[40.7128, -74.006]}
        zoom={zoom}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Threat Markers */}
        {filteredThreats.map((threat) => (
          <Marker
            key={threat.id}
            position={[threat.lat, threat.lng]}
            icon={createMarker(threat.severity)}
            eventHandlers={{
              click: () => {
                setSelectedThreat(threat)
                onThreatClick?.(threat)
              },
            }}
          >
            <Popup>
              <div className="p-2 min-w-48">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={threat.severity === "critical" ? "destructive" : "default"}>
                    {threat.severity.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-slate-500">{threat.type}</span>
                </div>
                <h3 className="font-semibold text-slate-900">{threat.title}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {threat.timestamp.toLocaleString()}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Motion Trails */}
        {showTrails && MOTION_TRAILS.map((trail, i) => (
          <Polyline
            key={i}
            positions={trail}
            pathOptions={{
              color: SEVERITY_COLORS.critical,
              weight: 2,
              opacity: 0.6,
              dashArray: "5, 10",
            }}
          />
        ))}
        
        {/* Heatmap Circles */}
        {showHeatmap && filteredThreats.map((threat) => (
          <Circle
            key={`heat-${threat.id}`}
            center={[threat.lat, threat.lng]}
            radius={50000}
            pathOptions={{
              fillColor: SEVERITY_COLORS[threat.severity as keyof typeof SEVERITY_COLORS],
              fillOpacity: 0.2,
              color: SEVERITY_COLORS[threat.severity as keyof typeof SEVERITY_COLORS],
              weight: 1,
            }}
          />
        ))}
        
        {/* Map Controls */}
        <MapControls
          onZoomIn={() => setZoom(z => Math.min(z + 1, 18))}
          onZoomOut={() => setZoom(z => Math.max(z - 1, 1))}
          onCenter={() => {}}
        />
      </MapContainer>
      
      {/* Overlay Controls */}
      <div className="absolute top-4 left-4 z-[1000] space-y-2">
        {/* Filters */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-2">
            <Filter size={14} />
            SEVERITY FILTER
          </div>
          <div className="space-y-1">
            {Object.entries(filters).map(([key, enabled]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setFilters(f => ({ ...f, [key]: e.target.checked }))}
                  className="rounded"
                />
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: SEVERITY_COLORS[key as keyof typeof SEVERITY_COLORS] }}
                />
                <span className="text-xs capitalize">{key}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Layers */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-2">
            <Layers size={14} />
            LAYERS
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTrails}
                onChange={(e) => setShowTrails(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs">Motion Trails</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs">Heatmap</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={clustering}
                onChange={(e) => setClustering(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs">Clustering</span>
            </label>
          </div>
        </div>
      </div>
      
      {/* Stats Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 font-mono">ACTIVE THREATS</div>
              <div className="text-xl font-bold text-red-400">{filteredThreats.length}</div>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div>
              <div className="text-xs text-slate-500 font-mono">ZONE COVERAGE</div>
              <div className="text-xl font-bold text-cyan-400">94%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MapControls({ onZoomIn, onZoomOut, onCenter }: {
  onZoomIn: () => void
  onZoomOut: () => void
  onCenter: () => void
}) {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
      <Button variant="outline" size="icon" onClick={onZoomIn}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onZoomOut}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onCenter}>
        <Target className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default ThreatMap