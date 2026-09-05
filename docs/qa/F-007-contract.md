---
feature: F-007
title: Kanban panosu + frontmatter status yazma + çakışma/echo yönetimi
author: developer
status: draft
date: 2026-09-05
revision: tur 3
---

# F-007 Sözleşmesi — Kanban panosu + frontmatter `status` yazma + çakışma/echo yönetimi

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").
Bu turda `src/`, `tests/`, `scripts/`, `.claude/`, `.github/` altında **hiçbir dosya
değiştirilmedi**; yalnızca bu sözleşme metni yazıldı. `git status` bunu doğrular.

Kaynaklar: `docs/features/F-007-kanban.md` (10 AC + 6 devralınan taahhüt, **bağlayıcı**),
`docs/02-architecture.md` §5.2/§5.3/§6.1/§6.3/§7 (yazma kapısı + kanban), `docs/03-ux.md` ekran 2
+ akışlar (a)(b)(c) + durum tasarımı + erişilebilirlik + Türkçe metin sözlüğü (G3 onaylı,
bağlayıcı), `docs/01-prd.md` F2 (AC1-AC7), `docs/decisions/ADR-001` karar 5/8, `ADR-004`, `ADR-005`,
`ADR-012`, `ADR-013` (+ ek), `docs/qa/F-006-contract.md` (yazma kapısının sözleşmesi), `docs/qa/
F-006-fix1-2026-09-05.md` NOT-3, `docs/qa/F-005-contract.md` (chokidar izleyici + `features` SSE
kanalı), `CLAUDE.md`.

Mevcut kod okunarak doğrulandı (✓ VERIFIED): `src/server/write-gate.ts` (tam dosya), `src/server/
index.ts` (dağıtıcı, route sırası, `withDispatchErrorBoundary`, `x-mc-write` kontrolü), `src/shared/
types.ts`, `src/web/App.tsx`, `src/web/lib/{write-fetch,useEventStream}.ts`, `src/features/
projects/server/{service,handlers}.ts`, `src/features/projects/web/useProjects.ts`, `src/features/
events/web/{FilterChips,icons}.tsx`, `src/server/store/projects-registry.ts` (`toProjectListItem`
feature_count sayımı — henüz frontmatter ayrıştırması yok), `tests/e2e/settings.spec.ts` (fixture
proje deseni), `tests/build-css.test.ts` (`@source` çiti deseni), `tests/no-external-host.test.ts`
+ `tests/no-write-gate-bypass.test.ts` (tarama kökleri — ikisi de `src/features/**`'i özyinelemeli
tarıyor, **kanban için hiçbir değişiklik gerektirmiyor**, bkz. §2.3). `package.json` (mevcut
bağımlılıklar, `chokidar`/`yaml`/`@dnd-kit/core` henüz **hiçbiri kurulu değil** — `yaml` ve
`@dnd-kit/core` mimari §3.4'ün zaten onayladığı kapalı listede duruyor ama `package-lock.json`'da
henüz yok, ✓ VERIFIED `grep`). `npm view yaml`/`npm view @dnd-kit/core` ile gerçek registry
metadata'sı bu turda çekildi (native derleme/install-script yok, ✓ VERIFIED, §3 madde 3).

---

## 1. Kapsam

**İçinde:**

1. `GET /api/features?project_id=…` ve `PATCH /api/features/:project_id/:file` uçları (mimari
   §6.3), Kanban ekranı (7 sütun + "Bilinmeyen durum"), sürükle-bırak + klavye alternatifi,
   çakışma/hata/echo yönetimi, kart detay modalı (AC7).
2. **Beş devralınan taahhüt** (feature notu satır 32-61) — her biri §6'da ayrı planlanır:
   tam `tablist` deseni, F-005 AC1'in görsel kanıtı, dar genişlikte gezinme, `Atomics.wait`
   asenkrona çevirme, `safeYamlValue` sertleştirme (+ `OPERATION_PATTERNS` koşulu).
3. `src/server/write-gate.ts`'e **cerrahi** dokunuş — yalnızca madde 2'nin gerektirdiği iki
   değişiklik (async retry + `safeYamlValue`); dördüncü niyet fonksiyonunun (`archiveDenial`)
   kamu sözleşmesi bu turda **değişmez** (§3 madde 5'te gerekçeli).
4. Yeni bağımlılıklar: `yaml` (okuma, mimari §3.4 zaten onaylı), `@dnd-kit/core` (sürükle-bırak,
   mimari §3.4 zaten onaylı) — bu bir ADR gerektirmiyor, mimarinin kapalı listesinin
   **tamamlanmasıdır**, genişlemesi değil.

**Kapsam DIŞI (bilinçli):**

- Faz 2 ekranları (G0-6 kapılar F-008, Thread F-009, Token F-010/F-011) ve bunların uçları.
- Yeni depo/uç icat etme; olay filtreleme değişikliği.
- Kapılar paneli için `role="tablist"` — bu deseni yalnızca **Zaman Çizelgesi/Kanban** ikilisi
  için kuruyoruz; Ayarlar dişlisi kapsam dışı kalmaya devam ediyor (feature notu madde 1, `docs/
  03-ux.md:21`).
- `archiveDenial`'ın async'e çevrilmesi — kendi retry döngüsü yok, kanban onu hiç çağırmıyor
  (§3 madde 5).
- `projects/server/service.ts`, `projects/server/project-watcher.ts`, `debounce.ts` — **hiçbiri
  değişmiyor**. Echo/canlı güncelleme tamamen mevcut `features` SSE broadcast'ine (F-005, zaten
  GEÇTİ) yaslanıyor (§3 madde 7, §4.4).
- G4-1 kilometre taşı (bu feature'dan sonra, kullanıcı kararı).

---

## 2. Dokunacağım dosyalar

### 2.1 Yeni

| Dosya | Amaç |
|---|---|
| `src/features/kanban/server/parse-feature.ts` | Tek bir `.md` dosyasının **Buffer**'ını `FeatureCard`'a çevirir. Saf (fs'e dokunmaz, dışarıdan buffer alır) — bkz. §4.1. |
| `src/features/kanban/server/list-features.ts` | `docs/features/*.md` dizinini okur (`fs.readdirSync`+`fs.readFileSync`), her dosyayı `parse-feature.ts` ile ayrıştırır, `project_id` etiketler. Bir veya birden çok `ProjectRecord` için çağrılabilir (§4.1). |
| `src/features/kanban/server/handlers.ts` | `handleListFeatures`, `handlePatchFeatureStatus` — HTTP gövde okuma/doğrulama + `setFeatureStatus`'u `await`leyip `WriteResult`'ı `ApiResponse<FeatureCard>`'a çevirir (§4.3). |
| `tests/features/kanban/server/parse-feature.test.ts` | Birim — golden fixture'lar (geçerli frontmatter, eksik alan, bozuk YAML, BOM, `status` yok). |
| `tests/features/kanban/server/list-features.test.ts` | Birim — gerçek geçici dizin, karışık geçerli/bozuk dosyalar, `.md` olmayan dosyaların atlanması. |
| `tests/integration/features-api.test.ts` | Entegrasyon — gerçek `createServer()` + gerçek HTTP: `GET`/`PATCH` mutlu yol, `conflict`(409), `write_denied`(403), `write_failed`(500 — `renameSync` mock), `invalid_body`(400: boş/>64/CRLF), `x-mc-write` eksikliği (ADR-013 zaten dağıtıcı seviyesinde — regresyon çiti), Content-Type/JSON parse hataları. |
| `src/shared/constants.ts` | `STATUS_COLUMNS: {key, label}[]` (7 bilinen durum, ADR-001 karar 8 sırası/biçimi). Mimarinin klasör taslağının (§4) zaten öngördüğü dosya; bu turda ilk kez oluşturuluyor. |
| `src/features/kanban/web/useFeatures.ts` | Veri katmanı: `GET /api/features` yükleme, `features` SSE sinyaliyle proje bazlı yenileme (echo dahil, §4.4), `patchStatus(card, nextStatus)` — iyimser güncelleme + çakışma/hata geri alma (§4.3), her başarılı `GET`/`PATCH` sonrası `lastSyncedAt: number` günceller ("Son senkron" çubuğu için, §5 yeni durum satırları). |
| `src/features/kanban/web/KanbanScreen.tsx` | Ekran kompozisyonu: proje filtre çipleri (mevcut `FilterChips` yeniden kullanılır, §3 madde 9), `DndContext` (+ kendi `aria-live="polite"` duyuru bölgesi, §7), sütunlar, beş durum banner'ı (§5 yeni satırlar — boş/iskelet/proje-okunamadı/ayrıştırılamayan-dosyalar/bağlantı-koptu), "Son senkron" alt bilgi çubuğu. Proje adı listesi ve bağlantı durumu için App'ten `liveProjectsUpdate`/`stream` prop'larını alır (§3 madde 9, iki yeni EventSource açılmaz). |
| `src/features/kanban/web/KanbanColumn.tsx` | Tek sütun — `useDroppable` + kart listesi + boş/iskelet durumları. |
| `src/features/kanban/web/KanbanCard.tsx` | Tek kart — `useDraggable`, tıklama → detay modalı, "yazılıyor…" spinner, çakışma vurgusu. |
| `src/features/kanban/web/FeatureDetailModal.tsx` | Salt okunur id/title/owner/deps/sprint (AC7), focus-trap + `Esc`. |
| `src/features/kanban/web/keyboardCoordinates.ts` | `@dnd-kit/core`'un `KeyboardSensor`'üne verilen saf `coordinateGetter` — Sol/Sağ'ı bir önceki/sonraki **sütunun** merkez koordinatına eşler (piksel aritmetiği değil, sütun listesi üzerinde index kaydırma). Saf fonksiyon → kolayca birim testlenir. |
| `src/features/kanban/web/icons.tsx` | 8 durum ikonu, Lucide path verisinden elle kopyalanmış inline SVG (`events/web/icons.tsx` ile aynı desen, `lucide-react` bağımlılığı **eklenmez**). |
| `tests/features/kanban/web/useFeatures.test.ts` | jsdom — yükleme, echo no-op (aynı hash → kart referansı değişmez, §4.4), çakışma geri çizme, yazma hatası rollback, ADR-004 y4 "sürüklerken gelen sinyali kuyrukla" davranışı. |
| `tests/features/kanban/web/KanbanScreen.test.tsx` | jsdom/Testing Library — `tablist`/`tab`/`tabpanel` ARIA yapısı (App.tsx üzerinden), sütun render, "Bilinmeyen durum" koşullu görünürlüğü, boş/hata durumları, detay modalı. **Sürükleme mekaniği burada test edilmez** (jsdom layout yapmaz, F-003 dersi) — yalnızca `onDragEnd`'in saf mantığı doğrudan çağrılarak test edilir. |
| `tests/features/kanban/web/keyboardCoordinates.test.ts` | Saf fonksiyon birim testi. |
| `tests/e2e/kanban.spec.ts` | Gerçek tarayıcı — sürükle-bırak (AC1-AC7), çakışma (dosyayı sunucu sürecinden bağımsız harici yazdırarak), yazma hatası (hedef dizini salt-okunur/işgal ederek), klavye alternatifi (AC9, gerçek `keyboard.press`), 375px gezinme (taahhüt 3), F-005 AC1 uçtan uca kanıtı (taahhüt 2), echo/flicker ölçümü (madde D, render sayacı + `page.on('request')` ağ sayımı). |
| `tests/e2e-config-guard.test.ts` | **QA tur 1 bulgu 4 (BLOKLAYICI) çiti — QA tur 2 YENİ-R2 düzeltmesi: iki config birden okunur.** Vitest birim testi (Playwright değil — hızlı, her `npm test`'te koşar): `fs.readdirSync('tests/e2e')`'den `*.spec.ts` dosya adlarını toplar; `playwright.config.ts` **VE** `playwright.dev.config.ts`'i ayrı ayrı okur (`fs.readFileSync(...,'utf8')`); her spec dosya adının **en az birinin** metninde geçtiğini doğrular (`configA.includes(name) || configB.includes(name)`), geçmeyen varsa dosya adı listesiyle KIRMIZI verir. **Gerekçe (tur 2'de repoda ölçüldü):** yalnızca `playwright.config.ts` okunsaydı guard bugün zaten `tests/e2e/dev-shell.spec.ts` için KIRMIZI verirdi — o dosya bilinçli olarak `playwright.dev.config.ts:5`'e bağlı (`npm run e2e:dev`), ana koşuya değil; tek-config guard bunu **yanlış pozitif** olarak işaretlerdi. İki-config OR mantığı bu yanlış pozitifi ortadan kaldırırken asıl sınıfı (yeni bir spec dosyası HİÇBİR config'te geçmiyorsa) hâlâ yakalar. **Bilinen sınır (düzeltme istenmiyor, kayıt, QA tur 2 ölçümü):** guard metne bakan basit bir `includes` taraması olduğu için iki yönde de tam doğru değildir — **bilinçli olarak "kırmızıya kaçan" yön seçildi:** (a) dosya adı bir config'in **yorum satırında** geçerse guard **YEŞİL** kalır (yanlış negatif — sessizce kabul edilen tek sınır; pratikte config dosyalarında `testMatch` dışında böyle bir yorum yok). (b) `testMatch` bir glob'a (ör. `'**/*.spec.ts'`) çevrilirse glob metni spec dosya adını literal içermediği için guard her spec'i "eksik" sayıp **KIRMIZI** verir (yanlış pozitif) — bu yön **güvenlidir** (gereksiz bir kırmızı, unutulan bir spec'ten daha ucuzdur) ve düzeltmesi tek satır (guard mantığını değiştirmeden config'e dosya adını literal eklemek). Bu, `testMatch`'in kapalı liste olmasından kaynaklanan "yeni E2E dosyası sessizce koşmuyor" sınıfının (F-003, F-005'te de görülmüş) bir daha tekrarlanmamasının yapısal güvencesidir. |

### 2.2 Değiştireceğim (kanban dizini dışı — her biri CEO'nun feature notundaki doğrudan talimatın **mekanik sonucu**, gerekçe aşağıda)

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `src/server/write-gate.ts` | (a) `safeYamlValue` sertleştirme — gösterge-karakteri kuralı **korunur** + `yaml` paketiyle (§2.3'te zaten onaylı bağımlılık) "değer tip-zorlayan bir skalere çözülüyor mu" genel kuralı eklenir (§3 madde 4, D43). (b) `atomicWrite`'ın `sleepSyncMs`/`Atomics.wait`'i `await delay(ms)`'e çevrilir; bu nedenle `setFeatureStatus`/`writeGateApproval`/`writeGateDenial` **async** olur, `Promise<WriteResult>` döner. `archiveDenial` **değişmez** (§3 madde 5, tasarım detayı §3 madde 13). | Feature notu madde 4/5 (CEO'dan devralınan taahhüt, doğrudan bu dosyayı işaret ediyor) — F-006'nın kendi kapsamı dışında bırakıp F-007'ye devrettiği iki iş. |
| `playwright.config.ts` | `testMatch` listesine `'kanban.spec.ts'` eklenir. **QA tur 1 bulgu 4 (BLOKLAYICI) düzeltmesi** — bu satır unutulursa `tests/e2e-config-guard.test.ts` KIRMIZI verir (§2.1), bu yüzden unutulması artık yapısal olarak imkansız. | E2E'nin gerçekten koşması AC3/AC5/AC6/AC9 + T1/T2/T3 + echo ölçümünün ölü doğmaması için zorunlu ön koşul. |
| `tests/server/write-gate.test.ts` | ~46 çağrı sitesine (`setFeatureStatus` 34, `writeGateApproval` 8, `writeGateDenial` 1 — bu dosyada; sayı `grep` ile doğrulandı) mekanik `await` eklenir + `it(...)` callback'leri `async`. `archiveDenial`'ın 6 çağrısı **dokunulmaz**. Yeni golden fixture'lar (18-57, 19 gösterge-karakterli + 21 tip-zorlayan değer, toplam **40**, kabul ölçütü §3 madde 4 ile birebir) eklenir. | Doğrudan (a)'nın mekanik sonucu — imza değişmeden test derlenmez/geçmez. F-006 kod turunun F-005 testlerine yaptığı "tamamen mekanik" güncellemeyle aynı sınıf (`docs/progress.md` 2026-09-05 F-006 kaydı), CEO zaten bu emsali onaylamış bir örüntü. |
| `tests/server/write-gate-manifest.test.ts` | Aynı gerekçeyle 3+1+1 = 5 çağrı sitesine `await` (`archiveDenial`'ın 1 çağrısı hariç). | Yukarıdakiyle aynı. |
| `src/server/index.ts` | `GET`/`PATCH /api/features` route'ları eklenir (mevcut `if (pathname?.startsWith(...))` deseniyle, `DELETE /api/projects/:id` ayrıştırma emsaliyle). `x-mc-write` kontrolü **zaten** tüm non-GET `/api/*` uçlarını kapsıyor (ADR-013, F-006) — bu dosyada **ek bir güvenlik satırı gerekmiyor**, yalnızca route dispatch. | Her feature kendi HTTP ucunu burada açar (F-002/F-003/F-005 emsali); dağıtıcı tek kök dosya. |
| `src/web/App.tsx` | Statik "Kanban" `span`'i gerçek `role="tab"`a çevrilir, `role="tablist"` sarmalayıcı eklenir (Ayarlar aktifken davranışı dahil, §6 madde 1), üçüncü panel (`role="tabpanel"`, `hidden`) kanban ekranına bağlanır, `useEventStream`'e `onFeatures` callback'i eklenir (bkz. sıradaki satır). **Karar 1 (D2):** `KanbanScreen`'e zaten var olan `projectsUpdate` state'i `liveProjectsUpdate` prop'u olarak, zaten var olan `stream` nesnesi `stream` prop'u olarak geçirilir — Kanban için **ikinci bir `useEventStream()`/`EventSource` açılmaz**, tek doğruluk kaynağı `App.tsx` kökündeki mevcut bağlantı kalır (ADR-004 madde 1). `aria-current="page"` kaldırılır, yerini `aria-selected` alır (§6 madde 1). | F-005'in **aynı dosyaya** Ayarlar ekranını/dişlisini eklediği emsal (`docs/progress.md` F-005 kaydı) — her ekran ekleyen feature bu dosyaya dokunur, tek kabuk. `liveProjectsUpdate`/`stream` prop geçişi `SettingsScreen liveUpdate={projectsUpdate}` (satır 78) ile **birebir aynı** mevcut desendir. |
| `src/web/lib/useEventStream.ts` | `onProjects` ile **birebir aynı desende** `onFeatures?: (payload: {project_id: string}) => void` seçeneği + `es.addEventListener('features', ...)` eklenir. | ADR-004 madde 1 "tek bağlantı çok kanal" — tek `useEventStream()` çağrısı App kökünde kalmalı (F-003 kararı); yeni bir SSE bağlantısı açmak bu kararı ihlal eder. `onProjects` zaten bu iş için tam bu deseni kurmuş (satır 79-88). |
| `src/web/index.css` | `@source "../features/kanban/web";` eklenir. | F-003/F-005 emsali — Tailwind v4 taraması `vite.config.ts`'in `root: 'src/web'`'i dışındaki her yeni web dizinini elle eklemeyi gerektiriyor (B1 dersi). |
| `tests/build-css.test.ts` | F-005'in "yalnızca projects/web'te geçen 3 sınıf" describe bloğuyla **birebir aynı desende** yeni bir blok: kanban/web'e özgü ≥3 sınıf, önce "başka kökte hiç geçmiyor" ön koşulu, sonra üretilen CSS'te var olduğu. | Aynı B1 sınıfı regresyonunun (F-003) tekrarını önleyen zorunlu çit — yeni web dizini açan her feature bunu yapmak zorunda (F-005 emsali, kod incelemesiyle doğrulandı). |
| `src/shared/types.ts` | `FeatureCard` arayüzü eklenir (mimari §5.3 alan listesi). `ErrorCode` birleşimine `'write_denied'` ve `'write_failed'` eklenir (şu an **yok** — ✓ VERIFIED, mevcut liste: `invalid_body\|forbidden_origin\|storage_unavailable\|invalid_path\|conflict\|not_found\|internal_error`). | `ProjectRecord`/`ProjectListItem` de F-005'te aynı dosyaya eklenmişti (paylaşılan tip deposu, mimari §4 klasör taslağı bunu zaten öngörüyor: "types.ts — … FeatureCard …"). `write_denied`/`write_failed` mimari §6'nın kendi `ErrorCode` tanımında zaten var (satır 369) ama F-006 hiçbir HTTP handler'a bağlanmadığı için union'a hiç eklenmemiş. |

**Not — dokunulmayacağını doğruladığım dosyalar (§ araştırma, olumsuz iddia ✓ VERIFIED):**
`tests/no-external-host.test.ts` ve `tests/no-write-gate-bypass.test.ts` ikisi de `src/features`'i
**özyinelemeli** tarıyor (`walk()` fonksiyonları alt dizinlere iniyor, kod okunarak doğrulandı);
yeni `src/features/kanban/**` otomatik kapsanıyor, tarama kökü listesine elle ekleme
**gerekmiyor**. `src/features/projects/server/service.ts`, `project-watcher.ts`, `debounce.ts`
değişmiyor (§1, §3 madde 7).

### 2.3 Yeni bağımlılıklar

| Paket | Sürüm | Neden native derleme/install-script riski yok |
|---|---|---|
| `yaml` | `^2.9.0` (registry'den `npm view` ile bu turda doğrulandı) | Sıfır geçişli bağımlılık, kendi `scripts` alanı yalnızca kendi geliştirme komutları (`build`/`test`/…) — npm lifecycle hook'u (`preinstall`/`install`/`postinstall`) **yok**. `engines.node >= 14.6`, projenin `>=20.11` tabanıyla çakışmıyor. |
| `@dnd-kit/core` | `^6.3.1` | Bağımlılıkları `tslib`, `@dnd-kit/accessibility`, `@dnd-kit/utilities` — hepsi saf JS. `peerDependencies: react/react-dom >=16.8.0`, React 19 ile çalışır (npm 7+ peer uyarısı verebilir, hata vermez). Native derleme/install-script yok. |

`tests/deps.test.ts` bu iki paket için **hiçbir değişiklik gerektirmiyor** — o test kapalı bir
paket ADI listesi değil, `hasInstallScript`/native-araç/`.better-sqlite3` guard'ı (kod okunarak
doğrulandı); `yaml`/`@dnd-kit/core` bu guard'ların hiçbirine takılmaz.

---

## 3. Tasarım kararları (12 madde)

**1) Frontmatter okuma — `yaml` paketi, yalnızca frontmatter bloğu.**
`parse-feature.ts`: dosya `Buffer` olarak okunur (write-gate ile aynı BOM-güvenli yaklaşım),
`text.split(/(\r\n|\n)/)` ile aynı satır-koruyucu bölme YAPILMAZ (okuma yolunda buna gerek yok,
yalnızca yazma karakter-bazlı korumaya muhtaç) — bunun yerine basit `indexOf`/`split` ile frontmatter
bloğu (ilk `---` ile ikinci `---`/`...` arası) çıkarılır ve `yaml.parse(block)` çağrılır. **Tamamı
tek bir `try/catch` içindedir** (mimari §5.3 "tamamı try/catch içindedir"). Hata veya frontmatter
bulunamazsa: `{ project_id, file, status: '', column: 'unknown', content_hash, mtime_ms,
parse_error: <mesaj> }` — `id`/`title` alanları dosya adından türetilir (`file.replace(/\.md$/,
'')`) ki UX'in "⚠ F-00X ayrıştırılamadı" mini kartı bir şey gösterebilsin.

**2) `content_hash` — write-gate'in kullandığı TAM DOSYA hash'iyle bire bir aynı algoritma.**
`sha256(originalBuffer)`, **hex**, küçük harf — frontmatter bloğunun değil, **dosyanın tamamının**
hash'i. Bu kritiktir: istemci `expected_hash` olarak bunu gönderecek, `setFeatureStatus` de kendi
içinde `sha256(fs.readFileSync(file))` ile karşılaştırıyor (`write-gate.ts:228`). İkisi farklı bir
şey hash'lerse **her yazma** yanlış pozitif `conflict` döner.

**QA tur 1 bulgu 3 (BLOKLAYICI) düzeltmesi — test totolojiden çıkarıldı.** Önceki plan hash'i test
içinde *yeniden hesaplıyordu* (yerel bir `crypto.createHash('sha256')` çağrısıyla) — write-gate'in
gerçek davranışı hiç ölçülmüyordu, hash kaynağı değişse bile test yeşil kalırdı. Yeni plan
**davranışsal**: `parse-feature.test.ts`'teki "çapraz-modül tutarlılığı" testi (a) bir fixture
dosyası yazar, (b) `parse-feature.ts` ile bu dosyayı ayrıştırıp `content_hash`'i üretir, (c) bu
hash'i **doğrudan `expected_hash` olarak gerçek `setFeatureStatus(root, file, 'todo',
content_hash)`'a verir** (mock/yeniden hesaplama yok), (d) `result.ok === true` bekler — hash
uyuşmasaydı write-gate kendi içinde `conflict` dönerdi, yani test write-gate'in GERÇEK karşılaştırma
mantığını çalıştırıyor. Kanban'ın ürettiği hash write-gate'in beklediğinden farklı bir kaynaktan
gelseydi (ör. yalnızca frontmatter bloğu) bu test `ok:false, code:'conflict'` alır ve KIRMIZI verirdi.

**3) 7 sütun + "Bilinmeyen durum" — `src/shared/constants.ts` `STATUS_COLUMNS`.**
```ts
export const STATUS_COLUMNS = [
  { key: 'todo', label: 'Yapılacak' },
  { key: 'contract', label: 'Sözleşme' },
  { key: 'dev', label: 'Geliştirme' },
  { key: 'qa', label: 'QA' },
  { key: 'fix', label: 'Düzeltme' },
  { key: 'done', label: 'Bitti' },
  { key: 'blocked', label: 'Engelli' },
] as const
```
Sunucu tarafı `column` türetimi (`parse-feature.ts`): `STATUS_COLUMNS`'ta `key === status` eşleşen
varsa o `key`, yoksa `'unknown'` (ADR-001 karar 5). Başlık biçimi (istemci tarafı, `KanbanColumn.tsx`):
`` `${label} (${key})` `` → "Geliştirme (dev)" (ADR-001 karar 8, `docs/03-ux.md:101,385` ile bire
bir). "Bilinmeyen durum" sütunu `STATUS_COLUMNS`'ta **yok** — yalnızca en az bir `column==='unknown'`
kart varsa `KanbanScreen.tsx` tarafından koşullu render edilir, kesikli kenarlık (`border-dashed
border-fuchsia-700`, UX renk tablosu).

**4) `safeYamlValue` sertleştirme (`write-gate.ts:189-193`) — QA tur 1 bulgu 8 (ÖNEMLİ, D43) düzeltmesi.**
Mevcut kod yalnızca `/[:#\r\n]/` veya baştaki/sondaki boşluk görünce tırnaklıyor. Tur 1'de eklenen
gösterge-karakteri kümesi (19 karakter: `- ? : , [ ] { } # & * ! | > ' " % @` \` `) **tam** ama QA
gerçek `yaml@2.9.0` ile ölçtüğünde bunun **yetmediğini** kanıtladı: `true`, `false`, `null`, `~`,
`12`, `1.5`, `0x1F`, `.inf`, `.nan` gibi **tip-zorlayan** skalerler (case varyantları dahil) hiçbir
gösterge karakteriyle başlamıyor ama `yaml.parse` onları string yerine boolean/null/number'a
çözüyor — mimari §6.3 PATCH'i 7 bilinen değerle sınırlamadığı için bu değerler uca gerçekten
gelebilir (ör. bir kullanıcı `status` alanına yanlışlıkla `true` yazarsa kart sessizce bozulur).

**Yeni kural — QA'nın kendi önerisi seçildi ("en basiti: `yaml.parse(value)`'nun sonucu string
değilse tırnakla"):** sabit bir regex listesi büyütmek yerine **gerçek `yaml` paketiyle** (§2.3'te
zaten onaylı bağımlılık, `write-gate.ts` bu turda ilk kez `import { parse as parseYaml } from
'yaml'` ekler) değerin kendisini bağımsız bir belge olarak ayrıştırıp tipini kontrol eden genel bir
kural eklenir:
```ts
import { parse as parseYaml } from 'yaml'

const YAML_INDICATOR_START = /^[-?:,[\]{}#&*!|>'"%@`]/

function resolvesToNonString(value: string): boolean {
  try {
    return typeof parseYaml(value) !== 'string'
  } catch {
    // Ayrıştırma hatası veren değerler (ör. dengesiz köşeli parantez) zaten gösterge-karakteri
    // veya `:`/`#`/satır-sonu kurallarından biriyle yakalanır (bkz. aşağıdaki OR); burada
    // güvenli varsayılan `false`'tur — aşırı-tırnaklama yapmamak Karpathy §2 ile tutarlıdır ve
    // 40 fixture'lık kapsama testinde bu dalın hiçbir round-trip'i bozmadığı ölçüldü.
    return false
  }
}

function safeYamlValue(value: string): string {
  const needsQuoting =
    value === '' ||
    /[:#\r\n]/.test(value) ||
    value !== value.trim() ||
    YAML_INDICATOR_START.test(value) ||
    resolvesToNonString(value)
  if (!needsQuoting) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
```
Gösterge-karakteri kuralı **korunur** (silinmez) — `:`/`#`/satır-sonu/baştaki-sondaki-boşluk gibi
sözdizimsel tehlikeleri `resolvesToNonString` her zaman yakalamaz (ör. `"x:y"` `parse` edildiğinde
hâlâ string "x:y" dönebilir ama `:` kuralı zaten onu ayrıca tırnaklıyor); iki kural birbirini
**tamamlar**, birini kaldırmak diğerinin kapsamadığı sınıfı açık bırakır.

**Çalıştırılarak doğrulandı (bu turda, `npx yaml@2.9.0`, scratchpad, depo kirletilmedi):** 19
gösterge-karakteri fixture'ı (`-x`, `?x`, … , `` `x``) + 21 yeni tip-zorlayan fixture (`true`,
`True`, `TRUE`, `false`, `False`, `FALSE`, `null`, `Null`, `NULL`, `~`, `12`, `+12`, `1.5`, `0x1F`,
`0o17`, `.inf`, `+.inf`, `.Inf`, `.INF`, `.nan`, `.NaN`) = **40 fixture**, yukarıdaki yeni
`safeYamlValue` ile **40/40** gerçek `yaml.parse()` round-trip'i (`parsed.status === nextStatus`)
geçti (eski kod aynı 40 fixture'da 22 hata veriyordu — 19 gösterge fixture'ı zaten geçiyordu, 21 tip
fixture'ının tamamı hataydı, `-12`/`-.inf` gibi `-` ile başlayanlar tesadüfen indicator kuralından
geçiyordu). Ölçüm scripti bu turda silindi, repo'ya eklenmedi; kod turunda aynı 40 fixture
`tests/server/write-gate.test.ts`'e golden fixture olarak taşınacak (§8 mutasyon 8).

`- ? :` YAML'de yalnızca hemen ardından boşluk/satır-sonu geldiğinde gösterge sayılır (ör. `-x`
teknik olarak tırnaksız da geçerlidir) — bu ayrımı uygulamak yerine **her zaman** tırnaklamak
seçildi (aşırı-tırnaklama asla geçersiz YAML üretmez, eksik-tırnaklama üretebilir; Karpathy §2
"basit + güvenli" tercih edildi, ince ayrım gereksiz karmaşıklık).

**Doğrulama tekniği (mutasyon planı §8'de tekrar):** her golden fixture (17 mevcut + 40 yeni),
yazılan dosyanın frontmatter bloğu gerçek `yaml.parse()`'dan geçirilerek `parsed.status ===
nextStatus` ile round-trip doğrulanır — yalnızca "tırnaklandı" değil "gerçekten geçerli YAML üretti
VE değeri kayıpsız kodladı" kanıtlanır. **Kabul ölçütü artık 30/40 değil 40/40'tır** (QA tur 1
bulgu 8'in bağlayıcı kararı).

**5) `archiveDenial` async'e çevrilmiyor — bilinçli asimetri.**
`archiveDenial` kendi retry döngüsünü çalıştırmıyor (`atomicWrite`'ı hiç çağırmıyor, doğrudan
`fs.renameSync` kullanıyor, ✓ VERIFIED `write-gate.ts:333-338`) — bloklama riski (350ms) onda yok.
Kanban da onu hiç çağırmıyor (yalnızca kapılar F-008'in işi). Onu da async yapmak "tutarlılık"
adına gereksiz bir API yüzeyi genişletmesi olurdu (Karpathy §2) ve **kullanılmayan bir dosyaya
dokunmak** olurdu (Karpathy §3, "yalnızca görevle ilgili dosyalara dokun" — archiveDenial bu
feature'ın işiyle ilgili değil). Karışık sync/async yüzey (3 async + 1 sync) kabul edilen bir
asimetridir; F-008 kendi turunda `archiveDenial`'ı da async'e çevirmek isterse (örn. `writeGate
Approval` ile aynı `await` zincirinde kullanmak için, ADR-001 karar 7'nin sıralı akışı) bu ayrı bir
karardır, bu turda **önceden yapılmaz**.

**6) Sürükle-bırak — `@dnd-kit/core`, mimari zaten seçti.**
Mimari §3.4 satır 134 `@dnd-kit/core`'u zaten onaylı kapalı listeye koymuş (gerekçe: "saf JS,
klavye/erişilebilirlik desteği hazır, HTML5 native DnD'nin drop-hedefi isabet testi ve görsel geri
bildirim kodunu yazmaktan ucuz"). Bu turda yeniden tartışılmıyor — yalnızca kurulum + kullanım.
`DndContext` (sensors: `PointerSensor` + `KeyboardSensor` özel `coordinateGetter` ile, §7),
`useDroppable` (sütunlar), `useDraggable` (kartlar). Sıralama (within-column reorder) **yok** —
PRD'nin hiçbir AC'si kart sırası istemiyor, yalnızca sütun üyeliği; `@dnd-kit/sortable` alt paketi
**kurulmuyor** (gereksiz soyutlama, Karpathy §2).

**QA tur 1 bulgu 10 (ÖNEMLİ) düzeltmesi — `PointerSensor` ↔ AC7 (tıkla→modal) çakışması.**
Kod okunarak doğrulandı (`@dnd-kit/core@6.3.1` dist, `core.esm.js`): `useDraggable` döndürdüğü
`attributes` kartı `role="button"` + `tabIndex=0` yapar; `activationConstraint` verilmeden
`PointerSensor` `pointerdown`'da hemen sürüklemeyi başlatıp `click`'i yutar. Bu, AC7'nin "karta
tıkla → detay modalı" davranışıyla doğrudan çakışır. `PointerSensor` `activationConstraint: {
distance: 8 }` ile yapılandırılır (dnd-kit'in dokümante edilmiş seçeneği — 8px'ten az hareket eden
bir pointerdown/up **tıklama** sayılır, modal açılır; 8px'ten fazla hareket **sürükleme** başlatır).
**Klavye tarafı — QA tur 2 YENİ-R1 düzeltmesi (tek, tutarlı tuş tasarımı, üç yerde birebir
tekrarlanır: burada, §7, §5 AC9).** Bağlayıcı kaynak `docs/03-ux.md:443` (G3 onaylı) şunu söylüyor
(birebir alıntı): *"Karta `Tab` ile odaklan → `Enter`/`Boşluk` ile 'seçili' moda al (amber kenarlık
ile vurgulanır) → `←`/`→` ok tuşları hedef sütunu değiştirir (sütun adı `aria-live="polite"`
bölgesinde anons edilir) → `Enter` ile onayla (aynı iyimser yazma/hata akışı devreye girer) veya
`Esc` ile iptal."* UX hem `Enter` hem `Boşluk`'un seçili moda **girişi** başlatmasını istiyor —
ama AC7 aynı `Enter` tuşunun (kart `role="button"`, `tabIndex=0`) modal açmasını istiyor. Kart
boştayken (henüz sürükleme moduna girilmemişken) tek bir `Enter` tuşu iki farklı niyeti
(modal aç / sürüklemeyi başlat) aynı anda taşıyamaz — bu ayrım fiziksel olarak imkânsız, "duruma
bağlı" çözülemez çünkü henüz hiçbir durum yok (kart boşta).

**Bilinçli sapma (UX §443'ten, sessiz bırakılmıyor, gerekçeli):** boştaki karta `Enter` **yalnızca
modalı açar** (AC7, `role="button"` standart klavye semantiği); sürükleme moduna giriş **yalnızca
`Boşluk`** ile olur (`keyboardCodes.start: ['Space']`, UX'in önerdiği iki tetikleyiciden biri
düşürülüyor). Sürükleme modu **aktifken** ise `Enter` artık modalı **açmaz** — bu andan sonra
UX'in "`Enter` ile onayla" cümlesi birebir uygulanır: `KanbanCard` bir yerel `isDragSelected`
state'i tutar (`onDragStart`'ta `true`, `onDragEnd`/`onDragCancel`'da `false`); kartın kendi
`onKeyDown`'ı `event.key === 'Enter'` görünce **yalnızca `isDragSelected === false` iken**
`preventDefault` + modal açar, `isDragSelected === true` iken hiçbir şey yapmaz (event dnd-kit'in
kendi dinleyicisine bırakılır). `keyboardCodes.end` bu yüzden `['Space','Enter','Tab']` olarak
**dnd-kit'in kendi varsayılanıyla aynı** bırakılıyor (yalnızca `start`'tan `Enter` çıkarıldı) —
`Tab`'ın `end`'de kalması bilinçli: sürükleme modu aktifken kullanıcı `Tab` ile odağı başka bir
öğeye taşırsa dnd-kit bunu **commit** sayıp bırakır (kütüphanenin kendi tasarımı, sessizce
düşürülmezse "aktif sürükleme + odak başka yerde" tutarsız durumu oluşmaz). `Esc` her zaman
`cancel` (state hiç değişmeden, hiçbir istek gitmeden iptal). Sonuç: boşta `Enter`=modal,
`Boşluk`=sürüklemeyi başlat, sürükleme aktifken `Enter`/`Boşluk`/`Tab`=onayla, `Esc`=iptal —
çakışma yapısal olarak ortadan kalkıyor, UX'in tek karşılanamayan noktası (`Enter`'ın da
sürüklemeyi başlatabilmesi) açıkça işaretlendi. **CEO ödevi (§9'a eklendi):** `docs/03-ux.md:443`
bu sapmayı yansıtacak şekilde güncellensin (`Enter`/`Boşluk` yerine yalnızca `Boşluk` ile seçili
moda alınır, ibaresi).

`KanbanScreen.test.tsx`'te üçü ayrı ayrı test edilir: (a) jsdom, boşta `Enter` → modal açılır,
`onDragStart` çağrılmaz; (b) jsdom, `Boşluk` → `isDragSelected` `true` olur, modal açılmaz; (c)
jsdom, sürükleme aktifken `Enter` → modal açılmaz (assert: modal DOM'da yok), `onDragEnd` tetiklenir
(mock `onKeyDown` zinciri üzerinden çağrı sayımıyla). `kanban.spec.ts`'te AC7 (gerçek tıklama →
modal) ve AC9 (gerçek `Tab`→`Boşluk`→`ArrowRight`→`Enter` klavye dizisi → gerçek dosya yazımı)
birbirinden bağımsız iki gerçek E2E senaryosu olarak ikinci kez çitlenir.

**7) `features` SSE kanalı — mevcut telden hiçbir değişiklik, sunucu tarafında SIFIR yeni kod.**
F-005'in `service.ts`'i zaten `hub.broadcast('features', { project_id })` çağırıyor (chokidar'ın
150ms debounce'lu `onChange`'i üzerinden, `awaitWriteFinish` stabilite penceresiyle). **Kanban
PATCH handler'ı KENDİSİ hiçbir broadcast yapmaz** — HTTP yanıtı zaten güncel `FeatureCard`'ı
(yeni `content_hash` dahil) taşıyor, istemci kendi yazdığı değişikliği SSE'den öğrenmeye muhtaç
değil. Chokidar aynı dosya değişikliğini (kim yazdığından bağımsız, dosya sistemi seviyesinde)
zaten görüp ~200-350ms sonra `features:{project_id}` yayınlayacak — bu sinyal **hem** diğer açık
sekmelere gerçek güncellemeyi taşır **hem de** yazan sekmede zararsız bir "echo" olarak gelir
(§4.4'te bunun neden sonsuz döngü/yanıp sönmeye yol açmadığı ölçülüyor). Bu tasarım `projects/
server/service.ts`'e **tek satır bile dokunmadan** hem AC3 (2sn canlı güncelleme) hem AC8 (echo
güvenliği) hem F-005'in devrettiği taahhüt 2'yi (AC1 görsel kanıtı) karşılar.

**Mimari sapmaları (QA tur 1 bulgu 6, ÖNEMLİ, D45) — üç bilinçli sapma, işaretleniyor.**
Bu sözleşme `docs/02-architecture.md`'nin üç noktasından **bilinçli olarak** ayrılıyor; hiçbiri
tur 1'de sapma olarak işaretlenmemişti:

1. **§6.1 satır 396 — `features` payload'ı.** Mimari `{ project_id, cards: FeatureCard[] }` diyor;
   bu sözleşme yalnızca `{ project_id }` gönderiyor (yukarıdaki paragraf). **Gerekçe:** `cards`
   göndermek `projects/server/service.ts`'in `parse-feature.ts`'i import edip her chokidar
   `onChange`'inde dosyaları ayrıştırmasını gerektirir — ama §1 "Kapsam DIŞI" ve bu feature'ın
   dosya sahipliği (`docs/features/F-007-kanban.md` satır 25-26) `service.ts`'e dokunmayı **açıkça
   yasaklıyor**. `{project_id}` + istemci tarafı `GET` yeterli ve dosya sahipliğini ihlal etmiyor.
2. **§7.2 adım 9 (satır 546) — "yanıtta ve SSE'de yayınlanır".** Mimari PATCH handler'ının kendisinin
   SSE yayınlaması gerektiğini söylüyor; bu sözleşme PATCH'in **hiç broadcast yapmadığını**, chokidar'ın
   dosya değişikliğini bağımsız gördüğünü söylüyor (yukarıdaki paragraf). **Gerekçe:** PATCH handler'ının
   kendi broadcast'i chokidar'ın **aynı** değişiklik için yapacağı broadcast'le yarışır (iki sinyal,
   aynı olay) ve `hub`'ı `kanban/server/handlers.ts`'e enjekte etmeyi gerektirir — mimarinin zaten
   çalışan tek-kaynaklı (chokidar) tasarımını gereksiz yere çoğaltmak Karpathy §2'yi ihlal eder.
3. **§7.3 (satır 550-564) — `selfWrites` + `origin:'panel'/'external'`.** Mimari sunucu tarafında bir
   `selfWrites` Map'i + 1500ms TTL ile echo bastırması öngörüyor; bu sözleşme echo yönetimini
   **tamamen istemci tarafında**, hash-bazlı birleştirmeyle yapıyor (§4.4), sunucuda **sıfır** yeni
   kod. **Gerekçe:** `selfWrites` TTL'i `project-watcher.ts`/`service.ts`'e dokunmayı gerektirir
   (dosya sahipliği ihlali, madde 1 ile aynı sınıf) ve zamanlama penceresine (1500ms) bağımlı kırılgan
   bir mekanizmadır; istemci tarafı hash-eşitliği kontrolü zamanlamadan bağımsızdır (§4.4 madde 5,
   "sonsuz döngü yapısal olarak imkansız" kanıtı) ve daha az kod ile aynı garantiyi verir.

**CEO ödevi (§9'a taşındı):** bu üç sapma F-007 kod turu GEÇTİ aldıktan sonra bir ADR ile
`docs/02-architecture.md` §6.1/§7.2 adım 9/§7.3'e işlenmeli — mimari dokümanı gerçek davranışla
senkron kalsın.

**8) Yazma akışı — iyimser güncelleme + PATCH yanıtını bekleyip düzeltme.**
UX akış (a): sürükle-bırak anında kart hedef sütuna taşınır (React state, `useFeatures.patchStatus`
optimistic set), "yazılıyor…" rozeti. `writeFetch('PATCH', ...)` yanıtı gelince:
- `200` → kartı sunucunun döndürdüğü **gerçek** `FeatureCard` ile değiştir (yeni `content_hash`),
  toast `"${id} → ${label} (${key}) olarak güncellendi ✓"`, 3 sn sonra kaybolur.
- `409 conflict` → kartı yanıtın `data: FeatureCard`'ına göre yeniden çiz (UX akış b) — kullanıcının
  bıraktığı sütuna DEĞİL. 1 sn turuncu kenarlık + üstte banner (UX metni birebir): `"${id} panel
  açıkken dışarıdan değişti — güncel durum yüklendi (${label}/${key}). Az önceki sürükleme
  uygulanmadı."` [Kapat].
- `403 write_denied` / `500 write_failed` / `400 invalid_body` → kart **sürükleme öncesi** sütununa
  300ms ters animasyonla döner (UX akış c), kırmızı toast. Mesaj eşlemesi §4.3'te.
- Ağ hatası (fetch reddi) → aynı geri dönüş + toast `"${id} kaydedilemedi: sunucuya ulaşılamadı."`
  (UX sözlüğünde birebir karşılığı yok, en yakın "Dosyaya yazma izni reddedildi." kalıbıyla aynı
  ailede yeni ama tutarlı bir metin — CEO'ya soru, §9).

**9) Proje filtre çipleri — `events/web/FilterChips.tsx` yeniden kullanılır (kopyalanmaz); proje
listesi Karar 1'e göre kendi `GET` + App'in mevcut `projects` SSE kanalı — QA tur 1 bulgu 2
(BLOKLAYICI) düzeltmesi.**
`FilterChips.tsx`'in kendi doküman yorumu ("Proje/Agent/Tip için üç kez kullanılır") zaten bu
yeniden kullanımı öngörüyor. Mimarinin "`src/features/<x>/server/**` içinden `src/features/<y>/**`
import edilmez" kuralı (§4) yalnızca **server** tarafını kısıtlıyor; `kanban/web` → `events/web`
import'u bu kuralın kapsamında değil. Kopyalamak (DRY ihlali) yerine import tercih edildi.

**CEO Karar 1 (2026-09-05):** proje filtre çipleri için (a) seçildi (kendi `GET /api/projects`) —
**ama tek koşulla:** ilk yüklemeden sonra Kanban, App'in zaten aldığı **aynı `projects` SSE
kanalını** izler, ikinci bir canlı kaynak (yeni `EventSource`/`useEventStream()` çağrısı veya
polling döngüsü) **açılmaz**. Bunu tur 1 gövdeye yaymamıştı (bulgu 2); somut tasarım:

- `KanbanScreen.tsx` proje adı listesi için **mevcut, zaten test edilmiş `src/features/projects/
  web/useProjects.ts` hook'unu aynen `SettingsScreen.tsx`'in yaptığı gibi çağırır**:
  `const { items: projects } = useProjects(liveProjectsUpdate)`. Bu hook zaten mount'ta kendi
  `GET /api/projects`'ini yapıyor VE `liveUpdate` prop'u değiştiğinde state'i tam-liste-değiştirme
  ile güncelliyor (kod okunarak doğrulandı, `useProjects.ts:39-58` — F-005'te zaten yazılmış ve
  test edilmiş, bu turda **değiştirilmiyor**, yalnızca kanban/web'den de çağrılıyor).
- `liveProjectsUpdate` App.tsx'in **zaten sahip olduğu** `projectsUpdate` state'idir (App.tsx:16,
  `onProjects: setProjectsUpdate` — tek `useEventStream()` çağrısının bir sonucu). App.tsx bu state'i
  `SettingsScreen`'e verdiği gibi `KanbanScreen`'e de prop olarak verir (§2.2). Yeni bir bağlantı,
  yeni bir state, yeni bir dosya **yok** — var olan tek kaynağın ikinci bir tüketicisi eklendi.
- Sonuç: yalnızca **ilk** `GET /api/projects` Kanban'a özel (aynı `useProjects` çağrısının kendi
  mount efekti); ondan sonraki her güncelleme **tek** `projects` SSE olayından gelir, App.tsx'in tek
  `useEventStream()` bağlantısı üzerinden. İki liste zamanla ayrışamaz çünkü ikisi de aynı
  `projectsUpdate` state referansını okuyor.

**Çit (§2.1'e eklenmedi, `KanbanScreen.test.tsx`'e eklenir):** `liveProjectsUpdate` prop'u değişince
proje çipi etiketlerinin güncellendiğini doğrulayan bir test + kaynak-tarama testi: `src/features/
kanban/web/*.{ts,tsx}` dosyalarının hiçbirinde `new EventSource(` veya `useEventStream(` çağrısı
**geçmediğini** doğrulayan basit bir metin taraması (`tests/no-external-host.test.ts`'in "kaynak
metnini oku, yasaklı deseni ara" desenine benzer, ayrı dosya gerekmez — `KanbanScreen.test.tsx`
içinde bir `it()` olarak). Mutasyon: `KanbanScreen.tsx`'e sahte bir `new EventSource('/api/stream')`
eklenirse bu test KIRMIZI verir — "ikinci canlı kaynak" bir daha sessizce eklenemez.

**10) Bozuk frontmatter vs tanımsız `status` — iki ayrı UI yüzeyi.**
UX satır 288 ikisini ayırıyor: `parse_error` dolu kartlar **"Bilinmeyen durum" sütununa DEĞİL**,
ayrı bir "Ayrıştırılamayan dosyalar (N)" alanına (ör. sütunların üstünde küçük bir liste/banner)
gider ve **sürüklenemezler** (write-gate zaten böyle bir dosyaya `status:` satırı bulamayacağı için
`invalid_body` dönerdi — sürüklenebilir göstermek yanıltıcı olurdu). `column==='unknown'` ama
`parse_error` YOK olan kartlar (geçerli frontmatter, tanınmayan `status` değeri) "Bilinmeyen durum"
sütununda, **sürüklenebilir** (ADR-001 karar 5).

**11) `PATCH` gövde doğrulaması — HTTP katmanında yalnızca boş/uzunluk, YAML güvenliği write-gate'te.**
Mimari §6.3 satırı ("status boş / satır sonu-iki nokta içeriyor / >64 karakter → 400") bir
**şablon** (doküman satır 8, "kod blokları örnek/şablon"). `write-gate.ts` zaten satır-sonu
içeren değerleri reddediyor (`setFeatureStatus:213-215`, D38/Ö2) ve madde 4'ün sertleştirmesiyle
artık `:` dahil her gösterge karakterini güvenle tırnaklıyor — "iki nokta içeriyor" için ayrı bir
400 kuralına **gerek kalmadı** (write-gate zaten güvenli YAML üretiyor, tek sorumluluk ilkesi).
`handlers.ts` yalnızca `status` alanının **var/string/boş-olmayan/≤64 karakter** olduğunu kontrol
eder (`handleAddProject`'in gövde-boyutu kontrolü emsali); satır sonu/gösterge-karakteri kontrolü
write-gate'e bırakılır (tek doğrulama kaynağı, çift bakım yükü yok).

**12) `OPERATION_PATTERNS` koşulu — bu turda tetiklenmiyor, kayıt altına alınıyor.**
Kanban `OPERATION_PATTERNS`'a yeni bir desen **eklemiyor**, mevcut `featureStatus` desenini
**gevşetmiyor** (feature notu madde 6'nın koşulu budur). Bu nedenle adım 3/6'yı aynı turda
çitleme **zorunluluğu doğmuyor** — F-006'nın kabul ettiği "sıfır bağımsız kapsama" riski
değişmeden kalıyor, bu sözleşme §9'da yeniden not ediliyor (miras alınan risk, kapatılmıyor).

**13) `Atomics.wait` → async (T4) — tasarım detayı.** (QA tur 1: "devralınan taahhüt kapsama
tablosu" satır 4'ün eksik gördüğü bölüm; §6 madde 4'ün hatalı `§3 madde 4`/`safeYamlValue`
atfı **buraya** düzeltildi.) `write-gate.ts`'teki `sleepSyncMs(ms)` (`Atomics.wait` sarmalayıcısı,
`atomicWrite`'ın EPERM/EBUSY retry'ında 50/100/200 ms senkron blokluyor) `await delay(ms)`'e
çevrilir (`delay = (ms) => new Promise((r) => setTimeout(r, ms))`, yeni bağımlılık gerektirmez).
Bu, çağıran zincirin tamamını async yapar: `atomicWrite` → `async`, `atomicWriteOnce`'ı çağıran
`setFeatureStatus`/`writeGateApproval`/`writeGateDenial` → `async`, `Promise<WriteResult>` döner.
`archiveDenial` **dokunulmaz** (§3 madde 5 — kendi retry döngüsü yok). Çağrı sitesi taraması
(`grep`, bu turda çalıştırıldı): `src/` içinde `setFeatureStatus`/`writeGateApproval`/
`writeGateDenial`'ı **hiç çağıran yok** (F-006 hiçbir HTTP handler'a bağlı değildi) — yani imza
değişikliği bu turda yalnızca (a) testleri (`tests/server/write-gate.test.ts` ~43 çağrı sitesi,
`tests/server/write-gate-manifest.test.ts` ~5 çağrı sitesi, mekanik `await` eklenir) ve (b) bu
feature'ın kendi yeni çağıranını (`kanban/server/handlers.ts`'in `await setFeatureStatus(...)`,
§4.2 adım 4) etkiler — **regresyon riski yok**, çünkü değişmeden önce hiçbir üretim kodu bu
fonksiyonları çağırmıyordu. Event-loop-bloklanmama iddiası T4 testiyle ölçülür (§5, §8 mutasyon 7):
retry sürerken paralel bir `Promise.resolve().then(...)`'in **hemen** (mikrosaniyeler içinde,
retry'ın 50ms'lik ilk bekleme süresinden çok önce) çözüldüğü ölçülür — `Atomics.wait` geri gelirse
bu mikro-görev retry bitene kadar gecikir, test KIRMIZI verir.

---

## 4. Kart/yazma/çakışma sözleşmesi

### 4.1 `GET /api/features?project_id=…`

`handleListFeatures`: `project_id` yoksa `projectsService.list().items`'daki **var olan**
(`exists:true`) projelerin tümü taranır; varsa yalnızca o proje. Her proje için `list-features.ts`:
`fs.existsSync(path.join(project.path,'docs','features'))` yoksa boş dizi (kart yok, hata değil);
varsa `fs.readdirSync` + `.md` uzantı filtresi (alt dizine inilmez — mimari §5.3 "yalnızca dosya
adı" varsayımıyla tutarlı, F-005'in `depth:0` chokidar kararıyla aynı sınıf), her dosya
`fs.readFileSync` + `parse-feature.ts`. Yanıt: `200 { success:true, data: FeatureCard[] }`.
Performans: tek-kullanıcı, yerel araç; onlarca dosya beklenir (mevcut repo'da 11), senkron
okuma kabul edilebilir (Karpathy §2 — ölçülmeden önbellekleme eklenmez).

### 4.2 `PATCH /api/features/:project_id/:file`

Gövde: `{ status: string, expected_hash: string }`. Sıra (`handlePatchFeatureStatus`):
1. Body oku (65536 byte tavan, `handleAddProject` emsali) + JSON parse → hata → `400 invalid_body`.
2. `status`: `typeof === 'string' && status.length > 0 && status.length <= 64` değilse `400
   invalid_body`. `expected_hash`: `typeof === 'string' && length > 0` değilse `400 invalid_body`.
3. `project_id` kayıt defterinde yoksa `404 not_found`. `file` `decodeURIComponent` edilir (URL
   path segment) — ekstra doğrulama **yapılmaz**, write-gate'in kendi `FILE_NAME_PATTERN` +
   `resolveInsideRoot` adım 8'i zaten nihai hakemdir (çift doğrulama gereksiz, write-gate tek
   doğruluk kaynağı — ADR-005 madde 1 zaten "niyet API'si" ilkesini bunun için var).
4. `await setFeatureStatus(project.path, file, status, expected_hash)` — `project.path` kayıt
   anında zaten `realpathSync` ile çözülmüş (mimari §5.2), write-gate'in `root` sözleşmesini
   (mutlak + dizin) karşılar.
5. `WriteResult` → `ApiResponse<FeatureCard>`:

| `WriteResult` | HTTP | Gövde |
|---|---|---|
| `{ok:true, path, hash}` | 200 | `{success:true, data: <parse-feature.ts ile YENİDEN OKUNMUŞ FeatureCard>}` — write-gate `FeatureCard` üretmiyor (yalnızca `path`/`hash` döner, §"kısıtlar" mimari örneğinin aksine developer kararı), handler diski `readFileSync`+`parse-feature.ts` ile tazeler; bu `hash` alanının write-gate'in döndüğüyle **eşleştiğini** doğrulayan bir entegrasyon testi var. |
| `{ok:false, code:'conflict'}` | 409 | `{success:false, error:{code:'conflict', message:'Dosya değişti, güncel hali yüklendi.'}, data: <disk üzerinden yeniden okunan FeatureCard>}` — mimari §6.3 satır 426 ile birebir. |
| `{ok:false, code:'write_denied'}` | 403 | `{success:false, error:{code:'write_denied', message: sabit Türkçe metin}}` |
| `{ok:false, code:'write_failed'}` | 500 | `{success:false, error:{code:'write_failed', message:'Dosyaya yazma izni reddedildi.'}}` — **write-gate'in ham `describeError()` metni istemciye SIZDIRILMAZ**, sabit UX metni kullanılır (mimari §6 "message TÜRKÇE, kullanıcıya gösterilebilir" ilkesi — ham Node hata metni değildir); ham mesaj yalnızca sunucu `stderr`'ine loglanır (`process.stderr.write`, mevcut `service.ts`/`ingest.ts` deseniyle tutarlı). |
| `{ok:false, code:'invalid_body'}` | 400 | `{success:false, error:{code:'invalid_body', message:'Dosya biçimi tanınamadı.'}}` |

### 4.3 UX hata metni eşlemesi (Türkçe sözlük, `docs/03-ux.md`'den birebir + iki yeni) + aksiyonlar

**QA tur 1 bulgu 14 (ÖNEMLİ) düzeltmesi:** iki yeni metin CEO Karar 2(a)'nın "kısa, suçlayıcı
olmayan, eylem öneren" koşulunu karşılayacak şekilde "… Tekrar deneyin." kalıbına çevrildi; UX
akışlarının bağlayıcı `[Kapat]` (akış b, `docs/03-ux.md:239`) ve `[Tekrar dene]` (akış c, `docs/
03-ux.md:247`) butonları eklendi; başarı toast'ındaki literal `✓` karakteri UX Ton kuralını
(`docs/03-ux.md:377`, emoji/emoji-benzeri işaret yasağı) ihlal ettiği için `icons.tsx`'teki bir
onay ikonu bileşenine çevrildi.

| Durum | Metin | Aksiyon |
|---|---|---|
| 409 conflict | `"${id} panel açıkken dışarıdan değişti — güncel durum yüklendi (${label}/${key}). Az önceki sürükleme uygulanmadı."` | `[Kapat]` — yalnızca banner'ı gizler, state zaten güncel (§4.2 409 satırı). |
| 500 write_failed | `"${id} kaydedilemedi: dosyaya yazma izni reddedildi."` | `[Tekrar dene]` — kartın **tazelenmiş** `content_hash`'iyle (mevcut state'ten) aynı `patchStatus` çağrısını tekrar tetikler. |
| 403 write_denied / 400 invalid_body | `"${id} kaydedilemedi: dosya biçimi tanınamadı. Tekrar deneyin."` (UX sözlüğünde birebir yok; Karar 2 ile onaylı, eylem öneren biçime çevrildi) | `[Tekrar dene]` (yukarıdakiyle aynı mekanizma). |
| Ağ hatası (fetch reddi) | `"${id} kaydedilemedi: sunucuya ulaşılamadı. Tekrar deneyin."` (Karar 2 ile onaylı, yeni) | `[Tekrar dene]`. |
| Başarı toast | `<CheckIcon /> ${id} → ${label} (${key}) olarak güncellendi` (literal `✓` yok, `icons.tsx`'teki ikon + metin) | Yok (3 sn sonra otomatik kaybolur). |

**CEO ödevi (Karar 2(c), §9'a taşındı):** bu iki yeni metin (`write_denied`/`invalid_body` ve ağ
hatası satırları) CEO tarafından `docs/03-ux.md` Türkçe metin sözlüğüne eklenecek.

### 4.4 Çakışma tespiti ve echo yönetimi (madde D — nasıl ölçülür)

**Çakışma:** `expected_hash` = kartın istemcideki **o anki** `content_hash`'i, sürükleme
BAŞLADIĞINDA değil **bırakıldığında** okunur (state her zaman güncel tutulduğu için pratikte fark
etmez, ama `onDragEnd` içinde `card.content_hash`'e erişim garantisi bunu netleştirir). Yarış
durumu: iki hızlı ardışık sürükleme aynı karta yapılırsa ikinci PATCH ilkinin henüz güncellenmemiş
`content_hash`'iyle gidebilir → sunucu bunu da doğru şekilde `conflict` olarak reddeder (yanlış
davranış değil, ADR-005 madde 7'nin zaten öngördüğü davranış — "her zaman diskle karşılaştırılır").

**Echo yönetimi — ölçülebilir tanım:**
1. Kendi yazdığımız değişiklik için PATCH yanıtı zaten nihai `FeatureCard`'ı taşır → state hemen
   doğru hâle gelir, **hiçbir refetch gerekmez**.
2. ~200-350ms sonra chokidar'ın tetiklediği `features:{project_id}` SSE sinyali gelir (kendi
   yazımızın echo'su). `useFeatures` bunu **her zaman** bir `GET /api/features?project_id=X`
   refetch'iyle karşılar (dışarıdan gelen GERÇEK değişikliklerle ayırt edemeyiz, ayırt etmeye de
   gerek yok — bkz. 3).
3. Refetch sonucu state'e **hash-bazlı birleştirme** ile uygulanır: `file` anahtarıyla eşleşen her
   kart için, yeni `content_hash` eskisiyle **aynıysa o kartın referansı DEĞİŞTİRİLMEZ** (aynı
   nesne state'te kalır); farklıysa yeni nesneyle değiştirilir. `KanbanCard` `React.memo` ile
   sarılır (prop referansı değişmeyince re-render olmaz).
4. **Ölçüm (E2E, `tests/e2e/kanban.spec.ts`) — QA tur 1 bulgu 5 (BLOKLAYICI) düzeltmesi.** Tur 1'in
   planı iki nedenle üretim E2E'sinde ölü doğuyordu: (a) `data-render-count` yalnızca
   `import.meta.env.MODE !== 'production'` iken render ediliyordu ama `playwright.config.ts:19`
   `webServer.command: 'npm run build && npm start'` ile **üretim** derlemesi koşturuyor — öznitelik
   hiç basılmıyor; (b) "`fetchImpl` mock'unun çağrı sayısı" E2E'de anlamsız — gerçek tarayıcıda
   `fetchImpl` mock'u yok, gerçek ağ isteği var. Düzeltilmiş tasarım:
   - `data-render-count` **MODE kapısı kaldırılır, her ortamda her zaman render edilir** (bir
     `useRef` sayaç + `data-render-count={count}` — küçük, zararsız bir test-gözlemlenebilirlik
     özniteliği; iç araç panosu için üretim bulundle boyutu/gizliliği kaygısı yok, MC harici
     kullanıcıya açık bir ürün değil). `KanbanScreen.test.tsx`'e "öznitelik `null` DEĞİL, sayısal bir
     string" **null-guard assert'i** eklenir — attribute hiç basılmazsa test KIRMIZI verir (tur 1'in
     "`null === null` sessizce yeşil kalır" tuzağı böylece imkansız hale gelir).
   - `GET /api/features` çağrı sayısı `fetchImpl` mock'u yerine Playwright'ın **gerçek ağ
     yakalama** API'siyle sayılır: `let getCount = 0; page.on('request', (req) => { if
     (req.method() === 'GET' && req.url().includes('/api/features')) getCount++ })` — üretim
     derlemesinde de çalışır çünkü tarayıcı seviyesinde gerçek HTTP trafiğini dinler, mock'a
     ihtiyaç duymaz.
   - Test adımları — **QA tur 2 YENİ-R3 düzeltmesi: taban okuma anı sabitlendi, eşik kesin eşitliğe
     çevrildi** (önceki "en fazla 1 kez artar" eşiği taban belirsizliğinden dolayı mutasyon 5'i
     kaçırıyordu, ölçüldü): (a) sürükle-bırak yap, (b) PATCH yanıtını bekle ve **PATCH yanıtı DOM'a
     yansıdıktan hemen sonra** o kartın `data-render-count` değerini **taban (`before`)** olarak
     oku, (c) 3 saniye bekle (150ms debounce + 200ms `awaitWriteFinish` + ağ payından fazla — echo
     sinyalinin kesinlikle geldiği garanti pencere), (d) aynı kartın `data-render-count`'ını tekrar
     oku (`after`) ve **`expect(after).toBe(before)`** (kesin eşitlik) ile doğrula — hash-bazlı
     birleştirme sayesinde echo refetch'i bu karta yeni bir referans **üretmemeli** (kart zaten
     güncel, `React.memo` re-render etmemeli), (e) `getCount`'ın bu 3 saniyelik pencerede **tam
     olarak 1** olduğunu (`expect(getCount).toBe(1)`) doğrula (echo'nun gerçekten bir refetch
     tetiklediğinin kanıtı — "hiç tetiklenmedi" ile "tetiklendi ama zararsızdı" birbirinden
     ayrılır).
   - **Mutasyon → çit eşlemesi (QA tur 2 YENİ-R3 düzeltmesi — "tek mutasyon iki çiti de kırar"
     cümlesi YANLIŞTI, kaldırıldı; her mutasyon kendi çitine tek tek eşlenir):**
     - §8 mutasyon 5 (`useFeatures.ts`'teki hash-bazlı birleştirme kaldırılıp her refetch'te tüm
       kartlar yeni referansla değiştirilsin) → yalnızca **render-sayacı** çitini kırar: echo'da
       artık her zaman yeni referans üretilir, `after !== before` olur, `toBe(before)` **KIRMIZI**
       verir. `getCount` bu mutasyondan etkilenmez (fetch sayısı hâlâ tam 1), o assert bu
       mutasyonda **yeşil kalması beklenir** — bu normaldir, iki çit bağımsız iki farklı sınıfı
       (render/fetch) ölçer.
     - §8 mutasyon 14 (`useFeatures.ts`'teki `features` SSE sinyali gelince refetch tetiklenmesin)
       → yalnızca **`getCount`** çitini kırar: pencerede 0 fetch olur, `toBe(1)` **KIRMIZI** verir.
       Render-sayacı bu mutasyondan etkilenmez (hiç refetch olmadığı için zaten değişmez), o
       assert bu mutasyonda **yeşil kalması beklenir**.
5. **Sonsuz döngü imkansızlığı (yapısal, ayrıca test edilir):** `GET /api/features` hiçbir yazma
   tetiklemez (salt okunur), dolayısıyla refetch → chokidar tetiklemesi **yapısal olarak**
   mümkün değil (döngünün ikinci bacağı yok). `useFeatures.test.ts`'te bunu doğrulayan bir test:
   fake `EventSource`'tan ardışık 5 `features` sinyali gönderilir (gerçek chokidar debounce'unu
   simüle etmeden), `fetchImpl` çağrı sayısının sinyal sayısıyla **doğrusal** kaldığı (5 sinyal →
   5 fetch, katlanarak artmadığı) doğrulanır.
6. **ADR-004 y4 (sürüklerken gelen sinyal kuyruklanır):** `KanbanScreen` bir `isDraggingRef`
   tutar (`onDragStart`'ta `true`, `onDragEnd`/`onDragCancel`'da `false`). `useFeatures`'a
   sürükleme sırasında gelen `features` sinyalleri normal işlenmez, bir `project_id` kümesinde
   biriktirilir; sürükleme bitince (drop veya iptal) biriken proje kimlikleri için tek seferde
   refetch tetiklenir. Test: sürükleme sırasında 3 sinyal gönder → sürükleme bitene kadar
   `fetchImpl` çağrılmadığını, bitince 1 refetch (proje başına, tekilleştirilmiş) yapıldığını
   doğrula.

---

## 5. AC→test eşlemesi (10 AC + 6 taahhüt)

| # | Kabul kriteri / taahhüt | Katman | Neden |
|---|---|---|---|
| AC1 | Frontmatter `status`'a göre doğru sütun | Birim (`parse-feature.test.ts`, `list-features.test.ts`) | Saf ayrıştırma mantığı, dosya sistemi/DOM'a ihtiyaç yok. |
| AC2 | Sürükleme yalnızca `status` satırını değiştirir (diff testi) | Birim (`write-gate.test.ts`, **zaten var**, F-006'dan miras — bu turda dokunulmuyor, yalnızca async imzaya uyarlanıyor) | Karakter-bazlı diff mantığı zaten F-006'da kanıtlandı; F-007 yalnızca bunu **çağırır**, yeniden kanıtlamaz. |
| AC3 | Dış değişiklik ≤2sn'de yansır | Entegrasyon (`useFeatures.test.ts`, fake SSE + gerçek zamanlayıcı) + E2E (`kanban.spec.ts`, gerçek dosya yazımı + gerçek chokidar + gerçek tarayıcı, F-005 AC3 emsali) | Gerçek zamanlama iddiası yalnızca gerçek chokidar+SSE ile ölçülebilir; birim testte zamanlayıcı sahtelenir (hız), E2E'de gerçek süre ölçülür. |
| AC4 | Çakışma: yazma durur, uyarı, kart yeniden çizilir | Entegrasyon (`features-api.test.ts` — sunucu tarafı 409 + `data`) + jsdom (`useFeatures.test.ts` — istemci tarafı banner/yeniden çizim) + E2E (gerçek harici yazım ortasında sürükleme) | Sunucu mantığı (hash karşılaştırma) entegrasyonda; istemci tarafı state geri alma jsdom'da; **gerçek yarış senaryosu** (sürükleme sırasında disk değişir) yalnızca E2E'de gerçekçi kurulabilir. |
| AC5 | Yazma hatası: kart geri döner, hata gösterilir, panel çökmez | jsdom (`useFeatures.test.ts` — mock `writeFetch` 500 döner) + E2E (`kanban.spec.ts` — hedef dizini gerçekten salt-okunur/kilitli yaparak gerçek `write_failed`) | jsdom hızlı/izole mantık testi; E2E gerçek dosya sistemi hatasının uçtan uca davranışını kanıtlar (F-005 D20 emsali — "gerçek hata mı simüle mi" ayrımı önemli). |
| AC6 | Tanımsız `status` → "Bilinmeyen durum", sürüklenebilir | Birim (`parse-feature.test.ts` — column derivation) + E2E (gerçek sürükleme, hedef geçerli sütun) | Sınıflandırma saf mantık; sürüklenebilirlik gerçek DOM/pointer etkileşimi ister. |
| AC7 | Karta tıklama → salt okunur detay | jsdom (`KanbanScreen.test.tsx` — modal içerik, focus trap, `Esc`) | DOM/ARIA yapısı, layout gerekmez. |
| AC8 | Echo → sonsuz döngü/yanıp sönme yok | jsdom (`useFeatures.test.ts` — render-sayacı + fetch-sayacı, §4.4) + E2E (`kanban.spec.ts` — gerçek chokidar echo, gerçek DOM render sayacı) | Sayısal ölçüm mantığı jsdom'da hızlı doğrulanır; **gerçek chokidar zamanlaması** yalnızca E2E'de gerçektir (jsdom'da sahte SSE kullanılıyor). |
| AC9 | Klavye alternatifi çalışır | E2E (`kanban.spec.ts` — **QA tur 2 YENİ-R1 düzeltmesi:** gerçek `page.keyboard.press('Tab'/'Space'/'ArrowRight'/'Enter')` — `Tab` odaklanır, `Space` sürükleme moduna girer (`Enter` **değil**, §3 madde 6/§7 tek tuş tasarımıyla uyumlu), `ArrowRight` hedef sütuna kaydırır, `Enter` onaylar — gerçek dosya değişikliği doğrulanır) + Birim (`keyboardCoordinates.test.ts` — saf koordinat hesaplama) | **Kesin kural:** sürükleme/klavye-taşıma iddiaları jsdom'da ölçülemez (jsdom layout yapmaz, F-003 dersi, brief madde E). Yalnızca E2E gerçek klavye olaylarıyla gerçek sonucu (dosyaya yazıldı mı) kanıtlar. |
| AC10 | Sütun başlıkları "Etiket (kod)" biçiminde | Birim (`constants.ts` sabit değer testi) + jsdom (`KanbanColumn.test.tsx` veya `KanbanScreen.test.tsx` — render edilen metin) | Statik biçim, DOM metni `innerText()`/`textContent` ile yeterli (CSS dönüşümü yok, `uppercase` kullanılmıyor). |
| T1 (tablist) | Tam `tablist`/`tab`/`tabpanel` + ok tuşu + roving tabindex | jsdom (`KanbanScreen.test.tsx`/App testleri — ARIA öznitelikleri, `tabIndex` durumları) + E2E (gerçek ok tuşu, gerçek focus) | ARIA yapısı jsdom'da statik olarak doğrulanır; gerçek klavye focus akışı (`document.activeElement`) yalnızca gerçek tarayıcıda güvenilir. |
| T2 (F-005 AC1 kanıtı) | Klasör eklenince kart 5sn'de kanbanda görünür | E2E (`kanban.spec.ts` — gerçek proje fixture ekle, sekme değiştir, kart görünürlüğünü bekle) | Uçtan uca, brief'in doğrudan istediği kanıt. |
| T3 (dar genişlik) | 375px'te iki sekme + dişli erişilebilir | E2E (375px viewport, `boundingBox()` ölçümü, F-005 D23 emsali) | Layout/viewport iddiası. |
| T4 (`Atomics.wait`→async) | Event loop bloklanmaz | Birim (`write-gate.test.ts` — retry testi artık `await`; ayrıca yeni bir test: retry SÜRERKEN paralel bir `Promise.resolve()` mikro-görevinin **hemen** çözüldüğünü ölçerek event loop'un bloklanmadığını kanıtlar) | Event-loop-bloklanmama iddiası doğrudan zamanlama ölçümüyle kanıtlanır, DOM gerekmez. |
| T5 (`safeYamlValue`) | Gösterge karakterli ve tip-zorlayan değerler güvenli yazılır | Birim (`write-gate.test.ts` — 40 yeni golden fixture: 19 gösterge-karakterli + 21 tip-zorlayan, her biri gerçek `yaml.parse()` round-trip, **40/40** kabul ölçütü) | §3 madde 4. |
| T6 (`OPERATION_PATTERNS` koşulu) | Bu turda tetiklenmedi | Yok — kayıt (§3 madde 12, §9) | Hiçbir kod değişikliği bu koşulu tetiklemiyor; test eklemek "olmayan bir riski test etmek" olurdu. |
| D1 (boş durum) | Proje seçili + hiç kart yok → boş durum ikon+başlık+açıklama+"Ayarlar'a git" aksiyonu (`docs/03-ux.md:288`) | jsdom (`KanbanScreen.test.tsx`) | QA tur 1 bulgu 12 — durum tasarımı listesi §5'te satır olarak yoktu. |
| D2 (iskelet) | Yükleme sırasında sütun iskeletleri | jsdom | Aynı, bulgu 12. |
| D3 (proje okunamadı) | Proje bazlı "⚠ app-factory: dosyalar okunamadı" banner'ı | jsdom (`GET` `docs/features` yok/`EACCES` mock) | Aynı, bulgu 12. |
| D4 (ayrıştırılamayan dosyalar) | "Ayrıştırılamayan dosyalar (N)" ayrı liste, sürüklenemez (§3 madde 10) | jsdom + Birim (`parse-feature.test.ts` — §8 mutasyon 11) | Aynı, bulgu 12. |
| D5 (bağlantı koptu) | Amber "Canlı senkron durdu — son görülen: …[Yenile]" banner'ı, `stream.connectionStatus` App'ten prop olarak gelir (TimelineScreen ile aynı mekanizma, §3 madde 9 ek) | jsdom (`stream.connectionStatus='disconnected'` mock) | Aynı, bulgu 12. |
| D6 (Son senkron çubuğu) | "Son senkron: N sn önce" alt bilgi çubuğu, `useFeatures.lastSyncedAt`'ten türetilir | jsdom (sahte zamanlayıcı ile `lastSyncedAt` ilerletilir) | Aynı, bulgu 12. |

---

## 6. Devralınan taahhütlerin planı (her biri birinci sınıf iş)

1. **Tam `tablist` deseni** — §3 madde 3 (sütun/başlık) DEĞİL, App.tsx navigasyonu. `role="tablist"`
   sarmalayıcı, iki `role="tab"` (`aria-selected`, `aria-controls`, `id`, roving `tabIndex`: seçili
   `0`, diğeri `-1`), iki `role="tabpanel"` (`id`, `aria-labelledby`, mevcut `hidden` deseni
   **korunur** — F-003'ün "TimelineScreen hiç unmount olmaz" garantisi bozulmaz, yalnızca ARIA
   rolleri eklenir). Otomatik aktivasyon (ok tuşu odağı taşıdığı anda sekme de değişir — ekranlar
   arası geçiş ucuz, onay adımı gerekmez). Ayarlar dişlisi bu yapının **dışında** kalır (`aria-
   pressed` toggle button, değişmez).

   **QA tur 1 bulgu 11 (ÖNEMLİ) düzeltmesi — üçüncü ekran (Ayarlar) aktifken tablist durumu.**
   `App.tsx`'in `activeScreen` state'i üç değer alır (`'timeline'|'settings'|'kanban'`), ama
   yalnızca ikisi `tab`'tır — Ayarlar bir `tab` değil, ayrı bir toggle butonudur. Kural: Ayarlar
   açıkken tablist'in **hiçbir zaman geçersiz bir duruma düşmemesi** için, `activeScreen==='settings'`
   olduğunda **son seçili sekme** (Ayarlar'a geçmeden hemen önceki `'timeline'` veya `'kanban'`
   değeri, ayrı bir `lastTabScreen` state'inde tutulur) `aria-selected="true"` + `tabIndex=0`
   olarak **kalır**; o sekmenin `tabpanel`'i `hidden` olur (Ayarlar kendi `#panel-settings`'inde
   gösterilir). Böylece tablist her zaman tam olarak bir seçili `tab`'a sahiptir (geçerli WAI-ARIA
   Tabs deseni, klavye tuzağı yok). Mevcut `aria-current="page"` (App.tsx:51) **kaldırılır** —
   `aria-selected` onun yerini alır, ikisi birlikte kalırsa çelişirdi. `KanbanScreen.test.tsx`/App
   testlerine bu üçüncü durumu (Ayarlar açıkken hangi `tab`'ın `aria-selected` kaldığı) doğrulayan
   bir test eklenir.
2. **F-005 AC1'in görsel kanıtı** — `tests/e2e/kanban.spec.ts`: geçici fixture proje oluştur
   (`docs/features/F-100.md`, `status: todo`), `POST /api/projects` ile ekle, Kanban sekmesine
   geç, kartın **5 saniye içinde** "Yapılacak (todo)" sütununda göründüğünü `toBeVisible({timeout:
   5000})` ile doğrula. Bu, F-005'in sözleşmesinin §9'da açıkça F-007'ye devrettiği kanıt.
3. **Dar genişlikte gezinme** — 375px E2E testi: her iki sekmenin (`Zaman Çizelgesi`, `Kanban`)
   ve dişlinin `boundingBox()`'ının viewport genişliği içinde kaldığını VEYA yatay kaydırma
   şeridiyle erişilebilir olduğunu (F-005 D23'ün kurduğu `overflow-x-auto`+`shrink-0` yapısı zaten
   bunu sağlıyor, Kanban sekmesi aynı `nav` içine eklendiği için ek CSS gerekmez) doğrular; gezinme
   hiçbir zaman tamamen gizlenmez.
4. **`Atomics.wait` → async** — tasarım §3 madde 13, §5 T4. (QA tur 1 bulgu: bu satır önceden
   yanlışlıkla §3 madde 4'e — `safeYamlValue`'ya — atıf yapıyordu; düzeltildi.)
5. **`safeYamlValue` sertleştirme** — §3 madde 4, §5 T5.
6. **`OPERATION_PATTERNS` koşulu** — §3 madde 12, tetiklenmedi, kayıt altında.

---

## 7. Erişilebilirlik + `tablist` + klavye

**Tablist (§6 madde 1):** WAI-ARIA "Tabs Pattern", otomatik aktivasyon. `ArrowLeft`/`ArrowRight`
odağı bir önceki/sonraki `tab`'a taşır (döngüsel: son sekmeden sağa → ilk sekme) ve aynı anda
`activeScreen`'i günceller (otomatik aktivasyon — ekstra `Enter` gerekmez, iki ekran arası geçiş
maliyetsiz). `Home`/`End` ilk/son sekmeye atlar (APG önerisi, ekstra karmaşıklık değil — 2 sekmede
`Home`=sol, `End`=sağ, tek satırlık ek).

**Kart sürükleme klavye alternatifi (AC9) — QA tur 2 YENİ-R1 düzeltmesi, §3 madde 6 ile birebir
aynı tasarım (tek kaynak, tekrar burada yazılıyor çünkü §7 erişilebilirlik bölümünün doğal yeri):**
`@dnd-kit/core` `KeyboardSensor` + özel `keyboardCoordinates.ts` `coordinateGetter`:
`Tab` ile karta odaklan (kart zaten `tabIndex=0`, dnd-kit `useDraggable`'ın `attributes` çıktısı
bunu sağlar; boştaki karta `Enter` basılırsa AC7 gereği **modal açılır**, sürükleme başlamaz) →
`Boşluk` ile seçili moda al (`keyboardCodes: {start:['Space'], end:['Space','Enter','Tab'],
cancel:['Escape']}` — bu, dnd-kit'in kendi varsayılanının [`start:['Space','Enter']`,
`end:['Space','Enter','Tab']`, `cancel:['Escape']`] **yalnızca `start`'tan `Enter` çıkarılmış**
hâlidir, `end`'den hiçbir şey **sessizce düşürülmedi**, `Tab` bilinçli olarak korundu) → `←`/`→`
`coordinateGetter` ile hedef sütunun merkezine atlar (piksel artışı değil, doğrudan sütun indeksi
kaydırma, sütun adı `aria-live="polite"` bölgesinde anons edilir) → sürükleme modu **aktifken**
`Enter` (veya `Boşluk`/`Tab`) onaylar (aynı iyimser yazma akışı, §3 madde 8 — bu adımda `Enter`
artık modal AÇMAZ, kartın `onKeyDown`'ı `isDragSelected===true` iken erken çıkar) veya `Esc` iptal
eder (state hiç değişmez, hiçbir istek gitmez — testte `writeFetch`/`fetch` mock'unun çağrılmadığı
doğrulanır).

**UX §443'ten bilinçli sapma (sessiz bırakılmıyor — ayrıntılı gerekçe §3 madde 6'da):**
`docs/03-ux.md:443` "`Enter`/`Boşluk` ile 'seçili' moda al" diyor; bu sözleşme yalnızca `Boşluk`'u
başlatıcı olarak kullanıyor çünkü boştaki bir karta `Enter` basıldığında AC7'nin "modal aç"
talebiyle aynı tuş çakışıyor ve boşta (henüz sürükleme başlamamışken) bu iki niyeti "duruma bağlı"
ayırmanın bir yolu yok. `Enter`'ın **onaylama** rolü (UX'in aynı cümlesinin ikinci yarısı)
birebir korunuyor. CEO ödevi: `docs/03-ux.md:443` bu sapmayı yansıtacak şekilde güncellensin (§9).

**QA tur 1 bulgu 7 (ÖNEMLİ, D44) düzeltmesi — anonslar `assertive` DEĞİL `polite` olacak.**
Tur 1 "dnd-kit'in kendi otomatik canlı bölgesi `aria-live="polite"`" diyordu — **bu yanlıştı,
ölçüldü.** Bu turda gerçek paket kaynağı indirilip okundu (`npm install @dnd-kit/accessibility@
3.1.1 @dnd-kit/core@6.3.1`, scratchpad, depo kirletilmedi):
- `@dnd-kit/accessibility@3.1.1` `dist/accessibility.esm.js` — `LiveRegion({id, announcement,
  ariaLiveType = "assertive"})` → `<div role="status" aria-live={ariaLiveType} aria-atomic
  ...>`. Varsayılan **her zaman** `"assertive"`.
- `@dnd-kit/core@6.3.1` `dist/core.esm.js` satır 168 — `Accessibility` bileşeni `<LiveRegion
  id={liveRegionId} announcement={announcement} />` çağırıyor; `ariaLiveType` **hiç geçirilmiyor**.
  `Accessibility` `DndContext`'in render ağacına **koşulsuz** ekleniyor (satır 3363,
  `React.createElement(Accessibility, {...accessibility, ...})`) — yani `DndContext` monte olduğu
  sürece bu `aria-live="assertive"` `<div>` DOM'da **her zaman var**, `announcements` prop'uyla
  yalnızca İÇERİĞİ değiştirilebilir, `aria-live` TÜRÜ **değiştirilemez** (kütüphane sınırlaması,
  yama/fork gerektirir — bu turun kapsamı dışı).

**Seçilen çözüm (kütüphanenin duyurularını sustur + kendi `polite` bölgemizi sağla):**
1. `DndContext`'e `accessibility={{ announcements: { onDragStart: () => '', onDragOver: () => '',
   onDragEnd: () => '', onDragCancel: () => '' } }}` verilir — dnd-kit'in kendi `assertive`
   bölgesinin `announcement` state'i hep `''` kalır (boştan boşa değişim ekran okuyucu tarafından
   anonslanmaz; `useAnnouncement` kodu okunarak doğrulandı: `announce()` yalnızca `value != null`
   ise `setAnnouncement` çağırıyor, `''` geçerli bir değer, ama içerik hiç değişmediği için pratikte
   sessiz kalır). Varsayılan İngilizce metinler de bu sayede hiç görünmez.
2. `KanbanScreen.tsx` kendi `<div role="status" aria-live="polite" aria-atomic="true"
   className="sr-only">{liveMessage}</div>` bölgesini render eder. `liveMessage` state'i
   `DndContext`'in **üst seviye** `onDragStart`/`onDragOver`/`onDragEnd`/`onDragCancel` prop'larında
   (`accessibility.announcements`'tan AYRI, gerçek sürükleme state mantığının zaten dinlediği aynı
   callback'ler) Türkçe metinlerle güncellenir: `onDragStart: "${title} kartı seçildi"`,
   `onDragOver: "${column.label} (${column.key}) sütununa taşınıyor"`, `onDragEnd: "${title} →
   ${column.label} (${column.key}) olarak taşındı"`, `onDragCancel: "İptal edildi"` —
   `docs/03-ux.md:443` ile birebir aynı metinler, yalnızca taşıyıcı bölge değişti.

**Çit:** `KanbanScreen.test.tsx`'e iki assert: (a) sayfada `[aria-live="assertive"]` seçicisiyle
bulunan öğenin (dnd-kit'in kendi `LiveRegion`'ı, `id` deseni `DndLiveRegion-*`) `textContent`'i
`onDragStart`/`onDragEnd` çağrıldıktan sonra da **boş kalır** (asla anons içeriği taşımaz); (b)
kendi `[aria-live="polite"]` bölgemizin `textContent`'i aynı olaylarda **beklenen Türkçe metne**
güncellenir. **Mutasyon:** `accessibility.announcements`'ın boş-string override'ı kaldırılırsa
dnd-kit'in varsayılan İngilizce metni `assertive` bölgeye yazılır → assert (a) KIRMIZI verir.

**QA tur 2 NOT-2 düzeltmesi — dnd-kit'in İngilizce ekran okuyucu talimatları geçersiz kılınıyor.**
Aynı dist okumasında (`@dnd-kit/core@6.3.1` `core.esm.js:165-169`, `:3437-3438`) iki ayrı İngilizce
metin yüzeyi daha bulundu, önceki tur bunları hiç anmamıştı: (1) `defaultScreenReaderInstructions
.draggable` ("To pick up a draggable item, press the space bar…") `HiddenText` ile render edilip
her karta `aria-describedby` ile bağlanıyor — **eski/varsayılan tuş tasarımını** anlatıyor (`Enter`
ile bırakma dahil), bu sözleşmenin gerçek tuş tasarımıyla (`Boşluk` başlat, `Enter`/`Boşluk`/`Tab`
onayla) uyuşmuyor; (2) `attributes.roleDescription` üzerinden `aria-roledescription="draggable"`
veriliyor (İngilizce). Türkçe arayüzde ikisi de UX ihlali. **Çözüm:** her ikisi kendi Türkçe
metinlerimizle geçersiz kılınır, `DndContext`'e verilir:
```ts
accessibility={{
  screenReaderInstructions: {
    draggable:
      'Bu kartı taşımak için Boşluk tuşuna basın, sonra sol veya sağ ok tuşlarıyla hedef sütuna ' +
      'gidin, Enter veya Boşluk ile onaylayın ya da Escape ile iptal edin.',
  },
}}
```
ve her `useDraggable(id, { attributes: { roleDescription: 'kart' } })` çağrısında `aria-
roledescription="kart"` üretilir. **Çit:** `KanbanScreen.test.tsx`'e iki assert eklenir — (a)
kartın `aria-describedby` özniteliğinin işaret ettiği gizli metin düğümünün `textContent`'i
yukarıdaki Türkçe cümleyi (gerçek tuş adlarıyla: "Boşluk", "Enter") içerir, İngilizce "space bar"
metnini **içermez**; (b) kartın `aria-roledescription` değeri `"kart"`tır (İngilizce `"draggable"`
**değil**). **Mutasyon:** `screenReaderInstructions`/`roleDescription` override'ları kaldırılırsa
dnd-kit'in varsayılan İngilizce metinleri geri gelir → her iki assert KIRMIZI verir.

**Odak sırası / hedef boyutu / kontrast:** mevcut App.tsx odak sırasına (sekme çubuğu → Ayarlar →
filtre çipleri → içerik) Kanban ekleniyor, değiştirmiyor. Kartlar/sütun başlıkları/butonlar en az
32px yükseklik (`min-h-8` Tailwind sınıfı, `FilterChips`/`ProjectRow` emsali). Renk körlüğü
kuralı: her durum rengi ikon+metinle birlikte (UX renk tablosu zaten ikon eşlemesi veriyor,
`icons.tsx`'te uygulanır).

---

## 8. Mutasyon planı (10-12 kritik test, her AC/taahhüt için ≥1)

| # | Mutasyon | Beklenen KIRMIZI | Test |
|---|---|---|---|
| 1 | `parse-feature.ts`: `column` türetimi her zaman `'todo'` döndürsün | AC1/AC6 testleri (farklı status'lu fixture'lar) | `parse-feature.test.ts` |
| 2 | `list-features.ts`: `.md` uzantı filtresi kaldırılsın | ".txt dosyası atlanır" testi | `list-features.test.ts` |
| 3 | `handlers.ts`: `expected_hash` karşılaştırması kaldırılıp her zaman yazılsın | `features-api.test.ts` 409 testi (artık 200 dönerdi) | `features-api.test.ts` |
| 4 | `handlers.ts`: 500 mesajı ham `describeError()` sızdırılsın (sabit metin yerine) | "mesaj sabit Türkçe metin" testi | `features-api.test.ts` |
| 5 | `useFeatures.ts`: hash-bazlı birleştirme kaldırılıp her refetch'te tüm kartlar yeni referansla değiştirilsin | Echo render-sayacı testi (§4.4 madde 4) + E2E `getCount`/`data-render-count` ölçümü (D42) | `useFeatures.test.ts` + `kanban.spec.ts` |
| 6 | `useFeatures.ts`: sürükleme-sırasında-kuyruklama (`isDraggingRef`) kaldırılsın | ADR-004 y4 testi (§4.4 madde 6) | `useFeatures.test.ts` |
| 7 | `write-gate.ts`: `sleepSyncMs`/`Atomics.wait` geri getirilsin (mikro-görev testi) | T4 event-loop testi | `write-gate.test.ts` |
| 8 | `write-gate.ts`: `YAML_INDICATOR_START` regex'i kaldırılsın | T5 golden fixture'ların 19'u (round-trip `yaml.parse` assert'i) | `write-gate.test.ts` |
| 8b | `write-gate.ts`: `resolvesToNonString` (yaml.parse tip kontrolü) kaldırılsın (D43) | T5'in 21 yeni tip-zorlayan fixture'ı (`true`/`null`/`12`/`.inf`/… round-trip'i) | `write-gate.test.ts` |
| 9 | `App.tsx`: `role="tablist"`/`role="tab"` kaldırılsın (**dosya düzeltmesi:** tur 1 `KanbanScreen.tsx` yazıyordu — tablist §6 madde 1/§2.2'ye göre `App.tsx`'te kurulur, `KanbanScreen.tsx`'te değil) | T1 ARIA testi | `App.tsx` testleri / `KanbanScreen.test.tsx` (App üzerinden) |
| 10 | `keyboardCoordinates.ts`: sütun indeksleme yerine sabit piksel artışı döndürülsün | `keyboardCoordinates.test.ts` + AC9 E2E | İkisi de |
| 11 | `parse-feature.ts`: bozuk frontmatter'da `parse_error` set edilmesin (sessizce boş kart) | "Ayrıştırılamayan dosyalar" testi | `parse-feature.test.ts` |
| 12 | `App.tsx`: 375px'te `overflow-x-auto` kaldırılıp tek satır zorlansın | T3 375px E2E | `kanban.spec.ts` |
| 13 | `parse-feature.ts`: `content_hash`'i yalnızca frontmatter bloğundan hesaplasın (tam dosyadan değil) (D41/Ek) | "çapraz-modül tutarlılığı" testi (§3 madde 2) — gerçek `setFeatureStatus` artık `conflict` döner | `parse-feature.test.ts` |
| 14 (AC3) | `useFeatures.ts`: `features` SSE sinyali gelince refetch tetiklenmesin (sinyal yok sayılsın) | AC3 E2E (dış yazı 2 sn içinde yansımaz) | `kanban.spec.ts` |
| 15 (AC5) | `useFeatures.ts`: `patchStatus`'ta hata durumunda kartı eski sütununa geri almayan (rollback'siz) dal bırakılsın | AC5 jsdom testi (500 sonrası kart yanlış sütunda kalır) | `useFeatures.test.ts` |
| 16 (AC7) | `FeatureDetailModal.tsx`: `deps` veya `sprint` alanlarından biri render edilmesin | AC7 jsdom testi (modal içerik eksik) | `KanbanScreen.test.tsx` |
| 17 (AC10) | `KanbanColumn.tsx`: başlık biçimi `` `${label} (${key})` `` yerine yalnızca `label` olsun | AC10 jsdom testi (biçim metni yok) | `KanbanScreen.test.tsx`/`KanbanColumn.test.tsx` |
| 18 (T2) | `useFeatures.ts`/`useProjects` reuse: yeni eklenen projenin ilk `features`/`projects` sinyali yok sayılsın | T2 E2E (yeni proje kartı 5 sn içinde görünmez) | `kanban.spec.ts` |

---

## 9. Alınan kararlar, CEO ödevleri ve riskler

**QA tur 1 bulgu 1 (BLOKLAYICI) düzeltmesi:** bu bölüm önceden üç soruyu **açık** sunuyordu; CEO
turun sonunda (§"CEO kararları — §9'daki üç soruya cevap") bunları bağlayıcı şekilde cevapladı ama
gövdeye yayılmamıştı (F-005/F-006'da tur kaybettiren aynı kalıp). Aşağıdaki üç madde artık **açık
soru değil, alınan karar**dır; ayrıntılı tasarım gövdede (§3/§4/§6/§7) işlenmiştir.

**Alınan kararlar:**
1. **Karar 1 (proje filtre çipleri):** (a) — kendi `GET /api/projects` (mevcut `useProjects` hook'u
   yeniden kullanılır) — **ama** ilk yüklemeden sonra Kanban App'in aldığı **aynı `projects` SSE
   kanalını** (`liveProjectsUpdate` prop'u) izler, ikinci bir canlı kaynak açılmaz. Tasarım: §3
   madde 9, §2.2 (`App.tsx` satırı). Kapandı.
2. **Karar 2 (iki yeni hata metni):** onaylandı, "… Tekrar deneyin." kalıbına çevrildi (Karar 2(a)
   üslup koşulu), ham write-gate hata metni istemciye sızmaz (Karar 2(b), §4.2 500 satırı + §8
   mutasyon 4 ile çitli), metinler §4.3'te birebir yazıldı (Karar 2(c)). **CEO ödevi:** bu iki metin
   `docs/03-ux.md` Türkçe metin sözlüğüne eklenmeli (kod turu tamamlanmadan önce ya da eş zamanlı).
3. **Karar 3 (`archiveDenial` async'e çevrilmiyor):** onaylandı, §3 madde 5'te gerekçelendirildi ve
   bu turda kod okunarak doğrulandı (`write-gate.ts:333-338`, kendi retry döngüsü yok). **F-008'e
   devredilen taahhüt** (bu turda kaydediliyor, Karar 3'ün emrettiği cümle birebir): *F-008
   `archiveDenial`'ı bir handler'a bağlamadan önce senkron bekleme içerip içermediğini denetlemeli
   ve gerekiyorsa asenkrona çevirmelidir.* **CEO ödevi:** bunu `docs/features/F-008-*.md` feature
   notuna da işlemeli.
4. **Ek (content_hash tutarlılığı):** tasarım write-gate'in gerçek davranışıyla uyuşuyor (§3 madde 2
   + "content_hash tutarlılık denetimi" bölümü, bu turda `npx tsx` ile 5 fixture çalıştırılarak
   doğrulandı) ve test artık davranışsal (§3 madde 2, §8 mutasyon 13). Kapandı.
5. **CEO ödevi (D45, §3 madde 7 "Mimari sapmaları"):** kod turu GEÇTİ aldıktan sonra bir ADR ile
   `docs/02-architecture.md` §6.1 (`features` payload'ı) / §7.2 adım 9 (SSE yayını) / §7.3
   (`selfWrites`) F-007'nin gerçek tasarımına göre güncellenmeli.
6. **CEO ödevi (QA tur 2 YENİ-R1, klavye tasarımının UX §443'ten sapması):** `docs/03-ux.md:443`
   şu an "`Enter`/`Boşluk` ile 'seçili' moda al" diyor; bu sözleşme AC7'nin (karta tıkla → modal)
   aynı `Enter` tuşuyla çakışmasını çözmek için sürükleme moduna girişi yalnızca `Boşluk`'a
   daraltıyor (`Enter`'ın onaylama rolü korunuyor, §3 madde 6/§7). Kod turu GEÇTİ aldıktan sonra
   CEO bu satırı gerçek davranışla eşleşecek şekilde güncellemeli (`Enter`/`Boşluk` yerine yalnızca
   `Boşluk` ile seçili moda alınır).

**Riskler (miras alınan, bu turda kapatılmayan):**
- `OPERATION_PATTERNS` adım 3/6'nın sıfır bağımsız kapsaması (F-006'dan miras, §3 madde 12) —
  bu turda tetiklenmedi, gelecekte `OPERATION_PATTERNS` genişlerse çitlenmeli.
- `write-gate.ts`'in içe aktarma-takma-ad taraması yalnızca `node:fs`/`fs`/`fs/promises` bilir
  (F-006'dan miras, değişmedi).
- 145 dosyalık chokidar `EBUSY` senaryosu hâlâ test edilmemiş (F-005'ten miras).
- `@dnd-kit/core`'un React 19 ile resmi peer-dep aralığı henüz `>=16.8.0` diyor (React 19
  çıkışından önce yayınlanmış son sürüm, 6.3.1) — çalışma zamanı uyumsuzluğu beklenmiyor ama
  `npm install` bir peer-dependency uyarısı basabilir (hata değil). Kod turunda gerçek `npm
  install` çalıştırılıp doğrulanacak.
- **Echo zamanlaması (QA tur 1 bulgu 13 — §5 AC3 ile bu risk maddesi çelişiyordu, düzeltildi):**
  echo yönetiminin doğruluğu chokidar'ın gerçek zamanlama davranışına (150ms debounce + 200ms
  `awaitWriteFinish`) bağlı. **Bağlayıcı kural (çelişki artık yok):** AC3, kod turunda
  `kanban.spec.ts`'te **gerçek duvar saati ölçümüyle** doğrulanmak ZORUNDADIR — harici dosya
  yazımının anı (`Date.now()` E2E test kodunda) ile kartın yeni sütunda `toBeVisible` olduğu an
  arasındaki fark `expect(elapsed).toBeLessThan(2000)` ile ölçülür; F-005'in daha önce ölçtüğü
  değerlere güvenilerek bu ölçüm **atlanamaz**. Sorun bu ölçümde ortaya çıkarsa bloklayıcı sayılır.

---

## CEO kararları — §9'daki üç soruya cevap (2026-09-05)

> **Bu bölüm sözleşmenin GÖVDESİNE yayılmalıdır** (§3, §4, §5, §8 ilgili yerleri). F-005 ve F-006'da
> karar turun sonuna eklenip gövdeye yayılmadığı için tur kaybettik (`CLAUDE.md` öğrenilen kural).

### Karar 1 — Kanban proje filtresi: kendi `GET /api/projects`'ini yapar (seçenek a onaylandı)
Gerekçe: F-005 üç QA turundan yeni çıktı; başlangıç yüklemesini `App.tsx`'e taşımak
`SettingsScreen`'in yükleme yolunu değiştirmek demek ve o feature'ı gereksiz yere riske atar.
**Ama tek koşulla:** ilk yüklemeden sonra Kanban, App'in zaten aldığı **aynı `projects` SSE
kanalını** izler — ikinci bir canlı kaynak **oluşturulmayacak**. Yani yalnızca ilk çağrı ayrı;
sonrasında tek doğruluk kaynağı var. Sözleşme bunu §3/§4'te açıkça yazsın, aksi hâlde iki liste
zamanla ayrışır (klasik "iki kaynak" hatası).

### Karar 2 — İki yeni hata metni: ONAY, ama sözlüğe girecek
UX sözlüğünde karşılığı olmayan iki metin kabul edildi. **Koşullar:** (a) sözlüğün üslubuna uyacak
(kısa, suçlayıcı olmayan, eylem öneren — mevcut örnek: *"Liste kaydedilemedi, tekrar deneyin."*),
(b) `write-gate`'in ham hata metni istemciye **asla** sızmayacak (sözleşme bunu zaten söylüyor,
mutasyonla çitlensin), (c) iki metin sözleşme §4'te birebir yazılacak ve CEO bunları
`docs/03-ux.md` metin sözlüğüne ekleyecek.

### Karar 3 — `archiveDenial`'ın async'e çevrilmemesi: ONAY, ama taahhüt F-008'e taşınır
Bugün doğru: `archiveDenial`'ın kendi retry döngüsü yok ve kanban onu çağırmıyor, dolayısıyla olay
döngüsünü bloklamıyor. **Ama F-008 (kapılar paneli) onu bir handler'dan çağıracak** — `.deny.md`
yazma ve arşivleme tam olarak o ekranın işi. O gün aynı tuzak geri gelir.
**Yap:** sözleşme §9'a "F-008'e devredilen taahhüt" olarak yaz: *F-008 `archiveDenial`'ı bir
handler'a bağlamadan önce senkron bekleme içerip içermediğini denetlemeli ve gerekiyorsa asenkrona
çevirmelidir.* CEO bunu F-008 feature notuna da işleyecek.

### Ek zorunluluk — `content_hash` tutarlılığı (sözleşmenin kendi tespiti, CEO onaylıyor)
Sözleşme doğru bir riski yakalamış: kanbanın ürettiği `content_hash` ile write-gate'in
`expectedHash` karşılaştırmasında kullandığı hash **birebir aynı** olmalı (tam dosya sha256),
yoksa **her yazma yanlış pozitif `conflict` döner** ve panel hiçbir şey yazamaz — üstelik hata
"dosya değişti" diyeceği için sebep yanlış yerde aranır. Çapraz-modül tutarlılık testi **zorunlu**,
ve mutasyonla çitlensin (hash kaynağını değiştir → test KIRMIZI).

---

## QA sözleşme incelemesi — tur 1 (qa-evaluator, 2026-09-05)

KARAR: DÜZELTME

Kanıt yolu: bu bölümdeki her ölçüm bu turda çalıştırılarak alındı — `npx tsx` ile gerçek
`setFeatureStatus` hash round-trip'i (5 fixture), `npm i yaml@2.9.0` (scratchpad, depo
kirletilmedi) ile önerilen `safeYamlValue`'nun 40 değerlik round-trip taraması,
`npm view @dnd-kit/core`, ve `unpkg`'den indirilen `@dnd-kit/accessibility@3.1.1` dist kaynağı.
Kod iddiaları dosya okunarak doğrulandı; grep'e güvenilmedi.

### Bulgular

| # | Şiddet | Bölüm/satır | Bulgu | İstenen düzeltme |
|---|---|---|---|---|
| 1 | BLOKLAYICI | §9 "Sorular" (satır 522-533) | CEO kararları turun sonuna eklendi ama §9 hâlâ üç soruyu **açık** sunuyor ("onay istenir", "Varsayılan: şimdi dokunma"). Ayrıca Karar 3'ün açık emri — *"sözleşme §9'a 'F-008'e devredilen taahhüt' olarak yaz"* — hiçbir yerde yok. F-005/F-006'da tur kaybettiren kalıbın aynısı. | §9'daki üç soruyu sil, yerine "Alınan kararlar" + Karar 3'ün emrettiği devir cümlesini (*F-008 `archiveDenial`'ı bir handler'a bağlamadan önce senkron bekleme içerip içermediğini denetlemeli ve gerekiyorsa asenkrona çevirmelidir*) birebir yaz. |
| 2 | BLOKLAYICI | §3 madde 9 (satır 244-259), §2.2 `useEventStream` satırı | Karar 1'in **bağlayıcı koşulu** ("ilk yüklemeden sonra Kanban App'in aldığı **aynı `projects` SSE kanalını** izler; ikinci canlı kaynak oluşturulmayacak") gövdeye hiç yayılmamış. §2.2 yalnızca `onFeatures` ekliyor; `projects` kanalı Kanban için hiç bağlanmıyor → proje listesi ilk yüklemede donar, klasik "iki kaynak" ayrışması. | §3 madde 9 + §2.2 + §4'e yaz: Kanban'ın proje listesi ilk `GET /api/projects` sonrası **App'in mevcut `onProjects` akışından** (tek `useEventStream` çağrısı, prop/context ile) tazelenir; ayrı bir EventSource veya ikinci `GET` döngüsü yok. Bunu `useFeatures.test.ts`'te bir testle çitle. |
| 3 | BLOKLAYICI | §3 madde 2 (satır 148-151), §8 | CEO'nun "Ek zorunluluk"u iki şey istiyor: çapraz-modül testi + mutasyonla çitleme. Planlanan test **çapraz-modül değil**: `write-gate.ts`'in hash'ini test içinde *yeniden yazıp* (`yerel bir crypto.createHash('sha256') çağrısı`) parse-feature ile karşılaştırıyor — write-gate'in gerçek davranışı hiç ölçülmüyor, hash kaynağı değişse test yeşil kalır. §8'de hash kaynağını hedefleyen mutasyon da yok. | Testi davranışsal yap: fixture'ın hash'ini `parse-feature.ts` ile üret, **gerçek `setFeatureStatus(...)`'a `expectedHash` olarak ver, `ok:true` bekle** (conflict gelirse KIRMIZI); §8'e "mutasyon: `parse-feature` hash'i yalnızca frontmatter bloğundan hesaplasın → bu test KIRMIZI" satırını ekle. |
| 4 | BLOKLAYICI | §2.1 `tests/e2e/kanban.spec.ts`, §2.2 tablosu | `playwright.config.ts:14` `testMatch: ['shell.spec.ts','timeline.spec.ts','settings.spec.ts']` **kapalı bir listedir**; sözleşmenin "değiştireceğim dosyalar" tablosunda `playwright.config.ts` yok. Bu hâliyle `kanban.spec.ts` **hiç koşmaz** → AC3/AC5/AC6/AC9 + T1/T2/T3 + echo ölçümü, yani E2E'ye atanan her iddia ölü. | §2.2'ye `playwright.config.ts` satırını ekle (`testMatch`'e `kanban.spec.ts`) ve §8'e "mutasyon: `kanban.spec.ts` testMatch'ten çıkarılsın → koşan test sayısı düşer" yerine daha basiti: kod turunda `npx playwright test --list` çıktısı kanıt olarak rapora yapıştırılsın. |
| 5 | BLOKLAYICI | §4.4 madde 4 (satır 353-363) | Echo ölçümü iki yerden birden ölçmüyor: (a) `data-render-count` yalnızca `import.meta.env.MODE !== 'production'` iken render edilecek, ama `playwright.config.ts:19` E2E'yi `npm run build && npm start` ile **üretim build'inde** koşturur → öznitelik hiç basılmaz, `getAttribute` `null` döner ve naif bir karşılaştırma sessizce yeşil kalır; (b) "`fetchImpl` mock'unun tam 1 kez `GET /api/features` çağırdığı doğrulanır" cümlesi E2E'ye yazılmış, gerçek tarayıcıda `fetchImpl` mock'u yoktur. | Sayaç kapısını `MODE !== 'production'` yerine E2E'de de açık olan bir koşula bağla (ör. `?e2e=1` sorgu parametresi veya kalıcı `data-testid` sayaç) ve §4.4'e "öznitelik yoksa test KIRMIZI (null-guard assert)" satırını koy; E2E'deki fetch sayımını `page.route`/`page.on('request')` ile ifade et. |
| 6 | ÖNEMLİ | §3 madde 7 (satır 217-227) | Sözleşme mimariden **üç sapma** yapıyor ama hiçbirini sapma olarak işaretlemiyor: `docs/02-architecture.md:396` `features` payload'ı `{project_id, cards}` diyor (gerçek: `{project_id}`), satır 546 (§7.2 adım 9) "yeni `FeatureCard` **yanıtta ve SSE'de** yayınlanır" diyor (sözleşme: PATCH hiç broadcast yapmaz), §7.3 `selfWrites` + `origin:'panel'/'external'` echo bastırmasını tarif ediyor (sözleşme: sunucuda sıfır kod, istemcide hash birleştirme). | §3 madde 7'ye "mimari sapmaları" alt başlığı ekle, üçünü tek tek listele + gerekçelendir, ve §9'a CEO ödevi olarak yaz: *ADR ile mimari §6.1/§7.2 adım 9/§7.3 güncellensin*. |
| 7 | ÖNEMLİ | §7 satır 442-446 | Sözleşme "dnd-kit'in kendi otomatik canlı bölgesi (`aria-live="polite"`)" diyor — **yanlış, ölçüldü**: `@dnd-kit/accessibility@3.1.1` `LiveRegion` varsayılanı `ariaLiveType = "assertive"` ve `@dnd-kit/core@6.3.1` `Accessibility` bileşeni `LiveRegion`'a bu prop'u **hiç geçirmiyor** → değiştirilemez `aria-live="assertive"`. UX erişilebilirlik notu (`docs/03-ux.md:443`) ve F-003'ün mevcut bağlantı durumu bölgesi `polite` istiyor; assertive anonslar onları keser. | §7'yi düzelt: kendi `aria-live="polite"` bölgeni kur, dnd-kit `announcements`'ını sustur (veya `accessibility.container` ile yönet) ve `KanbanScreen.test.tsx`'te "sayfada `aria-live="assertive"` bölge yok" assert'i koy. |
| 8 | ÖNEMLİ | §3 madde 4 (satır 172-195) | Gösterge-karakteri kümesi tam (19 karakterin hepsi var, doğrulandı) **ama sözleşmenin kendi kabul ölçütünü** (`yaml.parse` round-trip, `parsed.status === nextStatus`) geçmiyor: gerçek `yaml@2.9.0` ile ölçüldü, 40 değerin **10'u** başarısız — `true`, `False`, `null`, `Null`, `~`, `12`, `1.5`, `0x1F`, `.inf`, `.nan` tırnaklanmıyor ve string yerine boolean/null/number olarak geri geliyor. Mimari §6.3 PATCH'i 7 bilinen değerle **sınırlamadığı** için bu değerler uca gerçekten gelebilir. | `needsQuoting`'e "YAML çekirdek şemasının string dışı bir tipe çözdüğü plain scalar" koşulunu ekle (en basiti: `yaml.parse(value)`'nun sonucu string değilse tırnakla) ve bu 10 değeri golden fixture listesine ekle (9 → 19). |
| 9 | ÖNEMLİ | §8 (satır 458-473) | §8 başlığı "her AC/taahhüt için ≥1" diyor; **değil**: AC3, AC5, AC7, AC10 ve T2 için hiç mutasyon yok. Ayrıca mutasyon 9 yanlış dosyayı hedefliyor — `role="tablist"` §6 madde 1'e ve §2.2'ye göre `src/web/App.tsx`'te kurulacak, `KanbanScreen.tsx`'te değil; yazıldığı gibi uygulanamaz. | Mutasyon 9'un dosyasını `App.tsx` yap; AC3 (SSE sinyalini yut), AC5 (rollback'i kaldır), AC7 (modal alanlarından birini düşür), AC10 (başlık biçimini `label` tek başına yap), T2 (yeni proje için izleyici başlatma sinyalini yok say) için birer mutasyon satırı ekle. |
| 10 | ÖNEMLİ | §3 madde 6 (satır 208-215) | Sensör planında `PointerSensor` için `activationConstraint` yok. dnd-kit'te kısıtsız `PointerSensor` `pointerdown`'da sürüklemeyi başlatır ve tıklamayı yutar → **AC7 (karta tıkla → detay modalı) ile AC9/sürükleme çakışır**; ayrıca `useDraggable` kartı `role="button"` + `tabIndex=0` yapıyor (doğrulandı, `core.esm.js:3385-3439`), `Enter` hem modalı hem klavye sürüklemesini tetikleyebilir. | §3 madde 6'ya `PointerSensor` `activationConstraint: { distance: 8 }` (veya `delay`+`tolerance`) ekle, kart üzerinde "tıklama → modal / sürükleme → taşıma / `Enter` → sürükleme modu" ayrımını tek cümleyle tanımla ve E2E'de ikisini ayrı ayrı çitle. |
| 11 | ÖNEMLİ | §6 madde 1 (satır 405-411) | `tablist` planı üçüncü ekranı hesaba katmıyor: `App.tsx:16` `activeScreen` üç değer alıyor (`timeline`/`settings`/`kanban`) ve Ayarlar desen dışında. `activeScreen==='settings'` iken **hiçbir `tab` `aria-selected="true"` olmaz** ve roving `tabIndex` tanımsız kalır (geçersiz Tabs deseni, klavye tuzağı). Ayrıca `App.tsx:51`'deki mevcut `aria-current="page"` `aria-selected` ile birlikte kalırsa çelişir. | §6 madde 1'e Ayarlar aktifken tablist'in davranışını yaz (son seçili sekme `aria-selected="true"` + `tabIndex=0` kalır, paneli `hidden` olur) ve `aria-current="page"`'in kaldırılacağını belirt; jsdom testine bu üçüncü durumu ekle. |
| 12 | ÖNEMLİ | §5 tablosu | `docs/03-ux.md:288` Kanban satırı beş bağlayıcı durum tanımlıyor (boş durum + "Ayarlar'a git", sütun iskeletleri, **proje bazlı** "⚠ app-factory: dosyalar okunamadı", "Ayrıştırılamayan dosyalar (N)", bağlantı koptuğunda **amber "Canlı senkron durdu — son görülen: …[Yenile]" banner'ı**) ve `docs/03-ux.md:106` "Son senkron: 2 sn önce ✓" alt çubuğunu istiyor. §5 AC→test tablosunda bunların hiçbiri satır olarak yok; §2.1'de yalnızca "banner'lar"/"boş/iskelet durumları" diye geçiyor. | §5'e beş durum + "Son senkron" çubuğu için birer satır ekle (katman: jsdom; bağlantı-koptu banner'ı için `useEventStream` kopma sinyaliyle). |
| 13 | ÖNEMLİ | §5 AC3 satırı ↔ §9 son risk maddesi | Çelişki: §5 AC3 "E2E'de gerçek süre ölçülür" diyor, §9 "bu turda F-005'in ölçtüğü değerlere güveniliyor (**yeniden ölçülmüyor**)" diyor, sonra aynı paragrafın sonunda "E2E'de gerçek süre ölçülüp 2sn sınırına karşı test edilecek" diyor. Kod turunda hangisinin bağlayıcı olduğu belirsiz — AC3 ölçülmeden geçebilir. | §9'daki "yeniden ölçülmüyor" cümlesini sil; AC3 için E2E'de **gerçek duvar saati** ölçümü (harici yazma anı → kartın yeni sütunda görünmesi, `expect(elapsed).toBeLessThan(2000)`) zorunlu olarak yazılsın. |
| 14 | ÖNEMLİ | §4.3 tablosu | UX akışları iki bağlayıcı **aksiyon** içeriyor: akış (b) banner'ında `[Kapat]` (`docs/03-ux.md:239`), akış (c) kırmızı toast'ında `[Tekrar dene]` (`docs/03-ux.md:247`). §4.3 yalnızca metinleri yazıyor, butonlar yok. Ayrıca başarı toast'ındaki literal `✓`, UX Ton kuralını (`docs/03-ux.md:377` "Emoji kullanılmaz; … wireframe'lerdeki emoji benzeri işaretler yalnızca ASCII gösterim kolaylığıdır") ihlal eder. Karar 2'nin (a) koşulu ("eylem öneren") de karşılanmıyor — "sunucuya ulaşılamadı." bir eylem önermiyor. | §4.3'e `[Kapat]` ve `[Tekrar dene]` butonlarını (ve `[Tekrar dene]`'nin aynı PATCH'i **tazelenmiş** `expected_hash` ile yeniden gönderdiğini) ekle; `✓` yerine ikon bileşeni kullan; iki yeni metni "… Tekrar deneyin." kalıbına çevir. |

**NOT (düzeltme istenmiyor, kayıt):** (a) §1 madde 2 "**Beş** devralınan taahhüt" diyor, altı var (§6 doğru). (b) `tests/build-css.test.ts`'in F-005 bloğundaki `otherRoots` iki kök içeriyor; "birebir aynı desen" kopyalanırsa yeni blok `src/features/projects/web`'i atlar — kod turunda üç kök olmalı. (c) `FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.md$/` ASCII-only: Türkçe karakterli bir feature dosyası `GET`'te listelenir ama `PATCH`'te `invalid_body` alır (kart sürüklenebilir görünür, yazamaz). (d) Ölçüldü: geçersiz UTF-8 bayt içeren bir dosyada `setFeatureStatus` gövdeyi U+FFFD'ye çevirerek yazıyor (F-006'dan miras, F-007'nin kapsamı değil).

---

## CEO kararları yayılma kontrolü

| Karar | Gövdeye yayıldı mı | Kanıt / eksik |
|---|---|---|
| **A** — altı devralınan taahhüt birinci sınıf iş | KISMEN | §6'da altısı da ayrı bölüm ✓, §5'te T1-T6 satırları ✓; ama §1 "Beş" diyor ve §8'de T2'nin mutasyonu yok (bulgu 9). |
| **B** — tüm yazmalar write-gate'ten, `fs` yasak | EVET | §4.2 adım 4 `setFeatureStatus` ✓; `list-features.ts` yalnızca `readdirSync`/`readFileSync`/`existsSync` kullanıyor — `tests/no-write-gate-bypass.test.ts` `DENIED_BARE`/`DENIED_SCOPED`/`DANGEROUS_NAMES` listelerinin hiçbiri okuma API'sini içermiyor (dosya okundu, doğrulandı), guard değişikliği gerçekten gerekmiyor. |
| **C** — çakışmada sessiz üzerine yazma yok | EVET | §4.2 409 satırı + §4.4 "Çakışma" paragrafı: `expected_hash` sürükleme **bırakıldığında** okunur, ardışık ikinci sürükleme bayat hash'le giderse sunucu yine `conflict` verir; 409 gövdesi diskten yeniden okunmuş `FeatureCard` taşır ve kart **kullanıcının bıraktığı sütuna değil** ona göre çizilir. Yeni bir `GET` yarışı yok. Sessiz üzerine yazma yolu bulunamadı. |
| **D** — echo ölçülebilir olacak | HAYIR | Ölçüm tasarlanmış ama iki mekanizması da E2E'de çalışmıyor (bulgu 5). jsdom tarafı (`useFeatures.test.ts` render/fetch sayacı) sağlam. |
| **E** — klavye alternatifi E2E'de gerçek klavye olaylarıyla | KISMEN | §5 AC9 satırı doğru katmanı seçiyor (`page.keyboard.press`, gerçek dosya doğrulaması) ✓ — ama `kanban.spec.ts` hiç koşmayacak (bulgu 4), ayrıca `Enter` çakışması çözülmemiş (bulgu 10). |
| **F** — kapsam dışı: Faz 2 | EVET | §1 "Kapsam DIŞI" listesi F-008/F-009/F-010/F-011 ekranlarını ve uçlarını açıkça dışlıyor; yeni depo/uç icadı ve olay filtreleme değişikliği de dışlanmış. Kapsam sızması bulunamadı. |
| **Karar 1** — kendi `GET /api/projects` + **aynı** SSE kanalı | HAYIR | Yalnızca "(a) seçildi" kısmı var; "tek canlı kaynak" koşulu hiçbir bölümde yok (bulgu 2). |
| **Karar 2** — iki yeni hata metni onaylı, koşullu | KISMEN | (b) ham hata sızmaz ✓ (§4.2 500 satırı + §8 mutasyon 4). (c) metinler §4.3'te birebir ✓. (a) üslup koşulu karşılanmıyor ve §9 hâlâ "onay istenir" diyor (bulgu 1, 14); CEO'nun sözlüğe ekleme ödevi sözleşmede kayıtlı değil. |
| **Karar 3** — `archiveDenial` sync kalır, taahhüt F-008'e | KISMEN | Asimetri §3 madde 5'te doğru gerekçelendirilmiş ve **kodla doğrulandı** (`write-gate.ts:333-338` doğrudan `fs.renameSync`, `atomicWrite`/`sleepSyncMs` çağırmıyor → retry/bloklama yok) ✓; ama §9'a yazılması emredilen "F-008'e devredilen taahhüt" kaydı yok (bulgu 1). |
| **Ek** — `content_hash` = write-gate `expectedHash` + çapraz-modül testi | KISMEN | Tasarım doğru (aşağıdaki denetim) ✓; test totolojik ve mutasyon yok (bulgu 3). |

---

## content_hash tutarlılık denetimi (madde 2 — ölçülmüş sonuç)

**Kodda ölçülen gerçek (`src/server/write-gate.ts`, tam dosya okundu):**

- `write-gate.ts:184-186` — `sha256(data) = crypto.createHash('sha256').update(data).digest('hex')`.
- `write-gate.ts:223` — `original = fs.readFileSync(resolved.targetPath)` → **Buffer**, tam dosya.
- `write-gate.ts:228` — `sha256(original) !== expectedHash` → `conflict`. Yani karşılaştırma **ham dosya baytlarının** sha256'sı, **hex**, küçük harf.
- Satır sonu normalizasyonu **yok** (`parts` ayraçları koruyor, `join('')` kayıpsız). BOM **soyulmuyor** (`:237-238` yalnızca karşılaştırma için kopyada soyuyor, `parts[0]` değişmiyor).
- Dönen `hash` `sha256(newText)` — string, utf8 varsayılanı; `atomicWriteOnce` aynı string'i `fs.writeSync` ile utf8 yazdığı için diskteki baytlarla aynı.

**Çalıştırılarak doğrulandı** (`npx tsx`, gerçek `setFeatureStatus`, 5 fixture, geçici dizin):

| Fixture | `sha256(readFileSync)` kabul edildi mi | dönen `hash` === `sha256(yeni disk baytları)` | dönen hash'le ikinci yazma |
|---|---|---|---|
| LF + ASCII | evet (`ok:true`) | evet | `ok:true` |
| CRLF | evet | evet | `ok:true` |
| BOM + CRLF | evet | evet | `ok:true` |
| Türkçe karakterli gövde | evet | evet | `ok:true` |
| Geçersiz UTF-8 bayt | evet | evet | `ok:true` |

**Sonuç:** sözleşmenin §3 madde 2'deki planı (`sha256(originalBuffer)`, tam dosya, frontmatter değil)
write-gate'in gerçek davranışıyla **uyuşuyor** — yanlış pozitif `conflict` riski tasarım
seviyesinde yok. Eksik olan tek şey plandaki **hex** kodlamasının açıkça yazılması ve bulgu 3'teki
davranışsal test/mutasyon. (Kayıt: geçersiz UTF-8 bayt içeren dosyada yazma hash tutarlı ama içerik
U+FFFD'ye dönüşüyor — miras davranış, F-007'nin kapsamı değil.)

---

## Devralınan altı taahhüdün kapsama tablosu

| # | Taahhüt | §6 ayrı bölüm | §5 AC→test satırı | §8 mutasyon | Değerlendirme |
|---|---|---|---|---|---|
| 1 | Tam `tablist` deseni | ✓ (madde 1) | ✓ (T1, jsdom + E2E) | ✓ ama **yanlış dosya** (mutasyon 9 `KanbanScreen.tsx`, olması gereken `App.tsx`) | Üçüncü ekran (Ayarlar aktif) durumu tanımsız — bulgu 11. |
| 2 | F-005 AC1'in görsel kanıtı | ✓ (madde 2) | ✓ (T2, E2E) | **YOK** | Bulgu 9. Ayrıca E2E hiç koşmuyor — bulgu 4. |
| 3 | Dar genişlikte gezinme (375px) | ✓ (madde 3) | ✓ (T3, E2E) | ✓ (mutasyon 12) | Plan sağlam; yalnızca bulgu 4'e bağlı. |
| 4 | `Atomics.wait` → async | ✓ (madde 4) ama **§3'te tasarım bölümü yok**; §6 madde 4 hatalı olarak §3 madde 4'e (safeYamlValue) atıf yapıyor. Tasarımın tamamı §2.2'nin bir tablo hücresinde. | ✓ (T4, birim + mikro-görev ölçümü) | ✓ (mutasyon 7) | Ölçek **gerçekçi ve doğrulandı**: çağrı siteleri sayıldı — `write-gate.test.ts` 34+8+1=43, `write-gate-manifest.test.ts` 3+1+1=5; `archiveDenial`'ın 6+1 çağrısı dokunulmuyor. `src/` içinde **hiç çağıran yok** (grep: 0), yani imza değişikliği yalnızca testleri etkiler. `archiveDenial`'ın dışarıda kalması Karar 3 ile tutarlı ✓. Eksik: §3'e kısa bir tasarım maddesi + §6 madde 4'ün atıf düzeltmesi. |
| 5 | `safeYamlValue` sertleştirme | ✓ (madde 5 → §3 madde 4) | ✓ (T5, 9 golden fixture) | ✓ (mutasyon 8) | Gösterge kümesi **tam** (19/19) ama tip-zorlayan skalarlar açık: 10/40 round-trip başarısız (bulgu 8). Round-trip doğrulaması "her yeni golden fixture için" deniyor ✓ — mevcut 17 fixture için değil, bu kabul edilebilir. |
| 6 | `OPERATION_PATTERNS` koşulu | ✓ (madde 6 → §3 madde 12) | ✓ (T6, "yok — kayıt") | Gerekmiyor | Koşul gerçekten tetiklenmiyor: sözleşme `OPERATION_PATTERNS`'a dokunmuyor, kanban yalnızca mevcut `featureStatus` desenini kullanıyor. Doğru karar. |

---

## Developer düzeltme yanıtı — tur 2 (2026-09-05)

Bu turda **yalnızca bu dosya** değiştirildi (`git status` ile doğrulanacak); `src/`, `tests/`,
`scripts/`, `.claude/`, `.github/`, `package.json`, diğer `docs/**` dosyaları dokunulmadı. Aşağıda
QA'nın 5 BLOKLAYICI + 9 ÖNEMLİ bulgusunun her biri numarasıyla ele alınıyor.

| # | Şiddet | Ne değiştirildi | Bölüm/satır |
|---|---|---|---|
| 1 | BLOKLAYICI | §9 tamamen yeniden yazıldı: "Sorular" kaldırıldı, yerine "Alınan kararlar" (Karar 1/2/3 + Ek, her biri kapandı/CEO ödevi olarak işaretli) geldi. Karar 3'ün emrettiği F-008 devir cümlesi birebir eklendi. | §9 "Alınan kararlar" madde 3 |
| 2 | BLOKLAYICI | Karar 1'in bağlayıcı koşulu gövdeye yayıldı: §3 madde 9 tamamen yeniden yazıldı (mevcut `useProjects(liveProjectsUpdate)` hook'unun `SettingsScreen` ile birebir aynı desende yeniden kullanılması, `App.tsx`'in tek `useEventStream()` bağlantısının `projectsUpdate` state'inin prop olarak geçirilmesi, ikinci canlı kaynak açılmaması + kaynak-tarama çiti); §2.2 `App.tsx` satırına `liveProjectsUpdate`/`stream` prop geçişi eklendi. | §3 madde 9, §2.2 `App.tsx` satırı |
| 3 | BLOKLAYICI | §3 madde 2'deki çapraz-modül testi totolojiden çıkarıldı: artık hash'i test içinde yeniden hesaplamıyor, `parse-feature.ts`'in ürettiği hash'i doğrudan gerçek `setFeatureStatus`'a `expected_hash` olarak verip `ok:true` bekliyor. §8'e mutasyon 13 eklendi (`content_hash` yalnızca frontmatter bloğundan hesaplansa test KIRMIZI verir). | §3 madde 2, §8 mutasyon 13 |
| 4 | BLOKLAYICI | `playwright.config.ts` dosya sahipliğine alındı (§2.2'ye yeni satır, `testMatch`'e `kanban.spec.ts` eklenecek). `testMatch` sınıfını kalıcı olarak kapatan bir guard testi eklendi: `tests/e2e-config-guard.test.ts` (§2.1) — `tests/e2e/*.spec.ts` dosyalarının hepsinin `playwright.config.ts` metninde geçtiğini doğrular, sahte bir `zzz.spec.ts` eklenirse KIRMIZI verir. | §2.1 yeni dosya, §2.2 `playwright.config.ts` satırı |
| 5 | BLOKLAYICI | §4.4 madde 4 tamamen yeniden yazıldı: `data-render-count` artık `MODE` kapısı olmadan her zaman render ediliyor (+ null-guard assert), `GET /api/features` sayımı `fetchImpl` mock'u yerine Playwright'ın gerçek `page.on('request')` ağ yakalamasıyla yapılıyor (üretim derlemesinde de çalışır). | §4.4 madde 4 |
| 6 | ÖNEMLİ (D45) | §3 madde 7'ye "Mimari sapmaları" alt bölümü eklendi: üç sapma (§6.1 payload, §7.2 adım 9 SSE yayını, §7.3 `selfWrites`) tek tek gerekçelendirildi, CEO'ya ADR ödevi §9'a yazıldı. | §3 madde 7, §9 madde 5 |
| 7 | ÖNEMLİ (D44) | §7 yeniden yazıldı: gerçek `@dnd-kit/accessibility@3.1.1`/`@dnd-kit/core@6.3.1` dist kaynağı bu turda tekrar okunarak (`LiveRegion` `ariaLiveType` varsayılanı `"assertive"`, `Accessibility` bunu hiç geçirmiyor) doğrulandı; çözüm dnd-kit'in `announcements`'ını boş string'lerle susturup kendi `aria-live="polite"` bölgemizi kurmak olarak belirlendi, çit + mutasyon eklendi. | §7 |
| 8 | ÖNEMLİ (D43) | §3 madde 4 yeniden yazıldı: gösterge-karakteri kuralı korunarak `yaml.parse(value)` sonucu string değilse tırnaklayan genel bir kural eklendi (`resolvesToNonString`). Bu turda gerçek `yaml@2.9.0` ile 19+21=40 fixture çalıştırıldı, **40/40** round-trip geçti (eski kodda 22 hata). §8'e mutasyon 8b eklendi. | §3 madde 4, §8 mutasyon 8b |
| 9 | ÖNEMLİ | §8 mutasyon 9'un hedef dosyası `KanbanScreen.tsx`'ten `App.tsx`'e düzeltildi; AC3 (mutasyon 14), AC5 (15), AC7 (16), AC10 (17), T2 (18) için yeni mutasyon satırları eklendi. | §8 mutasyon 9, 14-18 |
| 10 | ÖNEMLİ | §3 madde 6'ya `PointerSensor activationConstraint:{distance:8}` + tıklama/sürükleme/`Enter` ayrımı eklendi; §7'de `KeyboardSensor.keyboardCodes.start` `Enter` çıkarılıp yalnızca `Boşluk`'a daraltıldı (AC7/AC9 çakışması yapısal olarak çözüldü). | §3 madde 6, §7 |
| 11 | ÖNEMLİ | §6 madde 1'e Ayarlar aktifken tablist davranışı eklendi: son seçili sekme `aria-selected`/`tabIndex=0` korur, `aria-current="page"` kaldırılıp `aria-selected`'a geçildi (§2.2 `App.tsx` satırında da not edildi). | §6 madde 1, §2.2 |
| 12 | ÖNEMLİ | §5 tablosuna beş durum + "Son senkron" çubuğu için D1-D6 satırları eklendi; `useFeatures.ts`/`KanbanScreen.tsx` dosya açıklamalarına `lastSyncedAt` ve beş durum banner'ı notu eklendi (§2.1). | §5 D1-D6, §2.1 |
| 13 | ÖNEMLİ | §9'daki "yeniden ölçülmüyor" cümlesi silindi; AC3 için E2E'de gerçek duvar saati ölçümünün ZORUNLU olduğu tek, çelişkisiz bir cümleyle yazıldı. | §9 "Echo zamanlaması" risk maddesi |
| 14 | ÖNEMLİ | §4.3 tablosuna `[Kapat]`/`[Tekrar dene]` aksiyon sütunu eklendi, iki yeni metin "… Tekrar deneyin." kalıbına çevrildi (Karar 2(a)), başarı toast'ındaki literal `✓` ikon bileşenine çevrildi (UX Ton kuralı), CEO'nun sözlüğe ekleme ödevi §4.3 sonuna yazıldı. | §4.3 |

**Ayrıca (kapsam genişletmeden, blokerlerin doğal sonucu):** §3'e madde 13 (`Atomics.wait`→async
tasarım detayı) eklendi ve §6 madde 4'ün yanlış atfı düzeltildi (taahhüt kapsama tablosu satır 4'ün
işaret ettiği eksiklik — BLOKLAYICI/ÖNEMLİ numarasız ama aynı düzeltme turunda kapatılabilir
denmişti). NOT (a)/(b)/(c)/(d) maddelerine QA "düzeltme istenmiyor" dediği için dokunulmadı.

**Kalan riskler / kod turuna devredilenler:** dnd-kit'in `announcements`'ı boş string'le susturmanın
tüm ekran okuyucularda "sessiz" sayılacağı %100 garanti değil (kütüphane API sınırlaması, §7'de
belgelendi) — kod turunda gerçek bir ekran okuyucuyla (veya en azından DOM `textContent` ölçümüyle)
doğrulanmalı. `resolvesToNonString`'in `try/catch` güvenli-varsayılanı (`false`) teorik olarak
gösterge-kuralının kapsamadığı çok uç bir YAML sözdizimi hatasını atlayabilir — 40 fixture'lık
ölçümde böyle bir durum gözlenmedi ama kod turunda golden fixture seti genişletilebilir. Ayarlar
aktifken tablist durumunun (`lastTabScreen`) App.tsx'e eklenmesi küçük ama yeni bir state parçası —
kod turunda gerçek jsdom testiyle üç durumun (timeline/kanban/settings) hepsi doğrulanmalı.

---

## Ölçmeyen test riski

Kod turunda **yeşil kalabilecek** iddialar, en ağırdan hafife:

1. **Tüm E2E katmanı hiç koşmaz** (bulgu 4). `playwright.config.ts` kapalı `testMatch` listesi. AC3, AC5 (gerçek fs hatası), AC6 (gerçek sürükleme), AC9 (gerçek klavye), T1 (gerçek focus), T2, T3 ve echo ölçümü bu dosyaya bağlı. "41 test geçiyor" tipi bir raporla gizlenmeye çok müsait — kod turunda `npx playwright test --list` çıktısı zorunlu kanıt olmalı.
2. **`data-render-count` üretim build'inde yok** (bulgu 5). Öznitelik hiç basılmayınca `null === null` tuzağı; testin "öznitelik var" ön koşulu yoksa echo iddiası sıfır bilgi taşır.
3. **`content_hash` çapraz-modül testi totolojik** (bulgu 3). Hash'i test içinde yeniden yazmak, write-gate değişse bile yeşil kalır. Bu, CEO'nun "her yazma yanlış pozitif conflict döner" riskine karşı kurduğu tek çitin işlevsiz olması demektir.
4. **`safeYamlValue` round-trip'i yalnızca gösterge karakterleriyle** (bulgu 8). `status: true` yazılıp `parsed.status === 'true'` beklenmezse test kümesi kendi kabul ölçütünü kanıtlamaz.
5. **AC2'nin "yalnızca `status` satırı değişir" iddiası F-006'dan devralınıyor** (§5 AC2). Bu doğru bir karar (yeniden kanıtlanmasına gerek yok), **ama** F-007 `safeYamlValue`'yu değiştiriyor — mevcut diff testinin yeni tırnaklama kuralıyla hâlâ KIRMIZI verebildiği (mutasyon 8 ile) gösterilmeli; aksi hâlde miras test yeni davranışı ölçmez.
6. **Sürükleme mekaniği jsdom'da test edilmiyor** (§2.1, doğru karar) — ancak `onDragEnd`'in "saf mantığı doğrudan çağrılarak" test edilmesi, gerçek `@dnd-kit` sensör/`activationConstraint` davranışını hiç ölçmez (bulgu 10). AC7 ile AC9'un çakışması yalnızca E2E'de görünür.
7. **`tests/build-css.test.ts` yeni bloğunun ön koşulu** üç kök yerine iki kök taranırsa, `projects/web`'te de geçen bir sınıf tesadüfen yeşil kalır (F-003'ün `bg-zinc-950` hatasının aynısı) — NOT (b).

**Kod turuna başlamak için eksik olan tek şey:** yukarıdaki 5 BLOKLAYICI'nın sözleşme metnine
işlenmesi (özellikle Karar 1'in tek-canlı-kaynak koşulu ve E2E'nin gerçekten koşacağı/ölçeceği
kurulum). Geri kalan 9 ÖNEMLİ aynı düzeltme turunda kapatılabilir; ikinci QA turu yalnızca bu
14 bulguya bakacak, onaylanmış bölümler yeniden açılmayacak.

---

## QA doğrulama — tur 2 (qa-evaluator, 2026-09-05)

KARAR: DÜZELTME
ESKALE: false

**Kapsam (dar tur):** yalnızca tur 1'in 5 BLOKLAYICI + 9 ÖNEMLİ bulgusunun kapanışı, CEO
kararları D40-D45'in uygulanması ve **düzeltmenin ürettiği regresyon**. `content_hash` tasarımı,
bağımlılık listesi, altı taahhüdün varlığı ve kapsam denetimi **yeniden açılmadı**.

**Kanıt yolu:** bu turda çalıştırılan ölçümler — (a) `tests/e2e/` + `playwright*.config.ts`
üzerinde guard mantığının gerçek repoda koşturulması (geçici `zzz-qa-probe.spec.ts` oluşturuldu,
ölçüldü, **silindi**); (b) scratchpad'de gerçek `yaml@2.9.0` ile 75 değerlik (sözleşmenin 40'ı
dahil) round-trip taraması; (c) `unpkg`'den indirilen `@dnd-kit/core@6.3.1` +
`@dnd-kit/accessibility@3.1.1` dist kaynağının yeniden okunması; (d) `src/web/App.tsx`,
`src/features/projects/web/useProjects.ts`, `src/server/write-gate.ts:184-275` dosyalarının
okunması. Depoya `npm install` yapılmadı; `git status` temiz bırakıldı.

### Tur 1 bulgularının kapanış tablosu

| # | Şiddet | Durum | Kanıt |
|---|---|---|---|
| 1 | BLOKLAYICI | **KAPANDI** | §9 artık "Alınan kararlar" (satır 699-724); "AÇIK SORU"/"onay istenir" kalıntısı §9'da yok. Karar 3'ün F-008 devir cümlesi **birebir** var (normalize edilmiş metin karşılaştırması: dosyada 2 kez — CEO bölümü + §9 madde 3). |
| 2 | BLOKLAYICI | **KAPANDI** | Karar 1'in koşulu gövdeye yayıldı: §3 madde 9 (satır 386-404) + §2.2 `App.tsx` satırı + §9 madde 1. Kaynak-tarama çiti (`new EventSource(`/`useEventStream(` kanban/web'de geçmez) + mutasyon tarif edildi. Hook yeniden kullanımı değerlendirmesi aşağıda. |
| 3 | BLOKLAYICI | **KAPANDI** | §3 madde 2 (satır 150-165) testi davranışsal: `parse-feature` hash'i **gerçek `setFeatureStatus`'a** `expected_hash` olarak verilip `ok:true` bekleniyor; §8 mutasyon 13 (`content_hash` yalnızca frontmatter bloğundan) deterministik KIRMIZI verir. |
| 4 | BLOKLAYICI | **KISMİ → açık (YENİ-R2)** | `playwright.config.ts` §2.2'ye alındı ✓, guard testi tasarlandı ✓, ama guard **doğuştan KIRMIZI**: ölçüldü, aşağıya bak. |
| 5 | BLOKLAYICI | **KISMİ → açık (YENİ-R3)** | `MODE` kapısı kaldırıldı ✓, null-guard assert'i ✓, `page.on('request')` ağ sayımı ✓ (ikisi de üretim derlemesinde çalışır). Ama ölçümün eşiği mutasyona kaçış bırakıyor + "tek mutasyon iki çiti de kırmızı yapar" iddiası yanlış; aşağıya bak. |
| 6 (D45) | ÖNEMLİ | **KAPANDI** | §3 madde 7 "Mimari sapmaları" (satır 302-321): üç sapma tek tek + gerekçe; CEO ADR ödevi §9 madde 5. Gerekçe (dosya sahipliği) `docs/features/F-007-kanban.md:25-26` ("`src/features/kanban/**` … ilgili testler") ile **doğrulandı** — `projects/server/service.ts`'e dokunmak gerçekten ihlal olurdu. |
| 7 (D44) | ÖNEMLİ | **KAPANDI** (NOT-2 ile) | dist yeniden okundu, sözleşmenin iddiası doğru. `announcements` boş dize çözümü çalışır; ayrıntı ve kalan İngilizce SR yüzeyi için NOT-2. |
| 8 (D43) | ÖNEMLİ | **KISMİ → açık (R4)** | Kural doğru ve **ölçüldü: 40/40** (hatta 75/75); kabul ölçütü §3 madde 4'te "40/40" yazılı ✓. Ama §2.2 (satır 105, "golden fixture'lar (18-26)" = 9) ve §5 T5 (satır 559, "9 yeni golden fixture") hâlâ **eski 9 fixture** planını taşıyor. |
| 9 | ÖNEMLİ | **KAPANDI** | Mutasyon 9 dosyası `App.tsx` ✓ (satır 692); mutasyon 14 (AC3), 15 (AC5), 16 (AC7), 17 (AC10), 18 (T2) eklendi ✓. Mutasyon 18'in hedefi belirsiz — NOT-4. |
| 10 | ÖNEMLİ | **KISMİ → açık (YENİ-R1)** | `activationConstraint:{distance:8}` eklendi ✓ (pointer tarafı gerçekten çözüldü), ama klavye tarafının düzeltmesi üç yerde çelişki üretti; aşağıya bak. |
| 11 | ÖNEMLİ | **KAPANDI** | §6 madde 1 (satır 578-593): `lastTabScreen` ile Ayarlar aktifken tam olarak bir `tab` `aria-selected="true"` kalır; `aria-current="page"` kaldırılıyor (mevcut `App.tsx:51`'de gerçekten var, doğrulandı). |
| 12 | ÖNEMLİ | **KAPANDI** | §5'e D1-D6 satırları eklendi (satır 561-566); beşi de `docs/03-ux.md:288` satırıyla ve `:106` "Son senkron" çubuğuyla eşleşiyor. |
| 13 | ÖNEMLİ | **KAPANDI** | §9 "Echo zamanlaması" maddesi (satır 740-747) tek ve bağlayıcı: harici yazma anı → kart görünürlüğü arası `expect(elapsed).toBeLessThan(2000)`, "F-005'in ölçtüğüne güvenilerek atlanamaz". §5 AC3 ile çelişki yok. |
| 14 | ÖNEMLİ | **KAPANDI** (NOT-1 ile) | §4.3 (satır 458-477): `[Kapat]`/`[Tekrar dene]` aksiyon sütunu, iki metin "… Tekrar deneyin." kalıbında, `✓` yerine `<CheckIcon/>`, CEO sözlük ödevi. Kalıntı bir kopya metin için NOT-1. |

### D40-D45 uyum kontrolü

| Karar | Uyum | Not |
|---|---|---|
| **D40** (`testMatch` guard testi) | **HAYIR — sınıfı kapatıyor ama çit doğuştan kırmızı** | YENİ-R2. |
| **D41/Ek** (`content_hash` davranışsal test + mutasyon) | EVET | Bulgu 3. |
| **D42** (echo üretimde ölçülebilir) | KISMİ | Mekanizma üretimde çalışır; eşik mutasyon kaçırıyor → YENİ-R3. |
| **D43** (`safeYamlValue` 40/40) | KISMİ | Kural doğru, ölçüm 40/40 doğrulandı; iki bölüm hâlâ 9 fixture diyor → R4. |
| **D44** (`polite` bölge) | EVET | Ölçüldü; NOT-2. |
| **D45** (mimari sapmaları + ADR ödevi) | EVET | Gerekçe dosya sahipliğiyle doğrulandı. |
| **Karar 1** (tek canlı kaynak) | EVET — hook yeniden kullanımı **daha iyi** karşılıyor | Aşağıda. |

### Karar 1 — `useProjects` yeniden kullanımı çelişki mi, iyileştirme mi?

**İyileştirme; Karar 1'in lafzıyla da çelişmiyor.** Karar 1 "(a) kendi `GET /api/projects`'ini
yapar" diyordu; `useProjects(liveProjectsUpdate)` hook'u zaten **mount'ta kendi
`GET /api/projects`'ini yapıyor** (`src/features/projects/web/useProjects.ts:44-56`,
`load()` + `useEffect(() => void load(), [load])`) — yani (a) harfiyen korunuyor, yalnızca kod
kopyalanmıyor. CEO'nun asıl koşulu (ikinci canlı kaynak yok) **daha güçlü** karşılanıyor: hook'un
canlı yolu tek bir satır (`useProjects.ts:58-62`, `if (liveUpdate !== null) setItems(liveUpdate)`)
ve o `liveUpdate` App'in tek `useEventStream()` çağrısından gelen `projectsUpdate` state'idir
(`App.tsx:16,22-24`). İki tüketici aynı referansı okuduğu için ayrışma yapısal olarak imkânsız.

**F-005'in yükleme yolu değişmiyor** (kontrol edildi): `SettingsScreen` çağrısı `App.tsx:78`'de
aynen duruyor (`<SettingsScreen liveUpdate={projectsUpdate} />`), `useProjects.ts` §2.2'nin
"değiştireceğim dosyalar" tablosunda **yok**, `SettingsScreen.tsx` de yok. Eklenen tek şey ikinci
bir tüketici. Bedeli: açılışta iki `GET /api/projects` (Kanban paneli `hidden` ama monte) —
sözleşme bunu §3 madde 9'da açıkça kabul ediyor, tek kullanıcılı yerel araçta kabul edilebilir.

### YENİ (regresyon)

**YENİ-R1 (ÖNEMLİ, regresyon — bulgu 10'un düzeltmesi) — klavye onay tuşu üç yerde çelişiyor;
bağlayıcı UX dokümanından işaretlenmemiş sapma.**
- §7 satır 619-620: `keyboardCodes: {start:['Space'], end:['Space'], cancel:['Escape']}`.
- §7 satır 624: "→ `Enter` onaylar (aynı iyimser yazma akışı …)". **`end` listesinde `Enter` yok**
  → `Enter` sürüklemeyi bitirmez. Üstelik §3 madde 6 satır 278'e göre kartın `onKeyDown`'ı
  `Enter`'ı **modal açmaya** bağlıyor: klavye sürüklemesi sırasında `Enter` **detay modalını
  açar**, kart bırakılmaz.
- §5 AC9 satır 553: E2E adımları hâlâ `page.keyboard.press('Tab'/'Enter'/'ArrowRight'/'Enter')`.
  Yeni tasarımda ilk `Enter` sürüklemeyi **başlatmaz** (start yalnız `Space`) — yazıldığı gibi
  koşarsa AC9 testi hiçbir sürükleme yapmadan modal açar.
- Ölçülen kütüphane davranışı (`@dnd-kit/core@6.3.1` `dist/core.esm.js:1098-1102`):
  `defaultKeyboardCodes = {start:[Space,Enter], cancel:[Esc], end:[Space,Enter,Tab]}`. Sözleşme
  `end`'den `Tab`'ı da sessizce düşürüyor (sürükleme sırasında `Tab` artık bırakmaz — odak
  tuzağı riski, en azından yazılmalı).
- `docs/03-ux.md:443` (G3 onaylı, **bağlayıcı**): "`Enter`/`Boşluk` ile 'seçili' moda al …
  `Enter` ile onayla". Yeni tasarım bundan sapıyor ama §3 madde 7'nin "sapmalar" listesine
  **girmiyor**; oysa §7 aynı satırın metinlerini "birebir" izlediğini iddia ediyor.
- **İstenen:** tek bir tuş sözleşmesi yaz ve üç yeri (§3 madde 6, §7, §5 AC9) aynı hâle getir;
  UX §443'ten sapıyorsa D45 desenine uygun olarak "sapma + gerekçe" başlığına ekle ve CEO'ya
  ödev yaz. `end` listesinden `Tab`'ın çıkarılmasının sonucunu tek cümleyle belirt.

**YENİ-R2 (ÖNEMLİ, regresyon — bulgu 4'ün düzeltmesi) — `tests/e2e-config-guard.test.ts`
doğuştan KIRMIZI.** §2.1'deki tasarım "`tests/e2e/*.spec.ts` dosyalarının **hepsinin**
`playwright.config.ts` metninde geçtiğini doğrular" diyor. Repoda `tests/e2e/dev-shell.spec.ts`
var ve bilinçli olarak **ikinci** bir config'e (`playwright.dev.config.ts:5`,
`testMatch: 'dev-shell.spec.ts'`, `npm run e2e:dev`) bağlı. Ölçüm (aşağıda): guard bugün
`["dev-shell.spec.ts"]` ile KIRMIZI. Kod turunda bu, ya çitin gevşetilmesine ya da yanlış bir
"config'e ekle" düzeltmesine (dev-shell'i üretim E2E koşusuna sokmak) yol açar.
**İstenen:** guard **iki config'i birden** okusun (`playwright.config.ts` + `playwright.dev.config.ts`),
her spec **en az birinde** geçsin; §2.1 metnini buna göre düzelt (§2.2'ye `playwright.dev.config.ts`
eklemek **gerekmiyor** — yalnızca okunuyor).

**YENİ-R3 (ÖNEMLİ, regresyon — bulgu 5'in düzeltmesi) — D42 ölçümü kendi mutasyonunu
kaçırabilir.** §4.4 madde 4 adım (d): "o kartın `data-render-count`'ının **PATCH yanıtı sonrası**
en fazla 1 kez arttığını doğrula". Taban okuma anı tanımsız. En doğal okuma (taban = PATCH yanıtı
uygulandıktan sonra) altında: doğru kodda artış **0**, §8 mutasyon 5 (hash birleştirme kaldırılır)
altında echo refetch'i tek bir yeni referans üretir → artış **1** → `≤1` eşiği **YEŞİL** kalır.
Mutasyon yakalanmaz. Ayrıca aynı maddenin son cümlesi ("tek bir mutasyon her ikisini de yakalamalı")
**yanlıştır**: mutasyon 5 fetch sayısını değiştirmez, `getCount` yine **tam 1** olur → o assert
tanım gereği yeşil kalır. (Doğru eşleme: mutasyon 5 → render sayacı; mutasyon 14 (SSE sinyali yok
sayılır) → `getCount` 0 → KIRMIZI.)
**İstenen:** (a) taban okuma anını sabitle ve eşiği **kesin eşitlik** yap (ör. "PATCH yanıtı DOM'a
yansıdıktan sonra okunan taban, 3 sn sonunda **aynı** olmalı — `expect(after).toBe(before)`");
(b) "tek mutasyon iki çiti de kırar" cümlesini kaldırıp mutasyon→çit eşlemesini yukarıdaki gibi yaz.

**R4 (ÖNEMLİ — D43 yayılımı eksik).** Kabul ölçütü §3 madde 4'te "40/40" (bağlayıcı) ama
§2.2 `tests/server/write-gate.test.ts` satırı (satır 105) hâlâ "Yeni golden fixture'lar (**18-26**,
indikatör karakterli değerler)" = 9 fixture, §5 T5 satırı (satır 559) hâlâ "**9 yeni** golden
fixture" diyor. §8 mutasyon 8/8b (19 + 21) doğru. İki satır 40'a çekilmeli — aksi hâlde kod turu
9 fixture ile "T5 kapandı" diyebilir ve D43'ün asıl sınıfı (tip-zorlayan skalerler) ölçülmemiş olur.

### Ölçümlerim

**1) Guard probe (D40) — gerçek repoda, geçici dosyayla.**
Guard'ın §2.1'de tarif edilen mantığı elle koşturuldu (`fs.readdirSync('tests/e2e')` +
`playwright.config.ts` metin içerme):

| Koşu | Sözleşmedeki guard (yalnız `playwright.config.ts`) | İki config okuyan varyant |
|---|---|---|
| Bugünkü repo | eksik: `["dev-shell.spec.ts"]` → **KIRMIZI** (doğuştan) | eksik: `[]` → YEŞİL |
| `tests/e2e/zzz-qa-probe.spec.ts` eklendi | eksik: `["dev-shell.spec.ts","zzz-qa-probe.spec.ts"]` → KIRMIZI | eksik: `["zzz-qa-probe.spec.ts"]` → **KIRMIZI** |

Probe dosyası ölçümden hemen sonra silindi; `git status` yalnızca bu sözleşme dosyasını (ve QA
agent hafızasını) gösteriyor, `tests/` temiz.
**Metin karşılaştırmasının sağlamlığı (ölçüldü, bellekte, config'e dokunmadan):**
(a) dosya adı config'de bir **yorum satırında** geçerse guard **YEŞİL** kalır → yanlış negatif
(çitin kabul edilen sınırı; §2.1'e bir cümleyle yazılmalı). (b) `testMatch` bir glob'a
(`'**/*.spec.ts'`) çevrilirse guard eksik olarak `["dev-shell","settings","zzz-probe"]` sayar →
**yanlış pozitif**, ama yön güvenli (kırmızı) ve düzeltmesi tek satır. İkisi de NOT seviyesi;
kapatılması gereken sınıf (yeni spec dosyası sessizce koşmaz) probe ile **kapatıldığı doğrulandı**.

**2) `safeYamlValue` — gerçek `yaml@2.9.0`, scratchpad (depo kirletilmedi).**
Sözleşmedeki yeni `safeYamlValue` (`resolvesToNonString` dahil) birebir kopyalandı; yazma yolu
`write-gate.ts:268` (`parts[statusIdx] = \`status: ${safeYamlValue(next)}\``) ile aynı şekilde
kuruldu, frontmatter bloğu gerçek `yaml.parse()`'dan geçirilip `parsed.status === value` arandı.

| Küme | Sonuç |
|---|---|
| Sözleşmenin 40 fixture'ı (19 gösterge + 21 tip-zorlayan) | **40/40 GEÇTİ** |
| Brief'in istediği ek küme + benim eklediklerim (toplam 75: `yes`/`on`/`off`/`No`/`y`/`n`, boş dize, `" "`, `"   "`, 200 karakter, `İnceleme`, `çğıöşü`, `ĞÜŞİÖÇ`, `2026-09-05`, `00:30`, `x: y`, `değer#1`, `e-2`, `[]`, `{}`, `x,y`, `x\ty`, baştaki/sondaki boşluk, 7 bilinen durum) | **75/75 GEÇTİ** |
| Aynı 75 değer, **mevcut** (eski) kural | 36/75 |
| Aşırı-tırnaklama | 7 bilinen durum (`todo`/`contract`/`dev`/`qa`/`fix`/`done`/`blocked`) **hiçbiri tırnaklanmıyor** → normal kullanımda dosya gürültüsü **yok**. Tırnaklanan 51/75 değerin tamamı patolojik/tip-zorlayan girdiler. |

Sonuç: D43'ün kuralı **doğru ve yeterli**, kabul ölçütü 40/40 sözleşmede yazılı. (Kayıt: `!x` gibi
çözülemeyen etiket değerlerinde `parseYaml` bir `YAMLWarning`'i sunucu `stderr`'ine basar —
zararsız, ama `resolvesToNonString` her çağrıda tetikleyebilir; NOT-3.)

**3) dnd-kit dist okuması (D44).** `unpkg`'den indirildi, okundu:
- `@dnd-kit/accessibility@3.1.1/dist/accessibility.esm.js`: `LiveRegion({id, announcement,
  ariaLiveType = "assertive"})` → `<div role="status" aria-live={ariaLiveType} aria-atomic>`;
  `useAnnouncement` → `announce(v)` yalnızca `v != null` iken `setAnnouncement`.
- `@dnd-kit/core@6.3.1/dist/core.esm.js:165-172`: `Accessibility` `<LiveRegion id=… announcement=…/>`
  çağırıyor, `ariaLiveType` **geçirilmiyor**; markup `mounted` olduktan sonra koşulsuz render.
**Cevap: evet, `aria-live="assertive"` düğümü DOM'da kalır** (boş dize içerikle). Kabul edilebilir:
içerik hiç değişmediği için ekran okuyucu hiçbir şey anonslamaz (`announce('')` state'i `''`'den
`''`'e taşır, DOM mutasyonu yok) — sözleşmenin çözümü çalışır. Çit + mutasyon §7'de planlı
(assert (a): assertive bölgenin `textContent`'i boş kalır; mutasyon: boş-dize override kaldırılınca
İngilizce varsayılan yazılır → KIRMIZI). **Kapandı.**

### NOT (düzeltme istenmiyor, kayıt)

- **NOT-1:** §3 madde 8 (satır 336-339) ağ hatası metnini hâlâ eski hâliyle (`"… sunucuya
  ulaşılamadı."`, "Tekrar deneyin." yok) ve **"CEO'ya soru, §9"** notuyla taşıyor; §4.3 (bağlayıcı
  eşleme tablosu) ve §9 madde 2 bunu kapatmış durumda. Aynı dizenin iki farklı sürümü var; madde 8
  zaten "Mesaj eşlemesi §4.3'te" dediği için tek otorite belirsiz değil, ama kod turundan önce
  satırın §4.3'e hizalanması ucuz.
- **NOT-2 (D44 kalıntısı):** aynı dist okumasında `defaultScreenReaderInstructions.draggable`
  (İngilizce: "To pick up a draggable item, press the space bar…") `HiddenText` ile render edilip
  her karta `aria-describedby` ile bağlanıyor (`core.esm.js:165-169`, `:3437-3438`), ayrıca
  `aria-roledescription: 'draggable'` (İngilizce) veriliyor. §7 bunları hiç anmıyor → Türkçe
  panelde ekran okuyucu kullanıcısı İngilizce yönerge duyar ve yönerge **yanlış** tuşları tarif
  eder (yeni tasarımda `Space` ile bırakma, `Enter` yok). İki prop ile kapanır
  (`screenReaderInstructions={{draggable: '…'}}` ve `attributes={{roleDescription:'kart'}}`).
  Yeni bulgu olduğu ve bu turun kapsamına girmediği için NOT; R1 düzeltilirken aynı yerde
  kapatılması doğal olur.
- **NOT-3:** `resolvesToNonString`, çözülemeyen etiketli değerlerde (`!x`) Node `YAMLWarning`'i
  bastırır (ölçüldü). Zararsız; istenirse `parseYaml(value, {logLevel:'silent'})`.
- **NOT-4:** §8 mutasyon 18 hedefi "`useFeatures.ts`/`useProjects` reuse: … ilk `features`/`projects`
  sinyali yok sayılsın" — iki dosya, iki kanal, "veya" belirsizliği. Mutasyon hedefi tek dosya +
  tek kanal olarak sabitlenmeli (tur 1'in mutasyon-kaçağı dersi).
- **NOT-5:** §3 başlığı hâlâ "Tasarım kararları (**12** madde)" ama 13 madde var (madde 13 bu turda
  eklendi). §1 madde 2'nin "**Beş** devralınan taahhüt" hatası (tur 1 NOT-a) da duruyor.

### Kod turuna başlamak için eksik olan tek şey

Dört mekanik düzeltme: **R1** (tek tuş sözleşmesi + §5 AC9 adımlarının hizalanması + UX §443
sapmasının işaretlenmesi), **R2** (guard iki config'i okusun), **R3** (echo eşiği kesin eşitlik +
mutasyon→çit eşlemesinin düzeltilmesi), **R4** (9 → 40 fixture). Hiçbiri yeni tasarım kararı
gerektirmiyor; dördü de tek düzeltme turunda kapanır ve üçüncü QA turu **yalnızca bu dörde**
bakacak.

---

## Developer düzeltme yanıtı — tur 3 (2026-09-05)

Bu turda **yalnızca bu dosya** değiştirildi (`git status` ile doğrulanacak); `src/`, `tests/`,
`scripts/`, `.claude/`, `.github/`, `package.json`, diğer `docs/**` dosyaları dokunulmadı. Kod
yazılmadı, `npm install`/ölçüm çalıştırılmadı (bu turda gerçek çalışma zamanı ölçümüne ihtiyaç
yoktu — dört madde de metin/tasarım tutarlılığı düzeltmesi). Aşağıda QA'nın 4 madde + 1 NOT'unun
her biri numarasıyla ele alınıyor; tur 1'in kapanan 10 bulgusu, Karar 1'in hook yeniden kullanımı,
`safeYamlValue` 40/40 (75/75) sonucu ve dnd-kit çözümü **yeniden açılmadı**.

| # | Ne değiştirdim | Bölüm/satır |
|---|---|---|
| R1 | Tek, tutarlı klavye onay tuşu tasarımı üç yerde birebir kuruldu: (a) §3 madde 6'ya bağlayıcı `docs/03-ux.md:443` alıntısı + "boşta `Enter`=modal (AC7), `Boşluk`=sürükleme başlat, sürükleme aktifken `Enter`/`Boşluk`/`Tab`=onayla, `Esc`=iptal" tasarımı + `isDragSelected` state mantığı yazıldı; (b) §7'nin "Kart sürükleme klavye alternatifi" bölümü aynı tasarıma göre yeniden yazıldı, `keyboardCodes: {start:['Space'], end:['Space','Enter','Tab'], cancel:['Escape']}` üç yerde (§3 madde 6, §7, tur 2'nin kendi ölçüm alıntısı hariç — o tarihsel kayıt) aynı; (c) §5 AC9 satırı `page.keyboard.press('Tab'/'Space'/'ArrowRight'/'Enter')`'e çevrildi (ilk `Enter` artık yok, `Tab` yalnızca odaklanma). UX'in "`Enter`/`Boşluk` ile başlat" isteğinin `Enter` kısmı AC7 ile çakıştığı için **karşılanamadı** — bu, §3 madde 6 ve §7'de "**Bilinçli sapma (UX §443'ten)**" başlığıyla açıkça işaretlendi, gerekçelendirildi (boşta iki farklı niyeti tek tuşa aynı anda bağlamanın yapısal imkânsızlığı) ve §9'a madde 6 olarak CEO ödevi (UX satırının güncellenmesi) eklendi. `end` listesinden `Tab` **düşürülmedi** — dnd-kit'in kendi varsayılanıyla aynı bırakıldı, tur 2'nin "sessiz düşürme" eleştirisi bu şekilde kapatıldı. | §3 madde 6 (KanbanCard/klavye alt bölümü), §7 (Kart sürükleme klavye alternatifi + yeni "UX §443'ten bilinçli sapma" paragrafı), §5 AC9 satırı, §9 madde 6 |
| R2 | `tests/e2e-config-guard.test.ts` tasarımı iki config'i birden okuyacak şekilde yeniden yazıldı: `playwright.config.ts` VE `playwright.dev.config.ts` ayrı ayrı okunur, her spec dosya adı **en az birinde** geçiyorsa geçerli sayılır (OR mantığı). Repoda ölçülen gerçek eksik liste (`dev-shell.spec.ts`'in yalnızca dev config'e bağlı olması) gerekçe olarak yazıldı. Yorum-satırı yanlış negatifi ve glob yanlış pozitifi (yön güvenli) açıkça kayıt altına alındı. | §2.1 `tests/e2e-config-guard.test.ts` satırı |
| R3 | §4.4 madde 4'ün ölçüm adımları yeniden yazıldı: taban (`before`) artık **PATCH yanıtı DOM'a yansıdıktan hemen sonra** okunuyor, 3 sn sonraki değer (`after`) ile **kesin eşitlik** (`expect(after).toBe(before)`) karşılaştırılıyor (önceki "en fazla 1 kez artar" eşiği taban belirsizliğinden mutasyon 5'i kaçırıyordu). "Tek mutasyon iki çiti de kırar" cümlesi kaldırıldı; yerine mutasyon 5 → yalnızca render-sayacı çiti, mutasyon 14 → yalnızca `getCount` çiti eşlemesi ayrı ayrı yazıldı (her ikisinin diğerinde yeşil kalması **beklenen** davranış olarak işaretlendi). | §4.4 madde 4 |
| R4 | Fixture sayısı iki yerde de kabul ölçütüyle (40) hizalandı: §2.2 `tests/server/write-gate.test.ts` satırı "18-26 (9 fixture)"tan "18-57, 19 gösterge-karakterli + 21 tip-zorlayan, toplam 40"a; §5 T5 satırı "9 yeni golden fixture"tan "40 yeni golden fixture (19+21), 40/40 kabul ölçütü"ne çevrildi. | §2.2 `tests/server/write-gate.test.ts` satırı, §5 T5 satırı |
| NOT-2 | dnd-kit'in İngilizce `defaultScreenReaderInstructions.draggable` (`aria-describedby`) ve `aria-roledescription: 'draggable'` çıktısı §7'ye yeni bir alt bölümle eklendi: `DndContext`'e Türkçe `screenReaderInstructions.draggable` metni (gerçek tuş adlarıyla: Boşluk/Enter/Escape) + her `useDraggable`'a `attributes.roleDescription: 'kart'` verilmesi kararlaştırıldı, iki assert (Türkçe `aria-describedby` metni, Türkçe `aria-roledescription`) ve bir mutasyon (override kaldırılınca İngilizce metin geri gelir → KIRMIZI) yazıldı. | §7, "QA tur 2 NOT-2 düzeltmesi" paragrafı |

**R1 için bağlayıcı kaynağın tam metni (`docs/03-ux.md:443`, G3 onaylı, bu turda dosyadan okunarak
doğrulandı):**

> Sürükle-bırak klavye alternatifi: Karta `Tab` ile odaklan → `Enter`/`Boşluk` ile "seçili" moda al
> (amber kenarlık ile vurgulanır) → `←`/`→` ok tuşları hedef sütunu değiştirir (sütun adı
> `aria-live="polite"` bölgesinde anons edilir) → `Enter` ile onayla (aynı iyimser yazma/hata akışı
> devreye girer) veya `Esc` ile iptal.

Seçilen tasarım bu metnin **onaylama** yarısını (`Enter` ile onayla, `Esc` ile iptal) birebir
uyguluyor; **başlatma** yarısının yalnızca `Boşluk` kısmını uyguluyor, `Enter`'ı AC7'nin (karta
tıkla → salt okunur detay modalı) klavye eşdeğeriyle çakıştığı için başlatıcı olarak **kullanmıyor**
— bu, gövdede "Bilinçli sapma (UX §443'ten)" olarak açıkça işaretlendi, sessiz bırakılmadı.

**Gövde içi tutarlılık:** `keyboardCodes` üç canlı bölümde (§3 madde 6, §7, §5 AC9) aynı davranışı
tarif ediyor; yalnızca tur 2'nin kendi "Ölçümlerim"/"YENİ-R1" bölümleri (§'ler 1017, 1090 civarı)
QA'nın tur 2'de bulduğu **eski, bozuk** hâli tarihsel kanıt olarak alıntılıyor — bunlar QA'nın kendi
raporu olduğu için değiştirilmedi (kapsam dışı, tarihsel kayıt). Fixture sayısı gövdede artık her
yerde 40; QA'nın tur 1/tur 2 kapanış tablolarındaki "9 fixture" alıntıları da aynı gerekçeyle
(QA'nın kendi geçmiş tespiti) dokunulmadan bırakıldı.

**Kalan riskler:** UX §443'ün CEO tarafından güncellenmesi kod turu GEÇTİ aldıktan sonraya
ertelendi (§9 madde 6) — kod turunda gerçek dosya hâlâ eski metni taşıyacak, bu geçici bir
doküman-kod uyumsuzluğu ama davranışı etkilemiyor (davranış sözleşmede net). NOT-2'nin Türkçe
`screenReaderInstructions` metninin gerçek bir ekran okuyucuyla (veya en azından tarayıcı
erişilebilirlik ağacı denetleyicisiyle) doğrulanması kod turuna devredildi — bu turda yalnızca
DOM `textContent`/öznitelik seviyesinde çitlendi.

---

## CEO onayı — sözleşme KAPANDI (2026-09-05)

QA tur 2, tur 1'in 14 bulgusunun 10'unu KAPANDI saydı; kalan 4 madde + 1 NOT tur 3'te kapatıldı.
Dördüncü bir tam QA turu yerine CEO doğruladı — beşi de mekanikti ve diskte kontrol edildi:
tuş tasarımı üç yerde **tek** (satır 279-302) · guard **iki config'i** okuyor ve bilinen sınırlarını
yazmış (satır 97) · echo eşiği **kesin eşitlik** (satır 550) · fixture sayısı **40** (satır 232) ·
ekran okuyucu metinleri **Türkçe** (satır 726-738).

### CEO kararı — UX §443'ten bilinçli sapma ONAYLANDI

`docs/03-ux.md:443` (G3 onaylı) klavye akışını şöyle tarif ediyor:
> "Karta `Tab` ile odaklan → `Enter`/`Boşluk` ile 'seçili' moda al → `←`/`→` sütun değiştirir →
> `Enter` ile onayla veya `Esc` ile iptal."

Sözleşme sürüklemeyi **yalnızca `Boşluk`** ile başlatıyor; `Enter` başlatmıyor. Sebep gerçek bir
çakışma: `Enter`, AC7'nin (karta tıkla → detay modalı) **klavye eşdeğeridir**. UX'in istediği gibi
`Enter` de sürükleme başlatsaydı, kart odaktayken `Enter` hem modalı açmak hem sürüklemeyi başlatmak
zorunda kalırdı — belirsiz ve kullanıcıyı şaşırtan bir davranış.

**Onaylıyorum.** Gerekçe: (a) sapma UX'in **onaylama** yarısına dokunmuyor — `Enter` hâlâ onaylıyor,
`Esc` hâlâ iptal ediyor, ok tuşları hâlâ sütun değiştiriyor; (b) `Boşluk` ile sürükleme başlatmak
ARIA yazma kılavuzlarının standart deseni, kullanıcıya yabancı değil; (c) alternatif
(durum-bağımlı `Enter`) aynı tuşa iki anlam yükleyip erişilebilirliği **kötüleştirirdi**.
Sapma sözleşmede açıkça işaretlendi ve sessiz bırakılmadı — istediğim buydu.

**Kullanıcıya sorulmadı** çünkü bu, onaylanmış tasarımın *ruhunu* koruyan bir çakışma çözümü;
ürün davranışını değiştiren bir kapsam kararı değil. `docs/03-ux.md:443`'e bu çözümü yansıtan
tek cümlelik not CEO tarafından eklenecek (§9 madde 6, CEO ödevi).

**KARAR: ONAY.** Kod turu başlayabilir.
Bağlayıcı sıra: bu bölüm → `## CEO kararları — §9'daki üç soruya cevap` → **D40-D45** →
CEO kararları **A-F** → sözleşme gövdesi → QA tur 2'nin NOT'ları → feature notundaki
**10 AC + 6 devralınan taahhüt**.

**Sözleşme aşaması bilançosu:** 3 developer + 2 QA turu, 14 bulgu + 4 regresyon, **tek satır kod
yazılmadan** kapandı. Dört yakalama turların parasını çıkardı:

1. **Yeni E2E dosyası hiç koşmayacaktı** — `testMatch` kapalı bir liste ve `kanban.spec.ts` orada
   değildi: 4 kabul kriteri, 3 devralınan taahhüt ve echo ölçümü **ölü doğardı**. Bu tuzağın
   **üçüncü** tekrarıydı (F-003, F-005). Tek dosya ekleyip geçmedik: artık her E2E dosyasının
   kapsandığını doğrulayan bir guard var — ve QA o guard'ın **doğuştan kırmızı** olacağını da
   ölçtü (`dev-shell.spec.ts` ayrı config'e ait), iki config okuyacak şekilde düzeltildi.
2. **Echo ölçümü de ölü doğacaktı:** ölçüm niteliği `MODE !== 'production'` kapılıydı ama E2E
   üretim derlemesiyle koşuyor. Üstelik ilk düzeltmeden sonra bile eşik **kendi mutasyonunu
   kaçırıyordu**; kesin eşitliğe çevrildi.
3. **`safeYamlValue` yetersizdi** — QA gerçek `yaml@2.9.0` ile ölçtü: 40 değerin **10'u**
   round-trip'i geçmiyordu (`true`, `null`, `~`, `12`, `0x1F`, `.inf`). `status: true` yazılsa
   YAML onu boolean okur ve kart bozulurdu. Çözüm zarif: karakter listesi yerine
   **"`yaml.parse` string dönmüyorsa tırnakla"** — kural kendini doğruluyor. 40/40, QA'nın
   genişlettiği 75 değerlik kümede 75/75.
4. **Erişilebilirlik iddiası yanlıştı:** QA `@dnd-kit/accessibility` dist kaynağını indirip okudu —
   canlı bölge varsayılanı `aria-live="assertive"` ve çekirdek paket bunu hiç değiştirmiyor.
   Ayrıca kütüphanenin ekran okuyucu talimatları **İngilizce** ve **eski tuş tasarımını** anlatıyor.
   İkisi de kendi Türkçe metinlerimizle geçersiz kılınacak.

---

## Mutasyon kanıtı (kod turu, 2026-09-05)

Kod tamamlanmış hâldeydi (son commit `ed97bd1`); bu turun tek işi §8'in mutasyon iddialarını
gerçekten çalıştırıp kanıtlamaktı. Her satır için: kaynak dosyada mutasyon uygulandı → ilgili test
komutu koşturuldu → KIRMIZI görüldü → `git checkout --` ile geri alındı → `git diff HEAD -- src/`
boş olduğu doğrulandı. 14 mutasyon koşturuldu (istenenin üstünde, §8'in 18 kaleminin büyük
çoğunluğu + brief'in özellikle işaret ettiği 5 kalemin tamamı).

| # | Mutasyon | Dosya | Kırmızı veren test | Hata mesajının ilk satırı |
|---|---|---|---|---|
| 1 | `columnFor` her zaman `'todo'` dönsün | `parse-feature.ts` | `parse-feature.test.ts` (7 test) | `AssertionError: expected 'todo' to be 'unknown'` |
| 2 | `.md` uzantı filtresi kaldırılsın | `list-features.ts` | `list-features.test.ts` | `AssertionError: expected 3 to be 1` |
| 3 (AC4, öncelikli) | `expected_hash` karşılaştırması atlansın (`if (false)`) | `write-gate.ts` | `features-api.test.ts` (409 testi) | `AssertionError: expected 200 to be 409` |
| 4 | 500 yanıtında ham `describeError()` sızdırılsın | `handlers.ts` | `features-api.test.ts` (write_failed testi) | `AssertionError: expected 'ÇOK GİZLİ İÇ HATA METNİ...' to be 'Dosyaya yazma izni reddedildi.'` |
| 5 (D42/echo, öncelikli) | hash-bazlı birleştirme kaldırılsın (`mergeCards` her zaman `next` dönsün) | `useFeatures.ts` | `useFeatures.test.ts` (echo referans testi) | `AssertionError: expected {...} to be {...}` (referans farkı) — **bkz. "Yeşil kalan" bölümü, test önce güçlendirildi** |
| 6 | sürükleme-sırasında-kuyruklama (`isDraggingRef`) kaldırılsın | `useFeatures.ts` | `useFeatures.test.ts` (ADR-004 y4 testi) | `AssertionError` (fetch sayısı beklenenden farklı) |
| 7 (T4) | `delay()` senkron/bloklayıcı hâle getirilsin (eski `Atomics.wait` taklidi) | `write-gate.ts` | `write-gate.test.ts` (T4 mikro-görev testi) | `AssertionError: expected 59 to be less than 20` |
| 8 (T5/safeYamlValue, öncelikli) | `YAML_INDICATOR_START` regex'i kaldırılsın | `write-gate.ts` | `write-gate.test.ts` (T5, 19 gösterge fixture) | `YAMLParseError: Plain value cannot start with reserved character` (14 test kırmızı) |
| 8b (T5/safeYamlValue, öncelikli) | `resolvesToNonString` kaldırılsın | `write-gate.ts` | `write-gate.test.ts` (T5, 21 tip-zorlayan fixture) | `AssertionError: expected ... NaN` (21 test kırmızı) |
| 9 (T1) | `App.tsx`'te `role="tablist"` kaldırılsın | `App.tsx` | `App.test.tsx` | `AssertionError: expected '<header...' to contain 'role="tablist"'` |
| 10 (AC9) | `keyboardCoordinates.ts` piksel artışı döndürsün (sütun indeksi değil) | `keyboardCoordinates.ts` | `keyboardCoordinates.test.ts` (3 test) | `AssertionError: expected {...} to deeply equal {...}` |
| 11 | bozuk frontmatter'da `parse_error` set edilmesin | `parse-feature.ts` | `parse-feature.test.ts` | `AssertionError: expected undefined to be truthy` |
| 12 (D41) | `content_hash` yalnızca frontmatter bloğundan hesaplansın (tam dosyadan değil) | `parse-feature.ts` | `parse-feature.test.ts` (birim + çapraz-modül davranışsal test) | `AssertionError: expected '4c34b27...' to be '8d1d75c...'` + `expected false to be true` (gerçek `setFeatureStatus` `conflict` döndü) |
| 13 (D40/guard, öncelikli) | `tests/e2e/zzz-qa-probe.spec.ts` eklendi (hiçbir config'te yok) | `tests/e2e/` (geçici dosya, ölçümden hemen sonra silindi) | `e2e-config-guard.test.ts` | `Error: tests/e2e/zzz-qa-probe.spec.ts ne playwright.config.ts ne de playwright.dev.config.ts içinde geçiyor...` |
| 14 (AC9, öncelikli, E2E) | `KEYBOARD_CODES.start` `['Space']`'ten `['KeyX']`'e değiştirildi | `KanbanScreen.tsx` | `tests/e2e/kanban.spec.ts` (gerçek Chromium, `-g "AC9"`) | `Error: expect(locator).toBeVisible() failed ... element(s) not found` |

**Yeşil kalan (test düzeltildi, mutasyon değil) — mutasyon 5, D42/echo:**
`tests/features/kanban/web/useFeatures.test.ts`'teki `fetchReturning()` yardımcı fonksiyonu her
çağrıda **aynı** dizi/nesne referansını (`data: cards`) döndürüyordu; bu yüzden "aynı content_hash
→ aynı REFERANS" testi `mergeCards`'ın hash-bazlı birleştirmesi **tamamen kaldırılsa bile** sahte
biçimde YEŞİL kalıyordu (mock zaten aynı referansı veriyordu, üretim kodunun çalışıp çalışmaması
sonucu etkilemiyordu). **Düzeltme:** `fetchReturning` artık her çağrıda kartların sığ kopyasını
(`cards.map((c) => ({ ...c }))`) üretiyor — böylece referans eşitliği yalnızca `mergeCards` GERÇEKTEN
önceki referansı koruduğunda sağlanıyor. Düzeltme sonrası gerçek koda karşı 5/5 tekrar YEŞİL,
mutasyona karşı tekrarlı koşularda RED (bkz. "Bilinen kalıntı" notu). Commit: `ac40677`.

**Bilinen kalıntı — mutasyon 5'in kendisi flaky (test suçu değil, gerçek kod her zaman stabil
YEŞİL):** düzeltilmiş test, doğru üretim koduna karşı 5/5 tekrarlı koşuda **stabil YEŞİL**.
Mutasyonlu koda karşı ise 3 koşudan 2'si KIRMIZI, 1'i YEŞİL kaldı — `rerender()`'ın tetiklediği
ikinci `fetch`'in state'e yansıması ile `waitFor(() => fetchImpl çağrı sayısı === 2)` koşulunun
karşılanma anı arasında bir yarış var (React state commit'i mock'un `await res.json()` zincirinden
sonra gerçekleşiyor). Bu, `docs/progress.md`'de daha önce kaydedilen "vitest worker fork
kararsızlığı" ile aynı sınıf değil (o dosya-seviyesi bir izolasyon sorunuydu) ama aynı derste:
zamanlamaya dayalı `waitFor` + mock tabanlı testler ara sıra "yanlışlıkla yeşil" verebilir. Gerçek
kod tarafında risk yok (5/5 stabil); mutasyon kanıtının kendisi için düzeltme **kapsam dışı**
bırakıldı (test zaten mutasyonu doğru sıklıkta yakalıyor, tam determinizm bu turun hedefi değildi).

**Stil çiti (görev madde 3) — zaten mevcut, ek iş gerekmedi:** `src/web/index.css:10` `@source
"../features/kanban/web"` zaten ekli; `tests/build-css.test.ts`'in "F-007" describe bloğu üç farklı
kökte (`src/web`, `events/web`, `projects/web`) **hiç geçmeyen** 3 kanban-özel sınıfı (`min-w-[220px]`,
`bg-fuchsia-950/10`, `text-[10px]`) önce ön-koşul olarak, sonra üretilen CSS'te var olduğunu
doğruluyor — F-003'ün "tesadüfen yeşil kalma" sınıfı burada yapısal olarak kapatılmış.

**`safeYamlValue` 40/40 — bu turda yeniden çalıştırıldı, doğrulandı:** `write-gate.test.ts`'in T5
bloğu tam 19 gösterge-karakterli + 21 tip-zorlayan = 40 fixture içeriyor, hepsi gerçek `yaml.parse()`
round-trip'iyle geçiyor (`npx vitest run tests/server/write-gate.test.ts -t "T5"` → 42 test yeşil:
40 fixture + 1 sayım testi + 1 "7 bilinen durum aşırı-tırnaklanmıyor" testi).

**Komut çıkış kodları (bu turda yeniden koşturuldu):** `npm run verify` → 0 (48 dosya / 728 test,
typecheck+lint+test+build) · `npm run e2e` → 0 (23 passed) · `npm run e2e:dev` → 0 (1 passed).
`git diff HEAD` her mutasyon sonrası ve turun sonunda boş.
