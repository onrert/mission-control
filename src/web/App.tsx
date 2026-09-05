import { useState } from 'react'
import { useEventStream } from './lib/useEventStream'
import { TimelineScreen } from '../features/events/web/TimelineScreen'
import { ScreenErrorBoundary } from '../features/events/web/ScreenErrorBoundary'
import { ConnectionBadge } from '../features/events/web/ConnectionBadge'
import { SettingsScreen } from '../features/projects/web/SettingsScreen'
import { KanbanScreen } from '../features/kanban/web/KanbanScreen'
import type { ProjectListItem } from '../shared/types'

type ActiveScreen = 'timeline' | 'settings' | 'kanban'
type TabScreen = 'timeline' | 'kanban'

const TABS: Array<{ screen: TabScreen; label: string }> = [
  { screen: 'timeline', label: 'Zaman Çizelgesi' },
  { screen: 'kanban', label: 'Kanban' },
]

export default function App() {
  // F-007 (Kanban gerçek ikinci sekmeyi getirdi) — `role="tablist"`/`tab`/`tabpanel` deseni,
  // roving tabindex + ok tuşu gezinmesi (sözleşme §6 madde 1, §7). Ayarlar bu desenin
  // DIŞINDA kalır (sağda sabit dişli düğmesi, `docs/03-ux.md:21`).
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('timeline')
  // QA tur 1 bulgu 11 düzeltmesi — Ayarlar aktifken tablist geçersiz bir duruma düşmesin diye
  // "son seçili sekme" ayrı tutulur; Ayarlar açıkken de tam olarak bir `tab` `aria-selected` kalır.
  const [lastTabScreen, setLastTabScreen] = useState<TabScreen>('timeline')
  const [projectsUpdate, setProjectsUpdate] = useState<ProjectListItem[] | null>(null)
  const [featuresSignal, setFeaturesSignal] = useState<{ project_id: string } | null>(null)

  // F-003 §2.2: tek `useEventStream()` çağrısı App kökünde — tek SSE bağlantısı. TimelineScreen
  // kendi bağlantısını açmaz, bu sonucu prop olarak alır. F-005: `onProjects` de aynı tek
  // bağlantıyı paylaşır (ADR-004 madde 1). F-007: `onFeatures` de aynı desende eklendi —
  // Kanban ikinci bir EventSource AÇMAZ.
  const stream = useEventStream('/api/stream', '/api/events', {
    onProjects: setProjectsUpdate,
    onFeatures: setFeaturesSignal,
  })

  const selectedTab: TabScreen = activeScreen === 'settings' ? lastTabScreen : activeScreen

  function selectTab(screen: TabScreen): void {
    setLastTabScreen(screen)
    setActiveScreen(screen)
  }

  function onTabKeyDown(event: React.KeyboardEvent<HTMLSpanElement>): void {
    const currentIndex = TABS.findIndex((t) => t.screen === selectedTab)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const nextIndex = (currentIndex + delta + TABS.length) % TABS.length
      selectTab(TABS[nextIndex]!.screen)
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectTab(TABS[0]!.screen)
    } else if (event.key === 'End') {
      event.preventDefault()
      selectTab(TABS[TABS.length - 1]!.screen)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-800 px-4">
        {/* QA düzeltme turu 1 (ÖNEMLİ-3): yalnızca başlık+nav bölgesi yatay kaydırılır
            (`overflow-x-auto`) — Ayarlar dişlisi bu kaydırma alanının DIŞINDA, `shrink-0` ile
            sağda sabit kalır (`docs/03-ux.md:17` dar panel senaryosu / `:21` "sağda sabit dişli
            ikonu"). */}
        <div className="flex flex-1 items-center gap-6 overflow-x-auto">
          <span
            data-testid="app-title"
            className="shrink-0 whitespace-nowrap font-display tracking-wide text-lg"
          >
            MISSION CONTROL
          </span>
          <div role="tablist" aria-label="Ekranlar" className="flex shrink-0 items-center gap-4">
            {TABS.map((tab) => {
              const isSelected = selectedTab === tab.screen
              return (
                <span
                  key={tab.screen}
                  role="tab"
                  id={`tab-${tab.screen}`}
                  aria-controls={`panel-${tab.screen}`}
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => selectTab(tab.screen)}
                  onKeyDown={onTabKeyDown}
                  className={
                    isSelected
                      ? 'cursor-pointer whitespace-nowrap text-sm font-mono text-amber-400'
                      : 'cursor-pointer whitespace-nowrap text-sm font-mono text-zinc-400'
                  }
                >
                  {tab.label}
                </span>
              )
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <ConnectionBadge status={stream.connectionStatus} variant="shell" />
          <button
            type="button"
            aria-label="Ayarlar"
            aria-pressed={activeScreen === 'settings'}
            onClick={() => setActiveScreen((s) => (s === 'settings' ? lastTabScreen : 'settings'))}
            className="shrink-0 whitespace-nowrap text-sm font-mono text-zinc-400 aria-pressed:text-amber-400"
          >
            ⚙ Ayarlar
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <div
          id="panel-timeline"
          role="tabpanel"
          aria-labelledby="tab-timeline"
          hidden={activeScreen !== 'timeline'}
          className="h-full"
        >
          <ScreenErrorBoundary>
            <TimelineScreen stream={stream} />
          </ScreenErrorBoundary>
        </div>
        <div
          id="panel-kanban"
          role="tabpanel"
          aria-labelledby="tab-kanban"
          hidden={activeScreen !== 'kanban'}
          className="h-full"
        >
          <ScreenErrorBoundary>
            <KanbanScreen
              liveProjectsUpdate={projectsUpdate}
              featuresSignal={featuresSignal}
              connectionStatus={stream.connectionStatus}
              onNavigateSettings={() => setActiveScreen('settings')}
            />
          </ScreenErrorBoundary>
        </div>
        <div id="panel-settings" hidden={activeScreen !== 'settings'} className="h-full">
          <SettingsScreen liveUpdate={projectsUpdate} />
        </div>
      </main>
    </div>
  )
}
