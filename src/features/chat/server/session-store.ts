import fs from 'node:fs'
import path from 'node:path'

/**
 * SDK `resume: <session_id>` için gereken kimliğin panel tarafındaki tek kalıcı kopyası
 * (sözleşme §2.1 D8 — `no-write-gate-bypass` STORE_FILES'a `jsonl-store.ts` ile aynı kategoride
 * eklendi). Oturumun kendi kaynak gerçeği SDK'nın kendi `~/.claude/projects/` transkriptidir;
 * bu dosya yalnızca "hangi session_id'yi resume edeceğiz" sorusuna cevap verir.
 */
function sessionIdFilePath(dataDir: string): string {
  return path.join(dataDir, 'chat', 'session-id.txt')
}

export function readSessionId(dataDir: string): string | undefined {
  const sessionIdFile = sessionIdFilePath(dataDir)
  try {
    const raw = fs.readFileSync(sessionIdFile, 'utf8').trim()
    return raw === '' ? undefined : raw
  } catch {
    return undefined
  }
}

export function writeSessionId(dataDir: string, sessionId: string): void {
  const chatDir = path.join(dataDir, 'chat')
  fs.mkdirSync(chatDir, { recursive: true })
  const sessionIdFile = sessionIdFilePath(dataDir)
  fs.writeFileSync(sessionIdFile, sessionId)
}
