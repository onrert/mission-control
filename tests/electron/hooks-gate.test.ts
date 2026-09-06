import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HOOKS_MISSING_TITLE, runApp } from '../../electron/main.cjs'
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

// QA F-014 (2026-09-06, KALDI) H1/B2 düzeltmesi — "Hook'suz oturum AÇILMAZ" (CEO kararı).
// Bu dosya `runApp`'ın hook kontrolüne doğru KABLOLANDIĞINI doğrular (kontrolün kendi mantığı
// `project-dir-and-hooks.test.ts`'te `hasHookInfrastructure` üzerinden ayrıca test edilir —
// burada `hasHookInfrastructureFn` doğrudan enjekte edilir, dosya sistemiyle uğraşmaya gerek yok).

beforeEach(() => {
  resetFakeBrowserWindowInstances()
})

describe('runApp — hook altyapısı yoksa sohbet oturumu (ve bu tek-süreç modelinde tüm uygulama) hiç açılmaz', () => {
  it('hasHookInfrastructureFn false dönerse createServer hiç çağrılmadan görünür bir hata gösterilir ve app.quit() çağrılır', async () => {
    const app = createFakeApp(false)
    const serverModule = createFakeServerModule()
    const hasHookInfrastructureFn = vi.fn(() => false)

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
        hasHookInfrastructureFn,
        env: { MC_PROJECT_DIR: 'D:\\fake-hooksuz-proje' },
      }
    )

    expect(result).toEqual({ started: false, reason: 'hooks-missing' })
    expect(serverModule.createServer).not.toHaveBeenCalled()
    expect(app.quit).toHaveBeenCalledTimes(1)
    expect(hasHookInfrastructureFn).toHaveBeenCalledWith('D:\\fake-hooksuz-proje')

    expect(FakeBrowserWindow.instances).toHaveLength(1)
    const errorWindow = FakeBrowserWindow.instances[0]
    expect(errorWindow.opts).toMatchObject({ title: HOOKS_MISSING_TITLE, show: true })
    const decodedUrl = decodeURIComponent(errorWindow.loadedUrl ?? '')
    expect(decodedUrl).toContain('D:\\fake-hooksuz-proje')
  })

  it('hasHookInfrastructureFn true dönerse (varsayılan/normal durum) sunucu başlar VE oturum çalışma dizini (MC_CHAT_SESSION_CWD) çözülen proje dizinine sabitlenir', async () => {
    const app = createFakeApp(false)
    const serverModule = createFakeServerModule()
    const env: NodeJS.ProcessEnv = { MC_PROJECT_DIR: 'D:\\gercek-proje' }

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
        hasHookInfrastructureFn: () => true,
        env,
      }
    )

    assertStarted(result)
    expect(result.projectDir).toBe('D:\\gercek-proje')
    // H1 — session.ts kendi __dirname türetimini ASLA kullanmasın diye electron/main.cjs bu
    // değişkeni loadServerModuleFn() ÇAĞRILMADAN ÖNCE set eder.
    expect(env.MC_CHAT_SESSION_CWD).toBe('D:\\gercek-proje')
  })
})
