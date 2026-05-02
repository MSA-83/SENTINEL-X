import { useState, createContext, useContext, ReactNode } from "react"
import {
  Bell,
  Map,
  AlertTriangle,
  FolderOpen,
  Users,
  BarChart3,
  Search,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"

interface SidebarProps {
  children?: ReactNode
  className?: string
}

interface NavItem {
  icon: ReactNode
  label: string
  href: string
  badge?: number
  severity?: "critical" | "high" | "medium" | "low"
}

const navItems: NavItem[] = [
  { icon: <Map />, label: "Threat Map", href: "/command-center" },
  { icon: <AlertTriangle />, label: "Live Feed", href: "/threat-feed", badge: 23, severity: "critical" },
  { icon: <Bell />, label: "Alerts", href: "/alerts", badge: 5, severity: "high" },
  { icon: <FolderOpen />, label: "Cases", href: "/cases", badge: 12 },
  { icon: <Users />, label: "Entities", href: "/entities" },
  { icon: <BarChart3 />, label: "Analytics", href: "/analytics" },
  { icon: <Search />, label: "Search", href: "/search" },
  { icon: <Bot />, label: "AI Assistant", href: "/ai-assistant" },
]

const bottomNavItems: NavItem[] = [
  { icon: <Settings />, label: "Settings", href: "/settings" },
  { icon: <LogOut />, label: "Sign Out", href: "/logout" },
]

interface SidebarContextType {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
})

export function SidebarProvider({ children }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function Sidebar() {
  const location = useLocation()
  const { collapsed, setCollapsed } = useContext(SidebarContext)
  
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-cyan-500 animate-pulse" />
            </div>
            <span className="font-display text-lg font-bold tracking-wider text-cyan-400">
              SENTINEL-X
            </span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      
      {/* Main Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative",
                    isActive
                      ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  )}
                >
                  <span className={cn("shrink-0", isActive ? "text-cyan-400" : "")}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            "px-2 py-0.5 text-xs font-mono font-bold rounded-full",
                            item.severity === "critical"
                              ? "bg-red-500/20 text-red-400"
                              : item.severity === "high"
                                ? "bg-orange-500/20 text-orange-400"
                                : "bg-slate-700 text-slate-300"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      
      {/* Bottom Navigation */}
      <div className="py-4 border-t border-slate-800 px-2">
        <ul className="space-y-1">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                    isActive
                      ? "bg-cyan-500/10 text-cyan-400"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
        
        {/* Quick Stats */}
        {!collapsed && (
          <div className="mt-4 mx-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-500 font-mono mb-2">SYSTEM STATUS</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Active Threats</span>
                <span className="text-red-400 font-mono">24</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Alerts</span>
                <span className="text-orange-400 font-mono">8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Open Cases</span>
                <span className="text-cyan-400 font-mono">12</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { collapsed } = useContext(SidebarContext)
  
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        {children}
      </main>
    </div>
  )
}