import { describe, expect, it, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import chokidar from 'chokidar'
import { watchProjectFeatures } from '../../../src/server/watch/project-watcher'

const tempDirs: string[] = []
const watchersToStop: Array<{ stop: () => void }> = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-watch-'))
  tempDirs.push(dir)
  return dir
}

function waitFor(predicate: () => boolean, timeoutMs = 3000, intervalMs = 20): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = (): void => {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`waitFor: ${timeoutMs}ms içinde koşul sağlanmadı`))
        return
      }
      setTimeout(check, intervalMs)
    }
    check()
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

afterEach(async () => {
  while (watchersToStop.length > 0) {
    watchersToStop.pop()!.stop()
  }
  await sleep(50)
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('watchProjectFeatures — gerçek chokidar (sözleşme §2.1)', () => {
  it('.md dosyası oluşunca onChange debounce sonrası bir kez çağrılır', async () => {
    const dir = makeTempDir()
    let count = 0
    const watcher = watchProjectFeatures(dir, () => {
      count += 1
    })
    watchersToStop.push(watcher)
    // chokidar'ın alt katman izleme kurulumu asenkron (readdirp taraması) — gerçek kullanımda
    // (sunucu açılışı ile kullanıcının dosya değiştirmesi arası) bu kurulum süresi hiç sorun
    // değildir; testte gerçekçi bir aralık bırakılmazsa yazım kurulumdan önce olup kaçırılabilir
    // (ampirik doğrulandı: kurulumdan hemen sonra senkron yazım olayı üretmiyor).
    await sleep(400)

    fs.writeFileSync(path.join(dir, 'F-001.md'), '# test')

    await waitFor(() => count === 1, 5000)
    // Debounce sonrası ekstra bir çağrı gelmediğinden emin olmak için kısa bir bekleme daha.
    await sleep(300)
    expect(count).toBe(1)
  }, 10000)

  it('.txt dosyası değişikliği tetiklemez', async () => {
    const dir = makeTempDir()
    let count = 0
    const watcher = watchProjectFeatures(dir, () => {
      count += 1
    })
    watchersToStop.push(watcher)

    fs.writeFileSync(path.join(dir, 'notlar.txt'), 'x')
    await sleep(800)
    expect(count).toBe(0)
  }, 10000)

  it("stop() sonrası değişiklik onChange'i tetiklemez", async () => {
    const dir = makeTempDir()
    let count = 0
    const watcher = watchProjectFeatures(dir, () => {
      count += 1
    })
    watcher.stop()
    await sleep(100)

    fs.writeFileSync(path.join(dir, 'F-002.md'), '# test')
    await sleep(800)
    expect(count).toBe(0)
  }, 10000)

  it('D16: dizin silinip yeniden oluşturulduktan sonra .md yazımı yine onChange tetikler', async () => {
    const dir = makeTempDir()
    let count = 0
    const watcher = watchProjectFeatures(dir, () => {
      count += 1
    })
    watchersToStop.push(watcher)
    await sleep(400)

    // Taban durum: izleyici çalışıyor mu?
    fs.writeFileSync(path.join(dir, 'F-001.md'), '# once')
    await waitFor(() => count === 1, 5000)

    // Dizini sil + yeniden oluştur (git checkout / branch değişimi deseni).
    fs.rmSync(dir, { recursive: true, force: true })
    await sleep(200)
    fs.mkdirSync(dir, { recursive: true })
    await sleep(200)

    fs.writeFileSync(path.join(dir, 'F-002.md'), '# yeniden')
    await waitFor(() => count === 2, 8000)
    expect(count).toBe(2)
  }, 15000)

  it("D16/NOT-2: dizin silinip silinmiş kalırsa 1 sn içinde üretilen ham chokidar olayı 500'ün altında kalır", async () => {
    const dir = makeTempDir()
    // Bu senaryo ham olay SAYISINI ölçer — `watchProjectFeatures` sarmalayıcısı raw watcher'ı
    // dışa açmadığı için burada doğrudan chokidar kullanılır (sözleşmenin öngördüğü gibi,
    // aynı üretim ayarlarıyla: depth:0, usePolling env'e bağlı, awaitWriteFinish).
    const watcher = chokidar.watch(dir, {
      depth: 0,
      ignoreInitial: true,
      usePolling: process.env.MC_WATCH_POLLING === '1',
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    })
    await new Promise<void>((resolve) => watcher.on('ready', () => resolve()))

    fs.rmSync(dir, { recursive: true, force: true })
    await sleep(300)

    let rawEventCount = 0
    watcher.on('all', () => {
      rawEventCount += 1
    })
    await sleep(1000)

    await watcher.close()

    expect(rawEventCount).toBeLessThan(500)
  }, 10000)
})
