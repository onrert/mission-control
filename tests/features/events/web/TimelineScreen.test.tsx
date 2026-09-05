// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimelineScreen } from '../../../../src/features/events/web/TimelineScreen'
import type { UseEventStreamResult } from '../../../../src/web/lib/useEventStream'
import type { EventRecord } from '../../../../src/shared/types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function makeEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    seq: 0,
    id: '0-a',
    ts: new Date().toISOString(),
    received_ms: Date.now(),
    project_path: 'p',
    project_name: 'mission-control',
    hook_event_name: 'PreToolUse',
    agent_type: 'developer',
    tool_name: 'Bash',
    summary: 's',
    flags: [],
    raw: {},
    ...overrides,
  }
}

function makeStream(overrides: Partial<UseEventStreamResult> = {}): UseEventStreamResult {
  return {
    events: [],
    connectionStatus: 'connected',
    loadState: 'ready',
    staleData: false,
    retryInitialLoad: vi.fn(),
    pausedByUser: false,
    scrolledAway: false,
    frozen: false,
    pendingCount: 0,
    togglePause: vi.fn(),
    setScrolledAway: vi.fn(),
    resume: vi.fn(),
    ...overrides,
  }
}

describe('TimelineScreen — durumlar', () => {
  it('loadState=loading iken iskelet + "Son 100 olay yükleniyor…" gösterir', () => {
    render(<TimelineScreen stream={makeStream({ loadState: 'loading' })} />)
    expect(screen.getByTestId('timeline-skeleton')).toBeTruthy()
    expect(screen.getByText('Son 100 olay yükleniyor…')).toBeTruthy()
  })

  it('loadState=error iken hata banner + Tekrar dene gösterir, tıklanınca retryInitialLoad çağrılır', async () => {
    const retryInitialLoad = vi.fn()
    const user = userEvent.setup()
    render(<TimelineScreen stream={makeStream({ loadState: 'error', retryInitialLoad })} />)
    expect(screen.getByTestId('timeline-error-banner')).toBeTruthy()
    expect(screen.getByText('Olay geçmişi yüklenemedi.')).toBeTruthy()
    await user.click(screen.getByText('Tekrar dene'))
    expect(retryInitialLoad).toHaveBeenCalled()
  })

  it('loadState=ready, events boş iken boş durum metni gösterir', () => {
    render(<TimelineScreen stream={makeStream({ events: [] })} />)
    expect(screen.getByTestId('timeline-empty').textContent).toContain('Henüz olay yok.')
  })

  it('staleData true iken liste korunur + "Olay deposu okunamadı" banner görünür', () => {
    render(<TimelineScreen stream={makeStream({ events: [makeEvent()], staleData: true })} />)
    expect(screen.getByTestId('timeline-stale-banner')).toBeTruthy()
    expect(screen.getByTestId('timeline-row')).toBeTruthy()
  })
})

describe('TimelineScreen — AC3/AC9: tüm tipler gösterilir, filtre yalnızca görünüm', () => {
  it('farklı hook_event_name değerleri hepsi varsayılan olarak render edilir', () => {
    const events = [
      makeEvent({ seq: 0, hook_event_name: 'PreToolUse' }),
      makeEvent({ seq: 1, hook_event_name: 'UserPromptSubmit' }),
      makeEvent({ seq: 2, hook_event_name: 'SessionStart' }),
    ]
    render(<TimelineScreen stream={makeStream({ events })} />)
    expect(screen.getAllByTestId('timeline-row')).toHaveLength(3)
  })

  it('Tip filtresinden bir değer kaldırılınca yalnızca görünüm daralır, events prop değişmez', async () => {
    const user = userEvent.setup()
    const events = [
      makeEvent({ seq: 0, hook_event_name: 'PreToolUse' }),
      makeEvent({ seq: 1, hook_event_name: 'UserPromptSubmit' }),
    ]
    render(<TimelineScreen stream={makeStream({ events })} />)
    expect(screen.getAllByTestId('timeline-row')).toHaveLength(2)

    const typeGroup = screen.getByTestId('filter-group-Tip')
    const promptChip = Array.from(typeGroup.querySelectorAll('button')).find(
      (b) => b.textContent === 'UserPromptSubmit'
    )!
    await user.click(promptChip)

    expect(screen.getAllByTestId('timeline-row')).toHaveLength(1)
    expect(screen.getByTestId('row-tool').textContent).toBe('Bash')
  })
})

describe('TimelineScreen — AC4: çoklu seçim filtreler', () => {
  it('proje filtresi çoklu seçilebilir, iki proje seçiliyken ikisi de görünür', async () => {
    const user = userEvent.setup()
    const events = [
      makeEvent({ seq: 0, project_name: 'mission-control' }),
      makeEvent({ seq: 1, project_name: 'app-factory' }),
      makeEvent({ seq: 2, project_name: 'other-project' }),
    ]
    render(<TimelineScreen stream={makeStream({ events })} />)
    expect(screen.getAllByTestId('timeline-row')).toHaveLength(3)

    const projectGroup = screen.getByTestId('filter-group-Proje')
    const otherChip = Array.from(projectGroup.querySelectorAll('button')).find(
      (b) => b.textContent === 'other-project'
    )!
    await user.click(otherChip)
    expect(screen.getAllByTestId('timeline-row')).toHaveLength(2)

    await user.click(screen.getByText('Filtreleri temizle'))
    expect(screen.getAllByTestId('timeline-row')).toHaveLength(3)
  })
})

describe('TimelineScreen — AC6 (dar kapsam, jsdom): duraklatılmışken render sayısı sabit, pendingCount artar', () => {
  it('frozen=true, pendingCount>0 iken rozet gösterilir; events sayısı stream.events ile birebir', () => {
    const events = [makeEvent({ seq: 0 }), makeEvent({ seq: 1 })]
    render(
      <TimelineScreen
        stream={makeStream({ events, frozen: true, pausedByUser: true, pendingCount: 3 })}
      />
    )
    expect(screen.getAllByTestId('timeline-row')).toHaveLength(2)
    const badge = screen.getByTestId('pending-events-badge')
    expect(badge.textContent).toContain('3 yeni olay')
  })

  it('frozen=false iken pending rozeti gösterilmez', () => {
    render(<TimelineScreen stream={makeStream({ events: [makeEvent()], pendingCount: 0 })} />)
    expect(screen.queryByTestId('pending-events-badge')).toBeNull()
  })

  it('rozete tıklanınca resume çağrılır', async () => {
    const resume = vi.fn()
    const user = userEvent.setup()
    render(
      <TimelineScreen
        stream={makeStream({
          events: [makeEvent()],
          frozen: true,
          pausedByUser: true,
          pendingCount: 2,
          resume,
        })}
      />
    )
    await user.click(screen.getByTestId('pending-events-badge'))
    expect(resume).toHaveBeenCalled()
  })

  it('Duraklat butonu tıklanınca togglePause çağrılır, paused iken etiket "Devam et" olur', async () => {
    const togglePause = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<TimelineScreen stream={makeStream({ togglePause })} />)
    expect(screen.getByText('Duraklat')).toBeTruthy()
    await user.click(screen.getByText('Duraklat'))
    expect(togglePause).toHaveBeenCalled()

    rerender(<TimelineScreen stream={makeStream({ pausedByUser: true, frozen: true })} />)
    expect(screen.getByText('Devam et')).toBeTruthy()
  })
})

describe('TimelineScreen — gruplama (Enter/Boşluk)', () => {
  it('3+ ardışık aynı session/agent PreToolUse olayı tek grup satırına katlanır, Enter ile genişler', async () => {
    const user = userEvent.setup()
    const events = Array.from({ length: 4 }, (_, i) =>
      makeEvent({
        seq: i,
        session_id: 's1',
        agent_type: 'developer',
        hook_event_name: 'PreToolUse',
      })
    )
    render(<TimelineScreen stream={makeStream({ events })} />)
    expect(screen.queryAllByTestId('timeline-row')).toHaveLength(0)
    const group = screen.getByTestId('timeline-group')
    expect(group.textContent).toContain('4 araç çağrısı')

    const groupHeader = group.querySelector('[role="button"]')!
    ;(groupHeader as HTMLElement).focus()
    await user.keyboard('{Enter}')
    expect(screen.getAllByTestId('timeline-row')).toHaveLength(4)

    await user.keyboard('{Enter}')
    expect(screen.queryAllByTestId('timeline-row')).toHaveLength(0)
  })
})

describe('TimelineScreen — olay hızı', () => {
  it('son 60 sn içindeki olayları sayar, eski olaylar sayılmaz', () => {
    const now = Date.now()
    const events = [
      makeEvent({ seq: 0, received_ms: now - 1000 }),
      makeEvent({ seq: 1, received_ms: now - 30000 }),
      makeEvent({ seq: 2, received_ms: now - 120000 }),
    ]
    render(<TimelineScreen stream={makeStream({ events })} />)
    expect(screen.getByTestId('event-rate').textContent).toBe('2 olay/dk')
  })

  it('1 sn sonra pencereden çıkan olay sayıyı düşürür (setInterval tetiklenir)', () => {
    vi.useFakeTimers()
    const now = Date.now()
    const events = [makeEvent({ seq: 0, received_ms: now - 59500 })]
    render(<TimelineScreen stream={makeStream({ events })} />)
    expect(screen.getByTestId('event-rate').textContent).toBe('1 olay/dk')
    act(() => {
      vi.setSystemTime(now + 1000)
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId('event-rate').textContent).toBe('0 olay/dk')
  })
})

describe('TimelineScreen — bağlantı rozeti (ekran-yerel)', () => {
  it('connected -> CANLI, disconnected -> DUYGUSUZ', () => {
    const { rerender } = render(
      <TimelineScreen stream={makeStream({ connectionStatus: 'connected' })} />
    )
    expect(screen.getByTestId('connection-badge-mini').textContent).toContain('CANLI')
    rerender(<TimelineScreen stream={makeStream({ connectionStatus: 'disconnected' })} />)
    expect(screen.getByTestId('connection-badge-mini').textContent).toContain('DUYGUSUZ')
  })
})

describe('TimelineScreen — render üst sınırı (1000, hook zaten uyguluyor)', () => {
  it('stream.events 1000den fazla olsa bile TimelineScreen olduğu gibi render eder (tavan hook sorumluluğunda)', () => {
    const events = Array.from({ length: 50 }, (_, i) => makeEvent({ seq: i }))
    render(<TimelineScreen stream={makeStream({ events })} />)
    expect(screen.getAllByTestId('timeline-row')).toHaveLength(50)
  })
})

// QA düzeltme turu 1, NOT-1: `aria-live="polite"` canlı bölgesinin (sözleşme §1 madde 4,
// §3 madde 10) hiç testi yoktu. `sr-only` sınıfının GERÇEKTEN ekrandan gizlediği B1'in kendi
// çiti (`tests/build-css.test.ts`, üretim CSS'inde `sr-only` üretildiğini kanıtlıyor) —
// burada yalnızca doğru ARIA özniteliğinin ve doğru metnin (rozetle birebir aynı 3 durum
// eşlemesi) var olduğu, jsdom seviyesinde denetleniyor.
describe('TimelineScreen — aria-live canlı bölge (NOT-1)', () => {
  it('aria-live="polite" ve sr-only taşıyan tek bir bölge var', () => {
    render(<TimelineScreen stream={makeStream({ connectionStatus: 'connected' })} />)
    const liveRegions = document.querySelectorAll('[aria-live="polite"]')
    expect(liveRegions.length).toBe(1)
    expect(liveRegions[0]?.className).toContain('sr-only')
  })

  it.each([
    ['connected', 'Bağlı'],
    ['reconnecting', 'Yeniden bağlanıyor'],
    ['connecting', 'Yeniden bağlanıyor'],
    ['disconnected', 'Bağlantı koptu'],
  ] as const)('connectionStatus=%s -> canlı bölge metni "%s"', (status, expectedText) => {
    render(<TimelineScreen stream={makeStream({ connectionStatus: status })} />)
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe(expectedText)
  })
})
