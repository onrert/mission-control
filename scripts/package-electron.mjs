#!/usr/bin/env node
// F-014 — Windows-only paketleme (ADR-009), `@electron/packager` ile (sözleşme §0 Bulgu 2:
// `electron-builder` guard'a çarpıyor, `@electron/packager` çarpmıyor).
//
// Bundling/relocation YOK (sözleşme §1 madde 2): `electron/main.cjs` göreli yol
// varsayımlarıyla çalışıyor (`__dirname/../src/server/index.ts`, `dist/web`'in
// `src/server/index.ts`'e göre konumu) — bu yüzden `asar: false` ve kaynak ağaç olduğu
// gibi kopyalanıyor, esbuild/webpack ile yeniden paketlenmiyor.
//
// `prune: true` (varsayılan): yalnızca `package.json`'ın `dependencies` alanındaki paketler
// kopyalanır — `electron`, `@electron/packager`, `playwright`, `vite`, `vitest`, `tsx` gibi
// devDependencies paketlenmiş çıktıya GİRMEZ (`tsx` bir istisna: `electron/main.cjs` çalışma
// zamanında `require('tsx/cjs/api')` çağırıyor, bu yüzden `tsx` `dependencies`'e taşınmalı —
// bu script bunu paketleme ÖNCESİ kontrol eder, sessizce yanlış bir paket üretmez).
import { packager } from '@electron/packager'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const require = createRequire(import.meta.url)

function assertTsxIsRuntimeDependency() {
  const pkg = require(path.join(repoRoot, 'package.json'))
  if (!pkg.dependencies || !pkg.dependencies.tsx) {
    throw new Error(
      '`tsx` package.json "dependencies" altında değil — electron/main.cjs çalışma zamanında ' +
        "require('tsx/cjs/api') çağırıyor, `prune: true` ile paketlenmiş çıktıda bu paket " +
        'eksik kalır ve uygulama açılışta çöker. `tsx`\'i "devDependencies"ten "dependencies"e taşıyın.'
    )
  }
}

async function main() {
  assertTsxIsRuntimeDependency()

  const appPaths = await packager({
    dir: repoRoot,
    out: path.join(repoRoot, 'release'),
    platform: 'win32', // ADR-009 — yalnızca Windows paketleniyor
    arch: 'x64',
    name: 'Mission Control',
    executableName: 'mission-control',
    overwrite: true,
    asar: false,
    prune: true,
    ignore: [
      '/\\.github($|/)',
      '/\\.claude($|/)',
      '/docs($|/)',
      '/tests($|/)',
      '/test-results($|/)',
      '/playwright-report($|/)',
      '/release($|/)',
      '/coverage($|/)',
      '/data($|/)',
      '/\\.playwright-mcp($|/)',
      '/\\.vscode($|/)',
      '/playwright.*\\.config\\.ts$',
      '/vitest\\.config\\.ts$',
      '/vite\\.config\\.ts$',
    ],
  })

  process.stdout.write('Paketlendi: ' + appPaths.join(', ') + '\n')
}

main().catch((err) => {
  process.stderr.write('Paketleme başarısız: ' + (err && err.stack ? err.stack : String(err)) + '\n')
  process.exitCode = 1
})
