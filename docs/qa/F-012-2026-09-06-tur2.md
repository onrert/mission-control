KARAR: KALDI
ESKALE: false

---
feature: F-012
title: CEO sohbet arayüzü — panel oturumu Agent SDK ile barındırır
reviewer: qa-evaluator
date: 2026-09-06
round: düzeltme turu QA (tur 2, dar kapsamlı)
previous: docs/qa/F-012-2026-09-06.md (KALDI — 6 BLOKLAYICI + Ö1-Ö8)
---

# F-012 düzeltme turu QA raporu (tur 2)

## 0. Özet

**KARAR: KALDI.** 2 BLOKLAYICI, 3 ÖNEMLİ.

Düzeltme turu iyi iş çıkardı: **1. turun 6 bloklayıcısının 6'sı da gerçekten kapandı** ve
tek tek ölçülerek doğrulandı — iddiaya güvenilmedi. En kritik olan E1/B5 güvenlik garantisini
**bağımsız, canlı, iki yönlü** bir deneyle kanıtladım (§2). 1. turda yeşil kalan üç mutasyonun
üçü de artık KIRMIZI. `verify` ve `e2e` sayıları doğrulandı.

Buna rağmen KALDI, çünkü ertelenen iki maddenin **gerçek etkisi ölçülünce** erteleme gerekçesinden
büyük çıktı:

1. **Bekleyen bir izin isteği varken sayfa yenilenirse oturum sessizce ve kalıcı olarak
   kilitleniyor** (Y1). Kart kayboluyor, hiçbir uyarı yok, kompozer açık kalıyor, gönderilen
   mesaj `202 queued` alıyor ve **hiç cevaplanmıyor**; 90 sn sonra hâlâ `busy:true`. Arayüzde
   kurtarma yolu (Yeniden bağlan / kes) **yok**. Üstelik bu turun B5 düzeltmesi
   (`permissions.ask:['Bash']`) her Bash çağrısını bir izin kartına çevirdiği için **bu pencereyi
   kat kat büyüttü** — düzeltme, ertelenen kusurun olasılığını artırdı. Bu etkileşim erteleme
   gerekçesinde hiç ele alınmamış.
2. **`npm run e2e` çalıştıktan sonra `dist/` sohbet sekmesini derleme anında kapatıyor** (Y2).
   Sunucu `chat_enabled: true` derken panelde sekme **hiç yok**; hata yok, mesaj yok. Bunu
   bu turda kazara, gerçek tarayıcıda yaşadım ve tek değişken olarak izole ettim.

Ayrıca Ö5'in erteleme **öncülü yanlış**: "sahte `query()` enjekte edilebilen ayrı bir E2E modu
mevcut harness'e yeni bir yetenek eklemek demektir" deniyor — oysa enjeksiyon dikişi **ürün
kodunda zaten var** (`createServer(port, dataDir, chatQueryOverride)`), ve bu turdaki tüm
tarayıcı ölçümlerimi **kota harcamadan** bu dikişle yaptım (§3). Yani boşluk kapatılabilirdi.

## 1. Ölçüm ortamı

| Ne | Değer |
|---|---|
| Çalıştırma | `npm run build` + gerçek `createServer()` (üretim yolu, `concurrently` yok) |
| Portlar / veri dizini | 7434/7435/7436, `MC_DATA_DIR=<scratchpad>/qa-data-t2*` (depo `data/` kirletilmedi) |
| Tarayıcı | Playwright (Chromium), 929–1280 px (dar genişlik 1. turda GEÇTİ, tekrar ölçülmedi) |
| Canlı SDK | `@anthropic-ai/claude-agent-sdk`, gerçek oturum — yalnızca E1 kanıtı ve `test:chat-live` için |
| Ürün kodu değişikliği | **YOK** — tur sonunda `git status --porcelain -- src tests package.json vite.config.ts playwright.config.ts` **boş** |
| Artık mutasyon | **yok** — `grep -rn "MUTATION\|MUTASYON" src/ tests/` yalnızca meşru test adını döndürüyor (`tests/server/write-gate-manifest.test.ts:124`) |

`verify` / `e2e` **kendim koşturdum**, iddiaya güvenmedim:

| Komut | Çıkış | Sayı |
|---|---|---|
| `npm run verify` | **0** | 849 geçti + 2 atlandı (851), **55 dosya** geçti + 1 atlandı (56) |
| `npm run e2e` | **0** | **23/23** |

Developer'ın "849 test / 55 dosya" ve "23/23" iddiaları **doğru**. Vitest worker kararsızlığı bu
turda bir kez görüldü (M6'nın ilk koşusunda "Errors 1 error"); tekrar koşuda aynı tek gerçek
başarısızlıkla temiz sonuç alındı — kod regresyonu değil.

## 2. E1 / B5 — güvenlik garantisi, bağımsız canlı iki yönlü kanıt

**Sonuç: KAPANDI, iki yön de gösterildi.** Developer'ın "kesilen önceki oturumda koşuldu"
dediği kanıtı kabul etmedim; kendi ölçümümü yaptım.

Yöntem: depo dışında (scratchpad) bir betik, `session.ts`'in `buildOptions()` çıktısıyla aynı
çekirdeği (`cwd`, `agent:'ceo'`, `settingSources:['project']`, `permissionMode:'default'`,
`allowManagedPermissionRulesOnly:true`) kullanarak **gerçek** `query()` açar; tek fark
`managedSettings.permissions.ask` alanının varlığı. `canUseTool` her çağrıldığında kaydedip
**reddediyor** — yani araç çalışırsa, sorulmadan çalışmıştır.

### Yön A — `permissions.ask: ['Bash']` VARKEN (mevcut ürün yapılandırması)

```
canUseTool_cagrildi: true
  Bash  find /c/dev/apps/mission-control/docs -name "latest.md" -type f 2>/dev/null | head -5
  Bash  git log --oneline -3
tool_result: "QA E1 probe: reddedildi"  (iki çağrı için de)
```

Salt-okunur sınıfın tam ortasındaki `git log --oneline -3` **soruldu ve bekledi**; reddedilince
çıktı **hiç üretilmedi**.

### Yön B — `permissions.ask` YOKKEN (düzeltme geri alınmış hâli)

```
tool_use sayısı: 3
canUseTool çağrıları: 2   <-- BİRİ EKSİK
  (asked)     cd "C:\dev\..." && git status --short && ls -la docs/approvals/ ...
  (SORULMADI) cd "C:\dev\apps\mission-control" && git log --oneline -3
  (asked)     cd "C:\dev\..." && ls -la docs/approvals/ ... | while read f; ...
tool_result (sorulmayan çağrı için):
  "730220d docs: F-012 QA fix round complete, feature status back to qa
   2e5b5d5 fix: F-012 QA Ö8 - permission card collapse..."
```

Aynı komut **hiç sorulmadan çalıştı ve gerçek depo çıktısını döndürdü**. 1. turdaki delik birebir
tekrar üretildi; `permissions.ask` eklenince kapandı.

**İki yön de gösterildi → E1 GEÇTİ.** Ek olarak çevrimdışı çit gerçek: `permissions.ask` satırını
silen mutasyon `session.test.ts`'i KIRMIZI veriyor (M1) ve o test SDK'nın kendi
`resolveSettings()` motorunu çağırıyor, literal obje karşılaştırmıyor.

## 3. Üç ertelenen madde — imza / ret

### Ö5 — sohbet ekranının sıfır tarayıcı kapsaması → **ERTELEME REDDEDİLDİ (öncül yanlış)**

Erteleme gerekçesi: *"Düzeltme sahte `query()` enjekte edilebilen ayrı bir E2E modu gerektirir —
bu, mevcut E2E harness'ine yeni bir yetenek eklemek demektir… bu QA turunun cerrahi değişiklik
sınırının dışında."*

Bu öncül **yanlış**. Dikiş ürün kodunda zaten var:

```
src/server/index.ts:301   chatQueryOverride?: Parameters<typeof createChatSession>[0]['query']
src/server/index.ts:322   const chatSession = createChatSession({ query: chatQueryOverride ?? sdkQuery, ... })
```

Bu turda ~100 satırlık **tek bir başlatıcı betikle** (depo dışında, scratchpad'de) gerçek üretim
sunucusunu sahte `query()` ile ayağa kaldırdım ve bu raporun **bütün tarayıcı ölçümlerini
sıfır kota ile** yaptım — B2, B3, Ö7, Ö8, B1'in hesaplanmış CSS'i, Y1, Y2. Yani "ücret riski
olmadan gerçek tarayıcıda sohbet ekranını açmak" yeni bir yetenek değil; `playwright.config.ts`'in
`webServer.command`'ını `npm start` yerine böyle bir başlatıcıya çevirmek yeterli.

Kapsam kararının kendisi (bu turda mı yapılsın) tartışılabilir; ama **gerekçe olarak yazılan
teknik iddia doğru değil** ve bu boşluk bu turda somut zarar üretti: Y2 tam bu boşluktan geçti.

### Ö6 — geçmiş yazma amplifikasyonu → **KABUL EDİLEBİLİR SAPMA (koşullu)**

Erteleme gerekçesi (yazma sıklığını kısıtlamanın `markDanglingAsInterrupted`'ın restart-sonrası
davranışını bozma riski) **teknik olarak geçerli**; aceleyle yapılırsa yeni bir dayanıklılık
hatası riski gerçek. Ama etkisi 1. turda tahmin edilenden büyük; **ölçtüm**:

| Ölçüm | Değer |
|---|---|
| Tek bir CEO cevabı | 6.000 karakter, 20 karakterlik 300 delta |
| `history.jsonl` | **302 satır / 956.300 bayt** |
| Amplifikasyon | **~159×** |

1. turda bilinmeyen ikinci kat: `history-log.ts:56` `entries` dizisi **tüm** girdileri bellekte
tutuyor ve **hiçbir üst sınırı yok** (`jsonl-store.ts`'in ring buffer emsalinin aksine);
`init()` dosyanın tamamını `readFileSync` ile belleğe alıyor; `readPage()` **her çağrıda** tüm
diziyi katlıyor. Yani 100 cevaplık bir gün ≈ 95 MB dosya + 95 MB bellek + her geçmiş isteğinde
30.000 girdilik katlama + her sunucu açılışında 95 MB senkron okuma.

**Kabul ediyorum**, iki koşulla: (a) ölçülmüş rakam ve **bellek/retention üst sınırının olmaması**
`ADR-014`'ün kabul edilen riskler bölümüne (yalnızca feature notunun QA bölümüne değil) yazılmalı;
(b) bir sonraki feature'a taşınacak açık madde olarak `docs/blockers.md`'ye girmeli.

### Ö7 — araç satırları ve bekleyen izinler yenilemede kayboluyor → **ERTELEME REDDEDİLDİ → BLOKLAYICI (Y1)**

Erteleme metni bunu bir **görüntüleme/şema** işi gibi ele alıyor ("araç satırları… hiç
yüklenmiyorlardı… şema + sunucu + istemci değişikliği"). Etkiyi ölçtüm: **veri kaybı değil,
kalıcı kilitlenme.** Ayrıntı §4/Y1.

Araç satırlarının kaybolan kısmı (`✓ Bash tamamlandı` satırlarının yenilemeden sonra gitmesi)
tek başına ÖNEMLİ olarak kabul edilebilirdi; **bekleyen izin isteğinin** kaybolması değil.

## 4. Bulgular

### BLOKLAYICI

**Y1 — Bekleyen izin isteği sayfa yenilemesinde kayboluyor; oturum sessizce ve kalıcı olarak kilitleniyor**

- **Tekrar üretme (gerçek tarayıcı, gerçek üretim sunucusu, sahte `query()`):**
  1. Sohbet sekmesinde bir mesaj gönder; CEO `canUseTool('Bash', {command:'npm test'})` çağırsın.
  2. Panelde izin kartı görünür, oturum bekler (`busy:true`). Ekran:
     `docs/qa/screens/F-012-T2-04-bekleyen-izin-karti-yenileme-oncesi.png`
  3. Sayfayı yenile (F5 / sekmeyi kapat-aç — `docs/03-ux.md`'nin birincil senaryosu VS Code
     Simple Browser, bu her tab geçişinde olabilir; AC7'nin kendi senaryosu da budur).
  4. Sohbet sekmesine dön.
- **Beklenen (`docs/03-ux.md §7` madde 3 + AC7):** bekleyen karar kullanıcıya sorulmaya devam
  etmeli; en kötü ihtimalle kullanıcı durumu görüp kurtarabilmeli.
- **Gerçek (ölçüldü):**
  ```
  izin kartı           : YOK
  araç satırı          : YOK
  kompozer             : AÇIK (disabled değil), placeholder normal
  panelde buton listesi: ["✕", "Gönder"]      <- "Yeniden bağlan"/"Kes" YOK
  POST /api/chat/message -> 202 {"queued":true}
  90 sn sonra          : busy=true, session_active=true, last_error=yok,
                         "CEO yazıyor… ▍" hâlâ yanıp sönüyor,
                         kuyruktaki mesaj HİÇ cevaplanmadı
  ```
  Ekran: `docs/qa/screens/F-012-T2-05-yenileme-sonrasi-izin-karti-kayip-oturum-kilitli.png`
- **Neden kurtarılamıyor:** `canUseTool`'un `Promise`'i `pendingPermissions` haritasında
  `request_id` ile tutuluyor; `request_id` yalnızca **istemci belleğinde** yaşıyordu.
  `GET /api/chat/history` bu isteği `kind:'permission_request'` girdisi olarak **taşıyor**
  (ölçüldü: `seq 304, role:system, kind:permission_request, text:"npm test"`) ama girdide
  `request_id` ve `tool_name` **yok**, ve istemci `useChatSession.ts` geçmişi
  `kind === 'text' || kind === 'error'` ile filtrelediği için kartı zaten hiç kurmuyor.
  `POST /api/chat/permission` için gereken `request_id`'yi kullanıcı **hiçbir yerden**
  elde edemiyor.
- **Bu turun düzeltmesi riski BÜYÜTTÜ:** `permissions.ask:['Bash']` (E1/B5 düzeltmesi) sayesinde
  artık **her** Bash çağrısı bir izin kartı üretiyor. 1. turda salt-okunur komutlar hiç sormadan
  geçiyordu; şimdi 5 Bash çalıştıran tek bir CEO turu, panelin kilitlenebileceği **5 pencere**
  açıyor. Erteleme gerekçesi bu etkileşimi hiç değerlendirmemiş.
- **Muhtemel dosya:satır:** `src/features/chat/server/session.ts:204-227` (`canUseTool` —
  geçmiş girdisi `request_id`/`tool_name` taşımıyor), `src/shared/types.ts` (`ChatLogEntry`
  şeması), `src/features/chat/web/useChatSession.ts:486` (geçmiş filtresi),
  `src/features/chat/web/ChatScreen.tsx` (kilitli durumda kurtarma yolu yok).
- **Not:** en küçük dürüst çözüm bile şema değişikliği gerektirmez: `session_active && busy &&
  pendingPermissions.size > 0` durumunu `chat_status`'a koyup panelde "Bekleyen bir izin isteği
  var, oturumu yeniden başlat" satırı göstermek kilitlenmeyi **görünür ve kurtarılabilir** yapar.
  Bu depoda tekrar eden ders: sessiz durma, temiz hatadan kötüdür.

**Y2 — `npm run e2e` sonrası üretim `dist/`'i sohbet sekmesini derleme anında kapatıyor; sunucu "açık" derken arayüzde özellik yok**

- **Tekrar üretme:**
  1. `npm run e2e` (Playwright `webServer` `npm run build && npm start`'ı
     `env: { MC_CHAT_ENABLED: '0' }` ile çalıştırır — `playwright.config.ts:35`).
  2. Sohbeti **açık** bir sunucuyla paneli aç (`MC_CHAT_ENABLED=1`).
  3. `GET /api/chat/status` → `chat_enabled: true`, `session_active: true`.
  4. Panelde sekme listesi: `Zaman Çizelgesi`, `Kanban`. **`Sohbet` yok.**
  5. `npm run build` (override'sız) → aynı sunucu, aynı oturum, sayfa yenile → `Sohbet` **geri
     geliyor.** Tek değişken derleme çıktısı.
- **Kök neden:** `vite.config.ts:16` `define: { 'process.env.MC_CHAT_ENABLED': JSON.stringify(
  process.env.MC_CHAT_ENABLED ?? '') }` → değer **derleme anında** bundle'a gömülüyor;
  `src/web/App.tsx:26-31` `isChatUiEnabled()` bunu okuyor. E2E'nin `env`'i `webServer.command`'ın
  **tamamına** uygulandığı için `npm run build` adımı da `'0'` ile derliyor ve `dist/` o hâlde
  kalıyor.
- **Beklenen:** sunucu tarafı anahtarla arayüz tarafı anahtar aynı şeyi söylemeli; en azından
  arayüzde bir açıklama olmalı (AC10 "temiz geri dönüş" bilinçli kapatma içindir, kaza için değil).
- **Gerçek:** özellik **sessizce ve tamamen** yok oluyor; hata yok, uyarı yok, API tersini
  söylüyor. Kullanıcının F-012'yi bitirdikten sonra izleyeceği en olası komut sırası
  (`verify` → `e2e` → `npm start`) tam olarak bu duruma sokuyor.
- **Muhtemel dosya:satır:** `playwright.config.ts:35`, `vite.config.ts:16`, `src/web/App.tsx:26`.
- **Neden hiçbir test yakalamadı:** derleme çıktısındaki bu bayrağı denetleyen çit yok; ve
  Ö5 gereği hiçbir tarayıcı testi sohbet sekmesine bakmıyor.

### ÖNEMLİ

**Y3 — B6'nın teslim ettiği canlı test güvenilir değil: 3 koşunun 3'ü de KIRMIZI, her seferinde farklı testten**

`MC_CHAT_LIVE_TESTS=1 npm run test:chat-live` (gerçek, ücretli oturum), üç koşu:

| Koşu | E1/B5 testi | AC4 iki yönlü testi | Sonuç |
|---|---|---|---|
| 1 | **KIRMIZI** — 30.000 ms zaman aşımı (test 30019 ms) | YEŞİL | exit 1 |
| 2 | YEŞİL | **KIRMIZI** — assert (54120 ms) | exit 1 |
| 3 | YEŞİL | **KIRMIZI** — `expect(blockedActive).toBe(true)` → `false` (58711 ms) | exit 1 |

- Kök neden 1: E1 testinin 30 sn'lik zaman aşımı gerçek CEO personası için yetersiz — kendi
  probem aynı yapılandırmayla `error_max_turns`'e kadar 40-70 sn koştu.
- Kök neden 2: AC4 testi bir **mekanizmayı** değil bir **model davranışını** assert ediyor
  ("model gerçekten `npm publish --dry-run` çalıştırsın"). Model bunu yapmazsa `blockedActive`
  `false` kalıyor ve test kırmızı oluyor — mekanizma sağlamken.
- Sonuç: sözleşme §11.3 "her QA turunda en az bir kez koşulur" diyor; koşulduğunda **yanlış
  alarm** veriyor. Bu, `ADR-014`'ün talep ettiği kanıtın kendisine olan güveni aşındırır.
- **Yine de mekanizma kanıtlandı:** koşu 1 AC4'ün iki yönünü (hook aktifken `Engellendi`,
  devre dışıyken geçiyor) **canlı olarak yeşil verdi**, koşu 2/3 E1'i yeşil verdi, ve §2'deki
  bağımsız probem E1'i iki yönlü kesin olarak kapattı. Sorun testin **güvenilirliği**, iddianın
  doğruluğu değil.
- **Muhtemel dosya:satır:** `tests/integration/chat-hooks-live.test.ts:110` (30 sn),
  `:175` (model davranışına bağlı assert).
- Ek gözlem: testin "hook devre dışı" kolu `npm publish --dry-run`'ı **gerçekten çalıştırıyor**
  (`settingSources: []` ile koruma kapalı). `--dry-run` olduğu için zararsız, ama koruma kapalı
  bir kolda yayın ailesinden bir komut çalıştırmak dokümante edilmeli.

**Y4 — B2'nin istemci yarısında çit yok (mutasyon YEŞİL geçiyor)**

- 1. turun B2 bulgusu **iki** dosyayı adlandırıyordu: `history-log.ts` (sunucu katlaması) ve
  `useChatSession.ts` (istemci katlaması). Sunucu tarafına test eklendi (M6 KIRMIZI); istemci
  tarafına eklenmedi.
- Mutasyon M8: `useChatSession.ts:131`'de anahtar `${turn_id}::${kind}::${role}` →
  `${turn_id}::${kind}` yapıldı → `tests/features/chat/web` **18/18 YEŞİL**.
- Davranış bugün doğru (canlı ölçüldü, §5), ama regresyon çiti yok: aynı hata istemci tarafında
  tekrar edilirse hiçbir test görmez.
- **Muhtemel dosya:satır:** `src/features/chat/web/useChatSession.ts:130-132`;
  test tarafı `tests/features/chat/web/ChatScreen.test.tsx` (aynı turda user+assistant girdisi
  içeren bir geçmiş yükleme senaryosu yok).

**Y5 — Ö6'nın bellek ayağı hiçbir belgede yazılı değil**

§3/Ö6'da ölçülen sınırsız bellek birikmesi (`entries` dizisinin üst sınırı yok, `init()` tüm
dosyayı belleğe alıyor) feature notunun erteleme metninde **geçmiyor**; orada yalnızca disk/
yazma sıklığı anlatılıyor. Kabul edilen sapmanın tam kapsamı yazılı olmalı.

## 5. 1. tur bulgularının kapanış tablosu

| # | 1. tur bulgusu | Durum | Bu turda nasıl doğrulandı |
|---|---|---|---|
| B1 | Sohbet CSS'i üretimde yok | **KAPANDI** | `dist/web/assets/*.css` içinde 17/17 sınıf var (`sm\:inline`, `max-w-\[92\%\]`, `sm\:max-w-\[80\%\]`, `whitespace-pre-wrap`, `bg-amber-700`, `sticky`, `border-l-4`, `text-zinc-950`, `resize-none`, `justify-end`, `items-end`, `max-h-24`, `last\:mb-0`, `text-amber-200`, `z-10`, `border-l-4`, `mt-2`). Canlı DOM: `whiteSpace:"pre-wrap"`, banner `position:"sticky"`, "Gönder" span `display:"block"`, buton sınıfı `bg-amber-700 text-zinc-950`. Çit yapısal ve gerçek (M2 KIRMIZI) |
| B2 | Kullanıcı mesajları transkriptten siliniyor | **KAPANDI** | Canlı: iki "Sen" balonu CEO cevapladıktan sonra da duruyor; **yenilemeden sonra da** duruyor (ekran `F-012-T2-03`). M6 KIRMIZI. İstemci yarısında çit yok → Y4 |
| B3 | İkinci mesaj ilk cevabı ikiye bölüyor | **KAPANDI** | Canlı: A'nın cevabı tek balonda tam (`"A-cevabi-basladi. A-cevabinin-DEVAMI."`), B ayrı balonda; takılı "yazıyor" balonu **yok** (ekran `F-012-T2-02`). M7 KIRMIZI |
| B4 | Ham araç **çıktısı** çiti yanlış dalda | **KAPANDI** | M3 (`tool_result` dalına `output` eklenmesi) KIRMIZI; assert kapalı allowlist + `not.toHaveProperty('content'/'tool_result'/'output')` |
| B5/E1 | İzin kartı çıkmadan araç çalışıyor | **KAPANDI** | §2 — bağımsız canlı **iki yönlü** kanıt + M1 KIRMIZI |
| B6 | Canlı hook testi hiç yazılmamış | **KAPANDI (dosya var, mekanizma kanıtlı) ama test güvenilir değil** | Dosya var, `npm run test:chat-live` artık dosya buluyor; AC4'ün iki yönü canlı yeşil görüldü. Ancak 3/3 koşu kırmızı → Y3 |
| Ö1 | Bariyer şeridi yanlış bilgi veriyor | **KAPANDI** | Canlı şerit gerçek 21 değişkeni sayıyor: *"Ortamda şu ortam değişkenleri bulundu ve bu oturum için temizlendi: ANTHROPIC_BASE_URL, CLAUDE_AGENT_SDK_VERSION, …"* |
| Ö2 | Bütçe mesajında tutar yok | **KAPANDI** | `GET /api/chat/status` → `max_budget_usd: 20` (yeni alan) |
| Ö3 | İzin yüklerinde kapalı şema yok | **KAPANDI** | M4 ve M5 **ayrı ayrı** KIRMIZI (iki farklı test adı) |
| Ö4 | `chat_error` kullanıcıya gösterilmiyor | **KAPANDI (kod + test)** | `session.ts:370-395` tur-içi hatayı kalıcı `kind:'error'` girdisi olarak yazıyor, `chat_error` `turn_id`/`chat_seq` taşıyor; `session.test.ts` bunu assert ediyor. Canlı tekrar ölçülmedi |
| Ö5 | Sıfır tarayıcı kapsaması | **ERTELEME REDDEDİLDİ** | §3 — öncül yanlış; Y2 tam bu boşluktan geçti |
| Ö6 | Yazma amplifikasyonu | **ERTELEME KABUL (koşullu)** | §3 — 6.000 karakter = 302 satır / 956.300 bayt ölçüldü; bellek ayağı belgesiz → Y5 |
| Ö7 | Araç satırları/izinler yenilemede kayboluyor | **ERTELEME REDDEDİLDİ → Y1** | §4/Y1 — kalıcı sessiz kilitlenme ölçüldü |
| Ö8 | İzin kartının kolabe hâli yok | **KAPANDI** | Canlı: "Onayla"ya basınca kart tek satıra dönüyor → **`Onaylandı — npm test çalıştı`** (UX §7 (h)3 birebir) |

## 6. Mutasyon tablosu (bu turda bağımsız koşturuldu)

Yöntem: uygula → ilgili testleri tek başına koştur → çıkış kodunu kaydet → dosyayı **birebir**
geri yaz (`cp` yedeği). Tur sonunda ürün kodu `git status` ile temiz doğrulandı.

| # | Mutasyon | Hangi test(ler) | Sonuç |
|---|---|---|---|
| **M1** | `session.ts:454` `permissions: { ask: ['Bash'] }` satırı **silinir** (E1 çiti) | `session.test.ts` + `chat-api.test.ts` | **KIRMIZI** (2/39) |
| **M2** | `index.css`'ten `@source "../features/chat/web"` **silinir** (yapısal @source çiti) | `build-css.test.ts` | **KIRMIZI** (2/19) |
| **M3** | `chat_tool` **finished/`tool_result`** dalına `output: JSON.stringify(block)` eklenir (E3/B4 — 1. turda yanlış daldaydı) | `chat-api.test.ts` + `session.test.ts` | **KIRMIZI** (1/39) |
| **M4** | `chat_permission_request` yüküne `raw_input: input` eklenir (1. turda YEŞİL kalmıştı) | `chat-api.test.ts` | **KIRMIZI** |
| **M5** | `chat_permission_resolved` yüküne `raw_result: result` eklenir (1. turda YEŞİL kalmıştı) | `chat-api.test.ts` | **KIRMIZI** |
| **M6** | `history-log.ts:20` katlama anahtarından `::${entry.role}` çıkarılır (B2 sunucu yarısı) | `history-log.test.ts` | **KIRMIZI** (1/24) |
| **M7** | `session.ts:519` `if (turnQueue.length === 1) currentTurnId = turnId` → koşulsuz atama (B3) | `session.test.ts` | **KIRMIZI** (1/39) |
| **M8** | `useChatSession.ts:131` katlama anahtarından `::${entry.role}` çıkarılır (B2 **istemci** yarısı) | `tests/features/chat/web` | **YEŞİL KALDI (18/18)** → **Y4** |

**8 mutasyonun 7'si KIRMIZI.** 1. turda yeşil kalan üç mutasyonun (12b, 15, 16) **üçü de** artık
KIRMIZI (M3, M4, M5) — zorunlu kontrol (a), (b), (c), (d) hepsi karşılandı.

Yapısal `@source` çitinin kendisi de sağlam: `build-css.test.ts:206-222` gerçek dosya sistemine
sahte bir `src/features/__mutation_probe_e2__/web` dizini yaratıp testin KIRMIZI verdiğini
doğruluyor — yani "regex her zaman boş döner de yeşil kalır" totolojisi elenmiş. Önceki üç
feature-bazlı çitin aksine bu, **bir sonraki** feature `@source` eklemeyi unutursa da yakalar.

## 7. Puanlama

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **5** / 10 | 1. turun altı bloklayıcısı da gerçekten çalışır hâlde (akış, kullanıcı balonları, tur kuyruğu, izin kartı, hook engelleme, hata sınırı) — bunlar canlı doğrulandı. Ama bekleyen izin varken yenileme paneli **kalıcı ve sessiz** kilitliyor (Y1) ve `e2e` sonrası özellik arayüzden tamamen kayboluyor (Y2). |
| Özellik bütünlüğü | **5** / 10 | AC1-AC6, AC8-AC10 karşılanıyor; AC4'ün iki yönü canlı görüldü. AC7 hâlâ kısmi: araç satırları ve bekleyen izinler geçmişten yeniden kurulmuyor, ve bu kısmilik artık bir kilitlenmeye dönüşüyor. Ana ekranın tarayıcı kapsaması hâlâ sıfır ve erteleme gerekçesi yanlış (Ö5). |
| Görsel / UX | **7** / 10 | B1 tam kapandı (üretim CSS'i, hesaplanmış stiller, birincil amber buton, `pre-wrap`, sticky şerit, "Gönder" etiketi). Ö1/Ö2/Ö8 kapandı; izin kartı UX §7'nin istediği tek satıra kolabe oluyor. Dar genişlik 1. turda geçmişti. Düşüren tek şey: yenilemeden sonra kullanıcının ekranda gördüğü araç/izin izlerinin sessizce kaybolması. |
| Kod kalitesi (test, hata yönetimi) | **5** / 10 | 849 test yeşil, 8 mutasyonun 7'si KIRMIZI, yapısal `@source` çiti önceki üç denemeden gerçekten daha iyi, çevrimdışı K3 çiti SDK'nın kendi motorunu kullanıyor. Buna karşılık: B2'nin istemci yarısı çitsiz (Y4), B6'nın canlı testi 3/3 kırmızı ve model davranışına bağlı (Y3), geçmiş belleği sınırsız ve 159× amplifikasyonlu (Ö6), ana ekranda sıfır E2E — üstelik dikiş ürün kodunda hazır dururken. |

**Herhangi biri < 7 → KALDI.** Üçü < 7.

## 8. Karar

**KARAR: KALDI.**

Bu, "düzeltme işe yaramadı" kararı değil — tam tersi: altı bloklayıcının altısı da gerçekten
kapandı ve en kritik olanı (E1) bağımsız canlı deneyle kanıtlandı; 1. turda yeşil kalan üç
mutasyon artık kırmızı. Karar iki ölçüme dayanıyor:

1. **Y1** — kullanıcının panelini sessizce ve kalıcı olarak kullanılamaz hâle getiren, kurtarma
   yolu olmayan bir durum var; ve bu turun güvenlik düzeltmesi bu durumun olasılığını
   **artırdı**. "Bilinçli ertelendi" gerekçesi bu etkileşimi değerlendirmemiş.
2. **Y2** — belgelenmiş komut sırasının (`verify` → `e2e` → `npm start`) sonunda özelliğin
   tamamı arayüzden sessizce kayboluyor, API tersini söylüyor.

Her ikisi de bu deponun `CLAUDE.md`'de defalarca yazdığı aynı sınıf: **sessiz durma / yarı-başarı,
temiz hatadan kötüdür.**

Sonraki tur için en küçük yol: (a) Y1 için `chat_status`'a bekleyen izin sayısını koyup panelde
görünür bir kurtarma satırı göstermek (şema değişikliği gerektirmez), (b) Y2 için
`playwright.config.ts`'in `env`'ini yalnızca `npm start` adımına uygulamak ya da derleme
bayrağını çalışma zamanına (`/api/chat/status.chat_enabled`) taşımak, (c) Y3 için canlı testin
zaman aşımını yükseltip assert'i model davranışından mekanizmaya çevirmek, (d) Y4 için istemci
katlama anahtarına bir test.

## 9. Harcanan kota

| Kalem | Oturum | Maliyet |
|---|---|---|
| E1 probe, yön A (`ask` var) | 2 | $0,0325 + $0,0338 (SDK `result.total_cost_usd`, **ölçüldü**) |
| E1 probe, yön B (`ask` yok) | 1 | $0,0292 (**ölçüldü**) |
| `npm run test:chat-live` × 3 | ≤ 9 | **ölçülmedi** (vitest maliyeti yüzeye çıkarmıyor); benzer tur profilinden **~$0,25 tahmin** |
| Tarayıcı ölçümleri (B1, B2, B3, Ö7, Ö8, Y1, Y2) | 0 | **$0** — sahte `query()` enjekte edilmiş gerçek üretim sunucusu |
| **Toplam** | | **$0,0955 ölçüldü + ~$0,25 tahmin ≈ $0,35** |

Model: E1 probe ve canlı testler `claude-haiku-4-5` (kota kısıtı; test edilen mekanizma —
SDK izin motoru ve hook zinciri — modelden bağımsız).

## 10. Süreç ve port durumu

- 7333 / 7434 / 7435 / 7436 portlarında dinleyen süreç: **yok** (`netstat -ano | grep LISTENING`).
- `claude-agent-sdk-win32-x64claude.exe` (SDK'nın kendi alt süreci) sayısı: **0** — canlı testler ve E1 probe'u yetim bırakmadı.
- Probe sunucularının `node.exe` süreçleri: **0** (üçü de `Stop-Process` ile kapatıldı; komut satırı taramasıyla doğrulandı).
- Kalan `claude.exe` süreçleri yalnızca masaüstü uygulaması ve bu QA oturumunun kendi CLI süreci — tur başında da vardılar.
- Depoya yazılanlar: bu rapor, `docs/qa/latest.md`, `docs/qa/screens/F-012-T2-*.png` (5 dosya),
  `docs/features/F-012-ceo-sohbet-arayuzu.md` yalnızca `status` satırı.
- `src/`, `tests/`, `package.json`, `vite.config.ts`, `playwright.config.ts` **hiç değişmedi**.
- Geçici betikler (`e1-probe.mjs`, `probe-server.mts`, `probe-server2.mts`) ve veri dizinleri
  scratchpad'de kaldı, depoya girmedi.

## 11. Doğrulayamadıklarım

1. **Ö4'ün canlı davranışı** — tur-içi hata balonu yalnızca kod okuması ve birim testleriyle
   doğrulandı, gerçek bir `is_error` turu tetiklenmedi (kota).
2. **`AskUserQuestion` kartı** — 1. turda da açık kalan madde; bu turda da canlı tetiklenmedi.
3. **Ö6'nın uzun vadeli etkisi** — 6.000 karakterlik tek cevap ölçüldü; 100 cevaplık gerçek bir
   günün `readPage`/açılış gecikmesi ölçülmedi, ekstrapolasyon.
4. **Dar genişlik ve akış** — 1. turda GEÇTİ verdiğim maddeler, bu dar kapsamlı turda bilinçli
   olarak yeniden ölçülmedi.
5. **`npm run dev` donması (N1)** — bu turda da üretim yoluyla ölçtüm, `concurrently` senaryosu
   bağımsız tekrar üretilmedi.
