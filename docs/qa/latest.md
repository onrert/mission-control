KARAR: KALDI
ESKALE: true

---
feature: F-011
title: Token kullanımı ekranı (proje / gün / oturum / agent grupları)
reviewer: qa-evaluator
date: 2026-09-10
round: kapanış denetimi (tur 3 — dar kapsam, yalnızca AA1-AA4)
verdict: KALDI
---

# F-011 QA raporu — kapanış denetimi (tur 3)

**Puanlar:** İşlevsellik **8/10** · Özellik bütünlüğü **8/10** · Görsel/UX **8/10** ·
Kod kalitesi **6/10** (ağ çiti kendi yazılı garantisini vermiyor) → biri < 7, karar **KALDI**.

**Tek cümlelik özet:** AA2, AA3 ve AA4 **üçü de gerçekten kapandı** (canlı ölçümle ve çift yönlü
mutasyonla doğrulandı); **AA1 kapanmadı** — beyaz liste çiti, gizlenmemiş, sıradan bir TypeScript
deseniyle (`export { get } from 'node:http'`) yenildi ve ürün kodunun gerçek
`computeUsageReport`'undan **canlı bir HTTP isteği** çıkarken **tüm test paketi (1295/1299) yeşil
kaldı**.

Ortam: Windows 11 · Node v24.15.0 · `npm run build && npx tsx src/server/index.ts`
(`MC_PORT=4599` gerçek veri, `MC_PORT=4601` sandbox) · Chromium (Playwright MCP) ·
`npm run dev` KULLANILMADI · `git push` yapılmadı · `git checkout` ile hiçbir mutasyon geri
alınmadı (hepsi elle `.bak` kopyasından, md5 doğrulamalı).

---

## 0. Karar tablosu

| # | İddia | Sonuç |
|---|---|---|
| AA1 | Ağ çiti beyaz listeye çevrildi; "onaylı listede olmayan HER içe aktarım REDDEDİLİR" | ✘ **YENİLDİ — PRATİK, CANLI sızıntı kanıtlandı** (X1) |
| AA2 | Okunamayan dosya sayılıyor, arayüzde görünüyor | ✔ **DOĞRULANDI** (gerçek `icacls`, üç ACL şekli, iki yönlü mutasyon KIRMIZI) |
| AA3 | Yanlış alarm gitti, gerçek sinyal duruyor | ✔ **DOĞRULANDI** (gerçek veride uyarı YOK, format değişiminde VAR, üç eşik mutasyonu KIRMIZI) |
| AA4 | 320px'te proje sütunu okunur ve hizalı | ✔ **DOĞRULANDI** (280/320/375/480px'te 72px, hizasızlık 1px, iki mutasyon KIRMIZI) |
| Testler | `verify` 1292/1296, `e2e` 55 | ✔ **DOĞRULANDI** (üçüncü koşuda birebir; ilk iki koşu ortam kararsızlığı) |

---

## 1. BLOKLAYICI B1 (AA1) — beyaz liste `export … from` ile yenildi, sızıntı CANLI kanıtlandı

### 1.1 2. turun 14 sondasının 14'ü artık KIRMIZI

Beyaz listeye geçiş gerçek bir ilerleme: 2. turun çiti yenen iki vektörü dahil **hepsi** kapandı.

| Sonda | 2. tur | 3. tur |
|---|---|---|
| P1 `fetch('http://…')` … P8 yakalanmış `http.request` | 8/8 KIRMIZI | **8/8 KIRMIZI** |
| **N1** `createRequire(import.meta.url)('node:http')` | YEŞİL ✘ | **KIRMIZI** ✔ (iki katman: `node:module` + metinsel) |
| **N2** `process.binding('tcp_wrap')` | YEŞİL ✘ | **KIRMIZI** ✔ |
| N3 `Function('return imp'+'ort(…)')` · N4 `globalThis['fet'+'ch']` · N5 `eval` · N6 | KIRMIZI | **KIRMIZI** |

Yeni denenen 7 vektörden 3'ü de kapalı: `import(\`node:h\`+\`ttp\`)` (**KIRMIZI**),
`globalThis.process.binding` (**KIRMIZI**), unicode kaçışlı modül adı
(`import qaU from '\u006eode:http'` → **KIRMIZI**, beyaz listenin varsayılan-RET davranışı
sayesinde). Beyaz listeyi gevşeten mutasyon da tutuyor (§5, M1).

### 1.2 X1 — `export … from` taramanın KÖR NOKTASI (bloklayıcı)

Statik tarayıcı yalnızca `import … from '<spec>'` ve `import '<spec>'` desenlerini görüyor
(`network-capability-guard.test.ts:96-103`). **`export … from '<spec>'` hiçbir desende yok** —
oysa bu ifade de modülü yükler ve yeteneği aktarır.

**Tekrar üretme (2 adım, gizleme/obfuscation YOK):**

```ts
// 1) src/features/usage/server/qa-x1-reexport.ts   (dosyada `import` kelimesi HİÇ geçmiyor)
export { get as qaGet } from 'node:http'

// 2) src/features/usage/server/usage-aggregator.ts (tepe + computeUsageReport'un ilk satırı)
import { qaGet } from './qa-x1-reexport'
qaGet({ host: '127.0.0.1', port: 45907, path: '/QA-X1-CANLI-SIZINTI', agent: false }, …)
```

| Ölçüm | Sonuç |
|---|---|
| `npx vitest run tests/features/usage` | **53/53 YEŞİL** (statik çit + çalışma zamanı katmanı, ikisi de) |
| `npx vitest run` (tam paket) | **1295 passed \| 4 skipped (1299)**, exit 0 |
| Yerel dinleyiciye gelen istek (`tsx`, gerçek `computeUsageReport`) | **`GET /QA-X1-CANLI-SIZINTI` → 200** |
| Tam test paketi koşarken dinleyiciye gelen istek sayısı | **30** (paket yine yeşil) |

Yani sızıntı **teorik bir bit taşıma değil**: ürün kodunun gerçek giriş noktası çalıştığında
gerçek bir TCP bağlantısı kuruldu, HTTP isteği gitti, 200 yanıtı alındı ve bunu **hiçbir test**
görmedi. Kanıt (`tsx` çıktısı): `rapor uretildi degraded= false` + `SONDA yanit 200`;
dinleyici günlüğü `2026-09-09T16:34:48.508Z GET /QA-X1-CANLI-SIZINTI`.

**Neden bloklayıcı (ve neden "önemsiz" değil):**
1. Çitin kendi yazılı garantisi yanlış: dosyanın tepesinde "onaylı listede olmayan HER içe
   aktarım, 'yasaklı' olarak işaretlenmiş olsun ya da olmasın, **REDDEDİLİR**" yazıyor. Bu ifade
   `export … from` için doğru değil. AC4 ("hiçbir ağ isteği atılmaz") için kurulan tek statik
   yapı, kendi belgelediği güvenceyi vermiyor.
2. Vektör **kasıt sınıfı değil, kaza sınıfı**: `export { x } from '<modül>'` bir barrel/yeniden
   dışa aktarım dosyasının en sıradan yazımıdır; `process['bind'+'ing']` gibi bilinçli bir kaçış
   değildir. Bir sonraki feature'da bu dosyalara bir yardımcı eklenirse çit sessizce delinir.
3. **İkinci katman da yakalamıyor.** Çalışma zamanı katmanı (`usage-aggregator.test.ts:372`)
   yalnızca **kendi rastgele portuna** gelen isteği görebiliyor; gerçek bir sızıntı başka bir
   adrese gider. X1'i tam olarak bu yüzden 53/53 yeşilken canlı çalıştırabildim. "İki katman"
   iddiası pratikte tek katmandır.

**Muhtemel dosya:satır:** `tests/features/usage/server/network-capability-guard.test.ts:96`
(`STATIC_IMPORT_RE` — `export … from` kapsanmıyor), `:100` (`BARE_SIDE_EFFECT_IMPORT_RE`),
`:118-171` (`scanModuleGraph` — yeniden dışa aktarımlar ne ihlal sayılıyor ne de grafiğe
ekleniyor).

**Kapatmak için gereken minimum:** tarayıcı `export\s+(?:\*|\{[^}]*\})\s+from\s*'<spec>'` (ve
`export * as X from …`) biçimlerini de aynı beyaz listeye tabi tutsun; yerel yeniden dışa
aktarımlar grafiğe **eklensin**. Çit: X1 kalıcı negatif kontrol olarak test dosyasına girsin.

### 1.3 Yenilen ama pratikliği SINIRLI iki vektör (bloklayıcı değil, not)

Dürüst ayrım (2. turun N1'i gibi "canlı kanıtlı" değiller):

| Sonda | Çit | Pratik yetenek | Not |
|---|---|---|---|
| Y3 `globalThis['proc'+'ess']['bind'+'ing']('tcp_wrap')` | YEŞİL ✘ | **VAR** — `{TCP, TCPConnectWrap, constants}` döndü (ham soket) | Metinsel desen bölünmüş erişimi görmüyor; ham soketle HTTP kurmak gerekir |
| Y5 `globalThis['Fun'+'ction']('return imp'+'ort("node:http")')()` | YEŞİL ✘ (statik) | **VAR — canlı 200 alındı** (`tsx`, üretim çalışma zamanı) | Ama vitest (vite-node) altında `A dynamic import callback was not specified` ile **patlıyor** → test koşusu kırmızı olur. Yani üretimde çalışan, testte çalışmayan bir vektör |
| Y6 `fs` üzerinden UNC/WebDAV (`\\127.0.0.1@port\DavWWWRoot\…`) | YEŞİL ✘ | **YOK (bu makinede)** — `UNKNOWN` hata, dinleyiciye istek gelmedi | İzinli `fs`'in teorik ağ yüzeyi; kanıtlanamadı, iddia edilmiyor |
| Y7 `globalThis['req'+'uire'](…)` | YEŞİL | **YOK** — ESM'de `require` tanımsız | Çit tetiklenmedi çünkü **hiçbir şey olmadı**; "geçti" saymıyorum |

Bu satırlar kararı **tek başına** değiştirmezdi. Kararı değiştiren X1'dir: gizlenmemiş, kazayla
yazılabilir ve **canlı kanıtlı**.

---

## 2. AA2 — okunamayan dosya artık sayılıyor ✔ DOĞRULANDI

Sandbox (`%TEMP%\mcqa3`, yalnızca sentetik veri): 1 ana oturum (150 token) + 1 subagent
(10 token) = 160 token.

| Senaryo | toplam | `unreadable_file_count` | `degraded` | Arayüz |
|---|---|---|---|---|
| temiz | 160 | 0 | false | uyarı yok |
| **`icacls /deny "(RA,RD,RX)"`** (2. turun repro'su) | 10 | **1** | **true** | **⚠ görünür** |
| `icacls /deny "(RD)"` tek başına | 10 | **1** | **true** | ⚠ görünür |
| ACL kaldırıldı | 160 | 0 | false | uyarı yok (yanlış pozitif yok) |

Arayüz metni (canlı, `MC_PORT=4601`, ekran görüntüsü `.playwright-mcp/qa-f011-t3-aa2-uyari.png`):
`⚠ 1 dosya okunamadı (izin/erişim hatası) — bu dosyaların token verisi toplamda YOK.`
"Toplam: 10 token" ile birlikte gösteriliyor — sessiz kısmi başarı **yok**.

Yarış durumu ayrımı korunuyor: `isPersistentAccessError` yalnızca EPERM/EACCES/EBUSY'yi sayıyor
(`usage-aggregator.ts:128-134`); ENOENT (listelendikten sonra silinen dosya) sayılmıyor. Bunu
**her iki yönde** mutasyonladım (§5, M2a/M2b) — ikisi de KIRMIZI. Ayrıca çit yalnızca mock
değil: `usage-aggregator.test.ts:665` **gerçek `icacls /deny "(RA,RD,RX)"`** koşturuyor
(`skipIf(platform!=='win32')`), yani 2. turun bulduğu ACL şekli kalıcı olarak çitlendi.

---

## 3. AA3 — yanlış alarm gitti, gerçek sinyal duruyor ✔ DOĞRULANDI (kalibrasyon notuyla)

### 3.1 Gerçek veri: uyarı ÇIKMIYOR (2. turun B2'si kapandı)

`GET /api/usage` (gerçek `~/.claude/projects`, izlenen tek proje `mission-control`):

```
lines_ok 58.977 · lines_bad 0 · unknown_type_lines 19.891 → tanınan oran %66,27
degraded: false · unreadable 0 · truncated 0
```

Tarayıcıda (1280px) uyarı kutusu **hiç yok**, yalnızca `Toplam: 2.809.621.179 token` ve 5 satır.
2. turda bu uyarı kalıcı olarak açıktı.

### 3.2 Format değişiminde: uyarı ÇIKIYOR

Sandbox'ta `"type":"assistant"`→`assistant_message`, `"type":"user"`→`user_message`:
`Toplam: 0 token` **+** `⚠ Toplam 3 satırdan 3 tanesi tanınmadı — veri eksik olabilir.`
Azaltımın kapatması gereken risk gerçekten kapalı.

### 3.3 Eşik kalibrasyonu TEK veri noktasına dayanmıyor mu? — kendi taramam

Developer'ın bildirdiği sınırlamayı bağımsız olarak ölçtüm: `~/.claude/projects` altındaki
**16 proje dizini, 110.354 ayrıştırılabilir satır** (yalnızca sayısal özet üretildi, hiçbir
transkript içeriği kaydedilmedi):

```
GENEL: taninan %66,17   bozuk JSON %0,0000   (developer'ın %66,2 tabanı DOĞRULANDI)
tip dağılımı: assistant 41,4 · attachment 26,0 · user 24,2 · queue-operation 1,7 · … · system 0,6
```

**Proje bazında** (küçükten büyüğe): 14,6 · 16,7 · 16,7 · 24 · 24 · 25 · 33,1 · **59,7** · 66,3 ·
67,8 · 68,6 · 71,5 · 72,8 %. Eşiğin (%50) altındaki yedi dizinin tamamı **24-284 satırlık** QA
sandbox'ları / spike dizinleri; **gerçek geliştirme projelerinin hepsi %59,7 ve üzerinde**
(en düşük: `video-factory` %59,7 — eşiğe **9,7 puan** marj).

**Dosya bazında** (≥100 satırlık 279 dosya): p5 **%49,1** · p50 %73,3 · p95 %80,6;
dosyaların **%6,1'i** (17/279) %50'nin altında. Yani **tek başına** bir-iki oturumluk yeni bir
proje izlenmeye başlandığında geçici bir yanlış alarm ihtimali var (~%6).

**Sonuç:** taban temsili (dört ayrı gerçek projede %59,7-%72,8), eşik ne çok gevşek ne çok sıkı:
`assistant` (%41,4) veya `user` (%24,2) tipinin yeniden adlandırılması oranı sırasıyla %24,8 ve
%42'ye düşürür — ikisi de eşiği tetikler, yani **asıl risk (token verisinin sessizce sıfırlanması)
yakalanıyor**. Kalan risk küçük ve **geçici** bir yanlış alarm; kararı değiştirmiyor. **NOT
(bloklayıcı değil):** proje sayısı arttıkça uyarı tüm izlenen projelerin TOPLAMI üzerinden
hesaplandığı için tek bir küçük/atipik proje toplamı aşağı çekebilir; ileride oranın **proje
başına** değerlendirilmesi daha dayanıklı olur.

---

## 4. AA4 — 320px'te proje sütunu ✔ DOĞRULANDI

Kendi kırpılmış-görünür-genişlik ölçümüm (gerçek Chromium, gerçek veri, 5 satır;
`min(el.right,kap.right) − max(el.left,kap.left)`):

| Genişlik | Başlık "Proje" | Satırlardaki proje hücresi | Başlık/satır sol kenar farkı | Kök yatay taşma |
|---|---|---|---|---|
| 280px | **72 px** | **72, 72, 72, 72, 72 px** | 1 px | 0 |
| **320px** | **72 px** | **72, 72, 72, 72, 72 px** | 1 px | 0 |
| 375px | **72 px** | **72 px ×5** | 1 px | 0 |
| 480px | **72 px** | **72 px ×5** | 1 px | 0 |

2. turda 320px'te satırlar **0 px**'ti. Artık `minmax(4.5rem,1fr)` tabanı sayesinde sütun asla
çökmüyor; başlık ve satırlar aynı `USAGE_GRID_COLS` şablonunu ve aynı kaydırma kabını paylaşıyor.
1 px'lik sapma satırdaki `<details>` kenarlığından geliyor (görsel olarak hizalı).
Kap içinde yatay kaydırma var (`scrollWidth 465 > clientWidth 296`) ve **kök belge taşmıyor**
(320=320) — F-010'un "gizli yatay kaydırma" sınıfı tekrarlamıyor.
Ekran görüntüsü: `.playwright-mcp/qa-f011-t3-320-proje-sutunu-72px.png` (metin `mission-…`
kısaltılmış ama sütun okunur ve kaydırılabilir).

---

## 5. Mutasyon tablosu (7 bağımsız mutasyon + 22 ağ sondası)

| # | Mutasyon | Dosya | Sonuç |
|---|---|---|---|
| M1 | **AA1 beyaz liste gevşetildi** (`{'fs','path'}` → `+'http','net'`) | `network-capability-guard.test.ts:50` | **KIRMIZI** (4 test) |
| M2a | **AA2 eski `catch`'e dönüş** (`unreadable: isPersistentAccessError(e)` → `false`) | `usage-aggregator.ts:161` | **KIRMIZI** (2: mock + GERÇEK icacls testi) |
| M2b | AA2 aşırı sayma (`→ true`, yarış durumu da sayılır) | `usage-aggregator.ts:161` | **KIRMIZI** (1: ENOENT regresyon çiti) |
| M3a | **AA3 eşik gevşetildi** (`0.5 → 0.01`) | `usage-aggregator.ts:76` | **KIRMIZI** (1) |
| M3b | AA3 eski davranışa dönüş (`0.5 → 0.99`, kalıcı yanlış alarm) | `usage-aggregator.ts:76` | **KIRMIZI** (1) |
| M3c | AA3 bozuk-JSON eşiği gevşetildi (`0.01 → 0.9`) | `usage-aggregator.ts:75` | **KIRMIZI** (1) |
| M4a | **AA4 eski şablona dönüş** (`1fr_auto_auto_auto_auto`) | `UsageScreen.tsx:36` | **KIRMIZI** (E2E: "kırpılmış görünür genişlik 0 OLMAMALI") |
| M4b | AA4 yalnızca `minmax` tabanı kaldırıldı (`1fr_5rem…`) | `UsageScreen.tsx:36` | **KIRMIZI** (aynı E2E) |
| P1-P8, N1-N6 | 2. turun 14 ağ sondası | `usage-aggregator.ts` | **14/14 KIRMIZI** ✔ |
| Y1, Y2, Y4 | yeni ağ sondaları (şablon `import()`, `globalThis.process.binding`, unicode kaçış) | `usage-aggregator.ts` | **KIRMIZI** ✔ |
| **X1** | **`export { get } from 'node:http'` + yerel import** | yeni `qa-x1-reexport.ts` + `usage-aggregator.ts` | **YEŞİL ✘ — canlı sızıntı** |
| Y3, Y5, Y6, Y7 | bölünmüş `process.binding` · bölünmüş `Function` · `fs`+UNC · `globalThis.require` | `usage-aggregator.ts` | YEŞİL (pratiklik §1.3'te ayrıştırıldı) |

Geri alma: `git checkout` **kullanılmadı**; her mutasyon scratchpad'teki `.bak` kopyasından elle
geri yazıldı, üç dosyanın da md5'i başlangıç değerine döndü
(`usage-aggregator.ts 5908d3fb…`, `UsageScreen.tsx 529bbbc5…`,
`network-capability-guard.test.ts a3dd7441…`), geçici `qa-x1-reexport.ts` silindi.

`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` → **22 eşleşmenin tamamı meşru
test adı/yorumu**, `src/` altında **sıfır** eşleşme; `write-gate-manifest.test.ts:124` dahil
hiçbirine dokunulmadı. `git status`: yalnızca developer'ın kendi commit'siz hafıza dosyaları
(bu turdan önce de oradaydı).

---

## 6. Koşulan test sayısı

| Koşu | Sonuç |
|---|---|
| `npm run verify` #1 | ✘ vitest **worker fork çökmesi** (`exit code 3221226505`, `events-api.test.ts`) → 83 dosya, **1288 passed \| 4 skipped** |
| `npm run verify` #2 | ✘ `history-log.test.ts` `afterEach` **ENOTEMPTY** (geçici dizin silinemedi) + ikinci worker çökmesi (`adr-013-write-header.test.ts`) → **1286 passed** |
| **`npx vitest run` #3** | ✔ **exit 0** · Test Files **84 passed \| 1 skipped (85)** · Tests **1292 passed \| 4 skipped (1296)** |
| `npm run typecheck` / `lint` / `build` | ✔ exit 0 (üçü de) |
| **`npx playwright test`** | ✔ **55 passed** (43,3 s) |

İddia edilen **1292/1296** ve **55** birebir doğrulandı. `--no-file-parallelism` **kullanılmadı**
(gizleme yok). Kırmızılar F-011 koduna ait değil: biri `CLAUDE.md`'de belgeli worker-fork
kararsızlığı (beşinci gözlem), diğeri chat özelliğinin geçici dizin temizliğinde Windows dosya
kilidi. Yine de **iki koşudan ikisi de kırmızıydı** — üçüncü koşuda yeşil; bu gürültü oranı
kendi başına bir borçtur (bkz. `docs/blockers.md`).

---

## 7. Kanıt dosyaları

- `.playwright-mcp/qa-f011-t3-320-proje-sutunu-72px.png` — 320px, proje sütunu 72px, başlık hizalı (AA4 ✔)
- `.playwright-mcp/qa-f011-t3-aa2-uyari.png` — gerçek `icacls /deny "(RA,RD,RX)"`, arayüzde izin uyarısı (AA2 ✔)
- Ölçüm betikleri depoya **girmedi** (scratchpad): `probe3.cjs`, `probes3-list.cjs`,
  `probe-x1.cjs`, `x1-live.cjs`, `listener.cjs`, `cap2.mts`, `aa2.mts`, `aa3-scan.cjs`.

⛔ Depoya hiçbir gerçek transkript içeriği bırakılmadı; AA3 taraması yalnızca sayısal özet üretti.
Sandbox `%TEMP%\mcqa3` **depo dışındadır** ve yalnızca sentetik veri içerir (silme komutu
`block-dangerous` hook'una takıldığı için onay istemeden silinmedi).

**Süreçler:** açtığım iki sunucu (4599, 4601) ve tüm sonda süreçleri kapatıldı; portlar boş.
Kalan `node.exe`: 2 adet Playwright MCP (araç altyapısı) + 3 adet `C:\dev\apps\hayat-mentoru`
(`next dev`) — **dokunulmadı**. Bu turdan **yetim süreç: 0**.

**Kapsam dışı gözlem (bulgu açılmadı):** 1280px'te Token sekmesine geçerken konsolda 3 adet React
`Encountered two children with the same key` hatası var; anahtar biçimi `m:<uuid>:text` — F-012
sohbet ekranına ait, F-011 ile ilgisiz.

---

## 8. KALDI'yı kaldırmak için gereken minimum (tek madde)

1. **B1/AA1** — statik tarayıcı `export … from '<spec>'` (ve `export * as X from …`) biçimlerini
   de beyaz listeye tabi tutsun, yerel yeniden dışa aktarımları modül grafiğine **eklesin**.
   Çit: X1 (`export { get } from 'node:http'` içeren geçici dosya) kalıcı negatif kontrol olarak
   `network-capability-guard.test.ts`'e girsin; ayrıca çalışma zamanı katmanının **yalnızca kendi
   portunu** görebildiği, yani ikinci bir katman sayılamayacağı yorumda dürüstçe yazılsın.
2. (Bloklayıcı değil, borç) `process['bind'+'ing']` gibi bölünmüş erişimler metinsel taramanın
   yapısal sınırıdır; kara-liste kalıntısı olan bu metin taramasının kapsamı belgelensin.
3. (Bloklayıcı değil, borç) AA3 oranı ileride **proje başına** değerlendirilsin (§3.3).
