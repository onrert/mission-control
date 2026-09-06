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
} from './helpers/fake-electron'

// F-014 sözleşme §2 + §8 MUTASYON M3 (tepsi "Çıkış" gerçek shutdown()'ı çağırır) ve
// MUTASYON M4 (pencere kapatma varsayılan davranışa bırakılmaz, gizlenir).

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
})
