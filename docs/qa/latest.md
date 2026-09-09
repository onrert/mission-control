KARAR: GEÇTİ
ESKALE: false

---
feature: F-011
title: Token kullanımı ekranı (proje / gün / oturum / agent grupları)
reviewer: qa-evaluator
date: 2026-09-09
round: nihai kapanış kontrolü (tur 7 — yalnızca CC1/CC2)
verdict: GEÇTİ
---

# F-011 QA raporu — tur 7 (nihai kapanış: CC1, CC2)

**Puanlar:** İşlevsellik **9/10** · Özellik bütünlüğü **9/10** · Görsel/UX **8/10** ·
Kod kalitesi **7/10** → hepsi ≥ 7, karar **GEÇTİ**.

**Tek cümlelik özet:** Tur 6'nın bloklayıcısı (CC1 — modül-yükleme-zamanlı yakalanmış
`process.binding` referansı) gerçekten kapandı: **birebir aynı sondayı** tekrarladım, artık
**KIRMIZI**; sıra bağımlılığını da kendim ölçtüm (precapture import'u ürün import'unun altına
alınınca **aynı sızıntı 54/54 YEŞİL**'e dönüyor ve dinleyiciye 26 gerçek TCP + 22 HTTP isteği
teslim ediliyor) — yani düzeltme kozmetik değil, taşıyıcı. CC2 (`restore()` ile sessiz öldürme)
de kapandı: tur 6'da 54/54 yeşil kalan `calls.length = 0` mutasyonu artık KIRMIZI. Denediğim
dört sessiz-öldürme yolunun dördü de KIRMIZI verdi. **Precapture modülü yerindeyken pratik canlı
sızıntı bulamadım.**

Ortam: Windows 11 · Node v24.15.0 · `npm run dev` **kullanılmadı** · `git push` yapılmadı ·
`git checkout` **kullanılmadı** (her mutasyon scratchpad `bak/` kopyasından elle geri yazıldı,
md5 doğrulandı) · `--no-file-parallelism` **kullanılmadı**.

---

## 0. Karar tablosu

| Brief'in sorusu | Sonuç |
|---|---|
| CC1 — tur 6'nın yakalanmış-referans sondası precapture yerindeyken KIRMIZI mı? | ✔ **KIRMIZI** (§1.1) |
| CC1 — sıra bağımlılığı gerçek mi (import sonraya alınınca yeşile dönüyor mu)? | ✔ **TEYİT** — 54/54 yeşil + 26 canlı bağlantı (§1.2) |
| CC1 — precapture'dan ÖNCE yakalama gerektiren varyant var mı? | ⚠ **Ürün yüzeyinde YOK** — yalnızca vitest `setupFiles`/çalıştırıcı katmanında düşünülebilir; **kabul edilmiş sınır** (§4) |
| CC2 — `restore()` içinde `calls.length = 0` artık KIRMIZI mı? | ✔ **KIRMIZI** (§2.1) |
| CC2 — başka sessiz öldürme yolu (anlık görüntüyü boşaltma / assert sırası / örnek değiştirme) | ✔ **Üçü de KIRMIZI** (§2.2) |
| Pozitif kontrol ile ana test aynı **fabrikaya** bağlı mı? | ✔ **EVET** — fabrika mutasyonu pozitif kontrolü kırıyor (§2.3) |
| **Pratik canlı sızıntı (precapture yerindeyken)** | ✔ **YOK** → bloklayıcı yok |
| Yanlış pozitif | ✔ **YOK** — sonda kaldırılınca 54/54, dinleyiciye **0** istek (§3) |
| Test sayısı | ✔ `verify` **1305 passed \| 4 skipped (1309)** ×2 koşu · `e2e` **55 passed** (§3) |
| Sonda/mutasyon kalıntısı, `git status` | ✔ **Temiz** (§5) |

---

## 1. CC1 — yakalanmış `process.binding` referansı

### 1.1 Tur 6'nın sondası birebir tekrarlandı → **KIRMIZI ✔**

Tur 6 §1.3'ün vektörünün aynısı ürün koduna (`src/features/usage/server/usage-aggregator.ts`)
kondu — hiçbir test dosyası değiştirilmeden:

1. **Modül gövdesinde** (fonksiyon içinde değil) referans yakalanıyor:
   `const qaBindingCaptured7 = qaProc7.binding.bind(qaProc7)`
2. `computeUsageReport`'un ilk satırından çağrılan `qaLeak7()`, yakalanmış referansla
   `tcp_wrap` + `stream_wrap` alıp ham `TCP` handle kuruyor ve `127.0.0.1:45922`'ye tam bir HTTP
   istek satırı yazıyor. Hata **yutuluyor** (`catch {}`) — fırlatmaya dayalı tespiti kırmak için.

```
npx tsc --noEmit                                          → exit 0
npx eslint src/features/usage/server/usage-aggregator.ts  → exit 0
npx vitest run tests/features/usage/server
  × GERÇEK computeUsageReport … HİÇBİRİ çağrılmaz (birincil davranış katmanı)
    AssertionError: expected [ 'process.binding', …(23) ] to deeply equal []
  Tests  1 failed | 53 passed (54)
```

Kırılan iddia **`expect(qaPreCalls).toEqual([])`** (`usage-aggregator.test.ts:501`) — yani tam
olarak CC1 için eklenen katman yakalıyor; `capturedCalls` (sentinel) bu biçimi hâlâ göremiyor,
beklendiği gibi. Aynı koşuda dinleyiciye 26 gerçek bağlantı + 26 istek gitti (aynı dosyadaki
sentinel'siz testler de ürün kodunu çağırıyor) — **ama çit KIRMIZI**, yani CI durur, sızıntı
görünür olur. Tur 6'daki durum bunun tersiydi (tam takım yeşil).

### 1.2 Sıra bağımlılığı **kendim doğruladım** → **TEYİT ✔**

Sonda yerinde kalırken **tek** değişiklik yaptım: `import { qaPreCalls } from
'./network-precapture-sentinel'` satırını ürün import'unun (`computeUsageReport`) **altına**
taşıdım (test dosyası satır 4 → satır 16):

```
npx vitest run tests/features/usage/server → Tests  54 passed (54)        ← TAMAMEN YEŞİL
dinleyici (127.0.0.1:45922): 26 RAW-TCP-CONNECT + 22 RAW-DATA
  "GET /CANLI-TUR7-CC1-yakalanmis-binding HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
```

Developer'ın iddiası (**"aynı leak + precapture importu üründen sonraya alınınca 54/54 YEŞİL"**)
**birebir doğrulandı**. Bu, düzeltmenin ESM değerlendirme sırasına dayandığının ve gerçekten yük
taşıdığının kanıtı. Test dosyası ardından `bak/` kopyasından geri yazıldı (md5
`82f9e6a27e215f2aaab1b8c72cf17e90`, başlangıç değeri).

> **⚠ Borç (bloklayıcı DEĞİL, §5'te kayıt):** bu sıra yalnızca bir **yorumla** korunuyor.
> `usage-aggregator.test.ts`'in ilk import'unun `network-precapture-sentinel` olduğunu **hiçbir
> test iddia etmiyor**. Yukarıdaki ölçüm, sıranın bozulmasının maliyetinin tam bir sessiz koruma
> kaybı olduğunu gösteriyor. CLAUDE.md'nin kendi kuralı burada birebir geçerli: *"aynı bulgu bir
> sonraki feature'da yine çıkacaksa çiti feature'a değil yapıya koy."* Ucuz çit: kaynak-şekli
> testi — dosyanın ilk `import` satırının bu modül olduğunu doğrula.

---

## 2. CC2 — sessiz öldürme

### 2.1 `restore()` içinde `calls.length = 0` → **KIRMIZI ✔** (tur 6'da YEŞİL'di)

Tur 6 §2.4'ün M9'u birebir tekrarlandı, tur 6'daki eşlikçisiyle (çağrı anında arama yapan,
hatası yutulan `process.binding` sızıntısı) birlikte:

```
restore: () => { for (const r of restores) r(); calls.length = 0 }   ← QA-TUR7-M9
npx tsc --noEmit → 0
AssertionError: expected [ 'process.binding' ] to deeply equal []
Tests  1 failed | 53 passed (54)
```

Tur 6'da bu kombinasyon **54/54 yeşil** kalıyordu. Anlık görüntünün `restore()`'dan önce
alınması iddiayı `restore()` davranışından gerçekten bağımsızlaştırmış.

### 2.2 Üç ek sessiz-öldürme denemesi → **üçü de KIRMIZI ✔**

| # | Mutasyon (test kodu) | Sonuç |
|---|---|---|
| M10 | Anlık görüntüyü boşalt: `capturedCalls = sentinel.calls.slice(0, 0)` | **KIRMIZI** — `qaPreCalls` katmanı yakaladı (`…(21)`) |
| M11 | Assert sırasını değiştir: anlık görüntüyü `restore()`'dan **sonra** al (düzeltmeyi geri sar) | **KIRMIZI** — `restore()` artık `calls`'a dokunmadığı için iz kalıyor |
| M12 | Sentinel **örneğini** değiştir: assert taze bir `installNetworkCapabilitySentinel().calls`'a baksın | **KIRMIZI** — `qaPreCalls` katmanı yakaladı |

Önemli yapısal gözlem: ana negatif iddia artık **iki bağımsız, farklı kapsamlı kayıt** üzerinde
duruyor — örnek-kapsamlı `capturedCalls` (sentinel) ve **modül kapsamlı, hiç temizlenmeyen**
`qaPreCalls` (precapture). Birini susturan mutasyon diğerine yakalanıyor; sessizce öldürmek için
artık **iki ayrı dosyada eşzamanlı** mutasyon gerekiyor.

### 2.3 Pozitif kontrol ile ana test aynı **fabrikaya** bağlı ✔

İkisi ayrı **örnek** kullanıyor (`installNetworkCapabilitySentinel()` her testte bir kez
çağrılıyor), ama aynı **fabrikayı** paylaşıyorlar — anlamlı bağ budur ve ölçtüm:

```
patch(processObj, 'binding', 'process.binding')  satırı SİLİNDİ   ← QA-TUR7-M13
FAIL  … › sentinelin öz-testi: kasıtlı net.connect/http.get/WebSocket/process.binding/fetch …
Tests  1 failed | 53 passed (54)
```

Mekanizmayı bozan mutasyon pozitif kontrolü kırıyor. (Tur 6'da doğrulanan `patch()` no-op
mutasyonu da aynı sınıf; tekrarlamadım.)

### 2.4 ÖNEMLİ (bloklayıcı DEĞİL) — **precapture katmanının pozitif kontrolü yok**

Sentinel'in bir öz-testi var (tur 5 B1'in ürünü); `network-precapture-sentinel.ts`'in **yok**.
İki mutasyon bunu gösteriyor — her ikisinde de §1.1'in yakalanmış-referans sızıntısı yerinde:

| # | Mutasyon (`network-precapture-sentinel.ts`) | Sonuç |
|---|---|---|
| P1 | Sarmalayıcı **kayıt etmesin** (`qaPreCalls.push(...)` satırı silindi) | **54/54 YEŞİL** + dinleyiciye **26 gerçek bağlantı + 26 istek** |
| P2 | Sarmalama hiç yapılmasın (`for … of []`) | **54/54 YEŞİL** + **26 gerçek bağlantı + 26 istek** |

`tsc` her iki durumda 0. Yani katmanın **kendi mekanizması hiçbir test tarafından
kanıtlanmıyor**: yarın bir refactor (anahtar listesi değişimi, `process.binding`'in yazılamaz
hâle gelmesi, dosyanın yanlışlıkla boşaltılması) bu kapıyı **sessizce** öldürürse takım yeşil
kalır. Bu, CLAUDE.md'nin *"sessizce ölmüş kapı"* sınıfıdır ve tur 5'te sentinel için tam olarak
aynı gerekçeyle bloklayıcı sayılmıştı.

**Neden bu turda bloklayıcı saymıyorum:** brief'in kararlaştırdığı ölçüt **"precapture modülü
yerindeyken çıkan pratik canlı sızıntı"**; P1/P2 modülün kendisini mutasyona uğratıyor, yani
modül **yerinde değil**. Ürün kodu tek başına bu sonucu üretemiyor (§1.1 KIRMIZI). Bu yüzden
**borç** olarak kaydediyorum, karar değiştirmiyorum — ama yumuşatmıyorum da: ~6 satırlık bir
pozitif kontrol (sarmalayıcıyı kasten tetikleyip `qaPreCalls`'ın dolduğunu iddia et) bu
boşluğu kapatır ve §1.2'nin import-sırası çitiyle birlikte tek turda yapılmalı.

---

## 3. Koşulan test sayısı ve yanlış pozitif

| Koşu | Sonuç |
|---|---|
| `npm run verify` #1 (temiz ağaç, tur başı) | ✔ exit 0 · Test Files **84 passed \| 1 skipped (85)** · **Tests 1305 passed \| 4 skipped (1309)** |
| `npm run verify` #2 (temiz ağaç, tüm mutasyonlar geri alındıktan sonra) | ✔ exit 0 · **Tests 1305 passed \| 4 skipped (1309)** |
| `npm run e2e` | ✔ **55 passed** (46,2 s), tek koşu, flake yok |
| `npx vitest run tests/features/usage/server` (sonda **kaldırılmış**, temiz) | ✔ **54 passed (54)** · dinleyiciye **0** istek → **yanlış pozitif YOK** |

İddia edilen **1305/1309** ve **e2e 55** birebir doğrulandı; düşük değil. Bu turda
`docs/blockers.md`'nin "test takımı sessizce test atlıyor" borcu (worker-fork) **hiç
görülmedi** — 8 vitest koşusunun hepsi beklenen dosya/test sayısını raporladı.

`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` → **22 eşleşme, `src/` altında 0**;
hepsi meşru test adı/yorumu. `tests/server/write-gate-manifest.test.ts:124` **dokunulmadı**
(`git diff -- src tests` boş). Sonda kalıntısı taraması
(`QA-TUR7|qaLeak7|qaLeak8|CANLI-TUR7|qaProc7|qaProc8`) → **0 eşleşme.**

---

## 4. Kabul edilmiş mimari sınır (süreç-içi monkey-patch'in doğal tavanı)

Bu bölüm bir bulgu değil, **bilinçli olarak kabul edilmiş bir sınırın** dürüst kaydıdır.

Süreç-içi bir monkey-patch, ilkesel olarak, **yamadan daha erken** yakalanmış bir referansla her
zaman yenilebilir. Bu matematiksel bir gerçektir, bir kusur değil: yama ne kadar erken kurulursa
kurulsun, o noktadan **önce** değerlendirilen herhangi bir kod orijinal referansı saklayabilir.
Bu depoda kapatılan şey, o "önce"nin **erişilebilir** kısmıdır:

- `network-precapture-sentinel.ts`, `usage-aggregator.test.ts`'in **ilk import'u**dur ve ESM
  değerlendirme sırası gereği **her ürün modülünden önce** çalışır. Ölçtüm: ürün modülünün
  gövdesinde alınan referans artık **yamalı** sürümü yakalıyor (§1.1 KIRMIZI), sıra bozulunca
  koruma tamamen kayboluyor (§1.2).
- Dolayısıyla **ürün kodu yüzeyinde** precapture'dan önce çalışan bir nokta **kalmadı**: test
  dosyasının 4. satırından önce yalnızca yorumlar var, ve `vitest.config.ts`'in tek `setupFiles`
  girdisi (`tests/setup/chat-disabled-by-default.ts`) `src/` altından **hiçbir şey import
  etmiyor** (okudum). Precapture'dan önce referans yakalayabilecek tek yer artık çalıştırıcının
  kendi katmanıdır (vitest setup dosyası, Node yükleyici kancası, `--import` bayrağı) — bunlar
  **ürün kodu değil**, ve oraya kod koyabilen bir aktör zaten test altyapısının tamamını
  değiştirebilir.
- Bu yüzden bu turda **precapture'dan önce yakalama gerektiren bir varyant aramadım/saymadım**:
  brief'in kuralı gereği bu **kabul edilmiş mimari sınırdır, bloklayıcı değildir**.

**Tam koruma** ancak süreç/işletim sistemi düzeyinde izolasyonla (ağ erişimi olmayan bir kum
havuzunda test koşturma, güvenlik duvarı kuralı, kapsayıcı) sağlanır. Yerel, tek kullanıcılı bir
araç için bu orantısızdır. Bugünkü savunma derinliği — (1) AST tabanlı statik modül grafiği
taraması, (2) çağrı anı davranış sentinel'i + öz-testi, (3) modül-yükleme-zamanlı precapture —
bu ürün için **yeterlidir**.

---

## 5. Taşınan borçlar (bloklayıcı değil)

Tur 5'ten taşınan iki borç (`network-capability-guard.test.ts` metinsel katmanının yanlış
pozitifleri; M5 giriş uzantı listesi) `docs/blockers.md`'de **eşikleriyle** duruyor — durumları
değişmedi. Bu turda **iki yeni borç** eklenmeli:

1. **Precapture katmanının pozitif kontrolü yok** (§2.4). P1/P2 mutasyonları 54/54 yeşil bırakıp
   26 canlı istek sızdırıyor. **Eşik:** `network-precapture-sentinel.ts`'e dokunan bir sonraki
   tur, ya da `usage/server` ağ çitine yeni bir katman eklendiğinde — hangisi önce gelirse.
   **Düzeltme yönü:** ~6 satır: sarmalayıcıyı kasten tetikle (`(process as unknown as
   {binding:(n:string)=>unknown}).binding('tcp_wrap')`) ve `qaPreCalls`'ın dolduğunu iddia et.
2. **Import sırası yapısal çitle korunmuyor** (§1.2). Sıra bozulursa koruma **sessizce** ölür;
   ölçtüm. **Eşik:** aynı tur. **Düzeltme yönü:** kaynak-şekli testi — `usage-aggregator.test.ts`
   içindeki **ilk** `import` satırının `./network-precapture-sentinel` olduğunu doğrula
   (yorumları atlayarak).

Bu ikisi tek turda, tek dosyada kapanır; ikisi de bugünkü davranışı değiştirmez, yalnızca
yarınki sessiz ölümü engeller.

---

## 6. Kanıt ve temizlik

- **Ölçüm betikleri depoya girmedi** (scratchpad `…/scratchpad/tur7/`): `listener7.cjs`,
  `apply7.cjs`, `apply8.cjs`, `snippet-cc1.ts.txt`, `snippet-cc2.ts.txt`, koşu günlükleri
  (`verify1.txt`, `verify2.txt`, `e2e1.txt`, `probe_cc1.txt`, `probe_cc1_order.txt`,
  `probe_cc2_M9.txt`, `probe_M10/M11/M12/M13.txt`, `probe_P1/P2.txt`, `clean.txt`) ve dinleyici
  günlüğü `hits7.txt` (**204 gerçek TCP bağlantısı + 200 HTTP isteğinin** tam dökümü, segment
  segment ayrılmış).
- Her mutasyon `bak/` kopyasından **elle** geri yazıldı; **`git checkout` kullanılmadı**.
  `git diff --stat -- src tests` → **boş**.
- `git status`: bu turdan **önce** de orada olan commit'siz dosyalar (agent hafıza dosyaları,
  `docs/qa/latest.md`, tur 4/5/6 raporları). Benim eklediğim tek dosya bu rapor.
- **Yetim süreç: 0.** Dinleyici (PID 10868) elle sonlandırıldı, `45922`'de LISTEN yok. Kalan
  `node.exe`: yalnızca 2 Playwright MCP süreci (oturum aracı). `C:\dev\apps\hayat-mentoru`
  süreçlerine **dokunulmadı**.

---

## 7. Karar

**GEÇTİ.** CC1 ve CC2 kapalı; precapture modülü yerindeyken **pratik canlı sızıntı yok** (gerçek
istek çıkan tek senaryoda çit KIRMIZI veriyor). Yanlış pozitif yok, test sayısı iddia edileni
tutuyor (1305/1309 + e2e 55). Feature notu `status: done`.
