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
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const require = createRequire(import.meta.url)

// QA F-014 (2026-09-06, KALDI) Ö4 düzeltmesi — bu isimler ölçülerek doğrulandı: `prune:true`
// bunları paketlenmiş `node_modules`'tan temizlemiyor (boş de olsa `@electron/packager`'ın
// prune adımı klasörleri bırakıyor). `esbuild`/`@esbuild` BİLEREK bu listede DEĞİL — `tsx`
// (üretim bağımlılığı, `electron/main.cjs` çalışma zamanında `require('tsx/cjs/api')` çağırıyor)
// `.ts` dosyalarını ÇALIŞMA ZAMANINDA `esbuild` ile transpile ediyor; ölçüldü (`npm ls esbuild`):
// hoisted tepe-seviye `node_modules/esbuild` tsx'in kendi sürümü, vite'ın (derleme-zamanı)
// sürümü ayrıca `node_modules/vite/node_modules/esbuild`'de iç içe duruyor ve zaten `prune`
// tarafından doğru şekilde temizleniyor. `esbuild`'i buraya eklemek uygulamayı AÇILIŞTA
// çökertirdi (bir kez ölçüldü, geri alındı).
const KNOWN_DEV_ONLY_NODE_MODULES_LEAKS = [
  '@playwright',
  'playwright',
  '@vitest',
  'vitest',
  '@vitejs',
  'vite',
  '@testing-library',
]

// H1 (QA F-014 B2 düzeltmesi) — `electron/main.cjs`'in `resolveProjectDir()`'ı paketlenmiş bir
// çalıştırmada (`app.isPackaged === true`) ve `MC_PROJECT_DIR` override'ı YOKKEN bu dosyayı okur.
// Böylece barındırılan CEO oturumunun çalışma dizini paketlenmiş kopyaya (`resources/app`) değil,
// paketleme ANINDAKİ gerçek depo köküne sabitlenir — ADR-014'ün "bu araç dağıtılmayacak, tek
// makine/tek kullanıcı" kararına dayanan makul bir varsayılan (yapılandırılabilir kalır:
// `MC_PROJECT_DIR` her zaman önceliklidir). Git'e COMMIT EDİLMEZ (`.gitignore`) — her paketleme
// çalıştırmasında o anki `repoRoot` ile yeniden üretilir.
function writeProjectDirDefault() {
  const target = path.join(__dirname, '..', 'electron', 'project-dir.generated.cjs')
  const contents =
    '// Otomatik üretildi (scripts/package-electron.mjs) — elle düzenlemeyin.\n' +
    `module.exports = { PROJECT_DIR: ${JSON.stringify(repoRoot)} }\n`
  fs.writeFileSync(target, contents)
}

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

/**
 * Ö4 düzeltmesi — paketleme çıktısını gerçek dosya sisteminde tarar, `ignore` listesinin
 * KAĞIT ÜZERİNDE değil GERÇEKTE işe yaradığını doğrular. Bulgu varsa paketleme BAŞARISIZ olur
 * (sessizce sızdırılmış bir artefakt teslim edilmez).
 */
function assertNoLeakedDevArtifacts(appPath) {
  const resourcesAppDir = path.join(appPath, 'resources', 'app')
  const forbiddenTopLevel = ['.claude', 'docs', 'tests', '.git', '.github']
  const leaks = []
  for (const name of forbiddenTopLevel) {
    if (fs.existsSync(path.join(resourcesAppDir, name))) leaks.push(name)
  }
  const nodeModulesDir = path.join(resourcesAppDir, 'node_modules')
  if (fs.existsSync(nodeModulesDir)) {
    for (const name of KNOWN_DEV_ONLY_NODE_MODULES_LEAKS) {
      if (fs.existsSync(path.join(nodeModulesDir, name))) leaks.push(`node_modules/${name}`)
    }
  }
  if (leaks.length > 0) {
    throw new Error(
      `Paketleme çıktısında olmaması gereken yollar bulundu: ${leaks.join(', ')}. ` +
        '`ignore` listesini genişletin (scripts/package-electron.mjs).'
    )
  }
}

function directorySizeBytes(dir) {
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      total += directorySizeBytes(full)
    } else {
      total += fs.statSync(full).size
    }
  }
  return total
}

async function main() {
  assertTsxIsRuntimeDependency()
  writeProjectDirDefault()

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
      ...KNOWN_DEV_ONLY_NODE_MODULES_LEAKS.map(
        (name) => `/node_modules/${name.replace(/^@/, '\\@')}($|/)`
      ),
    ],
  })

  for (const appPath of appPaths) {
    assertNoLeakedDevArtifacts(appPath)
  }

  const sizeMb = (directorySizeBytes(appPaths[0]) / (1024 * 1024)).toFixed(1)
  process.stdout.write('Paketlendi: ' + appPaths.join(', ') + '\n')
  process.stdout.write(`Paket boyutu: ${sizeMb} MB (${appPaths[0]})\n`)
}

main().catch((err) => {
  process.stderr.write('Paketleme başarısız: ' + (err && err.stack ? err.stack : String(err)) + '\n')
  process.exitCode = 1
})
