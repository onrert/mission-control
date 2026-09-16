---
name: faz2-durum
description: Faz 2 kapandı — G0–G6 onaylı, 14/14 feature done, Electron paketi üretildi ve masaüstü kısayolu kuruldu; dört borç bilerek açık
metadata:
  type: project
---

Faz 2 **2026-09-16'da kapandı**. G0–G6 onaylı, 14/14 feature `done`, her şey
`github.com/onrert/mission-control` → `main`'de.

**Why:** G6 kanıtı ölçülerek toplandı (3/3 ardışık tam yeşil `verify` · 1852 test · 55/55 e2e ·
420/420 hook self-test · tsc/eslint 0). Electron paketi üretildi (`release/Mission
Control-win32-x64`, 631 MB), duman testinden geçti (HTTP 200, `/api/events` 200, yetim süreç 0)
ve kullanıcının masaüstüne "Mission Control" kısayolu kuruldu.

**How to apply:** yeni bir tur başlarken "sırada G6 var" varsayma — o kapı geçildi. Sıradaki iş
ya açık borçlardan biri, ya `/retro`, ya da yeni bir faz. Uygulama 7333 portunu kullanıyor;
`npm run dev` ile paketlenmiş uygulama aynı anda çalışmaz.

**Bilerek açık bırakılan dört borç** (hepsi `docs/blockers.md`'de yeniden açma ölçütleriyle):
1. Hook hattının 24 canlı vektörü + izin açığı (`Write(src/**)` + `Bash(node *)` sıfır kartla tam
   yetki veriyor). `ADR-016` güncellendi: **hook bir kaza önleyicidir, saldırı önleyici değildir.**
   Yedi tur sertleştirmeden sonra durma kararı kullanıcınındı.
2. B-4 test kararsızlığı — kök neden üç ölçüm turunda bulunamadı; yapısal düzeltme denemeleri
   taban orandan kötü çıktı. Kritik bulgu: çökmelerin büyük kısmı **bizim kendi
   eşzamanlılığımızdandı** (kirli ortam %50, temiz ortam 0/3).
3. Ö6 yazma amplifikasyonu (~159×, 10MB eşiği).
4. A1/A10 parçalı yol ailesi.

`docs/qa/` altında 10 tarihsel sözleşme hâlâ `status: qa` görünüyor (kapanmış feature'lardan
kalma); bir `/retro` turunda librarian'la toplu düzeltilmeli. `CLAUDE.md`'ye bu oturumda onlarca
ders eklendi ama `docs/wiki`'ye işlenmedi.
