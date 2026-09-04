import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createJsonlStore, dayFileName, type EventInput } from '../../../src/server/store/jsonl-store'
import { createTempDataDir, removeTempDataDir } from '../../helpers/temp-data-dir'

function makeEvent(overrides: Partial<EventInput> = {}): EventInput {
  return {
    ts: new Date().toISOString(),
    received_ms: Date.now(),
    project_path: 'C:\\dev\\apps\\demo',
    project_name: 'demo',
    hook_event_name: 'PreToolUse',
    summary: 'npm test',
    flags: [],
    raw: { tool_input: { command: 'npm test' } },
    ...overrides,
  }
}

describe('dayFileName', () => {
  it('UTC tarihinden YYYY-MM-DD.jsonl üretir', () => {
    expect(dayFileName(new Date('2026-09-04T23:59:59.000Z'))).toBe('2026-09-04.jsonl')
    expect(dayFileName(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01.jsonl')
  })
})

describe('createJsonlStore', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = createTempDataDir()
  })

  afterEach(() => {
    removeTempDataDir(dataDir)
  })

  it('append seq 0dan başlayarak sıralı atar, id içerir', async () => {
    const store = createJsonlStore(dataDir)
    store.init()
    const first = await store.append(makeEvent())
    const second = await store.append(makeEvent())
    expect(first.seq).toBe(0)
    expect(second.seq).toBe(1)
    expect(first.id).toBe(`0-${first.id.split('-')[1]}`)
  })

  it('append sonrası satır dosyaya yazılır ve read ile geri döner', async () => {
    const store = createJsonlStore(dataDir)
    store.init()
    await store.append(makeEvent())
    await store.append(makeEvent())
    const { events, nextSeq } = store.read(-1, 200)
    expect(events).toHaveLength(2)
    expect(events[0]?.seq).toBe(0)
    expect(events[1]?.seq).toBe(1)
    expect(nextSeq).toBe(2)

    const file = path.join(dataDir, 'events', dayFileName(new Date()))
    const content = fs.readFileSync(file, 'utf8')
    const lines = content.split('\n').filter((l) => l.length > 0)
    expect(lines).toHaveLength(2)
    expect(() => JSON.parse(lines[0]!)).not.toThrow()
  })

  it('read since_seq ile filtreler', async () => {
    const store = createJsonlStore(dataDir)
    store.init()
    await store.append(makeEvent())
    await store.append(makeEvent())
    await store.append(makeEvent())
    const { events, nextSeq } = store.read(0, 200)
    expect(events.map((e) => e.seq)).toEqual([1, 2])
    expect(nextSeq).toBe(3)
  })

  it('read hiç sonuç yoksa since_seq değerini aynen next_seq olarak döner', async () => {
    const store = createJsonlStore(dataDir)
    store.init()
    await store.append(makeEvent())
    const { events, nextSeq } = store.read(5, 200)
    expect(events).toHaveLength(0)
    expect(nextSeq).toBe(5)
  })

  it('ring buffer MC_RING_SIZE ile sınırlıdır, eski olaylar bellekten düşer', async () => {
    const store = createJsonlStore(dataDir, { ringSize: 3 })
    store.init()
    for (let i = 0; i < 5; i++) {
      await store.append(makeEvent())
    }
    const { events } = store.read(-1, 200)
    expect(events.map((e) => e.seq)).toEqual([2, 3, 4])
  })

  it('bozuk satır içeren dosyayla init edilirse corrupt_lines doğru sayılır', () => {
    const eventsDir = path.join(dataDir, 'events')
    fs.mkdirSync(eventsDir, { recursive: true })
    const validLines = Array.from({ length: 8 }, (_, i) =>
      JSON.stringify({ seq: i, id: `${i}-a`, ts: new Date().toISOString(), flags: [], raw: {} })
    )
    const content = [...validLines, 'bozuk satır', '{ hala bozuk'].join('\n')
    fs.writeFileSync(path.join(eventsDir, dayFileName(new Date())), content)

    const store = createJsonlStore(dataDir)
    store.init()
    expect(store.getCorruptLines()).toBe(2)
  })

  it('lineCounts ring boyutundan bağımsız olarak TÜM gün dosyalarını sayar (Bulgu 4)', () => {
    // ring=5 iken 3 gün dosyası x 5 olay = 15 gerçek toplam. Ring taraması yalnızca en yeni
    // dosyayı (5 olay) görür; satır sayısı haritası bundan bağımsız, ayrı bir geçişle
    // doldurulmalı — aksi hâlde retention toplamı 5 sanır ve hiç budamaz.
    const eventsDir = path.join(dataDir, 'events')
    fs.mkdirSync(eventsDir, { recursive: true })
    const days = ['2026-09-02', '2026-09-03', '2026-09-04']
    for (const day of days) {
      const lines = Array.from({ length: 5 }, (_, i) =>
        JSON.stringify({ seq: i, id: `${i}-a`, flags: [], raw: {} })
      ).join('\n')
      fs.writeFileSync(path.join(eventsDir, `${day}.jsonl`), `${lines}\n`)
    }

    const store = createJsonlStore(dataDir, { ringSize: 5 })
    store.init()

    const total = Array.from(store.lineCounts.values()).reduce((sum, n) => sum + n, 0)
    expect(total).toBe(15)
  })

  it('açılışta ring buffer diskten yüklenir (yeniden başlatma simülasyonu)', async () => {
    const first = createJsonlStore(dataDir)
    first.init()
    for (let i = 0; i < 150; i++) {
      await first.append(makeEvent())
    }

    const second = createJsonlStore(dataDir)
    second.init()
    const { events } = second.read(-1, 1000)
    expect(events.length).toBeGreaterThanOrEqual(100)
    const seqs = events.map((e) => e.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })

  it('.seq dosyası JSONLden eskiyse JSONL kazanır (Math.max)', async () => {
    const first = createJsonlStore(dataDir)
    first.init()
    await first.append(makeEvent())
    await first.append(makeEvent())
    await first.append(makeEvent())
    // .seq dosyasını bilerek geriye çek (eski/bozuk best-effort yazım simülasyonu)
    fs.writeFileSync(path.join(dataDir, 'events', '.seq'), '0')

    const second = createJsonlStore(dataDir)
    second.init()
    const result = await second.append(makeEvent())
    expect(result.seq).toBe(3)
  })

  it('.seq dosyası JSONLin son satırından ileriyse .seq kazanır', () => {
    const eventsDir = path.join(dataDir, 'events')
    fs.mkdirSync(eventsDir, { recursive: true })
    fs.writeFileSync(
      path.join(eventsDir, dayFileName(new Date())),
      `${JSON.stringify({ seq: 2, id: '2-a', flags: [], raw: {} })}\n`
    )
    fs.writeFileSync(path.join(eventsDir, '.seq'), '9')

    const store = createJsonlStore(dataDir)
    store.init()
    return store.append(makeEvent()).then((result) => {
      expect(result.seq).toBe(10)
    })
  })

  it('200 eşzamanlı append — hepsi geçerli JSON, satır sayısı tam 200 (temel eşzamanlılık sağlığı)', async () => {
    const store = createJsonlStore(dataDir)
    store.init()
    const bigRaw = { filler: 'x'.repeat(260 * 1024) }
    const promises = Array.from({ length: 200 }, () => store.append(makeEvent({ raw: bigRaw })))
    await Promise.all(promises)

    const file = path.join(dataDir, 'events', dayFileName(new Date()))
    const content = fs.readFileSync(file, 'utf8')
    const lines = content.split('\n').filter((l) => l.length > 0)
    expect(lines).toHaveLength(200)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })

  it('yazma kuyruğu: appendFile çağrıları çağrı sırasıyla, önceki tamamlanmadan başlamaz (kuyruk kanıtı)', async () => {
    // Fiziksel dosya yazma yarışı bu makinede (Windows + O_APPEND) her boyutta atomik
    // kalabildiği için (ampirik olarak doğrulandı — bkz. geliştirme notu), kuyruğun VARLIĞINI
    // gerçek disk bozulmasına güvenmeden, doğrudan çağrı/tamamlanma sırasını ölçerek kanıtlıyoruz.
    // `fs.promises.appendFile` mock'lanır: çift seq'ler yapay olarak yavaşlatılır. Kuyruk
    // varsa bir sonraki çağrı öncekinin bitmesini beklediği için gecikme farkı sonucu
    // ETKİLEMEZ — tamamlanma sırası her zaman çağrı sırasıyla birebir aynı kalır. Kuyruk
    // kaldırılırsa (mutasyon), tüm çağrılar aynı anda ateşlenir ve yavaş (çift) seq'ler geriye
    // düşer — tamamlanma sırası bozulur.
    const store = createJsonlStore(dataDir)
    store.init()

    const completionOrder: number[] = []
    const realAppendFile = fs.promises.appendFile.bind(fs.promises)
    const spy = vi.spyOn(fs.promises, 'appendFile').mockImplementation(async (file, data) => {
      const match = /"seq":(\d+)/.exec(String(data))
      const seq = match ? Number(match[1]) : -1
      const delayMs = seq % 2 === 0 ? 15 : 0
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      completionOrder.push(seq)
      return realAppendFile(file as string, data as string)
    })

    try {
      const promises = Array.from({ length: 10 }, () => store.append(makeEvent()))
      await Promise.all(promises)
    } finally {
      spy.mockRestore()
    }

    expect(completionOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})
