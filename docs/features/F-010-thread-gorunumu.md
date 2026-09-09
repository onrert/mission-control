---
id: F-010
title: Feature thread görünümü (docs/qa birincil, transkript best-effort)
status: qa
owner: developer
deps: [F-007, F-009]
sprint: 2
---
## Açıklama
Bir feature'ın CEO brief → developer raporu → QA kararı → düzeltme turları zincirini tek ekranda kronolojik gösterir. Birincil kaynak App Factory'nin kendi dosyaları; transkript yalnızca zenginleştirme.
Kaynak: PRD özellik 5; `docs/03-ux.md` ekran 5 + akış (g); ADR-007 karar 2.

## Kabul kriterleri
- [x] `docs/qa/<feature>-contract.md` ve `docs/qa/*.md` bölümleri kronolojik sırayla listelenir (PRD F5/AC1). (`buildThreadDetail`, `tests/features/thread/server/thread-detail.test.ts`, `tests/e2e/thread.spec.ts`)
- [x] Transkript kaynağı yoksa, formatı tanınmazsa veya bir satır ayrıştırılamazsa panel çökmez; yalnızca ilgili bölüm "bu bölüm okunamadı" gösterir, diğer ekranlar normal çalışır (PRD F5/AC2). (W4 testleri + mutasyon M3)
- [x] Ayrıştırılamayan satır sayısı sunucu logunda tutulur; arayüzde ham hata veya stack trace gösterilmez (PRD F5/AC3). (`process.stderr.write`, dağıtıcı hata sınırı `withDispatchErrorBoundary`, mutasyon M4)
- [x] `docs/qa/latest.md` içinde `ESKALE: true` varsa thread'de rozet gösterilir (PRD F5/AC4). (`isEscalatedFor`, mutasyon M5)
- [x] Ekran tamamen salt okunurdur; hiçbir dosyaya yazma yapılmaz (PRD F5/AC5). (`thread-read-only-manifest.test.ts`, mutasyon M2)

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/thread/**`, ilgili testler.

## Notlar / kararlar
- Thread ekranı transkript hiç okunamasa bile kullanışlı kalmalıdır (ADR-007).
