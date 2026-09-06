import { beforeEach, describe, expect, it } from 'vitest'
import { PORT_ERROR_TITLE, portErrorBody, runApp } from '../../electron/main.cjs'
import {
  createFakeApp,
  createFakeDialog,
  createFakeMenu,
  createFakeServerModule,
  FakeBrowserWindow,
  FakeTray,
  resetFakeBrowserWindowInstances,
} from './helpers/fake-electron'

// F-014 sözleşme §4 + §8 (mutasyon M1).
//
// QA F-014 (2026-09-06, KALDI) B1 düzeltmesi — `dialog.showErrorBox` bu ortamda hiçbir pencere
// üretmiyor (izole sondayla ölçüldü). Kullanıcıya görünen hata artık gerçek bir `BrowserWindow`
// (`showFatalErrorWindow`) — bu test artık `dialog.showErrorBox` ÇAĞRILMADIĞINI ve onun yerine
// gerçek bir pencere OLUŞTURULDUĞUNU (başlık + gövde metniyle) doğruluyor.

beforeEach(() => {
  resetFakeBrowserWindowInstances()
})

describe('electron port ön kontrolü (7333 dolu)', () => {
  it('port doluysa createServer hiç çağrılmadan görünür bir pencerede hata gösterilir ve app.quit() çağrılır', async () => {
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
    // B1 dersi — `dialog.showErrorBox` bu makinede hiçbir pencere üretmiyor, bu yüzden hiç
    // çağrılmamalı; gerçek görünürlük bir `BrowserWindow` ile sağlanmalı.
    expect(dialog.showErrorBox).not.toHaveBeenCalled()
    expect(FakeBrowserWindow.instances).toHaveLength(1)
    const errorWindow = FakeBrowserWindow.instances[0]
    expect(errorWindow.opts).toMatchObject({ title: PORT_ERROR_TITLE, show: true })
    const decodedUrl = decodeURIComponent(errorWindow.loadedUrl ?? '')
    expect(decodedUrl).toContain(PORT_ERROR_TITLE)
    expect(decodedUrl).toContain(portErrorBody(7333))
    // Yabancı bir sürece sessizce bağlanma yapısal olarak imkânsız (N4 dersi): mesaj port
    // numarasını ve MC_PORT ipucunu içerir.
    expect(decodedUrl).toContain('7333')
    expect(decodedUrl).toContain('MC_PORT')
  })

  it('port boşsa hiçbir hata penceresi/diyaloğu gösterilmez, createServer normal şekilde çağrılır', async () => {
    const app = createFakeApp(false)
    const dialog = createFakeDialog()
    const serverModule = createFakeServerModule()

    const result = await runApp(
      { app, BrowserWindow: FakeBrowserWindow, Tray: FakeTray, Menu: createFakeMenu(), dialog },
      { isPortFreeFn: async () => true, loadServerModuleFn: () => serverModule }
    )

    expect(result.started).toBe(true)
    expect(dialog.showErrorBox).not.toHaveBeenCalled()
    expect(FakeBrowserWindow.instances).toHaveLength(1) // yalnızca ana pencere, hata penceresi yok
    expect(serverModule.createServer).toHaveBeenCalledTimes(1)
  })
})
