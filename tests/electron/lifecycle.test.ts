import { describe, expect, it, vi } from 'vitest'
import { runApp } from '../../electron/main.cjs'
import { shutdown as realShutdown } from '../../src/server/index'
import {
  assertStarted,
  createFakeApp,
  createFakeDialog,
  createFakeMenu,
  FakeBrowserWindow,
  FakeTray,
  resetFakeBrowserWindowInstances,
} from './helpers/fake-electron'

// F-014 sözleşme §2 + §8 (mutasyon M3, tepsi "Çıkış" gerçek shutdown()'ı çağırır) ve
// mutasyon M4, pencere kapatma varsayılan davranışa bırakılmaz, gizlenir).

function findMenuItem(template: unknown, label: string) {
  const items = template as Array<{ label?: string; click?: () => void; checked?: boolean }>
  const item = items.find((i) => i.label === label)
  if (!item) throw new Error(`menü öğesi bulunamadı: ${label}`)
  return item
}

describe('electron pencere kapatma (X) — tepside devam', () => {
  it('kapatma olayında preventDefault çağrılır, pencere yok edilmez, yalnızca gizlenir', async () => {
    const app = createFakeApp(false)
    const serverModule = {
      createServer: vi.fn(() => ({
        sseHub: { closeAll: vi.fn() },
        close: vi.fn((cb?: () => void) => cb?.()),
      })),
      shutdown: vi.fn(),
    }

    const result = await runApp(
      {
        app,
        BrowserWindow: FakeBrowserWindow,
        Tray: FakeTray,
        Menu: createFakeMenu(),
        dialog: createFakeDialog(),
      },
      { isPortFreeFn: async () => true, loadServerModuleFn: () => serverModule }
    )
    assertStarted(result)
    const mainWindow = result.mainWindow as FakeBrowserWindow
    const closeHandler = mainWindow.handlers.close
    expect(closeHandler).toBeTypeOf('function')

    const preventDefault = vi.fn()
    closeHandler?.({ preventDefault })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(mainWindow.hidden).toBe(true)
    expect(mainWindow.destroyed).toBe(false)
    expect(app.quit).not.toHaveBeenCalled()
  })
})

describe('electron tepsi "Çıkış" — gerçek kapanma', () => {
  it('gerçek (üretim) shutdown() fonksiyonunu server + sseHub ile çağırır, sonra app.quit() çalışır', async () => {
    const app = createFakeApp(false)
    const shutdownSpy = vi.fn(realShutdown)
    const fakeServer = {
      sseHub: { closeAll: vi.fn() },
      close: vi.fn((cb?: () => void) => cb?.()),
    }
    const serverModule = {
      createServer: vi.fn(() => fakeServer),
      shutdown: shutdownSpy,
    }

    const result = await runApp(
      {
        app,
        BrowserWindow: FakeBrowserWindow,
        Tray: FakeTray,
        Menu: createFakeMenu(),
        dialog: createFakeDialog(),
      },
      { isPortFreeFn: async () => true, loadServerModuleFn: () => serverModule }
    )
    assertStarted(result)
    const tray = result.tray as FakeTray
    const exitItem = findMenuItem(tray.contextMenu, 'Çıkış')

    exitItem.click?.()

    expect(shutdownSpy).toHaveBeenCalledTimes(1)
    expect(shutdownSpy).toHaveBeenCalledWith(fakeServer, fakeServer.sseHub, expect.any(Function))
    expect(fakeServer.sseHub.closeAll).toHaveBeenCalledTimes(1)
    expect(fakeServer.close).toHaveBeenCalledTimes(1)
    expect(app.quit).toHaveBeenCalledTimes(1)
  })

  // QA F-014 (2026-09-06, KALDI) H7/N1 düzeltmesi — M-E mutasyonu (`isQuitting` koruması
  // kaldırılırsa) eskiden bu dosyadaki 12/12 testi YEŞİL bırakıyordu; yalnızca gerçek Electron
  // E2E'si (`e2e:electron`) yakalıyordu. Gerçek hata şekli: `app.quit()` çağrıldığında Electron
  // hâlâ var olan (gizli) pencereyi TEKRAR kapatmaya çalışır ve bu, `close` handler'ını İKİNCİ
  // kez tetikler. `isQuitting` bayrağı YOKSA bu ikinci çağrı da `preventDefault()` çağırıp
  // pencereyi gizler — `app.quit()` sessizce iptal olur. Bu test tam olarak o ikinci çağrıyı
  // simüle eder; artık BİRİM seviyesinde de çitleniyor.
  it("tepsi Çıkış'tan SONRA close handler tekrar tetiklenirse (app.quit()'in kendi pencere kapatma denemesi) artık müdahale etmez — isQuitting koruması", async () => {
    const app = createFakeApp(false)
    const fakeServer = {
      sseHub: { closeAll: vi.fn() },
      close: vi.fn((cb?: () => void) => cb?.()),
    }
    const serverModule = {
      createServer: vi.fn(() => fakeServer),
      shutdown: vi.fn((server: unknown, hub: { closeAll: () => void }, exit?: () => void) => {
        hub.closeAll()
        exit?.()
      }),
    }

    const result = await runApp(
      {
        app,
        BrowserWindow: FakeBrowserWindow,
        Tray: FakeTray,
        Menu: createFakeMenu(),
        dialog: createFakeDialog(),
      },
      { isPortFreeFn: async () => true, loadServerModuleFn: () => serverModule }
    )
    assertStarted(result)
    const tray = result.tray as FakeTray
    const exitItem = findMenuItem(tray.contextMenu, 'Çıkış')
    const mainWindow = result.mainWindow as FakeBrowserWindow

    exitItem.click?.()
    expect(app.quit).toHaveBeenCalledTimes(1)

    // Gerçek Electron'da `app.quit()` burada `close`'u tekrar tetikler.
    const preventDefault = vi.fn()
    mainWindow.handlers.close?.({ preventDefault })

    expect(preventDefault).not.toHaveBeenCalled()
  })

  // QA F-014 (2026-09-06 tur2, KALDI) I1/B4 düzeltmesi — ilk açılış bildirim penceresi
  // (`showAutostartEnabledNotice`) AÇIKKEN tepsi "Çıkış" gerçek `electron.exe`'de ~%18 koşuda
  // uygulamayı hiç kapatmıyordu (5 süreç 30 sn boyunca yaşıyordu, yalnızca test kaçırıcının zorla
  // kapatması onları temizliyordu). Bu test o senaryoyu birim seviyesinde çitler: `fsImpl` marker
  // dosyasının OLMADIĞINI söyler (ilk açılış), bu yüzden `runApp` ikinci bir pencere açar; sonra
  // tepsi "Çıkış" tıklanır ve HER İKİ pencerenin de `destroy()` edildiği + `app.quit()`'in
  // çağrıldığı doğrulanır. Koruma (BrowserWindow.getAllWindows() döngüsü) kaldırılırsa bu test
  // KIRMIZI verir: sahte `app.quit()` hiçbir pencereyi kendiliğinden kapatmaz.
  it('bildirim penceresi AÇIKKEN tepsi Çıkış TÜM pencereleri kapatır (I1 — QA F-014 tur2 B4)', async () => {
    resetFakeBrowserWindowInstances()
    const app = createFakeApp(false)
    const fakeServer = {
      sseHub: { closeAll: vi.fn() },
      close: vi.fn((cb?: () => void) => cb?.()),
    }
    const serverModule = {
      createServer: vi.fn(() => fakeServer),
      shutdown: vi.fn((server: unknown, hub: { closeAll: () => void }, exit?: () => void) => {
        hub.closeAll()
        exit?.()
      }),
    }
    // Marker yok → ilk açılış → açılışta başlama bildirim penceresi de açılır (2 pencere).
    const fsImpl = { existsSync: () => false, mkdirSync: vi.fn(), writeFileSync: vi.fn() }

    const result = await runApp(
      {
        app,
        BrowserWindow: FakeBrowserWindow,
        Tray: FakeTray,
        Menu: createFakeMenu(),
        dialog: createFakeDialog(),
      },
      { isPortFreeFn: async () => true, loadServerModuleFn: () => serverModule, fsImpl }
    )
    assertStarted(result)
    expect(result.justEnabledAutostart).toBe(true)
    expect(FakeBrowserWindow.instances).toHaveLength(2) // [0]=ana pencere, [1]=bildirim penceresi
    const [mainWindow, noticeWindow] = FakeBrowserWindow.instances

    const tray = result.tray as FakeTray
    const exitItem = findMenuItem(tray.contextMenu, 'Çıkış')
    exitItem.click?.()

    expect(mainWindow.destroyed).toBe(true)
    expect(noticeWindow.destroyed).toBe(true)
    expect(app.quit).toHaveBeenCalledTimes(1)
  })
})
