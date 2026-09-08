import fs from 'node:fs'
import path from 'node:path'

export type ReadGuardResult =
  | { ok: true; targetPath: string }
  | { ok: false; reason: 'root-invalid' | 'not-found' | 'symlink' | 'outside-root' | 'not-allowed' }

/**
 * F-013 düzeltme turu (CEO kararı K2, QA bulgusu Ö4) — bu modülün TEK tüketicisi
 * `feature-detail.ts`, ve o modülün okuduğu her şey bu iki alt ağacın içinde kalmalı: gövde
 * dosyaları `docs/features/**`, sözleşme + QA raporları `docs/qa/**`. Ö4 ölçtü:
 * `resolveInsideRootForRead(root, ['..','..','package.json'])` gibi kök İÇİNDE ama bu iki
 * alt ağacın DIŞINDA bir çağrı (ör. `id` frontmatter'ından türeyen bir yol parçası kaza/kötü
 * niyetle `docs/qa` dışına çıkarsa) yalnızca "kök altında mı" kontrolünden geçip izlenen
 * projedeki HERHANGİ bir dosyayı (`.env`, `.git/config`) okunabilir hâle getiriyordu. En küçük
 * yetki ilkesi: kısıt burada, guard'ın içinde — çağıranın disipline güvenmiyoruz.
 */
const ALLOWED_PREFIXES: readonly string[][] = [
  ['docs', 'features'],
  ['docs', 'qa'],
]

function matchesAllowedPrefix(relFromRootPosix: string): boolean {
  const segments = relFromRootPosix.split('/')
  return ALLOWED_PREFIXES.some((prefix) => prefix.every((part, i) => segments[i] === part))
}

/**
 * F-013 sözleşme §3 — `src/server/write-gate.ts`'in `resolveInsideRoot`'unun KANITLANMIŞ
 * deseni (F-005/F-006), OKUMA yoluna uyarlanmış hâli: `node:path` + `fs.realpathSync.native` +
 * `path.relative` kapsama kontrolü + symlink savunması. Elle yol regex/replace YOK.
 *
 * `root` çağıranın önceden `fs.realpathSync.native` ile çözdüğü kanonik proje kökü olmalı
 * (`ProjectRecord.path`, `validate-path.ts`'in ürettiği gibi) — bu fonksiyon `root`'un
 * KENDİSİNE güvenmez, yine de var/dizin olduğunu ayrıca doğrular.
 *
 * `write-gate.ts`'ten FARKI: `OPERATION_PATTERNS` (işlem/hedef eşleşmesi) yok — çağıran zaten
 * sabit, önceden bilinen `relativeParts` verir; okuma tarafında hiçbir şey değişmediği için bu
 * ek kısıt gerekmiyor. `write-gate.ts`'in kendisi bu modülden import EDİLMEZ (ikinci bir tüketici
 * olmadan ortak bir dosyaya soyutlamak Karpathy §2 ihlali olurdu) — desen bilinçli olarak
 * tekrarlanır, `write-gate.ts`'e tek satır bile dokunulmaz.
 */
export function resolveInsideRootForRead(root: string, relativeParts: string[]): ReadGuardResult {
  if (!path.isAbsolute(root)) return { ok: false, reason: 'root-invalid' }

  let rootStat: fs.Stats
  try {
    rootStat = fs.statSync(root)
  } catch {
    return { ok: false, reason: 'root-invalid' }
  }
  if (!rootStat.isDirectory()) return { ok: false, reason: 'root-invalid' }

  const candidate = path.join(root, ...relativeParts)

  // Son segment HARİÇ tüm ata dizinler symlink olmamalı (son segment aşağıda ayrı kontrol edilir).
  let ancestorPath = root
  for (let i = 0; i < relativeParts.length - 1; i++) {
    ancestorPath = path.join(ancestorPath, relativeParts[i] ?? '')
    if (!fs.existsSync(ancestorPath)) return { ok: false, reason: 'not-found' }
    if (fs.lstatSync(ancestorPath).isSymbolicLink()) return { ok: false, reason: 'symlink' }
  }

  if (!fs.existsSync(candidate)) return { ok: false, reason: 'not-found' }
  if (fs.lstatSync(candidate).isSymbolicLink()) return { ok: false, reason: 'symlink' }

  // Windows büyük/küçük harf kanonikleştirmesi + savunma katmanı son kontrol (symlink'ler zaten
  // yukarıda elendi — güvenlik sınırı BURADA değil, `write-gate.ts`'in aynı yorumuyla tutarlı).
  const resolvedCandidate = fs.realpathSync.native(candidate)
  const relFromRoot = path.relative(root, resolvedCandidate)
  if (relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
    return { ok: false, reason: 'outside-root' }
  }

  // K2 — kök içinde ama izin verilen iki alt ağacın (docs/features, docs/qa) dışında kalan
  // her şey reddedilir (yukarıdaki `ALLOWED_PREFIXES` yorumu).
  const relFromRootPosix = relFromRoot.split(path.sep).join('/')
  if (!matchesAllowedPrefix(relFromRootPosix)) {
    return { ok: false, reason: 'not-allowed' }
  }

  return { ok: true, targetPath: candidate }
}
