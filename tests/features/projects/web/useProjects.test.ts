// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor, act } from '@testing-library/react'
import { useProjects } from '../../../../src/features/projects/web/useProjects'
import type { ProjectListItem } from '../../../../src/shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function item(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: 'p_1',
    path: 'C:\\dev\\apps\\demo',
    label: 'demo',
    added_at: new Date().toISOString(),
    enabled: true,
    exists: true,
    feature_count: 0,
    ...overrides,
  }
}

describe("useProjects — add() SSE ile yarış (E2E'de gözlenen çift satır hatası)", () => {
  it("SSE 'projects' broadcast POST yanıtından ÖNCE gelirse, add() aynı kaydı ikinci kez eklemez", async () => {
    let resolvePost: (v: unknown) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Promise((resolve) => {
            resolvePost = resolve
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        })
      }) as unknown as typeof fetch
    )

    const { result, rerender } = renderHook(({ liveUpdate }) => useProjects(liveUpdate), {
      initialProps: { liveUpdate: null as ProjectListItem[] | null },
    })

    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    const added = item()
    let addPromise: Promise<unknown>
    act(() => {
      addPromise = result.current.add(added.path)
    })

    // SSE çerçevesi (tam liste, zaten yeni kaydı içeriyor) POST yanıtından ÖNCE gelir.
    rerender({ liveUpdate: [added] })
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    // Şimdi POST'un kendi yanıtı gelir (aynı kayıt, farklı obje referansı).
    await act(async () => {
      resolvePost({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: { ...added } }),
      })
      await addPromise
    })

    expect(result.current.items).toHaveLength(1)
  })
})

// QA düzeltme turu 2 (D26) — önceki hâl (`if (!res.ok) return`) `500` yanıtını sessizce
// yutuyordu; çağıran hiçbir zaman `remove()`'un başarısız olduğunu öğrenemiyordu.
describe('useProjects — remove() (D26: 500 yanıtı yutulmaz)', () => {
  it('DELETE 500 storage_unavailable dönerse remove() {ok:false, message} döner, item listeden düşmez', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({
              success: false,
              error: {
                code: 'storage_unavailable',
                message: 'Liste kaydedilemedi, tekrar deneyin.',
              },
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [item()] }),
        })
      }) as unknown as typeof fetch
    )

    const { result } = renderHook(({ liveUpdate }) => useProjects(liveUpdate), {
      initialProps: { liveUpdate: null as ProjectListItem[] | null },
    })
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    let outcome: { ok: boolean; message?: string } = { ok: true }
    await act(async () => {
      outcome = await result.current.remove('p_1')
    })

    expect(outcome).toEqual({ ok: false, message: 'Liste kaydedilemedi, tekrar deneyin.' })
    // Yazma başarısız oldu — item listede kalmalı (sunucu durumu değişmedi).
    expect(result.current.items).toHaveLength(1)
  })
})
