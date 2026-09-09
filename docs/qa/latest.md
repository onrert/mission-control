KARAR: GEÇTİ
ESKALE: false

---
feature: F-008
title: Kapılar paneli — G0-G6/ASSETS onay, red, arşiv akışı
reviewer: qa-evaluator
date: 2026-09-09
tur: kod turu (A sunucu + B arayüz birlikte), gerçek tarayıcı
---

# F-008 QA raporu — Kapılar paneli

Kaynaklar: `docs/features/F-008-kapilar-paneli.md` (kabul kriterleri), `docs/qa/F-008-contract.md`
(tur 3, §3-§11), `docs/03-ux.md:185-215` (ekran 4 mockup + Türkçe metinler), `docs/PROCESS.md` §2,
`docs/decisions/ADR-005` madde 9, `ADR-009` (yalnızca Windows), `ADR-013` (`x-mc-write`),
`CLAUDE.md` "Öğrenilen kurallar".

**Bu bir güvenlik sınırı feature'ıdır** (G0 kararı: "panelden verilen kapı onayı kullanıcının
onayı sayılır"). Raporun ağırlığı "çalışıyor gibi görünüyor"da değil, **çitlerin mutasyonla
kırmızı verdiğini kanıtlamakta**.

## 0. Ölçüm ortamı ve güvenlik kısıtı

- Uygulama **`npm run build && npm start`** ile üretim derlemesinden koşturuldu
  (`MC_PORT=4599`, `MC_DATA_DIR=<scratchpad>/sandbox/data`). `npm run dev` KULLANILMADI.
- Tüm yazma ölçümleri **sandbox proje dizinlerinde** yapıldı
  (`<scratchpad>/sandbox/proj`, `<scratchpad>/caseproj`) — bunların kendi `docs/PROCESS.md` +
  `docs/approvals/`'ı var.
- **Gerçek `docs/approvals/` hiç değişmedi.** Tur başında ve sonunda alınan sha256 listeleri
  birebir aynı:

| Dosya | sha256 (tur başı = tur sonu) |
|---|---|
| `G0.ok` | `3b21fd8e7c4b2d1f3797275eb18dfe476a7f2c83435b905df3d6f31824148565` |
| `G1.ok` | `72bcf9757aec9ca5ba76f1a02bddad85f3051d1110d7e7a62189c1dc8d5b5234` |
| `G2.ok` | `a87cd696dd44424084594e2a32e83f0f32b4fc797cbb0148ef8b3cbdefba1bf5` |
| `G3.ok` | `36b18d582ac02afd3d0709d908ef256079b6ff147f09c08afccda5757bf9eef2` |
| `G4-1.ok` | `08d0fe3aaa80ed11a1eece6956a4c48272903ebadcb74974aa09c8fffba0d82b` |
| `README.md` | `770799bb377c769c3633217a73d579f5ddfc9d705c84a5c730f2425f554a3ed7` |

`ls docs/approvals/` tur sonunda: `G0.ok G1.ok G2.ok G3.ok G4-1.ok README.md` — **yeni dosya yok,
`archive/` oluşmadı, silme/taşıma yok.** `git status --porcelain` tur boyunca yalnızca bu raporun
ve ekran görüntülerinin eklenmesini gösterdi (tüm mutasyonlar geri alındı).

- `npm run verify`: ilk koşuda **worker fork kararsızlığı** (`exit code 3221226505`, önce
  `features-api.test.ts` sonra `gates-api.test.ts` worker'ı), **elle ikinci koşuda yeşil**:
  `73 passed | 1 skipped`, `1066 passed | 4 skipped`, build ✓. (CLAUDE.md'nin bilinen sınıfı —
  bu turda **iki kez** görüldü, rapora yazıldı.)
- `npx playwright test` (prod config): **36/36 geçti**, `gates.spec.ts`'in 8 testi dahil.
- `MC_GATES_LIVE_TESTS=1 npm run test:gates-live`: **1 kez** koşturuldu, **2/2 geçti** (32 s).

---

## 1. Kabul kriterleri — tek tek

### AC1 — durum türetme (onaylandı / reddedildi / bekliyor / çelişkili) — **GEÇTİ (bir uyarıyla)**

Sandbox fixture: `G0.ok`, `G1.deny.md`, `G3.ok`+`G3.deny.md` (deny daha yeni), `G4-1.ok`,
`G4-2.ok`, `G4-10.ok`, `g2.ok`, `README.md`, `DANGER.ok`, `.gitkeep`, `G6.ok.tmp`, `archive/`.

`GET /api/gates` çıktısı (ekran görüntüsü: `docs/qa/screens/F-008-01-liste-1280.png`):

- `G0 approved` · `G1 denied` · `G3 conflict` (`newer_side: "deny"`, mtime tabanlı) ·
  `ASSETS/G5/G6 pending` ✓
- **Ekli kimlikler listeleniyor:** `G4-1`, `G4-2`, `G4-10` üç ayrı satır olarak, **sayısal**
  sırada (`G4-10` `G4-2`'den SONRA) ✓ — sabit `G0..G6` varsayımı yok.
- Sıra `docs/03-ux.md:192` ile birebir: `G0, G1, G2, G3, ASSETS, G4-N, G5, G6` ✓
- **Hariç tutma kümesi çalışıyor:** `README.md`, `archive/`, `DANGER.ok`, `.gitkeep`,
  `G6.ok.tmp` **kapı sanılmıyor ve `unrecognized`'a da girmiyor**; yalnızca `g2.ok`
  raporlanıyor ✓
- Etiketler gerçek `docs/PROCESS.md` §2'den okunuyor (`process_doc_readable: true`).

**Uyarı → Bulgu 1 (ÖNEMLİ):** aynı `g2.ok` dosyası hem "Tanınmayan dosyalar" listesinde hem
`G2 = Onaylandı (kilitli)` durumunun kaynağı. Ayrıntı §4.

### AC2/AC7 — iki adımlı onay, iptal hiçbir şey yazmaz, `.ok` PROCESS.md formatında — **GEÇTİ**

**İptal (fotoğraf İŞLEMDEN ÖNCE alındı — F-013 dersi):**
1. `node manifest.mjs <sandbox/proj> before-cancel.json` → 17 girdi (yol + boyut + sha256 +
   **mtimeMs**).
2. Tarayıcıda `G5 → [Onayla]` → modal açıldı, `Onayı Yaz →` **boşken `disabled`** ✓,
   çok satırlı/özel karakterli karar metni yazıldı → `[İptal]`.
3. `after-cancel.json` → `diff` **tamamen boş**: "İPTAL SONRASI FARK YOK (tam eşitlik, mtime
   dahil)". Ekran görüntüsü: `F-008-02-onay-modali.png`.
4. Aynı ölçüm **Escape tuşuyla** da tekrarlandı → yine sıfır fark.

**Önizleme ↔ diske yazılan bayt eşitliği** (sözleşme §5'in temel iddiası):

| | sha256 | bayt |
|---|---|---|
| Modaldaki `approve-preview` metni (tarayıcıdan okundu) | `a3b722852d1dded41219be75a7b76d2ad9e557ef2b63dc66013380aae84e2c68` | 357 |
| `docs/approvals/G5.ok` (diskten) | `a3b722852d1dded41219be75a7b76d2ad9e557ef2b63dc66013380aae84e2c68` | 357 |

**EŞİT** ✓ — çift tırnak, `&`, `<tag>`, ters bölü, sekme ve satır sonu dahil.
Manifest diffi: **yalnızca `G5.ok` eklendi**, başka hiçbir dosya değişmedi.

`.ok` içeriği `docs/PROCESS.md:34` ("tarih + onaylanan özet + kullanıcının kararı") ile birebir:

```
G5 — Güvenlik/kalite kapısı ONAYLANDI
Tarih: 2026-09-09
Onaylayan: Panel kullanıcısı (Kapılar ekranı, iki adımlı onay)

Onaylanan özet: Panel Kapılar ekranından "G5 — Güvenlik/kalite" kapısı onaylandı (proje: sandbox-proj).

Kullanıcının kararı: Onaylıyorum. Özel karakterler: "tırnak" & <tag> \ ters bölü
İkinci satır	sekme
```

Sunucu tarafı çit: `confirmed` olmadan `POST .../approve` → **400** ✓ (dosya yazılmadı).

### AC3/AC8 — red gerekçesi zorunlu, olduğu gibi geçer — **GEÇTİ**

- Form boşken **ve yalnızca boşluk (`"   "`) girildiğinde** `Reddet - Kaydet` **`disabled`** ✓
- Sunucu: `{"reason":"   "}` → **400 `invalid_body`**, dosya yazılmadı ✓
- Gerçek red (`G6`) yazıldı; `.deny.md` içeriği gerekçeyi **karakter karakter** taşıyor:
  `"smoke"` tırnakları, `&`, `<riskli>`, sekme, satır sonu dahil (od dökümüyle doğrulandı).
  Ekran görüntüsü: `F-008-03-red-formu.png`.

### AC4 — çelişkili durum — **GEÇTİ**

`G3` (hem `.ok` hem `.deny.md`) → rozet **"⚠ Çelişkili durum"**, aksiyon sütununda **yalnızca
`[Detay]`** (Onayla/Reddet butonları DOM'da **yok**, `hasApprove:false, hasDeny:false`).
`[Detay]` genişleyen salt-okunur alt satır:

```
Onay (.ok) tarihi: 2026-09-09
Red (.deny.md) tarihi: 2026-09-09 (daha yeni)
Bu durum panelden düzeltilemez; dosyaları docs/approvals/ altında elle inceleyin.
```

Hiçbir dosya otomatik silinmedi/taşınmadı (manifest diffi boş).
Ekran görüntüsü: `F-008-07-celiski-detay.png`.

### AC5 — yazma hatası: geri alma, okunabilir hata, panel çökmez — **GEÇTİ**

Fault injection (gerçek, ACL ile): `icacls <sandbox>/docs/approvals /deny <user>:(NP)(WD,AD)`
→ dizinde **yeni dosya oluşturulamaz** ama **dizinden dışarı `rename` çalışır**. Bu asimetri
tam olarak §6'nın "yarı-başarı" senaryosunu üretir. Ayrıntı §2.

Sonuç: modal **kapanmadı**, karar metni **korundu**, buton yeniden aktifleşti, hata satır içi
gösterildi, **başarı toast'ı çıkmadı**, satır taze duruma (`Bekliyor`) döndü, **sunucu süreci
yaşadı** (`/api/health` cevap verdi, `uptime` sürekli). Artık `.tmp` dosyası kalmadı
(`atomicWriteOnce`'ın `finally` temizliği çalıştı). Ekran görüntüsü: `F-008-04-yari-basari.png`.

### AC6 — tüm yazmalar F-006 yazma kapısından geçer — **GEÇTİ**

İki bağımsız katman mutasyonla kanıtlandı (M3, M4 — §3). Ayrıca `x-mc-write` başlıksız
`POST .../approve` → **403** ✓, ve reddedilen tüm isteklerden sonra manifest diffi **boş**
("REDDEDİLEN İSTEKLER SONRASI HİÇBİR DEĞİŞİKLİK YOK").

### AC9 — arşivle, sonra onayla — **GEÇTİ**

Reddedilmiş `G1` panelden onaylandı. Manifest diffi:

| Değişim | Kanıt |
|---|---|
| `docs/approvals/G1.deny.md` **kayboldu** | — |
| `docs/approvals/archive/G1-2026-09-09T01-05-57-885Z.deny.md` **oluştu** | sha256 `9d6a34ca…` — **kaynak dosyayla aynı**, `mtimeMs` de aynı → **kopyala+sil değil, TAŞIMA** |
| `docs/approvals/G1.ok` oluştu | — |

"İçeriği kaybolan dosya" taraması: **`[]`** — hiçbir içerik yok olmadı.

---

## 2. Yarı-başarı davranışı (kritik ölçüm)

Senaryo: `G6` reddedilmiş; `docs/approvals` yazmaya kapalı (ACL), taşımaya açık.
`[Onayla] → Onayı Yaz →`:

| Beklenen (sözleşme §6) | Gerçekleşen |
|---|---|
| HTTP 500 `write_failed` | ✓ (`console`: 500 @ `/api/gates/…/G6/approve`) |
| Mesajda **gerçek arşiv yolu** | ✓ `"Red kaydı docs/approvals/archive/G6-2026-09-09T01-08-32-182Z.deny.md altına taşındı ama onay yazılamadı; kapı şu an \"Bekliyor\" durumunda. Tekrar deneyin."` |
| Gövdede taze `data`, `status:'pending'` | ✓ (satır anında `Bekliyor`'a döndü) |
| Kullanıcı "oldu" sanmıyor | ✓ **başarı toast'ı YOK**, modal açık, hata kırmızı, buton tekrar aktif |
| Yeniden deneme idempotent | ✓ ACL açıkken ikinci deneme: **"Kaydedilemedi, tekrar deneyin."** (ikinci arşivleme denenmedi, ikinci arşiv dosyası oluşmadı); ACL kalkınca üçüncü deneme **200** ve `G6.ok` yazıldı |

**Yani yarı-başarı dürüstçe raporlanıyor** — F-007'nin "yazma oldu, istemci hiç yanıt almadı"
sınıfı burada tekrarlamıyor.

---

## 3. Mutasyon tablosu (uygula → KIRMIZI gör → geri al)

Toplam **11 bağımsız mutasyon** koşturuldu. Her biri sonrasında dosya birebir geri yazıldı;
tur sonunda `git status --porcelain` yalnızca rapor/ekran görüntüsü gösterdi.

| # | Mutasyon | Hedef | Sonuç | Kırılan çit |
|---|---|---|---|---|
| M1 | İki adımlı onayın atlanması (`confirmed !== true` kaldırıldı) | `gates/server/handlers.ts` | **KIRMIZI** | `gates-api.test.ts` "confirmed eksik/false → 400, dosya yazılmaz" |
| M2 | `x-mc-write` muafiyeti (dağıtıcıya `/api/gates` istisnası eklendi) | `src/server/index.ts` | **KIRMIZI** | `gates-api.test.ts` "x-mc-write eksik → 403" |
| M3 | Arşivin **silmeye** dönmesi (`archiveDenial` → `fs.unlinkSync`) | `gates/server/handlers.ts` | **KIRMIZI ×2** | `no-write-gate-bypass.test.ts` (statik) **ve** `gates-manifest.test.ts` (dinamik, arşiv girdisi yok) |
| M4 | Salt-okunur modüle doğrudan `fs.writeFileSync` | `gates/server/list-gates.ts` | **KIRMIZI** | `no-write-gate-bypass.test.ts` (statik tarama `src/features/gates/**`'i gerçekten kapsıyor) |
| M5 | Red gerekçesi zorunluluğunun kalkması | `gates/server/handlers.ts` | **KIRMIZI ×3** | `gates-api.test.ts` (boş + >4000) ve `gates-manifest.test.ts` |
| M6 | **AC9 sırasının tersine çevrilmesi** (önce onay, sonra arşiv) | `gates/server/handlers.ts` | **doğru kodda YEŞİL (2/2), mutantta KIRMIZI** | `gates-api.test.ts` M6 fault injection — mutantta mesaj `"Kaydedilemedi, tekrar deneyin."`e düşüyor, arşivleme hiç olmuyor |
| M9 | `gates` SSE yayınının silinmesi | `gates/server/handlers.ts` | **KIRMIZI** | `gates-api.test.ts` M9. **Maskeleme kontrolü:** o testte dosya izleyicisi koşmuyor, hub doğrudan dinleniyor → maskelenmiyor |
| R1 | **Kapalı küme çiti**: koşulsuz **beşinci** sekme eklendi | `src/web/App.tsx` | **KIRMIZI ×5** | `App.test.tsx` (2), `App.chat-tab.test.tsx` (2), `App.interaction.test.tsx` (1) |
| R5 | `projectsService.list()` asenkron IIFE'nin **DIŞINA** geri alındı | `kanban/server/handlers.ts` | **KIRMIZI** | `features-api.test.ts` R5 — *"Test timed out in 5000ms"* + `ÇOK GİZLİ İÇ HATA` sızıntısı: tam olarak korunması gereken sınıf |
| QA-A | Onaylı kapıda `deny` 409 çitinin kaldırılması (**R2 sınırı**) | `gates/server/handlers.ts` | **KIRMIZI ×2** | `gates-api.test.ts` B6 + `gates-manifest.test.ts` B6 |
| QA-C/D | `isExcludedApprovalsEntry` izleyiciden / listeden kaldırıldı | `gates-watcher.ts`, `list-gates.ts` | **KIRMIZI ×3** | `gates-watcher.test.ts` (README + kendi `.tmp`), `list-gates.test.ts` |

### Yeşil kalan mutasyon (bulgu üretti)

| # | Mutasyon | Sonuç |
|---|---|---|
| **QA-B** | `ApproveModal` onaya gönderdiği metni değiştiriyor: `onConfirm(decision)` → `onConfirm(decision + ' [QA gizli ek]')` — yani **kullanıcının onayladığı önizleme ile diske giden içerik ayrışıyor** | **1066/1066 YEŞİL.** Ayrıca `gates.spec.ts`'in `toContain(...)` iddiası da yakalayamaz (ek metin sonda). → Bulgu 2 |

`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` → yalnızca **önceden var olan
meşru test adları** (F-013/F-007/F-006 dönemi + `gates-manifest.test.ts:202`, `write-gate-manifest.test.ts:124`).
Ürün kodunda **sıfır** kalıntı.

---

## 4. Bulgular

### Bulgu 1 — ÖNEMLİ · Windows'ta büyük/küçük harf: aynı dosya hem "tanınmayan" hem kapıyı kilitliyor

**Tekrar üretme (izole, tek nedenli):**
1. Boş bir sandbox projesi: `docs/PROCESS.md`, `docs/features/`, `docs/approvals/`.
2. `docs/approvals/` içine **yalnızca** iki dosya: `g2.ok` ve `g5.deny.md` (küçük harfli).
3. Projeyi panele ekle, Kapılar → projeyi seç.

**Beklenen:** her iki dosya da kapı deseniyle eşleşmiyor → yalnızca "Tanınmayan dosyalar"
olarak raporlanmalı; G2 ve G5 **Bekliyor** kalmalı.

**Gerçek:**
```
Tanınmayan dosyalar: g2.ok, g5.deny.md
G2 Mimari         ✔ Onaylandı    2026-09-09   (kilitli)
G5 Güvenlik/kalite ✘ Reddedildi   2026-09-09   [Onayla]
```
Ayrıca `POST /api/gates/<id>/G2/deny` → **409 `"Bu kapı zaten onaylı, reddedilemez."`**
Ekran görüntüsü: `docs/qa/screens/F-008-08-buyuk-kucuk-harf-celiskisi.png`.

**Kök neden:** sınıflandırma **büyük/küçük harfe duyarlı regex** ile
(`src/features/gates/shared/gate-id.ts:21-22` — `OK_FILE_PATTERN`/`DENY_FILE_PATTERN`), durum
türetme ise **`fs.existsSync`** ile yapılıyor (`src/features/gates/server/list-gates.ts:96-99`).
Windows'ta (ADR-009: yalnızca Windows) `existsSync` harfe duyarsızdır → iki katman aynı dosya
hakkında **zıt** karar veriyor.

**Neden bloklayıcı değil:** aynı harfe-duyarsızlık `.claude/hooks/gate-check.cjs:11`
(`exists('docs/approvals/G2.ok')`) için de geçerli — yani sistemin **tamamı** bu platformda
`g2.ok`'u G2 onayı sayıyor. Panelin türettiği **durum** platform semantiğiyle tutarlı; yanlış
olan, aynı dosyayı **aynı ekranda** "tanınmıyor" diye raporlaması ve kullanıcıya bu kilidi
açıklayacak hiçbir yol bırakmaması. Hiçbir test bu vakayı ölçmüyor.

**Muhtemel dosya:satır:** `src/features/gates/shared/gate-id.ts:9,21,22` (desenler harfe duyarlı)
· `src/features/gates/server/list-gates.ts:96-99` (`existsSync`). Öneri: `readdirSync` sonucu
üzerinden **tek** bir gerçek kaynağa dayanmak (dizin girdilerini eşleyip durum onlardan
türetmek), ya da desenleri `i` bayrağıyla kurup id'yi normalize etmek.

### Bulgu 2 — ÖNEMLİ · Onaylanan önizleme ile diske yazılan içeriğin aynılığını hiçbir test korumuyor

Sözleşme §5 bu aynılığı, "ayrı bir `/preview` ucu gerekmiyor" gerekçesinin **tamamı** yapıyor;
G0 kararı da doğrulama adımının anlamını buna dayandırıyor.

**(a) Çit yok:** `ApproveModal.tsx:73` (`await onConfirm(decision)`) satırını
`onConfirm(decision + ' [QA gizli ek]')` yapan mutasyon **1066/1066 yeşil** kaldı; `gates.spec.ts`
de yakalamaz (`toContain` önek eşleşmesi).

**(b) Gerçek bir ayrışma üretilebiliyor** (tekrar üretme):
1. Sandbox'ta `G0` bekliyor durumda; panelde `[Onayla]` → modal açık.
2. Modal **açıkken** projenin `docs/PROCESS.md` §2 tablosunda `| G0 Fikir |` → `| G0 DEGISTIRILMIS-ETIKET |`.
   (İzleyici yalnızca `docs/approvals`'ı izler; panel etiketi tazelemez.)
3. Karar metnini yaz → `Onayı Yaz →`.

| | değer |
|---|---|
| Modalda gösterilen | `G0 — Fikir kapısı ONAYLANDI` … `"G0 — Fikir" kapısı onaylandı` |
| Diske yazılan `G0.ok` | `G0 — DEGISTIRILMIS-ETIKET kapısı ONAYLANDI` … `"G0 — DEGISTIRILMIS-ETIKET" kapısı onaylandı` |

**Neden bloklayıcı değil:** ayrışma yalnızca **türetilmiş etikette** (ve gece yarısını geçen bir
modalda tarihte) oluşuyor; kullanıcının **kendi karar metni**, kapı kimliği, proje ve yazılacak
dosya yolu her koşulda birebir korunuyor — bunlar mutlu yolda bayt bayt eşit olarak **ölçüldü**
(§1 AC2 tablosu). Yine de sözleşmenin merkez iddiası ölçülmüyor.

**Muhtemel dosya:satır:** `src/features/gates/web/ApproveModal.tsx:73,118` (önizleme istemcide
üretiliyor) · `src/features/gates/server/handlers.ts:168,172` (sunucu etiketi/tarihi **yeniden**
türetiyor). Öneri: (i) modalın gönderdiği metnin önizlemeyle aynı olduğunu doğrulayan bir birim
testi, (ii) `gates.spec.ts`'te önizleme metnini okuyup diskteki dosyayla **tam eşitlik**
(`toBe`, `toContain` değil) karşılaştırması, (iii) istemcinin ürettiği gövdeyi sunucuya gönderip
sunucunun **karşılaştırması** (aksi hâlde 409) — üçü de küçük.

### Bulgu 3 — ÖNEMLİ (F-008 kapsamı DIŞI, proje düzeyi) · `npm run e2e:dev` kırmızı

`npx playwright test -c playwright.dev.config.ts` **2/2 koşuda başarısız**:
`dev-shell.spec.ts:22` → Vite `/api` proxy'si **500**, çünkü `npm run dev`'in
`dev:server`'ı **hiç dinlemeye başlamıyor** (`ECONNREFUSED 127.0.0.1:7433`).

**F-008'e ait olmadığı kanıtlandı:**
- `npm run dev:server` **tek başına** çalışıyor (`Mission Control API 127.0.0.1:7433 adresinde dinliyor.`)
- `npx tsx watch src/server/index.ts` **tek başına** çalışıyor.
- F-008'in gates izleyicisi devre dışı bırakıldığında (`service.ts:128`
  `startWatchingGatesIfPossible(record)` mutasyonu) **yine dinlemiyor**.
- Boş bir `MC_DATA_DIR` ile (hiç proje kaydı yok) **yine dinlemiyor**.
- Süreç tablosunda `tsx watch` çocuğu **yaşıyor** ama hiçbir port dinlemiyor.

Yani `concurrently` + `tsx watch` bileşimi bu makinede takılıyor; F-008 öncesine ait bir altyapı
sorunu. **F-008'in kararını etkilemiyor**, ama dört E2E yapılandırmasından biri kırmızı ve bu
`docs/blockers.md`'ye alınmalı.

### Bulgu 4 — ÖNEMLİ · Etiketi olmayan kapılarda ad tekrarı, kalıcı onay dosyasına da sızıyor

`GateRow.tsx:44` (`{gate.id} {gate.label}`) ve `list-gates.ts:88`/`readProcessLabels` birlikte,
`PROCESS.md`'de ikinci hücresi olmayan kapılarda `label = id` ürettiği için ekranda
**"ASSETS ASSETS"**, **"G4-1 G4-1"**, **"G4-10 G4-10"** yazıyor.
`docs/03-ux.md:203,208` mockup'ı bu satırları **`ASSETS`** ve **`G4-1`** olarak çiziyor.

Daha kötüsü, aynı tekrar **diske yazılan kalıcı artefakta** geçiyor:
modal başlığı `ASSETS — ASSETS kapısını onayla`, `.ok` içeriği
`ASSETS — ASSETS kapısı ONAYLANDI` (`F-008-06-modal-320px.png`).

Not: `list-gates.ts:16` yedek tablosu ASSETS için `'Higgsfield kredi bütçesi'` diyor, ama
`PROCESS.md` okunabildiğinde (normal durum) `label = 'ASSETS'` oluyor — iki yol tutarsız.

**Muhtemel dosya:satır:** `src/features/gates/web/GateRow.tsx:44,73` ·
`src/features/gates/server/list-gates.ts:16-22,55`.

### Bulgu 5 — DÜŞÜK · Dar genişlik: 320px'te Aksiyon sütunu 0 px, "Kapılar" sekmesi 13/59 px

`toBeVisible()` **kullanılmadı**; kırpılmış görünür genişlik (kaydırma kaplarının kesişimi) ölçüldü:

| Genişlik | "Kapılar" sekmesi | Aksiyon hücresi | `[Onayla]` | Tablo kabı |
|---|---|---|---|---|
| 320 px | **13 / 59 px** | **0 / 146 px** | 0 px | `clientWidth 281` vs `scrollWidth 458` |
| 375 px | 59 / 59 px ✓ | 39 / 146 px | 31 / 61 px | `336` vs `458` |
| 480 px | 59 / 59 px ✓ | 144 / 146 px ✓ | 61 / 61 px ✓ | `441` vs `458` |

**Kararım: kabul edilebilir, bulgu olarak DÜŞÜK önemde kaydediliyor — bloklayıcı değil.**
Gerekçeler:
1. `docs/03-ux.md:49` dar genişlikte sekme çubuğunu zaten **"yatay kaydırılabilir şerit"**
   olarak tanımlıyor; 13 px kırpılma bu tasarımın içinde ve **görünür bir kaydırma çubuğu** var
   (`F-008-05-320px.png`). F-007'nin bloklayıcısı **0 px + görünür affordance yok**'tu; burada
   durum farklı.
2. Aksiyon sütunu 320px'te ekran dışında ama **klavyeyle erişilebilir**: butona `focus()`
   verildiğinde kap `scrollLeft: 177`'ye kayıyor ve buton **61/61 px tam görünür** oluyor.
   Ayrıca tablo kabının altında **görünür yatay kaydırma çubuğu** var.
3. 375 px (Simple Browser'ın tipik genişliği) ve 480 px'te aksiyon **tıklanabilir/okunabilir**.
4. Aynı `overflow-x-auto` deseni kanban tahtasında zaten kabul edilmiş durumda.
5. Onay modalı 320 px'te tamamen kullanılabilir (`F-008-06-modal-320px.png`).

**Ama belge borcu var:** `docs/03-ux.md:813` hâlâ *"Ölçüldü: 320px ve 375px'te **iki sekme de**
tam görünür"* diyor. Sekme sayısı dörde çıktı ve 320 px'te dördüncüsü tam görünmüyor — bu satır
güncellenmeli (F-008'in eklediği bir hata değil, F-008'in geçersizleştirdiği bir ölçüm notu).

### Not 1 — sözleşmenin vaat ettiği `tests/features/gates/server/handlers.test.ts` yok

Sözleşme §10.1 bu dosyayı listeliyor; disk üzerinde yok. Kapsamı
`tests/integration/gates-api.test.ts` (gerçek `createServer()` + HTTP) **fazlasıyla** karşılıyor
— birim yerine entegrasyon, daha güçlü. Bulgu değil, sözleşme–kod sapması notu.

### Not 2 — canlı test hâlâ bir model kararına bakıyor

`gates-write-permission-live.test.ts:92` `expect(sawToolName).toBe('Write')` — modelin **hangi
aracı seçtiğine** assert ediyor. CLAUDE.md'nin "canlı testte modelin ne söyleyeceğine assert
etme" dersinin yumuşak bir ihlali; model başka bir araca yönelirse (ya da hiç araç kullanmazsa)
mekanizma sağlamken kırmızı verebilir. Bu turda **2/2 yeşil** geçti; ileride kararsızlık
görülürse iddia `canUseToolCalled === true` + dosya yokluğuyla sınırlanabilir.

### Not 3 — worker fork kararsızlığı bu turda iki kez görüldü

`exit code 3221226505`, farklı dosyalarda (`features-api.test.ts`, `gates-api.test.ts`).
İkisinde de elle ikinci koşu yeşil. Kod regresyonu değil; CLAUDE.md'nin kayıtlı sınıfı,
her görüldüğünde raporlanıyor.

---

## 5. Ek sınır ölçümleri

| Ölçüm | Sonuç |
|---|---|
| `x-mc-write` **başlıksız** `POST .../approve` | **403** ✓ |
| `confirmed` yok | **400** ✓ |
| `reason: "   "` | **400** ✓, dosya yok |
| Geçersiz kapı (`G9`) | **400** ✓ |
| Yol geçişi (`..%2F..%2Fevil`) | **400** ✓ |
| Bilinmeyen proje | **404** ✓ |
| **Onaylı kapıda `deny`** (R2) | **409 `conflict`** + taze `data` ✓, arayüz o butonu **hiç çizmiyor** ✓ |
| Reddedilen isteklerden sonra dosya sistemi | **tam eşitlik**, hiç değişmedi ✓ |
| **Panel çelişkili durum üretebiliyor mu** | 8 turluk eşzamanlı `approve` ∥ `deny` yarışı → **8/8 `approved`**, hiç `conflict` üretilmedi. Arayüzde de üretilemiyor (onaylıda `deny` 409, reddedilmişte önce arşiv). ✓ |
| Canlı güncelleme (harici dosya değişimi) | Panel yenilenmeden `Reddedildi`'ye döndü ✓ (`/api/health` `watchers: 2` — features + gates) |
| Escape ile modal kapatma | Modal kapandı, manifest **değişmedi** ✓ |
| Üretim CSS'i (`@source` çiti) | `src/features/gates/web` altında **yalnızca orada** geçen 7 sınıfın **7'si** de `dist/web/assets/*.css` içinde; eksik **0** ✓ |
| Türkçe metinler | `(kilitli)`, `Bekliyor/Onaylandı/Reddedildi/Çelişkili durum`, `Tanınmayan dosyalar: …`, `PROCESS.md okunamadı, varsayılan adlar gösteriliyor.`, `docs/approvals/G5.ok yazıldı`, `Önce bir proje seçin.`, `Kapı durumları okunamadı. [Tekrar dene]`, `Bu durum panelden düzeltilemez; …` → `docs/03-ux.md` ile birebir ✓ |
| Marka adı (`lang="tr"` büyük harf tuzağı) | `innerText` = `MISSION CONTROL` ✓ (`MİSSİON` değil) |
| Konsol hataları | Yalnızca kasıtlı fault injection'ın 500'leri; başka hata/uyarı yok ✓ |

---

## 6. Puanlar

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **8** / 10 | 9 kabul kriterinin tamamı gerçek tarayıcıda uçtan uca doğrulandı; yarı-başarı dürüst, yeniden deneme idempotent, süreç fault injection altında yaşadı, çelişkili durum üretilemedi. Eksi: Bulgu 1 (harf duyarlılığı çelişkisi). |
| Özellik bütünlüğü | **8** / 10 | Sözleşmedeki her uç, durum makinesi, arşiv akışı, SSE kanalı, dar genişlik ve canlı L5 ölçümü mevcut. Eksi: Bulgu 4 (etiket tekrarı UX mockup'ından sapıyor), Not 1 (vaat edilen birim test dosyası yok). |
| Görsel / UX | **7** / 10 | Ekran mockup'a sadık, dört durum ayrımı net, modal 320px'te kullanılabilir, erişilebilirlik (focus trap, Escape, `aria-live`) çalışıyor. Eksi: "ASSETS ASSETS"/"G4-1 G4-1" tekrarı kalıcı `.ok` dosyasına da sızıyor; 320px'te Aksiyon sütunu keşfedilmesi gereken yatay kaydırmanın arkasında; `docs/03-ux.md:813` ölçüm notu geçersizleşti. |
| Kod kalitesi (test, hata yönetimi) | **7** / 10 | 1066 birim/entegrasyon + 8 E2E; **11 mutasyonun 10'u kırmızı**, iki katmanlı savunmalar (statik + dinamik) ayrı ayrı kanıtlandı; asenkron handler'lar kendi `try/catch`'ini taşıyor ve R5 sınıfı gerçekten çitlenmiş. Eksi: **QA-B yeşil kaldı** — sözleşmenin merkez iddiasının (önizleme ≡ diske yazılan) sıfır kapsaması var; harf duyarlılığı vakası hiç test edilmiyor. |

**Hiçbiri < 7.**

## 7. Karar

**KARAR: GEÇTİ** · **ESKALE: false**

Bloklayıcı yok. Gerekçe: yazma kapısı çitleri (statik + dinamik), iki adımlı onay, red gerekçesi
zorunluluğu, AC9 sırası, `x-mc-write` sınırı ve R1/R5 çitlerinin hepsi bağımsız mutasyonlarla
**kırmızı** verdi; iptal "hiçbir dosya yazmaz" iddiası **işlemden önce alınmış** manifestle tam
eşitlik olarak kanıtlandı; yarı-başarı dürüstçe raporlanıyor ve veri kaybı yok; panel kendi
eylemiyle çelişkili durum üretemiyor; gerçek `docs/approvals/` bozulmadı.

Dört ÖNEMLİ + bir DÜŞÜK bulgu bir sonraki tura devrediliyor (Bulgu 3 F-008'in değil, projenin
borcu). Bulgu 1 ve 2 için `docs/blockers.md`'ye madde açılması önerilir.

## 8. Kota ve yetim süreç

- **Kota harcayan tek koşu:** `MC_GATES_LIVE_TESTS=1 npm run test:gates-live` — **1 kez**,
  2 test, ~32 s, model `claude-haiku-4-5`, her ikisinde de `canUseTool` **her zaman reddet**
  (hiçbir araç gerçekten çalışmadı). Başka hiçbir canlı model çağrısı yapılmadı
  (`playwright.config.ts` `MC_CHAT_ENABLED: '0'`).
- **Yetim süreç: 0.** Tur sonunda `mission-control` komut satırı içeren **hiç** `node.exe`
  kalmadı; `:4599` kapalı (`HTTP=000`). QA'nın açtığı iki süreç ağacı (üretim sunucusu +
  teşhis amaçlı `npm run dev`) `taskkill /T /F` ile kapatıldı.
  **`C:\dev\apps\hayat-mentoru` süreçlerine dokunulmadı** (`next dev` ve `next start -p 3211`
  ağaçları ölçüm sırasında da tur sonunda da ayakta).

## 9. Ekran görüntüleri

| Dosya | İçerik |
|---|---|
| `docs/qa/screens/F-008-01-liste-1280.png` | Kapı listesi, dört durum, G4-N sayısal sıra, "Tanınmayan dosyalar" |
| `docs/qa/screens/F-008-02-onay-modali.png` | İki adımlı onay modalı + önizleme |
| `docs/qa/screens/F-008-03-red-formu.png` | Satır içi zorunlu gerekçe formu |
| `docs/qa/screens/F-008-04-yari-basari.png` | Yarı-başarı: gerçek arşiv yolu, modal açık, satır "Bekliyor" |
| `docs/qa/screens/F-008-05-320px.png` | 320 px — kaydırma çubukları, Aksiyon sütunu ekran dışında |
| `docs/qa/screens/F-008-06-modal-320px.png` | 320 px onay modalı (+ "ASSETS — ASSETS" tekrarı) |
| `docs/qa/screens/F-008-07-celiski-detay.png` | Çelişkili durum `[Detay]` alt satırı |
| `docs/qa/screens/F-008-08-buyuk-kucuk-harf-celiskisi.png` | Bulgu 1'in izole kanıtı |
