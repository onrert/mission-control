import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runApp } from '../../electron/main.cjs'
import { isChatEnabled } from '../../src/features/chat/server/session'
import {
  createFakeApp,
  createFakeDialog,
  createFakeMenu,
  createFakeServerModule,
  FakeBrowserWindow,
  FakeTray,
} from './helpers/fake-electron'

// F-014 sözleşme §6 + §8 MUTASYON M5. Electron'un tek sorumluluğu `MC_CHAT_ENABLED`'a HİÇ
// dokunmamaktır (ne set etmek ne kaldırmak) — gerçek `isChatEnabled(env)` bu yüzden bootstrap
// öncesi/sonrası aynı sonucu vermeli. Gerçek üretim fonksiyonu kullanılıyor (elle yazılmış
// beklenen değer değil), totoloji tuzağından kaçınılıyor.
//
// NOT — `tests/setup/chat-disabled-by-default.ts` bu ortamda `MC_CHAT_ENABLED` tanımsızsa onu
// `'0'`a sabitler (gerçek ücretli SDK çağrısını önleyen güvenlik ağı, F-012). Bu testin amacı
// Electron'un DAVRANIŞINI ölçmek olduğu için, o güvenlik ağını *bu dosyaya özel* olarak açıkça
// geçersiz kılıyoruz (dosyanın kendi belgelediği yöntem, ayrı worker'da izole, diğer dosyalara
// sızmaz) — "varsayılan tanımsız/açık" durumunu `'1'` ile taklit ediyoruz.
describe("electron bootstrap MC_CHAT_ENABLED'a dokunmaz (sohbet varsayılan açık kalır)", () => {
  const originalValue = process.env.MC_CHAT_ENABLED

  beforeEach(() => {
    process.env.MC_CHAT_ENABLED = '1'
  })

  afterEach(() => {
    process.env.MC_CHAT_ENABLED = originalValue
  })

  it('runApp() çalıştıktan sonra isChatEnabled(process.env) hâlâ true döner, değer değişmez', async () => {
    expect(isChatEnabled(process.env)).toBe(true)

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

    expect(result.started).toBe(true)
    expect(process.env.MC_CHAT_ENABLED).toBe('1')
    expect(isChatEnabled(process.env)).toBe(true)
  })
})
