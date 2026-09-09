import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveInsideRootForRead } from '../../kanban/server/read-guard'
import { buildFeatureDetail } from '../../kanban/server/feature-detail'
import { parseFeatureCard } from '../../kanban/server/parse-feature'
import {
  findAllowedTranscriptDirectories,
  readAllowedTranscript,
  type TranscriptReaderStatsTracker,
} from './transcript-reader'
import type { ThreadDetail, ThreadSection } from '../../../shared/types'

/**
 * F-010 sözleşmesi §3 — `~/.claude/projects/` köküdür. `MC_CLAUDE_PROJECTS_ROOT` ile test/CI'da
 * gerçek ev dizinine dokunmadan enjekte edilebilir (`resolvePort`/`resolveEnvInt` emsali,
 * `src/server/index.ts`).
 */
export function resolveClaudeProjectsRoot(env: NodeJS.ProcessEnv): string {
  const override = env.MC_CLAUDE_PROJECTS_ROOT
  if (typeof override === 'string' && override.trim() !== '') return override
  return path.join(os.homedir(), '.claude', 'projects')
}

export type ThreadDetailResult =
  | { status: 'ok'; detail: ThreadDetail }
  | { status: 'not_found'; message: string }
  | { status: 'invalid_path'; message: string }

/** `docs/qa/*.md`'nin ilk satırlarındaki `KARAR: GEÇTİ|KALDI` — yalnızca görüntüleme amaçlı. */
function parseVerdict(content: string): 'GEÇTİ' | 'KALDI' | null {
  const match = /^KARAR:\s*(GEÇTİ|KALDI)\s*$/im.exec(content)
  if (!match) return null
  return match[1] === 'KALDI' ? 'KALDI' : 'GEÇTİ'
}

/**
 * `docs/qa/latest.md`'nin bu feature'a mı ait olduğunu belirler (frontmatter `feature:` veya ilk
 * başlıktaki id) — aksi halde başka bir feature'ın ESKALE'si yanlışlıkla gösterilebilir (§3.3).
 */
function isEscalatedFor(latestContent: string, featureId: string): boolean {
  if (!/^ESKALE:\s*true\s*$/im.test(latestContent)) return false
  const frontmatterMatch = /^feature:\s*(\S+)\s*$/im.exec(latestContent)
  if (frontmatterMatch) return frontmatterMatch[1] === featureId
  const headingMatch = /^#\s.*?\b([A-Za-z]+-\d+)\b/m.exec(latestContent)
  if (headingMatch) return headingMatch[1] === featureId
  return false
}

function statMtimeIso(root: string, relativeParts: string[]): string | null {
  const resolved = resolveInsideRootForRead(root, relativeParts)
  if (!resolved.ok) return null
  try {
    return new Date(fs.statSync(resolved.targetPath).mtimeMs).toISOString()
  } catch {
    return null
  }
}

function unreadableTranscriptSection(): ThreadSection {
  return {
    kind: 'transcript',
    title: 'Transkript',
    timestamp: null,
    content: null,
    readable: false,
  }
}

/**
 * F-010 sözleşmesi §3.2 — best-effort, TEK bölüm: seçili projenin `~/.claude/projects/
 * <kodlanmış>/` dizinindeki EN SON değiştirilen üst düzey (`subagents/` içinde OLMAYAN) `.jsonl`
 * dosyası. Belirli bir QA turuna eşleme YOK (bilinçli, gerekçe sözleşmede) — bu yüzden bu bölüm
 * her zaman listenin EN SONUNDA, genel bir "en son görülen oturum" notu olarak görünür.
 */
function buildTranscriptSection(
  projectPath: string,
  claudeProjectsRoot: string,
  statsTracker: TranscriptReaderStatsTracker
): ThreadSection {
  let dirs: string[]
  try {
    dirs = findAllowedTranscriptDirectories(claudeProjectsRoot, [projectPath])
  } catch {
    return unreadableTranscriptSection()
  }
  if (dirs.length === 0) return unreadableTranscriptSection()

  const dir = dirs[0]!
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return unreadableTranscriptSection()
  }

  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => {
      const full = path.join(dir, entry.name)
      let mtimeMs = 0
      try {
        mtimeMs = fs.statSync(full).mtimeMs
      } catch {
        mtimeMs = 0
      }
      return { full, mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  if (candidates.length === 0) return unreadableTranscriptSection()
  const latest = candidates[0]!

  const access = readAllowedTranscript(claudeProjectsRoot, [projectPath], latest.full)
  if (!access.ok) return unreadableTranscriptSection()

  // W2 — GERÇEK bir okuma yapıldı, sayaçlara işlenir (`/api/health.transcript_reader`).
  statsTracker.record(access.result)

  if (access.result.file_read_failed) return unreadableTranscriptSection()
  if (access.result.lines_bad > 0) {
    process.stderr.write(
      `Uyarı: transkriptin ${access.result.lines_bad} satırı ayrıştırılamadı (${latest.full}).\n`
    )
  }
  if (access.result.lines_ok === 0) return unreadableTranscriptSection()

  const usage = access.result.usage
  const content =
    `Bu proje için en son görülen oturumda ${usage.input_tokens.toLocaleString('tr-TR')} ` +
    `giriş, ${usage.output_tokens.toLocaleString('tr-TR')} çıkış token ölçüldü. ` +
    `Belirli bir QA turuna bağlı değildir (best-effort zenginleştirme).`

  return {
    kind: 'transcript',
    title: 'Transkript',
    timestamp: new Date(latest.mtimeMs).toISOString(),
    content,
    readable: true,
  }
}

/**
 * F-010 sözleşmesi §3 — saf(a yakın), `buildFeatureDetail` (F-013) + transkript okuyucusunu
 * (F-009) birleştirir. Salt okunur — hiçbir `fs` yazma çağrısı yok
 * (`tests/features/thread/server/thread-read-only-manifest.test.ts`).
 */
export function buildThreadDetail(
  projectPath: string,
  claudeProjectsRoot: string,
  file: string,
  statsTracker: TranscriptReaderStatsTracker
): ThreadDetailResult {
  const bodyResolved = resolveInsideRootForRead(projectPath, ['docs', 'features', file])
  if (!bodyResolved.ok) {
    if (bodyResolved.reason === 'not-found') {
      return { status: 'not_found', message: 'Özellik dosyası bulunamadı.' }
    }
    return { status: 'invalid_path', message: 'Bu dosya izlenen proje kökü dışında, reddedildi.' }
  }

  let buffer: Buffer
  let bodyMtimeMs: number
  try {
    buffer = fs.readFileSync(bodyResolved.targetPath)
    bodyMtimeMs = fs.statSync(bodyResolved.targetPath).mtimeMs
  } catch {
    return { status: 'not_found', message: 'Özellik dosyası okunamadı.' }
  }
  const card = parseFeatureCard(buffer, '', file, bodyMtimeMs)

  const featureDetail = buildFeatureDetail(projectPath, file)
  if (featureDetail.status !== 'ok') {
    return featureDetail
  }

  const sections: ThreadSection[] = []

  if (featureDetail.detail.body.exists && !featureDetail.detail.body.error) {
    sections.push({
      kind: 'ceo_brief',
      title: 'CEO brief',
      timestamp: new Date(bodyMtimeMs).toISOString(),
      content: featureDetail.detail.body.content ?? '',
      readable: true,
    })
  }

  if (featureDetail.detail.contract.exists) {
    const contractContent = featureDetail.detail.contract.content
    const readable = !featureDetail.detail.contract.error && contractContent !== undefined
    sections.push({
      kind: 'developer_report',
      title: 'Developer raporu',
      timestamp: statMtimeIso(projectPath, ['docs', 'qa', `${card.id}-contract.md`]),
      content: readable ? contractContent! : null,
      readable,
    })
  }

  for (const report of featureDetail.detail.qa_reports) {
    const readable = report.exists && !report.error && report.content !== undefined
    const verdict = readable ? parseVerdict(report.content!) : null
    sections.push({
      kind: 'qa_verdict',
      title: verdict ? `QA kararı: ${verdict}` : 'QA kararı',
      timestamp: statMtimeIso(projectPath, ['docs', 'qa', report.file]),
      content: readable ? report.content! : null,
      readable,
      verdict,
    })
  }

  sections.push(buildTranscriptSection(projectPath, claudeProjectsRoot, statsTracker))

  let eskale = false
  const latestResolved = resolveInsideRootForRead(projectPath, ['docs', 'qa', 'latest.md'])
  if (latestResolved.ok) {
    try {
      const latestContent = fs.readFileSync(latestResolved.targetPath, 'utf8')
      eskale = isEscalatedFor(latestContent, card.id)
    } catch {
      eskale = false
    }
  }

  return { status: 'ok', detail: { feature_id: card.id, eskale, sections } }
}
