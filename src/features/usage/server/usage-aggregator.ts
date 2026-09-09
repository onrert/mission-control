import fs from 'node:fs'
import path from 'node:path'
import {
  findAllowedTranscriptDirectories,
  readAllowedTranscript,
} from '../../thread/server/transcript-reader'
import type {
  TokenUsageTotals,
  UsageAgentTotal,
  UsageDayTotal,
  UsageProjectTotal,
  UsageReport,
  UsageSessionTotal,
} from '../../../shared/types'

/**
 * F-011 sözleşmesi §1 — `docs/decisions/ADR-007-…` karar 3 + `docs/features/
 * F-011-token-kullanimi.md`. **W1/Y1 — ikinci bir dosya-okuma/yol-guard yolu KURULMAZ:**
 * dosya bulma + yol guard'ı + satır ayrıştırma + `degraded` hesaplaması TAMAMEN F-009'un
 * `transcript-reader.ts`'inden (`findAllowedTranscriptDirectories`/`readAllowedTranscript`)
 * gelir. Bu dosyanın KENDİ `fs` çağrıları yalnızca üç amaç için: (a) proje dizini altındaki üst
 * düzey `.jsonl` + oturum alt dizinlerini LİSTELEMEK (okuma-guard değil, F-010'un
 * `buildTranscriptSection`'ının zaten yaptığı `fs.readdirSync` deseni), (b) `subagents/*.jsonl`
 * dosyasının kardeş `.meta.json`'ını okumak (path traversal riski yok — sabit uzantı değişimi,
 * dosya zaten guard'dan geçmiş bir dizinde), (c) `fs.statSync` (gün türetmek için `mtime`) ve
 * kökün var/okunabilir olduğunu tek seferde doğrulamak (AC2/Y8 — "kaynak okunamadı" sinyali).
 *
 * Ağ isteği YOK (AC4/Y3) — bu dosya yalnızca `node:fs`/`node:path` import eder.
 */

export interface UsageProjectInput {
  id: string
  label: string
  path: string
}

const MAIN_SESSION_AGENT_LABEL = 'ana oturum'
const UNKNOWN_AGENT_LABEL = 'bilinmiyor'

/**
 * ADR-007 "oran düşerse UI uyarısı gösterir" azaltımı — burada Thread'in (F-010) PER-DOSYA
 * `degraded` bayrağının aksine bir YÜZDE eşiği kullanılır, çünkü tek bir ekranda YÜZLERCE dosya
 * toplanır; tek bir bozuk satır her seferinde uyarı göstermek gürültü üretir.
 *
 * Bu, İKİ BAĞIMSIZ sinyaldir (F-011 QA düzeltme turu 2, AA3, BLOKLAYICI — önceki tur ikisini TEK
 * bir eşikte birleştirmişti ve gerçek veride HER ZAMAN tetikleniyordu):
 *
 * 1. **Bozuk JSON oranı** (`lines_bad`) — `readTranscript` bir satırı ayrıştıramadı. Gerçek veride
 *    HİÇ gözlenmedi (2026-09-09 taraması, 22.663 satır); eşik yalnızca GERÇEK bir bozulmada
 *    tetiklenecek kadar sıkı bırakıldı (%1).
 * 2. **"Tanınan" tip oranı** (`unknown_type_lines`) — reader'ın "tanınan" kümesi (`user`/
 *    `assistant`/`system`/`summary`, `transcript-reader.ts`) yalnızca USAGE ÇIKARIMI için
 *    yeterlidir; TÜM geçerli/normal satır tiplerini KAPSAMAZ. QA'nın gerçek veri taramasında
 *    (`docs/wiki/pages/desen/claude-transcript-formati.md`) normal transkriptlerin **%33,8'i**
 *    reader'ın tanımadığı ama **bilinen ve normal** tiplerdir (`attachment`, `queue-operation`,
 *    `agent-setting`, …) — eski %99 eşiği bu YÜZDEN gerçek veride HER ZAMAN tetikleniyordu (oran
 *    ~%66,2, hiçbir zaman %99'a ulaşmıyor). Bu ekran `transcript-reader.ts`'in "tanınan" kümesini
 *    GENİŞLETEMEZ (o dosya bu feature'ın sahipliği dışında, F-009/F-010'a ait) ve satır-tip
 *    dökümünü tekrar okuyamaz (W1/Y1 — ikinci bir satır-ayrıştırıcı yasak). Bu yüzden eşik, gerçek
 *    taban oranın (~%66,2) BELİRGİN ALTINA, ama TAM format değişiminin (oran → 0, Z4/Ö1 testi)
 *    ÜSTÜNE kalibre edildi — normal veri geçer, gerçek bir format kayması hâlâ yakalanır.
 */
const PARSE_FAILURE_WARNING_THRESHOLD = 0.01
const RECOGNIZED_TYPE_RATIO_WARNING_THRESHOLD = 0.5

function emptyUsage(): TokenUsageTotals {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  }
}

function addUsage(a: TokenUsageTotals, b: TokenUsageTotals): TokenUsageTotals {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_creation_input_tokens: a.cache_creation_input_tokens + b.cache_creation_input_tokens,
    cache_read_input_tokens: a.cache_read_input_tokens + b.cache_read_input_tokens,
  }
}

/** F-011 §1 madde 3 — gün, dosyanın kendi `mtime`'ının takvim günüdür (satır-bazlı zaman damgası
 *  DEĞİL, gerekçe sözleşmede: ikinci bir satır-ayrıştırıcı W1'i ihlal ederdi). */
function dayFromMtime(mtimeMs: number): string {
  return new Date(mtimeMs).toISOString().slice(0, 10)
}

/**
 * `subagents/agent-<id>.jsonl`'ın kardeş `agent-<id>.meta.json`'ını okur. Y2 — meta.json yok,
 * bozuk, veya `agentType` alanı yoksa/boşsa DÜRÜSTÇE `"bilinmiyor"` döner; ASLA uydurma/tahmin
 * yapmaz.
 */
function readMetaAgentType(jsonlPath: string): string {
  const metaPath = `${jsonlPath.slice(0, -'.jsonl'.length)}.meta.json`
  try {
    const raw = fs.readFileSync(metaPath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object') {
      const agentType = (parsed as Record<string, unknown>).agentType
      if (typeof agentType === 'string' && agentType.trim() !== '') return agentType
    }
  } catch {
    // yut — dosya yok/bozuk/izin hatası: dürüstçe "bilinmiyor" (Y2, uydurma yok).
  }
  return UNKNOWN_AGENT_LABEL
}

interface FileUsageRecord {
  day: string
  sessionId: string
  agent: string
  usage: TokenUsageTotals
  lines_ok: number
  lines_bad: number
  unknown_type_lines: number
  truncated: boolean
}

/**
 * F-011 QA düzeltme turu 2 (AA2, BLOKLAYICI) — `resolveAllowedTranscriptPath`'in (guard,
 * `transcript-reader.ts`) SARILMAMIŞ `fs.existsSync`/`fs.lstatSync`/`fs.realpathSync.native`
 * çağrıları gerçek bir erişim reddinde (Windows `icacls /deny "(RA,RD,RX)"` gibi) EPERM/EACCES/
 * EBUSY fırlatır. Bu KALICI bir erişim hatasıdır — dosyanın kendisi listelenirken görüldü, guard
 * onu OKUYAMADI, "bulunamadı" (`not-allowed`/`not-found` guard reddi) veya yarış durumu
 * (ör. dosya listelendikten SONRA silindi → ENOENT) DEĞİL. QA'nın ölçtüğü hata: eskiden bu üç kod
 * da diğer TÜM exception'larla (yarış durumu dahil) aynı `catch`'e düşüp sessizce
 * `{ unreadable: false }` dönüyordu — %94'e varan token kaybı hiçbir sayaca yansımıyordu.
 */
function isPersistentAccessError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as NodeJS.ErrnoException).code
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY'
}

/** F-011 QA düzeltme turu (Z4) — bir dosyanın işlenme sonucu: ya bir kayıt üretti, ya da
 *  GERÇEKTEN okunamadı (Ö2 — `file_read_failed:true`, guard'dan geçtikten SONRA, VEYA AA2 —
 *  guard'ın kendisi kalıcı bir erişim hatasıyla fırladı). Guard reddi (`access.ok===false`) VE
 *  gerçek bir yarış durumu (stat/lstat ENOENT — Y8'in kabul ettiği TOCTOU) bu sayaca dahil DEĞİL —
 *  ikisi de "gerçek bir okuma hatası" değil, best-effort atlama olarak kalır. */
function appendRecordIfReadable(
  records: FileUsageRecord[],
  claudeProjectsRoot: string,
  projectPath: string,
  filePath: string,
  sessionId: string,
  agent: string
): { unreadable: boolean } {
  let mtimeMs: number
  try {
    mtimeMs = fs.statSync(filePath).mtimeMs
  } catch {
    return { unreadable: false } // listelendi ama stat başarısız (yarış durumu) — best-effort atla
  }
  let access: ReturnType<typeof readAllowedTranscript>
  try {
    access = readAllowedTranscript(claudeProjectsRoot, [projectPath], filePath)
  } catch (error) {
    // AA2 — kalıcı erişim reddi (EPERM/EACCES/EBUSY) artık sayılır; gerçek yarış durumu
    // (ör. ENOENT) eskisi gibi sessizce atlanır.
    return { unreadable: isPersistentAccessError(error) }
  }
  if (!access.ok) return { unreadable: false }
  if (access.result.file_read_failed) return { unreadable: true } // Ö2 — gerçek okuma hatası
  records.push({
    day: dayFromMtime(mtimeMs),
    sessionId,
    agent,
    usage: access.result.usage,
    lines_ok: access.result.lines_ok,
    lines_bad: access.result.lines_bad,
    unknown_type_lines: access.result.unknown_type_lines,
    truncated: access.result.truncated,
  })
  return { unreadable: false }
}

interface CollectFileRecordsResult {
  records: FileUsageRecord[]
  unreadableFileCount: number
}

/** Tek bir izlenen projenin TÜM (ana oturum + subagent) dosyalarını best-effort tarar. */
function collectFileRecords(
  claudeProjectsRoot: string,
  projectPath: string
): CollectFileRecordsResult {
  const records: FileUsageRecord[] = []
  let unreadableFileCount = 0

  let dirs: string[]
  try {
    dirs = findAllowedTranscriptDirectories(claudeProjectsRoot, [projectPath])
  } catch {
    return { records, unreadableFileCount }
  }
  if (dirs.length === 0) return { records, unreadableFileCount }
  const dir = dirs[0]!

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return { records, unreadableFileCount }
  }

  // Ana oturum dosyaları: doğrudan proje dizininde `<session-uuid>.jsonl`.
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue
    const full = path.join(dir, entry.name)
    const sessionId = entry.name.slice(0, -'.jsonl'.length)
    const outcome = appendRecordIfReadable(
      records,
      claudeProjectsRoot,
      projectPath,
      full,
      sessionId,
      MAIN_SESSION_AGENT_LABEL
    )
    if (outcome.unreadable) unreadableFileCount += 1
  }

  // Subagent dosyaları: `<session-uuid>/subagents/agent-<id>.jsonl` + kardeş `.meta.json`.
  // `<session-uuid>/` dışındaki alt dizinler (ör. `memory`, araç sonucu dizinleri — bu makinede
  // gözlendi) `subagents/` alt dizini TAŞIMADIĞI için `readdirSync` throw eder ve sessizce atlanır.
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const subagentsDir = path.join(dir, entry.name, 'subagents')
    let subEntries: fs.Dirent[]
    try {
      subEntries = fs.readdirSync(subagentsDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const subEntry of subEntries) {
      if (!subEntry.isFile() || !subEntry.name.endsWith('.jsonl')) continue
      const full = path.join(subagentsDir, subEntry.name)
      const agent = readMetaAgentType(full)
      const outcome = appendRecordIfReadable(
        records,
        claudeProjectsRoot,
        projectPath,
        full,
        entry.name,
        agent
      )
      if (outcome.unreadable) unreadableFileCount += 1
    }
  }

  return { records, unreadableFileCount }
}

/** Kök dizinin en azından listelenip yeniden okunabildiğini tek seferde doğrular. Y8 — "bulunamadı"
 *  (`existsSync=false`) ile "fırlattı" (`readdirSync` throw, ör. EPERM) AYRI koşullardır, ikisi de
 *  aynı `source_unreadable:true` sonucuna düşer ama ayrı testlerle kanıtlanır. */
function isSourceUnreadable(claudeProjectsRoot: string): boolean {
  if (!fs.existsSync(claudeProjectsRoot)) return true
  try {
    fs.readdirSync(claudeProjectsRoot)
    return false
  } catch {
    return true
  }
}

export function computeUsageReport(
  claudeProjectsRoot: string,
  projects: readonly UsageProjectInput[]
): UsageReport {
  const sourceUnreadable = isSourceUnreadable(claudeProjectsRoot)

  const projectTotals: UsageProjectTotal[] = []
  let grandUsage = emptyUsage()
  let linesOk = 0
  let linesBad = 0
  let unknownTypeLines = 0
  let unreadableFileCount = 0
  let truncatedFileCount = 0

  if (!sourceUnreadable) {
    for (const project of projects) {
      const { records, unreadableFileCount: projectUnreadableCount } = collectFileRecords(
        claudeProjectsRoot,
        project.path
      )
      unreadableFileCount += projectUnreadableCount
      if (records.length === 0) continue

      let projectUsage = emptyUsage()
      // gün -> oturum -> agent -> toplam
      const dayMap = new Map<string, Map<string, Map<string, TokenUsageTotals>>>()

      for (const rec of records) {
        linesOk += rec.lines_ok
        linesBad += rec.lines_bad
        unknownTypeLines += rec.unknown_type_lines
        if (rec.truncated) truncatedFileCount += 1
        projectUsage = addUsage(projectUsage, rec.usage)
        grandUsage = addUsage(grandUsage, rec.usage)

        let sessionMap = dayMap.get(rec.day)
        if (!sessionMap) {
          sessionMap = new Map()
          dayMap.set(rec.day, sessionMap)
        }
        let agentMap = sessionMap.get(rec.sessionId)
        if (!agentMap) {
          agentMap = new Map()
          sessionMap.set(rec.sessionId, agentMap)
        }
        agentMap.set(rec.agent, addUsage(agentMap.get(rec.agent) ?? emptyUsage(), rec.usage))
      }

      const days: UsageDayTotal[] = Array.from(dayMap.entries())
        .map(([day, sessionMap]) => {
          let dayUsage = emptyUsage()
          const sessions: UsageSessionTotal[] = Array.from(sessionMap.entries())
            .map(([sessionId, agentMap]) => {
              let sessionUsage = emptyUsage()
              const agents: UsageAgentTotal[] = Array.from(agentMap.entries())
                .map(([agent, usage]) => {
                  sessionUsage = addUsage(sessionUsage, usage)
                  return { agent, usage }
                })
                .sort((a, b) => a.agent.localeCompare(b.agent))
              dayUsage = addUsage(dayUsage, sessionUsage)
              return { session_id: sessionId, agents, usage: sessionUsage }
            })
            .sort((a, b) => a.session_id.localeCompare(b.session_id))
          return { day, sessions, usage: dayUsage }
        })
        .sort((a, b) => a.day.localeCompare(b.day))

      projectTotals.push({
        project_id: project.id,
        project_label: project.label,
        days,
        usage: projectUsage,
      })
    }
  }

  // AA3 (F-011 QA düzeltme turu 2) — iki BAĞIMSIZ sinyal, iki AYRI eşik (yukarıdaki sabitlerin
  // yorumuna bakınız). (1) bozuk JSON — TEK bir bozuk satır bile önemlidir (%1 eşiği, Y5 emsali,
  // yalnızca `linesBad` kullanır, `unknownTypeLines` KARIŞTIRILMAZ). (2) "tanınan" tip oranı —
  // yalnızca GEÇERLİ JSON satırları arasında (`linesOk`) hesaplanır, gerçek verideki normal ~%34
  // "diğer tip" tabanını (ADR-007/wiki) yanlış alarma çevirmeyecek şekilde kalibre edilmiştir.
  const totalLines = linesOk + linesBad
  const parseFailureDegraded =
    totalLines > 0 && linesBad / totalLines > PARSE_FAILURE_WARNING_THRESHOLD
  const recognizedTypeRatio = linesOk > 0 ? (linesOk - unknownTypeLines) / linesOk : 1
  const recognitionDegraded =
    linesOk > 0 && recognizedTypeRatio < RECOGNIZED_TYPE_RATIO_WARNING_THRESHOLD
  // Z4/Ö2 (okunamayan dosya) VE Z4/Ö3 (32 MB kuyruk kırpması) de birer sessiz veri kaybı
  // sınıfıdır — ikisi de tek başına `degraded:true`'yu tetikler (sessiz kısmi başarı yok,
  // `CLAUDE.md`'nin en pahalı hata sınıfı).
  const degraded =
    parseFailureDegraded || recognitionDegraded || unreadableFileCount > 0 || truncatedFileCount > 0

  return {
    projects: projectTotals,
    usage: grandUsage,
    lines_ok: linesOk,
    lines_bad: linesBad,
    unknown_type_lines: unknownTypeLines,
    unreadable_file_count: unreadableFileCount,
    truncated_file_count: truncatedFileCount,
    degraded,
    source_unreadable: sourceUnreadable,
  }
}
