---
name: app-factory-sablon-klasoru
description: C:/dev/app-factory bir ŞABLON klasörüdür, gerçek uygulama üretim yeri değil — burada /new-app çalıştırmak yerine kopyala
metadata:
  type: project
---

`C:/dev/app-factory` bir **fabrika şablonudur**, içinde gerçek uygulama geliştirilmez. Gerçek projeler `C:/dev/apps/<ad>` altına kopyalanarak başlatılır.

**Why:** `/new-app` skill'i madde 1 gereği dolu bir `docs/01-prd.md` görürse durup "yeni klasörde başla" der. Şablonun içinde proje üretilirse klasör kirlenir ve sonraki her kopya bozuk başlar. 2026-09-04'teki kalibrasyon provası tam olarak bu yüzden bitiminde sıfırlandı (00-idea.md + 01-prd.md boş şablona döndü, G0.ok ve ADR-001 silindi).

**How to apply:**
- Bu klasörde `/new-app` isteği gelirse önce "burası şablon, kopyalayalım mı?" diye sor.
- Şablonda bir deneme yapıldıysa bitiminde artefaktları sıfırla; kalıcı bilgi `docs/wiki/` altına librarian ile taşınır (git geçmişi tek başına yeterli değil, çünkü şablon kopyalanınca geçmiş de kopyalanmaz).
- `docs/wiki/` projeler arası hafızadır; yeni proje klasörüne bu klasör taşınabilir.

**Kalibrasyon durumu (2026-09-04):** hat yalnızca G0→G1 arası sınandı. Sınanmamış: sözleşme→kod→QA döngüsü, qa-evaluator'ın gerçek bulgu yakalaması, KALDI/düzeltme turları, 3-tur eskalasyonu, G2 yazma engelinin gerçek kodda çalışması, G4/G5/G6, higgsfield asset akışı. İlk gerçek projede bunlara ekstra dikkat et. Detay: `docs/wiki/pages/desen/app-factory-hatti.md`.

**Açık iş:** higgsfield MCP kimlik doğrulaması yapılmadı (`/mcp`); Fable modelinin listede olup olmadığı doğrulanmadı (`/model`) — yoksa `.claude/agents/ceo.md` içinde `model: fable` → `model: opus`.

İlgili: [[veron-karar-tarzi]]
