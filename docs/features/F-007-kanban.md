---
id: F-007
title: Kanban panosu + frontmatter status yazma + çakışma/echo yönetimi
status: todo
owner: developer
deps: [F-005, F-006]
sprint: 1
---
## Açıklama
Faz 1'in en büyük ve en riskli parçası: feature kartları, 7 sütun (+ "Bilinmeyen durum"), sürükle-bırak ile dosyaya yazma, eşzamanlı dış değişiklik çakışması ve chokidar echo yönetimi.
Kaynak: `docs/02-architecture.md` §7; `docs/03-ux.md` ekran 2 + akışlar (a), (b), (c).

## Kabul kriterleri
- [ ] Kartlar frontmatter `status` değerine göre doğru sütunda görünür (PRD F2/AC1).
- [ ] Sürükleme YALNIZCA `status` alanını değiştirir; dosyanın geri kalanı karakter bazında aynı kalır (PRD F2/AC2) — diff testiyle kanıtlanır.
- [ ] Dosya dışarıdan değiştiğinde pano en geç 2 sn içinde günceli yansıtır (PRD F2/AC3).
- [ ] Çakışma: diskteki içerik beklenenden farklıysa yazma durur, "dosya değişti" uyarısı gösterilir, kart yeni duruma göre yeniden çizilir; sessizce üzerine yazılmaz (PRD F2/AC4).
- [ ] Yazma hatasında kart eski sütununa döner, okunabilir hata gösterilir, panel çökmez (PRD F2/AC5).
- [ ] Tanımsız `status` değeri "Bilinmeyen durum" sütununda görünür ve buradan geçerli bir sütuna sürüklenebilir (PRD F2/AC6, ADR-001 karar 5).
- [ ] Karta tıklanınca id, title, owner, deps, sprint salt okunur görünür (PRD F2/AC7).
- [ ] Kendi yazımız chokidar üzerinden geri gelip sonsuz döngü veya yanıp sönme yaratmaz.
- [ ] Sürükle-bırakın klavye alternatifi çalışır (UX erişilebilirlik bölümü).
- [ ] Sütun başlıkları "Geliştirme (dev)" biçimindedir (ADR-001 karar 8).

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/kanban/**` (server + web), frontmatter yaması, ilgili testler.

## Notlar / kararlar
- Tüm yazmalar F-006 yazma kapısından geçer; doğrudan `fs` çağrısı yasak.
