---
id: F-006
title: Yazma kapısı + sınır testleri
status: todo
owner: developer
deps: [F-001]
sprint: 1
---
## Açıklama
Panelin dosya sistemine yazan TEK bileşeni. Niyet tabanlı API (genel `write(path, content)` yok), izin verilen yol beyaz listesi, silme işlevi yok. F-007'den ÖNCE bitmek zorundadır.
Kaynak: `docs/02-architecture.md` §7, §11.4; ADR-005.

## Kabul kriterleri
- [ ] Modül yalnızca üç hedefe yazabilir: izlenen projenin `docs/features/*.md` (yalnızca frontmatter `status`), `docs/approvals/<G>.ok` ve `<G>.deny.md`, `docs/approvals/archive/`.
- [ ] Genel amaçlı yazma fonksiyonu YOK; her yazma ayrı niyet fonksiyonudur (`setFeatureStatus`, `writeGateApproval`, `writeGateDenial`, `archiveDenial`).
- [ ] Silme/`unlink` işlevi yok (arşivleme taşımadır, silme değil).
- [ ] İzin verilmeyen yol, `..` ile kaçış, symlink kaçışı ve izlenen proje dışındaki yol reddedilir; testlerle kanıtlanır.
- [ ] Yol işlemleri `node:path` ile yapılır; yol için elle regex kullanılmaz (statik tarama testi doğrular).
- [ ] Test 1 — dosya sistemi manifest diff'i: tam bir kullanıcı akışından sonra izin verilenler dışında hiçbir dosya değişmemiş olmalı.
- [ ] Test 2 — statik tarama: `src/` içinde yazma kapısı dışında `fs.write*` / `fs.promises.write*` çağrısı bulunmamalı.
- [ ] Atomik yazma (geçici dosya + rename) uygulanır.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/server/write-gate.ts`, `tests/helpers/manifest.ts`, ilgili testler.

## Notlar / kararlar
- Bu feature bir güvenlik sınırıdır; QA KALDI verirse kapsam daraltılarak değil, düzeltilerek geçilir.
