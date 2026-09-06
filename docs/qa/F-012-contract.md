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
