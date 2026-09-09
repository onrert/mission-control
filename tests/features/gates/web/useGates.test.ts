// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useGates } from '../../../../src/features/gates/web/useGates'
import type { ApiResponse, GateStatusItem, GatesListResponse } from '../../../../src/shared/types'

afterEach(() => {
  cleanup()
})

function gate(overrides: Partial<GateStatusItem> = {}): GateStatusItem {
  return { id: 'G2', label: 'Mimari', status: 'pending', ...overrides }
}

function listResponse(gates: GateStatusItem[], overrides: Partial<GatesListResponse> = {}) {
  const body: ApiResponse<GatesListResponse> = {
    success: true,
    data: { gates, unrecognized: [], process_doc_readable: true, ...overrides },
  }
  return body
}

function fetchReturning(body: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  })) as unknown as typeof fetch
}

describe('useGates — projectId null (§3 boş durum)', () => {
  it('projectId null iken hiç fetch çağırmaz, idle kalır', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const { result } = renderHook(() => useGates({ projectId: null, fetchImpl }))
    expect(result.current.loadState).toBe('idle')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.current.gates).toEqual([])
  })
})

describe('useGates — yükleme', () => {
  it('projectId verilince GET /api/gates?project_id=… çağrılır, gates yüklenir', async () => {
    const fetchImpl = fetchReturning(listResponse([gate()]))
    const { result } = renderHook(() => useGates({ projectId: 'p1', fetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(result.current.gates).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledWith('/api/gates?project_id=p1')
  })

  it("unrecognized ve process_doc_readable body'den aynen geçer", async () => {
    const fetchImpl = fetchReturning(
      listResponse([gate()], { unrecognized: ['g2.ok'], process_doc_readable: false })
    )
    const { result } = renderHook(() => useGates({ projectId: 'p1', fetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(result.current.unrecognized).toEqual(['g2.ok'])
    expect(result.current.processDocReadable).toBe(false)
  })

  it('fetch reddi → loadState error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network')
    }) as unknown as typeof fetch
    const { result } = renderHook(() => useGates({ projectId: 'p1', fetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('error'))
  })

  it('projectId değişince yeniden yüklenir', async () => {
    const fetchImpl = fetchReturning(listResponse([gate()]))
    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string | null }) => useGates({ projectId, fetchImpl }),
      { initialProps: { projectId: 'p1' as string | null } }
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    rerender({ projectId: 'p2' })
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledWith('/api/gates?project_id=p2'))
  })
})

describe('useGates — gatesSignal (§7 canlı güncelleme, onFeatures ile birebir desen)', () => {
  it('sinyal AYNI project_id ile gelirse yeniden yükler', async () => {
    const fetchImpl = fetchReturning(listResponse([gate()]))
    const { result, rerender } = renderHook(
      ({ signal }: { signal: { project_id: string } | null }) =>
        useGates({ projectId: 'p1', gatesSignal: signal, fetchImpl }),
      { initialProps: { signal: null as { project_id: string } | null } }
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    rerender({ signal: { project_id: 'p1' } })
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
  })

  it('sinyal FARKLI bir project_id taşırsa yeniden yüklemez', async () => {
    const fetchImpl = fetchReturning(listResponse([gate()]))
    const { result, rerender } = renderHook(
      ({ signal }: { signal: { project_id: string } | null }) =>
        useGates({ projectId: 'p1', gatesSignal: signal, fetchImpl }),
      { initialProps: { signal: null as { project_id: string } | null } }
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    rerender({ signal: { project_id: 'baska-proje' } })
    // Kısa bir bekleme sonrası hâlâ tek çağrı olmalı (ikinci fetch tetiklenmedi).
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('useGates — approve/deny', () => {
  function writeFetchReturning(status: number, body: unknown): typeof fetch {
    return vi.fn(async () => ({
      ok: status < 400,
      status,
      json: async () => body,
    })) as unknown as typeof fetch
  }

  it('approve başarılı → gates listesindeki ilgili öğe taze data ile değişir', async () => {
    const fetchImpl = fetchReturning(listResponse([gate({ status: 'pending' })]))
    const fresh = gate({ status: 'approved', ok_date: '2026-09-09' })
    const writeFetchImpl = writeFetchReturning(200, { success: true, data: fresh })
    const { result } = renderHook(() => useGates({ projectId: 'p1', fetchImpl, writeFetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    const outcome = await result.current.approve('G2', 'onaylandı')
    expect(outcome).toEqual({ kind: 'success', item: fresh })
    expect(writeFetchImpl).toHaveBeenCalledWith(
      '/api/gates/p1/G2/approve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ confirmed: true, decision: 'onaylandı' }),
      })
    )
  })

  it('deny onaylı kapıda 409 conflict → item taze durumla güncellenir, outcome conflict', async () => {
    const fetchImpl = fetchReturning(listResponse([gate({ status: 'pending' })]))
    const fresh = gate({ status: 'approved', ok_date: '2026-09-09' })
    const writeFetchImpl = writeFetchReturning(409, {
      success: false,
      error: { code: 'conflict', message: 'Bu kapı zaten onaylı, reddedilemez.' },
      data: fresh,
    })
    const { result } = renderHook(() => useGates({ projectId: 'p1', fetchImpl, writeFetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    const outcome = await result.current.deny('G2', 'reddediyorum')
    expect(outcome.kind).toBe('conflict')
    if (outcome.kind === 'conflict') {
      expect(outcome.item).toEqual(fresh)
      expect(outcome.message).toBe('Bu kapı zaten onaylı, reddedilemez.')
    }
  })

  it('yazma hatası (400 invalid_body) → outcome error, gates state DEĞİŞMEZ (AC5)', async () => {
    const original = gate({ status: 'pending' })
    const fetchImpl = fetchReturning(listResponse([original]))
    const writeFetchImpl = writeFetchReturning(400, {
      success: false,
      error: { code: 'invalid_body', message: 'Red gerekçesi zorunludur.' },
    })
    const { result } = renderHook(() => useGates({ projectId: 'p1', fetchImpl, writeFetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    const outcome = await result.current.deny('G2', '')
    expect(outcome).toEqual({ kind: 'error', message: 'Red gerekçesi zorunludur.' })
    expect(result.current.gates[0]).toEqual(original)
  })

  it('yarı-başarı (500 write_failed + taze data) → gates state taze durumu yansıtır (rollback DEĞİL)', async () => {
    const fetchImpl = fetchReturning(listResponse([gate({ status: 'pending' })]))
    const fresh = gate({ status: 'pending' })
    const writeFetchImpl = writeFetchReturning(500, {
      success: false,
      error: {
        code: 'write_failed',
        message:
          'Red kaydı docs/approvals/archive/G2-2026-09-09.deny.md altına taşındı ama onay ' +
          'yazılamadı; kapı şu an "Bekliyor" durumunda. Tekrar deneyin.',
      },
      data: fresh,
    })
    const { result } = renderHook(() => useGates({ projectId: 'p1', fetchImpl, writeFetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    const outcome = await result.current.approve('G2', 'karar')
    expect(outcome.kind).toBe('error')
    if (outcome.kind === 'error') {
      expect(outcome.message).toContain('altına taşındı ama onay yazılamadı')
    }
    expect(result.current.gates[0]).toEqual(fresh)
  })

  it('ağ hatası (fetch reddi) → outcome error, genel mesaj döner', async () => {
    const fetchImpl = fetchReturning(listResponse([gate()]))
    const writeFetchImpl = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const { result } = renderHook(() => useGates({ projectId: 'p1', fetchImpl, writeFetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    const outcome = await result.current.approve('G2', 'karar')
    expect(outcome).toEqual({ kind: 'error', message: 'Kaydedilemedi, tekrar deneyin.' })
  })
})
