import path from 'node:path'
import chokidar from 'chokidar'
import { createDebouncer } from '../../../server/watch/debounce'
import { isExcludedApprovalsEntry } from '../shared/gate-id'

export interface GatesWatcher {
  stop(): void
}

/**
 * `docs/approvals/` için `project-watcher.ts`'in KOPYASI DEĞİL (o dosyaya dokunulmuyor) —
 * aynı chokidar kurulumunu (depth:0, ignoreInitial, awaitWriteFinish, 150ms debounce) tekrarlar
 * (§7). Fark: `project-watcher.ts` yalnızca `.md` uzantılı değişiklikleri debounce'a sokuyor;
 * bu izleyici FİLTRESİZ ama §3'teki hariç tutma kümesini (Ö2) uygular — kendi `.tmp` dosyaları
 * ve `README.md`/`archive/` değişiklikleri tetiklemez, aksi hâlde her onay kendi geçici dosyası
 * yüzünden 2-3 kez SSE yayını yapardı.
 */
export function watchApprovals(
  approvalsDir: string,
  onChange: () => void,
  debounceMs = 150
): GatesWatcher {
  const debouncer = createDebouncer(debounceMs, onChange)

  const watcher = chokidar.watch(approvalsDir, {
    depth: 0,
    ignoreInitial: true,
    usePolling: process.env.MC_WATCH_POLLING === '1',
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  })

  watcher.on('all', (_event, changedPath) => {
    const name = path.basename(changedPath)
    if (isExcludedApprovalsEntry(name)) return
    debouncer.trigger()
  })
  watcher.on('error', (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Hata: ${approvalsDir} izlenirken hata oluştu: ${message}\n`)
  })

  function stop(): void {
    debouncer.cancel()
    void watcher.close()
  }

  return { stop }
}
