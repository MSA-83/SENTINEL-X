import { useState, useEffect, useMemo } from "react"
import { 
  Network, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Share2,
  Filter,
  Plus,
  Minus,
  Search,
  Layers,
  Eye,
  EyeOff,
  Maximize2,
  Download,
  RefreshCcw,
  Activity,
  Target,
  Plane,
  Ship,
  Building,
  Cpu,
  Link2,
  AlertTriangle,
  ArrowRight,
  X,
  Info
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface EntityNode {
  id: string
  name: string
  type: "aircraft" | "vessel" | "facility" | "signal" | "person" | "organization"
  riskLevel: "critical" | "high" | "medium" | "low"
  x?: number
  y?: number
}

interface EntityLink {
  source: string
  target: string
  relationship: "related" | "same_group" | "parent" | "child" | "associated"
  strength: number
}

interface GraphData {
  nodes: EntityNode[]
  links: EntityLink[]
}

interface GraphEngineProps {
  className?: string
  initialData?: GraphData
  onNodeClick?: (node: EntityNode) => void
}

const ENTITY_ICONS = {
  aircraft: Plane,
  vessel: Ship,
  facility: Building,
  signal: Cpu,
  person: AlertTriangle,
  organization: Network,
}

const RISK_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
}

const RELATIONSHIP_TYPES = [
  { value: "related", label: "Related", color: "#6b7280" },
  { value: "same_group", label: "Same Group", color: "#8b5cf6" },
  { value: "parent", label: "Parent", color: "#3b82f6" },
  { value: "child", label: "Child", color: "#06b6d4" },
  { value: "associated", label: "Associated", color: "#10b981" },
]

const SAMPLE_GRAPH_DATA: GraphData = {
  nodes: [
    { id: "UAV-X99", name: "Unknown UAV", type: "aircraft", riskLevel: "critical" },
    { id: "TANKER-01", name: "Tanker Vessel", type: "vessel", riskLevel: "high" },
    { id: "COMMS-42", name: "Comm Node", type: "signal", riskLevel: "high" },
    { id: "BASE-101", name: "Naval Base", type: "facility", riskLevel: "low" },
    { id: "RADAR-01", name: "Radar Station", type: "facility", riskLevel: "medium" },
    { id: "OPS-TEAM", name: "Operations Team", type: "organization", riskLevel: "medium" },
    { id: "PERSON-01", name: "Unknown Individual", type: "person", riskLevel: "high" },
  ],
  links: [
    { source: "UAV-X99", target: "TANKER-01", relationship: "support", strength: 0.8 },
    { source: "UAV-X99", target: "COMMS-42", relationship: "associated", strength: 0.6 },
    { source: "TANKER-01", target: "BASE-101", relationship: "parent", strength: 0.9 },
    { source: "COMMS-42", target: "RADAR-01", relationship: "related", strength: 0.4 },
    { source: "UAV-X99", target: "PERSON-01", relationship: "associated", strength: 0.5 },
    { source: "OPS-TEAM", target: "BASE-101", relationship: "related", strength: 0.7 },
  ],
}

export function GraphEngine({ className, initialData, onNodeClick }: GraphEngineProps) {
  const [data] = useState<GraphData>(initialData || SAMPLE_GRAPH_DATA)
  const [selectedNode, setSelectedNode] = useState<EntityNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [showLabels, setShowLabels] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["aircraft", "vessel", "facility", "signal", "person", "organization"])
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>(["related", "same_group", "parent", "child", "associated"])
  const [searchQuery, setSearchQuery] = useState("")
  const [highlightedPath, setHighlightedPath] = useState<string[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredNodes = useMemo(() => {
    let nodes = data.nodes
    
    if (selectedTypes.length < 6) {
      nodes = nodes.filter(n => selectedTypes.includes(n.type))
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      nodes = nodes.filter(n => 
        n.name.toLowerCase().includes(query) || 
        n.id.toLowerCase().includes(query)
      )
    }
    
    return nodes
  }, [data.nodes, selectedTypes, searchQuery])

  const filteredLinks = useMemo(() => {
    return data.links.filter(l => {
      const sourceExists = filteredNodes.some(n => n.id === l.source)
      const targetExists = filteredNodes.some(n => n.id === l.target)
      const relationshipValid = selectedRelationships.includes(l.relationship)
      return sourceExists && targetExists && relationshipValid
    })
  }, [data.links, filteredNodes, selectedRelationships])

  const drawGraph = useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width = canvas.offsetWidth
    const height = canvas.height = canvas.offsetHeight

    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.scale(zoom, zoom)
    ctx.translate(-width / 2, -height / 2)

    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 3

    const nodePositions = new Map<string, { x: number; y: number }>()
    
    filteredNodes.forEach((node, i) => {
      const angle = (i / filteredNodes.length) * 2 * Math.PI - Math.PI / 2
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      nodePositions.set(node.id, { x, y })
    })

    filteredLinks.forEach(link => {
      const source = nodePositions.get(link.source)
      const target = nodePositions.get(link.target)
      if (!source || !target) return

      const relConfig = RELATIONSHIP_TYPES.find(r => r.value === link.relationship)
      const isHighlighted = highlightedPath.includes(link.source) && highlightedPath.includes(link.target)

      ctx.beginPath()
      ctx.moveTo(source.x, source.y)
      ctx.lineTo(target.x, target.y)
      ctx.strokeStyle = isHighlighted ? "#06b6d4" : relConfig?.color || "#6b7280"
      ctx.lineWidth = isHighlighted ? 3 : 1 + link.strength * 2
      ctx.globalAlpha = isHighlighted ? 1 : 0.6
      ctx.stroke()
      ctx.globalAlpha = 1
    })

    filteredNodes.forEach(node => {
      const pos = nodePositions.get(node.id)
      if (!pos) return

      const Icon = ENTITY_ICONS[node.type] || Network
      const color = RISK_COLORS[node.riskLevel]
      const isSelected = selectedNode?.id === node.id
      const isHovered = hoveredNode === node.id

      if (isSelected || isHovered) {
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 30, 0, 2 * Math.PI)
        ctx.fillStyle = `${color}33`
        ctx.fill()
      }

      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 20, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()

      ctx.fillStyle = "#0f172a"
      ctx.font = "12px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(node.type.charAt(0).toUpperCase(), pos.x, pos.y)

      if (showLabels) {
        ctx.fillStyle = "#e2e8f0"
        ctx.font = "11px sans-serif"
        ctx.fillText(node.name, pos.x, pos.y + 30)
        ctx.font = "9px monospace"
        ctx.fillStyle = "#94a3b8"
        ctx.fillText(node.id, pos.x, pos.y + 42)
      }
    })

    ctx.restore()
  }, [filteredNodes, filteredLinks, zoom, showLabels, selectedNode, hoveredNode, highlightedPath])

  const handleNodeClick = (nodeId: string) => {
    const node = data.nodes.find(n => n.id === nodeId)
    if (node) {
      setSelectedNode(node)
      onNodeClick?.(node)
    }
  }

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3))
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5))
  const handleReset = () => { setZoom(1); setSelectedNode(null); setHighlightedPath([]) }

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const toggleRelationshipFilter = (rel: string) => {
    setSelectedRelationships(prev => 
      prev.includes(rel) 
        ? prev.filter(r => r !== rel)
        : [...prev, rel]
    )
  }

  return (
    <div className={cn("h-full flex flex-col bg-slate-950", className)}>
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Network className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-wider text-cyan-400">
                ENTITY GRAPH
              </h1>
              <p className="text-xs text-slate-500">Joint Entity Resolution</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowLabels(!showLabels)}
            >
              {showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-slate-800 p-4 space-y-4">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-700"
              />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono text-slate-500 mb-2">ENTITY TYPES</h3>
            <div className="space-y-1">
              {Object.entries(ENTITY_ICONS).map(([type, Icon]) => (
                <button
                  key={type}
                  onClick={() => toggleTypeFilter(type)}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded transition-colors",
                    selectedTypes.includes(type) 
                      ? "bg-cyan-500/20 text-cyan-400" 
                      : "text-slate-400 hover:bg-slate-800"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="capitalize text-sm">{type}</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {data.nodes.filter(n => n.type === type).length}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono text-slate-500 mb-2">RELATIONSHIPS</h3>
            <div className="space-y-1">
              {RELATIONSHIP_TYPES.map(rel => (
                <button
                  key={rel.value}
                  onClick={() => toggleRelationshipFilter(rel.value)}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded transition-colors",
                    selectedRelationships.includes(rel.value) 
                      ? "bg-cyan-500/20" 
                      : "text-slate-400 hover:bg-slate-800"
                  )}
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: rel.color }}
                  />
                  <span className="text-sm">{rel.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono text-slate-500 mb-2">STATISTICS</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded bg-slate-900 text-center">
                <div className="text-xl font-bold text-white">{filteredNodes.length}</div>
                <div className="text-xs text-slate-500">Nodes</div>
              </div>
              <div className="p-2 rounded bg-slate-900 text-center">
                <div className="text-xl font-bold text-white">{filteredLinks.length}</div>
                <div className="text-xs text-slate-500">Links</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 relative" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            onClick={(e) => {
              const rect = canvasRef.current?.getBoundingClientRect()
              if (!rect) return
              const x = e.clientX - rect.left
              const y = e.clientY - rect.top
              const centerX = rect.width / 2
              const centerY = rect.height / 2
              const radius = Math.min(rect.width, rect.height) / 3

              filteredNodes.forEach((node, i) => {
                const angle = (i / filteredNodes.length) * 2 * Math.PI - Math.PI / 2
                const nx = centerX + radius * Math.cos(angle)
                const ny = centerY + radius * Math.sin(angle)
                const dist = Math.sqrt((x - nx) ** 2 + (y - ny) ** 2)
                if (dist < 25) {
                  handleNodeClick(node.id)
                }
              })
            }}
            onMouseMove={(e) => {
              const rect = canvasRef.current?.getBoundingClientRect()
              if (!rect) return
              const x = e.clientX - rect.left
              const y = e.clientY - rect.top
              const centerX = rect.width / 2
              const centerY = rect.height / 2
              const radius = Math.min(rect.width, rect.height) / 3

              let found = null
              filteredNodes.forEach((node, i) => {
                const angle = (i / filteredNodes.length) * 2 * Math.PI - Math.PI / 2
                const nx = centerX + radius * Math.cos(angle)
                const ny = centerY + radius * Math.sin(angle)
                const dist = Math.sqrt((x - nx) ** 2 + (y - ny) ** 2)
                if (dist < 25) {
                  found = node.id
                }
              })
              setHoveredNode(found)
            }}
          />

          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-4">
              {Object.entries(RISK_COLORS).map(([level, color]) => (
                <div key={level} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs text-slate-400 capitalize">{level}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedNode && (
          <div className="w-80 border-l border-slate-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Entity Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge className={RISK_COLORS[selectedNode.riskLevel]}>
                  {selectedNode.riskLevel.toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {selectedNode.type}
                </Badge>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">ID</div>
                <div className="font-mono text-cyan-400">{selectedNode.id}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">Name</div>
                <div className="text-slate-200">{selectedNode.name}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-2">CONNECTIONS</div>
                <div className="space-y-2">
                  {filteredLinks
                    .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
                    .map((link, i) => {
                      const otherId = link.source === selectedNode.id ? link.target : link.source
                      const otherNode = data.nodes.find(n => n.id === otherId)
                      if (!otherNode) return null
                      const relConfig = RELATIONSHIP_TYPES.find(r => r.value === link.relationship)
                      
                      return (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-900">
                          <div className="flex items-center gap-2">
                            <Network className="h-3 w-3 text-slate-400" />
                            <span className="text-sm text-slate-300">{otherNode.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {relConfig?.label}
                          </Badge>
                        </div>
                      )
                    })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1">
                  <Link2 className="h-4 w-4 mr-1" />
                  Link Entity
                </Button>
                <Button variant="outline" className="flex-1">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Alert
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GraphEngine