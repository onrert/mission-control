---
feature: F-006
title: Yazma kapısı + sınır testleri
author: developer
status: draft
date: 2026-09-05
revision: tur 3 (QA tur 2 doğrulamasına göre düzeltildi — 1 bloklayıcı + 3 önemli + 1 kısmi + 2 not kapatıldı)
---

# F-006 Sözleşmesi — yazma kapısı + sınır testleri

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").

Kaynaklar: `docs/features/F-006-yazma-kapisi.md` (8 AC + dosya sahipliği + CEO'dan devralınan
taahhüt, **bağlayıcı**), `docs/02-architecture.md` §6.1/§6.2/§6.6 (API zarfı, hata kodları,
`watchers`), §7 (yazma kapısı, §7.1/§7.2/§7.3), §10 (Host/Origin/CSRF), §11.4 (sınır testleri),
`docs/decisions/ADR-005` (yazma kapısı ve tehdit modeli), `ADR-013` (yazma uçlarında özel başlık
zorunluluğu — bu turda CEO'dan doğrudan geldi), `ADR-008` + eki (Host/Origin port kararı ve
F-006'nın yeniden değerlendirme yükümlülüğü — ADR-013 bunu kapatıyor), `ADR-001` karar 4/6/7,
`docs/01-prd.md` F4 (AC1-AC9), `docs/qa/F-005-contract.md` (biçim örneği, manifest/no-delete-guard
emsali), `CLAUDE.md` (Karpathy kuralları + Öğrenilen kurallar).

Mevcut kod okunarak doğrulandı (✓ VERIFIED): `src/server/index.ts` (dağıtıcı, `withDispatchError
Boundary`, `isAllowedHost`/`isAllowedOrigin`, `sendForbidden`, route sırası), `src/server/store/
projects-registry.ts` (atomik yazma emsali, `unlinkSync(tmpPath)` istisna deseni),
`src/features/projects/server/{validate-path,handlers,service}.ts`, `src/features/projects/web/
useProjects.ts` (mevcut `fetch('/api/projects', …)` çağrıları — ADR-013 sonrası header eklemesi
gerekecek çağrı siteleri), `tests/features/projects/no-delete-guard.test.ts` (F-006'nın genel guard
öncülü, dizge-seviyesi istisna dersi), `tests/helpers/temp-data-dir.ts` (helper stil emsali).

Bu turda `src/`, `tests/`, `scripts/`, `.claude/`, `.github/` altında **hiçbir dosya
değiştirilmedi**; yalnızca bu sözleşme metni yazıldı. `git status` bunu doğrular.

---

## 1. Kapsam

**İçinde:**

1. `src/server/write-gate.ts` — izlenen projelere yazan **tek** modül. Dört niyet fonksiyonu:
   `setFeatureStatus`, `writeGateApproval`, `writeGateDenial`, `archiveDenial` (feature notunun
   birebir adlandırması — mimari §7.1'in taslak imzası `patchFeatureStatus` diyor ama mimari
   satır 491 açıkça "ÖRNEK imza taslağı — nihai kod developer'ın" diyor; feature notu
   `docs/features/F-006-yazma-kapisi.md:15` bağlayıcı, o yüzden `setFeatureStatus` kullanılıyor).
2. `tests/helpers/manifest.ts` — `(göreli yol, boyut, sha256)` üçlüsü üreten özyinelemeli dizin
   anlık görüntüsü (F-005'in aynı ismi taşıyan ama `mtimeMs` de içeren iç yardımcısının **genel
   amaçlı, paylaşılan** hâli — F-005 bunu `tests/integration/projects-api.test.ts` içine gömmüştü,
   ayrı dosya değildi; bu turda tekrar kullanılabilir hâle getiriliyor, bkz. §2 not).
3. Yol beyaz listesi + symlink/traversal reddi (§3 madde 3, §6).
4. Atomik yazma (tmp+rename), tüm hata yollarında `.tmp` temizliği (§3 madde 4).
5. Statik tarama testi — yazma kapısı dışında `fs.write*`/`fs.promises.write*`/`appendFile*`/
   `rename*`/`mkdir*` çağrısı yok (§6).
6. Manifest testi — tam kullanıcı akışından sonra izin verilenler dışında hiçbir dosya
   değişmemiş (§6).
7. **ADR-013 uygulaması** — dağıtıcı seviyesinde (`src/server/index.ts`) tüm non-GET `/api/*`
   isteklerinde özel başlık (`x-mc-write`) zorunluluğu, istemci tarafında tek bir sarmalayıcı,
   çitleme testi (§7). Bu, "uçlar" kelimesinin bu sözleşmedeki karşılığıdır — **yeni bir HTTP ucu
   (ör. `PATCH /api/features`, `POST /api/gates/.../approve`) bu turda AÇILMIYOR** çünkü onları
   çağıracak hiçbir tüketici yok (kanban F-007, kapılar paneli F-008 henüz başlamadı); mimarinin
   kendi §6.3/§6.4 taslağı bu uçları sırasıyla kanban ve Faz 2'ye atıyor. Bugün var olmayan bir
   tüketici için uç açmak Karpathy §2 ihlali olurdu (F-005'in tam `tablist` deseni ertelemesiyle
   aynı sınıf karar). `write-gate.ts` bu turda **hiçbir HTTP handler'dan çağrılmaz** — yalnızca
   birim/entegrasyon testlerinden doğrudan çağrılır. ADR-013'ün header kontrolü bugün zaten açık
   olan yazma uçlarını (`POST`/`DELETE /api/projects`) kapsar. **`POST /api/events` bu kontrolden
   MUAFTIR ama muaf olmanın bedeli vardır (CEO Karar 1, bkz. altta):** bu uçta `x-mc-write`
   yerine **`Content-Type: application/json` zorunludur** (allowlist, aşağıda tanımlı); eşleşmeyen
   veya eksik `Content-Type` `400 invalid_body` ile reddedilir. Yani ADR-013'ün "tüm yazma uçları
   korunur" hedefi iki farklı mekanizmayla ama **hiçbir istisnasız** karşılanır — `/api/events`
   "korumasız" değildir, farklı bir korumayla korunur.

**İçerik tipi allowlist'i (CEO Karar 1 — `POST /api/events` için, `x-mc-write` yerine):**
- Kontrol **dağıtıcı seviyesinde**, `x-mc-write` kontrolüyle **aynı yerde ve aynı önem
  sırasında** yapılır (Host/Origin bloğunun hemen ardından, route dispatch'ten önce) — `ingest.ts`
  içine konmaz (D5, gerekçe: F-002/F-004 dosya sahipliği + ADR-013'ün "tek yer" sonucu).
- **Allowlist, denylist DEĞİL:** yalnızca `Content-Type` başlığının `;` **öncesi** kısmı
  `trim().toLowerCase()` sonrası tam olarak `application/json` ise kabul edilir. Denylist
  yazılsaydı CORS güvenli listesinin üçüncü üyesi `multipart/form-data` sessizce geçerdi (D1).
- **Başlık hiç yoksa REDDEDİLİR** (`undefined` ≠ `'application/json'`) — bu, tipsiz `Blob` ile
  `navigator.sendBeacon` çağıran bir sayfanın header'sız çapraz kaynaklı istek atma deliğini
  kapatır (D3).
- Muafiyet/kontrol koşulu **metottan bağımsız değildir**: yalnızca `req.method === 'POST' &&
  pathname === '/api/events'` için uygulanır (D4) — `/api/events`'e ikinci bir metot eklenirse
  bu satır onu otomatik kapsamaz, o gün ayrı bir karar gerekir (bilinçli, dar tanım).
- Hook'un gönderdiği tam biçim (`.claude/hooks/send-event.cjs:153` — `'content-type':
  'application/json'`, küçük harf, `charset` eki yok) **değişmeden geçer** (✓ VERIFIED, D2).
  `application/json; charset=utf-8` gibi ek parametreli istemciler de geçer (`;` öncesi alınıp
  karşılaştırıldığı için).
- Kalan artık risk (D6, çitlenmeyecek, belgelenecek): tarayıcı olmayan yerel bir süreç iki
  başlığı da (doğru `Content-Type`) taklit edip gönderebilir; ADR-013'ün tehdit modeli
  tarayıcıyla sınırlı, bu risk `/api/events`'in zaten kabul edilmiş artık riskiyle (ADR-008)
  aynı sınıf.

**Kapsam DIŞI (bilinçli):**

- Kanban UI/uç (F-007), kapılar paneli UI/uç (F-008), Faz 2, hook kurulumu, olay filtreleme (brief
  madde G — birebir).
- `write-gate.ts`'in herhangi bir HTTP handler'a bağlanması — yukarıdaki §1 madde 7 gerekçesi.
- `.claude/hooks/send-event.cjs`'in değiştirilmesi — F-004'ün dosya sahipliği, bu feature'ın
  listesinde yok. Dosya **okundu** (`:153`, içerik tipi kararının kanıtı için, ✓ VERIFIED) ama
  **değiştirilmiyor**.
- `ProjectRecord`/registry'e bağımlılık — `write-gate.ts` `root: string` (çağıranın önceden
  `fs.realpathSync.native` ile çözdüğü kanonik proje kökü) alır, kayıt defterini hiç bilmez
  (saf kalması, F-005'in `validate-path.ts`'in registry'yi bilmemesiyle aynı ilke).
- **Echo bastırma (mimari §7.3, `selfWrites` Map'i)** — `write-gate.ts` bu turda hiçbir izleyiciyi
  (`chokidar`) bilmiyor; kendi yazımını "dış değişiklik" işaretlemeyecek şekilde bastırma F-007'nin
  (izleyici + write-gate'i birlikte kullanan ilk tüketici) sorumluluğudur.

---

## 2. Dokunacağım dosyalar

**Sahiplik genişletme talebi (QA Bulgu 13):** feature notu (`docs/features/F-006-yazma-kapisi.md`
"Dosya sahipliği") yalnızca `src/server/write-gate.ts` + `tests/helpers/manifest.ts` + ilgili
testleri sayıyor. ADR-013 (dağıtıcı seviyesi header/içerik-tipi kontrolü) ve CEO Karar 2
(`useProjects.ts` regresyon önleme) bu turda **dört ek dosyaya** dokunmayı zorunlu kılıyor:
`src/shared/types.ts`, `src/server/index.ts`, `src/web/lib/write-fetch.ts`,
`src/features/projects/web/useProjects.ts`. Gerekçe her biri için §2.2'de tek tek yazılı; CEO
bunların ikisini (ADR-013 dağıtıcı entegrasyonu, `useProjects.ts` dokunuşu) zaten "CEO kararları"
bölümünde onayladı. Feature notunun dosya sahipliği listesi CEO/PM tarafından bu dört dosyayı
kapsayacak şekilde güncellenmelidir; bu turda kod bu genişletilmiş kapsamla yazılacaktır.

### 2.1 Yeni

| Dosya | Amaç |
|---|---|
| `src/server/write-gate.ts` | Dört niyet fonksiyonu + paylaşılan iç `resolveInsideRoot` yardımcı (§3 madde 2). |
| `tests/helpers/manifest.ts` | `snapshotDir(dir): ManifestEntry[]` — `{ relPath: string; size: number; sha256: string }[]`, POSIX'e çevrilmiş göreli yol, alfabetik sıralı, boş dizinler `relPath` sonu `/` ile ayrı girdi olarak dahil (§6). |
| `tests/server/write-gate.test.ts` | Birim — dört fonksiyonun mutlu yol + hata yolları (**hiçbiri fırlatmaz**, §4), whitelist tablosu (§6, symlink/önek-tuzağı/root-yok satırları dahil), frontmatter round-trip diff testi (mimari §11.1 "12+ golden fixture", §5), EPERM/EBUSY yeniden deneme testi (§3 madde 4). |
| `tests/server/write-gate-manifest.test.ts` | Entegrasyon — gerçek geçici "izlenen proje" fixture'ı + `manifest.ts` ile önce/sonra, zenginleştirilmiş fixture + pozitif (`ok:true` VE hash değişti) assert'ler (§6). |
| `tests/no-write-gate-bypass.test.ts` | Statik tarama — `no-delete-guard.test.ts` ile aynı `walk()` deseni; `src/**` içinde (write-gate.ts dosya-seviyesi, üç store dosyası dizge-seviyesi istisnalı) yasak alt dizgeler + kalıcı negatif-kontrol fixture'ı (§6). |
| `tests/server/adr-013-write-header.test.ts` | Entegrasyon — gerçek `createServer`; `x-mc-write` eksik/yanlış → 403, doğru → geçer; `/api/events` içerik-tipi allowlist'i (kabul/red/eksik/`;charset` varyantları) → 400/geçer; rota başına çit tablosu (§7). |
| `src/web/lib/write-fetch.ts` | `writeFetch(input, init)` — `fetch`'i sarar, `init.headers`'a `WRITE_HEADER_NAME: WRITE_HEADER_VALUE` ekler. İstemci tarafındaki **tek** sarmalayıcı (ADR-013 sonucu, madde 2). |

### 2.2 Değişecek (paylaşılan, gerekçeli — F-005'in §2.2 emsaliyle aynı desen)

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `src/shared/types.ts` | `WRITE_HEADER_NAME = 'x-mc-write'`, `WRITE_HEADER_VALUE = '1'` sabitleri eklenir (fonksiyon değil, iki sabit — sunucu ve istemci aynı dizgeyi elle kopyalamasın). İçerik tipi allowlist'i için ayrı bir sabite gerek yok — `application/json` yalnızca `index.ts`'te, tek yerde, düz literal olarak karşılaştırılıyor (Karpathy §2, ikinci bir tüketici çıkarsa paylaşılır). | ADR-013 uygulaması iki tarafın (dağıtıcı + `write-fetch.ts`) aynı sabiti paylaşması gerektiriyor; `shared/types.ts` zaten bu rolü oynuyor (F-005'in `ErrorCode` eklemesiyle aynı emsal). |
| `src/server/index.ts` | Host/Origin bloğundan hemen sonra, route dispatch'ten önce (§7'de tam kod): `POST /api/events` için içerik-tipi allowlist kontrolü (`x-mc-write`'tan muaf); diğer non-GET `/api/*` istekleri için `x-mc-write` kontrolü. İkisi de başarısız olursa yeni bir `sendInvalidBody(res)` (içerik tipi, 400) veya mevcut `sendForbidden(res)` (`x-mc-write`, 403) — yeni `ErrorCode` **eklenmiyor**, mevcut `invalid_body`/`forbidden_origin` yeniden kullanılıyor (gerekçe §7). | ADR-013 + CEO Karar 1 — tek yer, dağıtıcı seviyesi, yeni bir yazma ucu eklendiğinde varsayılan olarak korunur (opt-out gerekir, opt-in değil). |
| `src/features/projects/web/useProjects.ts` | `add`/`remove` içindeki `fetch('/api/projects', …)` ve `fetch(`/api/projects/${id}`, { method: 'DELETE' })` çağrıları `writeFetch(...)` ile değiştirilir (`GET` çağrısı — `load()` — **değişmez**, `writeFetch` yalnızca yazma çağrılarına uygulanır). | CEO Karar 2 — ADR-013 header'ı bu iki uca da uygulanınca F-005'in mevcut, QA'den geçmiş fetch çağrıları header'sız kalıp 403 alır — bu **gerçek bir geriye dönük kırılma**, F-005'i bozmamak için bu iki satırlık değişiklik zorunlu. `SettingsScreen`/`AddProjectForm`/`ProjectRow` davranışı, testleri, metinleri **değişmiyor** — yalnızca `fetch` çağrısının içi. |

**Dokunulmayan ama incelenen:** `.claude/hooks/send-event.cjs` (✓ VERIFIED, `:153` okundu — hook
zaten `content-type: application/json` gönderiyor, bu yüzden yeni allowlist kurulu kopyaları
kırmaz; dosyanın kendisine dokunulmuyor, F-004 sahipliği), `scripts/install-hook.mjs` (✓ VERIFIED,
`:155` — hook dosyasını birebir kopyalıyor, tek sürüm var, değişmiyor),
`tests/features/projects/no-delete-guard.test.ts` (✓ VERIFIED — kendi kapsamı
`src/features/projects/**` + `src/server/watch/**`, `write-gate.ts` bunun dışında, çakışma yok,
değişmiyor), `src/features/projects/server/*.ts` (write-gate'i hiç import etmiyorlar, §1 madde 7
gerekçesiyle bu turda da etmeyecekler, değişmiyor).

---

## 3. Tasarım kararları

### 1) `root: string` parametresi — kayıt defterinden bağımsız, çağıran realpath'ler

Mimari §7.1'in taslağı `project: ProjectRecord` alıyor; `write-gate.ts` bunun yerine düz
`root: string` alır (çağıranın `fs.realpathSync.native` ile önceden çözdüğü kanonik kök — F-005'in
`ProjectRecord.path` alanı zaten bu invaryantı taşıyor, D17). Gerekçe: `write-gate.ts`'in
`projects-registry`/`ProjectRecord` tipine bağımlılığı olmadan tek başına test edilebilmesi
(mimari §7.1'in kendisi "nihai kod developer'ın" diyor, satır 491). `write-gate.ts` yine de kendi
savunmasını (madde 2 aşağıda) tam olarak koşar — `root`'a **güvenmez**, yalnızca kayıt anındaki
realpath'e göre bir başlangıç noktası kabul eder. **`root` sözleşmesi (QA Bulgu 11):** `root`
mutlak bir yol **ve** `fs.statSync(root).isDirectory() === true` değilse (`root` yok, bir dosya,
veya göreli) `resolveInsideRoot` fs'e daha fazla dokunmadan `write_denied` döner — bu kontrol
adım 0'dır, aşağıdaki adımlardan önce çalışır.

### 2) Ortak dahili yardımcı: `resolveInsideRoot` — symlink savunması + işlem/yol eşleşmesi geri getirildi

QA Bulgu 3 (BLOKLAYICI): önceki tasarım yalnızca **kökün içinde kalmayı** ölçüyordu; `docs/
features/F-001.md` kök **içindeki** başka bir dosyaya (ör. `src/index.ts`) symlink ise veya
`docs/features` kök içi başka bir dizine symlink ise, "kök içinde" testi geçiyor ve `atomicWrite`
symlink'in **hedefine** yazıyordu — AC1 delinirdi. Ayrıca ADR-005 madde 2'nin 5-6. adımı (POSIX
göreli yol üzerinde beyaz liste eşlemesi + işlem/yol eşleşmesi) "yapısal olarak zaten sağlanır"
denilerek çalışma zamanından tamamen kaldırılmıştı; QA bunun yanlış olduğunu gösterdi (yapısal
garanti yalnızca "hangi şablonun kurulduğu" ile ilgili, **hedefin gerçekte o şablona karşılık
gelip gelmediğiyle** ilgili değil — symlink tam bu ayrımı istismar ediyor). Bu turda ikisi de geri
getiriliyor:

```ts
type Operation = 'featureStatus' | 'approval' | 'denial' | 'archive'

// ADR-005 madde 2, adım 5-6'nın çalışma zamanı karşılığı — her işlem yalnızca kendi POSIX
// deseniyle eşleşen bir hedefe yazabilir, hedef daha önce "kök içinde" bulunmuş olsa bile.
const OPERATION_PATTERNS: Record<Operation, RegExp> = {
  featureStatus: /^docs\/features\/[A-Za-z0-9._-]+\.md$/,
  approval: /^docs\/approvals\/(G[0-6](-\d{1,3})?|ASSETS)\.ok$/,
  denial: /^docs\/approvals\/(G[0-6](-\d{1,3})?|ASSETS)\.deny\.md$/,
  // R1 düzeltmesi: önceki [0-9-]+ deseni §3 madde 6'nın ürettiği ISO zaman damgasındaki
  // harfleri (T, Z) kapsamıyordu ("G2-2026-09-05T14-58-24-375Z.deny.md" ile eşleşmiyordu,
  // her archiveDenial çağrısı write_denied dönüyordu) — scratchpad'de ölçülüp doğrulandı, §6'daki
  // yeni whitelist satırına bakın.
  archive: /^docs\/approvals\/archive\/(G[0-6](-\d{1,3})?|ASSETS)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.deny\.md$/,
}

function resolveInsideRoot(
  root: string, relativeParts: string[], operation: Operation
): { ok: true; targetPath: string } | { ok: false; code: 'write_denied'; message: string } {
  // adım 0: §3 madde 1 — root mutlak + dizin değilse burada biter.
  // adım 1: candidate = path.join(root, ...relativeParts).
  // adım 2 — HEDEFİN KENDİSİ SYMLINK Mİ (D30, yeni): candidate zaten varsa fs.lstatSync(candidate)
  //   (realpath DEĞİL — realpath symlink'i izler ve deliği tam olarak gizler). isSymbolicLink()
  //   ise write_denied. Yoksa (henüz oluşturulmamış hedef, normal durum) devam.
  // adım 3 — ATA DİZİNLERİN HİÇBİRİ SYMLINK OLMAMALI (D30, yeni): root'tan candidate'a giden
  //   relativeParts'ın HER ön eki (son segment hariç) için, o yol VARSA fs.lstatSync ile
  //   kontrol edilir; herhangi biri isSymbolicLink() ise write_denied. İlk var-olmayan
  //   segmentte döngü durur (daha derin segmentler zaten yok, symlink olamaz).
  // adım 4: en yakın var olan atayı bul (mevcut adım 2, F-005 D17 ile aynı): candidate'tan
  //   başlayıp fs.existsSync ile yukarı çık; kök diske ulaşılırsa (path.dirname sabit noktası)
  //   write_denied.
  // adım 5: resolvedAnc = fs.realpathSync.native(anc) — artık yalnızca Windows büyük/küçük harf
  //   kanonikleştirmesi için (adım 2-3 symlink'i zaten elemiş olduğundan güvenlik sınırı BURADA
  //   değil, adım 2-3'te).
  // adım 6: rel = path.relative(root, resolvedAnc); '..' ile başlıyor veya mutlaksa → write_denied
  //   (önek tuzağı burada otomatik kapanır: path.relative dizge öneki değil gerçek segment
  //   karşılaştırması yapar, `C:\dev\app` kökü `C:\dev\app-factory\x`'i asla "içeride" saymaz).
  // adım 7: targetPath = path.join(resolvedAnc, path.relative(anc, candidate)).
  // adım 8 — İŞLEM/YOL EŞLEŞMESİ (D30, geri getirildi): posixRel = path.relative(root,
  //   targetPath).split(path.sep).join('/'); OPERATION_PATTERNS[operation].test(posixRel)
  //   değilse write_denied ("İşlem, hedef yolla eşleşmiyor."). Bu adım §6'daki "işlem/yol
  //   uyumsuzluğu" satırını artık YAPISAL VARSAYIMLA değil ÇALIŞMA ZAMANINDA kapatır.
  // Tüm fonksiyon bir dış try/catch ile sarılıdır (§4 "asla fırlatmaz" invaryantı) — lstatSync/
  // realpathSync'ten beklenmeyen bir hata (ör. yarış durumunda dosya kaybolması) write_denied'a
  // düşer, fırlatılmaz.
}
```

`relativeParts` **hiçbir zaman** çağırandan (istemci girdisinden) doğrudan gelmez — her genel
fonksiyon kendi sabit şablonunu kurar (`['docs','features',fileName]` vb.), `fileName`/`gate` önce
aşağıdaki regex'lerden geçmiş olur; **ayrıca** kendi `operation` etiketini `resolveInsideRoot`'a
verir, böylece adım 8 gerçek bir çalışma zamanı kontrolüdür — yapıya değil ölçüme dayanır.

### 3) Girdi doğrulama — `fileName`/`gate` regex'leri (node:path dışında elle yol işlemi yok)

- `fileName`: `/^[A-Za-z0-9._-]+\.md$/` **ve** `path.basename(fileName) === fileName` (çift kontrol
  — regex tek başına `a/../b.md` gibi bir dizgeyi zaten reddeder çünkü `/` regex'te yok, ama
  ADR-005'in kendi metni her iki kontrolü de istiyor, savunma katmanı çoğaltması ucuz).
- `gate`: mimari §6.4 ile birebir `/^(G[0-6](-\d{1,3})?|ASSETS)$/` — bu bir *yol* değil bir
  *tanımlayıcı* regex'i (ters bölü yok, S6 ihlali değil).
- İkisi de uymazsa `{ ok: false, code: 'invalid_body', message: '...' }` — `resolveInsideRoot`
  hiç çağrılmaz (fs'e dokunmadan erken çıkış).

### 4) Atomik yazma — tek yerde, dört fonksiyon paylaşır, **asla fırlatmaz**, EPERM/EBUSY'de 3 deneme

QA Bulgu 4 (BLOKLAYICI) + Bulgu 9 (ÖNEMLİ): önceki taslakta `mkdirSync` `try` **dışındaydı**
(`docs/approvals` bir dosyaysa `ENOTDIR` fırlardı), `finally`'deki `unlinkSync` kendi hata yolunu
yakalamıyordu (Windows'ta `EPERM` dönüş değerini ezerdi), ve mimarinin istediği 50/100/200 ms'lik
3 denemeli `EPERM`/`EBUSY` yeniden deneme yalnızca düz metinde vardı, kodda tek deneme kalmıştı.
Düzeltilmiş tasarım iki katmana ayrılır — tek seferlik iç yardımcı ve onu saran yeniden deneme
döngüsü:

```ts
function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Senkron API'de engelleyici bekleme — Node'da async olmayan bu modülün TEK bekleme aracı.
 *  Event loop'u gerçekten bloklar (kabul edilebilir: yerel, tek kullanıcılı araç, dakikada
 *  birkaç yazma, ADR-005 "realpath maliyeti" riskiyle aynı sınıf). */
function sleepSyncMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function atomicWriteOnce(
  targetPath: string, data: string | Buffer
): { ok: true; path: string } | { ok: false; message: string; errno?: string } {
  const dir = path.dirname(targetPath)
  const tmp = path.join(
    dir, `.${path.basename(targetPath)}.${process.pid}-${crypto.randomBytes(3).toString('hex')}.tmp`
  )
  try {
    fs.mkdirSync(dir, { recursive: true })   // ARTIK try İÇİNDE — ENOTDIR burada yakalanır (Bulgu 4a)
    const fd = fs.openSync(tmp, 'wx')
    try {
      fs.writeSync(fd, data)
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.renameSync(tmp, targetPath)           // aynı dizin → atomik, Windows'ta üzerine yazar
    return { ok: true, path: targetPath }
  } catch (err) {
    const errno = (err as NodeJS.ErrnoException)?.code
    return { ok: false, message: describeError(err), errno }
  } finally {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp)   // hata yolunda artık bırakılmaz
    } catch {
      // Bulgu 4: unlinkSync'in KENDİ hatası (ör. Windows EPERM) dönüş değerini EZMEZ —
      // yalnızca yutulur, üst katmanın write_failed kararı değişmez. Modül yine de fırlamaz.
    }
  }
}

function atomicWrite(targetPath: string, data: string | Buffer): WriteResult {
  const delaysMs = [50, 100, 200]              // mimari §7.2 madde 8, ADR-005 madde 5
  let last: { ok: true; path: string } | { ok: false; message: string; errno?: string } = {
    ok: false, message: 'yazma denenmedi',
  }
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    last = atomicWriteOnce(targetPath, data)
    if (last.ok) return last
    const retryable = last.errno === 'EPERM' || last.errno === 'EBUSY'
    if (!retryable || attempt === delaysMs.length) break
    sleepSyncMs(delaysMs[attempt])
  }
  return last.ok ? last : { ok: false, code: 'write_failed', message: last.message }
}
```

`fs.mkdirSync(dir, {recursive:true})` **yalnızca** `resolveInsideRoot`'tan geçmiş, kapsam-içi
`dir` için çağrılır (`docs/approvals/archive/` ilk kez kullanıldığında böyle oluşur) — statik guard
testi bunu `write-gate.ts`'i tarama dışı tuttuğu için (§6) engellemez, ama `no-write-gate-bypass.
test.ts` bu `mkdirSync` çağrısının **yalnızca** `write-gate.ts` içinde kaldığını doğrular.

**"Asla fırlatmaz" invaryantı (§4'te tekrar edilir):** `setFeatureStatus`'un kendi `readFileSync`/
`realpathSync` çağrıları (dosya dışarıdan silinmişse `ENOENT` — F-007'nin ana yolu) da kendi
`try/catch`'i içine alınır ve `write_failed` döner; `resolveInsideRoot` da (madde 2) kendi dış
`try/catch`'iyle aynı invaryantı taşır. Dört genel fonksiyonun **hiçbiri, hiçbir koşulda fırlamaz.**

### 5) `setFeatureStatus` — yalnızca `status:` satırı, YAML round-trip yok, arama sınırı BOM-güvenli

QA Bulgu 1 kenar-durum tablosunu 11 vakayla **çalıştırdı** (bkz. sözleşme sonu, "setFeatureStatus
kenar durum tablosu"); iki gerçek hata bulundu ve burada düzeltiliyor:

1. **BOM'lu dosyada algoritma çalışmıyordu:** ilk eleman `﻿---` olduğu için `parts[0] ===
   '---'` karşılaştırması yanlış çıkıyor, "frontmatter yok" → yazma yapılmıyordu (mimari §7.2 adım
   1 "BOM korunur" ihlali). **Düzeltme:** açılış satırı karşılaştırılırken yalnızca karşılaştırma
   amacıyla lider BOM soyulur (`parts[0].replace(/^﻿/, '') === '---'`); `parts[0]`'ın kendisi
   **hiç değiştirilmez** (yalnızca `status:` satırının elemanı değişir, BOM elemanı 0'da kalıp
   dokunulmadığı için bayt bazında korunur).
2. **Arama sınırı yazılmamıştı — en tehlikeli bulgu (BOM'dan bile tehlikeli, çünkü sessiz):**
   önceki metin "açılış ile kapanış arasında ilk `status:` satırını bul" diyordu ama algoritma
   taslağı kapanışı bulduktan **sonra durmuyordu**; kapanışa bağlanmayan bir arama, frontmatter'da
   `status` yoksa **gövdedeki** girintisiz bir `status:` satırını sessizce yeniden yazar (QA'nın
   ölçtüğü vaka: "frontmatter'da status yok, gövdede girintisiz status: var" → önceki tasarımda
   tanımsız, riskli). **Düzeltme:** arama açık uçlu bir `for` değil, **açılış `---`'ın indeksi ile
   kapanış `---`/`...`'ın indeksi arasında** (ikisi hariç, yalnızca o aralıktaki içerik satırları)
   yapılır; kapanış bulunamazsa veya aralıkta `status:` yoksa arama **orada durur**, gövdeye asla
   inmez, `invalid_body` döner.
3. **`status : değer` (iki nokta öncesi boşluk):** `startsWith('status:')` bunu kaçırır, `/^status
   \s*:/ ` yakalar. Sözleşme bu ikinciyi **sabitler** — regex kullanılacak, `startsWith` değil.

Algoritma (mimari §7.2, düzeltilmiş):

1. `const original = fs.readFileSync(file)` (Buffer) → `sha256(original)` `expectedHash` ile
   karşılaştırılır; uyuşmazsa **hiç yazmadan** `conflict` döner. (readFileSync `ENOENT` fırlatırsa
   `try/catch` ile yakalanıp `write_failed` — §3 madde 4 "asla fırlatmaz".)
2. `const text = original.toString('utf8')`; `const parts = text.split(/(\r\n|\n)/)` — ayraçlar
   dizinin kendi elemanları, içerik satırları **çift** indekslerde (0, 2, 4, …).
3. Açılış: `parts[0]` BOM soyulmuş hâliyle tam `---` değilse → `invalid_body` ("frontmatter yok").
4. Kapanış: çift indekslerde, index ≥ 2'den başlayarak, değeri tam `---` veya `...` olan **ilk**
   elemanın indeksi (`closingIdx`). Bulunamazsa → `invalid_body`.
5. `status:` satırı: **yalnızca** `2 <= i < closingIdx` aralığındaki çift-indeksli elemanlarda
   `/^status\s*:/ ` ile test edilir (girintili `status:` bir alt alan, atlanır). İlk eşleşen
   indeks `statusIdx`. Aralıkta bulunamazsa → `invalid_body` — **kapanıştan sonrasına asla
   bakılmaz.**
6. `parts[statusIdx] = `status: ${safe(nextStatus)}`` — yalnızca bu **tek** eleman değişir.
7. `parts.join('')` → yeni metin. `safe()`: değer `#`, `:`, satır sonu veya baştaki/sondaki boşluk
   içeriyorsa çift tırnaklanır.

**Bayt koruma kanıtı (görev maddesi 2):** Tam ayrıştırıp yeniden yazmak (`yaml.parse`+`yaml.
stringify`) **kullanılmıyor** çünkü bu, yorumları/sırayı/tırnak stilini kaybeder (YAML
serializer'ların bilinen davranışı) — bunun yerine metin `split(/(\r\n|\n)/)` ile **yakalama
grubu içeren** bir regex'e bölünür, yani ayraçlar (`\r\n` veya `\n`) dizinin kendi elemanları
olarak korunur ve `join('')` onları olduğu gibi geri koyar; değişen **tek eleman**, `status:`
satırının kendisidir. Kanıt testi (`write-gate.test.ts`, birim): her fixture için `original` ve
`patched` metinleri `parts`'a bölünüp **önce `parts.length` eşitliği**, sonra elemanlar tek tek
karşılaştırılır — **`status:` satırının indeksi dışındaki her eleman `===` ile birebir eşit**
olmalı (`parts.length` kontrolü olmadan `safe()` bir satır sonu içeren değeri tırnaklamayı
kaçırırsa dizi uzar, indeks hizası kayar ve karşılaştırma yanlış yerden geçer — QA "Ölçmeyen test
riski" notu). Bu bir "iki dizi arasında tek satır farkı" `diff` kütüphanesi değil, kendi bölme/
karşılaştırma mantığımız (ek bağımlılık yok, Karpathy §2). Ayrıca CRLF fixture'ında **hiçbir
`\n`'in `\r\n`'e ya da tersine dönüşmediği** ayrı bir assert'le doğrulanır.

**12+ golden fixture — isim isim (mimari §11.1, QA Bulgu 8'in istediği somutluk):**
1. Saf LF, `status` ortada
2. Saf CRLF, `status` ortada
3. Karışık CRLF/LF
4. BOM + LF
5. `status` tırnaklı değer (`status: "in progress"`)
6. `status` ilk satırda (frontmatter açılışından hemen sonra)
7. `status` son satırda (kapanıştan hemen önce)
8. Girintili `status:` (bir alt nesne alanı, dokunulmamalı) + girintisiz `status:` birlikte
9. Frontmatter yok (`invalid_body`)
10. Kapanış `...` (`---` değil)
11. Unicode başlık (`title: "Özel Karakterler ığüşöç"`)
12. Çok satırlı blok skaler (`description: |\n  satır1\n  satır2`)
13. `deps: [F-001, F-002]` (dizi değeri, `status`'tan etkilenmemeli)
14. Son satırda satır sonu ayracı yok (dosya `\n` ile bitmiyor)
15. `status : değer` (iki nokta öncesi boşluk)
16. İki `---` bloğu — ikinci blok **gövdede**, kendi `status:` satırını taşıyor (yalnızca ilk blok değişmeli)
17. Frontmatter'da `status` yok, **gövdede** girintisiz `status:` var (arama sınırı burada test edilir — `invalid_body` dönmeli, gövdeki satır **değişmemeli**)

(17 fixture, mimarinin istediği "12+" eşiğinin üzerinde — QA'nın 11 vakalık kenar-durum
tablosunun tamamı bu listede karşılığını buluyor.)

### 6) Arşivleme — `archiveDenial` yalnızca `rename`, no-op durumu

`archiveDenial(root, gate)`: hedef `docs/approvals/<gate>.deny.md` **yoksa** — yani arşivlenecek
bir şey yoksa — `{ ok: true, path: '' }` döner (idempotent no-op; çağıran, örn. gelecekteki gates
handler, "onay öncesi varsa arşivle" akışını `archiveDenial` her onayda koşulsuz çağırarak
uygulayabilir, kendi `existsSync` kontrolü yazmasına gerek kalmaz). Varsa: `docs/approvals/
archive/` dizini `mkdirSync({recursive:true})` ile (yoksa) oluşturulur, hedef ad
`` `${gate}-${timestamp}.deny.md` `` (`timestamp = new Date().toISOString().replace(/[:.]/g,'-')`
— Windows dosya adlarında `:` yasak, `.` çakışmayı önlemek için de değiştirilir — bu bir yol
regex'i değil bir **dosya adı** sanitizasyonudur, `path` API'siyle ilgisi yok, S6 kapsamı dışı).
**R1 kanıtı (elle eşleştirme, scratchpad'de çalıştırıldı):** bu üretim gerçek bir çağrıda örneğin
`G2-2026-09-05T14-58-24-375Z.deny.md` üretir; §3 madde 2'deki
`OPERATION_PATTERNS.archive = /^docs\/approvals\/archive\/(G[0-6](-\d{1,3})?|ASSETS)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.deny\.md$/`
bu adla `docs/approvals/archive/G2-2026-09-05T14-58-24-375Z.deny.md` için `test() === true` döner
(node ile çalıştırılıp doğrulandı; eski `[0-9-]+` deseni aynı ad için `false` dönüyordu — R1'in
kök nedeni buydu). `G4-2` (gruplu gate) ve `ASSETS` varyantları da aynı yöntemle `true` döndü.
Çakışma ihtimali (aynı milisaniyede iki çağrı) — tek kullanıcılı, elle tetiklenen bir akışta
pratikte imkânsız; oluşursa `renameSync` üzerine yazar (kabul edilebilir, PRD hiçbir AC bunu
sorgulamıyor). `unlink`/`rm` **hiç çağrılmaz** — kaynak dosya `renameSync` ile taşınır, iki
konumda birden var olmaz.

### 7) `writeGateApproval` / `writeGateDenial` — tam içerik yazımı

İçerik biçimlendirmesi (mimari §6.4'ün `.ok`/`.deny.md` şablonu) **çağıranın** sorumluluğudur —
`write-gate.ts` `body: string`'i olduğu gibi `atomicWrite`'a verir, içerik üretmez (F-008'in işi,
tek sorumluluk). Boş `body` kontrolü de çağıranın işi (mimari §6.4 "summary/decision/reason boş
olamaz" — bunlar `write-gate.ts`'in bilmediği alan adları); `write-gate.ts` yalnızca `body.length
=== 0` ise `invalid_body` döner (çok dar, jenerik bir taban kontrol, iş kuralı değil).

### 8) `WriteResult` tipi — mimari taslağından küçük, gerekçeli sapma

```ts
export type WriteResult =
  | { ok: true; path: string; hash?: string }   // hash yalnızca setFeatureStatus başarılı dönüşte
  | { ok: false; code: 'write_denied' | 'conflict' | 'write_failed' | 'invalid_body'; message: string }
```

Mimari taslağının `card?: FeatureCard` alanı **yok** — `FeatureCard` türetimi F-007'nin işi
(F-005 sözleşmesi §3 madde 3'ün zaten kurduğu ayrım), `write-gate.ts` onu hiç bilmiyor.

### 9) `resolveInsideRoot` neden `write-gate.ts` içinde kalıyor, ayrı dosya değil

Tek kullanıcısı `write-gate.ts`'in kendi dört fonksiyonu; ayrı bir `path-guard.ts` dosyası
oluşturmak (F-005'in `validate-path.ts`'e benzer) bugün hiçbir ikinci tüketiciye hizmet etmiyor —
Karpathy §2 "istenmeyen soyutlama" (ikinci bir çağıran çıkarsa o zaman ayrılır).

---

## 4. Niyet fonksiyonları — nihai imzalar

```ts
export type WriteResult =
  | { ok: true; path: string; hash?: string }
  | { ok: false; code: 'write_denied' | 'conflict' | 'write_failed' | 'invalid_body'; message: string }

/** root: çağıranın önceden fs.realpathSync.native ile çözdüğü kanonik proje kökü. */
export function setFeatureStatus(
  root: string, fileName: string, nextStatus: string, expectedHash: string
): WriteResult   // ok:true → hash dolu (yeni içeriğin sha256'sı)

export function writeGateApproval(root: string, gate: string, body: string): WriteResult
export function writeGateDenial(root: string, gate: string, body: string): WriteResult
export function archiveDenial(root: string, gate: string): WriteResult   // yoksa ok:true path:''
```

Hiçbiri istemciden ham yol/dosya sistemi parçası almaz ötesinde `fileName`/`gate` — ikisi de
regex'le doğrulanmış, tek segmentlik tanımlayıcılardır (§3 madde 3). Genel `write(path, content)`
**yok**. `operation` etiketi (§3 madde 2) dışa açık değildir — her fonksiyon kendi sabit etiketiyle
`resolveInsideRoot`'u çağırır, çağıran bunu hiç görmez.

**"Asla fırlatmaz" invaryantı (CEO kararı F, QA Bulgu 4 — BLOKLAYICI):** Dört genel fonksiyonun
**dördü de, her koşulda** `WriteResult` döner; hiçbir `Error` fırlatmazlar. Bu, `mkdirSync`'in
`try` içine alınmasıyla (§3 madde 4), `finally` içindeki `unlinkSync`'in kendi `try/catch`'iyle,
`readFileSync`/`realpathSync`'in `write_failed`'a düşürülmesiyle (§3 madde 4-5) ve
`resolveInsideRoot`'un dış `try/catch`'iyle (§3 madde 2) sağlanır. **Kapsam sınırı (bu turda bu
modül hiçbir HTTP handler'dan çağrılmadığı için, §1 madde 7):** "yazma hatası süreci öldürmez"
iddiası bu turda İKİ farklı katmanda kanıtlanır — (a) modülün **kendi** seviyesinde,
`write-gate.test.ts`'in mutasyon 8a'sı (§8) fonksiyonların gerçekten fırlamadığını doğrudan ölçer;
(b) dağıtıcı seviyesinde, ADR-013'ün header/içerik-tipi kontrolünün **gerçekten bağlı olduğu**
(`withDispatchErrorBoundary` kaldırılırsa `adr-013-write-header.test.ts`'in KIRMIZI vermesi, §8
mutasyon 6-7) — bu ikinci katman F-005'in "430/430 yeşil kaldı" dersinin bu sözleşmedeki
karşılığıdır. `write-gate.ts`'in kendisi bu turda dağıtıcıya **hiç bağlı olmadığından**
(§1 madde 7), "dağıtıcı write-gate'in bir fırlatmasını yakalar mı" sorusu bugün **uygulanamaz** —
F-007 write-gate'i bir HTTP handler'a bağladığında bu soru yeniden açılır ve o turun kendi
mutasyon planına girer (bugünden varsayım yapılmıyor, Karpathy §1).

**API sözleşmesi notu:** Bu turda bu fonksiyonları çağıran hiçbir HTTP handler yok (§1 madde 7).
Bu sözleşmenin "hangi uçlar açılıyor" sorusuna yanıt: **hiçbiri** — yalnızca mevcut iki yazma
ucunun (`POST /api/events` içerik-tipi allowlist'iyle, `POST`/`DELETE /api/projects` `x-mc-write`
ile) dağıtıcı seviyesinde ADR-013 + CEO Karar 1'e tabi tutulması (§7). Bu, feature notunun
"F-007'den ÖNCE bitmek zorunda" ifadesiyle tutarlı: F-007 kendi `PATCH /api/features` handler'ını
yazdığında `write-gate.setFeatureStatus`'u doğrudan import edip çağıracak.

---

## 5. AC → test eşlemesi

| AC (`docs/features/F-006-yazma-kapisi.md`) | Katman | Neden |
|---|---|---|
| AC1 — yalnızca üç hedefe yazma | Birim (`resolveInsideRoot` + her fonksiyonun kendi şablonu) + Entegrasyon (manifest testi) | Modülün kendisi UI'sız; birim testler her yolun doğru şablona kilitlendiğini, manifest testi ise **gerçek dosya sisteminde** hiçbir yan etkinin sızmadığını kanıtlar — ikisi birbirini tamamlar (biri "kod doğru şablon üretiyor", diğeri "gerçekten yalnızca o dosyalar değişti"). |
| AC2 — genel yazma yok, dört niyet fonksiyonu | Statik (TypeScript export yüzeyi) + Birim | `write-gate.ts`'in export ettiği isimler `write-gate.test.ts`'te `Object.keys(module)` ile **`toEqual(['archiveDenial','setFeatureStatus','writeGateApproval','writeGateDenial'].sort())`** (tam liste, alfabetik) doğrulanır — QA "Ölçmeyen test riski" madde 2: `toContain` biçimi beşinci bir export sızsa bile sonsuza dek yeşil kalırdı, `toEqual` kalmasını engeller. |
| AC3 — silme yok | Statik tarama (`no-write-gate-bypass.test.ts`) + Birim (`archiveDenial` yalnızca `renameSync` çağırır, kaynak dosyanın rename sonrası **var olmadığı**, hedefin var olduğu doğrudan `fs.existsSync` ile ölçülür) | Statik tarama kaza eseri eklenecek bir `unlinkSync`'i yakalar (F-005 dersi — dizge seviyesi istisna, §6); birim test asıl **davranışı** (dosyanın gerçekten taşındığını, silinmediğini) ölçer — ikisi farklı hata sınıflarını yakalar. |
| AC4 — traversal/symlink/dış yol reddi | Birim (~28 vakalık tablo, §6) | jsdom/E2E'nin göremeyeceği saf mantık. Traversal/önek-tuzağı/root-yok vakaları gerçek geçici dizinle test edilir. Symlink vakaları: dizin-seviyesi (`docs/features` kök içi başka bir dizine symlink) gerçek `fs.symlinkSync(target, link, 'junction')` ile (Windows'ta yönetici izni **gerektirmez**); dosya-seviyesi (`docs/features/F-001.md` → `src/index.ts`) için junction kullanılamaz (Windows junction yalnızca dizin) — bu vaka **hem** fırsatçı gerçek `fs.symlinkSync(..., 'file')` denemesiyle (izin varsa çalışır, yoksa `try/catch` ile atlanır ve QA'ya "atlandı" olarak raporlanır) **hem de** zorunlu, hiçbir koşulda atlanmayan bir `vi.spyOn(fs, 'lstatSync')` sahte-symlink testiyle (`isSymbolicLink()` `true` döndürecek şekilde, belirli hedef yol için) kanıtlanır — ikincisi determinist olduğu için GEÇTİ'ye asıl katkıyı o sağlar, gerçek-symlink denemesi yalnızca ek güvence (§6, §9 risk notu). |
| AC5 — `node:path`, elle regex yok | Statik tarama, **yalnızca** `src/server/write-gate.ts` okunur | QA Bulgu 12: tarama hedefi ve yasak desen somutlaştırıldı — yasak desen elle ayraç bölme/kurma (kaynakta `split('\\')`, `split('/')`, `.replace('\\',...)`, `.replace('/',...)` veya ters-bölü/eğik-çizgi içeren bir string literal ile yol kurma girişimi); `archiveDenial`'ın kendi dosya adı sanitizasyonu (`timestamp.replace(/[:.]/g,'-')`, §3 madde 6) testte **adıyla** beyaz listelenir (bu bir yol regex'i değil, `:`/`.` karakterlerini temizleyen bir dosya-adı sanitizasyonu — S6 kapsamı dışı, ama tarama bunu otomatik ayırt edemeyeceği için test kodunda açık istisna olarak yazılır). |
| Test 1 (manifest diff) | Entegrasyon, gerçek fs | PRD'nin S4/F4-AC6 karşılığı; mock fs bu sınıf regresyonu (kaza eseri yeni bir yazma yolu) hiç yakalayamaz. |
| Test 2 (statik tarama) | Statik | Aynı gerekçe, AC3. |
| Atomik yazma | Birim (`.tmp` adının `renameSync`'ten önce var olduğu, sonra `targetPath`'in var olduğu, hata enjeksiyonunda `.tmp`'nin `finally` ile temizlendiği) | Gerçek `fs` üzerinde `openSync('wx')` sonrası bir `throw` enjekte edilerek (ör. `renameSync`'i geçersiz bir hedefe yönlendirip) hata yolu tetiklenir. |
| ADR-013 header | Entegrasyon, gerçek `createServer` (§7) | Dağıtıcı seviyesi davranış; birimde `withDispatchErrorBoundary`'i taklit etmek gerçek HTTP round-trip'in yerini tutmaz. |

**UI katmanı yok** (brief madde E) — bu yüzden hiçbir jsdom/RTL/Playwright testi eklenmiyor. F-003
dersi ("düzen/görünürlük iddiaları jsdom'da ölçülemez") burada tersine uygulanıyor: UI'nin kendisi
yok, o yüzden E2E'ye de gerek yok — ağırlık tamamen birim + entegrasyon'da.

---

## 6. Güvenlik — yol beyaz listesi, statik tarama, manifest testi

### Yol beyaz listesi tablosu (birim, `write-gate.test.ts`, ~28 vaka)

| Fonksiyon | Girdi | Beklenen |
|---|---|---|
| `setFeatureStatus` | `fileName='F-001.md'`, kök içinde mevcut | `docs/features/F-001.md` yazılır ✓ |
| `setFeatureStatus` | `fileName='../../../etc/passwd'` | regex reddeder (`/` içeriyor) → `invalid_body` ✗ |
| `setFeatureStatus` | `fileName='a.txt'` | regex reddeder (`.md` değil) → `invalid_body` ✗ |
| `setFeatureStatus` | `fileName='sub/a.md'` | regex reddeder (`/` içeriyor) → `invalid_body` ✗ |
| `setFeatureStatus` | `expectedHash` diskle uyuşmuyor | `conflict`, dosya değişmez ✗ |
| `setFeatureStatus` | hedef dosya dışarıdan silinmiş (`readFileSync` `ENOENT`) | fırlamaz, `write_failed` ✗ (QA Bulgu 4) |
| **`setFeatureStatus`** | **`docs/features/F-001.md`'in KENDİSİ bir symlink → `src/index.ts`** (kök içi, gerçek dosya) | **§3 madde 2 adım 2 (hedef lstat) reddeder → `write_denied` ✗ — QA Bulgu 3, ana vaka** |
| **(hepsi)** | **`docs/features` (ata dizin) kök içi başka bir dizine symlink** | **§3 madde 2 adım 3 (ata lstat) reddeder → `write_denied` ✗ — QA Bulgu 3** |
| `writeGateApproval` | `gate='G2'` | `docs/approvals/G2.ok` yazılır ✓ |
| `writeGateApproval` | `gate='G7'` | regex reddeder → `invalid_body` ✗ |
| `writeGateApproval` | `gate='G2/../../x'` | regex reddeder (`/` içeriyor) → `invalid_body` ✗ |
| `writeGateApproval` | `gate='ASSETS'` | `docs/approvals/ASSETS.ok` yazılır ✓ |
| `writeGateDenial` | `gate='G4-2'` | `docs/approvals/G4-2.deny.md` yazılır ✓ (mimari §6.4 gruplaması) |
| `archiveDenial` | `.deny.md` mevcut | `docs/approvals/archive/G2-<ts>.deny.md`'ye rename, kaynak yok olur ✓ |
| **`archiveDenial`** | **üretilen arşiv adı (`` `${gate}-${timestamp}.deny.md` ``, ör. `G2-2026-09-05T14-58-24-375Z.deny.md`)** | **kendi `OPERATION_PATTERNS.archive` desenine uyar → adım 8'de reddedilmez, `renameSync` çalışır ✓ — R1 kapatıldı, kanıt §3 madde 6 sonunda** |
| `archiveDenial` | `.deny.md` yok | no-op, `{ok:true, path:''}` |
| (hepsi) | `root` kendisi bir symlink (kayıt sonrası değiştirilmiş) | gerçek hedefi çözer, kök dışıysa `write_denied` (ADR-005 risk maddesi) |
| (hepsi) | Windows ayracıyla karışık girdi zaten `root`'tan geliyor (fileName/gate'te ayraç yok) | regex zaten `/`/`\` ikisini de reddediyor (karakter sınıfında yok) |
| **(hepsi)** | **önek tuzağı: `root='C:\dev\app'`, hedef aslında `C:\dev\app-factory\...`'a denk gelecek şekilde kurulmuş bir `relativeParts`** | **`path.relative` gerçek segment karşılaştırması yapar (dizge öneki değil) → `write_denied` ✗ — QA Bulgu 11** |
| **(hepsi)** | **`root` verilmemiş / boş dizge** | **adım 0 → `write_denied` ✗ — QA Bulgu 11** |
| **(hepsi)** | **`root` bir dosya (dizin değil)** | **adım 0 → `write_denied` ✗ — QA Bulgu 11** |
| **(hepsi)** | **`root` göreli bir yol (`path.isAbsolute` false)** | **adım 0 → `write_denied` ✗ — QA Bulgu 11** |

**Adım 8'in (işlem/yol eşleşmesi) tek doğrulama yolu — R3 düzeltmesi:** `operation` etiketi dışa
açık değil (§4) ve AC2'nin `toEqual` listesi tam dört export'a kilitli — bu ikisi bozulmadan, adım
8'i test dosyasından `resolveInsideRoot`'u doğrudan çağırarak (yanlış `operation` vererek) sınamak
**mümkün değil**. Dört genel fonksiyonun her biri kendi sabit şablonunu kendi sabit `operation`
etiketiyle çağırdığı için, normal genel-API kullanımıyla da bu ikisi asla uyuşmaz hâle gelemez —
adım 8'in kendisi yalnızca **kaynak kodu bozulursa** (bir fonksiyon yanlış etiket kullanırsa)
devreye girer. Bu yüzden adım 8'in **tek** kanıtı §8 mutasyon 11'dir: kaynakta bir fonksiyonun
`operation` argümanı geçici olarak yanlışla değiştirilir ve o fonksiyonun **genel API üzerinden**
zaten var olan mutlu-yol testinin (yukarıdaki tablo) KIRMIZI'ye döndüğü ölçülür. Ayrı bir whitelist
tablo satırı veya internal export gerekmiyor.

**Symlink testlerinin Windows'ta çalıştırılabilirliği (QA Bulgu 3'ün kendi notu):** dizin-seviyesi
vaka (`docs/features` → başka dizin) `fs.symlinkSync(target, link, 'junction')` ile kurulur —
junction NTFS reparse point'idir, `SeCreateSymbolicLinkPrivilege` **gerektirmez**, GitHub Actions
Windows runner'ında sorunsuz çalışır. Dosya-seviyesi vaka (`F-001.md` → `src/index.ts`) için
junction yoktur (yalnızca dizin); bu satır **iki parçalı** test edilir: (a) fırsatçı gerçek
`fs.symlinkSync(target, link, 'file')` denemesi — CI ortamı izin verirse çalışır, `EPERM` ile
başarısız olursa `it.skip`'e düşer (bu alt-test **atlanabilir**, GEÇTİ'ye katkısı sayılmaz); (b)
**zorunlu, hiç atlanmayan** `vi.spyOn(fs, 'lstatSync')` ile belirli bir hedef yol için
`isSymbolicLink() => true` döndüren sahte-stat testi — bu determinist olduğu için whitelist
tablosundaki "hedef symlink" satırının GEÇTİ'ye asıl katkısı budur.

### Statik tarama (`tests/no-write-gate-bypass.test.ts`) — F-005'in körlüğünü aşma, genişletilmiş kapsam

QA Bulgu 5 (ÖNEMLİ): önceki `DENIED` listesi ADR-005 madde 10 ve mimari §11.4b'nin kendi
listesinden darmış (`cp*`, `copyFileSync`, `createWriteStream`, `truncate*`, write-gate'in kendi
`openSync`/`writeSync` çifti eksik — kopyala-yapıştır tabanlı bir bypass en olası biçimiyle
taramadan geçerdi). QA Bulgu 6 (ÖNEMLİ): üç store dosyasının **dosya seviyesinde** muaf tutulması
F-005'in kendi dersini (istisna dizge seviyesine indirilmeli) geri alıyordu — bu dosyalardan
izlenen bir proje köküne (yanlışlıkla) yazan bir mutasyon iki guard'a da görünmez kalırdı.

```
DENIED = ['writeFileSync','writeFile(','appendFileSync','appendFile(',
          'renameSync','rename(','mkdirSync','mkdir(',
          'unlinkSync','unlink(','rmSync','rmdirSync','fs.rm(',
          'copyFile','cp(','cpSync','createWriteStream',
          'truncate(','truncateSync(','ftruncate(','ftruncateSync(',
          'openSync','writeSync','promises.open(']

files = walk('src', ['.ts','.tsx'])
  .filter(f => f !== 'src/server/write-gate.ts')   // TEK dosya-seviyesi istisna — write-gate
                                                    // kendisi tek yazma yetkilisi, geniş yüzeyi
                                                    // (openSync/writeSync/mkdirSync/renameSync/
                                                    // unlinkSync(tmp)) burada meşru.
```

**R4 düzeltmesi (çıplak `truncate`/`ftruncate` yanlış pozitif üretiyordu):** ölçüldü —
çıplak `'truncate'` `normalize.ts:78` (`truncateSummary`), `:133` (`truncated: true`), `:137`
(`raw_truncated`), `:154` (`truncateSummary(...)`), `query.ts:21-24` (`Math.trunc`/`truncated`
değişkeni), `TimelineRow.tsx:56` ve `ProjectRow.tsx:75`'teki Tailwind `truncate` sınıfına çarpıyordu
— bunların hiçbiri bir dosya sistemi çağrısı değil. Çağrı-biçimli `'truncate('`/`'truncateSync('`/
`'ftruncate('`/`'ftruncateSync('` bu dokuz satırın **hiçbiriyle** eşleşmez (`truncateSummary(`,
`Math.trunc(`, JSX sınıf dizgesi `truncate ` — hepsinde `truncate`'ten hemen sonra `(` gelmiyor)
ama gerçek bir `fs.truncateSync(...)`/`fs.ftruncateSync(...)` çağrısını hâlâ yakalar (`truncate`
kelimesinin hemen ardından `(` gelir). **Aynı sınıf kontrol edildi:** listedeki diğer çıplak
desenler (`writeFileSync`, `appendFileSync`, `renameSync`, `mkdirSync`, `unlinkSync`, `rmSync`,
`rmdirSync`, `copyFile`, `cpSync`, `createWriteStream`, `openSync`, `writeSync`) `src/**` genelinde
(write-gate.ts ve üç store dosyası dışında) grep'lendi — hiçbirinde ilgisiz bir eşleşme bulunamadı;
yanlış pozitif yalnızca `truncate`/`ftruncate` sınıfındaydı çünkü bunlar aynı zamanda proje içi
yardımcı fonksiyon adı (`truncateSummary`) ve CSS/JS sözcüğü (`truncate`, `Math.trunc`) olarak da
kullanılıyor.

**NOT-1 (aynı düzeltmeyle kapanıyor):** `projects-registry.ts:52` bir **yorum satırı** olup içinde
`renameSync`/`unlinkSync` sözcükleri geçiyor. Üç store dosyasının dizge-seviyesi kontrolü zaten
`no-delete-guard.test.ts`'in çağrı-biçimli deseniyle (`unlinkSync\([^)]*\)` vb.) çalışır, düz
`content.includes(forbidden)` **değildir** — bu yüzden yorum satırındaki düz metin eşleşmeyi tetiklemez.
Bu netlik önceki turda gövdeye açıkça yazılmamıştı; şimdi burada sabitleniyor, ek kod/test gerekmiyor.

Üç store dosyası artık dosya-seviyesinde **muaf değil** — `no-delete-guard.test.ts`'in
`unlinkSync(tmpPath)` emsaliyle **aynı, çağrı-biçimli (regex, ör. `unlinkSync\([^)]*\)`), dizge-seviyesi**
yaklaşım genelleştirilip bu testin içine taşınıyor (naif `content.includes(...)` **değil** —
NOT-1'in yorum-satırı yanlış pozitifini bu ayrım zaten engeller): her store dosyasının içeriği
okunur, DENIED listesindeki her desenin **çağrı biçiminde eşleşen her geçtiği yer** aşağıdaki
izinli tam-çağrı kümesiyle karşılaştırılır — izinli kümede olmayan herhangi bir eşleşme testi kırar:

```
İZİNLİ (yalnızca bu tam çağrılar, ✓ VERIFIED kaynak satırlarından alındı):
  jsonl-store.ts:
    'fs.writeFileSync(seqFile, String(value))'
    'fs.mkdirSync(eventsDir, { recursive: true })'
    'fs.promises.appendFile(file, line)'
  projects-registry.ts:
    'fs.mkdirSync(dataDir, { recursive: true })'
    'fs.writeFileSync(tmpPath, JSON.stringify(body, null, 2))'
    'fs.renameSync(tmpPath, filePath)'
    'fs.unlinkSync(tmpPath)'
  retention.ts:
    'fs.unlinkSync(target)'
```

(Bu üç dosyanın DENIED listesiyle eşleşen her satırı yukarıdaki tam dizgelerden biriyle birebir
eşleşmelidir; eşleşmezse — ör. birisi `retention.ts`'e ikinci bir `unlinkSync(otherPath)` eklerse —
test kırılır.) Ayrıca `0.0.0.0`/`MC_HOST` literal taraması **tekrar edilmiyor** — bu zaten
`tests/no-external-host.test.ts:80-84`'te kapsanıyor (✓ VERIFIED), aynı iddiayı ikinci bir dosyada
tutmak Karpathy §2 (gereksiz tekrar, bakım yükü) ihlali olurdu.

**Körlük assert'i + kalıcı negatif-kontrol (QA "Ölçmeyen test riski" madde 5 — artık mutasyon
DEĞİL, kalıcı test vakası):** `expect(files.length).toBeGreaterThan(0)` **ve** ayrı, her PR'da
koşan bir test: `src/**` dışında (`tests/fixtures/` altında) yapay, tek satırlık bir `mkdirSync(...)`
çağrısı içeren bir dosya `walk()`'a geçici olarak eklenip taramanın onu **gerçekten yakaladığı**
doğrudan ölçülür (önceden §8'de "mutasyon" olarak tanımlıydı — QA bunun mutasyon değil, guard'ın
kendi doğruluğunu kanıtlayan kalıcı bir test olması gerektiğini belirtti, çünkü aksi hâlde
`DENIED` listesinin **hiçbir şey yakalamadığı** bir yazım hatası fark edilmeden sonsuza dek yeşil
kalabilir).

**`no-delete-guard.test.ts` ile çakışma yok mu?** Hayır — o test yalnızca `src/features/projects/**`
+ `src/server/watch/**`'i tarıyor (dar kapsam, F-005'in kendi feature'ı). Bu yeni test **tüm**
`src/**`'i tarıyor (yalnızca write-gate dosya-seviyesi istisnalı, store dosyaları dizge-seviyesi
kontrollü). İkisi de kalır, biri diğerinin süper kümesi ama ikisi de PR'da koşar (F-005'in kendi
dosyalarının F-006 sonrası da hâlâ temiz kaldığını ikinci bir açıdan doğrulamak zarar vermez).

### Manifest testi (`tests/server/write-gate-manifest.test.ts`)

QA Bulgu 10 (ÖNEMLİ): fixture mimari §11.4a'nın zengin fixture'ından darmış (`.claude/`,
`docs/qa/`, `package.json`, kök içi symlink yoktu) ve `docs/approvals/archive/` **önceden**
oluşturulmuş kuruluyordu, yani `mkdirSync` ile ilk-kez-oluşturma yolu hiç koşmuyordu. Ayrıca
"izin verilmeyen bir dosyanın değiştiği" senaryosunu kanıtlayan bir mutasyon yoktu — İDDİA A/B
hiçbir yazma olmadığında da doğru çıkardı (QA "Ölçmeyen test riski" madde 1).

```
1. Zenginleştirilmiş geçici "izlenen proje" fixture'ı: docs/features/F-001.md (frontmatter'lı),
   docs/approvals/G1.ok, docs/approvals/G2.deny.md, src/index.ts, README.md, package.json,
   .claude/settings.json, docs/qa/latest.md — docs/approvals/archive/ BİLİNÇLİ OLARAK
   OLUŞTURULMAZ (archiveDenial'ın kendi mkdirSync'inin ilk-kez-oluşturma yolunu koşturmak için).
2. manifestBefore = snapshotDir(fixtureRoot)   // (relPath, size, sha256) — mtime YOK (F-005'in
   mtime'ı sha256 ile örtüşüyor, gereksiz alan eklenmiyor, Karpathy §2)
3. Senaryo: setFeatureStatus (geçerli — POZİTİF assert: dönüş `ok:true` VE F-001.md'nin sha256'sı
   değişti), setFeatureStatus (bayat hash → conflict, yazmamalı), setFeatureStatus (traversal
   denemesi → reddedilmeli, yazmamalı), writeGateApproval (POZİTİF assert), writeGateDenial
   (POZİTİF assert), archiveDenial (G2.deny.md'yi arşivler, archive/ dizinini ilk kez oluşturur,
   POZİTİF assert)
4. manifestAfter = snapshotDir(fixtureRoot)
5. İDDİA A: değişen/eklenen relPath kümesi ⊆ { docs/features/F-001.md, docs/approvals/G1.ok,
   docs/approvals/G3.deny.md, docs/approvals/archive/, docs/approvals/archive/G2-*.deny.md }
   İDDİA B (R2 düzeltmesi): manifestBefore'daki, İDDİA A'nın değişen/eklenen kümesinde **OLMAYAN**
   her relPath (yani `docs/features/F-001.md`, `docs/approvals/G1.ok` VE arşivlenip taşınan
   `docs/approvals/G2.deny.md` **hariç**) manifestAfter'da AYNI (relPath,size,sha256) ile var
   (içerik değişikliği de yakalanır, yalnızca dosya listesi değil — F-005 dersi). (Önceki metin
   yalnızca `G2.deny.md`'yi hariç tutuyordu; F-001.md ve G1.ok de senaryoda kasıtlı olarak
   değiştiği için bu hâliyle İDDİA A/E ile çelişip kaçınılmaz KIRMIZI veriyordu.)
   İDDİA C: G2.deny.md before'da var, after'da YOK (silinmedi, taşındı) — archive hedefinde
   AYNI İÇERİKLE (size/sha256 eşit) var
   İDDİA D: manifestAfter uzunluğu manifestBefore uzunluğundan yalnızca beklenen kadar farklı
   (F-005'in "yalnızca dosya listesi karşılaştırmak yeterli değil" dersi — uzunluk + küme +
   içerik üçü birden)
   İDDİA E (yeni, pozitif assert — QA "Ölçmeyen test riski" madde 1): her başarılı yazma
   çağrısının `ok:true` döndürdüğü VE ilgili dosyanın `sha256`'sının değiştiği ayrı ayrı
   doğrulanır — İDDİA A/B tek başına "hiçbir şey olmadı" durumunda da doğru kalabilir.
6. MUTASYON (§8 mutasyon 11): `writeGateApproval`'ın hedefi test içinde `README.md`'ye
   yönlendirilir (yalnızca bu testte, izin verilmeyen bir dosya "değişmiş" gibi simüle edilir) →
   İDDİA B KIRMIZI vermeli; bu, İDDİA A/B'nin gerçekten "izin verilmeyenler değişmedi"yi ölçtüğünü
   kanıtlar.
```

---

## 7. ADR-013 uygulaması + CEO Karar 1 (içerik tipi allowlist)

**Başlık adı:** `x-mc-write` · **Beklenen değer:** `1` · **Sabitler:** `src/shared/types.ts`
`WRITE_HEADER_NAME`/`WRITE_HEADER_VALUE` (§2.2). **`/api/events` için ayrıca:** `Content-Type:
application/json` allowlist'i (CEO Karar 1) — `x-mc-write`'ın **yerine geçer**, ek değildir.

**Nerede kontrol ediliyor:** `src/server/index.ts`, dağıtıcının en başında, mevcut Host/Origin
bloğunun **hemen ardından** (route dispatch'ten önce — ADR-013 Sonuç 1: "tek bir yerde"). İki
kontrol **aynı if-else zincirinde**, birbirini dışlayacak şekilde dallanır — `/api/events` ya
içerik-tipi kontrolünden ya `x-mc-write` kontrolünden geçer, ikisi asla aynı anda uygulanmaz:

```ts
const ALLOWED_EVENT_CONTENT_TYPE = 'application/json'

if (pathname?.startsWith('/api/')) {
  if (!isAllowedHost(req.headers.host)) { sendForbidden(res); return }
  if (req.method !== 'GET' && !isAllowedOrigin(req.headers.origin)) { sendForbidden(res); return }

  if (req.method === 'POST' && pathname === '/api/events') {
    // CEO Karar 1 — x-mc-write'tan MUAF, yerine içerik-tipi allowlist'i zorunlu.
    const raw = req.headers['content-type']
    const normalized = typeof raw === 'string' ? raw.split(';')[0].trim().toLowerCase() : undefined
    if (normalized !== ALLOWED_EVENT_CONTENT_TYPE) { sendInvalidBody(res); return }
  } else if (req.method !== 'GET' && req.headers[WRITE_HEADER_NAME] !== WRITE_HEADER_VALUE) {
    sendForbidden(res)
    return
  }
}
```

**İçerik tipi allowlist kuralları (CEO Karar 1, QA D1-D6'nın tamamı kapatıldı):**
- **Allowlist, denylist DEĞİL** — yalnızca `application/json` kabul edilir (D1: denylist
  yazılsaydı CORS güvenli listesindeki `multipart/form-data` sessizce geçerdi).
- Karşılaştırma `Content-Type` değerinin `;` **öncesi** kısmı alınıp `trim().toLowerCase()`
  yapıldıktan sonra yapılır (D2: `application/json; charset=utf-8` gönderen istemciler — gelecekte
  değişebilecek hook sürümleri, Playwright `request.post`, curl — sessizce düşürülmez).
- **Başlık hiç yoksa** (`undefined`) `normalized !== 'application/json'` zaten `true` olur →
  reddedilir (D3: tipsiz `Blob` ile `sendBeacon` çapraz-kaynak deliği kapanır).
- Kontrol **yalnızca** `req.method === 'POST' && pathname === '/api/events'` için çalışır (D4:
  metottan bağımsız değil — `/api/events`'e ikinci bir metot eklenirse bu satır onu kapsamaz,
  o gün ayrı bir karar gerekir).
- Kontrol **dağıtıcıda**, `ingest.ts`'e değil (D5: F-002/F-004 dosya sahipliği + ADR-013'ün "tek
  yer" sonucu korunur).
- Durum kodu **400**, yeni `sendInvalidBody(res)` yardımcısı (mevcut `invalid_body` `ErrorCode`'u
  yeniden kullanır — `sendForbidden`'ın 400 kardeşi): `{success:false, error:{code:'invalid_body',
  message:'İçerik tipi desteklenmiyor.'}}`.
- **Kalan artık risk (D6, kabul edilen, çitlenmeyen):** tarayıcı olmayan yerel bir süreç doğru
  `Content-Type`'ı da taklit edip gönderebilir; ADR-013'ün tehdit modeli tarayıcıyla sınırlı.

**Rota başına çit tablosu (QA Bulgu 7 — her satır ayrı `it`, `adr-013-write-header.test.ts`):**

| Rota | Header/içerik-tipi durumu | Beklenen |
|---|---|---|
| `POST /api/projects` | `x-mc-write` yok | 403 |
| `POST /api/projects` | `x-mc-write: 1` | dispatch edilir (200/400, header engellemedi) |
| `DELETE /api/projects/:id` | `x-mc-write` yok | 403 |
| `DELETE /api/projects/:id` | `x-mc-write: 1` | dispatch edilir |
| `POST /api/events` | `content-type: text/plain` | 400 `invalid_body` |
| `POST /api/events` | `content-type` yok | 400 `invalid_body` |
| `POST /api/events` | `content-type: multipart/form-data` | 400 `invalid_body` |
| `POST /api/events` | `content-type: application/json` | dispatch edilir (`x-mc-write` yoksa da) |
| `POST /api/events` | `content-type: application/json; charset=utf-8` | dispatch edilir |
| `GET /api/events` | header yok | 200 (GET zaten muaf, regresyon kontrolü) |
| `GET /api/stream` | header yok | bağlantı kurulur (regresyon kontrolü — F-003 `/api/stream` dersi) |
| `GET /api/projects` | header yok | 200 (regresyon kontrolü) |

**Durum kodu (`x-mc-write` yolu):** `403`, mevcut `sendForbidden()` **yeniden kullanılır** — yeni
bir `ErrorCode` eklenmez, `forbidden_origin` kodu korunur (istemciye göre ayrım hiçbir AC
tarafından istenmiyor, UI zaten bu hatayı göstermeyecek).

**İstemci sarmalayıcı:** `src/web/lib/write-fetch.ts` → `writeFetch(input, init)`:
```ts
export function writeFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, headers: { ...init.headers, [WRITE_HEADER_NAME]: WRITE_HEADER_VALUE } })
}
```
`useProjects.ts`'in `add`/`remove`'u bunu kullanır (§2.2); `load()` (`GET`) **kullanmaz** —
ADR-013 yalnızca non-GET içindir. `writeFetch` `/api/events` için **kullanılmaz** (o uç zaten
`x-mc-write`'tan muaf; olay gönderimi panelin UI'ından değil hook'tan gelir).

**Hook muafiyeti — CEO Karar 1 ile kapatıldı (artık "bilgi notu" değil, karar):** `POST
/api/events` `x-mc-write`'tan muaf, ama içerik-tipi allowlist'i zorunlu. `.claude/hooks/
send-event.cjs`'e dokunulmuyor (F-004 sahipliği) ve kurulu kopyalar kırılmıyor (✓ VERIFIED
`:153`, hook zaten `content-type: application/json` gönderiyor). Bu, ADR-013'ün "tüm yazma
uçları korunur" hedefini **istisnasız** karşılar — `/api/events` farklı bir mekanizmayla
korunuyor, korumasız değil. Gerekçenin tam zinciri (D1-D6) yukarıda; CEO'nun kendi kararı
(`## CEO kararları — §9'daki iki soruya cevap`, Karar 1) bağlayıcıdır, itiraz hakkı yok.

---

## 8. Mutasyon planı

1. `resolveInsideRoot`'un kapsama kontrolü (`path.relative` ile `..`/mutlak reddi) kaldırılır →
   traversal vakaları KIRMIZI vermeli.
2. `resolveInsideRoot`'un `.native` çözümlemesi düz `realpathSync`'e değiştirilir → symlink/harf
   büyüklüğü vakaları en az birinde KIRMIZI vermeli (D17 emsali).
3. `setFeatureStatus`'taki `sha256` karşılaştırması kaldırılır (her zaman yaz) → bayat-hash testi
   KIRMIZI, manifest testinin İDDİA B'si de KIRMIZI (dosya beklenmedik şekilde değişir).
4. `archiveDenial` içindeki `renameSync` bir `copyFileSync`'e değiştirilir (silme yerine kopyalama
   simülasyonu) → "kaynak dosya sonrasında yok" birim testi KIRMIZI, manifest İDDİA C KIRMIZI.
5. Dağıtıcıdaki ADR-013 `x-mc-write` `if` bloğu tamamen silinir → `adr-013-write-header.test.ts`'in
   "header'sız `POST /api/projects` reddedilir" testi KIRMIZI.
6. `x-mc-write` muafiyet koşulu `pathname !== '/api/events'`'ten `true`'ya değiştirilir (header
   her yere zorunlu olur, `/api/events`'in içerik-tipi yolu devre dışı bırakılır) → hook-benzeri
   (yalnızca doğru `content-type`, `x-mc-write` yok) `POST /api/events` isteği testte 403 alır;
   bu, muafiyetin *gerçekten* `x-mc-write`'a değil içerik-tipine devredildiğinin kanıtı.
7. **(D29, yeni)** İçerik-tipi allowlist kontrolü (`normalized !== ALLOWED_EVENT_CONTENT_TYPE`)
   dağıtıcıdan tamamen kaldırılır → rota-başına-çit tablosundaki `text/plain`/eksik-header/
   `multipart/form-data` satırlarının **üçü de** KIRMIZI vermeli (artık 400 yerine dispatch
   ediliyor olacaklar).
8. **(D29, yeni)** Allowlist karşılaştırması `;` öncesini almadan yapılır (`raw !==
   'application/json'` direkt) → `application/json; charset=utf-8` satırı KIRMIZI vermeli (D2'nin
   çitlenmesi).
9. **(D30, yeni, Bulgu 3'ün mutasyonu)** `resolveInsideRoot`'un adım 2 (hedef `lstatSync`
   sembolik-link kontrolü) kaldırılır → "hedef dosyanın kendisi symlink" whitelist satırı
   (§6, spy-tabanlı zorunlu test) KIRMIZI vermeli.
10. **(D30, yeni)** `resolveInsideRoot`'un adım 3 (ata dizin `lstatSync` döngüsü) kaldırılır →
    "`docs/features` ata dizini symlink" whitelist satırı (junction fixture'lı) KIRMIZI vermeli.
11. **(D30, yeni — R3 ile düzeltildi)** Kaynakta `writeGateApproval`'ın `resolveInsideRoot`
    çağrısındaki `operation: 'approval'` etiketi geçici olarak `'featureStatus'` ile değiştirilir.
    (Önceki metin bunu "test dosyasından `resolveInsideRoot`'u doğrudan, yanlış `operation`
    parametresiyle çağırarak" tanımlıyordu — bu, `operation`'ın dışa açık olmadığı §4 iddiasıyla
    ve AC2'nin dört-export `toEqual` sabidiyle çelişiyordu, R3. Düzeltme: internal fonksiyona
    hiç erişilmiyor, yalnızca kaynak kodun kendisi mutasyonlanıyor.) Adım 8 artık
    `docs/approvals/G2.ok` hedefini `featureStatus` şablonuyla (`docs/features/*.md`)
    karşılaştırır, uyuşmaz → §6'daki `writeGateApproval` mutlu-yol testi (`gate='G2'` →
    `docs/approvals/G2.ok` yazılır ✓, **genel API üzerinden**) `write_denied` döner, KIRMIZI.
    Adım 8'in tek kanıtı budur.
12. **(D31, yeni, Bulgu 4'ün mutasyonu — a)** `atomicWriteOnce` içindeki `mkdirSync`'i `try`
    dışına taşı (eski konumuna geri al) VE `docs/approvals`'ı önceden bir **dosya** olarak kur
    (test fixture'ında) → dört fonksiyonun tümü artık `ENOTDIR` **fırlatır** (throw), "asla
    fırlatmaz" birim testi KIRMIZI.
13. **(D31, yeni — b)** `withDispatchErrorBoundary` sarmalayıcısı `createServer`'daki
    `http.createServer(...)` çağrısından kaldırılır (yalnızca test amaçlı, geçici) →
    `adr-013-write-header.test.ts`'in header/içerik-tipi testleri, sarmalayıcının dağıtıcıya
    gerçekten bağlı olduğunu dolaylı olarak kanıtlar (mutasyon 5/7 zaten bu sınıfı kapsıyor,
    burada ayrıca doğrulanan şey: sarmalayıcı kaldırıldığında dispatch içindeki senkron bir hata
    500 yerine süreci çökertir — F-005'in "430/430 yeşil kaldı" dersinin tekrar etmediğinin
    kanıtı).
14. **(D32, yeni)** `DENIED` listesinden `copyFileSync` (veya yeni eklenen desenlerden biri)
    çıkarılır → `no-write-gate-bypass.test.ts`'in kalıcı negatif-kontrol fixture'ı (§6, artık
    mutasyon değil kalıcı test) her yeni desen için ayrı ayrı KIRMIZI vermeli.
15. **(D32, yeni)** Üç store dosyasından birine (ör. `retention.ts`) izinli-kümede olmayan ikinci
    bir `unlinkSync(otherPath)` eklenir → dizge-seviyesi kontrol KIRMIZI vermeli.
16. **(D33, yeni, Bulgu 8'in mutasyonu)** `setFeatureStatus`'un arama sınırı kaldırılır (kapanış
    indeksine bağlanmadan tüm `parts` taranır) → 17. fixture ("frontmatter'da status yok, gövdede
    girintisiz status: var") artık `invalid_body` yerine gövdeyi değiştirir, testi KIRMIZI verir.
17. Manifest testinin `snapshotDir` çağrısı `fs.readdirSync(..., {recursive:false})`'a
    düşürülür (kasıtlı bozuk fixture) → İDDİA D (uzunluk) veya İDDİA B (alt dizin içeriği)
    KIRMIZI vermeli — `manifest.ts`'in kendi özyinelemeliliğinin test edildiğinin kanıtı.
18. **(§6 mutasyon 11, tekrar)** `writeGateApproval`'ın hedefi test içinde `README.md`'ye
    yönlendirilir → manifest testinin İDDİA B'si KIRMIZI vermeli.
19. **(R1, yeni)** `OPERATION_PATTERNS.archive` deseni daraltılır (ör. tekrar eski
    `-[0-9-]+\.deny\.md$` biçimine, harfleri `T`/`Z` kabul etmeyecek şekilde) → `archiveDenial`'ın
    kendi mutlu-yol testi (§6, `.deny.md` mevcut → rename) `write_denied` döner, KIRMIZI; manifest
    testinin `archiveDenial` pozitif assert'i ve İDDİA C de KIRMIZI verir.
20. **(Bulgu 9 KISMİ'nin kapanışı, yeni)** `atomicWrite`'taki `delaysMs` dizisi `[]`'e (sıfır
    yeniden deneme, tek deneme) düşürülür → EPERM/EBUSY enjekte edilen retry birim testi
    (§2.1 `write-gate.test.ts`, "3. denemede de `EPERM` → `write_failed`" vakası) ilk denemeden
    sonra beklenenden erken `write_failed` döner, KIRMIZI — 50/100/200 ms'lik 3-deneme döngüsünün
    gerçekten çalıştığının kanıtı.

---

## 9. Riskler ve CEO'ya sorular

**CEO kararları (tur 1'de "bilgi notu" olarak açık bırakılmıştı, QA Bulgu 1 bunu bloklayıcı
saydı — CEO şimdi karara bağladı, aşağıdaki iki madde KAPALI):**

1. **ADR-013 `/api/events` muafiyeti** — **KARAR VERİLDİ (Karar 1, altta).** ADR metninin "tüm
   yazma uçları" ifadesi, `/api/events`'in `x-mc-write` yerine içerik-tipi allowlist'iyle
   korunmasıyla **istisnasız** karşılanıyor sayılır. ADR-013'e CEO'nun ekleyeceği tek cümlelik not
   (Karar 1'in son paragrafı) bunu resmileştirir; kod bu turda zaten bu şekilde yazılacak.
2. **`useProjects.ts`'e dokunma** — **ONAYLANDI (Karar 2, altta).** F-006'nın dosya sahipliği
   listesi §2'nin başındaki "sahiplik genişletme talebi" ile birlikte CEO/PM tarafından
   güncellenmeli.

**Riskler (kod turunda izlenecek, bloklayıcı değil):**

1. **Statik tarama kaçağı** (ADR-005'in kendi kabul ettiği risk): `fs['write'+'File']` gibi dolaylı
   çağrı taramayı atlatabilir. Manifest testi ikinci savunma hattı (dolaylı çağrıyı da yakalar,
   davranışı ölçtüğü için).
2. **`archiveDenial` çakışma penceresi** (§3 madde 6, aynı milisaniye) — tek kullanıcılı senkron
   akışta gözlemlenmesi beklenmiyor, testte de simüle edilmiyor (Karpathy §2 — gerçekleşmeyen
   senaryo için savunma yok).
3. **Dosya-seviyesi symlink testi Windows'ta atlanabilir** (§6) — junction dizin-seviyesi vakayı
   kapsıyor, ama dosya-seviyesi (`F-001.md` → `src/index.ts`) gerçek symlink denemesi CI'da izin
   sorunuyla atlanabilir. Zorunlu, atlanmayan `vi.spyOn(fs.lstatSync)` testi bu riski **kapatır**
   (GEÇTİ'ye asıl katkıyı o sağlıyor) — QA kod turunda ikisinin de gerçekten yazıldığını
   doğrulamalı.
4. **`sleepSyncMs` (Atomics.wait) event loop'u bloklar** (§3 madde 4) — kabul edilen davranış
   (senkron API'nin doğal sonucu), ama en kötü senaryoda (3 deneme, hepsi EPERM) tek bir yazma
   çağrısı ~350 ms boyunca sunucuyu bloklar. Dakikada birkaç yazma olan bu araç için ölçülemez
   (ADR-005 "realpath maliyeti" riskiyle aynı sınıf); **bu turda** kabul edilebilir çünkü
   `write-gate.ts` henüz hiçbir HTTP handler'a bağlı değil (§1 madde 7), dolayısıyla bugün hiçbir
   isteği geciktirmiyor (QA tur 2 doğrulaması, D31). **F-007'ye devredilen taahhüt:** F-007,
   `write-gate.setFeatureStatus`'u `PATCH /api/features` handler'ına bağladığı gün bu ~350 ms'lik
   senkron bekleme **tüm istekleri** (SSE akışı dahil) durdurur; F-007'nin kendi sözleşmesi
   `Atomics.wait` tabanlı yeniden denemeyi asenkron bir yaklaşımla değiştirmek **zorundadır** —
   bugünden bu değişikliği yapmıyoruz (Karpathy §1, henüz gerçekleşmeyen bir bağlanma için
   asenkron karmaşıklık eklemek erken olur).
5. **Desen karşılaştırması harf duyarlı, adım 5'in harf-büyüklüğü kanonikleştirmesiyle tam
   örtüşmeyebilir (QA NOT-2):** `resolveInsideRoot` adım 5 `fs.realpathSync.native` ile diskteki
   **gerçek** harf büyüklüğünü döndürür, adım 8'in `OPERATION_PATTERNS`'ı ise harf duyarlı
   (`docs/features/…`, küçük harf). Bu depoda ve F-006'nın kendi test fixture'larında dizin adları
   zaten küçük harf olduğu için bugün hiçbir vakayı etkilemiyor; izlenen bir projede `Docs/Features`
   gibi büyük harfli bir dizin **varsa** tüm yazmalar sessizce `write_denied` olurdu. **Karar:**
   bu turda desen karşılaştırmasını harf duyarsız yapmıyoruz — gerçekleşmeyen bir senaryo için
   savunma eklemek Karpathy §2 ihlali olurdu; kayıt için burada yazılı, çitlenmiyor. Windows'ta
   proje dizinleri tipik olarak kurulum sırasında sabit/küçük harfli oluşturulduğu için pratik
   olasılığı düşük; F-007/F-008 kendi projelerinde büyük harfli dizinle karşılaşırsa o tur
   yeniden değerlendirir.
6. **İçerik-tipi allowlist'in artık riski (D6):** tarayıcı olmayan yerel bir süreç `Content-Type:
   application/json` başlığını da taklit edip `/api/events`'e sahte olay yazabilir. ADR-013'ün
   tehdit modeli tarayıcıyla sınırlı olduğu için kabul edilen bir risktir, çitlenmiyor.

---

## CEO kararları — §9'daki iki soruya cevap (2026-09-05)

> **Bu bölüm sözleşmenin GÖVDESİNE yayılmalıdır.** F-005'te bir CEO kararı turun sonuna eklendi,
> gövdeye hiç işlenmedi ve yedi yerde çelişki bıraktı (`CLAUDE.md` öğrenilen kural). §3, §4, §5, §6,
> §7, §8 bu kararlara göre güncellenecek.

### Karar 1 — `/api/events` muafiyeti KABUL, ama karşılığında içerik tipi ZORUNLU

Sorunun özü doğru tespit edilmiş: `send-event.cjs` bir tarayıcı değil, CSRF tehdidi taşımıyor.
Ve muafiyeti kaldırmanın gizli bir bedeli var — **izlenen projelere zaten kurulmuş hook kopyaları
sessizce kırılırdı.** Script tasarım gereği sessizce başarısız oluyor (ADR-006), yani olay akışı
durur ve kimse fark etmez. Bu, projenin tekrar eden "sessiz başarısızlık" sınıfı olurdu.

**Ama düz muafiyet de kabul edilemez:** o zaman kötü niyetli bir yerel sayfa `/api/events`'e sahte
olay basabilir ve ADR-013'ün kapatmak istediği delik yarı açık kalır.

**Karar:** `/api/events` `x-mc-write` başlığından **muaftır**, fakat sunucu bu uçta
**`Content-Type: application/json` şart koşacaktır**; başka bir içerik tipiyle gelen istek reddedilir.

Gerekçe: `application/json` CORS'un "güvenli listesinde" **değildir**. Çapraz kaynaklı bir tarayıcı
isteği bu içerik tipini taşıyorsa **preflight** gerektirir ve panel preflight'ı kabul etmiyor.
Preflight'tan kaçmak isteyen bir sayfa `text/plain` veya `application/x-www-form-urlencoded`
kullanmak zorundadır — ki artık onlar reddediliyor. Net sonuç: **hiçbir tarayıcı sayfası
`/api/events`'e çapraz kaynaklı yazamaz**, `x-mc-write` ile aynı koruma, sıfır kırılma.

Doğrulandı: hook zaten `content-type: application/json` gönderiyor
(`.claude/hooks/send-event.cjs:153`), yani **kurulu kopyalar kırılmaz**. Sunucu şu an gelen içerik
tipini hiç kontrol etmiyor (`ingest.ts` ve `index.ts`'teki `content-type` geçişlerinin hepsi
**yanıt** başlığı) — bu kontrol eklenecek.

**Çitlenme zorunlu:** (a) `text/plain` ile gönderilen `POST /api/events` reddedilir; (b) hook'un
gönderdiği biçim kabul edilir; (c) **mutasyon:** içerik tipi kontrolünü kaldır → (a) testi KIRMIZI.
ADR-013'ün "tüm yazma uçları" ifadesi bu istisnayla birlikte okunacak; ADR-013'e tek cümlelik bir
not eklenecek (CEO yazacak).

### Karar 2 — `useProjects.ts`'e dokunma ONAYLANDI

Gerekçe yeterli: `/api/projects` uçları `x-mc-write` isteyecekse F-005'in istemcisi başlığı
göndermek zorunda; yoksa F-006 kendi eklediği korumayla F-005'i kırar. Dokunuş **minimum**
olmalı — yalnızca `fetch` çağrılarını `writeFetch` sarmalayıcısına geçirmek; başka hiçbir davranış
değişmeyecek. §2.2'deki gerekçe yeterli, feature notunun dosya sahipliği listesine de eklenecek.
**Regresyon kanıtı:** F-005'in mevcut testleri (Ekle/Kaldır hata yolları dahil) değişmeden geçmeli.

---

## QA sözleşme incelemesi — tur 1 (qa-evaluator, 2026-09-05)

**KARAR: DÜZELTME**

Bloklayıcı: 4 · Önemli: 8 · Not: 2 (toplam 14). Yöntem: sözleşme + `docs/features/
F-006-yazma-kapisi.md` + ADR-005/008(+ek)/013 + mimari §6.1/§6.4/§7/§10/§11.1/§11.4 okundu;
iddialar `src/server/index.ts`, `src/features/events/server/ingest.ts`, `src/features/projects/
web/useProjects.ts`, `.claude/hooks/send-event.cjs`, `scripts/install-hook.mjs`,
`tests/features/projects/no-delete-guard.test.ts`, `tests/integration/events-api.test.ts`,
`tests/no-external-host.test.ts` **okunarak** doğrulandı. `setFeatureStatus` algoritması
scratchpad'de birebir kodlanıp 11 kenar durumu **çalıştırıldı** (tablo aşağıda). Hiçbir proje
dosyası değiştirilmedi; yalnızca bu bölüm eklendi.

### Bulgular

| # | Şiddet | Bölüm/satır | Bulgu | İstenen düzeltme |
|---|---|---|---|---|
| 1 | BLOKLAYICI | §1.7 (s.55-65), §2.1-2.2 (s.92,103-104), §5 (s.293), §7 (s.417-438), §8 (s.456-461), §9 (s.482-485) | **CEO Karar 1 gövdeye hiç yayılmamış.** §7 hâlâ dört gerekçeyle *düz muafiyet* anlatıyor; içerik tipi zorunluluğu ne kapsamda (§1), ne test dosyası amacında (§2.1 `adr-013-write-header.test.ts`), ne AC→test tablosunda (§5), ne mutasyon planında (§8) geçiyor. §2.2 "`send-event.cjs` okunmadı bile" diyor, karar ise dosyayı okuyup `:153`'e dayanıyor. §9 madde 1 hâlâ "CEO onayından geçmesi iyi olur" kipinde açık soru. | §1/§2.1/§2.2/§5/§7/§8/§9'u Karar 1'e göre yeniden yaz: muafiyet = "`x-mc-write`'tan muaf **ama** `Content-Type` zorunlu"; §8'e "içerik tipi kontrolünü kaldır → `text/plain` testi KIRMIZI" mutasyonunu ekle; §9'un iki maddesini "karar verildi" olarak kapat. |
| 2 | BLOKLAYICI | §7 (s.388-398), CEO Karar 1 (s.523-540) | **İçerik tipi kontrolünün kendisi hiç tanımlanmamış**: nerede (dağıtıcı mı `ingest.ts` mi), allowlist mi denylist mi, `; charset=utf-8` eki, **başlık hiç yokken** ne olacağı, hangi metotlar, hangi durum kodu/`ErrorCode`. Denylist yazılırsa CORS güvenli listesinin üçüncü üyesi `multipart/form-data` açık kalır (zincir denetimi D1); başlıksız istek kabul edilirse tipsiz Blob ile `sendBeacon` deliği açık kalır (D3). | §7'ye tek paragraf: kontrol **dağıtıcıda**, Host/Origin bloğunun hemen ardında, gövde okunmadan; `content-type` başlığının `;` öncesi parçası `trim().toLowerCase()` sonrası `application/json` olmalı (**allowlist**); eşleşmeyen VEYA eksik başlık → `400 invalid_body` (yeni `ErrorCode` yok, PRD F1/AC5 korunur); muafiyet koşulu `req.method === 'POST' && pathname === '/api/events'` olarak daraltılır. |
| 3 | BLOKLAYICI | §3 madde 2 (s.139-146), §6 tablo (s.305-321) | **ADR-005 madde 2'nin 5. ve 6. adımı (POSIX göreli yol üzerinde beyaz liste eşlemesi + işlem/yol eşleşmesi) çalışma zamanından kaldırılmış**, "yapısal olarak zaten sağlanır" denmiş. Sağlanmıyor: `resolveInsideRoot` yalnızca **kök içinde kalmayı** ölçer. `docs/features/F-001.md` **kök içindeki** bir dosyaya (ör. `src/index.ts`) symlink ise adım 3 realpath'i `src/index.ts` verir, adım 4 "kök içinde" der ve `atomicWrite` **`src/index.ts`'e yazar** — AC1 ("yalnızca üç hedef") delinir. Aynı şey `docs/features` dizini kök içi başka bir dizine symlink olduğunda da geçerli. | `resolveInsideRoot`'a ADR-005 adım 5-6'yı geri koy: `path.relative(root, targetPath)` POSIX'e çevrilip üç desenden birine **ve çağıran işleme** uymazsa `write_denied`. §6 tablosuna iki vaka: (a) `docs/features/F-001.md` kök içi symlink → `src/index.ts`, (b) `docs/features` kök içi dizin symlink'i; ikisi de reddedilmeli. |
| 4 | BLOKLAYICI | §3 madde 4 (s.160-177), §4 (s.259-266), CEO kararı F | **Fonksiyonlar `WriteResult` sözü veriyor ama fırlatıyor.** `mkdirSync` `try`'ın **dışında** (`docs/approvals` bir dosyaysa `ENOTDIR` fırlar), `finally`'deki `unlinkSync` Windows'ta `EPERM` fırlatıp dönüş değerini ezer, `setFeatureStatus`'un `readFileSync`'i olmayan dosyada `ENOENT` fırlatır (F-007'nin ana yolu: kart varken dosya dışarıdan silinmiş). CEO kararı F'nin "yazma hatası süreci öldürmez" iddiasının ne testi ne mutasyonu var; ADR-013 Sonuç 3'ün istediği "hata sınırı **bağlı** mı" mutasyonu da yok. F-002 B1 ve F-005 bloklayıcısının birebir üçüncü tekrarı. | `mkdirSync`'i `try` içine al, `finally`'yi kendi `try/catch`'ine sar, `readFileSync`/`realpathSync`'i yakala; §4'e "bu modül **asla fırlatmaz**" invaryantını yaz. §8'e iki mutasyon: (a) `docs/approvals`'ı dosya yap + hedef `.md`'yi sil → dört fonksiyon da fırlatmadan `write_failed` dönmeli, (b) `withDispatchErrorBoundary` sarmalayıcısı kaldırılınca KIRMIZI veren test. |
| 5 | ÖNEMLİ | §6 `DENIED` listesi (s.335-337) | Liste ADR-005 madde 10 ve mimari §11.4b'nin **kendi listesinden dar**: `cp*`, `copyFileSync`, `createWriteStream`, `truncate*` yok; ayrıca write-gate'in **kendi kullandığı** `openSync`/`writeSync` çifti yok — bir bypass en olası biçimde (kopyala-yapıştır) taramadan geçer. §11.4b'nin istediği `0.0.0.0`/`MC_HOST` literal taraması da bu testte yok (`tests/no-external-host.test.ts:80-84`'te var). | `DENIED`'a `copyFile`, `cp(`, `cpSync`, `createWriteStream`, `truncate`, `ftruncate`, `openSync`, `writeSync`, `promises.open(` ekle; §6'ya "literal taraması `no-external-host.test.ts`'te, tekrar edilmiyor" cümlesini yaz. |
| 6 | ÖNEMLİ | §6 (s.328-345) | Sözleşme F-005'in dersini **yanlış aktarıyor**: `no-delete-guard.test.ts:61-74` istisnayı DOSYA seviyesinden **DİZGE seviyesine** indirmişti (`unlinkSync(tmpPath)` dışında her çağrı KIRMIZI). Yeni guard ise `jsonl-store.ts`, `projects-registry.ts`, `retention.ts`'i **dosya seviyesinde** muaf tutuyor → bu üç dosyadan izlenen bir proje köküne yazan/silen bir mutasyon iki guard'a da görünmez, manifest testi de onları hiç çağırmadığı için yakalamaz. | Üç store dosyası için dizge-seviyesi daraltma (`unlinkSync` yalnızca `unlinkSync(tmpPath)` biçiminde; silme çağrıları yalnızca `retention.ts`'in kendi desenlerinde) ya da bu dosyaların yazdığı yolun `MC_DATA_DIR` altında kaldığını ölçen ayrı çalışma-zamanı testi. |
| 7 | ÖNEMLİ | §7 (s.430-434), §8 madde 6-7 | **Rota başına çit yok.** Test yalnızca `POST /api/projects` üzerinden anlatılıyor; `DELETE /api/projects/:id` (dağıtıcıda ayrı dal, `index.ts:338`) adlandırılmamış. Ayrıca GET uçlarının (`GET /api/events`, `/api/stream`, `GET /api/projects`) başlıksız çalışmaya devam ettiğini ölçen regresyon assert'i yok — F-003'ün `/api/stream` muafiyeti dersi tam bu sınıf. | §7'ye tablo: `POST /api/projects` · `DELETE /api/projects/:id` · `POST /api/events` (muaf, içerik tipi zorunlu) · üç GET ucu (başlıksız 200) — her satır ayrı `it`. |
| 8 | ÖNEMLİ | §3 madde 5 (s.187-207), §5 (s.201) | **BOM'lu dosyada algoritma çalışmıyor** (ölçüldü): ilk eleman BOM + `---` olduğu için "frontmatter yok" → `invalid_body`; mimari §11.1 BOM'u zorunlu fixture sayıyor, §7.2 adım 1 "BOM korunur" diyor. Ayrıca 12+ fixture kümesi sözleşmede **sayılmamış**; kritik dört vaka yok: frontmatter'da `status` yokken **gövdede** girintisiz `status:`, `status : değer` (boşluklu), iki `---` bloğu, son satırda ayraç yok. | §3 madde 5'e: BOM karşılaştırmadan önce **soyulur, çıktıda korunur**; satır bulma `/^status\s*:/` (startsWith DEĞİL); arama **yalnızca açılış/kapanış arasında**. §5'e 12 fixture'ı isim isim listele ve kanıt assert'ine `parts.length` eşitliğini ekle. |
| 9 | ÖNEMLİ | §3 madde 4 (s.160-186) | ADR-005 madde 5 ve mimari §7.2 adım 8'in **50/100/200 ms, 3 denemeli `EPERM`/`EBUSY` yeniden denemesi** yalnızca düz metinde geçiyor; kod taslağında tek deneme var, testi ve mutasyonu yok, senkron API'de bekleme mekanizması tanımsız. Testsiz katman = ölçülmeyen katman. | Kod taslağına döngüyü ekle, bekleme mekanizmasını adıyla yaz, §5'e "3. denemede de `EPERM` → `write_failed`" birim testi, §8'e "denemeleri 1'e düşür → KIRMIZI" mutasyonu. |
| 10 | ÖNEMLİ | §6 manifest (s.355-376), §8 | Manifest testinin **İDDİA B'yi kanıtlayan mutasyonu yok**: "izin verilmeyen bir dosya değişti" senaryosu listede geçmiyor. Fixture mimari §11.4a'nın zengin fixture'ından dar (`.claude/`, `docs/qa/`, `package.json`, kök içi symlink yok) ve `docs/approvals/archive` **var** olarak kuruluyor, yani `mkdirSync` ile ilk kez oluşturma yolu hiç koşulmuyor. | §8'e mutasyon 11: `writeGateApproval`'ın hedefini `README.md` yap → İDDİA B KIRMIZI. Fixture'a `.claude/`, `docs/qa/latest.md`, `package.json` ve bir kök içi symlink ekle; `archive/` dizinini **oluşturma** (ilk `archiveDenial` yaratsın). |
| 11 | ÖNEMLİ | §6 tablo (s.305-321) | ADR-005'in adıyla saydığı **önek tuzağı** (`C:/dev/app` kökü ile `C:/dev/app-factory` hedefi) tabloda yok; mimari §11.1 bunu ayrı satır olarak istiyor. Ayrıca `root` hiç yokken / `root` bir dosyayken / göreli verildiğinde davranış tanımsız (adım 2'nin döngüsü kök diske kadar tırmanır). | Tabloya üç satır: önek tuzağı, `root` yok, `root` bir dosya (ikisi de `write_denied`); §3 madde 1'e "`root` mutlak ve dizin değilse hiçbir şey yapılmaz" cümlesi. |
| 12 | ÖNEMLİ | §5 AC5 satırı (s.289) | AC5'in statik taraması **somut değil**: hangi dosya taranıyor, hangi desenler yasak, `write-gate.ts` kapsamda mı yazmıyor. Bu hâliyle test hiçbir şey bulmayacak biçimde yazılabilir ve sonsuza dek yeşil kalır — üstelik modülün kendi `timestamp.replace(/[:.]/g,'-')` çağrısı (§3 madde 6) taramayla çelişme riski taşıyor. | §5'e: tarama **yalnızca** `src/server/write-gate.ts`'i okur; yasak desen = elle ayraç bölme/değiştirme (ters bölü veya eğik çizgi ile `split`/`replace` üzerinden yol kurma); dosya adı sanitizasyonu istisnası testte adıyla beyaz listelenir. |
| 13 | NOT | §2 (s.83-101), feature notu s.23-24 | Sözleşme feature notunun dosya sahipliği listesinin **dışında dört dosyaya** dokunuyor: `src/shared/types.ts`, `src/server/index.ts`, `src/web/lib/write-fetch.ts`, `src/features/projects/web/useProjects.ts`. CEO kararı yalnızca sonuncusunu onayladı. | §2'nin başına "sahiplik genişletme talebi" satırı: dört dosya + tek cümlelik gerekçe; feature notunu CEO güncellesin. |
| 14 | NOT | §1, §3 | Mimari §7.3 (echo bastırma — yazmadan hemen önce `selfWrites.set(realpath(target))`) sözleşmede **hiç geçmiyor**; F-007 bunu write-gate'in içinde mi dışında mı bekleyeceği belirsiz. | §1 "Kapsam DIŞI" listesine tek satır: "§7.3 echo bastırma F-007'de; `write-gate.ts` bu turda izleyiciyi bilmiyor". |

### CEO kararları yayılma kontrolü

| Karar | Gövdeye işlenmiş mi | Kanıt / eksik |
|---|---|---|
| **A** ADR-013: dağıtıcıda tek yer, istemcide tek sarmalayıcı, çitlenme zorunlu | **Kısmen** | Kontrol §7 s.388-398'de dağıtıcıda, sarmalayıcı §2.1 `write-fetch.ts` — doğru. Eksik: rota başına çit (Bulgu 7), "sınır bağlı mı" mutasyonu (Bulgu 4). |
| **B** Yazma kapısı tek bileşen + statik tarama | **Kısmen** | §1.1 ve §6 var; tarama listesi ADR'den dar (Bulgu 5), üç store dosyası dosya seviyesinde muaf (Bulgu 6). |
| **C** Silme yok, arşiv = taşıma | **Evet** | §3 madde 6 (s.209-222) `unlink` hiç çağrılmaz; §5 AC3 satırı davranışı da ölçüyor; §8 mutasyon 4. |
| **D** Manifest hem silmeyi hem değişikliği yakalar | **Kısmen** | §6 İDDİA B/C/D içerik + küme + uzunluk üçlüsünü kuruyor; İDDİA B'yi kanıtlayan mutasyon yok (Bulgu 10). |
| **E** F-006 arayüz yazmaz | **Evet** | §5 s.295-297: hiçbir jsdom/RTL/Playwright testi yok; §1 kapsam dışı listesi. |
| **F** Hata sınırı yeni uçları kapsar, yazma hatası süreci öldürmez | **Hayır** | Yalnızca §5 s.293'te bir yan cümle. Yeni uç açılmaması gerekçesi kabul edilebilir (§1.7), ama "yazma hatası süreci öldürmez" ne tasarımda (fırlatan üç yol) ne testte ne mutasyonda karşılanıyor → **Bulgu 4**. |
| **G** Kapsam dışı: kanban/kapılar UI, Faz 2 | **Evet** | §1 s.67-77; §1.7'nin "bugün tüketicisi olmayan uç açılmaz" gerekçesi tutarlı. Kapsam sızması bulunamadı. |
| **Karar 1** `/api/events` başlıktan muaf, `Content-Type` zorunlu | **Hayır** | Gövdenin altı bölümünde iz yok, §7 hâlâ düz muafiyet → **Bulgu 1 + 2**. |
| **Karar 2** `useProjects.ts`'e minimum dokunuş | **Evet** | §2.2 s.101 yalnızca iki `fetch` çağrısını sarmalıyor; `load()` (`useProjects.ts:49`, GET) dışarıda, `:73` ve `:105` gerçekten tek yazma çağrıları — doğrulandı. Tek eksik, §9'un hâlâ soru kipinde olması (Bulgu 1). |

### İçerik tipi zincirinin denetimi

Zincirin doğru olan kısmı (doğrulandı): `application/json` CORS güvenli listesinde değildir →
çapraz kaynaklı `fetch` preflight tetikler → panel `OPTIONS`'a hiçbir CORS başlığı dönmez
(`src/server/index.ts:353-356`, `/api/` altındaki eşleşmeyen istek düz 404) → tarayıcı isteği
bloklar. Yani **preflight gerçekten kabul edilmiyor**. Delikler:

- **D1 — güvenli listede üç tip var, karar metni ikisini sayıyor.** `multipart/form-data` da
  güvenli listededir. Kontrol denylist olarak yazılırsa bu tip geçer ve gövde JSON ayrıştırıcısına
  **ulaşır**: `ingest.ts:58-59` içerik tipine hiç bakmadan `Buffer.concat(chunks).toString('utf8')`
  yapıyor, JSON değilse mimari §6.1 s.382 gereği `parse_error` bayrağıyla **yine de kaydediliyor**.
  Reddedilmeyen her tip = sahte olay yazma yetkisi. **Allowlist zorunlu.**
- **D2 — katı eşitlik mi, önek mi.** Hook `'content-type': 'application/json'` gönderiyor
  (`.claude/hooks/send-event.cjs:153`; küçük harf, `charset` eki **yok**);
  `scripts/install-hook.mjs:155` dosyayı birebir kopyalıyor ve dosyanın tek sürümü var
  (`git log`: 7d721bd) → **katı eşitlik bugün kurulu kopyaları kırmaz.** Ama
  `application/json; charset=utf-8` gönderen istemcileri (Playwright `request.post`, curl,
  gelecekteki hook sürümü) sessizce düşürür. Doğrusu: `;` öncesini al → `trim().toLowerCase()` →
  eşitlik.
- **D3 — başlığın hiç olmadığı durum tanımsız ve bu gerçek bir delik.**
  `navigator.sendBeacon(url, new Blob([json]))` (tipsiz Blob) **hiç `Content-Type` göndermez**,
  güvenli liste ihlali olmadığı için preflight tetiklenmez ve istek çapraz kaynaktan çıkar.
  "Eksik başlık = kabul" yazılırsa Karar 1'in kapattığı delik yeniden açılır. **Eksik başlık
  reddedilmeli.** Kırılma riski ölçüldü: `tests/integration/events-api.test.ts:160-161`
  ("content-type eksik" / "text/plain") yalnızca `status < 500` iddia ediyor (s.183), yani 400 ile
  de **yeşil kalır** — mevcut testler kırılmaz, ama yeni davranışı ölçmedikleri için §7'ye ayrı bir
  "reddedildi" assert'i gerekir.
- **D4 — muafiyet metottan bağımsız.** `pathname !== '/api/events'` koşulu tüm non-GET metotları
  muaf kılıyor. Bugün hepsi 404'e düşüyor, ama `/api/events`'e ikinci bir metot eklendiği gün
  koruma sessizce yok olur. `req.method === 'POST' &&` ile daralt.
- **D5 — kontrolün yeri.** `ingest.ts` içine konursa (a) F-002/F-004 dosya sahipliği ihlal edilir,
  (b) muafiyet dağıtıcıda, kontrol handler'da kalır ve ADR-013'ün "tek yer" sonucu delinir.
- **D6 — kalan artık risk (yazılmalı):** tarayıcı olmayan yerel bir süreç her iki başlığı da
  gönderebilir; ADR-013'ün tehdit modeli zaten tarayıcıyla sınırlı. `isAllowedOrigin`
  (`index.ts:118`) `Origin` yokluğunu `true` saydığı için `/api/events` ayağında **tek** koruma bu
  içerik tipi kontrolüdür — çitlenmesi tavizsiz.

### setFeatureStatus kenar durum tablosu

Sözleşme §3 madde 5'in algoritması birebir kodlanıp çalıştırıldı (`split(/(\r\n|\n)/)` +
frontmatter sınırı + girintisiz ilk `status:` + `join('')`):

| Vaka | Ölçülen sonuç | Değerlendirme |
|---|---|---|
| BOM + `---` | **"frontmatter yok" → yazma yok** | **HATA** — mimari §11.1 BOM fixture'ı, §7.2 adım 1. Bulgu 8. |
| Saf CRLF | `status` değişti, tüm CRLF korundu | Doğru |
| Karışık CRLF/LF | Her ayraç kendi elemanında korundu | Doğru |
| Son satırda ayraç yok | Kayıpsız `join`, kuyruk korundu | Doğru |
| Kapanış `...` | Bulundu, doğru satır değişti | Doğru (mimari §7.2 adım 4) |
| Girintili + girintisiz `status:` birlikte | Girintili atlandı, girintisiz değişti | Doğru (`/^status\s*:/` ile) |
| Frontmatter'da `status` yok, **gövdede** girintisiz `status:` | "status yok" (arama kapanışta durdu) | Doğru **ama yalnızca arama sınırı kapanışa bağlanırsa**; sözleşme bunu §3'te yazmıyor → fixture zorunlu |
| İki `---` bloğu (gövdede ikinci `status:`) | Yalnızca ilk blok değişti | Doğru |
| `status` anahtarı hiç yok | "status yok" → yazma yok | Doğru |
| Frontmatter hiç yok | "frontmatter yok" → yazma yok | Doğru |
| `status : todo` (iki nokta öncesi boşluk) | Regex ile **çalışıyor**, `startsWith('status:')` ile **kaçıyor** | Sözleşme birini sabitlemeli (Bulgu 8) |

**Kanıt yöntemi:** `parts` dizisini eleman-eleman karşılaştırmak, `join('')` kayıpsız olduğu için
"status satırı dışında hiçbir bayt değişmedi"yi **gerçekten kanıtlar** — ancak `parts.length`
eşitliği de assert edilirse. Aksi hâlde `safe()` satır sonu içeren bir değeri tırnaklamayı
kaçırdığında dizi uzar, indeks hizası kayar ve karşılaştırma yanlış yerden geçer. En tehlikeli
vaka BOM değil (görünür ret), **arama sınırının yazılmamış olmasıdır**: sınır kapanışa
bağlanmazsa gövdedeki bir `status:` satırı sessizce yeniden yazılır.

### Ölçmeyen test riski

1. **Manifest testi tamamen ölü bir `write-gate` ile de büyük ölçüde yeşil kalır.** İDDİA A
   ("değişenler ⊆ izinliler") ve İDDİA B ("diğerleri aynı") **hiçbir yazma olmadığında da**
   doğrudur; yalnızca İDDİA C bunu kısmen yakalar. §6'ya her senaryo için "çağrı `ok:true` döndü
   **ve** beklenen dosyanın `sha256`'sı değişti" pozitif assert'i eklenmeli.
2. **AC2'nin export yüzeyi testi** "beşinci export sızarsa kırılır" iddiasını ancak
   `toEqual([tam liste])` ile taşır; `toContain` biçimi sonsuza dek yeşil kalır.
3. **AC5 statik taraması** desen listesi olmadan yazılırsa hiçbir şey bulamaz ve asla kırılmaz
   (Bulgu 12) — projenin on kez tekrarlanan "yeşil ama ölçmeyen test" kalıbı.
4. **§8 mutasyon 9 kendi kaçış kapısını taşıyor** ("yorumla belgelenip atlanır"). Mutasyon planı
   koşullu olamaz: ya her fonksiyonun ürettiği `targetPath` şablonuna kilitlenir (Bulgu 3 zaten
   bunu gerektiriyor) ya da madde silinir.
5. **`no-write-gate-bypass` körlük assert'i** (`files.length > 0`) taranan dosya sayısını ölçer,
   `DENIED` listesinin **çalıştığını** ölçmez; §8 mutasyon 5'teki negatif kontrol fixture'ı
   mutasyon değil **kalıcı test vakası** olmalı.

### Kod turuna başlamadan önce kapatılması gereken tek şey

Bulgu 1-4 (bloklayıcılar). Bulgu 3 ve 4 "kod turunda bakarız" denemeyecek tasarım kararlarıdır:
birincisi AC1'i, ikincisi CEO kararı F'yi doğrudan geçersiz kılıyor.

---

## Developer düzeltme yanıtı — tur 2 (2026-09-05)

Bu turda **yalnızca bu sözleşme dosyası** değiştirildi (`git status` bunu doğrular); `src/`,
`tests/`, `scripts/`, `.claude/`, `.github/`, `docs/**` (bu dosya hariç) dokunulmadı. D29-D33'e
(CEO kararları, bağlayıcı) itiraz edilmedi, hepsi gövdeye işlendi. Aşağıda QA'nın **her** bulgu
numarası için ne değiştiğinin dosya/bölüm referansı:

| # | Ne değişti | Nerede |
|---|---|---|
| 1 (BLOKLAYICI, CEO Karar 1 yayılmamış) | §1 madde 7 + yeni "İçerik tipi allowlist'i" alt bölümü, §2.1 (`adr-013-write-header.test.ts` amacı güncellendi), §2.2 (`send-event.cjs`/`index.ts` satırları), §5 (AC eşlemesi dolaylı), §7 (tam yeniden yazım — kod bloğu, kural listesi, rota tablosu), §8 (mutasyon 7-8), §9 (bilgi notu 1 → "KARAR VERİLDİ") olarak gövdeye işlendi. §2.2 "okunmadı bile" ifadesi "✓ VERIFIED, `:153` okundu" olarak düzeltildi. | §1, §2.1, §2.2, §5, §7, §8, §9 |
| 2 (BLOKLAYICI, içerik tipi tanımsız) | Allowlist (denylist değil), `;` öncesi + `trim().toLowerCase()`, başlıksız → red, yalnızca `POST /api/events`, dağıtıcı seviyesi, `400 invalid_body` — hepsi §7'de tek paragraf + kod bloğu + madde madde D1-D6 referanslı kurallar olarak yazıldı. | §1, §7 |
| 3 (BLOKLAYICI, symlink + işlem/yol eşleşmesi) | §3 madde 2 tamamen yeniden yazıldı: `resolveInsideRoot` artık `operation` parametresi alıyor, `OPERATION_PATTERNS` ile çalışma zamanı eşlemesi yapıyor, hedefin kendisi (`lstatSync`) ve tüm ata dizinler symlink kontrolünden geçiyor. §6 whitelist tablosuna iki QA vakası (dosya-seviyesi + dizin-seviyesi symlink) + işlem/yol uyumsuzluğu satırı eklendi, Windows test edilebilirliği (junction + zorunlu `vi.spyOn` ikili kanıt) tasarlandı. §8 mutasyon 9-11 eklendi (eski mutasyon 9'un "atlanabilir" kaçış kapısı kapatıldı). | §3 madde 2, §6, §8 |
| 4 (BLOKLAYICI, fırlatan fonksiyonlar) | §3 madde 4 tamamen yeniden yazıldı: `mkdirSync` `try` içine alındı, `finally`'deki `unlinkSync` kendi `try/catch`'ine sarıldı, `readFileSync`/`realpathSync` `write_failed`'a düşürüldü, EPERM/EBUSY için 50/100/200 ms 3 deneme döngüsü (`sleepSyncMs`/`Atomics.wait` ile adı konmuş senkron bekleme) eklendi. §4'e "asla fırlatmaz" invaryantı + CEO kararı F'nin kapsam sınırı (write-gate bu turda HTTP'ye bağlı değil) yazıldı. §8 mutasyon 12-13 eklendi. | §3 madde 4, §4, §8 |
| 5 (ÖNEMLİ, DENIED listesi dar) | `DENIED`'a `copyFile`, `cp(`, `cpSync`, `createWriteStream`, `truncate`, `ftruncate`, `openSync`, `writeSync`, `promises.open(` eklendi; `0.0.0.0`/`MC_HOST` taramasının `no-external-host.test.ts`'te olduğu ve tekrar edilmediği not edildi. | §6 |
| 6 (ÖNEMLİ, dosya-seviyesi istisna) | Üç store dosyası dosya-seviyesi istisnadan çıkarıldı; her birinin gerçek kaynak koduna bakılarak (✓ VERIFIED) tam izinli çağrı dizgeleri çıkarıldı ve dizge-seviyesi kontrol olarak yazıldı (`no-delete-guard.test.ts`'in `unlinkSync(tmpPath)` deseninin genellemesi). | §6 |
| 7 (ÖNEMLİ, rota başına çit yok) | §7'ye 12 satırlık rota-başına-çit tablosu eklendi: `POST`/`DELETE /api/projects`, `POST /api/events` (4 içerik-tipi varyantı), 3 GET ucu regresyon kontrolü. | §7 |
| 8 (ÖNEMLİ, BOM + fixture eksikliği) | §3 madde 5 tamamen yeniden yazıldı: BOM soyma (karşılaştırma amaçlı, bayt korunuyor), arama sınırı açılış/kapanış indeksleriyle kesin tanımlandı, `status\s*:` regex'i sabitlendi. §3 madde 5 sonuna 17 fixture'lık isim isim liste eklendi (mimarinin istediği 12+ eşiğinin üzerinde, QA'nın 11 kenar durumunun hepsi karşılığını buluyor). | §3 madde 5 |
| 9 (ÖNEMLİ, EPERM/EBUSY testsiz) | §3 madde 4'teki kod bloğuna retry döngüsü + `sleepSyncMs` eklendi; §9 riskler listesine "Atomics.wait event loop'u bloklar" notu eklendi (kayıt için, çitlenmiyor — retry testinin kendisi `write-gate.test.ts`'te tanımlı, §2.1). | §3 madde 4, §9 |
| 10 (ÖNEMLİ, manifest mutasyonu eksik) | §6 manifest testi bölümü yeniden yazıldı: fixture'a `.claude/`, `docs/qa/latest.md`, `package.json` eklendi, `archive/` dizini ÖNCEDEN OLUŞTURULMUYOR, İDDİA E (pozitif assert) eklendi, mutasyon 11 (README.md hedefi → İDDİA B KIRMIZI) eklendi. | §6, §8 mutasyon 18 |
| 11 (ÖNEMLİ, önek tuzağı + root kenar durumları) | §3 madde 1'e "root mutlak + dizin olmalı" adım 0'ı eklendi; §6 whitelist tablosuna önek tuzağı + `root` yok/dosya/göreli satırları eklendi. | §3 madde 1, §6 |
| 12 (ÖNEMLİ, AC5 somut değil) | §5 AC5 satırı: tarama hedefi (`write-gate.ts` tek dosya), yasak desen (elle ayraç bölme/kurma), `archiveDenial`'ın kendi sanitizasyon istisnası adıyla yazıldı. | §5 |
| 13 (NOT, sahiplik genişletme) | §2 başına "Sahiplik genişletme talebi" paragrafı eklendi — dört dosya + gerekçe, CEO/PM'in feature notunu güncellemesi gerektiği belirtildi. | §2 |
| 14 (NOT, echo bastırma) | §1 "Kapsam DIŞI" listesine tek satır eklendi. | §1 |

**"Ölçmeyen test riski" (1-5) — hepsi kapatıldı:** (1) manifest İDDİA E pozitif assert; (2) AC2
`toEqual` tam liste; (3) AC5 somut desen listesi; (4) mutasyon 9'un kaçış kapısı kapatıldı (D30
sayesinde artık koşulsuz çalışma-zamanı testi); (5) negatif-kontrol fixture'ı mutasyondan kalıcı
teste taşındı (§6).

**CEO'ya kalan sorular:** Yok — D29-D33 bağlayıcı kararlardı, itiraz hakkı tanınmadı ve hepsi
uygulandı. §9'daki iki eski "bilgi notu" da bu turda kapatıldı (Karar 1/2 üzerinden). Tek açık
nokta CEO'nun kendisinin zaten planladığı idari iş: ADR-013'e Karar 1'i özetleyen tek cümlelik not
eklemesi ve feature notunun dosya sahipliği listesinin dört-dosya genişlemesini yansıtacak şekilde
güncellenmesi (§2 "Sahiplik genişletme talebi") — bunlar kod turunu bloklamıyor.

**Risk (yeni, bu turdan):** `resolveInsideRoot`'un artık 8 adımlı, `operation` parametreli hâli
önceki 5 adımlı hâlden belirgin şekilde daha karmaşık. Bu karmaşıklık QA'nın kendi bulgusunun
(symlink + işlem/yol eşleşmesi delikleri) doğrudan sonucu ve zorunlu — ama kod turunda bu
fonksiyonun kendi birim testlerinin (whitelist tablosu, ~28 vaka) her adımı ayrı ayrı kapsadığından
emin olunmalı, tek büyük "mutlu yol" testi yeterli olmayacaktır.

---

## QA doğrulama — tur 2 (qa-evaluator, 2026-09-05)

**KARAR: DÜZELTME** · **ESKALE: false**

Kapanmayan: 1 BLOKLAYICI (regresyon) + 3 ÖNEMLİ (üçü de regresyon) + 1 KISMİ · 2 NOT.
Tur 1'in 14 bulgusunun 13'ü KAPANDI, 1'i KISMİ. **Yeni kusurların tamamı bu turun düzeltmelerinin
ürettiği regresyonlardır** — kapsam dışına çıkılmadı; CEO kararları A-G / Karar 1-2, niyet
fonksiyonu adları, kapsam denetimi ve biçim yeniden açılmadı.

**Yöntem (dar tur):** §1-§9 gövdesi CEO kararları + D29-D33'e karşı okundu; iddialar
`src/server/index.ts:288-356`, `src/server/store/jsonl-store.ts`,
`src/server/store/projects-registry.ts`, `src/server/store/retention.ts`, `src/shared/types.ts:38-39`,
`tests/features/projects/no-delete-guard.test.ts`, `docs/02-architecture.md:176/532/535/545`,
`ADR-005 madde 5` **okunarak** doğrulandı. `OPERATION_PATTERNS` ile junction/`lstat` davranışı
scratchpad'de **çalıştırıldı** (aşağıda). Hiçbir proje dosyası değiştirilmedi; yalnızca bu bölüm
eklendi.

### Tur 1 bulgularının kapanış tablosu

| # | Şiddet | Durum | Kanıt |
|---|---|---|---|
| 1 | BLOKLAYICI | **KAPANDI** | CEO Karar 1 gövdeye yayıldı: §1 madde 7 (s.55-70) + "İçerik tipi allowlist'i" alt bölümü (s.71-90), §2.1 `adr-013-write-header.test.ts` amacı, §2.2 (`send-event.cjs:153` artık ✓ VERIFIED), §4 "API sözleşmesi notu" (s.472-478), §7 tamamen yeniden yazıldı, §8 mutasyon 7-8, §9 madde 1-2 "KARAR VERİLDİ". §7'de **düz muafiyet kalmadı** (s.730-737 muafiyeti içerik tipine devrediyor). Gövde ile sondaki karar bölümleri arasında çelişki bulunamadı. |
| 2 | BLOKLAYICI | **KAPANDI** | §7 s.662-676 kod bloğu + s.680-697 kural listesi: allowlist, `;` öncesi + `trim().toLowerCase()`, başlıksız → red, yalnızca `POST /api/events`, dağıtıcı seviyesi, 400 `invalid_body`. §1 s.71-90 ile **birebir aynı** ifade (bir yerde denylist / başka yerde allowlist çelişkisi yok). `invalid_body` mevcut `ErrorCode` (`src/shared/types.ts:38`) ✓. |
| 3 | BLOKLAYICI | **KAPANDI** (→ R1, R3 doğurdu) | §3 madde 2 s.168-227: adım 2 hedef `lstatSync`, adım 3 ata segment döngüsü, adım 5'te realpath artık **güvenlik sınırı değil** (s.207-209, yalnızca harf kanonikleştirme), adım 8 `OPERATION_PATTERNS` çalışma zamanında (s.185-190, 214-218). §6 tabloya üç satır, §8 mutasyon 9-11. Tasarım doğru; iki uygulanamaz nokta aşağıda (R1, R3). |
| 4 | BLOKLAYICI | **KAPANDI** | §3 madde 4 s.239-305: `mkdirSync` `try` **içinde** (s.268), `finally`'deki `unlinkSync` kendi `try/catch`'inde (s.283-288), `readFileSync`/`realpathSync` `write_failed`'a düşürülüyor (s.302-306), `resolveInsideRoot` dış `try/catch` (s.219-221). §4 s.458-470 invaryant + mutasyon 12 (ENOTDIR fırlatma) ve 13 (`withDispatchErrorBoundary` bağlantısı). |
| 5 | ÖNEMLİ | **KAPANDI** (→ R4) | §6 s.553-555 `DENIED`: `copyFile`, `cp(`, `cpSync`, `createWriteStream`, `truncate`, `ftruncate`, `openSync`, `writeSync`, `promises.open(` eklendi; `0.0.0.0`/`MC_HOST` tekrarı `no-external-host.test.ts`'e bırakıldı. Listenin **biçimi** ayrı sorun (R4). |
| 6 | ÖNEMLİ | **KAPANDI** | §6 s.557-582: üç store dosyası dosya-seviyesi istisnadan çıkarıldı, dizge-seviyesi izinli küme yazıldı. İzinli dizgelerin **hepsi gerçekten kaynakta var** (✓ VERIFIED): `jsonl-store.ts:119,187,218` · `projects-registry.ts:76,78,79,83` · `retention.ts:52` (dosyanın gerçek yolu `src/server/store/retention.ts`). |
| 7 | ÖNEMLİ | **KAPANDI** | §7 s.699-714: 12 satırlık rota tablosu — `POST`/`DELETE /api/projects` (`DELETE` dalı `index.ts:338` ile eşleşiyor), 5 içerik-tipi varyantı (`text/plain`, eksik, `multipart/form-data`, `application/json`, `; charset=utf-8`), 3 GET regresyon satırı. |
| 8 | ÖNEMLİ | **KAPANDI** | §3 madde 5 s.317-392: BOM yalnızca karşılaştırmada soyuluyor (`parts[0]` değişmiyor), arama `[2, closingIdx)` aralığında, `/^status\s*:/` sabitlendi, 17 fixture isim isim (s.375-391). `...` kapanışı **mimari s.535'in kendi ifadesi** ("sonraki `---` veya `...` satırı kapanıştır") — kapsam genişletmesi değil. QA'nın 11 kenar durumunun 10'u fixture'larda birebir; "status anahtarı hiç yok" vakası fixture 17'nin içinde örtülü. |
| 9 | ÖNEMLİ | **KISMİ** | Döngü + `sleepSyncMs` §3 madde 4'te (s.246-252, 291-303), retry testi §2.1'de — ama tur 1'in açıkça istediği **"denemeleri 1'e düşür → KIRMIZI" mutasyonu §8'de yok** (18 maddenin hiçbiri retry'ı mutasyonlamıyor). Developer bunu kendi tablosunda kabul ediyor (s.1029: "çitlenmiyor"). Ölçülmeyen katman riski sürüyor. |
| 10 | ÖNEMLİ | **KAPANDI** (→ R2) | §6 s.608-658: fixture'a `.claude/settings.json`, `docs/qa/latest.md`, `package.json` eklendi; `archive/` **bilinçli olarak oluşturulmuyor**; İDDİA E pozitif assert (s.639); mutasyon 18 / §6 mutasyon 11 (README.md hedefi). İDDİA B'nin metni artık İDDİA A/E ile çelişiyor (R2). |
| 11 | ÖNEMLİ | **KAPANDI** | §3 madde 1 s.163-167 adım 0 (`root` mutlak + `isDirectory`); §6 tabloda önek tuzağı + `root` yok/dosya/göreli satırları (s.526-530). Önek tuzağı gerekçesi mimari s.176 ile uyumlu. |
| 12 | ÖNEMLİ | **KAPANDI** | §5 AC5 satırı s.491: tarama hedefi tek dosya (`write-gate.ts`), yasak desen (elle ayraç bölme/kurma), `timestamp.replace(/[:.]/g,'-')` istisnası adıyla beyaz listelendi. |
| 13 | NOT | **KAPANDI** | §2 s.112-121 "Sahiplik genişletme talebi" — dört dosya + gerekçe + CEO/PM'e görev. |
| 14 | NOT | **KAPANDI** | §1 "Kapsam DIŞI" s.104-107 echo bastırma satırı. |
| Ölçmeyen 1 | — | KAPANDI (→ R2) | İDDİA E (s.639). |
| Ölçmeyen 2 | — | KAPANDI (→ R3) | §5 AC2 `toEqual([4 ad])` (s.488). |
| Ölçmeyen 3 | — | KAPANDI | §5 AC5 somut desenler (s.491). |
| Ölçmeyen 4 | — | KAPANDI (→ R3) | Mutasyon 9-11 koşulsuz; "yorumla belgelenip atlanır" kaçış kapısı kalktı. |
| Ölçmeyen 5 | — | KAPANDI | §6 s.593-601: negatif-kontrol fixture'ı mutasyondan **kalıcı teste** taşındı. |

### D29-D33 uyum kontrolü

| Karar | Uyum | Kanıt / kalan |
|---|---|---|
| **D29** içerik tipi allowlist | **Tam** | Kuralın beş parçası da eksiksiz ve §1 s.71-90 ile §7 s.680-697'de **aynı** yazılmış. **Delik aranışı — bulunamadı:** §7 s.667-675'teki if/else zinciri bilinmeyen veya küçük harfli metodu (`post`) `else if (req.method !== 'GET' …)` dalına düşürüyor → `x-mc-write` ister, **fail-closed**; `HEAD` de aynı dala düşer; rotalar `index.ts:318-339`'da **tam eşleşme** olduğundan `/api/events/` allowlist'i atlayamaz (403 alır, 404'e bile gitmez); `content-type` yinelendiğinde Node ilk değeri korur, `typeof raw === 'string'` varsayımı geçerli. Kalan (yeni değil, D6'nın içinde): doğru `Content-Type` + JSON olmayan gövde `ingest.ts`'te `parse_error` bayrağıyla yine kaydedilir — tarayıcı bu isteği preflight olmadan atamadığı için kabul edilmiş artık risk. Çit tablosu 5 içerik-tipi varyantını, hook'un tam biçimini ve 3 GET regresyonunu ölçüyor. |
| **D30** symlink savunması | **Tasarım tam, iki uygulama noktası kırık** | `lstatSync` hem hedefe hem her var olan ata segmentine uygulanıyor; realpath açıkça "güvenlik sınırı değil" (s.207-209) — ölçümle de desteklendi (aşağıda realpath junction'ı çözüp gizliyor). `OPERATION_PATTERNS` gerçekten geri geldi (s.185-190) ve adım 8 çalışma zamanı kontrolü, "yapısal garanti" iddiası kalmadı. "Atlanabilir test GEÇTİ'ye katkı saymaz" kuralı **yazılı** (§6 s.538 + §9 risk 3 s.821). Ama `OPERATION_PATTERNS.archive` hiçbir gerçek arşiv adını kabul etmiyor (**R1**) ve adım 8'in tek testi/mutasyonu erişilemez bir fonksiyona dayanıyor (**R3**). |
| **D31** asla fırlatmaz | **Tam** (retry mutasyonu KISMİ) | Bulgu 4 satırındaki kanıtlar. **`Atomics.wait` değerlendirmesi:** Node'da ana iş parçacığında izinlidir (tarayıcının aksine) ve gerçekten bloklar; ancak `write-gate.ts` bu turda **hiçbir HTTP handler'a bağlı değil** (§1 madde 7, §4 s.463-470), dolayısıyla bugün hiçbir isteği geciktirmiyor — seçim kabul edilebilir ve §9 risk 4 (s.826) en kötü hâli (~350 ms) adıyla yazmış. Kayda geçsin: **F-007 write-gate'i `PATCH /api/features`'a bağladığı gün bu 350 ms sunucunun tüm isteklerini durdurur**; o turun sözleşmesi bunu yeniden değerlendirmeli (bugün bulgu değil). Dağıtıcı sınırının **bağlı** olduğunu ölçen mutasyon 13 var. |
| **D32** statik tarama | **İçerik tam, biçim kırık** | Liste ADR-005 madde 10 / mimari §11.4b ile eş; istisnalar dize seviyesinde (F-005'in kazanımı geri alınmamış); körlük assert'i + kalıcı negatif kontrol duruyor. Desenlerin **çıplak alt dizge** biçimi çiti doğuştan kırmızı yapıyor (**R4**). |
| **D33** arama sınırı | **Tam** | Arama açılış `---` ile kapanış arasında (`[2, closingIdx)`); kapanış yoksa `invalid_body`, gövdeye asla inilmiyor. `...` kapanışı mimari s.535 ile **doğrulandı** — gereksiz genişletme değil; yanlış tarafa hata yapsa bile "yazmayı reddet" yönünde, güvenli. BOM iddiası tutarlı: yalnızca `parts[0]`'ın kopyası soyuluyor, eleman değişmiyor, `join('')` baytları koruyor. `/^status\s*:/` `status : x`'i yakalıyor, girintili `  status:`'ü satır başı çapasıyla atlıyor. 17 fixture tur 1'in 11 vakasını karşılıyor. |

### Junction ölçümü (görev maddesi 3 — bu makinede, yönetici hakkı olmadan çalıştırıldı)

Scratchpad'de geçici dizin açılıp `node` ile ölçüldü; dizin `fs.rmSync` ile temizlendi, artık dosya
veya süreç kalmadı.

| Ölçüm | Sonuç |
|---|---|
| `fs.symlinkSync(hedef, link, 'junction')` yönetici izni olmadan | **başarılı** (`created: true`) |
| `fs.lstatSync(junction).isSymbolicLink()` | **`true`** — sözleşmenin adım 2/3 kontrolü junction'ı yakalar |
| `fs.lstatSync(junction).isDirectory()` | `false` (reparse point, `lstat` izlemiyor) |
| `fs.statSync(junction).isDirectory()` | `true` (izliyor) — `existsSync`/`statSync` tabanlı bir kontrol deliği **gizlerdi** |
| `fs.realpathSync.native(junction) !== junction` | `true` — **realpath junction'ı çözüp deliği gizliyor**; "realpath güvenlik sınırı değil" gerekçesi ölçümle doğrulandı |
| Ata segment senaryosu: `lstat(path.dirname(<junction>/F-001.md))` | `true` → adım 3 gerçekten ölçebiliyor |
| `fs.symlinkSync(dosya, link, 'file')` (dosya-seviyesi) | **`EPERM`** — yönetici/Geliştirici Modu olmadan oluşmuyor |

**Sonuç:** developer'ın ikili tasarımı doğru ve junction beklendiği gibi davranıyor. Dizin-seviyesi
vaka determinist olarak kurulabiliyor; dosya-seviyesi vaka bu makinede fiilen `EPERM` veriyor, yani
**zorunlu `vi.spyOn(fs, 'lstatSync')` testi taşıyıcı testtir** ve fırsatçı gerçek symlink denemesi
bu ortamda atlanacaktır (sözleşme onu GEÇTİ'ye saymıyor — doğru).

### YENİ (regresyon) — bu turun düzeltmelerinin ürettiği kusurlar

| # | Şiddet | Bölüm/satır | Bulgu | İstenen düzeltme |
|---|---|---|---|---|
| **R1** | **BLOKLAYICI** | §3 madde 2 s.189 (`OPERATION_PATTERNS.archive`) vs. §3 madde 6 s.399-402 | **Geri getirilen adım 8, `archiveDenial`'ı tamamen kilitliyor.** Arşiv adı `` `${gate}-${new Date().toISOString().replace(/[:.]/g,'-')}.deny.md` `` → `G2-2026-09-05T14-58-24-375Z.deny.md`; desendeki `[0-9-]+` `T` ve `Z` karakterlerini kabul etmiyor. **Ölçüldü** (aynı regex + aynı zaman damgası üretimi scratchpad'de çalıştırıldı): `archive → false`, `G4-2` varyantı → `false`; diğer üç desen (`approval`/`denial`/`featureStatus`) → `true`. Sonuç: her `archiveDenial` çağrısı `write_denied` döner → §6 tablosunun `archiveDenial | .deny.md mevcut | ✓` satırı (s.524), §6 manifest senaryosunun `archiveDenial` pozitif assert'i (s.626-628) ve İDDİA C (s.635) **yapısal olarak KIRMIZI** doğar; AC3'ün arşiv yolu karşılanamaz. | `archive` desenini gerçek zaman damgası alfabesine göre yaz (ör. `-\d{4}-\d{2}-\d{2}T[\d-]+Z\.deny\.md$` ya da en azından `[0-9TZ-]+`) **ve** §6 tablosuna "üretilen arşiv adı kendi `OPERATION_PATTERNS.archive` desenine uyar" satırını ekle — yoksa iki bölüm yeniden birbirinden kayar. |
| **R2** | **ÖNEMLİ** | §6 manifest s.629-641 (İDDİA A ↔ İDDİA B/E) | **İDDİA B, aynı turda eklenen İDDİA E ile çelişiyor.** İDDİA A `docs/features/F-001.md` ve `docs/approvals/G1.ok`'u "değişebilir" sayıyor, İDDİA E bu dosyaların sha256'sının **değiştiğini zorunlu kılıyor**, İDDİA B ise "`manifestBefore`'daki HER relPath (**yalnızca** `G2.deny.md` hariç) aynı (relPath,size,sha256) ile var" diyor. Fixture'da F-001.md ve G1.ok **önceden var** (s.612-615) → İDDİA B kaçınılmaz KIRMIZI. Tur 1'de İDDİA E yokken çelişki görünmüyordu; pozitif assert eklenince açığa çıktı. | İDDİA B'nin istisnasını "İDDİA A'nın izinli kümesi + `G2.deny.md`" olarak yaz (tek cümle). |
| **R3** | **ÖNEMLİ** | §5 AC2 s.488 (`toEqual` 4 ad) ↔ §4 s.455 ↔ §6 s.521 + §8 mutasyon 11 s.768-772 | **Adım 8'in tek testi ve tek mutasyonu erişilemez bir fonksiyona dayanıyor.** §4 s.455 `operation` etiketinin "dışa açık olmadığını", AC2 testi de export yüzeyinin **tam olarak dört ad** olduğunu (`toEqual`) sabitliyor; §6 s.521'in "yanlış `operation` etiketiyle çağrı" satırı ve mutasyon 11 ise `resolveInsideRoot`'un test dosyasından **doğrudan çağrılabildiğini** varsayıyor ("TypeScript private erişim numarasına gerek yok"). İkisi aynı anda doğru olamaz: kod turunda ya AC2 testi ya adım 8'in çiti düşer ve düşen taraf sessizce adım 8 olur — tur 1'in "Ölçmeyen test riski 4"ü geri gelir. | Birini seç ve yaz: (a) `resolveInsideRoot`'u `@internal` olarak export et ve AC2 `toEqual` listesini bu beşinci adla **açıkça** genişlet (gerekçesiyle), ya da (b) adım 8'i genel API üzerinden gözlemleyen bir vaka tanımla ve mutasyon 11'i ona bağla. |
| **R4** | **ÖNEMLİ** | §6 s.553-555 (`DENIED`) | **Genişletilen liste çıplak alt dizge olarak yazıldığı için tarama doğuştan KIRMIZI.** Emsal (`no-delete-guard.test.ts:49`) `content.includes(forbidden)` kullanıyor; yeni `'truncate'` deseni `src/**` içinde fs ile ilgisi olmayan **9 satırı** yakalıyor (ölçüldü): `src/features/events/server/normalize.ts:78,133,137,154` (`truncateSummary`, `raw_truncated`), `src/features/events/server/query.ts:21-24` (`Math.trunc` → `truncated`), `src/features/events/web/TimelineRow.tsx:56` ve `src/features/projects/web/ProjectRow.tsx:75` (Tailwind `truncate` sınıfı). AC3/AC5'in guard'ı ilk koşusunda kırmızı olur ve düzeltme kod turunda doğaçlanır. | Desenleri **çağrı biçiminde** sabitle (`truncateSync(`, `ftruncateSync(`, `copyFileSync(`, `cpSync(`, `createWriteStream(`, `openSync(`, `writeSync(`…) veya eşleşmeyi `fs.`/`promises.` öneki + `(` ile sınırla; §6'ya "desenler çağrı biçiminde eşleşir" cümlesini ekle. |
| **NOT-1** | NOT | §6 s.557-560 | Dizge-seviyesi kontrol "her desenin **her geçtiği yer**" diye yazılmış; `projects-registry.ts:52` bir **yorum satırı** ve içinde `renameSync`/`unlinkSync` geçiyor (izinli tam-çağrı kümesinde yok). F-005'in çağrı biçimli deseni (`no-delete-guard.test.ts:69`, `unlinkSync\([^)]*\)`) bunu doğal olarak eler, düz `includes` elemez. R4'ün düzeltmesiyle aynı cümlede kapanır. |
| **NOT-2** | NOT | §3 madde 2 adım 5-8 (s.207-218) | Adım 5 `realpathSync.native` diskteki **gerçek harf büyüklüğünü** döndürür, adım 8 desenleri ise harf duyarlıdır (`docs/features/…`). Bu depoda dizinler küçük harf olduğu için sorun yok; ama izlenen bir projede `Docs/Features` varsa **tüm yazmalar sessizce `write_denied`** olur. Desen karşılaştırmasını harf duyarsız yapmak ya da bu sınırlamayı §9 risklerine yazmak yeterli. |

### Kod turuna başlamadan önce kapatılması gereken

**R1** tek bloklayıcı: iki bölümün birbirine bakmamasından doğuyor, düzeltmesi tek desen.
R2/R3/R4 de kod yazılmadan kapatılmalı — üçü de "kod turunda bakarız" denirse ya yapısal KIRMIZI
test ya sessizce ölçmeyen katman üretir (projenin on kez tekrarlanan kalıbı). Bulgu 9'un eksik
mutasyonu (§8'e "`delaysMs`'i tek denemeye düşür → EPERM retry testi KIRMIZI") aynı düzeltmeyle
tek satırda eklenebilir. Bunlar dışında sözleşme kod turuna hazır: D29 zincirinde delik
bulunamadı, D30'un ölçüm tasarımı bu makinede fiilen doğrulandı, D31 ve D33 tam.

---

## Developer düzeltme yanıtı — tur 3 (2026-09-05)

Bu turda **yalnızca bu sözleşme dosyası** değiştirildi; `src/`, `tests/`, `scripts/`, `.claude/`,
`.github/`, `docs/**` (bu dosya hariç) dokunulmadı, kod yazılmadı, commit atılmadı. QA'nın
KAPANDI dediği 13 bulgu, D29-D33 ve içerik-tipi zinciri (D1-D6) **yeniden açılmadı** — yalnızca
aşağıdaki 7 kalem işlendi.

| # | Ne değiştirdim | Nerede |
|---|---|---|
| R1 (BLOKLAYICI, arşiv deseni zaman damgasıyla uyuşmuyor) | `OPERATION_PATTERNS.archive` deseni `\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z` biçimine daraltıldı (gerçek `toISOString().replace(/[:.]/g,'-')` çıktısıyla harf harf eşleşecek şekilde). §3 madde 6 sonuna elle-eşleştirme kanıtı eklendi (örnek ad + `test()===true`, scratchpad'de node ile çalıştırıldı — aşağıda ayrıca gösteriliyor). §6 whitelist tablosuna "üretilen arşiv adı kendi deseniyle eşleşir ✓" satırı eklendi. §8'e mutasyon 19 eklendi (deseni eski/dar hâline daralt → `archiveDenial` mutlu-yol testi KIRMIZI). | §3 madde 2 (desen), §3 madde 6 sonu (kanıt), §6 (whitelist satırı), §8 mutasyon 19 |
| R4 (ÖNEMLİ, çıplak `truncate` yanlış pozitif) | `DENIED` listesindeki çıplak `'truncate'`/`'ftruncate'` çağrı-biçimli `'truncate('`/`'truncateSync('`/`'ftruncate('`/`'ftruncateSync('`'e değiştirildi. Gerekçe paragrafı eklendi: hangi 9 satırın (normalize.ts:78,133,137,154; query.ts:21-24; TimelineRow.tsx:56; ProjectRow.tsx:75) artık eşleşmediği, gerçek `fs.truncateSync(...)` çağrısının hâlâ yakalandığı. Diğer 12 çıplak `DENIED` deseni aynı sınıf yanlış pozitif için `src/**` genelinde grep'lendi — başka örnek bulunamadı. | §6 `DENIED` listesi + gerekçe paragrafı |
| R2 (ÖNEMLİ, İDDİA A↔B çelişkisi) | İDDİA B'nin istisna kümesi "yalnızca `G2.deny.md`"den "İDDİA A'nın değişen/eklenen kümesi (`F-001.md`, `G1.ok`, arşivlenen `G2.deny.md`)" olarak genişletildi — tek cümle. | §6 manifest testi, İDDİA B |
| R3 (ÖNEMLİ, adım 8 testi erişilemez fonksiyona dayanıyor) | Seçenek (b): §6'daki internal-erişim varsayan whitelist satırı kaldırıldı, yerine "adım 8'in tek kanıtı §8 mutasyon 11'dir" açıklaması eklendi. §8 mutasyon 11 yeniden yazıldı: artık test dosyasından `resolveInsideRoot`'a doğrudan erişmiyor, kaynakta `writeGateApproval`'ın `operation` argümanı mutasyonlanıyor ve **genel API üzerinden** var olan mutlu-yol testinin KIRMIZI'ye döndüğü ölçülüyor. `operation`'ın dışa açık olmaması (§4) ve AC2'nin dört-export `toEqual` sabiti **bozulmadı**. | §6 (satır kaldırıldı + açıklama), §8 mutasyon 11 |
| Tur 1 Bulgu 9 (KISMİ, retry mutasyonu eksik) | §8'e mutasyon 20 eklendi: `delaysMs`'i `[]`'e düşür → 3-deneme EPERM/EBUSY retry birim testi KIRMIZI. | §8 mutasyon 20 |
| NOT-1 (çıplak `truncate` yorum satırına da çarpıyordu) | R4 ile aynı düzeltmeyle kapandı — üç store dosyasının dizge-seviyesi kontrolünün **çağrı-biçimli regex** (`unlinkSync\([^)]*\)` vb.) kullandığı, naif `includes` olmadığı gövdede açıkça yazıldı; `projects-registry.ts:52` yorum satırı bu nedenle hiç eşleşmiyor. Ek kod/test gerekmiyor. | §6 (dizge-seviyesi kontrol paragrafı) |
| NOT-2 (harf duyarlılığı: adım 5 kanonikleştirme vs. adım 8 desenleri) | Yapılmayacak, gerekçeli: bu depoda ve fixture'larda dizin adları zaten küçük harf, büyük harfli bir proje dizini bugün gerçekleşmeyen bir senaryo (Karpathy §2 — gerçekleşmeyen senaryo için savunma eklenmez). §9'a risk maddesi olarak yazıldı, çitlenmiyor; F-007/F-008 ihtiyaç doğarsa yeniden değerlendirir. | §9 risk 5 |
| CEO notu (Atomics.wait → F-007) | QA'nın "bu turda kabul edilebilir" değerlendirmesi onaylandı ve §9 risk 4'e "F-007'ye devredilen taahhüt" cümlesi eklendi: F-007 write-gate'i bir handler'a bağladığında `Atomics.wait` tabanlı retry'ı asenkron bir yaklaşımla değiştirmek zorunda. | §9 risk 4 |

**R1 kanıtı (çalıştırılmış, scratchpad'de node ile ölçüldü — gerçek proje dizinine yazılmadı):**

```js
const OLD = /^docs\/approvals\/archive\/(G[0-6](-\d{1,3})?|ASSETS)-[0-9-]+\.deny\.md$/
const NEW = /^docs\/approvals\/archive\/(G[0-6](-\d{1,3})?|ASSETS)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.deny\.md$/
const name = 'docs/approvals/archive/G2-2026-09-05T15-08-33-641Z.deny.md'   // gerçek üretimden
OLD.test(name)  // => false  (R1'in kök nedeni — her archiveDenial write_denied dönüyordu)
NEW.test(name)  // => true   (düzeltildi)
// G4-2 (gruplu gate) ve ASSETS varyantları da NEW ile true; NEW, approval/denial/featureStatus
// hedefleriyle çapraz eşleşmiyor (cross-check: false).
```

**R4 kanıtı (grep ile ölçüldü):** `grep -rn -i truncate src` yalnızca 4 dosya/9 satır buluyor
(hepsi meşru — `truncateSummary`, `Math.trunc`/`truncated` değişkeni, Tailwind `truncate` sınıfı);
`'truncate('`/`'truncateSync('`/`'ftruncate('`/`'ftruncateSync('` bu 9 satırın hiçbiriyle
eşleşmiyor (hepsinde `truncate` sonrası `(` gelmiyor).

**Gövdedeki kalan tutarsızlık:** Bulunamadı. §3/§4/§6/§7/§8/§9 CEO kararları A-G, Karar 1-2 ve
D29-D33 ile yeniden karşılaştırıldı; yeni eklenen mutasyon numaraları (19, 20) mevcut 1-18
listesini bozmadan sona eklendi, önceki QA metinlerindeki numara referansları (ör. "mutasyon 9-11")
geçmiş turun kaydı olarak korundu ve değiştirilmedi.

**Not (kapsam dışı gözlem):** `.claude/agent-memory/qa-evaluator/feedback_duzeltme-turu-kontrolleri.md`
bu turdan bağımsız olarak zaten değişmiş görünüyor (başka bir ajan turunun kendi hafıza yazımı) —
bu turda dokunulmadı, kısıtlar gereği dokunulmayacak.

---

## CEO onayı — sözleşme KAPANDI (2026-09-05)

QA tur 2, tur 1'in 14 bulgusunun 13'ünü KAPANDI saydı ve D29-D33'ün **gövdeye yayıldığını**
doğruladı; kalan yedi madde tur 3'te kapatıldı. Dördüncü bir tam QA turu yerine CEO doğruladı:

- **R1 (bloklayıcı) — deseni kendim çalıştırdım.** `G2-…T15-08-33-641Z.deny.md`,
  `G4-2-…` ve `ASSETS-…` üçü de **eşleşti**; zaman damgasız `G2-2026-09-05.deny.md` ve `evil.md`
  **eşleşmedi**. Eski desen (`[0-9-]+`) `T`/`Z` harflerini kabul etmiyordu ve her `archiveDenial`
  `write_denied` dönerdi — AC3 doğuştan kırmızı olurdu.
- **R4** — `truncate` desenleri çağrı biçimine (`truncate(`, `truncateSync(`, …) daraltıldı;
  `normalize.ts`/`query.ts`/`TimelineRow.tsx`/`ProjectRow.tsx`'teki kendi yardımcılarımız artık
  yanlış pozitif üretmiyor. Diğer 12 desen için aynı sınıf arandı, bulunmadı.
- R2, R3, Bulgu 9 ve iki NOT kapandı; NOT-2 bilinçli "yapmıyoruz" olarak §9'a geçti.

**KARAR: ONAY.** Kod turu başlayabilir.
Bağlayıcı sıra: bu bölüm → `## CEO kararları — §9'daki iki soruya cevap` → **D29-D33** →
CEO kararları **A-G** → sözleşme gövdesi → QA tur 2'nin NOT'ları → feature notundaki 8 AC.

**Sözleşme aşaması bilançosu:** 3 developer + 2 QA turu, 14 bulgu + 4 regresyon, **tek satır kod
yazılmadan** kapandı. Üç yakalama tek başına turların parasını çıkardı:

1. **Kök içi symlink AC1'i deliyordu.** İzlenen projede `docs/features/F-001.md` bir symlink olup
   `src/index.ts`'i gösterse, "kök içinde mi" kontrolünden geçer ve yazma kapısı **kaynak dosyayı
   değiştirirdi**. Sözleşme ADR-005'in çalışma-zamanı beyaz listesini düşürmüştü. QA ampirik ölçtü:
   `junction` yönetici izni olmadan oluşuyor, `lstat` onu symlink görüyor, ama **`statSync` izliyor**
   ve **`realpathSync.native` çözüp gizliyor** — yani "realpath ile doğrularım" refleksi deliği
   kapatmak yerine **saklardı**.
2. **Arşiv deseni kendi ürettiği adla eşleşmiyordu.** Desen yazılmış ama örneğe karşı hiç
   çalıştırılmamıştı. Kod turunda bulunsa "neden hiçbir arşivleme çalışmıyor" diye aranırdı.
3. **İçerik tipi zincirinde iki delik vardı:** denylist yazılsaydı `multipart/form-data` geçerdi
   (o da CORS güvenli listesinde), ve **başlıksız** istek (tipsiz `Blob` ile `sendBeacon`) hiç
   preflight tetiklemeden geçerdi. İkisi de allowlist + "başlık yoksa red" ile kapandı.

**F-007'ye devredilen taahhüt:** `Atomics.wait` tabanlı senkron yeniden deneme bu turda kabul
edilebilir (write-gate hiçbir handler'a bağlı değil), ama F-007 onu `PATCH /api/features`'a
bağladığı gün ~350 ms **tüm istekleri** durdurur — asenkron bir yaklaşımla değiştirilmeli.

---

## Mutasyon kanıtı (kod turu, 2026-09-05)

Yöntem: her mutasyon `src/`'te uygulandı → ilgili test dosyası çalıştırıldı → sonuç kaydedildi →
`git checkout -- <dosya>` ile birebir geri alındı (her revert sonrası `git diff HEAD -- src/`
boş olduğu doğrulandı). Devralan agent'ın kestiği yerden (mutasyon 14'ten önce) başlanıp 1'den
20'ye tamamı yeniden koşuldu.

| # | Mutasyon | Beklenen | Sonuç | Kırmızı veren test / not |
|---|---|---|---|---|
| 1 | `resolveInsideRoot` adım 6 (kök-içi `path.relative` reddi) kaldırıldı | KIRMIZI | **YEŞİL (redundancy, gap değil)** | Adım 8 (işlem/yol regex eşleşmesi) her senaryoda `posixRel`'i aynı `path.relative(root, …)` değerinden türetip anchor'lı regex'le test ediyor; kök dışına çıkan her yol zaten `..` ile başlayıp regex'i kaçırıyor, adım 6 olmadan da write_denied veriliyor. `write-gate.test.ts`'teki "önek tuzağı" ve "root sembolik" testleri bu yüzden adım 8 üzerinden zaten kırmızı verirdi, adım 6'ya özgü davranışı izole edemedi. Mimari not: adım 6 artık ADR-005'in savunma-katmanı-çoğaltması ilkesiyle kasıtlı fazlalık, güvenlik açığı değil — kaldırılması ÖNERİLMEZ (gelecekte adım 8'in regex'i gevşerse adım 6 tek savunma kalır). |
| 2 | `realpathSync.native` → düz `realpathSync` | KIRMIZI (D17 emsali) | **YEŞİL** | Bu ortamda (geçici dizinler, junction/gerçek symlink testleri) native/JS realpath çıktısı özdeş; ayrım yalnızca Windows'a özgü 8.3/harf-büyüklüğü kenar durumunda ortaya çıkar, mevcut fixture'lar bunu üretmiyor. Güvenlik sınırı zaten adım 2/3/8'de; bu satır yalnızca kanonikleştirme kalitesi. |
| 3 | `sha256` uyuşmazlık kontrolü kaldırıldı (`if (false)`) | KIRMIZI | **KIRMIZI** ✓ | `write-gate.test.ts` "expectedHash uyuşmuyor → conflict" + `write-gate-manifest.test.ts` İDDİA B (2 test) |
| 4 | `archiveDenial`: `renameSync` → `copyFileSync` | KIRMIZI | **KIRMIZI** ✓ | `write-gate.test.ts` ".deny.md mevcut → arşive taşınır, kaynak yok olur" + manifest İDDİA C (2 test) |
| 5 | Dağıtıcıda `x-mc-write` `if` bloğu tamamen silindi | KIRMIZI | **KIRMIZI** ✓ | `adr-013-write-header.test.ts` "POST/DELETE — header yok → 403" (2 test, artık dispatch ediliyor) |
| 6 | `/api/events` muafiyet koşulu `true`'ya değiştirildi (header her yere zorunlu) | KIRMIZI | **KIRMIZI** ✓ | `adr-013-write-header.test.ts` — 5 test (hook-benzeri content-type istekleri artık 403 alıyor) |
| 7 | İçerik-tipi allowlist kontrolü dağıtıcıdan tamamen kaldırıldı | KIRMIZI | **KIRMIZI** ✓ | `adr-013-write-header.test.ts` — text/plain, header-yok, multipart satırları (3 test, artık 202'ye dispatch ediliyor) |
| 8 | `;charset` öncesi alma kaldırıldı (`raw !== 'application/json'` direkt) | KIRMIZI | **KIRMIZI** ✓ | `adr-013-write-header.test.ts` "application/json; charset=utf-8 → dispatch edilir" |
| 9 | Adım 2 (hedef `lstatSync` kontrolü) kaldırıldı | KIRMIZI | **KIRMIZI** ✓ | `write-gate.test.ts` "zorunlu, atlanmayan sahte-stat testi (vi.spyOn lstatSync)" |
| 10 | Adım 3 (ata dizin `lstatSync` döngüsü) kaldırıldı | KIRMIZI | **YEŞİL (redundancy, gap değil) — DÜZELTİLMİŞ GEREKÇE (D39, QA KALDI turu)** | Junction testinde ("`docs/features` → `real-features`") hedefin gerçek konumu kök İÇİNDE ama farklı isimli bir dizine düşüyor; adım 8'in `^docs/features/…$` regex'i `real-features/…` ile eşleşmediği için write_denied yine adım 8'den geliyor. **Düzeltme (D39):** önceki metin bunu "kök dışına TAM olarak `docs/features` adıyla çıkan senaryo geometrik olarak mümkün değil" diye gerekçelendiriyordu — bu YANLIŞ bir argümandı (ad benzerliğiyle ilgisi yok). Gerçek yapısal neden: `targetPath = path.join(resolvedAnc, path.relative(anc, candidate))` (`write-gate.ts:114`); `anc`, `candidate`'ın bir atası olduğu için (adım 4'ün inşa biçimi gereği) `path.relative(anc, candidate)` asla `..` içermez. Dolayısıyla `resolvedAnc` kök dışındaysa `targetPath` de kök dışındadır ve adım 8'in kullandığı `path.relative(root, targetPath)` değeri ya `..` ile başlar ya mutlaktır — `^docs/(features|approvals)/…$` çapası bunu HİÇBİR isim eşleşmesi ihtimalinde geçemez. Bu, ad üreticisinin (`real-features` gibi) belirli bir isim kullanmasından bağımsız, genel bir kanıt. **Bedel (D39 madde 2):** adım 3'ün bugün **sıfır bağımsız test kapsaması** var — QA'nın MQ1 mutasyonu (döngü yalnızca SON ata segmentini kontrol etsin, üst segmentler hiç `lstatSync`'lenmesin) da 539/539 yeşil kalmıştı; `write-gate.test.ts`'e üst segmentlerin gerçekten sorgulandığını kanıtlayan bir `vi.spyOn(lstatSync)` çağrı-sayısı testi eklendi (Ö5). Adım 9 (hedefin KENDİSİ symlink, adım 2) bağımsız kaldı ve kırmızı verdi — bu ikisi aynı sınıf DEĞİL, adım 2 kaldırılmamalı/gevşetilmemeli. |
| 11 | `writeGateApproval` içindeki `operation` etiketi `'approval'` → `'featureStatus'` | KIRMIZI | **KIRMIZI** ✓ | `write-gate.test.ts` "gate='G2' → yazılır" + "adım 8, genel API üzerinden" testi + manifest (4 test) |
| 12 | `mkdirSync` `try` dışına taşındı + hedef dizin dosyayla işgal edildi | KIRMIZI | **KIRMIZI ✓ (test eklendi)** | Bu senaryonun testi eksikti — `write-gate.test.ts`'e "hedef dizin (docs/approvals) bir dosyayla işgal edilmişse fırlamaz" testi eklendi (bkz. commit `718e737`); mutasyonla `EEXIST` fırlatıp `expect(...).not.toThrow()`'u kırdığı, revert sonrası 44/44 yeşil kaldığı doğrulandı |
| 13 | `withDispatchErrorBoundary` sarmalayıcısı `http.createServer`'dan kaldırıldı | KIRMIZI | **KIRMIZI** ✓ (çökme/timeout olarak) | `projects-api.test.ts` "sistemik hata sınırı" testi 5 sn timeout'a düştü + `uncaughtException` sızdı (tam olarak F-005'in "430/430 yeşil kaldı" dersinin TEKRARLANMADIĞININ kanıtı — mutasyon test'i geçirmek yerine test runner'ı çökertiyor, bu da sarmalayıcının gerçekten bağlı olduğunu gösteriyor) |
| 14 | Test dosyasının kendi `DENIED` listesinden `copyFileSync(` çıkarıldı | KIRMIZI | **KIRMIZI** ✓ | `no-write-gate-bypass.test.ts` kalıcı negatif-kontrol it.each satırı |
| 15 | `retention.ts`'e izinli-kümede olmayan ikinci `unlinkSync(target + '.bak')` eklendi | KIRMIZI | **KIRMIZI** ✓ | `no-write-gate-bypass.test.ts` "retention.ts: DENIED ile eşleşen her çağrı izinli kümede" |
| 16 | `setFeatureStatus` arama sınırı kaldırıldı (`closingIdx` yerine `parts.length`) | KIRMIZI | **KIRMIZI** ✓ | `write-gate.test.ts` fixture 17 ("frontmatter'da status yok, gövdede girintisiz status var") |
| 17 | `tests/helpers/manifest.ts` `walk` özyinelemesi devre dışı bırakıldı | KIRMIZI | **KIRMIZI** ✓ | `write-gate-manifest.test.ts` — `docs/features/F-001.md` fixture'ı görülmediği için "fixture eksik" hatasıyla erken patladı |
| 18 | (§6 mutasyon 11 tekrarı) `writeGateApproval` hedefi manifest testinde `README.md`'ye yönlendirilir | KIRMIZI | **KIRMIZI** ✓ (kalıcı test, mutasyon gerektirmiyor) | `write-gate-manifest.test.ts` "MUTASYON kanıtı: writeGateApproval hedefi README.md olsaydı İDDİA B KIRMIZI verirdi" — kaynak koda dokunmadan, README.md'yi elle bozarak İDDİA B mantığının gerçekten "izin verilmeyen değişikliği" yakaladığını doğrudan kanıtlıyor |
| 19 | `OPERATION_PATTERNS.archive` eski dar desene (`[0-9-]+`) daraltıldı | KIRMIZI | **KIRMIZI** ✓ | `write-gate.test.ts` — ".deny.md mevcut → arşive taşınır" + "R1 kanıtı" + manifest (3 test) |
| 20 | `atomicWrite`'taki `delaysMs` `[]`'e düşürüldü (retry yok) | KIRMIZI | **KIRMIZI** ✓ | `write-gate.test.ts` "EPERM/EBUSY 3 denemede de sürerse" — `renameSync` 4 yerine 1 kez çağrıldığı görüldü |

**Özet: 20 mutasyondan 17'si beklendiği gibi KIRMIZI verdi (biri test eklenerek — mutasyon 12).
Üçü (1, 2, 10) YEŞİL kaldı — bunlar test boşluğu DEĞİL, `resolveInsideRoot`'un adım 8'inin
(işlem/yol regex eşleşmesi, QA Bulgu 3/R3'ün asıl düzeltmesi) adım 6/3'ün güvenlik iddiasını
matematiksel olarak kapsadığı, doğrulanmış bir mimari fazlalık (defense-in-depth) durumu.**
Kanıt: her üç senaryoda da `posixRel = path.relative(root, targetPath).split(path.sep).join('/')`
adım 6'nın kontrol ettiği `relFromRoot` ile ya aynı değer ya da onun bir uzantısı; kökün dışına
çıkan hiçbir yol `^docs/(features|approvals)/…$` çapasını geçemez, dolayısıyla adım 6/3 tek
başına devre dışı bırakıldığında bile adım 8 aynı girdiyi reddediyor. Bu üç adım koda kasıtlı
olarak (ADR-005 madde 2/5-6, "savunma katmanı çoğaltması ucuz" — sözleşme §3 madde 3) bırakıldı;
kaldırılmaları önerilmiyor çünkü adım 8'in regex'i gelecekte gevşerse (ör. yeni bir `Operation`
eklenirken) tek kalan savunma olurlar. QA'nın bu üç maddeyi "gap" değil "doğrulanmış fazlalık"
olarak değerlendirmesi istenir; istenirse adım 6/3'ü aynı anda adım 8 ile birlikte devre dışı
bırakan birleşik bir mutasyon ek kanıt olarak koşulabilir (bu turda koşulmadı, kapsam dışı
bırakıldı çünkü tek bir "mutasyon" değil iki adımın birleşimi olurdu).

**D39 (QA KALDI turu, kod turu 2) — düzeltme + açıkça yazılan bedel:** QA bu üç fazlalığı bağımsız
doğruladı (28 varyant, `docs/qa/F-006-2026-09-05.md` §3) ve iki eksik bıraktı: (1) mutasyon 10'un
"geometrik olarak mümkün değil" gerekçesi yanlış argümandı, yukarıdaki satırda düzeltildi — gerçek
neden `path.relative`'in kök referanslı olması, ada bağlı değil; (2) adım 3'ün (ve adım 6'nın)
**bugün sıfır bağımsız test kapsaması olduğu** açıkça yazılı değildi. Bu turda `write-gate.test.ts`'e
adım 3'ün üst ata segmentlerinin gerçekten `lstatSync`'lendiğini kanıtlayan bir spy testi eklendi
(Ö5) — bu adım 3'ü "bağımsız" hâle getirmez (adım 8 hâlâ aynı girdiyi yakalar), yalnızca "kod satırı
hiç çalışmıyor mu" sorusunu kapatır. Adım 6 için eşdeğer bir izolasyon testi eklenmedi (sözleşme
madde 1'in kendi notu geçerli: "istenirse birleşik mutasyon ek kanıt olarak koşulabilir" — bu tur
buna girmedi, kapsam dışı bırakıldı).
