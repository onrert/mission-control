---
feature: F-013
title: Feature penceresinde içerik — gövde, sözleşme ve QA raporları
author: developer
status: draft
date: 2026-09-08
---

# F-013 Sözleşmesi — Feature detay penceresinde gövde + sözleşme + QA raporları

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").
Bu turda `src/`, `tests/` altında henüz hiçbir dosya değiştirilmedi; yalnızca bu sözleşme metni
yazıldı.

Kaynaklar: `docs/features/F-013-feature-detay-icerigi.md` (8 AC, bağlayıcı, CEO kararları
J1-J8 içeriyor), `docs/03-ux.md` ekran 2 (Kanban) + Türkçe metin sözlüğü, `CLAUDE.md` "Öğrenilen
kurallar" (tamamı — özellikle yol çiti/symlink, sessiz kırpma yasağı, dar genişlik ölçümü, dağıtıcı
hata sınırının senkron/asenkron ayrımı, mutasyon totolojisi maddeleri).

Kod okunarak doğrulandı (✓ VERIFIED): `src/features/kanban/web/FeatureDetailModal.tsx`,
`KanbanScreen.tsx`, `useFeatures.ts`, `src/features/kanban/server/{handlers,list-features,
parse-feature}.ts`, `src/features/projects/server/{validate-path,service}.ts`, `src/server/
write-gate.ts` (`resolveInsideRoot` deseni — okuma tarafına UYARLANACAK, bu dosyanın KENDİSİ
değiştirilmeyecek), `src/server/index.ts` (dağıtıcı/route sırası, `withDispatchErrorBoundary`),
`src/shared/types.ts`, `tests/integration/features-api.test.ts`, `tests/no-write-gate-bypass.
test.ts`, `tests/server/write-gate-manifest.test.ts`, `tests/helpers/manifest.ts`, `tests/e2e/
kanban.spec.ts` (`clippedVisibleWidth` yardımcısı — YENİDEN KULLANILACAK).

---

## 1. Kapsam

**İçinde:**
1. Yeni salt-okunur uç: `GET /api/features/detail?project_id=…&file=…` — gövde + sözleşme +
   QA raporlarını döner (J1: `FeatureCard`'a EKLENMEZ, ayrı uç).
2. `FeatureDetailModal`'ın genişletilmesi: mevcut id/title/owner/deps/sprint `dl` bloğu KORUNUR,
   altına gövde/sözleşme/QA raporları bölümü eklenir.
3. Yol güvenliği: yeni bir okuma-guard modülü (`src/features/kanban/server/read-guard.ts`),
   `write-gate.ts`'in `resolveInsideRoot`'unun OKUMA emsali (J2 — `write-gate.ts`'e DOKUNULMAZ,
   yalnızca deseni tekrarlar: `node:path` + `fs.realpathSync.native` + `path.relative` kapsama
   kontrolü + symlink savunması, elle regex yok).
4. `src/shared/types.ts`'e üç küçük tip eklenir (`FeatureDetailDocument`, `FeatureDetailReport`,
   `FeatureDetail`) — bu dosya her feature'ın ek yaptığı ortak sözleşme dosyası (F-002/F-005/
   F-007/F-012 emsali).
5. `src/server/index.ts`'e tek route satırı + import (mevcut route'larla aynı desen).

**Kapsam DIŞI (bilinçli, J8):** agent mesajları/transkriptler (F-009/F-010), token sayacı
(F-011), kapılar paneli (F-008) — bunlara bağlantı bile verilmeyecek. `write-gate.ts`'in kendisi
değişmeyecek (yalnızca deseni okunacak). Yeni bir SSE kanalı/watcher icat edilmeyecek (J6).

---

## 2. Veri sözleşmesi

```ts
interface FeatureDetailDocument {
  exists: boolean          // dosya yok → yalnızca bu alan (false)
  content?: string         // exists && okuma başarılı
  truncated?: boolean      // içerik MAX_DOCUMENT_CHARS'ı aştıysa true (J4, sessiz kırpma YASAK)
  error?: string           // exists:true ama okuma başarısız (izin, yarış durumu) — sabit TR metin
}
interface FeatureDetailReport extends FeatureDetailDocument { file: string }
interface FeatureDetail {
  content_hash: string             // FeatureCard.content_hash ile AYNI (sha256, tam dosya baytı)
  body: FeatureDetailDocument       // her zaman exists:true (dosya zaten okunabildiği için)
  contract: FeatureDetailDocument   // docs/qa/<id>-contract.md
  qa_reports: FeatureDetailReport[] // docs/qa/<id>-*.md (contract HARİÇ), mtime artan sıralı
}
```

`id`, gövde dosyasının frontmatter'ından **sunucu tarafında** `parseFeatureCard` ile yeniden
türetilir — istemciden `id` alınmaz (client zaten elindeki `card.id`'yi bu amaçla kullanmaz,
yalnızca `project_id`+`file` gönderir). `id` yol parçası olarak kullanılmadan önce
`^[A-Za-z0-9._-]+$` ile sınırlanır; eşleşmezse sözleşme/QA raporları sessizce "yok" (`exists:
false`/boş dizi) döner — hata değil.

HTTP: 400 `invalid_body` (eksik/biçimsiz `project_id`/`file`), 404 `not_found` (proje yok VEYA
gövde dosyası bulunamadı — yarış durumu, kart listelendiği an ile tıklama arası dosya silinmiş
olabilir), 400 `invalid_path` (J2 — okunan yol proje kökü dışında/symlink, ADR-005 ruhuyla
tutarlı bir "reddedildi" kodu; yeni bir `ErrorCode` EKLENMEZ, var olan `invalid_path` — F-005'in
proje ekleme akışında zaten kullanılan kod — semantik olarak uyuyor).

Boyut sınırı: **200.000 karakter** (bayt değil — UTF-8 çok baytlı sınırında bölünme riskini
basitçe ortadan kaldırır, Karpathy §2: tam bayt-hizalı kırpma bu ölçekte gereksiz karmaşıklık).
Bu depodaki gerçek gövde/sözleşme/QA dosyalarının hiçbiri bu sınıra yakın değil (en büyükleri
birkaç bin satır); sınır gerçekçi bir "çok büyük dosya" senaryosunu kapsıyor.

---

## 3. Yol güvenliği (J2)

`resolveInsideRootForRead(root: string, relativeParts: string[])`:
1. `root` mutlak ve gerçek bir dizin olmalı (aksi hâlde `root-invalid`).
2. Son segment HARİÇ tüm ata dizinler `fs.lstatSync(...).isSymbolicLink()` ile kontrol edilir —
   biri symlink ise `symlink`.
3. Hedefin kendisi de `existsSync` + `lstatSync` ile kontrol edilir; yoksa `not-found`, symlink
   ise `symlink`.
4. `fs.realpathSync.native` ile Windows büyük/küçük harf kanonikleştirmesi yapılır, `path.relative
   (root, resolved)` `..` ile başlıyorsa veya mutlaksa `outside-root` (savunma katmanı — symlink
   zaten adım 2-3'te elendi, `write-gate.ts` yorumundaki gerekçeyle birebir aynı).

`write-gate.ts`'in `resolveInsideRoot`'undan FARKI: `OPERATION_PATTERNS` yok (çağıran zaten sabit,
önceden bilinen `relativeParts` verir — okuma tarafında "işlem/hedef eşleşmesi" kavramı yazma
kadar kritik değil, çünkü hiçbir şey değişmiyor). `write-gate.ts` dosyasının KENDİSİ bu turda
DEĞİŞMEZ — ikinci bir tüketici olmadan `resolveInsideRoot`'u iki modülün paylaştığı ortak bir
dosyaya taşımak (soyutlama) Karpathy §2 ihlali olurdu; desen bilinçli olarak KOPYALANIR
(read-guard.ts kendi başına, write-gate.ts'ten import YOK).

**Mutasyon (a) hedefi:** `resolveInsideRootForRead`'in symlink/`outside-root` kontrolü
kaldırılırsa, `docs/qa` (veya `docs/features`) gerçek kökün dışına symlink'lenmiş bir senaryoda
okuma başarılı olur — `tests/integration/features-api.test.ts`'e F-007'nin symlink test desenini
(`fs.symlinkSync(..., 'junction')`) birebir uygulayan bir test eklenecek, mutasyon KIRMIZI vermeli.

---

## 4. Boyut sınırı + kırpma görünürlüğü (J4)

`truncate(text)`: `text.length > 200_000` ise `{ exists:true, content: text.slice(0,200_000),
truncated:true }`, aksi hâlde `truncated:false`. İstemci `truncated:true` gördüğünde belge
başlığının hemen altına görünür bir uyarı yazar (§7 metin sözlüğü). **Mutasyon (b) hedefi:**
`truncated:true` YAZILMASA (veya istemci bu bayrağı yok sayıp uyarıyı basmasa) bile içerik zaten
kırpıldığı için "her şey normal" görünür — bu YASAK sessiz kırpma sınıfı. Test: sınırı aşan bir
fixture dosyası ile hem sunucu (`truncated:true` dönüyor mu) hem istemci (uyarı metni DOM'da var
mı) ayrı ayrı ölçülür; ikisi de mutasyonla (bayrağı `false` sabitleyerek / istemcide uyarı JSX'ini
kaldırarak) ayrı ayrı KIRMIZI verdirilir.

---

## 5. Salt okunurluk (J3)

Yeni modüllerin hiçbiri `fs` yazma fonksiyonu çağırmaz — `tests/no-write-gate-bypass.test.ts`
zaten `src/**/*.ts` içindeki TÜM dosyaları tarıyor (dosya-seviyesi muafiyet YOK, F-013'ün yeni
dosyaları otomatik kapsanır). Ayrıca F-006 emsaliyle **dinamik** bir dosya sistemi manifest testi
eklenir (`tests/features/kanban/server/feature-detail-manifest.test.ts`,
`tests/helpers/manifest.ts`'in `snapshotDir`'ini kullanır): gerçek bir proje fixture'ında
(`docs/features/F-001.md` + `docs/qa/F-001-contract.md` + iki QA raporu) `buildFeatureDetail`
birkaç kez (mutlu yol, eksik dosya, geçersiz `id`) çağrılır, çağrı öncesi/sonrası `snapshotDir`
BİREBİR AYNI olmalı. **Mutasyon (c) hedefi:** teste özel bir kaçış, `buildFeatureDetail` içine
geçici bir `fs.writeFileSync` eklenip manifest testinin gerçekten fark ettiği (KIRMIZI verdiği)
gösterilir, sonra geri alınır — bu, statik tarayıcının (no-write-gate-bypass) yakalayacağı AYNI
şeyi dinamik olarak da doğrular (savunma-derinliği, totoloji değil: ikisi FARKLI mekanizma).

---

## 6. Bayatlık/tazeleme (J6)

Yeni mekanizma İCAT EDİLMEZ. `FeatureCard.content_hash` zaten `KanbanScreen`'in `cards` state'i
üzerinden SSE (`features` sinyali → chokidar → refetch) ile taze tutuluyor. `KanbanScreen`'e
küçük bir effect eklenir: açık `detailCard`'ın `cardKey`'i `cards` listesindeki güncel kartla
eşleşiyorsa VE `content_hash` farklıysa, `detailCard` güncel karta değiştirilir (referans
güncellenir). `FeatureDetailModal`'daki `useFeatureDetail` hook'u `card.content_hash`'i effect
bağımlılığına koyar — hash değiştiğinde uç YENİDEN çağrılır, panel **otomatik yenilenir**
(AC'nin "tazelenir VEYA bayat olduğu belli olur" seçeneklerinden ilkini, daha iyi UX'i, seçiyoruz).

**Bilinen sınırlama (kapsam dışı bırakılan risk, dokümante edilecek):** `docs/qa/*` dosyaları
SSE ile izlenmiyor (yalnızca `docs/features` chokidar izleniyor) — sözleşme/QA raporu dosyası
gövde HİÇ değişmeden tek başına değişirse (nadir — genellikle ikisi birlikte değişir, QA turu
gövdenin `status:` alanını da günceller) panel açıkken otomatik yenilenmez. Yeni bir watcher
icat etmek J6'nın ruhuna aykırı olurdu; bu sınırlama `docs/progress.md`'ye açıkça yazılacak.

**Mutasyon (d) hedefi:** `KanbanScreen`'deki senkron effect'i kaldırıp `detailCard` hep aynı
referansta kalırsa, `content_hash` değişikliğinde `useFeatureDetail` yeniden tetiklenmez —
`KanbanScreen.test.tsx`'e "kart tıklandıktan sonra dosya değişirse (`content_hash` değişir),
modal içeriği yeniden fetch edilir" testi eklenip mutasyonla KIRMIZI verdirilir.

---

## 7. Metin sözlüğü (J7 — önce burada, sonra `docs/03-ux.md`, sonra kod; birebir aynı)

| Durum | Metin |
|---|---|
| Yükleniyor | `Yükleniyor…` |
| Gövde bölüm başlığı | `Açıklama` |
| Sözleşme bölüm başlığı | `Sözleşme` |
| QA raporları bölüm başlığı | `QA raporları` |
| Sözleşme yok | `Sözleşme bulunamadı.` |
| QA raporu yok | `QA raporu bulunamadı.` |
| Kırpma uyarısı | `İçerik çok büyük olduğu için kısaltıldı.` |
| Belge okunamadı (izin/yarış durumu) | `Dosya okunamadı.` |
| Ağ/sunucu hatası (genel) | `İçerik yüklenemedi. Tekrar deneyin.` |

---

## 8. Markdown gösterimi (J5)

**Karar: yeni bağımlılık EKLENMEZ.** Gövde/sözleşme/QA raporu içeriği `<pre className=
"whitespace-pre-wrap break-words font-mono text-xs">` ile ham metin olarak gösterilir — proje
zaten terminal/mono estetiğinde (kart id'leri, yol alanları hep `font-mono`), düz metin markdown
kaynağı bu bağlamda "çirkin" değil, tutarlı. Gerekçe: (1) `ADR-009` native derleme yasağı +
`tests/deps.test.ts` guard riski sıfırlanır (hiç yeni paket yok → ölçülecek bir boyut farkı da
yok, bundle etkisi **0 KB**), (2) `dangerouslySetInnerHTML` gerektiren bir HTML render'ı hiç
gündeme gelmez (XSS yüzeyi açılmaz — bu dosyalar bizim yazdığımız markdown olsa da, sıfır riskli
yol her zaman tercih edilir), (3) Karpathy §2 testi: bir kıdemli mühendis, dahili/geliştirici
belgeleri için düz metin göstermeyi "eksik" bulmaz. Bu, sözleşmenin `MAX_DOCUMENT_CHARS`
kırpmasıyla birlikte basit ve öngörülebilir kalır. CEO/kullanıcı gerçek markdown render'ı isterse
ayrı bir feature notu olarak açılabilir.

---

## 9. Dosya sahipliği (feature notundan)

`src/features/kanban/**` (modal + veri yolu), ilgili sunucu ucu ve testler. Bu sözleşme kapsamında
dokunulacak dosyalar: `src/features/kanban/server/{read-guard,feature-detail}.ts` (yeni),
`src/features/kanban/server/{parse-feature,handlers}.ts` (cerrahi ek), `src/features/kanban/web/
{FeatureDetailModal,KanbanScreen,useFeatureDetail}.tsx/ts` (yeni hook + cerrahi ek), `src/shared/
types.ts` (üç tip eklenir — her feature'ın dokunduğu ortak dosya), `src/server/index.ts` (tek
route + import satırı — dağıtıcı merkezi, her feature route eklerken buraya dokunuyor, F-007/
F-012 emsali). Testler: `tests/features/kanban/**`, `tests/integration/features-api.test.ts`,
`tests/e2e/kanban.spec.ts`. **`src/server/write-gate.ts`'e HİÇBİR satır dokunulmaz.**

---

## 10. Doğrulama planı

- `npm run verify` = 0, mevcut test sayısından yalnızca ARTAR (regresyon yok).
- `npm run e2e` mevcut kanban.spec.ts paketi bozulmaz + yeni: (a) mutlu yol (gövde/sözleşme/QA
  raporu görünür), (b) sözleşme/QA yok → "yok" metni, (c) 320/375/480px'te modal içeriğinin
  `clippedVisibleWidth`'i > 0 (mevcut yardımcı yeniden kullanılır).
- 5 mutasyon (yukarıda a-d + AC7 hata sınırı — aşağıda e): uygula → KIRMIZI → geri al.
  (e) Hata sınırı: `handleFeatureDetail` içine kasıtlı bir senkron `throw` konur → dağıtıcının
  `withDispatchErrorBoundary`'si bunu yakalayıp 500 dönmeli (panel çökmez, süreç yaşar) — bu
  ZATEN var olan bir mekanizma (F-002/F-007'de kanıtlı), yeni bir şey İCAT EDİLMİYOR, yalnızca
  YENİ route'un da bu sınırın İÇİNDE (dispatcher `withDispatchErrorBoundary(...)` sarmalayıcısının
  kapsamında) olduğu doğrulanıyor.
- `grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` sonunda yalnızca meşru
  `write-gate-manifest.test.ts:124` kalmalı.

---

CEO onayı: bu sözleşme, kullanıcının önceden verdiği J1-J8 kararlarını uyguluyor — ayrı bir
onay turu beklenmeden koda geçilecek (kararlar zaten bağlayıcı olarak verildi).
