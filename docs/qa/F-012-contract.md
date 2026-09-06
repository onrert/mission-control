---
feature: F-012
title: CEO sohbet arayüzü — panel, oturumu Agent SDK ile barındırır
author: developer
status: draft
date: 2026-09-06
revision: 3 (docs/qa/F-012-contract-review-2.md bulgularına yanıt — 3 BLOKLAYICI: Y-B1/Y-B2/Y-B3,
  + Ö5/Ö6 kapatıldı. Tur 1 → docs/qa/F-012-contract-review-1.md, 7 BLOKLAYICI + 13 ÖNEMLİ + 6 NOT.)
---

# F-012 Sözleşmesi — Panel CEO oturumunu `@anthropic-ai/claude-agent-sdk` ile barındırır

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").
Bu turda da `src/`, `tests/`, `package.json` altında **hiçbir dosya değiştirilmedi**; yalnızca bu
sözleşme metni düzeltildi. `git status --porcelain` bunu doğrular (tek satır: bu dosya).

**Bu revizyon (3) neyi kapatıyor:** `docs/qa/F-012-contract-review-2.md`'nin dar kapsamlı denetimi
üç yeni bloklayıcı buldu — Y-B1 (yanlış `sdk.d.ts` atfı), Y-B2 (D10 kararı gövdeye yayılmamış),
Y-B3 (D11 kararı hiç işlenmemiş) — ve iki kısmi-önemli bulguyu (Ö5, Ö6) bloklayıcı olmasa da
kapatılmamış bıraktı. Bu revizyon **yalnızca** bu beş maddeyi ve bunların doğurduğu iç çelişkileri
kapatır; 1. turda QA'nın kapandığını doğruladığı hiçbir bölüm yeniden açılmadı. Değişen bölümler:
§0.1 (D10/D11 satırları eklendi), §2.4 (Yol B'nin koşullu dosyası notu), §3 (bütçe tavanı alt
bölümü, D11), §5 (izin olaylarının kapalı şeması, Ö6), §8a (mekanizma kanıtı düzeltildi + Yol
B artık koşullu plana dahil, Y-B1/Y-B2), §10 (bütçe aşımı satırı + "Yeniden bağlan" butonunun
gerçekte ne çağırdığı, D11/Ö5), §11 (mutasyon 13/14, D9), §13 (soru 1 kapatıldı, D10).

**Kanıt işaretleri (bu belge boyunca):** **✓ DOĞRULANDI** (bu turda kendim okudum/çalıştırdım,
alıntı/yol var) · **⊢ ÇIKARIM** (doğrulanmış kanıttan türetildi) · **[T] TAHMİN** (doğrulanmadı,
riski açıkça yazıldı).

## 0. Bu turda değişen şey — özet

Tur 1'in 7 bloklayıcısının 4'ü **öncül hatasıydı** (var olmayan bir mekanizmaya dayanma, yazılmış
bir belgeyi "yazılmamış" sayma) — bu tur önce bunları **kaynağı yeniden okuyarak** düzeltti, sonra
3 çitleme eksiğini kapattı. Ayrıca bu turda **kurulu SDK paketi** (`@anthropic-ai/claude-agent-sdk@
0.3.261`) proje dışında (`C:\Users\pc\AppData\Local\Temp\claude\...\scratchpad\sdk-probe`, `npm
install`, depo İÇİNE değil) kurulup tip tanımları (`sdk.d.ts`, 8700+ satır) okunarak önceki turun
6 "doğrulayamadım" maddesinden 4'ü ✓ DOĞRULANDI'ya yükseltildi (aşağıda §0.3).

**Bağlayıcı kaynaklar (bu turda yeniden okundu, tam metin):**
`docs/features/F-012-ceo-sohbet-arayuzu.md` (AC listesi — **K1-K8 burada YOK**, düzeltme: N1) ·
`docs/HANDOFF.md:29-36` (K1-K8'in **gerçek** kaynağı, ✓ DOĞRULANDI) ·
`docs/decisions/ADR-014-paneli-ceo-oturumunun-arayuzu-yapmak.md` ·
`docs/decisions/ADR-005-yazma-kapisi-ve-guvenlik-siniri.md` **dahil "Ek — F-012…" bölümü
(satır 59-101, ✓ DOĞRULANDI YAZILMIŞ — tur 1'in B4 hatası düzeltildi)** ·
`docs/03-ux.md:225-379` ("### 7. Sohbet (CEO)", ✓ DOĞRULANDI YAZILMIŞ VE ONAYLANMIŞ — tur 1'in B6
hatası düzeltildi) · `docs/03-ux.md:733-762` ("CEO notları §4" — S1/S2/S3 kararları, bağlayıcı) ·
`docs/spikes/SPIKE-002-paneli-ceo-istemcisi-yapmak.md` · `docs/spikes/SPIKE-002-asama0-olcum.md`
(M1/M2/M3 GEÇTİ, bu sözleşme tekrar ölçmüyor) ·
`docs/decisions/ADR-013-yazma-uclarinda-ozel-baslik-zorunlulugu.md` ·
`docs/decisions/ADR-004-gercek-zamanli-tasima.md` · `docs/decisions/ADR-009-tek-platform-windows.md`
· `CLAUDE.md` "Öğrenilen kurallar" (tamamı) · `docs/qa/F-012-contract-review-1.md` (tur 1'in görev
listesi) · `docs/qa/F-012-contract-review-2.md` (bu revizyonun görev listesi, dokunulmadı, yalnızca
okundu) · kurulu SDK paketinin `sdk.d.ts`'i bu revizyonda **tekrar, satır satır** okunarak Y-B1'in
yanlış atfı düzeltildi (§8a) ve D11'in bütçe-aşımı sinyali (`sdk.d.ts:1774-1777`, `:4957-4964`)
doğrulandı (§3).

**Kod okunarak bu turda YENİDEN doğrulandı (✓ DOĞRULANDI):** `src/web/lib/useEventStream.ts` (tam
dosya — `hello` dinlenmiyor, ama `handleOpen`/native `'open'` olayı **her yeniden bağlanmada**
ateşleniyor, satır 169 ve 203; bu tur bunu B1'in çözümü için kullanıyor, aşağıya bak) ·
`src/server/sse/hub.ts` + `stream.ts` (`hello` her zaman ilk yazılan çerçeve, `id:` yok; `resync`
yalnızca `event` kanalının `Last-Event-ID` boşluğu için) · `src/server/index.ts` (tam dosya, 471
satır — değişmedi, tur 1'in tespitleri geçerli) · `.claude/settings.json` (tam dosya — 40 satırlık
`permissions.allow`, `"agent": "ceo"`, `env` bloğunda üç `CLAUDE_CODE_*` değişkeni — bu son nokta
D2'nin allowlist tasarımını doğrudan etkiliyor, §7'de ele alınıyor) ·
`tests/no-write-gate-bypass.test.ts` (tam dosya — `STORE_FILES` haritasının **tam biçimi**, yeni
girdi eklemenin gerçek sözdizimi buradan alındı, §2.3/B5).

### 0.1 CEO kararları D1-D9 (bu iki tur boyunca verildi, bağlayıcı, gövdeye yayıldı)

Önceki turdan geçerli **D1-D5** ve bu turda eklenen **D6-D9**. Her biri ilgili bölümde işlenmiştir;
burada yalnızca özet ve hangi bölümde uygulandığının haritası var (`CLAUDE.md` dersi: karar
gövdeye yayılmazsa tur sonunda çelişki bırakır — bu yüzden madde madde referans veriliyor):

| Karar | Özet | Uygulandığı bölüm(ler) |
|---|---|---|
| D1 | Minimal/geçici arayüz **reddedildi** | §1, §2.2, §13 (soru 1 kapandı) |
| D2 | Bariyer: denylist değil, tehlikeli ad-uzayı **allowlist**'i | §7 |
| D3 | `ADR-005` eki **yazıldı**, üç kuralı bağlayıcı | §1, §2.4 (ADR-005 ek notu), §12 |
| D4 | Canlı hook testi `verify`de koşmaz + çevrimdışı çit zorunlu | §8, §11.3 |
| D5 | Sohbet **üçüncü kalıcı** sekme | §1, §2.2, §2.4, §11.1 (Ö1) |
| D6 | İzin deliği: kapatma denendi, **kısmen doğrulanabildi** — bkz. §8a | §8a (yeni) |
| D7 | Sohbet akışı boşluk-tespiti: `chat_seq` + **var olan** `handleOpen` kancası | §5 |
| D8 | Sohbet geçmişi yazması **mevcut** `no-write-gate-bypass` deseniyle kapatılır, yeni istisna yok | §2.3, §2.4 (STORE_FILES notu) |
| D9 | Mutasyon listesi: her madde "hangi test" + "türetilmiş mi/elle mi" taşır | §11.2 |
| D10 | Yol A'nın canlı testi başarısız olursa **durmadan** Yol B'ye geç; K3/UX§7.3 gevşetme **kapalı**; yalnızca Yol B de başarısız olursa eskale | §8a (Yol B, D6/D10 sonucu), §13 (soru 1 kapandı) |
| D11 | Bütçe tavanı: ayarlanabilir (sabit gömülmez) + tavana çarpınca sessiz durmaz + çitlenir | §3 (Bütçe tavanı alt bölümü), §10 (yeni satır), §11.1/§11.2 (mutasyon 14) |

### 0.2 Doğrulanamayanlar — güncel liste (tur 1'in 6 maddesinden 4'ü bu turda kapandı)

| # | Tur 1'in maddesi | Bu turda sonuç |
|---|---|---|
| 1 | SDK sürüm/peer bağımlılık listesi | ✓ DOĞRULANDI (bu turda kuruldu, §0.3) |
| 2 | `hasInstallScript` durumu | ✓ DOĞRULANDI: **yok** (§0.3, §2.5) |
| 3a | `settingSources:['project']` CLAUDE.md yükler mi | ✓ DOĞRULANDI (SDK'nın kendi tip dokümantasyonu, §0.3) |
| 3b | `settingSources:['project']` `"agent"` alanını (persona) yükler mi | **hâlâ [T] TAHMİN** — tip tanımlarında `agent` anahtarı Settings arayüzünde bulunamadı, ne yüklediği ne yüklemediği kesin değil. Kod turunun **ilk işi**: gerçek bir oturumda "CLAUDE.md'deki bir kuralı söyle" + "hangi persona/agent olarak davranıyorsun" sorularak elle doğrulanır (§8a). |
| 4 | `includePartialMessages`/`stream_event` varlığı | ✓ DOĞRULANDI: var (`sdk.d.ts:1725`, `SDKPartialAssistantMessage` tipi `sdk.d.ts:4826-4844`, §5) |
| 5 | Canlı davranış / uygulamanın çalışan hâli | **hâlâ doğrulanmadı** — bu sözleşme turu da hiçbir SDK oturumu açmadı (görev kısıtı korunuyor: tip tanımı okumak oturum açmaktan farklı, kota harcamaz). Kod turunda gerçek ölçüm yapılacak. |
| 6 | Windows'ta ebeveyn ölünce `claude.exe` akıbeti | **hâlâ doğrulanmadı**, Ö8'e bakınız — iddia [T]'ye indirildi. |

### 0.3 SDK paketi bu turda kuruldu ve okundu (repo DIŞINDA, scratchpad'de)

`npm install @anthropic-ai/claude-agent-sdk@0.3.261` scratchpad'de (`sdk-probe/`) çalıştırıldı —
**depo içinde `npm install` çalıştırılmadı**, `git status --porcelain` bunu doğruluyor. Bulgular:

- **`hasInstallScript` = false, doğrulandı.** SDK'nın kendi `package.json`'ında `scripts` yok;
  `node_modules` altındaki **103 paketin tamamı** taranıp (`scripts.install`/`postinstall`/
  `preinstall` için) hiçbirinde install-script bulunamadı (script çıktısı boş). `tests/deps.test.ts`
  bu paket ağacıyla **temiz** geçer — §2.5'teki [T] işareti kaldırıldı.
- `optionalDependencies`: sekiz platforma-özgü önceden derlenmiş ikili paket (native derleme
  değil) — tur 1'in ✓ DOĞRULANDI iddiasıyla tutarlı.
- `peerDependencies`: `@anthropic-ai/sdk@>=0.93.0`, `@modelcontextprotocol/sdk@^1.29.0`,
  `zod@^4.0.0` — sözleşmenin §2.4 `package.json` satırıyla birebir uyumlu.
- **`Options.settingSources` JSDoc'u (`sdk.d.ts:2075-2084`):** *"When omitted, all sources are
  loaded... Pass `[]` to disable filesystem settings (SDK isolation mode). **Must include
  'project' to load CLAUDE.md files.**"* — Ö13'ün sorduğu "CLAUDE.md gerçekten yükleniyor mu"
  sorusunun **kaynağı SDK'nın kendi tip dokümantasyonu**, artık spike alıntısına dayanmıyor.
- **`Options.includePartialMessages` (`sdk.d.ts:1721-1725`)** ve **`SDKPartialAssistantMessage`
  tipi (`sdk.d.ts:4826-4844`)** var — `event: BetaRawMessageStreamEvent` (Anthropic Messages API
  ham akış olayı: `content_block_delta` vb.) taşıyor. §5'te kullanılıyor.
- **`Options.managedSettings` (`sdk.d.ts:2051-2074`)** ve **`Options.hooks` (`sdk.d.ts:1582-1595`,
  programatik JS callback, dosya-tabanlı değil)** ve **`Options.systemPrompt` (`sdk.d.ts:2237+`)**
  — üçü de var. D6'nın (§8a) ve D2/N6'nın teknik temeli.
- **Settings precedence, SDK'nın kendi dokümantasyonunda (`sdk.d.ts:6391`):** *"Settings precedence
  is user < project < local < flag < policy"* — D6'nın analizinin temeli.

---

## 1. Kapsam

**İçinde:**

1. Barındırılan tek bir CEO sohbet oturumu (K1): sunucu içi yaşam döngüsü, `POST /api/chat/*`
   uçları, `/api/stream` üzerinden yeni `chat_*` SSE kanalları, `canUseTool` tabanlı izin/soru
   akışı, ortam bariyeri (D2 — genişletilmiş ad-uzayı allowlist'i, yalnızca `ANTHROPIC_API_KEY`
   değil), kendi görüntüleme önbelleği (kalıcılık, sayfalama ile), hata sınırı.
2. Sohbet ekranının **kendisi** — D1/D5 kararıyla bu artık "minimal geçici ekran" değil,
   `docs/03-ux.md §7`'nin yazılı ve onaylı hâline birebir uyan, sekme çubuğunda **üçüncü kalıcı
   sekme**. Görsel ince ayar (renk/spacing) hâlâ UX dokümanının **son sözü** olduğu alan, ama
   yapı/yerleşim/Türkçe metin artık **belirsiz değil** — bu sözleşme onu uygular, ertelemez.
3. Sohbet özelliğinin açma/kapama anahtarı (K6) ve devre dışıyken mevcut ekranların bozulmadığını
   kanıtlayan testler.
4. Veri akışı + durum makinesi + hata semantiği (K8) — UX'in Türkçe metin/renk/spacing tercihleri
   bu sözleşmenin konusu değil, ama **hangi veri hangi bileşene gider** artık `docs/03-ux.md §7`
   ile birebir eşleşecek şekilde tanımlı (§10).
5. `package.json`'a `@anthropic-ai/claude-agent-sdk` + zorunlu peer bağımlılıkları eklemek.

**Kapsam DIŞI (bilinçli, K4/K8 + feature notu + D3):**

- Olay akışının (izlenen projelerin hook verileri) CEO'nun bağlamına herhangi bir biçimde
  **beslenmesi** — K4. Bu feature bu köprüyü **kurmaz**; ileride istenirse ayrı bir feature/karar.
- Çoklu sohbet oturumu / thread (F-010'un konusu), kapılar paneli (F-008), token ekranı (F-011).
- `ANTHROPIC_AUTH_TOKEN` için **ayrı** bir bariyer — D2 ile bu artık ayrı değil, aynı allowlist
  mekanizmasının **doğal kapsamına** giriyor (§7). Açık soru olarak kapandı.
- ~~`ADR-005`'e ek yazmak~~ — **D3: bu ek zaten yazılmış** (`docs/decisions/ADR-005-…md:59-101`).
  Bu feature ADR'yi **değiştirmiyor**, ekin zaten koyduğu kurallara **uyuyor**. Ekin kendi ifadesi:
  panelin kendi yazması (1) "DEĞİŞMEDİ... F-012 bu kümeye tek bir yol bile eklemez." Bu sözleşmenin
  iki yeni dosya yazma yolu (`history-log.ts`, `session-id.txt`) **panelin kendi görüntüleme
  önbelleğidir** (jsonl-store.ts ile aynı kategori) — kategori (1)'e girer, kategori (2)'ye
  (barındırılan CEO'nun kendi araç yazmaları) değil. Detay: §2.3/§2.4 not, D8.

---

## 2. Dokunacağım dosyalar

### 2.1 Yeni — sunucu

| Dosya | Amaç |
|---|---|
| `src/features/chat/server/env-barrier.ts` | Saf fonksiyonlar: `checkApiKeyBarrier(env)` → `{ strippedVars: string[] }` (D2 — **isimlerin listesi**, tek bir boolean değil, çünkü K2 "her temizlenen değişkenin adı" görünür olsun istiyor), `stripApiKey(env)` → env'i **mutate eder**, kaldırılan değerleri asla döndürmez/loglamaz. `process.env`'e doğrudan dokunmaz — çağıran (`session.ts`) hangi env nesnesine uygulanacağını seçer (saf obje ile test edilebilir). Ayrıca `hasApiKeyHelperConfigured(settingsJsonPath)` (N6, aşağıda §7). |
| `src/features/chat/server/session.ts` | Oturumun tek sahibi: bootstrap (env bariyeri + `query()` çağrısı + `cwd`/`settingSources`/`permissionMode`/`maxBudgetUsd`/`managedSettings`(§8a)/`includePartialMessages` sabitleri), streaming-input kuyruğu, mesaj döngüsü (`for await`), `canUseTool` → bekleyen istekler haritası, `interrupt()`, restart, durum makinesi (`idle\|busy\|crashed\|disabled`), her SDK mesajını hem SSE'ye yayınlar hem `history-log.ts`'e yazar. `query` fonksiyonu **enjekte edilebilir** parametre (`createChatSession(deps)` — `deps`'in alan kümesi **kapalı**: yalnızca `{ query, dataDir, hub, now, env }`, Ö7'nin istediği statik assert bu kapalı kümeyi kontrol eder, `store`/`projectsService` **asla** geçirilmez). Kendi 3 satırlık `isChatEnabled(env)` çözücüsünü taşır — `index.ts`'ten **import ETMEZ** (Ö12, döngü kırılıyor). |
| `src/features/chat/server/history-log.ts` | Kendi basit ekleme-log dosyası (`<dataDir>/chat/history.jsonl`) — SDK'nın kendi transkript formatını **ayrıştırmaz**, yalnızca bu sunucunun zaten ürettiği/aldığı görüntüleme mesajlarını kalıcı hale getirir. **Ekleme-only, düzeltme-satırı deseni** (Ö3 — aşağıda tam tanım): `append(entry)`, `readPage({ limit, beforeSeq })` (Ö4 sayfalama), `foldByTurn(entries)` (aynı `turn_id`+`kind` için en yüksek `seq`'li satır kazanır), `markDanglingAsInterrupted()` (init'te, yarım kalan `streaming` girdileri için **yeni bir `interrupted` düzeltme satırı ekler**, var olan satırı YENİDEN YAZMAZ). |
| `src/features/chat/server/handlers.ts` | HTTP işleyicileri: `handleChatMessage`, `handleChatInterrupt`, `handleChatPermission`, `handleChatRestart`, `handleChatStatus`, `handleChatHistory`. Her biri kendi `try/catch`'ini taşır (§9) — `ingest.ts`'in async-IIFE deseniyle **birebir aynı**. |

**D8/B5 — `history-log.ts` ve `no-write-gate-bypass` (yeni istisna İCAT EDİLMEDİ):**
`tests/no-write-gate-bypass.test.ts` tüm `src/**`'ı tarar (✓ DOĞRULANDI bu turda, tam dosya okundu)
ve muafiyeti **çağrının tam metniyle** dört dosyalık bir haritada (`STORE_FILES`) tutar
(`tests/no-write-gate-bypass.test.ts:141-163`). `history-log.ts` (ve `session-id.txt` yazan küçük
yardımcı, aynı dosyada) bu haritaya **beşinci ve altıncı girdi** olarak eklenir — **yeni bir
kategori/mekanizma değil, var olan deseni tekrarlamak**:

```ts
[path.join(ROOT, 'src', 'features', 'chat', 'server', 'history-log.ts')]: [
  'fs.mkdirSync(chatDir, { recursive: true })',
  'fs.promises.appendFile(historyFile, line)',
],
[path.join(ROOT, 'src', 'features', 'chat', 'server', 'session-store.ts')]: [
  // ya da history-log.ts'in içinde ayrı bir fonksiyon — tek küçük dosya, session_id kalıcılığı
  'fs.writeFileSync(sessionIdFile, sessionId)',
],
```
Gerekçe (ADR-005 ek kategorisi (1)'e göre): bu, `jsonl-store.ts`'in zaten yaptığı şeyin
**birebir aynısı** — sunucunun kendi görüntüleme kaydını append-only bir dosyaya yazması. Ek
kategori (2) (barındırılan CEO'nun **kendi** araç yazmaları — `Write`/`Edit`/`Bash`) bu taramanın
**dışında** kalmaya devam eder, çünkü o yazmalar bu sunucu sürecinin `fs` çağrıları değil, ayrı bir
`claude.exe` alt sürecinin kendi dosya sistemi erişimidir (Node process boundary — statik tarama
zaten bunu göremiyor, göstermeye çalışmıyor, ADR-005 ekinin kendi tespiti). **Yeni mutasyon (B5'in
istediği "allowlist'e eklenen satırın dışına çıkan yazma" çiti):** mutasyon 11, §11.2.

### 2.2 Yeni — istemci (görsel DEĞİL veri katmanı + D1/D5 uygulaması)

| Dosya | Amaç |
|---|---|
| `src/features/chat/web/useChatSession.ts` | `useEventStream.ts`'in `onFeatures` deseniyle **aynı şekilde** yeni `chat_*` SSE olaylarına abone olur (App kökündeki **tek** `stream`/`EventSource`'a — K5). Callback'lerin hepsi **kararlı referans** olmak ZORUNDA (N5 — aşağıda not). Dışa: `{ messages, status, pendingRequests, sendMessage(text), interrupt(), respond(requestId, result), restart(), loadOlder() }` (`loadOlder` Ö4'ün sayfalaması için). `writeFetch` ile POST'lar (mevcut sarmalayıcı, değişmeden). |
| `src/features/chat/web/ChatScreen.tsx` | **D1/D5 ile artık kalıcı, minimal DEĞİL.** `docs/03-ux.md §7`'nin yazılı Türkçe metinlerini, mockup yapısını (mesaj balonları, izin kartı, soru kartı, alt agent durum satırı, kalıcı uyarı şeridi, kompozer, "▲ Daha eski mesajları yükle") **birebir** uygular — UX kendi Türkçe metnini vermişse geliştirici **yeni metin uydurmaz**. Tailwind sınıfları UX'in belirttiği aynen (`bg-zinc-800`/`bg-zinc-900 border-zinc-800`, `border-amber-700`, `sticky top-0 bg-amber-950 border-b border-amber-800`, vb. — §7 mockup'larında literal geçiyor). `docs/03-ux.md`'ye bu sözleşme turunda **dokunulmadı**; oradaki her metin/sınıf isim aynen alınır. |

**Not — `ChatScreen.minimal.tsx` adı ve konsepti bu turda TERK EDİLDİ (B6 düzeltmesi):** tur 1'de
"UX dokümanı henüz yazılmadığı için minimal ekran" gerekçesi vardı; UX dokümanı artık yazılı ve
onaylı, o gerekçe **artık geçerli değil**. Ayrı bir "görsel-uygulama turu" beklemeye gerek yok —
ekran bu feature'ın içinde, UX'in tarif ettiği hâliyle yazılır. (§13 eski soru 1 bu yüzden kapandı.)

### 2.3 Yeni — testler

| Dosya | Kapsam |
|---|---|
| `tests/features/chat/server/env-barrier.test.ts` | Birim — bariyer saf fonksiyonları: allowlist dışı bir `ANTHROPIC_*`/`CLAUDE_*`/`AWS_*`/`GOOGLE_*` değişkeni temizlenir + adı `strippedVars`'a düşer; allowlist İÇİNDEKİ üç `CLAUDE_CODE_*` değişkeni (mevcut `.claude/settings.json`'ın `env` bloğuyla **aynı üç isim**) dokunulmadan kalır. |
| `tests/features/chat/server/session.test.ts` | Birim, **enjekte edilmiş sahte `query`** — mesaj kuyruklama, `canUseTool` bekleme/çözme, `interrupt()`, restart, durum geçişleri, hata sınırı, `settingSources`/`cwd`/`permissionMode`/`maxBudgetUsd`/`managedSettings`/`includePartialMessages` seçeneklerinin doğru değerlerle çağrıldığı, `deps` alanlarının kapalı kümesi (Ö7). |
| `tests/features/chat/server/history-log.test.ts` | Birim — gerçek geçici dizin: ekleme, `readPage` sayfalama (Ö4: `limit`/`beforeSeq`), `foldByTurn` (aynı `turn_id`+`kind` için son `seq` kazanır), `markDanglingAsInterrupted` (yarım kalan `streaming` girdisi → yeni bir `interrupted` düzeltme satırı, ESKİ satır silinmez/değişmez). |
| `tests/integration/chat-api.test.ts` | Entegrasyon — gerçek `createServer()` + gerçek HTTP + **enjekte edilmiş sahte `query`**: `x-mc-write` zorunluluğu (mutasyon 6), bariyer bayrağının `GET /api/chat/status`'ta göründüğü, izin round-trip'i, kesme, restart, disabled-modda tüm chat uçlarının **düzgün** (503, çökme değil) davrandığı, hata sınırı (mutasyon 7), `chat_tool` yayınının **kapalı alan allowlist'i** (mutasyon 12, B7). |
| `tests/features/chat/no-context-injection.test.ts` | Statik guard (K4) — iki iddia: (a) `src/features/chat/**` hiçbir dosyası `jsonl-store`, `events/server/query`, `events/server/ingest`, `sse/hub`'ın **broadcast dışı** okuma API'lerini import etmiyor (mutasyon 8); (b) `createChatSession`'a geçirilen `deps` nesnesinin `index.ts`'teki çağrı yerinde **yalnızca** kapalı alan kümesini (`query, dataDir, hub, now, env`) içerdiği — `store`/`projectsService` geçirilirse KIRMIZI (mutasyon 8b, Ö7). |
| `tests/features/chat/permission-mode-fence.test.ts` | Statik guard — `session.ts` içinde `permissionMode` **literal** değeri `'bypassPermissions'` veya `'acceptEdits'` değil (mutasyon 4). |
| `tests/web/App.test.tsx` **(mevcut dosya, güncellenecek — Ö1/B6)** | `role="tab"` sayım assert'i 2 → **3** (açık modda); `MC_CHAT_ENABLED=0` altında **2** kalır (yeni assert, AC10). |
| `tests/e2e/shell.spec.ts` **(mevcut dosya, güncellenecek — Ö1/B6)** | `clickableCount` 3 → **4**; `tabRoleCount` 2 → **3** (açık modda). |
| `tests/web/App.interaction.test.tsx` **(mevcut dosya, güncellenecek — Ö1/B6)** | `End` tuşu artık **Sohbet**'i (üçüncü/son sekme) seçer — mevcut "Kanban'ı seçer" assert'i güncellenir. |
| `tests/no-write-gate-bypass.test.ts` **(mevcut dosya, güncellenecek — B5/D8)** | `STORE_FILES`'a `history-log.ts`/`session-store.ts` girdileri eklenir (§2.1). |
| `tests/integration/chat-hooks-live.test.ts` | **Varsayılan `npm test`/`npm run verify`'de KOŞMAZ** — `describe.skipIf(!process.env.MC_CHAT_LIVE_TESTS)`. §8/§8a. |

**Ö1/B6 — dosya sahipliği notu (bkz. §2.4 sonu):** yukarıdaki dört `tests/web/**` ve
`tests/e2e/**` dosyası feature notunun ("Dosya sahipliği") listesinde **yoktu** — bu sessiz bir
genişleme değil, **açıkça** burada listeleniyor ve CEO'nun feature notunu güncellemesi
isteniyor (Ö11).

### 2.4 Değiştireceğim (chat dizini dışı — her biri mekanik/zorunlu, gerekçeli)

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `src/server/index.ts` | (a) `createServer` içine `createChatSession({ query, dataDir, hub, now, env: process.env })` çağrısı (kapalı `deps` kümesi, Ö7) + `handleChat*` route eşleşmeleri (mevcut desen). (b) `server.on('close', ...)` içine `chatSession.stopAll()` eklenir (aynı satırda, aynı desen). `x-mc-write` **zaten** otomatik kapsıyor (ADR-013). | Feature notu "sohbet ucunun kaydı için `src/server/` içindeki dağıtıcı satırı" — F-002/F-003/F-005/F-007 emsali. |
| `src/web/App.tsx` | **D5: sekme kalıcı ve üçüncü** — `TABS` dizisine `{ id: 'chat', label: 'Sohbet' }` eklenir, sıra `docs/03-ux.md:230`'a göre **Kanban'dan sonra, Kapılar'dan önce**: `[Zaman Çizelgesi][Kanban][Sohbet][Kapılar][Thread][Token]` (bugün yalnızca ilk ikisi var — Kapılar/Thread/Token henüz yok, yani pratikte `[Zaman Çizelgesi][Kanban][Sohbet]`). `MC_CHAT_ENABLED=0` iken bu sekme **hiç render edilmez** (dizide yok), `role="tab"` sayısı bugünkü gibi 2 kalır (AC10, Ö1). `useEventStream`'e `onChatMessage`/`onChatStatus`/`onChatToolEvent`/`onChatPermissionRequest`/`onChatPermissionResolved`/`onChatError` callback'leri geçirilir — **hepsi `useCallback`/kararlı `setState` fonksiyonu ile sarılı** (N5, aşağıda not), aksi hâlde her render'da `useEventStream`'in efekti yeniden kurulur ve B1'in reconnect-senkron mekanizması gereksiz yere tetiklenir. | D5 + Ö1 + N5. |
| `src/web/lib/useEventStream.ts` | (a) `onFeatures` ile **birebir aynı** desende altı yeni `chat_*` callback seçeneği + `es.addEventListener(...)`. (b) **B1/D7 düzeltmesi:** mevcut `handleOpen` fonksiyonuna (satır 169) yeni bir opsiyonel çağrı eklenir: `options.onChatSync?.()` — bu, `hello` adlı **var olmayan** bir SSE kanalına değil, **gerçekten var olan ve her yeniden bağlanmada ateşlenen** native `EventSource` `'open'` olayına bağlanır (✓ DOĞRULANDI, `useEventStream.ts:169`, WHATWG `EventSource` spesifikasyonunun native davranışı — her `open` olayından hemen önce sunucu zaten bir `hello` çerçevesi yazmış olur, ✓ DOĞRULANDI `stream.ts:70-72`, ama istemci bunu SSE-seviyesinde DEĞİL native browser-seviyesinde yakalıyor; bu ayrım açıkça yazılıyor ki "hello dinliyoruz" gibi yanlış bir izlenim kalmasın). | ADR-004 "tek bağlantı çok kanal" + gerçek var olan kancayı kullanmak (B1 düzeltmesi, uydurma yok). |
| `package.json` | `dependencies`'e `@anthropic-ai/claude-agent-sdk@^0.3.261`, `zod@^4`, `@anthropic-ai/sdk@>=0.93.0`, `@modelcontextprotocol/sdk@^1.29.0` eklenir. `scripts`'e `"test:chat-live": "vitest run tests/integration/chat-hooks-live.test.ts"` eklenir (varsayılan `test`/`verify` **çağırmaz**). | SDK'nın peer gereksinimleri, bu turda kurulu paketten ✓ DOĞRULANDI (§0.3). |
| `src/shared/types.ts` | `ErrorCode` birleşimine `'chat_disabled' \| 'session_not_ready' \| 'no_active_turn' \| 'request_not_found' \| 'invalid_body'` eklenir (F-007 emsali). `ChatLogEntry` tipi (§6) burada tanımlanır. | Paylaşılan tip deposu — her feature kendi tip genişletmesini burada yapıyor. |

**Not — dokunulmayacağını doğruladığım dosyalar (olumsuz iddia, ✓ DOĞRULANDI):**
`src/server/store/jsonl-store.ts`, `src/server/store/retention.ts`, `src/server/write-gate.ts`,
`src/features/events/**`, `src/features/projects/**`, `src/features/kanban/**` — hiçbiri
değişmiyor.

**Not — genişletilmiş dosya sahipliği (Ö11, açıkça listelendi, sessiz değil):** feature notunun
("Dosya sahipliği") listesi yalnızca `src/features/chat/**`, ilgili testler, `package.json`, ve
"dağıtıcı satırı" diyor. Bu sözleşme buna ek olarak şu dosyalara dokunuyor: `src/web/App.tsx`,
`src/web/lib/useEventStream.ts`, `src/shared/types.ts`, `tests/web/App.test.tsx`,
`tests/e2e/shell.spec.ts`, `tests/web/App.interaction.test.tsx`, `tests/no-write-gate-bypass.test.ts`.
**CEO'nun feature notunu bu listeyle güncellemesi isteniyor** — kod turu başlamadan.

### 2.5 Yeni bağımlılıklar — `tests/deps.test.ts` etkisi (bu turda kurulu paketten doğrulandı)

`@anthropic-ai/claude-agent-sdk`'nin `optionalDependencies`'i platforma-özgü önceden derlenmiş
ikili paketlerdir. `tests/deps.test.ts`'in üç kontrolü: (1) **`hasInstallScript`** — bu turda
kurulan 103 paketin **tamamı** taranıp hiçbirinde `install`/`postinstall`/`preinstall` script'i
bulunamadı (§0.3, ✓ DOĞRULANDI — artık [T] değil). (2) native araç isimleri (`node-gyp` vb.)
bağımlılık ağacında yok (paket `dependencies` taşımıyor, ✓ DOĞRULANDI). (3) `better-sqlite3`
ilgisiz.

---

## 3. Oturum yaşam döngüsü

**Nerede yaşıyor:** mevcut `127.0.0.1:7333` Node sürecinin **içinde** (SPIKE-002 §5.1). Panel
süreci **ebeveyn**, SDK'nın açtığı `claude.exe` **çocuk** (Windows, ADR-009).

**`cwd` açıkça verilir:** `path.resolve(__dirname, '..', '..', '..')` — `process.cwd()`
**kullanılmaz**. Test: session bootstrap'a geçirilen `cwd` değerinin `path.join(cwd, '.claude',
'settings.json')`'da gerçekten bir dosya bulduğu doğrulanır (mutasyon 3a, §11).

**Ne zaman açılır:** sunucu başlarken, **arka planda, engellemeden**. Sohbet **kapalıysa**
(`MC_CHAT_ENABLED`, K6, aşağıda) bootstrap hiç çağrılmaz. Sohbet açıksa ama bariyer/SDK hatası
**varsa**, bootstrap başarısız olur, durum `crashed` olarak işaretlenir — **sunucu ayakta kalır**.

**Ne zaman kapanır:** (a) `shutdown()` → `chatSession.stopAll()` aktif `Query`'yi `interrupt()`'ler
ve alt süreç referansını bırakır. **[T] TAHMİN (Ö8 düzeltmesi, aşağıda) — "alt süreç ebeveynle
birlikte ölür" iddiası bu turda [T]'ye indirildi**, gerekçe altta. (b) `POST /api/chat/restart` —
mevcut oturum kapatılır, `resume: <son session_id>` ile yeni bir `query()` açılır. (c) panel
sekmesi kapanır — **oturum kapanmaz**.

**Ö8 düzeltmesi — "Alt süreç ebeveynle birlikte ölür" [T] TAHMİN'e indirildi (tur 1'de yanlışlıkla
✓ DOĞRULANDI yazılmıştı):** kaynak metin SPIKE-002 §5.5'te **⊢ ÇIKARIM** olarak işaretli, ✓
DOĞRULANDI değil. ADR-009 gereği platform Windows ve Windows'ta ebeveyn süreç ölünce çocuk
**otomatik ölmez** (POSIX süreç grubu semantiği yok) — `CLAUDE.md`'nin kendi dersi: *"Uygulamayı
çalıştıran agent turları arkada yetim `npm run dev` süreç ağaçları bırakıyor."* Bu yüzden
`stopAll()` **açıkça** alt süreci sonlandırmalı: SDK'nın döndürdüğü `Query` nesnesinin
`interrupt()`/`abortController`'ı (veya varsa açık bir `kill()`/`dispose()`) çağrılarak — hangi API
olduğu kod turunda kurulu paketin `Query` tipinden (`sdk.d.ts`) teyit edilecek, bu sözleşme turunda
adı garanti edilmiyor. **QA kabul kriteri (elle, kod turunda):** panel kapatılıp sunucu
`SIGINT`/`SIGTERM` ile durdurulduktan sonra Görev Yöneticisi'nde (Windows) yetim bir `claude.exe`
**kalmadığı** kontrol edilir; kalırsa bu bir bloklayıcıdır, "kabul edilen risk" değildir (Ö8).

**Çöker ne olur:** SDK'nın `for await (const message of query(...))` döngüsü bir istisna
fırlatırsa, `session.ts`'in döngüsü bunu **kendi** `try/catch`'i içinde yakalar (§9), durumu
`crashed` yapar, `history-log.ts`'e yarım kalan (`streaming`) son girdi için **yeni bir**
`interrupted` düzeltme satırı ekler (`markDanglingAsInterrupted`, §6 — var olan satır DEĞİŞMEZ,
Ö3), `chat_status` yayınlar. **Otomatik yeniden başlatma YOK** (v1 tasarım kararı, N4 — bilinen
sınırlama olarak burada da not edilir: bekleyen bir izin isteği sunucu yeniden başlarsa/çökerse
**kaybolur**, tur tamamlanmadan ölür; v1 için kabul edilebilir, ayrıca çitlenmiyor).

**Sohbet devre dışıyken (K6) — Ö12 düzeltmesi:** `resolveEnvInt`'i `index.ts`'ten import ETMEK
döngüsel bağımlılık kurardı (chat modülü `index.ts`'i, `index.ts` da chat handler'larını import
edecek — `index.ts`'in modül-seviyesi yan etkileri var, satır 26-32) ve `resolveEnvInt`'in
"geçersiz değer sessizce varsayılana düşer" semantiği bir **kill-switch** için güvensiz (typolu
`MC_CHAT_ENABLED=false` sohbeti **açık** bırakırdı). Bunun yerine `session.ts` kendi 3 satırlık
çözücüsünü taşır:

```ts
function isChatEnabled(env: NodeJS.ProcessEnv): boolean {
  const raw = env.MC_CHAT_ENABLED
  if (raw === undefined) return true // varsayılan: açık
  if (raw === '1') return true
  if (raw !== '0') {
    process.stderr.write(`Uyarı: MC_CHAT_ENABLED değeri ("${raw}") tanınmıyor, kapalı varsayılıyor.\n`)
  }
  return false // '0' VEYA tanınmayan herhangi bir değer → güvenli taraf: KAPALI
}
```
`isChatEnabled(env) === false` ise: `createChatSession(...)` hiç çağrılmaz, chat route'ları
dispatcher'da kayıtlı **kalır** ama her biri sabit `{ success: false, error: { code:
'chat_disabled', message: '...' } }` (503) döner. Mevcut beş uç ve ekranları **hiçbir şekilde
etkilenmez**.

---

## 4. Uçlar (endpoints)

Tümü `POST /api/chat/*` **`x-mc-write` başlığına tabidir** (ADR-013, muafiyet yok). Bu kontrol
dağıtıcıda **zaten** otomatik uygulanıyor (`index.ts:333`, ✓ DOĞRULANDI).

**N2 düzeltmesi — zarf tutarlılığı:** tur 1 `/api/chat/status`'u zarfsız bırakmıştı, "Tüm yanıtlar
`ApiResponse<T>` zarfını kullanır" cümlesiyle çelişiyordu. Bu turda **düzeltildi**: `/api/chat/
status` da `ApiResponse<T>` zarfını kullanır — `200 { data: { session_active, session_id, busy,
api_key_barrier_tripped, stripped_env_vars, chat_enabled, last_error } }` (`api_key_barrier_
tripped` boolean **ve** `stripped_env_vars: string[]` birlikte — D2'nin "her temizlenen değişkenin
adı görünür" şartı, §7).

`ErrorCode` birleşimine eklenecek yeni kodlar: `'chat_disabled' | 'session_not_ready' |
'no_active_turn' | 'request_not_found' | 'invalid_body'` (`internal_error` zaten var).
**`src/shared/types.ts`'e bu genişletme de dokunacağım dosyalar listesindedir** (§2.4).

| Uç | Metot | Gövde | Başarı | Hata kodları |
|---|---|---|---|---|
| `/api/chat/status` | GET | — | `200 { data: { session_active, session_id, busy, api_key_barrier_tripped, stripped_env_vars, chat_enabled, last_error } }` | — (her zaman 200) |
| `/api/chat/history` | GET | Query: `?limit=50&before_seq=<n>` (Ö4) | `200 { data: { entries: ChatLogEntry[], has_more: boolean } }` | `chat_disabled` (503) |
| `/api/chat/message` | POST | `{ text: string }` (1-8000 karakter, boş/trim-sonrası-boş reddedilir) | `202 { data: { turn_id, queued } }` | `invalid_body`(400) · `chat_disabled`(503) · `session_not_ready`(503) · `internal_error`(500) |
| `/api/chat/interrupt` | POST | `{}` | `200 { data: { interrupted: true } }` | `no_active_turn`(409) · `chat_disabled`(503) |
| `/api/chat/permission` | POST | `{ request_id: string, result: unknown }` | `200 { data: { resolved: true } }` | `request_not_found`(404) · `invalid_body`(400) · `chat_disabled`(503) |
| `/api/chat/restart` | POST | `{}` | `200 { data: { session_id } }` | `chat_disabled`(503) · `internal_error`(500) |

**`result` alanının şekli (`/api/chat/permission`):** sunucu bunu **doğrulamadan** bekleyen
`canUseTool`/`AskUserQuestion` promise'ine olduğu gibi iletir. Sunucu tarafında **tek** kontrol:
`request_id` bilinen bir bekleyen istekle eşleşmeli (yoksa `404`) ve her `request_id` **yalnızca
bir kez** çözülebilir. Bu, K3'ün HTTP seviyesindeki karşılığıdır: sunucu hiçbir zaman kendi
başına `{behavior:'allow'}` üretmez. (K3'ün **SDK-seviyesi** karşılığı — `.claude/settings.json`'ın
allow listesinin `canUseTool`'u hiç tetiklememesi sorunu — ayrı ve daha derin bir konu, §8a.)

---

## 5. Akış protokolü (SSE)

**K5 — mimari karar:** mevcut `/api/stream` bağlantısı yeniden kullanılır, ikinci `EventSource`
AÇILMAZ (ADR-004 "tek bağlantı, çok kanal"). Yeni kanal adları: `chat_message`, `chat_user_echo`,
`chat_tool`, `chat_permission_request`, `chat_permission_resolved`, `chat_status`, `chat_error`.

**Sıralama:** tek bir sunucu içi `for await` döngüsü SDK mesaj akışını **sırayla** tüketir ve her
mesajı işlerken `hub.broadcast(...)` çağırır — Node tek iş parçacıklı olduğu için yayın sırası
üretim sırasıyla birebir aynıdır.

**`id:`/`Last-Event-ID` kararı — değişmedi:** yeni `chat_*` çerçevelerinin **hiçbiri `id:` satırı
taşımaz** (`hello`/`resync` ile aynı desen). Gerekçe tur 1'deki gibi: `EventSource`'un tek "son
olay kimliği" tamponu, `chat_*` ve `event` kanallarını karıştırırdı.

**D7/B1 düzeltmesi — boşluk tespiti ve telafi (bu turda yeniden tasarlandı, gerçek bir kancaya
dayanıyor):**

1. **`chat_seq` alanı:** her `chat_*` çerçevesi (yalnızca `chat_message` değil, hepsi) kendi
   `turn_id`'sinden **bağımsız**, `history-log.ts`'in **kendi** monoton sayacından (§6
   `ChatLogEntry.seq` ile **aynı sayaç**, yeni bir ikinci sayaç İCAT EDİLMİYOR) bir `chat_seq: number`
   taşır. İstemci (`useChatSession.ts`) son gördüğü `chat_seq`'i tutar.
2. **Telafi kancası `hello` DEĞİL, gerçekten var olan `handleOpen`/native `'open'`:** her
   `EventSource` (yeniden) bağlanışında `useEventStream.ts:169`'daki mevcut `handleOpen`
   çağrılır (✓ DOĞRULANDI, kod okundu) — bu turda oraya `options.onChatSync?.()` çağrısı
   eklenir. `useChatSession.ts` bu callback'te **her zaman** `GET /api/chat/history`'yi (son 50
   mesaj, Ö4) çağırıp mesaj listesini **tam olarak değiştirir** (append değil, `RESET` —
   `useEventStream`'in ana olay listesindeki `RESET_EVENTS` deseniyle aynı fikir). Bu, kısa bir
   kopmada (son 50 mesaj içinde kalan) boşluğu **her zaman** kapatır; `chat_seq` alanı ek olarak
   CANLI bağlantı sırasında bir atlama olursa (ör. sunucu tarafı bir mesajı kaybetti) istemcinin
   bunu **fark edip** (ardışık olmayan `chat_seq`) aynı `GET /api/chat/history` çağrısını **hemen**
   tetiklemesini sağlar — reconnect'i beklemeden.
3. Bu tasarım tur 1'in "hello'da yeniden yükle" cümlesini **`open`'da yeniden yükle + canlı
   `chat_seq` boşluk kontrolü** olarak değiştirir; ADR-004 karar 5'in gerekçesi ("yalnızca `event`
   kanalı sıra garantisi verir") hâlâ ihlal edilmiyor — `chat_*` kanalı hâlâ SSE-seviyesinde sıra
   garantisi vermiyor, garanti **uygulama katmanında** (`chat_seq` + tam-yeniden-yükleme) sağlanıyor.

**Yarım cevap kesilirse ne olur (iki senaryo):**
1. **Tarayıcı bağlantısı kopar, sunucu süreci hayatta:** asistan cevabı üretmeye **sunucu
   tarafında devam eder**. Tarayıcı yeniden bağlanınca `onChatSync` + `GET /api/chat/history` ile
   son duruma döner.
2. **Sunucu süreci çöker/yeniden başlar:** tur **tamamlanmadan** kaybolur (Ö8 — [T] TAHMİN'e
   indirilen ebeveyn/çocuk varsayımı burada da geçerli, ama sonuç aynı: `chatSession.stopAll()`'un
   ne yaptığından bağımsız olarak, süreç crash olduğunda zaten tüm bellek durumu gider).
   `history-log.ts`'te bu turdan kalan `streaming` girdi, bir sonraki `init()`'te
   `markDanglingAsInterrupted()` tarafından **yeni bir `interrupted` satırı eklenerek** düzeltilir.

**`chat_message` delta biçimi — Ö2 düzeltmesi (artık [T] değil, kısmen ✓ DOĞRULANDI):**
`{ turn_id: string, chat_seq: number, delta: string, done: boolean }`. `delta`, SDK'nın
`includePartialMessages: true` seçeneğiyle (✓ DOĞRULANDI VAR, `sdk.d.ts:1721-1725`) yayınladığı
`SDKPartialAssistantMessage` mesajlarından (✓ DOĞRULANDI VAR, `sdk.d.ts:4826-4844`) çıkarılır: her
mesajın `event` alanı ham bir Anthropic Messages API akış olayıdır (`content_block_delta` vb.);
`event.type === 'content_block_delta' && event.delta.type === 'text_delta'` olduğunda
`event.delta.text` panelin göreceği `delta` alanına kopyalanır — **ham SDK zarfı** (`event`
nesnesinin geri kalanı, `uuid`, `session_id` gibi alanlar) **asla** panele gönderilmez (K3'ün
gözlemiyle aynı gerekçe). **Kalan [T]:** `event`'in tam tip birleşimi (`BetaRawMessageStreamEvent`)
kod turunda kurulu paketten (`agentSdkTypes.d.ts` veya benzeri) tekrar kontrol edilmeli — bu
sözleşme yalnızca `content_block_delta`/`text_delta` alt tipini varsayıyor, `thinking_delta` gibi
diğer alt tiplerin nasıl ele alınacağı (yoksayılır mı, ayrı bir `chat_thinking` kanalına mı gider)
kod turunda karara bağlanacak — **v1 için varsayım: yalnızca `text_delta` işlenir, diğerleri
yoksayılır** (Karpathy §2, "ileride lazım olur" özelliği eklenmiyor).

**`chat_tool` alt agent görünürlüğü — B7 düzeltmesi (KAPALI allowlist, çitlenmiş):**
CEO kararı S2 (`docs/03-ux.md:747-752`) bağlayıcı: *"ham araç çıktısı arayüze basılmaz."* Bu
sözleşme `chat_tool` yükünün alan kümesini **kapalı** (yalnızca-şunlar) olarak tanımlar:
```ts
interface ChatToolEvent {
  tool_use_id: string
  tool_name: string          // ör. "Agent", "Bash" — SPIKE-002 M3'te doğrulanan gerçek isimler
  description?: string       // S1: sabit, CEO tarafından ÜRETİLMEZ — alt agent başlatma
                              // parametresinden gelen 3-5 kelimelik özet, olduğu gibi
  status: 'started' | 'finished' | 'error'
  elapsed_ms?: number
  parent_tool_use_id: string | null
}
```
`tool_input`, `tool_result`, SDK mesajının **hiçbir ham alanı** bu şemaya girmez. Mutasyon 12
(§11.2) bunun tersini test eder: `chat_tool` yayınına ham `tool_result`/`content` eklenirse KIRMIZI.

---

## 6. Kalıcılık

**Kaynak gerçeği ayrımı:** oturumun **kendisinin** kaynak gerçeği SDK'nın kendi transkriptidir
(`resume: <session_id>`, panel bunu **ayrıştırmaz**). Panelin **görüntüleme** geçmişinin kaynak
gerçeği `history-log.ts`'idir.

**`ChatLogEntry` şekli** (`src/shared/types.ts`'e eklenir):
```ts
interface ChatLogEntry {
  seq: number            // history-log.ts'in kendi monoton sayacı — chat_seq ile AYNI sayaç (§5)
  turn_id: string
  role: 'user' | 'assistant' | 'system'
  kind: 'text' | 'tool' | 'permission_request' | 'permission_resolved' | 'question' | 'error'
  text?: string
  status: 'streaming' | 'done' | 'interrupted'
  ts: string
}
```
**Ö6 düzeltmesi — `kind`'a `'question'` eklendi** (tur 1'de eksikti, `AskUserQuestion` izin
isteğinden ayırt edilemiyordu). Seçilen cevap `chat_user_echo` olarak akışa **kullanıcı balonu**
gibi eklenir (`docs/03-ux.md:337`'nin "seçilen metin ayrıca kullanıcı balonu olarak akışa da
eklenir" kuralı) — `role: 'user'`, `kind: 'text'`.

**Ö3 düzeltmesi — ekleme-only log ile durum geçişi (yöntem seçildi: düzeltme-satırı, katlama okuma
anında):** `history-log.ts` dosyaya **asla** yeniden yazmaz/rewind etmez. Bir `turn_id`'nin durumu
değiştiğinde (`streaming` → `done`/`interrupted`) **yeni bir satır** eklenir, aynı `turn_id`+`kind`
ile ama yeni `seq` ve güncel `status`/`text`. Okuma tarafında (`readPage`/`GET /api/chat/history`)
`foldByTurn` aynı `(turn_id, kind)` çiftine sahip birden çok satırı **en yüksek `seq`'li olanla**
temsil eder — istemci asla aynı mantıksal mesajın iki kopyasını görmez. Bu, `atomicWrite`/kısmi-
yazma riskini **tamamen ortadan kaldırır** (yalnızca `appendFile`, asla `rename`/`truncate`) ve
`no-write-gate-bypass` taramasının zaten kapsadığı çağrı biçimiyle (§2.1) uyumludur.

**Ö4 düzeltmesi — sayfalama (UX "son 50 + daha eski" ile artık eşleşiyor):**
`GET /api/chat/history?limit=50&before_seq=<n>` — `limit` yoksa 50 varsayılan; `before_seq` varsa
o `seq`'ten **küçük** en yeni `limit` kadar satır döner (katlanmış hâliyle); yanıt `has_more:
boolean` taşır (UX'in "▲ Daha eski mesajları yükle" bağlantısının görünüp görünmeyeceğini
belirler). "Tamamı yükle" ifadesi bu turda **kaldırıldı**.

**Retention:** v1'de **yok** (Karpathy §2) — N4'te not edilen bilinen sınırlamayla birlikte kabul
edilen risk, engelleyici değil.

**Devam ettirme (resume):** ✓ DOĞRULANDI, SDK `resume: <session_id>` seçeneğini destekliyor —
değişmedi.

---

## 7. Kimlik ve bariyer (K2) — D2 uygulaması

**D2 — denylist değil, tehlikeli ad-uzayı allowlist'i (B2'nin kapanışı):** `checkApiKeyBarrier`/
`stripApiKey`, `env`'deki **her** anahtarı tarar; anahtar şu dört önekten biriyle **başlıyorsa**
(`ANTHROPIC_`, `CLAUDE_`, `AWS_`, `GOOGLE_`) VE aşağıdaki sabit istisna listesinde **değilse**,
temizlenir ve adı `strippedVars`'a eklenir:

```ts
const ALLOWED_ENV_EXCEPTIONS = new Set([
  'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
  'CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH',
  'CLAUDE_CODE_SUBAGENT_MODEL',
])
```
Bu üç isim **bilinçli olarak** `.claude/settings.json`'ın kendi `env` bloğuyla (`.claude/
settings.json:3-7`, ✓ DOĞRULANDI bu turda okundu) **birebir aynı** — bunlar kimlik/bulut-
yönlendirme sinyali değil, alt agent derinlik/model operasyonel ayarları; barındırılan CEO
oturumunun **kendi** işlevselliği için gerekli.

**Bu allowlist tasarımı B2'nin ölçtüğü kimlik önceliği tablosunu (bulut sağlayıcı >
`ANTHROPIC_AUTH_TOKEN` > `ANTHROPIC_API_KEY` > `apiKeyHelper`) baştan sona kapatıyor:**
`CLAUDE_CODE_USE_BEDROCK`/`CLAUDE_CODE_USE_VERTEX` gibi bulut-sağlayıcı bayrakları da `CLAUDE_`
önekiyle başladığı için **varsayılan olarak temizlenir** (B2'nin orijinal sorusunun ötesinde,
en yüksek öncelikli kimlik kaynağını da kapatan bir bonus — SPIKE-002 §2.2 tablosu, madde 1).
`ANTHROPIC_AUTH_TOKEN` aynı mekanizmayla kapsanır (§1'deki eski açık soru 2 kapandı).

**[T] TAHMİN — kod turunda doğrulanmalı:** `.claude/settings.json`'ın kendi `env` bloğunun SDK
tarafından **spawn zamanında ayrıca uygulandığı** (yani `process.env`'den `CLAUDE_CODE_MAX_
SUBAGENT_SPAWN_DEPTH` silinse bile settings.json'daki değerin devreye girdiği) varsayılıyor ama
bu turda **doğrulanamadı** (kurulu paketin spawn mantığı minify edilmiş `bridge.mjs`/`sdk.mjs`
içinde, statik okumayla güvenilir şekilde teyit edilemedi). Allowlist istisnası (yukarıdaki üç
isim) tam olarak bu belirsizliğe karşı bir **savunma** — eğer settings.json'ın `env` bloğu
gerçekten process.env'i miras alıp üzerine yazıyorsa istisna gereksiz ama zararsız; eğer
miras almıyorsa istisna **gereklidir** (aksi hâlde CEO'nun subagent derinlik/model ayarları
sessizce sıfırlanırdı — bu deponun "sessiz kayıp" hata sınıfı). Kod turunda `chat-hooks-live.
test.ts` kapsamı genişletilerek (veya ayrı küçük bir canlı test) bu doğrulanmalı.

**Mekanizma (Node çekirdek davranışı, ✓ DOĞRULANDI):** `child_process.spawn` açıkça `env`
verilmezse çocuk ebeveynin `process.env`'ini spawn anında miras alır. `env-barrier.ts`, panelin
**kendi** `process.env`'inden bu değişkenleri `query()` **ilk kez çağrılmadan önce** `delete` eder
— hem modül yüklenirken hem her `query()` çağrısından hemen önce.

**Sessiz olmama (K2):** `strippedVars` `session.ts`'in durum nesnesine yazılır ve **kalıcı olarak**
`GET /api/chat/status`'un `stripped_env_vars` alanından ve `chat_status` SSE olayından görünür
kalır. stderr'e de insan-okunur bir satır yazılır — **değerler asla loglanmaz**, yalnızca adlar.

**N6 düzeltmesi — `apiKeyHelper` (settings alanı, env değil, allowlist'in KAPSAMADIĞI bir yol):**
`.claude/settings.json` (proje seviyesi) okunup `apiKeyHelper` anahtarı **tanımlıysa**, bu da
`strippedVars`'a benzer bir uyarı yüzeyine (`api_key_helper_configured: boolean`, `GET /api/chat/
status`'a eklenir) düşer — **kaldırılmaz** (bu bir dosya yolu, silinecek bir env değişkeni değil),
yalnızca **görünür** kılınır, kullanıcı bunun ücretli bir kimlik kaynağına işaret edip
etmediğini kendi bilir. Yalnızca **proje** seviyesi (`.claude/settings.json`) kontrol edilir;
kullanıcı (`~/.claude/settings.json`) ve local (`.claude/settings.local.json`) seviyeleri
**kapsam dışı** (bilinen sınırlama, v1'de kontrol edilmiyor — açıkça not ediliyor ki gelecekte biri
"neden yalnızca proje seviyesi" diye şaşırmasın).

**Sessiz kullanmama:** anahtar silindiği için `query()`'nin spawn ettiği alt süreç onu hiç görmez,
bir sonraki kimlik kaynağına düşer. **Reddetme yolu seçilmedi** (temizleme tercih edildi, K2'nin
izin verdiği iki seçenekten biri) — tasarım tercihi, CEO onayına tabi.

**Çitleme:** mutasyon 1/2/2b (§11.2, 2b yeni: allowlist istisnası kaldırılırsa `CLAUDE_CODE_
SUBAGENT_MODEL` gibi meşru bir değişken de silinir → KIRMIZI).

---

## 8. Hook kapıları

**Yükleme mekanizması:** `query()` seçeneklerinde `settingSources: ['project']` — SDK'nın kendi
tip dokümantasyonu bu turda ✓ DOĞRULANDI: *"Must include 'project' to load CLAUDE.md files"*
(`sdk.d.ts:2083`, §0.3). Bu depodaki altı güvenlik hook'u (`.claude/settings.json`, tam liste tur
1'de doğru listelenmiş, değişmedi): `session-start.cjs`, `gate-check.cjs`, `block-dangerous.cjs`,
`asset-guard.cjs`, `post-format.cjs`, `stop-check.cjs`. Ayrıca telemetri hook'u `send-event.cjs` —
K4'ü ihlal etmez (tek yönlü: dışarı telemetri gidiyor, içeri hiçbir olay-metni CEO'nun promptuna
girmiyor).

**"Yükleniyor" ≠ "engelliyor" (K7/M2 dersi, iki testle karşılanıyor):**
1. **Zorunlu, varsayılan `verify`'de koşan wiring testi:** `session.ts`'in `query()`'e geçirdiği
   `Options` nesnesinde `settingSources: ['project']` VE doğru `cwd` **gerçekten var** (mutasyon
   3a).
2. **Gerçek, iki yönlü kanıt:** `tests/integration/chat-hooks-live.test.ts` — varsayılan koşuda
   **atlanır**, yalnızca `MC_CHAT_LIVE_TESTS=1` ile elle çalıştırılır.

**Ö10 düzeltmesi — canlı testin üç eksiği kapatıldı:**
1. **Yanlış-negatif tuzağı devralınıyor:** test, `.claude/settings.json`'ın `permissions.deny`
   listesiyle (`Bash(rm -rf *)`, `Bash(git push --force*)`, `Bash(git reset --hard*)`) **örtüşmeyen**
   bir komut sınıfı kullanır — `block-dangerous.cjs`'in kendi mantığıyla yakaladığı ama `deny`
   listesinde OLMAYAN bir işaretleyici komut (SPIKE-002-asama0'ın M2'de kullandığı yöntemin
   birebir tekrarı — hangi komut olduğu `block-dangerous.cjs` okunarak kod turunda seçilecek, bu
   sözleşme yalnızca "deny listesiyle örtüşmemeli" kısıtını koyuyor).
2. **Üretim `cwd` çözümlemesi ölçülür:** test, hook'ların **repo kökü `cwd`'sinden** çalıştığını
   (sandbox'a kopyalanan yalnızca `block-dangerous.cjs`'in içeriği, `.claude/settings.json`'ın
   kendisi DEĞİL) doğrular — mutasyon 3a'nın tespit ettiği gibi `.claude/settings.json`'daki
   komutlar `node .claude/hooks/X.cjs` (göreli yol) olarak kayıtlı; test bu göreli yolun repo kökü
   `cwd`'siyle **gerçekten** çözüldüğünü (dosyanın var olduğunu) ayrıca assert eder.
3. **Çevrimdışı çit genişletildi:** mutasyon 3a artık yalnızca `settings.json`'ın varlığını değil,
   `.claude/settings.json`'daki **her** hook komutunun işaret ettiği dosyanın `cwd`'den
   çözülebildiğini de assert eder (`.claude/hooks/_selftest.cjs`'in zaten yaptığı kontrolün
   `session.ts`'in kullandığı `cwd` değeriyle **tekrarı**).

**Bilinen sınırlama (kayıt, düzeltme istenmiyor):** `ListAgents`'ın ilgisiz başka projelerin
oturumlarını listelediği (ADR-014 "Kabul edilen riskler" madde 2) — CEO kararı S2 (`docs/03-
ux.md:747-752`) gereği bu sınırlama **arayüze sızmaz** (§5 `chat_tool` kapalı allowlist'i zaten
bunu çitliyor, mutasyon 12).

---

## 8a. K3'ün fiilen delinmesi (B3/D6 — en kritik bulgu, bu turun asıl işi)

**Sorun (tur 1'in ölçtüğü, bu turda da geçerli, DÜZELTİLMEDİ, yalnızca ele alındı):**
`settingSources: ['project']` `.claude/settings.json`'ı yükler — o dosyada 40 satırlık bir
`permissions.allow` listesi var (`Bash(npm run *)`, `Write(src/**)`, `Bash(git commit *)` vb.,
✓ DOĞRULANDI bu turda tam dosya okundu). SDK'nın izin motoru bu listeyle eşleşen bir araç
çağrısını **`canUseTool`'a hiç sormadan** onaylıyor (SPIKE-002 §5.4 sınır 3, ✓ ölçüldü:
*"`canUseTool` otomatik onaylanan araçlar için hiç ateşlenmez"*). K3 ("otomatik onay YASAK") ve
ADR-005 ekinin *"üç yol dışına her çıkış kullanıcının o an verdiği karara bağlıdır"* cümlesi bu
yüzden **fiilen deliniyor**.

**D6 önceliği izlendi: (1) kurulu paketten yol arandı → (2) kısmen bulundu, tam doğrulanamadı →
(3) UYDURULMADI, aşağıda hem önerilen yapılandırma hem de doğrulanamayan kısmın açık kaydı var.**

### Bulunan mekanizma (SDK tip yüzeyinde ✓ VAR, davranışı [T] TAHMİN)

`Options.managedSettings` (`sdk.d.ts:2051-2074`, ✓ DOĞRULANDI VAR) — SDK'nın kendi
dokümantasyonuna göre bu, "politika katmanı"na (`user < project < local < flag < policy`
sıralamasında **en yüksek**, `sdk.d.ts:6391`) beslenir ve **yalnızca kısıtlayıcı anahtarları**
kabul eder: `ResolveSettingsOptions.managedSettings` dokümantasyonu (`sdk.d.ts:3038-3043`) bunu
açıkça sayıyor: *"filtered through a restrictive-key allowlist (`allowManaged*Only` locks,
`permissions.deny`/`ask`, sandbox restrictions)"*. Yani projenin `permissions.allow`'unu bu
kanaldan **silemeyiz** ama üzerine `permissions.ask` kuralı **ekleyebiliriz** — ve bu depoda zaten
kabul edilmiş bir ilke olan "denylist/kısıtlayıcı kural allow'dan önce gelir" deseniyle tutarlı
(`sdk.d.ts:6016`, MCP sunucu örneği: *"Denylist takes precedence - if a server is on both lists, it
is denied"*).

**Önerilen yapılandırma (session.ts'e eklenecek):**
```ts
managedSettings: {
  permissions: {
    ask: ['Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch'],
  },
}
```
Amaç: `.claude/settings.json`'ın 40 satırlık `permissions.allow`'unu **silmeden** (dosyayı
değiştirmiyoruz, panelin kendi dışındaki hiçbir Claude Code oturumunu etkilemiyoruz), yalnızca
**barındırılan CEO oturumu için** bunun üzerine "her zaman sor" kısıtını bindirmek.

### Neden bu [T] TAHMİN — ve nasıl kapatılacak

`session.test.ts`'in enjekte edilmiş sahte `query`'si SDK'nın **gerçek izin motorunu hiç
çalıştırmıyor** — yani bu spesifik mekanizmayı test EDEMEZ (tıpkı hook'lar gibi, `M2`'nin
gerekçesi burada da geçerli: "yükleniyor" ölçmek "engelliyor" ölçmek değildir). Bu yalnızca
**gerçek bir SDK oturumuyla** kanıtlanabilir.

**Kod turunun ZORUNLU ilk işi (diğer her şeyden önce, `chat-hooks-live.test.ts` kapsamı
genişletilerek veya yeni bir `chat-permission-live.test.ts` ile, `MC_CHAT_LIVE_TESTS` gate'i
altında):**
1. `managedSettings.permissions.ask` override'ı **VARKEN**, `.claude/settings.json`'ın
   `permissions.allow`'unda zaten bulunan bir komut (ör. `Bash(npm run test:chat-live)`) denenir —
   beklenen: `chat_permission_request` yayınlanır (host'a soruldu, otomatik onaylanmadı).
2. Override **YOKKEN** (aynı komut, `managedSettings` verilmeden), aynı komut denenir — beklenen
   (bugünkü ölçülen davranış, SPIKE-002 M2/M3'ün de dolaylı gösterdiği): komut hiçbir
   `chat_permission_request` olmadan çalışır.
3. **Eğer adım 1'de `chat_permission_request` YAYINLANMAZSA** (yani `ask` override'ı da allow'u
   ezemiyorsa): kod turu **DURUR**, bu bloklayıcı **CEO/architect'e eskale edilir** — aşağıdaki
   "Yol B" ve "hiçbiri işe yaramazsa" seçenekleri onlara sunulur. Developer kendi başına ikinci bir
   varsayımla ilerlemez (bu belgenin kendi kuralı, `CLAUDE.md`).

### Alternatif — Yol B (daha güvenli, çok daha maliyetli, bu sözleşmenin kapsamına ALINMADI)

`settingSources: []` (hiç proje ayarı yüklenmez — `permissions.allow` **garanti** yüklenmez, bu
davranış SDK dokümantasyonunda "SDK isolation mode" olarak net yazılı, ✓ DOĞRULANDI) +
**programatik** `Options.hooks` (`sdk.d.ts:1582-1595`, ✓ DOĞRULANDI VAR — JS callback, dosya-
tabanlı DEĞİL: `hooks: { PreToolUse: [{ hooks: [async (input) => ...] }] }`) ile altı `.cjs`
dosyasını `spawn` ederek JS callback içinden çağırıp çıkış koduna göre `{continue: boolean}`
üretmek + CLAUDE.md'yi `systemPrompt` seçeneğine (`sdk.d.ts:2237+`, ✓ DOĞRULANDI VAR) elle
enjekte etmek. Bu, "izin motoru allow'u hiç görmüyor" belirsizliğini **tamamen ortadan kaldırır**
(precedence tartışması yok, çünkü allow hiç yüklenmiyor) ama:
- Altı hook dosyasının matcher'larını (`Edit|Write`, `Bash`, `mcp__higgsfield__.*`) ve giriş/çıkış
  biçimini JS callback köprüsüne **yeniden** yazmak gerekir — bu, `src/features/chat/server/`
  içine **yeni bir dosya** (`hook-bridge.ts`) ve **yeni bir dosya sahipliği genişlemesi** demektir.
  `.claude/hooks/`'a **dokunulmuyor**, sarmalanıyor.
  `"agent": "ceo"` persona alanının (§0.2 madde 3b) `settingSources: []` ile **kesin kaybolacağı**
  bilinen bir bedel — persona ayrıca `systemPrompt`'a elle yazılmalı, ki bu da CLAUDE.md'nin
  **tam olarak** CLI'nin okuduğu formatta (agent frontmatter dahil) yeniden üretilmesini
  gerektirir — kolay taklit edilemeyen bir yüzey.
- Bu, sözleşmenin dosya/kapsam sınırını **önemli ölçüde** genişletir ve bu turda tek başına karar
  verilecek bir şey değil.

**Bu yüzden Yol B bu sözleşmenin planına ALINMADI** — yalnızca Yol A'nın canlı testi
başarısız olursa CEO/architect'in önüne konacak somut bir alternatif olarak kayıtlı.

### D6 sonucu — özet

**Yol kısmen bulundu (Yol A: `managedSettings.permissions.ask`), tam doğrulanamadı.** Kod turu bu
yapılandırmayla başlar AMA yukarıdaki 3 adımlık canlı test **her şeyden önce** çalıştırılıp
sonuç raporlanmadan geri kalan implementasyona devam edilmez. Test başarısız olursa **DUR, CEO'ya
eskale et** — Yol B'nin maliyeti ve "bilinçli risk kabulü" (K3'ün UX §7.3 metninin gözden
geçirilmesi) seçenekleri CEO'nun kararı, developer'ın değil.

---

## 9. Hata sınırı

(Değişmedi — tur 1'in bu bölümü QA tarafından güçlü bulundu, korunuyor.)

**`CLAUDE.md`'nin üç kez tekrarlayan dersi burada dördüncü kez tekrarlanmayacak.** Kural:
dağıtıcının `withDispatchErrorBoundary`'si (`index.ts:147`) yalnızca handler'ın **senkron çağrı
yığınında** fırlayan hataları yakalar (✓ DOĞRULANDI). Bu feature'ın **tüm** yeni handler'ları
`ingest.ts`'in async-IIFE deseniyle **birebir aynı** şekilde yazılır: her handler kendi hata
sınırını taşır, dağıtıcının senkron sınırına asla güvenmez.

**Uzun ömürlü asenkron döngü ayrı bir risk sınıfıdır** — `session.ts`'in `for await` mesaj
tüketicisi **kendi** `try/catch`'i içine alınır; döngü içinde fırlayan HERHANGİ bir hata
yakalanır, oturum durumu `crashed` yapılır, `chat_error`/`chat_status` yayınlanır, döngü **temiz**
sonlanır.

**Ö9 düzeltmesi — alt süreç stdio `'error'` olayları da kapsanır (tur 1'de eksikti):** SDK alt
sürecinin stdio akışlarının **EventEmitter `'error'` olayları** (EPIPE, alt süreç ani ölümü)
`try/catch`'e düşmez — dinleyicisi yoksa Node bunu `uncaughtException`'a çevirir ve
`src/server/index.ts:26-32`'de yalnızca **`unhandledRejection`** ağı var, `uncaughtException` ağı
**YOK** (✓ DOĞRULANDI, tam dosya bu turda tekrar okundu). `session.ts` bu yüzden SDK'nın döndürdüğü
`Query`/alt süreç referansına (kod turunda kesinleşecek gerçek API'ye göre) **açık bir** `'error'`
dinleyicisi ekler — bu dinleyici hataları `crashed` durumuna çevirir, asla `uncaughtException`'a
düşürmez. Mutasyon 7b (§11.2, yeni): bu dinleyici kaldırılırsa, sahte bir stream `'error'`
olayı `/api/health`'i düşürmeli (KIRMIZI: düşmezse test zaten geçemez çünkü süreç kapanır — bu
mutasyon **süreç ölümünü** kanıtlayan bir fault-injection testidir, `session.test.ts` içinde ayrı
bir alt süreç/worker'da çalıştırılması gerekebilir; kod turunda kesinleşecek).

**Yarı-başarı dürüstlüğü:** `POST /api/chat/message` mesajı kuyruğa **verildiği anda** yanıt
döner, asistanın cevabını **beklemeden**. Cevap SSE üzerinden ayrı bir kanaldan gelir; SSE
tarafında hata olursa (`chat_error`) bu da dürüst, ayrı bir sinyaldir.

---

## 10. Metin/UI sözleşmesi — `docs/03-ux.md §7`'ye atıf (K8) — D1/D5/B6 ile güncellendi

Bu sözleşme kullanıcıya gösterilecek Türkçe metinleri, renkleri, yerleşimi **kendisi icat etmez**
— ama artık **`docs/03-ux.md §7` yazılı ve onaylı** olduğu için, aşağıdaki tablo "bağlayıcı
değildir" DEĞİL, **UX §7'nin veri karşılığıdır** ve UX'in metinleri/sınıfları **birebir** kullanılır
(§2.2).

| Durum anahtarı | Ne zaman | UX §7'nin karşılığı |
|---|---|---|
| `chat_disabled` | `MC_CHAT_ENABLED=0` | Sohbet sekmesi hiç render edilmez (§2.4, AC10) |
| `stripped_env_vars: string[]` | Bariyer bir/daha çok değişken temizledi | Kalıcı uyarı şeridi (`docs/03-ux.md` madde 6, `sticky top-0 bg-amber-950`) |
| `session_active: false, last_error` | Bootstrap/oturum çöktü | Sistem mesajı satırı + "Yeniden bağlan" (`docs/03-ux.md` madde 5) |
| `busy: true` | Bir tur işleniyor | Kompozer **kilitlenmez** (S1 gerekçesi, `docs/03-ux.md:327`) |
| `permission_request` bekleniyor | `canUseTool`/allow'a rağmen ask tetiklendi (§8a) | İzin kartı, amber kenarlık (`docs/03-ux.md` madde 3) — **otomatik onay yok** |
| `kind:'question'` | `AskUserQuestion` | Soru kartı, 2-4 seçenek (`docs/03-ux.md` madde 4) |
| `status:'interrupted'` | Sunucu çöktükten sonra yeniden yüklendi | "Yarıda kesildi" işareti |
| `has_more: true` | Daha eski mesaj var | "▲ Daha eski mesajları yükle" (madde 7) |

---

## 11. Test planı ve mutasyon listesi

### 11.1 Kabul kriteri → test eşlemesi

| AC (feature notu) | Test(ler) |
|---|---|
| AC1 | `chat-api.test.ts` (POST 202 hemen döner, SSE'den `chat_message` delta'ları) · `session.test.ts` |
| AC2 | `env-barrier.test.ts` · `session.test.ts` · `chat-hooks-live.test.ts`/canlı izin testi (§8a) |
| AC3 | Mutasyon 1, 2, 2b |
| AC4 | Mutasyon 3 (wiring) + `chat-hooks-live.test.ts` (Ö10 genişlemesiyle) |
| AC5 | `session.test.ts` (sahte `query` art arda `chat_tool`(started) → ikinci mesaj işlenir → `chat_tool`(finished)) |
| AC6 | Mutasyon 6 |
| AC7 | `history-log.test.ts` · `chat-api.test.ts` (sayfalama dahil, Ö4) |
| AC8 | Mutasyon 7, 7b + `session.test.ts` (çöküş sonrası `/api/health` hâlâ 200) |
| AC9 | `no-context-injection.test.ts`, mutasyon 8, 8b |
| AC10 | `chat-api.test.ts` (`MC_CHAT_ENABLED=0`) + `App.test.tsx` (kapalıyken `role="tab"`=2) + mutasyon 9 |
| K3 (izin deliği) | §8a canlı test (kod turunun ilk işi) |

### 11.2 Mutasyon listesi — D9: her madde "hangi dosya/test KIRMIZI" + "türetilmiş mi/elle mi"

1. **Bariyer temizliği kaldırılır** (`delete`ler yorumlanır) → `env-barrier.test.ts`/
   `session.test.ts` KIRMIZI. **Elle yazılmış beklenti** (env-barrier'ın kendi sabit önek listesi
   test tarafından da elle yazılıyor — kaynaktan TÜRETİLMİYOR, çünkü önek listesi zaten burada,
   sözleşmede, tek yerde tanımlı; test bunu kopyalar. Kabul edilebilir çünkü tek kaynak bu
   sözleşme, kodun kendisi değil).
2. **Görünür uyarı bayrağı kaldırılır** (`stripped_env_vars`'ın status'a yansıması silinir) →
   `chat-api.test.ts` KIRMIZI. Elle yazılmış beklenti (belirli bir env adı sabit yazılır, sonra
   status'ta göründüğü assert edilir).
2b. **Allowlist istisnası (`ALLOWED_ENV_EXCEPTIONS`) kaldırılır** → `env-barrier.test.ts` KIRMIZI:
   `CLAUDE_CODE_SUBAGENT_MODEL` gibi meşru bir değişken de silinir. **Kaynaktan türetilmiş**:
   test, `.claude/settings.json`'ın gerçek `env` bloğunu **okuyup** (dosyadan, literal
   kopyalamadan) o anahtarların dokunulmadığını assert eder — böylece settings.json'a dördüncü bir
   `CLAUDE_CODE_*` değişkeni eklenirse test onu da otomatik kapsar.
3. **Hook yükleme seçenekleri bozulur** (`settingSources: []` veya yanlış `cwd`) →
   `session.test.ts` KIRMIZI. Elle yazılmış beklenti (sahte `query`'e geçirilen `Options` sözleşme
   metnindeki literal değerlerle karşılaştırılır — sözleşme tek kaynak).
4. **`permissionMode` `'bypassPermissions'`e çevrilir** → `permission-mode-fence.test.ts` KIRMIZI
   (statik grep guard, kaynaktan türetilmiş: gerçek dosya içeriği taranır).
5. **`canUseTool` bekleme olmadan otomatik `{behavior:'allow'}` döner** → `chat-api.test.ts`
   KIRMIZI (sahte `query`, `POST /api/chat/permission` hiç çağrılmadan "onaylandı" görünürse
   yakalanır). **Not:** bu mutasyon yalnızca sunucunun KENDİ davranışını ölçer, §8a'nın SDK
   izin-motoru sorununu ÖLÇMEZ (o ayrı, canlı test gerektirir — D9'un totoloji uyarısı burada
   açıkça yazılıyor ki ikisi karıştırılmasın).
6. **Chat uçlarına `x-mc-write` istisnası eklenir** → `chat-api.test.ts` KIRMIZI (başlıksız POST
   403 yerine 202/200 döner). Kaynaktan türetilmiş: dağıtıcının gerçek kontrolü çağrılır, test
   yalnızca başlığı eksik bırakır.
7. **Bir handler'ın kendi `try/catch`'i kaldırılır** → `chat-api.test.ts` KIRMIZI (yanıt 2 sn içinde
   gelmez). Elle yazılmış zaman aşımı eşiği (2sn, sözleşmede sabit).
7b. **Alt süreç stdio `'error'` dinleyicisi kaldırılır** → fault-injection testi KIRMIZI (§9,
   yöntem kod turunda kesinleşir — [T] işaretli, D9 gereği burada açıkça not ediliyor).
8. **`session.ts`'e `jsonl-store`'dan okuma import'u eklenir** → `no-context-injection.test.ts`
   KIRMIZI (statik guard, kaynaktan türetilmiş: gerçek import grafiği taranır).
8b. **`index.ts`'teki `createChatSession(...)` çağrısına `store`/`projectsService` eklenir** →
   `no-context-injection.test.ts` KIRMIZI (Ö7 — çağrı-yeri assert'i, kaynaktan türetilmiş: gerçek
   `index.ts` dosyası taranır).
9. **`isChatEnabled` kontrolü kaldırılır** → `chat-api.test.ts` KIRMIZI (kapalıyken 503 yerine
   500/gerçek işlenme).
10. **`markDanglingAsInterrupted` çağrısı kaldırılır** → `history-log.test.ts`/`chat-api.test.ts`
    KIRMIZI (yeniden başlatma sonrası eski `streaming` girdi `interrupted`e dönmez).
11. **`STORE_FILES`'a eklenen tam-çağrı metninin dışına çıkan yeni bir `fs` yazma çağrısı
    `history-log.ts`'e eklenir** (ör. debug amaçlı ek bir `fs.writeFileSync`) →
    `no-write-gate-bypass.test.ts` KIRMIZI (B5, kaynaktan türetilmiş: gerçek dosya taranır, yeni
    çağrı `STORE_FILES` listesinde olmadığı için yakalanır).
12. **`chat_tool` yayınına ham `tool_result`/`content` alanı eklenir** → `chat-api.test.ts`
    KIRMIZI (B7/S2 — yayınlanan yükün alan kümesi **kapalı** allowlist ile assert edilir: `{
    tool_use_id, tool_name, description, status, elapsed_ms, parent_tool_use_id }` dışında hiçbir
    alan kabul edilmez, "şu alan yok" değil "yalnızca şu alanlar var" biçiminde).

**≥6 zorunlu şartı 13 mutasyonla fazlasıyla karşılanıyor; her biri gerçek bir koruma noktası,
hiçbiri kozmetik değil (D9 gereği yukarıda hangisinin kaynaktan türetildiği, hangisinin sözleşme
metnine dayandığı açıkça işaretlendi).**

### 11.3 Canlı (gerçek SDK) test kadansı

`chat-hooks-live.test.ts` + §8a'nın izin-motoru canlı testi **her `npm run verify`'de değil**
(D4). Kadans: (a) hook zinciri veya `managedSettings` yapılandırması değiştiğinde elle bir kez,
(b) her QA turunda en az bir kez (ADR-014'ün "iki yönlü kanıt" şartı için), (c) §8a'nın izin-motoru
testi **kod turunun ilk işi olarak zaten bir kez** çalıştırılmış olacak.

---

## 12. Kapsam dışı listesi (konsolide)

- **K4 — olay akışı köprüsü yok.**
- **Çoklu oturum / thread görünümü** — F-010.
- **Kapılar paneli** (F-008), **Token kullanım ekranı** (F-011).
- **`ADR-005`'e ek yazmak — GEREKSİZ, zaten yazılı** (D3). Bu feature ekin (1) numaralı kategorisine
  iki dosya ekliyor (§2.1/§2.4 not), (2) numaralı kategoriye (barındırılan CEO'nun kendi yazmaları)
  hiçbir statik test eklemiyor çünkü ek bunun **hook + kullanıcı onayı** ile tutulduğunu, dosya
  sistemi manifestiyle DEĞİL, zaten karara bağlamış (§8a bu tutmanın kendisinin B3/D6 ile ilgili
  zayıf noktasını ele alıyor).
- **`bypassPermissions`/`acceptEdits` dışındaki `permissionMode` ince ayarları.**
- **Görsel tasarım, renk/spacing** — artık `docs/03-ux.md §7`'nin **yazılı** hâli var, ama bu
  sözleşme UX'in kendisini değiştirmiyor, yalnızca uyguluyor (§2.2/§10).
- **Retention/boyut sınırlama** — v1'de yok, N4.
- **Otomatik yeniden başlatma / crash-loop koruması** — v1'de yok.

---

## 13. Açık sorular (CEO karar verecek — uydurulmadı)

Tur 1'in beş sorusundan **dördü bu turda kapandı** (D1→soru 1, D2→soru 2, D3→soru 3, D5→soru 5).
Kalan ve yeni açık sorular:

1. **§8a'nın canlı testi başarısız olursa ne olur?** Bu sözleşme Yol A'yı (managedSettings ask
   override) plana aldı ve başarısızlık durumunda "DUR, eskale et" dedi — ama CEO'nun bunu ŞİMDİDEN
   bir tercihle (ör. "Yol B'ye otomatik geç" ya da "K3'ü gözden geçir, UX §7.3'ü yumuşat") önceden
   cevaplamak isteyip istemediği soruluyor. Cevaplanmazsa kod turu, canlı test başarısız olursa
   gerçekten **durup** CEO'ya döner (varsayım yapılmaz).
2. **`maxBudgetUsd` için somut bir sayı** (N3, tur 1'de hiç yoktu) — bu sözleşme geçici olarak
   **$20/oturum** öneriyor (bilinçli bir tahmin, [T] işaretli) — aşılırsa oturum `crashed` +
   `error_max_budget_usd`, kullanıcı `restart` ile yeni bütçeyle devam eder. CEO bu sayıyı
   değiştirebilir/onaylayabilir; onaylanmazsa kod turu bu değerle başlar ve CEO'nun ilk geri
   bildiriminde değişir (engelleyici değil, Karpathy §2 gereği "makul bir varsayılan + kolay
   değiştirilebilir sabit").
3. **`"agent": "ceo"` persona alanının gerçekten yüklendiği** (§0.2 madde 3b) kod turunun ilk
   işlerinden biri olarak **elle** doğrulanacak — bu bir CEO kararı değil ama sonucu olumsuzsa
   (persona yüklenmiyor) bu yeni bir bloklayıcı doğurur ve CEO'ya o noktada haber verilir.

Bu üç madde **engelleyici değildir** — kod turu bu sözleşmedeki en muhafazakâr/açık varsayımlarla
(§8a'nın "dur, eskale et" kuralı, $20 bütçe, elle persona kontrolü) başlar.
