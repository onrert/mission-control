---
id: F-008
title: Kapılar paneli (G0–G6 / ASSETS) — onay, red, arşiv akışı
status: dev
owner: developer
deps: [F-006, F-007]
sprint: 2
---
## Açıklama
Faz 2'nin ilk işi (kullanıcı kararı: F-009'dan önce). Seçili projenin kapı durumlarını gösterir; onay ve red dosyalarını yazma kapısı üzerinden yazar.
Kaynak: PRD özellik 4; `docs/03-ux.md` ekran 4 + akışlar (d), (e); ADR-001 karar 7, ADR-005.

## Kabul kriterleri
- [ ] G0–G6 ve ASSETS durumu `docs/approvals/` içeriğinden doğru türetilir: onaylandı / reddedildi / bekliyor (PRD F4/AC1).
- [ ] "Onayla" önce doğrulama adımı açar ve dosyaya yazılacak özeti gösterir; ikinci onaydan sonra `docs/approvals/<G>.ok` yazılır. İptal edilirse hiçbir dosya oluşmaz (PRD F4/AC7).
- [ ] `.ok` içeriği PROCESS.md §2 formatındadır: tarih + onaylanan özet + kullanıcının kararı (PRD F4/AC2).
- [ ] "Reddet" zorunlu gerekçe metni ister; gerekçe girilmeden dosya yazılmaz. Gerekçe `.deny.md` içine olduğu gibi geçer (PRD F4/AC3, AC8).
- [ ] Daha önce reddedilmiş bir kapı onaylanırsa `.deny.md` silinmez; `docs/approvals/archive/<G>-<zaman>.deny.md` yoluna taşınır, sonra `.ok` yazılır (PRD F4/AC9).
- [ ] Aynı kapıda hem `.ok` hem `.deny.md` bulunursa "çelişkili durum" işaretlenir, hangisinin daha yeni olduğu gösterilir, hiçbir dosya otomatik silinmez (PRD F4/AC4).
- [ ] Yazma hatasında buton durumu geri alınır, okunabilir hata gösterilir, panel çökmez (PRD F4/AC5).
- [ ] Tüm yazmalar F-006 yazma kapısından geçer (PRD F4/AC6).

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
