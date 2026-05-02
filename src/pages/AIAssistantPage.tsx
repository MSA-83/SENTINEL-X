import { useState, useRef, useEffect } from "react"
import { 
  Send,
  Bot,
  User,
  Sparkles,
  Copy,
  RefreshCw,
  Zap,
  AlertTriangle,
  MapPin,
  Clock,
  ChevronRight,
  Terminal
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  tools_used?: string[]
  sources?: { title: string; url: string }[]
}

interface QuickAction {
  id: string
  label: string
  icon: "map" | "alert" | "search" | "analysis"
  query: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "q1", label: "Show Critical Threats", icon: "alert", query: "Show all critical severity threats in the last 24 hours" },
  { id: "q2", label: "Map Overview", icon: "map", query: "Display threat activity on the command center map" },
  { id: "q3", label: "Analyze Patterns", icon: "analysis", query: "Analyze recent threat patterns and trends" },
  { id: "q4", label: "Search Intel", icon: "search", query: "Search for aircraft incursions in the Mediterranean region" },
]

const MOCK_RESPONSES: Record<string, string> = {
  "critical": "I've identified 23 critical threats in the last 24 hours. The highest concentration is in the Eastern Mediterranean region (14 threats), primarily involving unknown aircraft incursions. Recommend immediate attention to 3 new incursions detected within the last hour.",
  "patterns": "Analysis of the past 7 days reveals three significant patterns:\n\n1. **Aircraft Incursions** (+45%): Unknown aircraft entering restricted airspace, primarily in the Eastern Mediterranean and Baltic Sea regions.\n\n2. **GPS Interference** (+23%): Concentrated around conflict zones, with 156 recorded instances.\n\n3. **AIS Spoofing** (+12%): Suspected vessel identity manipulation in the South China Sea.\n\nThe ML model confidence for pattern detection is 87%.",
  "overview": "Current threat landscape summary:\n\n• **Total Active Threats**: 1,247\n• **Critical**: 23 (+12.5%)\n• **High**: 87 (+8.3%)\n• **Medium**: 234 (-3.2%)\n• **Low**: 903 (+15.7%)\n\nMost active region: Eastern Mediterranean (234 threats)\nMost active type: Aircraft Incursions (234 events)",
}

interface AIAssistantPageProps {
  className?: string
}

export function AIAssistantPage({ className }: AIAssistantPageProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello. I'm SENTINEL-X AI Assistant, powered by Groq. I can help you with threat analysis, entity tracking, case management, and pattern recognition.\n\nTry asking me about:\n• Current threat activity\n• Specific entities or cases\n• Trend analysis\n• Region-based intelligence\n\nWhat would you like to know?",
      timestamp: new Date(),
      tools_used: [],
    },
  ])
  const [isProcessing, setIsProcessing] = useState(false)
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
    
    // Simulate Groq API response
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Generate response based on input keywords
    let responseContent = ""
    const query = input.toLowerCase()
    
    if (query.includes("critical")) {
      responseContent = MOCK_RESPONSES["critical"]
    } else if (query.includes("pattern") || query.includes("trend") || query.includes("analyze")) {
      responseContent = MOCK_RESPONSES["patterns"]
    } else if (query.includes("overview") || query.includes("summary") || query.includes("total")) {
      responseContent = MOCK_RESPONSES["overview"]
    } else if (query.includes("aircraft") || query.includes("vessel") || query.includes("entity")) {
      responseContent = "I've found 5 relevant entities matching your query:\n\n1. **Unknown-2024-A892** (Critical): Unknown aircraft, last seen 5 min ago near coordinates 34.05°N, 118.24°W\n\n2. **MV OCEAN PRIDE** (Low): Commercial vessel, last seen 1h ago near coordinates 25.76°N, 80.19°W\n\n3. **IL-76TD** (Medium): Military aircraft, last seen 2h ago near coordinates 41.90°N, 12.50°E\n\nWould you like me to link any of these to a case or provide more details?"
    } else {
      responseContent = "I've analyzed your query and retrieved relevant intelligence. Based on the current dataset, here's what I found:\n\nThe threat landscape shows elevated activity in multiple regions. Would you like me to drill down into specific threat types, regions, or time periods?\n\nI can also help you:\n• Create new cases from detected threats\n• Link entities to existing investigations\n• Generate analytical reports\n• Set up automated alerts",
    }
    
    const assistantMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: responseContent,
      timestamp: new Date(),
      tools_used: ["threat_query", "entity_search"],
    }
    
    setMessages(prev => [...prev, assistantMessage])
    setIsProcessing(false)
  }

  const handleQuickAction = (action: QuickAction) => {
    setInput(action.query)
  }

  return (
    <div className={cn("h-screen flex flex-col bg-slate-950", className)}>
      <header className="h-14 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl font-bold tracking-wider text-cyan-400">
            AI ASSISTANT
          </h1>
          <Badge variant="outline" className="gap-1">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Groq Model
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button variant="ghost" size="sm">
            <Copy className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Quick Actions Sidebar */}
        <div className="w-64 border-r border-slate-800 p-4 space-y-4">
          <div>
            <h3 className="text-xs font-mono text-slate-500 mb-3">QUICK ACTIONS</h3>
            <div className="space-y-2">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action)}
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm text-slate-300">{action.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono text-slate-500 mb-3">AVAILABLE TOOLS</h3>
            <div className="space-y-2">
              {[
                { name: "threat_query", desc: "Query threat database" },
                { name: "entity_search", desc: "Search tracked entities" },
                { name: "case_management", desc: "Create/manage cases" },
                { name: "geo_analysis", desc: "Geographic analysis" },
              ].map(tool => (
                <div key={tool.name} className="p-2 rounded bg-slate-900 text-xs">
                  <div className="text-cyan-400 font-mono">{tool.name}</div>
                  <div className="text-slate-500">{tool.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={cn(
                "flex gap-3",
                msg.role === "user" ? "flex-row-reverse" : ""
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  msg.role === "assistant" ? "bg-cyan-500/20" : "bg-slate-700"
                )}>
                  {msg.role === "assistant" 
                    ? <Bot className="h-4 w-4 text-cyan-400" />
                    : <User className="h-4 w-4 text-slate-300" />
                  }
                </div>
                <div className={cn(
                  "max-w-[70%] p-3 rounded-lg",
                  msg.role === "assistant" 
                    ? "bg-slate-900 border border-slate-800" 
                    : "bg-slate-800"
                )}>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap">
                    {msg.content}
                  </div>
                  {msg.tools_used && msg.tools_used.length > 0 && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-slate-700">
                      <Terminal className="h-3 w-3 text-slate-500" />
                      {msg.tools_used.map(tool => (
                        <Badge key={tool} variant="outline" className="text-[10px]">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">
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
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-cyan-400 animate-pulse" />
                    <span className="text-sm text-slate-400">Processing query...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
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
                placeholder="Ask about threats, entities, or intelligence..."
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
            <div className="text-xs text-slate-500 mt-2">
              Press Enter to send, Shift+Enter for new line • Powered by Groq
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIAssistantPage