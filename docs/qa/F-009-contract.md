---
feature: F-009
title: Spike — transkript format doğrulama + dayanıklı okuyucu + fixture'lar
author: developer
status: draft
date: 2026-09-09
---

# F-009 Sözleşmesi — transkript format doğrulama + dayanıklı okuyucu + fixture'lar

Kod yazılmadan önceki "ne yapacağım + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").

Kaynaklar: `docs/features/F-009-transkript-spike.md` (7 AC), `docs/02-architecture.md` §9,
`docs/decisions/ADR-007-transkript-ve-token-veri-kaynagi.md`, CEO'nun bu turdaki ek kararları
T1-T6 (bağlayıcı), `src/features/kanban/server/read-guard.ts` (T4'ün uyarlanacağı desen),
`CLAUDE.md` "Öğrenilen kurallar" (tamamı).

Araştırma bu turda yapıldı (kod yazılmadan önce): `C:\Users\pc\.claude\projects\
C--dev-apps-mission-control\` altındaki 217 gerçek `.jsonl` dosyası (ana oturum + subagent)
tip alanına göre tarandı (yalnızca `type` sayıları + `message.usage` alan adları toplandı, ham
içerik bu belgeye YAPIŞTIRILMADI). Kurulu CLI: `claude --version` → **2.1.205**; transkriptlerin
kendi `version` alanı **2.1.261** gösteriyor (SDK/harness sürümü CLI'dan ayrı görünüyor — ikisi de
wiki sayfasına yazılacak).

---

## 1. Kapsam

**İçinde:**
1. `src/features/thread/server/transcript-reader.ts` — tek dosya, şu işlevler:
   - `readTranscript(filePath)`: satır bazlı, ASLA throw etmeyen okuyucu. `lines_ok`/`lines_bad`/
     `unknown_type_lines`/`degraded`/`usage` (yalnızca `type:"assistant"` satırlarının
     `message.usage.*` toplamı) döner. 64 MB üstü dosyalarda yalnızca son 32 MB okunur (satır
     sınırına hizalı) — ADR-007 §9.4.
   - `encodeProjectDirName(absoluteProjectPath)`: bilinen (önceden güvenilen) bir proje yolunu
     `~/.claude/projects/<kodlanmış>` dizin adına çevirir (regex değil, karakter eşlemesi).
   - `findAllowedTranscriptDirectories(claudeProjectsRoot, allowedProjectPaths)`: **yedek yol**
     (T3) — harf duyarsız dizin taraması, yalnızca izin verilen projelerin dizinlerini döner.
   - `resolveAllowedTranscriptPath(claudeProjectsRoot, allowedProjectPaths, candidatePath)`:
     **en küçük yetki çiti** (T4) — F-013 `read-guard.ts` deseni (node:path + symlink savunması +
     `path.relative` kapsama kontrolü), izin verilen proje kümesinin DIŞINDaki her şeyi reddeder.
   - `readAllowedTranscript(...)`: guard + reader'ı birleştiren tek giriş noktası (gelecekteki
     F-010/F-011'in tek çağıracağı fonksiyon — guard'ı atlamayı imkânsız kılar).
   - `createTranscriptReaderStatsTracker()`: `/api/health` için `{files_seen, lines_ok,
     lines_bad}` sayaç fabrikası (T5).
2. `tests/fixtures/transcripts/{valid,truncated-last-line,unknown-schema,empty,bom-crlf}.jsonl`
   — anonimleştirilmiş, elle yazılmış (gerçek transkriptten kopya DEĞİL, gözlemlenen şemaya göre
   üretildi).
3. `tests/features/thread/transcript-reader.test.ts` — T2/T3/T4/T5 davranışları + 5 mutasyon.
4. `tests/features/thread/transcripts-privacy-guard.test.ts` — T1 gizlilik çiti (fixture
   içeriğini tarar).
5. `docs/wiki/pages/desen/claude-transcript-formati.md` — T6 (bulgular + tekrarlanacak kontrol
   listesi + sürüm no).
6. **Asgari dokunuş** (CEO'nun bu turdaki genişletmesi): `src/server/index.ts`'e
   `createTranscriptReaderStatsTracker()` çağrısı + `handleHealth`'in `transcript_reader` alanı
   (mevcut `getCorruptLines`/`getWriteErrors` getter desenini tekrarlar, ~6 satır), ve
   `tests/server/health.test.ts`'e bu alanı doğrulayan tek bir assert genişletmesi.

**Kapsam DIŞI (bilinçli):** Thread/Token uçlarının kendisi (F-010/F-011), `transcript_path`'in
gerçek olay akışından toplanması (o, ileride F-010/F-011'in `src/features/events/**`'i
kullanacağı ayrı bir entegrasyon — bu turda YOK, çünkü dosya sahipliği yalnızca
`transcript-reader.ts`). `createTranscriptReaderStatsTracker()`'ın `.record()`'unu hiçbir üretim
kodu bu turda ÇAĞIRMAZ — health'teki üç sayaç bu turda dürüstçe sıfır kalır (henüz hiçbir
okuma olmadı); bu bilinçli bir sınırlama, F-010/F-011'e devredilir.

---

## 2. Veri sözleşmesi

```ts
interface TranscriptUsageTotals {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}
interface TranscriptReadResult {
  file_path: string
  lines_ok: number
  lines_bad: number
  unknown_type_lines: number
  degraded: boolean          // lines_bad > 0
  file_read_failed: boolean  // dosya hiç açılamadıysa (ENOENT/EPERM) true, geri kalan alanlar 0
  usage: TranscriptUsageTotals
}
type TranscriptGuardRejectReason =
  | 'path-invalid' | 'not-found' | 'symlink' | 'outside-root' | 'not-allowed'
type TranscriptGuardResult =
  | { ok: true; targetPath: string }
  | { ok: false; reason: TranscriptGuardRejectReason }
interface TranscriptReaderStats { files_seen: number; lines_ok: number; lines_bad: number }
```

Gözlemlenen gerçek satır tipleri (217 dosya, bu makinede): `agent-setting`, `queue-operation`,
`attachment`, `user`, `last-prompt`, `atis-latch`, `assistant`, `system`, `mode`,
`permission-mode`, `file-history-snapshot`, `bridge-session`, `custom-title`. Okuyucu yalnızca
`user`/`assistant`/`system`/`summary`'yi "tanınan" sayar (mimari §9.3'ün örnek listesiyle
tutarlı); geri kalanı **atlar ve `unknown_type_lines`'a sayar** — throw etmez, `lines_ok`'u
etkilemez (JSON olarak geçerliydiler).

---

## 3. Davranış ↔ doğrulama eşleşmesi

| # | Davranış | Nasıl doğrulanacak |
|---|---|---|
| T1 | Fixture'larda gerçek prompt/kişisel veri/mutlak kullanıcı yolu/secret-biçimli dizge/ilgisiz proje adı yok | `transcripts-privacy-guard.test.ts`: `tests/fixtures/transcripts/**`'i `readdirSync` ile numaralandırıp her satırı 4 desenle tarar: (a) `C:\\Users\\<gerçek-olmayan-örnek-dışında>`, (b) `sk-`/`ghp_`/`toolu_`-biçimli uzun token, (c) bilinen ilgisiz proje adları (`hayat-mentoru`, `video-factory`, `growth-factory`, `app-factory`), (d) 200+ karakterlik serbest metin bloğu (gerçek prompt kopyası şüphesi). **Mutasyon:** yeni bir fixture'a `C:\Users\pc\gercek-yol` eklenince test KIRMIZI. |
| T2 | Okuyucu 5 bozuk fixture'da da throw etmez | Her fixture için `expect(() => readTranscript(f)).not.toThrow()` + dönen sonucun şeklini assert eder (`truncated-last-line` → `lines_bad >= 1`, `empty` → hepsi 0, `bom-crlf` → BOM+CRLF satırları `lines_ok`'a sayılır). **Mutasyon:** `try/catch` kaldırılınca `truncated-last-line.jsonl` testinde gerçek `SyntaxError` fırlar → KIRMIZI. |
| T3 | Yol tahmin edilmez; dizin taraması yedek + harf duyarsız | Geçici dizinde karışık harfli proje dizinleri oluşturulur (`C--dev-Foo`, `c--dev-bar`); `findAllowedTranscriptDirectories` yalnızca izin verilen projelerin (harf duyarsız eşleşen) dizinlerini döner, izin verilmeyen bir dizin (ör. `C--dev-hayat-mentoru` benzeri sahte ad) asla dönmez. **Mutasyon:** harf duyarsız karşılaştırma `===`'a düşürülünce karışık harfli test KIRMIZI. |
| T4 | En küçük yetki: yalnızca izlenen projelerin transkriptleri | Geçici `claudeProjectsRoot` içinde iki proje dizini kurulur: biri `allowedProjectPaths`'te, biri değil ("kaçış denemesi" — ilgisiz proje transkripti). `resolveAllowedTranscriptPath` izin verilenin dosyasını kabul eder, izin verilmeyeninkini `not-allowed` ile reddeder. **Mutasyon:** izin listesi kontrolü kaldırılınca (her zaman `ok:true`) kaçış testi KIRMIZI. |
| T5 | `degraded` dürüst | `readTranscript(truncated-last-line)` → `degraded === true`; `readTranscript(valid)` → `degraded === false`. `/api/health` → `transcript_reader:{files_seen:0,lines_ok:0,lines_bad:0}` (bu turda hiç okuma tetiklenmediği için dürüst sıfır). **Mutasyon:** `degraded: linesBad > 0` → `degraded: false` sabitine düşürülünce KIRMIZI. |
| T6 | Wiki + kontrol listesi + sürüm no | Elle inceleme: sayfa gözlemlenen tip/`usage` alanlarını, kurulu sürüm (2.1.205 CLI / 2.1.261 transkript) numarasını ve "her güncellemeden sonra tekrarla" başlıklı adım adım kontrol listesini içeriyor mu. |

`file_read_failed` (ENOENT/EPERM gibi dosya hiç açılamayan durum) 5 zorunlu fixture'ın hiçbirinde
tetiklenmiyor; bonus olarak var olmayan bir yol için `readTranscript` çağrılıp throw etmediği ve
`file_read_failed:true` döndürdüğü ayrı, küçük bir testle doğrulanacak (AC'nin "ASLA istisna
fırlatmaz" iddiasını dosya-düzeyinde de kanıtlamak için).

---

## 4. Mutasyon testi (zorunlu, §"MUTASYON TESTİ" görev talimatı)

Yukarıdaki 5 satırın "Mutasyon" sütunu birebir uygulanacak: değiştir → `npx vitest run
tests/features/thread/` ile izole çalıştır → KIRMIZI gözlemle → Edit ile birebir geri al → tekrar
YEŞİL doğrula. Her mutasyonda "bunu maskeleyen bir yan etki var mı?" sorusu sorulacak (F-008
dersi). Turun sonunda `grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` çalıştırılıp
yalnızca `tests/server/write-gate-manifest.test.ts:124`'ün (meşru, dokunulmayacak) çıktığı
doğrulanacak.

---

## 5. Doğrulama

- `npm run typecheck && npm run lint && npm run test && npm run build` (== `npm run verify`) = 0.
  Kırmızı çıkarsa **elle bir kez daha koştur** (worker-fork kararsızlığı, retry EKLENMEZ).
- `npm run e2e` ve mevcut paketler bu turda **bozulmamalı** — dosya sahipliği yalnızca yeni
  dosyalar + `index.ts`/`health.test.ts`'e birkaç satır olduğu için E2E davranışı etkilenmiyor,
  yine de tam koşu yapılıp sayı raporlanacak.
- `git status`/`git diff` mutasyon izi göstermemeli.
- Yetim `node`/`npm run dev` süreci kalmamalı (`npm run dev` bu turda hiç çalıştırılmayacak).

## 6a. Sapma (kod turunda ortaya çıktı) — `fs.openSync`/`fs.readSync` yerine tam `readFileSync` + bellekte kırpma

`readRelevantText`'in ilk taslağı 64 MB üstü dosyalarda yalnızca son 32 MB'ı diskten okumak için
`fs.openSync`/`fs.readSync`/`fs.closeSync` kullanıyordu. `npm run verify` bunun `tests/
no-write-gate-bypass.test.ts`'i (dosya sahipliğimiz DIŞI, tüm `src/**`'i tarayan repo-geneli bir
çit) kırdığını gösterdi: `openSync(` bu depoda TÜM `src/**` için (yalnızca `write-gate.ts` gibi
önceden beyaz listelenmiş dosyalar hariç) yasak. Çözüm: yalnızca `fs.readFileSync` (izinli, bir
okuma çağrısı) kullanılır; dosyanın TAMAMI belleğe okunur, ADR-007'nin "yalnızca son 32 MB
işlenir" niyeti diskten kısmi okuma yerine bellekte kırpma ile korunur. Gerçek gözlemlenen
transkript boyutları (≤ ~10 MB, 2026-09-09) için bu ayrımın maliyeti yoktur; yüzlerce MB'lık bir
transkript teorik olarak tek seferlik daha yüksek bellek kullanımına yol açar ama böyle bir dosya
bu makinede hiç gözlemlenmedi. Dosya sahipliği dışına çıkmamak için `no-write-gate-bypass.test.ts`
DEĞİŞTİRİLMEDİ.

## 6. Sapma / bilinen sınır (kod yazılmadan not düşülüyor)

- `readTranscript`'in ADR pseudocode'undaki `records[]` alanı **kasıtlı olarak yok** — F-009'un
  tek somut tüketim ihtiyacı (ADR §9.4 madde 3: token toplama) `usage` toplamıyla karşılanıyor;
  ham satır içeriğini bellekte tutmak hem gizlilik yüzeyini büyütür hem de hiçbir AC bunu talep
  etmiyor. F-010 (Thread) kendi zenginleştirme ihtiyacı için bu dosyaya yeni bir fonksiyon
  ekleyebilir — mevcut fonksiyonlar değişmeden kalır.
- `createTranscriptReaderStatsTracker()` bu turda hiçbir üretim kodu tarafından `.record()` ile
  beslenmiyor (yukarıya bakınız, kapsam dışı bölümü) — `/api/health`'in üç sayacı bu turda hep
  sıfır. Yanlış/uydurma bir sayı YOK, yalnızca "henüz kullanılmadı" dürüstlüğü var.

---

## 7. Round 3 (2026-09-09) — gizlilik çitinin YENİDEN TASARIMI: denylist → allowlist

CEO kararı, `docs/qa/F-009-2026-09-09-tur2.md` (KALDI, Y1/Y2/Y3 bloklayıcı). İki turda iki kez
yenilen denylist yaklaşımı **tamamen atılıyor**; yerine bir **beyaz liste (allowlist)** geliyor.
`ADR-013` Ek'teki emsal ("allowlist zorunludur, denylist değil") burada birebir uygulanıyor.

### 7.1 Ne değişiyor

`transcripts-privacy-guard.test.ts` artık şu tasarıma göre çalışacak:

1. **Ham satır, JSON'dan bağımsız tokenize edilir.** `fs.readFileSync` ile okunan her satır
   (BOM strip edildikten sonra), `JSON.parse` denemeden, doğrudan `/[A-Za-z0-9çÇğĞıİöÖşŞüÜ:._-]+/g`
   deseniyle "token"lara bölünür. JSON yapısal karakterleri (`{`,`}`,`"`,`,`,`\`, boşluk, `%`,
   `@`, `/`) her zaman AYIRICI kabul edilir — bu, JSON'un ayrıştırılıp ayrıştırılamamasından
   (Y1 kök neden #2/#3: bozuk satır, tırnaksız dosya, kaçışlı tırnak hizalama kayması) TAMAMEN
   bağımsız TEK bir kod yolu demektir. Anahtar/değer ayrımı da yoktur (Y1 kök neden P8) — hepsi
   aynı token akışına girer.
2. **Her token, kapalı bir beyaz listeye karşı kontrol edilir** (`isApprovedToken`):
   - `ALLOWED_TOKENS`: mevcut 5 dondurulmuş fixture'ın (+ kasıtlı bozuk/bilinmeyen şema
     fixture'larının) ÜRETTİĞİ, elle enumere edilmiş ~57 sabit dize (JSON anahtarları, enum
     değerleri, onaylı Türkçe/İngilizce serbest metin sözcükleri, `workspace`/`ornek-proje` cwd
     bileşenleri). Script ile (`node tokenize.mjs`) gerçek fixture içeriğinden türetildi —
     elle tahmin edilmedi.
   - 7 dar YAPISAL desen: sentetik UUID (`00000000-0000-4000-8000-0000000000‹N›`), ISO zaman
     damgası, semver (`x.y.z`), sürücü harfi (`C:`), `:` + kısa sayı/`true`/`false`/`null`,
     `msg_example‹N›`, ve 1-3 haneli çıplak sayı (mevcut fixture'lardaki en yüksek `usage` değeri
     800 — 3 hane; bu üst sınır kasıtlı: 4+ haneli her sayı — telefon, TC kimlik, kredi kartı
     grupları, IBAN — otomatik reddedilir).
   - **Listede/desende olmayan HER token reddedilir** — sızıntı olup olmadığına bakılmaksızın.
     Yeni bir fixture yeni bir kelime eklerse bu listeye BİLİNÇLİ olarak eklenmesi gerekir (sürtünme
     kasıtlı, mevcut tasarımın devamı).
3. **`.gitattributes`** (fixture dizinindeki git kontrol dosyası, Türkçe düzyazı içeriyor) dosya
   ADIYLA (uzantıyla değil) tarama dışı bırakılır — tek istisna, tek satırlık, gerekçeli.

### 7.2 Neden bu tasarım "24 vektörün hiçbirini" geçirmiyor

Denylist yaklaşımının yenilgisi hep aynı şekildeydi: saldırgan **bilinen bir desenden farklı bir
biçim** buluyordu (URL-encode, ROT13, e-posta, alt çizgi, tırnaksız dosya, kaçışlı tırnak). Beyaz
listede bu fark ETMEZ: hangi biçimde gelirse gelsin, tokenizer'dan çıkan parça
`ALLOWED_TOKENS`'ta YA DA 7 desenden birinde değilse reddedilir. Sistem "bunu tanıyorum, kötü"
demiyor; "bunu tanımıyorum" diyor. QA'nın 24 vektörünün 20'si scratchpad script'iyle (bu turun
kod yazılmadan önceki doğrulaması) tek tek simüle edildi, hepsi reddedildi; kalan 4'ü (N4, N8,
N12, N13/N14) zaten daha zayıf/kontrol amaçlı sondalar ve aynı mekanizmaya tabi.

### 7.3 V2 — bağlantı kanıtı (tek mekanizma, yedek yok)

Eski tasarımın Y2 açığı ("beyaz liste katmanı 1124/1124 yeşil kalarak devre dışı bırakılabildi")
şuradan geliyordu: TC-kimlik regex'i gibi ÖRTÜŞEN bir başka mekanizma aynı sondayı yakalıyor,
beyaz liste kapatılınca fark edilmiyordu. Yeni tasarımda **TEK mekanizma var** (`isApprovedToken`)
— TC kimlik deseni, secret-prefix deseni, opak-blok deseni, yol deseni, ilgisiz-proje listesi
gibi eski ÖRTÜŞEN denylist parçalarının HİÇBİRİ kalmıyor. Bu, mutasyonun maskelenmesini
YAPISAL olarak imkânsız kılıyor: `isApprovedToken` her zaman `true` dönecek şekilde bozulursa
~30 sonda testinin NEREDEYSE TAMAMI aynı anda kırmızı olur (tek bir izole test değil). Bu turda
bunu bizzat uygulayıp (`isApprovedToken` gövdesini `return true` yapıp) `npx vitest run` ile
kırmızı sayısını ölçüp rapora yazacağım, sonra birebir geri alacağım.

### 7.4 V3 — M10/M11 için kaynak-şekli çiti kaldırılıyor, davranış çitiyle değiştiriliyor

QA'nın ölçtüğü S1/S3 senaryoları `transcript-reader.test.ts`'e GERÇEK `resolveAllowedTranscriptPath`
çağrılarıyla eklenecek (kaynak metnini okuyan `expect(source).toMatch(...)` testleri SİLİNECEK):

- **S1** — kök DIŞINDA + VAR OLMAYAN bir aday: `reason` KESİNLİKLE `outside-root` (M10 kaldırılırsa
  akış `not-found`'a düşer — QA'nın ölçtüğü fark).
- **S3** — `claudeProjectsRoot`'un KENDİSİ bir junction üzerinden verilir, adayı o junction'ın
  İÇİNDE (lexical olarak) ama gerçek hedefi (`realpathSync` sonrası) kökün DIŞINDA: `reason`
  KESİNLİKLE `outside-root` (M11 kaldırılırsa/`resolved` yerine `candidatePath` kullanılırsa
  `ok:true` döner — QA'nın ölçtüğü fark).

M6/M6b düzeltmesi ve M6+M11 birleşik testi (QA'nın kabul ettiği kısım) DOKUNULMAZ.

### 7.5 V4 — wiki 219/217 tutarsızlığı

`claude-transcript-formati.md`'ye her sayının HANGİ tarama anına ait olduğunu belirten notlar
eklenecek: `type` tablosu (217 dosya) round-1'in daha ERKEN taramasına ait; `version` tablosu
(219 dosya) round-2'nin daha SONRAKİ taramasına ait; QA'nın kendi bağımsız ölçümü (220 dosya,
~1 saat sonra) üçüncü, en geç an. Üçü de aynı büyüyen canlı oturumun farklı anlarındaki dürüst
enstantaneleri — çelişki değil, not eksikliğiydi.

### 7.6 Doğrulama

- `npx vitest run tests/features/thread/` — 5 fixture temiz + tüm QA sondaları (P1-P12, N1-N14
  eşdeğerleri) kalıcı regresyon olarak KIRMIZI'dan YEŞİL'e (yakalandı anlamında) döner.
- Manuel mutasyon: `isApprovedToken` → her zaman `true`, tüm suite kırmızı sayısı ölçülür, geri
  alınır. M10/M11 satırları tek tek kaldırılır, S1/S3 testleri KIRMIZI görülür, geri alınır.
  M-H (zararsız yeniden adlandırma) artık test edilmez çünkü kaynak-şekli çiti yok.
- `npm run verify` ve `npm run e2e` yeşil olmalı.
