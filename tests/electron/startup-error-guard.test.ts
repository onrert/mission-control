import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STARTUP_ERROR_TITLE, runApp } from '../../electron/main.cjs'
import {
  createFakeApp,
  createFakeDialog,
  createFakeMenu,
  FakeBrowserWindow,
  FakeTray,
  resetFakeBrowserWindowInstances,
} from './helpers/fake-electron'

// QA F-014 (2026-09-06, KALDI) B3/H3 düzeltmesi — `createServer` (veya `loadServerModuleFn`)
// senkron olarak fırlatırsa (gerçek repro: `dataDir` bir dosya tarafından engellenmiş — AV
// kilidi, salt-okunur/dolu disk) eskiden hiçbir yere düşmüyordu: pencere yok, tepsi yok, hata
// yok, süreç sonsuza kadar açık kalıyordu (zombi). CLAUDE.md'nin üç kez tekrarlayan "yazma/
// başlatma yolundaki yakalanmamış hata her şeyi öldürür" dersinin dördüncü tekrarı.

beforeEach(() => {
  resetFakeBrowserWindowInstances()
})

describe('electron başlatma hatası — yakalanmamış hata artık sessiz zombiye dönmez', () => {
  it('createServer senkron olarak fırlatırsa görünür bir hata gösterilir, app.exit(1) çağrılır (app.quit() DEĞİL — kesin çıkış)', async () => {
    const app = createFakeApp(false)
    const brokenServerModule = {
      createServer: vi.fn(() => {
        throw new Error('ENOTDIR: veri dizini oluşturulamadı')
      }),
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
      { isPortFreeFn: async () => true, loadServerModuleFn: () => brokenServerModule }
    )

    expect(result).toEqual({
      started: false,
      reason: 'startup-error',
      error: expect.stringContaining('ENOTDIR'),
    })
    expect(app.exit).toHaveBeenCalledWith(1)
    expect(app.quit).not.toHaveBeenCalled()

    // Görünür hata — gerçek bir BrowserWindow oluşturuldu (dialog.showErrorBox DEĞİL, B1 dersi).
    expect(FakeBrowserWindow.instances).toHaveLength(1)
    const errorWindow = FakeBrowserWindow.instances[0]
    expect(errorWindow.opts).toMatchObject({ title: STARTUP_ERROR_TITLE, show: true })
    const decodedUrl = decodeURIComponent(errorWindow.loadedUrl ?? '')
    expect(decodedUrl).toContain(STARTUP_ERROR_TITLE)
    expect(decodedUrl).toContain('ENOTDIR')
  })

  it('loadServerModuleFn senkron olarak fırlatırsa da aynı şekilde yakalanır (tsx register hatası vb.)', async () => {
    const app = createFakeApp(false)

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
        loadServerModuleFn: () => {
          throw new Error('modül yüklenemedi')
        },
      }
    )

    expect(result).toEqual({
      started: false,
      reason: 'startup-error',
      error: expect.stringContaining('modül yüklenemedi'),
    })
    expect(app.exit).toHaveBeenCalledWith(1)
  })
})
