"""
SENTINEL-X Accessibility Utilities
Keyboard navigation, focus management, screen reader support
"""
import { useEffect, useCallback, useRef, useState } from "react"
import { useEffect } from "react"

type KeyboardShortcut = {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
}

const SHORTCUTS: Record<string, KeyboardShortcut> = {
  "search": { key: "/", description: "Focus search" },
  "newCase": { key: "c", ctrl: true, description: "Create case" },
  "newThreat": { key: "t", ctrl: true, description: "Create threat" },
  "save": { key: "s", ctrl: true, description: "Save" },
  "escape": { key: "Escape", description: "Close modal" },
  "arrowUp": { key: "ArrowUp", description: "Previous item" },
  "arrowDown": { key: "ArrowDown", description: "Next item" },
  "enter": { key: "Enter", description: "Select/open" },
  "delete": { key: "Delete", description: "Delete" },
  "question": { key: "?", shift: true, description: "Show help" },
}

// Keyboard shortcuts hook
export function useKeyboardShortcuts(
  handlers: Record<string, (event: KeyboardEvent) => void>
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key
      const ctrl = event.ctrlKey || event.metaKey
      const shift = event.shiftKey
      const alt = event.altKey

      // Check for matching shortcut
      const shortcut = SHORTCUTS[key]
      if (!shortcut) return

      // Verify modifiers match
      const ctrlMatch = shortcut.ctrl ? ctrl : !ctrl
      const shiftMatch = shortcut.shift ? shift : !shift
      const altMatch = shortcut.alt ? alt : !alt

      if (ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault()
        const handler = handlers[key]
        if (handler) handler(event)
      }
    },
    [handlers]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}

// Focus trap hook for modals
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isActive) return

    const container = containerRef.current
    if (!container) return

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    firstElement?.focus()

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener("keydown", handleTab)
    return () => container.removeEventListener("keydown", handleTab)
  }, [isActive])

  return containerRef
}

// Announce to screen readers
export function useLiveRegion() {
  const [message, setMessage] = useState("")

  const announce = useCallback((text: string) => {
    setMessage("")
    setTimeout(() => setMessage(text), 100)
  }, [])

  return { message, announce }
}

// Focus ring management
export function useFocusManagement() {
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  const saveFocus = useCallback(() => {
    lastFocusedRef.current = document.activeElement as HTMLElement
  }, [])

  const restoreFocus = useCallback(() => {
    lastFocusedRef.current?.focus()
  }, [])

  return { saveFocus, restoreFocus }
}

// Skip link hook
export function useSkipLink(targetId: string) {
  useEffect(() => {
    const element = document.getElementById(targetId)
    if (element) {
      element.tabIndex = -1
      element.focus()
    }
  }, [targetId])
}

// Keyboard nav for lists
export function useListKeyboardNav(
  items: any[],
  onSelect: (index: number) => void,
  options: { wrap?: boolean } = {}
) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { wrap = true } = options

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault()
          setSelectedIndex((prev) => {
            const next = prev - 1
            return next < 0 ? (wrap ? items.length - 1 : 0) : next
          })
          break

        case "ArrowDown":
          event.preventDefault()
          setSelectedIndex((prev) => {
            const next = prev + 1
            return next >= items.length ? (wrap ? 0 : items.length - 1) : next
          })
          break

        case "Enter":
        case " ":
          event.preventDefault()
          onSelect(selectedIndex)
          break
      }
    },
    [items.length, onSelect, selectedIndex, options]
  )

  return { selectedIndex, handleKeyDown }
}

// Reduced motion hook
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  return prefersReducedMotion
}

// Color scheme hook
export function useColorScheme(): "light" | "dark" {
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("dark")

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    setColorScheme(mediaQuery.matches ? "dark" : "light")

    const handler = (e: MediaQueryListEvent) => {
      setColorScheme(e.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  return colorScheme
}

// ARIA labels for common actions
export const ARIA_LABELS = {
  close: "Close",
  menu: "Menu",
  search: "Search",
  filters: "Filters",
  submit: "Submit",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  save: "Save",
  loading: "Loading",
  expand: "Expand",
  collapse: "Collapse",
  previous: "Previous",
  next: "Next",
  select: "Select",
  selected: "Selected",
  enabled: "Enabled",
  disabled: "Disabled",
}

// High contrast mode hook
export function useHighContrastMode(): boolean {
  const [isHighContrast, setIsHighContrast] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: more)")
    setIsHighContrast(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches)
    }

    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  return isHighContrast
}