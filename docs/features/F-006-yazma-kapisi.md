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

**Genişletme (CEO onayı, 2026-09-05 — sözleşme §2.2'de gerekçeli):**
- `src/server/index.ts` — ADR-013 başlık kontrolü ve `POST /api/events` içerik tipi allowlist'i
  **dağıtıcı seviyesinde tek yerde** uygulanacak (yeni bir yazma ucu eklendiğinde korumasız
  kalmasın; F-003'te `/api/stream` Host korumasından muaf kalmış ve QA mutasyonu 314/314 yeşil
  bırakmıştı). Yeni yazma uçları da burada tanımlanır.
- `src/web/lib/write-fetch.ts` (yeni) — başlığı ekleyen **tek** istemci sarmalayıcısı.
- `src/features/projects/web/useProjects.ts` — F-005'in `fetch` çağrıları `writeFetch`'e geçirilir.
  **Zorunlu:** aksi hâlde F-006 kendi eklediği korumayla F-005'i kırar. Dokunuş minimum olacak;
  F-005'in mevcut testleri (Ekle/Kaldır hata yolları dahil) **değişmeden** geçmeli.
- `src/shared/types.ts` — başlık adı ve içerik tipi sabitleri.

**İkinci genişletme (CEO onayı, 2026-09-05 — developer `blockers.md`'de sordu, doğru davrandı):**
F-006'nın eklediği `x-mc-write` zorunluluğu, F-005'in **test** dosyalarını da kırıyor: onlar API'yi
başlıksız çağırıyor. Düzeltme tamamen **mekanik** (çağrı sitelerine `{ headers: { 'x-mc-write': '1' } }`
eklemek); hiçbir davranış veya assert değişmeyecek.
- `tests/integration/projects-api.test.ts` (~13 çağrı sitesi)
- `tests/features/projects/web/SettingsScreen.test.tsx` (1 assert)
- `tests/e2e/settings.spec.ts` (2 çağrı sitesi)
**Kısıt:** yalnızca başlık eklenecek. Bir testin *beklentisi* değişmesi gerekiyorsa bu, korumanın
F-005'in davranışını bozduğu anlamına gelir → dur ve CEO'ya bildir.

## Notlar / kararlar
- Bu feature bir güvenlik sınırıdır; QA KALDI verirse kapsam daraltılarak değil, düzeltilerek geçilir.

## CEO'dan devralınan taahhüt (ADR-008 eki, 2026-09-04)
- F-002'de Host/Origin kontrolünde **port bileşeni yok sayıldı**; bu, aynı makinedeki başka bir yerel sayfanın API'ye istek atabilmesi demek. F-002'de etkisi sınırlıydı. **F-006 sunucuya kullanıcı adına diske yazdırdığı için bu kararı yeniden değerlendirmek ZORUNDADIR** (etkin porta bağlama, token veya eşdeğeri). Gerekçe: `docs/decisions/ADR-008-f002-kapsam-kararlari.md` "Ek — R-1".
