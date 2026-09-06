import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTOSTART_ENABLED_MESSAGE,
  ensureDefaultAutostart,
  runApp,
  setAutostart,
} from '../../electron/main.cjs'
import {
  assertStarted,
  createFakeApp,
  createFakeDialog,
  createFakeMenu,
  createFakeServerModule,
  FakeBrowserWindow,
  FakeTray,
  resetFakeBrowserWindowInstances,
} from './helpers/fake-electron'

beforeEach(() => {
  resetFakeBrowserWindowInstances()
})

// F-014 sözleşme §5 + G1 (CEO kararı: varsayılan AÇIK ama GÖRÜNÜR) + §8 (mutasyon M6).

function findMenuItem(template: unknown, label: string) {
  const items = template as Array<{ label?: string; click?: () => void; checked?: boolean }>
  const item = items.find((i) => i.label === label)
  if (!item) throw new Error(`menü öğesi bulunamadı: ${label}`)
  return item
}

describe('setAutostart (saf yazma fonksiyonu)', () => {
  it('verilen değeri olduğu gibi setLoginItemSettings çağrısına yazar, girdiyi yok saymaz', () => {
    const app = createFakeApp(true)
    setAutostart(app, false)
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
      path: process.execPath,
      args: [],
    })
  })
})

describe('tepsi menüsü — açılışta başlama onay kutusu', () => {
  it('tıklanınca mevcut değeri TERSİNE çevirip setLoginItemSettings çağırır, menü checkbox durumu güncellenir', async () => {
    const app = createFakeApp(true) // başlangıç: açık
    const serverModule = createFakeServerModule()

    const result = await runApp(
      {
        app,
        BrowserWindow: FakeBrowserWindow,
        Tray: FakeTray,
        Menu: createFakeMenu(),
        dialog: createFakeDialog(),
      },
      {
        isPortFreeFn: async () => true,
        loadServerModuleFn: () => serverModule,
        fsImpl: { existsSync: () => true, mkdirSync: vi.fn(), writeFileSync: vi.fn() },
      }
    )
    assertStarted(result)
    const tray = result.tray as FakeTray
    const item = findMenuItem(tray.contextMenu, 'Bilgisayar açılışında başlat')
    expect(item.checked).toBe(true)

    item.click?.()

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
      path: process.execPath,
      args: [],
    })
    const updatedItem = findMenuItem(tray.contextMenu as unknown, 'Bilgisayar açılışında başlat')
    expect(updatedItem.checked).toBe(false)
  })
})

describe('ensureDefaultAutostart (G1 — varsayılan AÇIK ama görünür)', () => {
  it('marker dosyası yoksa (ilk açılış) açılışta başlamayı AÇAR ve marker yazar', () => {
    const app = createFakeApp(false)
    const writeFileSync = vi.fn()
    const mkdirSync = vi.fn()
    const fsImpl = { existsSync: () => false, mkdirSync, writeFileSync }

    const justEnabled = ensureDefaultAutostart(
      app,
      '/fake/userdata/autostart-initialized.json',
      fsImpl
    )

    expect(justEnabled).toBe(true)
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      path: process.execPath,
      args: [],
    })
    expect(writeFileSync).toHaveBeenCalledTimes(1)
  })

  it('marker dosyası zaten varsa ZORLA açmaz (kullanıcının önceki tercihi korunur)', () => {
    const app = createFakeApp(false)
    const setLoginItemSettings = app.setLoginItemSettings
    const fsImpl = { existsSync: () => true, mkdirSync: vi.fn(), writeFileSync: vi.fn() }

    const justEnabled = ensureDefaultAutostart(
      app,
      '/fake/userdata/autostart-initialized.json',
      fsImpl
    )

    expect(justEnabled).toBe(false)
    expect(setLoginItemSettings).not.toHaveBeenCalled()
  })

  it('runApp içinde ilk açılışta tepsi balonu gösterilir (görünür varsayılan, gizli değil)', async () => {
    const app = createFakeApp(false)
    const serverModule = createFakeServerModule()
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
    const tray = result.tray as FakeTray
    expect(tray.displayBalloon).toHaveBeenCalledTimes(1)

    // Ö2 düzeltmesi (QA F-014 KALDI) — tepsi balonu bu ortamda hiç çizilmiyor (B1 ile aynı
    // sınıf), bu yüzden "açık VE görünür" şartının görünür yarısını artık ölçülebilir bir
    // `BrowserWindow` taşır (ana pencereden AYRI, ikinci bir pencere).
    expect(FakeBrowserWindow.instances).toHaveLength(2) // [0]=ana pencere, [1]=bildirim penceresi
    const noticeWindow = FakeBrowserWindow.instances[1]
    const decodedUrl = decodeURIComponent(noticeWindow.loadedUrl ?? '')
    expect(decodedUrl).toContain(AUTOSTART_ENABLED_MESSAGE)
  })

  it('ikinci açılışta (marker zaten var, justEnabledAutostart false) bildirim penceresi GÖSTERİLMEZ', async () => {
    const app = createFakeApp(false)
    const serverModule = createFakeServerModule()
    const fsImpl = { existsSync: () => true, mkdirSync: vi.fn(), writeFileSync: vi.fn() }

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
    expect(result.justEnabledAutostart).toBe(false)
    expect(FakeBrowserWindow.instances).toHaveLength(1) // yalnızca ana pencere
  })
})
