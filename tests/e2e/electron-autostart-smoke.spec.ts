import { test, expect, _electron as electron } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// F-014 sözleşme §5 + ADR-011 eki — bu dosya `electron-smoke.spec.ts`'ten AYRI tutuluyor (kendi
// worker'ı) çünkü ölçüldü: `electronApp.windows()`'un döndürdüğü sıra CEO garantili DEĞİL — ana
// pencere bazen `windows()[windows.length - 1]` konumunda çıkabiliyor. Bu, yanlış pencereyi
// "bildirim penceresi" sanıp içeriğini doğrulamaya çalışıp (yanlışlıkla) başarısız olmaya, oradan
// da `finally`'de tepsi-modunda hâlâ canlı olan uygulamaya `electronApp.close()` çağırıp
// SÜRESİZ ASILI KALMAYA yol açtı (kök neden buydu — rastgele "ortam kararsızlığı" değil).
// Düzeltme: bildirim penceresi ARTIK `data:` URL'siyle (ana pencerenin `http://127.0.0.1:port`
// URL'sinden ayırt edilerek) buluyor, sıraya güvenmiyor; temizlik de gerçek `shutdownViaTray()`
// test kancasıyla (aynı `electron-smoke.spec.ts`'teki kanıtlı desen) yapılıyor — `electronApp
// .close()` yalnızca süreç ZATEN kapanmışken çağrılıyor.

async function findFreePort(): Promise<number> {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('beklenmeyen adres türü')
  }
  const { port } = address
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return port
}

const mainPath = path.join(__dirname, '..', '..', 'electron', 'main.cjs')

test.describe('electron açılışta başlama — gerçek pencere kanıtı (F-014)', () => {
  // QA F-014 (2026-09-06, KALDI) H5/Ö1/Ö2 doğrulaması — "açık VE görünür" şartının (ADR-011
  // eki) ikisini de GERÇEK bir userData klasörü (marker YOK, `MC_SKIP_AUTOSTART_DEFAULT`
  // KASITLI OLARAK verilmiyor — teslim durumunun birebir aynısı) ile ölçer. Tepsi balonu bu
  // makinede hiç çizilmiyor (B1 ile aynı sınıf, izole sondayla kanıtlı), bu yüzden "görünür"
  // iddiası yalnızca gerçek `BrowserWindow` sayısıyla ve içeriğiyle doğrulanabilir — "çağrı
  // yapıldı" değil.
  test('ilk açılışta (marker yok) açılışta başlama GERÇEKTEN açılır ve görünür bir bildirim penceresi çizilir', async () => {
    const port = await findFreePort()
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-electron-e2e-autostart-'))
    let electronApp: Awaited<ReturnType<typeof electron.launch>> | undefined

    try {
      electronApp = await electron.launch({
        args: [mainPath],
        env: {
          ...process.env,
          MC_PORT: String(port),
          MC_ELECTRON_USER_DATA_DIR: userDataDir,
          MC_CHAT_ENABLED: '0',
          // MC_SKIP_AUTOSTART_DEFAULT bilerek YOK — bu test tam olarak gerçek ilk-açılış
          // varsayılanını ölçüyor.
        },
      })

      const mainWindow = await electronApp.firstWindow()
      await mainWindow.waitForLoadState('domcontentloaded')

      // Görünürlüğün ötesinde "gerçekten açık mı" — işletim sisteminin kendi API'siyle ölçülür
      // (gerçek `electron.exe`, gerçek `app.getLoginItemSettings()`). Okuma VE bu testin
      // GERÇEKTEN yazdığı ayarı geri alma TEK bir main-process round-trip'te yapılır.
      const openAtLoginWasTrue = await electronApp.evaluate(({ app }) => {
        const wasTrue = app.getLoginItemSettings().openAtLogin
        app.setLoginItemSettings({ openAtLogin: false, path: process.execPath, args: [] })
        return wasTrue
      })
      expect(openAtLoginWasTrue).toBe(true)

      // Görünür ikinci pencere (bildirim) — balon değil, gerçek BrowserWindow. Ana pencere
      // `http://127.0.0.1:<port>` yükler, bildirim penceresi `data:text/html,...` — sırayla
      // DEĞİL, URL'yle ayırt ediliyor (bkz. başlık notu).
      await expect
        .poll(() => electronApp!.windows().some((w) => w.url().startsWith('data:')), {
          timeout: 5000,
          message: 'bildirim penceresi (data: URL) açılmalı',
        })
        .toBe(true)
      const noticeWindow = electronApp.windows().find((w) => w.url().startsWith('data:'))!
      await noticeWindow.waitForLoadState('domcontentloaded')
      await expect(noticeWindow).toHaveTitle('Mission Control')
      // `.locator('body').innerText()` Playwright'ın actionability/visibility kontrolüne
      // takılıyor (bu pencere arka planda kalabilen ikinci bir pencere, render throttling
      // ölçüldü — süresiz asıldı) — bunun yerine doğrudan `evaluate` (CDP üzerinden,
      // görünürlük şartı yok).
      const bodyText = await noticeWindow.evaluate(() => document.body.innerText)
      expect(bodyText).toContain('açılışında otomatik başlayacak')

      // Marker dosyası gerçekten yazıldı (bir daha zorla açılmayacak bilgisi) — bu, ana
      // süreç değil doğrudan disk (host tarafı), ek bir CDP round-trip gerektirmez.
      const markerPath = path.join(userDataDir, 'autostart-initialized.json')
      expect(fs.existsSync(markerPath)).toBe(true)

      // Gerçek kapanma — ana pencerenin `close` handler'ı (tepside devam et) yüzünden pencere
      // kapatmak uygulamayı sonlandırmaz (kasıtlı tasarım); `electron-smoke.spec.ts`'teki
      // kanıtlı desenle aynı test kancası kullanılıyor. `electronApp.close()` (finally) bu
      // noktadan sonra ZATEN ölü bir sürece çağrılacağı için anında döner.
      const closePromise = electronApp.waitForEvent('close')
      await electronApp.evaluate(() => {
        ;(
          global as unknown as {
            __missionControlTestHook?: { shutdownViaTray: () => void }
          }
        ).__missionControlTestHook?.shutdownViaTray()
      })
      await closePromise
    } finally {
      await electronApp?.close().catch(() => {})
      fs.rmSync(userDataDir, { recursive: true, force: true })
    }
  })
})
