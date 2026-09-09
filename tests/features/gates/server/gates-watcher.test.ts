import { describe, expect, it, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { watchApprovals } from '../../../../src/features/gates/server/gates-watcher'

const tempDirs: string[] = []
const watchersToStop: Array<{ stop: () => void }> = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-gates-watch-'))
  tempDirs.push(dir)
  return dir
}

function waitFor(predicate: () => boolean, timeoutMs = 5000, intervalMs = 20): Promise<void> {
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

describe('watchApprovals — gerçek chokidar (F-008 sözleşmesi §7)', () => {
  it('.ok dosyası oluşunca onChange debounce sonrası bir kez çağrılır', async () => {
    const dir = makeTempDir()
    let count = 0
    const watcher = watchApprovals(dir, () => {
      count += 1
    })
    watchersToStop.push(watcher)
    await sleep(400)

    fs.writeFileSync(path.join(dir, 'G1.ok'), 'onay')

    await waitFor(() => count === 1)
    await sleep(300)
    expect(count).toBe(1)
  }, 10000)

  it('.deny.md dosyası oluşunca da tetiklenir (filtresiz — yalnızca hariç tutma kümesi uygulanır)', async () => {
    const dir = makeTempDir()
    let count = 0
    const watcher = watchApprovals(dir, () => {
      count += 1
    })
    watchersToStop.push(watcher)
    await sleep(400)

    fs.writeFileSync(path.join(dir, 'G3.deny.md'), 'red')

    await waitFor(() => count === 1)
    expect(count).toBe(1)
  }, 10000)

  it('tanınmayan ama hariç tutulmayan bir dosya değişikliği de tetikler (yanlış yazım gibi)', async () => {
    const dir = makeTempDir()
    let count = 0
    const watcher = watchApprovals(dir, () => {
      count += 1
    })
    watchersToStop.push(watcher)
    await sleep(400)

    fs.writeFileSync(path.join(dir, 'g2.ok'), 'yanlış yazım')

    await waitFor(() => count === 1)
    expect(count).toBe(1)
  }, 10000)

  it('README.md değişikliği TETİKLEMEZ (hariç tutma kümesi)', async () => {
    const dir = makeTempDir()
    let count = 0
    const watcher = watchApprovals(dir, () => {
      count += 1
    })
    watchersToStop.push(watcher)
    await sleep(400)

    fs.writeFileSync(path.join(dir, 'README.md'), '# belge')
    await sleep(800)
    expect(count).toBe(0)
  }, 10000)

  it("kendi .tmp dosyası (write-gate'in atomik yazma geçici dosyası) TETİKLEMEZ", async () => {
    const dir = makeTempDir()
    let count = 0
    const watcher = watchApprovals(dir, () => {
      count += 1
    })
    watchersToStop.push(watcher)
    await sleep(400)

    fs.writeFileSync(path.join(dir, '.G1.ok.12345-abcdef.tmp'), 'geçici')
    await sleep(800)
    expect(count).toBe(0)
  }, 10000)

  it('archive/ alt dizinindeki değişiklik TETİKLEMEZ (depth:0)', async () => {
    const dir = makeTempDir()
    fs.mkdirSync(path.join(dir, 'archive'))
    let count = 0
    const watcher = watchApprovals(dir, () => {
      count += 1
    })
    watchersToStop.push(watcher)
    await sleep(400)

    fs.writeFileSync(path.join(dir, 'archive', 'G1-x.deny.md'), 'arşiv')
    await sleep(800)
    expect(count).toBe(0)
  }, 10000)

  it("stop() sonrası değişiklik onChange'i tetiklemez", async () => {
    const dir = makeTempDir()
    let count = 0
    const watcher = watchApprovals(dir, () => {
      count += 1
    })
    watcher.stop()
    await sleep(100)

    fs.writeFileSync(path.join(dir, 'G1.ok'), 'onay')
    await sleep(800)
    expect(count).toBe(0)
  }, 10000)
})
