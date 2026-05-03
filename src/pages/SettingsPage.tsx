import { useState } from "react"
import { 
  Settings as SettingsIcon,
  User,
  Shield,
  Bell,
  Globe,
  Palette,
  Database,
  Key,
  Users,
  Mail,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  Check,
  AlertTriangle,
  Trash2,
  Plus,
  Download,
  Upload,
  Cpu,
  Activity,
  Map,
  Layers,
  Sliders
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface SettingsProps {
  className?: string
}

interface UserProfile {
  name: string
  email: string
  avatar: string
  role: string
  createdAt: string
}

interface SecuritySettings {
  mfaEnabled: boolean
  sessionTimeout: number
  passwordExpiry: number
  apiKeys: { name: string; key: string; lastUsed: string }[]
}

interface NotificationSettings {
  emailAlerts: boolean
  pushAlerts: boolean
  smsAlerts: boolean
  dailyDigest: boolean
  quietHours: { enabled: boolean; start: number; end: number }
}

interface DisplaySettings {
  theme: "dark" | "light" | "auto"
  compactMode: boolean
  showAnimations: boolean
  mapStyle: string
  dateFormat: string
}

export function SettingsPage({ className }: SettingsProps) {
  const [activeTab, setActiveTab] = useState("profile")

  const [profile, setProfile] = useState<UserProfile>({
    name: "John Doe",
    email: "john.doe@sentinel-x.com",
    avatar: "",
    role: "admin",
    createdAt: "2024-01-15",
  })

  const [security, setSecurity] = useState<SecuritySettings>({
    mfaEnabled: true,
    sessionTimeout: 30,
    passwordExpiry: 90,
    apiKeys: [
      { name: "Production", key: "sk_live_****...****3f2a", lastUsed: "2 hours ago" },
      { name: "Development", key: "sk_test_****...****8b1c", lastUsed: "5 days ago" },
    ],
  })

  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailAlerts: true,
    pushAlerts: true,
    smsAlerts: false,
    dailyDigest: true,
    quietHours: { enabled: false, start: 22, end: 7 },
  })

  const [display, setDisplay] = useState<DisplaySettings>({
    theme: "dark",
    compactMode: false,
    showAnimations: true,
    mapStyle: "dark",
    dateFormat: "MM/DD/YYYY",
  })

  const [newApiKeyName, setNewApiKeyName] = useState("")

  const saveSettings = () => {
    console.log("Saving settings...")
  }

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "display", label: "Display", icon: Palette },
    { id: "integrations", label: "Integrations", icon: Layers },
  ]

  return (
    <div className={cn("h-full flex flex-col bg-slate-950", className)}>
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <SettingsIcon className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold tracking-wider text-cyan-400">
              SETTINGS
            </h1>
            <p className="text-xs text-slate-500">Manage your account and preferences</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-slate-800 p-4 space-y-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  activeTab === tab.id
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <ScrollArea className="flex-1 p-6">
          {activeTab === "profile" && (
            <div className="space-y-6 max-w-2xl">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle>User Profile</CardTitle>
                  <CardDescription>Manage your personal information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center text-2xl font-bold text-cyan-400">
                      {profile.name.charAt(0)}
                    </div>
                    <Button variant="outline" size="sm">Change Avatar</Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-400">Name</label>
                      <Input
                        value={profile.name}
                        onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Email</label>
                      <Input
                        value={profile.email}
                        onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">Role</label>
                    <Badge className="mt-1 bg-cyan-500/20 text-cyan-400">
                      {profile.role.toUpperCase()}
                    </Badge>
                  </div>

                  <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={saveSettings}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6 max-w-2xl">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Manage your security preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded bg-slate-800">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-cyan-400" />
                      <div>
                        <div className="font-medium">Two-Factor Authentication</div>
                        <div className="text-sm text-slate-500">Add an extra layer of security</div>
                      </div>
                    </div>
                    <Switch
                      checked={security.mfaEnabled}
                      onCheckedChange={(checked) => setSecurity(s => ({ ...s, mfaEnabled: checked }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-400">Session Timeout (minutes)</label>
                      <Select
                        value={String(security.sessionTimeout)}
                        onValueChange={(v) => setSecurity(s => ({ ...s, sessionTimeout: parseInt(v) }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Password Expiry (days)</label>
                      <Select
                        value={String(security.passwordExpiry)}
                        onValueChange={(v) => setSecurity(s => ({ ...s, passwordExpiry: parseInt(v) }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={saveSettings}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>Manage your API keys for external integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {security.apiKeys.map((apiKey, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded bg-slate-800">
                      <div>
                        <div className="font-medium">{apiKey.name}</div>
                        <div className="text-sm text-slate-500 font-mono">{apiKey.key}</div>
                        <div className="text-xs text-slate-500">Last used: {apiKey.lastUsed}</div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <Input
                      placeholder="API key name"
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Generate Key
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6 max-w-2xl">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle>Notification Channels</CardTitle>
                  <CardDescription>Choose how you want to receive notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded bg-slate-800">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="font-medium">Email Alerts</div>
                        <div className="text-sm text-slate-500">Receive alerts via email</div>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.emailAlerts}
                      onCheckedChange={(checked) => setNotifications(n => ({ ...n, emailAlerts: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded bg-slate-800">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="font-medium">Push Notifications</div>
                        <div className="text-sm text-slate-500">Browser push notifications</div>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.pushAlerts}
                      onCheckedChange={(checked) => setNotifications(n => ({ ...n, pushAlerts: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded bg-slate-800">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="font-medium">SMS Alerts</div>
                        <div className="text-sm text-slate-500">Text message alerts</div>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.smsAlerts}
                      onCheckedChange={(checked) => setNotifications(n => ({ ...n, smsAlerts: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded bg-slate-800">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="font-medium">Daily Digest</div>
                        <div className="text-sm text-slate-500">Daily summary of activity</div>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.dailyDigest}
                      onCheckedChange={(checked) => setNotifications(n => ({ ...n, dailyDigest: checked }))}
                    />
                  </div>

                  <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={saveSettings}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "display" && (
            <div className="space-y-6 max-w-2xl">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle>Display Settings</CardTitle>
                  <CardDescription>Customize your SENTINEL-X experience</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400">Theme</label>
                    <Select
                      value={display.theme}
                      onValueChange={(v) => setDisplay(d => ({ ...d, theme: v as any }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">Map Style</label>
                    <Select
                      value={display.mapStyle}
                      onValueChange={(v) => setDisplay(d => ({ ...d, mapStyle: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="satellite">Satellite</SelectItem>
                        <SelectItem value="terrain">Terrain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded bg-slate-800">
                    <div>
                      <div className="font-medium">Compact Mode</div>
                      <div className="text-sm text-slate-500">Reduce spacing and padding</div>
                    </div>
                    <Switch
                      checked={display.compactMode}
                      onCheckedChange={(checked) => setDisplay(d => ({ ...d, compactMode: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded bg-slate-800">
                    <div>
                      <div className="font-medium">Animations</div>
                      <div className="text-sm text-slate-500">Enable animations and transitions</div>
                    </div>
                    <Switch
                      checked={display.showAnimations}
                      onCheckedChange={(checked) => setDisplay(d => ({ ...d, showAnimations: checked }))}
                    />
                  </div>

                  <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={saveSettings}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-6 max-w-2xl">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>Connect with external services</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "Slack", status: "connected" },
                    { name: "Microsoft Teams", status: "not_connected" },
                    { name: "Jira", status: "not_connected" },
                    { name: "ServiceNow", status: "not_connected" },
                  ].map((integration, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded bg-slate-800">
                      <div className="font-medium">{integration.name}</div>
                      <Badge className={
                        integration.status === "connected" 
                          ? "bg-green-500/20 text-green-400" 
                          : "bg-slate-700 text-slate-400"
                      }>
                        {integration.status === "connected" ? "Connected" : "Connect"}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}

export default SettingsPage