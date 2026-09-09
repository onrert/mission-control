// F-008 sözleşmesi §4/§10.1 — kapı tanımlayıcısı için PAYLAŞILAN (server + gelecekte web)
// saf yardımcılar. `fs` importu yok.

/**
 * write-gate.ts'in kendi `GATE_PATTERN`'iyle AYNI metin (ayrı kopya — gerçek güvenlik sınırı
 * write-gate.ts'in kendisidir, bu yalnızca daha iyi bir 400 mesajı için ön-doğrulamadır, §4).
 */
const GATE_ID_PATTERN = /^(G[0-6](-\d{1,3})?|ASSETS)$/

export function isValidGateId(id: string): boolean {
  return GATE_ID_PATTERN.test(id)
}

export interface ParsedGateFileName {
  gateId: string
  kind: 'ok' | 'deny'
}

// §3 "Dosya taraması" — `.ok` ve `.deny.md` için ayrı desenler (grup kaymasını önlemek için).
// Tur 4 (S2, QA Bulgu 1 düzeltmesi): `i` bayrağıyla harfe DUYARSIZ — Windows'ta (ADR-009) bu
// dosyaların DURUMU zaten `fs.existsSync` (harfe duyarsız) ile türetiliyor
// (`list-gates.ts` `getGateStatus`); tarama katmanı harfe duyarlı kalırsa aynı dosya iki
// katmanda farklı sınıflandırılır (`g2.ok` hem "tanınmayan" hem "G2 onaylı"). Kabul edilen
// davranış: küçük/karışık harfli bir dosya normal bir kapı dosyası gibi TANINIR (reddedilmez) —
// `.claude/hooks/gate-check.cjs`'in kendi harfe-duyarsız `existsSync` kontrolüyle TUTARLI kalmak
// için (o dosya bu feature'ın sahipliğinde değil, değiştirilmiyor).
const OK_FILE_PATTERN = /^(G[0-6](-\d{1,3})?|ASSETS)\.ok$/i
const DENY_FILE_PATTERN = /^(G[0-6](-\d{1,3})?|ASSETS)\.deny\.md$/i

/** `docs/approvals/` altındaki bir dosya adını kapı id'si + türe ayrıştırır. Eşleşmezse `undefined`.
 *  `gateId` her zaman KANONİK büyük harfle döner (S2) — `g2.ok` → `gateId: 'G2'`. */
export function parseGateFileName(fileName: string): ParsedGateFileName | undefined {
  const okMatch = OK_FILE_PATTERN.exec(fileName)
  if (okMatch) return { gateId: okMatch[1]!.toUpperCase(), kind: 'ok' }
  const denyMatch = DENY_FILE_PATTERN.exec(fileName)
  if (denyMatch) return { gateId: denyMatch[1]!.toUpperCase(), kind: 'deny' }
  return undefined
}

/**
 * Kapı id'si + etiketini tek bir görüntülenebilir başlığa birleştirir (S3, QA Bulgu 4 düzeltmesi).
 * Ayırt edici bir etiket yoksa (`label === id` — ör. `ASSETS`, `G4-1` gibi PROCESS.md'de eşi
 * olmayan id'ler, bkz. `list-gates.ts`'in `label = id` fallback'i) id TEK BAŞINA döner — aksi
 * hâlde "ASSETS ASSETS" / "G4-1 G4-1" gibi bir tekrar hem ekranda hem kalıcı `.ok`/`.deny.md`
 * içeriğinde oluşur. `separator` çağıran yerin MEVCUT biçimini korur (GateRow boşluk, modal/
 * format-approval em-dash kullanıyordu — S3 yalnızca tekrarı kaldırıyor, biçimi birleştirmiyor).
 */
export function formatGateTitle(id: string, label: string, separator = ' — '): string {
  return label === id ? id : `${id}${separator}${label}`
}

// §3 "Dosya taraması" — altı sınıf `unrecognized` listesine hiç girmez: belge (`README.md`),
// yazma hedefi dizini (`archive`), block-dangerous.cjs'in tek kullanımlık onay dosyaları
// (`DANGER.ok`/`PUSH.ok` — kapı onayı DEĞİL), `.gitkeep`, ve write-gate.ts'in kendi atomik
// yazma geçici dosyaları (`.`ile başlayan/`.tmp` ile biten). Bu liste hem `list-gates.ts`'in
// tarama/unrecognized ayrımında hem `gates-watcher.ts`'in kendi tetikleme filtresinde AYNI
// şekilde kullanılır (Ö2 — ikisi de aynı hariç tutma kümesini uygulamalı, aksi hâlde her onay
// kendi `.tmp` dosyası yüzünden fazladan SSE yayını yapar).
const EXCLUDED_EXACT_NAMES = new Set(['README.md', 'archive', 'DANGER.ok', 'PUSH.ok', '.gitkeep'])

export function isExcludedApprovalsEntry(name: string): boolean {
  if (EXCLUDED_EXACT_NAMES.has(name)) return true
  if (name.startsWith('.')) return true
  if (name.endsWith('.tmp')) return true
  return false
}
