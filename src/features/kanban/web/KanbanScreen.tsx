import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core'
import type { KeyboardCoordinateGetter } from '@dnd-kit/core'
import type { FeatureCard, ProjectListItem } from '../../../shared/types'
import type { ConnectionStatus } from '../../../web/lib/useEventStream'
import { STATUS_COLUMNS } from '../../../shared/constants'
import { FilterChips, ClearFiltersLink } from '../../events/web/FilterChips'
import { useProjects } from '../../projects/web/useProjects'
import { useFeatures, cardKey } from './useFeatures'
import { KanbanColumn } from './KanbanColumn'
import { FeatureDetailModal } from './FeatureDetailModal'
import { nextColumnCoordinates, type ColumnRect } from './keyboardCoordinates'

export interface KanbanScreenProps {
  /** App.tsx'in `onProjects` akışından gelen tam liste (Karar 1 — ikinci canlı kaynak yok). */
  liveProjectsUpdate: ProjectListItem[] | null
  /** App.tsx'in `onFeatures` akışından gelen sinyal (yalnızca `{project_id}`, §3 madde 7). */
  featuresSignal: { project_id: string } | null
  connectionStatus: ConnectionStatus
  onNavigateSettings: () => void
}

const TURKISH_SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'Bu kartı taşımak için Boşluk tuşuna basın, sonra sol veya sağ ok tuşlarıyla hedef sütuna ' +
    'gidin, Enter veya Boşluk ile onaylayın ya da Escape ile iptal edin.',
}

const SILENT_ANNOUNCEMENTS = {
  onDragStart: () => '',
  onDragOver: () => '',
  onDragEnd: () => '',
  onDragCancel: () => '',
}

// Sensör seçenekleri MODÜL SEVİYESİNDE sabit tutulur (§8 mutasyon 5/D42 bulgusu — bu turda
// bulundu): `@dnd-kit/core`'un `useSensor` bu OBJE REFERANSINI bağımlılık olarak kullanıyor
// (`useMemo([sensor, options])`); her render'da YENİ bir literal geçilirse `useSensors`'un
// döndürdüğü `sensors` dizisi de her render YENİ bir referans olur. `DndContext`'in `sensors`
// prop'u değiştiğinde dnd-kit KENDİ context değerini yeniden oluşturuyor — bu da her
// `useDraggable`/`useDroppable` TÜKETİCİSİNİ (yani her `KanbanCard`/`KanbanColumn`) `React.memo`
// TAMAMEN DEVRE DIŞI kalacak şekilde yeniden render ediyordu (memo yalnızca PROP değişikliğine
// bakar, context aboneliğinden gelen render'ı engelleyemez). "Son senkron" saatinin (1 sn'lik
// `now` interval'i) KanbanScreen'i her tikte yeniden render etmesi bu yüzden TÜM kartların
// gereksiz yere yeniden render olmasına yol açıyordu (D42 echo ölçümü render sayacının 3 sn
// içinde sabit kalmasını bekliyor).
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } }
const KEYBOARD_CODES = { start: ['Space'], end: ['Space', 'Enter', 'Tab'], cancel: ['Escape'] }

function formatSecondsAgo(ms: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - ms) / 1000))
  return `${seconds} sn önce`
}

export function KanbanScreen({
  liveProjectsUpdate,
  featuresSignal,
  connectionStatus,
  onNavigateSettings,
}: KanbanScreenProps) {
  // Karar 1 (§3 madde 9): mevcut, zaten test edilmiş `useProjects` hook'u `SettingsScreen`
  // ile birebir aynı desende yeniden kullanılır — ikinci bir EventSource/`useEventStream()`
  // çağrısı YOK, tek canlı kaynak App.tsx'in `projectsUpdate` state'i.
  const { items: projects } = useProjects(liveProjectsUpdate)
  const {
    cards,
    loadState,
    unreadableProjects,
    lastSyncedAt,
    retry,
    isPending,
    patchStatus,
    notifyDragStart,
    notifyDragEnd,
  } = useFeatures({ featuresSignal, projectsSignal: liveProjectsUpdate })

  const [deselectedProjects, setDeselectedProjects] = useState<Set<string>>(new Set())
  const [detailCard, setDetailCard] = useState<FeatureCard | null>(null)
  const [conflictBanner, setConflictBanner] = useState<string | null>(null)
  const [conflictedKey, setConflictedKey] = useState<string | null>(null)
  const [toast, setToast] = useState<{
    message: string
    tone: 'success' | 'error'
    retryCard?: FeatureCard
    retryStatus?: string
  } | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!toast || toast.tone !== 'success') return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!conflictedKey) return
    const id = setTimeout(() => setConflictedKey(null), 1000)
    return () => clearTimeout(id)
  }, [conflictedKey])

  const projectLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) map.set(p.id, p.label)
    return map
  }, [projects])

  const projectOptions = useMemo(() => projects.map((p) => p.label).sort(), [projects])

  const visibleCards = useMemo(
    () =>
      cards.filter((c) => {
        const label = projectLabelById.get(c.project_id) ?? c.project_id
        return !deselectedProjects.has(label)
      }),
    [cards, projectLabelById, deselectedProjects]
  )

  const parseErrorCards = useMemo(
    () => visibleCards.filter((c) => c.parse_error !== undefined),
    [visibleCards]
  )
  const okCards = useMemo(
    () => visibleCards.filter((c) => c.parse_error === undefined),
    [visibleCards]
  )
  const hasUnknown = okCards.some((c) => c.column === 'unknown')

  const columnOrder = useMemo(
    () => [...STATUS_COLUMNS.map((c) => c.key), ...(hasUnknown ? ['unknown'] : [])],
    [hasUnknown]
  )

  const handleDrop = useCallback(
    async (card: FeatureCard, nextColumn: string): Promise<void> => {
      if (card.column === nextColumn) return
      const outcome = await patchStatus(card, nextColumn)
      if (outcome.kind === 'success') {
        const label = STATUS_COLUMNS.find((c) => c.key === nextColumn)?.label ?? 'Bilinmeyen durum'
        setToast({
          message: `${card.id} → ${label} (${nextColumn}) olarak güncellendi`,
          tone: 'success',
        })
        return
      }
      if (outcome.kind === 'conflict') {
        setConflictedKey(cardKey(card))
        const label =
          STATUS_COLUMNS.find((c) => c.key === outcome.card.column)?.label ?? 'Bilinmeyen durum'
        setConflictBanner(
          `${card.id} panel açıkken dışarıdan değişti — güncel durum yüklendi (${label}/${outcome.card.column}). Az önceki sürükleme uygulanmadı.`
        )
        return
      }
      setToast({
        message: `${card.id} kaydedilemedi: ${outcome.message}`,
        tone: 'error',
        retryCard: card,
        retryStatus: nextColumn,
      })
    },
    [patchStatus]
  )

  function handleRetryToast(): void {
    if (!toast?.retryCard || !toast.retryStatus) return
    setToast(null)
    void handleDrop(toast.retryCard, toast.retryStatus)
  }

  // §7 — klavye koordinat çekirdeği: sütun listesi üzerinde index kaydırma (piksel değil).
  // `useCallback` (D42 bulgusu, yukarıdaki modül seviyesi yorum) — referansı yalnızca
  // `columnOrder` gerçekten değiştiğinde (yeni sütun kümesi) değişir, `now`/`toast` gibi
  // ilgisiz state tikleriyle DEĞİL.
  const coordinateGetter: KeyboardCoordinateGetter = useCallback(
    (event, { context, currentCoordinates }) => {
      if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') {
        return undefined
      }
      const rects: ColumnRect[] = []
      for (const key of columnOrder) {
        const rect = context.droppableRects.get(key)
        if (!rect) continue
        rects.push({ key, left: rect.left, top: rect.top, width: rect.width, height: rect.height })
      }
      if (rects.length === 0) return undefined
      let currentIndex = context.over ? rects.findIndex((r) => r.key === context.over?.id) : -1
      if (currentIndex === -1) {
        currentIndex = rects.findIndex(
          (r) => currentCoordinates.x >= r.left && currentCoordinates.x <= r.left + r.width
        )
      }
      if (currentIndex === -1) currentIndex = 0
      const direction = event.code === 'ArrowLeft' ? 'left' : 'right'
      const next = nextColumnCoordinates(rects, currentIndex, direction)
      if (!next) return undefined
      event.preventDefault()
      const column = STATUS_COLUMNS.find((c) => c.key === next.key)
      setLiveMessage(`${column?.label ?? 'Bilinmeyen durum'} (${next.key}) sütununa taşınıyor`)
      return { x: next.x, y: next.y }
    },
    [columnOrder]
  )

  // Klavye sensörünün `options` nesnesi de sabitlenir (yukarıdaki modül yorumu) — yalnızca
  // `coordinateGetter` gerçekten değiştiğinde yeni bir referans üretir.
  const keyboardSensorOptions = useMemo(
    () => ({ coordinateGetter, keyboardCodes: KEYBOARD_CODES }),
    [coordinateGetter]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    // §3 madde 6/§7 (YENİ-R1) — dnd-kit'in VARSAYILAN `keyboardCodes.start` hem `Space` hem
    // `Enter` içerir. `Enter` AC7'nin (karta tıkla/Enter'la aç → detay modalı) klavye
    // eşdeğeriyle çakışır: `Enter` varsayılanda kalsaydı boşta bir karta `Enter` basıldığında
    // dnd-kit AYNI ANDA sürüklemeyi başlatır VE `KanbanCard.handleKeyDown` (stale `isDragging`
    // kapanışıyla) modalı da açardı — iki eylem birden. `start`'tan yalnızca `Enter` çıkarılır,
    // `end`/`cancel` dnd-kit'in varsayılanıyla aynı bırakılır (bilinçli sapma, `docs/03-ux.md:443`).
    useSensor(KeyboardSensor, keyboardSensorOptions)
  )

  const cardsByKey = useMemo(() => {
    const map = new Map<string, FeatureCard>()
    for (const c of okCards) map.set(cardKey(c), c)
    return map
  }, [okCards])

  const handleDragStart = useCallback(
    (event: DragStartEvent): void => {
      notifyDragStart()
      const card = cardsByKey.get(String(event.active.id))
      if (card) setLiveMessage(`${card.title} kartı seçildi`)
    },
    [notifyDragStart, cardsByKey]
  )

  const handleDragOver = useCallback((event: DragOverEvent): void => {
    if (!event.over) return
    const column = STATUS_COLUMNS.find((c) => c.key === event.over?.id)
    setLiveMessage(
      `${column?.label ?? 'Bilinmeyen durum'} (${String(event.over.id)}) sütununa taşınıyor`
    )
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      notifyDragEnd()
      const card = cardsByKey.get(String(event.active.id))
      if (card && event.over) {
        const nextColumn = String(event.over.id)
        const column = STATUS_COLUMNS.find((c) => c.key === nextColumn)
        setLiveMessage(
          `${card.title} → ${column?.label ?? 'Bilinmeyen durum'} (${nextColumn}) olarak taşındı`
        )
        void handleDrop(card, nextColumn)
      }
    },
    [notifyDragEnd, cardsByKey, handleDrop]
  )

  const handleDragCancel = useCallback((): void => {
    notifyDragEnd()
    setLiveMessage('İptal edildi')
  }, [notifyDragEnd])

  const noProjects = projects.length === 0
  const isEmpty = loadState === 'ready' && visibleCards.length === 0 && parseErrorCards.length === 0

  return (
    <div
      data-testid="kanban-screen"
      className="flex h-full flex-col gap-3 overflow-y-auto bg-zinc-950 p-3 text-zinc-100"
    >
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChips
          label="Proje"
          options={projectOptions}
          selected={new Set(projectOptions.filter((o) => !deselectedProjects.has(o)))}
          onToggle={(value) =>
            setDeselectedProjects((prev) => {
              const next = new Set(prev)
              if (next.has(value)) next.delete(value)
              else next.add(value)
              return next
            })
          }
        />
        {deselectedProjects.size > 0 && (
          <ClearFiltersLink onClear={() => setDeselectedProjects(new Set())} />
        )}
        {lastSyncedAt !== null && (
          <span data-testid="kanban-last-synced" className="text-xs text-zinc-500">
            Son senkron: {formatSecondsAgo(lastSyncedAt, now)}
          </span>
        )}
      </div>

      {connectionStatus === 'disconnected' && (
        <div
          role="alert"
          data-testid="kanban-connection-lost-banner"
          className="flex items-center justify-between gap-3 rounded-md border border-amber-800 bg-amber-950/40 p-2 text-sm text-amber-300"
        >
          <span>
            Canlı senkron durdu — son görülen:{' '}
            {lastSyncedAt !== null ? formatSecondsAgo(lastSyncedAt, now) : 'bilinmiyor'}.
          </span>
          <button
            type="button"
            onClick={retry}
            className="min-h-8 rounded-md border border-amber-700 px-3 py-1.5 text-xs"
          >
            Yenile
          </button>
        </div>
      )}

      {unreadableProjects.map((p) => (
        <div
          key={p.project_id}
          role="alert"
          data-testid={`kanban-unreadable-${p.project_id}`}
          className="rounded-md border border-red-800 bg-red-950/40 p-2 text-sm text-red-300"
        >
          ⚠ {p.label}: dosyalar okunamadı
        </div>
      ))}

      {conflictBanner && (
        <div
          role="alert"
          data-testid="kanban-conflict-banner"
          className="flex items-center justify-between gap-3 rounded-md border border-orange-700 bg-orange-950/40 p-2 text-sm text-orange-300"
        >
          <span>{conflictBanner}</span>
          <button
            type="button"
            onClick={() => setConflictBanner(null)}
            className="min-h-8 rounded-md border border-orange-700 px-3 py-1.5 text-xs"
          >
            Kapat
          </button>
        </div>
      )}

      {toast && (
        <div
          role={toast.tone === 'error' ? 'alert' : 'status'}
          data-testid="kanban-toast"
          className={`flex items-center justify-between gap-3 rounded-md border p-2 text-sm ${
            toast.tone === 'error'
              ? 'border-red-700 bg-red-950/40 text-red-300'
              : 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
          }`}
        >
          <span>{toast.message}</span>
          {toast.tone === 'error' && toast.retryCard && (
            <button
              type="button"
              onClick={handleRetryToast}
              className="min-h-8 rounded-md border border-red-700 px-3 py-1.5 text-xs"
            >
              Tekrar dene
            </button>
          )}
        </div>
      )}

      {noProjects && loadState === 'ready' && (
        <div
          data-testid="kanban-empty"
          className="flex flex-col items-center gap-2 p-8 text-center"
        >
          <p className="text-sm text-zinc-500">İzlenen projelerde henüz feature bulunamadı.</p>
          <button
            type="button"
            onClick={onNavigateSettings}
            className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
          >
            Ayarlar&apos;a git
          </button>
        </div>
      )}

      {!noProjects && isEmpty && (
        <div
          data-testid="kanban-empty"
          className="flex flex-col items-center gap-2 p-8 text-center"
        >
          <p className="text-sm text-zinc-500">İzlenen projelerde henüz feature bulunamadı.</p>
          <button
            type="button"
            onClick={onNavigateSettings}
            className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
          >
            Ayarlar&apos;a git
          </button>
        </div>
      )}

      {(!noProjects || loadState === 'loading') && !isEmpty && (
        <KanbanBoard
          sensors={sensors}
          okCards={okCards}
          hasUnknown={hasUnknown}
          loading={loadState === 'loading'}
          isPending={isPending}
          conflictedKey={conflictedKey}
          onOpenDetail={setDetailCard}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        />
      )}

      {parseErrorCards.length > 0 && (
        <div data-testid="kanban-unparsable" className="border-t border-zinc-800 pt-2">
          <h3 className="mb-1 text-xs text-zinc-500">
            Ayrıştırılamayan dosyalar ({parseErrorCards.length})
          </h3>
          <ul className="flex flex-wrap gap-2">
            {parseErrorCards.map((c) => (
              <li
                key={cardKey(c)}
                data-testid={`kanban-unparsable-${c.file}`}
                className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-400"
              >
                ⚠ {c.id} ayrıştırılamadı
              </li>
            ))}
          </ul>
        </div>
      )}

      {detailCard && <FeatureDetailModal card={detailCard} onClose={() => setDetailCard(null)} />}
    </div>
  )
}

interface KanbanBoardProps {
  sensors: SensorDescriptor<SensorOptions>[]
  okCards: FeatureCard[]
  hasUnknown: boolean
  loading: boolean
  isPending: (card: FeatureCard) => boolean
  conflictedKey: string | null
  onOpenDetail: (card: FeatureCard) => void
  onDragStart: (event: DragStartEvent) => void
  onDragOver: (event: DragOverEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  onDragCancel: () => void
}

/**
 * `DndContext` + sütunlar — D42 bulgusu düzeltmesi (yukarıdaki modül yorumu): AYRI, `memo`
 * SARILI bir bileşene çıkarıldı ki `KanbanScreen`'in ilgisiz state'i (`now` saati, `toast`
 * zamanlayıcısı, `conflictedKey` sıfırlama zamanlayıcısı) her tetiklendiğinde bu alt ağaç
 * (ve dolayısıyla `DndContext`'in kendi context değeri, ve dolayısıyla HER `KanbanCard`'ın
 * `useDraggable` aboneliği) yeniden render OLMASIN. `KanbanScreen` tarafında tüm prop'lar
 * (`sensors`, `okCards`, handler'lar) zaten `useCallback`/`useMemo`/dnd-kit'in kendi
 * memoizasyonuyla referans olarak sabit — bu bileşen yalnızca GERÇEK bir veri/durum
 * değişikliğinde (kartlar, yükleme durumu, çakışma vurgusu) yeniden render olur.
 */
const KanbanBoard = memo(function KanbanBoard({
  sensors,
  okCards,
  hasUnknown,
  loading,
  isPending,
  conflictedKey,
  onOpenDetail,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
}: KanbanBoardProps) {
  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements: SILENT_ANNOUNCEMENTS,
        screenReaderInstructions: TURKISH_SCREEN_READER_INSTRUCTIONS,
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex flex-1 gap-2 overflow-x-auto pb-2">
        {STATUS_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            columnKey={col.key}
            label={col.label}
            cards={okCards.filter((c) => c.column === col.key)}
            loading={loading}
            isPending={isPending}
            conflictedKey={conflictedKey}
            onOpenDetail={onOpenDetail}
          />
        ))}
        {hasUnknown && (
          <KanbanColumn
            columnKey="unknown"
            label="Bilinmeyen durum"
            unknown
            cards={okCards.filter((c) => c.column === 'unknown')}
            loading={loading}
            isPending={isPending}
            conflictedKey={conflictedKey}
            onOpenDetail={onOpenDetail}
          />
        )}
      </div>
    </DndContext>
  )
})
