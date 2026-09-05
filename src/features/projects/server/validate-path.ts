import fs from 'node:fs'
import path from 'node:path'

export interface ValidPath {
  ok: true
  path: string
}

export interface InvalidPath {
  ok: false
  /** `invalid_body` — yapısal (path yok/string değil/boş). `invalid_path` — semantik (§3 madde 7). */
  code: 'invalid_body' | 'invalid_path'
  message: string
}

/**
 * Savunmacı yol doğrulaması, yalnızca `node:path` + senkron `fs` (sözleşme §3 madde 7, D17).
 * Elle yol regex/replace yok. Sıra sözleşmenin adım sırasıyla birebir.
 */
export function resolveProjectPath(input: unknown): ValidPath | InvalidPath {
  // 1) yapısal kontrol
  if (typeof input !== 'string') {
    return { ok: false, code: 'invalid_body', message: 'path alanı zorunludur.' }
  }
  const trimmed = input.trim()
  if (trimmed === '') {
    return { ok: false, code: 'invalid_body', message: 'path alanı zorunludur.' }
  }

  // 2) mutlak yola çevir (`..` çözülür, göreli normalize edilir)
  const resolved = path.resolve(trimmed)

  // 3) sürücü kökü
  const rootToken = path.parse(resolved).root
  if (rootToken === resolved) {
    return { ok: false, code: 'invalid_path', message: 'Sürücü kökü izlenemez.' }
  }

  // 4) UNC — `path.parse`'ın izole kök tokenı üzerinde kontrol (elle yol regex/replace değil)
  if (rootToken.startsWith('\\\\')) {
    return { ok: false, code: 'invalid_path', message: 'Ağ/UNC yolları desteklenmiyor.' }
  }

  // 5) var mı
  if (!fs.existsSync(resolved)) {
    return { ok: false, code: 'invalid_path', message: 'Bu yol bulunamadı.' }
  }

  // 6) klasör mü
  let stat: fs.Stats
  try {
    stat = fs.statSync(resolved)
  } catch {
    return { ok: false, code: 'invalid_path', message: 'Bu yol bulunamadı.' }
  }
  if (!stat.isDirectory()) {
    return { ok: false, code: 'invalid_path', message: 'Bu bir klasör değil.' }
  }

  // 7) kanonik gerçek yol — `fs.realpathSync.native` (D17: düz `realpathSync` Windows'ta
  //    büyük/küçük harfi kanonikleştirmez, bkz. sözleşme §3 madde 4 ampirik ölçüm 2).
  const real = fs.realpathSync.native(resolved)

  // 8) docs/features var mı + klasör mü
  const featuresDir = path.join(real, 'docs', 'features')
  if (!fs.existsSync(featuresDir) || !fs.statSync(featuresDir).isDirectory()) {
    return {
      ok: false,
      code: 'invalid_path',
      message: 'Bu klasörde docs/features bulunamadı. Yolu kontrol edin.',
    }
  }

  // 9) kabul
  return { ok: true, path: real }
}
