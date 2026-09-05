import { useEventStream } from './lib/useEventStream'
import { TimelineScreen } from '../features/events/web/TimelineScreen'
import { ScreenErrorBoundary } from '../features/events/web/ScreenErrorBoundary'
import { ConnectionBadge } from '../features/events/web/ConnectionBadge'

const OTHER_TABS = ['Kanban', 'Ayarlar']

export default function App() {
  // F-003 §2.2: tek `useEventStream()` çağrısı App kökünde — tek SSE bağlantısı. TimelineScreen
  // kendi bağlantısını açmaz, bu sonucu prop olarak alır.
  const stream = useEventStream('/api/stream', '/api/events')

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
          {/* F-003 CEO kararı D8 (YENİ-1): gerçek bir tablist/tab deseni kurulmuyor — bu tek
              ekran için `role`/`onClick` taşımayan, yalnızca `aria-current="page"` işaretli
              statik bir öğe (tıklaması no-op olurdu, F-001 "iş yapmayan buton" yasağı).
              Kanban/Ayarlar F-001/F-002'den devralınan aynı statik `<span>` biçiminde kalır
              (NOT-4: bu borç F-005/F-007'nin işi). */}
          <span aria-current="page" className="whitespace-nowrap text-sm font-mono text-amber-400">
            Zaman Çizelgesi
          </span>
          {OTHER_TABS.map((tab) => (
            <span key={tab} className="whitespace-nowrap text-sm font-mono text-zinc-400">
              {tab}
            </span>
          ))}
        </nav>
        <div className="ml-auto shrink-0">
          <ConnectionBadge status={stream.connectionStatus} variant="shell" />
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <ScreenErrorBoundary>
          <TimelineScreen stream={stream} />
        </ScreenErrorBoundary>
      </main>
    </div>
  )
}
