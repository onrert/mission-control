import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * Genel amaçlı, paylaşılan özyinelemeli dizin anlık görüntüsü (F-006 sözleşmesi §1/§6).
 * F-005'in `tests/integration/projects-api.test.ts` içine gömdüğü iç yardımcının genel
 * amaçlı hâli (o sürüm `mtimeMs` de içeriyordu; burada gereksiz, sha256 zaten içerik
 * değişikliğini yakalıyor).
 */
export interface ManifestEntry {
  relPath: string
  size: number
  sha256: string
  /** F-008 sözleşmesi §10.2 (Ö4) — yalnızca `snapshotDir(dir, { includeMtime: true })` ile
   *  istenirse dolu. Varsayılan (parametresiz) çağrılarda YOK; mevcut çağıranların (F-005/F-006
   *  manifest testleri) davranışı DEĞİŞMEZ. */
  mtimeMs?: number
}

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function toPosix(relPath: string): string {
  return relPath.split(path.sep).join('/')
}

function walk(dir: string, root: string, out: ManifestEntry[], includeMtime: boolean): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  if (entries.length === 0 && dir !== root) {
    out.push({ relPath: `${toPosix(path.relative(root, dir))}/`, size: 0, sha256: '' })
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, root, out, includeMtime)
    } else if (entry.isFile()) {
      const stat = fs.statSync(full)
      const entryOut: ManifestEntry = {
        relPath: toPosix(path.relative(root, full)),
        size: stat.size,
        sha256: sha256File(full),
      }
      if (includeMtime) entryOut.mtimeMs = stat.mtimeMs
      out.push(entryOut)
    }
  }
}

export interface SnapshotDirOptions {
  /** F-008 sözleşmesi §10.2 (Ö4/M11) — `true` ise her girdiye `mtimeMs` eklenir, `mtime`-only
   *  bir dokunuşu (içerik/sha256/boyut aynı kalırken yalnızca `mtime` değişmesi) yakalayabilmek
   *  için. Varsayılan `false` — mevcut davranış değişmez. */
  includeMtime?: boolean
}

/** `dir` altındaki tüm dosyaların (göreli yol, boyut, sha256) üçlüsü — POSIX'e çevrilmiş
 * göreli yol, alfabetik sıralı. Boş dizinler `relPath` sonu `/` ile ayrı girdi olarak dahil. */
export function snapshotDir(dir: string, options?: SnapshotDirOptions): ManifestEntry[] {
  const out: ManifestEntry[] = []
  walk(dir, dir, out, options?.includeMtime ?? false)
  out.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0))
  return out
}
