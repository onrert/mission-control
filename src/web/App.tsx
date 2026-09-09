import { useState } from 'react'
import { useEventStream } from './lib/useEventStream'
import { TimelineScreen } from '../features/events/web/TimelineScreen'
import { ScreenErrorBoundary } from '../features/events/web/ScreenErrorBoundary'
import { ConnectionBadge } from '../features/events/web/ConnectionBadge'
import { SettingsScreen } from '../features/projects/web/SettingsScreen'
import { KanbanScreen } from '../features/kanban/web/KanbanScreen'
import { ChatScreen } from '../features/chat/web/ChatScreen'
import { useChatSession } from '../features/chat/web/useChatSession'
import { GatesScreen } from '../features/gates/web/GatesScreen'
import { ThreadScreen } from '../features/thread/web/ThreadScreen'
import type { ProjectListItem } from '../shared/types'

type ActiveScreen = 'timeline' | 'settings' | 'kanban' | 'chat' | 'gates' | 'thread'
type TabScreen = 'timeline' | 'kanban' | 'chat' | 'gates' | 'thread'

// F-008 (G0 kararı: Kapılar F-009'un önüne geçer) — Kapılar Faz 2'den Faz 1 kabuğuna KOŞULSUZ
// eklenir (chat'in aksine bir sunucu bayrağına bağlı değil). Sıra `docs/03-ux.md:735` — Sohbet
// varsa ondan SONRA, yoksa Kanban'dan sonra (`docs/03-ux.md` sekme sırası: "[Zaman Çizelgesi]
// [Kanban][Sohbet][Kapılar][Thread][Token]").
function buildTabs(chatEnabled: boolean): Array<{ screen: TabScreen; label: string }> {
  const tabs: Array<{ screen: TabScreen; label: string }> = [
    { screen: 'timeline', label: 'Zaman Çizelgesi' },
    { screen: 'kanban', label: 'Kanban' },
  ]
  if (chatEnabled) tabs.push({ screen: 'chat', label: 'Sohbet' })
  tabs.push({ screen: 'gates', label: 'Kapılar' })
  // F-010 (W9) — Thread, Kapılar emsali gibi bir sunucu bayrağına bağlı değil, koşulsuz eklenir.
  // Sıra `docs/03-ux.md` sekme sırası: "…[Kapılar][Thread][Token]" — Kapılar'dan hemen sonra.
  tabs.push({ screen: 'thread', label: 'Thread' })
  return tabs
}

export default function App() {
  // QA F-012 tur 2 Y2 (BLOKLAYICI) düzeltmesi — `MC_CHAT_ENABLED` artık bir ÇALIŞMA ZAMANI
  // bilgisidir, derleme anında `vite.config.ts`'e gömülen bir sabit DEĞİL (eskiden `npm run
  // e2e`'nin `MC_CHAT_ENABLED=0` ortamıyla derlediği `dist/` her zaman sohbetsiz kalıyordu, açık
  // bir sunucuyla çalıştırılsa bile — `docs/qa/F-012-2026-09-06-tur2.md` §4 Y2). Sunucu zaten
  // `GET /api/chat/status`'ta `chat_enabled`'ı bildiriyor; istemci ikinci bir kaynağa (env/derleme
  // bayrağı) değil, doğrudan buna bakar. İlk render'da henüz yanıt gelmediği için sekme kısa bir
  // an gizli kalabilir — bu, "sunucu ne diyorsa arayüz onu gösterir" garantisinin kaçınılmaz
  // bedeli ve sessizce yanlış bir duruma (kapalıyken açık görünme/tersi) yeğdir.
  const chat = useChatSession({ enabled: true })
  const chatUiEnabled = chat.status?.chat_enabled ?? false
  const TABS = buildTabs(chatUiEnabled)
  // F-007 (Kanban gerçek ikinci sekmeyi getirdi) — `role="tablist"`/`tab`/`tabpanel` deseni,
  // roving tabindex + ok tuşu gezinmesi (sözleşme §6 madde 1, §7). Ayarlar bu desenin
  // DIŞINDA kalır (sağda sabit dişli düğmesi, `docs/03-ux.md:21`).
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('timeline')
  // QA tur 1 bulgu 11 düzeltmesi — Ayarlar aktifken tablist geçersiz bir duruma düşmesin diye
  // "son seçili sekme" ayrı tutulur; Ayarlar açıkken de tam olarak bir `tab` `aria-selected` kalır.
  const [lastTabScreen, setLastTabScreen] = useState<TabScreen>('timeline')
  const [projectsUpdate, setProjectsUpdate] = useState<ProjectListItem[] | null>(null)
  const [featuresSignal, setFeaturesSignal] = useState<{ project_id: string } | null>(null)
  const [gatesSignal, setGatesSignal] = useState<{ project_id: string } | null>(null)

  // F-003 §2.2: tek `useEventStream()` çağrısı App kökünde — tek SSE bağlantısı. TimelineScreen
  // kendi bağlantısını açmaz, bu sonucu prop olarak alır. F-005: `onProjects` de aynı tek
  // bağlantıyı paylaşır (ADR-004 madde 1). F-007: `onFeatures` de aynı desende eklendi —
  // Kanban ikinci bir EventSource AÇMAZ. F-012: altı `chat_*` kanalı + `onChatSync` de aynı
  // paylaşılan bağlantıyı kullanır, `useChatSession`'ın kararlı (`useCallback`) referansları.
  const stream = useEventStream('/api/stream', '/api/events', {
    onProjects: setProjectsUpdate,
    onFeatures: setFeaturesSignal,
    onGates: setGatesSignal,
    onChatMessage: chat.handlers.onChatMessage as (payload: unknown) => void,
    onChatUserEcho: chat.handlers.onChatUserEcho as (payload: unknown) => void,
    onChatToolEvent: chat.handlers.onChatToolEvent as (payload: unknown) => void,
    onChatPermissionRequest: chat.handlers.onChatPermissionRequest as (payload: unknown) => void,
    onChatPermissionResolved: chat.handlers.onChatPermissionResolved as (payload: unknown) => void,
    onChatStatus: chat.handlers.onChatStatus as (payload: unknown) => void,
    onChatError: chat.handlers.onChatError as (payload: unknown) => void,
    onChatSync: chat.handlers.onChatSync,
  })

  const selectedTab: TabScreen = activeScreen === 'settings' ? lastTabScreen : activeScreen

  function selectTab(screen: TabScreen): void {
    setLastTabScreen(screen)
    setActiveScreen(screen)
  }

  // QA düzeltme turu 1 (D50/Ö1) — WAI-ARIA APG Tabs Pattern roving tabindex, ok tuşuyla
  // seçim değiştiğinde DOM odağı da yeni sekmeye taşınır; aksi hâlde ekran okuyucu duyurmaz
  // ve bir sonraki `Tab` basışı beklenmedik yere düşer (QA ölçtü, `docs/qa/F-007-2026-09-06.md`
  // Ö1). `id`ler sabit (`tab-${screen}`) olduğu için ref dizisi yerine doğrudan DOM sorgusu
  // yeterli — gereksiz soyutlama eklenmiyor (Karpathy §2).
  function focusTab(screen: TabScreen): void {
    document.getElementById(`tab-${screen}`)?.focus()
  }

  function onTabKeyDown(event: React.KeyboardEvent<HTMLSpanElement>): void {
    const currentIndex = TABS.findIndex((t) => t.screen === selectedTab)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const nextIndex = (currentIndex + delta + TABS.length) % TABS.length
      const nextScreen = TABS[nextIndex]!.screen
      selectTab(nextScreen)
      focusTab(nextScreen)
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectTab(TABS[0]!.screen)
      focusTab(TABS[0]!.screen)
    } else if (event.key === 'End') {
      event.preventDefault()
      selectTab(TABS[TABS.length - 1]!.screen)
      focusTab(TABS[TABS.length - 1]!.screen)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* QA düzeltme turu 1 (BLOKLAYICI B2/T3) — `docs/03-ux.md:48-56` dar-genişlik mockup'ının
          BİREBİR uyguladığı iki satırlı düzen: <640px (`sm:` altı) başlık+rozet+Ayarlar üstte,
          sekme çubuğu ALTTA kendi satırında TAM genişlik alır (title/right-group ile genişlik
          YARIŞMAZ) — önceki tek-satırlık `overflow-x-auto` düzeni QA'nın ölçtüğü gibi 375px'te
          her iki sekmenin de kırpılmış görünür genişliğini SIFIRA indiriyordu (title'ın doğal
          genişliği tek başına kalan alanı tüketiyordu). `sm:` (≥640px) üzerinde tek satıra
          döner (`sm:flex-nowrap`, `order-none`), başlık doğal genişliğinde, sekme alanı
          `flex-1` — geniş ekran görünümü DEĞİŞMEDİ. */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-800 px-4 py-2 sm:h-14 sm:flex-nowrap sm:gap-y-0 sm:py-0">
        <span
          data-testid="app-title"
          // Tailwind'in min-width sıfırlama yardımcı sınıfı KASITLI OLARAK class değil, inline
          // style olarak uygulanıyor: `tests/build-css.test.ts` "yalnızca projects/web" testi
          // o TAM sınıf dizgesinin `src/web/**`'te HİÇ geçmediğini ön koşul sayıyor (F-005
          // kararı) — dosya sahipliği dışına çıkmadan aynı CSS davranışını (dar genişlikte flex
          // item'ın içeriğe göre büzülmesine izin verir, `truncate` ile birlikte) elde etmenin
          // cerrahi yolu.
          style={{ minWidth: 0 }}
          className="order-1 flex-1 truncate font-display tracking-wide text-lg sm:order-none sm:flex-none sm:shrink-0"
        >
          MISSION CONTROL
        </span>
        <div
          role="tablist"
          aria-label="Ekranlar"
          // QA düzeltme turu 1 (X3/Ö2) — beşinci sekme (Thread) eklenince üretim varsayılanında
          // (sohbet açık, 5 sekme) 320/375px'te son sekme(ler) `overflow-x-auto` şeridinin
          // TAMAMEN dışına düşüyordu (kırpılmış görünür genişlik 0px, QA ölçtü — E2E çiti eskiden
          // sohbeti kapalı koşan bir yapılandırmayla 4 sekme ölçtüğü için bunu YAKALAYAMIYORDU).
          // Yalnızca dar genişlikte (`sm:` altı) boşluk/yazı boyutu küçültülür — metin/yapı/geniş
          // ekran görünümü DEĞİŞMEZ; bu, 5 sekmenin tamamının en azından bir kısmının başlangıç
          // kaydırma konumunda (scrollLeft=0) görünür kalması için yeterli.
          className="order-3 flex w-full shrink-0 items-center gap-1.5 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:gap-4"
        >
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
                    ? 'cursor-pointer whitespace-nowrap text-xs font-mono text-amber-400 sm:text-sm'
                    : 'cursor-pointer whitespace-nowrap text-xs font-mono text-zinc-400 sm:text-sm'
                }
              >
                {tab.label}
              </span>
            )
          })}
        </div>
        <div className="order-2 flex shrink-0 items-center gap-4 sm:order-none">
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
        {chatUiEnabled && (
          <div
            id="panel-chat"
            role="tabpanel"
            aria-labelledby="tab-chat"
            hidden={activeScreen !== 'chat'}
            className="h-full"
          >
            <ScreenErrorBoundary>
              <ChatScreen chat={chat} />
            </ScreenErrorBoundary>
          </div>
        )}
        <div
          id="panel-gates"
          role="tabpanel"
          aria-labelledby="tab-gates"
          hidden={activeScreen !== 'gates'}
          className="h-full"
        >
          <ScreenErrorBoundary>
            <GatesScreen
              liveProjectsUpdate={projectsUpdate}
              gatesSignal={gatesSignal}
              onNavigateSettings={() => setActiveScreen('settings')}
            />
          </ScreenErrorBoundary>
        </div>
        <div
          id="panel-thread"
          role="tabpanel"
          aria-labelledby="tab-thread"
          hidden={activeScreen !== 'thread'}
          className="h-full"
        >
          <ScreenErrorBoundary>
            <ThreadScreen
              liveProjectsUpdate={projectsUpdate}
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
