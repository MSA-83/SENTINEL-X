import { 
  Loader2, 
  AlertCircle, 
  Inbox, 
  AlertTriangle,
  FileText,
  Search,
  Upload,
  Users,
  BarChart3,
  Clock
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  className?: string
  message?: string
}

export function LoadingState({ className, message = "Loading..." }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8", className)}>
      <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mb-4" />
      <div className="text-slate-400">{message}</div>
    </div>
  )
}

interface ErrorStateProps {
  className?: string
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({ 
  className, 
  title = "Error", 
  message = "An error occurred",
  onRetry 
}: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8", className)}>
      <AlertCircle className="h-8 w-8 text-red-400 mb-4" />
      <div className="text-lg text-slate-200">{title}</div>
      <div className="text-sm text-slate-500 mt-1">{message}</div>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  )
}

interface EmptyStateProps {
  className?: string
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ 
  className, 
  icon: Icon = Inbox,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8", className)}>
      <Icon className="h-8 w-8 text-slate-600 mb-4" />
      <div className="text-lg text-slate-400">{title}</div>
      {description && (
        <div className="text-sm text-slate-500 mt-1">{description}</div>
      )}
      {action && (
        <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

interface NotFoundStateProps {
  className?: string
  title?: string
  message?: string
  onBack?: () => void
}

export function NotFoundState({ 
  className, 
  title = "Not Found",
  message = "The requested resource could not be found",
  onBack
}: NotFoundStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8", className)}>
      <Search className="h-8 w-8 text-slate-600 mb-4" />
      <div className="text-lg text-slate-400">{title}</div>
      <div className="text-sm text-slate-500 mt-1">{message}</div>
      {onBack && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onBack}>
          Go Back
        </Button>
      )}
    </div>
  )
}

// Predefined empty states for different data types
export function EmptyThreats({ className, onCreate }: { className?: string; onCreate?: () => void }) {
  return (
    <EmptyState
      className={className}
      icon={AlertTriangle}
      title="No threats detected"
      description="No threats match your current filters"
      action={onCreate ? { label: "Clear filters", onClick: onCreate } : undefined}
    />
  )
}

export function EmptyCases({ className, onCreate }: { className?: string; onCreate?: () => void }) {
  return (
    <EmptyState
      className={className}
      icon={FileText}
      title="No cases"
      description="Create your first case to get started"
      action={onCreate ? { label: "Create Case", onClick: onCreate } : undefined}
    />
  )
}

export function EmptyEntities({ className, onCreate }: { className?: string; onCreate?: () => void }) {
  return (
    <EmptyState
      className={className}
      icon={Users}
      title="No entities"
      description="Start tracking aircraft, vessels, or facilities"
      action={onCreate ? { label: "Add Entity", onClick: onCreate } : undefined}
    />
  )
}

export function EmptyAlerts({ className, onCreate }: { className?: string; onCreate?: () => void }) {
  return (
    <EmptyState
      className={className}
      icon={AlertTriangle}
      title="No alerts"
      description="No active alerts at this time"
      action={onCreate ? { label: "Create Alert Rule", onClick: onCreate } : undefined}
    />
  )
}

export function EmptySearch({ className, onSearch }: { className?: string; onSearch?: () => void }) {
  return (
    <EmptyState
      className={className}
      icon={Search}
      title="No results"
      description="Try adjusting your search or filters"
      action={onSearch ? { label: "Clear filters", onClick: onSearch } : undefined}
    />
  )
}

export function EmptyFiles({ className, onUpload }: { className?: string; onUpload?: () => void }) {
  return (
    <EmptyState
      className={className}
      icon={Upload}
      title="No files"
      description="Upload evidence files to attach"
      action={onUpload ? { label: "Upload Files", onClick: onUpload } : undefined}
    />
  )
}

export function EmptyAnalytics({ className }: { className?: string }) {
  return (
    <EmptyState
      className={className}
      icon={BarChart3}
      title="No data"
      description="Analytics will appear once data is collected"
    />
  )
}

export function EmptyTimeline({ className }: { className?: string }) {
  return (
    <EmptyState
      className={className}
      icon={Clock}
      title="No activity"
      description="Timeline events will appear here"
    />
  )
}

// Predefined loading states
export function LoadingThreats({ className }: { className?: string }) {
  return <LoadingState className={className} message="Loading threats..." />
}

export function LoadingCases({ className }: { className?: string }) {
  return <LoadingState className={className} message="Loading cases..." />
}

export function LoadingEntities({ className }: { className?: string }) {
  return <LoadingState className={className} message="Loading entities..." />
}

export function LoadingAlerts({ className }: { className?: string }) {
  return <LoadingState className={className} message="Loading alerts..." />
}

// Predefined error states
export function ErrorThreats({ className, onRetry }: { className?: string; onRetry?: () => void }) {
  return (
    <ErrorState
      className={className}
      title="Failed to load threats"
      message="Unable to fetch threat data"
      onRetry={onRetry}
    />
  )
}

export function ErrorCases({ className, onRetry }: { className?: string; onRetry?: () => void }) {
  return (
    <ErrorState
      className={className}
      title="Failed to load cases"
      message="Unable to fetch case data"
      onRetry={onRetry}
    />
  )
}

export function ErrorEntities({ className, onRetry }: { className?: string; onRetry?: () => void }) {
  return (
    <ErrorState
      className={className}
      title="Failed to load entities"
      message="Unable to fetch entity data"
      onRetry={onRetry}
    />
  )
}

export function ErrorAlerts({ className, onRetry }: { className?: string; onRetry?: () => void }) {
  return (
    <ErrorState
      className={className}
      title="Failed to load alerts"
      message="Unable to fetch alert data"
      onRetry={onRetry}
    />
  )
}