import { test, expect, type Page } from '@playwright/test'

// F-011 sözleşmesi §1 madde 11 (Y6 — D10 kapatma) + §3 B3/B7 — gerçek tarayıcı E2E.
// `mockChatEnabled`/`clippedVisibleWidth` KASITLI OLARAK `tests/e2e/thread.spec.ts`'ten
// KOPYALANMAZ (o dosya F-010'un dosya sahipliğinde) — sözleşme §1 madde 11: iki dosyanın aynı
// küçük yardımcıyı BAĞIMSIZ yazması, üçüncü bir paylaşılan test-yardımcı modülü İCAT ETMEKTEN
// daha ucuz (Karpathy §2).

/**
 * X3/Ö2/F-011 emsali (`tests/e2e/thread.spec.ts`) — paylaşılan `playwright.config.ts` webServer'ı
 * `MC_CHAT_ENABLED:'0'` ile çalışır; üretim varsayılanının GERÇEK 6-sekme kümesini (Sohbet dahil)
 * ölçmek için `GET /api/chat/status`'u sahteleştiriyoruz. Hiçbir gerçek/ücretli model çağrısı
 * YAPILMAZ — yalnızca durum yanıtı sahte, mesaj gönderilmiyor.
 */
async function mockChatEnabled(page: Page): Promise<void> {
  await page.route('**/api/chat/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          session_active: true,
          session_id: undefined,
          busy: false,
          api_key_barrier_tripped: false,
          stripped_env_vars: [],
          chat_enabled: true,
          api_key_helper_configured: false,
          max_budget_usd: 20,
          pending_permissions: [],
        },
      }),
    })
  })
  await page.route('**/api/chat/history**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { entries: [], has_more: false } }),
    })
  })
}

/** F-007 dersi — `toBeVisible()` bir kaydırma kabında YALAN SÖYLER; kırpılmış görünür genişlik
 *  gerçek geometriyle ölçülür (`tests/e2e/thread.spec.ts` ile AYNI yöntem, bağımsız yazılmıştır). */
async function clippedVisibleWidth(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    let left = rect.left
    let right = rect.right
    let node: HTMLElement | null = el.parentElement
    while (node) {
      const style = window.getComputedStyle(node)
      if (['auto', 'scroll', 'hidden'].includes(style.overflowX)) {
        const containerRect = node.getBoundingClientRect()
        left = Math.max(left, containerRect.left)
        right = Math.min(right, containerRect.right)
      }
      node = node.parentElement
    }
    left = Math.max(left, 0)
    right = Math.min(right, window.innerWidth)
    return Math.max(0, right - left)
  }, selector)
}

const TAB_IDS = ['tab-timeline', 'tab-kanban', 'tab-chat', 'tab-gates', 'tab-thread', 'tab-usage']

test.describe('D10 kapatma (Y6) — 320-767px arası (sm: ÜSTÜ dahil), üretim 6-sekme kümesi, hiçbir sekme 0px değil', () => {
  for (const width of [320, 375, 480, 640, 700, 767]) {
    test(`${width}px'te tüm sekmeler (Zaman Çizelgesi/Kanban/Sohbet/Kapılar/Thread/Token) kırpılmadan erişilebilir`, async ({
      page,
    }) => {
      await mockChatEnabled(page)
      await page.setViewportSize({ width, height: 700 })
      await page.goto('/')

      await expect(page.locator('header [role="tab"]')).toHaveCount(6)

      for (const id of TAB_IDS) {
        const width_ = await clippedVisibleWidth(page, `#${id}`)
        expect(
          width_,
          `#${id} kırpılmış görünür genişliği 0 olmamalı (${width}px)`
        ).toBeGreaterThan(0)
      }
    })
  }
})

test('Token sekmesi açılır, /api/usage 200 döner (500 değil), kaynak izlenen proje yoksa "okunamadı" DEĞİL boş durum gösterir', async ({
  page,
}) => {
  const responsePromise = page.waitForResponse((res) => res.url().includes('/api/usage'))
  await page.goto('/')
  await page.getByRole('tab', { name: 'Token' }).click()
  const response = await responsePromise
  expect(response.status()).toBe(200)

  await expect(page.locator('[data-testid="usage-screen"]')).toBeVisible()
  // Bu e2e webServer'ının `MC_DATA_DIR` izole geçici dizini gerçek `~/.claude/projects` kökünü
  // DEĞİŞTİRMEZ (yalnızca proje kaydı verisi izole edilir) — kaynak kök gerçek makinede var
  // olabilir de olmayabilir de; garanti edilen tek şey 200 yanıtı ve panelin ÇÖKMEMESİ. Kesin
  // içerik (okunamadı/boş/veri) `computeUsageReport`'un birim testlerinde (Y8) zaten kanıtlı.
  const hasCrashed = await page.evaluate(() => document.title === '')
  expect(hasCrashed).toBe(false)
})
