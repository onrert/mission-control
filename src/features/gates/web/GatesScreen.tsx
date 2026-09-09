import { useEffect, useState } from 'react'
import type { GateStatusItem, ProjectListItem } from '../../../shared/types'
import { useProjects } from '../../projects/web/useProjects'
import { useGates } from './useGates'
import { ProjectSelect } from './ProjectSelect'
import { GateRow } from './GateRow'
import { ApproveModal } from './ApproveModal'

export interface GatesScreenProps {
  /** App.tsx'in `onProjects` akışından gelen tam liste (Karar 1 — ikinci canlı kaynak yok, Kanban emsali). */
  liveProjectsUpdate: ProjectListItem[] | null
  /** App.tsx'in `onGates` akışından gelen sinyal (yalnızca `{project_id}`, §7). */
  gatesSignal: { project_id: string } | null
  onNavigateSettings: () => void
}

const SKELETON_ROW_COUNT = 8

/** F-008 sözleşmesi §10.1 — Kapılar ekranının kompozisyonu (`docs/03-ux.md` ekran 4 birebir). */
export function GatesScreen({
  liveProjectsUpdate,
  gatesSignal,
  onNavigateSettings,
}: GatesScreenProps) {
  const { items: projects, loadState: projectsLoadState } = useProjects(liveProjectsUpdate)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Seçili proje kaldırıldıysa (silindi) seçim sıfırlanır — geçersiz bir id ile `GET /api/gates`
  // çağırıp 404 almak yerine "Önce bir proje seçin." durumuna döner.
  useEffect(() => {
    if (selectedProjectId === null) return
    if (!projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(null)
    }
  }, [projects, selectedProjectId])

  const { gates, unrecognized, processDocReadable, loadState, retry, approve, deny } = useGates({
    projectId: selectedProjectId,
    gatesSignal,
  })

  const [approvingGate, setApprovingGate] = useState<GateStatusItem | null>(null)
  const [denyingGateId, setDenyingGateId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState('')

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  async function handleApproveConfirm(decision: string) {
    if (!approvingGate) throw new Error('onaylanacak kapı seçilmemiş')
    const outcome = await approve(approvingGate.id, decision)
    if (outcome.kind === 'success') {
      setApprovingGate(null)
      setToast(`docs/approvals/${outcome.item.id}.ok yazıldı`)
      setLiveMessage(`${outcome.item.id} onaylandı`)
    }
    return outcome
  }

  async function handleDenySubmit(reason: string) {
    if (!denyingGateId) throw new Error('reddedilecek kapı seçilmemiş')
    const outcome = await deny(denyingGateId, reason)
    if (outcome.kind === 'success') {
      setDenyingGateId(null)
      setToast(`docs/approvals/${outcome.item.id}.deny.md yazıldı`)
      setLiveMessage(`${outcome.item.id} reddedildi`)
    }
    return outcome
  }

  const noProjects = projects.length === 0 && projectsLoadState === 'ready'

  return (
    <div
      data-testid="gates-screen"
      className="flex h-full flex-col gap-3 overflow-y-auto bg-zinc-950 p-3 text-zinc-100"
    >
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      {noProjects ? (
        <div
          data-testid="gates-no-projects"
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
          <ProjectSelect
            projects={projects}
            selectedProjectId={selectedProjectId}
            onChange={setSelectedProjectId}
          />

          {selectedProjectId === null && (
            <p data-testid="gates-empty" className="p-8 text-center text-sm text-zinc-500">
              Önce bir proje seçin.
            </p>
          )}

          {toast && (
            <div
              role="status"
              data-testid="gates-toast"
              className="rounded-md border border-emerald-700 bg-emerald-950/40 p-2 text-sm text-emerald-300"
            >
              {toast}
            </div>
          )}

          {selectedProjectId !== null && loadState === 'error' && (
            <div
              role="alert"
              data-testid="gates-error-banner"
              className="flex items-center justify-between gap-3 rounded-md border border-red-800 bg-red-950/40 p-2 text-sm text-red-300"
            >
              <span>Kapı durumları okunamadı.</span>
              <button
                type="button"
                onClick={retry}
                className="min-h-8 rounded-md border border-red-700 px-3 py-1.5 text-xs"
              >
                Tekrar dene
              </button>
            </div>
          )}

          {selectedProjectId !== null && !processDocReadable && loadState === 'ready' && (
            <div
              role="status"
              data-testid="gates-process-doc-unreadable"
              className="rounded-md border border-amber-800 bg-amber-950/40 p-2 text-sm text-amber-300"
            >
              PROCESS.md okunamadı, varsayılan adlar gösteriliyor.
            </div>
          )}

          {selectedProjectId !== null && unrecognized.length > 0 && loadState === 'ready' && (
            <div
              role="status"
              data-testid="gates-unrecognized"
              className="rounded-md border border-zinc-700 bg-zinc-900/60 p-2 text-xs text-zinc-400"
            >
              Tanınmayan dosyalar: {unrecognized.join(', ')}
            </div>
          )}

          {selectedProjectId !== null && loadState === 'loading' && (
            <div data-testid="gates-skeleton" className="flex flex-col gap-1.5">
              {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded-sm bg-zinc-900" />
              ))}
            </div>
          )}

          {selectedProjectId !== null && loadState === 'ready' && (
            <div className="overflow-x-auto">
              <table data-testid="gates-table" className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                    <th className="p-2 font-normal">Kapı</th>
                    <th className="p-2 font-normal">Durum</th>
                    <th className="p-2 font-normal">Tarih</th>
                    <th className="p-2 font-normal">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {gates.map((gate) => (
                    <GateRow
                      key={gate.id}
                      gate={gate}
                      isDenying={denyingGateId === gate.id}
                      onApproveClick={() => setApprovingGate(gate)}
                      onDenyClick={() => setDenyingGateId(gate.id)}
                      onDenyCancel={() => setDenyingGateId(null)}
                      onDenySubmit={handleDenySubmit}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {approvingGate && selectedProject && (
        <ApproveModal
          gate={approvingGate}
          projectLabel={selectedProject.label}
          onCancel={() => setApprovingGate(null)}
          onConfirm={handleApproveConfirm}
        />
      )}
    </div>
  )
}
