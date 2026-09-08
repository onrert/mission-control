---
id: F-013
title: Feature penceresinde içerik — gövde, sözleşme ve QA raporları
status: qa
owner: developer
deps: [F-007, F-012]
sprint: 2
---
## Açıklama
Kullanıcı isteği (2026-09-06): *"feature'ların içlerine neler yapıldıkları, hangi mesajları
verdikleri görünmüyor. Onların tıkladıktan sonra içlerinde açılan pencerede görülebilir olsa
güzel olur."*

Bugünkü durum: `FeatureDetailModal` yalnızca **frontmatter** alanlarını gösteriyor
(`id/title/owner/deps/sprint`) — feature dosyasının **gövdesi sunucuda hiç okunmuyor**
(`FeatureCard` tipinde gövde alanı yok, ayrıştırıcı yalnızca frontmatter çıkarıyor).
Açıklama, kabul kriterleri ve alınan kararlar diskte duruyor ama panele hiç gelmiyor.

Bu feature **ucuz yarısını** yapar: kaynağı bizim yazdığımız düz markdown dosyaları.
**Agent mesajları (CEO brief → developer raporu → QA kararı → düzeltme turları) KAPSAM DIŞI** —
onlar `~/.claude/projects/**/agent-*.jsonl` transkriptlerinde ve o format belgesiz/kırılgan
(G0 fikir doğrulamasında YÜKSEK risk). O iş F-009 keşif turu + F-010 thread görünümü olarak
ayrı duruyor. Kullanıcı sıralamayı bilerek böyle seçti (2026-09-06).

## Kabul kriterleri
- [x] Karta tıklanınca açılan pencere, feature dosyasının **gövdesini** (frontmatter'dan sonraki
      tüm markdown) okunabilir biçimde gösterir.
- [x] O feature'a ait ilgili belgeler pencereden görülebilir: sözleşmesi
      (`docs/qa/<id>-contract.md`) ve QA raporları (`docs/qa/<id>-*.md`). Dosya yoksa pencere
      bozulmaz, "yok" durumu okunabilir biçimde gösterilir.
- [x] Belgeler **salt okunur**. Bu feature hiçbir dosyaya yazmaz; `ADR-005`'in "izlenen projelere
      yazma yok" kuralı korunur ve dosya sistemi manifest testiyle kanıtlanır.
- [x] **Yol çiti:** okunan her yol izlenen projenin kökü altında kalır. `..`, symlink, UNC ve
      Windows harf duyarsızlığı savunulur; elle regex YASAK, `node:path` zorunlu (F-005 deseni).
      **Mutasyonla çitlenecek:** çiti kaldıran mutasyon KIRMIZI vermeli.
- [x] **Boyut sınırı:** büyük belge paneli kilitlemez. Sınır aşılırsa kırpılır ve kırpıldığı
      kullanıcıya söylenir (sessiz kırpma YASAK).
- [x] Dosya diskte değişince pencere içeriği tazelenir veya bayat olduğu belli olur — sessizce
      eski içerik gösterilmez.
- [x] Okuma hatası (izin yok, bozuk kodlama, dosya silinmiş) pencerede okunabilir hata olarak
      görünür; **panel çökmez**, sunucu ayakta kalır.
- [x] Dar genişlikte (320-480px) okunabilir — bu projede dar genişlik iki kez feature bozdu.
- [x] Mevcut pencere davranışı korunur: focus-trap, `Esc` ile kapanma (F-007 AC7).

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/kanban/**` (modal + veri yolu), ilgili sunucu ucu ve testler.

## Notlar / kararlar
- Markdown'ı nasıl göstereceğimiz (kütüphane mi, düz metin mi) sözleşme turunda karara bağlanacak.
  Yeni bağımlılık gelecekse gerekçesi ve boyutu yazılacak — `ADR-009` native derleme yasağı geçerli.
- Gövde `FeatureCard`'a mı eklenecek yoksa ayrı bir uçtan mı çekilecek: sözleşme turunda karar.
  Kanban listesi her kartın gövdesini taşımak zorunda kalmamalı (yükü boşuna büyütür).
- `content_hash` zaten tam dosya baytlarından üretiliyor — tazeleme/bayatlık tespiti için
  yeniden bir mekanizma icat etmeden önce bunun yeterli olup olmadığına bakılsın.

## Uygulama notu (developer, 2026-09-08)
CEO kararları J1-J8 (brief'te bağlayıcı olarak verildi) uygulandı: ayrı salt-okunur uç
(`GET /api/features/detail`), F-005/F-006'nın yol-güvenliği deseni okumaya uyarlandı
(`read-guard.ts`, `write-gate.ts`'e dokunulmadı), 200.000 karakter sınır + görünür kırpma
uyarısı, `content_hash` tabanlı otomatik yenileme (yeni mekanizma yok), markdown kütüphanesi
EKLENMEDİ (ham `<pre>`, bundle etkisi 0 — `package-lock.json` değişmedi). Ayrıntı:
`docs/qa/F-013-contract.md`, doğrulama detayları `docs/progress.md`.

## Düzeltme turu notu (developer, 2026-09-08) — QA kod turu KALDI → K1-K6 kapatıldı
`docs/qa/F-013-2026-09-08.md` (KALDI, 2 bloklayıcı + 4 önemli) CEO kararları K1-K6 ile
kapatıldı: B2/AC4 (id üzerinden kök kaçışı — ikinci savunma katmanı `resolveInsideRootForRead`),
Ö4/AC4 (okuma kapsamı `docs/features/**`/`docs/qa/**` ile sınırlandı), Ö1/AC3 (manifest testi
artık TÜM çağrılardan önce anlık görüntü alıp TAM eşitlik karşılaştırıyor), B1/AC6 ("Yenile"
düğmesi + "Son yenileme: <saat>" — sessiz bayatlık yok), Ö2 (klavye ile kaydırılabilir tek
bağlam), Ö3 (bölümler katlanabilir, gövde açık/geri kalanı kapalı). Ayrıntı `docs/qa/F-013-
contract.md` gövdesine yayılmadı (kapsam sözleşme değil düzeltme turu) — kanıt ve mutasyon
tablosu `docs/progress.md`'de.
