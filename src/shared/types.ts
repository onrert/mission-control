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
  /**
   * Ö7 düzeltmesi (`docs/qa/o7-agent-satirlari-contract.md`) — yalnızca `kind==='tool'` iken
   * dolu. `tool_use_id`, aynı turdaki birden fazla araç çağrısını `foldByTurn`'de ayırt etmek
   * (anahtar `tool::${tool_use_id}`, turn_id/role'den BAĞIMSIZ) ve sayfa yenilemesinde
   * `toolRows`'u yeniden inşa etmek için gerekli. `elapsed_ms`, yalnızca `tool_status`
   * `'finished'`/`'error'` iken dolar; istemci başlangıç anını bundan geri hesaplar (§ kronoloji
   * kararı) — ayrı bir `started_ts` alanı YOKTUR (gereksiz, `ts - elapsed_ms` yeterli).
   */
  tool_use_id?: string
  tool_name?: string
  tool_status?: 'started' | 'finished' | 'error'
  elapsed_ms?: number
}

/**
 * G5 Tur 4 (4-Ek3) düzeltmesi — `session.ts`'in `buildInputPreview`'ı ve `ChatScreen.tsx`'in
 * `PermissionCard`'ı bu iki sabiti PAYLAŞIR (bkz. `docs/qa/g5-tur4-izin-karti-onizlemesi-
 * contract.md`). Sunucu `input_preview` alanına yeni bir alan EKLEMEZ (kapalı allowlist,
 * `tests/integration/chat-api.test.ts` "Ö3") — istemci uzunluk uyarısını doğrudan
 * `input_preview.length`'ten hesaplar; bu doğrudur çünkü artık önizleme = çalışacak komutun
 * TAMAMI (kırpma yok).
 */
export const INPUT_PREVIEW_WARN_THRESHOLD = 500
/** Bu sınırı aşan komutlar `OVERSIZED_INPUT_PREVIEW_MARKER` ile değiştirilir — sessizce
 *  KESİLMEZ (fail-closed, bkz. sözleşme §tasarım kararı 3). */
export const INPUT_PREVIEW_HARD_CAP = 20_000
export const OVERSIZED_INPUT_PREVIEW_MARKER =
  '⚠ GÜVENLİK: Bu komut önizlemesi güvenli şekilde gösterilemeyecek kadar uzun'

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

/**
 * F-013 sözleşme §2 — kart tıklanınca açılan pencerenin gövde/sözleşme/QA rapor içerikleri.
 * `GET /api/features/detail`'in tel tipi. Her belge bağımsız `exists`/`truncated`/`error`
 * taşır — biri okunamasa/olmasa bile diğerleri etkilenmez.
 */
export interface FeatureDetailDocument {
  exists: boolean
  content?: string
  /** Boyut sınırı (200.000 karakter) aşılıp kırpıldıysa `true` — sessiz kırpma YASAK, istemci
   *  bunu görünür şekilde bildirir. */
  truncated?: boolean
  /** Dosya var ama okunamadıysa (izin, silinmiş yarış durumu vb.) sabit Türkçe metin. */
  error?: string
}

export interface FeatureDetailReport extends FeatureDetailDocument {
  file: string
}

/** `docs/qa/<id>-*.md` sözleşmesi ve gövde birlikte. `id`, gövde dosyasının frontmatter'ından
 *  SUNUCU tarafında türetilir (istemciden alınmaz). */
export interface FeatureDetail {
  /** `docs/features/<file>.md`'nin TAM byte hash'i — `FeatureCard.content_hash` ile AYNI
   *  algoritma; istemci bunu kendi elindeki karta karşı ölçüp bayatlığı/tazelemeyi yönetir
   *  (F-013 sözleşme §6 — yeni bir mekanizma icat edilmedi). */
  content_hash: string
  body: FeatureDetailDocument
  contract: FeatureDetailDocument
  qa_reports: FeatureDetailReport[]
}

/**
 * F-010 sözleşmesi — Thread ekranının tel tipi (`GET /api/thread/detail`). Birincil kaynak
 * `docs/qa/<id>-contract.md` + `docs/qa/*.md` (ADR-007 karar 2), F-013'ün `feature-detail.ts`'i
 * ÜZERİNDEN okunur — ikinci bir dosya okuma yolu İCAT EDİLMEDİ (CEO kararı W1). `sections` her
 * zaman: gövde (CEO brief) ilk sırada, ardından sözleşme (Developer raporu) + QA raporları
 * GERÇEK dosya `mtime`'ına göre artan sırada KARIŞIK listelenir (QA düzeltme turu 1, X5/Ö5 —
 * sözleşme rol'e göre sabit ikinci sırada DEĞİL, gerçek zamanına göre), en sonda transkript
 * zenginleştirmesi (best-effort, ADR-007 karar 2, kronolojiye dahil değil).
 */
export type ThreadSectionKind = 'ceo_brief' | 'developer_report' | 'qa_verdict' | 'transcript'

export interface ThreadSection {
  kind: ThreadSectionKind
  title: string
  /** Kaynak dosyanın `mtime`'ı, ISO 8601. Bilinmiyorsa (ör. transkript hiç bulunamadıysa) `null`. */
  timestamp: string | null
  /** `readable:false` iken her zaman `null` — arayüz "Bu bölüm okunamadı." gösterir (PRD F5/
   *  AC2/AC3: ham hata/stack trace ASLA buraya gelmez). */
  content: string | null
  readable: boolean
  /** Yalnızca `kind:'qa_verdict'` iken dolabilir — `docs/qa/*.md`'nin ilk satırından ayrıştırılır. */
  verdict?: 'GEÇTİ' | 'KALDI' | null
}

/** `GET /api/thread/detail?project_id=…&file=…`'in tel tipi (F-010 sözleşmesi). */
export interface ThreadDetail {
  feature_id: string
  /** PRD F5/AC4 — `docs/qa/latest.md` bu feature'a aitse VE içinde `ESKALE: true` varsa. */
  eskale: boolean
  sections: ThreadSection[]
}

/**
 * F-011 sözleşmesi §1 — `transcript-reader.ts`'in (F-009) `TranscriptUsageTotals`'ıyla
 * YAPISAL OLARAK aynı dört alan. Ayrı tanımlanır çünkü `shared/types.ts` bir feature'ın sunucu
 * modülünü (`src/features/thread/server/transcript-reader.ts`) import ETMEZ (katman ihlali) —
 * `ThreadDetail`'in kendi bölüm tiplerini bağımsız tanımlamasıyla AYNI karar.
 */
export interface TokenUsageTotals {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

/** F-011 sözleşmesi §1 madde 4 — bir oturum içinde tek bir agent'ın (`"ana oturum"` veya
 *  `subagents/*.meta.json`'daki `agentType`, yoksa `"bilinmiyor"`) token toplamı. */
export interface UsageAgentTotal {
  agent: string
  usage: TokenUsageTotals
}

/** Tek bir `.jsonl` oturumunun (ana dosya + o dosyanın adını taşıyan `subagents/` alt dizini)
 *  agent kırılımı. */
export interface UsageSessionTotal {
  session_id: string
  agents: UsageAgentTotal[]
  usage: TokenUsageTotals
}

/** F-011 §1 madde 3 — gün, dosyanın kendi `mtime`'ının takvim günüdür (satır-bazlı zaman damgası
 *  DEĞİL — gerekçe sözleşmede). `YYYY-MM-DD` biçimi. */
export interface UsageDayTotal {
  day: string
  sessions: UsageSessionTotal[]
  usage: TokenUsageTotals
}

export interface UsageProjectTotal {
  project_id: string
  project_label: string
  days: UsageDayTotal[]
  usage: TokenUsageTotals
}

/**
 * `GET /api/usage`'ın tel tipi (F-011 sözleşmesi). Proje filtresi YOK — tüm izlenen projeler tek
 * yanıtta. Hiçbir transkript bulunamayan projeler `projects` dizisinde YER ALMAZ (dürüst boş
 * durum — uydurma sıfır satır yok).
 */
export interface UsageReport {
  projects: UsageProjectTotal[]
  usage: TokenUsageTotals
  lines_ok: number
  lines_bad: number
  /** F-011 QA düzeltme turu (Z4/Ö1) — geçerli JSON ama tanınmayan `type` taşıyan satır sayısı
   *  (`lines_ok`'a dahildir, ayrı bir alt küme). `degraded` artık bunu da hesaba katar — bir
   *  transkript formatı değişimi TÜM satırları tanınmaz yapabilir, `lines_bad` sıfır kalsa bile. */
  unknown_type_lines: number
  /** F-011 QA düzeltme turu (Z4/Ö2) — guard'dan geçtikten SONRA gerçekten okunamayan (EPERM/…)
   *  dosya sayısı. `>0` iken bu dosyaların token verisi toplama dahil DEĞİLDİR (sessiz kısmi
   *  başarı yok — `degraded:true` VE istemcide görünür uyarı). */
  unreadable_file_count: number
  /** F-011 QA düzeltme turu (Z4/Ö3) — 64 MB eşiğini aşıp yalnızca son 32 MB'ı okunan dosya sayısı
   *  (satır sınırı bulunmuş olsa bile, dosyanın BAŞI sessizce kaybolmuştur). `>0` iken
   *  `degraded:true` VE istemcide görünür uyarı. */
  truncated_file_count: number
  /** ADR-007 azaltımı — tanınan satır oranı eşiğin altına düşerse VEYA `unreadable_file_count`/
   *  `truncated_file_count` sıfırdan büyükse `true` (F-011 §1 madde 8, QA düzeltme turu Z4). */
  degraded: boolean
  /** PRD F6/AC2 — `claudeProjectsRoot`'un kendisi bulunamadı VEYA listelenemedi (EPERM vb.).
   *  `true` iken `projects` her zaman boştur; istemci "Token verisi okunamadı…" gösterir. */
  source_unreadable: boolean
}

/**
 * F-008 sözleşmesi §4 — `docs/approvals/` içeriğinden türetilen tek bir kapının durumu.
 * `error:true` ise `status` yalnızca güvenli bir varsayılandır (`'pending'`) — gerçek durum
 * `fs.statSync` başarısız olduğu için belirlenemedi, istemci "Durum belirlenemedi" gösterir
 * (§3 "Satır bazlı hata izolasyonu").
 */
export type GateStatus = 'pending' | 'approved' | 'denied' | 'conflict'

export interface GateStatusItem {
  /** `"G2"`, `"ASSETS"`, `"G4-1"` gibi. */
  id: string
  label: string
  status: GateStatus
  error?: boolean
  /** `mtime` kaynaklı, `"YYYY-MM-DD"` (§3 — dosya içeriğindeki serbest metin tarih PARSE EDİLMEZ). */
  ok_date?: string
  deny_date?: string
  /** Yalnızca `status === 'conflict'` iken dolu. */
  newer_side?: 'ok' | 'deny'
}

/** `GET /api/gates?project_id=…`'in tel tipi (F-008 sözleşmesi §4). */
export interface GatesListResponse {
  gates: GateStatusItem[]
  /** Kapı desenine uymayan ama hariç tutma kümesinde de olmayan dosya/dizin adları (§3). */
  unrecognized: string[]
  /** `false` ise `BASE_CATALOG` gömülü yedek etiketlerle gösterilir (§3). */
  process_doc_readable: boolean
}
