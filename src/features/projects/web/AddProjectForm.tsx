import { useRef, useState } from 'react'
import type { AddProjectFailure, AddProjectSuccess } from './useProjects'

export interface AddProjectFormProps {
  onAdd: (path: string) => Promise<AddProjectSuccess | AddProjectFailure>
}

/** Ayarlar ekranının ekleme formu (sözleşme §2.1, UX akış f). */
export function AddProjectForm({ onAdd }: AddProjectFormProps) {
  const [path, setPath] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const result = await onAdd(path)
    setSubmitting(false)
    if (result.ok) {
      setPath('')
    } else {
      setError(result.message)
      inputRef.current?.focus()
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="add-project-path" className="text-sm text-zinc-400">
          Yeni proje yolu:
        </label>
        <input
          id="add-project-path"
          ref={inputRef}
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="C:\dev\apps\proje-adi"
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-sm text-zinc-100"
        />
        <button
          type="submit"
          disabled={submitting || path.trim() === ''}
          className="min-h-8 shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50"
        >
          {submitting ? 'kontrol ediliyor…' : 'Ekle'}
        </button>
      </div>
      {error && (
        <p role="alert" data-testid="add-project-error" className="text-sm text-red-400">
          ⚠ {error}
        </p>
      )}
    </form>
  )
}
