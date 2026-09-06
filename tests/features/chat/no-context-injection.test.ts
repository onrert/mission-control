import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(__dirname, '..', '..', '..')
const CHAT_DIR = path.join(ROOT, 'src', 'features', 'chat')
const INDEX_FILE = path.join(ROOT, 'src', 'server', 'index.ts')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full)
  }
  return out
}

// K4 — olay akışı (izlenen projelerin hook verileri) CEO'nun bağlamına HİÇBİR biçimde
// beslenmez. `src/features/chat/**` hiçbir dosyası olay deposunun/sorgusunun okuma API'lerini
// import ETMEMELİ (mutasyon 8).
const FORBIDDEN_IMPORT_FRAGMENTS = [
  'store/jsonl-store',
  'events/server/query',
  'events/server/ingest',
]

describe('no-context-injection — chat modülü olay akışını CEO bağlamına beslemez (K4)', () => {
  const files = walk(CHAT_DIR)

  it("taranan dosya sayısı > 0 (körlük assert'i)", () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)("%s yasak olay-okuma import'larından hiçbirini içermiyor", (file) => {
    const content = fs.readFileSync(file, 'utf8')
    for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
      expect(content).not.toContain(fragment)
    }
  })

  it("kalıcı negatif-kontrol: tarama yapay bir yasak import'u gerçekten yakalar", () => {
    const content = "import { handleQuery } from '../../../server/events/server/query'\n"
    const matched = FORBIDDEN_IMPORT_FRAGMENTS.some((fragment) => content.includes(fragment))
    expect(matched).toBe(true)
  })

  // Ö7/mutasyon 8b — `index.ts`'teki `createChatSession(...)` çağrı yerinin KAPALI alan
  // kümesi: yalnızca `query, dataDir, hub, now, env`. `store`/`projectsService` asla geçirilmez.
  it("index.ts'teki createChatSession(...) çağrısı yalnızca kapalı deps kümesini geçirir", () => {
    const content = fs.readFileSync(INDEX_FILE, 'utf8')
    const match = content.match(/createChatSession\(\{([\s\S]*?)\}\)/)
    expect(match).not.toBeNull()
    const argsBlock = match![1]!
    expect(argsBlock).toMatch(/query\s*:/)
    expect(argsBlock).toMatch(/dataDir\s*:/)
    expect(argsBlock).toMatch(/hub\s*[,:]/)
    expect(argsBlock).toMatch(/now\s*:/)
    expect(argsBlock).toMatch(/env\s*:/)
    expect(argsBlock).not.toMatch(/\bstore\b\s*[,:]/)
    expect(argsBlock).not.toMatch(/projectsService/)
  })
})
