KARAR: GEÇTİ
ESKALE: false

---
feature: F-012
title: CEO sohbet arayüzü — panel oturumu Agent SDK ile barındırır
reviewer: qa-evaluator
date: 2026-09-06
round: kapanış denetimi (tur 4, çok dar kapsam — üç madde)
previous: docs/qa/F-012-2026-09-06-tur3.md (KALDI — Y1 bloklayıcı, Y3 kırmızı, Ö7 kabul edildi)
---

# F-012 kapanış denetimi (tur 4)

## 0. Özet

**KARAR: GEÇTİ. ESKALE: false.**

Dördüncü tur olduğu için `ESKALE` bayrağı KALDI hâlinde `true` olacaktı; karar GEÇTİ olduğu için
eskale edilecek bir şey yok.

Bu tur yalnızca üç maddeye baktı. Üçü de tuttu:

| # | 3. tur bulgusu | İddia | Ölçüm sonucu |
|---|---|---|---|
| **Y1** | Bekleyen izin yenilemede kayboluyor (istemci `loadStatus` yanıtını indirgeyiciden geçirmiyor) | "`loadStatus` artık `onChatStatus`'tan geçiyor" | **KAPANDI** — canlı doğrulandı; mutasyon F artık **KIRMIZI** (§2) |
| **Y3** | Canlı hook testi model davranışına bağımlı, dört turdur kırmızı | "tanı dalı kaldırıldı + kota-sıfır doğrudan hook bloğu" | **KAPANDI** — kota-sıfır blok deterministik yeşil; AC4 canlı kolu **ilk kez yeşil** (§3) |
| **Paketler** | 859/57, 23/23, 1/1 iddiası | — | **DOĞRU** — üçü de kendim koşturuldu (§4) |

## 1. Ölçüm ortamı

| Ne | Değer |
|---|---|
| Çalıştırma | `npm run verify`'nin ürettiği `dist/` + gerçek üretim `createServer()`; `npm run dev` **hiç kullanılmadı** (bu ortamda `concurrently` ile bozuk) |
| Port / veri dizini | 7437, `MC_DATA_DIR=<scratchpad>/qa-data-t4` (depo `data/` kirletilmedi) |
| Tarayıcı | Playwright (Chromium), masaüstü genişliği |
| Sahte `query()` | `tests/e2e/helpers/chat-fake-server.ts` (ürün kodundaki `chatQueryOverride` dikişi) — tarayıcı ölçümlerinin kotası **$0** |
| Canlı SDK | yalnızca `MC_CHAT_LIVE_TESTS=1 npm run test:chat-live`, **tek koşu** (talimat gereği) |
| Ürün kodu değişikliği | **YOK** — mutasyonlar yedekten birebir geri alındı, `git status --porcelain` boş |
| Artık mutasyon | **yok** — `grep -rn "MUTATION\|MUTASYON" src/ tests/` yalnızca `tests/server/write-gate-manifest.test.ts:124` (meşru test adı) |
| Yeniden ölçülmeyenler | Akış, dar genişlik, bariyer, E1 güvenlik garantisi, B2, B3, Y2, Y4 — 1./2./3. turda GEÇTİ, talimat gereği açılmadı |

## 2. Y1 — KAPANDI (canlı doğrulandı + iki mutasyonla çitlendi)

### 2.1 Canlı tekrar üretme (gerçek Chromium, gerçek üretim sunucusu, sıfır kota)

1. `PORT=7437 MC_CHAT_ENABLED=1 MC_DATA_DIR=<scratchpad>/qa-data-t4 npx tsx tests/e2e/helpers/chat-fake-server.ts`
2. `http://127.0.0.1:7437/` → **Sohbet** sekmesi → mesaj gönder. Sahte CEO akan cevap verir,
   `Bash` (`ls -la`) için izin ister. Kart görünür, oturum bekler.
   Ekran: `docs/qa/screens/F-012-T4-01-y1-yenileme-oncesi-izin-karti.png`
3. Sunucu durumu 26 saniye boyunca 2 sn aralıkla yoklandı — bekleyen izin **kararlı** duruyor
   (kendiliğinden çözülmüyor, zaman aşımı yok):
   ```
   09:17:14.511 busy= true pending= 1 req_bb93d9bb-8c38-4633-89de-917b0fd445ef
   … (12 ölçüm, hepsi aynı) …
   09:17:40.469 busy= true pending= 1 req_bb93d9bb-8c38-4633-89de-917b0fd445ef
   ```
4. **Sayfa yenilendi** (`docs/03-ux.md:443`'ün birebir senaryosu), Sohbet'e dönüldü, 3 sn beklendi.

### 2.2 Beklenen

`docs/03-ux.md:443` — *"panel yeniden başlasa/sekme kapatılıp açılsa bile bekleyen izin isteği
geçmişte kaldığı hâliyle gösterilir."* Feature notu — *"kart geri gelir ve gerçekten
cevaplanabilir."*

### 2.3 Gerçek (ölçüldü)

Yenileme sonrası, hiçbir ek mesaj göndermeden:

```
document.querySelectorAll('[role="group"]').length = 1        <- KART VAR  (tur 3: 0)
role="group" adı: "İzin isteği"; içerik: "Komut: ls -la"
buton listesi: ["⚙ Ayarlar","Duraklat","Filtreleri temizle","Ayarlar'a git","✕",
                "Reddet","Onayla","Gönder","Ekle"]                <- Onayla/Reddet VAR (tur 3: YOK)
body.innerText "İzin isteği" içeriyor: true
```
Ekran: `docs/qa/screens/F-012-T4-02-y1-yenileme-sonrasi-izin-karti-GERI-GELDI.png`

**Cevaplanabilirlik ölçüldü** (tur 3'te ölçülemeyen asıl soru): yenileme sonrası gelen karttaki
**Onayla**'ya tıklandı →

```
GET /api/chat/status -> busy: false, pending_permissions: []   <- sunucu AYNI request_id'yi çözdü
DOM: "Onaylandı — ls -la çalıştı" kolabe satırı        (status rolü)
     "✓ Bash tamamlandı (1 dk 25 sn)" araç satırı
     "Klasörde iki dosya buldum, hazır."  <- tool_result sonrası kapanış cevabı akıp bitti
     "İzin isteği" DOM'da yok, kompozer aktif (disabled=false)
```
Ekran: `docs/qa/screens/F-012-T4-03-y1-yenileme-sonrasi-onaylandi-oturum-devam.png`

Yani tur 3'ün "kart yok → kullanıcı ancak ikinci bir mesajla kazara kurtarabiliyor" davranışı
ortadan kalktı: kart yenilemeden sonra geri geliyor, aynı `request_id` ile gerçekten
cevaplanıyor, tur normal tamamlanıyor ve oturum kilitlenmiyor.

### 2.4 Kök nedenin kapandığı yer (kod okundu)

```
src/features/chat/web/useChatSession.ts:388-397
  const loadStatus = useCallback(async () => {
      …
      onChatStatus(body.data)        // <- tur 3'te: setStatus(body.data)
  }, [fetchImpl, onChatStatus])
```
`onChatStatus` (`:372-385`) hem `setStatus`'u hem `setPendingPermissions`'ı kuruyor ve artık her
üç yol da (mount → `:417`, SSE `chat_sync` → `:428`, SSE `chat_status` olayı) aynı indirgeyiciden
geçiyor. `permissionDataRef` bu yüzden dosyanın üstüne taşınmış (`:319`) — kolabe satırının metni
`loadStatus` yolundan da doldurulabiliyor.

### 2.5 Mutasyonlar (kendim koşturdum)

| # | Mutasyon | Testler | Tur 3 | Tur 4 |
|---|---|---|---|---|
| **F** | `useChatSession.ts:428` — `onChatSync`'ten `void loadStatus()` silinir | **tüm paket** | **YEŞİL 855/855** | **KIRMIZI** — 1 failed / 858 passed, `ChatScreen.test.tsx:491` (`getByText('İzin isteği')` bulunamıyor) |
| **F2** | `useChatSession.ts:393` — `onChatStatus(body.data)` → `setStatus(body.data)` (düzeltmenin birebir geri sarılması) | `tests/features/chat/web` | — | **KIRMIZI** — 2 failed / 21 passed |

F2'yi ayrıca koşturdum çünkü F yalnızca **yeniden bağlanma** yolunu, F2 ise **mount/yenileme**
yolunu da vuruyor; ikisi de kırmızı olduğuna göre Y1'in her iki yarısı da çitli. Her iki mutasyon
sonrası dosya yedekten birebir geri yazıldı, `git status --porcelain` boş.

## 3. Y3 — KAPANDI

### 3.1 Kota-sıfır blok (bedava, `verify`'nin parçası) — **YEŞİL**

```
npx vitest run tests/integration/chat-hooks-live.test.ts     exit 0
  Test Files  1 passed (1)
       Tests  2 passed | 2 skipped (4)          675 ms
  ✓ yayın komutunu ÇIKIŞ KODU 2 ile "Engellendi" mesajıyla durdurur
  ✓ salt-okunur bir komutu (ls -la) engellemeden ÇIKIŞ KODU 0 ile geçirir
```

`tests/integration/chat-hooks-live.test.ts:104-119` `runHookDirect()`, gerçek
`.claude/hooks/block-dangerous.cjs`'i `spawnSync` ile ayrı bir Node alt süreci olarak,
PreToolUse'un göndereceği `{tool_input:{command}}` JSON'uyla besliyor ve çıkış kodunu okuyor.
Modelden, SDK'dan ve kotadan **tamamen** bağımsız; `describe.skipIf` ile sarılmamış, yani
**her `npm run verify` koşusunda** çalışıyor. `ADR-014` M2'nin "hook'ların engellediği otomatik
testle kanıtlanmalı; 'yükleniyor' testi kabul edilmez" şartı böylece koşulsuz olarak
karşılanıyor — bu tam olarak tur 3 §4'te önerdiğim iki model-bağımsız alternatiften biri.
İddia boş değil: iki yönü de (engelle / geçir) çıkış kodu + stderr ile doğrudan ölçüyor.

### 3.2 Canlı koşu (talimat gereği tek kez)

```
MC_CHAT_LIVE_TESTS=1 npm run test:chat-live       exit 1     (79,25 sn)
  Test Files  1 failed (1)
       Tests  1 failed | 3 passed (4)

  ✓ block-dangerous.cjs kota-sıfır × 2                            -> YEŞİL
  ✓ AC4 iki yönlü canlı kanıt (hook aktif / devre dışı)           -> YEŞİL  (tur 2-3: KIRMIZI)
  × E1/B5 canlı izin motoru testi                     18260ms     -> KIRMIZI (tur 3: YEŞİL)
      AssertionError: expected false to be true
      tests/integration/chat-hooks-live.test.ts:180  expect(sawPermissionRequest).toBe(true)
```

**Y3'ün hedefi olan test (AC4) ilk kez yeşil.** Sözleşme §11.3'ün "her QA turunda en az bir kez
alınan iki yönlü canlı kanıt" şartı **beş turdur ilk kez karşılandı**: aktif kolda canlı
oturumun gözlenen kararı, modelin **gerçekten önerdiği ham komutun** aynı hook betiğine doğrudan
verilmesiyle hesaplanan ground truth ile eşleşti (`:275`), devre dışı kolda hiçbir komut
engellenmedi (`:278`). "Model işaretleyici komutu önerdi mi" tanı dalı gerçekten kaldırılmış —
`git show d466044` ile doğrulandı.

**Kırmızının nedenini ayırdım (talimatın istediği): mekanizma değil, kardeş testin model
bağımlılığı.**
- Kırmızı, hook mekanizmasını ölçen bir iddiada değil; **E1/B5** testinde
  (`sawPermissionRequest === false`, yani model bu turda hiç `Bash` çağırmadı — 18 sn'de metinle
  cevapladı). Mekanizma hakkında ne olumlu ne olumsuz bir şey söylüyor.
- **Düzeltmenin ürünü değil:** E1/B5 test bloğunu düzeltme öncesi (`81276a8`) ve sonrası
  (`d466044`) sürümlerden çıkarıp `diff`'ledim — **byte-byte aynı**, hiç dokunulmamış. Aynı
  kırılganlık (persona + direktif systemPrompt yokluğu) orada başından beri vardı; tur 3'te
  zarla yeşil geldi, bu turda zarla kırmızı geldi.
- **Kapsam:** E1 güvenlik garantisi bu turda yeniden ölçülmeyecekler listesinde (1./2. turda
  GEÇTİ). Yapılandırma yarısının çevrimdışı çiti de var ve `verify`'de yeşil:
  `tests/features/chat/server/session.test.ts:487` "K3 çevrimdışı çit — allowManagedPermission
  RulesOnly gerçekten etkili" (`:499`, `:506` `permissions.ask:['Bash']`'ı da doğruluyor).
- Talimat gereği canlı test **tekrarlanmadı** (kota).

Kayda geçiyorum, bloklayıcı olarak açmıyorum (talimat: düzeltmenin kendisi üretmediyse yeni
bulgu açma): **E1/B5, AC4'ün kurtulduğu model-uyum kırılganlığını hâlâ taşıyor** — `agent:'ceo'`
personasıyla koşuyor ve AC4'e eklenen direktif `systemPrompt`'u almadı. Bir sonraki turda canlı
paketin kırmızı gelmesi muhtemel; kalıcı çözüm AC4'e uygulanan iki tedavinin (direktif prompt +
"araç çağrılmadı" durumunu kanıt-yok sayan dal) E1/B5'e de uygulanmasıdır.

## 4. Üç paket (iddiaya güvenilmedi, kendim koşturdum)

| Komut | Çıkış | Sayı | Developer iddiası |
|---|---|---|---|
| `npm run verify` | **0** | **859 geçti + 2 atlandı (861)**; **57 dosya** | 859 / 57 → **doğru** |
| `npm run e2e` | **0** (2. koşu) | **23/23** | 23/23 → **doğru** |
| `npm run e2e:chat` | **0** | **1/1** | 1/1 → **doğru** |

`verify` **ilk koşuda temiz** geçti (9,69 sn test + tipkontrol + lint + build); vitest worker fork
kararsızlığı bu turda görülmedi.

`npm run e2e` **ilk koşuda 22 geçti / 1 kırmızı** verdi:
`tests/e2e/kanban.spec.ts:261` (AC4 çakışma banner'ı, `:298 expect(banner).toHaveCount(0)`).
İkinci koşuda **23/23 yeşil**. F-012'nin dosya sahipliğinin tamamen dışında (Kanban/dosya
izleyici zamanlaması), bu turun düzeltmesiyle ilgisiz. Deponun `CLAUDE.md`'sindeki "kırmızıya
alışma, her görüldüğünde rapora yaz" kuralı gereği kayda geçiyorum: **kanban AC4 e2e'si
kararsız**, 1/2 koşuda kırmızı.

## 5. Ayrıca istenen iki tek satırlık kontrol

- **Mutasyon artığı temiz.** `grep -rn "MUTATION\|MUTASYON" src/ tests/` → tek sonuç
  `tests/server/write-gate-manifest.test.ts:124` (meşru test adı). Tur sonunda tekrar kontrol
  edildi, `git status --porcelain` boş.
- **Ö7 yazılmış, kod değişmemiş.** `ADR-014` "Kabul edilen riskler" **madde 5** (satır 102-116:
  `docs/03-ux.md:327` ile sapma, ne kaybolduğu, verinin `history.jsonl`'de durduğu, yeniden ele
  alınma eşiği) **ve** `docs/blockers.md:212`'deki açık madde. Her ikisi de davranışın
  değişmediğini, yalnızca belgelendiğini açıkça söylüyor; `git show` ile Ö7 için ürün kodu
  değişikliği olmadığı doğrulandı.

## 6. Kapsam dışı, bloklayıcı değil — kayda geçirilen tek gözlem

Canlı ölçüm sırasında tarayıcı konsolunda React `"Encountered two children with the same key"`
hatası biriktiğini gördüm (anahtar: `m:<turn_id>:text`). Kaynağı
`src/features/chat/web/ChatScreen.tsx:393`: render anahtarı `` `m:${entry.turn_id}:${entry.kind}` ``
— `role` içermiyor, dolayısıyla aynı turdaki kullanıcı mesajı ve CEO cevabı **aynı React
anahtarını** alıyor. Bu, B2'de `entryKey()` için düzeltilen hatanın (`::${entry.role}` eklenmesi,
`useChatSession.ts:142`) render tarafındaki ikizi.

**Bloklayıcı olarak açmıyorum**, çünkü:
- **Bu turun düzeltmesi üretmedi:** satır `42c3848` (F-012'nin ilk UI commit'i, 07:22) tarihli;
  `81276a8` ve `d466044` `ChatScreen.tsx`'e **hiç dokunmadı** (`git show --stat` ile doğrulandı).
- Talimat: "Yeni bulgu açma — ancak düzeltmenin kendisi yeni bir bloklayıcı ürettiyse aç."
- Görünen çıktı doğruydu: transkript ölçümlerimde kullanıcı balonu, CEO cevabı, araç satırı ve
  kolabe satırı eksiksiz ve doğru sırada render edildi.

Bir sonraki sohbet ekranı işine taşınması için buraya yazdım.

## 7. Puanlama

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **8** / 10 | Ana akış, akan cevap, izin kartı, karar, kalıcı geçmiş, `dist/` sekmesi zaten yeşildi; bu turda `docs/03-ux.md:443`'ün birebir senaryosu (bekleyen izinle yenileme) **canlı doğrulandı**: kart geri geliyor, aynı `request_id` ile cevaplanıyor, tur tamamlanıyor, oturum kilitlenmiyor. Tur 3'ün tek bloklayıcısı kapandı. |
| Özellik bütünlüğü | **8** / 10 | AC1-AC3, AC5, AC6, AC8-AC10 zaten karşılanıyordu; **AC7 artık tam** (bekleyen izin yenilemeden sağ çıkıyor); **AC4'ün iki yönlü canlı kanıtı beş turdur ilk kez alındı** ve ayrıca koşulsuz, kota-sıfır bir mekanizma kanıtı `verify`'ye girdi. Eksilten: Ö7 (araç satırları yenilemede render edilmiyor) bilinçli, belgelenmiş bir sapma olarak duruyor. |
| Görsel / UX | **8** / 10 | Bariyer şeridi, izin kartı, kolabe satırı, akış imleci, üretim CSS'i, sekme görünürlüğü, dar genişlik — önceki turlarda GEÇTİ. Bu turun kazancı: kullanıcının ekranda bıraktığı **karar bekleyen** durum artık yenilemeden sonra da duruyor. Eksilten: Ö7'nin geçmiş araç izleri hâlâ görünmüyor. |
| Kod kalitesi (test, hata yönetimi) | **7** / 10 | 859 test yeşil (57 dosya), Y1'in **her iki** yolu mutasyonla çitli (F ve F2 KIRMIZI; F tur 3'te 855/855 yeşil kalıyordu), hook mekanizması artık model-bağımsız ve kotasız kanıtlanıyor, `e2e`/`e2e:chat` yeşil, artık mutasyon yok, Ö7 hem ADR'ye hem `blockers.md`'ye yazılmış. Eksilten (ikisi de kapsam dışı/önceden var olan, bu turun ürünü değil): canlı paket kardeş test E1/B5'in model bağımlılığı yüzünden hâlâ exit 1 verebiliyor, ve `ChatScreen.tsx:393` render anahtarı `role` içermediği için React duplicate-key hatası üretiyor. |

**Eşik: herhangi biri < 7 → KALDI.** Dördü de ≥ 7.

## 8. Karar

**KARAR: GEÇTİ. ESKALE: false.**

Karar kuralının üç şartı da tuttu:
1. **Y1 canlı doğrulandı** (kart yenilemeden sonra geri geliyor **ve** cevaplanıyor, oturum
   kilitlenmiyor) **ve mutasyon F artık KIRMIZI** — üstelik düzeltmeyi birebir geri saran
   mutasyon F2 de KIRMIZI.
2. **Y3 deterministik:** kota-sıfır doğrudan hook bloğu her `verify`'de koşuyor ve iki yönü de
   çıkış koduyla ölçüyor; AC4'ün canlı iki yönlü kanıtı bu turda alındı. Canlı paketin exit 1'i
   dokunulmamış, önceden geçmiş ve kapsam dışı bir kardeş testin model uyumundan geliyor —
   ayrımı §3.2'de kanıtladım.
3. **Üç paket yeşil:** `verify` 859+2/57, `e2e` 23/23, `e2e:chat` 1/1.

Feature notu `status: done` yapıldı.

## 9. Harcanan kota

| Kalem | Oturum | Maliyet |
|---|---|---|
| `MC_CHAT_LIVE_TESTS=1 npm run test:chat-live` × **1** (E1/B5 + AC4'ün iki kolu; 79,25 sn) | 3 | **ölçülmedi** (vitest maliyeti yüzeye çıkarmıyor); tur 2'nin ölçülmüş ~$0,03/oturum profilinden **~$0,09 tahmin** |
| Kota-sıfır hook bloğu (`spawnSync`, gerçek betik) | 0 | **$0** |
| Tarayıcı ölçümleri (Y1 tam akış + yenileme + onay) | 0 | **$0** — sahte `query()` enjekte edilmiş gerçek üretim sunucusu |
| `verify` (×1) / `e2e` (×2) / `e2e:chat` (×1) / mutasyon koşuları (×3) | 0 | **$0** |
| **Toplam** | | **~$0,09 (tahmin)** |

Model: canlı test `claude-haiku-4-5` (`chat-hooks-live.test.ts:145,232`).

## 10. Süreç ve port durumu

- 7333 / 7334 / 7433 / 7434 / 7435 / 7436 / **7437** portlarında **LISTENING yok** (probe sunucusu
  PID 14420 ölçüm sonunda `taskkill //T //F` ile kapatıldı).
- `tasklist` → kalan `node.exe`: **2** (PID 50720, 48568) — ikisi de bu QA oturumunun kendi
  Playwright MCP sunucusu, oturum başındaki temel çizgiyle **aynı**. Yetim `npm run dev` veya
  probe sunucusu **yok**.
- `claude.exe` süreçleri: 16 adet, ama hepsinin `CreationDate`'i canlı testimden (12:12) **eski**
  (en yenisi 11:50:41) — canlı SDK testi yetim alt süreç **bırakmadı**.
- Depoya yazılanlar: bu rapor, `docs/qa/latest.md`, `docs/qa/screens/F-012-T4-*.png` (3 dosya),
  `docs/features/F-012-ceo-sohbet-arayuzu.md` yalnızca `status` satırı.
- `src/`, `tests/`, `package.json`, `*.config.ts` **hiç değişmedi**; mutasyonlar yedekten geri
  alındı, `git status --porcelain` boş. `git push` yapılmadı.
- Geçici dosyalar (probe logu, veri dizini, mutasyon yedekleri) scratchpad'de kaldı.

## 11. Doğrulayamadıklarım

1. **E1/B5'in canlı kanıtı bu turda** — model `Bash`'i hiç çağırmadı; yapılandırma yarısı
   `session.test.ts:487` K3 çevrimdışı çitiyle `verify`'de yeşil, canlı yarısı 1./2. turda
   GEÇTİ almıştı.
2. **Dar genişlik, akış, bariyer, B2/B3, Y2, Y4** — önceki turlarda GEÇTİ, talimat gereği
   yeniden ölçülmedi.
3. **`AskUserQuestion` kartı** — dört turdur canlı tetiklenmedi.
4. **Ö7'nin ve Ö6'nın gerçek kullanımdaki etkisi** — sentetik ölçümler dışında veri yok.
