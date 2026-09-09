import type { ProjectListItem } from '../../../shared/types'

export interface ProjectSelectProps {
  projects: ProjectListItem[]
  selectedProjectId: string | null
  onChange: (projectId: string) => void
}

/**
 * F-008 sözleşmesi §10.1 — tek-seçim proje dropdown'u, `docs/03-ux.md:198` mockup'ının
 * `[mission-control ▾]` başlığı. `FilterChips`'ten (çoklu seçim, Zaman Çizelgesi/Kanban)
 * BİLİNÇLİ OLARAK farklı, ayrı bir bileşen — tek tüketici, gereksiz soyutlama eklenmiyor
 * (Karpathy §2). Native `<select>`: erişilebilirlik/klavye desteği ücretsiz gelir, bu ekranın
 * ihtiyacı olan tek şey "hangi proje" sorusudur.
 */
export function ProjectSelect({ projects, selectedProjectId, onChange }: ProjectSelectProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-300">
      <span className="text-zinc-500">Proje:</span>
      <select
        aria-label="Proje"
        data-testid="gates-project-select"
        value={selectedProjectId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
      >
        <option value="" disabled>
          Proje seçin…
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  )
}
