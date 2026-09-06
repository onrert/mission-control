import { test, expect, _electron as electron } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// F-014 sözleşme §2/§8 — gerçek `electron.exe` + gerçek `electron/main.cjs` + gerçek
// `src/server/index.ts` (tsx üzerinden, `require('tsx/cjs/api')`). Bu, §1 Bulgu 3'ün ("gerçek
// dosyayla kodlama turunda tek bir smoke test'le doğrulanmalı") kalan riskini kapatan test.
//
// Maliyet güvenliği (CLAUDE.md kültürü, `tests/setup/chat-disabled-by-default.ts` ile aynı
// gerekçe): `createServer()`'ın gerçek (enjekte edilmemiş) `@anthropic-ai/claude-agent-sdk`
// `query()`'sini çağırması "gerçek, ücretli bir Claude oturumu" sayılıyor — bu proje bunu HER
// `playwright*.config.ts`'te `MC_CHAT_ENABLED=0` ile engelliyor. Bu test de aynı deseni izler.
// Bu YÜZDEN bu test "sohbet varsayılan açık" AC'sini `chat_enabled:true` ile CANLI ÖLÇMEZ —
// o garanti `tests/electron/chat-enabled.test.ts`'te GERÇEK `isChatEnabled()` fonksiyonuyla
// (sıfır kota, saf fonksiyon çağrısı) zaten kanıtlanmış durumda (sözleşme §6). Burada yalnızca
// `/api/chat/status` uç noktasının Electron içinden de erişilebilir olduğu doğrulanıyor.

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

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
    tester.once('error', () => resolve(false))
    tester.once('listening', () => tester.close(() => resolve(true)))
    tester.listen(port, '127.0.0.1')
  })
}

const mainPath = path.join(__dirname, '..', '..', 'electron', 'main.cjs')

test.describe('electron masaüstü kabuğu — uçtan uca duman testi (F-014)', () => {
  test('çift tıklamayla açılır (terminal yok), sunucu içeride başlar, kapatma tepside devam ettirir, tepsi Çıkış gerçekten kapatır ve port serbest kalır', async () => {
    const port = await findFreePort()
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-electron-e2e-'))

    // "Çift tıklama" — hiçbir npm script'i, hiçbir terminal komutu yok: yalnızca electron.exe
    // ve main.cjs'in kendisi (packager çıktısının çift tıklanınca çalıştıracağı ile aynı giriş).
    const electronApp = await electron.launch({
      args: [mainPath],
      env: {
        ...process.env,
        MC_PORT: String(port),
        MC_ELECTRON_USER_DATA_DIR: userDataDir,
        MC_SKIP_AUTOSTART_DEFAULT: '1', // gerçek Windows açılış kaydını kirletme (test izolasyonu)
        MC_CHAT_ENABLED: '0', // maliyet güvenliği (yukarıdaki başlık notu)
      },
    })

    try {
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await expect(window).toHaveTitle(/Mission Control/i)

      // Sunucu uygulamanın İÇİNDE başladı (ayrı bir süreç değil) — gerçek HTTP isteğiyle.
      const health = await window.evaluate(async (p: number) => {
        const res = await fetch(`http://127.0.0.1:${p}/api/health`)
        return { status: res.status, body: await res.json() }
      }, port)
      expect(health.status).toBe(200)
      expect(health.body.ok).toBe(true)

      // Sohbet uç noktası Electron içinden de erişilebilir (bkz. başlık notu — maliyet
      // güvenliği nedeniyle değer `false` bekleniyor, gerçek varsayılan `tests/electron/
      // chat-enabled.test.ts`'te kanıtlanmıştır).
      const chatStatus = await window.evaluate(async (p: number) => {
        const res = await fetch(`http://127.0.0.1:${p}/api/chat/status`)
        return { status: res.status, body: await res.json() }
      }, port)
      expect(chatStatus.status).toBe(200)
      expect(typeof chatStatus.body.data.chat_enabled).toBe('boolean')

      // Pencere kapatma (X) — sözleşme §2: sunucu çalışmaya devam eder, pencere yalnızca
      // gizlenir. Tepsi ikonu OS-native olduğu için gerçek kapatmayı `BrowserWindow.close()`'u
      // ana süreçte doğrudan çağırarak simüle ediyoruz (X butonuna tıklamakla aynı native olay).
      await electronApp.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.close()
      })
      await new Promise((resolve) => setTimeout(resolve, 300))
      const stillDestroyed = await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0]
        return { isVisible: win?.isVisible() ?? null, isDestroyed: win?.isDestroyed() ?? true }
      })
      expect(stillDestroyed.isDestroyed).toBe(false)
      expect(stillDestroyed.isVisible).toBe(false)

      // Sunucu hâlâ ayakta (yetim süreç değil, aynı süreçte, kapatılmadı).
      const healthAfterClose = await fetch(`http://127.0.0.1:${port}/api/health`)
      expect(healthAfterClose.status).toBe(200)

      // Tepsi "Çıkış" — gerçek `shutdown()` çağrılır, uygulama GERÇEKTEN kapanır. Tepsi context
      // menüsü OS-native olduğu için Playwright'ın tıklayabileceği bir DOM öğesi değil; test
      // main.cjs'in kendi test kancasını (`global.__missionControlTestHook`) kullanır — bu
      // kanca yalnızca test amaçlıdır, üretim kodunun hiçbir yeri onu okumaz.
      const closePromise = electronApp.waitForEvent('close')
      await electronApp.evaluate(() => {
        ;(
          global as unknown as {
            __missionControlTestHook?: { shutdownViaTray: () => void }
          }
        ).__missionControlTestHook?.shutdownViaTray()
      })
      await closePromise

      // Yetim süreç yok: port gerçekten serbest kaldı, yeni bir dinleyici bağlanabiliyor.
      await expect
        .poll(() => isPortFree(port), { timeout: 5000, message: 'port kapanıştan sonra boşalmalı' })
        .toBe(true)
    } finally {
      await electronApp.close().catch(() => {})
      fs.rmSync(userDataDir, { recursive: true, force: true })
    }
  })
})
