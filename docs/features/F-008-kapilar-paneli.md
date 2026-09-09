---
id: F-008
title: Kapılar paneli (G0–G6 / ASSETS) — onay, red, arşiv akışı
status: done
owner: developer
deps: [F-006, F-007]
sprint: 2
---
## Açıklama
Faz 2'nin ilk işi (kullanıcı kararı: F-009'dan önce). Seçili projenin kapı durumlarını gösterir; onay ve red dosyalarını yazma kapısı üzerinden yazar.
Kaynak: PRD özellik 4; `docs/03-ux.md` ekran 4 + akışlar (d), (e); ADR-001 karar 7, ADR-005.

## Kabul kriterleri
- [x] G0–G6 ve ASSETS durumu `docs/approvals/` içeriğinden doğru türetilir: onaylandı / reddedildi / bekliyor (PRD F4/AC1).
- [x] "Onayla" önce doğrulama adımı açar ve dosyaya yazılacak özeti gösterir; ikinci onaydan sonra `docs/approvals/<G>.ok` yazılır. İptal edilirse hiçbir dosya oluşmaz (PRD F4/AC7).
- [x] `.ok` içeriği PROCESS.md §2 formatındadır: tarih + onaylanan özet + kullanıcının kararı (PRD F4/AC2).
- [x] "Reddet" zorunlu gerekçe metni ister; gerekçe girilmeden dosya yazılmaz. Gerekçe `.deny.md` içine olduğu gibi geçer (PRD F4/AC3, AC8).
- [x] Daha önce reddedilmiş bir kapı onaylanırsa `.deny.md` silinmez; `docs/approvals/archive/<G>-<zaman>.deny.md` yoluna taşınır, sonra `.ok` yazılır (PRD F4/AC9).
- [x] Aynı kapıda hem `.ok` hem `.deny.md` bulunursa "çelişkili durum" işaretlenir, hangisinin daha yeni olduğu gösterilir, hiçbir dosya otomatik silinmez (PRD F4/AC4).
- [x] Yazma hatasında buton durumu geri alınır, okunabilir hata gösterilir, panel çökmez (PRD F4/AC5).
- [x] Tüm yazmalar F-006 yazma kapısından geçer (PRD F4/AC6).

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/gates/**`, ilgili testler.

## Notlar / kararlar
- Panelden verilen onay kullanıcının onayı sayılır (G0 kararı); bu yüzden doğrulama adımı zorunludur.

## Kod turu — A bölümü (sunucu, 2026-09-09)

Sunucu tarafı tamamlandı (durum türetme, üç uç, `.ok`/`.deny.md` yazımı, arşivleme + yarı-başarı,
hata semantiği, SSE yayını). AC kutuları **B turu (arayüz) bitene kadar işaretlenmedi** — her AC
uçtan uca (UI dahil) doğrulanmadan "bitti" sayılmıyor. Ayrıntı: `docs/progress.md` "F-008 — A
bölümü (sunucu)" kaydı. B turuna devredilenler: React bileşenleri (`GatesScreen`, `GateRow`,
`ApproveModal`, `DenyInlineForm`, `useGates`, `ProjectSelect`, `icons`), `App.tsx`/
`useEventStream.ts` bağlanması, `docs/03-ux.md`'ye ★ işaretli 6 yeni Türkçe metnin eklenmesi,
kırılan sekme sayacı testlerinin (§10.2 tablosu) güncellenmesi, dar genişlik E2E'si.

## Kod turu — B bölümü (arayüz, 2026-09-09)

Arayüz tamamlandı: Kapılar ekranı + sekmesi (Faz 1 kabuğuna koşulsuz eklendi), dört durumlu
aksiyon sütunu, iki adımlı onay modalı, satır içi red formu, `[Detay]` genişleyen çelişki satırı,
SSE `gates` kanalı ile canlı güncelleme. Ayrıntı: `docs/progress.md` "F-008 — B bölümü (arayüz)"
kaydı. Tüm AC'ler artık uçtan uca (sunucu + UI, gerçek tarayıcı E2E dahil) doğrulandı — bu yüzden
yukarıdaki kutular işaretlendi. `status: qa` — GEÇTİ/KALDI kararı qa-evaluator'a ait.

CEO'nun ek yetkisiyle (`docs/blockers.md` 2026-09-09) bu turda kapsam dışı ama dosya sahipliği
genişletmesiyle düzeltilen bir madde: `src/features/kanban/server/handlers.ts`
`handlePatchFeatureStatus`'un `projectsService.list()` çağrısı asenkron IIFE'nin dışındaydı
(sunucuyu üç kez öldüren hata sınıfı) — düzeltildi ve mutasyonla kanıtlandı, `docs/blockers.md`
maddesi kapatıldı.

## Kod turu — dar kapsamlı düzeltme (2026-09-09, `docs/qa/F-008-2026-09-09.md` sonrası)

QA kararı bu raporda **GEÇTİ** idi (bloklayıcı yok), ama üç ÖNEMLİ bulgu kapatıldı (CEO talimatı,
sözleşme: `docs/qa/F-008-contract.md` §13):

- **S1 (Bulgu 2 — önizleme≡diske yazılan çitsizdi):** `POST .../approve` gövdesine `expectedBody`
  eklendi (istemcinin gösterdiği önizlemenin kendisi); sunucu kendi ürettiği içerikle **tam
  eşitlik** karşılaştırır, uyuşmazsa (ör. `decision` önizlemeden sonra değişti, ya da etiket modal
  açıkken değişti) hiçbir dosyaya dokunmadan 409 döner. Mutasyonla kanıtlandı (QA-B sınıfının
  birebir tekrarı + label-drift senaryosu).
- **S2 (Bulgu 1 — Windows harf duyarsızlığı split-brain):** `gate-id.ts`'in dosya tarama
  regex'leri `i` bayrağıyla harfe duyarsız yapıldı, id kanonik büyük harfe normalize edilir.
  Karar: **kabul et ve normalize et** (reddetme) — `.claude/hooks/gate-check.cjs`'in kendi
  harfe-duyarsız `existsSync`'iyle tutarlı kalmak için (o dosyaya dokunulmadı).
- **S3 (Bulgu 4 — etiketsiz kapılarda "ASSETS ASSETS"/"G4-1 G4-1" tekrarı, kalıcı `.ok`'a da
  sızıyordu):** yeni paylaşılan saf yardımcı `formatGateTitle(id, label, separator)` — `label ===
  id` ise tekrar etmez. Dört kullanım yeri (`GateRow`, `ApproveModal`, `format-approval.ts`'in iki
  fonksiyonu) güncellendi.

Üçü de mutasyonla KIRMIZI/YEŞİL döngüsüyle kanıtlandı (uygula → kırmızı gör → geri al).
`docs/blockers.md`'ye ayrı madde: `npm run e2e:dev` kırmızısı (proje borcu, F-008'e ait değil,
dört ayrı ölçümle kanıtlandı). `docs/03-ux.md:813`'ün dar genişlik ölçüm notu QA'nın gerçek
değerleriyle güncellendi. Ayrıntı ve test sayıları: `docs/progress.md`.
