import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { SseHub } from '../../../../src/server/sse/hub'

// D27/NOT-4 — `watchProjectFeatures`'ı sahteler: gerçek chokidar zamanlamasına (debounce +
// awaitWriteFinish) bağımlı olmadan, `service.ts`'in `startWatchingIfPossible`'a geçirdiği
// `onChange` closure'ını doğrudan yakalayıp çağırabilmek için. Bu closure, chokidar'ın debounce
// zamanlayıcısından tetiklendiğinde gerçekte çalışacak koddur (D27'nin konusu).
let capturedOnChange: (() => void) | undefined
vi.mock('../../../../src/server/watch/project-watcher', () => ({
  watchProjectFeatures: (_featuresDir: string, onChange: () => void) => {
    capturedOnChange = onChange
    return { stop: () => {} }
  },
}))

const { createProjectsService } = await import('../../../../src/features/projects/server/service')

/**
 * QA düzeltme turu 2 (D27/NOT-4) — `service.ts`'in izleyici başlatma/durdurma ve SSE
 * `broadcast` çağrıları (yazma zaten başarılı olduktan SONRA çalışan yan etkiler) artık
 * `safelyNotify` ile sarılı. Bu testler `hub.broadcast`'i her zaman fırlatacak şekilde sahteler
 * ve hem senkron (addProject/removeProject'in kendi çağrı yığını) hem de asenkron (chokidar'ın
 * debounce zamanlayıcısından tetiklenen `onChange`) yolun süreci düşürmediğini/sonucu
 * bozmadığını ölçer.
 */
function makeThrowingHub(): SseHub {
  return {
    subscribe: () => () => {},
    broadcast: () => {
      throw new Error('sse yayını başarısız (qa-probe)')
    },
    closeAll: () => {},
    subscriberCount: () => 0,
  }
}

function makeProjectDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-proj-svc-'))
  fs.mkdirSync(path.join(dir, 'docs', 'features'), { recursive: true })
  return dir
}

function makeDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mc-data-svc-'))
}

describe('createProjectsService — NOT-4: hub.broadcast fırlarsa süreç düşmez, sonuç bozulmaz', () => {
  it('addProject: hub.broadcast fırlarsa bile yazma başarılı sonucu döner, fırlatmaz', () => {
    const dataDir = makeDataDir()
    const projectDir = makeProjectDir()
    const service = createProjectsService(dataDir, makeThrowingHub())
    try {
      let result: ReturnType<typeof service.addProject> | undefined
      expect(() => {
        result = service.addProject(projectDir, undefined)
      }).not.toThrow()
      expect(result?.ok).toBe(true)
      // İzleme yine de kuruldu mu (broadcast fırlamış olsa bile startWatchingIfPossible önce
      // çalıştı)?
      expect(service.getActiveWatcherCount()).toBe(1)
    } finally {
      service.stopAll()
      fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      fs.rmSync(projectDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('removeProject: hub.broadcast fırlarsa bile kaldırma başarılı sonucu döner, fırlatmaz', () => {
    const dataDir = makeDataDir()
    const projectDir = makeProjectDir()
    const service = createProjectsService(dataDir, makeThrowingHub())
    try {
      const added = service.addProject(projectDir, undefined)
      if (!added.ok) throw new Error('kurulum: proje eklenemedi')

      let result: ReturnType<typeof service.removeProject> | undefined
      expect(() => {
        result = service.removeProject(added.item.id)
      }).not.toThrow()
      expect(result?.ok).toBe(true)
      expect(service.getActiveWatcherCount()).toBe(0)
    } finally {
      service.stopAll()
      fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      fs.rmSync(projectDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it("izleyici değişiklik callback'i (chokidar debounce tetikleyicisi): hub.broadcast fırlarsa dahi fırlatmaz", () => {
    const dataDir = makeDataDir()
    const projectDir = makeProjectDir()
    capturedOnChange = undefined
    const service = createProjectsService(dataDir, makeThrowingHub())
    try {
      const added = service.addProject(projectDir, undefined)
      if (!added.ok) throw new Error('kurulum: proje eklenemedi')

      // `capturedOnChange`, `service.ts`'in `watchProjectFeatures`'a geçirdiği gerçek closure —
      // chokidar bunu normalde 150ms'lik debounce zamanlayıcısından çağırır. Doğrudan çağırarak
      // gerçek dosya izleme zamanlamasına (flaky) bağımlı olmadan aynı kod yolunu ölçüyoruz.
      expect(capturedOnChange).toBeTypeOf('function')
      expect(() => capturedOnChange?.()).not.toThrow()
    } finally {
      service.stopAll()
      fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      fs.rmSync(projectDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })
})
