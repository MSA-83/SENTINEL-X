import { useState } from "react"
import { 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Activity,
  Clock,
  Globe,
  Target,
  Zap,
  BarChart3
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Mock analytics data
const THREAT_STATS = {
  total: 1247,
  critical: 23,
  high: 87,
  medium: 234,
  low: 903,
  trend: +12.5,
}

const ACTIVITY_DATA = [
  { time: "00:00", critical: 2, high: 5, medium: 12, low: 45 },
  { time: "04:00", critical: 1, high: 3, medium: 8, low: 32 },
  { time: "08:00", critical: 5, high: 12, medium: 25, low: 67 },
  { time: "12:00", critical: 8, high: 18, medium: 34, low: 89 },
  { time: "16:00", critical: 4, high: 15, medium: 28, low: 76 },
  { time: "20:00", critical: 3, high: 9, medium: 19, low: 54 },
  { time: "24:00", critical: 2, high: 7, medium: 15, low: 43 },
]

const TOP_LOCATIONS = [
  { name: "Eastern Mediterranean", count: 234, trend: "up" },
  { name: "South China Sea", count: 189, trend: "up" },
  { name: "Baltic Sea", count: 156, trend: "down" },
  { name: "Persian Gulf", count: 134, trend: "stable" },
  { name: "Caribbean", count: 98, trend: "up" },
]

const TOP_PATTERNS = [
  { name: "Aircraft Incursions", count: 234, severity: "critical" },
  { name: "AIS Spoofing", count: 187, severity: "high" },
  { name: "GPS Interference", count: 156, severity: "high" },
  { name: "Comms Surveillance", count: 123, severity: "medium" },
  { name: "Radar Jamming", count: 89, severity: "medium" },
]

const SEVERITY_COLORS = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
}

interface AnalyticsDashboardProps {
  className?: string
}

export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h")

  return (
    <div className={cn("h-screen flex flex-col bg-slate-950", className)}>
      <header className="h-14 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl font-bold tracking-wider text-cyan-400">
            ANALYTICS
          </h1>
          <Badge variant="outline">Live</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <TabsList className="bg-slate-800">
              <TabsTrigger value="24h">24H</TabsTrigger>
              <TabsTrigger value="7d">7D</TabsTrigger>
              <TabsTrigger value="30d">30D</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Total Threats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {THREAT_STATS.total.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-sm text-green-400">
                <TrendingUp className="h-3 w-3" />
                +{THREAT_STATS.trend}%
              </div>
            </CardContent>
          </Card>

          {Object.entries({ critical: THREAT_STATS.critical, high: THREAT_STATS.high, medium: THREAT_STATS.medium, low: THREAT_STATS.low }).map(([severity, count]) => (
            <Card key={severity} className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className={cn("text-sm flex items-center gap-2", severity === "critical" ? "text-red-400" : severity === "high" ? "text-orange-400" : severity === "medium" ? "text-yellow-400" : "text-green-400")}>
                  <AlertTriangle className="h-4 w-4" />
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{count}</div>
                <div className="text-xs text-slate-500">
                  {((count / THREAT_STATS.total) * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Threat Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-1">
                {ACTIVITY_DATA.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-0.5 items-end" style={{ height: 160 }}>
                      <div 
                        className="flex-1 bg-red-500/60 rounded-t" 
                        style={{ height: `${(d.critical / 10) * 100}%` }} 
                      />
                      <div 
                        className="flex-1 bg-orange-500/60 rounded-t" 
                        style={{ height: `${(d.high / 20) * 100}%` }} 
                      />
                      <div 
                        className="flex-1 bg-yellow-500/60 rounded-t" 
                        style={{ height: `${(d.medium / 40) * 100}%` }} 
                      />
                      <div 
                        className="flex-1 bg-green-500/60 rounded-t" 
                        style={{ height: `${(d.low / 100) * 100}%` }} 
                      />
                    </div>
                    <span className="text-[10px] text-slate-500">{d.time}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-2 justify-center">
                {[
                  { label: "Critical", color: "bg-red-500" },
                  { label: "High", color: "bg-orange-500" },
                  { label: "Medium", color: "bg-yellow-500" },
                  { label: "Low", color: "bg-green-500" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1 text-xs">
                    <div className={cn("w-2 h-2 rounded", item.color)} />
                    <span className="text-slate-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Top Threat Patterns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {TOP_PATTERNS.map((pattern, i) => (
                <div key={pattern.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300">{pattern.name}</span>
                    <span className="text-sm font-mono text-slate-400">{pattern.count}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full", SEVERITY_COLORS[pattern.severity as keyof typeof SEVERITY_COLORS])} 
                      style={{ width: `${(pattern.count / 234) * 100}%` }} 
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Hotspots</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {TOP_LOCATIONS.map((loc, i) => (
                  <div key={loc.name} className="flex items-center justify-between p-2 rounded bg-slate-800">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm text-slate-300">{loc.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-slate-400">{loc.count}</span>
                      {loc.trend === "up" && <TrendingUp className="h-3 w-3 text-green-400" />}
                      {loc.trend === "down" && <TrendingDown className="h-3 w-3 text-red-400" />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded bg-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-slate-300">Data Ingestion</span>
                </div>
                <Badge className="bg-green-500/20 text-green-400">Operational</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-800">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-slate-300">Real-time Stream</span>
                </div>
                <Badge className="bg-green-500/20 text-green-400">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-800">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-slate-300">ML Pipeline</span>
                </div>
                <Badge className="bg-green-500/20 text-green-400">Running</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-slate-300">Last Sync</span>
                </div>
                <span className="text-xs text-slate-400">2 min ago</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsDashboard