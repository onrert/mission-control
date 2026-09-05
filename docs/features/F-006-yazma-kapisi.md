---
id: F-006
title: Yazma kapısı + sınır testleri
status: done
owner: developer
deps: [F-001]
sprint: 1
---
## Açıklama
Panelin dosya sistemine yazan TEK bileşeni. Niyet tabanlı API (genel `write(path, content)` yok), izin verilen yol beyaz listesi, silme işlevi yok. F-007'den ÖNCE bitmek zorundadır.
Kaynak: `docs/02-architecture.md` §7, §11.4; ADR-005.

## Kabul kriterleri
- [x] Modül yalnızca üç hedefe yazabilir: izlenen projenin `docs/features/*.md` (yalnızca frontmatter `status`), `docs/approvals/<G>.ok` ve `<G>.deny.md`, `docs/approvals/archive/`. Kanıt: `src/server/write-gate.ts` `OPERATION_PATTERNS` + `resolveInsideRoot` adım 8; `tests/server/write-gate.test.ts` beyaz liste tablosu (28 vaka), `tests/server/write-gate-manifest.test.ts` gerçek fs akışı.
- [x] Genel amaçlı yazma fonksiyonu YOK; her yazma ayrı niyet fonksiyonudur (`setFeatureStatus`, `writeGateApproval`, `writeGateDenial`, `archiveDenial`). Kanıt: `write-gate.test.ts` "yalnızca dört niyet fonksiyonu export edilir" (`Object.keys` → `toEqual`, mutasyon 11 ile ölçüldü).
- [x] Silme/`unlink` işlevi yok (arşivleme taşımadır, silme değil). Kanıt: `archiveDenial` yalnızca `renameSync` çağırır (mutasyon 4 ile ölçüldü — `copyFileSync`'e çevrilince kırmızı verdi); `no-write-gate-bypass.test.ts` statik tarama artık `write-gate.ts`'i de ÇAĞRI-BİÇİMLİ + DİZGE-SEVİYESİ izinli tam-çağrı kümesiyle tarar (QA KALDI turu D34/B2 — önceki tasarım bu dosyayı dosya-seviyesinde tamamen muaf tutuyordu, `setFeatureStatus`'a gerçek bir `unlinkSync` eklense bile 539/539 yeşil kalıyordu; mutasyonla ölçülüp kapatıldı).
- [x] İzin verilmeyen yol, `..` ile kaçış, symlink kaçışı ve izlenen proje dışındaki yol reddedilir; testlerle kanıtlanır. Kanıt: `write-gate.test.ts` traversal/önek-tuzağı/root-yok/symlink (hedef + ata dizin) vakaları; hedef-symlink zorunlu spy testi mutasyon 9 ile kırmızı verdi; ata-dizin döngüsünün ÜST segmentlerinin de gerçekten sorgulandığı ayrı bir spy testiyle kanıtlandı (QA KALDI turu Ö5).
- [x] Yol işlemleri `node:path` ile yapılır; yol için elle regex kullanılmaz. Kanıt: `write-gate.ts` içinde `path.join`/`path.relative`/`path.dirname`/`path.basename` dışında elle ayraç birleştirme yok (elle kod incelemesiyle doğrulandı, ✓ VERIFIED — `OPERATION_PATTERNS`/`FILE_NAME_PATTERN`/`GATE_PATTERN` birer *tanımlayıcı*/*yol-şablonu* regex'idir, elle ayraç birleştirme değildir). **Düzeltme (QA KALDI turu Ö3):** önceki metindeki "(statik tarama testi doğrular)" ifadesi YANLIŞTI — `no-write-gate-bypass.test.ts`'in DENIED listesi yalnızca `fs.*` çağrı biçimlerini tarar, yol/ayraç deseni taramaz; bu AC halen elle doğrulanıyor, otomatik bir çit eklenmedi (kırılgan bir yol-regex-tespit deseni yazmak, zaten elle doğrulanmış bir özelliği ölçmek için orantısız karmaşıklık olurdu — Karpathy §2).
- [x] Test 1 — dosya sistemi manifest diff'i: tam bir kullanıcı akışından sonra izin verilenler dışında hiçbir dosya değişmemiş olmalı. Kanıt: `tests/server/write-gate-manifest.test.ts` (zenginleştirilmiş fixture, İDDİA A-E); mutasyon 3/4/17/18 ile ölçüldü.
- [x] Test 2 — statik tarama: `src/` içinde yazma kapısı dışında `fs.write*` / `fs.promises.write*` çağrısı bulunmamalı. Kanıt: `tests/no-write-gate-bypass.test.ts` — dört dosya (write-gate.ts + üç store dosyası) DİZGE-SEVİYESİ izinli tam-çağrı istisnalı, geri kalan `src/**` sıfır. **Genişletme (QA KALDI turu D35/B1):** tarama artık nesne-önekinden bağımsız (`fs.`/`fs.promises.`/`fsp.`/destructure edilmiş `promises.`) ve `fs.open`/`fs.write`/`fs.writev(Sync)`/`fs.rmdir`/`fs.promises.rm(dir)`/`fs.symlinkSync`/`fs.linkSync` ailelerini de kapsıyor; ayrıca yeniden adlandırılmış import (`import { writeFile as wf }`) veya destructure (`const { rm } = fs`) ile yasak bir fs adının EDİNİLDİĞİ satırı da yakalıyor (önceki tur bunların hiçbirini yakalamıyordu, QA'nın 9 kaçak denemesiyle ölçüldü).
- [x] Atomik yazma (geçici dosya + rename) uygulanır. Kanıt: `atomicWriteOnce`/`atomicWrite` (tmp+rename, EPERM/EBUSY 3 deneme); mutasyon 12/20 ile ölçüldü (ENOTDIR asla fırlamaz, retry gerçekten çalışıyor).

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
- Kod turu (2026-09-05): önceki agent tur sınırında kesildi, 5 ara commit + `blockers.md`
  sorusuyla devraldım. F-005'in üç test dosyası (`tests/integration/projects-api.test.ts`,
  `tests/features/projects/web/SettingsScreen.test.tsx`, `tests/e2e/settings.spec.ts`) CEO onayıyla
  mekanik olarak düzeltildi (yalnızca `x-mc-write` başlığı eklendi, hiçbir davranış/beklenti
  değişmedi). Sözleşme §8'deki 20 mutasyonun tamamı koşuldu; kanıt tablosu
  `docs/qa/F-006-contract.md` sonunda. 17/20 kırmızı verdi (biri için eksik test eklendi — mutasyon
  12); 3'ü (1, 2, 10) doğrulanmış mimari fazlalık (adım 8'in regex'i adım 6/3'ün güvenlik iddiasını
  zaten kapsıyor) olarak yeşil kaldı, gap değil — gerekçe kanıt tablosunda.

- **Düzeltme turu (2026-09-05, QA KALDI → 2 bloklayıcı + 5 önemli):** CEO kararları D34-D39
  uygulandı. **D34/B2 (bloklayıcı):** `write-gate.ts` `no-write-gate-bypass.test.ts`'in dosya-
  seviyesi tek istisnasıydı, AC3'ün "silme yok" iddiası çitsizdi (QA'nın `unlinkSync` mutasyonu
  539/539 yeşil kalmıştı) — dosya artık üç store dosyasıyla aynı, dizge-seviyesi izinli tam-çağrı
  kümesiyle taranıyor. **D35/B1 (bloklayıcı):** statik tarama `fs.write*` ailesinin bir kısmını
  (open/write/writev(Sync)/rmdir/promises.rm(dir)/symlinkSync/linkSync) ve nesne-önekinden
  bağımsız biçimleri (`fsp.rm(`/`promises.rm(`) kaçırıyordu (QA'nın 9 kaçak denemesi) — DENIED
  listesi bare/scoped olarak ikiye ayrıldı, ayrıca yeniden adlandırılmış import/destructure ile fs
  kapasitesi EDİNİMİ ayrı bir mekanizmayla yakalanıyor. **D36/Ö1:** `archiveDenial`'ın
  `mkdirSync`+`renameSync`'i zaten `try` içindeydi (kod doğru) ama arşiv hedefi bir dosyayla işgal
  edilmiş senaryosunu ölçen test yoktu — eklendi, mutasyonla (try dışına taşı → `EEXIST` fırlar)
  kanıtlandı. **D37/Ö4:** `OPERATION_PATTERNS.archive`'ın gevşetme yönü çitsizdi — `toISOString`
  sahtelenerek üretilen ad biçimine uymayan bir dosya adının reddedildiğini kanıtlayan test
  eklendi. **D38/Ö2:** `setFeatureStatus`, satır sonu içeren bir `nextStatus`'u tırnaklayıp
  frontmatter'ı bozuyordu (`ok:true` + kapanmamış tırnak) — artık satır sonu içeren değer baştan
  `invalid_body` ile reddediliyor. **D39:** sözleşmedeki mutasyon 10 gerekçesi ("geometrik olarak
  mümkün değil") yanlıştı, düzeltildi (gerçek neden `path.relative`'in kök referanslı olması);
  adım 3/6'nın sıfır bağımsız kapsaması olduğu artık açıkça yazılı, adım 3 için izole bir spy
  testi eklendi (Ö5). **Ele alınmayanlar (QA'nın "ucuz/belgesel" dediği N1-N5):** N1 (test sayısı
  raporlama farkı) bu turun kendi sayımıyla düzeltildi; N2 (`//api/events` önek atlaması), N3
  (arşiv adı ms çakışması), N4 (manifest'in symlink'e kör `walk`'ı) ve N5 (harf duyarlılığı
  mesajının teşhis edilemezliği) kasıtlı olarak KOD DEĞİŞİKLİĞİ ALMADI — hiçbiri bugün
  istismar edilebilir bir yazma yolu açmıyor (üçü de QA'nın kendi ölçümünde "etki sınırlı/hiç
  yazma rotası bu yolla erişilebilir değil" notuyla kapanmıştı), yalnızca `docs/progress.md`'ye
  not düşüldü.

## CEO'dan devralınan taahhüt (ADR-008 eki, 2026-09-04)
- F-002'de Host/Origin kontrolünde **port bileşeni yok sayıldı**; bu, aynı makinedeki başka bir yerel sayfanın API'ye istek atabilmesi demek. F-002'de etkisi sınırlıydı. **F-006 sunucuya kullanıcı adına diske yazdırdığı için bu kararı yeniden değerlendirmek ZORUNDADIR** (etkin porta bağlama, token veya eşdeğeri). Gerekçe: `docs/decisions/ADR-008-f002-kapsam-kararlari.md` "Ek — R-1".
