import fs from 'node:fs'
import path from 'node:path'

/**
 * F-009 spike — `docs/qa/F-009-contract.md` + `docs/decisions/ADR-007-transkript-ve-token-
 * veri-kaynagi.md` §9.4. Bu dosya `~/.claude/projects/**` altındaki belgesiz, sürümle
 * değişebilir Claude Code transkript formatını okur. Tasarım ilkesi (ADR-007): bu KIRILGAN bir
 * kaynaktır, okuyucu bunu bilir ve ASLA istisna fırlatmaz — en kötü ihtimalle "az veri" döner,
 * çökme veya sızıntı döndürmez.
 */

// ---------------------------------------------------------------------------------------------
// Okuyucu — satır bazlı, asla throw etmeyen `.jsonl` okuma
// ---------------------------------------------------------------------------------------------

/** ADR-007 §9.4: 64 MB üstü dosyalarda yalnızca son 32 MB okunur (satır sınırına hizalı). */
const DEFAULT_MAX_BYTES_BEFORE_TAIL = 64 * 1024 * 1024
const DEFAULT_TAIL_BYTES = 32 * 1024 * 1024

/**
 * Mimari §9.3'ün örnek listesiyle tutarlı "tanınan" tipler. Bunların dışındaki her `type`
 * (`agent-setting`, `queue-operation`, `attachment`, `last-prompt`, `atis-latch`, `mode`,
 * `permission-mode`, `file-history-snapshot`, `bridge-session`, `custom-title`, … — 2026-09-09'da
 * bu makinede gerçek dosyalarda gözlemlendi, `docs/wiki/pages/desen/claude-transcript-formati.md`)
 * ASLA hataya düşürmez, yalnızca `unknown_type_lines`'a sayılır ve atlanır.
 */
const RECOGNIZED_TYPES = new Set(['user', 'assistant', 'system', 'summary'])

export interface TranscriptUsageTotals {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

export interface TranscriptReadResult {
  file_path: string
  lines_ok: number
  lines_bad: number
  unknown_type_lines: number
  /**
   * `lines_bad > 0` VEYA kuyruk kırpmasında satır sınırı hiç bulunamadığı için verinin TAMAMI
   * kayboldu (T5 — dürüst bozulma bayrağı, sessiz kısmi/tam başarı yok; QA U4/B5 düzeltmesi).
   */
  degraded: boolean
  /** Dosyanın kendisi hiç açılamadıysa (ENOENT/EPERM/…) true; diğer tüm sayaçlar 0 kalır. */
  file_read_failed: boolean
  /**
   * F-011 QA düzeltme turu (Z4/Ö3) — dosya `DEFAULT_MAX_BYTES_BEFORE_TAIL`'i AŞTIĞI için yalnızca
   * kuyruk okunduysa `true` (satır sınırı bulunsa da bulunmasa da — `dataLostNoLineBoundary`
   * yalnızca "kuyruğun TAMAMI da kayboldu" alt durumunu işaretler, bu alan "dosyanın BAŞI kesildi"
   * genel durumunu işaretler). Önceki davranış: normal kırpmada (satır sınırı bulunduğunda)
   * `degraded` hep `false` kalıyordu — QA 70 MB'lık gerçek bir dosyada verinin %54,4'ünün sessizce
   * düştüğünü ölçtü, hiçbir sinyal yoktu. Bu alan `degraded`'i DEĞİŞTİRMEZ (F-010/Thread'in mevcut
   * per-dosya rozeti bozulmasın diye) — yalnızca F-011'in toplam raporuna taşınır.
   */
  truncated: boolean
  usage: TranscriptUsageTotals
}

function emptyUsage(): TranscriptUsageTotals {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  }
}

function emptyResult(filePath: string, fileReadFailed: boolean): TranscriptReadResult {
  return {
    file_path: filePath,
    lines_ok: 0,
    lines_bad: 0,
    unknown_type_lines: 0,
    degraded: fileReadFailed,
    file_read_failed: fileReadFailed,
    truncated: false,
    usage: emptyUsage(),
  }
}

/** `value` sonlu bir sayıysa onu, değilse 0 döner — bozuk/eksik `usage` alanları asla NaN sızdırmaz. */
function toFiniteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Dosyanın ilgili baytlarını okur. Küçük dosyalarda tamamı; `maxBytesBeforeTail`'i aşan
 * dosyalarda yalnızca son `tailBytes` (ilk (muhtemelen kesik) satır atılarak satır sınırına
 * hizalanır) — ADR-007 §9.4. `maxBytesBeforeTail`/`tailBytes` yalnızca testler için enjekte
 * edilebilir; üretimde varsayılanlar kullanılır.
 *
 * Bilinçli olarak yalnızca `fs.readFileSync` kullanır — fd tabanlı kısmi okuma (dosya tanıtıcısı
 * açıp belirli bir konumdan okuyup kapatma) KULLANILMAZ, çünkü bu depoda tüm düşük seviyeli fd
 * erişimi `write-gate.ts`'e ayrılmıştır ve `tests/no-write-gate-bypass.test.ts` (dosya
 * sahipliğimiz dışı) bu tür çağrıları statik olarak TÜM `src/**` için yasaklar. Dosya tamamı
 * okunup baytlar bellekte kırpılır — gerçek
 * transkriptlerin gözlemlenen boyutu (≤ ~10 MB, 2026-09-09) için maliyeti önemsizdir; 64 MB+
 * bir dosyada bile tek seferlik bir `readFileSync` işlem sınırını aşmaz, yalnızca işlenen metin
 * kuyruğa kırpılır (ADR-007'nin "yalnızca son 32 MB işlenir" niyeti korunur).
 */
interface RelevantTextResult {
  text: string
  /**
   * QA düzeltme turu (U4, B5) — kuyruk kırpması sırasında satır sınırı BULUNAMAZSA (tüm kuyruk
   * tek bir newline'sız blok), önceki davranış `''` dönüp `degraded:false` ile "sağlıklı, hiç
   * sorun yok" diyordu — oysa dosyanın TAMAMI sessizce kayboluyordu. Bu bayrak `readTranscript`'e
   * bu veri kaybını dürüstçe bildirmesi için taşınır (T5 — sessiz kısmi/tam başarısızlık yok).
   */
  dataLostNoLineBoundary: boolean
  /** F-011 QA düzeltme turu (Z4/Ö3) — dosya eşiği aştığı için kuyruk kırpması UYGULANDI mı
   *  (satır sınırı bulunsa da, `dataLostNoLineBoundary:false` kalsa da) — dosyanın BAŞININ
   *  sessizce düştüğünü işaretler. */
  truncated: boolean
}

function readRelevantText(
  filePath: string,
  maxBytesBeforeTail: number,
  tailBytes: number
): RelevantTextResult {
  const buffer = fs.readFileSync(filePath)
  if (buffer.length <= maxBytesBeforeTail) {
    return { text: buffer.toString('utf8'), dataLostNoLineBoundary: false, truncated: false }
  }
  const start = Math.max(0, buffer.length - tailBytes)
  const tail = buffer.subarray(start)
  const newlineIndex = tail.indexOf(0x0a)
  if (newlineIndex === -1) return { text: '', dataLostNoLineBoundary: true, truncated: true }
  return {
    text: tail.subarray(newlineIndex + 1).toString('utf8'),
    dataLostNoLineBoundary: false,
    truncated: true,
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Tek bir `.jsonl` transkript dosyasını best-effort okur. Satır bazlı `try/catch`: bozuk bir
 * satır yalnızca `lines_bad`'ı artırır, dosyanın geri kalanının okunmasını ENGELLEMEZ. Dosyanın
 * kendisi açılamazsa (ENOENT/EPERM/dizinse) throw ETMEZ, `file_read_failed:true` döner.
 */
export function readTranscript(
  filePath: string,
  options: { maxBytesBeforeTail?: number; tailBytes?: number } = {}
): TranscriptReadResult {
  const maxBytesBeforeTail = options.maxBytesBeforeTail ?? DEFAULT_MAX_BYTES_BEFORE_TAIL
  const tailBytes = options.tailBytes ?? DEFAULT_TAIL_BYTES

  let text: string
  let dataLostNoLineBoundary = false
  let truncated = false
  try {
    const relevant = readRelevantText(filePath, maxBytesBeforeTail, tailBytes)
    text = relevant.text
    dataLostNoLineBoundary = relevant.dataLostNoLineBoundary
    truncated = relevant.truncated
  } catch {
    return emptyResult(filePath, true)
  }

  text = stripBom(text)
  const rawLines = text.split('\n')

  let linesOk = 0
  let linesBad = 0
  let unknownTypeLines = 0
  const usage = emptyUsage()
  // F-011 QA düzeltme turu (Z1, BLOKLAYICI B1) — Claude Code tek bir asistan yanıtını BİRDEN
  // FAZLA `type:"assistant"` satırı olarak yazar (her içerik bloğu — text/thinking/tool_use —
  // kendi satırı), ve HER satır aynı, TAM `message.usage` nesnesini taşır (aynı `message.id`,
  // aynı üst-seviye `requestId`). Bu okuyucu her satırın `usage`'ını topladığı için tek bir gerçek
  // API çağrısı 2-3 kez sayılıyordu (QA ölçtü: gerçek veride +%101,3 şişme,
  // `docs/wiki/pages/desen/claude-transcript-formati.md`). Aynı `message.id`+`requestId` çiftini
  // taşıyan satırlardan yalnızca İLKİ sayılır. İkisinden biri eksik/boş ise (eski/bilinmeyen
  // biçim) satır ASLA başka bir satırla tekilleştirilmez — güvenli varsayılan HER ZAMAN SAYMAKTIR
  // (az sayma değil, az riskli olan fazla sayma yönünde hataya düşmemek için — ama aynı anahtar
  // ikinci kez görülünce artık "fazla sayma" riskinden kaçınmak öncelikli, çünkü QA'nın ölçtüğü
  // gerçek hata zaten bu yöndeydi).
  const seenResponseKeys = new Set<string>()

  for (const rawLine of rawLines) {
    // CRLF: sondaki `\r`'ı at. Boş satır (dosya sonu `\n` veya tamamen boş dosya): sessizce atla,
    // ne `lines_ok` ne `lines_bad` sayılır (JSONL'de kayıp veri değil, biçim gürültüsü).
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (line.trim() === '') continue

    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      linesBad += 1
      continue
    }
    linesOk += 1

    if (parsed === null || typeof parsed !== 'object') {
      unknownTypeLines += 1
      continue
    }
    const record = parsed as Record<string, unknown>
    const type = typeof record.type === 'string' ? record.type : undefined
    if (type === undefined || !RECOGNIZED_TYPES.has(type)) {
      unknownTypeLines += 1
      continue
    }

    if (type === 'assistant') {
      const message = record.message
      const messageId =
        message !== null && typeof message === 'object'
          ? (message as Record<string, unknown>).id
          : undefined
      const requestId = record.requestId
      const responseKey =
        typeof messageId === 'string' &&
        messageId !== '' &&
        typeof requestId === 'string' &&
        requestId !== ''
          ? `${messageId} ${requestId}`
          : undefined
      const alreadyCounted = responseKey !== undefined && seenResponseKeys.has(responseKey)
      if (responseKey !== undefined) seenResponseKeys.add(responseKey)

      const rawUsage =
        message !== null && typeof message === 'object'
          ? (message as Record<string, unknown>).usage
          : undefined
      if (rawUsage !== null && typeof rawUsage === 'object' && !alreadyCounted) {
        const u = rawUsage as Record<string, unknown>
        usage.input_tokens += toFiniteNumber(u.input_tokens)
        usage.output_tokens += toFiniteNumber(u.output_tokens)
        usage.cache_creation_input_tokens += toFiniteNumber(u.cache_creation_input_tokens)
        usage.cache_read_input_tokens += toFiniteNumber(u.cache_read_input_tokens)
      }
    }
  }

  return {
    file_path: filePath,
    lines_ok: linesOk,
    lines_bad: linesBad,
    unknown_type_lines: unknownTypeLines,
    degraded: linesBad > 0 || dataLostNoLineBoundary,
    file_read_failed: false,
    truncated,
    usage,
  }
}

// ---------------------------------------------------------------------------------------------
// Yol toplama + en küçük yetki çiti (T3/T4)
// ---------------------------------------------------------------------------------------------

/**
 * Bilinen, ÖNCEDEN GÜVENİLEN bir proje kökünü (`ProjectRecord.path` gibi zaten doğrulanmış bir
 * mutlak yol) `~/.claude/projects/<kodlanmış>` dizin adına çevirir (ADR-007 §9.1: sürücü iki
 * noktası ve yol ayraçları `-` olur). Kullanıcıdan gelen serbest metni AYRIŞTIRMAZ — yalnızca
 * bilinen bir yolu üretir, bu yüzden regex değil basit karakter eşlemesi yeterli ve daha güvenli.
 */
export function encodeProjectDirName(absoluteProjectPath: string): string {
  let out = ''
  for (const ch of absoluteProjectPath) {
    out += ch === ':' || ch === '\\' || ch === '/' ? '-' : ch
  }
  return out
}

/**
 * T3 — YEDEK yol. `transcript_path`'in birincil kaynak olduğu (`docs/02-architecture.md` §9.2)
 * senaryolar dışında, panel kurulmadan önceki oturumları bulmak için kullanılır. Windows'ta dizin
 * adı kodlaması harf duyarsız gözlemlendi (ADR-007 §9.1) — eşleştirme buna göre harf duyarsızdır.
 * Yalnızca `allowedProjectPaths`'e karşılık gelen dizinleri döner (en küçük yetki burada da
 * geçerlidir — bu fonksiyon asla izlenmeyen bir projenin dizinini döndürmez).
 */
export function findAllowedTranscriptDirectories(
  claudeProjectsRoot: string,
  allowedProjectPaths: readonly string[]
): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(claudeProjectsRoot, { withFileTypes: true })
  } catch {
    return []
  }
  const encodedAllowed = new Set(
    allowedProjectPaths.map((p) => encodeProjectDirName(p).toLowerCase())
  )
  const matches: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (encodedAllowed.has(entry.name.toLowerCase())) {
      matches.push(path.join(claudeProjectsRoot, entry.name))
    }
  }
  return matches
}

export type TranscriptGuardRejectReason =
  'path-invalid' | 'not-found' | 'symlink' | 'outside-root' | 'not-allowed'

export type TranscriptGuardResult =
  { ok: true; targetPath: string } | { ok: false; reason: TranscriptGuardRejectReason }

/**
 * T4 — en küçük yetki. `candidatePath` (üretimde bir hook olayının `transcript_path` alanından
 * gelir) `claudeProjectsRoot` altında VE `allowedProjectPaths`'ten birinin kodlanmış dizini
 * içinde değilse reddedilir. Desen `src/features/kanban/server/read-guard.ts`'in (F-013)
 * KANITLANMIŞ okuma-guard deseninin uyarlamasıdır: `node:path` + `fs.realpathSync.native` +
 * `path.relative` kapsama kontrolü + symlink savunması. Elle yol regex/replace YOK.
 * `read-guard.ts`'in kendisi bu dosyadan import EDİLMEZ/DEĞİŞTİRİLMEZ — desen bilinçli olarak
 * tekrarlanır (Karpathy §2: tek tüketicili soyutlama yaratma).
 */
export function resolveAllowedTranscriptPath(
  claudeProjectsRoot: string,
  allowedProjectPaths: readonly string[],
  candidatePath: string
): TranscriptGuardResult {
  if (!path.isAbsolute(candidatePath)) return { ok: false, reason: 'path-invalid' }
  if (!fs.existsSync(claudeProjectsRoot)) return { ok: false, reason: 'path-invalid' }

  const relFromRootRaw = path.relative(claudeProjectsRoot, candidatePath)
  if (relFromRootRaw === '' || relFromRootRaw.startsWith('..') || path.isAbsolute(relFromRootRaw)) {
    return { ok: false, reason: 'outside-root' }
  }

  // Son segment HARİÇ tüm ata dizinler symlink olmamalı (son segment aşağıda ayrı kontrol edilir).
  const segments = relFromRootRaw.split(path.sep)
  let ancestor = claudeProjectsRoot
  for (let i = 0; i < segments.length - 1; i++) {
    ancestor = path.join(ancestor, segments[i] ?? '')
    if (!fs.existsSync(ancestor)) return { ok: false, reason: 'not-found' }
    if (fs.lstatSync(ancestor).isSymbolicLink()) return { ok: false, reason: 'symlink' }
  }

  if (!fs.existsSync(candidatePath)) return { ok: false, reason: 'not-found' }
  if (fs.lstatSync(candidatePath).isSymbolicLink()) return { ok: false, reason: 'symlink' }

  const resolved = fs.realpathSync.native(candidatePath)
  const relFromRoot = path.relative(claudeProjectsRoot, resolved)
  if (relFromRoot === '' || relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
    return { ok: false, reason: 'outside-root' }
  }

  const firstSegment = relFromRoot.split(path.sep)[0] ?? ''
  const encodedAllowed = new Set(
    allowedProjectPaths.map((p) => encodeProjectDirName(p).toLowerCase())
  )
  if (!encodedAllowed.has(firstSegment.toLowerCase())) {
    return { ok: false, reason: 'not-allowed' }
  }

  return { ok: true, targetPath: resolved }
}

export type TranscriptAccessResult =
  { ok: true; result: TranscriptReadResult } | { ok: false; reason: TranscriptGuardRejectReason }

/**
 * Guard + okuyucuyu birleştiren TEK giriş noktası. F-010/F-011'in `readTranscript`'i DOĞRUDAN
 * çağırmak yerine bunu çağırması beklenir — guard'ı atlamayı imkânsız kılar (en küçük yetki,
 * çağıranın disiplinine güvenmez).
 */
export function readAllowedTranscript(
  claudeProjectsRoot: string,
  allowedProjectPaths: readonly string[],
  candidatePath: string
): TranscriptAccessResult {
  const guard = resolveAllowedTranscriptPath(claudeProjectsRoot, allowedProjectPaths, candidatePath)
  if (!guard.ok) return { ok: false, reason: guard.reason }
  return { ok: true, result: readTranscript(guard.targetPath) }
}

// ---------------------------------------------------------------------------------------------
// `/api/health` sayaçları (T5)
// ---------------------------------------------------------------------------------------------

export interface TranscriptReaderStats {
  files_seen: number
  lines_ok: number
  lines_bad: number
}

export interface TranscriptReaderStatsTracker {
  record(result: Pick<TranscriptReadResult, 'lines_ok' | 'lines_bad'>): void
  getStats(): TranscriptReaderStats
}

/**
 * `src/server/index.ts`'in `createServer()` içinde (diğer `store`/`hub`/`projectsService`
 * fabrikalarıyla aynı desende) bir kez oluşturup `handleHealth`'e enjekte etmesi için. Bu turda
 * hiçbir üretim kodu `.record()`'u ÇAĞIRMIYOR (Thread/Token uçları F-010/F-011'de gelecek) — bu
 * yüzden `/api/health.transcript_reader` bu turda dürüstçe sıfır kalır; sessizce uydurulmuş bir
 * sayı değil, "henüz hiç okuma tetiklenmedi" gerçeğinin kendisi.
 */
export function createTranscriptReaderStatsTracker(): TranscriptReaderStatsTracker {
  let filesSeen = 0
  let linesOk = 0
  let linesBad = 0
  return {
    record(result) {
      filesSeen += 1
      linesOk += result.lines_ok
      linesBad += result.lines_bad
    },
    getStats() {
      return { files_seen: filesSeen, lines_ok: linesOk, lines_bad: linesBad }
    },
  }
}
