KARAR: GEÇTİ
ESKALE: false

---
feature: F-008
title: Kapılar paneli — üç ÖNEMLİ bulgunun kapanış doğrulaması (S1/S2/S3)
reviewer: qa-evaluator
date: 2026-09-09
tur: 2 (dar kapsamlı düzeltme doğrulaması)
onceki: docs/qa/F-008-2026-09-09.md (KARAR GEÇTİ, bloklayıcı yok)
---

# F-008 tur 2 — kapanış doğrulaması

Kapsam **yalnızca** tur 1'in üç ÖNEMLİ bulgusunun düzeltmesi (`docs/qa/F-008-contract.md` §13,
düzeltme commit'i `a6ee710`). Tur 1'de GEÇTİ verilen hiçbir konu yeniden ölçülmedi.

## 0. Ölçüm ortamı

- **`npm run build && npm start`** (ADR kısıtı: `npm run dev` kullanılmadı), `MC_PORT=4611`,
  `MC_DATA_DIR=<scratchpad>/sb2/data`. Üç sandbox proje: `projA` (temiz), `projB`
  (`g2.ok` + `g5.deny.md`, küçük harf), `projC` (`G2.OK` + `g4-1.Ok`, karışık harf).
- Tüm yazma ölçümleri sandbox projelerde yapıldı. **Gerçek `docs/approvals/` hiç değişmedi**
  (§5).
- Her mutasyon: uygula → koştur → **birebir geri yaz**. Tur boyunca `git status --porcelain`
  yalnızca bu raporu ve iki ekran görüntüsünü gösterdi.

---

## 1. S1 — Önizleme ≡ diske yazılan (tur 1 Bulgu 2)

Düzeltme: istemci gösterdiği önizlemeyi `expectedBody` olarak gönderiyor; sunucu kendi güvendiği
girdilerle metni yeniden üretip **tam eşitlik** arıyor; uyuşmazsa 409, hiçbir `fs` mutasyonu yok
(`handlers.ts:184-195`).

### 1a. QA-B mutasyonunun birebir tekrarı — **KIRMIZI** ✓

`ApproveModal.tsx:82` → `await onConfirm(decision + ' [QA gizli ek]', preview)`

```
FAIL tests/features/gates/web/GatesScreen.test.tsx > GatesScreen — onay akışı (AC7 iki adım,
     iptal yazmaz) > S1 (QA Bulgu 2): sunucuya gönderilen decision/expectedBody, EKRANDAKİ
     önizlemeyle birebir aynı
Test Files 2 failed | 70 passed | 1 skipped (74)
Tests      2 failed | 1063 passed | 4 skipped (1081)
```
(İkinci kırmızı `tests/integration/send-event-hook.test.ts` — F-004 dönemine ait, S1'le ilgisiz,
aynı testin diğer üç koşuda yeşil olduğu **zamanlama kararsızlığı**; bkz. §6 Not 2.)

Tur 1'de **aynı mutasyon 1066/1066 yeşil** kalıyordu. Çit artık var.

### 1b. Eşitlik kontrolünü devre dışı bırakan mutasyon — **KIRMIZI** ✓

`handlers.ts:184` → `if (false && bodyText !== expectedBody) {`

```
FAIL tests/integration/gates-api.test.ts > POST approve — önizleme ≡ diske yazılan bayt eşitliği
     (S1, QA Bulgu 2) > expectedBody sunucunun üreteceğinden farklıysa 409 conflict, dosya yazılmaz
FAIL … > QA-B sınıfı: decision gönderilmeden hemen önce değiştirilirse (önizlemeyle uyuşmaz),
     yazma engellenir
Tests 2 failed | 1075 passed | 4 skipped (1081)
```

### 1c. Canlı doğrulama — 409 + **hiçbir dosya oluşmuyor** ✓

Fotoğraf **işlemden ÖNCE** alındı (`manifest.cjs`: relPath + size + **mtimeMs** + sha256).

| Senaryo (üretim sunucusu, `projA`) | HTTP | Dosya sistemi |
|---|---|---|
| `expectedBody` tamamen farklı bir metin | **409** `conflict` | manifest **birebir aynı** (mtime dahil), `approvals/` boş |
| **QA-B birebir**: `expectedBody` orijinal karardan, `decision` = orijinal + `' [QA gizli ek]'` | **409** | `approvals/` **boş** |
| `expectedBody` yok | **400** `"Beklenen içerik eksik."` | dosya yok |
| `expectedBody: 42` (yanlış tip) | **400** | dosya yok |
| **`G1.deny.md` VARKEN** uyuşmaz `expectedBody` | **409** | `G1.deny.md` **yerinde**, mtime **değişmedi**, `archive/` **oluşmadı** ← sözleşmenin "arşivleme dahil hiçbir dosyaya dokunulmaz" iddiası kanıtlandı |
| Doğru `expectedBody` (mutlu yol) | **200** | `G0.ok` yazıldı, **disk === expectedBody** (`true`) |

### 1d. Tur 1'in ikinci ayrışması: modal AÇIKKEN kaynak değişirse — kapandı ✓

Gerçek tarayıcıda (`projA`, G6): modal açıkken `docs/PROCESS.md`'de `| G6 Yayin |` →
`| G6 DEGISTIRILMIS-ETIKET |`. Önizleme hâlâ `G6 — Yayin kapısı ONAYLANDI`.
`Onayı Yaz →` sonrası:

- **Modal açık kalıyor**, karar metni korunuyor, hata satırı:
  *"Onay önizlemesi güncelliğini yitirdi (gösterilen bilgiler değişmiş olabilir); pencereyi kapatıp
  tekrar deneyin."* — `docs/03-ux.md:648`'e eklenen metinle **birebir**.
- Manifest diffi: **yalnızca benim değiştirdiğim `PROCESS.md`**; `G6.ok` **yok**, dosya sayısı
  10 → 10.
- **Kurtarma yolu ölçüldü** (tek istek yetmez, ders 30): iptal → yeniden aç → önizleme artık
  `G6 — DEGISTIRILMIS-ETIKET kapısı ONAYLANDI` → **200**, diske yazılan içerik kullanıcının
  gördüğüyle aynı. Çıkmaz sokak değil.

Tur 1'de bu senaryo **sessizce ayrışıyordu** (ekranda eski etiket, diske yeni etiket).

E2E tarafı da gerçek: `tests/e2e/gates.spec.ts:110-127` artık `expect(content).toBe(previewText)`
(`toContain` değil) — tur 1'in "önek eşleşmesi yakalayamaz" boşluğu kapandı.

---

## 2. S2 — Windows harf duyarsızlığı (tur 1 Bulgu 1)

### 2a. Orijinal repro — split-brain **gitti** ✓

`projB` = yalnızca `g2.ok` + `g5.deny.md`. Gerçek tarayıcı, üretim derlemesi
(`docs/qa/screens/F-008-tur2-01-s2-split-brain-gitti.png`):

```
Kapı                Durum        Tarih        Aksiyon
G0 Fikir            Bekliyor     —            Onayla / Reddet
G2 Mimari           Onaylandı    2026-09-09   (kilitli)
G5 Guvenlik/kalite  Reddedildi   2026-09-09   Onayla
```
**"Tanınmayan dosyalar" satırı hiç yok.** `GET /api/gates` → `unrecognized: []`.
Tur 1'deki "aynı ekranda hem *Tanınmayan dosyalar: g2.ok* hem *G2 Onaylandı*" çelişkisi ortadan
kalktı.

### 2b. Karışık harf varyantları ✓

`parseGateFileName` (gerçek fonksiyon, tek tek çağrıldı):

| Girdi | Sonuç |
|---|---|
| `g2.ok`, `G2.OK`, `g2.OK` | `{gateId:'G2', kind:'ok'}` |
| `G4-1.Ok` | `{gateId:'G4-1', kind:'ok'}` |
| `assets.ok`, `ASSETS.OK` | `{gateId:'ASSETS', kind:'ok'}` |
| `g5.DENY.MD`, `G5.Deny.Md` | `{gateId:'G5', kind:'deny'}` |
| `G7.ok`, `G2.ok.bak` | `undefined` (doğru — tanınmayan) |

`projC` (`G2.OK` + `g4-1.Ok`) listesi: `unrecognized: []`, `G2=approved`, `G4-1=approved`,
sıra doğru (`ASSETS` ile `G5` arasında).

### 2c. Mutasyonlar

| # | Mutasyon | Sonuç |
|---|---|---|
| **M3** | `i` bayrağı iki desenden de kaldırıldı (`gate-id.ts:27,28`) | **KIRMIZI ×3** — `list-gates.test.ts` "Windows harf duyarsızlığı (S2)" grubunun üç testi. `Tests 3 failed \| 1074 passed` |
| **M4** | *(ikinci katman)* `.toUpperCase()` normalizasyonu kaldırıldı (`gate-id.ts:34,36`), `i` bayrağı yerinde | **1077/1077 YEŞİL** → bkz. §6 Not 1 |

### 2d. Normalize etmenin yan etkisi — **ikinci dosya OLUŞMUYOR** ✓ (ama yazma reddediliyor)

Brief'in kritik sorusu: `.ok` yazılırken iki farklı adla iki dosya oluşabiliyor mu? **Hayır.**
Ölçüldü (`projB`, üretim sunucusu):

| İşlem | Sonuç | Dizin |
|---|---|---|
| `g5.deny.md` varken G5 onayla | **500** `"Kaydedilemedi, tekrar deneyin."` | `["g2.ok","g5.deny.md"]` — **değişmedi** |
| `g2.ok` varken G2 onayla | **500** | **değişmedi** |
| `G2.OK` varken (`projC`) G2 reddet | **409** *"Bu kapı zaten onaylı, reddedilemez."* | değişmedi |

Sunucu günlüğü: `Hata: kapı red kaydı arşivlenemedi (G5): İşlem, hedef yolla eşleşmiyor.` /
`Hata: kapı onayı yazılamadı (G2): İşlem, hedef yolla eşleşmiyor.`

Kök neden: `src/server/write-gate.ts:95-120` — adım 4 en yakın **var olan** atayı buluyor
(`existsSync('…/G2.ok')` Windows'ta küçük harfli dosya için **true**), adım 5 onu
`fs.realpathSync.native` ile diskteki gerçek yazıma (`g2.ok`) kanonikleştiriyor, adım 8'in
`OPERATION_PATTERNS.approval` regex'i (`…/(G[0-6](-\d{1,3})?|ASSETS)\.ok$`, **harfe duyarlı**)
eşleşmiyor → `write_denied`.

**Bu turun regresyonu DEĞİL:** `write-gate.ts` düzeltme commit'inde hiç değişmedi
(`git show --stat a6ee710`), son dokunuluşu `dc0a02b` (F-007 dönemi). Tur 1'de de aynı satır
(`G5 Reddedildi → [Onayla]`) vardı ve aynı 500'ü verirdi. Yeni bloklayıcı üretmiyor: **veri
kaybı yok, yanlış dosya yazılmıyor, süreç yaşıyor, modal açık kalıyor, karar metni korunuyor**
(tarayıcıda ölçüldü, `docs/qa/screens/F-008-tur2-02-kucuk-harfli-dosyada-yazma-500.png`).
Yine de §6 Not 3'e alınıyor: S2 düzeltmesi "Tanınmayan dosyalar" ipucunu (bilinçli olarak,
sözleşme `unrecognized` **boş** olmalı diyor) kaldırdığı için kullanıcı artık bu çıkmazın
nedenine dair **hiçbir sinyal** görmüyor.

---

## 3. S3 — `.ok` içeriğinde ad tekrarı (tur 1 Bulgu 4)

Üretim sunucusuna gerçek istekler; dosyalar **diskten okundu**.

**Etiketsiz kapı — `ASSETS.ok`:**
```
ASSETS kapısı ONAYLANDI
Tarih: 2026-09-09
Onaylayan: Panel kullanıcısı (Kapılar ekranı, iki adımlı onay)

Onaylanan özet: Panel Kapılar ekranından "ASSETS" kapısı onaylandı (proje: sandbox-A).

Kullanıcının kararı: Butce onaylandi.
```
**Etiketsiz kapı — `G4-1.deny.md`:** `# G4-1 kapısı REDDEDİLDİ` (tekrar yok).

**Etiketli kapı — `G3.ok`:** `G3 — UX kapısı ONAYLANDI` … `"G3 — UX" kapısı onaylandı` ✓
**Etiketli kapı — `G5.deny.md`:** `# G5 — Guvenlik/kalite kapısı REDDEDİLDİ` ✓

`docs/PROCESS.md:35` formatı ("tarih + onaylanan özet + kullanıcının kararı"): dört dosyanın
dördünde de üç bileşen **birebir** var.

**Ekranda** (tarayıcı, `innerText`): satır `ASSETS` — tur 1'deki `ASSETS ASSETS` gitti.

**Mutasyon M5:** `gate-id.ts:50`'den `label === id ? id :` kısayolu kaldırıldı →
**KIRMIZI ×3**: `format-approval.test.ts` (`buildApprovalBody` + `buildDenialBody` golden
string'leri) ve `GatesScreen.test.tsx` ("etiketsiz kapıda ad TEKRARLANMAZ").
`Tests 3 failed | 1074 passed`.

---

## 4. Mutasyon tablosu

| # | Mutasyon | Hedef | Sonuç |
|---|---|---|---|
| M1 | `onConfirm(decision + ' [QA gizli ek]', preview)` (**QA-B birebir**) | `ApproveModal.tsx:82` | **KIRMIZI** (GatesScreen.test.tsx S1) |
| M2 | `if (false && bodyText !== expectedBody)` | `handlers.ts:184` | **KIRMIZI ×2** (gates-api.test.ts S1 grubu) |
| M3 | `/…/i` → `/…/` (iki desen) | `gate-id.ts:27,28` | **KIRMIZI ×3** (list-gates.test.ts S2 grubu) |
| M4 | `.toUpperCase()` kaldırıldı (S2'nin **ikinci** katmanı) | `gate-id.ts:34,36` | **YEŞİL 1077/1077** → Not 1 |
| M5 | `label === id ? id :` kısayolu kaldırıldı | `gate-id.ts:50` | **KIRMIZI ×3** (format-approval ×2 + GatesScreen) |

Brief'in istediği üç mutasyonun (M1, M3, M5) **üçü de KIRMIZI**; ek olarak S1'in sunucu yarısı
(M2) da kırmızı. M4 gönüllü ek katman ölçümüdür.

---

## 5. Zorunlu kontroller

| Kontrol | Sonuç |
|---|---|
| `npm run verify` | **EXIT 0, ilk koşuda yeşil** (worker-fork kararsızlığı görülmedi): `Test Files 73 passed \| 1 skipped (74)`, `Tests 1077 passed \| 4 skipped (1081)`, `tsc`/`eslint` temiz, `vite build ✓` |
| `npm run e2e` | **EXIT 0 — 36 passed (39.2s)**, `gates.spec.ts`'in 8 testi dahil |
| `grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` | **Ürün kodunda sıfır.** 12 eşleşmenin tamamı önceden var olan **meşru test adları** (`gates-manifest.test.ts:222`, `write-gate-manifest.test.ts:124`, `feature-detail.test.ts` ×6, `features-api.test.ts` ×3) |
| `docs/blockers.md` — `e2e:dev` borcu | ✓ işlenmiş: *"2026-09-09 — `npm run e2e:dev` kırmızı (proje borcu, F-008'e ait DEĞİL)"*, dört ayırt edici ölçüm + kapatma yolu + eşik dahil |
| `docs/03-ux.md:813` | ✓ güncellenmiş: F-007 ölçümü "geçersiz" işaretlenmiş, F-008'in gerçek 320/375/480px değerleri (`13/59 px`, `0/146 px`, `59/59`, `144/146`) yazılmış |
| **Gerçek `docs/approvals/`** | **Değişmedi.** Tur başı/tur sonu `sha256sum docs/approvals/*` çıktıları `diff` ile **birebir aynı**; dizin içeriği `G0.ok G1.ok G2.ok G3.ok G4-1.ok README.md` — yeni dosya yok, `archive/` yok, silme/taşıma yok |
| Yetim süreç | **0.** Tur sonunda komut satırında `mission-control` geçen **hiç** `node.exe` yok; `:4611` yalnızca `TIME_WAIT`. Sunucu ağacı `taskkill /T /F` ile kapatıldı (4 süreç). **`C:\dev\apps\hayat-mentoru` süreçlerine dokunulmadı** (`next dev` PID 37640 ve `next start -p 3211` PID 47360 ağaçları ölçüm boyunca ve tur sonunda ayakta) |
| Kota | **Sıfır canlı model çağrısı** — `test:gates-live` bu turda hiç koşturulmadı |

---

## 6. Notlar (yeni bloklayıcı yok)

**Not 1 (ÖNEMLİ, çit boşluğu — ürün kodu DOĞRU).** S2 iki katmanlı: (a) `i` bayrağı,
(b) `.toUpperCase()` normalizasyonu. (a) çitli; **(b) çitsiz.** `.toUpperCase()`'i kaldıran
mutasyon **1077/1077 yeşil** kalıyor, oysa gerçek bir sızıntı üretiyor — probla ölçüldü
(`g2.ok` içeren proje):

```
doğru kod : G0 | G1 | G2=approved | G3 | ASSETS | G5 | G6        (7 satır)
mutant    : G0 | G1 | G2=approved | G3 | ASSETS | G5 | G6 | g2=approved   (8 satır)
```
Mutantta panel **aynı kapıyı iki satırda** gösteriyor (`g2` listenin sonuna düşüyor,
`sortKey` bilinmeyen id'yi 99'a atıyor) — yani split-brain yer değiştirmiş hâlde geri geliyor.
Mevcut S2 testleri yalnızca `unrecognized`'ın boş ve `G2`'nin `approved` olduğunu iddia ediyor;
**satır kümesinin tamamını** (`toEqual`) iddia etmiyor. Bir sonraki dokunuşta
`list-gates.test.ts`'in S2 grubuna `gates.map(g => g.id)` üzerinde tam eşitlik assert'i eklenmeli.
Şiddet: ÖNEMLİ, bloklayıcı değil — ürün kodu doğru ve S2'nin **asıl** katmanı (regex) çitli.

**Not 2 (DÜŞÜK).** `tests/integration/send-event-hook.test.ts:185` bu turun 5 vitest koşusunun
**1'inde** kırmızı verdi (`expected [] to have a length of 1`), diğer 4'ünde yeşil — F-004
dönemine ait bir zamanlama kararsızlığı, F-008 ile ilgisi yok. `verify` ve `e2e` yeşil.
CLAUDE.md'nin bilinen worker-fork sınıfından **farklı** (bu bir assert kararsızlığı, çökme değil).

**Not 3 (ÖNEMLİ, taşınan borç — bu turun ürünü DEĞİL).** §2d'deki çıkmaz: `docs/approvals/`
altında kanonik olmayan harfle yazılmış bir kapı dosyası varsa o kapıya panelden **hiçbir zaman**
onay/red yazılamıyor (kalıcı 500 `"Kaydedilemedi, tekrar deneyin."`), ve S2 düzeltmesinden sonra
kullanıcı bunun nedenine dair hiçbir ipucu görmüyor ("Tanınmayan dosyalar" satırı bilinçli olarak
kaldırıldı). Kök neden `write-gate.ts`'in `realpathSync.native` + harfe **duyarlı**
`OPERATION_PATTERNS` ikilisi (bu turda dokunulmamış, F-007 dönemi kod). Gerçek depoda tüm dosyalar
kanonik olduğu için pratikte tetiklenmiyor. `docs/blockers.md`'ye madde açılması önerilir.

**Not 4 (bilgi).** İstemci `todayIso()` ve sunucu `isoDate()`'in ikisi de `toISOString()` (UTC)
kullanıyor → tarih ayrışması yalnızca UTC gece yarısını kesen bir modal penceresinde mümkün ve o
durumda da sonuç 409 + çalışan kurtarma yolu (§1d). Kabul edilebilir.

---

## 7. Puanlar

| Boyut | Tur 1 | Tur 2 | Gerekçe |
|---|---|---|---|
| İşlevsellik | 8 | **9** / 10 | Harf duyarlılığı çelişkisi kapandı; onay yolu artık ayrışmayı **tespit edip** yazmayı engelliyor ve kurtarma yolu ölçüldü. Eksi: §2d çıkmazı (taşınan borç). |
| Özellik bütünlüğü | 8 | **9** / 10 | Etiket tekrarı hem ekranda hem kalıcı artefaktta kalktı, UX mockup'ıyla uyumlu; 409 metni `03-ux.md` sözlüğüne birebir eklendi. |
| Görsel / UX | 7 | **8** / 10 | `ASSETS`/`G4-1` satırları temiz, hata metni buyurgan değil ve ne yapılacağını söylüyor, modal durumu korunuyor. Eksi: §6 Not 3 (sessiz çıkmaz), 320px Aksiyon sütunu (tur 1'de DÜŞÜK olarak kabul edilmişti). |
| Kod kalitesi (test, hata yönetimi) | 7 | **8** / 10 | 1077 birim/entegrasyon + 36 E2E; brief'in istediği **üç mutasyonun üçü de kırmızı** + S1'in sunucu yarısı da kırmızı; E2E artık `toBe` ile bayt eşitliği ölçüyor; 409 yolu **hiçbir `fs` mutasyonu yapmadan** (arşiv dahil) dönüyor. Eksi: §6 Not 1 (normalizasyon katmanı çitsiz). |

**Hiçbiri < 7.**

## 8. Karar

**KARAR: GEÇTİ** · **ESKALE: false**

S1, S2 ve S3'ün üçü de gerçek tarayıcıda/üretim sunucusunda canlı doğrulandı; brief'in istediği
üç mutasyonun üçü de KIRMIZI verdi; `npm run verify` (1077 test) ve `npm run e2e` (36 test) yeşil;
gerçek `docs/approvals/` sha256 düzeyinde değişmedi; yetim süreç yok. **Bu turun düzeltmesi yeni
bir bloklayıcı üretmedi.** Feature notu `status: done` yapıldı.

Kapanışta taşınan üç not (§6) bloklayıcı değildir; Not 1 ve Not 3 için `docs/blockers.md`'ye
madde açılması önerilir.

## 9. Ekran görüntüleri

| Dosya | İçerik |
|---|---|
| `docs/qa/screens/F-008-tur2-01-s2-split-brain-gitti.png` | `projB` (`g2.ok`+`g5.deny.md`): "Tanınmayan dosyalar" satırı yok, G2 kilitli, `ASSETS` tek kelime |
| `docs/qa/screens/F-008-tur2-02-kucuk-harfli-dosyada-yazma-500.png` | §2d çıkmazı: modal açık, `"Kaydedilemedi, tekrar deneyin."`, karar metni korunuyor |
