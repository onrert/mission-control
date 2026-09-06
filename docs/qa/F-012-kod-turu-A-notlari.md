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

## Temizlik notu

Bu turun ortasında bu depoda (benim başlatmadığım) yetim bir `npm start`/`tsx watch src/server/
index.ts` süreç zinciri iki kez gözlemlendi (PID'ler değişerek). Kendi başlattığım süreçler
(`.probe/live-test*.mjs`) tur sonunda temiz çıktı (`process.exit(0)` + `Query.close()`) ve
`tasklist` boş çıktı. Yabancı `npm start` zincirine **dokunulmadı** (sahipliği belirsiz, bu
oturumun başlattığı bir şey değil — muhtemelen bu makinede paralel çalışan başka bir agent
oturumu); ilk gözlemde zaten çalışıyordu, ikinci gözlemde (muhtemelen bir başka oturum tarafından)
yeniden başlatılmış görünüyordu.
