import { useState } from 'react'
import { useEventStream } from './lib/useEventStream'
import { TimelineScreen } from '../features/events/web/TimelineScreen'
import { ScreenErrorBoundary } from '../features/events/web/ScreenErrorBoundary'
import { ConnectionBadge } from '../features/events/web/ConnectionBadge'
import { SettingsScreen } from '../features/projects/web/SettingsScreen'
import type { ProjectListItem } from '../shared/types'

type ActiveScreen = 'timeline' | 'settings'

export default function App() {
  // CEO kararı ("Ayarlar'ın yeri ve sekme deseninin ertelenmesi", docs/qa/F-005-contract.md):
  // basit bir activeScreen state'i + `hidden` özniteliğiyle panel geçişi. Gerçek
  // `role="tablist"`/`tab`/`tabpanel` deseni + roving tabindex + ok tuşu gezinmesi bu
  // feature'ın kapsamı DIŞINDA (F-007'nin işi, Kanban gerçek ikinci sekmeyi getirdiğinde).
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('timeline')
  const [projectsUpdate, setProjectsUpdate] = useState<ProjectListItem[] | null>(null)

  // F-003 §2.2: tek `useEventStream()` çağrısı App kökünde — tek SSE bağlantısı. TimelineScreen
  // kendi bağlantısını açmaz, bu sonucu prop olarak alır. F-005: `onProjects` de aynı tek
  // bağlantıyı paylaşır (ADR-004 madde 1).
  const stream = useEventStream('/api/stream', '/api/events', {
    onProjects: setProjectsUpdate,
  })

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex h-14 shrink-0 items-center gap-6 overflow-x-auto border-b border-zinc-800 px-4">
        <span
          data-testid="app-title"
          className="shrink-0 whitespace-nowrap font-display tracking-wide text-lg"
        >
          MISSION CONTROL
        </span>
        <nav className="flex shrink-0 items-center gap-4">
          {/* F-003 CEO kararı D8 (YENİ-1) + F-005 CEO kararı (sekme deseninin ertelenmesi):
              gerçek bir tablist/tab deseni kurulmuyor — Zaman Çizelgesi/Kanban `role`/`onClick`
              taşımayan statik öğeler kalır (F-007'nin işi, Kanban gerçek ikinci sekmeyi
              getirdiğinde). Ayarlar bunların dışında, sağda sabit bir dişli düğmesidir. */}
          <span aria-current="page" className="whitespace-nowrap text-sm font-mono text-amber-400">
            Zaman Çizelgesi
          </span>
          <span className="whitespace-nowrap text-sm font-mono text-zinc-400">Kanban</span>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-4">
          <ConnectionBadge status={stream.connectionStatus} variant="shell" />
          <button
            type="button"
            aria-label="Ayarlar"
            aria-pressed={activeScreen === 'settings'}
            onClick={() => setActiveScreen((s) => (s === 'settings' ? 'timeline' : 'settings'))}
            className="whitespace-nowrap text-sm font-mono text-zinc-400 aria-pressed:text-amber-400"
          >
            ⚙ Ayarlar
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <div id="panel-timeline" hidden={activeScreen !== 'timeline'} className="h-full">
          <ScreenErrorBoundary>
            <TimelineScreen stream={stream} />
          </ScreenErrorBoundary>
        </div>
        <div id="panel-settings" hidden={activeScreen !== 'settings'} className="h-full">
          <SettingsScreen liveUpdate={projectsUpdate} />
        </div>
      </main>
    </div>
  )
}
