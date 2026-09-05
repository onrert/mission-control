import { useProjects } from './useProjects'
import { ProjectRow } from './ProjectRow'
import { AddProjectForm } from './AddProjectForm'
import type { ProjectListItem } from '../../../shared/types'

export interface SettingsScreenProps {
  /** App.tsx'in `useEventStream({ onProjects })` sonucu — `projects` SSE kanalından gelen tam liste. */
  liveUpdate: ProjectListItem[] | null
}

/** Ayarlar ekranının kökü (sözleşme §2.1, UX ekran-3 birebir). */
export function SettingsScreen({ liveUpdate }: SettingsScreenProps) {
  const { items, loadState, registryCorrupt, retry, add, remove } = useProjects(liveUpdate)

  return (
    <div
      data-testid="settings-screen"
      className="flex h-full flex-col overflow-y-auto bg-zinc-950 text-zinc-100"
    >
      <div className="border-b border-zinc-800 p-3">
        <h1 className="text-sm font-semibold text-zinc-200">İzlenen Projeler</h1>
      </div>

      {registryCorrupt && (
        <div
          role="status"
          data-testid="registry-corrupt-banner"
          className="border-b border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-300"
        >
          Proje listesi okunamadı, varsayılan boş liste ile başlandı.
        </div>
      )}

      {loadState === 'error' && (
        <div
          role="alert"
          data-testid="settings-error-banner"
          className="flex items-center justify-between gap-3 border-b border-red-800 bg-red-950/40 p-3 text-sm text-red-300"
        >
          <span>Liste kaydedilemedi, tekrar deneyin.</span>
          <button
            type="button"
            onClick={retry}
            className="min-h-8 rounded-md border border-red-700 px-3 py-1.5 text-xs"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {loadState === 'loading' && (
        <div data-testid="settings-skeleton" className="p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-1.5 h-8 animate-pulse rounded-sm bg-zinc-900" />
          ))}
        </div>
      )}

      {loadState === 'ready' && items.length === 0 && (
        <p data-testid="settings-empty" className="p-6 text-center text-sm text-zinc-500">
          Henüz izlenen proje yok. Başlamak için bir App Factory proje klasörü ekleyin.
        </p>
      )}

      {loadState === 'ready' && items.length > 0 && (
        <div data-testid="project-list">
          {items.map((project: ProjectListItem) => (
            <ProjectRow key={project.id} project={project} onRemove={remove} />
          ))}
        </div>
      )}

      <AddProjectForm onAdd={(path) => add(path)} />

      <p className="mt-auto border-t border-zinc-800 p-3 text-xs text-zinc-500">
        Depo bilgisi: olaylar son 30 gün veya 20.000 olay saklanır (sunucu ayarı).
      </p>
    </div>
  )
}
