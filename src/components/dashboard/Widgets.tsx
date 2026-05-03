import { useMemo } from "react"
import { 
  TrendUp, 
  TrendDown, 
  Activity,
  AlertTriangle,
  Shield,
  Target,
  Users,
  FileText,
  Eye,
  MapPin,
  Clock,
  Cpu,
  Zap,
  BarChart3,
  Gauge,
  Layers,
  Radio,
  Plane,
  Ship
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface DashboardWidgetProps {
  className?: string
  title?: string
}

export function ThreatStatWidget({ 
  className, 
  data 
}: { 
  className?: string
  data: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
    trend: number
  }
}) {
  const stats = useMemo(() => {
    return [
      { label: "Total", value: data.total, color: "text-white" },
      { label: "Critical", value: data.critical, color: "text-red-400" },
      { label: "High", value: data.high, color: "text-orange-400" },
      { label: "Medium", value: data.medium, color: "text-yellow-400" },
      { label: "Low", value: data.low, color: "text-green-400" },
    ]
  }, [data])

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-400">
          <Shield className="h-4 w-4" />
          THREAT STATISTICS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className={cn("text-2xl font-bold", stat.color)}>
                {stat.value}
              </div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800">
          {data.trend > 0 ? (
            <TrendUp className="h-4 w-4 text-red-400" />
          ) : (
            <TrendDown className="h-4 w-4 text-green-400" />
          )}
          <span className={data.trend > 0 ? "text-red-400" : "text-green-400"}>
            {Math.abs(data.trend)}%
          </span>
          <span className="text-slate-500 text-sm">vs last period</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function ActivityFeedWidget({ className }: DashboardWidgetProps) {
  const activities = useMemo(() => [
    { type: "threat", title: "Critical threat detected", time: "2m ago", severity: "critical" },
    { type: "case", title: "Case #CASE-001 created", time: "5m ago", severity: "high" },
    { type: "alert", title: "Alert rule triggered", time: "12m ago", severity: "medium" },
    { type: "entity", title: "New entity tracked", time: "18m ago", severity: "low" },
    { type: "system", title: "Data sync complete", time: "25m ago", severity: "low" },
  ], [])

  const typeIcons = {
    threat: AlertTriangle,
    case: FileText,
    alert: Shield,
    entity: Users,
    system: Activity,
  }

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-400">
          <Activity className="h-4 w-4" />
          RECENT ACTIVITY
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-3">
            {activities.map((activity, i) => {
              const Icon = typeIcons[activity.type as keyof typeof typeIcons]
              return (
                <div 
                  key={i} 
                  className="flex items-start gap-3 p-2 rounded hover:bg-slate-800/50 transition-colors"
                >
                  <div className={cn(
                    "p-2 rounded",
                    activity.severity === "critical" ? "bg-red-500/20" :
                    activity.severity === "high" ? "bg-orange-500/20" :
                    activity.severity === "medium" ? "bg-yellow-500/20" :
                    "bg-slate-700"
                  )}>
                    <Icon className={cn(
                      "h-3 w-3",
                      activity.severity === "critical" ? "text-red-400" :
                      activity.severity === "high" ? "text-orange-400" :
                      activity.severity === "medium" ? "text-yellow-400" :
                      "text-slate-400"
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-200">{activity.title}</div>
                    <div className="text-xs text-slate-500">{activity.time}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export function RegionHotspotWidget({ className }: DashboardWidgetProps) {
  const hotspots = useMemo(() => [
    { name: "Eastern Mediterranean", count: 234, trend: "up" },
    { name: "South China Sea", count: 189, trend: "up" },
    { name: "Baltic Sea", count: 156, trend: "down" },
    { name: "Persian Gulf", count: 134, trend: "stable" },
    { name: "Caribbean", count: 98, trend: "up" },
  ], [])

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-400">
          <MapPin className="h-4 w-4" />
          HOTSPOTS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {hotspots.map((spot, i) => (
            <div 
              key={i} 
              className="flex items-center justify-between p-2 rounded bg-slate-800"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-cyan-500/20 flex items-center justify-center text-xs text-cyan-400">
                  {i + 1}
                </div>
                <span className="text-sm text-slate-300">{spot.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-slate-400">{spot.count}</span>
                {spot.trend === "up" && <TrendUp className="h-3 w-3 text-red-400" />}
                {spot.trend === "down" && <TrendDown className="h-3 w-3 text-green-400" />}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SystemStatusWidget({ className }: DashboardWidgetProps) {
  const systems = useMemo(() => [
    { name: "Data Ingestion", status: "operational", uptime: "99.9%" },
    { name: "Real-time Stream", status: "operational", uptime: "99.8%" },
    { name: "ML Pipeline", status: "operational", uptime: "98.5%" },
    { name: "Map Engine", status: "operational", uptime: "99.9%" },
    { name: "Database", status: "degraded", uptime: "97.2%" },
  ], [])

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-400">
          <Cpu className="h-4 w-4" />
          SYSTEM STATUS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {systems.map((system, i) => (
            <div 
              key={i} 
              className="flex items-center justify-between p-2 rounded bg-slate-800"
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  system.status === "operational" ? "bg-green-500" : "bg-yellow-500"
                )} />
                <span className="text-sm text-slate-300">{system.name}</span>
              </div>
              <span className="text-xs text-slate-500">{system.uptime}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500 mt-4">
          Last sync: 2 minutes ago
        </div>
      </CardContent>
    </Card>
  )
}

export function EntityWidget({ className }: DashboardWidgetProps) {
  const entities = useMemo(() => [
    { type: "aircraft", name: "UAV-X99", risk: "critical", count: 234 },
    { type: "vessel", name: "TANKER-01", risk: "high", count: 189 },
    { type: "signal", name: "SIG-42", risk: "high", count: 156 },
    { type: "facility", name: "BASE-01", risk: "medium", count: 98 },
  ], [])

  const typeIcons = {
    aircraft: Plane,
    vessel: Ship,
    signal: Radio,
    facility: Layers,
  }

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-400">
          <Target className="h-4 w-4" />
          TOP ENTITIES
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entities.map((entity, i) => {
            const Icon = typeIcons[entity.type as keyof typeof typeIcons]
            return (
              <div 
                key={i} 
                className="flex items-center justify-between p-2 rounded bg-slate-800"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-cyan-400" />
                  <div>
                    <div className="text-sm text-slate-300">{entity.name}</div>
                    <div className="text-xs text-slate-500">{entity.type}</div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={cn(
                    entity.risk === "critical" ? "bg-red-500" :
                    entity.risk === "high" ? "bg-orange-500" :
                    "bg-yellow-500"
                  )}>
                    {entity.risk}
                  </Badge>
                  <div className="text-xs text-slate-500 mt-1">{entity.count} links</div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function GaugeWidget({ 
  className, 
  value, 
  max, 
  label 
}: { 
  className?: string
  value: number
  max: number
  label: string 
}) {
  const percentage = Math.round((value / max) * 100)
  const color = percentage > 80 ? "text-red-400" : percentage > 50 ? "text-yellow-400" : "text-green-400"

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">{label}</span>
          <span className={cn("text-2xl font-bold", color)}>{percentage}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              percentage > 80 ? "bg-red-500" : percentage > 50 ? "bg-yellow-500" : "bg-green-500"
            )} 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export function MiniMapWidget({ className }: DashboardWidgetProps) {
  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-400">
          <MapPin className="h-4 w-4" />
          THREAT MAP
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 bg-slate-800 rounded flex items-center justify-center">
          <div className="text-center text-slate-500">
            <MapPin className="h-8 w-8 mx-auto mb-2" />
            <div className="text-sm">Interactive map</div>
            <div className="text-xs">Click to expand</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function QuickActionsWidget({ className }: DashboardWidgetProps) {
  const actions = [
    { label: "Create Case", icon: FileText, action: "create-case" },
    { label: "Add Alert", icon: AlertTriangle, action: "create-alert" },
    { label: "Track Entity", icon: Target, action: "track-entity" },
    { label: "Export", icon: BarChart3, action: "export" },
  ]

  return (
    <Card className={cn("bg-slate-900 border-slate-800", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-400">
          <Zap className="h-4 w-4" />
          QUICK ACTIONS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action, i) => {
            const Icon = action.icon
            return (
              <Button key={i} variant="outline" className="h-16 flex-col gap-1">
                <Icon className="h-4 w-4" />
                <span className="text-xs">{action.label}</span>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}