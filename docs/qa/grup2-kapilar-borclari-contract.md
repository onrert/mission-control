---
type: qa-contract
date: 2026-09-11
status: qa
---

# Sözleşme — Grup 2: kapılar ekranı ve çevresi borç kapatma (S1, S2, N6)

**Kaynak:** CEO görev talimatı (Grup 2, G6 öncesi borç kapatma turu), `docs/blockers.md`
"2026-09-09 — F-008 kapanışından taşınan iki borç" (S1, S2) ve "2026-09-08 — F-013 devreden
açık madde" / "2026-09-10 güncelleme" (N6).

**Dosya sahipliği (bu turda dokunulan):** `src/server/write-gate.ts`,
`src/features/kanban/web/FeatureDetailModal.tsx` (yalnızca doğrulama amaçlı geçici mutasyon,
kalıcı değişiklik YOK), `tests/integration/gates-api.test.ts`,
`tests/features/gates/shared/gate-id.test.ts` (yeni), `tests/e2e/kanban.spec.ts`. `src/features/
gates/shared/gate-id.ts`'e KALICI değişiklik yapılmadı (zaten düzeltilmişti, bkz. §2).
`.claude/`, `docs/approvals/`, `data/` altına dokunulmadı.

## 0. Diskte doğrulanmış durum (kodlamadan ÖNCE, üç maddenin de bugün gerçekten açık olup
olmadığı)

| Madde | Sözleşme öncesi iddia | Kod okuma + canlı test sonucu |
|---|---|---|
| S1 — `write-gate.ts` kanonik olmayan harfli dosya varken kalıcı 500 | AÇIK | **AÇIK, doğrulandı** — `resolveInsideRoot` adım 4-5-8 arasında, `OPERATION_PATTERNS.approval/denial/archive` harfe DUYARLIYDI. Repro: bkz. §1.1. |
| S2 — `.toUpperCase()` normalizasyonu çitsiz | AÇIK | **AÇIK, doğrulandı** — `parseGateFileName`'in `.toUpperCase()`'i kaldırılınca 322 mevcut test (7 dosya) YEŞİL kaldı, yalnızca YENİ yazılan tam-küme testi (228/457) KIRMIZI verdi. Bkz. §1.2. |
| N6 — `kanban.spec.ts` K6 `.focus()` ile "test ediyor" | AÇIK | **AÇIK, doğrulandı** — `tabIndex={0}` kaldırılınca test YEŞİL kalıyordu (QA'nın orijinal M6 bulgusuyla birebir). Bkz. §1.3. |

Üçü de bugün gerçekten açıktı; "kayıt yanlış" ilan edilecek bir madde yok. `gate-id.ts`'teki
S2 etiketli ÖNCEKİ düzeltme (`a6ee710`, gate-id.ts'in KENDİ okuma/tarama davranışı için harfe
duyarsızlık) zaten commit'liydi ve DOKUNULMADI — o, blockers.md'nin S1/S2 madde 1-2'sinden
FARKLI bir katmanın (liste/okuma) düzeltmesiydi; bu turun S1/S2'si YAZMA katmanı (write-gate.ts)
ve normalizasyonun ÇİTİ ile ilgili, ayrı bulgular.

### 0.1 Terim çakışması uyarısı (kod okurken karışabilir)
Commit `a6ee710`'un mesajı "S1/S2/S3" etiketlerini KULLANIYOR ama bunlar `docs/qa/
F-008-2026-09-09.md` round-3 turunun KENDİ numaralandırmasıdır (S1=önizleme-eşitliği/expectedBody,
S2=gate-id.ts tarama harfe-duyarsızlığı, S3=formatGateTitle tekrarı) — CEO'nun bu turdaki brief'i
`docs/blockers.md`'nin "F-008 kapanışından taşınan iki borç" başlığı altındaki madde 1/2'yi
"S1"/"S2" diye anıyor, bunlar AYNI ISIMLI ama FARKLI bulgular. Bu sözleşmede "S1" = write-gate.ts
kalıcı 500 (blockers.md madde 1), "S2" = gate-id.ts `.toUpperCase()` çitsizliği (blockers.md
madde 2) anlamındadır; `a6ee710`'daki S1/S2/S3 ile KARIŞTIRILMAMALI.

## 1. Tekrar üretme adımları ve kök neden

### 1.1 S1 — write-gate.ts kalıcı 500

**Repro (scratch test, `writeGateApproval` doğrudan çağrılarak):**
1. Geçici bir proje kökünde `docs/approvals/g2.ok` (küçük harf) oluştur.
2. `writeGateApproval(root, 'G2', 'yeni içerik')` çağır.
3. Sonuç: `{ ok: false, code: 'write_denied', message: 'İşlem, hedef yolla eşleşmiyor.' }`.
4. Aynı çağrıyı tekrar yap → AYNI hata (dosya diskte kaldığı için kalıcı).

**Kök neden:** `resolveInsideRoot` adım 4, `fs.existsSync(candidate)` Windows'ta harfe duyarsız
olduğu için `G2.ok` adayını "zaten var" sayıyor (gerçek dosya `g2.ok`). Bu durumda döngü hiç
çalışmıyor, `anc = candidate` (istenen BÜYÜK harfli ad) kalıyor. Adım 5'te `fs.realpathSync.
native(anc)` diskteki GERÇEK adı (küçük harfli `g2.ok`) döndürüyor — bu, Windows'un kendi
kanonikleştirmesi, kodun bir hatası değil. Adım 7'de `targetPath` bu küçük harfli ada eşitleniyor
(`path.relative(anc, candidate)` boş dize döndüğü için). Adım 8'de `OPERATION_PATTERNS.approval`
(`/^docs\/approvals\/(G[0-6]...)\.ok$/`, `i` bayrağı YOK) `docs/approvals/g2.ok` ile
eşleşmiyor → `write_denied`. HTTP katmanında (`handlers.ts` `handleApproveGate`) bu spesifik
`code` ayrımı yapılmadan genel 500 `write_failed`'e düşüyor — kullanıcı "kalıcı 500" görüyor.

**Neden kalıcı:** dosya diske yazılmadığı (write reddedildiği) için `g2.ok` hiç değişmiyor;
sonraki her istekte AYNI adımlar AYNI sonuca varıyor. Kullanıcının bunu kendi başına
düzeltmesinin tek yolu dosyayı elle yeniden adlandırmak — panelin kendisi bunu yapamıyor.

### 1.2 S2 — `.toUpperCase()` çitsiz

**Repro:** `parseGateFileName`'deki iki `.toUpperCase()` çağrısı kaldırılır (mutasyon). Mevcut
7 test dosyası (`format-approval.test.ts`, `gates-manifest.test.ts`, `list-gates.test.ts`,
`GatesScreen.test.tsx`, `useGates.test.ts`, `gates-api.test.ts` + entegrasyon), toplam 322 test,
**hepsi YEŞİL kalıyor**. Kök neden: `list-gates.ts`'in `discoveredIds` kümesi `BASE_ORDER` ile
HER ZAMAN kanonik `'G2'`yi içeriyor; bu kanonik girdinin durumu `getGateStatus('G2', ...)` ile
BAĞIMSIZ olarak `fs.existsSync(path.join(approvalsDir, 'G2.ok'))` üzerinden hesaplanıyor —
Windows'ta bu, harfe duyarsız olduğu için `g2.ok` dosyasını YİNE buluyor ve `G2` satırını
"approved" gösteriyor. Mevcut testler yalnızca "`G2` satırının durumu approved mı" diye
bakıyor — bunu her hâlükârda (normalizasyon çalışsın çalışmasın) doğru buluyorlar. Gerçek hata
(normalizasyon kaldırılınca) `discoveredIds`'e AYRICA normalize-edilmemiş `'g2'` kimliğinin de
eklenmesi ve panelde AYNI kapının İKİ SATIR halinde görünmesidir ("G2" + "g2", ikisi de
approved) — hiçbir mevcut test bu YİNELENEN satırı ya da id kümesinin TAM içeriğini kontrol
etmiyor.

**Yazılan çit (`tests/features/gates/shared/gate-id.test.ts`):** kimlik listesi `isValidGateId`
(kaynağın kendisi, `GATE_ID_PATTERN`'in dışa açılan doğrulayıcısı) ile geniş bir aday uzayından
(G0-G9 × {yok,0,1,9,42,99,100,999,1000 sonek} + ASSETS + küçük harf "assets") SÜZÜLEREK
üretiliyor — sabit bir dizi teste elle kopyalanmadı. Süzülen küme: 7 bare (`G0`..`G6`) + 7×7=49
sonekli + `ASSETS` = 57 kanonik kimlik. Her kimlik için hem `.ok` hem `.deny.md` dosya adının
orijinal/küçük harf/büyük harf/alternatif-harf varyantları `parseGateFileName`'e verilip
`gateId`'nin HER ZAMAN kanonik forma normalize edildiği doğrulanıyor (457 test).

**Mutasyon kanıtı (elle, `git checkout` KULLANILMADI):**
- `.toUpperCase()` iki çağrı da kaldırıldı → `tests/features/gates/shared/gate-id.test.ts` tek
  başına: **228/457 KIRMIZI** (yalnızca zaten-kanonik varyantlar, ör. tam büyük harf hâli zaten
  kendisiyle eşit olduğu için yanlışlıkla yeşil kalanlar hariç, geri kalanı kırmızı).
- AYNI mutasyonla `tests/features/gates/` + `tests/integration/gates-api.test.ts` (7 ESKİ dosya,
  322 test) birlikte koşturuldu: **7/7 dosya YEŞİL** — QA'nın orijinal "1077/1077 yeşil kaldı"
  bulgusuyla birebir tutarlı, yeni çit olmadan bu mutasyon gerçekten görünmez kalıyor.
- Mutasyon elle geri alındı (`.toUpperCase()` eklendi), `git diff src/features/gates/shared/
  gate-id.ts` **boş** — iz kalmadı, 457/457 tekrar YEŞİL.

### 1.3 N6 — kanban.spec.ts K6 gerçek klavye ölçmüyor

**Repro:** `FeatureDetailModal.tsx`'teki kaydırma kutusunun `tabIndex={0}` özniteliği kaldırıldı.
`tests/e2e/kanban.spec.ts` "K5/K6" testi (eski hâliyle, `.focus()` kullanan) **YEŞİL kaldı**
(Playwright `locator.focus()` CDP ile odağı doğrudan DOM API'siyle veriyor, tarayıcının gerçek
Tab-sırası hesaplamasını hiç kullanmıyor) — QA'nın orijinal M6 bulgusuyla birebir aynı sonuç.

**Kök neden:** `.focus()` çağrısı elementin klavyeyle GERÇEKTEN erişilebilir olup olmadığını
değil, yalnızca "bu elemente odak verilebilir mi" (herhangi bir yolla, script dahil) sorusunu
test ediyor — `tabIndex` olmadan da `HTMLElement.focus()` çalışır (`tabIndex` yalnızca `Tab`
tuşuyla SIRADAKİ hedef olup olmayacağını etkiler, script ile odaklanmayı değil).

## 2. Düzeltme mekanizmaları

**S1:** `src/server/write-gate.ts` `OPERATION_PATTERNS.approval`/`denial`/`archive` desenlerine
`i` bayrağı eklendi. Güvenlik gerekçesi: bu üç desene ulaşan `gate` parametresi, HTTP
katmanında (`handlers.ts` `isValidGateId(rawDecodedGate)`) ve `write-gate.ts`'in kendi
`GATE_PATTERN.test(gate)` kontrolünde ZATEN yalnızca kanonik BÜYÜK harfle kabul ediliyor;
harfe-duyarsızlık burada YENİ bir giriş yolu açmıyor, yalnızca "istenen kanonik ad" ile "aynı
dosyanın disk üzerindeki (Windows'un case-insensitive FS'i yüzünden farklı olabilecek) gerçek
adı" arasındaki eşleşmeyi kabul ediyor — `gate-id.ts`'teki S2 (`a6ee710`) düzeltmesiyle AYNI
ilke ve emsal.

**S2:** Kod değişmedi (`.toUpperCase()` zaten doğruydu, yalnızca çiti eksikti). Yeni dosya
`tests/features/gates/shared/gate-id.test.ts` tam-küme normalizasyon çitini ekliyor.

**N6:** `tests/e2e/kanban.spec.ts`'teki K6 assert'i `scrollBox.focus()` yerine gerçek
`page.keyboard.press('Tab')` döngüsü + `document.activeElement` ölçümü kullanacak şekilde
değiştirildi (`thread.spec.ts` X4/D1 deseniyle birebir aynı teknik). Ürün kodu
(`FeatureDetailModal.tsx`) değişmedi — yalnızca test dosyası, N6'nın dosya sahipliği
(`tests/e2e/kanban.spec.ts`) içinde.

## 3. Ölçülebilir kabul kriterleri

1. S1: `docs/approvals/g2.ok` (küçük harf) varken `POST /api/gates/:id/G2/approve` **200** döner
   ve dosya güncellenir — hem ilk hem ikinci ardışık denemede (kalıcılık testi). GET `/api/gates`
   G2'yi `approved` gösterir. → `tests/integration/gates-api.test.ts` "S1 borç kapatma" bloğu
   (3 test).
2. S2: `isValidGateId`'den türetilen TAM kimlik kümesindeki (57 kimlik × 2 dosya türü × ≤4 harf
   varyantı) HER kombinasyon `parseGateFileName` ile kanonik forma normalize edilir. →
   `tests/features/gates/shared/gate-id.test.ts` (458 test — 457 normalizasyon + 1 öz-kontrol).
3. N6: `tests/e2e/kanban.spec.ts` K6 assert'i `document.activeElement` üzerinden GERÇEK Tab
   navigasyonuyla kaydırma kutusuna ulaşıldığını ölçer; `tabIndex` kaldırma mutasyonu bu testi
   KIRMIZI vermeli (kanıtlandı, §1.3/yukarıda).
4. Üç madde için de: düzeltmeyi geri saran mutasyon → ilgili yeni/güncellenen test KIRMIZI →
   elle geri alma → `git diff` ilgili kaynak dosyada İZ BIRAKMAZ.
5. `npm run test`, `npx playwright test tests/e2e/kanban.spec.ts` ve `tests/integration/
   gates-api.test.ts` + `tests/features/gates/shared/gate-id.test.ts` yeşil; `npx tsc --noEmit`
   ve `npx eslint .` temiz.

## 4. `.toUpperCase()` locale ölçümü (S2 brief'inin özel talebi)

Ölçüldü (`node -e`, bu makinede `Intl.DateTimeFormat().resolvedOptions().locale` → `tr-TR`):

```
'i'.toUpperCase()            === 'I'   (locale'DEN BAĞIMSIZ — ECMA-262 sabit Unicode eşlemesi)
'i'.toLocaleUpperCase()      === 'I'   (motor varsayılan locale'i tr-TR olsa bile İngilizce kural uyguluyor; bu V8 davranışı, spesifikasyon garantisi değil)
'i'.toLocaleUpperCase('tr')  === 'İ'   (yalnızca 'tr' AÇIKÇA verilirse Türkçe nokta farkı ortaya çıkar)
```

**Sonuç:** `gate-id.ts` düz `.toUpperCase()` kullanıyor (`.toLocaleUpperCase()` DEĞİL) — bu,
spesifikasyon gereği HER ZAMAN locale'den bağımsız sabit Unicode büyük-harf eşlemesi kullanır.
`lang="tr"` bağlamı (bu depoda kayıtlı CSS `text-transform: uppercase` riskiyle KARIŞTIRILMAMALI
— o CSS/tarayıcı render katmanında, `.toLocaleUpperCase()`'siz JS motor davranışında DEĞİL) bu
kod yolunu ETKİLEMİYOR. Ayrıca kapı kimliği alfabesinin kendisi (`G0-G6`, rakam, tire, `ASSETS`)
zaten `i` harfini HİÇ içermiyor — yani bu spesifik veri kümesi için risk teorik olarak da sıfır,
üstüne pratikte `.toUpperCase()` zaten güvenli. **Değişiklik gerekmiyor, yalnızca ölçüldü ve
belgelendi.**

## 5. Kapanmayan/kalan risk

Yok — üç madde de bu turda tam kapatıldı, eşiksiz. `a6ee710`'un S1/S2/S3 etiketleriyle bu
sözleşmenin S1/S2'si arasındaki isim çakışması (§0.1) gelecekte kafa karıştırabilir; ileride
`docs/blockers.md`'ye yeni bir madde eklenirken bu ayrımın korunması önerilir.
