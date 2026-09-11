---
feature: test-izolasyon (npm run test — history-log.test.ts assert kırmızısı teşhisi)
status: qa
owner: developer
---

# Sözleşme — `npm run test` tam suite'te görülen assert kırmızısının teşhisi ve düzeltmesi

## 1. Ne yapacağım (özet)

CEO'nun bildirdiği bulgu ("tam suitte `history-log.test.ts` assert kırmızısı, izole koşuda
5/5 yeşil, hata metni `mc-events-*\projects.json okunamadı`") **ölçülerek** teşhis edildi.
Teşhis, ilk hipotezi ("iki test aynı geçici dizini paylaşıyor") **reddetti** ve gerçek kök
nedeni buldu: **Windows'ta `fs.rmSync(dir, { recursive: true, force: true })` transient
`ENOTEMPTY` hatası** (Node'un kendi belgelediği, `maxRetries`/`retryDelay` ile çözülen, bilinen
bir Windows dosya sistemi yarışı — genelde Windows Defender/İçerik İndeksleyici'nin az önce
oluşturulan dosyaya kısa süreliğine kilit koyması). Düzeltme: bu deponun test suitindeki
**her** `fs.rmSync(..., { recursive: true, force: true })` temizlik çağrısına `maxRetries: 5,
retryDelay: 50` eklemek (Node'un yerleşik retry mekanizması — yeni soyutlama yok).

## 2. Teşhis — ölçülerek

### 2.1 İlk hipotez (CEO'nun raporu) — REDDEDİLDİ, kanıtla

CEO'nun raporundaki metin ("FAIL history-log.test.ts ... Hata: ...projects.json okunamadı...")
iki bağımsız, ilgisiz olayın **ham terminal çıktısında yan yana görünmesiydi**, mantıksal bir
bağlantı değildi. Kanıt:

1. `vitest.config.ts`'de `poolOptions` yok → varsayılan `pool: 'forks'`, `isolate: true`.
   Her koşuda raporun kendisi bunu doğruluyor: `Isolate 87 workers spawned ... (spawn +
   environment, per file)` — yani **her test dosyası kendi ayrı işletim sistemi sürecinde**
   çalışıyor, süreçler arası paylaşılan `process`/modül durumu yok.
2. `history-log.test.ts` kendi `mc-chat-history-*` önekiyle (`fs.mkdtempSync`), `projects-
   registry.test.ts`/`createTempDataDir()` ise `mc-events-*` önekiyle geçici dizin açıyor —
   **iki dosya arasında hiçbir ortak dosya yolu yok**, dolayısıyla gerçek bir "paylaşılan
   durum" bu iki dosya arasında **yapısal olarak imkânsız**.
3. `Hata: ...mc-events-*\projects.json okunamadı...: Expected property name or '}' in JSON at
   position 2 (line 1 column 3)` metni **birebir ve tek kaynaktan** geliyor:
   `tests/server/store/projects-registry.test.ts:107`'deki kasıtlı "bozuk JSON" testi
   (`fs.writeFileSync(filePath, '{ bozuk json ]')`). Bu, **GEÇEN** bir testin **beklenen**
   `process.stderr.write` çıktısıdır (`src/server/store/projects-registry.ts`'in `init()`'i).
   40 ardışık `npm run test` koşusunun **40'ında da** bu iki mesaj **birebir aynı metinle,
   tam olarak 2 kez** göründü — hiçbiri bir FAIL/Unhandled Error bölümüyle ilişkilendirilmedi.
4. 40 koşunun **hiçbirinde** `history-log.test.ts`'in bu mesajla bağlantılı bir kırmızısı
   görülmedi.

### 2.2 Gerçek kök neden — yakalandı, kanıtla (run 36/40)

40. koşuda `history-log.test.ts` gerçekten kırmızı verdi — ama CEO'nun bahsettiği mesajla
**değil**. Gerçek hata (vitest'in "Failed Tests" bölümünde, `projects.json` metninden tamamen
ayrı):

```
FAIL  tests/features/chat/server/history-log.test.ts > createHistoryLog — append + readPage > sayfalama: limit ve beforeSeq (Ö4)
Error: ENOTEMPTY, Directory not empty: \\?\C:\Users\pc\AppData\Local\Temp\mc-chat-history-Pmw3qy '\\?\C:\Users\pc\AppData\Local\Temp\mc-chat-history-Pmw3qy'
 ❯ tests/features/chat/server/history-log.test.ts:22:6
     22|   fs.rmSync(dataDir, { recursive: true, force: true })
```

Önemli: aynı ham logda, bu gerçek FAIL bloğundan **hemen önce**, ilgisiz `projects.json
okunamadı` satırları da göründü (§2.1'in 3. maddesindeki aynı deterministik metin) —
**CEO'nun raporundaki yan yana görünüm tam olarak burada oluşuyor.** Kanıt: CEO'nun raporu
muhtemelen bu satırların **inline özet** (`❯ ... × sayfalama... (Ö4)`) kısmından kopyalanmış;
gerçek hata birkaç satır aşağıdaki "Failed Tests" bölümünde, farklı bir metinle.

**Bu, `docs/blockers.md`'de ZATEN KAYITLI bir sınıf** (satır ~534): "bilinen bağımsız bir
Windows temp-dizin yarış durumu (`ENOTEMPTY`, `tests/helpers/temp-data-dir.ts`)" ve B-4'ün
"Sınıf B (~%5): `ENOTEMPTY` temp-dizin yarışı" girdisiyle **birebir aynı aile**. Yeni olan:
(a) bu örnekte `tests/helpers/temp-data-dir.ts` değil `history-log.test.ts`'in **kendi** inline
`fs.rmSync`'i etkilendi — yani sınıf, paylaşılan helper'a özgü değil, **her** `fs.rmSync(...,
{recursive:true, force:true})` çağrısına genel; (b) bu kez kalıcı bir düzeltme yapılıyor
(önceden yalnızca "tekrar koşunca kayboldu" notu düşülmüştü).

**Mekanizma (Node'un kendi belgelediği davranış):** `fs.rmSync`/`fs.rm`'in `recursive: true`
modu önce dizini okur (`readdir`), sonra içindekileri tek tek siler. Windows'ta bu iki adım
arasında Windows Defender / İçerik Dizini gibi bir süreç dizindeki bir dosyaya kısa süreli bir
tutamaç (handle) açarsa, silme `ENOTEMPTY` veya `EBUSY` ile başarısız olur — **transient**,
birkaç milisaniye içinde kendiliğinden geçer. Node bu durum için `maxRetries`/`retryDelay`
seçeneklerini **yerleşik olarak** sağlıyor (v14.14+); bu depodaki hiçbir çağrı bunları
kullanmıyordu (`maxRetries` varsayılanı `0` = retry yok).

### 2.3 Etkilenen dosyalar — aynı desenin herkeste taranması

`tests/**/*.test.ts` içinde (yani `npm run test`'in kapsadığı, `vitest.config.ts`'in
`exclude: ['tests/e2e/**']` dışında bıraktığı dosyalar) `fs.rmSync(X, { recursive: true, force:
true })` deseni **19 dosyada, 61 çağrı noktasında** birebir aynı biçimde geçiyor (grep ile
numaralandırıldı, hepsi test-temizlik çağrısı — güvenlik/guard testi DEĞİL, elle doğrulandı;
`tests/build-css.test.ts` ilk taramada atlanmıştı, uygulama sırasında `grep -rn "recursive:
true, force: true })" tests/` ile doğrulanan sıfır-kalıntı kontrolünde yakalanıp eklendi):

`tests/helpers/temp-data-dir.ts` (1) · `tests/no-write-gate-bypass.test.ts` (1) ·
`tests/scripts/install-hook.test.ts` (1) · `tests/server/write-gate.test.ts` (3) ·
`tests/integration/gates-write-permission-live.test.ts` (1) ·
`tests/integration/projects-api.test.ts` (1) · `tests/integration/features-api.test.ts` (3) ·
`tests/server/watch/project-watcher.test.ts` (3) ·
`tests/features/gates/server/gates-watcher.test.ts` (1) ·
`tests/server/store/retention.test.ts` (4) ·
`tests/features/events/server/normalize.test.ts` (1) ·
`tests/features/thread/transcript-reader.test.ts` (23) ·
`tests/features/usage/server/network-capability-guard.test.ts` (7) ·
`tests/features/chat/server/history-log.test.ts` (1, gerçek kırmızıyı üreten) ·
`tests/features/chat/server/session.test.ts` (1) ·
`tests/features/chat/server/env-barrier.test.ts` (2) ·
`tests/features/projects/server/service.test.ts` (6) ·
`tests/features/projects/server/validate-path.test.ts` (1) ·
`tests/build-css.test.ts` (1)

`tests/e2e/**` altındaki 6 dosyadaki aynı desen **kapsam dışı** bırakıldı — bunlar `npm run
test` (vitest) tarafından değil `npm run e2e` (Playwright, ayrı runner/config) tarafından
çalıştırılıyor; bu sözleşme yalnızca `npm run test`'i kapsıyor.

## 3. Düzeltme mekanizması

19 dosyadaki 61 çağrı noktasının **tümünde** `{ recursive: true, force: true }` →
`{ recursive: true, force: true, maxRetries: 5, retryDelay: 50 }` (birebir string değişimi,
her dosyada `replace_all`; uygulamadan sonra `grep -rn "recursive: true, force: true })"
tests/ | grep -v tests/e2e/` boş döndü — sıfır kalıntı doğrulandı). Yeni fonksiyon/soyutlama
**eklenmiyor** — Node'un zaten var olan, belgelenmiş `fs.rmSync` seçenekleri kullanılıyor.
En kötü senaryoda dosya başına ek gecikme 5 × 50ms = 250ms (yalnızca gerçekten ENOTEMPTY/EBUSY/
vb. ile karşılaşılırsa; normal koşuda ek maliyet sıfır).

## 4. Ölçülebilir kabul kriterleri

1. Düzeltme sonrası `npm run test` **≥10 ardışık koşuda** hiçbir dosyada `ENOTEMPTY`/`EBUSY`
   kaynaklı assert kırmızısı vermemeli (Sınıf A — `Worker forks emitted error` — düzeltmenin
   kapsamı dışında, B-4'te ayrı, yönetilen risk olarak kayıtlı; bu koşularda sınıflandırılarak
   ayrı raporlanacak).
2. Mutasyon: `maxRetries`/`retryDelay`'i `history-log.test.ts`'in düzeltilen satırından **elle**
   geri alıp (git checkout KULLANILMADI), ENOTEMPTY'nin tekrar üretilebilirliğini birkaç koşu
   ile göstermeye çalışmak — transient bir yarış olduğu için deterministik tekrar üretim
   garanti değil; kaç koşuda kaç kez göründüğü sayılacak.
3. `_selftest.cjs` 206/206 (değişmedi — `.claude/` dokunulmadı).
4. `npx tsc --noEmit` = 0, `npx eslint .` = 0.
5. `npm run e2e` 55/55 (izole) — bu değişiklik e2e'yi etkilemiyor ama regresyon olmadığı
   doğrulanacak.
6. B-4 taban oranına etki: düzeltme öncesi ölçüm burada — **40 `npm run test` koşusu, 10
   kırmızı (%25.0)**: 9'u Sınıf A (`Worker forks emitted error`, assert kırmızısı YOK), 1'i bu
   sözleşmenin konusu olan ENOTEMPTY assert kırmızısı (`history-log.test.ts`). Düzeltme
   sonrası aynı sayıda koşu tekrarlanıp yeni oran karşılaştırılacak; beklenti: kırmızı oranı
   ENOTEMPTY payı kadar düşer (~%2.5 puan), Sınıf A (B-4'ün ana konusu) **değişmeden** kalır —
   bu sözleşme Sınıf A'yı düzeltmiyor, yalnızca ENOTEMPTY assert sınıfını kapatıyor.

## 5. Kabul edilen sınır

Sınıf A (`Worker forks emitted error`, exit code 3221226505) bu sözleşmenin kapsamı dışında —
B-4'te ayrı, üç turda ölçülmüş ve kök nedeni bulunamamış, "ölçülmüş ve yönetilen risk" olarak
kayıtlı. Bu sözleşme yalnızca **assert kırmızısı üreten** ENOTEMPTY sınıfını kapatıyor; CLAUDE.md
kuralı gereği ("assert kırmızısı = gerçek hata, her zaman bloklayıcı") bu sınıf artık "tekrar
koş" ile idare edilemez, kalıcı olarak kapatılmalıydı — bu tur bunu yapıyor.

## 6. Ölçülen sonuçlar (uygulama sonrası)

**Düzeltme öncesi taban (40 koşu, ayrı ölçüm):** 10 kırmızı (%25.0) — 9 Sınıf A, 1 ENOTEMPTY
assert kırmızısı (§2.2'deki run 36/40, canlı yakalandı).

**Düzeltme sonrası (30 ardışık `npm run test` koşusu, iki parti — 15+15):**
- **Assert kırmızısı: 0/30.** ENOTEMPTY: 0/30.
- Kırmızı toplam: 7/30 (%23.3) — **hepsi Sınıf A** (`Worker forks emitted error`, farklı
  dosyalarda: `features-api`, `gates-api`×2, `events-api`, `health`, `chat-api`, `projects-api`
  arasında dağılmış — B-4'ün "8 farklı dosyaya rastgele dağılmış" bulgusuyla tutarlı).
- **Kabul kriteri §4.1 (≥10 ardışık koşu, assert kırmızısı sıfır) 30/30 ile fazlasıyla
  karşılandı.**
- B-4 taban oranına etki (§4.6): %25.0 → %23.3 — ENOTEMPTY payı kadar düşüş (istatistiksel
  gürültü payı içinde, n=30-40 için beklenen); Sınıf A oranı **değişmedi** (beklenen — bu
  sözleşme Sınıf A'ya dokunmuyor).

**Mutasyon kanıtı (elle, `git checkout` KULLANILMADI):**
- `history-log.test.ts:22`'deki `maxRetries: 5, retryDelay: 50` elle kaldırıldı (`Edit` ile
  birebir ters işlem), diğer 60 çağrı noktası **dokunulmadan** düzeltilmiş kaldı.
- Yalnızca bu dosyayı **izole** 30 kez koşturmak (`npx vitest run
  tests/features/chat/server/history-log.test.ts`) **0/30 ENOTEMPTY** verdi — bu, ırkın tam
  suitteki **sistem-geneli G/Ç yükü** (87 eşzamanlı süreç) ile korelasyonlu olduğunu, dosyanın
  kendi başına yeterli olmadığını doğruluyor (izole koşuda hiçbir zaman görünmemesiyle tutarlı,
  §2.1 madde 1'deki tam süreç izolasyonu bulgusuyla birlikte okunmalı).
- Mutasyonla tam suit **20 kez** koşturuldu: **0/20 ENOTEMPTY tekrar üretildi** (2 kırmızı çıktı,
  ikisi de Sınıf A — `gates-api`, `chat-api` — ENOTEMPTY ile ilgisiz). Bu, transient bir yarışın
  **beklenen** davranışı: düzeltme öncesi taban oranı (1/40 ≈ %2.5) ile 20 koşuda hiç
  görülmemesi (`(1-0.025)^20 ≈ %60` ihtimalle beklenen) **istatistiksel olarak tutarlı** —
  yokluğu düzeltmenin etkisiz olduğunu KANITLAMIYOR, yalnızca deterministik tekrar üretim
  garanti edilemeyen bir sınıf olduğunu doğruluyor. Asıl kanıt §2.2'deki **canlı yakalanan**
  orijinal olay ve mekanizmanın Node'un resmî belgelenmiş davranışı olması.
- Mutasyon elle geri alındı, `git diff` **boş** (hiçbir iz kalmadı) — doğrulandı.

**Diğer doğrulamalar:**
- `_selftest.cjs`: **206/206** (`.claude/` dokunulmadı).
- `npx tsc --noEmit` = 0, `npx eslint .` = 0.
- `npm run e2e`: **55/55** (izole).
- Süreç hijyeni: her ağır komut öncesi/sonrası `tasklist` ile `node.exe` sayısı **0** (yetim
  süreç yok, tüm turlar boyunca).
- `git status --short`: temiz (mutasyon geri alındıktan sonra).

## 7. Durum

`status: qa`. Kod ve sözleşme commit'li (`08184a4` sözleşme, `e004b34` düzeltme). GEÇTİ/KALDI
kararı qa-evaluator'a ait. Kalan risk: ENOTEMPTY'nin transient doğası nedeniyle §6'daki mutasyon
kanıtı **dolaylı** (istatistiksel tutarlılık) — canlı yakalanan tek örnek ve Node'un resmî
`maxRetries` belgesi asıl dayanak. Sınıf A (B-4) bu sözleşmenin kapsamı dışında, değişmeden
devam ediyor.
