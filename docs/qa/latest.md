KARAR: KALDI
ESKALE: true

---
feature: F-012
title: CEO sohbet arayüzü — panel oturumu Agent SDK ile barındırır
reviewer: qa-evaluator
date: 2026-09-06
round: düzeltme turu QA (tur 3, kapanış kontrolü — çok dar kapsam)
previous: docs/qa/F-012-2026-09-06-tur2.md (KALDI — Y1, Y2 bloklayıcı; Y3, Y4, Y5 önemli)
---

# F-012 düzeltme turu QA raporu (tur 3 — kapanış kontrolü)

## 0. Özet

**KARAR: KALDI. ESKALE: true** (üçüncü tur — süreç gereği kullanıcıya gider).

Bu tur yalnızca 2. turun açık maddelerine baktı. Dört maddenin ikisi gerçekten kapandı, biri
kapanmadı, biri hâlâ kırmızı:

| # | 2. tur bulgusu | İddia | Ölçüm sonucu |
|---|---|---|---|
| **Y1** | Bekleyen izin yenilemede kayboluyor, oturum kilitleniyor | "sunucudan geri geliyor, cevaplanabiliyor" | **KAPANMADI** — sunucu doğru veriyi gönderiyor, **istemci onu çöpe atıyor** (§2) |
| **Y2** | `e2e` sonrası `dist/` sohbeti derleme anında kapatıyor | "çalışma zamanı oldu" | **KAPANDI** — canlı, gerçek `dist/` ile doğrulandı (§3) |
| **Y3** | Canlı hook testi güvenilir değil | "determinize edildi" | **HÂLÂ KIRMIZI** — bu turda 1 koşu, exit 1 (§4) |
| **Y4** | İstemci fold anahtarı çitsiz | "çitlendi" | **KAPANDI** — mutasyon C KIRMIZI (§5) |

Y1'in durumu 2. turdakinden **farklı ama hâlâ bloklayıcı**: sunucu tarafı düzeltmesi doğru ve
çitli (`getStatus().pending_permissions` gerçekten dolu geliyor, mutasyon A KIRMIZI), ama
istemcinin sayfa-yenileme yolu (`loadStatus`) yanıtı `onChatStatus`'tan **geçirmiyor**;
`setStatus`'a doğrudan yazıyor ve `pendingPermissions` hiç kurulmuyor. Sonuç: yenilemeden sonra
izin kartı **yine yok**, kurtarma satırı yok, kullanıcı ancak **ikinci bir mesaj göndererek**
(bu yeni bir `chat_status` yayını tetiklediği için) kartı kazara geri getirebiliyor.

Bu, deponun `CLAUDE.md`'sinde yazılı iki dersin aynı anda tekrarı:
1. **"Testin yorumu ile taradığı şey çelişebiliyor."** Y1 için yazılan istemci testinin kendi
   yorumu (`ChatScreen.test.tsx:273-279`) *"sayfa yenilenince … `onChatSync` … `onChatStatus`'u
   tetikliyor"* diyor. Ürün kodunda `onChatSync` → `loadStatus()` → `setStatus()`; `onChatStatus`
   **çağrılmıyor**. Test, `handlers.onChatStatus(...)`'u elle çağırarak gerçekte var olmayan bir
   yolu ölçüyor.
2. **"Sessiz durma / yarı-başarı, temiz hatadan kötüdür."** Veri kabloda var, ekranda yok.

Mutasyon F bunu bağımsız olarak kanıtlıyor: `onChatSync`'ten `loadStatus()` çağrısını tamamen
silmek **855 testin tamamını YEŞİL bırakıyor** — yeniden bağlanma/yenileme yolunda hiçbir çit yok.

## 1. Ölçüm ortamı ve üç paketin sayıları

| Ne | Değer |
|---|---|
| Çalıştırma | `npm run build` (e2e'nin kendi derlemesi) + gerçek üretim `createServer()`; `npm run dev` hiç kullanılmadı |
| Port / veri dizini | 7435, `MC_DATA_DIR=<scratchpad>/qa-data-t3` (depo `data/` kirletilmedi) |
| Tarayıcı | Playwright (Chromium), varsayılan masaüstü genişliği (dar genişlik 1./2. turda GEÇTİ — yeniden ölçülmedi) |
| Sahte `query()` | `tests/e2e/helpers/chat-fake-server.ts` (ürün kodundaki enjeksiyon dikişi) — tarayıcı ölçümlerinin kotası **$0** |
| Canlı SDK | yalnızca `npm run test:chat-live`, **tek koşu** (talimat gereği) |
| Ürün kodu değişikliği | **YOK** — tur sonunda `git status --porcelain` boş |
| Artık mutasyon | **yok** — `grep -rn "MUTATION\|MUTASYON" src/ tests/` yalnızca `tests/server/write-gate-manifest.test.ts:124` (meşru test adı) |

**Sayılar kendim koşturuldu, iddiaya güvenilmedi:**

| Komut | Çıkış | Sayı | Developer iddiası |
|---|---|---|---|
| `npm run verify` | **0** | 855 geçti + 2 atlandı (857); 56 dosya + 1 atlandı (57) | 855 / 56 → **doğru** |
| `npm run e2e` | **0** | **23/23** | 23/23 → **doğru** |
| `npm run e2e:chat` | **0** | **1/1** | 1/1 → **doğru** |
| `MC_CHAT_LIVE_TESTS=1 npm run test:chat-live` | **1** | 1 geçti, **1 KIRMIZI** | "5 denemede determinize edildi" → **doğrulanmadı** |

Vitest worker fork kararsızlığı bu turda **görülmedi** (verify tek koşuda temiz).

## 2. Y1 — BLOKLAYICI, KAPANMADI

### Tekrar üretme (gerçek Chromium, gerçek üretim sunucusu, sahte `query()`, sıfır kota)

1. `PORT=7435 MC_CHAT_ENABLED=1 npx tsx tests/e2e/helpers/chat-fake-server.ts` ile üretim
   sunucusunu başlat, `http://127.0.0.1:7435/` aç, **Sohbet** sekmesine geç.
2. "Y1 testi: klasörü kontrol eder misin?" gönder. Sahte CEO akan cevap verir ve `Bash`
   (`ls -la`) için izin ister. Kart görünür, oturum bekler.
   Ekran: `docs/qa/screens/F-012-T3-02-y1-bekleyen-izin-yenileme-oncesi.png`
   ```
   GET /api/chat/status -> busy: true
     pending_permissions: [{ request_id:"req_37299f6d-…", turn_id:"2fccbd45-…",
                             tool_name:"Bash", input_preview:"ls -la", ts:"…08:26:38.960Z" }]
   ```
3. **Sayfayı yenile** (`docs/03-ux.md:443`'ün birebir senaryosu; VS Code Simple Browser'da
   sekme geçişi bunu üretir), **Sohbet**'e dön, 3 sn bekle.

### Beklenen

`docs/03-ux.md:443` — *"Otomatik onay hiçbir koşulda yapılmaz; panel yeniden başlasa/sekme
kapatılıp açılsa bile **bekleyen izin isteği geçmişte kaldığı hâliyle gösterilir**."*
Feature notu (tur 2 yanıtı) — *"Sayfa yenilemesi/SSE yeniden bağlanması sonrası kart geri gelir
ve gerçekten cevaplanabilir."*

### Gerçek (ölçüldü)

```
sayfa yenilendi, SSE bağlı ("Bağlı" rozeti)
GET /api/chat/status (istek #16) -> 200
   pending_permissions: [ { request_id:"req_37299f6d-…", … } ]     <- SUNUCU DOĞRU
DOM: document.querySelectorAll('[role="group"]').length = 0        <- KART YOK
buton listesi: ["⚙ Ayarlar","Duraklat","Filtreleri temizle","Ayarlar'a git","✕","Gönder","Ekle"]
   -> "Onayla" / "Reddet" / "Yeniden bağlan" YOK
busy = true, oturum bekliyor; kompozer açık, hiçbir uyarı yok
```
Ekran: `docs/qa/screens/F-012-T3-03-y1-yenileme-sonrasi-izin-karti-YOK.png`

Kullanıcı **ikinci bir mesaj** gönderince kart geri geliyor (çünkü `sendMessage`
`session.ts:562`'de `chat_status` yayınlıyor ve bu **SSE yolu** `onChatStatus`'tan geçiyor):
`docs/qa/screens/F-012-T3-04-y1-kart-ancak-ikinci-mesajdan-sonra-geliyor.png`. Yani 2. turdaki
**kalıcı** kilitlenme artık **kazara kurtarılabilir** bir kilitlenme — ama kullanıcıya bunu
söyleyen hiçbir şey yok ve gönderdiği mesaj bloke turun arkasına kuyruklanıyor.

### Kök neden (kod okundu)

```
src/features/chat/web/useChatSession.ts:355-364
  const loadStatus = useCallback(async () => {
    …
    setStatus(body.data)          // <- SADECE status; pendingPermissions HİÇ kurulmuyor
  }, [fetchImpl])

src/features/chat/web/useChatSession.ts:496-509
  const onChatStatus = useCallback((payload) => {
    setStatus(payload)
    …
    setPendingPermissions(pending.map(…))   // <- kartı kuran TEK yer, yalnızca SSE olayında
  }, [])

src/features/chat/web/useChatSession.ts:383-398
  useEffect(… void loadStatus() …)      // ilk yükleme  -> onChatStatus'tan GEÇMEZ
  const onChatSync = … void loadStatus() // SSE 'open'   -> onChatStatus'tan GEÇMEZ
```

Sunucu yarısı doğru: `session.ts:522-530` (`getStatus().pending_permissions`),
`session.ts:252-255` (`canUseTool` içinde `chat_status` yayını), `session.ts:594`
(`resolvePermission` sonrası yayın). Eksik olan tek şey istemcinin `GET /api/chat/status`
yanıtını da aynı indirgeyiciden geçirmesi.

**En küçük dürüst düzeltme:** `loadStatus`'un `setStatus(body.data)` satırını
`onChatStatus(body.data)` çağrısına çevirmek (tek satır) + bunu **gerçek yolla** (mount + stub
`fetch` `pending_permissions` döndürür) ölçen bir test. Mevcut test bu yolu ölçmüyor.

### Neden hiçbir test yakalamadı

- `tests/features/chat/web/ChatScreen.test.tsx:272` testi `handlers.onChatStatus(...)`'u **elle**
  çağırıyor; `loadStatus` yolunu hiç kullanmıyor. Testin yorumu (`:277-279`) bu iki yolun aynı
  olduğunu iddia ediyor — ürün kodunda değiller.
- `tests/e2e/chat.spec.ts` yenilemeyi **izin çözüldükten sonra** yapıyor (`:51`), bekleyen izin
  varken değil — tam olarak boşluğun dışından geçiyor.
- Mutasyon F (§7): `onChatSync`'ten `loadStatus()`'u silmek **855/855 YEŞİL**.

## 3. Y2 — KAPANDI (canlı doğrulandı)

Talimat gereği tam 2. turdaki sıra tekrarlandı:

1. `npm run e2e` koşturuldu (exit 0, 23/23). Bu koşu `webServer.command` olarak
   `npm run build && npm start`'ı `MC_CHAT_ENABLED:'0'` ortamıyla çalıştırır, yani `dist/` bu
   ortamda derlenir. Derleme zaman damgası: `dist/web/assets/index-B2X4BJsm.js` **11:25:04**.
2. Aynı `dist/` **yeniden derlenmeden**, sohbeti açık bir üretim sunucusuyla servis edildi
   (`MC_CHAT_ENABLED=1`, port 7435). `GET /api/chat/status` → `chat_enabled: true`.
3. Gerçek Chromium'da sekme listesi: **Zaman Çizelgesi · Kanban · Sohbet** — sekme **var**.
   Ekran: `docs/qa/screens/F-012-T3-01-y2-e2e-sonrasi-dist-sohbet-sekmesi-var.png`
4. `grep -c "MC_CHAT_ENABLED" dist/web/assets/*.js` → **0** (derleme anı literali yok).

2. turda tam bu noktada sekme kayboluyordu. Çit de gerçek: mutasyon B (§7) KIRMIZI.

## 4. Y3 — HÂLÂ KIRMIZI (tek koşu, talimat gereği tekrarlanmadı)

```
MC_CHAT_LIVE_TESTS=1 npm run test:chat-live
  Test Files  1 failed (1)
       Tests  1 failed | 1 passed (2)          exit 1     (48,5 sn)

  ✓ E1/B5 canlı izin motoru testi                       -> YEŞİL
  × AC4 iki yönlü kanıt (hook aktif/devre dışı)         -> KIRMIZI (29,8 sn)
    Error: Model işaretleyici komutu (npm publish) ÖNERMEDİ (aktif kol) …
      Önerilen komut(lar): ["head -20 docs/progress.md && …",
                            "cat docs/progress.md 2>/dev/null | tail -50",
                            "ls -1 docs/features/*.md 2>/dev/null | head -20"]
    tests/integration/chat-hooks-live.test.ts:206
```

**Ayrım (talimatın istediği):** **mekanizma bozuk değil, test hâlâ model davranışına bağımlı.**
Kırmızı, mekanizmayı ölçen `expect(blockedActive).toBe(true)` satırına **hiç ulaşmadan**, ondan
önceki tanı dalında (`:205-211`) oluştu; yani bu koşu AC4 hakkında ne olumlu ne olumsuz bir şey
söylüyor. 5. denemenin getirdiği iyileştirme gerçek ama **kısmi**: hata mesajı artık dürüst ve
ayırt edici (2. turda "assert false" diyordu, şimdi "model işbirliği yapmadı" diyor). Ne var ki
`ADR-014` M2'nin ve sözleşme §11.3'ün istediği şey bir hata mesajı değil, **her QA turunda en az
bir kez alınan iki yönlü canlı kanıt** — bu tur da alınamadı (2. turda 3/3 kırmızı, bu turda
1/1 kırmızı; üst üste dördüncü başarısız koşu).

Yapısal sorun: test, modelin `npm publish` içeren bir komut **önermesini** bekliyor; CEO
personası ise turu proje bağlamını okuyarak açıyor (yukarıdaki üç `docs/` komutu). Prompt'un
"işaretleyici komutu öner" talimatı, güvenlik hook'unun engellediği bir komutu modele önerttirmeye
çalışıyor — modelin reddetmesi **beklenen** bir davranış. Mekanizmayı ölçmenin model-bağımsız
yolu, hook'u modelin seçmediği bir komut yerine **doğrudan** (SDK'ya elle bir `tool_use` girdisi
vererek ya da hook betiğini kendi başına çalıştırarak) tetiklemektir; bu bir tasarım kararıdır ve
CEO/architect'e aittir.

Not: E1/B5 canlı testi **yeşil** — `ADR-014`'ün iki koruma mekanizmasından ikincisi (izin motoru)
bu turda da canlı doğrulandı.

## 5. Y4 — KAPANDI

`useChatSession.ts:143-144`'ün `${entry.turn_id}::${entry.kind}::${entry.role}` anahtarından
`role` çıkarılınca `tests/features/chat/web` **KIRMIZI** (1 failed / 21) — 2. turda aynı mutasyon
18/18 YEŞİL geçiyordu. Çit gerçek (mutasyon C, §7).

## 6. Ertelenen maddelerin bu turdaki durumu

### Ö5 (sıfır tarayıcı kapsaması) — **KAPANDI**
`playwright.chat.config.ts` + `tests/e2e/chat.spec.ts` + `tests/e2e/helpers/chat-fake-server.ts`
gerçek Chromium'da ana akışı **sıfır kota** ile koşuyor (`npm run e2e:chat` = 0, 1/1, kendim
koşturdum). Ayrıca `tests/e2e-config-guard.test.ts` sabit listeden `readdirSync` taramasına
çevrilmiş ve bu **yapısal** — mutasyon D ile doğrulandı (§7). Bu, 2. turda reddedilen erteleme
gerekçesinin doğru yanıtı.

### Ö6 (yazma amplifikasyonu + sınırsız bellek) — **KAPANDI (koşullu kabul, belgelendi)**
2. turun koşulu yerine getirilmiş: `ADR-014` "Kabul edilen riskler" madde 4 ölçülmüş rakamları
(302 satır / 956.300 bayt, ~159×), **bellek ayağını** (`entries` üst sınırsız, `init()` tam
dosya okuması, `readPage()` her çağrıda katlama) ve **yeniden ele alınma eşiğini** (günlük
`history.jsonl` > 10 MB) içeriyor. Y5 böylece kapandı.

### Ö7'nin kalanı (araç satırları yenilemede görünmüyor) — **KABUL EDİLEBİLİR SAPMA (bloklayıcı değil)**

Kararım ve gerekçesi:

- **Bloklayıcı değil**, çünkü: veri kaybı yok (`history.jsonl`'de `kind:'tool'` girdileri
  duruyor, yalnızca istemci render etmiyor), oturum durumu bozulmuyor, kullanıcı akışında bir
  kilitlenme veya sessiz yarı-başarı üretmiyor. Ölçtüm: yenileme sonrası transkript metni,
  kullanıcı balonları ve akan cevap eksiksiz geliyor; kaybolan tek şey `✓ Bash tamamlandı (…)`
  bilgi satırı. Kullanıcı bir işlemi yanlış tamamlanmış sanmıyor — satır hiç yok, yanlış bilgi
  vermiyor.
- **Y1'den kategorik olarak farklı**: Y1 bir **karar bekleyen** durumu gizliyordu (kullanıcı
  eylemi gerekiyor, gizlenince oturum duruyor); Ö7'nin kalanı yalnızca **geçmiş bir olayın izini**
  gizliyor.
- **Ama borç olarak yazılı olmalı**: `docs/03-ux.md:327` araç/agent satırı için açıkça *"kalıcı
  kalır (silinmez) — kullanıcı geçmişe döndüğünde hangi agent'ın ne zaman çalıştığını görebilir"*
  diyor. Bu, yazılı UX'ten bilinçli bir sapmadır; Ö6 gibi `ADR-014`'ün "Kabul edilen riskler"
  bölümüne (yalnızca feature notuna değil) ve `docs/blockers.md`'ye girmelidir. Şu an yalnızca
  feature notunun "Kalan risk" paragrafında.

## 7. Mutasyon tablosu (bu turda bağımsız koşturuldu)

Yöntem: `cp` yedeği → mutasyonu uygula → ilgili testleri koştur → yedekten **birebir** geri yaz.
Tur sonunda `git status --porcelain` boş ve `grep -rn "MUTATION\|MUTASYON" src/ tests/` yalnızca
meşru test adını döndürüyor.

| # | Mutasyon | Hedef | Testler | Sonuç |
|---|---|---|---|---|
| **A** | `session.ts:523` `pending_permissions: [...pendingPermissions.values()]` → `[]` | Y1 **sunucu** çiti | `session.test.ts` | **KIRMIZI** (1 failed / 24) |
| **B** | `App.tsx:33` `chatUiEnabled = chat.status?.chat_enabled ?? false` → `= true` | Y2 çalışma-zamanı çiti | `App.chat-tab.test.tsx` | **KIRMIZI** (2 failed / 3) |
| **C** | `useChatSession.ts:144` fold anahtarından `::${entry.role}` çıkarılır | Y4 istemci fold çiti | `tests/features/chat/web` | **KIRMIZI** (1 failed / 21) |
| **D** | `e2e-config-guard.test.ts` `configFileNames()` yapısal `readdirSync` yerine eski sabit iki-dosyalık listeye döndürülür | F6 yapısal tarama | `e2e-config-guard.test.ts` | **KIRMIZI** (1 failed / 8 — `chat.spec.ts`) |
| **E** | `useChatSession.ts` `onChatStatus` gövdesinden `setPendingPermissions(...)` silinir | Y1 **istemci** çiti (SSE yolu) | `tests/features/chat/web` | **KIRMIZI** (2 failed / 21) |
| **F** | `useChatSession.ts:395` `onChatSync`'ten `void loadStatus()` silinir | Y1 **yenileme/yeniden bağlanma** yolu | **tüm paket** | **YEŞİL KALDI (855/855)** → §2 |

**Zorunlu dört mutasyonun (a,b,c,d) dördü de KIRMIZI**; developer'ın D iddiası (eski sabit listeye
dönünce kırmızı) **kendim doğruladım, doğru**. Ek mutasyon F, Y1'in kapanmadığını bağımsız olarak
gösteriyor: 2. turun bloklayıcısının **kalan yarısında hiçbir çit yok**.

## 8. Puanlama

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **6** / 10 | Ana akış, akış hâlinde cevap, izin kartı, karar, kalıcı geçmiş ve Y2 hepsi canlı çalışıyor; `dist/` artık zehirlenmiyor. Ama `docs/03-ux.md:443`'ün birebir senaryosunda (yenileme) bekleyen izin **hâlâ ekrana gelmiyor** ve kullanıcı bunu ancak ikinci bir mesajla kazara kurtarabiliyor. |
| Özellik bütünlüğü | **6** / 10 | AC1-AC3, AC5, AC6, AC8-AC10 karşılanıyor; AC7 hâlâ **kısmi** (bekleyen izin + araç satırları yenilemeden sonra gelmiyor). AC4'ün canlı iki yönlü kanıtı sözleşme §11.3'ün istediği kadansta **bu turda da alınamadı**. |
| Görsel / UX | **7** / 10 | Bariyer şeridi, izin kartı ve kolabe satırı, akış imleci, üretim CSS'i, sekme görünürlüğü — hepsi canlı doğru. Düşüren: yenileme sonrası kullanıcının ekranda bıraktığı izin/araç izlerinin sessizce kaybolması. |
| Kod kalitesi (test, hata yönetimi) | **5** / 10 | 855 test yeşil, altı mutasyonun beşi kırmızı, yapısal E2E config guard'ı gerçekten yapısal, sohbet ekranı artık sıfır kotayla tarayıcıda koşuyor. Buna karşılık: Y1'in yenileme yolu **hiç çitlenmemiş** (mutasyon F 855/855 yeşil), o yolu ölçtüğünü **yorumunda iddia eden** ama ölçmeyen bir test var (deponun tekrar eden ders sınıfı), ve canlı test dört koşudur kırmızı. |

**Herhangi biri < 7 → KALDI.** Üçü < 7.

## 9. Karar

**KARAR: KALDI. ESKALE: true.**

Bu üçüncü QA turu; süreç kuralı gereği karar kullanıcıya gider. Dürüst özet: düzeltme turu
**ilerleme kaydetti** — Y2 ve Y4 gerçekten kapandı, Ö5 ve Ö6 kapandı, sunucu tarafı Y1
düzeltmesi doğru ve çitli, üç test paketi de iddia edilen sayılarla yeşil. Kalan iki şey:

1. **Y1'in istemci yarısı** — tek satırlık bir yol hatası (`loadStatus` yanıtını `onChatStatus`
   indirgeyicisinden geçirmemek) + o yolu ölçmeyen bir test. Kullanıcıya görünen etki, 2. turda
   bloklayıcı sayılan etkiyle aynı sınıfta: karar bekleyen bir durum sessizce ekrandan siliniyor.
2. **Y3** — sözleşme §11.3'ün "her QA turunda en az bir kez" şartı dört turdur karşılanamıyor;
   testin model davranışına bağımlılığı azaltıldı ama **ortadan kalkmadı**.

Kullanıcı kararı için seçenekler (QA olarak tercihim (a)):

- **(a) Bir düzeltme turu daha, çok dar kapsamlı:** yalnızca Y1'in tek satırı + gerçek yolu
  (mount → stub `fetch` → kart) ölçen bir test + `chat.spec.ts`'e "bekleyen izin varken yenile"
  adımı. Bu üçü birlikte ~30 satır ve mevcut altyapıyla ölçülebilir; kalan her şey zaten yeşil.
- **(b) Y3'ü ayrı bir işe ayır:** canlı AC4 kanıtını model önerisine değil doğrudan hook
  tetiklemesine dayandırmak bir tasarım kararı; bu turun kapsamında çözülmesi gerçekçi değil.
  `ADR-014` M2 kadansı bu iş bitene kadar "karşılanmadı" olarak açık kalmalı.
- **(c) Y1'i bilinen sınırlama olarak kabul et:** QA olarak **önermiyorum** — `docs/03-ux.md:443`
  bu davranışı açıkça şart koşuyor ve düzeltme maliyeti tek satır.

## 10. Harcanan kota

| Kalem | Oturum | Maliyet |
|---|---|---|
| `MC_CHAT_LIVE_TESTS=1 npm run test:chat-live` × **1** (talimat: bir kezden fazla koşma) | 2 (E1 kolu + AC4'ün iki kolu; toplam 48,5 sn) | **ölçülmedi** (vitest maliyeti yüzeye çıkarmıyor); 2. turun ölçülmüş ~$0,03/oturum profilinden **~$0,06 tahmin** |
| Tarayıcı ölçümleri (Y1, Y2, Ö7) | 0 | **$0** — sahte `query()` enjekte edilmiş gerçek üretim sunucusu |
| `verify` / `e2e` / `e2e:chat` | 0 | **$0** |
| **Toplam** | | **~$0,06 (tahmin)** |

Model: canlı test `claude-haiku-4-5` (`chat-hooks-live.test.ts:114,189,252`).

## 11. Süreç ve port durumu

- 7333 / 7334 / 7433 / 7434 / 7435 / 7436 portlarında **LISTENING yok**.
- `tasklist` → kalan `node.exe`: **2**, ikisi de bu QA oturumunun kendi Playwright MCP sunucusu
  (`@playwright/mcp` — komut satırıyla doğrulandı). Yetim `npm run dev` / probe sunucusu **yok**;
  probe sunucusu (PID 41916) ölçüm sonunda kapatıldı.
- `claude-agent-sdk-win32-x64claude.exe` alt süreci: **0** — canlı test yetim bırakmadı.
- Depoya yazılanlar: bu rapor, `docs/qa/latest.md`, `docs/qa/screens/F-012-T3-*.png` (4 dosya),
  `docs/features/F-012-ceo-sohbet-arayuzu.md` yalnızca `status` satırı.
- `src/`, `tests/`, `package.json`, `vite.config.ts`, `playwright*.config.ts` **hiç değişmedi**
  (mutasyonlar yedekten geri alındı, `git status` temiz).
- Geçici dosyalar (probe logları, veri dizini) scratchpad'de kaldı, depoya girmedi.

## 12. Doğrulayamadıklarım

1. **AC4'ün canlı iki yönlü kanıtı** — tek koşu kırmızı, talimat gereği tekrarlanmadı.
2. **Dar genişlik, akış, bariyer, B2/B3, E1 güvenlik garantisi** — 1./2. turda GEÇTİ verilen
   maddeler, bu dar kapsamlı turda bilinçli olarak yeniden ölçülmedi.
3. **`AskUserQuestion` kartı** — üç turdur canlı tetiklenmedi.
4. **Ö6'nın uzun vadeli etkisi** — 2. turun sentetik ölçümü dışında gerçek kullanım verisi yok.
