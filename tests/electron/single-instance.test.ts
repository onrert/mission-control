import { describe, expect, it } from 'vitest'
import { runApp } from '../../electron/main.cjs'
import {
  assertStarted,
  createFakeApp,
  createFakeDialog,
  createFakeMenu,
  createFakeServerModule,
  FakeBrowserWindow,
  FakeTray,
} from './helpers/fake-electron'

// F-014 sözleşme §3 + §8 MUTASYON M2.

describe('electron tek örnek (single instance)', () => {
  it('ikinci örnek kilidi alamazsa hiçbir şey başlatılmadan (createServer hiç çağrılmadan) app.quit() çağrılır', async () => {
    const app = createFakeApp(false)
    app.requestSingleInstanceLock.mockReturnValue(false)
    const serverModule = createFakeServerModule()

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

    expect(result).toEqual({ started: false, reason: 'single-instance' })
    expect(app.quit).toHaveBeenCalledTimes(1)
    expect(serverModule.createServer).not.toHaveBeenCalled()
  })

  it('kilidi alan "kazanan" örnekte second-instance olayı pencereyi gösterip odaklar', async () => {
    const app = createFakeApp(false)
    const serverModule = createFakeServerModule()

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
    mainWindow.hidden = true

    app.emit('second-instance')

    expect(mainWindow.show).toHaveBeenCalled()
    expect(mainWindow.focus).toHaveBeenCalled()
  })
})
