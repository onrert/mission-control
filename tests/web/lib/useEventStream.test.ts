// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, act, waitFor } from '@testing-library/react'
import { useEventStream } from '../../../src/web/lib/useEventStream'
import { FakeEventSource } from '../../helpers/fake-event-source'
import type { EventRecord } from '../../../src/shared/types'

afterEach(() => cleanup())

function makeEvent(seq: number, overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    seq,
    id: `${seq}-a`,
    ts: new Date().toISOString(),
    received_ms: Date.now(),
    project_path: 'p',
    project_name: 'demo',
    hook_event_name: 'PreToolUse',
    summary: 's',
    flags: [],
    raw: {},
    ...overrides,
  }
}

function fakeFetchOk(events: EventRecord[]) {
  return vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: events,
      meta: { total: events.length, next_seq: events.length },
    }),
    url,
  })) as unknown as typeof fetch
}

describe('useEventStream', () => {
  it('ilk yükleme başarılı olunca loadState=ready, events dolar; fetch tam olarak bir kez, filtre param içermeyen URL ile çağrılır', async () => {
    FakeEventSource.reset()
    const fetchImpl = fakeFetchOk([makeEvent(0), makeEvent(1)])
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )

    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(result.current.events.map((e) => e.seq)).toEqual([0, 1])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    // since_seq HİÇ gönderilmez: query.ts negatif since_seq'i 400 invalid_body ile reddediyor
    // (bkz. src/web/lib/useEventStream.ts loadEvents yorumu, CEO düzeltmesi).
    expect(fetchImpl).toHaveBeenCalledWith('/api/events?limit=200')
  })

  it('ilk yükleme başarısız olursa loadState=error', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )
    await waitFor(() => expect(result.current.loadState).toBe('error'))
  })

  it('retryInitialLoad başarısız ilk yüklemeden sonra tekrar dener', async () => {
    let call = 0
    const fetchImpl = vi.fn(async () => {
      call += 1
      if (call === 1) return { ok: false, status: 500 } as unknown as Response
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [makeEvent(0)] }),
      } as unknown as Response
    })
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )
    await waitFor(() => expect(result.current.loadState).toBe('error'))
    act(() => result.current.retryInitialLoad())
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(result.current.events).toHaveLength(1)
  })

  it('seq bazlı de-dup: canlı olay initial fetch ile çakışırsa tekrar eklenmez (mutasyon 3 hedefi)', async () => {
    FakeEventSource.reset()
    const fetchImpl = fakeFetchOk([makeEvent(0)])
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    const es = FakeEventSource.instances[0]!
    act(() => {
      es.dispatch('event', makeEvent(0))
    })
    expect(result.current.events).toHaveLength(1)
    act(() => {
      es.dispatch('event', makeEvent(1))
    })
    expect(result.current.events.map((e) => e.seq)).toEqual([0, 1])
  })

  it('3 bağlantı durumu geçişi: open->connected, error+CONNECTING->reconnecting, error+CLOSED->disconnected', async () => {
    FakeEventSource.reset()
    const fetchImpl = fakeFetchOk([])
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    const es = FakeEventSource.instances[0]!

    expect(result.current.connectionStatus).toBe('connecting')

    act(() => es.dispatch('open'))
    expect(result.current.connectionStatus).toBe('connected')

    act(() => {
      es.readyState = FakeEventSource.CONNECTING
      es.dispatch('error')
    })
    expect(result.current.connectionStatus).toBe('reconnecting')

    act(() => {
      es.readyState = FakeEventSource.CLOSED
      es.dispatch('error')
    })
    expect(result.current.connectionStatus).toBe('disconnected')
  })

  it('resync olayı yeniden GET /api/events tetikler (RESET_EVENTS)', async () => {
    FakeEventSource.reset()
    let call = 0
    const fetchImpl = vi.fn(async () => {
      call += 1
      const data = call === 1 ? [makeEvent(0)] : [makeEvent(0), makeEvent(1), makeEvent(2)]
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data }),
      } as unknown as Response
    })
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(result.current.events).toHaveLength(1)

    const es = FakeEventSource.instances[0]!
    act(() => es.dispatch('resync', { reason: 'gap' }))

    await waitFor(() => expect(result.current.events).toHaveLength(3))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('sonraki bir yeniden-yükleme (resync sonrası) başarısız olursa staleData=true, mevcut liste korunur', async () => {
    FakeEventSource.reset()
    let call = 0
    const fetchImpl = vi.fn(async () => {
      call += 1
      if (call === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [makeEvent(0)] }),
        } as unknown as Response
      }
      return { ok: false, status: 500 } as unknown as Response
    })
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    const es = FakeEventSource.instances[0]!
    act(() => es.dispatch('resync', { reason: 'gap' }))

    await waitFor(() => expect(result.current.staleData).toBe(true))
    expect(result.current.loadState).toBe('ready')
    expect(result.current.events).toHaveLength(1)
  })

  it('1000 olay tavanı: 1001. olay eklenince en eski düşer', async () => {
    FakeEventSource.reset()
    const initial = Array.from({ length: 1000 }, (_, i) => makeEvent(i))
    const fetchImpl = fakeFetchOk(initial)
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )
    await waitFor(() => expect(result.current.events).toHaveLength(1000))
    const es = FakeEventSource.instances[0]!
    act(() => es.dispatch('event', makeEvent(1000)))
    expect(result.current.events).toHaveLength(1000)
    expect(result.current.events[0]!.seq).toBe(1)
    expect(result.current.events[result.current.events.length - 1]!.seq).toBe(1000)
  })

  it('pausedByUser sırasında yeni olaylar görünür listeye eklenmez, pendingCount artar (mutasyon 4 hedefi)', async () => {
    FakeEventSource.reset()
    const fetchImpl = fakeFetchOk([makeEvent(0)])
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    act(() => result.current.togglePause())
    expect(result.current.pausedByUser).toBe(true)
    expect(result.current.frozen).toBe(true)

    const es = FakeEventSource.instances[0]!
    act(() => es.dispatch('event', makeEvent(1)))

    expect(result.current.events).toHaveLength(1)
    expect(result.current.pendingCount).toBe(1)

    act(() => result.current.togglePause())
    expect(result.current.pausedByUser).toBe(false)
    expect(result.current.frozen).toBe(false)
    expect(result.current.events).toHaveLength(2)
    expect(result.current.pendingCount).toBe(0)
  })

  it('Duraklat + scrolledAway sonra yalnızca pausedUser kaldırılırsa hâlâ frozen (Bulgu 8)', async () => {
    FakeEventSource.reset()
    const fetchImpl = fakeFetchOk([makeEvent(0)])
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    act(() => result.current.togglePause())
    act(() => result.current.setScrolledAway(true))
    expect(result.current.frozen).toBe(true)

    act(() => result.current.setScrolledAway(false))
    // scrolledAway kalktı ama pausedByUser hâlâ true -> frozen hâlâ true
    expect(result.current.pausedByUser).toBe(true)
    expect(result.current.frozen).toBe(true)
  })

  it('resume() hem pausedByUser hem scrolledAway kaldırır', async () => {
    FakeEventSource.reset()
    const fetchImpl = fakeFetchOk([makeEvent(0)])
    const { result } = renderHook(() =>
      useEventStream('/api/stream', '/api/events', {
        EventSourceImpl: FakeEventSource as never,
        fetchImpl,
      })
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    act(() => result.current.togglePause())
    act(() => result.current.setScrolledAway(true))
    act(() => result.current.resume())
    expect(result.current.pausedByUser).toBe(false)
    expect(result.current.scrolledAway).toBe(false)
    expect(result.current.frozen).toBe(false)
  })
})
