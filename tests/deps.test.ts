import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const lockPath = path.join(__dirname, '..', 'package-lock.json')
const lockRaw = fs.readFileSync(lockPath, 'utf8')
type PackageMeta = { hasInstallScript?: boolean; optional?: boolean; os?: string[] }
const lock = JSON.parse(lockRaw) as { packages: Record<string, PackageMeta> }

function packageNameFromPath(pkgPath: string): string {
  return pkgPath.replace(/^node_modules\//, '').replace(/.*\/node_modules\//, '')
}

// Önceden derlenmiş ikili İNDİREN, derleme YAPMAYAN paketler (G2/S2 yasağı "derleme"dir,
// ikili indirme değil — mimari §3.2).
const ALLOWED_INSTALL_SCRIPT_PACKAGES = new Set(['esbuild', 'playwright'])

// `fsevents` (chokidar/rollup/vite'ın transitive bağımlılığı) BU kategoride DEĞİLDİR: kendi
// `install`/`build` script'leri `node-gyp rebuild` çağırır ve `gypfile: true` taşır — yani
// gerçekten node-gyp ile KAYNAKTAN DERLENEN bir native pakettir (npm registry'den doğrulandı,
// QA F-001 bulgusu B2). Yine de beyaz listeye alınabilir çünkü lock'taki HER kaydı
// `optional: true` + `os: ['darwin']`'dir: Windows/Linux'ta hiç kurulmaz, script'i hiç
// çalışmaz; macOS'ta derlenir ama `optional` olduğu için başarısız olsa bile `npm install`
// çıkış kodunu bozmaz. Bu koşulu (çıplak isim değil) assert ediyoruz ki fsevents ileride
// zorunlu hale gelir veya darwin dışı bir OS'a yayılırsa test kırılsın.
function isAllowedFsevents(pkgPath: string): boolean {
  const meta = lock.packages[pkgPath]
  if (!meta) return false
  return meta.optional === true && Array.isArray(meta.os) && meta.os.length === 1 && meta.os[0] === 'darwin'
}

function isAllowed(pkgPath: string): boolean {
  const name = packageNameFromPath(pkgPath)
  if (ALLOWED_INSTALL_SCRIPT_PACKAGES.has(name)) return true
  if (name.startsWith('@esbuild/')) return true
  if (name === '@playwright/test') return true
  if (name === 'fsevents') return isAllowedFsevents(pkgPath)
  return false
}

describe('package-lock.json bağımlılık güvenliği', () => {
  it('hasInstallScript olan tüm paketler bilinen beyaz listede (derlemesiz VEYA darwin-only opsiyonel)', () => {
    const offenders = Object.entries(lock.packages)
      .filter(([, meta]) => meta.hasInstallScript === true)
      .map(([pkgPath]) => pkgPath)
      .filter((pkgPath) => !isAllowed(pkgPath))
    expect(offenders).toEqual([])
  })

  // NOT — bu assert'in bilinen sınırı: package-lock.json paketlerin devDependency'lerini
  // (ör. fsevents'in kendi `node-gyp` bağımlılığını) KAYDETMEZ; npm kurulum sırasında
  // kendi dahili/bundled node-gyp kopyasını kullanır ve bu asla lock dosyasına yazılmaz.
  // Yani bu test "node-gyp hiçbir zaman çalışmaz" demez — yalnızca projenin bağımlılık
  // ağacına *doğrudan bir paket olarak* bir native derleme aracı (node-gyp,
  // prebuild-install, node-addon-api, nan) eklenmediğini doğrular; bu, üstteki
  // `hasInstallScript` + beyaz liste kontrolüyle birlikte anlamlıdır, tek başına değil.
  it('native derleme araçları (node-gyp, prebuild-install, node-addon-api, nan) bağımlılık ağacında paket olarak yer almıyor', () => {
    const nativeToolNames = new Set(['node-gyp', 'prebuild-install', 'node-addon-api', 'nan'])
    const offenders = Object.keys(lock.packages)
      .map(packageNameFromPath)
      .filter((name) => nativeToolNames.has(name))
    expect(offenders).toEqual([])
  })

  it('better-sqlite3 hiç geçmiyor', () => {
    expect(lockRaw.includes('better-sqlite3')).toBe(false)
  })
})
