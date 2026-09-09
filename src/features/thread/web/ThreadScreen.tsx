import { useEffect, useState } from 'react'
import type { ProjectListItem } from '../../../shared/types'
import { useProjects } from '../../projects/web/useProjects'
import { useProjectFeatureList } from './useProjectFeatureList'
import { useThreadDetail } from './useThreadDetail'
import { ThreadSectionCard } from './ThreadSectionCard'

export interface ThreadScreenProps {
  /** App.tsx'in `onProjects` akışından gelen tam liste (Kanban/Kapılar emsali — ikinci canlı
   *  kaynak yok). */
  liveProjectsUpdate: ProjectListItem[] | null
  onNavigateSettings: () => void
  /** Testler için. */
  fetchImpl?: typeof fetch
}

const SKELETON_SECTION_COUNT = 3

/**
 * F-010 sözleşmesi §4 — Thread ekranı: proje + feature seçici, kronolojik bölüm listesi, ESKALE
 * rozeti. Tamamen salt okunur (PRD F5/AC5) — bu dosya hiçbir yazma isteği ATMAZ (`fetchImpl`
 * dışında hiçbir ağ çağrısı yok, `write-fetch` hiç import edilmedi).
 */
export function ThreadScreen({
  liveProjectsUpdate,
  onNavigateSettings,
  fetchImpl,
}: ThreadScreenProps) {
  const { items: projects, loadState: projectsLoadState } = useProjects(liveProjectsUpdate)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  // Seçili proje kaldırıldıysa (silindi) seçim sıfırlanır (Kapılar/Kanban emsali).
  useEffect(() => {
    if (selectedProjectId === null) return
    if (!projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(null)
      setSelectedFile(null)
    }
  }, [projects, selectedProjectId])

  const { features, loadState: featuresLoadState } = useProjectFeatureList(selectedProjectId, {
    fetchImpl,
  })

  // Proje değişince önceki feature seçimi geçersizleşir.
  function handleProjectChange(projectId: string): void {
    setSelectedProjectId(projectId)
    setSelectedFile(null)
  }

  useEffect(() => {
    if (selectedFile === null) return
    if (featuresLoadState === 'ready' && !features.some((f) => f.file === selectedFile)) {
      setSelectedFile(null)
    }
  }, [features, featuresLoadState, selectedFile])

  const { loadState, detail, errorMessage, retry } = useThreadDetail(
    selectedProjectId,
    selectedFile,
    { fetchImpl }
  )

  const noProjects = projects.length === 0 && projectsLoadState === 'ready'

  return (
    <div
      data-testid="thread-screen"
      className="flex h-full flex-col gap-3 overflow-y-auto bg-zinc-950 p-3 text-zinc-100"
      tabIndex={0}
      aria-label="Thread içeriği"
    >
      {noProjects ? (
        <div
          data-testid="thread-no-projects"
          className="flex flex-col items-center gap-2 p-8 text-center"
        >
          <p className="text-sm text-zinc-500">Önce bir proje seçin.</p>
          <button
            type="button"
            onClick={onNavigateSettings}
            className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
          >
            Ayarlar&apos;a git
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {/* QA düzeltme turu 1 (X3/Ö3) — Feature seçeneklerinin metni (`id — title`)
                sınırsız uzayabilir; native `<select>` kapalıyken bile en uzun `<option>`'ın
                içerik genişliğine göre boyutlanıyordu (375px'te 828px ölçüldü, `thread-screen`
                915px'e taşıp 555px hayalet yatay kaydırma yaratıyordu). `min-w-0` (flex item
                varsayılan `min-width:auto`'yu kapatır) + sabit `w-*`/`max-w-full` + `truncate`
                select'i viewport'a bağlı, kırpılan bir kutuya sabitler — tam metin dropdown
                açılınca zaten görünür. */}
            <label className="flex min-w-0 items-center gap-2 text-sm text-zinc-300">
              <span className="shrink-0 text-zinc-500">Proje:</span>
              <select
                aria-label="Proje"
                data-testid="thread-project-select"
                value={selectedProjectId ?? ''}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="min-h-8 w-32 min-w-0 max-w-full truncate rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 sm:w-48"
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

            {selectedProjectId !== null && (
              <label className="flex min-w-0 items-center gap-2 text-sm text-zinc-300">
                <span className="shrink-0 text-zinc-500">Feature:</span>
                <select
                  aria-label="Feature"
                  data-testid="thread-feature-select"
                  value={selectedFile ?? ''}
                  onChange={(e) => setSelectedFile(e.target.value || null)}
                  className="min-h-8 w-40 min-w-0 max-w-full truncate rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 sm:w-64"
                >
                  <option value="" disabled>
                    Feature seçin…
                  </option>
                  {features.map((f) => (
                    <option key={f.file} value={f.file}>
                      {f.id} — {f.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {selectedProjectId === null && (
            <p data-testid="thread-empty" className="p-8 text-center text-sm text-zinc-500">
              Önce bir proje seçin.
            </p>
          )}

          {selectedProjectId !== null && selectedFile === null && (
            <p data-testid="thread-empty" className="p-8 text-center text-sm text-zinc-500">
              Bir feature seçin.
            </p>
          )}

          {selectedFile !== null && loadState === 'loading' && (
            <div data-testid="thread-skeleton" className="flex flex-col gap-2">
              {Array.from({ length: SKELETON_SECTION_COUNT }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-zinc-900" />
              ))}
            </div>
          )}

          {selectedFile !== null && loadState === 'error' && (
            <div
              role="alert"
              data-testid="thread-error-banner"
              className="flex items-center justify-between gap-3 rounded-md border border-red-800 bg-red-950/40 p-2 text-sm text-red-300"
            >
              <span>{errorMessage ?? 'Thread yüklenemedi.'}</span>
              <button
                type="button"
                onClick={retry}
                className="min-h-8 rounded-md border border-red-700 px-3 py-1.5 text-xs"
              >
                Tekrar dene
              </button>
            </div>
          )}

          {selectedFile !== null && loadState === 'ready' && detail && (
            <>
              {detail.eskale && (
                <div
                  role="status"
                  data-testid="thread-eskale-banner"
                  className="rounded-md border border-amber-800 bg-amber-950/40 p-2 text-sm text-amber-300"
                >
                  ⚠ ESKALE: QA turu sınırı aşıldı, kullanıcıya iletildi.
                </div>
              )}

              {!detail.sections.some(
                (s) => s.kind === 'developer_report' || s.kind === 'qa_verdict'
              ) && (
                <p data-testid="thread-no-qa-note" className="text-xs text-zinc-500">
                  Bu feature için henüz sözleşme/QA kaydı yok.
                </p>
              )}

              <div data-testid="thread-sections" className="flex flex-col gap-2">
                {detail.sections.map((section, i) => (
                  <ThreadSectionCard
                    key={`${section.kind}-${i}`}
                    section={section}
                    defaultOpen={section.kind === 'ceo_brief'}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
