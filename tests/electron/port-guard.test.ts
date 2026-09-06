import { describe, expect, it } from 'vitest'
import { PORT_ERROR_TITLE, portErrorBody, runApp } from '../../electron/main.cjs'
import {
  createFakeApp,
  createFakeDialog,
  createFakeMenu,
  createFakeServerModule,
  FakeBrowserWindow,
  FakeTray,
} from './helpers/fake-electron'

// F-014 sözleşme §4 + §8 MUTASYON M1.

describe('electron port ön kontrolü (7333 dolu)', () => {
  it('port doluysa createServer hiç çağrılmadan okunabilir bir hata diyaloğu gösterilir ve app.quit() çağrılır', async () => {
    const app = createFakeApp(false)
    const dialog = createFakeDialog()
    const serverModule = createFakeServerModule()

    const result = await runApp(
      { app, BrowserWindow: FakeBrowserWindow, Tray: FakeTray, Menu: createFakeMenu(), dialog },
      {
        env: { MC_PORT: '7333' },
        isPortFreeFn: async () => false,
        loadServerModuleFn: () => serverModule,
      }
    )

    expect(result).toEqual({ started: false, reason: 'port-in-use' })
    expect(serverModule.createServer).not.toHaveBeenCalled()
    expect(app.quit).toHaveBeenCalledTimes(1)
    expect(dialog.showErrorBox).toHaveBeenCalledWith(PORT_ERROR_TITLE, portErrorBody(7333))
    // Yabancı bir sürece sessizce bağlanma yapısal olarak imkânsız (N4 dersi): mesaj port
    // numarasını ve MC_PORT ipucunu içerir.
    expect(dialog.showErrorBox.mock.calls[0]?.[1]).toContain('7333')
    expect(dialog.showErrorBox.mock.calls[0]?.[1]).toContain('MC_PORT')
  })

  it('port boşsa dialog gösterilmez, createServer normal şekilde çağrılır', async () => {
    const app = createFakeApp(false)
    const dialog = createFakeDialog()
    const serverModule = createFakeServerModule()

    const result = await runApp(
      { app, BrowserWindow: FakeBrowserWindow, Tray: FakeTray, Menu: createFakeMenu(), dialog },
      { isPortFreeFn: async () => true, loadServerModuleFn: () => serverModule }
    )

    expect(result.started).toBe(true)
    expect(dialog.showErrorBox).not.toHaveBeenCalled()
    expect(serverModule.createServer).toHaveBeenCalledTimes(1)
  })
})
