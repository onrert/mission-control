// Paylaşılan tipler (hem sunucu hem tarayıcıdan import edilebilir). F-002 yalnızca kendi
// kullandığı alt kümeyi tanımlar; `ProjectRecord`/`FeatureCard`/`GateState` ileriki
// feature'larda eklenecek (bkz. `docs/qa/F-002-contract.md` §2.1).

/** JSONL'de satır başına bir kayıt. Mimari §5.1 — F-002'nin doldurduğu alanlar. */
export interface EventRecord {
  seq: number
  id: string
  ts: string
  received_ms: number
  project_path: string
  project_name: string
  /** F-005 (proje kayıt defteri) yokluğunda bu feature'da her zaman `undefined` kalır. */
  project_id?: string
  hook_event_name: string
  session_id?: string
  agent_id?: string
  agent_type?: string
  tool_name?: string
  tool_use_id?: string
  permission_mode?: string
  transcript_path?: string
  prompt_id?: string
  summary: string
  flags: string[]
  raw: unknown
}

/**
 * F-002'nin ürettiği/tükettiği hata kodları (mimari §6'nın alt kümesi).
 * `storage_unavailable` — QA düzeltme turu 1 (B1): gerçek bir disk I/O hatası (ör. gün
 * dosyası yolunda beklenmeyen bir dizin, disk dolu) yüzünden olay saklanamadığında döner.
 * PRD F1/AC5'in "5xx dönmez" kuralı yalnızca payload kaynaklı sorunlar (eksik/bilinmeyen alan)
 * içindir — gerçek depolama arızası bu kuralın kapsamı dışındadır (bkz. `docs/qa/
 * F-002-contract.md` "Kod turu notu — B1").
 */
export type ErrorCode =
  | 'invalid_body'
  | 'forbidden_origin'
  | 'storage_unavailable'
  | 'invalid_path'
  | 'conflict'
  | 'not_found'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { code: ErrorCode; message: string }
  meta?: { total?: number; next_seq?: number }
}

/** İzlenen proje kaydı (mimari §5.2, F-005). `data/projects.json`'daki `projects[]` şeması. */
export interface ProjectRecord {
  id: string
  path: string
  label: string
  added_at: string
  enabled: boolean
}

/**
 * `GET /api/projects` ve `projects` SSE kanalının tel tipi. `exists`/`feature_count` sunucu
 * tarafında her istekte canlı hesaplanır, kalıcı değildir (sözleşme §3 madde 5).
 */
export interface ProjectListItem extends ProjectRecord {
  exists: boolean
  feature_count: number
}
