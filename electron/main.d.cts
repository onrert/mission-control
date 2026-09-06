// F-014 — `electron/main.cjs`'in test/typecheck için tip bildirimi. `.cjs` uzantılı bir dosya
// için TypeScript eşleşen `.d.cts` dosyasını arar (TS 4.7+ implementation-extension eşlemesi).
// Bu dosya YALNIZCA tip bilgisi taşır, hiçbir çalışma zamanı davranışı eklemez.

export declare const DEFAULT_PORT: number
export declare const PORT_ERROR_TITLE: string
export declare function portErrorBody(port: number): string
export declare function resolvePortLike(raw: string | undefined, defaultPort: number): number
export declare function isPortFree(port: number): Promise<boolean>
export declare function ensurePortAvailable(
  port: number,
  isPortFreeFn?: (port: number) => Promise<boolean>
): Promise<boolean>
export declare function loadServerModule(): unknown
export declare function setAutostart(app: ElectronAppLike, openAtLogin: boolean): void
export declare function getAutostart(app: ElectronAppLike): boolean
export declare function ensureDefaultAutostart(
  app: ElectronAppLike,
  markerPath: string,
  fsImpl?: unknown
): boolean
export declare function buildTrayMenuTemplate(opts: {
  app: ElectronAppLike
  openAtLogin: boolean
  onOpen: () => void
  onToggleAutostart: (app: ElectronAppLike) => void
  onQuit: () => void
}): unknown[]

export interface ElectronAppLike {
  requestSingleInstanceLock(): boolean
  quit(): void
  on(event: string, handler: (...args: unknown[]) => void): void
  getPath(name: string): string
  getLoginItemSettings(): { openAtLogin: boolean }
  setLoginItemSettings(settings: { openAtLogin: boolean; path?: string; args?: string[] }): void
}

export interface ElectronApiLike {
  app: ElectronAppLike
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BrowserWindow: new (opts?: unknown) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Tray: new (iconPath: string) => any
  Menu: { buildFromTemplate: (template: unknown[]) => unknown }
  dialog: { showErrorBox: (title: string, body: string) => void }
}

export interface RunAppOptions {
  env?: NodeJS.ProcessEnv
  isPortFreeFn?: (port: number) => Promise<boolean>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadServerModuleFn?: () => any
  trayIconPath?: string
  fsImpl?: unknown
}

export type RunAppResult =
  | { started: false; reason: 'single-instance' | 'port-in-use' }
  | {
      started: true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mainWindow: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tray: any
      shutdownViaTray: () => void
      rebuildTrayMenu: () => void
      port: number
      dataDir: string
      justEnabledAutostart: boolean
    }

export declare function runApp(
  electronApi: ElectronApiLike,
  options?: RunAppOptions
): Promise<RunAppResult>
