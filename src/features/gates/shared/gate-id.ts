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
const OK_FILE_PATTERN = /^(G[0-6](-\d{1,3})?|ASSETS)\.ok$/
const DENY_FILE_PATTERN = /^(G[0-6](-\d{1,3})?|ASSETS)\.deny\.md$/

/** `docs/approvals/` altındaki bir dosya adını kapı id'si + türe ayrıştırır. Eşleşmezse `undefined`. */
export function parseGateFileName(fileName: string): ParsedGateFileName | undefined {
  const okMatch = OK_FILE_PATTERN.exec(fileName)
  if (okMatch) return { gateId: okMatch[1]!, kind: 'ok' }
  const denyMatch = DENY_FILE_PATTERN.exec(fileName)
  if (denyMatch) return { gateId: denyMatch[1]!, kind: 'deny' }
  return undefined
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
