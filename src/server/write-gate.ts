import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { parse as parseYaml } from 'yaml'

// Yazma kapısı (sözleşme `docs/qa/F-006-contract.md`, ADR-005). İzlenen bir proje köküne
// yazan TEK modül. Genel amaçlı `write(path, content)` YOK — yalnızca dört niyet fonksiyonu
// (`setFeatureStatus`, `writeGateApproval`, `writeGateDenial`, `archiveDenial`) dışa açılır.
// QA KALDI turu (D34/B2): bu dosya `tests/no-write-gate-bypass.test.ts`'te artık DOSYA-seviyesinde
// muaf DEĞİL — üç store dosyasıyla aynı, ÇAĞRI-BİÇİMLİ + DİZGE-SEVİYESİ izinli tam-çağrı kümesiyle
// taranıyor (yalnızca aşağıdaki `atomicWriteOnce`/`archiveDenial`'ın kendi tmp/rename çağrıları
// izinli; hedef dosyayı silen YENİ bir çağrı eklenirse — meşru izinli kümede olmadığı için —
// tarama KIRMIZI verir).

export type WriteResult =
  | { ok: true; path: string; hash?: string }
  | {
      ok: false
      code: 'write_denied' | 'conflict' | 'write_failed' | 'invalid_body'
      message: string
    }

type Operation = 'featureStatus' | 'approval' | 'denial' | 'archive'

// ADR-005 madde 2, adım 5-6'nın çalışma zamanı karşılığı — her işlem yalnızca kendi POSIX
// deseniyle eşleşen bir hedefe yazabilir, hedef daha önce "kök içinde" bulunmuş olsa bile.
// S1 (borç kapatma, `docs/blockers.md` "F-008 kapanışından taşınan iki borç" madde 1): bu üç
// desen `i` bayrağıyla harfe DUYARSIZ. `resolveInsideRoot` adım 5, hedef zaten kanonik-olmayan
// harfle mevcutsa (ör. `g2.ok`) `realpathSync.native` ile gerçek disk adını (küçük harfli) döner
// (adım 4 candidate'i "var" sayar çünkü Windows dosya sistemi harfe duyarsız); `targetPath` o
// zaman küçük harfli olur. `gate` parametresi buraya ulaşmadan ÖNCE zaten `GATE_PATTERN`/
// `isValidGateId` ile kanonik BÜYÜK harfle doğrulanmış olduğundan (bkz. `handlers.ts`
// `isValidGateId(rawDecodedGate)`, aşağıdaki `GATE_PATTERN`) harfe duyarsızlık burada YENİ bir
// giriş yolu açmıyor — yalnızca "aynı dosyanın disk üzerindeki mevcut adı" ile "istenen kanonik
// ad" arasındaki OLMASI GEREKEN eşleşmeyi kabul ediyor (gate-id.ts'teki S2 düzeltmesiyle AYNI
// ilke: küçük/karışık harfli bir onay dosyası normal bir kapı dosyası gibi TANINIR, engellenmez).
const OPERATION_PATTERNS: Record<Operation, RegExp> = {
  featureStatus: /^docs\/features\/[A-Za-z0-9._-]+\.md$/,
  approval: /^docs\/approvals\/(G[0-6](-\d{1,3})?|ASSETS)\.ok$/i,
  denial: /^docs\/approvals\/(G[0-6](-\d{1,3})?|ASSETS)\.deny\.md$/i,
  // R1 düzeltmesi (sözleşme §3 madde 2/6): gerçek `toISOString().replace(/[:.]/g,'-')`
  // çıktısının alfabesiyle (T/Z dahil) harf harf eşleşir (saat/dakika/vs kısmı harfe duyarsızlıktan
  // etkilenmez, yalnızca kapı id'si kısmı `i` ile gevşetildi).
  archive:
    /^docs\/approvals\/archive\/(G[0-6](-\d{1,3})?|ASSETS)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.deny\.md$/i,
}

const FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.md$/
const GATE_PATTERN = /^(G[0-6](-\d{1,3})?|ASSETS)$/

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

type ResolveResult =
  { ok: true; targetPath: string } | { ok: false; code: 'write_denied'; message: string }

/**
 * Ortak dahili yardımcı — symlink savunması + işlem/yol eşleşmesi (sözleşme §3 madde 2).
 * `root`'a güvenmez, yalnızca başlangıç noktası kabul eder; kendi tüm savunmasını koşar.
 * Ayrı bir dosya değil (`path-guard.ts` yok) — tek kullanıcısı bu modülün kendi dört
 * fonksiyonu, ikinci bir tüketici çıkmadan soyutlamak Karpathy §2 ihlali olurdu.
 */
function resolveInsideRoot(
  root: string,
  relativeParts: string[],
  operation: Operation
): ResolveResult {
  try {
    // adım 0 — root mutlak ve dizin değilse burada biter.
    if (!path.isAbsolute(root)) {
      return { ok: false, code: 'write_denied', message: 'Kök yol mutlak değil.' }
    }
    let rootStat: fs.Stats
    try {
      rootStat = fs.statSync(root)
    } catch (err) {
      return { ok: false, code: 'write_denied', message: describeError(err) }
    }
    if (!rootStat.isDirectory()) {
      return { ok: false, code: 'write_denied', message: 'Kök bir dizin değil.' }
    }

    // adım 1
    const candidate = path.join(root, ...relativeParts)

    // adım 2 — hedefin kendisi symlink mi (realpath DEĞİL — realpath symlink'i izler ve
    // deliği tam olarak gizler, bu yüzden lstat kullanılır).
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isSymbolicLink()) {
      return { ok: false, code: 'write_denied', message: 'Hedef bir sembolik bağlantı.' }
    }

    // adım 3 — ata dizinlerin hiçbiri symlink olmamalı (son segment hariç, o adım 2'de
    // kontrol edildi). İlk var-olmayan segmentte döngü durur.
    let ancestorPath = root
    for (let i = 0; i < relativeParts.length - 1; i++) {
      ancestorPath = path.join(ancestorPath, relativeParts[i] ?? '')
      if (!fs.existsSync(ancestorPath)) break
      if (fs.lstatSync(ancestorPath).isSymbolicLink()) {
        return { ok: false, code: 'write_denied', message: 'Bir ata dizin sembolik bağlantı.' }
      }
    }

    // adım 4 — en yakın var olan atayı bul.
    let anc = candidate
    while (!fs.existsSync(anc)) {
      const parent = path.dirname(anc)
      if (parent === anc) {
        return { ok: false, code: 'write_denied', message: 'Kök diske ulaşıldı.' }
      }
      anc = parent
    }

    // adım 5 — yalnızca Windows büyük/küçük harf kanonikleştirmesi; symlink adım 2-3'te
    // zaten elendiği için güvenlik sınırı BURADA değildir.
    const resolvedAnc = fs.realpathSync.native(anc)

    // adım 6 — kök içinde mi (path.relative gerçek segment karşılaştırması yapar, dizge
    // öneki değil — önek tuzağı burada otomatik kapanır).
    const relFromRoot = path.relative(root, resolvedAnc)
    if (relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
      return { ok: false, code: 'write_denied', message: 'Hedef kök dışında.' }
    }

    // adım 7
    const targetPath = path.join(resolvedAnc, path.relative(anc, candidate))

    // adım 8 — işlem/yol eşleşmesi (çalışma zamanı kontrolü, yapısal varsayım değil).
    const posixRel = path.relative(root, targetPath).split(path.sep).join('/')
    if (!OPERATION_PATTERNS[operation].test(posixRel)) {
      return { ok: false, code: 'write_denied', message: 'İşlem, hedef yolla eşleşmiyor.' }
    }

    return { ok: true, targetPath }
  } catch (err) {
    return { ok: false, code: 'write_denied', message: describeError(err) }
  }
}

/**
 * Asenkron bekleme — bu modülün TEK bekleme aracı (ADR-005 madde 5, F-007 sözleşme §3 madde 13
 * T4). Önceki sürüm `Atomics.wait` ile SENKRON bekliyordu; F-006'da kabul edilebilirdi çünkü
 * hiçbir HTTP handler'a bağlı değildi. F-007 `setFeatureStatus`'u `PATCH /api/features`'a
 * bağladığı için artık ~350ms'lik senkron blok ana iş parçacığını (dolayısıyla SSE akışı dahil
 * TÜM istekleri) durdururdu — `setTimeout` tabanlı bu sürüm event loop'u bloklamaz.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type AtomicWriteOnceResult =
  { ok: true; path: string } | { ok: false; message: string; errno?: string }

function atomicWriteOnce(targetPath: string, data: string | Buffer): AtomicWriteOnceResult {
  const dir = path.dirname(targetPath)
  const tmp = path.join(
    dir,
    `.${path.basename(targetPath)}.${process.pid}-${crypto.randomBytes(3).toString('hex')}.tmp`
  )
  try {
    fs.mkdirSync(dir, { recursive: true }) // try İÇİNDE — ENOTDIR burada yakalanır.
    const fd = fs.openSync(tmp, 'wx')
    try {
      if (typeof data === 'string') {
        fs.writeSync(fd, data)
      } else {
        fs.writeSync(fd, data)
      }
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.renameSync(tmp, targetPath) // aynı dizin → atomik, Windows'ta üzerine yazar.
    return { ok: true, path: targetPath }
  } catch (err) {
    const errno = (err as NodeJS.ErrnoException)?.code
    return { ok: false, message: describeError(err), errno }
  } finally {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp) // hata yolunda artık bırakılmaz.
    } catch {
      // unlinkSync'in KENDİ hatası dönüş değerini EZMEZ — yalnızca yutulur.
    }
  }
}

/** Atomik yazma (tmp+rename), EPERM/EBUSY'de 50/100/200 ms 3 deneme (ADR-005 madde 5). */
async function atomicWrite(targetPath: string, data: string | Buffer): Promise<WriteResult> {
  const delaysMs = [50, 100, 200]
  let lastMessage = 'yazma denenmedi'
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    const result = atomicWriteOnce(targetPath, data)
    if (result.ok) return { ok: true, path: result.path }
    lastMessage = result.message
    const retryable = result.errno === 'EPERM' || result.errno === 'EBUSY'
    if (!retryable || attempt === delaysMs.length) break
    await delay(delaysMs[attempt] ?? 0)
  }
  return { ok: false, code: 'write_failed', message: lastMessage }
}

function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

// F-007 sözleşme §3 madde 4 (D43, QA tur 1 bulgu 8) — gösterge-karakteri kümesi (19 karakter).
const YAML_INDICATOR_START = /^[-?:,[\]{}#&*!|>'"%@`]/

/**
 * `value` bağımsız bir YAML belgesi olarak ayrıştırıldığında string DIŞINDA bir tipe (boolean/
 * null/number) çözülüyor mu? (`true`, `null`, `~`, `12`, `.inf` gibi tip-zorlayan skalerler —
 * hiçbiri gösterge karakteriyle başlamaz ama tırnaksız yazılırsa `status` alanını bozar.)
 */
function resolvesToNonString(value: string): boolean {
  try {
    return typeof parseYaml(value) !== 'string'
  } catch {
    // Ayrıştırma hatası veren değerler zaten gösterge-karakteri veya `:`/`#`/satır-sonu
    // kurallarından biriyle yakalanır; güvenli varsayılan `false` — aşırı-tırnaklama yapmamak
    // Karpathy §2 ile tutarlı, 40 fixture'lık kapsama testinde bu dalın hiçbir round-trip'i
    // bozmadığı ölçüldü (sözleşme §3 madde 4).
    return false
  }
}

/** `status:`/`status : x` gibi değerleri YAML açısından güvenli hale getirir. */
function safeYamlValue(value: string): string {
  const needsQuoting =
    value === '' ||
    /[:#\r\n]/.test(value) ||
    value !== value.trim() ||
    YAML_INDICATOR_START.test(value) ||
    resolvesToNonString(value)
  if (!needsQuoting) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * root: çağıranın önceden `fs.realpathSync.native` ile çözdüğü kanonik proje kökü.
 * Yalnızca izlenen projenin `docs/features/<fileName>.md` dosyasının frontmatter'ındaki
 * `status:` satırını değiştirir; gövdeye asla inmez (sözleşme §3 madde 5).
 */
export async function setFeatureStatus(
  root: string,
  fileName: string,
  nextStatus: string,
  expectedHash: string
): Promise<WriteResult> {
  if (!FILE_NAME_PATTERN.test(fileName) || path.basename(fileName) !== fileName) {
    return { ok: false, code: 'invalid_body', message: 'Geçersiz dosya adı.' }
  }
  // D38/Ö2 (QA KALDI turu): `status` bir kelimedir, çok satırlı olması meşru değil (Karpathy §2).
  // `safeYamlValue` satır sonunu tırnaklar ama KAÇIRMAZ — satır sonu içeren bir değer frontmatter'ı
  // erken kapatıp (`status: "x\n---\nBODY"` gibi) ayrıştırılamaz hâle getirebilir. Kabul edip
  // kaçırmak yerine baştan reddediyoruz.
  if (/[\r\n]/.test(nextStatus)) {
    return { ok: false, code: 'invalid_body', message: 'status değeri satır sonu içeremez.' }
  }
  const resolved = resolveInsideRoot(root, ['docs', 'features', fileName], 'featureStatus')
  if (!resolved.ok) {
    return { ok: false, code: resolved.code, message: resolved.message }
  }

  let original: Buffer
  try {
    original = fs.readFileSync(resolved.targetPath)
  } catch (err) {
    return { ok: false, code: 'write_failed', message: describeError(err) }
  }

  if (sha256(original) !== expectedHash) {
    return { ok: false, code: 'conflict', message: 'Dosya beklenmedik şekilde değişmiş.' }
  }

  const text = original.toString('utf8')
  // Yakalama grubu içeren regex ile bölünür — ayraçlar (\r\n veya \n) dizinin kendi
  // elemanı olarak korunur, `join('')` onları olduğu gibi geri koyar.
  const parts = text.split(/(\r\n|\n)/)

  // Açılış: yalnızca karşılaştırma amacıyla BOM soyulur; parts[0]'ın kendisi DEĞİŞMEZ.
  const openingStripped = (parts[0] ?? '').replace(/^\uFEFF/, '')
  if (openingStripped !== '---') {
    return { ok: false, code: 'invalid_body', message: 'Frontmatter bulunamadı.' }
  }

  // Kapanış: çift indekslerde, index >= 2'den başlayarak ilk `---`/`...`.
  let closingIdx = -1
  for (let i = 2; i < parts.length; i += 2) {
    if (parts[i] === '---' || parts[i] === '...') {
      closingIdx = i
      break
    }
  }
  if (closingIdx === -1) {
    return { ok: false, code: 'invalid_body', message: 'Frontmatter kapanışı bulunamadı.' }
  }

  // status satırı: yalnızca [2, closingIdx) aralığında — kapanıştan sonrasına asla bakılmaz.
  let statusIdx = -1
  for (let i = 2; i < closingIdx; i += 2) {
    if (/^status\s*:/.test(parts[i] ?? '')) {
      statusIdx = i
      break
    }
  }
  if (statusIdx === -1) {
    return { ok: false, code: 'invalid_body', message: 'status alanı bulunamadı.' }
  }

  parts[statusIdx] = `status: ${safeYamlValue(nextStatus)}`
  const newText = parts.join('')

  const writeResult = await atomicWrite(resolved.targetPath, newText)
  if (!writeResult.ok) {
    return writeResult
  }
  return { ok: true, path: writeResult.path, hash: sha256(newText) }
}

/** İçerik biçimlendirmesi çağıranın sorumluluğu; bu fonksiyon `body`'yi olduğu gibi yazar. */
async function writeGateFile(
  root: string,
  gate: string,
  body: string,
  operation: 'approval' | 'denial',
  fileNameFor: (gate: string) => string
): Promise<WriteResult> {
  if (!GATE_PATTERN.test(gate)) {
    return { ok: false, code: 'invalid_body', message: 'Geçersiz kapı tanımlayıcısı.' }
  }
  if (body.length === 0) {
    return { ok: false, code: 'invalid_body', message: 'İçerik boş olamaz.' }
  }
  const resolved = resolveInsideRoot(root, ['docs', 'approvals', fileNameFor(gate)], operation)
  if (!resolved.ok) {
    return { ok: false, code: resolved.code, message: resolved.message }
  }
  return atomicWrite(resolved.targetPath, body)
}

export function writeGateApproval(root: string, gate: string, body: string): Promise<WriteResult> {
  return writeGateFile(root, gate, body, 'approval', (g) => `${g}.ok`)
}

export function writeGateDenial(root: string, gate: string, body: string): Promise<WriteResult> {
  return writeGateFile(root, gate, body, 'denial', (g) => `${g}.deny.md`)
}

/**
 * `docs/approvals/<gate>.deny.md`'yi `docs/approvals/archive/`'e TAŞIR (silme değil).
 * Hedef yoksa idempotent no-op: `{ ok: true, path: '' }`.
 */
export function archiveDenial(root: string, gate: string): WriteResult {
  if (!GATE_PATTERN.test(gate)) {
    return { ok: false, code: 'invalid_body', message: 'Geçersiz kapı tanımlayıcısı.' }
  }

  const sourceResolved = resolveInsideRoot(root, ['docs', 'approvals', `${gate}.deny.md`], 'denial')
  if (!sourceResolved.ok) {
    return { ok: false, code: sourceResolved.code, message: sourceResolved.message }
  }
  if (!fs.existsSync(sourceResolved.targetPath)) {
    return { ok: true, path: '' }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const archiveResolved = resolveInsideRoot(
    root,
    ['docs', 'approvals', 'archive', `${gate}-${timestamp}.deny.md`],
    'archive'
  )
  if (!archiveResolved.ok) {
    return { ok: false, code: archiveResolved.code, message: archiveResolved.message }
  }

  try {
    fs.mkdirSync(path.dirname(archiveResolved.targetPath), { recursive: true })
    fs.renameSync(sourceResolved.targetPath, archiveResolved.targetPath)
  } catch (err) {
    return { ok: false, code: 'write_failed', message: describeError(err) }
  }
  return { ok: true, path: archiveResolved.targetPath }
}
