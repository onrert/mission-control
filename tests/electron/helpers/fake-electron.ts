import { vi } from 'vitest'
import type { RunAppResult } from '../../../electron/main.cjs'

// F-014 — testlerin `electron/main.cjs`'in `runApp()`'ına verdiği sahte Electron nesneleri.
// `runApp` üst seviyede `require('electron')` çağırmaz (bkz. main.cjs başlık yorumu); tüm
// Electron API'leri parametre olarak gelir, bu yüzden bu sahteler gerçek Electron'a hiç ihtiyaç
// duymadan tüm yaşam döngüsünü test edebilir.

export function createFakeApp(initialOpenAtLogin = false) {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  let openAtLogin = initialOpenAtLogin
  return {
    requestSingleInstanceLock: vi.fn(() => true),
    quit: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      ;(listeners[event] ??= []).push(handler)
    }),
    emit(event: string, ...args: unknown[]) {
      for (const handler of listeners[event] ?? []) handler(...args)
    },
    getPath: vi.fn(() => '/fake/userdata'),
    getLoginItemSettings: vi.fn(() => ({ openAtLogin })),
    setLoginItemSettings: vi.fn((settings: { openAtLogin: boolean }) => {
      openAtLogin = settings.openAtLogin
    }),
  }
}

export type FakeApp = ReturnType<typeof createFakeApp>

export class FakeBrowserWindow {
  handlers: Record<string, (...args: unknown[]) => void> = {}
  hidden = false
  destroyed = false
  loadedUrl?: string
  show = vi.fn(() => {
    this.hidden = false
  })
  hide = vi.fn(() => {
    this.hidden = true
  })
  focus = vi.fn()
  restore = vi.fn()
  constructor(public opts: unknown) {}
  loadURL(url: string) {
    this.loadedUrl = url
  }
  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers[event] = handler
  }
  isMinimized() {
    return false
  }
  isDestroyed() {
    return this.destroyed
  }
}

export class FakeTray {
  handlers: Record<string, (...args: unknown[]) => void> = {}
  contextMenu: unknown = null
  setToolTip = vi.fn()
  displayBalloon = vi.fn()
  constructor(public iconPath: string) {}
  setContextMenu(menu: unknown) {
    this.contextMenu = menu
  }
  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers[event] = handler
  }
}

export function createFakeMenu() {
  return { buildFromTemplate: vi.fn((template: unknown) => template) }
}

export function createFakeDialog() {
  return { showErrorBox: vi.fn() }
}

/**
 * `createServer` ve `shutdown`'ı taklit eder ama GERÇEK sunucuyu (chat SDK dahil) hiç başlatmaz
 * — mutasyon testleri hangi fonksiyonun ÇAĞRILDIĞINI ölçer, gerçek ağ/SDK davranışını değil.
 */
export function createFakeServerModule() {
  const fakeServer = {
    sseHub: { closeAll: vi.fn() },
    close: vi.fn((cb?: () => void) => cb?.()),
  }
  return {
    createServer: vi.fn(() => fakeServer),
    shutdown: vi.fn(
      (server: typeof fakeServer, hub: { closeAll: () => void }, exit?: (code: number) => void) => {
        hub.closeAll()
        server.close(() => exit?.(0))
      }
    ),
    fakeServer,
  }
}

export function createFakeElectronApi(
  overrides: {
    app?: FakeApp
  } = {}
) {
  const app = overrides.app ?? createFakeApp(false)
  return {
    app,
    BrowserWindow: FakeBrowserWindow,
    Tray: FakeTray,
    Menu: createFakeMenu(),
    dialog: createFakeDialog(),
  }
}

/** `result.started`'ı TS'e daraltır; testler `mainWindow`/`tray`/`shutdownViaTray`'e sarmalama
 *  olmadan erişebilir. Beklenmedik `started:false` durumunda anlamlı bir assertion hatası verir. */
export function assertStarted(
  result: RunAppResult
): asserts result is Extract<RunAppResult, { started: true }> {
  if (!result.started) {
    throw new Error(`runApp beklenmedik şekilde başlamadı: ${result.reason}`)
  }
}
