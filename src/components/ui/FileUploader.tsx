import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { 
  Upload, 
  File, 
  Image, 
  FileText, 
  X, 
  Download, 
  Trash2, 
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface Attachment {
  id: string
  filename: string
  size: number
  mimeType: string
  url: string
  uploadedAt: Date
  uploadedBy: string
  caseId?: string
  threatId?: string
}

interface FileUploadProps {
  className?: string
  onUpload?: (files: File[]) => Promise<void>
  onFileClick?: (attachment: Attachment) => void
  maxSize?: number
  acceptedTypes?: string[]
  caseId?: string
  threatId?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ACCEPTED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "application/json": [".json"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
}

export function FileUploader({ 
  className,
  onUpload,
  onFileClick,
  maxSize = MAX_FILE_SIZE,
  acceptedTypes = Object.keys(ACCEPTED_TYPES),
  caseId,
  threatId,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<Attachment[]>([])
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      setError(`Rejected ${rejectedFiles.length} file(s): ${rejectedFiles[0].errors[0]?.message}`)
      return
    }
    
    if (!onUpload) {
      // Simulate local upload
      const mockUpload = acceptedFiles.map(file => ({
        id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        url: URL.createObjectURL(file),
        uploadedAt: new Date(),
        uploadedBy: "current_user",
        caseId,
        threatId,
      })) as Attachment[]
      
      setUploadedFiles(prev => [...prev, ...mockUpload])
      return
    }
    
    setUploading(true)
    setError(null)
    setUploadProgress(0)
    
    try {
      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      await onUpload(acceptedFiles)
      
      const newFiles = acceptedFiles.map(file => ({
        id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        url: `/uploads/${file.name}`,
        uploadedAt: new Date(),
        uploadedBy: "current_user",
        caseId,
        threatId,
      })) as Attachment[]
      
      setUploadedFiles(prev => [...prev, ...newFiles])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }, [onUpload, caseId, threatId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize,
    accept: acceptedTypes.reduce((acc, type) => ({...acc, [type]: ACCEPTED_TYPES[type as keyof typeof ACCEPTED_TYPES]}), {}),
  })

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id))
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return Image
    if (mimeType === "application/pdf") return FileText
    return File
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive 
            ? "border-cyan-500 bg-cyan-500/10" 
            : "border-slate-700 hover:border-slate-600",
          uploading && "pointer-events-none opacity-50"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center">
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mb-4" />
              <div className="text-slate-400 mb-2">Uploading...</div>
              <Progress value={uploadProgress} className="w-48" />
              <div className="text-sm text-slate-500 mt-1">{uploadProgress}%</div>
            </>
          ) : isDragActive ? (
            <>
              <Upload className="h-8 w-8 text-cyan-400 mb-4" />
              <div className="text-slate-400">Drop files here</div>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-slate-500 mb-4" />
              <div className="text-slate-400">Drag & drop files here</div>
              <div className="text-sm text-slate-500 mt-1">or click to browse</div>
              <div className="text-xs text-slate-600 mt-2">Max {formatSize(maxSize)} per file</div>
            </>
          )}
        </div>
      </div>
      
      {error && (
        <div className="flex items-center gap-2 p-3 rounded bg-red-500/10 border border-red-500/30">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}
      
{uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500">UPLOADED FILES ({uploadedFiles.length})</div>
          {uploadedFiles.map(file => {
            const FileIcon = getFileIcon(file.mimeType)
            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded bg-slate-900 border border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <FileIcon className="h-4 w-4 text-cyan-400" />
                  <div>
                    <div className="text-sm text-slate-200">{file.filename}</div>
                    <div className="text-xs text-slate-500">
                      {formatSize(file.size)} • {file.uploadedAt.toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onFileClick?.(file)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}