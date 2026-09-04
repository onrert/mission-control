import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const lockPath = path.join(__dirname, '..', 'package-lock.json')
const lockRaw = fs.readFileSync(lockPath, 'utf8')
const lock = JSON.parse(lockRaw) as { packages: Record<string, { hasInstallScript?: boolean }> }

// Önceden derlenmiş ikili indiren, derleme YAPMAYAN paketler (G2/S2 yasağı "derleme"dir,
// ikili indirme değil — mimari §3.2). `fsevents` chokidar/rollup'ın darwin-only opsiyonel
// bağımlılığıdır (bkz. `optional: true, os: ['darwin']` package-lock.json'da); Windows/Linux'ta
// hiç kurulmaz, script'i hiç çalışmaz; macOS'ta da prebuilt ikili indirir, node-gyp/derleme
// gerektirmez. Bu, sözleşmenin §3 beyaz listesinin (esbuild/@esbuild/*/playwright/@playwright/test)
// gerçek `npm install` çıktısına göre bir satırlık, gerekçeli genişletmesidir (ADR gerekmez —
// yeni bir doğrudan bağımlılık eklenmiyor, yalnızca mevcut transitive dependency'nin whitelist'e
// tanınması).
const ALLOWED_INSTALL_SCRIPT_PACKAGES = new Set(['esbuild', 'playwright', 'fsevents'])

function isAllowed(pkgPath: string): boolean {
  const name = pkgPath.replace(/^node_modules\//, '').replace(/.*\/node_modules\//, '')
  if (ALLOWED_INSTALL_SCRIPT_PACKAGES.has(name)) return true
  if (name.startsWith('@esbuild/')) return true
  if (name === '@playwright/test') return true
  return false
}

describe('package-lock.json bağımlılık güvenliği', () => {
  it('hasInstallScript olan tüm paketler bilinen, derlemesiz beyaz listede', () => {
    const offenders = Object.entries(lock.packages)
      .filter(([, meta]) => meta.hasInstallScript === true)
      .map(([pkgPath]) => pkgPath)
      .filter((pkgPath) => !isAllowed(pkgPath))
    expect(offenders).toEqual([])
  })

  it('native derleme araçları (node-gyp, prebuild-install, node-addon-api, nan) hiç geçmiyor', () => {
    for (const needle of ['node-gyp', 'prebuild-install', 'node-addon-api', '"nan"']) {
      expect(lockRaw.includes(needle)).toBe(false)
    }
  })

  it('better-sqlite3 hiç geçmiyor', () => {
    expect(lockRaw.includes('better-sqlite3')).toBe(false)
  })
})
