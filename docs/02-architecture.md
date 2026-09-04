# 02 — Mimari (Mission Control)

- **Tarih:** 2026-09-04
- **Durum:** G2 onayına sunuldu
- **Kaynaklar:** `docs/01-prd.md` (onaylı), `docs/approvals/G0.ok`, `docs/approvals/G1.ok`, `docs/decisions/ADR-001-mission-control-urun-kararlari.md`, `docs/00-idea-validation.md`, `C:\dev\app-factory\docs\PROCESS.md`
- **Kararlar:** ADR-002 … ADR-007 (bu dosyayla birlikte `docs/decisions/`)

Bu doküman **ne** inşa edileceğini ve **sınırların** nerede olduğunu tanımlar. Fonksiyon imzaları, bileşen ağacı, CSS sınıfları ve dosya-içi düzen developer'ın kararıdır. Aşağıdaki kod blokları **örnek/şablon**dur, kopyalanacak nihai kaynak değildir (G2 onayı öncesi `src/` altında hiçbir dosya yok).

---

## 1. Özet ve bağlayıcı sınırlar

Mission Control tek kullanıcılık, tamamen yerel bir izleme panosudur. Üç dış dünya bağlantısı vardır ve hepsi `127.0.0.1` üzerindedir:
1. İzlenen projelerin Claude Code hook'ları → HTTP POST → sunucu.
2. İzlenen projelerin `docs/` klasörleri → chokidar dosya izleme → sunucu (**okuma**).
3. Panelin yazma kapısı → izlenen projelerin **üç beyaz listeli yolu** (yazma).

Aşağıdaki sınırlar mimari düzeyde zorlanır, tercih değildir:

| # | Sınır | Nasıl zorlanır (mimari mekanizma) |
|---|---|---|
| S1 | Yalnızca yerel; dış servis/hesap/telemetri yok | Kodda hiçbir dış hostname yok; `listen(port, '127.0.0.1')`; Host/Origin beyaz listesi (§10). Test: bağımlılık ve kaynak taraması. |
| S2 | Native derleme (node-gyp) gerektiren bağımlılık yok | Bağımlılık tablosu (§3.4) kapalı listedir; hiçbiri derleme gerektirmez. `better-sqlite3` yasak (ADR-003). |
| S3 | Varsayılan port 4000 değil | `MC_PORT` varsayılan **7333** (§3.5). |
| S4 | Panel yalnızca 3 yola yazar | Tek yazma kapısı modülü + yol beyaz listesi (§7, ADR-005). Yazma API'lerinin başka dosyadan import'u statik guard testiyle engellenir (§11.4). |
| S5 | Faz 2 ayrıştırma best-effort | Satır bazlı `try/catch`, bozuk satır sayacı, yalnızca ilgili görünüm "okunamadı" (§9). |
| S6 | Windows birincil, macOS destekli | **Yol işlemlerinde elle regex yasak** — yalnızca `node:path` API'si (§3.6). |
| S7 | Kabul kriterleri otomatik doğrulanabilir | Playwright + vitest eşlemesi (§11). |

---

## 2. Sistem şeması

```
                 İZLENEN PROJELER (N adet, ör. C:\dev\apps\*)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  Claude Code oturumu (ceo / developer / qa-evaluator / subagent)          │
 │        │                                                                 │
 │        │ hook tetiklenir (PreToolUse, PostToolUse, SubagentStop, ...)     │
 │        ▼                                                                 │
 │  .claude/hooks/send-event.cjs   (async, timeout 5s, ASLA bloklamaz)       │
 │        │ stdin: hook JSON                                                │
 │        │                                                                 │
 │  docs/features/*.md   docs/approvals/*   docs/qa/*   (diskte dosyalar)    │
 └────────┼───────────────────────────┬───────────────────────▲─────────────┘
          │ HTTP POST /api/events     │ dosya değişikliği     │ YAZMA
          │ 127.0.0.1:7333, 400ms t/o │ (chokidar izler)      │ (yalnızca 3 yol)
          ▼                           ▼                       │
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  MISSION CONTROL SUNUCUSU  (tek Node süreci, node:http, 127.0.0.1:7333)  │
 │                                                                          │
 │  ingest ──► normalizer ──► JSONL depo (data/events/YYYY-MM-DD.jsonl)     │
 │    │                            │  append-only, tek yazar, retention     │
 │    │                            ▼                                        │
 │    └──────────────────────► seq ring buffer (bellek, son N olay)         │
 │                                 │                                        │
 │  watcher (chokidar) ──► feature/gate durum önbelleği ──┐                 │
 │                                 │                      │                 │
 │  YAZMA KAPISI (write-gate)  ◄───┼──────────────────────┘                 │
 │    beyaz liste + realpath + atomik rename + echo bastırma                │
 │                                 ▼                                        │
 │                          SSE HUB  (GET /api/stream, id: = seq)           │
 └─────────────────────────────────┬────────────────────────────────────────┘
                                   │ text/event-stream (tek yönlü)
                                   │  ▲ POST/PATCH (yazma istekleri, ayrı kanal)
                                   ▼  │
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  TARAYICI  (dev: Vite 7334 → /api proxy → 7333 · prod: tek port 7333)    │
 │  Zaman çizelgesi · Kanban · Kapılar · Thread · Token · Ayarlar           │
 └──────────────────────────────────────────────────────────────────────────┘
```

Üç akış ayrı ayrı:

**A. Olay akışı (Faz 1, özellik 1)**
`hook → send-event.cjs → POST /api/events → normalize → JSONL append + ring buffer → SSE push → timeline satırı`
Uçtan uca hedef gecikme < 2 s (PRD F1/AC2). Gerçekte tek makinede < 100 ms beklenir; 2 s bütçenin tamamı hook async kuyruğu + SSE flush payıdır.

**B. Dosya izleme akışı (Faz 1, özellik 2-3)**
`chokidar change → dosya oku → frontmatter parse → durum önbelleği güncelle → SSE 'features' olayı → kanban yeniden çizilir`
Hedef < 2 s (PRD F2/AC3); chokidar `awaitWriteFinish` 200 ms eklediği için bütçe rahat.

**C. Yazma akışı (Faz 1 kanban, Faz 2 kapılar)**
`UI eylemi → PATCH/POST → write-gate (beyaz liste + realpath + hash kontrolü) → tmp yaz + fsync + rename → echo bastırma kaydı → chokidar change (bastırılır, ama diskten yeniden okunur) → SSE 'features'`

---

## 3. Stack kararı

### 3.1 Frontend — **onaylandı: Vite + React + TypeScript + Tailwind**

Spec'teki varsayım teyit edilir. Gerekçe: kullanıcının bildiği stack; Vite dev sunucusu `/api` proxy'si ile iki süreçli geliştirmeyi sıfır konfigürasyonla çözer; Tailwind v4 artık `@tailwindcss/vite` eklentisiyle ayrı PostCSS zinciri istemez. React'e itiraz yok — kanban sürükle-bırak ve canlı akış için ekosistem burada.

**Bilinçli olarak ALINMAYANLAR:**
- **Router yok.** 6 düz ekran var, iç içe rota yok. `location.hash` üzerinde ~20 satırlık bir hook yeter. UX dokümanı (`docs/03-ux.md`) derin bağlantı (ör. `#/thread/F-007`) isterse hash şeması bunu zaten karşılar; `react-router` ancak iç içe/korumalı rota gerekirse gündeme gelir.
- **Global state kütüphanesi yok** (Redux/Zustand/TanStack Query). Tek veri kaynağı SSE akışıdır; `useReducer` + context yeterlidir. Sunucu durumu zaten push ediliyor, cache invalidation problemi yok.
- **Bileşen kütüphanesi yok** (MUI/shadcn kurulumu). Ekran sayısı az; Tailwind + ~10 yerel bileşen yeter. UX dokümanı aksini gerektirirse G3'te tartışılır.

### 3.2 Sunucu — **çıplak `node:http` + ~50 satırlık router**

Express/Fastify/Hono **alınmaz**. Gerekçe: 11 uç nokta, bir statik klasör ve bir SSE akışı var. Bir çatı burada yalnızca ~60 geçişli bağımlılık ve sürüm bakımı ekler; ürünün satış argümanı "`npm install` hiç patlamaz". Gövde okuma (~15 satır), yönlendirme (~40 satır) ve statik servis (~30 satır) yazılıp bir kez test edilir.

Sınır: eğer yönlendirme kodu 120 satırı aşarsa developer ADR ile `hono` (sıfır bağımlılık, node adaptörü var) önerebilir. Bu bir *sınır*, bugünkü karar değil.

**TypeScript çalıştırma:** Sunucu TS yazılır, `tsx` ile çalıştırılır (`tsx watch` geliştirmede yeniden başlatmayı da verir). Ayrı bir sunucu build adımı **yoktur** — bu araç kullanıcının kendi deposundan çalışır, "prod deploy" diye bir şey yok. `tsc --noEmit` yalnızca tip kontrolüdür.
Neden `tsx`, Node'un yerleşik tip soyma özelliği değil: yerleşik özellik Node ≥ 22.18 ister ve kurulu sürümü bu ortamda doğrulayamadık; `tsx`'in temeli olan **esbuild zaten Vite'ın geçişli bağımlılığı**, yani yeni yüzey alanı ~sıfır. esbuild önceden derlenmiş ikili indirir (node-gyp/Visual Studio Build Tools **gerektirmez**) — S2 kısıtı "derleme" ile ilgilidir, "ikili" ile değil.

**SSE yaklaşımı:** `res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'})`, ardından `res.write()` ile `id:`/`event:`/`data:` üçlüsü. 15 saniyede bir `: keepalive` yorum satırı. Kütüphane yok. Detay ve yeniden bağlanma: ADR-004.

### 3.3 Süreç modeli — dev'de iki, prod'da tek

| Mod | Süreçler | Portlar | Statik dosyalar |
|---|---|---|---|
| `npm run dev` | Vite dev server + API sunucusu (`concurrently`) | web 7334, api 7333 | Vite'tan (HMR), `/api` → 7333 proxy |
| `npm start` | Yalnızca API sunucusu | 7333 | `dist/web/` sunucudan servis edilir |

Tek portlu prod modu, panelin "tek URL, tek komut" olmasını sağlar; VS Code Simple Browser için de tek adres yeter.

### 3.4 Bağımlılık listesi (kapalı liste — her satırda tek cümlelik gerekçe)

**Runtime (`dependencies`)**

| Paket | Gerekçe |
|---|---|
| `chokidar` (v4) | `fs.watch` Windows ve macOS'ta farklı davranır ve olay kaçırır; chokidar bunu normalize eder ve saf JS'tir. |
| `yaml` | Frontmatter'ı **okumak** için (id/title/owner/deps/sprint); saf JS, sıfır geçişli bağımlılık. Yazma bu paketle yapılmaz (§7.2). |

**Web (`dependencies`)**

| Paket | Gerekçe |
|---|---|
| `react`, `react-dom` | Onaylı UI stack'i. |
| `@dnd-kit/core` | Kanban sürükle-bırak; saf JS, klavye/erişilebilirlik desteği hazır, HTML5 native DnD'nin drop-hedefi isabet testi ve görsel geri bildirim kodunu yazmaktan ucuz. |

**Geliştirme (`devDependencies`)**

| Paket | Gerekçe |
|---|---|
| `vite`, `@vitejs/plugin-react` | Web build ve dev sunucusu. |
| `typescript` | Tip kontrolü. |
| `tsx` | Sunucuyu TS olarak build'siz çalıştırmak (§3.2). |
| `tailwindcss`, `@tailwindcss/vite` | Stil; v4 eklentisi ayrı PostCSS konfigürasyonunu gereksiz kılar. |
| `vitest` | Birim + entegrasyon testleri; Vite konfigürasyonunu paylaşır, ikinci bir test altyapısı gerekmez. |
| `@playwright/test` | E2E; PRD kabul kriterlerinin çoğu ancak gerçek tarayıcıda doğrulanabilir. |
| `concurrently` | `npm run dev` tek komutta iki süreci başlatsın diye; alternatifi elle bakacağımız bir spawn scripti. |
| `eslint`, `@eslint/js`, `typescript-eslint`, `prettier` | Fabrika `lint` komutu için asgari yapılandırma. |
| `@types/react`, `@types/react-dom`, `@types/node` | Tip tanımları. |

Bu listeye ekleme yapmak ADR gerektirir. **Yasaklı:** `better-sqlite3` ve node-gyp derlemesi gerektiren her paket; ağ/hesap gerektiren her SDK.

### 3.5 Portlar ve ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `MC_PORT` | `7333` | API + prod statik sunucu. **4000 değil** (S3, `hook-lab` ve `disler/...` ile çakışıyor); 3000/5173/8080/4318 gibi yaygın portlardan da uzak. |
| `MC_WEB_PORT` | `7334` | Yalnızca `npm run dev` Vite sunucusu. |
| `MC_DATA_DIR` | `<repo>/data` | Panelin kendi deposu (gitignore'lu). Testler geçici dizine yönlendirir. |
| `MC_RETENTION_DAYS` | `30` | ADR-001 karar 4. |
| `MC_RETENTION_EVENTS` | `20000` | ADR-001 karar 4; hangisi önce dolarsa. |
| `MC_RING_SIZE` | `2000` | Bellekteki son-olay tamponu (SSE telafi penceresi). |
| `MC_MAX_PAYLOAD` | `65536` | `send-event.cjs` ham payload üst sınırı (bayt). |
| `MC_WATCH_POLLING` | `0` | Ağ sürücüsü/WSL sorununda `1` yapılır (chokidar polling). |
| `MC_DISABLE` | *(boş)* | `1` ise `send-event.cjs` hiçbir şey yapmadan çıkar. |

**`MC_HOST` diye bir değişken yoktur ve eklenmeyecektir** (G1 kullanıcı kararı 1). Bind adresi kaynakta sabittir.

### 3.6 Platform kuralı — yol işlemleri (S6, ZORUNLU)

Fabrika `CLAUDE.md`'de kayıtlı öğrenilmiş kural: ters bölü içeren regex/`replace` kodu araç zincirinde bozulabiliyor. Bu yüzden mimari kural:

> Yol karşılaştırma, birleştirme, göreceleştirme ve ayraç dönüşümü **yalnızca** `node:path` API'si ile yapılır. Yol dizgesi üzerinde elle regex veya `replace` **yasaktır**.

Pratikte:
- Ayraç normalizasyonu: `p.split(path.sep).join('/')` — `replace(/\\/g, '/')` **değil**.
- Kapsama kontrolü: `path.relative(root, target)` sonucu `''` değilse ve `..` ile başlamıyorsa ve `path.isAbsolute(...)` değilse içeridedir. Dizge önek karşılaştırması (`startsWith(root)`) **yasak** (`C:\dev\app` ile `C:\dev\app-factory` tuzağı).
- Beyaz liste eşlemesi POSIX'e çevrilmiş göreli yol üzerinde `path.posix` ile yapılır.
- Uzantı/temel ad: `path.extname` / `path.basename` — dizge dilimleme değil.
- Bu kural §11.1'de bir birim testiyle ve §11.4'te bir statik tarama testiyle desteklenir.

---

## 4. Klasör yapısı

Fabrika kuralı `src/features/<feature>/...` korunur; sunucu ve web ortak altyapısı ayrı köklerde durur. Monorepo/workspace **gerekmez** (tek `package.json`, tek `node_modules`, tek tip kontrolü).

```
mission-control/
├─ docs/                      # kaynak gerçeği (bu doküman dahil)
├─ data/                      # panelin kendi deposu — .gitignore
│  ├─ events/2026-09-04.jsonl
│  └─ projects.json
├─ src/
│  ├─ shared/                 # hem sunucu hem tarayıcıdan import edilir
│  │  ├─ types.ts             # EventRecord, ProjectRecord, FeatureCard, GateState, ApiResponse
│  │  └─ constants.ts         # STATUS_COLUMNS, GATE_IDS, olay tip etiketleri
│  ├─ server/                 # yalnızca Node
│  │  ├─ index.ts             # bootstrap: config → store → watcher → http.listen('127.0.0.1')
│  │  ├─ http/                # router, gövde okuma, statik servis, Host/Origin koruması
│  │  ├─ sse/                 # hub, seq üreteci, Last-Event-ID telafisi
│  │  ├─ store/               # jsonl-store.ts, ring-buffer.ts, retention.ts, projects-registry.ts
│  │  ├─ watch/               # chokidar sarmalayıcı, echo bastırma kaydı
│  │  └─ write-gate.ts        # ★ İZLENEN PROJELERE YAZAN TEK MODÜL (§7)
│  ├─ web/                    # yalnızca tarayıcı
│  │  ├─ main.tsx, App.tsx, index.css
│  │  ├─ lib/                 # useEventStream, useHashRoute, api istemcisi
│  │  └─ ui/                  # ortak sunum bileşenleri
│  └─ features/               # ★ fabrika kuralı: dikey dilimler
│     ├─ events/              # server/ (ingest, normalize, sorgu) + web/ (timeline) + *.test.ts
│     ├─ projects/            # server/ (kayıt defteri, watcher bağlama) + web/ (ayarlar)
│     ├─ kanban/              # server/ (feature okuma, status patch) + web/ (pano, kart, dnd)
│     ├─ gates/               # server/ (durum türetimi, approve/deny) + web/ (kapılar ekranı)
│     ├─ thread/              # Faz 2
│     └─ usage/               # Faz 2
├─ tests/
│  ├─ fixtures/               # projects/, events/, transcripts/
│  ├─ helpers/                # geçici proje kurucu, hook simülatörü, dosya manifesti
│  └─ e2e/                    # Playwright spec'leri
├─ .claude/hooks/send-event.cjs  # izlenen projelere kopyalanacak şablon (§8)
├─ scripts/install-hook.mjs     # şablonu bir projeye kuran yardımcı (F-004)
└─ package.json
```

Kural: `src/features/<x>/server/**` içinden `src/features/<y>/**` import edilmez; paylaşım `src/shared/` veya `src/server/` üzerinden olur.

---

## 5. Veri modeli

Depo kararı ve gerekçesi: **ADR-003** (düz JSONL, günlük dosyalar, append-only).

### 5.1 Olay kaydı (`EventRecord`)

JSONL'de satır başına bir nesne. Alanlar (`?` = opsiyonel):

| Alan | Tip | Zorunlu | Not |
|---|---|---|---|
| `seq` | number | ✓ | Sunucu tarafı monoton artan sıra; SSE `id:` değeri. Yeniden başlatmada son dosyadaki en yüksek `seq`+1'den devam. |
| `id` | string | ✓ | `<seq>-<rastgele6>`; UI anahtar. |
| `ts` | string | ✓ | Sunucunun aldığı an, ISO-8601 UTC. **Kaynak zamanına güvenilmez** (saat kayması). |
| `received_ms` | number | ✓ | `Date.now()`; sıralama ve gecikme ölçümü. |
| `project_path` | string | ✓ | Mutlak, `realpath`'lenmiş. Hook `cwd`'sinden gelir. |
| `project_name` | string | ✓ | `path.basename(project_path)`; kayıtlı projede ise kayıt defterindeki etiket. |
| `project_id` | string? | | Kayıt defterinde eşleşme varsa; yoksa boş (izlenmeyen projeden olay da kabul edilir ve saklanır). |
| `hook_event_name` | string | ✓ | `PreToolUse`, `SubagentStop`, … Bilinmiyorsa `"unknown"`. |
| `session_id` | string? | | |
| `agent_id` | string? | | Yalnızca subagent içinde var. |
| `agent_type` | string? | | `ceo`, `architect`, `Explore`, … Yoksa UI `"main"` gösterir. |
| `tool_name` | string? | | Araç olaylarında. |
| `tool_use_id` | string? | | Pre/Post eşleştirmesi için. |
| `permission_mode` | string? | | |
| `transcript_path` | string? | | **Faz 2'nin altın alanı** (§9). |
| `prompt_id` | string? | | Bir kullanıcı turunu gruplamak için. |
| `summary` | string | ✓ | ≤ 200 karakter, olay tipine göre türetilir; türetilemezse `""`. |
| `flags` | string[] | ✓ | `missing_fields`, `parse_error`, `raw_truncated`, `unknown_event`, `oversize`. Boş dizi normaldir. |
| `raw` | object \| null | ✓ | Hook'tan gelen **ham payload**, olduğu gibi. Şema değişirse veri kaybolmasın diye (risk (a) azaltımı). Üst sınır `MC_MAX_PAYLOAD`; aşarsa `{truncated:true, byte_length, keys:[…]}` yazılır ve `raw_truncated` bayrağı eklenir. |

**Bilinmeyen alan politikası:** Normalizer bilinen alanları çıkarır, **kalanları asla atmaz** — `raw` içinde bütünüyle durur. Yeni bir hook alanı eklendiğinde sunucu değişmeden veri toplanmaya devam eder; UI sonradan `raw`'dan okuyabilir. Bilinen alan eksikse `flags: ["missing_fields"]` eklenir ve olay **yine de kaydedilir** (PRD F1/AC5: 5xx yok).

`summary` türetme tablosu (developer genişletebilir):

| Olay | `summary` kaynağı |
|---|---|
| `PreToolUse`/`PostToolUse` + `Bash` | `tool_input.command` |
| `PreToolUse`/`PostToolUse` + `Edit`/`Write`/`Read` | `tool_input.file_path` (projeye göre göreli, `path.relative`) |
| `PreToolUse` + `Task` | `tool_input.description` |
| `UserPromptSubmit` | `user_input` |
| `Stop` / `SubagentStop` | `last_assistant_message` |
| `SessionStart` / `SessionEnd` | `reason` |
| `Notification` | `notification_type` |
| diğer | `hook_event_name` |

### 5.2 Proje kaydı (`ProjectRecord`) — `data/projects.json`

```jsonc
{
  "version": 1,
  "projects": [
    {
      "id": "p_9f31c2",              // kalıcı, yol değişse de bozulmaz
      "path": "C:\\dev\\apps\\mission-control",  // realpath'lenmiş mutlak yol
      "label": "mission-control",    // varsayılan basename; kullanıcı düzenleyebilir
      "added_at": "2026-09-04T10:00:00.000Z",
      "enabled": true
    }
  ]
}
```

- Ekleme koşulu: `<path>/docs/features` **klasörü var** (PRD F3/AC3; yoksa 400).
- Çıkarma: kayıt silinir, watcher durdurulur. **Olay geçmişi depoda kalır** (ADR-001 karar 6); `/api/events` sorgusu `project_id` ile hâlâ döner, UI filtreler.
- Kalıcılık: atomik yazma (tmp + rename). Tek yazar sunucudur.
- `path` alanı JSON'da Windows ayracı ile durur; karşılaştırma her zaman `path` API'siyle yapılır, dizge eşitliğiyle değil.

### 5.3 Feature kartı türetimi (`FeatureCard`) — türetilmiş, saklanmaz

Kaynak: `<project>/docs/features/*.md`. Bellekte önbellek, diskte tek gerçek dosyanın kendisidir.

```ts
type FeatureCard = {
  project_id: string
  file: string            // 'F-007-kanban.md' (yalnızca dosya adı; yol istemciye gitmez)
  id?: string             // frontmatter: id
  title?: string
  status: string          // frontmatter'daki HAM değer (normalize edilmez)
  column: Column          // 7 bilinen sütun | 'unknown'
  owner?: string
  deps?: string[]
  sprint?: number | string
  content_hash: string    // sha256(dosyanın tamamı, bayt), çakışma tespiti için
  mtime_ms: number
  parse_error?: string    // frontmatter yok/bozuk → kart yine gösterilir
}
```

- `column` = `status` ∈ {`todo`,`contract`,`dev`,`qa`,`fix`,`done`,`blocked`} ise o sütun, değilse `unknown` ("Bilinmeyen durum", PRD F2/AC6). `unknown` kartları sürüklenebilir (ADR-001 karar 5).
- `F-000-template.md` gizlenir mi? **Hayır** — gizleme sessiz davranıştır; kart gösterilir, UI "şablon" rozeti koyabilir (UX kararı).
- Frontmatter okuması `yaml` ile yapılır ve **tamamı try/catch içindedir**; hata → `parse_error` dolu, `status: ""`, `column: 'unknown'`.

### 5.4 Kapı durumu türetimi (`GateState`) — türetilmiş, saklanmaz

Kaynak: `<project>/docs/approvals/` dizin listesi. Kapılar: `G0…G6`, `ASSETS`. (`G4-<n>` kilometre taşı kapıları desenle yakalanır ve `G4` altında gruplanır.)

```ts
type GateState = {
  project_id: string
  gate: string                 // 'G0'..'G6' | 'G4-1' | 'ASSETS'
  state: 'approved' | 'denied' | 'pending' | 'conflict'
  ok_mtime_ms?: number
  deny_mtime_ms?: number
  newer?: 'ok' | 'deny'        // conflict durumunda hangisi daha yeni
}
```

`conflict` = hem `.ok` hem `.deny.md` var (PRD F4/AC4). Panel **hiçbir dosyayı otomatik silmez**; yalnızca işaretler. ADR-001 karar 7 sayesinde panel üzerinden bu durum oluşmaz (onay öncesi `.deny.md` arşive taşınır); ancak elle oluşturulmuş çelişki gösterilmelidir.

### 5.5 Depo dosya düzeni ve retention

```
data/
├─ events/
│  ├─ 2026-09-03.jsonl        # UTC gününe göre; append-only
│  └─ 2026-09-04.jsonl
├─ events/.seq                # son verilen seq (çökme sonrası hızlı devam; yoksa son dosyadan türetilir)
└─ projects.json
```

- **Yazma:** yalnızca sunucu süreci, yalnızca `fs.appendFile` ile, satır sonunda `\n`. Node aynı süreç içinde append çağrılarını sıraya koyar; `O_APPEND` ile satır bütünlüğü korunur. Çoklu-yazar senaryosu **yoktur** — hook'lar dosyaya değil HTTP'ye yazar (ADR-006'nın yan faydası).
- **Okuma:** açılışta en yeni dosyadan geriye doğru, `MC_RING_SIZE` olay toplanana kadar. Bozuk satır atlanır, sayaç `data/events/.corrupt-count` yerine yalnızca log + `/api/health` alanı olarak tutulur.
- **Retention (ADR-001 karar 4):** açılışta ve saatte bir; (a) `MC_RETENTION_DAYS`'ten eski gün dosyaları silinir, (b) toplam satır sayısı `MC_RETENTION_EVENTS`'i aşarsa en eski gün dosyaları baştan silinir. Budama **dosya silmedir, satır düzenlemesi değildir** — bu yüzden ucuz ve bozulmaya kapalıdır. Silme yalnızca `MC_DATA_DIR` altında olur; yazma kapısıyla ilgisi yoktur, izlenen projelere asla dokunmaz.
- Gün dosyası 50 MB'ı aşarsa `YYYY-MM-DD.1.jsonl` olarak devam edilir (tek kullanıcıda beklenmiyor; güvenlik supabı).

---

## 6. API sözleşmesi

Taban: `http://127.0.0.1:7333`. Tüm veri uçları `/api` önekli. Yanıt zarfı (fabrika `coding-style` konvansiyonu):

```ts
type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: { code: ErrorCode; message: string }   // message TÜRKÇE, kullanıcıya gösterilebilir
  meta?: { total?: number; next_seq?: number }
}

type ErrorCode =
  | 'invalid_body' | 'invalid_path' | 'not_found' | 'conflict'
  | 'write_denied' | 'write_failed' | 'unavailable' | 'forbidden_origin'
```

Hata kodu → HTTP eşlemesi: `invalid_body|invalid_path` 400 · `forbidden_origin` 403 · `not_found` 404 · `conflict` 409 · `write_denied` 403 · `write_failed` 500 · `unavailable` 503.

### 6.1 Olaylar

**`POST /api/events`** — hook alımı. *Yazma kapısıyla ilgisi yok: yalnızca `MC_DATA_DIR` altına yazar.*

- İstek: `Content-Type: application/json`, gövde = ham hook payload'ı (+ `send-event.cjs`'in eklediği `project_path`, `client_ts`, `client_version`).
- Gövde sınırı 256 KB; aşarsa 400 `invalid_body` (hook zaten `MC_MAX_PAYLOAD` ile kırpar).
- **Asla 5xx dönmez** (PRD F1/AC5). Eksik/bilinmeyen alan → 202 + `flags`.
- Yanıt: `202 { success: true, data: { id, seq, flags } }`
- Gövde JSON değilse: `202 { success: true, data: { id, seq, flags: ['parse_error'] } }` — olay `raw_text` ile kaydedilir. (Veri kaybetmemek 400 dönmekten değerlidir.)

**`GET /api/events`**
- Sorgu: `project_id`, `type` (çoklu, virgüllü), `agent`, `session_id`, `since_seq`, `before_seq`, `limit` (varsayılan 200, max 1000), `q` (summary alt dizgesi).
- Yanıt: `200 { success: true, data: EventRecord[], meta: { total, next_seq } }` — `seq` artan sırada.

**`GET /api/stream`** — SSE. Detay: ADR-004.
- İstek başlıkları: `Last-Event-ID` (opsiyonel, tarayıcı otomatik gönderir).
- Gönderilen olay tipleri:

| `event:` | `data:` | Ne zaman |
|---|---|---|
| `hello` | `{ seq, server_version, ring_from }` | Bağlantı açılır açılmaz |
| `event` | `EventRecord` | Yeni hook olayı |
| `features` | `{ project_id, cards: FeatureCard[] }` | İlgili projenin feature dosyaları değişti (debounce 150 ms) |
| `projects` | `ProjectRecord[]` | Kayıt defteri değişti |
| `gates` | `{ project_id, gates: GateState[] }` | `docs/approvals/` değişti |
| `resync` | `{ reason: 'gap' }` | `Last-Event-ID` ring buffer'dan eski → istemci `/api/events` ile tam yeniden yükleme yapar |

### 6.2 Projeler

| Method | Yol | Gövde | Yanıt | Hatalar |
|---|---|---|---|---|
| GET | `/api/projects` | — | `ProjectRecord[]` | — |
| POST | `/api/projects` | `{ path: string, label?: string }` | `201 ProjectRecord` | 400 `invalid_path` (yol yok / `docs/features` yok / dosya değil), 409 `conflict` (aynı realpath kayıtlı) |
| PATCH | `/api/projects/:id` | `{ label?, enabled? }` | `200 ProjectRecord` | 404 |
| DELETE | `/api/projects/:id` | — | `200 { removed: true }` | 404 |

**Sınır 4 zorlaması:** Bu uçlar izlenen projelere **hiç yazmaz**; yalnızca `data/projects.json` güncellenir. DELETE hiçbir dosya silmez (PRD F3/AC2).

### 6.3 Feature'lar (kanban)

**`GET /api/features?project_id=…`** → `200 { success: true, data: FeatureCard[] }`. `project_id` yoksa tüm etkin projeler.

**`PATCH /api/features/:project_id/:file`** — **yazma kapısından geçen tek kanban ucu.**

```jsonc
// istek
{ "status": "qa", "expected_hash": "sha256-hex-of-file-as-read" }
```

| Durum | Yanıt |
|---|---|
| Başarılı | `200 { success:true, data: FeatureCard }` (yeni hash ile) |
| `expected_hash` diskle uyuşmuyor | `409 { success:false, error:{code:'conflict', message:'Dosya değişti, güncel hali yüklendi.'}, data: FeatureCard }` — **dosya yazılmaz** (PRD F2/AC4) |
| `status` boş / satır sonu-iki nokta içeriyor / >64 karakter | `400 invalid_body` |
| `file` beyaz listeye uymuyor (`..`, alt klasör, `.md` değil) | `403 write_denied` |
| Frontmatter yok veya `status:` satırı yok | `400 invalid_body` ("frontmatter'da status alanı yok") |
| `rename`/izin hatası (3 denemeden sonra) | `500 write_failed` (PRD F2/AC5) |

Not: `status` değeri 7 bilinen değerle **sınırlanmaz** — kullanıcı bilinçli olarak başka değer yazmak isteyebilir; ama UI yalnızca 7 sütun sunar, yani pratikte 7 değerden biri gelir. Doğrulama: tek satır, kontrol karakteri yok, YAML skaleri olarak güvenli.

### 6.4 Kapılar (Faz 2)

**`GET /api/gates?project_id=…`** → `200 GateState[]`

**`POST /api/gates/:project_id/:gate/approve`**
```jsonc
{ "summary": "Onaylanan kapsam özeti (çok satırlı)", "decision": "Kullanıcının kararı, bir cümle" }
```
- `summary` ve `decision` **boş olamaz** (400). İkinci doğrulama adımı UI tarafındadır (PRD F4/AC7) — sunucu ayrıca `confirmed: true` alanı ister ki yanlışlıkla tetiklenen bir istek yazmasın.
- Sıra: (1) mevcut `.deny.md` varsa `docs/approvals/archive/<G>-<YYYY-AA-GG-ss-dd>.deny.md`'ye **rename** edilir (ADR-001 karar 7; silme yok), (2) `.ok` atomik yazılır.
- İçerik (PROCESS.md §2 formatı):
  ```
  <G> — <Kapı adı> ONAYLANDI
  Tarih: 2026-09-04
  Onaylayan: Veron (Mission Control panelinden)

  Onaylanan özet:
  <summary>

  Kullanıcının kararı (bir cümle): "<decision>"
  ```
- Yanıt: `200 { gate: GateState, wrote: ['docs/approvals/G2.ok'], archived?: '…' }`

**`POST /api/gates/:project_id/:gate/deny`**
```jsonc
{ "reason": "Zorunlu gerekçe metni" }
```
- `reason.trim() === ''` → `400 invalid_body` (PRD F4/AC8). Doğrulama adımı **istenmez**.
- `<G>.deny.md` atomik yazılır; gerekçe **olduğu gibi** geçer.

**`:gate` doğrulaması:** `^(G[0-6](-\d{1,3})?|ASSETS)$` — bu bir *yol* regex'i değil, bir *tanımlayıcı* regex'idir (ters bölü içermez, S6 kuralını ihlal etmez). Dosya adı bu doğrulanmış tanımlayıcıdan `path.join` ile kurulur, istemciden gelen dizge asla doğrudan yola konmaz.

### 6.5 Faz 2 okuma uçları

| Method | Yol | Yanıt | Bozuk veri davranışı |
|---|---|---|---|
| GET | `/api/thread?project_id&feature_id` | `{ sections: ThreadSection[], degraded: boolean, notes: string[] }` | `degraded: true` + o bölüm yok; 200 döner, hata değil (PRD F5/AC2) |
| GET | `/api/usage?project_id&group_by=day\|session\|agent&from&to` | `{ rows: UsageRow[], source: 'transcript'\|'none', degraded }` | kaynak okunamıyorsa `rows: []`, `source: 'none'` (PRD F6/AC2) |

Her ikisi de **salt okunur**; yazma kapısını hiç çağırmaz (PRD F5/AC5).

### 6.6 Sağlık

**`GET /api/health`** → `{ ok, version, port, node, uptime_s, projects: n, events_total, ring_from, ring_to, corrupt_lines, watchers: n, degraded: string[] }`
E2E ve smoke testler bunu hazır-olma sinyali (readiness) olarak kullanır.

---

## 7. Yazma kapısı ve güvenli frontmatter yazımı

Karar ve tehdit modeli: **ADR-005**.

### 7.1 Yazma kapısı (`src/server/write-gate.ts`)

Bu modül, izlenen projelere yazan **tek** yerdir ve dışarıya yalnızca **niyet** düzeyinde API verir — ham yol kabul eden genel bir `writeFile` fonksiyonu yoktur:

```ts
// ÖRNEK imza taslağı — nihai kod developer'ın
export type WriteResult =
  | { ok: true; path: string; card?: FeatureCard }
  | { ok: false; code: 'write_denied'|'conflict'|'write_failed'|'invalid_body'; message: string }

export function patchFeatureStatus(
  project: ProjectRecord, fileName: string, nextStatus: string, expectedHash: string
): WriteResult

export function writeGateApproval(project: ProjectRecord, gate: GateId, body: string): WriteResult
export function writeGateDenial(project: ProjectRecord, gate: GateId, body: string): WriteResult
export function archiveDenial(project: ProjectRecord, gate: GateId): WriteResult   // yalnızca rename
```

Her çağrıda çalışan 6 adımlı kontrol:

1. **Kök doğrulama** — `project.path` kayıt defterindeki, kayıt anında `fs.realpathSync` ile çözülmüş yoldur. İstemciden gelen yol asla kök olamaz.
2. **Hedefi kur** — hedef yol istemci dizgesinden değil, doğrulanmış parçalardan `path.join` ile kurulur (`fileName` yalnızca `[A-Za-z0-9._-]+\.md` desenine uyarsa geçer; `path.basename(fileName) === fileName` ayrıca kontrol edilir).
3. **realpath ile symlink kaçışı kapat** — hedefin **var olan en yakın atası** `realpathSync` ile çözülür; sonuç kökün altında değilse `write_denied`. (Hedefin kendisi henüz yok olabilir; bu yüzden ata üzerinden.)
4. **Kapsama kontrolü** — `path.relative(root, resolvedTarget)`; boş, `..` ile başlayan veya mutlak sonuç → `write_denied`. Dizge önek karşılaştırması kullanılmaz (§3.6).
5. **Beyaz liste eşlemesi** — göreli yol `split(path.sep).join('/')` ile POSIX'e çevrilir ve şu tabloya bakılır:

   | Desen (POSIX göreli) | İzinli işlem |
   |---|---|
   | `docs/features/<ad>.md` | `patchStatus` — yalnızca `status:` satırı |
   | `docs/approvals/<G>.ok` | `writeApproval` — tam dosya oluştur/üzerine yaz |
   | `docs/approvals/<G>.deny.md` | `writeDeny` — tam dosya oluştur/üzerine yaz |
   | `docs/approvals/archive/<G>-<zaman>.deny.md` | `archiveDeny` — yalnızca **rename hedefi** |
   | *diğer her şey* | **reddedilir** |

   Eşleşme *işlemle birlikte* yapılır: `writeApproval` çağrısı bir `docs/features/*.md` yoluna denk gelse bile reddedilir.
6. **Silme yok** — modülde `unlink`/`rm`/`rmdir` çağrısı **bulunmaz**. Arşivleme `rename`'dir. (Retention silmesi ayrı modüldedir ve yalnızca `MC_DATA_DIR` altında çalışır.)

Bunlara ek olarak modül `MC_DATA_DIR` dışına yazan `node:fs` çağrılarının tek sahibidir; §11.4'teki statik guard testi bu tekelliği doğrular.

### 7.2 Frontmatter'da yalnızca `status` satırını değiştirme

**Kural: YAML round-trip yapılmaz.** `yaml` paketi yalnızca okumak için kullanılır; yazarken dosya bir *metin* olarak ele alınır ve tek bir satır değiştirilir. Böylece yorumlar, sıra, tırnak stili, girinti, boş satırlar ve blok skalerleri karakter bazında korunur (PRD F2/AC2).

Algoritma:

1. `const original = fs.readFileSync(file)` → **Buffer**; `const text = original.toString('utf8')`. BOM varsa ilk karakter korunur, kırpılmaz.
2. `sha256(original)` hesapla → `expectedHash` ile karşılaştır. Uyuşmuyorsa **hiç yazma**, `conflict` dön (PRD F2/AC4).
3. Satırlara ayır: `const parts = text.split(/(\r\n|\n)/)` — bu regex satır sonu içindir, **yol içermez**, S6 kuralı ihlal edilmez. Ayraçlar `parts` içinde kaldığı için birleştirme kayıpsızdır.
4. Frontmatter sınırlarını bul: ilk içerik satırı tam olarak `---` olmalı; sonraki `---` veya `...` satırı kapanıştır. Bulunamazsa `invalid_body` ("frontmatter yok").
5. Açılış ile kapanış arasında, girinti seviyesi 0 olan **ilk** `status:` satırını bul (`line.startsWith('status:')` veya `/^status\s*:/` — girintili `status:` bir alt nesne alanıdır, dokunulmaz). Yoksa `invalid_body`.
6. O satırı `` `status: ${safe(nextStatus)}` `` ile değiştir; satır sonu ayracı `parts` içinde ayrı eleman olduğu için **değişmez** (CRLF korunur). `safe()`: değer `#`, `:`, satır sonu veya baştaki/sondaki boşluk içeriyorsa çift tırnaklanır.
7. `parts.join('')` → yeni metin. **Değişen tek şey o satırdır** — bir birim testi bunu `diff` ile doğrular (§11.1).
8. Atomik yazma:
   ```
   tmp = path.join(dir, `.${base}.${process.pid}-${rand}.tmp`)
   fd = fs.openSync(tmp, 'wx'); fs.writeSync(fd, buf); fs.fsyncSync(fd); fs.closeSync(fd)
   fs.renameSync(tmp, target)      // aynı dizin, aynı birim → atomik
   ```
   `rename` Windows'ta üzerine yazar. `EPERM`/`EBUSY` (antivirüs, açık editör) durumunda 50 ms → 100 ms → 200 ms ile 3 deneme; sonra `write_failed` (PRD F2/AC5). Hata yolunda `tmp` her koşulda silinir (`finally`).
9. Yeni `content_hash` ve `FeatureCard` üretilip yanıtta ve SSE'de yayınlanır.

**Aynı algoritma `.ok` / `.deny.md` yazımında da kullanılır** (adım 3-7 atlanır; tam içerik yazılır), böylece atomiklik ve tmp temizliği tek yerde durur.

### 7.3 Echo bastırma (kendi yazımızı dış değişiklik sanmama)

```
yazmadan hemen önce:  selfWrites.set(realpath(target), Date.now() + 1500)
chokidar 'change':    e = selfWrites.get(realpath(file))
                      if (e && e > Date.now()) { selfWrites.delete(file)
                                                 dosyayı YİNE DE oku, önbelleği tazele,
                                                 SSE 'features' olayını origin:'panel' ile gönder }
                      else                     { normal dış değişiklik akışı, origin:'external' }
```

Önemli detay: bastırma "olayı yok say" değil, "**dış değişiklik diye işaretleme**"dir. Disk her zaman gerçektir; önbellek her durumda diskten tazelenir. Ek olarak:
- chokidar `awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }` — yarım yazılmış dosya okunmaz.
- `.tmp` dosyaları `ignored` ile dışlanır (chokidar v4 glob desteklemez; `ignored` bir **fonksiyon** olarak verilir ve `path.extname(p) === '.tmp'` kontrolü yapar).
- TTL süresi dolmuş kayıtlar dakikada bir temizlenir (bellek sızıntısı yok).

---

## 8. `send-event.cjs` hook scripti tasarımı

> **Doküman düzeltmesi (CEO, 2026-09-04):** Bu bölümdeki tüm `send-event.js` referansları
> `send-event.cjs` olarak güncellendi. Gerekçe: izlenen projenin `package.json`'ında
> `"type": "module"` varsa düz `.js` ESM sayılır, `require` patlar ve script **sessizce ölür**
> — panel hiç olay almaz, kimse fark etmez. Bu depoda tam olarak bu yaşandı ve bütün güvenlik
> hook'ları haftalarca no-op koştu (commit `9ae23bf`). `.cjs` uzantısı `type` alanından bağımsız
> olarak CommonJS'i garantiler. Karar: `docs/features/F-004-send-event-hook.md` "CEO kararları".
> Aynı düzeltme `ADR-006`'ya da uygulandı. Tasarımın kendisi değişmedi.


Taşıma kararı (`command` + `async` vs `type:"http"`): **ADR-006**.

### 8.1 Davranış sözleşmesi

| Kural | Neden |
|---|---|
| **Asla `process.exit(≠0)`** | Exit 2 = bloklayıcı hata; oturumu durdurur. Her yol `exit(0)`. |
| **Asla stdout'a yazma** | Exit 0'da stdout JSON karar objesi olarak ayrıştırılır; yanlış çıktı Claude'un davranışını değiştirebilir. `console.log` **yasak**. |
| **Asla 400 ms'ten uzun bekleme** | `req.setTimeout(400)` + `socket.destroy()`. `async: true` zaten oturumu bekletmez; bu ikinci emniyet. |
| **Asla istisna sızdırma** | Tüm gövde `try/catch`; ayrıca `process.on('uncaughtException'/'unhandledRejection', () => process.exit(0))`. |
| **Sunucu kapalıysa sessizce düş** | Bkz. §8.4. |
| **`MC_DISABLE=1` → anında çık** | Kullanıcı paneli kapattığında hook'ları settings'ten sökmek zorunda kalmasın. |
| **Bağımlılık yok** | Yalnızca `node:http`, `node:path`. İzlenen projede `npm install` gerektirmez — script tek dosya olarak kopyalanır. |

### 8.2 Örnek içerik (şablon — G2 sonrası `.claude/hooks/send-event.cjs` olarak yazılacak)

```js
// Mission Control — hook olay göndericisi. Bağımlılıksız, bloklamaz, sessizce başarısız olur.
// Kurulum: bu dosyayı izlenen projenin .claude/hooks/ klasörüne kopyala + settings.json'a kaydet.
'use strict';
const http = require('node:http');
const path = require('node:path');

process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));
if (process.env.MC_DISABLE === '1') process.exit(0);

const PORT = Number(process.env.MC_PORT) || 7333;
const MAX = Number(process.env.MC_MAX_PAYLOAD) || 65536;
const TIMEOUT_MS = 400;

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { if (buf.length < 1_000_000) buf += c; });
process.stdin.on('end', () => { try { send(buf); } catch (_) { process.exit(0); } });
setTimeout(() => process.exit(0), 2000).unref();   // stdin hiç kapanmazsa

function firstString(...vals) {
  for (const v of vals) if (typeof v === 'string' && v) return v;
  return undefined;
}

function summarize(p) {
  const ti = (p && p.tool_input) || {};
  const s = firstString(
    ti.command, ti.file_path, ti.path, ti.description, ti.pattern,
    p && p.user_input, p && p.last_assistant_message,
    p && p.reason, p && p.notification_type, p && p.hook_event_name
  );
  return s ? String(s).replace(/\s+/g, ' ').slice(0, 200) : '';
}

function send(text) {
  let payload = null; const flags = [];
  try { payload = JSON.parse(text || '{}'); }
  catch (_) { payload = null; flags.push('parse_error'); }

  const p = payload || {};
  const projectPath = firstString(p.cwd, process.env.CLAUDE_PROJECT_DIR, process.cwd());

  let raw = payload;
  try {
    if (payload && JSON.stringify(payload).length > MAX) {
      raw = { truncated: true, keys: Object.keys(payload) };
      flags.push('raw_truncated');
    }
  } catch (_) { raw = null; flags.push('raw_unserializable'); }

  const body = JSON.stringify({
    client_ts: new Date().toISOString(),
    client_version: 1,
    project_path: projectPath,
    project_name: projectPath ? path.basename(projectPath) : undefined,
    hook_event_name: firstString(p.hook_event_name) || 'unknown',
    session_id: p.session_id, agent_id: p.agent_id, agent_type: p.agent_type,
    tool_name: p.tool_name, tool_use_id: p.tool_use_id,
    permission_mode: p.permission_mode, transcript_path: p.transcript_path,
    prompt_id: p.prompt_id,
    summary: summarize(p),
    flags,
    raw: raw === null && flags.includes('parse_error') ? { raw_text: String(text).slice(0, MAX) } : raw
  });

  const req = http.request(
    { host: '127.0.0.1', port: PORT, path: '/api/events', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
    (res) => { res.resume(); res.on('end', () => process.exit(0)); }
  );
  req.setTimeout(TIMEOUT_MS, () => { req.destroy(); process.exit(0); });
  req.on('error', () => process.exit(0));   // sunucu kapalı → sessiz
  req.end(body);
}
```

> `summarize` içindeki `\s+` regex'i **boşluk** içindir; yol ayracı regex'i değildir (S6 uyumlu). Yol işlemi yalnızca `path.basename` ile yapılır.

### 8.3 İzlenen projeye eklenecek `settings.json` satırları (TAM metin)

İzlenen projenin `.claude/settings.json` dosyasındaki `"hooks"` nesnesine birleştirilir. Mevcut hook'lar (fabrika `gate-check.js` vb.) **silinmez**; aynı olay tipinde ikinci bir matcher grubu olarak eklenir.

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "SessionEnd": [
      { "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "PreToolUse": [
      { "matcher": "*", "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "PostToolUse": [
      { "matcher": "*", "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "PostToolUseFailure": [
      { "matcher": "*", "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "SubagentStart": [
      { "matcher": "*", "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "SubagentStop": [
      { "matcher": "*", "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "StopFailure": [
      { "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "Notification": [
      { "matcher": "*", "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "PreCompact": [
      { "matcher": "*", "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ],
    "PostCompact": [
      { "matcher": "*", "hooks": [ { "type": "command", "command": "node .claude/hooks/send-event.cjs", "async": true, "timeout": 5 } ] }
    ]
  }
}
```

Notlar:
- Komut biçimi fabrikadaki çalışan hook'larla **aynı desendedir** (`node .claude/hooks/<script>` — göreli, kabuk biçimi). Mutlak yol veya `${CLAUDE_PROJECT_DIR}` denenmez; Windows yolu tırnak/ters bölü sorunlarını davet eder.
- `async: true` kurulu Claude Code sürümünde desteklenmiyorsa satır kaldırılır; `timeout: 5` + scriptin 400 ms'lik kendi zaman aşımı yine de oturumu bekletmez. F-004 bunu smoke test ile doğrular.
- ADR-001 karar 2 ("tüm olay tipleri") bu listeyle karşılanır. Yeni bir olay tipi eklemek **yalnızca bu dosyaya bir satır** eklemektir — sunucu şemadan bağımsızdır, kod değişikliği gerekmez.
- `scripts/install-hook.mjs` (F-004) bu birleştirmeyi otomatik yapar: mevcut `settings.json` okunur, `hooks` altına eksik girdiler eklenir, dosya atomik yazılır. **Bu script Mission Control'ün kendi deposundadır ve yazma kapısından geçmez** — çünkü kullanıcının açıkça çalıştırdığı bir kurulum aracıdır, panelin çalışma zamanı davranışı değildir. Panelin kendisi hiçbir zaman `settings.json` yazmaz.

### 8.4 Sunucu kapalıyken: **sessizce düş** (kuyruk yok)

Karar: hata/timeout durumunda olay atılır, hiçbir yere yazılmaz.

Gerekçe:
- Diske kuyruk yazmak, "hook'lar dosyaya yazmaz" tasarımını bozar; ikinci bir yazar, kilitlenme, kısmi satır, flush zamanlaması ve sıralama sorunları getirir.
- Verinin değeri "**şu an ne oluyor**"dur. Panel kapalıysa kimse bakmıyordur; 3 saat önceki bir `PreToolUse` satırının geriye dönük değeri düşüktür.
- Kalıcı geçmiş zaten iki yerde duruyor: Claude Code'un kendi transkriptleri ve projenin `docs/` artefaktları.
- Kuyruk = yeni bir hata yüzeyi (dolan disk, bozuk kuyruk dosyası, çift gönderim) — tek kullanıcılık bir izleme aracı için orantısız.

Bunun yerine **görünürlük** eklenir: `/api/health` ve UI, sunucunun başlangıç zamanını gösterir; bir oturum sunucu kapalıyken çalıştıysa zaman çizelgesinde boşluk görünür ve UI "sunucu <zaman>'da başlatıldı, öncesi kaydedilmedi" bilgi satırı gösterir.

---

## 9. Faz 2 — transkript ve token kaynağı

Kaynak kararı: **ADR-007**.

### 9.1 Doğrulanmış gerçekler (2026-09-04, bu makinede gözlemlendi)

Bunlar tahmin değil, dosya sistemi üzerinde doğrulanmıştır:

- Ana oturum transkripti: `~/.claude/projects/<kodlanmış-cwd>/<session-uuid>.jsonl`
- Subagent transkripti: `~/.claude/projects/<kodlanmış-cwd>/<session-uuid>/subagents/agent-<id>.jsonl`
- Yanında meta dosyası: `agent-<id>.meta.json`, gözlemlenen içerik:
  ```json
  {"agentType":"architect","description":"Mission Control architecture",
   "toolUseId":"toolu_011x3EcgUd33r8wNxRtgywKU","spawnDepth":1,"stoppedByUser":true}
  ```
- `<cwd>` kodlaması: sürücü iki noktası ve yol ayraçları `-` olur (`C:\dev\app-factory` → `C--dev-app-factory`). **Büyük/küçük harf tutarlı değildir** (`c--Users-pc-...` ile `C--dev-...` aynı dizinde bir arada gözlemlendi) → dizin eşleştirme **harf duyarsız** yapılmalıdır.
- Token alanları jsonl içinde mevcut (`output_tokens` doğrulandı).

### 9.2 Yol tahmini yerine yol **toplama** (risk (b)'nin asıl azaltımı)

Her hook olayı `transcript_path` alanı taşır ve `SubagentStart`/`SubagentStop` olayları `agent_id` + `agent_type` taşır. Yani Faz 1'de topladığımız olaylar, Faz 2'nin ihtiyaç duyduğu **dosya yollarını ve agent kimliklerini zaten içerir**.

Sonuç: transkript dosyalarını bulmak için dizin adı kodlamasını tersine mühendislik yapmamıza gerek yok.
- **Birincil yol:** olay deposundan `transcript_path` oku (kesin, sürüm bağımsız).
- **Yedek yol:** `~/.claude/projects/` altında harf duyarsız dizin taraması (yalnızca panel kurulmadan önce yapılmış oturumlar için).
- Dizin adı kodlaması değişirse birincil yol etkilenmez.

### 9.3 Ön görev: format doğrulama (F-009, kod yazmadan önce)

F-009 bir *spike*'tır ve şu çıktıyı üretmeden thread/token kodu yazılmaz:
1. En az 3 gerçek `.jsonl` dosyasının ilk/orta/son 20 satırı incelenir; gözlemlenen satır tipleri (`user`, `assistant`, `system`, `summary`, …) ve `message.usage` alan adları `docs/wiki/pages/desen/claude-transcript-formati.md` altına yazılır (librarian'a değil, F-009'a ait).
2. Anonimleştirilmiş fixture'lar `tests/fixtures/transcripts/` altına alınır: `valid.jsonl`, `truncated-last-line.jsonl`, `unknown-schema.jsonl`, `empty.jsonl`, `bom-crlf.jsonl`.
3. Okuyucunun sözleşmesi yazılır: satır bazlı `try/catch`, bilinmeyen `type` atlanır ve sayılır, hiçbir koşulda istisna dışarı sızmaz.
4. Bu doğrulama **her Claude Code güncellemesinden sonra** tekrarlanır (README'ye not).

### 9.4 Okuyucu tasarımı (best-effort sözleşmesi)

```
readTranscript(file) → { lines_ok, lines_bad, records[] }   // asla throw etmez
```
- Dosya boyutu > 64 MB ise yalnızca son 32 MB okunur (satır sınırına hizalanarak).
- `lines_bad > 0` → yanıt `degraded: true`, UI'da "bu bölüm okunamadı" (PRD F5/AC2). **Ham hata veya stack trace UI'a gitmez** (PRD F5/AC3); sunucu loguna yazılır ve `/api/health.degraded` içinde sayılır.
- Thread görünümü iki kaynağı birleştirir: (a) `docs/qa/<feature>-contract.md` + `docs/qa/*.md` (**güvenilir**, dosya tabanlı, format bizim doktrinimiz), (b) transkript (**best-effort**). Kaynak (a) tek başına çalışır; (b) hiç okunamasa da thread ekranı kullanışlıdır. Bu, PRD F5/AC1'in "ilgili dosyalar mevcutsa" koşulunu karşılar ve riski en kırılgan bileşenden uzaklaştırır.
- `ESKALE: true` rozeti (PRD F5/AC4) `docs/qa/latest.md`'den okunur — transkriptten değil, yani en kırılgan kaynağa bağlı değildir.

---

## 10. Auth, yetkilendirme ve güvenlik sınırı

**Auth yoktur ve olmayacaktır** (G0/G1 onaylı kapsam dışı). Tek kullanıcı, tek makine. Kimlik doğrulama yerine geçen kontroller:

| Kontrol | Uygulama |
|---|---|
| Ağ erişimi | `server.listen(port, '127.0.0.1')`. Kodda `HOST` okuyan hiçbir satır yok; `0.0.0.0` dizgesi kaynakta bulunmamalı (guard testi). |
| **DNS rebinding koruması** | Loopback'e bağlı olmak yetmez: kötü niyetli bir web sayfası `evil.com`'u `127.0.0.1`'e çözerek panele istek atabilir. Bu yüzden her istekte `Host` başlığı `127.0.0.1:<port>` veya `localhost:<port>` olmalı; değilse `403 forbidden_origin`. |
| CSRF | `Origin` başlığı varsa `http://127.0.0.1:<port>` / `http://localhost:<port>` / `http://localhost:<MC_WEB_PORT>` kümesinde olmalı; değilse yazma uçlarında `403`. `GET` uçları `Origin` yokluğunu kabul eder (SSE, doğrudan tarayıcı gezinmesi). |
| Yazma yetkisi | §7 yazma kapısı; beyaz liste dışında **hiçbir** yol yazılamaz. |
| Yıkıcı işlem | Panel **hiçbir dosyayı silmez**. Arşivleme `rename`'dir. Retention silmesi yalnızca `MC_DATA_DIR` altında. |
| Yanlışlıkla kapı onayı | İki adımlı doğrulama + sunucuda `confirmed: true` zorunluluğu (§6.4). |
| Path traversal | §3.6 + §7.1 adım 3-5; testleri §11.1/§11.4. |
| Gizli veri | Panel dışarıya hiçbir şey göndermez; log yalnızca yerel stdout. `raw` payload'lar `data/` altında kalır ve `data/` **gitignore**'dadır — aksi halde araç kullanım metinleri yanlışlıkla commit edilebilir. |
| Bağımlılık riski | Kapalı bağımlılık listesi (§3.4); yeni paket ADR gerektirir. |

---

## 11. Test stratejisi

Piramit: çok sayıda hızlı birim testi, orta katmanda gerçek dosya sistemi + gerçek HTTP kullanan entegrasyon testleri, tepede az sayıda ama PRD kabul kriterlerine **birebir** eşlenen Playwright testi.

### 11.1 Birim (vitest, `src/**/*.test.ts`)

| Konu | Doğrulanan |
|---|---|
| Frontmatter yamacı | 12+ golden fixture: LF/CRLF, BOM, `status` tırnaklı/tırnaksız, `status` ilk/orta/son satırda, girintili `status:` (dokunulmamalı), frontmatter yok, kapanış `...`, unicode başlık, çok satırlı blok skaler, `deps: [F-001, F-002]`. **İddia: çıktı ile giriş arasındaki fark tam olarak 1 satırdır** (satır bazlı diff ile ölçülür). |
| Yol beyaz listesi | ~25 vaka tablosu: `docs/features/a.md` ✓ · `docs/features/../../src/x.ts` ✗ · `../outside.md` ✗ · `C:\Windows\x` ✗ · `docs\features\a.md` (Windows ayracı) ✓ · `docs/features/sub/a.md` ✗ · `docs/approvals/G2.ok` ✓ · `docs/approvals/G2.ok/../../../x` ✗ · symlink'li dizin ✗ · `docs/features/a.txt` ✗ · `docs/approvals/archive/G2-2026-09-04-10-00.deny.md` ✓ (yalnızca `archiveDeny` ile) · `patchStatus` çağrısıyla `.ok` yolu ✗ |
| Yol yardımcıları | `path` API kullanımı; `C:\dev\app` kökünün `C:\dev\app-factory`'yi içermediği (önek tuzağı) |
| Olay normalizer | Eksik alan → `missing_fields`; bilinmeyen `hook_event_name` → saklanır; büyük payload → `raw_truncated`; JSON değil → `parse_error` + `raw_text`; bilinmeyen ek alanlar `raw`'da korunur |
| JSONL depo | Append + geri okuma; bozuk satır atlanır ve sayılır; gün dönümünde yeni dosya; retention (gün + adet) doğru dosyaları siler; `seq` yeniden başlatmada devam eder |
| Kart/kapı türetimi | 7 sütun + `unknown`; `conflict` durumu; `G4-2` gruplaması |
| SSE telafi | `Last-Event-ID` ring içinde → eksik olaylar yollanır; ring dışında → `resync` |
| Transkript okuyucu | 5 bozuk fixture'da throw etmez, `lines_bad` doğru sayılır |

### 11.2 Entegrasyon (vitest, gerçek fs + gerçek `node:http`, rastgele port, `MC_DATA_DIR` = geçici dizin)

- `POST /api/events` → `GET /api/events` aynı olayı döner; `flags` doğru.
- Açık SSE bağlantısı yeni olayı 500 ms içinde alır; `id:` = `seq`.
- Sunucu yeniden başlatılır → son 100+ olay yeniden yüklenir (PRD F1/AC6).
- Geçici proje fixture'ı eklenir → `GET /api/features` kartları döner; `docs/features` yoksa `POST /api/projects` 400.
- `PATCH` doğru hash ile → dosya değişir; **bayat hash ile → 409 ve dosya bayt bazında değişmez**.
- Dosya dışarıdan değiştirilir → chokidar `features` SSE olayı 2 s içinde gelir; kendi yazımızdan sonra `origin: 'panel'` gelir (echo bastırma).
- `approve` mevcut `.deny.md` varken → arşive rename + `.ok` yazılır, `.deny.md` **silinmez**.
- `deny` boş gerekçeyle → 400, hiçbir dosya oluşmaz.
- `Host: evil.com` başlığıyla istek → 403.
- **Hook scriptinin kendisi** `child_process.spawn('node', ['.claude/hooks/send-event.cjs'])` ile çalıştırılır, fixture JSON stdin'e yazılır → sunucuya olay ulaşır. Ayrıca: sunucu kapalıyken aynı script **exit 0** ile ve **< 1 s** içinde biter, stdout **boştur**.

### 11.3 E2E (Playwright, `npm run build && npm start` üzerinde, geçici veri dizini + geçici fixture projeleri)

PRD kabul kriteri → test eşlemesi:

| PRD | Playwright testi |
|---|---|
| F1/AC2, AC3 | `request.post('/api/events')` × 3 → satırlar 2 s içinde, yenilemeden görünür; her satırda zaman, proje, agent, araç, özet |
| F1/AC4 | 200 olay hızlı POST → hepsi listede, `seq` sırası bozulmamış (≥%99 eşiği fazlasıyla aşılır) |
| F1/AC5 | Eksik alanlı olay POST → yanıt 202, satır "eksik alan" rozetiyle görünür |
| F1/AC7, AC9 | Proje/tip/agent filtreleri yalnızca görünümü değiştirir; filtre kaldırılınca olaylar geri gelir |
| F2/AC1, AC6 | Fixture'daki 8 kart doğru sütunlarda; bozuk `status` "Bilinmeyen durum"da |
| F2/AC2 | `dev`→`qa` sürükle; testte dosya okunur, **yalnızca `status` satırı** değişmiş olmalı (byte diff) |
| F2/AC3 | Test dosyayı diskte değiştirir → kart 2 s içinde taşınır |
| F2/AC4 | Sürükleme öncesi dosya diskte değiştirilir → uyarı görünür, kart **disk durumuna** göre çizilir, dosya üzerine yazılmamış |
| F2/AC5 | Dosya salt-okunur yapılır → hata mesajı, kart geri döner, panel ayakta |
| F2/AC7 | Kart tıklanınca id/title/owner/deps/sprint salt okunur görünür |
| F3/AC1–AC5 | Proje ekle (5 s içinde kartlar) · çıkar (5 s içinde kalkar, dosyalar diskte aynı) · geçersiz yol reddedilir · 3 proje aynı anda ayırt edilebilir · sunucu yeniden başlatılınca liste korunur |
| F4/AC1–AC5, AC7–AC9 | Kapı durumları doğru · onay doğrulama adımı; **iptal edilince hiçbir dosya yok** · red boş gerekçeyle yazmaz · deny→approve arşivler |
| F5/AC2, AC5 | Bozuk transkript fixture'ı → "okunamadı", kanban/timeline çalışmaya devam eder; thread ekranından hiçbir yazma isteği çıkmaz (`page.on('request')` ile POST/PATCH sayılır = 0) |
| F6/AC2, AC4 | Kaynak yokken "veri yok"; test boyunca dış ağ isteği sayısı 0 (`page.route('**', …)` ile 127.0.0.1 dışı istek yakalanırsa test kırılır) |

### 11.4 Sınır testleri (S4/S1'in otomatik kanıtı — PRD F4/AC6)

**(a) Dosya sistemi anlık görüntü testi.** `tests/helpers/manifest.ts` bir dizinin özyinelemeli manifestini üretir: `(göreli yol, boyut, mtimeMs, sha256)`.
```
1. Zengin bir fixture proje kur: src/, package.json, README.md, .claude/, docs/{features,approvals,qa}/
2. manifestBefore = manifest(projectDir)
3. Senaryo: her yazma ucunu çağır — geçerli PATCH, bayat-hash PATCH, geçersiz status,
   traversal denemeleri, approve, deny, deny→approve, geçersiz kapı adı, symlink hedefi
4. manifestAfter = manifest(projectDir)
5. İDDİA: değişen/eklenen yolların kümesi ⊆ { docs/features/<düzenlenen>.md,
   docs/approvals/<G>.ok, docs/approvals/<G>.deny.md, docs/approvals/archive/** }
   ve SİLİNEN yol sayısı = 0
```
Bu test PRD F4/AC6'nın birebir karşılığıdır ve her PR'da çalışır.

**(b) Statik guard testi.** `src/**/*.ts(x)` taranır; `writeFile`, `writeFileSync`, `appendFile*`, `rename*`, `unlink*`, `rm`, `rmdir`, `mkdir*`, `cp*`, `createWriteStream`, `truncate*` çağrıları yalnızca şu dosyalarda bulunabilir: `src/server/write-gate.ts`, `src/server/store/jsonl-store.ts`, `src/server/store/projects-registry.ts`, `src/server/store/retention.ts`. Başka yerde bulunursa test kırılır. Ayrıca `0.0.0.0`, `MC_HOST`, `http://` ile başlayan 127.0.0.1 dışı literal aranır. (Okuma API'leri serbesttir.)

**(c) Bağımlılık testi.** `package.json` bağımlılıkları §3.4 kapalı listesiyle karşılaştırılır; liste dışı paket → test kırılır (ADR ile listeyi güncellemek gerekir).

### 11.5 Fixture envanteri

```
tests/fixtures/
├─ projects/
│  ├─ alpha/    docs/features/{F-001..F-008}.md (7 sütun + bozuk status + frontmatter'sız),
│  │            docs/approvals/{G0.ok,G1.ok,G2.deny.md}, docs/qa/latest.md, src/, package.json
│  ├─ beta/     minimal (yalnızca docs/features)
│  └─ gamma/    docs/features YOK (geçersiz proje testi)
├─ events/      valid.json, missing-fields.json, unknown-type.json, oversize.json,
│               not-json.txt, unicode-summary.json
└─ transcripts/ valid.jsonl, truncated-last-line.jsonl, unknown-schema.jsonl, empty.jsonl, bom-crlf.jsonl
```

---

## 12. Hosting, deploy ve çalıştırma komutları

**Hosting yoktur. Deploy yoktur.** Araç kullanıcının makinesinde, kendi deposundan çalışır. G6 kapısı bu proje için "kullanıcı `npm start` diyor" anlamına gelir; hiçbir sunucuya, mağazaya veya kayıt defterine gönderim yapılmaz. `npm publish` yapılmaz.

`package.json` scriptleri (fabrika `CLAUDE.md` "Çalıştırma" bölümüyle uyumlu):

| Komut | Ne yapar |
|---|---|
| `npm run dev` | `concurrently` ile `dev:server` + `dev:web` |
| `npm run dev:server` | `tsx watch src/server/index.ts` (127.0.0.1:7333) |
| `npm run dev:web` | `vite --port 7334` (`/api` → 7333 proxy) |
| `npm run build` | `vite build` → `dist/web` |
| `npm start` | `tsx src/server/index.ts` — tek port 7333, `dist/web` statik servis |
| `npm test` | `vitest run` (birim + entegrasyon) |
| `npm run test:watch` | `vitest` |
| `npm run e2e` | `playwright test` (önce `build`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm run format` | `prettier --write .` |
| `npm run install-hook -- <proje-yolu>` | `send-event.cjs`'i kopyalar + `settings.json`'a hook satırlarını birleştirir (F-004) |
| `npm run verify` | `typecheck && lint && test && build` — feature bitiş kapısı. (CEO düzeltmesi 2026-09-04, QA sözleşme denetimi R1: `build` dahildir; CI yalnızca `verify` koşuyor, aksi hâlde `vite build` hiçbir otomatik kapıdan geçmezdi. `e2e` dahil DEĞİLDİR — Playwright tarayıcı indirmesi CI'ı kırılganlaştırır.) |

İlk kurulum: `npm install` → `npm run install-hook -- C:\dev\apps\<proje>` → `npm run dev`.

---

## 13. Üçüncü parti servisler ve paket dokümanları

### 13.1 Servisler

| Servis | Kullanılıyor mu | Ücret / hesap | Not |
|---|---|---|---|
| Bulut barındırma (Vercel/Fly/Railway/…) | **Hayır** | — | Ürün yerel; deploy kapsam dışı |
| Veritabanı servisi (Supabase/Neon/…) | **Hayır** | — | Depo = yerel JSONL (ADR-003) |
| Kimlik/auth sağlayıcı | **Hayır** | — | Auth yok (§10) |
| Analitik / hata izleme (Sentry, PostHog…) | **Hayır** | — | Telemetri G0'da yasaklandı |
| LLM / harici API | **Hayır** | — | Panel model çağırmaz |
| Higgsfield (varlık üretimi) | **Hayır** | — | Görsel varlık gerekmiyor; ASSETS kapısı bu projede açılmaz |
| npm registry | Evet (yalnızca `npm install` sırasında) | Ücretsiz, hesap gerekmez | Çalışma zamanında ağ erişimi yok |
| Tailscale / SSH tüneli | **Hayır (MVP dışı)** | Ücretsiz katman ama **hesap gerektirir** → **KULLANICI ONAYI** | ADR-001 karar 1; ürün kodu değişmez, kullanıcının kendi tercihi |

**Ücretli veya hesap gerektiren hiçbir bağımlılık yoktur.** Yukarıdaki tabloda "KULLANICI ONAYI" işaretli tek satır (Tailscale) MVP kapsamı dışındadır ve ürün kodunu etkilemez.

### 13.2 Paket dokümanları (`docs/packages/`) — hiçbiri etkinleştirilmez

| Paket | Karar | Gerekçe |
|---|---|---|
| `i18n` | Etkin değil | Tek kullanıcı, arayüz yalnızca Türkçe (G0 kararı). Metinler bileşenlerde gömülü; ileride gerekirse tek bir `strings.ts` ile başlanır. |
| `payments` | Etkin değil | Ödeme yok, ücret yok. |
| `analytics` | Etkin değil | Telemetri açıkça yasak (G0/G1 kapsam dışı). |
| `legal` | Etkin değil | Dağıtım yok, kullanıcı verisi toplanmıyor, üçüncü kişi kullanımı yok. |
| `store` | Etkin değil | Mobil native uygulama ve mağaza gönderimi kapsam dışı. |

---

## 14. Tahmini aylık maliyet

**0 TL / ay.** Doğrulama kalemleri:

| Kalem | Aylık | Not |
|---|---|---|
| Barındırma | 0 TL | Yok — kullanıcının kendi makinesi |
| Alan adı / TLS | 0 TL | Yok — `http://127.0.0.1:7333` |
| Veritabanı | 0 TL | Yerel dosya |
| Harici API / LLM | 0 TL | Çağrı yok |
| Hata izleme / analitik | 0 TL | Yok |
| Bağımlılık lisansları | 0 TL | Hepsi MIT/ISC/Apache-2.0 sınıfı ücretsiz paketler |
| Varlık üretimi (Higgsfield) | 0 TL | Kullanılmıyor |
| Disk | 0 TL | 30 gün / 20.000 olay sınırıyla tipik < 50 MB |

Tek "maliyet" geliştirme sırasındaki Claude kullanımıdır; bu ürünün işletme maliyeti değildir. Kullanıcının aboneliği dışında **hiçbir yeni ücret kalemi doğmaz** ve doğması için ADR + kullanıcı onayı gerekir.

---

## 15. Riskler ve azaltımlar

Doğrulama raporundaki (`docs/00-idea-validation.md`) 4 risk + mimariden doğan 4 yeni risk:

| # | Risk | Mimari cevabı |
|---|---|---|
| (a) | **Hook payload şeması garanti değil** — tüm `send-event.cjs`'ler aynı anda kırılabilir | Sunucu **şemadan bağımsız**: bilinen alanlar opsiyonel, tanınmayan her şey `raw` içinde saklanır (§5.1). Hook scripti hiçbir alanı zorunlu görmez; eksikse `missing_fields` bayrağı. Yeni olay tipi eklemek yalnızca `settings.json` satırıdır. Kırılma **sessiz olmaz**: `/api/health` ve UI, `flags` dağılımını ve son olay zamanını gösterir; olay akışı durursa görünür. |
| (b) | **Transkript formatı belgesiz** (en yüksek risk) | Faz 2'nin **iki** kaynağı var: güvenilir `docs/qa/*` dosyaları ve best-effort transkript. Thread ekranı birincisiyle tek başına çalışır. Yol **tahmin edilmez, olaylardan toplanır** (§9.2). Okuyucu satır bazlı hataya dayanıklı; bozulursa yalnızca o bölüm "okunamadı". F-009 spike'ı kod yazmadan önce formatı doğrular ve fixture'lara dondurur. |
| (c) | **`better-sqlite3` native derleme** | Bağımlılık kapalı listesinde yok ve yasaklı (ADR-003). Depo düz JSONL; `npm install` derleyici gerektirmez. Test (c): bağımlılık beyaz listesi testi (§11.4c). |
| (ek) | **Port 4000 çakışması** | Varsayılan `7333` (§3.5); env ile değiştirilebilir. Sunucu `EADDRINUSE` alırsa okunabilir Türkçe mesaj basar ve `MC_PORT` önerir. |
| (y1) | **Windows `rename` EPERM** (antivirüs / açık editör dosyayı kilitler) | 3 kademeli yeniden deneme (50/100/200 ms), sonra `write_failed` + UI'da okunabilir hata + kartın geri dönmesi (PRD F2/AC5). `tmp` dosyası `finally` içinde her koşulda silinir. |
| (y2) | **chokidar ağ sürücüsü/WSL'de olay kaçırır** | `MC_WATCH_POLLING=1` ile polling'e geçiş; ayrıca kanban ekranı 30 s'de bir "yumuşak" yeniden doğrulama yapar (`GET /api/features`), yani izleme sessizce ölse bile pano en fazla 30 s bayat kalır. |
| (y3) | **Node sürümü bilinmiyor** (bu ortamda doğrulanamadı) | `tsx` kullanıldığı için yerleşik TS desteğine bağımlılık yok; taban gereksinim Node ≥ 20.11 (`package.json` `engines`) ve sunucu açılışta sürümü kontrol edip Türkçe hata basar. F-001'in ilk işi `node --version` doğrulamasıdır. |
| (y4) | **SSE + sürükle-bırak yarışı** — sürükleme sırasında gelen `features` olayı kartı yerinden oynatabilir | Aktif sürükleme sırasında gelen `features` olayları kuyruğa alınır, bırakma bittiğinde uygulanır; PATCH yanıtı 409 ise zaten disk durumu esas alınır (PRD F2/AC4 bunu zaten talep ediyor). |

---

## 16. Feature parçalama önerisi

> Bu yalnızca **öneri listesidir**. Feature notu dosyalarını CEO oluşturur (`docs/features/F-NNN-<slug>.md`).
> Faz 1 = F-001…F-007 (bittiğinde ürün tek başına kullanılabilir, PRD başarı ölçütü 6). Faz 2 = F-008…F-011.

| id | Başlık | Bağımlılık | Dokunacağı alan | Boyut |
|---|---|---|---|---|
| **F-001** | **İskelet: repo, TS, Vite/React/Tailwind kabuğu, `node:http` sunucusu, test altyapısı, CI** | — | `git init`, `package.json`, `tsconfig`, `vite.config`, `vitest.config`, `playwright.config`, `eslint`/`prettier`, `src/server/index.ts` (+`/api/health`), `src/web/` boş kabuk, `.github/workflows/ci.yml`, `.gitignore` (`data/`, `dist/`), `npm run verify` | M |
| **F-002** | Olay alma + JSONL depo + retention | F-001 | `src/features/events/server/**`, `src/server/store/**`, `src/shared/types.ts` | M |
| **F-003** | SSE akışı + canlı zaman çizelgesi UI + filtreler | F-002 | `src/server/sse/**`, `src/features/events/web/**`, `src/web/lib/useEventStream.ts` | M |
| **F-004** | `send-event.cjs` hook scripti + `install-hook` + hook smoke testleri | F-002 | `.claude/hooks/send-event.cjs`, `scripts/install-hook.mjs`, `tests/helpers/emit-hook.ts`, `KURULUM.md` | S |
| **F-005** | Proje kayıt defteri + chokidar izleme + ayarlar ekranı (çok projeli izleme) | F-003 | `src/features/projects/**`, `src/server/watch/**`, `src/server/store/projects-registry.ts` | M |
| **F-006** | **Yazma kapısı + sınır testleri** (kod yazan tek güvenlik bileşeni) | F-001 | `src/server/write-gate.ts`, `tests/helpers/manifest.ts`, §11.4 testleri | M |
| **F-007** | Kanban panosu + frontmatter `status` yazma + çakışma/echo yönetimi | F-005, F-006 | `src/features/kanban/**` (server + web), frontmatter yamacı | L |
| **F-008** | Kapılar paneli (G0–G6/ASSETS), onay/red/arşiv akışı | F-006, F-007 | `src/features/gates/**` | M |
| **F-009** | **Spike:** transkript format doğrulama + dayanıklı okuyucu + fixture'lar | F-003 | `src/features/thread/server/transcript-reader.ts`, `tests/fixtures/transcripts/**`, `docs/wiki/pages/desen/claude-transcript-formati.md` | S–M |
| **F-010** | Feature thread görünümü (docs/qa birincil, transkript best-effort) | F-007, F-009 | `src/features/thread/**` | M |
| **F-011** | Token kullanımı ekranı (proje/gün/oturum/agent grupları) | F-009 | `src/features/usage/**` | S |

Sıra notları:
- **F-006 (yazma kapısı) F-007'den önce bitmelidir**; kanban yazması kapıdan geçmek zorunda olduğu için tersi mümkün değil.
- F-004 teknik olarak F-002'den sonra herhangi bir zamanda yapılabilir, ama erken yapılması gerçek veriyle geliştirmeyi sağlar (önerilen sıra: F-002 → F-004 → F-003).
- F-009 bir *araştırma* feature'ıdır; çıktısı kod değil, doğrulanmış format + fixture + okuyucudur. QA kriteri: 5 bozuk fixture'da throw etmemek ve format notunu yazmış olmak.

---

## 17. ADR dizini ve G2'de kullanıcıya sorulacaklar

| ADR | Konu | Karar (özet) |
|---|---|---|
| ADR-001 | Ürün davranışı kararları (G1) | *(mevcut, değiştirilmedi)* |
| ADR-002 | Olay sunucusu: sıfırdan mı, OSS uyarlaması mı | **Sıfırdan yaz** (disler lisanssız, hook-lab Elixir) |
| ADR-003 | Depolama katmanı | Düz JSONL, günlük dosyalar, append-only |
| ADR-004 | Gerçek zamanlı taşıma | SSE + `Last-Event-ID` telafisi |
| ADR-005 | Yazma kapısı ve güvenlik sınırı | Tek modül, niyet tabanlı API, beyaz liste, silme yok |
| ADR-006 | Hook taşıma biçimi | `command` + `async` script (`type:"http"` değil) |
| ADR-007 | Faz 2 transkript ve token kaynağı | Kendi minimal okuyucumuz (ccusage/OTel değil) |

**CEO'nun G2'de kullanıcıya sorması gereken en fazla 3 madde** — gerekçeler ilgili ADR'lerde:
1. **Token kaynağı G0 daralmasından sapıyor.** G0.ok "hazır kaynak (ccusage/OTel) öncelikli değerlendirilecek" diyordu; değerlendirdik ve **kendi minimal okuyucumuzu** seçtik (ccusage aynı belgesiz dosyayı okuyan üçüncü parti bir CLI; format riskini azaltmıyor, üstüne kurulum/ağ bağımlılığı ekliyor — ADR-007). Onaylanıyor mu?
2. **Faz 2 sırası.** F-008 (kapılar paneli, P1) Faz 1 biter bitmez mi yapılsın, yoksa önce F-009 spike'ı (transkript formatı) mı koşulsun? Öneri: **önce F-008** — daha yüksek değerli ve risksiz; spike sonra.
3. **Panelin kendi deposu Mission Control reposunun içinde (`data/`, gitignore'lu) mu dursun, yoksa `%APPDATA%`/`~/.config` altında mı?** Öneri: **repo içinde** (yedeklemesi ve silmesi görünür, taşınabilir). Alternatifi seçmek yalnızca `MC_DATA_DIR` varsayılanını değiştirir.
