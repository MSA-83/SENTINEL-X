import { useState } from "react"
import { 
  FolderPlus, 
  Search, 
  Filter, 
  Calendar,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  MoreHorizontal,
  Tag,
  Link2,
  FileText,
  MessageSquare
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// Mock case data
const MOCK_CASES = [
  {
    id: "CASE-001",
    title: "Unknown Aircraft Intercept",
    description: "Investigate unidentified aircraft entering restricted airspace",
    status: "open",
    priority: "critical",
    type: "threat_investigation",
    assignedTo: "John Doe",
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(),
    eventsLinked: 5,
    alertsLinked: 3,
  },
  {
    id: "CASE-002", 
    title: "GPS Jamming Analysis",
    description: "Analyze pattern of GPS interference in Eastern Mediterranean",
    status: "in_progress",
    priority: "high",
    type: "intelligence",
    assignedTo: "Jane Smith",
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 3600000),
    eventsLinked: 12,
    alertsLinked: 8,
  },
  {
    id: "CASE-003",
    title: "Vessel Tracking Anomaly",
    description: "Follow up on suspicious vessel movement patterns",
    status: "resolved",
    priority: "medium",
    type: "routine",
    assignedTo: "Bob Wilson",
    createdAt: new Date(Date.now() - 259200000),
    updatedAt: new Date(Date.now() - 7200000),
    eventsLinked: 3,
    alertsLinked: 2,
  },
  {
    id: "CASE-004",
    title: "Communications Intercept Review",
    description: "Review intercepted communications for threat indicators",
    status: "open",
    priority: "high",
    type: "investigation",
    assignedTo: "Alice Brown",
    createdAt: new Date(Date.now() - 43200000),
    updatedAt: new Date(Date.now() - 1800000),
    eventsLinked: 7,
    alertsLinked: 4,
  },
]

const STATUS_CONFIG = {
  open: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertCircle },
  in_progress: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  resolved: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  closed: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: CheckCircle },
}

const PRIORITY_CONFIG = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-green-500 text-white",
}

interface CaseManagementPageProps {
  className?: string
}

export function CaseManagementPage({ className }: CaseManagementPageProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>(["open", "in_progress", "resolved", "closed"])
  const [priorityFilter, setPriorityFilter] = useState<string[]>(["critical", "high", "medium", "low"])
  const [selectedCase, setSelectedCase] = useState<typeof MOCK_CASES[0] | null>(null)

  // Filter cases
  const filteredCases = MOCK_CASES.filter(c => {
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (!statusFilter.includes(c.status)) return false
    if (!priorityFilter.includes(c.priority)) return false
    return true
  })

  return (
    <div className={cn("h-screen flex flex-col bg-slate-950", className)}>
      {/* Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl font-bold tracking-wider text-cyan-400">
            CASE MANAGEMENT
          </h1>
          <Badge variant="outline">{filteredCases.length} cases</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
          <Button size="sm" className="bg-cyan-500 hover:bg-cyan-600">
            <FolderPlus className="h-4 w-4 mr-1" />
            New Case
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Cases List */}
        <div className="w-1/2 border-r border-slate-800 flex flex-col">
          {/* Search & Filters */}
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700"
              />
            </div>
            <div className="flex gap-2">
              {Object.keys(STATUS_CONFIG).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(prev => 
                    prev.includes(status) 
                      ? prev.filter(s => s !== status)
                      : [...prev, status]
                  )}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full font-mono capitalize transition-colors",
                    statusFilter.includes(status)
                      ? STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].color
                      : "bg-slate-800 text-slate-500"
                  )}
                >
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Cases Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-900">
                <TableRow className="hover:bg-slate-800/50 border-slate-800">
                  <TableHead className="text-slate-400">Case</TableHead>
                  <TableHead className="text-slate-400">Priority</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Assignee</TableHead>
                  <TableHead className="text-slate-400">Links</TableHead>
                  <TableHead className="text-slate-400">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map((c) => (
                  <TableRow 
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className={cn(
                      "cursor-pointer hover:bg-slate-800/50 border-slate-800",
                      selectedCase?.id === c.id && "bg-cyan-500/10"
                    )}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-200">{c.title}</div>
                        <div className="text-xs text-slate-500 font-mono">{c.id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-0.5 text-xs font-mono rounded",
                        PRIORITY_CONFIG[c.priority as keyof typeof PRIORITY_CONFIG]
                      )}>
                        {c.priority.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-0.5 text-xs font-mono rounded capitalize border",
                        STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG].color
                      )}>
                        {c.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {c.assignedTo}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <span className="text-xs text-slate-500">
                          <Link2 className="h-3 w-3 inline mr-1" />
                          {c.eventsLinked}
                        </span>
                        <span className="text-xs text-slate-500">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          {c.alertsLinked}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {formatDate(c.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Case Detail Panel */}
        <div className="w-1/2 flex flex-col">
          {selectedCase ? (
            <>
              <div className="p-4 border-b border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        "px-2 py-0.5 text-xs font-mono rounded",
                        PRIORITY_CONFIG[selectedCase.priority as keyof typeof PRIORITY_CONFIG]
                      )}>
                        {selectedCase.priority.toUpperCase()}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 text-xs font-mono rounded capitalize border",
                        STATUS_CONFIG[selectedCase.status as keyof typeof STATUS_CONFIG].color
                      )}>
                        {selectedCase.status.replace("_", " ")}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-white">{selectedCase.title}</h2>
                    <p className="text-sm text-slate-400 mt-1">{selectedCase.description}</p>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Case Info */}
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-400">Case Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500">Case ID</div>
                      <div className="font-mono text-cyan-400">{selectedCase.id}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Type</div>
                      <div className="capitalize">{selectedCase.type.replace("_", " ")}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Assigned To</div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {selectedCase.assignedTo}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Created</div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(selectedCase.createdAt)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Linked Items */}
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-400">Linked Items</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-slate-800">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-cyan-400" />
                        <span>Threat Events</span>
                      </div>
                      <Badge>{selectedCase.eventsLinked}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-800">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-400" />
                        <span>Alerts</span>
                      </div>
                      <Badge>{selectedCase.alertsLinked}</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Add Note
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <FileText className="h-4 w-4 mr-1" />
                    Add Evidence
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Select a case to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

export default CaseManagementPage