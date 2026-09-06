---
feature: F-012
title: CEO sohbet arayüzü — panel, oturumu Agent SDK ile barındırır
author: developer
status: draft
date: 2026-09-06
---

# F-012 Sözleşmesi — Panel CEO oturumunu `@anthropic-ai/claude-agent-sdk` ile barındırır

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").
Bu turda `src/`, `tests/`, `package.json` altında **hiçbir dosya değiştirilmedi**; yalnızca bu
sözleşme metni yazıldı. `git status --porcelain` bunu doğrular (tek satır: bu dosya).

**Kanıt işaretleri (bu belge boyunca):** **✓ DOĞRULANDI** (bu turda kendim okudum/çalıştırdım,
alıntı/yol var) · **⊢ ÇIKARIM** (doğrulanmış kanıttan türetildi) · **[T] TAHMİN** (doğrulanmadı,
riski açıkça yazıldı).

## 0. Kaynaklar ve bu turda yapılan doğrulama

**Bağlayıcı kaynaklar (okundu, tam metin):**
`docs/features/F-012-ceo-sohbet-arayuzu.md` (AC listesi + CEO'nun önden verdiği kararlar K1-K8) ·
`docs/decisions/ADR-014-paneli-ceo-oturumunun-arayuzu-yapmak.md` (özellikle "Sonuçlar" bölümü) ·
`docs/spikes/SPIKE-002-paneli-ceo-istemcisi-yapmak.md` (§2-§10, mimari S4 dahil) ·
`docs/spikes/SPIKE-002-asama0-olcum.md` (M1/M2/M3 — bu üçü GEÇTİ, gerçek oturum açılarak ölçüldü,
bu sözleşme onları **tekrar ölçmüyor**, sonuçlarına dayanıyor) ·
`docs/decisions/ADR-013-yazma-uclarinda-ozel-baslik-zorunlulugu.md` (`x-mc-write` kuralı + ek) ·
`docs/decisions/ADR-005-yazma-kapisi-ve-guvenlik-siniri.md` (statik/manifest guard'ların kapsamı) ·
`docs/decisions/ADR-004-gercek-zamanli-tasima.md` (SSE tek-bağlantı-çok-kanal kararı) ·
`docs/decisions/ADR-009-tek-platform-windows.md` · `CLAUDE.md` "Öğrenilen kurallar" (tamamı).

**Kod okunarak doğrulandı (✓ DOĞRULANDI, bu turda):** `src/server/index.ts` (tam dosya, 471 satır —
dağıtıcı sırası, `withDispatchErrorBoundary`'nin yalnızca SENKRON hatayı yakaladığı, `x-mc-write`
kontrolünün `POST /api/events` dışındaki TÜM non-GET `/api/*` uçlarını otomatik kapsadığı, `server.
on('close', ...)` içindeki `stopRetention()`/`projectsService.stopAll()` deseni) · `src/server/sse/
stream.ts` + `hub.ts` (tel formatı, `Last-Event-ID` ayrıştırma/karar fonksiyonları, `hello`/`resync`
çerçevelerinin **`id:` taşımadığı**) · `src/features/events/server/ingest.ts` (asenkron IIFE'nin
**kendi** `try/catch`'ini taşıdığı — dağıtıcının senkron sınırına güvenmediği somut emsal) ·
`src/server/write-gate.ts` (tam dosya — dört niyet fonksiyonu, `atomicWrite` retry deseni) ·
`src/shared/types.ts` (`ApiResponse<T>`, `WRITE_HEADER_NAME`/`VALUE`, `ErrorCode` birleşimi) ·
`src/web/lib/write-fetch.ts` + `useEventStream.ts` (istemci tarafı `x-mc-write` sarmalayıcısı ve SSE
kanal ekleme deseni — `onProjects`/`onFeatures` emsali) · `.claude/settings.json` (6 güvenlik hook'u
+ `send-event.cjs` telemetri hook'u, tam liste §8'de) · `tests/no-write-gate-bypass.test.ts` +
`tests/no-external-host.test.ts` (ikisi de `src/features/**`'i **özyinelemeli** tarıyor — yeni
`src/features/chat/**` otomatik kapsanıyor, tarama kökü eklemek **gerekmiyor**) ·
`tests/deps.test.ts` (kapalı paket adı listesi DEĞİL, `hasInstallScript`/native-araç/
`better-sqlite3` guard'ı — yeni bağımlılıkların bu guard'a **nasıl** çarpabileceği §2.3'te
değerlendirildi) · `package.json` (mevcut 5 üretim bağımlılığı, script listesi, `engines.node
>=20.11`).

**Bu turda tekrar doğrulanan dış kanıt:** `npm view @anthropic-ai/claude-agent-sdk version` bu
sözleşme turunda çalıştırıldı (salt okunur, kurulum yapılmadı) → **`0.3.261`** ✓ DOĞRULANDI —
`SPIKE-002-asama0-olcum.md`'nin ölçtüğü sürümle **aynı**, paket registry'de değişmemiş.

**Bu turda tekrar ölçülmeyen (zaten SPIKE-002-asama0'da gerçek oturumla ölçülmüş, kanıtına
güveniliyor — `CLAUDE.md`: "kurulu sürümden doğrula" kuralı zaten o turda karşılandı):**
K7'nin gerektirdiği "araç isim yüzeyi kurulu sürümden doğrulansın" şartı — `Agent` aracının gerçek
adı, `ListAgents`'ın peer-session sınırlaması, `.claude/agents/*.md` alt agent'larının
`settingSources` ile yüklendiği, arka plan varsayılanı, `SessionStart` hook'unun ateşlediği — hepsi
**gerçek bir SDK oturumu açılarak** ✓ DOĞRULANDI (asama0 raporu). Bu sözleşme turunda **hiçbir
oturum açılmadı** (görev kısıtı: kullanıcının kotasını harcamamak) — bu, tekrarlanan bir ölçüm
olmadığı için kabul edilebilir; §11'deki "canlı" testler bu boşluğu **uygulama turunda** kapatacak.

---

## 1. Kapsam

**İçinde:**

1. Barındırılan tek bir CEO sohbet oturumu (K1): sunucu içi yaşam döngüsü, `POST /api/chat/*`
   uçları, `/api/stream` üzerinden yeni `chat_*` SSE kanalları, `canUseTool` tabanlı izin/soru
   akışı, `ANTHROPIC_API_KEY` bariyeri, kendi görüntüleme önbelleği (kalıcılık), hata sınırı.
2. Sohbet özelliğinin açma/kapama anahtarı (K6) ve devre dışıyken mevcut ekranların bozulmadığını
   kanıtlayan testler.
3. Veri akışı + durum makinesi + hata semantiği (K8) — **görsel bileşenler bu sözleşmenin konusu
   değildir**, bkz. §1 "Kapsam DIŞI" ve §12.
4. `package.json`'a `@anthropic-ai/claude-agent-sdk` + zorunlu peer bağımlılıkları eklemek.

**Kapsam DIŞI (bilinçli, K4/K8 + feature notu):**

- Olay akışının (izlenen projelerin hook verileri) CEO'nun bağlamına herhangi bir biçimde
  **beslenmesi** — K4. Bu feature bu köprüyü **kurmaz**; ileride istenirse ayrı bir feature/karar.
- Çoklu sohbet oturumu / thread (F-010'un konusu), kapılar paneli (F-008), token ekranı (F-011).
- Görsel tasarım, renk/spacing/tipografi, kullanıcıya görünen Türkçe metinlerin **son hâli**
  (K8) — `docs/03-ux.md`'nin sohbet ekranı bölümüne atıfla uygulanır, bu sözleşme yalnızca
  hangi veri/duruma hangi ekranın erişeceğini tanımlar (§5, §10 sözlüğü). **Bu belgeye
  DOKUNULMADI.**
- `docs/decisions/ADR-005-yazma-kapisi-ve-guvenlik-siniri.md`'ye ek yazmak. SPIKE-002 §6.1'in
  tespiti geçerliliğini koruyor: barındırılan oturum, `write-gate.ts`'in dört-niyet sınırının
  **dışında** kalan bir yazma yüzeyi açıyor ve mevcut statik/manifest guard'lar (ADR-005 karar 10)
  bunu **ölçmüyor** (kod okunarak bu turda yeniden doğrulandı ✓ — `tests/no-write-gate-bypass.
  test.ts` yalnızca `src/**`'taki `fs.writeFile*` vb. çağrılarını tarıyor; agent alt sürecinin
  dosya yazmaları bu taramanın **dışında**, bir Node çağrısı değil). Bu, `docs/decisions/` dosyası
  ve bu feature'ın dosya sahipliği dışında — **açık soru olarak §13'e taşındı**, CEO/architect
  ayrı yazmalı.
- `ANTHROPIC_AUTH_TOKEN` için ayrı bir bariyer (yalnızca `ANTHROPIC_API_KEY` — AC ve ADR-014'ün
  literal ifadesi bununla sınırlı) — §7'de gerekçeli, §13'te açık soru olarak bırakıldı.

---

## 2. Dokunacağım dosyalar

### 2.1 Yeni — sunucu

| Dosya | Amaç |
|---|---|
| `src/features/chat/server/env-barrier.ts` | Saf fonksiyonlar: `checkApiKeyBarrier(env)` → `{tripped: boolean}`, `stripApiKey(env)` → env'i **mutate eder**, kaldırılan değeri asla döndürmez/loglamaz (§7). `process.env`'e doğrudan dokunmaz — çağıran (`session.ts`) hangi env nesnesine uygulanacağını seçer, böylece testler gerçek `process.env`'i kirletmeden saf obje ile test edebilir. |
| `src/features/chat/server/session.ts` | Oturumun tek sahibi: bootstrap (env bariyeri + `query()` çağrısı + `cwd`/`settingSources`/`permissionMode`/`maxBudgetUsd` sabitleri), streaming-input kuyruğu, mesaj döngüsü (`for await`), `canUseTool` → bekleyen istekler haritası, `interrupt()`, restart, durum makinesi (`idle\|busy\|crashed\|disabled`), her SDK mesajını hem SSE'ye yayınlar hem `history-log.ts`'e yazar. `query` fonksiyonu **enjekte edilebilir** parametre (`createChatSession(deps)`) — testler gerçek SDK'yı hiç çağırmadan (kota harcamadan) sahte bir `query` ile tüm mantığı sınar; üretimde varsayılan gerçek `query` (SDK'dan import). |
| `src/features/chat/server/history-log.ts` | Kendi basit ekleme-log dosyası (`<dataDir>/chat/history.jsonl`) — SDK'nın kendi transkript formatını **ayrıştırmaz** (SPIKE-002 §5.5 kararı), yalnızca bu sunucunun zaten ürettiği/aldığı görüntüleme mesajlarını kalıcı hale getirir. `append(entry)`, `readAll()`, `markDanglingAsInterrupted()` (kilitlenme sonrası temizlik, §6). |
| `src/features/chat/server/handlers.ts` | HTTP işleyicileri: `handleChatMessage`, `handleChatInterrupt`, `handleChatPermission`, `handleChatRestart`, `handleChatStatus`, `handleChatHistory`. Her biri kendi `try/catch`'ini taşır (§9) — `ingest.ts`'in async-IIFE deseniyle **birebir aynı**. |

### 2.2 Yeni — istemci (veri katmanı, görsel DEĞİL — K8)

| Dosya | Amaç |
|---|---|
| `src/features/chat/web/useChatSession.ts` | `useEventStream.ts`'in `onProjects`/`onFeatures` deseniyle **aynı şekilde** yeni `chat_*` SSE olaylarına abone olur (App kökündeki **tek** `stream`/`EventSource`'a — K5, ikinci bağlantı YOK). Dışa: `{ messages, status, pendingRequests, sendMessage(text), interrupt(), respond(requestId, result), restart() }`. `writeFetch` ile POST'lar (mevcut sarmalayıcı, değişmeden). |
| `src/features/chat/web/ChatScreen.minimal.tsx` | **Bilinçli olarak minimal/işlevsel** ekran — metin girişi, mesaj listesi, izin isteği kartı, meşgul/hata/bariyer banner'ı. Yeni bir görsel dil icat **etmez**; mevcut ekranlarda kullanılan temel Tailwind yardımcı sınıflarını (kenarlık, boşluk, mevcut renk paleti) tekrar kullanır. `docs/03-ux.md`'nin sohbet ekranı bölümü onaylandığında **ayrı, küçük bir görsel-uygulama turu** bu dosyayı değiştirir/yeniden adlandırır — bkz. §13 açık soru 1 (bu, bu feature'ın DoD'sini etkiler, CEO'ya soruldu). |

### 2.3 Yeni — testler

| Dosya | Kapsam |
|---|---|
| `tests/features/chat/server/env-barrier.test.ts` | Birim — bariyer saf fonksiyonları. |
| `tests/features/chat/server/session.test.ts` | Birim, **enjekte edilmiş sahte `query`** — mesaj kuyruklama, `canUseTool` bekleme/çözme, `interrupt()`, restart, durum geçişleri, hata sınırı (sahte `query` reddedince ne olur), `settingSources`/`cwd`/`permissionMode`/`maxBudgetUsd` seçeneklerinin doğru değerlerle çağrıldığı. |
| `tests/features/chat/server/history-log.test.ts` | Birim — gerçek geçici dizin: ekleme, okuma, `markDanglingAsInterrupted` (yarım kalan `streaming` girdisi → `interrupted`). |
| `tests/integration/chat-api.test.ts` | Entegrasyon — gerçek `createServer()` + gerçek HTTP + **enjekte edilmiş sahte `query`** (gerçek SDK/ağ YOK): `x-mc-write` zorunluluğu (regresyon çiti, mutasyon 6), bariyer bayrağının `GET /api/chat/status`'ta göründüğü, izin round-trip'i, kesme, restart, disabled-modda tüm chat uçlarının **düzgün** (503/404, çökme değil) davrandığı, hata sınırı (mutasyon 7). |
| `tests/features/chat/no-context-injection.test.ts` | Statik guard (K4) — `src/features/chat/**` hiçbir dosyası `jsonl-store`, `events/server/query`, `events/server/ingest`, `sse/hub`'ın **broadcast dışı** okuma API'lerini import etmiyor (mutasyon 8). |
| `tests/features/chat/permission-mode-fence.test.ts` | Statik guard — `session.ts` içinde `permissionMode` **literal** değeri `'bypassPermissions'` veya `'acceptEdits'` değil (mutasyon 4). |
| `tests/integration/chat-hooks-live.test.ts` | **Varsayılan `npm test`/`npm run verify`'de KOŞMAZ** — `describe.skipIf(!process.env.MC_CHAT_LIVE_TESTS)`. Gerçek SDK oturumu açar (küçük/ucuz prompt, `model: 'haiku'`), SPIKE-002-asama0 M2 yöntemiyle **iki yönlü** kanıtlar: hook aktifken engellenir, hook no-op'a çevrilince (sandbox kopyası) geçer. Manuel çalıştırma: `MC_CHAT_LIVE_TESTS=1 npx vitest run tests/integration/chat-hooks-live.test.ts` — gerçek abonelik kotası harcar (SPIKE-002-asama0'da ölçülen mertebe: birkaç sent-eşdeğeri). §11 ve §13'te ne zaman koşulacağı tartışılıyor. |

### 2.4 Değiştireceğim (chat dizini dışı — her biri mekanik/zorunlu, gerekçeli)

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `src/server/index.ts` | (a) `createServer` içine `createChatSession(...)` çağrısı + `handleChat*` route eşleşmeleri (mevcut `if (pathname === ... && req.method === ...)` deseni, F-005/F-007 emsali). (b) `server.on('close', ...)` içine `chatSession.stopAll()` çağrısı eklenir (`stopRetention()`/`projectsService.stopAll()` ile **aynı satırda**, aynı desen). `x-mc-write` kontrolü **zaten** tüm non-GET `/api/*` uçlarını otomatik kapsıyor (ADR-013) — dağıtıcıya ek bir güvenlik satırı **gerekmiyor**, yalnızca route dispatch + kapanış çağrısı. | Feature notu "sohbet ucunun kaydı için `src/server/` içindeki dağıtıcı satırı" — her önceki feature (F-002/F-003/F-005/F-007) burada kendi route'unu ve kendi kapanış çağrısını aynı şekilde eklemiş, emsal net. Dokunulan satır sayısı küçük tutulacak (~6-10 satır); QA bunu diff'te doğrulayabilir. |
| `src/web/App.tsx` | Yeni sekme (Ayarlar dişlisinin solunda, mevcut sekme listesine bir eleman) veya sohbetin panel kabuğunda nerede yaşayacağı — **görsel/gezinme kararı `docs/03-ux.md`'nin konusu** (K8). Bu dosyada yapılacak **teknik** değişiklik yalnızca: `useEventStream`'e `onChatMessage`/`onChatStatus`/vb. callback'lerini geçirmek (mevcut `onFeatures` deseni) ve `ChatScreen.minimal.tsx`'i mevcut `stream`/bağlantı prop'larıyla bağlamak — **ikinci bir `EventSource` açılmaz** (K5). Sekme yerleşiminin kendisi UX dokümanı onaylanınca netleşir; bu turda geçici/en az invaziv bir bağlama noktası kullanılır (§13 açık soru 1). | Her ekran ekleyen feature bu dosyaya dokunur (F-005/F-007 emsali) — tek kabuk. |
| `src/web/lib/useEventStream.ts` | `onFeatures` ile **birebir aynı** desende `onChatMessage`/`onChatStatus`/`onChatToolEvent`/`onChatPermissionRequest`/`onChatPermissionResolved`/`onChatError` seçenekleri + `es.addEventListener(...)` eklenir. | ADR-004 "tek bağlantı çok kanal" — yeni kanal eklemenin **zaten kurulu** yolu. |
| `package.json` | `dependencies`'e `@anthropic-ai/claude-agent-sdk@^0.3.261`, `zod@^4`, `@anthropic-ai/sdk@>=0.93.0`, `@modelcontextprotocol/sdk@^1.29.0` eklenir (peer bağımlılıkların hepsi doğrudan bağımlılık olarak eklenir — SDK'nın kendisi `dependencies` taşımıyor, ✓ DOĞRULANDI §2.1 registry kaydı). `scripts`'e `"test:chat-live": "vitest run tests/integration/chat-hooks-live.test.ts"` eklenir (varsayılan `test`/`verify` bunu **çağırmaz**). | SDK'nın peer gereksinimleri; `npm ci`'nin `--omit=optional` **kullanılmadığı** doğrulanmalı (CI script'i bu sözleşmenin kapsamı dışında, mevcut `package.json` script'lerinde zaten yok ✓ DOĞRULANDI). |
| `src/shared/types.ts` | `ErrorCode` birleşimine `'chat_disabled' \| 'session_not_ready' \| 'no_active_turn' \| 'request_not_found'` eklenir (mekanik tek satır — F-007'nin aynı dosyaya `write_denied`/`write_failed` eklediği emsal, §2.4). `ChatLogEntry` tipi (§6) burada tanımlanır — sunucu ve istemci aynı şekli import eder. | Paylaşılan tip deposu; her feature kendi tip genişletmesini burada yapıyor (mimari emsal). |

**Not — dokunulmayacağını doğruladığım dosyalar (olumsuz iddia, ✓ DOĞRULANDI):**
`src/server/store/jsonl-store.ts`, `src/server/store/retention.ts`, `src/server/write-gate.ts`,
`src/features/events/**`, `src/features/projects/**`, `src/features/kanban/**` — hiçbiri
değişmiyor. Sohbetin kendi görüntüleme önbelleği (`history-log.ts`) **kasıtlı olarak** `jsonl-
store.ts`'i yeniden kullanmıyor: o modül `EventRecord` şemasına sıkı bağlı (import tipinden ✓
DOĞRULANDI) ve dosya sahipliği dışında (`src/server/store/**` bu feature'ın listesinde yok) —
ikinci bir tüketici için genelleştirmek Karpathy §2 ihlali olurdu, kendi basit dosyası yeterli.

### 2.5 Yeni bağımlılıklar — `tests/deps.test.ts` etkisi (önceden değerlendirildi)

`@anthropic-ai/claude-agent-sdk`'nin `optionalDependencies`'i **platforma özgü önceden derlenmiş
ikili** paketlerdir (native derleme değil, ✓ DOĞRULANDI §2.1). `tests/deps.test.ts`'in üç kontrolü
kod okunarak değerlendirildi: (1) `hasInstallScript` — bu paketlerin `install`/`postinstall`
script'i taşıyıp taşımadığı **bu sözleşme turunda `npm view`/paket kaydından doğrulanmadı** [T] —
uygulama turunda `package-lock.json` üretildikten sonra ilk iş bu testi çalıştırmak olmalı; taşırsa
beyaz listeye (`ALLOWED_INSTALL_SCRIPT_PACKAGES`) gerekçeli bir ekleme gerekir (SPIKE-002 §7.4'ün
zaten işaret ettiği risk — burada da devralınıyor, yeni değil). (2) native araç isimleri
(`node-gyp` vb.) SDK'nın bağımlılık ağacında **yok** (paket `dependencies` taşımıyor, yalnızca
`peerDependencies`, ✓ DOĞRULANDI). (3) `better-sqlite3` ilgisiz.

---

## 3. Oturum yaşam döngüsü

**Nerede yaşıyor:** mevcut `127.0.0.1:7333` Node sürecinin **içinde**, ayrı bir süreç/port
**değil** (SPIKE-002 §5.1 önerisi, gerekçeler ✓ DOĞRULANDI: SDK zaten kendi `claude` CLI alt
sürecini `spawn` ediyor — izolasyon zaten var; `scripts/check-ports.mjs` tek-süreç modeline kurulu;
ikinci port yönetmek istenmiyor). Panel süreci **ebeveyn**, SDK'nın açtığı `claude.exe` **çocuk**
(Windows, ADR-009).

**`cwd` açıkça verilir** (varsayılana güvenilmez): `path.resolve(__dirname, '..', '..', '..')`
(`src/features/chat/server/session.ts`'ten repo köküne) — `process.cwd()` **kullanılmaz**, çünkü
`npm run dev`/`tsx watch` her zaman repo kökünden çalıştırılmayabilir ve yanlış `cwd` = `.claude/`
ve `CLAUDE.md`'nin **sessizce yüklenmemesi** (SPIKE-002 §5.1, bu deponun "sessiz kayıp" hata
sınıfının bir başka görünümü). Test: session bootstrap'a geçirilen `cwd` değerinin `path.join(cwd,
'.claude', 'settings.json')`'da gerçekten bir dosya bulduğu doğrulanır (mutasyon 3a, §11).

**Ne zaman açılır:** sunucu başlarken, **arka planda, engellemeden** (`createServer()`'ın kendisi
`await` etmez — asenkron bootstrap `void` ile başlatılır, hata `session.ts`'in kendi `try/catch`'i
içinde yakalanır, asla `createServer()`'ı fırlatmaz). Gerekçe: "gecikme olmadan" beklentisi (ADR-014
bağlam) ilk mesajda oturum açılış gecikmesi yaşanmamasını gerektiriyor; sohbet **kapalıysa**
(`MC_CHAT_ENABLED=0`, K6) bootstrap hiç çağrılmaz. Sohbet açıksa ama bariyer/SDK hatası **varsa**,
bootstrap başarısız olur, durum `crashed` olarak işaretlenir, panel bunu `GET /api/chat/status` /
`chat_status` SSE olayıyla görür — **sunucu ayakta kalır, diğer ekranlar çalışmaya devam eder**
(AC "barındırılan oturumdaki bir hata paneli çökertmez").

**Ne zaman kapanır:** (a) sunucu `SIGINT`/`SIGTERM` alıp `shutdown()` çağrıldığında —
`server.on('close', ...)`'a eklenen `chatSession.stopAll()` aktif `Query`'yi `interrupt()`'ler ve
alt süreç referansını bırakır (SDK alt süreç ebeveynle birlikte ölür, ✓ DOĞRULANDI SPIKE-002 §5.5,
ebeveyn/çocuk ilişkisi). (b) kullanıcı `POST /api/chat/restart` çağırdığında — mevcut oturum
kapatılır, `resume: <son session_id>` ile yeni bir `query()` açılır (SPIKE-002 §5.5,
`resume: <session_id>` ✓ DOĞRULANDI). (c) panel sekmesi kapanır — **oturum kapanmaz**, K1'in tek
oturumu panelin tarayıcı sekmesinden **bağımsızdır**; sekme kapansa da sunucu süreci (dolayısıyla
CEO oturumu) ayaktadır, yeniden açılan sekme `GET /api/chat/history` ile kaldığı yeri görür.

**Çöker ne olur:** SDK'nın `for await (const message of query(...))` döngüsü bir istisna
fırlatırsa veya alt süreç beklenmedik şekilde çıkarsa (`SDKResultMessage` `is_error: true` ile
biterse ya da iterator hata fırlatırsa), `session.ts`'in döngüsü bunu **kendi** `try/catch`'i
içinde yakalar (§9), durumu `crashed` yapar, `history-log.ts`'e yarım kalan (`streaming`) son
girdiyi **`interrupted`** olarak işaretler (`markDanglingAsInterrupted`, §6), `chat_status`
yayınlar. **Otomatik yeniden başlatma YOK** (v1 tasarım kararı) — çöküş döngüsü riskini (crash-loop)
almamak için kullanıcı `POST /api/chat/restart`'ı elle tetikler; panel bunu tek tıkla sunar
(görsel detay UX'in konusu, buton **verinin** varlığı bu sözleşmenin konusu).

**Sohbet devre dışıyken (K6):** `MC_CHAT_ENABLED` ortam değişkeni (varsayılan `1`, mevcut
`resolveEnvInt`'in 0/1 yorumuyla — `resolveEnvInt(env, 'MC_CHAT_ENABLED', 1) !== 0`, `index.ts`'ten
**içe aktarılır**, kopyalanmaz) `0` ise: `createChatSession(...)` hiç çağrılmaz, chat route'ları
dispatcher'da kayıtlı **kalır** ama her biri sabit `{ success: false, error: { code:
'chat_disabled', message: '...' } }` (503) döner — 404 değil, çünkü uç "yok" değil "kapalı" (ayrım
panelin doğru mesaj göstermesi için önemli). Mevcut beş uç (`/api/health`, `/api/events`,
`/api/stream`, `/api/projects`, `/api/features`) ve ekranları **hiçbir şekilde etkilenmez** —
bunların hiçbiri chat modülüne bağımlı değil (mimari izolasyon, §2.4).

---

## 4. Uçlar (endpoints)

Tümü `POST /api/chat/*` **`x-mc-write` başlığına tabidir** (ADR-013, muafiyet yok — `POST
/api/events`'in `send-event.cjs`'e özel istisnası burada **geçerli değil**, çünkü bu uçların tek
istemcisi panelin kendi tarayıcı arayüzüdür, SPIKE-002 §5.3). Bu kontrol dağıtıcıda **zaten**
otomatik uygulanıyor (`index.ts:333`, ✓ DOĞRULANDI) — chat route'ları eklenince ek kod
gerekmiyor, yalnızca regresyon testi (mutasyon 6, §11).

Tüm yanıtlar `ApiResponse<T>` zarfını kullanır (`src/shared/types.ts`, değişmeden).
`ErrorCode` birleşimine eklenecek yeni kodlar: `'chat_disabled' | 'session_not_ready' |
'no_active_turn' | 'request_not_found' | 'invalid_body'` (`invalid_body`/`internal_error` zaten
var). **`src/shared/types.ts` bu feature'ın dosya sahipliğinde DEĞİL** — bu genişletme `ErrorCode`
birleşimine eklenmek zorunda, ama dosya `src/shared/**` altında; F-007'nin de aynı dosyaya
`write_denied`/`write_failed` eklediği emsal var (§2.4 tablosu bu satırı **eksik bırakmıştı**,
burada düzeltiliyor): **`src/shared/types.ts`'e `ErrorCode` genişletmesi de dokunacağım dosyalar
listesine eklenir** (mekanik, tek satır, mevcut birleşime ekleme).

| Uç | Metot | Gövde | Başarı | Hata kodları |
|---|---|---|---|---|
| `/api/chat/status` | GET | — | `200 { session_active, session_id, busy, api_key_barrier_tripped, chat_enabled, last_error }` | — (her zaman 200, durumun kendisi bilgi taşır) |
| `/api/chat/history` | GET | — | `200 { data: { entries: ChatLogEntry[] } }` | `chat_disabled` (503) |
| `/api/chat/message` | POST | `{ text: string }` (1-8000 karakter, boş/trim-sonrası-boş reddedilir) | `202 { data: { turn_id, queued } }` | `invalid_body`(400) · `chat_disabled`(503) · `session_not_ready`(503) · `internal_error`(500) |
| `/api/chat/interrupt` | POST | `{}` | `200 { data: { interrupted: true } }` | `no_active_turn`(409) · `chat_disabled`(503) |
| `/api/chat/permission` | POST | `{ request_id: string, result: unknown }` | `200 { data: { resolved: true } }` | `request_not_found`(404) · `invalid_body`(400) · `chat_disabled`(503) |
| `/api/chat/restart` | POST | `{}` | `200 { data: { session_id } }` | `chat_disabled`(503) · `internal_error`(500) |

**`result` alanının şekli (`/api/chat/permission`):** sunucu bunu **doğrulamadan** (şema
zorlamadan) bekleyen `canUseTool`/`AskUserQuestion` promise'ine olduğu gibi iletir — SDK'nın
beklediği şekil çağrı tipine göre değişir (izin: `{behavior:'allow'|'deny', updatedInput?,
message?}`; soru: `{answers: Record<string,string>}`, SPIKE-002 §3.1 ✓ DOĞRULANDI). Sunucu
tarafında **tek** kontrol: `request_id` bilinen bir bekleyen istekle eşleşmeli (yoksa `404`) ve
her `request_id` **yalnızca bir kez** çözülebilir (ikinci POST `404` döner — "zaten çözüldü" ile
"hiç var olmadı" aynı koda düşer, bilgi sızdırmaz). Bu, K3'ün "otomatik onay yok" kuralının HTTP
seviyesindeki karşılığıdır: sunucu hiçbir zaman kendi başına `{behavior:'allow'}` üretmez, yalnızca
panelden gelen kararı **yönlendirir**.

---

## 5. Akış protokolü (SSE)

**K5 — mimari karar: mevcut `/api/stream` bağlantısı yeniden kullanılır, ikinci `EventSource`
AÇILMAZ.** Gerekçe (ölçülmüş, SPIKE-002 §5.2): ADR-004 zaten "tek bağlantı, çok kanal" desenini
kurmuş (`hello`/`event`/`features`/`projects`/`gates`/`resync`, ✓ DOĞRULANDI) ve kanal listesi
"zaten genişletilebilir" olarak tasarlanmış; sohbet trafiği de tek yönlü (sunucu→tarayıcı) olduğu
için WebSocket'e geçmek için hiçbir sebep yok. Yeni kanal adları: `chat_message`,
`chat_user_echo`, `chat_tool`, `chat_permission_request`, `chat_permission_resolved`,
`chat_status`, `chat_error`.

**Sıralama:** tek bir sunucu içi `for await` döngüsü (`session.ts`) SDK mesaj akışını **sırayla**
tüketir ve her mesajı işlerken `hub.broadcast(...)` çağırır — Node tek iş parçacıklı olduğu için
(mevcut `ingest.ts`/`hub.ts` ile aynı garanti, ✓ DOĞRULANDI) yayın sırası **üretim sırasıyla
birebir aynıdır**, ek bir kilitleme/kuyruklama gerekmez.

**`id:`/`Last-Event-ID` kararı — bağlayıcı ve ADR-004'ten sapma:** yeni `chat_*` çerçevelerinin
**hiçbiri `id:` satırı taşımaz** (`hello`/`resync` ile aynı desen, `formatSseFrame(name, data)` —
`id` parametresi **verilmez**). Gerekçe, ölçülmüş bir kısıttan geliyor: WHATWG `EventSource`
spesifikasyonu **tek bir** "son olay kimliği" tamponu tutar — bu tampon, adı ne olursa olsun `id:`
taşıyan **her** çerçeveyle güncellenir (SPIKE §5.2'nin `hello`'ya sahte `id` koymama gerekçesiyle
**aynı mekanizma**, `hub.ts:4-9` yorumu ✓ DOĞRULANDI). Eğer `chat_message` kendi `seq`'inden bir
`id:` taşısaydı ve `event` kanalının `seq`'i **farklı bir sayı uzayında** olsaydı, bir yeniden
bağlanmada `Last-Event-ID` hangi uzaya ait olduğu belirsiz tek bir sayı gönderirdi —
`computeResyncDecision` bunu yanlış yorumlardı (ya gereksiz `resync` ya da **sessiz boşluk**, bu
deponun en pahalı hata sınıfı). İki uzayı **aynı** sayaçtan beslemek (chat mesajlarını
`store.append()`'e yazmak) da reddedildi: `jsonl-store` `EventRecord` şemasına kilitli (§2.4) ve
hook-olay retention/`corrupt_lines` sayaçlarıyla sohbeti karıştırmak kavramsal olarak yanlış.

**Sonuç — kopma/telafi (bağlayıcı):** `chat_*` kanalı **sıra garantisi vermez** (ADR-004 karar
5'in "yalnızca `event` kanalı sıra garantisi verir" cümlesi **korunuyor**, genişletilmiyor — bu
feature o cümleyi ihlal etmiyor, aksine ona **uyuyor**: sıra garantisi istemeyen bir kanal
ekliyor). Panel, `/api/stream` her (yeniden) bağlandığında (`hello` çerçevesini gördüğünde) **her
zaman** `GET /api/chat/history`'yi çağırıp sohbet durumunu **tam olarak** yeniden yükler — hook
olay akışının `Last-Event-ID` tabanlı kısmi telafisinden **bağımsız**, ayrı bir REST çağrısı.
Bu, "sohbette kaçan bir mesaj telafi edilemezse kullanıcı fark etmez" riskini (SPIKE-002 §5.2)
yapısal olarak ortadan kaldırır: kayıp bir SSE çerçevesi olsa bile bir sonraki `hello` tam
senkronizasyon tetikler. Bedel: her yeniden bağlanmada küçük bir REST çağrısı (sohbet metni kısa
ömürlü/az hacimli, `MAX_EVENTS`/ring gibi bir tavana ihtiyaç yok, §6).

**Yarım cevap kesilirse ne olur (iki senaryo, ayrı ayrı):**
1. **Tarayıcı bağlantısı kopar, sunucu süreci hayatta:** asistan cevabı üretmeye **sunucu
   tarafında devam eder** (SSE aboneliğinden bağımsız, `for await` döngüsü tarayıcıya değil
   `hub`'a yazar). Tarayıcı yeniden bağlanınca `hello` + `GET /api/chat/history` ile son duruma
   (tamamlanmışsa tam metin, hâlâ üretiliyorsa `status:'streaming'` işaretli kısmi metin) döner.
2. **Sunucu süreci çöker/yeniden başlar (turun ortasında):** SDK alt süreci de ölür (ebeveyn/çocuk
   ilişkisi), tur **tamamlanmadan** kaybolur — bu, "Claude Code kapanınca da tur ölür" bugünkü
   davranışıyla **aynıdır** (SPIKE-002 §5.5 ⊢ ÇIKARIM). `history-log.ts`'te bu turdan kalan
   `status:'streaming'` girdi, bir sonraki `init()`'te `markDanglingAsInterrupted()` tarafından
   `status:'interrupted'`e çevrilir (§6) — panel sonsuza kadar dönen bir "yazıyor…" göstergesi
   **göstermez**.

**`chat_message` delta biçimi:** `{ turn_id: string, delta: string, done: boolean }` — SDK'nın
`stream_event`/parça mesajlarından **metin** alanı çıkarılıp gönderilir (tam SDK mesaj zarfı
panelin bağlamına **sızmaz** — K3'ün "iç metadata kullanıcıya sızmamalı" gözlemiyle aynı gerekçe,
SPIKE-002 §4/M3'teki "bu tool_result'ı asla alıntılama" iç talimatı ✓ DOĞRULANDI, biz zaten yalnızca
görüntülenecek metni çıkarıp gönderiyoruz, ham mesaj asla tarayıcıya gitmiyor).

**`chat_tool` alt agent görünürlüğü:** `parent_tool_use_id` alanı SDK mesajında **varsa** olduğu
gibi iletilir (SPIKE-002 M3'te ✓ DOĞRULANDI: alt agent mesajları bu alanla etiketleniyor) — panel
bunu kullanarak "Explorer agent çalışıyor" gibi bir ağaç gösterebilir (görsel detay UX'in konusu).

---

## 6. Kalıcılık

**Kaynak gerçeği ayrımı (bağlayıcı):** oturumun **kendisinin** (modelin bağlamı, "devam
ettirilebilirlik") kaynak gerçeği SDK'nın kendi transkriptidir (`~/.claude/projects/<encoded-cwd>/
<session-id>.jsonl`, ✓ DOĞRULANDI SPIKE-002 §5.5) — panel bunu **ayrıştırmaz**, yalnızca
`resume: <session_id>` çağırır (K1'in tek-oturum basitliğiyle uyumlu: tek bir `session_id`,
`<dataDir>/chat/session-id.txt` gibi küçük bir dosyada saklanır). Panelin **görüntüleme**
geçmişinin (kullanıcının ekranda gördüğü mesaj listesi) kaynak gerçeği ise kendi
`history-log.ts`'idir — bu, "SDK'nın belgesiz transkript formatını ayrıştırmayalım" kararının
(SPIKE-002 §5.5) doğal sonucu: zaten sunucu sürecinden **canlı geçen** her mesajı kendi basit
şemamızla kaydediyoruz, geriye dönük ayrıştırmaya hiç gerek kalmıyor.

**`ChatLogEntry` şekli** (`src/shared/types.ts`'e eklenir):
```ts
interface ChatLogEntry {
  seq: number            // history-log.ts'in kendi monoton sayacı — SSE seq'i DEĞİL, karışmaz
  turn_id: string
  role: 'user' | 'assistant' | 'system'
  kind: 'text' | 'tool' | 'permission_request' | 'permission_resolved' | 'error'
  text?: string
  status: 'streaming' | 'done' | 'interrupted'
  ts: string
}
```

**Retention:** v1'de **yok** — "ileride lazım olur" kodu yazılmıyor (Karpathy §2). Sohbet metni
hacim olarak hook-olay firehose'una kıyasla küçüktür (kullanıcı başına, tek oturum); dosya
büyürse gelecekte ayrı bir feature retention ekler. Bu, bilinen/kabul edilen bir risktir — §13'te
açık soru olarak da not edilebilir ama engelleyici değildir.

**Panel açılınca ne yükleniyor:** `GET /api/chat/history` → `history-log.ts` dosyasının tamamı
(retention olmadığı için "tamamı" sınırlı kalıyor, yukarıdaki risk kabulüyle tutarlı) sırayla
render edilir; `status:'streaming'` olan varsa panel "hâlâ yazıyor" gösterir ve SSE'den gelecek
devamı bekler.

**Devam ettirme (resume):** ✓ DOĞRULANDI, SDK `resume: <session_id>` seçeneğini destekliyor.
Sunucu yeniden başladığında (K1 tek oturum, tek dosyada saklı `session_id` varsa) yeni `query()`
çağrısı `resume` ile açılır — model, kendi tarafında konuşmanın **tamamına** sahiptir (SDK'nın
kendi transkriptinden); panelin `history-log.ts`'i ise yalnızca **görüntüleme** amaçlıdır ve iki
kaynağın round-trip'te birebir aynı olması **gerekmez** (biri model bağlamı, diğeri ekran metni) —
bu ayrım açıkça yazılmalı ki gelecekte biri "neden ikisi farklı" diye şaşırmasın.

---

## 7. Kimlik ve bariyer (K2)

**Denetlenen tek değişken:** `ANTHROPIC_API_KEY` — yalnızca bu (AC ve ADR-014 "Sonuçlar"
bölümünün literal ifadesi bununla sınırlı; `ANTHROPIC_AUTH_TOKEN`'ın da benzer bir riski olup
olmadığı §13 açık soru 2'de CEO'ya soruluyor, **kendim karar vermiyorum**).

**Mekanizma (kesin, doğrulanmış bir SDK `env` seçeneğine bağımlı DEĞİL):** Node'un
`child_process.spawn` davranışı, açıkça `env` verilmezse çocuğun **ebeveynin `process.env`'ini
spawn anında** miras aldığıdır — bu, Node'un kendi çekirdek davranışıdır (SDK'ya özgü bir API
değil, dolayısıyla ✓ DOĞRULANDI sayılabilir bir platform garantisi). Bariyer bu yüzden SDK'nın
belirsiz/doğrulanmamış bir `env` seçeneğine **dayanmaz** — `env-barrier.ts`, panelin **kendi**
`process.env`'inden `ANTHROPIC_API_KEY`'i `query()` **ilk kez çağrılmadan önce** `delete` eder.
Bu, hem modül yüklenirken (bir kerelik) hem de her `query()` çağrısından hemen önce (savunma
katmanı, ör. bir şeyin değişkeni sonradan geri koyması ihtimaline karşı) tekrar uygulanır.

**Sessiz olmama (K2'nin "temizle + görünür uyar" ikili şartı):** silme işlemi başlamadan önce
`checkApiKeyBarrier(env)` çağrılır, sonucu (`tripped: boolean`) `session.ts`'in durum nesnesine
yazılır ve **kalıcı olarak** `GET /api/chat/status`'un `api_key_barrier_tripped` alanından ve
`chat_status` SSE olayından görünür kalır (tek seferlik bir toast/log **değil** — K2 açıkça
"kalıcı, gözden kaçmayan bir uyarı" istiyor; panelin bunu nasıl göstereceği görsel bir karar ama
**verinin her an sorgulanabilir olması** bu sözleşmenin garantisi). stderr'e de insan-okunur bir
satır yazılır (`ingest.ts`'in hata loglama desemiyle aynı üslup) — ama **anahtarın değeri asla
loglanmaz/döndürülmez**, yalnızca "bulundu ve kaldırıldı" bilgisi.

**Sessiz kullanmama:** anahtar silindiği için `query()`'nin spawn ettiği alt süreç onu hiç
görmez — SDK'nın kimlik önceliği listesine göre (SPIKE-002 §2.2, ✓ DOĞRULANDI) bir sonraki
sıradaki kaynağa (abonelik `/login` mirası, madde 7) düşer. **Reddetme yolu seçilmedi** (K2'nin
izin verdiği iki seçenekten biri "oturum açılmaz" idi) — çünkü temizleme yeterli ve daha az
kesintili; bu bir tasarım tercihi olarak açıkça yazılıyor, CEO'nun onayına tabi (§13'e gerek yok,
K2 zaten "ya… ya da" diyerek ikisini de meşru sayıyor, biz temizlemeyi seçtik).

**Çitleme (AC "mutasyonla çitlenir"):** mutasyon 1/2, §11.

---

## 8. Hook kapıları

**Yükleme mekanizması:** `query()` seçeneklerinde `settingSources: ['project']` — bu, SDK'nın
`.claude/settings.json`'ı **CLI ile aynı şekilde** okumasını sağlar (✓ DOĞRULANDI, SPIKE-002 §3.1:
*"those hooks run automatically in the SDK with no extra configuration"*) ve **SPIKE-002-asama0'da
gerçek bir oturumla iki yönlü ölçülmüştür** (M2 — GEÇTİ, §0'da alıntılandı). Bu depodaki altı
güvenlik hook'u (✓ DOĞRULANDI, `.claude/settings.json` bu turda okundu, tam liste): `session-
start.cjs` (SessionStart), `gate-check.cjs` (PreToolUse, `Edit|Write`), `block-dangerous.cjs`
(PreToolUse, `Bash`), `asset-guard.cjs` (PreToolUse, `mcp__higgsfield__.*`), `post-format.cjs`
(PostToolUse, `Edit|Write`), `stop-check.cjs` (Stop). Ayrıca telemetri hook'u `send-event.cjs`
(hemen hemen her olayda, `async: true`) — bu hook'un ateşlemesi K4'ü **ihlal etmez**: kendi
projesinin (bu depo) hook olaylarını `POST /api/events`'e göndermesi, "izlenen **başka**
projelerin" olaylarının CEO bağlamına **girmesinden** ayrı bir şey — CEO oturumu bu olayları asla
**okumaz**, yalnızca üretir (§ K4 sınırı tersine işlemiyor, tek yönlü: dışarı telemetri gidiyor,
içeri hiçbir olay-metni CEO'nun promptuna girmiyor).

**"Yükleniyor" ≠ "engelliyor" (K7/M2 dersinin tekrarı, bu sözleşmede iki testle karşılanıyor):**
1. **Zorunlu, varsayılan `verify`'de koşan birim/entegrasyon testi** (enjekte sahte `query`):
   `session.ts`'in `query()`'e geçirdiği `Options` nesnesinde `settingSources: ['project']` VE
   doğru `cwd` **gerçekten var** — bu "yükleniyor" seviyesinde bir kanıttır (mutasyon 3a).
2. **Gerçek, iki yönlü kanıt** (K7/ADR-014 M2 yönteminin birebir tekrarı, gerçek bir oturumla):
   `tests/integration/chat-hooks-live.test.ts` — varsayılan koşuda **atlanır** (§2.3), yalnızca
   `MC_CHAT_LIVE_TESTS=1` ile elle çalıştırılır. Bu test SPIKE-002-asama0 M2 metodolojisini
   birebir uygular: (a) hook aktifken `block-dangerous.cjs`'in yakaladığı zararsız bir işaretleyici
   komutu dener, dosyanın **oluşmadığını** doğrular; (b) sandbox'a kopyalanmış (gerçek repo
   dosyasına **dokunulmadan**) no-op bir `block-dangerous.cjs` ile **aynı** komutu tekrar dener,
   dosyanın **oluştuğunu** doğrular. **Neden bu, varsayılan `verify`'de değil:** her koşu gerçek
   abonelik kotası harcıyor (SPIKE-002-asama0'da ölçülen mertebe ~$0.36-2 kota-eşdeğeri/tur,
   gerçek para değil ama sınırsız değil) — her `npm test` çalıştırmasında bunu harcamak orantısız.
   Bu, §11 ve §13'te ne sıklıkla koşulacağı (ör. yalnızca hook zinciri değiştiğinde) sorusuyla
   birlikte ele alınıyor.

**Bilinen sınırlama (kayıt, düzeltme istenmiyor):** `ListAgents`'ın bu makinedeki **ilgisiz başka
projelerin** oturumlarını listelediği (SPIKE-002-asama0 M3, ✓ DOĞRULANDI) bu feature'ın
`.claude/` dosyalarına dokunmasıyla **değişmez** — mevcut, kabul edilmiş bir sınırlama (ADR-014
"Kabul edilen riskler" madde 2). Bu sözleşme onu tekrar üretmiyor, yalnızca miras alıyor.

---

## 9. Hata sınırı

**`CLAUDE.md`'nin üç kez tekrarlayan dersi burada dördüncü kez tekrarlanmayacak.** Kural:
dağıtıcının `withDispatchErrorBoundary`'si (`index.ts:147`) yalnızca handler'ın **senkron çağrı
yığınında** fırlayan hataları yakalar (✓ DOĞRULANDI, dosyanın kendi yorumu + kod okuması) — bir
`async` fonksiyonun `await`'ten sonraki gövdesinde fırlayan hata bu sınırın **kapsamı dışındadır**.
Bu feature'ın **tüm** yeni handler'ları (`handleChatMessage`, `handleChatInterrupt`,
`handleChatPermission`, `handleChatRestart`) `ingest.ts`'in async-IIFE deseniyle **birebir aynı**
şekilde yazılır: `req`/gövde okuma tamamlandıktan sonra `void (async () => { try { … } catch (err)
{ sendJson(res, 5xx, {...}) } })()` — yani **her handler kendi hata sınırını taşır**, dağıtıcının
senkron sınırına asla güvenmez.

**Uzun ömürlü asenkron döngü (`session.ts`'in `for await` mesaj tüketicisi) ayrı bir risk
sınıfıdır** — bu bir HTTP handler değil, sunucu başlangıcında bir kez başlatılan bağımsız bir
asenkron görev. Bu döngü **kendi** `try/catch`'i içine alınır; döngü içinde fırlayan HERHANGİ bir
hata (SDK mesaj ayrıştırma hatası, `hub.broadcast`'in kendisi fırlarsa, `history-log.ts`'in yazma
hatası) yakalanır, oturum durumu `crashed` yapılır, `chat_error`/`chat_status` yayınlanır, döngü
**temiz** sonlanır. Bu döngü **hiçbir zaman** `await` edilmeden bırakılmaz (`.catch()` zinciriyle
de korunur) — aksi hâlde `index.ts:29`'daki `process.on('unhandledRejection')` güvenlik ağına
düşerdi, ki o ağ zaten yorumunda "asıl çözüm DEĞİL, yalnızca son emniyet" diye işaretli (✓
DOĞRULANDI, kod okundu) — bu feature o ağa **hiç düşmemeyi** hedefler, ona güvenmez.

**Yarı-başarı dürüstlüğü (F-007'nin dersi, `CLAUDE.md`):** `POST /api/chat/message` bir mesajı
SDK'nın girdi kuyruğuna **başarıyla** verdikten sonra herhangi bir aşamada (ör. `history-log.ts`'e
yazma hatası) bir şey ters giderse, istemciye **her zaman** bir yanıt döner (202 veya 5xx) — asla
"yazma oldu ama istemci hiç öğrenmedi" durumu yaratılmaz, çünkü HTTP yanıtı mesaj kuyruğa
**verildiği anda** (SDK'nın `streamInput()`'una push edildiği anda), asistanın cevabını
**beklemeden** dönülür (zaten AC bunu istiyor: "tamamlanmayı beklemeden"). Cevabın kendisi SSE
üzerinden ayrı bir kanaldan gelir; SSE tarafında bir hata olursa (`chat_error`) bu da panelin
görebileceği ayrı, dürüst bir sinyaldir — "sessizce kayboldu" hiçbir yol **yoktur**.

---

## 10. Metin/UI sözleşmesi — `docs/03-ux.md`'ye atıf (K8)

Bu sözleşme kullanıcıya gösterilecek Türkçe metinleri, renkleri, yerleşimi **tanımlamaz**.
Aşağıdaki durum makinesi/veri sözlüğü, UX dokümanının hangi durumları karşılaması gerektiğinin
**listesidir** (F-007 sözleşmesinin "durum tasarımı" bölümüne UX'in nasıl metin/görsel bağladığı
emsaliyle aynı iş bölümü):

| Durum anahtarı | Ne zaman | UX'in karşılaması gereken |
|---|---|---|
| `chat_disabled` | `MC_CHAT_ENABLED=0` | Sohbet sekmesi/alanı hiç görünmez veya "kapalı" mesajı (F-007 emsali: Faz 2 sekmelerinin "hiç yok" kuralına benzer) |
| `api_key_barrier_tripped: true` | Ortamda `ANTHROPIC_API_KEY` bulunup temizlendi | **Kalıcı**, göz ardı edilemeyen bir uyarı (K2) |
| `session_active: false, last_error: <mesaj>` | Bootstrap/oturum çöktü | Okunabilir hata + "yeniden başlat" eylemi |
| `busy: true` | Bir tur işleniyor | SPIKE-001 §7.5'in kabul kriteri: "CEO meşgul, mesajın sıraya alındı" göstergesi |
| `permission_request` bekleniyor | `canUseTool` tetiklendi | Onay/red kartı — **otomatik onay yok** (K3) |
| `status:'interrupted'` geçmiş girdi | Sunucu çöktükten sonra yeniden yüklendi | "Yarıda kesildi" işareti, sonsuz spinner değil |

Bu tablo **bağlayıcı değildir** (UX dokümanı son sözü söyler) — yalnızca veri katmanının hangi
durumları ürettiğinin envanteridir.

---

## 11. Test planı ve mutasyon listesi

### 11.1 Kabul kriteri → test eşlemesi

| AC (feature notu) | Test(ler) |
|---|---|
| AC1 — mesaj ulaşır, cevap akış hâlinde, beklemeden | `chat-api.test.ts` (POST 202 hemen döner, SSE'den `chat_message` delta'ları gelir) · `session.test.ts` (kuyruklama, `done:false` ara mesajlar) |
| AC2 — abonelik yolu, `ANTHROPIC_API_KEY` sessizce kullanılmaz | `env-barrier.test.ts` · `session.test.ts` (temizlik `query()`'den önce) · `chat-hooks-live.test.ts` (gerçek M1 tekrarı, opsiyonel kadans) |
| AC3 — bariyer çitlenmiş | Mutasyon 1, 2 (aşağıda) |
| AC4 — hook kapıları engelliyor, iki yönlü | Mutasyon 3 (unit, wiring) + `chat-hooks-live.test.ts` (gerçek iki yönlü) |
| AC5 — alt agent arka planda, ana oturum cevap verebilir, ilerleme görünür | `session.test.ts` (sahte `query` art arda `chat_tool`(started) → ikinci kullanıcı mesajı işlenir → `chat_tool`(finished) sırası; SPIKE M3 zaman damgalı gözleminin sahte-veriyle tekrarı) |
| AC6 — `x-mc-write`, çitlenmiş | Mutasyon 6 |
| AC7 — kalıcı geçmiş | `history-log.test.ts` · `chat-api.test.ts` (yeniden başlatma sonrası `GET /api/chat/history`) |
| AC8 — hata paneli çökertmez, async handler kendi sınırı | Mutasyon 7 + `session.test.ts` (çöküş sonrası `/api/health` hâlâ 200) |
| AC9 — olay akışı CEO bağlamına girmez | `no-context-injection.test.ts`, mutasyon 8 |
| AC10 — geri dönüş temiz | `chat-api.test.ts` (`MC_CHAT_ENABLED=0` altında 5 mevcut uç + ekranlar bozulmadan çalışır), mutasyon 9 |

### 11.2 Mutasyon listesi (≥6 zorunlu — burada 10, her biri gerçek bir koruma noktası)

1. **Bariyer temizliği kaldırılır** (`env-barrier.ts`'teki `delete env.ANTHROPIC_API_KEY` satırı
   yorumlanır) → `env-barrier.test.ts`/`session.test.ts` KIRMIZI: anahtar `query()`'e geçirilen
   env'de hâlâ mevcut.
2. **Görünür uyarı bayrağı kaldırılır** (`tripped` durumunun `GET /api/chat/status`'a
   yansıtılması silinir) → `chat-api.test.ts` KIRMIZI: anahtar varken `api_key_barrier_tripped`
   hâlâ `false`.
3. **Hook yükleme seçenekleri bozulur** (`settingSources: []` veya yanlış `cwd`) →
   `session.test.ts` KIRMIZI: sahte `query`'e geçirilen `Options`'ta beklenen değerler yok.
4. **`permissionMode` `'bypassPermissions'`e çevrilir** → `permission-mode-fence.test.ts`
   KIRMIZI (statik grep guard).
5. **`canUseTool` bekleme olmadan otomatik `{behavior:'allow'}` döner** → `chat-api.test.ts`
   KIRMIZI: izin isteği hiç `POST /api/chat/permission` çağrılmadan "onaylandı" görünür (test bu
   endpoint'i **hiç** çağırmadan sahte tool-call'ın izin gerektiği hâlde geçtiğini yakalar).
6. **Chat uçlarına `POST /api/events` benzeri bir `x-mc-write` istisnası eklenir** →
   `chat-api.test.ts` KIRMIZI: başlıksız `POST /api/chat/message` 403 yerine 202 döner.
7. **Bir handler'ın kendi `try/catch`'i kaldırılır** (ör. `handleChatMessage`'ın async
   gövdesindeki `catch` bloğu silinir, sahte `query` reddeden bir promise döndürür) →
   `chat-api.test.ts` KIRMIZI: yanıt makul bir sürede (ör. 2 sn) hiç gelmez / bağlantı asılı kalır
   (tam olarak `CLAUDE.md`'nin F-007 dersinin tekrarını yakalayan test).
8. **`src/features/chat/server/session.ts`'e `jsonl-store`'dan bir okuma import'u eklenir**
   (K4 ihlali simülasyonu) → `no-context-injection.test.ts` KIRMIZI (statik guard).
9. **`MC_CHAT_ENABLED=0` kontrolü kaldırılır** → `chat-api.test.ts` KIRMIZI: kapalıyken chat
   uçları 503 yerine (sahte oturum hiç kurulmadığı için) 500/crash döner **ya da** kapalı
   olması gerekirken mesaj gerçekten işlenir.
10. **`markDanglingAsInterrupted` çağrısı `session.ts` bootstrap'ından kaldırılır** →
    `history-log.test.ts`/`chat-api.test.ts` KIRMIZI: yeniden başlatma sonrası eski bir
    `status:'streaming'` girdi `interrupted`e dönmez, sonsuz "yazıyor" durumunda görünür.

### 11.3 Canlı (gerçek SDK) test kadansı — kesinleştirilecek

`chat-hooks-live.test.ts` ve M1'in gerçek-abonelik tekrarı **her `npm run verify`'de değil**;
öneri: (a) hook zinciri (`settingSources`, `session.ts`'in bootstrap seçenekleri) değiştiğinde
elle bir kez, (b) her QA turunda en az bir kez (ADR-014'ün kendi "iki yönlü kanıt" şartını
karşılamak için). Kesin kadans **§13 açık soru 4**'te CEO'ya soruluyor.

