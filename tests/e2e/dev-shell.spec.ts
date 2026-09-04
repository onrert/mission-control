import { test, expect } from '@playwright/test'

// K1 (tur 3 QA): bu config `MC_PORT=7433`/`MC_WEB_PORT=7434` ile çalışır (playwright.dev.config.ts),
// böylece 7333'ü dinleyen yabancı/yetim bir süreç bu koşuyu asla yanlış yeşile düşüremez.

test('npm run dev — panel açılır, /api proxy çalışır, API süreci doğrudan ayakta', async ({
  page,
}) => {
  await page.goto('/')

  // (1) başlık görünür
  await expect(page.locator('[data-testid="app-title"]')).toBeVisible()

  // (2) body boş değil (beyaz ekran yok)
  const bodyText = await page.locator('body').innerText()
  expect(bodyText.trim().length).toBeGreaterThan(0)
  const rootChildCount = await page.locator('#root > *').count()
  expect(rootChildCount).toBeGreaterThan(0)

  // (3) Vite /api proxy'si (7434 → MC_PORT=7433) çalışıyor
  const proxied = await page.request.get('/api/health')
  expect(proxied.status()).toBe(200)
  const proxiedBody = (await proxied.json()) as { instance_id: string; service: string }

  // (4) dev API süreci doğrudan 7433'te ayakta — bu configde prod webServer hiç yok,
  // dolayısıyla bu yanıt yalnızca `npm run dev`'in kendi API sürecinden gelebilir.
  const direct = await page.request.get('http://127.0.0.1:7433/api/health')
  expect(direct.status()).toBe(200)
  const directBody = (await direct.json()) as { instance_id: string; service: string }

  // (5) N4 katman (b) — asıl ayırt edici kanıt `instance_id` alanının VARLIĞI değil,
  // proxy'li ve doğrudan yanıtların AYNI sürece ait olduğunu gösteren kimlik EŞİTLİĞİDİR.
  // Alan varlığı, proxy'nin yabancı bir Mission Control sürecine gitmesi hâlinde de yeşil
  // kalırdı (o süreç de bir instance_id döndürür) — eşitlik bu kör noktayı kapatır.
  expect(proxiedBody.service).toBe('mission-control')
  expect(directBody.service).toBe('mission-control')
  expect(proxiedBody.instance_id).toBe(directBody.instance_id)
})
