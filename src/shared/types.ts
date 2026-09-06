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
  /** QA düzeltme turu 1 (BLOKLAYICI-1) — dağıtıcının sistemik hata sınırının (`src/server/
   *  index.ts` `withDispatchErrorBoundary`) döndürdüğü genel 500 kodu; herhangi bir handler
   *  öngörülemeyen bir hata fırlattığında kullanılır. */
  | 'internal_error'
  /** F-007 sözleşme §2.2 — write-gate'in mimari §6'da zaten tanımlı kodları, `PATCH /api/
   *  features`'a bağlanınca ilk kez bir HTTP handler'ın ürettiği birleşime eklendi. */
  | 'write_denied'
  | 'write_failed'
  /** F-012 sözleşme §4 — CEO sohbet uçlarının kendi hata kodları. */
  | 'chat_disabled'
  | 'session_not_ready'
  | 'no_active_turn'
  | 'request_not_found'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { code: ErrorCode; message: string }
  meta?: {
    total?: number
    next_seq?: number
    /** F-007 sözleşme §5 D3 — `GET /api/features` bir proje kökü okunamadığında (EACCES vb.)
     *  diğer projeleri etkilemeden bunu bildirir, kartlar listesi boş kalır. */
    unreadable_projects?: Array<{ project_id: string; label: string }>
  }
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

/**
 * ADR-013 — dağıtıcı seviyesinde zorunlu yazma başlığı (F-006). Sunucu ve istemci aynı
 * dizgeyi elle kopyalamasın diye burada tanımlanır (`src/server/index.ts` + `src/web/lib/
 * write-fetch.ts` ikisi de bunu import eder). `POST /api/events` bu başlıktan muaftır —
 * onun yerine `Content-Type: application/json` zorunludur (CEO Karar 1).
 */
export const WRITE_HEADER_NAME = 'x-mc-write'
export const WRITE_HEADER_VALUE = '1'

/**
 * F-012 sözleşme §6 — panelin CEO sohbet ekranının **görüntüleme** geçmişi. Oturumun kendi
 * kaynak gerçeği SDK'nın transkriptidir (`resume: <session_id>`); bu tip yalnızca
 * `history-log.ts`'in ekleme-only kaydının tel biçimidir. `seq`, SSE'nin `chat_seq` alanıyla
 * AYNI sayaç (boşluk tespiti, sözleşme §5).
 */
export interface ChatLogEntry {
  seq: number
  turn_id: string
  role: 'user' | 'assistant' | 'system'
  kind: 'text' | 'tool' | 'permission_request' | 'permission_resolved' | 'question' | 'error'
  text?: string
  status: 'streaming' | 'done' | 'interrupted'
  ts: string
}

/**
 * Kanban kartı (F-007 sözleşme §3 madde 1, mimari §5.3). `docs/features/<file>.md`
 * frontmatter'ının bir alt kümesi + türetilmiş alanlar (`column`, `content_hash`, `mtime_ms`).
 * `parse_error` doluysa `id`/`title` dosya adından türetilir, diğer alanlar boş/varsayılan kalır
 * ve kart "Ayrıştırılamayan dosyalar" listesine gider (`column` bu durumda da `'unknown'`).
 */
export interface FeatureCard {
  project_id: string
  file: string
  id: string
  title: string
  status: string
  /** `STATUS_COLUMNS`'taki bilinen bir `key` veya `'unknown'` (ADR-001 karar 5). */
  column: string
  owner: string
  deps: string[]
  sprint: string
  /** `sha256(tam dosya baytları)`, hex — write-gate'in `expectedHash` karşılaştırmasıyla BİREBİR
   *  aynı kaynak (sözleşme §3 madde 2). */
  content_hash: string
  mtime_ms: number
  /** Frontmatter ayrıştırılamadıysa hata mesajı; başarılıysa `undefined`. */
  parse_error?: string
}
