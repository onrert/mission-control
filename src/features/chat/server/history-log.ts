import fs from 'node:fs'
import path from 'node:path'
import type { ChatLogEntry } from '../../../shared/types'

/**
 * Aynı `(turn_id, kind)` çiftine sahip birden çok satırı **en yüksek `seq`'li olanla** temsil
 * eder (sözleşme §6, Ö3) — istemci asla aynı mantıksal mesajın iki kopyasını görmez. `Map.set`
 * var olan bir anahtarın ILK GÖRÜLME sırasını değiştirmez (yalnızca değeri günceller), bu yüzden
 * `map.values()` sırası zaten "ilk görülme" sırasıdır; sonuç ayrıca kendi (güncel) `seq`'ine göre
 * artan sıralanır ki döndürülen dizi her zaman `seq` bakımından monoton olsun (sayfalama bunu
 * varsayar).
 */
export function foldByTurn(entries: ChatLogEntry[]): ChatLogEntry[] {
  const map = new Map<string, ChatLogEntry>()
  for (const entry of entries) {
    map.set(`${entry.turn_id}::${entry.kind}`, entry)
  }
  return [...map.values()].sort((a, b) => a.seq - b.seq)
}

export interface HistoryLog {
  init(): void
  append(entry: Omit<ChatLogEntry, 'seq'>): ChatLogEntry
  readPage(opts?: { limit?: number; beforeSeq?: number }): {
    entries: ChatLogEntry[]
    has_more: boolean
  }
  markDanglingAsInterrupted(): void
  /** Test/gözlem amaçlı: bekleyen disk yazımlarının tamamlandığı ana kadar bekler
   *  (`readPage` zaten bellekten servis eder, bu yalnızca DİSKTEKİ satırları doğrulayan
   *  testler için gerekir — jsonl-store.ts'in `await store.append(...)` emsaliyle aynı amaç). */
  flush(): Promise<void>
}

/**
 * Kendi basit ekleme-log dosyası (`<dataDir>/chat/history.jsonl`) — SDK'nın kendi transkript
 * formatını AYRIŞTIRMAZ, yalnızca bu sunucunun zaten ürettiği/aldığı görüntüleme mesajlarını
 * kalıcı hale getirir. Ekleme-only, düzeltme-satırı deseni (sözleşme §6): bir turun durumu
 * değiştiğinde YENİ bir satır eklenir, var olan satır asla değiştirilmez/silinmez.
 */
export function createHistoryLog(dataDir: string): HistoryLog {
  const chatDir = path.join(dataDir, 'chat')
  const historyFile = path.join(chatDir, 'history.jsonl')

  // Okuma tarafı her zaman BELLEKTEN servis edilir (jsonl-store.ts'in ring buffer emsaliyle
  // aynı fikir) — disk yazımı yalnızca kalıcılık/dayanıklılık içindir, `readPage` her `append`
  // sonrası diski yeniden okumaz (hem daha hızlı hem de yazma kuyruğunun tamamlanmasını
  // BEKLEMEK ZORUNDA KALMADAN deterministik: `append()` çağrıldığı anda okunabilir olur).
  let entries: ChatLogEntry[] = []
  let nextSeq = 1
  let writeQueue: Promise<void> = Promise.resolve()

  function loadAllEntriesFromDisk(): ChatLogEntry[] {
    if (!fs.existsSync(historyFile)) return []
    const raw = fs.readFileSync(historyFile, 'utf8')
    const loaded: ChatLogEntry[] = []
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      try {
        loaded.push(JSON.parse(trimmed) as ChatLogEntry)
      } catch {
        // Bozuk satır — jsonl-store.ts'in `corrupt_lines` emsaliyle aynı tolerans: atla, çökme.
      }
    }
    return loaded
  }

  function init(): void {
    fs.mkdirSync(chatDir, { recursive: true })
    entries = loadAllEntriesFromDisk()
    const maxSeq = entries.reduce((max, entry) => Math.max(max, entry.seq), 0)
    nextSeq = maxSeq + 1
    markDanglingAsInterrupted()
  }

  function append(input: Omit<ChatLogEntry, 'seq'>): ChatLogEntry {
    const entry: ChatLogEntry = { ...input, seq: nextSeq }
    nextSeq += 1
    entries.push(entry)
    const line = `${JSON.stringify(entry)}\n`
    writeQueue = writeQueue
      .then(() => fs.promises.appendFile(historyFile, line))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        process.stderr.write(`Hata: sohbet geçmişi diske yazılamadı: ${message}\n`)
      })
    return entry
  }

  function readPage(opts: { limit?: number; beforeSeq?: number } = {}): {
    entries: ChatLogEntry[]
    has_more: boolean
  } {
    const limit = opts.limit ?? 50
    const folded = foldByTurn(entries)
    const filtered =
      opts.beforeSeq === undefined ? folded : folded.filter((entry) => entry.seq < opts.beforeSeq!)
    const page = filtered.slice(Math.max(0, filtered.length - limit))
    return { entries: page, has_more: filtered.length > page.length }
  }

  function markDanglingAsInterrupted(): void {
    const folded = foldByTurn(entries)
    for (const entry of folded) {
      if (entry.status === 'streaming') {
        append({
          turn_id: entry.turn_id,
          role: entry.role,
          kind: entry.kind,
          text: entry.text,
          status: 'interrupted',
          ts: new Date().toISOString(),
        })
      }
    }
  }

  function flush(): Promise<void> {
    return writeQueue
  }

  return { init, append, readPage, markDanglingAsInterrupted, flush }
}
