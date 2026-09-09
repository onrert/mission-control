import fs from 'node:fs'
import path from 'node:path'
import { isExcludedApprovalsEntry, parseGateFileName } from '../shared/gate-id'
import type { GateStatus, GateStatusItem, GatesListResponse } from '../../../shared/types'

// §3 "Durum türetme" — "Her zaman gösterilen" temel katalog, G4 BİLEREK dışarıda (bare `G4`
// diye bir dosya adı sözleşmesi projede yok, yalnızca `G4-<n>.ok` var — dosya varsa görünür).
const BASE_ORDER = ['G0', 'G1', 'G2', 'G3', 'ASSETS', 'G5', 'G6'] as const

// PROCESS.md okunamazsa/tablo bulunamazsa kullanılan gömülü yedek — `docs/PROCESS.md` §2'nin
// G4 HARİÇ diğer yedi satırıyla birebir.
const FALLBACK_LABELS: Record<string, string> = {
  G0: 'Fikir',
  G1: 'PRD',
  G2: 'Mimari',
  G3: 'UX',
  ASSETS: 'Higgsfield kredi bütçesi',
  G5: 'Güvenlik/kalite',
  G6: 'Yayın',
}

interface ProcessLabels {
  labels: Map<string, string>
  readable: boolean
}

/**
 * `docs/PROCESS.md` §2 tablosunun ilk hücresinden id/label türetir (§3 "Etiket türetme").
 * `^(\S+)(?:\s+(.+))?$` — ASSETS gibi tek-kelimelik hücrelerde grup 2 yok, `label = id`.
 */
function readProcessLabels(projectPath: string): ProcessLabels {
  const processPath = path.join(projectPath, 'docs', 'PROCESS.md')
  let content: string
  try {
    content = fs.readFileSync(processPath, 'utf8')
  } catch {
    return { labels: new Map(Object.entries(FALLBACK_LABELS)), readable: false }
  }

  const knownIds = new Set<string>([...BASE_ORDER, 'G4'])
  const labels = new Map<string, string>()
  for (const rawLine of content.split(/\r\n|\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    if (cells[0] === '') cells.shift()
    if (cells[cells.length - 1] === '') cells.pop()
    const firstCell = cells[0]
    if (firstCell === undefined || firstCell === '') continue
    const match = /^(\S+)(?:\s+(.+))?$/.exec(firstCell)
    if (!match) continue
    const id = match[1]!
    if (!knownIds.has(id)) continue
    labels.set(id, match[2] ?? id)
  }

  // Tablo bulunamadı (hiçbir bilinen id eşleşmedi) — PROCESS.md yapısal olarak tanınmıyor.
  if (labels.size === 0) {
    return { labels: new Map(Object.entries(FALLBACK_LABELS)), readable: false }
  }
  // Tablo kısmen bozuksa (bilinen bir temel kapı satırı eksikse) yedek etiketle doldurulur —
  // panel asla çökmez.
  for (const id of BASE_ORDER) {
    if (!labels.has(id)) labels.set(id, FALLBACK_LABELS[id]!)
  }
  return { labels, readable: true }
}

function toDateString(mtimeMs: number): string {
  return new Date(mtimeMs).toISOString().slice(0, 10)
}

interface StatResult {
  stat?: fs.Stats
  failed: boolean
}

function statSafe(filePath: string | undefined): StatResult {
  if (filePath === undefined) return { failed: false }
  try {
    return { stat: fs.statSync(filePath), failed: false }
  } catch {
    return { failed: true }
  }
}

/**
 * Tek bir kapının durumunu diskten canlı hesaplar (§3 "Tek bir kapı için durum" tablosu +
 * "conflict" `mtime` karşılaştırması + "Satır bazlı hata izolasyonu"). `list-gates`'in ve
 * `handlers.ts`'in yazma sonrası "taze durum" ihtiyacının TEK ortak kaynağı.
 */
export function getGateStatus(projectPath: string, gateId: string, label?: string): GateStatusItem {
  const resolvedLabel = label ?? readProcessLabels(projectPath).labels.get(gateId) ?? gateId
  const approvalsDir = path.join(projectPath, 'docs', 'approvals')
  const okPath = path.join(approvalsDir, `${gateId}.ok`)
  const denyPath = path.join(approvalsDir, `${gateId}.deny.md`)

  const ok = statSafe(fs.existsSync(okPath) ? okPath : undefined)
  const deny = statSafe(fs.existsSync(denyPath) ? denyPath : undefined)

  if (ok.failed || deny.failed) {
    // §3 "Satır bazlı hata izolasyonu" — yalnızca bu satır etkilenir, `status` güvenli bir
    // varsayılan (`'pending'`), gerçek anlamı `error:true`'dur ("Durum belirlenemedi").
    return { id: gateId, label: resolvedLabel, status: 'pending', error: true }
  }

  const hasOk = ok.stat !== undefined
  const hasDeny = deny.stat !== undefined

  if (hasOk && hasDeny) {
    const status: GateStatus = 'conflict'
    return {
      id: gateId,
      label: resolvedLabel,
      status,
      ok_date: toDateString(ok.stat!.mtimeMs),
      deny_date: toDateString(deny.stat!.mtimeMs),
      newer_side: ok.stat!.mtimeMs >= deny.stat!.mtimeMs ? 'ok' : 'deny',
    }
  }
  if (hasOk) {
    return {
      id: gateId,
      label: resolvedLabel,
      status: 'approved',
      ok_date: toDateString(ok.stat!.mtimeMs),
    }
  }
  if (hasDeny) {
    return {
      id: gateId,
      label: resolvedLabel,
      status: 'denied',
      deny_date: toDateString(deny.stat!.mtimeMs),
    }
  }
  return { id: gateId, label: resolvedLabel, status: 'pending' }
}

// §3 "Sıralama" — sabit: G0,G1,G2,G3,ASSETS,G4-N (sayısal artan),G5,G6.
const FIXED_ORDER_INDEX: Record<string, number> = {
  G0: 0,
  G1: 1,
  G2: 2,
  G3: 3,
  ASSETS: 4,
  G5: 6,
  G6: 7,
}

function sortKey(id: string): [number, number] {
  const fixed = FIXED_ORDER_INDEX[id]
  if (fixed !== undefined) return [fixed, 0]
  const g4Match = /^G4(?:-(\d+))?$/.exec(id)
  if (g4Match) return [5, g4Match[1] ? Number.parseInt(g4Match[1], 10) : 0]
  // Beklenmeyen bir id (yapısal olarak olmamalı, `discoveredIds` yalnızca GATE dosya deseniyle
  // eşleşenleri ekliyor) — güvenli varsayılan, listenin sonuna gider.
  return [99, 0]
}

/** `GET /api/gates`'in veri katmanı — salt okunur, hiçbir `fs` yazma/silme çağrısı yok (§3). */
export function listGates(projectPath: string): GatesListResponse {
  const { labels, readable } = readProcessLabels(projectPath)
  const approvalsDir = path.join(projectPath, 'docs', 'approvals')

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(approvalsDir, { withFileTypes: true })
  } catch {
    entries = []
  }

  const discoveredIds = new Set<string>(BASE_ORDER)
  const unrecognized: string[] = []

  for (const entry of entries) {
    if (isExcludedApprovalsEntry(entry.name)) continue
    if (entry.isDirectory()) {
      unrecognized.push(entry.name)
      continue
    }
    if (!entry.isFile()) continue
    const parsed = parseGateFileName(entry.name)
    if (!parsed) {
      unrecognized.push(entry.name)
      continue
    }
    discoveredIds.add(parsed.gateId)
  }

  const gates = [...discoveredIds]
    .map((id) => getGateStatus(projectPath, id, labels.get(id) ?? id))
    .sort((a, b) => {
      const [aMajor, aMinor] = sortKey(a.id)
      const [bMajor, bMinor] = sortKey(b.id)
      return aMajor - bMajor || aMinor - bMinor
    })

  return { gates, unrecognized, process_doc_readable: readable }
}
