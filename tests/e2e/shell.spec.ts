import { test, expect } from '@playwright/test'

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const srgb = [r, g, b].map((c) => c / 255)
  const linear = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
}

test('kabuk açılır, başlık görünür, konsol hatası yok, tıklanabilir öğe yok, tema doğru', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message)
  })

  await page.goto('/')

  // (1) başlık görünür — render edilen metin (innerText) ölçülür, DOM metin düğümü değil.
  // Chromium'da innerText CSS `text-transform` uygulanmış hâli döner; `lang="tr"` altında
  // `uppercase` locale-duyarlı çalışıp `i` -> `İ` (U+0130) üretebilir (AC10 regresyon guard'ı).
  // toContainText/DOM metni bunu YAKALAMAZ çünkü CSS'i hiç uygulamaz.
  const title = page.locator('[data-testid="app-title"]')
  await expect(title).toBeVisible()
  const renderedTitle = await title.innerText()
  expect(renderedTitle).toBe('MISSION CONTROL')

  // (2) body boş değil
  const bodyText = await page.locator('body').innerText()
  expect(bodyText.trim().length).toBeGreaterThan(0)

  // (3) konsol/pageerror hatası yok
  expect(consoleErrors).toEqual([])

  // (4) F-005: üst çubukta artık TAM OLARAK BİR tıklanabilir öğe var — Ayarlar dişli düğmesi
  // (CEO kararı, "Ayarlar'ın yeri ve sekme deseninin ertelenmesi"). Zaman Çizelgesi/Kanban
  // hâlâ statik öğeler (F-003 CEO kararı D8), tam `tablist` deseni F-007'ye ertelendi.
  const clickableCount = await page.locator('header button, header a, header [role=button]').count()
  expect(clickableCount).toBe(1)
  const settingsButton = page.locator('header [aria-label="Ayarlar"]')
  await expect(settingsButton).toBeVisible()

  // (4b) Zaman Çizelgesi etiketi aria-current="page" taşır, Kanban/Ayarlar taşımaz; hiçbiri
  // role="tab" değildir (geçersiz ARIA riskine hiç girilmiyor).
  const ariaCurrentCount = await page.locator('header [aria-current="page"]').count()
  expect(ariaCurrentCount).toBe(1)
  const ariaCurrentText = await page.locator('header [aria-current="page"]').innerText()
  expect(ariaCurrentText).toBe('Zaman Çizelgesi')
  const tabRoleCount = await page.locator('header [role="tab"]').count()
  expect(tabRoleCount).toBe(0)

  // (5) yükleme kanıtı (birincil) — font gerçekten yüklendi mi
  const fontLoaded = await page.evaluate(async () => {
    await document.fonts.ready
    return document.fonts.check('16px "Departure Mono"')
  })
  expect(fontLoaded).toBe(true)

  // (6) uygulanma kanıtı (ikincil) — hesaplanan fontFamily
  const titleFontFamily = await title.evaluate((el) => getComputedStyle(el).fontFamily)
  expect(titleFontFamily).toContain('Departure Mono')

  // Renk/koyuluk assert'i (AC10) — serileştirmeden bağımsız. Chromium `getComputedStyle`
  // rengi Tailwind v4'ün ürettiği `oklch()` biçiminde döndürür (rgb() değil); dizge
  // karşılaştırması yerine bir 1x1 canvas'a çizip `getImageData` ile 8-bit sRGB piksele
  // çeviriyoruz — bu, tarayıcının kendi renk motorunu kullanan, biçimden bağımsız bir kanıttır.
  //
  // N1 (F-002 borcu) — bu ölçüm yalnızca `document.body`'ye kör kalmasın diye `#root > div`
  // (App'in kök kabı, `src/web/App.tsx`) için de aynı teknikle tekrarlanır. F-003 gerçek bir
  // panel yüzeyi getirdiği için (`data-testid="timeline-screen"`) üçüncü bir ölçüm noktası da
  // eklendi — F-002'nin devrettiği borç burada kapanıyor.
  const [bg, token, bgRgb, tokenRgb, rootBg, rootBgRgb, timelineBg, timelineBgRgb] =
    await page.evaluate(() => {
      function toRgb(colorStr: string): [number, number, number] {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('2d context alınamadı')
        ctx.fillStyle = colorStr
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
        return [r ?? 0, g ?? 0, b ?? 0]
      }
      const bgValue = getComputedStyle(document.body).backgroundColor
      const tokenValue = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-zinc-950')
        .trim()
      const rootEl = document.querySelector('#root > div')
      if (!rootEl) throw new Error('#root > div bulunamadı')
      const rootBgValue = getComputedStyle(rootEl).backgroundColor
      const timelineEl = document.querySelector('[data-testid="timeline-screen"]')
      if (!timelineEl) throw new Error('timeline-screen bulunamadı')
      const timelineBgValue = getComputedStyle(timelineEl).backgroundColor
      return [
        bgValue,
        tokenValue,
        toRgb(bgValue),
        toRgb(tokenValue),
        rootBgValue,
        toRgb(rootBgValue),
        timelineBgValue,
        toRgb(timelineBgValue),
      ]
    })
  expect(bg).not.toBe('')
  expect(token).not.toBe('')
  expect(bgRgb).toEqual(tokenRgb)
  expect(relativeLuminance(bgRgb)).toBeLessThan(0.1)
  expect(rootBg).not.toBe('')
  expect(rootBgRgb).toEqual(tokenRgb)
  expect(relativeLuminance(rootBgRgb)).toBeLessThan(0.1)
  expect(timelineBg).not.toBe('')
  expect(timelineBgRgb).toEqual(tokenRgb)
  expect(relativeLuminance(timelineBgRgb)).toBeLessThan(0.1)

  // Faz 2 ekranları hiç görünmez
  expect(bodyText).not.toContain('Kapılar')
  expect(bodyText).not.toContain('Thread')
  expect(bodyText).not.toContain('Token')
})

// QA düzeltme turu 1 (ÖNEMLİ-3) — `docs/03-ux.md:17` panelin birincil senaryosunu
// ≈320-480px (VS Code Simple Browser) olarak tanımlıyor, `:21` Ayarlar'ın "sağda sabit bir
// dişli ikonu" olduğunu söylüyor. Düzeltmeden önce 375px'te dişli, başlık+nav ile birlikte
// `overflow-x-auto` şeridinin dışına kayıyordu (bkz. `docs/qa/screens/F-005-2026-09-05-mobil.
// png`). Bu test dişlinin viewport SINIRLARI İÇİNDE kaldığını (yatay kaydırma GEREKMEDEN)
// ölçer — yalnızca `.click()`'in kendisini kullanmak yetmez, Playwright gerekirse otomatik
// kaydırıp tıklayabilir; asıl kanıt kaydırmadan ÖNCEKİ `boundingBox()` konumudur.
test('375px viewport (VS Code Simple Browser genişliği): Ayarlar dişlisi yatay kaydırma olmadan görünür ve tıklanabilir kalır', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await page.goto('/')

  const button = page.getByRole('button', { name: 'Ayarlar' })
  await expect(button).toBeVisible()

  const box = await button.boundingBox()
  expect(box).not.toBeNull()
  // Düğme, hiçbir kaydırma yapılmadan (goto sonrası, click'ten ÖNCE) viewport'un içinde:
  // sıfırın solunda değil, 375px'in sağında değil.
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)

  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible()
})
