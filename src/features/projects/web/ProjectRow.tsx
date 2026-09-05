import { useState } from 'react'
import type { ProjectListItem } from '../../../shared/types'
import type { AddProjectFailure, AddProjectSuccess } from './useProjects'

// Sözleşme §6 "durum tasarımı": ikon burada tekrar tanımlanır (3 satırlık inline SVG,
// `src/features/events/web/icons.tsx`'ten import ETMEZ — dikey dilim izolasyonu, henüz yalnızca
// 2 feature aynı ikona ihtiyaç duyuyor, paylaşılan bir dosya oluşturmak Karpathy §2 ihlali olurdu).
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export interface ProjectRowProps {
  project: ProjectListItem
  onRemove: (id: string) => Promise<AddProjectSuccess | AddProjectFailure>
}

function copyPath(path: string): void {
  navigator.clipboard?.writeText(path).catch(() => {
    // kritik değil — panoya kopyalama başarısız olursa sessizce yutulur.
  })
}

export function ProjectRow({ project, onRemove }: ProjectRowProps) {
  const [removing, setRemoving] = useState(false)
  // QA düzeltme turu 2 (D26): `onRemove` başarısız olursa (`ok:false`) burada gösterilir —
  // `AddProjectForm`'daki desenle aynı (`role="alert"`).
  const [error, setError] = useState<string | null>(null)

  async function handleRemove(): Promise<void> {
    if (removing) return
    setRemoving(true)
    setError(null)
    const result = await onRemove(project.id)
    setRemoving(false)
    if (!result.ok) {
      setError(result.message)
    }
  }

  return (
    <div
      data-testid="project-row"
      className="flex flex-wrap items-center gap-3 border-b border-zinc-800 p-3 text-sm"
    >
      {project.exists ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-emerald-400">
          <span aria-hidden="true">●</span> izleniyor
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-amber-400">
          <AlertTriangleIcon className="h-4 w-4" /> yol bulunamadı
        </span>
      )}
      <span className="shrink-0 font-medium text-zinc-100">{project.label}</span>
      <button
        type="button"
        onClick={() => copyPath(project.path)}
        title="Yolu panoya kopyala"
        className="min-w-0 flex-1 truncate text-left font-mono text-xs text-zinc-400"
      >
        {project.path}
      </button>
      {project.exists && (
        <span className="shrink-0 text-xs text-zinc-500">{project.feature_count} feature</span>
      )}
      <button
        type="button"
        onClick={() => void handleRemove()}
        disabled={removing}
        className="min-h-8 shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50"
      >
        {removing ? 'kaldırılıyor…' : 'Kaldır'}
      </button>
      {error && (
        <p role="alert" data-testid="remove-project-error" className="w-full text-sm text-red-400">
          ⚠ {error}
        </p>
      )}
    </div>
  )
}
