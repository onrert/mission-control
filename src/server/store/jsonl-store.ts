import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { EventRecord } from '../../shared/types'

/**
 * Gün dosyası adı deseni. `(\.\d+)?` parçası ADR-008 karar 2'nin ileride eklenebilecek
 * rotasyon dosyalarını (`YYYY-MM-DD.1.jsonl`) da güvenlik/liste taramalarında tolere etmek
 * içindir — bu feature rotasyonu üretmez, yalnızca ileride kırılmayacak bir desen bırakır.
 */
export const DAY_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}(\.\d+)?\.jsonl$/

/**
 * Gün dosyasının adını tek bir yerden üretir (ADR-008 karar 2 koşulu). İleride 50 MB
 * rotasyonu eklenirse yalnızca bu fonksiyon değişir; append/açılış yüklemesi/retention
 * hepsi bunu çağırır.
 */
export function dayFileName(date: Date): string {
  return `${date.toISOString().slice(0, 10)}.jsonl`
}

export type EventInput = Omit<EventRecord, 'seq' | 'id'>

export interface AppendResult {
  seq: number
  id: string
}

export interface ReadResult {
  events: EventRecord[]
  nextSeq: number
}

export interface JsonlStoreOptions {
  ringSize?: number
}

export interface JsonlStore {
  /** Açılışta bir kez çağrılır: dizinleri oluşturur, ring buffer'ı yükler, seq'i çözer. */
  init(): void
  /** Yeni bir olayı sıraya ekler; disk yazımı tamamlanınca çözülen promise döner. */
  append(input: EventInput): Promise<AppendResult>
  /** Ring buffer'dan (yalnızca bellek) since_seq'ten büyük olayları döner. */
  read(sinceSeq: number, limit: number): ReadResult
  getCorruptLines(): number
  /** QA düzeltme turu 1 (B1): kalıcı disk yazma hatası sayacı — `corrupt_lines` deseniyle tutarlı. */
  getWriteErrors(): number
  readonly dataRoot: string
  readonly eventsDir: string
  /**
   * Gün dosyası adı (uzantısız, ör. "2026-09-04") → satır sayısı. Retention modülü bu
   * haritayı doğrudan mutasyona uğratır (dosya sildiğinde ilgili anahtarı siler) — bilinçli
   * paylaşılan referans, kopya değil (bkz. sözleşme §3 madde 2 alt madde 4).
   */
  readonly lineCounts: Map<string, number>
}

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex')
}

function parseLine(line: string): EventRecord | undefined {
  if (line.length === 0) return undefined
  try {
    return JSON.parse(line) as EventRecord
  } catch {
    return undefined
  }
}

function countLines(content: string): number {
  return content.split('\n').filter((l) => l.length > 0).length
}

/**
 * Bellekte tutulan yazma kuyruğu + ring buffer + seq üreteci. Süreç içinde birden fazla
 * örnek yaşayabilir (ör. AC-5 testinde aynı `dataDir`'e karşı ardışık iki `createServer`
 * çağrısı) — bu yüzden modül-global durum yerine fabrika deseni kullanılır (QA tur 2 "kod
 * turuna devredilen notlar" N1).
 */
export function createJsonlStore(dataDir: string, options: JsonlStoreOptions = {}): JsonlStore {
  const dataRoot = dataDir
  const eventsDir = path.join(dataDir, 'events')
  const seqFile = path.join(eventsDir, '.seq')
  const ringSize = options.ringSize ?? 2000

  let nextSeq = 0
  let corruptLines = 0
  let writeErrors = 0
  let ring: EventRecord[] = []
  let queue: Promise<void> = Promise.resolve()
  const lineCounts = new Map<string, number>()

  /**
   * QA düzeltme turu 1 (B1): tek dosya bazında bir kez log (satır başına spam yok, `corrupt_lines`
   * loglama stiliyle tutarlı). Hatayı burada yutarız — kuyruk asla reddedilmiş durumda kalmaz.
   */
  function logWriteError(dayFile: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Hata: ${dayFile} dosyasına yazılamadı: ${message}\n`)
  }

  function listDayFiles(): string[] {
    if (!fs.existsSync(eventsDir)) return []
    return fs
      .readdirSync(eventsDir)
      .filter((name) => DAY_FILE_PATTERN.test(name))
      .sort()
  }

  function writeSeqBestEffort(value: number): void {
    try {
      fs.writeFileSync(seqFile, String(value))
    } catch {
      // best-effort — JSONL zaten tek doğruluk kaynağı (sözleşme §3 madde 4).
    }
  }

  /**
   * En yeni dosyadan geriye doğru, `ringSize` olay toplanana kadar okur. Basitlik için tüm
   * dosya `readFileSync` ile belleğe alınır (tipik gün dosyası boyutunda önemsiz maliyet);
   * yalnızca en yeni (ilk taranan) dosyanın son geçerli satırından `seq` çözülür — o dosya
   * tamamen bozuksa bir önceki güne bakılmaz (§3 madde 4 alt madde 2).
   */
  function loadRingAndSeq(files: string[]): void {
    ring = []
    let fileSeq = -1
    for (let i = files.length - 1; i >= 0 && ring.length < ringSize; i--) {
      const isNewestFile = i === files.length - 1
      const file = files[i]
      if (!file) continue
      const content = fs.readFileSync(path.join(eventsDir, file), 'utf8')
      const lines = content.split('\n').filter((l) => l.length > 0)
      const parsedInFile: EventRecord[] = []
      for (const line of lines) {
        const parsed = parseLine(line)
        if (parsed) {
          parsedInFile.push(parsed)
        } else {
          corruptLines += 1
        }
      }
      if (isNewestFile) {
        fileSeq = parsedInFile.length > 0 ? parsedInFile[parsedInFile.length - 1]!.seq : -1
      }
      for (let j = parsedInFile.length - 1; j >= 0 && ring.length < ringSize; j--) {
        ring.unshift(parsedInFile[j]!)
      }
    }

    // `.seq` dosyasının semantiği: "bir sonraki atanacak seq" (QA düzeltme turu 1 — Ö1).
    // `append` de aynı semantikle yazar (aşağıya bakınız); okuma tarafı burada iki kaynağın
    // maksimumunu alır: JSONL'den çözülen `fileSeq + 1` (dosyanın kendi "sonraki"si) ile
    // `.seq` dosyasının değeri. Böylece olaysız bir yeniden başlatmada `.seq` değişmeden kalır
    // (önceden `init` "sonraki"yi, `append` "son atanan"ı yazdığı için her açılışta bir
    // kayıyordu — bkz. `docs/qa/latest.md` Bulgu Ö1).
    let fileFromDotSeq: number | undefined
    if (fs.existsSync(seqFile)) {
      const raw = fs.readFileSync(seqFile, 'utf8').trim()
      const parsed = Number(raw)
      if (Number.isInteger(parsed)) fileFromDotSeq = parsed
    }
    nextSeq = Math.max(fileSeq + 1, fileFromDotSeq ?? 0)
    writeSeqBestEffort(nextSeq)
  }

  /**
   * Ring buffer taramasından bağımsız, ayrı ve ucuz bir geçiş: yalnızca satır sayar
   * (JSON.parse yok). Gün bazlı budamadan hemen sonra çağrılmalıdır (§3 madde 2 alt madde 4).
   */
  function recomputeLineCounts(files: string[]): void {
    lineCounts.clear()
    for (const file of files) {
      const content = fs.readFileSync(path.join(eventsDir, file), 'utf8')
      const day = file.replace(/\.jsonl$/, '')
      lineCounts.set(day, countLines(content))
    }
  }

  function init(): void {
    fs.mkdirSync(eventsDir, { recursive: true })
    const files = listDayFiles()
    loadRingAndSeq(files)
    recomputeLineCounts(files)
  }

  function append(input: EventInput): Promise<AppendResult> {
    // seq ataması senkron, kuyruğa girmeden önce yapılır (§3 madde 7) — çağrı sırası hiçbir
    // zaman disk yazma sırasından bağımsızlaşmaz.
    const seq = nextSeq
    nextSeq += 1
    const id = `${seq}-${randomHex(3)}`
    const event: EventRecord = { ...input, seq, id }

    ring.push(event)
    if (ring.length > ringSize) ring.shift()

    const day = dayFileName(new Date())
    const line = `${JSON.stringify(event)}\n`
    const file = path.join(eventsDir, day)

    // QA düzeltme turu 1 (B1): bu append'in disk yazması `writeResult`'ta izlenir ve çağırana
    // (ingest.ts) olduğu gibi (başarı/hata) döner — yanıt dürüst olsun diye (§4.2, storage_unavailable).
    // `queue` ise HİÇBİR ZAMAN reddedilmiş durumda bırakılmaz: hata burada yutulup loglanır,
    // böylece bu append başarısız olsa bile SONRAKİ append'ler kuyrukta bekletilmeye devam eder
    // (zehirlenmiş kuyruk = tüm sonraki isteklerin de düşmesi, eski davranış).
    // QA düzeltme turu 1 (B1): bu append'in disk yazması `writeResult`'ta izlenir ve çağırana
    // (ingest.ts) olduğu gibi (başarı/hata) döner — yanıt dürüst olsun diye (§4.2, storage_unavailable).
    // `queue` ise HİÇBİR ZAMAN reddedilmiş durumda bırakılmaz: hata burada yutulup loglanır,
    // böylece bu append başarısız olsa bile SONRAKİ append'ler kuyrukta bekletilmeye devam eder
    // (zehirlenmiş kuyruk = tüm sonraki isteklerin de düşmesi, eski davranış).
    const writeResult = queue.then(() => fs.promises.appendFile(file, line))
    queue = writeResult.then(
      () => {
        lineCounts.set(day, (lineCounts.get(day) ?? 0) + 1)
      },
      (err: unknown) => {
        writeErrors += 1
        logWriteError(day, err)
      }
    )
    // `.seq` best-effort güncellemesi başarı/hatadan bağımsız yapılır (§3 madde 4) — yazma
    // başarısız olsa bile bu seq bir daha verilmez (kuyrukta sıradaki zaten `nextSeq`'i kullanır).
    writeSeqBestEffort(nextSeq)

    return writeResult.then(
      () => ({ seq, id }),
      (err: unknown) => {
        throw err
      }
    )
  }

  function read(sinceSeq: number, limit: number): ReadResult {
    const filtered = ring.filter((e) => e.seq > sinceSeq)
    const events = filtered.slice(0, limit)
    const nextSeqOut =
      events.length > 0 ? events[events.length - 1]!.seq + 1 : sinceSeq === -1 ? 0 : sinceSeq
    return { events, nextSeq: nextSeqOut }
  }

  return {
    init,
    append,
    read,
    getCorruptLines: () => corruptLines,
    getWriteErrors: () => writeErrors,
    dataRoot,
    eventsDir,
    lineCounts,
  }
}
