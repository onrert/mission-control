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
