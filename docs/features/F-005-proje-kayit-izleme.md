---
id: F-005
title: Proje kayıt defteri + chokidar izleme + Ayarlar ekranı (çok projeli izleme)
status: todo
owner: developer
deps: [F-003]
sprint: 1
---
## Açıklama
İzlenen proje klasörlerinin panelden eklenip çıkarılması, kalıcı kayıt defteri ve chokidar ile canlı dosya izleme.
Kaynak: `docs/02-architecture.md` §5 (proje kaydı), §6 (API); `docs/03-ux.md` ekran 3.

## Kabul kriterleri
- [ ] Klasör eklendiğinde `docs/features/*.md` dosyaları, sunucu yeniden başlatılmadan en geç 5 sn içinde görünür (PRD F3/AC1).
- [ ] Proje çıkarıldığında kartları ve olayları 5 sn içinde arayüzden kalkar; diskte hiçbir dosya silinmez veya değişmez (PRD F3/AC2).
- [ ] Geçmiş olaylar depoda kalır; proje geri eklenirse yeniden görünür (ADR-001 karar 6).
- [ ] `docs/features` içermeyen geçersiz yol reddedilir ve okunabilir hata gösterilir (PRD F3/AC3).
- [ ] En az 3 proje aynı anda izlenirken kartlar ve olaylar proje etiketiyle ayırt edilir (PRD F3/AC4).
- [ ] İzlenen proje listesi kalıcıdır; sunucu yeniden başlatılınca korunur (PRD F3/AC5).

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/projects/**`, `src/server/watch/**`, `src/server/store/projects-registry.ts`, ilgili testler.

## Notlar / kararlar
- Yol karşılaştırmaları `node:path` ile yapılır; yol için elle regex yasak.
