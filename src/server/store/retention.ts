import fs from 'node:fs'
import path from 'node:path'
import { DAY_FILE_PATTERN, dayFileName } from './jsonl-store'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * `target`'ın gerçek yolu `root`'un gerçek yolu altında mı? Dizge önek karşılaştırması
 * (`startsWith`) KESİNLİKLE kullanılmaz — mimari §3.6'nın yasakladığı "kardeş önek tuzağı"
 * (`C:\dev\app` kökü `C:\dev\app-factory`'yi içeriyormuş gibi yanlışlıkla eşleşir). Saf
 * fonksiyon: hem `root` hem `target` her çağrıda yeniden `realpathSync` ile çözülür (TOCTOU'ya
 * karşı, açılışta bir kez değil — sözleşme §3 madde 3).
 */
export function isInsideDataRoot(root: string, target: string): boolean {
  let resolvedRoot: string
  let resolvedTarget: string
  try {
    resolvedRoot = fs.realpathSync(root)
  } catch {
    return false
  }
  try {
    resolvedTarget = fs.realpathSync(target)
  } catch {
    return false
  }
  const rel = path.relative(resolvedRoot, resolvedTarget)
  if (rel === '') return false
  if (rel.startsWith('..')) return false
  if (path.isAbsolute(rel)) return false
  return true
}

function listDayFilesAscending(eventsDir: string): string[] {
  if (!fs.existsSync(eventsDir)) return []
  // Adlar (`YYYY-MM-DD.jsonl`) sözlük sırasına göre zaten kronolojiktir.
  return fs
    .readdirSync(eventsDir)
    .filter((name) => DAY_FILE_PATTERN.test(name))
    .sort()
}

/**
 * Silinecek her dosya adı yalnızca `readdir` çıktısından gelir, silinmeden önce desene karşı
 * doğrulanır (savunma katmanı) ve `isInsideDataRoot` ile kapsama kontrolünden geçirilir.
 */
function safeDelete(dataRoot: string, eventsDir: string, fileName: string): boolean {
  if (!DAY_FILE_PATTERN.test(fileName)) return false
  const target = path.join(eventsDir, fileName)
  if (!isInsideDataRoot(dataRoot, target)) return false
  try {
    fs.unlinkSync(target)
    return true
  } catch {
    // Windows'ta EPERM/EBUSY (antivirüs, açık dosya) — bir sonraki saatlik tura bırakılır (R4).
    return false
  }
}

function dayKeyFromFile(fileName: string): string {
  return fileName.replace(/\.jsonl$/, '')
}

/**
 * Gün bazlı budama: aktif (bugünkü) gün dosyası hiçbir koşulda silinmez. `MC_RETENTION_DAYS`'ten
 * eski dosyalar silinir. Silinen dosyaların satır sayısı, verilirse `lineCounts`'tan da düşülür.
 */
export function pruneByDays(
  dataRoot: string,
  now: Date,
  retentionDays: number,
  lineCounts?: Map<string, number>
): string[] {
  const eventsDir = path.join(dataRoot, 'events')
  const activeFile = dayFileName(now)
  const cutoff = dayFileName(new Date(now.getTime() - retentionDays * MS_PER_DAY))
  const deleted: string[] = []
  for (const file of listDayFilesAscending(eventsDir)) {
    if (file === activeFile) continue
    if (file >= cutoff) continue
    if (safeDelete(dataRoot, eventsDir, file)) {
      deleted.push(file)
      lineCounts?.delete(dayKeyFromFile(file))
    }
  }
  return deleted
}

/**
 * Adet bazlı budama: toplam satır sayısı (yalnızca `lineCounts` haritasından, disk taraması
 * değil) `retentionEvents`'i aşıyorsa en eski gün dosyasından başlanarak (aktif dosya hariç)
 * silinir; her silmeden sonra toplam güncellenir.
 */
export function pruneByCount(
  dataRoot: string,
  now: Date,
  lineCounts: Map<string, number>,
  retentionEvents: number
): string[] {
  const eventsDir = path.join(dataRoot, 'events')
  const activeFile = dayFileName(now)
  const deleted: string[] = []
  const files = listDayFilesAscending(eventsDir).filter((f) => f !== activeFile)
  let total = Array.from(lineCounts.values()).reduce((sum, n) => sum + n, 0)

  for (const file of files) {
    if (total <= retentionEvents) break
    const day = dayKeyFromFile(file)
    const count = lineCounts.get(day) ?? 0
    if (safeDelete(dataRoot, eventsDir, file)) {
      deleted.push(file)
      lineCounts.delete(day)
      total -= count
    }
  }
  return deleted
}

export interface RetentionOptions {
  retentionDays: number
  retentionEvents: number
}

export interface LineCountSource {
  readonly lineCounts: Map<string, number>
}

export function runRetentionOnce(
  dataRoot: string,
  store: LineCountSource,
  options: RetentionOptions,
  now: Date = new Date()
): void {
  pruneByDays(dataRoot, now, options.retentionDays, store.lineCounts)
  pruneByCount(dataRoot, now, store.lineCounts, options.retentionEvents)
}

/** Açılışta bir kez + saatte bir (`unref()`'li, süreç kapanışını asla bloklamaz). */
export function startRetentionScheduler(
  dataRoot: string,
  store: LineCountSource,
  options: RetentionOptions
): () => void {
  runRetentionOnce(dataRoot, store, options)
  const timer = setInterval(() => runRetentionOnce(dataRoot, store, options), 60 * 60 * 1000)
  timer.unref()
  return () => clearInterval(timer)
}
