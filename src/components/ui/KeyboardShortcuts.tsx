import { useState, useEffect } from "react"
import { X,Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface KeyboardShortcut {
  key: string
  description: string
  action?: string
}

const SHORTCUTS: KeyboardShortcut[] = [
  { key: "/", description: "Focus search" },
  { key: "Ctrl + C", description: "Create new case" },
  { key: "Ctrl + T", description: "Create new threat" },
  { key: "Ctrl + S", description: "Save current" },
  { key: "Ctrl + K", description: "Open AI assistant" },
  { key: "Esc", description: "Close modal/popup" },
  { key: "↑ / ↓", description: "Navigate list items" },
  { key: "Enter", description: "Select/open item" },
  { key: "Delete", description: "Delete selected" },
  { key: "?", description: "Show this help" },
  { key: "M", description: "Toggle map view" },
  { key: "F", description: "Toggle fullscreen" },
  { key: "R", description: "Refresh data" },
]

interface KeyboardShortcutsModalProps {
  className?: string
}

export function KeyboardShortcutsModal({ className }: KeyboardShortcutsModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Listen for ? key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" || (e.shiftKey && e.key === "/") {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className={cn("max-w-md bg-slate-900 border-slate-700", className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-cyan-400" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-2 mt-4">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between p-2 rounded bg-slate-800"
            >
              <span className="text-sm text-slate-400">{shortcut.description}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-slate-700 rounded text-slate-300">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        
        <div className="flex justify-end mt-4">
          <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Floating help button
export function HelpButton({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn("fixed bottom-4 right-4 z-50", className)}
      >
        <Keyboard className="h-4 w-4 mr-1" />
        ?
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-cyan-400" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-2 mt-4">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between p-2 rounded bg-slate-800"
              >
                <span className="text-sm text-slate-400">{shortcut.description}</span>
                <kbd className="px-2 py-1 text-xs font-mono bg-slate-700 rounded text-slate-300">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default KeyboardShortcutsModal