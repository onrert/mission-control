---
feature: F-012
title: Kod turu A (sunucu tarafı) — zorunlu ilk iş notları
author: developer
date: 2026-09-06
---

# F-012 kod turu A — zorunlu ilk iş: K3'ün fiilen kapandığının kanıtı

Sözleşme (`docs/qa/F-012-contract.md` §8a) kod turunun **her şeyden önce** yapılmasını istediği
şey: `managedSettings.permissions.allowManagedPermissionRulesOnly` önerisinin gerçek bir SDK
oturumunda **iki yönlü** kanıtlanması. Bu belge o kanıtı ve kod sırasında ortaya çıkan **iki
düzeltmeyi** kaydeder.

## Sonuç — **Yol A çalışıyor** (Yol B'ye geçilmedi)

Sözleşmenin D10 kaçış yolu (Yol B: `settingSources: []` + programatik hook köprüsü) **tetiklenmedi**
— aşağıdaki canlı test override AÇIKKEN `canUseTool`'un gerçekten ateşlendiğini, KAPALIYKEN
ateşlenmediğini gösterdi.

## Düzeltme 1 (kritik) — `allowManagedPermissionRulesOnly` **üst seviye** bir `Settings` alanı,
`permissions` içinde DEĞİL

Sözleşme §8a'nın önerdiği yapılandırma:
```ts
managedSettings: { permissions: { allowManagedPermissionRulesOnly: true } }  // YANLIŞ
```
Kurulu paketin `sdk.d.ts`'i satır satır okunarak (bu turda, gerçek kurulu sürüm 0.3.261) doğrulandı:
`allowManagedPermissionRulesOnly` (`sdk.d.ts:6322`) `permissions?: {...}` bloğunun (`sdk.d.ts:5865-5895`,
yalnızca `allow`/`deny`/`ask`/`defaultMode`/`disableBypassPermissionsMode`/
`blockReadsOutsideWorkingDirectories`/`additionalDirectories` alanlarını tanımlıyor) **dışında**,
büyük `Settings` tipinin **üst seviyesinde** tanımlı bir alan (`hooks`, `model`, `agent` gibi kardeş
alanlar aynı seviyede). Doğru biçim:
```ts
managedSettings: { allowManagedPermissionRulesOnly: true }  // DOĞRU
```
**Kanıt (çevrimdışı, kota harcamadan, `resolveSettings()` ile):**
- Yanlış (iç içe) biçimle: `resolveSettings(...).sources` içinde `managed` kaynaklı **hiçbir**
  girdi belirmiyor — parametre sessizce yok sayılıyor.
- Doğru (üst seviye) biçimle: `sources` içinde `{"source":"managed","policyOrigin":"parent",
  "allowManagedPermissionRulesOnly":true}` görünüyor, `effective.allowManagedPermissionRulesOnly
  === true`.

Bu, sözleşmenin kod turuna bıraktığı [T] TAHMİN'in ("SDK izin motorunun buna fiilen uyup uymadığı")
**önündeki** bir hata idi — yapılandırma sözleşmedeki hâliyle yazılsaydı **hiçbir etkisi olmazdı**
(sessiz başarısızlık, bu deponun en pahalı hata sınıfı). `session.ts` **düzeltilmiş** biçimi kullanır.

## Düzeltme 2 — test komutu seçimi: `git status` gibi salt-okunur komutlar `canUseTool`'u hiç
tetiklemiyor (allow listesinden veya override'dan BAĞIMSIZ olarak)

İlk canlı denemeler `git status --short` ile yapıldı ve **her iki** durumda da (override açık/kapalı,
hatta `settingSources: []` ile HİÇBİR ayar yokken) `canUseTool` **hiç ateşlenmedi** — sonuç ikisinde
de aynıydı, bu yüzden hiçbir şey kanıtlamıyordu (CLAUDE.md dersi: "hiçbir şey ölçmeyen yeşil test").
`permissionMode: 'default'`'in kendi dahili "zararsız/salt-okunur komut" sınıflandırıcısı bu tür
komutları allow listesinden/override'dan bağımsız olarak otomatik geçiriyor — SDK dokümantasyonunun
"auto-mode classifier" referansı (`sdk.d.ts` `PermissionDenialEvent` yorumu) bunu doğruluyor.
**Düzeltme:** test komutu `.claude/settings.json`'ın **gerçekten** bir allow kuralına ihtiyaç duyan
bir mutasyon komutuna değiştirildi (`node -e "...writeFileSync(...)"`, `Bash(node *)` kuralıyla
eşleşiyor) — bu komut olmadan (allow kuralı yokken) normalde sorulması gerekir, allow kuralı VARKEN
otomatik geçer. Bu ayrım gözlemlenebilir bir fark ürettiği için gerçekten ölçüyor.

**Ayrıca:** ilk denemeler tek seferlik `prompt: string` biçimini kullandı; `session.ts`'in
gerçek tasarımı (streaming-input kuyruğu, sözleşme §3/§8a) ile tutarlı olması için canlı test
**streaming-input** (`prompt: AsyncIterable<SDKUserMessage>`) biçimine geçirildi — iki biçim de
`git status` için aynı (yanlış-negatif) sonucu verdiği için bu, sonucu etkilemedi, ama üretim
davranışıyla birebir örtüşmesi için düzeltme kalıcı yapıldı.

## Kanıt — gerçek SDK oturumu, iki yönlü (scratchpad'de çalıştırıldı, repo'ya commit edilmedi)

Ortam: bu makinede `ANTHROPIC_API_KEY` **tanımlı değil** (mevcut Claude Code oturum kimlik
bilgileriyle çalışıyor — ADR-014 sonuç 1'in varsaydığı tam senaryo). Model: `claude-haiku-4-5`
(en ucuz), `cwd`: repo kökü, `settingSources: ['project']`, komut: `node -e "require('fs').
writeFileSync('.probe/marker.txt','ok')"` (`.claude/settings.json`'ın `Bash(node *)` allow
kuralıyla eşleşiyor).

| Test | `managedSettings` | `canUseTool` ateşlendi mi | Maliyet |
|---|---|---|---|
| E | `{ allowManagedPermissionRulesOnly: true }` (düzeltilmiş, üst seviye) | **EVET** (1 çağrı, `toolName: 'Bash'`, gerçek komut/`description` görüldü) | $0.0272 |
| F | (yok) | **HAYIR** (0 çağrı — bugünkü davranış, allow kuralıyla otomatik geçti) | $0.0250 |

İki yönlü kanıt tamam: override **açıkken** allow-listeli komut yine de sorulmaya düşüyor, override
**kapalıyken** sessizce geçiyor. **D10'un Yol B kaçışı tetiklenmedi.**

## §13 açık soru kapandı — `"agent": "ceo"` persona gerçekten yükleniyor

Ayrı bir canlı çağrıda (`agent: 'ceo'` + `settingSources: ['project']`, tek seferlik prompt,
"hangi personasın + CLAUDE.md'den bir satır alıntıla") model **"Agent: CEO (ana orchestrator)"**
dedi ve CLAUDE.md'nin "Öğrenilen kurallar" bölümünden **gerçek, birebir** bir satırı alıntıladı
("Bu ortamda ToolSearch kapalı → SendMessage yok."). Uydurma değil — bu satır gerçekten
`CLAUDE.md`'de var. **✓ DOĞRULANDI**: `settingSources: ['project']` hem CLAUDE.md'yi hem
`"agent"` persona alanını yüklüyor (ek olarak `options.agent: 'ceo'` da açıkça verildi — ikisinin
üst üste binmesi ayrıştırılmadı, ama sonuç `session.ts`'in her ikisini de sözleşmedeki gibi
vermesini haklı çıkarıyor: hem `settingSources: ['project']` hem `agent: 'ceo'`).

## Doğrulanan/doğrulanamayan [T]'ler (görev talimatının istediği liste)

| [T] | Sonuç |
|---|---|
| `.claude/settings.json`'ın `env` bloğu spawn'ı eziyor mu | **Ölçülemedi** — canlı testler `env` blok değişkenlerinin (`CLAUDE_CODE_*`) alt süreçte gerçekten göründüğünü doğrudan gözlemlemedi (canlı testler bunu ölçecek bir prompt içermiyordu, kapsam dışı bırakıldı — mekanizma zaten Node çekirdek davranışıyla ✓ DOĞRULANDI, `env-barrier.ts`'in üç istisnası savunma amaçlı kalıyor). |
| Windows'ta ebeveyn ölünce `claude.exe` ne oluyor | **Ölçülemedi** (bu turun kapsamında ayrı bir süreç öldürme deneyi yapılmadı — `Query.close()`'un varlığı `sdk.d.ts:2950` ile ✓ DOĞRULANDI, "Close the query and terminate the underlying process... cleaning up... the CLI subprocess" — `session.ts` `stopAll()` bunu çağırır, ama gerçek bir ebeveyn-öldürme senaryosu simüle edilmedi). |
| `"agent":"ceo"` personası yükleniyor mu | **✓ DOĞRULANDI** (yukarıda). |
| admin-tier `managed-settings.json` var mı | **Ölçülemedi/YOK göründü** — `resolveSettings()` çıktısında `managed` kaynaklı hiçbir girdi (bizim `managedSettings` parametremiz dışında) belirmedi; bu makinede bir admin/MDM katmanı olduğuna dair kanıt yok, ama resmi bir "yok" kanıtı da değil (yalnızca bu turda görülmedi). |

## `Query.close()` — Ö8'in aradığı gerçek API bulundu

`sdk.d.ts:2942-2950`: *"Close the query and terminate the underlying process. This forcefully ends
the query, cleaning up all resources including pending requests, MCP transports, and the CLI
subprocess."* — senkron, `Promise` döndürmüyor. `session.ts` `stopAll()` bunu kullanır (Ö8'in
"hangi API olduğu kod turunda kesinleşecek" notu burada kapandı).

## Harcanan kota

Yaklaşık **7 gerçek SDK oturumu** açıldı (2 hatalı tasarımlı deneme seti + 1 yanlış-negatif kontrol
+ 2 doğru E/F testi + 1 persona testi + 1 tekrar) toplam ölçülen `total_cost_usd` toplamı
**≈ $0,50** (haiku modeliyle, kısa turlar, `maxTurns` ≤ 3). Scratchpad betikleri (`.probe/*.mjs`)
tur sonunda silindi, repoya commit edilmedi.

## Mutasyon kanıtı — sözleşme §11.2'nin 17 maddesi (1,2,2b,3,4,5,6,7,8,8b,9,10,11,12,13,14 +
13'ün nested-permissions varyantı), hepsi uygulandı → KIRMIZI gözlendi → geri alındı

Uygulama sırası: her madde için ilgili dosyada tek satır/blok değiştirildi, sözleşmenin
belirttiği test dosyası tek başına çalıştırıldı, KIRMIZI ekran görüntüsü (test çıktısı) burada
özetlendi, sonra Edit ile birebir geri alındı. Tur sonunda `git status`/`git diff` boş —
mutasyon izi yok (kontrol edildi).

| # | Mutasyon | Test | Sonuç |
|---|---|---|---|
| 1 | `env-barrier.ts` `stripApiKey`'in `delete` döngüsü yorumlandı | `env-barrier.test.ts` | KIRMIZI: `ANTHROPIC_API_KEY` silinmedi |
| 2 | `session.ts` `getStatus()`'ta `stripped_env_vars`/`api_key_barrier_tripped` sabitlendi | `chat-api.test.ts` (mutasyon 2) | KIRMIZI: `api_key_barrier_tripped` beklenen `true` yerine `false` |
| 2b | `ALLOWED_ENV_EXCEPTIONS` kontrolü `if (false)` yapıldı | `env-barrier.test.ts` | KIRMIZI (2 test): `CLAUDE_CODE_SUBAGENT_MODEL` de silindi |
| 3 | `buildOptions()` `settingSources: []` yapıldı | `session.test.ts` | KIRMIZI: `opts.settingSources` `['project']` değil `[]` |
| 4 | `permissionMode: 'bypassPermissions'` yapıldı | `permission-mode-fence.test.ts` + `session.test.ts` | KIRMIZI (2 dosya, 3 test) |
| 5 | `canUseTool` beklemeden `Promise.resolve({behavior:'allow',...})` döndü | `chat-api.test.ts` (mutasyon 5) | KIRMIZI: sonuç beklenenden önce geldi |
| 6 | Dağıtıcıya `!pathname.startsWith('/api/chat/')` istisnası eklendi | `chat-api.test.ts` (AC1/mutasyon 6) | KIRMIZI (2 test): header'sız istek 403 yerine 202/409 döndü |
| 7 | `handleChatMessage`'ın dış `try/catch`'i kaldırıldı | `chat-api.test.ts` (mutasyon 7, 65536+ bayt gövde) | KIRMIZI: istemci 5 sn zaman aşımına kadar yanıt almadı (bu turda testin kendisi de güçlendirildi, aşağıya bakınız) |
| 8 | `session.ts`'e `'events/server/query'` içeren bir yorum satırı eklendi | `no-context-injection.test.ts` | KIRMIZI |
| 8b | `index.ts`'teki `createChatSession(...)` çağrısına `store` eklendi | `no-context-injection.test.ts` | KIRMIZI |
| 9 | `sendMessage()`'daki `if (!chatEnabled)` kontrolü yorumlandı | `session.test.ts` + `chat-api.test.ts` (mutasyon 9/AC10) | KIRMIZI (2 dosya; HTTP testi de bu turda `error.code` assert'iyle güçlendirildi, aşağıya bakınız) |
| 10 | `historyLog.init()`'teki `markDanglingAsInterrupted()` çağrısı yorumlandı | `history-log.test.ts` | KIRMIZI: restart sonrası `streaming` satır düzeltilmedi |
| 11 | `append()`'e `STORE_FILES` listesinde olmayan bir `fs.writeFileSync` eklendi | `no-write-gate-bypass.test.ts` | KIRMIZI |
| 12 | `chat_tool` yayınına `raw_input: block.input` eklendi | `chat-api.test.ts` (mutasyon 12) | KIRMIZI |
| 13 | `managedSettings` `{ allowManagedPermissionRulesOnly: false }` yapıldı | `session.test.ts` (K3 çevrimdışı çit) | KIRMIZI |
| 13b (ek) | `managedSettings` **round A'nın gerçek bulduğu hata biçimine** (`{ permissions: { allowManagedPermissionRulesOnly: true } }`) geri döndürüldü | `session.test.ts` (K3 çevrimdışı çit) | KIRMIZI — bu turun offline çiti, önceki turda canlı oturumla bulunan **gerçek** regresyon sınıfını da yakalıyor |
| 14 | `error_max_budget_usd` `case`'i `if (false && ...)` ile devre dışı bırakıldı | `session.test.ts` (D11 bütçe tavanı) | KIRMIZI |

**Bu turda mutasyon koşarken bulunan 2 test zayıflığı, kalıcı olarak düzeltildi (kod DEĞİL, test
güçlendirildi):**
- **Mutasyon 7 totolojisi:** İlk yazılan test yalnızca bozuk JSON gövdesi gönderiyordu — bu,
  `JSON.parse`'ın kendi İÇ `try/catch`'i tarafından yakalanıyor, dış `try/catch` kaldırılsa bile
  yeşil kalıyordu. Düzeltme: `readBody()`'nin dış `try` dışında reddettiği bir senaryo (65536
  baytı aşan gövde) eklendi — bu, dış `try/catch` kaldırıldığında gerçekten asılı kalıp 5 sn
  zaman aşımına düşüyor.
- **Mutasyon 9 totolojisi:** `session_not_ready` ve `chat_disabled` ikisi de HTTP 503 döner;
  yalnızca durum kodunu kontrol eden test, `isChatEnabled` kaldırılsa bile yeşil kalıyordu.
  Düzeltme: dört uç için de gövdedeki `error.code === 'chat_disabled'` açıkça assert edildi.

**7b (alt süreç stdio `'error'` dinleyicisi) — CEO kararı gerektirmeden kapatıldı:** SDK,
alt süreç yaşam döngüsünü bize doğrudan expose etmiyor (`Query` yalnızca async iterable +
`interrupt()`/`close()`). Alt sürecin beklenmeyen şekilde ölmesi/çökmesi SDK'nın kendi async
iterable'ının `throw` etmesi veya sessizce bitmesi olarak yüzeye çıkar — bu zaten `consume()`'un
`try/catch`'i tarafından yakalanıyor ve `session.test.ts`'in "hata sınırı (§9)" bloğunda
(`handle.throwError`) test ediliyor. Ayrı bir stdio-seviyesi dinleyici eklemek SDK'nın verdiği
API'nin dışına çıkmak olurdu (Karpathy §2, gereksiz soyutlama) — bu yüzden §9'un mevcut hata
sınırı 7b'nin karşılığı sayıldı, ayrı bir mekanizma YAZILMADI.

## Temizlik notu

Bu turun ortasında bu depoda (benim başlatmadığım) yetim bir `npm start`/`tsx watch src/server/
index.ts` süreç zinciri iki kez gözlemlendi (PID'ler değişerek). Kendi başlattığım süreçler
(`.probe/live-test*.mjs`) tur sonunda temiz çıktı (`process.exit(0)` + `Query.close()`) ve
`tasklist` boş çıktı. Yabancı `npm start` zincirine **dokunulmadı** (sahipliği belirsiz, bu
oturumun başlattığı bir şey değil — muhtemelen bu makinede paralel çalışan başka bir agent
oturumu); ilk gözlemde zaten çalışıyordu, ikinci gözlemde (muhtemelen bir başka oturum tarafından)
yeniden başlatılmış görünüyordu.
