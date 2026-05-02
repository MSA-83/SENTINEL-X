import { useEffect, useRef, useState, useCallback } from "react"
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  Circle,
  Polyline,
  useMap,
  useMapEvents
} from "react-leaflet"
import L from "leaflet"
import "leaflet.markercluster"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ThreatMarker {
  id: string
  title: string
  severity: "critical" | "high" | "medium" | "low"
  location: { lat: number; lng: number }
  heading?: number
  speed?: number
  timestamp: Date
  trail?: { lat: number; lng: number }[]
}

interface EnhancedMapProps {
  className?: string
  threats: ThreatMarker[]
  onMarkerClick?: (threat: ThreatMarker) => void
  showTrails?: boolean
  showHeatmap?: boolean
  showCluster?: boolean
  showBoundaries?: boolean
  initialCenter?: [number, number]
  initialZoom?: number
}

const SEVERITY_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
}

const SEVERITY_GLOW = {
  critical: "0 0 20px #ef4444",
  high: "0 0 15px #f97316",
  medium: "0 0 10px #eab308",
  low: "0 0 5px #22c55e",
}

// Custom marker icons
const createMarkerIcon = (severity: string, heading?: number) => {
  const color = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]
  const glow = SEVERITY_GLOW[severity as keyof typeof SEVERITY_GLOW]
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" style="filter:${glow}">`
  
  if (heading !== undefined) {
    svg += `<path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>`
  } else {
    svg += `<circle cx="12" cy="12" r="8" fill="${color}"/>
         <circle cx="12" cy="12" r="4" fill="#0f172a"/>`
  }
  
  svg += `</svg>`
  
  return L.divIcon({
    className: "custom-marker",
    html: svg,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

// Motion arrow component
const MotionArrow = ({ from, to, color }: { from: [number, number]; to: [number, number]; color: string }) => {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI
  
  return (
    <Polyline
      positions={[from, to]}
      pathOptions={{
        color,
        weight: 2,
        opacity: 0.7,
        dashArray: "5, 5",
      }}
    />
  )
}

// Cluster grouping component
const MarkerClusterGroup = L.markerClusterGroup({
  chunkedLoading: true,
  maxClusterRadius: 50,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  disableClusteringAtZoom: 15,
  iconCreateFunction: (cluster) => {
    const count = cluster.getChildCount()
    let size = "small"
    if (count > 10) size = "medium"
    if (count > 50) size = "large"
    
    return L.divIcon({
      html: `<div class="marker-cluster marker-cluster-${size}">
               <span>${count}</span>
             </div>`,
      className: "marker-cluster-custom",
      iconSize: L.point(40, 40),
    })
  },
})

// Map controls component
function MapControls({ 
  showTrails,
  showHeatmap,
  showCluster,
  onToggleTrails,
  onToggleHeatmap,
  onToggleCluster,
}: {
  showTrails: boolean
  showHeatmap: boolean
  showCluster: boolean
  onToggleTrails: () => void
  onToggleHeatmap: () => void
  onToggleCluster: () => void
}) {
  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-2">
        <div className="text-xs text-slate-500 mb-2">LAYERS</div>
        <div className="flex flex-col gap-1">
          <button
            onClick={onToggleCluster}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded text-sm",
              showCluster ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400"
            )}
          >
            <div className="w-3 h-3 rounded border border-current" />
            Cluster
          </button>
          <button
            onClick={onToggleTrails}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded text-sm",
              showTrails ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400"
            )}
          >
            <div className="w-3 h-3 rounded border border-current" />
            Trails
          </button>
          <button
            onClick={onToggleHeatmap}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded text-sm",
              showHeatmap ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400"
            )}
          >
            <div className="w-3 h-3 rounded border border-current" />
            Heatmap
          </button>
        </div>
      </div>
    </div>
  )
}

// Main enhanced map
export function EnhancedMap({
  className,
  threats,
  onMarkerClick,
  showTrails: initialShowTrails = true,
  showHeatmap: initialShowHeatmap = true,
  showCluster: initialShowCluster = true,
  showBoundaries = false,
  initialCenter = [40, -40],
  initialZoom = 4,
}: EnhancedMapProps) {
  const [showTrails, setShowTrails] = useState(initialShowTrails)
  const [showHeatmap, setShowHeatmap] = useState(initialShowHeatmap)
  const [showCluster, setShowCluster] = useState(initialShowCluster)
  const mapRef = useRef<L.Map>(null)
  const clusterRef = useRef<L.MarkerClusterGroup>(null)

  // Initialize cluster group
  useEffect(() => {
    if (showCluster && mapRef.current) {
      if (!clusterRef.current) {
        clusterRef.current = MarkerClusterGroup({
          chunkedLoading: true,
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true,
        })
        mapRef.current.addLayer(clusterRef.current)
      }
    }
    
    return () => {
      if (clusterRef.current && mapRef.current) {
        mapRef.current.removeLayer(clusterRef.current)
        clusterRef.current = null
      }
    }
  }, [showCluster])

  // Handle map ready
  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map
    
    // Add attribution for dark tiles
    map.attributionControl.setPrefix("")
  }, [])

  return (
    <div className={cn("relative", className)}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        
        {/* Threat markers */}
        {threats.map((threat) => (
          <Marker
            key={threat.id}
            position={[threat.location.lat, threat.location.lng]}
            icon={createMarkerIcon(threat.severity, threat.heading)}
            eventHandlers={{
              click: () => onMarkerClick?.(threat),
            }}
          >
            <Popup>
              <div className="p-2">
                <div className="font-semibold">{threat.title}</div>
                <Badge className={SEVERITY_COLORS[threat.severity]}>
                  {threat.severity}
                </Badge>
                {threat.speed && (
                  <div className="text-sm mt-1">{threat.speed} kts</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Trails */}
        {showTrails && threats.map((threat) => {
          if (!threat.trail || threat.trail.length < 2) return null
          
          return (
            <Polyline
              key={`trail-${threat.id}`}
              positions={threat.trail.map(t => [t.lat, t.lng])}
              pathOptions={{
                color: SEVERITY_COLORS[threat.severity],
                weight: 2,
                opacity: 0.5,
              }}
            />
          )
        })}
        
        {/* Heatmap circles */}
        {showHeatmap && threats.map((threat) => (
          <Circle
            key={`heatmap-${threat.id}`}
            center={[threat.location.lat, threat.location.lng]}
            radius={50000}
            pathOptions={{
              fillColor: SEVERITY_COLORS[threat.severity],
              fillOpacity: 0.2,
              color: SEVERITY_COLORS[threat.severity],
              weight: 1,
              opacity: 0.3,
            }}
          />
        ))}
        
        {/* Critical zone boundaries */}
        {showBoundaries && (
          <>
            <Circle
              center={[34.0522, -118.2437]}
              radius={50000}
              pathOptions={{
                fillColor: "#ef4444",
                fillOpacity: 0.1,
                color: "#ef4444",
                weight: 2,
                dashArray: "5, 5",
              }}
            />
            <Circle
              center={[40.7128, -74.006]}
              radius={30000}
              pathOptions={{
                fillColor: "#f97316",
                fillOpacity: 0.1,
                color: "#f97316",
                weight: 2,
                dashArray: "5, 5",
              }}
            />
          </>
        )}
      </MapContainer>
      
      {/* Map controls */}
      <MapControls
        showTrails={showTrails}
        showHeatmap={showHeatmap}
        showCluster={showCluster}
        onToggleTrails={() => setShowTrails(!showTrails)}
        onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
        onToggleCluster={() => setShowCluster(!showCluster)}
      />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-3">
        <div className="text-xs text-slate-500 mb-2">SEVERITY</div>
        <div className="space-y-1">
          {Object.entries(SEVERITY_COLORS).map(([severity, color]) => (
            <div key={severity} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-slate-400 capitalize">{severity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EnhancedMap