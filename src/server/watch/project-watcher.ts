import path from 'node:path'
import chokidar from 'chokidar'
import { createDebouncer } from './debounce'

export interface ProjectWatcher {
  stop(): void
}

/**
 * Tek bir projenin `docs/features` dizinini (yalnızca bu alt dizin, düz/derin olmayan) izler,
 * 150 ms trailing debounce ile bir `onChange` çağrısı tetikler (sözleşme §3 madde 1/2, D16 —
 * `chokidar@^4.0.3`, CEO kararı, `node:fs.watch`'ın ölçülen iki kusuru — dizin yaşam döngüsü
 * ölümü + olay fırtınası — yüzünden geri alındı, bkz. ADR-012).
 */
export function watchProjectFeatures(
  featuresDir: string,
  onChange: () => void,
  debounceMs = 150
): ProjectWatcher {
  const debouncer = createDebouncer(debounceMs, onChange)

  const watcher = chokidar.watch(featuresDir, {
    depth: 0,
    ignoreInitial: true,
    usePolling: process.env.MC_WATCH_POLLING === '1',
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  })

  // Tek bir `all` dinleyicisi: dosyanın eklenmesi/değişmesi/kaldırılması hepsi aynı şekilde
  // ele alınır — yalnızca değişen yolun `.md` uzantısı taşıyıp taşımadığına bakılır, olay
  // TÜRÜNE hiç bakılmaz (no-delete-guard.test.ts'in taradığı bu dosyada bir kaldırma/silme
  // fs çağrısının literal adı hiç geçmez — sözleşme §2.1 "no-delete-guard" niyeti).
  watcher.on('all', (_event, changedPath) => {
    if (path.extname(changedPath) !== '.md') return
    debouncer.trigger()
  })
  watcher.on('error', (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Hata: ${featuresDir} izlenirken hata oluştu: ${message}\n`)
  })

  function stop(): void {
    debouncer.cancel()
    void watcher.close()
  }

  return { stop }
}
