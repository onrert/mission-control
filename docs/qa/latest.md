KARAR: KALDI
ESKALE: false

---
feature: F-011
title: Token kullanımı ekranı (proje / gün / oturum / agent grupları)
reviewer: qa-evaluator
date: 2026-09-10
round: düzeltme turu 2 (dar kapsam — yalnızca 1. tur bulguları)
verdict: KALDI
---

# F-011 QA raporu — düzeltme turu 2

**Puanlar:** İşlevsellik **5/10** · Özellik bütünlüğü **5/10** · Görsel/UX **5/10** ·
Kod kalitesi **6/10** → dördü de < 7, karar **KALDI**.

**Tek cümlelik özet:** BLOKLAYICI B1 (rakamın iki katına yakın şişmesi) **gerçekten kapandı ve
üçüncü parti araçla birebir doğrulandı** — ama Z4'ün üç sessiz kaybından **biri hâlâ tamamen
sessiz** (gerçek `icacls /deny` ile tokenların %94'ü kayboldu, uyarı yok), **ikincisi ise sürekli
yanlış alarm** veriyor (gerçek veride uyarı **her zaman** açık, çünkü normal transkript
satırlarının %33,8'i "tanınmayan" sayılıyor), ağ çiti yeni bir vektörle **kanıtlanmış canlı ağ
isteğiyle** yenildi ve 320px'te proje sütunu hâlâ **0 piksel**.

Ortam: Windows 11 · `npm run build && npx tsx src/server/index.ts` (`MC_PORT=4599` gerçek veri,
`MC_PORT=4601` sandbox) · Chromium (Playwright) · `npm run dev` KULLANILMADI · `git push`
yapılmadı · `git checkout` ile hiçbir mutasyon geri alınmadı (hepsi elle, md5 doğrulamalı).

---

## 0. Karar tablosu (CEO'nun kabul kuralına göre)

| # | İddia | Sonuç |
|---|---|---|
| Z1 | Tekilleştirme, 66/66 oturum `ccusage` ile birebir | ✔ **DOĞRULANDI** (67/68 oturum birebir; tek fark aktif oturum, farkın **%100'ü** ondan) |
| Z2 | Yapısal ağ çiti | ✘ **YENİLDİ** — 6 yeni vektörden 2'si geçti, **N1 gerçekten ağ isteği attı** (dinleyici kaydetti), 318/318 test yeşil |
| Z3 | Dolaylı yazma kapandı | ✔ **DOĞRULANDI** (5 vektörden 4'ü KIRMIZI; 5.'si kapsam dışı yola yazıyor — not) |
| Z4a | 32 MB kuyruk kırpması görünür | ✔ **DOĞRULANDI** (arayüzde uyarı) |
| Z4b | Okunamayan dosya görünür | ✘ **KAPANMADI** — gerçek `icacls /deny "(RA,RD,RX)"` ile **sessiz** (175→10 token, uyarı yok) |
| Z4c | Format değişimi görünür | ⚠ **KISMEN** — uyarı çıkıyor, ama aynı uyarı **gerçek veride de her zaman** çıkıyor (bilgi taşımıyor) |
| Z5 | 320px taşması giderildi, eşik kalibre | ✔ **DOĞRULANDI** (320-767px taşma 0, eşik 20px, mutasyon KIRMIZI) |
| Z6 | Sütun başlıkları | ✘ **YARIM** — başlıklar var ama 320px'te **proje sütunu hâlâ boş** (üstelik artık "PROJE" etiketi boşluğun üstünde duruyor) |
| Z7 | README yordamı | ✔ **DOĞRULANDI** — kendim uyguladım, çalıştı, sapma beklentisi **birebir** doğru çıktı |
| Testler | 1281 geçti / 4 skip | ✔ **DOĞRULANDI** (iki bağımsız koşuda da 1281, 84 dosya + 1 skip, e2e 54/54) |

---

## 1. Z1 — sayılar artık DOĞRU (bloklayıcı kapandı)

### 1.1 Sandviç ölçümü (bağımsız okuyucu → panel → bağımsız okuyucu)

Ürün kodundan tamamen ayrı kendi okuyucumla (233 dosya, 57.791 satır) aynı saniyelerde:

| Ölçüm | Toplam (4 alan) |
|---|---|
| Bağımsız betik (önce) | 2.748.688.768 |
| **Panel `/api/usage`** | **2.748.688.768** |
| Bağımsız betik (sonra) | 2.748.688.768 |

→ **Sapma 0,0000%.** Aynı verinin tekilleştirilmemiş ham toplamı **4.968.413.874** olurdu
(+%80,7) — yani düzeltme gerçekten devrede. 23.820 `assistant` satırı **12.911 gerçek API
çağrısına** karşılık geliyor.

### 1.2 `ccusage` (üçüncü parti) çapraz kontrolü — oturum oturum

`npx ccusage@latest session --json` (exit 0) çıktısı ile kendi oturum bazlı toplamlarımı
**tek tek** karşılaştırdım:

```
oturum sayısı: 68   BİREBİR eşit: 67   farklı: 1
benim toplam : 2.757.109.781
ccusage      : 2.493.082.582   (fark 264.027.199 = %10,59)
en büyük tek fark: b13e8d3f… → 264.027.199  →  toplam farkın %100,0'ı
```

`b13e8d3f…` **bu QA oturumunun kendisidir** (ölçüm sırasında büyüyen tek oturum). Yani ham
%10,59'luk sapmanın **tamamı** tek bir aktif oturumdan geliyor; **kapanmış 67 oturumun 67'si
üçüncü parti araçla BİREBİR eşit.** Developer'ın iddiası (66/66) bu turda 67/67 olarak
doğrulandı. Bu, "sandviç etkisi" gerekçesinin uydurma olmadığının kanıtıdır.

### 1.3 Kontrollü fixture

Sandbox'ta aynı `message.id`+`requestId`'yi taşıyan mükerrer satır (100 token) + tekil satırlar:
elle hesap **157/18**, panel **157/18** → mükerrer satır sayılmadı.

Tekilleştirme anahtarı `` `${messageId}\0${requestId}` `` (ayraç **NUL** baytı —
`transcript-reader.ts:224`); bu yüzden dosya `grep`'e "binary" görünüyor, `grep -a` gerekiyor.

---

## 2. BLOKLAYICI B1 (yeni, Z4b) — gerçek Windows ACL'inde okunamayan dosya HÂLÂ sessizce düşüyor

1. turun Ö2 bulgusu **aynı tekrar üretme adımlarıyla aynen tekrarlıyor**. Düzeltme yalnızca
`readTranscript`'in `file_read_failed` yolunu kapsıyor; gerçek `icacls /deny` bu yola **hiç
ulaşmıyor**.

**Tekrar üretme (sandbox, gerçek ACL — mock yok):**

```sh
# sandbox: 1 ana oturum (150 token) + 1 subagent (10 token) = 175 token, degraded:false
icacls sess-aaaaaaaa.jsonl /deny "pc:(RA,RD,RX)"
curl http://127.0.0.1:4601/api/usage
```

| | toplam token | unreadable_file_count | degraded | arayüzde uyarı |
|---|---|---|---|---|
| önce | 175 | 0 | false | yok |
| **sonra** | **10** | **0** | **false** | **YOK** |

Arayüzde (`.playwright-mcp/qa-f011-t2-z4b-eperm-sessiz-kayip.png`): "Toplam: **10** token",
"ana oturum" satırı agent kırılımından **tamamen silinmiş**, uyarı kutusu **hiç yok**.
**Tokenların %94,3'ü sessizce kayboldu.**

**Kök neden (kanıt, tahmin değil):**

```
fs.statSync(...)            → BAŞARILI (mtime okunuyor)
fs.existsSync(...)          → true
fs.realpathSync.native(...) → EPERM FIRLATIYOR
```

`usage-aggregator.ts:129-134` bu fırlatmayı `catch { return { unreadable: false } }` ile yutuyor
(yorumu "stat yarış durumu / best-effort atlama" diyor). Fırlatan çağrı
`resolveAllowedTranscriptPath` içindeki **sarılmamış** `fs.realpathSync.native`
(`src/features/thread/server/transcript-reader.ts:343`) — path guard'ın kendisi.

**Sayaç hiç erişilemez değil:** yalnızca `RD` reddedilirse (`icacls /deny "pc:(RD)"`)
`realpath` başarılı olur, `readFileSync` patlar, `unreadable_file_count:1` + `degraded:true`
doğru çalışır. Yani düzeltme **bir ACL şeklini** kapatmış, 1. turda ölçülen **asıl şekli**
açık bırakmış. Antivirüs kilidi/ağ sürücüsü/salt-okunur paylaşım senaryolarında beklenen davranış
`RA` reddi olan şekildir.

**Muhtemel dosya:satır:** `src/features/usage/server/usage-aggregator.ts:129-135`
(best-effort `catch`, hangi hatanın "gerçek okuma hatası" olduğunu ayırt etmiyor) +
`src/features/thread/server/transcript-reader.ts:340-343` (guard'ın `existsSync`/`realpath`
çağrıları sarılı değil).

---

## 3. BLOKLAYICI B2 (yeni, Z4c'nin yan etkisi) — "veri eksik olabilir" uyarısı gerçek veride HER ZAMAN açık

Z4/Ö1 düzeltmesi uyarı eşiğini "ayrıştırılabilen" orandan **"tanınan"** orana çevirdi
(`unrecognizedLines = linesBad + unknownTypeLines`, `usage-aggregator.ts:321`). Ama "tanınan"
kümesi yalnızca 4 tip: `user`/`assistant`/`system`/`summary`
(`transcript-reader.ts:27`). Gerçek transkriptlerde bu kümenin dışındaki tipler **normaldir**:

```
TOPLAM 57.795 satır   assistant 41,2%  attachment 26,4%  user 24,3%
queue-operation 1,9%  agent-setting 1,2%  last-prompt 1,1%  atis-latch 1,1%
bridge-session 0,8%   system 0,7%  custom-title 0,6%  mode 0,6%  …
→ "tanınmayan" 19.547 satır = %33,8   →   oran 0,662 < 0,99  →  degraded:true HER ZAMAN
```

Bu tiplerin normal olduğu deponun **kendi wiki'sinde** zaten yazılı
(`docs/wiki/pages/desen/claude-transcript-formati.md:76-100`, "✓ DOĞRULANDI", `attachment 13445`
… "geri kalan 9 tip atlanır ve sayılır — throw etmez").

**Canlı kanıt (üretim verisi, 1280px):**
`⚠ Toplam 57.808 satırdan 19.552 tanesi tanınmadı — veri eksik olabilir.`
(`.playwright-mcp/qa-f011-t2-1280-uyari.png`) — oysa **hiçbir veri eksik değil**: aynı anda
kendi bağımsız toplamım ve `ccusage` panelin rakamını **birebir** doğruluyor (§1).

**Neden bloklayıcı:**
1. Panelin tek varlık gerekçesi rakamına güvenilmesi; ekran, doğru olduğu kanıtlanmış rakamın
   yanında kalıcı olarak "veri eksik olabilir" diyor.
2. `README.md:146-148`'in çapraz kontrol yordamı kullanıcıyı tam olarak bu uyarıya yönlendiriyor
   ("sapma birden fazla tamamlanmış oturuma yayılıyorsa panelin 'veri eksik olabilir' uyarısını
   kontrol edin") — uyarı her zaman açık olduğu için yordamın son adımı **hiçbir şey ayırt
   etmiyor**.
3. Asıl amaç olan **format değişimi** sinyali (Z4c) böylece **ölü doğdu**: format değişip ekran
   "Toplam: 0 token" gösterdiğinde de aynı uyarı çıkıyor, kullanıcı zaten aylardır aynı uyarıyı
   görüyor. Bu, deponun "kapının yanlış pozitifi kapıyı öldürür" dersinin tam örneği.
4. AC4 "tanınan satır oranı **düştüğünde**" diyor; %66,2 bir düşüş değil, **sabit taban**.
   Eşik (0,99) eski metriğe göre kalibre edilmiş, metrik değişince yeniden kalibre edilmemiş.

**Muhtemel dosya:satır:** `usage-aggregator.ts:54` (eşik), `:320-324` (oran hesabı) —
"tanınan" tanımı `usage` taşıyabilecek satır tiplerini değil, okuyucunun 4 tipini kullanıyor.
`docs/03-ux.md:299-303` de aynı tanımı yazdığı için **sözleşme metni de düzeltilmeli**.

---

## 4. BLOKLAYICI B3 (Z2) — yapısal ağ çiti yeni bir vektörle yenildi, sızıntı CANLI kanıtlandı

1. turun **8 sondasının 8'i de artık KIRMIZI** (aşağıdaki tablo) — bu gerçek bir ilerleme.
Ama çit bir **metin/regex taraması** olduğu için import ifadesi kurmayan yollar görünmez.

| # | Sonda | 1. tur | 2. tur |
|---|---|---|---|
| P1 | `fetch('http://…')` | KIRMIZI | **KIRMIZI** |
| P2 | `globalThis.fetch(…)` | KIRMIZI | **KIRMIZI** |
| P3 | `http.get(…)` | YEŞİL ✘ | **KIRMIZI** ✔ |
| P4 | `net.connect(…)` | YEŞİL ✘ | **KIRMIZI** ✔ |
| P5 | `dns.lookup(…)` | YEŞİL ✘ | **KIRMIZI** ✔ |
| P6 | `execFileSync('curl', …)` | YEŞİL ✘ | **KIRMIZI** ✔ |
| P7 | dinamik `import('node:https')` | YEŞİL ✘ | **KIRMIZI** ✔ |
| P8 | yakalanmış `http.request` referansı | YEŞİL ✘ | **KIRMIZI** ✔ |
| **N1** | **`createRequire(import.meta.url)('node:http').get(…)`** | — | **YEŞİL ✘ (çiti YENDİ)** |
| **N2** | **`process.binding('tcp_wrap')` (hiç import yok)** | — | **YEŞİL ✘ (çiti YENDİ)** |
| N3 | `Function('return imp'+'ort("node:https")')` | — | KIRMIZI (dolaylı: koşu unhandled rejection ile patlıyor, çit yakalamıyor) |
| N4 | `globalThis['fet'+'ch'](…)` | — | KIRMIZI (statik çit değil, **çalışma zamanı casusu** yakaladı) |
| N5 | `eval('fet'+'ch')(…)` | — | KIRMIZI (aynı casus) |
| N6 | `createRequire(…)('node:child_process').execFileSync('curl')` | — | KIRMIZI |

**N1 yalnızca "çit görmedi" değil — GERÇEKTEN ağ isteği attı.** Yerel bir dinleyici açıp
`computeUsageReport`'u `tsx` ile çağırdım:

```
SUNUCUYA GELEN İSTEKLER: ["/QA-N1-LEAK"]
vitest: 318 passed (318)   ← tests/features/usage + no-external-host + no-write-gate-bypass
```

Yani `src/features/usage/server/**` içine `node:module`'ün `createRequire`'ı ile bir HTTP
istemcisi sokulabiliyor, **hiçbir test kırmızı vermiyor** ve istek gerçekten gidiyor.
`node:module` `FORBIDDEN_MODULES` listesinde yok
(`tests/features/usage/server/network-capability-guard.test.ts:35-44`) ve `require(`/
`process.binding(` desenleri hiç aranmıyor. AC4 ("hiçbir ağ isteği atılmaz") için kurulan çit,
kendi belgelediği güvenceyi vermiyor.

**Not:** N4/N5'i **statik çit değil**, `usage-aggregator.test.ts:325-361`'deki çalışma zamanı
casusu yakaladı — yani `fetch` ailesi için iki katman var, `require` ailesi için sıfır katman.

---

## 5. BLOKLAYICI B4 (Z6) — 320px'te proje sütunu hâlâ 0 piksel, üstelik artık "PROJE" etiketi boşluğun üstünde

Sütun başlıkları eklendi ve `docs/03-ux.md:322-330` mockup'ıyla **metin olarak birebir**
(`Proje · Gün · Giriş · Çıkış · Dağılım`; ekranda CSS `uppercase` ile `PROJE/GÜN/GİRİŞ/ÇIKIŞ/
DAĞILIM` — Türkçe locale'de doğru büyüyor, marka bozulması yok).

Ama 1. turun Ö7'sinin **ikinci yarısı kapanmamış.** Kendi ölçümüm (üretim verisi, 5 satır):

| Genişlik | Başlıktaki "Proje" sütunu | Satırlardaki proje hücresi |
|---|---|---|
| **320px** | 95 px | **0, 0, 0, 0, 0 px** (5/5 satır **tamamen boş**) |
| 375px | 150 px | 44, 23, 23, 44, 23 px (kırpılmış) |
| 1280px | 1055 px | ~930 px |

Ekran görüntüsü: `.playwright-mcp/qa-f011-t2-320-proje-sutunu-bos.png` — "PROJE" başlığının
altındaki beş satır boş; başlık ile veri sütunları **hizalanmıyor** (başlık `1fr` alanını 95px
gösterirken satırlarda aynı alan 0px'e çöküyor, çünkü satırdaki `auto` sütunlar — `2026-09-04`,
`248.017` — daha geniş). Başlık eklenmesi bu hatayı **görünür kılmakla kalmadı, yanlış bir vaat
de ekledi**: kullanıcı etiketli ama boş bir sütun görüyor.

`docs/03-ux.md:17`'ye göre 320px **birincil senaryo**; bu ekranda proje filtresi olmadığı için
satırın hangi projeye ait olduğu tek ayırt edici bilgidir.

**Muhtemel dosya:satır:** `src/features/usage/web/UsageScreen.tsx:200` (başlık grid) ve `:222`
(satır grid) — aynı `grid-cols-[1fr_auto_auto_auto_auto]`, ama içerik genişlikleri farklı
olduğu için iki grid **birbirinden bağımsız** hizalanıyor.

---

## 6. Doğrulanan düzeltmeler (developer haklıydı)

### Z3 — dolaylı yazma kapandı ✔
Sonuç-tabanlı manifest testi (`usage-read-only-manifest.test.ts`) 1. turun kaçağını kapatıyor:

| # | Yazma vektörü | Sonuç |
|---|---|---|
| W1 | `fs['w'+'riteFileSync'](taranan kök)` — 1. turda YEŞİL'di | **KIRMIZI** ✔ |
| W2 | `fs.promises.writeFile` (asenkron) | **KIRMIZI** ✔ |
| W3 | `fs.createWriteStream` | **KIRMIZI** ✔ |
| W5 | `createRequire('node:fs').writeFileSync` | **KIRMIZI** ✔ |
| W4 | dolaylı yazma → **`process.cwd()`** (anlık görüntü kapsamı dışı) | YEŞİL — dosya gerçekten oluştu (`qa-w4.txt`, silindi) |

W4 Thread emsalinin de bilinen sınırı (anlık görüntü yalnızca iki hedef dizini kapsıyor);
**not**, bloklayıcı değil — 1. turun bulgusu (taranan köke dolaylı yazma) kapandı.

### Z4a — 32 MB kuyruk kırpması ✔
Gerçek 70 MB fixture (73.401.154 bayt, 67.609 satır, gerçek toplam 6.760.900 input token):
panel **3.089.857** gösterdi (%54,3 kayıp) **ve** arayüzde
`⚠ 1 dosya çok büyük olduğu için kırpıldı (yalnızca son 32 MB okundu) — toplam eksik olabilir.`
(`.playwright-mcp/qa-f011-t2-z4a-kirpma-uyarisi.png`). Sessiz değil.

### Z4c — format değişimi artık sessiz değil (ama §3'e bakınız)
Sandbox'ta tüm `type:"assistant"` → `assistant_message`: ekranda "Toplam: 0 token" **+**
`⚠ Toplam 4 satırdan 4 tanesi tanınmadı — veri eksik olabilir.`
(`.playwright-mcp/qa-f011-t2-z4c-format-degisti.png`). Mekanizma çalışıyor; sorun eşiğin gerçek
veride sürekli tetiklenmesi (B2).

### Z5 — 320px taşması gerçekten gitti ✔
Kendi kırpılmış-genişlik ölçümüm (üretim 6 sekme, gerçek Chromium):

| Genişlik | Sekme şeridi taşması | En dar sekme (Token) |
|---|---|---|
| 280px | 18 px | **12 px** (kırpılmış; 1. turda 0 px — iyileşti, hâlâ kıymık, aralık dışı) |
| **320px** | **0 px** | **30 px** (1. turda 21 px taşma / 12 px idi) |
| 360 / 375 / 480 / 640 / 700 / 767px | 0 px | 30 px |
| 1024px | 0 px | 42 px |

E2E eşiği artık anlamlı: `MEANINGFUL_MIN_TAB_WIDTH = 20` **+** `scrollWidth <= clientWidth`
(`tests/e2e/usage.spec.ts:76,97,104`) — `> 0` değil. `App.tsx`'teki yanlış yorum düzeltilmiş
(satır 130-137 açıkça "yukarıdaki iddia YANLIŞTI, 21px taşma vardı" diyor). **Nit:** iç yorum
hâlâ `gap-1` diyor, sınıf `gap-0.5` (satır 163) — bayat cümle, davranışı etkilemiyor.

### Z7 — README yordamı KENDİM uyguladım, çalışıyor ✔
Adım 1 (98 oturum kimliği) → adım 2 (`npx ccusage@latest session --json`, exit 0, 98 oturum) →
adım 3 (kesişim toplamı **2.493.082.582**). Sapma %10,59, ve README'nin dürüstlük iddiası
(**"tamamı o tek büyüyen oturumdan"**) ölçümle **birebir** doğrulandı (farkın %100,0'ı tek
oturumdan, §1.2). Yordam uygulanabilir, kapsam farkı (`daily` proje filtresi almaz) doğru
anlatılmış. **AC6 sağlanıyor.**

---

## 7. Mutasyon tablosu (11 bağımsız + 14 ağ + 5 yazma sondası)

| # | Mutasyon | Dosya | Sonuç |
|---|---|---|---|
| M1 | Z1 tekilleştirme kaldırıldı (`alreadyCounted = false`) | `transcript-reader.ts:226` | **KIRMIZI** (2) |
| M1b | dedup anahtarı zayıflatıldı: yalnızca `requestId` | `transcript-reader.ts:224` | YEŞİL — **eşdeğer mutant**: gerçek veride 23.929 satırda `message.id` ↔ `requestId` **1:1** (0 çakışma), davranış farkı yok |
| M2 | **transitif** dosyaya yasak import (`node:net` → `transcript-reader.ts`) | `transcript-reader.ts:26` | **KIRMIZI** (1) — grafik derinliği gerçek |
| M3 | Z3 dolaylı yazma `fs['w'+'riteFileSync']` | `usage-aggregator.ts:244` | **KIRMIZI** (1) |
| M4 | Z4 uyarı görünürlüğü `report.degraded &&` → `false &&` | `UsageScreen.tsx:164` | **KIRMIZI** (4) |
| M5 | Z4 kırpma sayacı iptal | `usage-aggregator.ts:270` | **KIRMIZI** (1) |
| M6 | **düzeltmeyi birebir geri sarma**: `unrecognizedLines = linesBad` (eski davranış) | `usage-aggregator.ts:321` | **KIRMIZI** (1) |
| M7 | Z4/Ö2 okunamayan dosya sayacı iptal (**iki döngüde de**) | `usage-aggregator.ts:192,219` | **KIRMIZI** (1) |
| M8 | Z6 sütun başlığı metni bozuldu (`Proje`→`ProjeXX`) | `UsageScreen.tsx:202` | **KIRMIZI** (1) |
| M9 | Z5 dar-genişlik CSS'i geri alındı (`gap-0.5`→`gap-1`, `tracking-tighter` silindi) | `App.tsx:163,177` | **KIRMIZI** (E2E 2 test: 320px `317 > 304`, 280px `0 px`) |
| P1-P8 | 1. turun ağ sondaları | `usage-aggregator.ts` | **8/8 KIRMIZI** ✔ |
| N1-N6 | yeni ağ vektörleri | `usage-aggregator.ts` | 4 KIRMIZI / **2 YEŞİL ✘** (N1 canlı sızıntı kanıtlı) |
| W1-W5 | yazma vektörleri | `usage-aggregator.ts` | 4 KIRMIZI / 1 YEŞİL (kapsam dışı yol) |

Geri alma: `git checkout` **kullanılmadı**; her mutasyon scratchpad'teki `.bak` kopyasından elle
geri yazıldı, `md5sum -c` üç dosyada da **OK**, `git status` temiz
(`.claude/agent-memory/developer/**` bu QA turuna ait değil, developer'ın kendi commit'siz notu).

`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` → yalnızca **meşru test adları**
(`gates-manifest.test.ts:222`, `feature-detail.test.ts`, `thread-read-only-manifest.test.ts:61`,
`transcript-reader.test.ts:124/220`, `transcripts-privacy-guard.test.ts`,
`usage-read-only-manifest.test.ts:69`, `write-gate-manifest.test.ts:124`, `features-api.test.ts`)
— hiçbirine dokunulmadı.

---

## 8. Koşulan test sayısı (⚠ `docs/blockers.md` uyarısı gereği)

| Koşu | Sonuç |
|---|---|
| `npm run verify` (1. koşu) | **exit 0** · Test Files **84 passed \| 1 skipped (85)** · Tests **1281 passed \| 4 skipped (1285)** |
| `npx vitest run` (2. bağımsız koşu) | **exit 0** · aynı: **84 \| 1** ve **1281 \| 4** |
| `npx playwright test` | **exit 0** · **54 passed** |

Developer'ın bildirdiği sayılarla **birebir aynı**; bu turda "sessizce atlanan test" gözlenmedi
(iki koşu da aynı sayıyı verdi). `--no-file-parallelism` **kullanılmadı**, worker-fork çökmesi
bu turda **hiç** görülmedi.

---

## 9. Kanıt dosyaları

- `.playwright-mcp/qa-f011-t2-1280-uyari.png` — üretim, doğru rakam + **kalıcı yanlış uyarı** (B2)
- `.playwright-mcp/qa-f011-t2-320-proje-sutunu-bos.png` — 320px, "PROJE" başlığı altında 5 boş satır (B4)
- `.playwright-mcp/qa-f011-t2-z4a-kirpma-uyarisi.png` — 70 MB kırpma uyarısı görünür (Z4a ✔)
- `.playwright-mcp/qa-f011-t2-z4b-eperm-sessiz-kayip.png` — gerçek `icacls /deny`, %94 kayıp, **uyarı yok** (B1)
- `.playwright-mcp/qa-f011-t2-z4c-format-degisti.png` — format değişimi → 0 token **+ uyarı** (Z4c)

Ölçüm betikleri depoya **girmedi** (scratchpad): `indep2.cjs`, `netprobe.cjs`, `leakproof.cjs`,
`writeprobe.cjs`, `mutate2.cjs`, `mutate2b.cjs`, `make-sandbox2.cjs`.

⛔ Depoya hiçbir gerçek transkript içeriği bırakılmadı. Sandbox (`%TEMP%\mcqa11b`) yalnızca
sentetik veri içerir ve depo dışındadır (silme komutu `block-dangerous` hook'una takıldığı için
**onay istemeden silinmedi**; içinde gerçek veri yok). 70 MB'lık fixture silindi.

**Süreçler:** açtığım iki sunucu (`4599`, `4601`) kapatıldı, portlar boş. Kalan `node.exe`
süreçleri: **2 adet Playwright MCP** (araç altyapısı) + **3 adet `C:\dev\apps\hayat-mentoru`
(`npm run dev` → `next dev`)** — **dokunulmadı**. Bu turdan **yetim süreç: 0**.

---

## 10. KALDI'yı kaldırmak için gereken minimum

1. **B1** — best-effort `catch`'te "gerçek erişim hatası" (EPERM/EACCES/EBUSY) ile "yarış durumu"
   (ENOENT) ayrılsın; guard'ın `realpath`/`existsSync` fırlatması `unreadable_file_count`'a
   sayılsın. Çit: **`(RA,RD,RX)` reddi** ile gerçek bir ACL testi (RD-only zaten geçiyor, tek
   başına yetersiz).
2. **B2** — "tanınan" tanımı yeniden kalibre edilsin: ya bilinen-normal tipler (`attachment`,
   `queue-operation`, `agent-setting`, `last-prompt`, `atis-latch`, `bridge-session`,
   `custom-title`, `mode`, `permission-mode`, `file-history-snapshot`) tanınan kümeye alınsın,
   ya da uyarı yalnızca **`usage` taşıması beklenen** satırların kaybına bağlansın. Çit:
   **gerçek dağılımı (%33,8 "diğer tip") taşıyan bir fixture'da `degraded:false` olmalı**, format
   yeniden adlandırıldığında `true`. `docs/03-ux.md:299-303` de düzeltilsin.
3. **B3** — çite `node:module`/`createRequire`/`require(`/`process.binding(` desenleri eklensin
   (ya da beyaz liste: `src/features/usage/server/**` yalnızca `node:fs`, `node:path` import
   edebilir — beyaz liste kara listeden daha dayanıklı). Çit: N1 ve N2 sondaları kalıcı negatif
   kontrol olarak test dosyasına girsin.
4. **B4** — 320px'te proje sütunu okunur kalsın (ör. dar genişlikte iki satırlı hücre ya da
   başlık+satır için **tek** grid şablonu). Çit: 320px'te proje hücresinin kırpılmış görünür
   genişliğinin `> 0` **ve** başlıkla hizalı olduğunu ölçen bir E2E iddiası.
5. Nit (bloklayıcı değil): `App.tsx:157-163` içindeki bayat `gap-1` yorumu;
   `usage-table-header` `aria-hidden="true"` olduğu için ekran okuyucuya sütun bağlamı hâlâ
   gitmiyor.
