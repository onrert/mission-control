import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SESSION_FILE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'features',
  'chat',
  'server',
  'session.ts'
)

// Sözleşme §2.4/§12 — K3'ün kapsam dışı bıraktığı tek şey `permissionMode` ince ayarı: bu
// literal değerler hiçbir zaman `session.ts`'e girmemeli (mutasyon 4). Statik grep guard,
// kaynaktan türetilmiş: gerçek dosya içeriği taranır, kopyalanmış bir sabit metin değil.
describe("permission-mode-fence — session.ts 'bypassPermissions'/'acceptEdits' KULLANMAZ", () => {
  it("session.ts dosyası mevcut ve taranabilir (körlük assert'i)", () => {
    expect(fs.existsSync(SESSION_FILE)).toBe(true)
  })

  it("session.ts içinde literal 'bypassPermissions' geçmiyor", () => {
    const content = fs.readFileSync(SESSION_FILE, 'utf8')
    expect(content).not.toContain('bypassPermissions')
  })

  it("session.ts içinde literal 'acceptEdits' geçmiyor", () => {
    const content = fs.readFileSync(SESSION_FILE, 'utf8')
    expect(content).not.toContain('acceptEdits')
  })

  it("permissionMode değeri gerçekten 'default'", () => {
    const content = fs.readFileSync(SESSION_FILE, 'utf8')
    expect(content).toMatch(/permissionMode:\s*'default'/)
  })
})
