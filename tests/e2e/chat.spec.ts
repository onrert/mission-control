import { test, expect, type Page } from '@playwright/test'
import { LONG_COMMAND, LONG_COMMAND_TAIL, LONG_COMMAND_TRIGGER } from './helpers/chat-long-command'

/**
 * F-012 F6 — sohbet ekranı için ana akış E2E'si (QA'nın "sıfır E2E kabul edilemez" bulgusuna
 * yanıt, `docs/qa/F-012-2026-09-06-tur2.md` §3). `playwright.chat.config.ts`'in başlattığı
 * `chat-fake-server.ts` gerçek üretim sunucusunu enjekte edilmiş sahte bir `query()` ile
 * çalıştırır — burada gerçek tarayıcı, gerçek HTTP/SSE üzerinden gerçek `session.ts` kodunu
 * (permission/history/SSE mantığı DEĞİŞMEDEN) tetikler. Kota: **0**.
 *
 * Kapsam (QA'nın istediği asgari akış): mesaj gönder → akan cevap → izin kartı → karar.
 * Abartılmadı — tek senaryo, tek tur.
 */
test('mesaj gönder → akan cevap görünür → izin kartı çıkar → onayla → sonuç ve kapanış cevabı görünür', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('tab', { name: 'Sohbet' }).click()
  const screen = page.getByTestId('chat-screen')
  await expect(screen).toBeVisible()

  const composer = page.getByPlaceholder('CEO’ya yaz…')
  await composer.fill('Klasörü kontrol eder misin?')
  await page.getByRole('button', { name: 'Gönder' }).click()

  // Kullanıcı balonu hemen (chat_user_echo SSE'si) görünür.
  await expect(page.getByText('Klasörü kontrol eder misin?')).toBeVisible()

  // Akan cevap: `chat-fake-server.ts` kelime kelime `stream_event` yayınlıyor — "CEO yazıyor…"
  // etiketi yalnızca `status:'streaming'` iken görünür (bkz. `MessageBubble`).
  await expect(page.getByText('CEO yazıyor…')).toBeVisible({ timeout: 5000 })

  // İzin kartı: `role="group"` `aria-label="İzin isteği"` (bkz. `PermissionCard`).
  const permissionCard = page.getByRole('group', { name: 'İzin isteği' })
  await expect(permissionCard).toBeVisible({ timeout: 5000 })
  await expect(permissionCard).toContainText('Bash')
  await expect(permissionCard).toContainText('ls -la')

  // QA F-012 tur 3 Y1 (BLOKLAYICI) tekrar üretmesi — bekleyen izin VARKEN sayfa yenilenirse
  // kart geri gelmeli ve gerçekten cevaplanabilmeli (`docs/03-ux.md:443`). Sunucu tarafında
  // `canUseTool` hâlâ bekliyor (in-memory pending map, `session.ts`), yenileme yalnızca
  // istemciyi sıfırlar; `loadStatus` artık `onChatStatus` indirgeyicisinden geçtiği için kart
  // ELLE bir SSE olayı beklemeden geri kurulmalı.
  await page.reload()
  await page.getByRole('tab', { name: 'Sohbet' }).click()
  const permissionCardAfterReload = page.getByRole('group', { name: 'İzin isteği' })
  await expect(permissionCardAfterReload).toBeVisible({ timeout: 5000 })
  await expect(permissionCardAfterReload).toContainText('Bash')
  await expect(permissionCardAfterReload).toContainText('ls -la')

  await permissionCardAfterReload.getByRole('button', { name: 'Onayla' }).click()

  // Kolabe olmuş izin satırı (Ö8) — kart TAMAMEN silinmez, tek satıra döner.
  await expect(page.getByText('Onaylandı — ls -la çalıştı')).toBeVisible({ timeout: 5000 })
  await expect(permissionCardAfterReload).toHaveCount(0)

  // Kapanış cümlesi — akış bitip `status:'done'` olunca "CEO yazıyor…" etiketi kaybolur.
  await expect(page.getByText('Klasörde iki dosya buldum, hazır.')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('CEO yazıyor…')).toHaveCount(0)

  // Sayfa yenilemesi: geçmiş kalıcı (AC7'nin metin kısmı) — kullanıcı mesajı ve nihai cevap
  // `GET /api/chat/history`'den geri gelir.
  await page.reload()
  await page.getByRole('tab', { name: 'Sohbet' }).click()
  await expect(page.getByText('Klasörü kontrol eder misin?')).toBeVisible()
  await expect(page.getByText('Klasörde iki dosya buldum, hazır.')).toBeVisible()

  // Ö7 (`docs/qa/o7-agent-satirlari-contract.md`) — araç satırı da AYNI reload'da kalıcı
  // görünmeli, canlı sırada gösterilen BİREBİR aynı biçimle (`ToolStatusRow`).
  await expect(page.getByTestId('chat-tool-row')).toBeVisible()
  await expect(page.getByText(/Bash tamamlandı/)).toBeVisible()
})

/** `CLAUDE.md` dersi — `toBeVisible()` bir kaydırma kabında yalan söyler; dar genişlikte araç
 *  satırının GERÇEKTEN kırpılmış görünür genişliği (viewport + üst kaydırma kaplarının
 *  kesişimi) ölçülür (`tests/e2e/usage.spec.ts`'in `clippedVisibleWidth` tekniğinin kopyası). */
async function clippedVisibleWidth(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    // `querySelectorAll(...).at(-1)` — bu dosyada TEK sunucu/oturum tüm testler arasında
    // paylaşıldığı için (`playwright.chat.config.ts`) birden fazla eşleşme olabilir; SON
    // (bu testin kendi ürettiği) eşleşme ölçülür.
    const matches = document.querySelectorAll(sel)
    const el = matches[matches.length - 1] as HTMLElement | undefined
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

test('Ö7 dar genişlik (320px) — sayfa yenilemesi sonrası araç satırı gerçekten okunabilir (kırpılmış görünür genişlik > 0)', async ({
  page,
}) => {
  // Not: `playwright.chat.config.ts` TÜM `chat.spec.ts` dosyası için TEK bir sunucu/oturum
  // başlatır (`webServer` dosya başına bir kez) — önceki testlerin araç satırları bu testin
  // sayfası yenilendiğinde de geçmişte GÖRÜNÜR (Ö7'nin tam da kanıtlamak istediği şey). Bu
  // yüzden aşağıdaki assertion'lar TEKİL değil `.last()` — bu testin KENDİ ürettiği en son
  // satırı ölçer, önceki testlerin birikimiyle strict-mode çakışmasına düşmez.
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')
  await page.getByRole('tab', { name: 'Sohbet' }).click()
  await expect(page.getByTestId('chat-screen')).toBeVisible()

  const composer = page.getByPlaceholder('CEO’ya yaz…')
  await composer.fill('Klasörü kontrol eder misin?')
  await page.getByRole('button', { name: 'Gönder' }).click()

  const permissionCard = page.getByRole('group', { name: 'İzin isteği' })
  await expect(permissionCard).toBeVisible({ timeout: 5000 })
  await permissionCard.getByRole('button', { name: 'Onayla' }).click()
  await expect(page.getByText('Klasörde iki dosya buldum, hazır.').last()).toBeVisible({
    timeout: 5000,
  })

  await page.reload()
  await page.getByRole('tab', { name: 'Sohbet' }).click()
  await expect(page.getByText(/Bash tamamlandı/).last()).toBeVisible()
  const width = await clippedVisibleWidth(page, '[data-testid="chat-tool-row"]')
  expect(
    width,
    '320px genişlikte araç satırının kırpılmış görünür genişliği 0 OLMAMALI'
  ).toBeGreaterThan(0)
})

/** CLAUDE.md dersi — `toBeVisible()` bir kaydırma kabında YALAN SÖYLER; burada DİKEY kaydırma
 *  kutusunun gerçek kutu modelini (`scrollHeight`/`clientHeight`/hesaplanmış `overflow-y`) ve
 *  DOM `textContent`'ini ölçüyoruz, CSS görselliğine güvenmiyoruz. */
async function previewBoxMetrics(page: Page): Promise<{
  textContent: string
  scrollHeight: number
  clientHeight: number
  overflowY: string
  textOverflow: string
}> {
  return page.locator('[data-testid="permission-command-preview"]').evaluate((el) => {
    const style = window.getComputedStyle(el)
    return {
      textContent: el.textContent ?? '',
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: style.overflowY,
      textOverflow: style.textOverflow,
    }
  })
}

for (const width of [320, 375, 480]) {
  test(`G5 Tur 4 (4-Ek3) — dar genişlik ${width}px: 500+ karakterlik komutun TAMAMI (dolgu ARKASINDAKİ iz dahil) kartta gerçekten okunabilir, ONAYLAMAYIN uyarısı YOK (hard cap altı)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await page.getByRole('tab', { name: 'Sohbet' }).click()
    await expect(page.getByTestId('chat-screen')).toBeVisible()

    const composer = page.getByPlaceholder('CEO’ya yaz…')
    await composer.fill(LONG_COMMAND_TRIGGER)
    await page.getByRole('button', { name: 'Gönder' }).click()

    const permissionCard = page.getByRole('group', { name: 'İzin isteği' })
    await expect(permissionCard).toBeVisible({ timeout: 5000 })

    // Denetimin kendi kanıt biçimi (4-Ek3): "ÖNIZLEMEDE hassas kelime GEÇİYOR MU" — burada
    // GERÇEK bir tarayıcıda, GERÇEK render sonrası ölçülüyor (offline değil).
    const metrics = await previewBoxMetrics(page)
    expect(metrics.textContent).toContain(LONG_COMMAND_TAIL)
    expect(metrics.textContent).toContain(LONG_COMMAND)
    // Kaydırma kutusu — kırpma DEĞİL: içerik kutudan taşıyorsa `scrollHeight > clientHeight` VE
    // `overflow-y` fiilen kaydırılabilir; `text-overflow: ellipsis` (eski `truncate` sınıfı)
    // KULLANILMIYOR.
    expect(['auto', 'scroll']).toContain(metrics.overflowY)
    expect(metrics.textOverflow).not.toBe('ellipsis')

    // 20k hard cap'in ALTINDA — fail-closed uyarı ÇIKMAMALI, Onayla etkin kalmalı.
    await expect(page.getByText(/ONAYLAMAYIN, komutun tamamı gösterilemiyor/)).toHaveCount(0)
    await expect(
      page.getByText(new RegExp(`olağandışı uzun \\(${LONG_COMMAND.length} karakter\\)`))
    ).toBeVisible()
    const approveButton = permissionCard.getByRole('button', { name: 'Onayla' })
    await expect(approveButton).toBeEnabled()
  })
}
