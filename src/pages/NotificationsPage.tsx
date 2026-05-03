import { useState, useEffect, useCallback } from "react"
import { 
  Bell, 
  BellOff, 
  Check, 
  X, 
  Settings,
  Mail,
  Smartphone,
  Webhook,
  Volume2,
  VolumeX,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle,
  MoreVertical
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: "alert" | "info" | "warning" | "success"
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionLabel?: string
  actionUrl?: string
}

interface NotificationPreferences {
  email: boolean
  push: boolean
  sms: boolean
  webhook: boolean
  sound: boolean
  quietHours: { enabled: boolean; start: number; end: number }
}

interface NotificationSystemProps {
  className?: string
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "alert",
    title: "Critical Threat Detected",
    message: "Unknown aircraft detected in restricted airspace near LA",
    timestamp: new Date(Date.now() - 300000),
    read: false,
    actionLabel: "View Details",
    actionUrl: "/threats/THREAT-001",
  },
  {
    id: "2",
    type: "warning",
    title: "GPS Interference",
    message: "Elevated GPS jamming detected in Eastern Mediterranean",
    timestamp: new Date(Date.now() - 1800000),
    read: false,
  },
  {
    id: "3",
    type: "success",
    title: "Case Resolved",
    message: "CASE-2024-0156 has been marked as resolved",
    timestamp: new Date(Date.now() - 3600000),
    read: true,
  },
  {
    id: "4",
    type: "info",
    title: "Data Sync Complete",
    message: "All data sources synchronized successfully",
    timestamp: new Date(Date.now() - 7200000),
    read: true,
  },
]

export function NotificationSystem({ className }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS)
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: true,
    push: true,
    sms: false,
    webhook: true,
    sound: true,
    quietHours: { enabled: false, start: 22, end: 7 },
  })
  const [showPreferences, setShowPreferences] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<string>("all")

  const unreadCount = notifications.filter(n => !n.read).length
  const filteredNotifications = selectedFilter === "all" 
    ? notifications 
    : notifications.filter(n => n.type === selectedFilter)

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "alert": return AlertTriangle
      case "warning": return AlertTriangle
      case "success": return CheckCircle
      case "info": return Info
      default: return Bell
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "alert": return "text-red-400 bg-red-500/20"
      case "warning": return "text-yellow-400 bg-yellow-500/20"
      case "success": return "text-green-400 bg-green-500/20"
      case "info": return "text-blue-400 bg-blue-500/20"
      default: return "text-slate-400 bg-slate-700"
    }
  }

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime()
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={cn("h-full flex flex-col bg-slate-950", className)}>
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Bell className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-wider text-cyan-400">
                NOTIFICATIONS
              </h1>
              <p className="text-xs text-slate-500">
                {unreadCount} unread
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowPreferences(!showPreferences)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {showPreferences && (
        <div className="p-4 border-b border-slate-800 bg-slate-900/50">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Notification Preferences</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-300">Email</span>
              </div>
              <Switch 
                checked={preferences.email}
                onCheckedChange={(checked) => setPreferences(p => ({ ...p, email: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-300">Push</span>
              </div>
              <Switch 
                checked={preferences.push}
                onCheckedChange={(checked) => setPreferences(p => ({ ...p, push: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-300">Webhook</span>
              </div>
              <Switch 
                checked={preferences.webhook}
                onCheckedChange={(checked) => setPreferences(p => ({ ...p, webhook: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-300">Sound</span>
              </div>
              <Switch 
                checked={preferences.sound}
                onCheckedChange={(checked) => setPreferences(p => ({ ...p, sound: checked }))}
              />
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Button 
            variant={selectedFilter === "all" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setSelectedFilter("all")}
          >
            All
          </Button>
          <Button 
            variant={selectedFilter === "alert" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setSelectedFilter("alert")}
          >
            Alerts
          </Button>
          <Button 
            variant={selectedFilter === "warning" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setSelectedFilter("warning")}
          >
            Warnings
          </Button>
          <Button 
            variant={selectedFilter === "info" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setSelectedFilter("info")}
          >
            Info
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <BellOff className="h-8 w-8 mb-2" />
              <div>No notifications</div>
            </div>
          ) : (
            filteredNotifications.map(notification => {
              const Icon = getTypeIcon(notification.type)
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all",
                    notification.read 
                      ? "bg-slate-900 border-slate-800" 
                      : "bg-slate-900 border-cyan-500/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      getTypeColor(notification.type)
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className={cn(
                            "font-medium",
                            notification.read ? "text-slate-400" : "text-white"
                          )}>
                            {notification.title}
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            {notification.message}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="h-3 w-3 text-slate-500" />
                            <span className="text-xs text-slate-500">
                              {formatTime(notification.timestamp)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {!notification.read && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => dismissNotification(notification.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {notification.actionLabel && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                        >
                          {notification.actionLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {notifications.length > 0 && (
        <div className="p-4 border-t border-slate-800">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={markAllAsRead}
            >
              Mark All Read
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={clearAll}
            >
              Clear All
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationSystem