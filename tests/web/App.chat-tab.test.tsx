// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import App from '../../src/web/App'
import { FakeEventSource } from '../helpers/fake-event-source'

/**
 * QA F-012 tur 2 Y2 (BLOKLAYICI) düzeltmesi — "Sohbet" sekmesinin görünürlüğü artık
 * `vite.config.ts`'in DERLEME ANINDA gömdüğü bir sabitten değil, `GET /api/chat/status`'un
 * ÇALIŞMA ZAMANINDA döndürdüğü `chat_enabled` alanından geliyor (`src/web/App.tsx`). Bu yüzden
 * eski `tests/web/App.test.tsx`'in `renderToStaticMarkup` + `process.env.MC_CHAT_ENABLED`
 * testleri artık bu davranışı ÖLÇEMEZ (statik render hiçbir efekt çalıştırmaz, `fetch` hiç
 * atılmaz) — bu dosya onların yerini alır: gerçek DOM render + stub `fetch`/`EventSource`.
 */
function stubGlobals(chatEnabled: boolean) {
  const originalFetch = window.fetch
  const originalEventSource = (window as unknown as { EventSource: unknown }).EventSource
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/chat/status')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            session_active: chatEnabled,
            session_id: undefined,
            busy: false,
            api_key_barrier_tripped: false,
            stripped_env_vars: [],
            chat_enabled: chatEnabled,
            api_key_helper_configured: false,
            max_budget_usd: 20,
            pending_permissions: [],
          },
        }),
      } as Response
    }
    if (url.includes('/api/chat/history')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { entries: [], has_more: false } }),
      } as Response
    }
    return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) } as Response
  })
  window.fetch = fetchMock as unknown as typeof fetch
  ;(window as unknown as { EventSource: unknown }).EventSource = FakeEventSource
  return () => {
    window.fetch = originalFetch
    ;(window as unknown as { EventSource: unknown }).EventSource = originalEventSource
  }
}

async function renderAndWaitForStatus() {
  render(<App />)
  // `loadStatus` iki `await` içeriyor (`fetch` + `res.json()`) — birkaç mikro görev turu
  // gerekiyor ki `setStatus` gerçekten commit edilsin.
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

afterEach(() => {
  cleanup()
})

describe("App — Sohbet sekmesi görünürlüğü ÇALIŞMA ZAMANINDA /api/chat/status.chat_enabled'a bağlı (Y2)", () => {
  it('sunucu chat_enabled:false derken (ör. e2e sonrası derlenmiş ama açık sunucu) 2 sekme kalır, Sohbet hiç yok', async () => {
    FakeEventSource.reset()
    const restore = stubGlobals(false)
    try {
      await renderAndWaitForStatus()
      expect(screen.getAllByRole('tab')).toHaveLength(2)
      expect(screen.queryByRole('tab', { name: 'Sohbet' })).toBeNull()
      expect(document.getElementById('panel-chat')).toBeNull()
    } finally {
      restore()
    }
  })

  it("sunucu chat_enabled:true derken 3. sekme (Sohbet) belirir, Kanban'dan sonra gelir", async () => {
    FakeEventSource.reset()
    const restore = stubGlobals(true)
    try {
      await renderAndWaitForStatus()
      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(3)
      const chatTab = screen.getByRole('tab', { name: 'Sohbet' })
      expect(chatTab).toBeTruthy()
      expect(document.getElementById('panel-chat')).not.toBeNull()
      // Sıra: docs/03-ux.md — "[Zaman Çizelgesi][Kanban][Sohbet]".
      expect(tabs[2]).toBe(chatTab)
    } finally {
      restore()
    }
  })

  it("derlenmiş paket AYNI (tek `dist/`), yalnızca sunucunun yanıtı değişince sekme görünürlüğü değişir — bu, Y2'nin kök nedenine karşı doğrudan çit", async () => {
    // Y2'nin kök nedeni: derleme anında gömülen bir bayrak, sunucudan BAĞIMSIZ olarak sekmeyi
    // kalıcı olarak kapatıyordu. Burada AYNI `App` modülü (yeniden import/derleme YOK) önce
    // kapalı, sonra açık bir `/api/chat/status` yanıtıyla iki kez render edilip ikisinin de
    // sunucunun o anki yanıtını yansıttığı doğrulanıyor — modül seviyesinde sabitlenmiş bir
    // değer OLSAYDI ikinci render ilkiyle aynı kalırdı.
    FakeEventSource.reset()
    let restore = stubGlobals(false)
    try {
      await renderAndWaitForStatus()
      expect(screen.queryByRole('tab', { name: 'Sohbet' })).toBeNull()
    } finally {
      restore()
    }
    cleanup()

    FakeEventSource.reset()
    restore = stubGlobals(true)
    try {
      await renderAndWaitForStatus()
      expect(screen.getByRole('tab', { name: 'Sohbet' })).toBeTruthy()
    } finally {
      restore()
    }
  })
})
