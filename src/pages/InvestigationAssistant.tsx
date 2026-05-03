import { useState, useRef, useEffect } from "react"
import { 
  Bot, 
  User, 
  Send, 
  Sparkles, 
  Loader2,
  AlertTriangle,
  Target,
  TrendingUp,
  FileText,
  MessageSquare,
  Clock,
  ChevronRight,
  Zap,
  Brain,
  Search,
  Shield,
  Plane,
  Building,
  MapPin,
  Lightbulb,
  CheckCircle,
  XCircle,
  ArrowRight,
  Mic,
  FileSearch,
  Link2,
  Cpu
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  sources?: { title: string; type: string; relevance: number }[]
  actions?: { label: string; type: string; payload: any }[]
  thinking?: string
}

interface InvestigationResult {
  threat_id: string
  title: string
  description: string
  severity: "critical" | "high" | "medium" | "low"
  confidence: number
  linked_entities: { name: string; type: string; relationship: string }[]
  recommended_actions: { priority: number; action: string }[]
  timeline: { timestamp: string; event: string }[]
}

interface QuickAnalysis {
  label: string
  icon: React.ComponentType<{ className?: string }>
  query: string
}

interface InvestigationAssistantProps {
  className?: string
}

const QUICK_ANALYSES: QuickAnalysis[] = [
  { label: "Analyze Threat", icon: Target, query: "Analyze recent critical threat patterns" },
  { label: "Entity Search", icon: Search, query: "Find aircraft with unusual flight patterns" },
  { label: "Risk Assessment", icon: Shield, query: "Provide risk assessment for current threats" },
  { label: "Timeline Review", icon: Clock, query: "Review timeline of recent incidents" },
  { label: "Entity Graph", icon: Link2, query: "Show entity relationship network" },
  { label: "Generate Report", icon: FileText, query: "Generate investigation report" },
]

const SAMPLE_RESULTS: InvestigationResult[] = [
  {
    threat_id: "THREAT-2024-001",
    title: "Unknown Aircraft Cluster - Eastern Mediterranean",
    description: "Multiple unknown aircraft detected operating without transponder signals in restricted airspace. Analysis suggests potential coordinated incursion.",
    severity: "critical",
    confidence: 0.92,
    linked_entities: [
      { name: "UAV-X99", type: "aircraft", relationship: "primary" },
      { name: "TANKER-01", type: "vessel", relationship: "support" },
      { name: "COMMS-NODE-42", type: "signal", relationship: "intercepted" },
    ],
    recommended_actions: [
      { priority: 1, action: "Alert air defense assets" },
      { priority: 2, action: "Begin interception procedure" },
      { priority: 3, action: "Link to active case CASE-2024-0156" },
    ],
    timeline: [
      { timestamp: "2024-01-15T14:30:00Z", event: "First detection" },
      { timestamp: "2024-01-15T14:35:00Z", event: "Cluster expanded to 3 contacts" },
      { timestamp: "2024-01-15T14:40:00Z", event: "Signal intercept detected" },
      { timestamp: "2024-01-15T14:45:00Z", event: "Alert generated" },
    ],
  },
]

export function InvestigationAssistant({ className }: InvestigationAssistantProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content: "Investigation Assistant ready. I can help you analyze threats, find entity connections, generate reports, and provide actionable intelligence.",
      timestamp: new Date(),
    },
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<InvestigationResult | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return
    
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsProcessing(true)
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const assistantMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: getInvestigationResponse(input),
      timestamp: new Date(),
      sources: [
        { title: "Threat Database", type: "database", relevance: 0.95 },
        { title: "Entity Graph", type: "graph", relevance: 0.87 },
        { title: "Historical Patterns", type: "analytics", relevance: 0.72 },
      ],
      actions: [
        { label: "View Details", type: "detail", payload: SAMPLE_RESULTS[0] },
        { label: "Create Case", type: "create", payload: { type: "case" } },
        { label: "Share Intel", type: "share", payload: {} },
      ],
      thinking: "Analyzing threat patterns and entity connections...",
    }
    
    setMessages(prev => [...prev, assistantMessage])
    setIsProcessing(false)
  }

  const getInvestigationResponse = (query: string): string => {
    const q = query.toLowerCase()
    
    if (q.includes("critical") || q.includes("high severity")) {
      return "Analysis complete. Found 3 critical threats requiring immediate attention:\n\n**1. THREAT-2024-001** (Critical, 92% confidence)\nUnknown aircraft cluster in Eastern Mediterranean region. Linked to 3 entities.\n\n**2. THREAT-2024-002** (Critical, 88% confidence)\nGPS interference pattern detected near strategic location.\n\n**3. THREAT-2024-003** (Critical, 85% confidence)\nUnusual vessel movement in restricted zone.\n\nRecommended action: Create investigation case for THREAT-2024-001."
    }
    
    if (q.includes("entity") || q.includes("aircraft") || q.includes("vessel")) {
      return "Entity search results:\n\n**UAV-X99** (Critical)\n- Type: Unmanned Aerial Vehicle\n- Last seen: 34.05°N, 118.24°W\n- Status: Active, no transponder\n- Linked to: 2 cases, 5 threats\n\n**TANKER-01** (High Risk)\n- Type: Commercial Vessel\n- Flag: Unknown\n- Risk indicators: AIS mismatch, unusual route\n\nWould you like to view full entity profiles or link to a case?"
    }
    
    if (q.includes("report") || q.includes("summary")) {
      return "Generating investigation report...\n\n## Daily Threat Assessment\n- Total threats: 47\n- Critical: 3 (6.4%)\n- High: 12 (25.5%)\n- Medium: 21 (44.7%)\n- Low: 11 (23.4%)\n\n## Top Regions\n1. Eastern Mediterranean - 18 threats\n2. South China Sea - 12 threats\n3. Baltic Sea - 9 threats\n\n## Recommendations\n1. Increase surveillance in Eastern Mediterranean\n2. Review pending cases for resource allocation\n3. Update threat criteria for GPS interference\n\nReport saved to investigations/"
    }
    
    return "Investigation analysis complete. Current threat landscape shows elevated activity in multiple regions. Would you like me to:\n\n1. **Analyze specific threat** - Enter threat ID\n2. **Search entities** - Search by name/callsign\n3. **Generate report** - Create daily/weekly summary\n4. **Link to case** - Connect entities to existing case\n\nHow can I assist your investigation?"
  }

  const handleQuickAnalysis = (analysis: QuickAnalysis) => {
    setInput(analysis.query)
  }

  const handleAction = (action: { label: string; type: string; payload: any }) => {
    if (action.type === "detail") {
      setSelectedAnalysis(action.payload)
    } else if (action.type === "create") {
      setInput(`Create new case for: ${selectedAnalysis?.title || "selected threat"}`)
    }
  }

  const severityColors = {
    critical: "bg-red-500 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-yellow-500 text-black",
    low: "bg-green-500 text-white",
  }

  return (
    <div className={cn("h-full flex flex-col bg-slate-950", className)}>
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Bot className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-wider text-cyan-400">
                INVESTIGATION ASSISTANT
              </h1>
              <p className="text-xs text-slate-500">AI-Powered Threat Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Groq Model
            </Badge>
            <Button variant="ghost" size="sm">
              <FileText className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r border-slate-800 p-4 space-y-4">
          <div>
            <h3 className="text-xs font-mono text-slate-500 mb-3">QUICK ANALYSIS</h3>
            <div className="space-y-2">
              {QUICK_ANALYSES.map((analysis, i) => {
                const Icon = analysis.icon
                return (
                  <button
                    key={i}
                    onClick={() => handleQuickAnalysis(analysis)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/30 transition-all text-left"
                  >
                    <Icon className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm text-slate-300">{analysis.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono text-slate-500 mb-3">ACTIVE INVESTIGATIONS</h3>
            <div className="space-y-2">
              {SAMPLE_RESULTS.map((result, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedAnalysis(result)}
                  className={cn(
                    "w-full p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/30 transition-all text-left",
                    selectedAnalysis?.threat_id === result.threat_id && "border-cyan-500"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-slate-500">{result.threat_id}</span>
                    <Badge className={severityColors[result.severity]}>
                      {result.severity}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-300 line-clamp-2">{result.title}</div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <span>{Math.round(result.confidence * 100)}% confidence</span>
                    <span>•</span>
                    <span>{result.linked_entities.length} entities</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono text-slate-500 mb-3">STATISTICS</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded bg-slate-900">
                <div className="text-2xl font-bold text-white">47</div>
                <div className="text-xs text-slate-500">Active Threats</div>
              </div>
              <div className="p-3 rounded bg-slate-900">
                <div className="text-2xl font-bold text-red-400">3</div>
                <div className="text-xs text-slate-500">Critical</div>
              </div>
              <div className="p-3 rounded bg-slate-900">
                <div className="text-2xl font-bold text-white">156</div>
                <div className="text-xs text-slate-500">Entities</div>
              </div>
              <div className="p-3 rounded bg-slate-900">
                <div className="text-2xl font-bold text-cyan-400">12</div>
                <div className="text-xs text-slate-500">Open Cases</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "flex-row-reverse" : ""
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    msg.role === "assistant" ? "bg-cyan-500/20" : 
                    msg.role === "system" ? "bg-purple-500/20" : "bg-slate-700"
                  )}>
                    {msg.role === "assistant" ? <Bot className="h-4 w-4 text-cyan-400" /> :
                     msg.role === "system" ? <Brain className="h-4 w-4 text-purple-400" /> :
                     <User className="h-4 w-4 text-slate-300" />}
                  </div>
                  <div className={cn(
                    "max-w-[70%] p-4 rounded-lg",
                    msg.role === "assistant" ? "bg-slate-900 border border-slate-800" : 
                    msg.role === "system" ? "bg-purple-500/10 border border-purple-500/30" : "bg-slate-800"
                  )}>
                    {msg.thinking && (
                      <div className="flex items-center gap-2 mb-2 text-xs text-cyan-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {msg.thinking}
                      </div>
                    )}
                    <div className="text-sm text-slate-200 whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <div className="text-xs text-slate-500 mb-2">Sources</div>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((source, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              {source.title} ({Math.round(source.relevance * 100)}%)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
                        {msg.actions.map((action, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(action)}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    <div className="text-xs text-slate-500 mt-2">
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                      <span className="text-sm text-slate-400">Analyzing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-slate-800">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask about threats, entities, or request investigation..."
                className="min-h-[60px] bg-slate-900 border-slate-700"
              />
              <Button 
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <span>Powered by Groq • Ctrl+K for AI suggestions</span>
            </div>
          </div>
        </div>

        {selectedAnalysis && (
          <div className="w-96 border-l border-slate-800 p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Analysis Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedAnalysis(null)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge className={severityColors[selectedAnalysis.severity]}>
                  {selectedAnalysis.severity.toUpperCase()}
                </Badge>
                <span className="text-sm text-slate-400">
                  {Math.round(selectedAnalysis.confidence * 100)}% confidence
                </span>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">Threat ID</div>
                <div className="font-mono text-cyan-400">{selectedAnalysis.threat_id}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">Title</div>
                <div className="text-slate-200">{selectedAnalysis.title}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">Description</div>
                <div className="text-sm text-slate-400">{selectedAnalysis.description}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-2">Linked Entities</div>
                <div className="space-y-2">
                  {selectedAnalysis.linked_entities.map((entity, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-900">
                      <div className="flex items-center gap-2">
                        {entity.type === "aircraft" ? <Plane className="h-3 w-3 text-cyan-400" /> :
                         entity.type === "vessel" ? <MapPin className="h-3 w-3 text-blue-400" /> :
                         <Cpu className="h-3 w-3 text-orange-400" />}
                        <span className="text-sm text-slate-300">{entity.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {entity.relationship}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-2">Recommended Actions</div>
                <div className="space-y-2">
                  {selectedAnalysis.recommended_actions.sort((a, b) => a.priority - b.priority).map((action, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-slate-900">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <span className="text-xs text-cyan-400">{action.priority}</span>
                      </div>
                      <span className="text-sm text-slate-300">{action.action}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-2">Timeline</div>
                <div className="space-y-2">
                  {selectedAnalysis.timeline.map((event, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span className="text-slate-400">{event.timestamp}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-slate-300">{event.event}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1">
                  <FileText className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button variant="outline" className="flex-1">
                  <Link2 className="h-4 w-4 mr-1" />
                  Link to Case
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InvestigationAssistant