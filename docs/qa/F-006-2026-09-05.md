KARAR: KALDI
ESKALE: false

# F-006 — yazma kapısı + sınır testleri · QA kod turu (qa-evaluator, 2026-09-05)

Kapsam: `docs/features/F-006-yazma-kapisi.md` (8 AC) · `docs/qa/F-006-contract.md`
(CEO onayı → CEO kararları → D29-D33 → A-G → gövde) · ADR-005 / ADR-013+ek / ADR-008+ek /
ADR-001 k.4 · `docs/02-architecture.md` §7,§10,§11.1,§11.4.
Ürün kodu **kalıcı değiştirilmedi**; her mutasyon `git checkout` ile geri alındı (kanıt en altta).

## Puanlar

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **7** | 28 yol-kaçışı + 28 HTTP denemesinde **tek bir delme başarılı olmadı**; disk üzerinde kök dışında hiçbir bayt değişmedi. Düşüren: `safeYamlValue` satır sonu içeren değeri tırnaklıyor ama **kaçırmıyor** → frontmatter bozulabiliyor (Ö2, ölçüldü). |
| Özellik bütünlüğü | **5** | AC3, AC5 ve AC7'nin **kanıt olarak gösterdiği çit ya yok ya da iddia ettiği şeyi taramıyor** (B1, B2, Ö3). AC7 adıyla saydığı `fs.write*` ailesini yakalamıyor. |
| Görsel/UX (doküman + hata mesajları) | **7** | F-006'nın UI'ı yok. Sözleşme/ADR metinleri örnek düzeyde net; hata mesajları Türkçe ve ayırt edici. Düşüren: NOT-2'nin (harf duyarlılığı) kullanıcıya dönen tek mesajı `İşlem, hedef yolla eşleşmiyor.` — teşhis edilemez; `KURULUM`/`docs` tarafında F-006 için hiçbir kullanıcı notu yok. |
| Kod kalitesi | **6** | Modülün kendisi temiz, fail-closed, atomik, yorumları doğru. Düşüren: yeni bir yazma yolunun **hata dalı çitsiz** (Ö1 — F-002 ve F-005'in bloklayıcısıyla aynı sınıf, ders `CLAUDE.md`'de iki kez yazılı), guard'ın **yorumu ile taradığı** ayrışıyor (B1 — F-005 dersi #6/#19'un birebir tekrarı). |

**Herhangi bir boyut < 7 → KALDI.** Bu bir güvenlik sınırıdır; kapsam daraltarak kapatılmamalıdır.

---

## 1. Komutlar — kendim çalıştırdım

| Komut | Çıkış kodu | Sonuç |
|---|---|---|
| `npm run verify` | **0** | typecheck + lint + `Test Files 41 passed (41)` / `Tests 539 passed (539)` + `vite build ✓ 961ms` |
| `npm run e2e` | **0** | `15 passed (15.5s)` |
| `npm run e2e:dev` | **0** | `1 passed (3.5s)` |
| `npm audit` / `npm audit --omit=dev` | 0 | `found 0 vulnerabilities` |

**Sapma:** developer ve `docs/progress.md` **538** test bildiriyor, gerçek sayı **539** (N3).

---

## 2. AC1-AC8 kanıt tablosu

| AC | Durum | Bağımsız kanıt |
|---|---|---|
| **AC1** üç hedef beyaz listesi | ✅ | `write-gate.ts:22-30` `OPERATION_PATTERNS` + `:112-116` adım 8. Kendi harness'ımla 13 dosya-adı + 9 kapı-adı + 8 symlink/junction varyantı denendi (§5): **0 kaçış**, kök dışı diskte hiç değişmedi. |
| **AC2** genel `write()` yok, 4 niyet fonksiyonu | ✅ | `write-gate.test.ts:35-39` `Object.keys(...).sort() → toEqual`. Dosyada başka `export` yok (`grep -c '^export' = 5`, biri `type WriteResult`). |
| **AC3** silme/`unlink` yok | ❌ **B2** | Kod doğru (`archiveDenial` yalnızca `renameSync`, `write-gate.ts:324`; `unlinkSync` yalnızca kendi `.tmp`'si, `:158`). **Ama hiçbir çit yok:** `setFeatureStatus`'a gerçek bir `fs.unlinkSync(resolved.targetPath)` silme yeteneği ekledim → **539/539 YEŞİL**. Feature notunun kanıt olarak gösterdiği `no-write-gate-bypass.test.ts` bu dosyayı **dosya-seviyesinde muaf tutuyor** (`:54,:62`), `no-delete-guard.test.ts:28-29` ise yalnızca `src/features/projects` + `src/server/watch` tarıyor. |
| **AC4** izinsiz yol / `..` / symlink / kök dışı reddi | ✅ | §5'teki 28 deneme + `write-gate.test.ts` beyaz liste tablosu + zorunlu `vi.spyOn(lstatSync)` testi. Junction'lı ata dizin (C2/C3/C7) gerçek diskte reddedildi. |
| **AC5** yol işlemleri `node:path` ile, elle regex yok | ⚠️ **Ö3** | Kod uyuyor (`path.join/relative/dirname/basename` dışında elle ayraç birleştirme yok). Ama AC'nin parantez içindeki şartı — “**statik tarama testi doğrular**” — **uygulanmamış**: `DENIED` listesi (`no-write-gate-bypass.test.ts:26-52`) yalnızca fs çağrı desenleri içeriyor, yol/regex ile ilgili tek desen yok. |
| **AC6** manifest diff'i | ✅ | `write-gate-manifest.test.ts` İDDİA A-E. Mutasyonum **MQ6** (`sha256` sabitlendi → içerik değişikliğine körleştir) **2 test KIRMIZI** verdi → manifest gerçekten ölçüyor. |
| **AC7** statik tarama: `src/`'te `fs.write*` yok | ❌ **B1** | Tarama, AC'nin **adıyla saydığı** `fs.write*` ailesinin bir kısmını yakalamıyor (aşağıda 7 kaçak, ölçüldü). |
| **AC8** atomik yazma (tmp+rename) | ✅ | `atomicWriteOnce` `:132-163` (`openSync 'wx'` + `fsync` + `renameSync`, `finally`'de tmp temizliği). MQ8 (`renameSync` → doğrudan `writeFileSync`) **KIRMIZI**. Ayrıca C6'da (dış dosyaya **hardlink**) yazma başarılı oldu ama **dış dosya değişmedi** — atomik rename dizin girdisini değiştirdiği için; atomikliğin güvenlik değeri ampirik olarak görüldü. |

---

## 3. Fazlalık iddiasının denetimi (görev maddesi 3)

Developer'ın iddiası: *“adım 8'in işlem/yol regex'i, adım 6/3'ün reddedeceği her girdiyi bağımsız
olarak zaten reddediyor; mutasyon 1/2/10 gap değil, mimari fazlalık.”*

**İddia DOĞRU. Kabul ediyorum — ama gerekçesi developer'ın yazdığından daha güçlü ve tek adımı
(mutasyon 10'un “geometrik olarak mümkün değil” cümlesi) yanlış nedenle doğru.**

Ölçüm (gerçek diskte junction kurup dört senaryo, her seferinde diskte ne olduğu ölçüldü):

| Mutasyon | C1 hedef junction | C2 `docs/features`→junction | C3 `docs`→junction | C7 `archive`→junction | Dış dizin değişti mi |
|---|---|---|---|---|---|
| (yok, sağlam kod) | adım 2 reddetti | adım 3 | adım 3 | adım 3 | **hayır** |
| **adım 3 kaldırıldı** | adım 2 | **adım 6** | **adım 6** | **adım 6** | hayır |
| **adım 6 kaldırıldı** | adım 2 | adım 3 | adım 3 | adım 3 | hayır |
| **adım 3 + 6 birlikte kaldırıldı** | adım 2 | **adım 8** | **adım 8** | **adım 8** | hayır |
| **adım 8 kaldırıldı, 3/6 duruyor** | adım 2 | adım 3 | adım 3 | adım 3 | hayır |
| **adım 2 + 3 + 6 hep birlikte kaldırıldı** | **adım 8** | **adım 8** | **adım 8** | **adım 8** | hayır |

Yani developer'ın koşmadığı birleşik mutasyon (3+6, hatta 2+3+6) **koşuldu ve savunma tuttu**.

**Adım 8'i atlatan ama 6/3'ün yakalayacağı bir girdi arandı, bulunamadı — ve bulunamayacağının
yapısal nedeni var:** `targetPath = path.join(resolvedAnc, path.relative(anc, candidate))`
(`write-gate.ts:110`); `anc`, `candidate`'ın bir atası olduğu için ek parça `..` içeremez, dolayısıyla
`resolvedAnc` kök dışındaysa `targetPath` de kök dışındadır ve adım 8'in `path.relative(root,…)`
değeri ya `..` ile başlar ya mutlaktır → çapa (`^docs/…$`) hiçbir hâlde tutmaz. Denenen varyantlar:
ters bölü, çift ayraç, sondaki ayraç, `.`/`..` segmentleri, `\\?\` ve UNC önekleri, sürücü kökü,
harf farkı, `...md`/`..md`, Türkçe `İ` — hepsi §5'te, hepsi reddedildi.

**Ama iki düzeltme:**
1. Developer'ın mutasyon 10 gerekçesi (“kök dışına TAM olarak `docs/features` adıyla çıkan senaryo
   *geometrik olarak mümkün değil*”) yanlış argüman: mümkün olmama nedeni ad benzerliği değil,
   `path.relative`'in **kök referanslı** olması. Sonuç aynı, gerekçe hatalı — sözleşmeye doğru
   gerekçe yazılmalı ki gelecekte adım 8 gevşetilirken yanlış güvenle silinmesin.
2. Fazlalığın kabul edilen bedeli açıkça yazılmalı: **adım 3 ve adım 6'nın bugün sıfır bağımsız
   test kapsaması var.** Buna ek olarak benim MQ1 mutasyonum (ata döngüsü **yalnızca son ata**
   segmentini kontrol etsin) da **539/539 YEŞİL** kaldı — yani döngünün üst segmentleri de çitsiz.
   Kodda kalmaları doğru karar (savunma katmanı çoğaltması); çitsizliğin **rapora yazılması** şart.

---

## 4. Kendi mutasyon tablom (developer'ın 20'si tekrarlanmadı)

Yöntem: mutasyon uygulandı → `npx vitest run` (539 test) → sonuç → `git checkout -- <dosya>`.

| # | Hedef (görev maddesi 4) | Mutasyon | Sonuç | Not |
|---|---|---|---|---|
| **MQ1** | symlink savunması, **ata segmentleri** | `for (i=0; i<len-1)` → `for (i=len-2; i<len-1)` (yalnızca son ata `lstat`lenir) | **YEŞİL 539/539** | Üst ata segmentleri çitsiz (§3'e bakınız). |
| **MQ2** | içerik tipi allowlist, `;` ayrıştırması | `raw.split(';')[0]` → `raw.trim().toLowerCase()` | **KIRMIZI 1** | `application/json; charset=utf-8 → dispatch` testi düştü — doğru yön (charset'li istek **kalmalı**). |
| **MQ3** | `x-mc-write` dağıtıcı genelliği | kontrol yalnızca `pathname === '/api/projects'` için | **KIRMIZI 1** | `DELETE /api/projects/:id — header yok → 403` düştü → genellik gerçekten çitli. |
| **MQ4** | “asla fırlatmaz” | `archiveDenial`'daki `mkdirSync`+`renameSync` `try` **dışına** | **YEŞİL 539/539** | **Ö1 — bulgu.** Ayrıca ampirik: `docs/approvals/archive` yolu bir **dosyayla** işgal edilince sağlam kod `write_failed` döndürüyor, mutasyonlu kod `EEXIST` **fırlatıyor**. Hiçbir test bunu ölçmüyor. |
| **MQ5** | `OPERATION_PATTERNS` gevşetme | `archive` deseni → `^docs\/approvals\/archive\/.*$` | **YEŞİL 539/539** | **Ö4 — bulgu.** Desen yalnızca “fazla dar” yönünde çitli (developer mutasyon 19); dosya-adı bileşeni ölçülmüyor. |
| **MQ6** | manifest, içerik değişikliği yakalama | `sha256: sha256File(full)` → `sha256: 'SABIT'` | **KIRMIZI 2** | Manifest gerçekten içerik ölçüyor. |
| **MQ7** | `featureStatus` deseni gevşetme | `[A-Za-z0-9._-]+` → `.+` | **KIRMIZI 10** | Güçlü kapsama. |
| **MQ8** | atomiklik | `renameSync(tmp,target)` → `writeFileSync(target,data)` | **KIRMIZI 1** | AC8 çitli. |
| **MQ9** | `basename` kontrolü | `FILE_NAME_PATTERN.test(f) \|\| basename(f)!==f` → yalnız regex | **YEŞİL 539/539** | Gerçekten fazlalık (`[A-Za-z0-9._-]+` zaten `/` ve `\` kabul etmiyor) → NOT. |
| **MQ10** | AC3 çiti | `setFeatureStatus` içine gerçek `fs.unlinkSync(resolved.targetPath)` silme yolu | **YEŞİL 539/539** | **B2 — bloklayıcı.** |
| **MQ11-15** | adım 2/3/6/8 birleşimleri | §3'teki tablo | — | Fazlalık iddiasının denetimi. |

**Yeşil kalan (ölçmeyen test):** MQ1, MQ4, MQ5, MQ9, MQ10 (+ statik tarama kaçakları, §6).

---

## 5. Delme denemeleri — yol kapısı (görev maddesi 5)

Harness: `scratchpad/pen1.mts` + `pen2.mts`, gerçek `fs`, her denemede **kök içi ve kök dışı dizin
ayrı ayrı sha256'landı**; “diskte ne oldu” dönen koddan bağımsız ölçüldü. Gerçek proje klasörlerine
hiç dokunulmadı; tüm fixture'lar sonda silindi (10 dizin).

| Deneme | Dönen | **Diskte ne oldu** |
|---|---|---|
| `fileName='../../../src/index.ts'` / `'..\\..\\src\\index.ts'` / `'../src/index.ts'` | `invalid_body` | değişiklik yok |
| `fileName='F-001.md/'` · `'F-001.md '` (sondaki ayraç/boşluk) · `'.\\F-001.md'` | `invalid_body` | değişiklik yok |
| `fileName='C:/Windows/temp/x.md'` · `'\\\\?\\C:\\x.md'` (UNC/uzun yol) · `'\\\\localhost\\C$\\x.md'` | `invalid_body` | değişiklik yok |
| `fileName='F-001.MD'` (harf farkı) | `invalid_body` | değişiklik yok |
| `fileName='f-001.md'` (harf farkı, küçük) | `ok:true` | **`docs/features/F-001.md` yazıldı** — Windows harf duyarsızlığı, beyaz liste **dışına çıkmadı**; kabul edilebilir |
| `fileName='...md'` / `'..md'` | `write_failed (ENOENT)` | değişiklik yok |
| kapı `G9` · `g2` · `'G2 '` · `'G2/../../src/index'` · `'../G2'` · `G2-1000` · `G2İ` | `invalid_body` | değişiklik yok |
| kapı `ASSETS` · `G0-999` | `ok:true` | beyaz liste içinde, ADR-005 ile uyumlu |
| **C1** `docs/features/F-001.md` → **junction**(kök dışı) | `write_denied: Hedef bir sembolik bağlantı.` | dış dizin **değişmedi** |
| **C2** `docs/features` → **junction**(kök dışı) | `write_denied: Bir ata dizin sembolik bağlantı.` | dış dizin **değişmedi** |
| **C3** `docs` → **junction**(dış `docs` klonu) | `write_denied: Bir ata dizin…` | dış `F-001.md` **birebir aynı** kaldı (içeriği okundu) |
| **C7** `docs/approvals/archive` → **junction**(kök dışı) | `write_denied: Bir ata dizin…` | dış dizin **değişmedi** |
| **C4/C5** dosya-symlink (dangling / var olan) | `EPERM` — bu makinede yönetici/Geliştirici Modu olmadan **kurulamıyor** (QA tur 2 ölçümüyle aynı) | — |
| **C6** `G2.ok` = dış dosyaya **hardlink** | `ok:true` | **dış dosya DEĞİŞMEDİ** — `tmp+rename` dizin girdisini değiştirdi; hardlink kopmuş oldu |
| **C8** `root` parametresi realpath'lenmemiş junction yolu | `write_denied: Hedef kök dışında.` | değişiklik yok (fail-closed) |
| **A1** `docs/approvals/archive` yolu bir **dosya** | `write_failed (EEXIST)` | değişiklik yok |
| **A3** hedef bir **dizin** | `write_failed (EISDIR)` | değişiklik yok |
| **A4** `docs/approvals` bir **dosya** | `write_failed (EEXIST)` | değişiklik yok |
| **A6** `nextStatus='done\nowner: hacker'` | `ok:true` | dosya `status: "done⏎owner: hacker"` oldu — YAML katlaması sayesinde **tek değer**, zararsız |
| **A7** `nextStatus='x\n---\nBODY'` | **`ok:true`** | **dosya bozuldu:** `---⏎status: "x⏎---⏎BODY"⏎---⏎body` → frontmatter ilk `---`'da kapanıyor, `status: "x` **kapanmamış tırnak** = ayrıştırılamaz YAML (**Ö2**) |

**Sonuç: yol kapısında geçen tek bir delme denemesi olmadı.** Kök dışında hiçbir bayt değişmedi.

## 6. Delme denemeleri — `x-mc-write` + içerik tipi zinciri (görev maddesi 6)

Harness: `scratchpad/pen3.mjs` — gerçek sunucu (`tsx src/server/index.ts`, `MC_PORT=7461`,
izole `MC_DATA_DIR`), 28 istek, her istekten sonra **olay dosyaları ve `projects.json` diskte sayıldı**.

| İstek | Kod | Diskte |
|---|---|---|
| `/api/events` `content-type: application/json` (**hook'un `send-event.cjs:153` biçimi birebir**) | 202 | **olay yazıldı** ✅ kurulu hook'lar kırılmıyor |
| `application/json; charset=utf-8` · `APPLICATION/JSON` · `"  application/json  "` · `application/json;;;` | 202 | olay yazıldı (allowlist normalize ediyor) |
| `text/plain` · `multipart/form-data` · `application/x-www-form-urlencoded` · **başlıksız** | 400 | yazılmadı |
| `text/plain` **+ `x-mc-write: 1`** (zincir karışımı) | 400 | yazılmadı — muafiyet dalı `x-mc-write` ile atlanamıyor |
| `/api/events/` (sondaki eğik çizgi) `text/plain` | 403 | yazılmadı |
| `/api/events?x=1` `text/plain` | 400 | yazılmadı |
| `/api/%65vents` `text/plain` | 403 | yazılmadı |
| `//api/events` (çift eğik) `text/plain` | 404 | yazılmadı — **ama koruma bloğu hiç çalışmıyor**, `serveStatic`'e düşüyor (N4) |
| `POST /api/projects` başlıksız · `x-mc-write: 0` · `x-mc-write: ''` · `x-mc-write: 1,1` (çift başlık) | 403 | değişmedi (fail-closed) |
| `POST /api/projects` `x-mc-write: 1` · `X-MC-WRITE: 1` | 400 | dispatch edildi (başlık engellemedi; büyük harfli başlık adı da çalışıyor) |
| `DELETE` / `PUT` / `PATCH` `/api/projects/abc` başlıksız | 403 | değişmedi |
| `HEAD` / `OPTIONS` `/api/events` başlıksız | 403 | değişmedi — **preflight kabul edilmiyor**, ADR-013'ün CORS gerekçesi ayakta |
| `POST /api/events` `Origin: http://evil.example` | 403 | yazılmadı |
| `POST /api/events` `Host: evil.example` | 403 | yazılmadı |
| `GET /api/health` başlıksız | 200 | okuma yolu regresyonu yok |

**Sonuç: zincirde delme yok.** ADR-013'ün beş parçası (allowlist, `;` öncesi, küçük harf,
başlıksız=red, tek yer/dağıtıcı) çalışıyor.

---

## 7. Bulgular

| # | Şiddet | Dosya:satır | Bulgu / tekrar üretme / beklenen vs. gerçek |
|---|---|---|---|
| **B1** | **BLOKLAYICI** | `tests/no-write-gate-bypass.test.ts:26-52` | **AC7'nin statik taraması, AC'nin adıyla saydığı `fs.write*` ailesini yakalamıyor.** Tekrar üretme: taranan bir dosyaya (`src/server/index.ts`) tek satır ekle → `npx vitest run tests/no-write-gate-bypass.test.ts`. Yakalanmayanlar (ölçüldü, hepsi **40/40 YEŞİL**): `fs.open(p,'w',cb)` + `fs.write(fd,…)` (**tam işlevsel bir yazma yolu**), `fs.writevSync(`, `fs.promises.rm(`, `fs.rmdir(`, `fs.promises.rmdir(`, `fs.symlinkSync(`, `fs.linkSync(`. Yakalananlar: `fs.writeFileSync(`, `fsp.writeFile(`. **Beklenen:** `fs.write*` ailesinin tamamı yakalanır. **Gerçek:** `fs.write(`/`fs.writev(`/`fs.writevSync(` listede yok. Ayrıca `'fs.rm('` (satır 39) listedeki **tek nesne-önekli** desen — `fsp.rm(`/`promises.rm(` bu yüzden kaçıyor; `CLAUDE.md`/QA hafızasındaki F-005 D28 dersinin (“daraltılan çitin desen DIŞINDA kalan en yakın eşdeğer API'si”) birebir tekrarı. Testin adı da (`… yasak dosya sistemi çağrısı içermiyor`) taradığından geniş iddia ediyor. |
| **B2** | **BLOKLAYICI** | `docs/features/F-006-yazma-kapisi.md` AC3 · `tests/no-write-gate-bypass.test.ts:54,62` · `tests/features/projects/no-delete-guard.test.ts:28-29` | **AC3 (“silme/`unlink` işlevi yok”) tamamen çitsiz ve AC'nin gösterdiği kanıt yanlış.** Tekrar üretme: `write-gate.ts` `setFeatureStatus` içine `if (nextStatus === '__purge__') { fs.unlinkSync(resolved.targetPath); return { ok: true, path: resolved.targetPath } }` ekle → `npx vitest run` → **539/539 YEŞİL**. **Beklenen:** yazma kapısının silme yeteneği kazanması en az bir testi kırar. **Gerçek:** `write-gate.ts` statik taramanın TEK dosya-seviyesi istisnası, `no-delete-guard` ise `src/server/`'ı hiç taramıyor → tek yazma yetkilisi modülün “silmez” özelliği hiçbir katmanda ölçülmüyor. |
| **Ö1** | ÖNEMLİ | `src/server/write-gate.ts:322-327` | **“Asla fırlatmaz” garantisi `archiveDenial` için çitsiz.** MQ4: `mkdirSync`+`renameSync` `try` dışına → 539/539 YEŞİL. Ampirik kanıt: `docs/approvals/archive` yolu bir dosyayla işgal edilince sağlam kod `write_failed (EEXIST)` döndürüyor, mutasyonlu kod **fırlatıyor**. F-007 bu fonksiyonu bir handler'a bağladığı gün F-002/F-005'in süreç-öldüren bloklayıcısı tekrarlanır. Developer mutasyon 12 ile `atomicWriteOnce`'ın aynı sınıfını fark edip test ekledi ama **`archiveDenial`'ın ikinci `mkdirSync`'i atlandı**. |
| **Ö2** | ÖNEMLİ | `src/server/write-gate.ts:184-189` (`safeYamlValue`) + `:256` | **Satır sonu içeren `nextStatus` tırnaklanıyor ama kaçırılmıyor → frontmatter bozulabiliyor.** Tekrar üretme: `setFeatureStatus(root,'F-001.md','x\n---\nBODY',hash)` → **`ok:true`**, dosya `---⏎status: "x⏎---⏎BODY"⏎---⏎body` oluyor; standart bir frontmatter okuyucu ilk `---`'da kapatır ve `status: "x` **kapanmamış tırnak** = ayrıştırılamaz YAML. Sözleşme §3 madde 5 (s.369-371) bu riski **adıyla öngörmüş** (“`safe()` bir satır sonu içeren değeri tırnaklamayı kaçırırsa dizi uzar”) ama 17 golden fixture'ın hiçbiri `nextStatus`'a satır sonu **beslemiyor** → çit hiç ateşlenmiyor. Düzeltme tek satır (`\r`/`\n`'i `\\n`'e kaçır) + bir fixture. |
| **Ö3** | ÖNEMLİ | `docs/features/F-006-yazma-kapisi.md` AC5 · `tests/no-write-gate-bypass.test.ts:26-52` | **AC5'in “(statik tarama testi doğrular)” şartı uygulanmamış.** `DENIED` listesinde yol/ayraç/regex ile ilgili tek desen yok; feature notunun AC5 kanıtı olarak gösterdiği “DENIED listesi + çağrı-biçimli tarama” bu iddiayı taramıyor. AC'yi ya çitle ya da metnini “elle inceleme ile doğrulandı”ya düzelt — mevcut hâli yanlış güven üretiyor. |
| **Ö4** | ÖNEMLİ | `src/server/write-gate.ts:28-29` | **`OPERATION_PATTERNS.archive` yalnızca “fazla dar” yönünde çitli.** MQ5: desen `^docs\/approvals\/archive\/.*$`'e gevşetildi → 539/539 YEŞİL. Developer mutasyon 19 deseni daraltıp KIRMIZI aldı; gevşetme yönü ölçülmüyor. Bugün ad üreteci iç (saldırgan kontrolü yok) olduğu için etki sınırlı, ama R1'in (arşiv deseni ↔ ad üreteci ayrışması) tekrar kaçmasına açık kapı bırakıyor. |
| **Ö5** | ÖNEMLİ | `src/server/write-gate.ts:78-86` | **Ata-dizin `lstat` döngüsünün üst segmentleri çitsiz.** MQ1 (döngü yalnızca son atayı kontrol etsin) → 539/539 YEŞİL. Kod doğru, savunma çalışıyor (§5 C3 ölçüldü), eksik olan **çit**. §3'teki fazlalık analizi gereği bugün adım 8 kurtarıyor; adım 8 bir gün gevşerse bu yeşil mutasyon gerçek bir açığa döner. |
| **N1** | NOT | `docs/progress.md` son bölüm | Bildirilen test sayısı **538**, gerçek **539**. |
| **N2** | NOT | `src/server/index.ts:308` | `//api/events` (çift eğik çizgi) `pathname.startsWith('/api/')` önekini kaçırıyor → Host/Origin/`x-mc-write` bloğunun **tamamı atlanıyor** ve istek `serveStatic`'e düşüyor (ölçüldü: 404, disk değişmedi). Hiçbir yazma rotası bu yolla erişilebilir değil (rota eşleşmesi tam eşitlik) ve statik salt-okunur, ama korumanın önek tabanlı olması yeni bir rota deseni eklendiğinde sessizce delinir. |
| **N3** | NOT | `src/server/write-gate.ts:312,324` | `archiveDenial` arşiv adını milisaniye damgasıyla üretiyor; aynı milisaniyede ikinci bir arşivleme aynı adı üretir ve `renameSync` Windows'ta **sessizce üzerine yazar** (ilk red gerekçesi kaybolur). Ölçüldü: ardışık iki çağrı farklı ms aldı, çakışma tetiklenmedi; test yok. |
| **N4** | NOT | `tests/helpers/manifest.ts:33-42` | `walk` yalnızca `entry.isFile()` alıyor; bir dosya **symlink/junction'a dönüştürülürse** manifestten sessizce düşer (`isFile()===false`). “İzin verilmeyen hiçbir dosya değişmedi” iddiası bu dönüşüme kör. |
| **N5** | NOT | `src/server/write-gate.ts:114-115` | NOT-2'nin (harf duyarlılığı, CEO “yapmıyoruz” dedi — sözleşme §9 risk 5) kullanıcıya dönen tek mesajı `İşlem, hedef yolla eşleşmiyor.`. `Docs/Features` gibi büyük harfli bir proje dizininde **her yazma** bu mesajla sessizce reddedilir ve teşhis edilemez. Karar doğru; mesaja/logs'a bir ipucu eklenmesi ucuz. |

---

## 8. F-005 regresyon denetimi (görev maddesi 7)

`git diff 614ced1..HEAD -- tests/integration/projects-api.test.ts
tests/features/projects/web/SettingsScreen.test.tsx tests/e2e/settings.spec.ts`:

- 15 çağrı sitesine `'x-mc-write': '1'` **eklendi**; başka hiçbir satır anlamca değişmedi
  (silinen satırların tamamı eklenenlerin başlıksız hâli).
- **Değişen tek beklenti:** `SettingsScreen.test.tsx:102-105`
  `expect(fetchMock).toHaveBeenCalledWith('/api/projects/p_1', { method: 'DELETE' })` →
  `{ method: 'DELETE', headers: { 'x-mc-write': '1' } }`.
  Bu, feature notunun **İkinci genişletme** bölümünde CEO tarafından adıyla önceden onaylanmış
  (“`SettingsScreen.test.tsx` (1 assert)”) ve `writeFetch`'in istemci davranışının doğrudan
  yansıması — F-005'in **ürün** davranışı değişmedi.
- Durum kodu, hata mesajı, banner metni, manifest assert'i, satır sayısı iddiası: **hiçbiri değişmedi**.
- E2E `settings.spec.ts` 6 testi ve `projects-api.test.ts` bütünüyle yeşil.

**Sonuç: koruma F-005'in davranışını bozmadı.** ✅

## 9. Kapsam denetimi (görev maddesi 9)

`git diff 9521443..HEAD --stat`: 17 dosya. Ürün kodu yalnızca `src/server/write-gate.ts` (yeni),
`src/server/index.ts` (+31, dağıtıcı kontrolü), `src/web/lib/write-fetch.ts` (yeni, 14),
`src/shared/types.ts` (+9, iki sabit), `src/features/projects/web/useProjects.ts` (+5, iki çağrının
`writeFetch`'e geçirilmesi). **Yeni ekran/sekme/düğme/rota YOK** — F-006 arayüz yazmadı. ✅
Dosya sahipliği, feature notundaki iki CEO genişletmesiyle birebir örtüşüyor.

## 10. ADR-013 ↔ ADR-008 taahhüdü (görev maddesi 10)

ADR-008 eki: *“F-006 bu kararı yeniden değerlendirmek ZORUNDADIR (etkin porta bağlama, token veya
eşdeğeri).”* **Kapanmıştır** — ve gerçekten kapanmıştır, kâğıt üzerinde değil:

- ADR-013 ana kararı tüm non-GET `/api/*` için özel başlık zorunlu kılıyor; reddedilen alternatifler
  (tam origin eşleştirmesi, token) gerekçeli. Dağıtıcı seviyesinde **tek yerde** (`index.ts:321-335`),
  route dispatch'ten **önce** — F-003'ün `/api/stream` dersinin doğru uygulaması.
- `POST /api/events` istisnası **artık riski kapatıyor**: `application/json` CORS güvenli listesinde
  **değil** → çapraz kaynaklı bir tarayıcı isteği preflight gerektirir; ölçtüm: `OPTIONS /api/events`
  **403** ve yanıtta CORS başlığı yok → preflight geçmez. Güvenli listedeki üç tip (`text/plain`,
  `application/x-www-form-urlencoded`, `multipart/form-data`) ve **başlıksız** istek de 400 alıyor
  (ölçüldü). Yani ADR-008'in “aynı makinedeki başka bir yerel **sayfa**” riski hem yazma uçlarında
  hem olay ucunda kapalı.
- Kalan ve **bilinçli** artık risk (sözleşme D6): tarayıcı olmayan yerel bir süreç her iki başlığı da
  gönderebilir — ama o süreç zaten doğrudan diske yazabilir; tehdit modeli dışında. Doğru sınır.

**Açık kalan yön yok.** ADR-013'ün ek bölümü hook'un tam biçimini `send-event.cjs:153` referansıyla
doğruluyor; ben de gerçek sunucuya o biçimle POST atıp olayın diske yazıldığını gördüm.

---

## 11. Temizlik kanıtı

- `git diff HEAD` → **boş**; `git status --porcelain` → **boş** (rapor yazımından önce ölçüldü).
  Uygulanan 15 mutasyonun tamamı `git checkout -- <dosya>` ile geri alındı.
- Portlar: `netstat -ano | grep -E "7333|7334|7335|7433|7434|7461"` → **hiç satır yok**
  (TIME_WAIT dahil temiz). Test sunucum 7461'de koştu ve `SIGTERM` ile kapatıldı.
- Süreçler: `tasklist` → 2 `node.exe`; `Win32_Process` ile komut satırları okundu, **ikisi de
  Playwright MCP** (pid 6356, 14820) — yetim `npm run dev`/`tsx` ağacı **yok**.
- Delme fixture'ları yalnızca `os.tmpdir()` altındaki geçici dizinlerde kuruldu, **gerçek proje
  klasörlerine yazılmadı**; sonda `fs.rmSync` ile 10 dizin silindi.

---

## 12. KALDI'yı kapatmak için istenenler

1. **B1** — `DENIED` listesine en az `write(`, `writev(`, `writevSync(`, `open(`, `rm(`, `rmdir(`,
   `symlink(`, `symlinkSync(`, `link(`, `linkSync(` ekle; `'fs.rm('` desenini nesne-önekinden
   arındır (liste tutarlılığı). Her yeni desen için `grep -rn` ile yanlış-pozitif taraması yap
   (R4'ün emsali) ve `it.each` kalıcı negatif-kontrol satırlarına ekle. Testin adını taradığıyla
   birebir aynı iddiaya indir.
2. **B2** — AC3 için gerçek bir çit: `write-gate.ts`'i dosya-seviyesi muafiyetten çıkarıp
   `STORE_FILES` desenindeki gibi **dizge-seviyesi izinli tam-çağrı kümesine** taşı
   (`fs.unlinkSync(tmp)` izinli, başka `unlink*`/`rm*` değil). Mutasyon: `setFeatureStatus`'a
   silme yolu ekle → KIRMIZI görülsün.
3. **Ö1** — `archiveDenial`'ın `mkdirSync`+`renameSync`'i için `expect(...).not.toThrow()` testi
   (`docs/approvals/archive` bir dosyayla işgal edilmiş fixture'ı); mutasyonla KIRMIZI gösterilsin.
4. **Ö2** — `safeYamlValue` satır sonlarını kaçırsın (`\n`→`\\n`, `\r`→`\\r`); satır sonu içeren
   `nextStatus` için bir golden fixture ekle (mevcut `parts.length` eşitlik assert'i onu yakalar).
5. **Ö3** — AC5'i ya çitle (yol/ayraç deseni taraması) ya da AC metnindeki “statik tarama testi
   doğrular” ifadesini gerçeğe uydur.
6. **Ö4** — `OPERATION_PATTERNS.archive`'ın **gevşetme** yönü için mutasyon/test ekle.
7. **Ö5** — ata-dizin döngüsünün **üst** segmenti için izole bir test (adım 8'i geçen, yalnızca
   adım 3'ün yakaladığı bir fixture kurulamıyorsa, `vi.spyOn(lstatSync)` ile çağrı sayısı assert'i).
8. **N1-N5** — belgesel/ucuz; kapanışta not düşülmesi yeterli, ayrı tur gerektirmez.
9. Sözleşmenin “Mutasyon kanıtı” tablosunda **mutasyon 10'un gerekçesi** düzeltilsin (§3): sebep
   “geometrik imkânsızlık” değil, `path.relative`'in kök referanslı olması; ve adım 3/6'nın
   **sıfır bağımsız kapsaması olduğu** açıkça yazılsın.
