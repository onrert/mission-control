---
id: F-009
title: Spike — transkript format doğrulama + dayanıklı okuyucu + fixture'lar
status: qa
owner: developer
deps: [F-003]
sprint: 2
---
## Açıklama
Araştırma feature'ı: `~/.claude/projects/**` transkript formatı belgesiz ve sürümle değişebilir. Kod yazmadan önce gerçek dosyalarla doğrulanır, dayanıklı bir okuyucu ve donmuş fixture seti üretilir. F-010 ve F-011 buna bağlıdır.
Kaynak: `docs/02-architecture.md` §9; ADR-007.

## Kabul kriterleri
- [x] En az 3 gerçek `.jsonl` incelenir; gözlemlenen satır tipleri ve `usage` alan adları yazıya dökülür. (217 dosya incelendi, `docs/wiki/pages/desen/claude-transcript-formati.md`)
- [x] Transkript yolu TAHMİN EDİLMEZ: her hook olayındaki `transcript_path` alanından toplanır; dizin taraması yalnızca yedek yoldur ve harf duyarsız eşleşir. (`resolveAllowedTranscriptPath` + `findAllowedTranscriptDirectories`)
- [x] Okuyucu satır bazında `try/catch` kullanır, bilinmeyen `type` değerlerini atlar ve sayar, ASLA istisna fırlatmaz. (`readTranscript`, `unknown_type_lines`)
- [x] `tests/fixtures/transcripts/` altına 5 fixture donar: `valid`, `truncated-last-line`, `unknown-schema`, `empty`, `bom-crlf`. Beşinde de okuyucu throw etmez.
- [x] Fixture'lar anonimleştirilir: gerçek prompt metinleri kısaltılır/temizlenir. (elle üretildi, gerçek transkriptten kopya değil; yapısal çit: `tests/features/thread/transcripts-privacy-guard.test.ts`)
- [x] `lines_bad > 0` durumunda yanıt `degraded: true` döner; `/api/health` içinde `transcript_reader: { files_seen, lines_ok, lines_bad }` raporlanır.
- [x] Doğrulanan format `docs/wiki/pages/desen/claude-transcript-formati.md` sayfasına yazılır (her Claude Code güncellemesinden sonra tekrarlanacak kontrol listesiyle).

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/thread/server/transcript-reader.ts`, `tests/fixtures/transcripts/**`, `docs/wiki/pages/desen/claude-transcript-formati.md`.

CEO'nun bu turdaki genişletmesi (T5, bağlayıcı): `src/server/index.ts` + `tests/server/
health.test.ts`'e `/api/health.transcript_reader` raporlaması için asgari dokunuş (~15 satır,
detay `docs/qa/F-009-contract.md` §1 madde 6).

## Notlar / kararlar
- Çıktısı kod değil, doğrulanmış format + fixture + okuyucudur; QA kriteri bozuk fixture'larda çökmemektir.
- Sözleşme: `docs/qa/F-009-contract.md` (T1-T6 CEO kararları + davranış/doğrulama eşleşmesi + 5 mutasyon).
- Kod turu tamamlandı 2026-09-09; QA turu 1 KALDI kararı verdi (`docs/qa/F-009-2026-09-09.md`,
  2 bloklayıcı + 5 önemli + 4 yeşil mutasyon). Düzeltme turu 1 (U1-U8) aynı gün tamamlandı, QA
  turu 2 yine KALDI kararı verdi (`docs/qa/F-009-2026-09-09-tur2.md`, Y1/Y2/Y3 bloklayıcı —
  gizlilik çiti 11/12 yeni vektörde yenildi, beyaz liste katmanı bağlantısız, M10/M11 kaynak-şekli
  çiti reddedildi). Düzeltme turu 2 (round 3, CEO kararı): gizlilik çiti DENYLIST'ten
  ALLOWLIST'e yeniden tasarlandı (`ADR-013` Ek emsali), M10/M11 davranış çitiyle değiştirildi,
  wiki 219/217 tutarsızlığı düzeltildi — detay `docs/qa/F-009-contract.md` §7 ve
  `docs/progress.md`. Feature durumu tekrar `qa`'ya alındı.
- **F-010 bağlamazsa sil:** `createTranscriptReaderStatsTracker()`'ın `.record()`'u bu turda da
  (round-2 sonunda) hiçbir üretim kodu tarafından çağrılmıyor (QA B8, "kabul edilebilir" kararı
  round-1'de verildi). F-010/F-011 bu fonksiyonu gerçek bir okuma yoluna bağlamazsa, bu ~25
  satırlık tüketicisiz kod Karpathy §2 gereği kaldırılmalı (`transcript-reader.ts`'teki
  `createTranscriptReaderStatsTracker`/`TranscriptReaderStats`/`TranscriptReaderStatsTracker` +
  `src/server/index.ts`'teki entegrasyonu + `/api/health.transcript_reader` alanı).
