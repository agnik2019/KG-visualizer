import { useRef } from 'react'
import { Upload } from 'lucide-react'
import type { FileHint } from '../types/graph'
import { iconButtonClass, controlClass } from '../ui'

export type UploadHint = FileHint | 'auto'

interface FileUploaderProps {
  hint: UploadHint
  onHintChange: (hint: UploadHint) => void
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function FileUploader({ hint, onHintChange, onFiles, disabled }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="upload-hint">
        How to classify uploaded files
      </label>
      <select
        id="upload-hint"
        className={`${controlClass} w-44`}
        value={hint}
        onChange={(event) => onHintChange(event.target.value as UploadHint)}
        disabled={disabled}
      >
        <option value="auto">Auto-detect KG</option>
        <option value="original-theory">Original TheoryKG</option>
        <option value="original-practice">Original PracticeKG</option>
        <option value="unspecified">Reconciled / use columns</option>
      </select>
      <button type="button" className={iconButtonClass} onClick={() => inputRef.current?.click()} disabled={disabled}>
        <Upload className="h-4 w-4" />
        Upload CSV
      </button>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".csv,text/csv"
        multiple
        data-testid="csv-input"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          if (files.length > 0) onFiles(files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
