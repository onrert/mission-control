import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Her test kendi geçici `MC_DATA_DIR`'ini alır — hiçbir test gerçek `data/` dizinine
 * dokunmaz ve `process.env.MC_DATA_DIR` kalıcı olarak set edilmez (sözleşme §3 madde 10).
 */
export function createTempDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mc-events-'))
}

export function removeTempDataDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
}
