---
feature: F-005
title: Proje kayıt defteri + dosya izleme + Ayarlar ekranı (çok projeli izleme)
author: developer
status: draft
date: 2026-09-05
revision: tur 3 (2026-09-05) — QA tur 2'nin 1 BLOKLAYICI + 3 ÖNEMLİ + 2 NOT bulgusu kapatıldı:
  CEO'nun "Ayarlar'ın yeri ve sekme deseninin ertelenmesi" kararı gövdeye işlendi (tam `tablist`
  deseni kaldırıldı, F-007'ye devredildi), F-007 devir taahhüdü tamamlandı, `shell.spec.ts`
  eklendi, izleyici sayacı gözlem yolu düzeltildi, `fs.watch`/eşik kalıntıları temizlendi. Bkz.
  sonundaki "Developer düzeltme yanıtı — tur 3".
---

# F-005 Sözleşmesi — proje kayıt defteri + dosya izleme + Ayarlar ekranı

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").

Kaynaklar: `docs/features/F-005-proje-kayit-izleme.md` (6 AC + dosya sahipliği, bağlayıcı),
`docs/02-architecture.md` §3.4 (bağımlılık listesi), §3.6 (yol kuralı), §4 (klasör yapısı), §5.2
(`ProjectRecord`), §5.3 (`FeatureCard` — F-007'nin işi), §6.1/§6.2 (API), §7/§10 (yazma sınırı,
Host/Origin), §11 (test stratejisi), `docs/decisions/ADR-001` (karar 4/6), `ADR-003` (karar 6),
`ADR-005`, `ADR-008` + eki, `ADR-009` (Windows-only), `docs/03-ux.md` ekran 3 (Ayarlar) + ortak
kabuk/gezinme + erişilebilirlik notları + Türkçe metin sözlüğü (G3 onaylı, bağlayıcı),
`docs/01-prd.md` Özellik 3 (AC1-AC5), `docs/qa/F-003-contract.md` (biçim örneği + D1-D15 disiplini),
`CLAUDE.md` (Karpathy kuralları + Öğrenilen kurallar), `docs/HANDOFF.md` (CEO kararları A-H).
Mevcut kod: `src/server/index.ts`, `src/server/sse/{hub,stream}.ts`, `src/server/store/
jsonl-store.ts`, `src/shared/types.ts`, `src/web/{App.tsx,index.css}`, `src/web/lib/
useEventStream.ts`, `src/features/events/web/icons.tsx`, `package.json`, `vite.config.ts`,
`playwright.config.ts`, `tests/no-external-host.test.ts`, `tests/deps.test.ts`, `tests/build-css.
test.ts`, `tests/web/App.test.tsx`, `tests/web/App.interaction.test.tsx`, `tests/helpers/
temp-data-dir.ts`.

Bu turda `src/`, `tests/`, `scripts/`, `.claude/`, `package.json`, `.github/workflows/ci.yml`,
`docs/02-architecture.md`, `docs/features/**`, `docs/decisions/**` altında **hiçbir dosya
değiştirilmedi**; yalnızca bu sözleşme metni yazıldı. `chokidar`/`readdirp` sürüm, bağımlılık ve
`scripts` (install script) verisi (§3 madde 1) `npm view` ile gerçek npm registry'sinden bu turda
(tur 2) yeniden okundu — `chokidar@4.0.0-4.0.3`, `chokidar@5.0.0` ve `readdirp@4.0.0-4.1.2` dahil —
hiçbir dosyaya yazılmadı, `node_modules`'a hiçbir şey kurulmadı, geçici dizin/süreç bırakılmadı.

---

## 1. Kapsam

**İçinde:**

1. **İzleme mekanizması — `chokidar@^4.0.3`** (CEO kararı D16 — tur 1'in `node:fs.watch` kararı
   QA'nın ölçtüğü iki gerçek kusur yüzünden **geri alındı**, bkz. §3 madde 1, ADR-012 taslağı §6).
   Yeni runtime bağımlılığı **ekleniyor** (`package.json`, kod turunda — mimari §3.4'ün zaten
   onaylı kapalı listesinde, bu bir kapsam genişlemesi değil eksik uygulamanın tamamlanması).
2. `src/server/store/projects-registry.ts` — `data/projects.json` kayıt defterinin fabrika
   deseninde (jsonl-store ile aynı stil) okunması/yazılması: `init/list/add/remove/findByRealPath`,
   atomik yazma (tmp+rename), bozuk/eksik dosyada best-effort davranış (§4).
3. `src/server/watch/debounce.ts` + `src/server/watch/project-watcher.ts` — tek bir projenin
   `docs/features` dizinini (yalnızca bu alt dizin, düz/derin olmayan) izler, 150 ms trailing
   debounce ile bir `onChange(projectId)` callback'i tetikler (§3 madde 2).
4. `src/features/projects/server/{validate-path,handlers,service}.ts` — yol doğrulama (savunmacı,
   `node:path` ile, elle regex yok — §7), HTTP işleyicileri (`GET/POST/DELETE /api/projects`),
   servis orkestrasyonu (registry + watcher + hub broadcast, sunucu açılışında var olan kayıtlar
   için otomatik yeniden izleme — AC5).
5. `src/features/projects/web/{SettingsScreen,ProjectRow,AddProjectForm,useProjects}.{ts,tsx}` —
   Ayarlar ekranı: proje listesi tablosu, ekleme formu, durum tasarımı (boş/yükleniyor/hata),
   canlı güncelleme (SSE `projects` kanalı).
6. **Ayarlar'a geçiş: dişli düğmesi** (CEO kararı, dosya sonu — "Ayarlar'ın yeri ve sekme
   deseninin ertelenmesi") — `App.tsx`'e gerçek bir `<button type="button" aria-label="Ayarlar"
   aria-pressed={...}>` eklenir; basit bir `activeScreen: 'timeline' | 'settings'` state'i
   `hidden` özniteliğiyle panel geçişini yönetir (§6). Zaman Çizelgesi `aria-current="page"`
   taşıyan statik `<span>` olarak değişmeden kalır (`src/web/App.tsx:28`); Kanban da statik
   `<span>` olarak değişmeden kalır. **Tam `role="tablist"`/`tab`/`tabpanel` deseni + roving
   tabindex + ok tuşu gezinmesi bu feature'ın kapsamı DIŞINDA** — Kanban F-007'de gelene kadar
   sekme çubuğunda tek gerçek ekran (Zaman Çizelgesi) var, bugün olmayan bir şey için desen
   kurmak F-003 CEO kararı D8'in reddettiği durumun aynısı (Karpathy §2); tam desen F-007'ye
   devredilir (§9 madde 8).
7. `App.tsx`'e Ayarlar ekranının kablolanması + `useEventStream`'e `onProjects` callback'i
   (dosya sahipliği genişletmesi, gerekçe §2.2).
8. `src/web/index.css`'e `@source "../features/projects/web"` eklenmesi + `tests/build-css.
   test.ts`'in genişletilmesi (madde 8, gerekçe §2.2 — F-003'ün B1 dersinin tekrarını önler).
9. `playwright.config.ts`'e yeni `tests/e2e/settings.spec.ts` dosyasının `testMatch`'e eklenmesi.

**Kapsam DIŞI (bilinçli):**

- Yazma kapısı (F-006), kanban (F-007), Kapılar/Thread/Token (Faz 2) — CEO kararı H.
- İzlenen projelere hook kurulumu (`scripts/install-hook.mjs` çağrısı) — CEO kararı H, F-004'ün
  işi, bu feature'ın hiçbir AC'si bunu istemiyor.
- `FeatureCard` türetimi / frontmatter ayrıştırma / kanban kartı hesaplama — mimari §4 bunu açıkça
  `features/kanban/server`'a atıyor (F-007). F-005 yalnızca "docs/features değişti" **sinyalini**
  üretir (§3 madde 3), kart içeriğini üretmez.
- `PATCH /api/projects/:id` (etiket yeniden adlandırma / `enabled` değiştirme) — mimari §6.2 bunu
  listeliyor ama **hiçbir AC istemiyor**, UX ekran-3 wireframe'inde yeniden adlandırma/etkinleştirme
  denetimi yok (yalnızca Ekle/Kaldır). Karpathy §2 — istenmeyen soyutlama eklenmiyor.
- `EventRecord.project_id` doldurma (olayları kayıt defteriyle eşleştirme) — bu, `src/features/
  events/server/{ingest,normalize}.ts`'e dokunmayı gerektirir (F-002/F-003'ün sahiplik alanı,
  F-005'in dosya sahipliği listesinde yok). AC4'ün "olaylar ... ayırt edilebilir" kısmı zaten
  `project_name` (her zaman dolu, `path.basename(project_path)`, F-002'den beri var) ve mevcut
  `projectColor.ts` ile **F-005'ten bağımsız olarak** karşılanıyor (bkz. §5 AC4 notu) — bu yüzden
  dokunmuyorum. `project_id` alanı F-005 sonrası da `undefined` kalmaya devam edecek; ileride
  gerekirse ayrı, küçük bir görev.
- 1-6 numaralı global sekme kısayolları — F-003'ün zaten kapsam dışı bıraktığı, henüz hiçbir
  feature'ın üstlenmediği bir iş; F-005 yalnızca UX'in istediği dişli düğmesini kurar, sayısal
  kısayolları eklemez.
- Gerçek `tablist`/`tab`/`tabpanel` deseni + roving tabindex + ok tuşu gezinmesi (`useTabs`
  soyutlaması) — CEO kararı (dosya sonu). Kanban F-007'de gelene kadar sekme çubuğunda tek gerçek
  ekran var; bugün olmayan bir şey için desen kurmak Karpathy §2 ihlali olurdu. F-007'nin işi (§9
  madde 8).
- Sunucu taraflı olay filtreleme, izlenen projelere periyodik "yeniden dene" (path kaybolduysa
  otomatik kurtarma) — CEO kararı H + Karpathy §2, hiçbir AC istemiyor (bkz. §9 risk 4).

---

## 2. Dokunacağım dosyalar

### 2.1 Yeni dosyalar

| Dosya | Amaç |
|---|---|
| `src/server/store/projects-registry.ts` | `createProjectsRegistry(dataDir)`: `init()` (dosya yoksa `{version:1,projects:[]}` ile başlar, bozuksa logla+boş başla **ve `isCorrupt()` sonraki çağrılarda `true` döner** — QA Bulgu 8b), `list()`, `add(realPath, label)` (id üret, `added_at`, `enabled:true`, atomik yaz, **conflict** kontrolü — bkz. §3 madde 4), `remove(id)` (bulunamazsa `false`), `findByRealPath(p)`, `isCorrupt(): boolean` (yalnızca `init()`'in bozuk JSON gördüğü süreç ömrü boyunca `true`, sonraki başarılı yazımlar sıfırlamaz). `unlink`/`rm` **hiç kullanılmaz** (yalnızca kendi `projects.json`'ını tmp+rename ile yazar). |
| `src/server/watch/debounce.ts` | `createDebouncer(delayMs, callback)` → `{ trigger(): void; cancel(): void }` — saf, zamanlayıcı enjekte edilebilir değil (gerçek `setTimeout` yeterli, testler `vi.useFakeTimers()` kullanır). Trailing debounce: her `trigger()` bekleyen zamanlayıcıyı sıfırlar. |
| `src/server/watch/project-watcher.ts` | `watchProjectFeatures(featuresDir, onChange, debounceMs=150)` → `stop(): void`. `chokidar.watch(featuresDir, { depth: 0, ignoreInitial: true, usePolling: process.env.MC_WATCH_POLLING === '1', awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 } })` (`depth: 0` — `docs/features` düz bir dizin, mimari §5.3 `FeatureCard.file` "yalnızca dosya adı" varsayımıyla tutarlı, bkz. §3 madde 3; `usePolling` mimari §3.5'in zaten tanımladığı `MC_WATCH_POLLING` anahtarına bağlı — kod turunda dizin yaşam döngüsü testleri (§3 madde 1 sonu) native modda başarısız olursa aynı anahtar bu senaryo için de kullanılabilir). Yalnızca `.md` uzantılı yol olayları (`add`/`change`/`unlink`, `path.extname(p) === '.md'`) debounce'a düşer. `watcher.on('error', ...)` hatayı yutar+loglar, fırlatmaz. Dizin baştan yoksa chokidar senkron atmaz, dizin belirdiğinde otomatik izlemeye başlar (chokidar'ın kendi davranışı — bu **kod turunda ampirik doğrulanacak**, bkz. §3 madde 1 sonu). |
| `src/features/projects/server/validate-path.ts` | `resolveProjectPath(input: unknown): { ok: true; path: string } \| { ok: false; message: string }` — saf ama senkron `fs` çağırır (jsonl-store/retention ile aynı stil, mimari örneklerinde yeni bir async soyutlama yok). §7'deki tabloyu birebir uygular; `node:path` dışında hiçbir yol işlemi yok. |
| `src/features/projects/server/handlers.ts` | `handleListProjects`, `handleAddProject`, `handleRemoveProject` — `ingest.ts`/`query.ts` ile aynı `sendJson` kalıbı (küçük yerel kopya, F-004'ün kendi port-çözümü kopyası emsaliyle tutarlı — paylaşılan bir `http-util.ts` **eklenmiyor**, tek fonksiyon). `handleListProjects` `registry.isCorrupt()` `true` ise yanıta `registry_corrupt: true` ekler (QA Bulgu 8b, §4.3). |
| `src/features/projects/server/service.ts` | `createProjectsService(dataDir, hub)`: açılışta registry'yi yükler, her `enabled` kayıt için (hepsi zaten `true`, §1 kapsam dışı not) `docs/features`'ın var olup olmadığını kontrol edip **varsa** izlemeye başlar (AC5); `addProject`/`removeProject` (registry + watcher lifecycle + `hub.broadcast('projects', list)` + değişen projede `hub.broadcast('features', {project_id})`); `stopAll()` (tüm `project-watcher` `stop()`'larını çağırır, `server.on('close', ...)`'a bağlanır — mevcut `stopRetention` deseniyle aynı yerde); **(QA Bulgu 10)** `getActiveWatcherCount(): number` (aktif `project-watcher` sayısı — `addProject`/`removeProject`/`stopAll` bunu güncel tutar, `handleHealth`'e `/api/health`'in `watchers` alanı için verilir). |
| `src/features/projects/web/SettingsScreen.tsx` | Ekranın kökü: `useProjects` + tablo + `AddProjectForm` + durum tasarımı (boş/yükleniyor/hata, UX doc "Ayarlar" satırı). |
| `src/features/projects/web/ProjectRow.tsx` | Tek satır: ad, yol (mono, kopyalanabilir — `navigator.clipboard`, başarısız olursa sessizce yutulur, kritik değil), `● izleniyor` / `⚠ yol bulunamadı` (ikon+renk+metin, UX "renk körlüğü kuralı"), feature sayısı, **Kaldır** butonu. |
| `src/features/projects/web/AddProjectForm.tsx` | Yol girişi (mono, placeholder) + **Ekle** butonu + satır içi kırmızı hata metni (AC3, UX akış f). Gönderim sırasında "kontrol ediliyor…" durumu. |
| `src/features/projects/web/useProjects.ts` | `useProjects(liveUpdate: ProjectListItem[] \| null)`: mount'ta `GET /api/projects`; `liveUpdate` değiştiğinde state'i onunla değiştirir (tam-liste-değiştirme, seq bazlı dedup gerekmez — küçük, sık değişmeyen liste); `add(path,label?)`/`remove(id)` (fetch + iyimser olmayan, yanıtı bekleyip state'i günceller — kayıt defteri kanban gibi yüksek frekanslı değil, iyimser UI karmaşıklığına gerek yok, Karpathy §2). |
| `tests/features/projects/server/validate-path.test.ts` | Birim — §7 tablosunun tamamı (≈20 vaka). |
| `tests/features/projects/server/projects-registry.test.ts` | Birim/entegrasyon (gerçek geçici dizin): ekle/çıkar/listele, atomik yazma (F-002'nin B1 tekniğiyle aynı — hedef dosya yolunda dizin koyup yazma hatasını gözlemle, orijinal dosya bozulmaz), dosya yoksa boş başlama, bozuk JSON'da boş başlama + log **+ `isCorrupt() === true`** (QA Bulgu 8b), `conflict` (aynı realpath ikinci kez eklenince, altı yazım varyantıyla — D17, §3 madde 4). |
| `tests/features/projects/no-delete-guard.test.ts` | Statik guard (CEO kararı B/C, savunma katmanı — mimari §11.4b'nin genel guard'ı henüz yok, F-006'da gelecek): `src/features/projects/**`, `src/server/watch/**`, `src/server/store/projects-registry.ts` metninde `unlink`, `rmSync`, `rmdirSync`, `fs.rm(` alt dizgelerinin **hiç** geçmediğini doğrular. **(QA Bulgu 13a)** Guard körlüğe karşı önce "taranan dosya sayısı > 0" assert'i yapılır (`tests/no-external-host.test.ts:53`'ün zaten kurduğu desenle aynı) — tarama listesi boş/yanlış olursa test kendisi başarısız olur, körlemesine yeşil kalamaz. |
| `tests/server/watch/debounce.test.ts` | Birim, sahte zamanlayıcı (`vi.useFakeTimers()`): art arda 5 `trigger()` çağrısı → yalnızca 1 `callback` çağrısı, 150 ms sonra; `cancel()` sonrası zamanlayıcı ateşlemez. |
| `tests/server/watch/project-watcher.test.ts` | Entegrasyon, gerçek geçici dizin + gerçek `chokidar`: `.md` dosyası oluşturunca `onChange` **debounce sonrası bir kez** çağrılır (event-driven bekleme, sabit `sleep` yok — bkz. §5 AC1); `.txt` dosyası değişikliği **tetiklemez**; `stop()` sonrası değişiklik `onChange`'i tetiklemez; **(D16 — yeni, QA Bulgu 1)** dizin silinip yeniden oluşturulduktan sonra `.md` yazımı yine `onChange`'i tetikler (event-driven bekleme, `watcher.close()` çağrılmadan); **(D16 — yeni, QA Bulgu 2)** dizin silinip silinmiş kalırken chokidar'ın `watcher.on('all', ...)` ile sayılan ham olay sayısı **1 saniyede 500'ün altında** kalır (tek, kesin sayaç ve tek eşik — `fs.watch`'ın ölçülen tabanının, 1 sn'de 112.535 olay [§6 ADR-012 taslağı], çok altında; "hata fırlamaz" gibi ölçmeyen bir assert **kullanılmaz**, QA Bulgu 2/"Ölçmeyen test riski" 1; `process.cpuUsage()` farkı yalnızca ek bilgi olarak loglanır, assert'in dayanağı değildir). Bu senaryo chokidar'da da tekrarlarsa (native modda) §9'daki geri dönüş planı (`usePolling`) aynı testle tekrar koşulup doğrulanır. |
| `tests/integration/projects-api.test.ts` | Entegrasyon, gerçek `createServer` + gerçek fs: AC1 (uçtan uca — proje ekle, `docs/features`'a `.md` yaz, `sse-client.ts` ile `features` çerçevesinin geldiğini event-driven ölç), AC2 (kaldır → `projects` çerçevesi güncel listeyi taşır, watcher durur — kaldırmadan sonra dosya değişikliği artık `features` yaymaz), AC3 (geçersiz yollarla `POST` → 400 `invalid_path` + Türkçe mesaj), AC4 (3 proje eşzamanlı, `GET /api/projects` 3 ayrı kayıt, bir projedeki değişikliğin yalnızca o projenin `project_id`'siyle sinyal ürettiği — izolasyon), AC5 (aynı `MC_DATA_DIR`'e karşı ikinci bir `createServer` — kayıtlar korunur **ve** yeni sunucu örneği eski kayıtlar için otomatik izlemeye başlar, dosya değişikliği yeni sunucuda da sinyal üretir), **dosya sistemi manifest testi** (§7 — ekle/izle/çıkar döngüsünden önce/sonra sahte proje ağacının `(yol,boyut,mtime,sha256)` manifestinin birebir aynı kaldığı, `data/events/**`'in de etkilenmediği), Host/Origin (yeni `POST`/`DELETE` uçlarının mevcut korumayı miras aldığı — regresyon **ve, QA Bulgu 13b, `GET /api/projects`'in de `isAllowedHost` çitine tabi olduğu** — `src/server/index.ts:235-240`'ın mevcut Host kontrolü tüm `/api/*` yollarını kapsıyor, yeni yolun bundan muaf olmadığı ayrıca assert edilir). |
| `tests/features/projects/web/SettingsScreen.test.tsx` | jsdom+RTL: boş durum, yükleniyor iskeleti, liste render (ad/yol/durum/feature sayısı), Kaldır tıklama → `fetch` çağrısı + optimistik olmayan state güncellemesi, hata durumu ("Liste kaydedilemedi"), **(QA Bulgu 8b)** `registry_corrupt:true` yanıtında UX'in birebir metniyle ("Proje listesi okunamadı, varsayılan boş liste ile başlandı.") banner göründüğü, alan yokken/`false`ken banner **hiç** render edilmediği. |
| `tests/features/projects/web/AddProjectForm.test.tsx` | jsdom+RTL: geçerli girişte `Ekle` sonrası input temizlenir; 400 yanıtında satır içi kırmızı hata görünür ve input odakta kalır (UX akış f). |
| `tests/e2e/settings.spec.ts` | Playwright: gerçek proje ekleme (geçici fixture klasörü) → satır 5 sn içinde görünür; geçersiz yol → kırmızı satır içi hata; kaldırma → satır kalkar + fixture'ın disk manifestinin değişmediği (Node `child_process` ile öncesi/sonrası hash karşılaştırması, testin kendi içinde); 3 proje ile Ayarlar tablosunun 3 ayrı satır gösterdiği; Ayarlar dişli düğmesine `click()` sonrası panellerin **gerçek hesaplanmış `display`** değerinin değiştiği (D18, §6) ve `aria-pressed`'in güncellendiği. |

### 2.2 Değişecek dosyalar

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `src/shared/types.ts` | `ProjectRecord` (mimari §5.2 şeması birebir: `id,path,label,added_at,enabled`) + `ProjectListItem extends ProjectRecord` (`exists: boolean; feature_count: number` — istemcinin hesaplamaması için sunucu ekler, §3 madde 5) eklenir. `ErrorCode` union'a `'invalid_path' \| 'conflict' \| 'not_found'` eklenir (F-002/F-003'ün kurduğu "yalnızca kullanılan alt küme" deseniyle tutarlı artımlı genişletme). | Yeni API yüzeyi bu tipleri gerektiriyor; dosya zaten paylaşılan/artımlı büyüyen bir dosya (F-002'nin kurduğu emsal). |
| `src/server/index.ts` | `createProjectsService(dataDir, hub)` bir kez kurulur (`store.init()`'ten hemen sonra); `GET/POST /api/projects` ve `DELETE /api/projects/:id` route'ları eklenir (basit `pathname.startsWith('/api/projects/')` string ayrıştırması — bu bir **dosya yolu** değil bir **URL segmenti**, §3.6'nın yol-regex yasağı dosya sistemi yollarını kapsar, URL yönlendirmesini değil, mevcut kodda da `pathname?.split('?')[0]` zaten aynı sınıf işlem). Host/Origin `Origin` kontrolü **genelleştirilir**: `req.method === 'POST' && pathname === '/api/events'` özel-durumu yerine `req.method !== 'GET'` (tüm `/api/*` yazma uçları) — mimari §10 "CSRF ... yazma uçlarında Origin" ile artık gerçekten tutarlı (F-002 zamanında tek yazma ucu olduğu için özel-durum yeterliydi). `server.on('close', ...)` içine `projectsService.stopAll()` eklenir (mevcut `stopRetention()` ile aynı bloğa). **(QA Bulgu 10)** `handleHealth`'in imzasına `getWatcherCount: () => number` eklenir (mimari §6.6'nın zaten şemasında duran ama şu ana kadar hiç doldurulmamış `watchers: n` alanı — diğer §6.6 alanları, `projects`/`events_total`/`ring_from`/`ring_to`/`degraded`, F-005'in kapsamı dışı, dokunulmuyor); `projectsService`'ten `getActiveWatcherCount()` bu değeri sağlar (her `watchProjectFeatures` çağrısında +1, her `stop()`'ta -1). **(ÖNEMLİ-2/YENİ-1 düzeltmesi)** Gözlem iki ayrı, uygulanabilir yoldan yapılır: (1) sunucu **ayaktayken** `projects-api.test.ts` N proje eklendikten sonra `GET /api/health`'in `watchers` alanının `=== N` olduğunu okur; (2) `stopAll()`'ın gerçekten çağrıldığı, `server.close()`'un `'close'` olayı beklendikten sonra `projectsService.getActiveWatcherCount()`'ın **doğrudan** (HTTP'siz) `0` döndüğü assert edilerek kanıtlanır — `server.close()` sonrası atılan bir HTTP isteği `ECONNREFUSED` alacağı için kapanış sonrası gözlem `/api/health` üzerinden **yapılamaz**, bu yüzden servis nesnesinin kendi sayacı doğrudan okunur. | Yeni yazma uçları + AC5 (açılışta otomatik izleme) + CSRF sınırının genelleşmesi (§3 madde 6, §7) + izleyici kapanışının gözlemlenebilirliği (§8 mutasyon 10). |
| `src/web/lib/useEventStream.ts` | Yeni opsiyonel `onProjects?: (records: ProjectListItem[]) => void` alanı `UseEventStreamOptions`'a eklenir; `'projects'` adlı SSE olayına `es.addEventListener('projects', handleProjects)` ile abone olunur (mevcut `'event'`/`'resync'` dinleyicileriyle aynı `useEffect` bloğunda, aynı temizleme). Mevcut davranış (Timeline) **değişmez** — `onProjects` verilmezse hiçbir şey olmaz. | ADR-004 madde 1 "tek bağlantı çok kanal" — Ayarlar ekranı **ikinci bir `EventSource` açmaz**, mevcut tek bağlantıyı paylaşır (F-003'ün kurduğu jenerik hub bunu zaten destekliyor, yalnızca istemci tarafı dinleyici eksikti). |
| `src/web/App.tsx` | CEO kararı (dosya sonu, "Ayarlar'ın yeri ve sekme deseninin ertelenmesi"): basit `activeScreen: 'timeline' \| 'settings'` `useState` (roving tabindex/ok tuşu soyutlaması **yok** — Karpathy §2, F-007'ye ertelendi). Zaman Çizelgesi mevcut `aria-current="page"` taşıyan statik `<span>` olarak **değişmeden** kalır (`src/web/App.tsx:28`); Kanban da statik `<span>` olarak **değişmeden** kalır. Ayarlar için yeni bir `<button type="button" aria-label="Ayarlar" aria-pressed={activeScreen==='settings'}>` eklenir. `<main>` içinde **iki** panel her zaman mount edilir (`TimelineScreen` ve `SettingsScreen`), yalnızca aktif olmayanın `hidden` özniteliği `true` (React `hidden` prop → DOM `hidden` attribute, `display:none` verir, **unmount ETMEZ** — F-003'ün mutasyon-kanıtlı "TimelineScreen hiç unmount olmaz" değişmezi korunur, bkz. §5/§8 mutasyon 12 emsali; D18 — bu görünmezliğin gerçekliği E2E'de doğrudan kanıtlanıyor, §6). `useEventStream(...,{onProjects:setProjectsUpdate})`; yeni state `projectsUpdate` `SettingsScreen`'e prop olarak geçer. | CEO kararı birebir: Ayarlar dişli düğmesi + panel `hidden` ile geçiş; F-003'ün "TimelineScreen asla unmount olmaz" garantisi bozulmadan ikinci gerçek ekran ekleniyor; tam `tablist` deseni F-007'ye ertelendi (§9 madde 8). |
| `tests/e2e/shell.spec.ts` | **(ÖNEMLİ-3/YENİ-2)** Ayarlar gerçek bir `<button>` olduğu için mevcut `header button, header a, header [role=button]` sayısının `0` olduğu iddiası (F-003 CEO kararı D8) **yapısal olarak KIRMIZI** olur; iddia güncellenir: üst çubukta **tam olarak bir** tıklanabilir öğe var — `aria-label="Ayarlar"` düğmesi. `header [role="tab"]` sayısının `0` kaldığı iddiası **korunur** (CEO kararıyla artık kalıcı olarak doğru — tam tablist F-007'ye ertelendi). | Ayarlar dişli düğmesi F-003'ün "üst çubukta tıklanabilir öğe yok" garantisini daraltıyor; bu dosyanın yeni garantiyi ("yalnızca Ayarlar tıklanabilir") kanıtlaması gerekiyor. |
| `src/web/index.css` | `@source "../features/events/web";` satırının altına `@source "../features/projects/web";` eklenir (aynı desen, F-003 B1 dersi — bkz. §1 madde 8). | Yeni `src/features/projects/web/**` kökü Vite'ın `root:'src/web'` tarama sınırının dışında; F-003'ün B1 bulgusunun aynısı önceden önlenir. |
| `tests/build-css.test.ts` | Ayarlar ekranına özgü, **yalnızca** `projects/web` içinde geçen 2-3 sınıf (ör. `AddProjectForm`'un kullanacağı bir sınıf) üretim CSS'inde arandığı yeni assert'ler eklenir (mevcut 5 assert değişmez). **(QA Bulgu 11)** Bu, F-003'te `bg-zinc-950`'nin başka yerde de geçtiği için tesadüfen yeşil kaldığı hatanın tekrarını önlemek için, seçilen sınıfların `src/web/**` ve `src/features/events/web/**` içinde **hiç geçmediği** testin kendisi tarafından programatik olarak doğrulanır (`fs.readFileSync` + `includes()` ile bu iki kökün kaynak dosyaları taranır) — "yalnızca `projects/web`'de geçer" bir niyet cümlesi değil, testin çalışma zamanında kontrol ettiği bir ön koşuldur; ön koşul sağlanmazsa test kendisi (yanlış sınıf seçimini bildirerek) başarısız olur. | §1 madde 8 — çitin gerçekten yeni dizini kapsadığının kanıtı (F-003'ün kendi dersini kendi çitinde de uygulamak). |
| `playwright.config.ts` | `testMatch: ['shell.spec.ts','timeline.spec.ts']` → `[...,'settings.spec.ts']`. | Yeni E2E dosyası `npm run e2e`'ye dahil olsun. |
| `package.json` | `dependencies`'e `"chokidar": "^4.0.3"` eklenir (kod turunda `npm install`, `package-lock.json` da güncellenir). | CEO kararı D16 — mimari §3.4'ün zaten onayladığı kapalı listedeki bağımlılığın fiilen eklenmesi; feature notunun (`docs/features/F-005-proje-kayit-izleme.md:22`) dosya sahipliği listesinde `package.json` açıkça yok ama yeni bağımlılık eklemek doğası gereği kök `package.json`'a dokunmayı gerektirir (F-001'in ilk bağımlılık kurulumunda da aynı gerekçeyle dokunulmuştu) — bu bir kapsam sızması değil, D16'nın doğal sonucu. |
| `tests/web/App.test.tsx` | Statik iddialar tek dallı güncellenir: Ayarlar artık gerçek bir `<button type="button" aria-label="Ayarlar" aria-pressed={...}>` (statik `<span>` değil), tıklanabilir; Zaman Çizelgesi `aria-current="page"` taşıyan statik `<span>` olarak **değişmeden** kalır (satır 28); Kanban statik `<span>` olarak **değişmeden** kalır. Hiçbiri `role="tab"`/`role="tablist"` taşımaz (tam tablist deseni F-007'ye ertelendi, §9 madde 8). Mevcut "üst çubukta tıklanabilir öğe yok" iddiası (F-003 CEO kararı D8) **artık kısmen yanlış** — bu satır kaldırılıp yerine "üst çubukta **tam olarak bir** tıklanabilir öğe var: Ayarlar düğmesi" ile değiştirilir. | Ayarlar dişli düğmesi F-003'ün "üst çubukta tıklanabilir öğe yok" garantisini daraltıyor; bu dosya yeni garantiyi (yalnızca Ayarlar tıklanabilir) kanıtlamalı. |
| `tests/web/App.interaction.test.tsx` | Yeni testler: Ayarlar düğmesine `click()` sonrası `TimelineScreen`'in DOM'dan kaldırılmadığı (`hidden` olduğu ama `unmount` olmadığı — önceden seçili bir filtrenin DOM'da kalıcı olduğu, F-003'ün orijinal assert'i **aynen korunur**, yalnızca artık gerçek bir tıklamayla tetiklenir), Ayarlar `aria-pressed`'in `click()` sonrası `true`/`false` arasında değiştiği, Kanban'a `click()` ile ulaşılamadığı (statik `<span>`, hiçbir olay dinleyicisi yok). | F-003'ün "unmount olmaz" iddiası artık gerçek bir kullanıcı etkileşimiyle (o zaman hiç yoktu) yeniden ve daha güçlü doğrulanıyor; tam klavye/ok tuşu gezinmesi F-007'ye ertelendi (§9 madde 8). |

**Dokunulmayan ama incelenen dosyalar:** `tests/no-external-host.test.ts` (✓ VERIFIED — `walk()`
zaten `src/features/**` ve `src/server/**`'i özyinelemeli tarıyor, yeni `projects/`+`watch/`
dizinleri otomatik kapsanıyor, dosya değişmiyor), `tests/deps.test.ts` (✓ VERIFIED bu turda `npm
view chokidar@4.0.3 scripts` ve `npm view readdirp@4.0.2 scripts` — ikisinde de `preinstall`/
`install`/`postinstall` anahtarı yok, yalnızca `lint`/`test`/`build`/`format`/`nyc`/`mocha`; yani
`hasInstallScript` `package-lock.json`'da `true` **yazılmayacak** ve mevcut `ALLOWED_INSTALL_
SCRIPT_PACKAGES` beyaz listesine chokidar/readdirp eklemek **gerekmeyecek** — guard testi kod
değişikliği gerektirmeden geçmeye devam eder; `fsevents` zaten `package-lock.json:3331`'de
vite/rollup'ın transitive bağımlılığı olarak duruyor, chokidar v4 zaten fsevents'e bağımlı değil
(§3 madde 1) — yeni bir darwin-only native paket kategorisi eklenmiyor), `tests/ci-workflow.test.ts` (yeni CI job'ı yok,
değişmiyor), `vite.config.ts` (kök/proxy değişmiyor), `tsconfig.json`/`eslint.config.js` (F-003'ün
zaten kurduğu `.tsx`/jsdom altyapısı yeterli, yeni bir ayar gerekmiyor).

---

## 3. Tasarım kararları

### 1) İzleme: `chokidar@^4.0.3` — CEO kararı D16, tur 1'in `node:fs.watch` kararı geri alındı

**Karar (D16, tur 2):** Tur 1'de "yeni bağımlılık eklenmiyor, `node:fs.watch` yeter" kararı
verilmişti. QA bu kararı **ölçerek** çürüttü (bkz. §"QA sözleşme incelemesi — tur 1", Bulgu 1/2,
"Ampirik ölçümler" 1): aynı Windows makinesinde, aynı `docs/features` dizininde,

- dizin **silinip yeniden oluşturulunca** `fs.watch`'ın izlediği tanıtıcı kalıcı olarak ölüyor —
  sonraki `.md` yazımı **0 olay** üretiyor, hata da yok. Bu bir `git checkout`/dal değişimi
  desenidir ve bu ürün tam olarak proje depolarını izlediği için senaryo günlük, teorik değil.
- dizin **silinip silinmiş kalırsa** `fs.watch` sınırsız olay fırtınası üretiyor: 1 sn'de 112.535,
  3 sn'de 342.548 ham olay, ~%21 çekirdek CPU'su, süresiz.

Yani mimari §3.4'ün chokidar için yazdığı özgün gerekçe ("`fs.watch` Windows ve macOS'ta farklı
davranır ve olay kaçırır") — tur 1'in "ADR-009 Windows-only olduğu için bu kazanç sıfırlanır,
Node'un Windows implementasyonu zaten stabildir" itirazının aksine — **bu iki senaryoda haklı
çıktı**. Kod bunları kendimiz yeniden yazmak (üst dizini de izleyip yeniden oluşmayı yakalamak,
kendi olay-sayacı/`close()` mantığımızı kurmak) `chokidar`'ın zaten yaptığı ve ekosistemde yıllardır
sınanmış işi kötü kopyalamak olurdu — Karpathy §2 "gereksiz soyutlama" yasağı burada tam tersi
yönde çalışıyor: **ölçülmüş bir gereksinimi karşılayan bağımlılık gereksiz değildir.**
`docs/features/F-005-proje-kayit-izleme.md:3` başlığının zaten "chokidar izleme" demesi ve mimari
§3.4/§4/§6.1'in chokidar'ı önceden onaylamış olması bu geri dönüşü destekliyor.

**Veri (tur 1'de + bu turda `npm view` ile gerçek registry'den, ✓ VERIFIED):**

| Kontrol | Sonuç |
|---|---|
| `chokidar` mevcut sürümler | `4.0.0`, `4.0.1`, `4.0.2`, `4.0.3`, `5.0.0` |
| `chokidar@4.0.3` bağımlılıkları | Yalnızca `readdirp: ^4.0.1` — `fsevents` **yok** (v4 macOS native izlemeyi bıraktı, saf JS) |
| `chokidar@4.0.3` `engines.node` | `>= 14.16.0` — projenin `>=20.11` tabanıyla (`package.json:7`) çelişmiyor |
| `chokidar@4.0.3` `scripts` (tur 2'de yeniden doğrulandı) | `{lint, test, build, format}` — `preinstall`/`install`/`postinstall` **yok** → `hasInstallScript` `package-lock.json`'da `true` yazılmayacak |
| `readdirp@4.0.2` `scripts` (tur 2'de yeniden doğrulandı) | `{nyc, lint, test, build, mocha, format}` — `preinstall`/`install`/`postinstall` **yok** |
| `readdirp@4.0.2` `engines.node` | `>= 14.16.0` |
| `chokidar@5.0.0` (bilgi, **seçilmedi**) | `readdirp: ^5.0.0`, `engines.node: >= 20.19.0` — projenin `>=20.11` tabanıyla **çelişir** (bazı CI/geliştirici makineleri 20.11-20.18 aralığında olabilir), sürüm sabitlemesi bu yüzden `^4.0.3`'te kalıyor, `^5` değil |
| `fsevents` (mevcut lock, `package-lock.json:3331`) | Zaten vite/rollup'ın transitive bağımlılığı olarak var, `optional:true`+`os:['darwin']` — chokidar v4 buna hiç bağımlı değil, yeni bir native-paket kategorisi eklenmiyor |

Sonuç: chokidar/readdirp native derleme gerektirmiyor (S2/ADR-003 ile çakışmaz), `tests/deps.
test.ts` guard'ı kod değişikliği gerektirmeden geçmeye devam eder (bkz. §2.1/§2.2 tabloları).

**Recursive gerekmiyor:** `docs/features` mimari §5.3'ün varsaydığı gibi düz bir dizindir
(`FeatureCard.file` "yalnızca dosya adı"). `chokidar.watch(dir, { depth: 0 })` tek bir dizini
izler, alt dizinlere (varsa) inmez.

**Kod turunda ampirik doğrulanacak, sözleşmede yalnızca planlanan iki senaryo (D16'nın açık
talimatı — "chokidar'ı da varsayma"):**

1. **Dizin sil + yeniden oluştur → olaylar geri geliyor mu?** chokidar'ın belgelenen davranışı,
   henüz var olmayan bir yolu izlemeye alabilmesi ve yol belirdiğinde otomatik yakalamasıdır
   (bu, `fs.watch`'ın tam tersi — QA'nın ölçtüğü kalıcı ölüm burada beklenmiyor) ama bu proje
   Windows'ta gerçek chokidar 4.0.3 ile **hiç ölçülmedi**; varsayım değil, `project-watcher.
   test.ts`'e eklenen yeni vaka bunu ölçecek (bkz. §2.1 tablosu).
2. **Dizin silinip silinmiş kalırsa CPU/olay fırtınası oluşuyor mu?** chokidar'ın native modda
   (Windows'ta `fs.watch` üzerine kurulu) QA'nın gözlemlediği aynı alt-katman kusurunu miras alma
   ihtimali var — bu da ölçülecek (aynı test dosyası, "ölçmeyen assert" değil sayısal üst sınır).

**Başarısız olursa geri dönüş planı:** İki senaryodan biri chokidar'da da (native modda) tekrar
ederse, mimari §3.5'in zaten tanımladığı `MC_WATCH_POLLING=1` anahtarı (`usePolling: true`)
devreye alınır — bu env değişkeni zaten var, yeni bir konfigürasyon yüzeyi eklenmiyor. Polling
modunda aynı iki test tekrar koşulup doğrulanır. Bu ikinci geri dönüş de başarısız olursa (ki
chokidar'ın kendi test paketi/topluluk kullanımı bu senaryoları yıllardır kapsıyor, düşük
olasılık) sonraki adım CEO'ya bildirilecek yeni bir bloklayıcı sorudur — bu sözleşme o noktayı
varsaymıyor.

**ADR-012 taslağı** (kalıcı ADR'ye çevrilmesi CEO'nun kararı, bkz. §6 sonu).

### 2) Debounce: 150 ms trailing, mimari §6.1'in kendi sayısıyla birebir

Mimari §6.1 "features" SSE kanalı için zaten "debounce 150 ms" diyor — D16 sonrası bu artık
chokidar'ın **kendi bağlamında** yazılmış orijinal karar. chokidar'ın `awaitWriteFinish`'i
(stabilityThreshold 200 ms) yarım yazılmış dosyaları filtreler ama editörlerin "geçici dosya +
rename" deseni yine de tek bir mantıksal kaydetmeyi birden çok `add`/`change`/`unlink` olayına
bölebilir — `project-watcher.ts`'in kendi 150 ms trailing debounce'u (her `trigger()` bekleyen
zamanlayıcıyı sıfırlar) bunları tek bir `onChange` çağrısına toplar; bu, chokidar'ın kendi
`awaitWriteFinish`'inin **üstüne binen** ikinci, ucuz bir katman (iki farklı sorunu çözüyorlar:
biri "dosya hâlâ yazılıyor mu", diğeri "aynı mantıksal değişiklik kaç olay üretti"). Sayı sabit,
env ile ayarlanamaz (hiçbir AC bunu istemiyor, Karpathy §2).

### 3) `features` SSE kanalı: F-005 yalnızca sinyal üretir, `cards` alanı YOK

Mimari §6.1 API tablosu `features` kanalının gövdesini `{ project_id, cards: FeatureCard[] }`
olarak yazıyor. `FeatureCard` türetimi (`frontmatter` ayrıştırma) mimari §4'te açıkça
`features/kanban/server`'a atanmış — F-005'in dosya sahipliği bunu **kapsamıyor**. Bu yüzden
F-005'in ürettiği `features` çerçevesinin gövdesi bu turda yalnızca **`{ project_id: string }`**
olur (`cards` alanı **yok**). F-003'ün kurduğu hub zaten jenerik (`broadcast(name, data, id?)`,
`data: unknown`) — bu, mimarinin kendi sözünü tuttuğu tasarım (§3 F-003 madde 1: "F-005/F-007
kendi olaylarını ürettiğinde yalnızca `hub.broadcast(...)` çağıracaklar"). F-007 bu sinyali alınca
kendi `GET /api/features?project_id=...`'ini çağırıp kartları getirecek — push-then-refetch deseni
(zaten `resync`/`gates` kanallarının da örtük varsayımı). Bu, mimarinin literal alan şemasından
küçük bir sapmadır; CEO'ya bilgi notu olarak §9'da işaretlendi (bloklayıcı değil — hiçbir tüketici
şu an bu alanı okumuyor).

`projects` kanalının gövdesi mimariyle **birebir**: `ProjectListItem[]` (tam liste, F-005'in
kendi sorumluluğu, sapma yok).

### 4) Kayıt defteri: kanonikleştirme `fs.realpathSync.native` ile — ayrı bir `pathsEqual` yok (CEO kararı D17)

**Tur 1'in hatası (QA Bulgu 3, ölçüldü):** `fs.realpathSync` (native olmayan, saf-JS sürüm)
Windows'ta büyük/küçük harfi **kanonikleştirmiyor** — girdinin yazımını olduğu gibi koruyor. Aynı
gerçek dizine 6 farklı yazımla çağrıldığında `realpathSync` **3 farklı dizge** üretti
(`...\MyProject`, `...\myproject`, `...\MYPROJECT`); yalnızca `fs.realpathSync.native()` altısını
da **tek** kanonik dizgeye (`...\MyProject`, dizinin NTFS'te oluşturulduğu hâl) indirdi. Tur 1'in
"`realpathSync` kanonik harfe çözer" iddiası bu yüzden yanlıştı ve düz dizge eşitliğiyle
tekilleştirme kararı §7 vaka 13'ü (farklı harf büyüklüğü → 409) KIRMIZI verdirirdi. Mimari §5.2
zaten bunu açıkça yasaklıyor: "`path` alanı JSON'da Windows ayracı ile durur; karşılaştırma her
zaman `path` API'siyle yapılır, dizge eşitliğiyle değil" — `.native` olmayan `realpathSync` bu
sözü tutmuyordu.

**Karar (D17):** Kanonik tanımlayıcı tek bir çağrıya indirgenir: **`fs.realpathSync.native(p)`**.
`validate-path.ts`'in §3 madde 7 adım 7'sinde ve kayıt defterinin `add()`/`findByRealPath()`
içindeki tekilleştirme kontrolünde **yalnızca** bu fonksiyon kullanılır (`fs.realpathSync` — `.
native` olmadan — hiçbir yerde çağrılmaz). Tekilleştirme kontrolü yine basit dizge eşitliğidir
(`existing.path === newRealPath`), özel bir `pathsEqual`/karşılaştırma fonksiyonu **yazılmıyor**
(Karpathy §2 — `.native` zaten kanonikleştirmeyi ücretsiz verdiği için ek soyutlamaya gerek yok).

**`.native` bulunmadığı/başarısız olduğu durum:** Node.js'te `fs.realpathSync.native` işlevi
`fs.realpathSync`'in kendisiyle **aynı modülde, her zaman tanımlı bir alt-özelliktir** (ayrı bir
opsiyonel bağımlılık değil, Node'un `fs` modülünün native binding'i) — projenin desteklediği
`>=20.11` taban sürümünde bu fonksiyonun **yokluğu** beklenmez, bu yüzden "yoksa" dalı için ayrı
bir kod yolu **yazılmıyor** (var olmayan bir senaryo için savunma Karpathy §2 ihlali olurdu).
`.native()` **çağrısı** başarısız olursa (ör. dosya `existsSync`/`statSync` kontrolünden sonra ama
`realpathSync.native` çağrılmadan önce harici bir aktör tarafından silinirse — bir yarış durumu,
`ENOENT` fırlatır) davranış değişmiyor: bu, `validate-path.ts`'in zaten sardığı senkron `fs`
çağrılarından biri olarak aynı üst seviye hata işleyicisine düşer (§3 madde 7'nin mevcut adım
sırası — 7. adımda bir istisna, `resolveProjectPath`'in çağıranına (handler) fırlar, handler genel
`500`/loglama yoluna düşer; bu davranış zaten mevcut `realpathSync` çağrısı için de aynıydı, `.
native`'e geçiş bunu değiştirmiyor).

Bu varsayım `validate-path.test.ts`'te ampirik olarak doğrulanır: aynı geçici dizine altı farklı
yazımla (oluşturulduğu hâl, tümü küçük harf, tümü BÜYÜK harf, `/` ayraçlı, sondaki ayraçlı, `docs\
..` içeren) `fs.realpathSync.native()` çağrılıp **hepsinin birebir aynı dizgeyle** sonuçlandığı
assert edilir (✓ VERIFIED bu turda ölçüldü — §"Ampirik ölçümler" 2, farklı sonuç sayısı `.native`
ile **1**, `.native` olmadan **3**).

### 5) `ProjectListItem`: `exists`/`feature_count` sunucu tarafında hesaplanır, saklanmaz

UX ekran-3 "N feature" sütunu ve "⚠ yol bulunamadı" durumunu istiyor. Bunlar **kalıcı** alanlar
değil (mimari §5.2'nin `ProjectRecord` şeması bunları içermiyor) — her `GET /api/projects`
çağrısında (ve her `service` mutasyonundan sonraki `broadcast`'te) canlı hesaplanır:
`exists = fs.existsSync(record.path)`, `feature_count = exists ? docs/features altındaki
*.md sayısı (fs.readdirSync + path.extname filtresi) : 0`. Bu, `FeatureCard` türetimi
**DEĞİLDİR** — yalnızca bir dosya sayımı, frontmatter okunmaz/ayrıştırılmaz, F-007'nin alanına
girmez. Ucuz (bir `readdirSync`), her istek için kabul edilebilir (kayıt defteri küçük, saniyede
onlarca istek beklenmiyor).

### 6) Ayarlar geçişi: basit state, `hidden` özniteliğiyle unmount'suz panel gizleme (tam `tablist` F-007'ye ertelendi)

CEO kararı (dosya sonu, "Ayarlar'ın yeri ve sekme deseninin ertelenmesi") Ayarlar'ı UX'in tarif
ettiği sağda sabit dişli düğmesi yapıyor, tablist'in dışında tutuyor (`docs/03-ux.md:21`). F-005
bittiğinde sekme çubuğunda hâlâ tek gerçek ekran (Zaman Çizelgesi) var — Kanban F-007'de geliyor —
bu yüzden `role="tablist"`/`tab`/`tabpanel`/roving tabindex/ok tuşu deseni **bu feature'da
kurulmaz**: bugün olmayan bir şey için desen kurmak F-003 CEO kararı D8'in reddettiği durumun
aynısıdır (Karpathy §2). `App.tsx` tek bir `activeScreen: 'timeline' | 'settings'` `useState` ile
ekran geçişini yönetir; Ayarlar düğmesinin `onClick`'i bunu değiştirir. Zaman Çizelgesi
`aria-current="page"` taşımaya devam eder (F-003'teki gibi, değişmiyor, `role="tab"` taşımaz).
Kanban statik kalır (değişmiyor), hiçbir olay dinleyicisi yok — F-001'in "iş yapmayan buton"
yasağına girmez (zaten hiçbir buton/dinleyici değil, dürüstçe devre dışı bir öğe). Panel geçişi
yine DOM'dan kaldırma değil `hidden` özniteliği değişimidir — pahalı bir yeniden-mount maliyeti
zaten yok, F-003'ün "TimelineScreen hiç unmount olmaz" garantisiyle çakışmaz.

**`hidden` özniteliğinin panelini gerçekten görünmez yaptığının kanıtı (CEO kararı D18):** Tur
1'in "`hidden` unmount'suz gizleme yapar, TimelineScreen'in F-003 değişmezi korunur" tasarımı
doğru ama sözleşme bunun **gerçekten görünmez** kaldığını hiç kanıtlamıyordu (mutasyon 8 yalnızca
ters yönü — koşullu render'a geçince state kaybı — ölçüyordu; jsdom CSS yüklemediği için
`App.interaction.test.tsx` de yalnızca `hidden` **özniteliğinin varlığını** ölçebilir, gerçek
`display` değerini değil).

- **Dayanak (bu turda dosya okunarak doğrulandı, ✓ VERIFIED):** `node_modules/tailwindcss/
  preflight.css:396` — `[hidden]:where(:not([hidden='until-found'])) { display: none !important;
  }` (yüklü sürüm `tailwindcss@4.3.3`, `package.json:46`'daki `^4` aralığı içinde). `!important`
  sayesinde `SettingsScreen`/`TimelineScreen` kapsayıcılarının kullanabileceği `flex`/`block`
  yardımcı sınıfları bu kuralı **ezemez** — React'ın `hidden` prop'undan gelen DOM `hidden`
  özniteliği, hangi Tailwind yardımcı sınıfı eklenirse eklensin panel için `display:none` üretir.
- **Kanıt (kod turunda eklenecek, E2E, gerçek tarayıcı):** `tests/e2e/settings.spec.ts`'e, aktif
  olmayan ekranın panelinin **gerçek hesaplanmış `display` değeri** `'none'` olduğu assert edilir
  (`page.locator('#panel-settings').evaluate(el => getComputedStyle(el).display)` → Zaman
  Çizelgesi aktifken `'none'`; aynısı Ayarlar aktifken `#panel-timeline` için) — Playwright gerçek
  yapılandırılmış CSS ile çalışır (`playwright.config.ts:19` `npm run build && npm start`), jsdom
  gibi kör değildir. Yalnızca `hidden` özniteliğinin DOM'da var olduğunu (jsdom) değil, tarayıcının
  onu **görünmez render ettiğini** doğrudan ölçer.
- **Mutasyon (§8'e madde 8b olarak eklendi):** `App.tsx`'te pasif panelin `hidden={...}` ifadesi
  sabit `hidden={false}`'a değiştirilir → yukarıdaki E2E `display` assert'i KIRMIZI vermeli (her
  iki panel de aynı anda görünür kalır).

### 7) Yol doğrulama: `node:path` + senkron `fs`, elle regex yok

`resolveProjectPath` sırası: (1) `typeof input === 'string'` + `trim()` boş değil → değilse
`invalid_body` (yapısal, `invalid_path` değil); (2) `path.resolve(trimmed)` (mutlak yola çevirir,
`..` çözülür); (3) kök mü kontrolü — `path.parse(resolved).root === resolved` → `invalid_path`
("Sürücü kökü izlenemez."); (4) UNC mü — `path.parse(resolved).root` `\\` ile başlıyor mu (bir
regex değil, `path.parse`'ın döndürdüğü **izole kök tokenı** üzerinde `startsWith` — mimari
§3.6'nın yasakladığı "elle yol regex/replace" bu değil, o tüm yol dizgesi üzerinde manipülasyonu
kapsıyor) → `invalid_path` ("Ağ/UNC yolları desteklenmiyor."); (5) `fs.existsSync(resolved)` →
yoksa `invalid_path` ("Bu yol bulunamadı."); (6) `fs.statSync(resolved).isDirectory()` → değilse
`invalid_path` ("Bu bir klasör değil."); (7) `fs.realpathSync.native(resolved)` (symlink çöz,
kanonik büyük/küçük harf — **D17**, `.native` olmadan çağrılan `realpathSync` Windows'ta
kanonikleştirmez, bkz. §3 madde 4); (8) `path.join(real, 'docs', 'features')` var mı + dizin mi → yoksa `invalid_path`
("Bu klasörde docs/features bulunamadı. Yolu kontrol edin." — UX doc'un **birebir** metni, AC3);
(9) `ok: true, path: real`. Tekilleştirme (§3 madde 4) `service.ts`'te bu adımdan SONRA, registry
seviyesinde yapılır (`conflict`, 409) — `validate-path.ts` registry'yi bilmez (saf kalması için).

### 8) HTTP: basit string tabanlı yönlendirme, yeni router kütüphanesi yok

Mimari §3.2'nin "≈50 satırlık router" bütçesi zaten `index.ts`'te canlı; üç yeni satır
(`GET`/`POST /api/projects`, `DELETE /api/projects/:id` — `id` `pathname.slice('/api/projects/'.
length)` ile ayrıştırılır, boşsa/`/` içeriyorsa 404) eklemek bütçeyi aşmıyor. Yeni bir
`URLPattern`/router paketi **eklenmiyor**.

### 9) Origin koruması artık tüm yazma metodlarına uygulanıyor (F-006'ya hazırlık değil, bugünün ihtiyacı)

Mevcut kod `Origin` kontrolünü yalnızca `POST /api/events`'e özel yazmış (tek yazma ucu olduğu
için, F-002 döneminde yeterliydi). F-005 ikinci ve üçüncü yazma ucunu (`POST`/`DELETE
/api/projects`) eklediği an bu özel-durum kodu **sessizce delinir** — CLAUDE.md'nin "kod kazası"
tehdit modeli (ADR-005) tam olarak bunu tarif ediyor. Düzeltme mimari §10'un zaten yazdığı genel
kuralı (`GET` dışındaki `/api/*` uçlarında `Origin` kontrolü) uyguluyor; bu bir kapsam genişlemesi
değil, mevcut bir mimari taahhüdün eksik uygulamasının tamamlanması.

### 10) `useEventStream` genişlemesi tek yönlü ve geriye dönük uyumlu

`onProjects` verilmezse (Timeline'ın kendi kullanımı) davranış birebir korunur — yeni `if
(options.onProjects)` dalı yalnızca sağlanmışsa dinleyici ekler. F-003'ün 27 dosya/326 testlik
mevcut süiti bu değişiklikten etkilenmemeli (regresyon: mevcut `useEventStream.test.ts` aynen
geçmeli, hiçbir assert'i değiştirilmiyor).

---

## 4. API + kayıt defteri sözleşmesi

### 4.1 `data/projects.json` şeması (mimari §5.2 ile birebir)

```jsonc
{
  "version": 1,
  "projects": [
    { "id": "p_9f31c2", "path": "C:\\dev\\apps\\mission-control", "label": "mission-control",
      "added_at": "2026-09-05T10:00:00.000Z", "enabled": true }
  ]
}
```

- `id`: `p_` + `crypto.randomBytes(3).toString('hex')` (jsonl-store'un `randomHex` deseniyle
  aynı stil, ayrı bir yerel kopya — paylaşılan util yok, F-004 emsaliyle tutarlı).
- `label`: verilmezse `path.basename(realPath)`.
- `enabled`: her zaman `true` (§1 kapsam dışı — hiçbir yol bunu `false` yapmıyor bu turda).
- Dosya yoksa `init()` `{version:1,projects:[]}` ile başlar (yazmaz, yalnızca bellek). Bozuk JSON
  → `process.stderr`'e Türkçe log + boş liste ile başla (jsonl-store'un bozuk-satır toleransı
  felsefesiyle tutarlı — kayıt defteri kaybolursa çökmek yerine boş listeyle devam, kullanıcı
  projelerini yeniden ekler).
- Yazma: tmp (`.${base}.${pid}-${rand}.tmp`) + `fs.writeFileSync` + `fs.renameSync` (ADR-003
  karar 6). `fsync` **atlanır** (bu, F-002'nin JSONL append'inde de yapılmayan bir seçim; kayıt
  defteri küçük ve nadiren yazılır, ekstra fsync maliyeti hiçbir ACın istemediği bir garanti
  ekler — Karpathy §2).

### 4.2 `ProjectListItem` (wire tipi, `src/shared/types.ts`)

```ts
interface ProjectRecord { id: string; path: string; label: string; added_at: string; enabled: boolean }
interface ProjectListItem extends ProjectRecord { exists: boolean; feature_count: number }
```

### 4.3 Uç noktalar

| Method | Yol | Gövde | Yanıt | Hatalar |
|---|---|---|---|---|
| GET | `/api/projects` | — | `200 { success:true, data: ProjectListItem[], registry_corrupt?: true }` (QA Bulgu 8b — `registry_corrupt` yalnızca kayıt defteri bozuk başladıysa var, normalde alan hiç yok) | — |
| POST | `/api/projects` | `{ path: string, label?: string }` | `201 { success:true, data: ProjectListItem }` | `400 invalid_body` (path yok/string değil/boş), `400 invalid_path` (§3 madde 7 tablosu), `409 conflict` ("Bu proje zaten izleniyor.") |
| DELETE | `/api/projects/:id` | — | `200 { success:true, data:{removed:true} }` | `404 not_found` |

Her ikisi de (`POST`/`DELETE`) `Origin` kontrolüne tabi (§3 madde 9). `GET` tabi değil (mimari
§10 ile tutarlı — okuma uçları `Origin` yokluğunu kabul eder).

### 4.4 SSE

| `event:` | `data:` | Ne zaman |
|---|---|---|
| `projects` | `ProjectListItem[]` (tam liste) | Ekleme/çıkarma sonrası |
| `features` | `{ project_id: string }` (§3 madde 3 — `cards` yok) | İlgili projenin `docs/features`'ı değişti, 150 ms debounce sonrası |

---

## 5. AC → test eşlemesi

| AC | Katman | Neden bu katman | Test dosyası |
|---|---|---|---|
| AC1 — `docs/features` değişikliği 5 sn içinde görünür | Birim (`debounce.test.ts`) + Entegrasyon (gerçek fs + gerçek `chokidar` + gerçek SSE) | **Gözlemlenebilir sınır burada "kanban" değil "features SSE sinyali"dir** — Kanban (F-007) henüz yok, bu yüzden AC1'in "kanbanda görünür" ifadesinin bu feature'daki karşılığı, F-007'nin tüketeceği sinyalin kendisinin 5 sn'nin çok altında (event-driven, debounce dahil ~150-300 ms) üretildiğinin kanıtlanmasıdır. Tam "kanbanda görünür" iddiası F-007 kendi AC1'ini yazdığında yeniden ve tam olarak doğrulanacak (bu, F-003'ün "hello sadece bilgi taşır" gibi katmanlı doğrulama emsaliyle tutarlı bir ara-katman kanıtıdır, kaçırma değil). | `tests/server/watch/debounce.test.ts`, `tests/server/watch/project-watcher.test.ts`, `tests/integration/projects-api.test.ts` |
| AC2 — kaldırma 5 sn içinde arayüzden kalkar, disk değişmez | Entegrasyon (registry+watcher+SSE) + Dosya sistemi manifest testi + E2E (Ayarlar ekranı gerçek DOM) | "Disk değişmez" iddiası yalnızca gerçek dosya sistemi manifestiyle kanıtlanabilir (mock bunu ölçmez — `docs/HANDOFF.md`'nin "yeşil ama hiçbir şey ölçmeyen test" dersi); "arayüzden kalkar" gerçek DOM'da (E2E) ve SSE mesaj içeriğinde (entegrasyon) ayrı ayrı doğrulanır. | `tests/integration/projects-api.test.ts`, `tests/e2e/settings.spec.ts` |
| AC3 — geçersiz yol reddedilir, okunabilir hata | Birim (`validate-path.test.ts`, ~20 vaka) + Entegrasyon (birkaç temsili vaka gerçek HTTP üzerinden) + E2E (Ayarlar formu satır içi hata) | Doğrulama mantığı saf/deterministik (birim ucuz); entegrasyon sunucunun gerçekten 400 döndürdüğünü kanıtlar; E2E kullanıcının GERÇEKTEN gördüğü metni kanıtlar (`innerText()`, CLAUDE.md "uppercase" dersiyle aynı sınıf dikkat — bu ekranda `uppercase` kullanılmıyor zaten, ama render edilen metin her zaman `innerText()` ile okunur). | `tests/features/projects/server/validate-path.test.ts`, `tests/integration/projects-api.test.ts`, `tests/e2e/settings.spec.ts` |
| AC4 — ≥3 proje eşzamanlı, ayırt edilebilir | Entegrasyon (registry + watcher izolasyonu) + E2E (Ayarlar tablosu 3 satır) | **Olaylar tarafı zaten F-005'ten bağımsız karşılanıyor** (§1 kapsam dışı notu — `project_name` F-002'den beri her zaman dolu, Zaman Çizelgesi zaten proje adına göre renklendiriyor, F-003'ün `projectColor.ts`'i regresyonsuz). F-005'in kendi payı: kayıt defterinin 3 ayrı kayıt döndürmesi VE izleyicinin proje-A'daki değişikliği proje-B/C'ye sızdırmaması (izolasyon, entegrasyon testiyle doğrudan ölçülür — üç ayrı geçici dizin, üçüne de watcher bağlanır, yalnızca birine yazılır, yalnızca o `project_id`'nin sinyal ürettiği assert edilir). Kanban tarafı (kartların da ayırt edilmesi) F-007'ye ait. | `tests/integration/projects-api.test.ts`, `tests/e2e/settings.spec.ts` |
| AC5 — kayıt defteri kalıcı, restart sonrası devam | Entegrasyon (aynı `MC_DATA_DIR`'e karşı iki ardışık `createServer()`) | Gerçek süreç restart'ı (F-003'ün AC5 E2E'si gibi `child_process` kill/spawn) bu AC için gereksiz maliyet — kalıcılık iddiası disk dosyasının kendisiyle ilgili, süreç ölümüyle değil; iki ayrı `createServer()` çağrısı aynı sonucu çok daha ucuza kanıtlar (F-002'nin kendi AC6'sının test deseniyle aynı). "Otomatik yeniden izleme" kısmı da bu ikinci sunucu örneğinde bir dosya değişikliği tetikleyip `features` sinyalinin YENİDEN EKLEME OLMADAN geldiğini göstererek kanıtlanır. | `tests/integration/projects-api.test.ts` |
| Ayarlar geçişi (CEO kararı, dosya sonu — dişli düğmesi; tam `tablist` F-007'ye ertelendi, §9 madde 8) | Bileşen (`App.test.tsx`/`App.interaction.test.tsx`) + E2E (`settings.spec.ts`, gerçek tıklama + gerçek hesaplanmış `display`) | Dişli düğmesinin `onClick`'i ve `aria-pressed` durumu saf state değişimi, jsdom'da tam test edilebilir; E2E yalnızca gerçek tarayıcı CSS'inin `hidden` özniteliğini gerçekten görünmez render ettiğini (D18) bir kez doğrular. | `tests/web/App.test.tsx`, `tests/web/App.interaction.test.tsx`, `tests/e2e/settings.spec.ts` |

**En tartışmalı katman seçimi:** AC1'in "kanbanda görünür" ifadesini bu feature'da tam olarak
test edememek (Kanban yok). Alternatif olarak F-005'e minimal bir "kart sayısı" görselleştirmesi
eklenip AC1'i orada "kapatmak" düşünüldü ama bu, F-007'nin dosya sahipliğine (`FeatureCard`
türetimi) girer ve iki feature'ın aynı işi iki kez yapmasına yol açardı — reddedildi. Seçilen
yaklaşım (sinyal katmanını kanıtlamak, tam görselleştirmeyi F-007'ye bırakmak) F-003'ün kendi
"features/projects/gates kanallarının gerçek üreticisi yok" kararıyla simetriktir.

---

## 6. Ayarlar ekranı + sekme deseni

### Ayarlar ekranı (UX ekran-3 birebir)

```
İzlenen Projeler                                            [+ Proje ekle]
┌─────────────────────────────────────────────────────────────────────┐
│ ● app-factory      C:\dev\app-factory              12 feature [Kaldır]│
│ ● mission-control  C:\dev\apps\mission-control       4 feature [Kaldır]│
│ ⚠ eski-proje       C:\dev\apps\eski (bulunamadı)              [Kaldır]│
└─────────────────────────────────────────────────────────────────────┘
Yeni proje yolu: [______________________________]  [Ekle]
⚠ Bu klasörde docs/features bulunamadı.

Depo bilgisi: olaylar son 30 gün veya 20.000 olay saklanır (sunucu ayarı).
```

**(QA Bulgu 8a)** Bilgi satırı (`docs/03-ux.md:137`, salt bilgi, ayarlanamaz) yukarıdaki
wireframe'e eklendi — tur 1'de sessizce düşmüştü. `SettingsScreen.tsx` bu satırı sabit metin
olarak render eder (API'den gelmez, retention env değerleri `/api/health`'te zaten var ama bu
satır F-005'in kapsamında yalnızca statik Türkçe metin, sayısal değerleri dinamikleştirmek
hiçbir AC istemiyor).

Durum tasarımı (UX "Durum tasarımı" tablosu, Ayarlar satırı, birebir):
- Boş: "Henüz izlenen proje yok. Başlamak için bir App Factory proje klasörü ekleyin."
- Yükleniyor: liste iskeleti (2-3 gri satır, pulse).
- Hata: "Liste kaydedilemedi, tekrar deneyin." (satır üstü banner, `[Tekrar dene]`).
- **(QA Bulgu 8b)** Bozuk kayıt defteri: `docs/03-ux.md:289`'un "Proje listesi okunamadı,
  varsayılan boş liste ile başlandı." metni — tur 1'de yalnızca `stderr`'e loglanıp kullanıcıya
  hiç taşınmıyordu (kullanıcı projelerini sessizce kaybediyordu). Düzeltme: `registry.init()`
  bozuk JSON'da boş listeyle başladığında bir `corrupt: boolean` bayrağı bellekte tutar;
  `GET /api/projects` yanıtı `{ success:true, data: ProjectListItem[], registry_corrupt?: true }`
  olur (`registry_corrupt` yalnızca `true` olduğunda eklenir, normal durumda alan hiç yok — §4.2
  güncellendi); `SettingsScreen` bunu görürse listenin üstünde turuncu bir banner ile UX'in
  birebir metnini gösterir. Bayrak yalnızca **süreç ömrü boyunca** bir kez `true` olabilir (sonraki
  başarılı `add`/`remove` yazımı onu sıfırlamaz — kullanıcı geçmiş kaybını bir kez görüp anlamalı,
  gizlenmemeli; env/config yok, hiçbir AC bunun ayarlanabilir olmasını istemiyor).
- `exists:false` satırı: `⚠ yol bulunamadı` (turuncu, `AlertTriangle` ikonu — mevcut
  `src/features/events/web/icons.tsx`'ten import edilir, **kopyalanmaz** — `src/features/
  projects/web/**`'ten `../../events/web/icons` importu mimari §4 kuralını ihlal eder mi?
  Kural "`features/<x>/server/**` içinden `features/<y>/**` import edilmez" diyor — bu bir
  **web/web** importu, kural yalnızca server-server'ı yasaklıyor gibi okunabilir ama ruhu
  "dikey dilim izolasyonu"dur. Güvenli taraf: `AlertTriangle`'ı `src/web/lib/icons.tsx`'e
  taşımak F-003'ün dosyasına dokunmak demek olurdu (gereksiz genişletme). Karar: ikon **burada
  tekrar tanımlanır** (3 satırlık inline SVG, F-003'ün zaten yaptığı "Lucide'den elle al" deseni
  tekrarlanır, paylaşılan bir `src/web/ui/icons.tsx` **oluşturulmaz** — henüz yalnızca 2 feature
  aynı ikona ihtiyaç duyuyor, 3. ihtiyaç doğduğunda ortak dosyaya taşınması daha ucuz bir karar
  olur, şimdiden soyutlamak Karpathy §2 ihlali).

### Ayarlar geçişi (App.tsx) — dişli düğmesi, tam `tablist` deseni F-007'ye ertelendi

CEO kararı (dosya sonu, "Ayarlar'ın yeri ve sekme deseninin ertelenmesi") §9 madde 0'ın sorusunu
kapattı: UX'in tarif ettiği seçenek — Ayarlar sağda sabit bir dişli düğmesi, sekme çubuğunun
**dışında** (`docs/03-ux.md:21`). F-005 bittiğinde sekme çubuğunda hâlâ tek gerçek ekran (Zaman
Çizelgesi) var — Kanban F-007'de geliyor — bu yüzden gerçek `tablist`/`tab`/`tabpanel`/roving
tabindex/ok tuşu deseni **bu feature'da kurulmaz** (F-003 CEO kararı D8'in reddettiği "bugün
olmayan bir şey için desen kurma" durumunun aynısı, Karpathy §2). Tam desen F-007'nin işi (§9
madde 8).

```html
<nav>
  <span aria-current="page">Zaman Çizelgesi</span>
  <span aria-disabled="true">Kanban</span>
</nav>
<button type="button" aria-label="Ayarlar" aria-pressed={activeScreen==='settings'}
        onClick={() => setActiveScreen(s => s==='settings' ? 'timeline' : 'settings')}>⚙ Ayarlar</button>
<div id="panel-timeline" hidden={activeScreen!=='timeline'}><TimelineScreen .../></div>
<div id="panel-settings" hidden={activeScreen!=='settings'}><SettingsScreen .../></div>
```

- Zaman Çizelgesi mevcut `aria-current="page"`'i korur (`src/web/App.tsx:28`, değişmiyor,
  `role="tab"` **taşımaz**).
- Kanban statik bir öğe kalır (değişmiyor); `onClick`/`onKeyDown` handler'ı **yok** (gerçekten
  no-op, F-001'in "iş yapmayan buton" yasağına girmez — zaten hiçbir olay dinleyicisi olmayan,
  dürüstçe devre dışı bir öğe).
- Ayarlar gerçek bir `<button>`; etkin durumu **`aria-pressed`** ile belirtilir — CEO kararının
  "etkinken basılı durumu erişilebilir biçimde belirtilir" talimatının seçilen karşılığı budur:
  `aria-pressed`, bir toggle düğmesinin ikili açık/kapalı durumunu ifade etmenin standart ARIA
  yoludur; `aria-selected`/`aria-current` burada uygun değildir çünkü Ayarlar bir sekme/sayfa
  değil, bir yapılandırma panelini açıp kapatan bir anahtar düğmedir.
- Paneller `role="tabpanel"` **taşımaz** (bir tab'a `aria-labelledby` ile bağlı değil, sıradan
  bölgeler); `id="panel-timeline"`/`id="panel-settings"` D18'in E2E `display` assert'inin
  hedefleri olarak korunur.
- İki panel de her zaman mount edilir, yalnızca `hidden` değişir (F-003'ün unmount'suz garantisi,
  §2.2 `App.tsx` satırı, D18, §6 "`hidden` özniteliğinin panelini gerçekten görünmez yaptığının
  kanıtı").
- `aria-live="polite"` bağlantı durumu bölgesi (F-003) **değişmiyor**; ekran geçişleri ayrıca
  anons edilmez (UX kuralı: yalnızca durum değişiklikleri anons edilir, geçiş zaten görsel +
  `aria-pressed` ile programatik olarak yeterli).

**Test etkisi:** `App.test.tsx`/`App.interaction.test.tsx`/`settings.spec.ts` yukarıdaki tek
taslağa göre yazılır — Ayarlar `role="tab"` taşımaz, roving döngüye girmez, ok tuşuyla
ulaşılamaz; dişli düğmesine `click()` sonrası `aria-pressed` ve panel `hidden`/`display` değişir.

### ADR-012 taslağı (CEO kararı D16 — kalıcı ADR'ye çevrilmesi CEO'nun kararı)

- **Tarih:** 2026-09-05
- **Durum:** önerildi
- **Bağlam:** F-005'in tur 1 sözleşmesi, `docs/features` dizinini izlemek için mimari §3.4'ün
  onaylı `chokidar` bağımlılığı yerine yeni bağımlılık eklemeden `node:fs.watch` kullanmayı
  önermişti (gerekçe: ADR-009 tek-platform + düz-dizin izleme chokidar'ın çapraz-platform
  kazancını sıfırlıyor). QA bu kararı bu Windows makinesinde ampirik olarak test etti.
- **Ölçüm (QA, tur 1, geçici dizin, temizlendi):**
  - Sağlam dizinde `.md` yazımı: 2 ham olay, ilk olay 3 ms içinde.
  - **Dizin silinip yeniden oluşturulduktan sonra** `.md` yazımı: **0 olay**, hata yok — izleyici
    kalıcı olarak ölü.
  - **Dizin silinip silinmiş kalırsa:** 1 sn'de 112.535 / 3 sn'de 342.548 ham olay, ~641 ms
    kullanıcı CPU / 3 sn (~%21 çekirdek), süresiz; `filename` bu olaylarda dosya adı değil
    `\\?\C:\...\docs\features` mutlak yolu (bir başka yanlış varsayımı da çürüttü).
  - `chokidar@4.0.3`: yalnızca `readdirp@^4.0.1` bağımlılığı, `fsevents` yok, `hasInstallScript`
    yok (native derleme riski yok), `engines.node >= 14.16.0` (proje tabanı `>=20.11` ile uyumlu).
- **Karar:** `chokidar@^4.0.3` bağımlılığı eklenir; `project-watcher.ts` `chokidar.watch(dir,
  {depth:0, ignoreInitial:true, usePolling: MC_WATCH_POLLING==='1', awaitWriteFinish:{...}})`
  sarmalayıcısı üzerine kurulur.
- **Alternatifler ve neden reddedildi:**
  - `node:fs.watch` (tur 1'in kararı) — yukarıdaki iki ölçüm yüzünden reddedildi (AC1'i sessizce
    ihlal eder, kaynak tüketen sonsuz döngü riski taşır).
  - Kendi üst-dizin-izleyip-yeniden-kur mantığımızı yazmak — chokidar'ın zaten sınanmış çözdüğü
    bir problemi (dizin yaşam döngüsü) kötü kopyalamak olurdu (Karpathy §2).
- **Sonuçlar / riskler:** chokidar'ın kendisinin de native modda (Windows'ta `fs.watch` üzerine
  kurulu) aynı iki kusuru miras alıp almadığı bu turda **ölçülmedi** — kod turunda
  `project-watcher.test.ts`'in iki yeni vakasıyla (§2.1, §3 madde 1 sonu) doğrulanacak. Başarısız
  olursa mimari §3.5'in zaten var olan `MC_WATCH_POLLING=1` anahtarı (`usePolling: true`) geri
  dönüş planıdır — bu anahtar **emekliye ayrılmıyor**, iki amaçla (orijinal: ağ sürücüsü/WSL; yeni:
  Windows dizin yaşam döngüsü) kullanılmaya devam ediyor (QA Bulgu 5 kapatıldı, §9 madde 1).
- **Kullanıcı onayı gerekli mi:** hayır (ücret/hesap/geri alınamazlık yok — `package.json`'a bir
  npm bağımlılığı ekleniyor, mimari §3.4'ün zaten onayladığı kapalı listeden).

---

## 7. Güvenlik: yol doğrulama tablosu + manifest testi

### Yol doğrulama tablosu (≈20 vaka, `validate-path.test.ts`)

| # | Girdi | Beklenen | Neden |
|---|---|---|---|
| 1 | Var olmayan yol | `invalid_path` — "Bu yol bulunamadı." | `fs.existsSync` |
| 2 | Var olan bir **dosya** (klasör değil) | `invalid_path` — "Bu bir klasör değil." | `statSync().isDirectory()` |
| 3 | Var olan klasör, `docs/features` yok | `invalid_path` — "Bu klasörde docs/features bulunamadı. Yolu kontrol edin." | AC3 çekirdek vaka, UX metni birebir |
| 4 | `docs/features` var ama **dosya** | `invalid_path` (aynı mesaj) | `statSync` alt kontrolü |
| 5 | Boş dizge / yalnızca boşluk | `invalid_body` | Yapısal, semantik değil |
| 6 | `path` alanı string değil (sayı/obje) | `invalid_body` | Tip koruması |
| 7 | Göreli yol (`.\proje`) | `path.resolve` mutlak yola çevirir, sonra normal akış | Kaçış değil, normalizasyon |
| 8 | `..` içeren ama geçerli bir yola çözülen (`C:\dev\apps\..\apps\mission-control`) | `path.resolve` çözer → geçerliyse **KABUL**, saklanan `path` çözülmüş mutlak yol | "Kaçış" registration bağlamında ayrıcalık artışı değil, yalnızca normalizasyon (§3 madde 7 gerekçesi) |
| 9 | Sürücü kökü (`C:\`) | `invalid_path` — "Sürücü kökü izlenemez." | `path.parse(x).root === x` |
| 10 | UNC yol (`\\server\share\proj`) | `invalid_path` — "Ağ/UNC yolları desteklenmiyor." | `path.parse(x).root` UNC önekiyle başlıyor |
| 11 | Symlink/junction → geçerli `docs/features` içeren hedef | **KABUL**, saklanan `path` = `realpathSync.native` hedefi | §3 madde 4 (D17) |
| 12 | Zaten kayıtlı (aynı realpath) ikinci kez | `409 conflict` — "Bu proje zaten izleniyor." | Registry seviyesi |
| 13 | Aynı gerçek dizin, farklı harf büyüklüğü | `409 conflict` | `realpathSync.native` kanonikleştirir (§3 madde 4, D17 — ✓ VERIFIED, düz `realpathSync` bunu **başaramaz**, bkz. Ampirik ölçümler 2) |
| 14 | Aynı gerçek dizin, `/` vs `\` | `409 conflict` | `path.resolve` + `realpathSync.native` normalize eder |
| 15 | Aynı gerçek dizin, sondaki ayraç farkı | `409 conflict` | `path.resolve` sondaki ayracı atar |
| 16 | Çok uzun yol (324 karakter, geçerli `docs/features` içeriyor) | **KABUL** (✓ VERIFIED bu turda ölçüldü — `mkdirSync`/`existsSync`/`statSync().isDirectory()`/`realpathSync.native` hepsi bu Windows makinesinde başarılı; uzun yol desteği etkin, doğal `ENOENT` **oluşmuyor**) | Tur 1'in "invalid_path/doğal ENOENT" beklentisi ölçülen davranışla **çelişiyordu** (Bulgu 6) — düzeltildi, özel kod eklenmiyor, test yalnızca ölçülen KABUL davranışını doğruluyor |
| 17 | Baş/son boşluklu geçerli yol | Trim edilip **KABUL** | `input.trim()` |
| 18 | `docs` var, `features` yok (`docs/Features` büyük harf yazımıyla var) | **KABUL** (NTFS büyük/küçük harf duyarsız+koruyucu olduğu için `docs/Features` aslında bulunur; `docs/features` küçük harfle **de** eşleşir) | Windows dosya sistemi gerçeği — tur 1'deki iki çelişkili beklenti (Bulgu 6) tek beklentiye (**KABUL**) indirildi |
| 19 | Aynı anda iki eşzamanlı `POST` aynı yola (yarış) | İkincisi `409` (registry'nin `add()`'i senkron kontrol eder, Node tek iş parçacıklı — yarış yok) | Node event-loop garantisi |
| 20 | `id` alanı olmayan `DELETE /api/projects/` (boş segment) | `404 not_found` | Router segment kontrolü |

### Dosya sistemi manifest testi (CEO kararı C)

`tests/integration/projects-api.test.ts` içinde (F-006'nın gelecekteki `tests/helpers/
manifest.ts`'ini **önceden almadan** — o dosya mimari §2.1 tablosunda F-006'ya atanmış, isim
çakışmasından kaçınmak için burada **yerel, dosyaya özel** bir snapshot fonksiyonu yazılır, paylaşılan
helper'a çıkarılmaz):

```
1. Zengin bir fixture proje kur (geçici dizin): docs/features/{F-001,F-002}.md, docs/approvals/,
   src/index.ts, package.json, README.md, .claude/settings.json.
2. manifestBefore = özyinelemeli (göreli yol, boyut, mtimeMs, sha256)
3. Senaryo: POST /api/projects (ekle) → docs/features'a dışarıdan bir .md daha yaz (izleme
   sinyalini üretmek için, F-005 BUNU YAZMIYOR, harici bir test aktörü yazıyor) → DELETE
   /api/projects/:id (kaldır)
4. manifestAfter = aynı fonksiyon
5. İDDİA: manifestBefore/After'daki TÜM yollar (harici test aktörünün eklediği yeni .md dosyası
   dahil — o da manifestte görünür ama F-005'in kendisi onu yaratmadı, testin kurduğu senaryonun
   parçası) sha256/boyut olarak birebir aynı KALDI (F-005'in add/remove akışı hiçbir baytı
   değiştirmedi) ve SİLİNEN yol sayısı = 0.
5b. **(QA Bulgu 9, CEO kararı B'nin kendi çiti)** İDDİA: manifestAfter'daki **eklenen** yol kümesi
   (manifestBefore'da olmayıp manifestAfter'da olan yollar) **tam olarak** harici test aktörünün
   3. adımda yazdığı tek `.md` dosyasına eşittir — başka hiçbir yeni yol yok. Bu, madde 5'in
   yalnızca "silinen = 0" ölçtüğü, "eklenen ⊆ {test aktörünün yazdığı}" tarafını çitlemediği
   boşluğu kapatır (mutasyon 9, §8).
6. Ayrıca `data/events/**` (MC_DATA_DIR, ayrı bir geçici dizin) aynı senaryo boyunca hiç
   dokunulmadığı ayrıca doğrulanır (ADR-001 karar 6'nın "geçmiş olaylar kalır" güvencesinin
   negatif kanıtı — F-005 events dizinine asla yazmıyor).
```

**İzleyici yaşam döngüsünün gerçek kapanışı (QA Bulgu 10):** Tur 1'de "kaldırmadan sonra dosya
değişikliği artık `features` yaymaz" yalnızca **davranışsal** kanıttı — mantıksal aboneliğin
kapandığını gösterir, işletim sistemi tanıtıcısının (chokidar `FSWatcher`) kapandığını göstermez;
`server.on('close')` → `stopAll()` bağlantısı hiç doğrudan assert edilmiyordu. Düzeltme:
`createProjectsService`'in döndürdüğü nesneye (`getActiveWatcherCount()`) ve mimari §6.6'nın zaten
öngördüğü `/api/health`'in `watchers: n` alanına aktif izleyici sayısı gözlemlenebilir kılınır.
**(ÖNEMLİ-2/YENİ-1 düzeltmesi)** Gözlem iki ayrı, uygulanabilir adımda yapılır — `server.close()`
sonrası atılan bir HTTP isteği `ECONNREFUSED` alacağı için kapanış sonrası gözlem `/api/health`
üzerinden **yapılamaz**: `projects-api.test.ts` önce sunucu **ayaktayken** N proje eklendikten
sonra `GET /api/health`'in `watchers` alanının `=== N` olduğunu okur; ardından `server.close()`
çağrılır, `'close'` olayı beklenir ve `projectsService.getActiveWatcherCount()` (HTTP'siz,
doğrudan nesne çağrısı) `=== 0` olduğu assert edilir — tek ve kesin gözlem yolu budur, "(veya
eşdeğer bir sayaç)" kaçış yolu kapatıldı. Mutasyon 10 (§8) `stopAll()` çağrısı kaldırıldığında bu
ikinci assert'in KIRMIZI verdiğini kanıtlar.

---

## 8. Mutasyon planı (10 kritik test — tur 1'in 8'i + tur 2'nin QA bulgularıyla eklenen 8b/9/10)

| # | Mutasyon | Beklenen KIRMIZI | Ne kanıtlar |
|---|---|---|---|
| 1 | `debounce.ts`'te trailing reset kaldırılır (her `trigger()` hemen ateşler) | `debounce.test.ts` — "5 çağrı → 1 callback" testi | Debounce gerçekten coalesce ediyor mu |
| 2 | `validate-path.ts`'te `docs/features` varlık kontrolü tersine çevrilir | `validate-path.test.ts` vaka 3 + `projects-api.test.ts` AC3 testi | AC3'ün çekirdek reddi gerçek mi |
| 3 | Registry `add()`'teki realpath tekilleştirme kontrolü kaldırılır | `projects-registry.test.ts` — aynı yol iki kez eklenince `409` beklenen testi | §3 madde 4 — tekilleştirme gerçek mi |
| 4 | `service.ts`'in `removeProject`'ine kasıtlı bir `fs.unlinkSync(project.path)` eklenir | Manifest testi (§7) — silinen yol sayısı artık 0 değil | CEO kararı C'nin gerçekten sınandığı |
| 5 | `no-delete-guard.test.ts`'in taradığı dosyalardan birine (`service.ts`) yorum içinde değil **gerçek kod** olarak `fs.rmSync(...)` eklenir | `no-delete-guard.test.ts` | Statik guard gerçekten okuyor mu |
| 6 | `project-watcher.ts`'te `onChange`'e proje id'si yerine sabit/yanlış bir id geçirilir | `projects-api.test.ts` AC4 izolasyon testi | Çoklu proje izolasyonu gerçek mi |
| 7 | `index.ts`'teki genelleştirilmiş `Origin` kontrolü (§3 madde 9) eski özel-duruma (`yalnızca POST /api/events`) geri alınır | `projects-api.test.ts` Host/Origin regresyon testi (yeni `POST`/`DELETE /api/projects` uçlarında) | CSRF sınırı gerçekten genelleşti mi |
| 8 | `App.tsx`'te `hidden` özniteliği yerine koşullu JSX render (`{active==='timeline' && <TimelineScreen/>}`) kullanılır | `App.interaction.test.tsx` — sekme değişiminde filtre state'inin korunduğu testi | F-003'ün "unmount olmaz" değişmezinin yeni sekme deseninde de korunduğu |
| 8b (D18, QA Bulgu 4) | `App.tsx`'te pasif panelin `hidden={active!=='...'}` ifadesi sabit `hidden={false}`'a değiştirilir (her iki panel her zaman görünür) | `settings.spec.ts` — gerçek hesaplanmış `display` assert'i (§6 "`hidden` özniteliğinin panelini gerçekten görünmez yaptığının kanıtı") | `hidden` özniteliğinin gerçekten görünmezlik ürettiği (jsdom değil, gerçek tarayıcı CSS'i) |
| 9 (QA Bulgu 9) | `service.ts`'in `addProject`/`removeProject`'ine izlenen proje kökü altına (ör. `path.join(project.path, '.mc-cache')`) bir dosya **yazan** kasıtlı bir satır eklenir | Manifest testi (§7) — "eklenen yol kümesi tam olarak harici test aktörünün yazdığı tek `.md`'ye eşittir" iddiası | CEO kararı B'nin ("izlenen projelere hiçbir şey yazılmaz") gerçekten sınandığı |
| 10 (QA Bulgu 10) | `src/server/index.ts`'te `server.on('close', ...)` içindeki `projectsService.stopAll()` çağrısı kaldırılır | `projects-api.test.ts` — `server.close()`'un `'close'` olayı sonrası `projectsService.getActiveWatcherCount()`'ın (HTTP'siz, doğrudan) `0`'a düştüğünün assert'i | İzleyici yaşam döngüsünün yalnızca davranışsal değil, gerçekten kapatıldığının kanıtı |

Her mutasyon kod turunda: uygula → ilgili testi izole çalıştır → KIRMIZI gözlemi kaydet → Edit ile
birebir geri al → tekrar YEŞİL doğrulanacak (F-002/F-003/F-004 disiplinİyle aynı).

---

## 9. Riskler ve CEO'ya sorular

**Açık CEO sorusu: 0.** Bulgu 7 (Ayarlar'ın yerleşimi) dosya sonundaki "Ayarlar'ın yeri ve sekme
deseninin ertelenmesi" kararıyla kapandı (madde 0). Geri kalanı düşük etkili/geri alınabilir
teknik kararlar — CLAUDE.md "düşük etkili olanları kendin karara bağla, yaz" kuralı gereği kendim
karara bağladım, şeffaflık için bilgi notu olarak listeliyorum. D16-D19 (tur 1 QA bulgularının CEO
kararları) aşağıda ayrıca işaretli.

0. **[KAPANDI — CEO kararı, dosya sonu "Ayarlar'ın yeri ve sekme deseninin ertelenmesi"] Ayarlar
   dişli düğmesi, tam `tablist` deseni F-007'ye ertelendi** (QA Bulgu 7). CEO UX'in tarif ettiği
   seçeneği onayladı: Ayarlar sekme çubuğunun **dışında**, sağda sabit bir dişli düğmesi
   (`docs/03-ux.md:21`); gerçek `role="tablist"`/`tab`/`tabpanel`/roving tabindex/ok tuşu deseni
   bu feature'da **kurulmaz** — Kanban F-007'de gelene kadar sekme çubuğunda tek gerçek ekran var,
   bugün olmayan bir şey için desen kurmak F-003 CEO kararı D8'in reddettiği durumun aynısı
   (Karpathy §2). Uygulama §6'da tek bir taslak olarak yazılı (`aria-pressed`'li dişli düğmesi +
   `hidden` panel geçişi). F-007'ye devredilen tam taahhüt aşağıda madde 8'de.
1. **D16 — chokidar'a geri dönüş** (§3 madde 1) — tur 1'in `node:fs.watch` kararı QA'nın ölçtüğü
   iki gerçek kusur (dizin sil+yeniden-oluştur → kalıcı ölüm; dizin silinmiş kal → olay fırtınası)
   yüzünden CEO tarafından geri alındı. `ADR-012` taslağı bu bölümde (§6 sonu) yazılı; CEO
   onaylarsa `docs/decisions/ADR-012-proje-izleme-mekanizmasi.md` olarak kalıcı hâle getirilebilir
   (F-003'ün ADR-010 taslağı emsaliyle aynı yol). **Bu geri dönüş QA Bulgu 5'i de kendiliğinden
   kapatıyor:** tur 1'de chokidar düşünce mimari §3.5'in `MC_WATCH_POLLING` anahtarı ve §11 risk
   (y2)'nin azaltımı sessizce anlamsız kalıyordu (uygulanacak bir chokidar polling modu yoktu);
   D16 sonrası `MC_WATCH_POLLING` **emekliye ayrılmıyor**, tam tersine hem orijinal amacıyla (ağ
   sürücüsü/WSL) hem de yeni ölçülen ihtiyaçla (Windows dizin yaşam döngüsü kusurlarına karşı
   geri dönüş, §3 madde 1 sonu) **aynı anahtar üzerinden** kullanılmaya devam ediyor — §3.4/§3.5
   metninin kendisi zaten doğru, güncellenmesi gerekmiyor (`docs/02-architecture.md`'ye bu turda
   dokunulmuyor).
2. **`docs/features/F-005-proje-kayit-izleme.md` başlığı** zaten "chokidar izleme" diyor (D16
   sonrası artık **doğru**, tur 1'in "yanıltıcı" notu geçersiz) — dosya sahipliği listesine
   `package.json`'ın eklenmesi gerekiyor (§2.2 — chokidar bağımlılığı için); bu satırı
   güncellemiyorum (bu turun kapsamı yalnızca sözleşme), `status: qa` geçişinde CEO/ben
   güncelleyebiliriz.
3. **`features` SSE payload'ı `cards` içermiyor** (§3 madde 3) — mimarinin literal şemasından
   küçük bir sapma, F-007'nin kendi sözleşmesinde bu sinyali nasıl tüketeceğini (muhtemelen
   push-then-refetch) netleştirmesi gerekecek.
4. **`EventRecord.project_id` hâlâ hiç doldurulmuyor** (§1 kapsam dışı) — AC4 bugün
   `project_name` ile karşılanıyor; olay-seviyesi kayıt-defteri eşlemesi istenirse ayrı, küçük
   bir görev (ingest.ts'e dokunacağı için F-002/F-003 sahiplik alanına küçük bir istisna gerekir).
5. **Kayıp/geri gelen proje klasörü için otomatik yeniden izleme yok** — `exists:false` olan bir
   proje, kullanıcı klasörü geri getirse bile otomatik olarak yeniden izlenmeye başlamaz (periyodik
   yeniden kontrol yok, Karpathy §2, hiçbir AC istemiyor). Kullanıcı projeyi kaldırıp yeniden
   eklemeli. Bu, PRD/UX'te açıkça ele alınmamış bir köşe durumu — küçük risk, ekliyorum.
6. **[QA Bulgu 8] UX ekran-3'ün iki zorunlu öğesi §6'ya eklendi (aşağıya bakınız), burada yalnızca
   özetliyorum:** (a) "Depo bilgisi" bilgi satırı (`docs/03-ux.md:137`) wireframe'e eklendi; (b)
   bozuk kayıt defteri uyarısı (`docs/03-ux.md:289` "Proje listesi okunamadı, varsayılan boş liste
   ile başlandı.") artık `GET /api/projects` yanıtında bir `registry_corrupt: boolean` bayrağı
   olarak taşınıyor ve `SettingsScreen` bunu görürse banner gösteriyor (§4.2/§6 güncellendi).
7. **[QA Bulgu 12 / CEO kararı D19] AC1'in ertelenen kısmı — devir maddesi:** AC1'in "kanbanda
   görünür" ifadesinin tam görsel doğrulaması bu feature'da **yapılmıyor** (§5 tablosunun kendi
   gerekçesi — Kanban henüz yok). Bu, meşru bir daraltma ama **yalnızca §5 tablosunun bir hücresinde
   durursa kaybolur** — bu yüzden açıkça buraya taşınıyor: **F-007'nin sözleşmesi, kendi AC1'ini
   yazarken `features` SSE sinyalinin (`{project_id}`, §4.4) kanban ekranında gerçekten kart
   görünürlüğüne dönüştüğünü uçtan uca (sinyal → `GET /api/features` refetch → kart render) yeniden
   ve tam olarak doğrulamalıdır — bu F-005'in bıraktığı ara-katman kanıtın devamıdır, F-007'nin
   kendi başına yeniden icat edeceği bir iş değil.** CEO'nun F-007 brief'ine bu cümleyi (veya
   eşdeğerini) eklemesi gerekiyor; ben `docs/features/F-007-kanban.md`'ye dokunmuyorum (bu turun
   dosya sahipliği dışı).
8. **[F-007 devir — CEO kararı, dosya sonu] Tam `tablist` deseni + klavye gezinmesi.** CEO'nun
   "Ayarlar'ın yeri ve sekme deseninin ertelenmesi" kararı iki taahhüdü F-007'ye devrediyor; madde
   7 yalnızca ikincisini (AC1'in görsel kanıtı, D19) taşıyordu. Birincisi burada açıkça yazılı:
   **F-007'nin sözleşmesi, Kanban gerçek ikinci sekmeyi getirdiğinde gerçek `role="tablist"`/
   `tab`/`tabpanel` deseni + roving tabindex + ok tuşu gezinmesi (`ArrowLeft`/`ArrowRight`/`Home`/
   `End`, otomatik aktivasyon) kurmalı ve Ayarlar'ın bu tablist'in içinde mi dışında mı kalacağını
   (CEO kararı gereği dışında kalması bekleniyor, UX `docs/03-ux.md:21`) kendi ARIA taslağında
   netleştirmelidir.** CEO'nun F-007 brief'ine bu cümleyi (veya eşdeğerini) eklemesi gerekiyor; ben
   `docs/features/F-007-kanban.md`'ye dokunmuyorum (bu turun dosya sahipliği dışı).

**En büyük risk (D16 sonrası yeniden ölçüldü):** chokidar'ın Windows'ta native modda (`fs.watch`
üzerine kurulu) QA'nın `fs.watch` için ölçtüğü iki kusuru (dizin yaşam döngüsü ölümü + olay
fırtınası) miras alıp almadığı **henüz bilinmiyor** — bu, kod turunda `project-watcher.test.ts`'in
iki yeni vakasıyla (§2.1, §3 madde 1 sonu) ampirik olarak doğrulanacak. Geri dönüş planı zaten
mimaride hazır: `MC_WATCH_POLLING=1` (§3.5) → `usePolling: true`. Bu da başarısız olursa CEO'ya
yeni bir bloklayıcı soru olarak bildirilecek (bu sözleşme o noktayı varsaymıyor).

İkincil risk: chokidar'ın polling **olmayan** modda bazı Windows/antivirüs kombinasyonlarında
dosya kilitliyken (`EBUSY`) olay üretme davranışı test edilmedi — gerçek bir kilit senaryosu
simüle edilemiyor (F-002'nin retention `EPERM`/`EBUSY` riskiyle aynı sınıf, kabul edilmiş).

Üçüncü risk (bilgi, düşük): mimari §3.5 `MC_WATCH_POLLING`'in kayıtlı gerekçesi ("ağ sürücüsü/WSL
sorunu") artık F-005'in yeniden kullandığı ikinci bir amaca (Windows dizin yaşam döngüsü sorunu)
da hizmet edebilir; §3.5'in açıklama cümlesinin CEO tarafından genişletilip genişletilmeyeceği
(`docs/02-architecture.md`'ye dokunmak bu turun dışı) CEO'nun kararı.

---

## QA sözleşme incelemesi — tur 1 (qa-evaluator, 2026-09-05)

KARAR: DÜZELTME
ESKALE: false

Bu turda hiçbir kaynak kodu, config veya `.claude/` dosyası değiştirilmedi; yalnızca bu bölüm
eklendi. Üç iddia ampirik olarak ölçüldü (§Ampirik ölçümler): `fs.watch` davranışı,
`fs.realpathSync` büyük/küçük harf kanonikleştirmesi, uzun yol (>260 karakter) davranışı.
Ölçümler geçici dizinlerde yapıldı, hepsi temizlendi, yetim süreç bırakılmadı.

Sözleşme genel olarak güçlü: kapsam sınırları net, mutasyon planı gerçek, manifest testi CEO
kararı C'yi doğru anlıyor, stil çiti (§1 madde 8) F-003'ün B1 dersini **önden** kapatıyor.
Bloklayıcıların tamamı, sözleşmenin kendi kabul ettiği "en büyük risk"in (§9) sanılandan büyük
olmasından ve bir ölçülmemiş Windows varsayımından kaynaklanıyor.

### Bulgular

| # | Şiddet | Bölüm/satır | Bulgu | İstenen düzeltme |
|---|---|---|---|---|
| 1 | BLOKLAYICI | §3 madde 1 (satır 144-183), §2.1 `project-watcher.ts` (satır 99), §9 "En büyük risk" | **`fs.watch` izlenen dizin silinip yeniden oluşturulunca kalıcı olarak ölür — sessizce.** Ölçtüm: taban durumda `.md` yazımı 2 olay üretiyor; `docs` ağacı silinip `docs/features` yeniden oluşturulduktan sonra aynı yazım **0 olay** üretiyor, hata da fırlatmıyor. Bu tam olarak bir `git checkout`/branch değişimi desenidir ve AC1'i sunucu yeniden başlayana kadar **sessizce** ihlal eder. Sözleşmenin "Node'un Windows implementasyonu zaten stabildir ve olay kaçırmaz" gerekçesi (satır 163-164) bu vaka için yanlış; mimari §3.4'ün chokidar gerekçesi haklı çıkıyor. Planlanan `project-watcher.test.ts` vakaları arasında sil-yeniden-oluştur **yok**, yani bu kusur yeşil süitle sevk edilir. | `project-watcher.ts` izlemeyi yeniden kurabilir hâle getir (ör. üst dizini `docs`'u da izleyip `features` yeniden belirdiğinde yeni bir `fs.watch` kur, eskisini `close()` et) **veya** ADR-012'yi geri çekip mimari §3.4'ün onaylı `chokidar`'ını kullan; her iki hâlde `project-watcher.test.ts`'e "dizin sil → yeniden oluştur → `.md` yaz → `onChange` yine tetiklenir" vakası ve karşılık gelen bir mutasyon ekle. |
| 2 | BLOKLAYICI | §2.1 `project-watcher.ts` (satır 99), §9 ikincil risk | **İzlenen dizin silinip silinmiş kalırsa `fs.watch` sınırsız olay fırtınası üretiyor.** Ölçtüm: 1 sn'de 112.535, 3 sn'de 342.548 olay; ~641 ms kullanıcı CPU/3 sn (bir çekirdeğin ~%21'i), süresiz devam ediyor. `filename` bu olaylarda dosya adı değil `\\?\C:\...\docs\features` **mutlak yolu** — yani sözleşmenin "Windows'ta `ReadDirectoryChangesW` her zaman dosya adı verir" varsayımı (satır 99) da yanlış. `.md` uzantı filtresi `onChange`'i korur (SSE taşmaz) ama JS geri çağrısı 115k/sn çalışmaya devam eder. `watcher.close()` fırtınayı temiz durduruyor. Planlanan tek ilgili test "dizin silinirse **hata fırlamaz**" — bu assert fırtına sürerken **yeşil** kalır (ölçmeyen test). Bu depo daha önce yetim süreç/kaynak sızıntısıyla uğraştı (CLAUDE.md). | İzlenen dizin kaybolduğunda izleyiciyi `close()` et (yol kaybını tespit et; `exists:false` durumu zaten tasarlanmış) ve testi "hata fırlamaz"dan **"N sn içinde üretilen ham olay sayısı sınırlı VE izleyici kapandı"**a çevir. |
| 3 | BLOKLAYICI | §3 madde 4 (satır 217-230), §7 vaka 13 (satır ~466) | **`fs.realpathSync` Windows'ta kanonik büyük/küçük harfe çözmüyor — girdinin harf yazımını koruyor.** Ölçtüm: aynı gerçek dizin için 6 farklı yazım `realpathSync`'ten **3 farklı dizge** olarak çıkıyor (`...\MyProject`, `...\myproject`, `...\MYPROJECT`); yalnızca `fs.realpathSync.native` altısını da **tek** kanonik dizgeye indiriyor. Sözleşmenin bu iddiaya dayanarak `pathsEqual` yazmama ve düz dizge eşitliğiyle tekilleştirme kararı bu yüzden hatalı: §7 vaka 13 (farklı harf büyüklüğü → 409) **KIRMIZI** verir. Ayrıca mimari §5.2 bunu açıkça yasaklıyor: "`path` alanı JSON'da Windows ayracı ile durur; **karşılaştırma her zaman `path` API'siyle yapılır, dizge eşitliğiyle değil**." | §3 madde 4'ü ölçülen gerçekle değiştir: kanonikleştirme `fs.realpathSync.native()` ile yapılsın (tek tanımlayıcı değişikliği, `pathsEqual` yine gerekmez) ve `validate-path.test.ts`'e altı yazım varyantının **tek** dizgeye indiğini doğrulayan ampirik vakayı koy. |
| 4 | ÖNEMLİ | §2.2 `App.tsx` (satır 126), §3 madde 6, §6 sekme deseni | `hidden` + Tailwind çakışması **bu depoda gerçek bir risk değil** — doğruladım: `node_modules/tailwindcss/preflight.css:396` kuralı `[hidden]:where(:not([hidden='until-found'])) { display: none !important }` (tailwindcss 4.3.3), `!important` `flex`/`block` yardımcı sınıflarını ezer. Ama sözleşme bu dayanağı hiç yazmıyor (varsayım olarak duruyor) ve **panelin gerçekten görünmez olduğunu kanıtlayan hiçbir assert/mutasyon yok**: mutasyon 8 ters yönü (koşullu render → state kaybı) ölçüyor, §2.1'deki E2E ise yalnızca "panel görünürlüğünün değiştiği" diyor. jsdom bunu göremez (CSS yüklemez). | §3 madde 6'ya doğrulanmış dayanağı (preflight `!important`, sürüm numarasıyla) yaz; `settings.spec.ts`'e aktif olmayan panel için hesaplanmış `display`/`toBeHidden()` assert'i ve §8'e "`hidden` özniteliği kaldırılır → E2E KIRMIZI" mutasyonu ekle. |
| 5 | ÖNEMLİ | §3 madde 1 (satır 144-183), §9 madde 1 | chokidar düşürülünce mimarinin **kayıtlı risk azaltımı** sessizce yok oluyor: §3.5 `MC_WATCH_POLLING` ortam değişkeni (`chokidar polling`) uygulanamaz hâle gelir ve §11 risk **(y2)** ("chokidar ağ sürücüsü/WSL'de olay kaçırır → `MC_WATCH_POLLING=1`") azaltımsız kalır. Sözleşme ikisinden de hiç söz etmiyor. | ADR-012 taslağına `MC_WATCH_POLLING`'in **emekliye ayrıldığını** (veya `fs.watch` karşılığını) ve risk (y2)'nin yeni azaltımını açıkça yaz; §3.4/§3.5 ve feature notu başlığındaki "chokidar" ifadelerinin hangi turda güncelleneceğini belirt. |
| 6 | ÖNEMLİ | §7 vaka 16 ve vaka 18 | Vaka 16 ampirik olarak **yanlış**: 324 karakterlik bir yol için ölçtüm — `mkdirSync` başarılı, `existsSync` **true**, `statSync().isDirectory()` true, `realpathSync` çalışıyor. Yani beklenen `invalid_path` ("Bu yol bulunamadı.") değil, **KABUL**; test yazıldığı gibi KIRMIZI verir. Vaka 18 ise kendi içinde çelişkili (önce `invalid_path` diyor, sonra parantez içinde "düzeltme: beklenen **KABUL**") — bağlayıcı bir tabloda iki farklı beklenti. | Vaka 16'yı ölçülen davranışla (KABUL) yaz; vaka 18'i tek bir beklentiye indir. |
| 7 | ÖNEMLİ | §6 UX sapma notu (satır 429-439), §9 madde 5 | Ayarlar'ı üçüncü bir `role="tab"` yapmak **G3 onaylı** iki ifadeyle çelişiyor: `docs/03-ux.md:21` ("sağda sabit bir dişli ikonu olarak ayrılır, ana sekmelerin yanına karışmaz") ve `docs/03-ux.md:444` odak sırası ("Sekme çubuğu → **Ayarlar ikonu** → filtre çipleri"), yani Ayarlar tablist'in dışında konumlanıyor. CEO kararı A yalnızca "gerçek tablist/tab/tabpanel deseni F-005'in işi" diyor, Ayarlar'ın sekme olmasını istemiyor. Sözleşme onaylı bir kapı dokümanının davranışını kendi kararıyla değiştirip bunu §9'da bilgi notu olarak geçiyor. | Bunu §9'da **bilgi notu değil açık CEO sorusu** yap (iki seçenek: (a) tablist = Zaman Çizelgesi + Kanban, Ayarlar ayrı dişli düğmesi; (b) üç sekme + `docs/03-ux.md:21/444` güncellenir) ve karar gelmeden kodlama. |
| 8 | ÖNEMLİ | §6 Ayarlar wireframe (satır 374-383), durum tasarımı (satır 385-388) | UX ekran 3'ün **iki zorunlu öğesi** sessizce düşmüş: (a) bilgi satırı "Depo bilgisi: olaylar son 30 gün veya 20.000 olay saklanır (sunucu ayarı)." (`docs/03-ux.md:127,138`) sözleşmenin wireframe'inde yok ve kapsam-dışı listesinde de yok; (b) UX durum tablosunun Ayarlar satırındaki **bozuk-veri** durumu ("Proje listesi okunamadı, varsayılan boş liste ile başlandı.", `docs/03-ux.md:289`) hiçbir yerde arayüze taşınmıyor — §4.1 bozuk `projects.json`'ı yalnızca `stderr`'e logluyor, kullanıcı proje listesini sessizce kaybediyor. | İkisini de §6'ya ekle: bilgi satırını wireframe'e, bozuk-defter uyarısını `GET /api/projects` yanıtında taşınan bir bayrak + `SettingsScreen` bildirimi olarak; `SettingsScreen.test.tsx`'e bozuk-defter durumu için bir assert koy. |
| 9 | ÖNEMLİ | §7 manifest testi adım 5 (satır ~490), §8 mutasyon 4 | Manifest iddiası CEO kararı C'yi (silme yok) kanıtlıyor ama CEO kararı **B**'yi (*"izlenen projelere hiçbir şey yazılmaz"*) kanıtlamıyor: adım 5 yalnızca ortak yolların sha256/boyut olarak aynı kaldığını ve **silinen yol sayısı = 0** olduğunu assert ediyor; **eklenen** yol kümesi için bir sınır yok. `service.ts`'e izlenen projeye bir önbellek/`.tmp` dosyası yazan bir mutasyon bu testte **yeşil** kalır. §8'de de yalnızca `unlink` mutasyonu (4) var, yazma mutasyonu yok. | Adım 5'e "eklenen yol kümesi **tam olarak** harici test aktörünün yazdığı tek `.md`'ye eşittir" iddiasını ekle; §8'e "4b: `removeProject`/`addProject` izlenen proje köküne bir dosya yazar → manifest testi KIRMIZI" mutasyonunu koy. |
| 10 | ÖNEMLİ | §2.1 `projects-api.test.ts` (satır 113), §2.2 `src/server/index.ts` | İzleyici yaşam döngüsü yalnızca **davranışsal** kanıtlanıyor ("kaldırmadan sonra dosya değişikliği artık `features` yaymaz") — bu, mantıksal aboneliğin kapandığını gösterir, işletim sistemi tanıtıcısının kapandığını **göstermez**. `server.on('close')` → `stopAll()` bağlantısı için hiçbir assert yok. Mimari §6.6 zaten `/api/health`'te `watchers: n` alanını öngörüyor ve bunu ucuza gözlemlenebilir kılardı. | `stopAll()`'ın sunucu kapanışında çağrıldığını doğrudan assert et (sayaç/`watchers: n`) ve §8'e "`server.on('close')`'tan `stopAll()` kaldırılır → KIRMIZI" mutasyonunu ekle. |
| 11 | NOT | §2.2 `tests/build-css.test.ts` (satır 128) | Çit doğru kurulmuş (`@source` + üretim CSS denetimi) ama F-003'ün asıl tuzağı sınıfın **tesadüfen başka yerde de geçmesiydi** (`bg-zinc-950` yüzünden yeşil kalmıştı). "yalnızca `projects/web` içinde geçen" ifadesi bir niyet, bir assert değil. | Seçilen sınıfların `src/web/**` ve `src/features/events/**` içinde geçmediğini testin kendisinin programatik olarak doğrulamasını iste. |
| 12 | NOT | §5 AC1 satırı (satır 354), §9 | AC1'in "kanbanda görünür"den "features SSE sinyali" sınırına çekilmesini **meşru** buluyorum (Kanban henüz yok, alternatifi F-007'nin dosya sahipliğine girmek olurdu) ve F-007 taahhüdü §5 tablosunun hücresinde yazılı. Ancak taahhüt yalnızca orada duruyor; §9/HANDOFF'un devir listesinde görünmüyor, bu da ertelenmiş AC'lerin kaybolma yoludur. | §9'a tek satırlık açık bir devir maddesi ekle: "AC1'in tam görsel doğrulaması F-007'nin sözleşmesinde yeniden açılacak." |
| 13 | NOT | §2.1 `no-delete-guard.test.ts` (satır 110), `projects-api.test.ts` Host/Origin satırı | İki küçük çit boşluğu: (a) statik guard'ın **kör olmadığını** doğrulayan assert yok (taranan dosya listesi boş olsa test yine yeşil olur; `tests/no-external-host.test.ts:53` bu deseni zaten kurmuş); (b) Host/Origin regresyonu yalnızca `POST`/`DELETE` için planlanmış — `GET /api/projects`'in de `isAllowedHost` çitine tabi olduğu (`src/server/index.ts:235-240`) assert edilmiyor. | Guard'a "taranan dosya sayısı > 0" assert'i, Host testine `GET /api/projects` vakası ekle. |
| 14 | NOT | Feature notu `docs/features/F-005-proje-kayit-izleme.md:3,22` | Sözleşme, feature notunun dosya sahipliği satırının dışında 8 dosyaya dokunuyor (`src/shared/types.ts`, `src/server/index.ts`, `src/web/{App.tsx,index.css,lib/useEventStream.ts}`, `tests/build-css.test.ts`, `tests/web/App*.tsx`, `playwright.config.ts`). Gerekçelerin hepsi §2.2'de tek tek yazılmış ve minimal buldum (kablolama + güvenlik tamamlama), kapsam sızması değil. Ama feature notunun kendisi güncellenmediği sürece iki doküman çelişik kalır; başlık da hâlâ "chokidar izleme" diyor. | Feature notunun dosya sahipliği satırının ve başlığının hangi turda güncelleneceğini §9'a yaz. |

### CEO kararları uyum kontrolü

| Karar | Durum | Not |
|---|---|---|
| **A** — gerçek `tablist`/`tab`/`tabpanel` + ok tuşu + roving tabindex | **Kısmen** | Desen doğru ve eksiksiz planlanmış (§2.1 `useTabs.ts`, §6): otomatik aktivasyon, `Home`/`End`, disabled sekmenin döngüden atlanması, `aria-controls` yalnızca gerçek paneli olan sekmelerde. Üç katmanlı test (birim + bileşen + E2E gerçek odak) yerinde. Tek açık konu Ayarlar'ın sekme olup olmayacağı (Bulgu 7) ve panel görünmezliğinin kanıtı (Bulgu 4). |
| **B** — kayıt defteri panelin verisi, atomik yazma, izlenen projelere hiçbir şey yazılmaz | **Kısmen** | `data/projects.json` + tmp/rename doğru (§4.1); `fsync` atlama gerekçesi kabul edilebilir. Ama "hiçbir şey yazılmaz" iddiası manifest testinde **eklenen dosya** tarafından çitlenmemiş (Bulgu 9). |
| **C** — çıkarma diskte hiçbir şeyi silmez, dosya sistemi manifest testiyle | **Uygun** | Manifest `(göreli yol, boyut, mtimeMs, sha256)` — yalnızca dizin listesi değil, içerik ve mtime de karşılaştırılıyor; mutasyon 4 (`unlink` ekle → KIRMIZI) planlı; `data/events/**`'in de dokunulmadığı ayrıca doğrulanıyor. Silme tarafı sağlam. |
| **D** — geçmiş olaylar depoda kalır | **Uygun** | `EventRecord`/`ingest` hiç değişmiyor; §1 kapsam dışı bunu açıkça koruyor, manifest testi `data/events/**`'i negatif kanıtla çitliyor. |
| **E** — savunmacı yol doğrulaması, elle regex yasak | **Kısmen** | Tablo kapsamlı (yok · dosya · kök · UNC · symlink · `..` · uzun yol · harf · `/` vs `\` · kayıtlı · `docs/features` yok) ve her satırda okunabilir Türkçe mesaj var; `node:path` dışına çıkılmıyor, `path.parse().root` üzerinde `startsWith` mimari §3.6'nın yasakladığı sınıfa girmiyor (kök tokenı, tüm yol dizgesi değil). Ancak vaka 13 (Bulgu 3) ve vaka 16/18 (Bulgu 6) ölçülen gerçekle uyuşmuyor. |
| **F** — izleme yalnızca `docs/features/*.md`, `node_modules` dışlanır | **Uygun** | `fs.watch(featuresDir)` recursive **değil** → `node_modules` yapısal olarak erişilemez (dışlama listesi gerekmiyor, daha güçlü bir garanti); `.md` filtresi `path.extname` ile. |
| **G** — izleyici kararı veriyle | **Kısmen** | Veri toplama gerçek (`npm view`: chokidar@4 → yalnızca `readdirp`, `fsevents` yok, install script yok) ve gerekçe yapısı doğru. Ama karar, **ölçülmemiş** bir ikinci öncüle dayanıyor ("Node'un Windows implementasyonu olay kaçırmaz") ve bu öncül ölçümle çürüdü (Bulgu 1/2). Karar veriyle yeniden alınmalı. |
| **H** — kapsam dışı: yazma kapısı, kanban, Faz 2, hook kurulumu | **Uygun** | §1 kapsam-dışı listesi bunları tek tek reddediyor; ayrıca `PATCH /api/projects/:id`, `FeatureCard` türetimi, `EventRecord.project_id`, 1-6 kısayolları ve sunucu taraflı olay filtreleme de gerekçeli olarak dışarıda. Kapsam sızması görmedim. |

### Ampirik ölçümler

Hepsi bu makinede (Windows 11, Node v24.15.0, NTFS, geçici dizin) çalıştırıldı; dizinler silindi.

**1) `fs.watch` — sil/yeniden oluştur (kritik).**

| Senaryo | Sonuç |
|---|---|
| Dizin sağlamken `.md` yazımı | 2 ham olay, ilk olay **3 ms** içinde (AC1'in 5 sn bütçesi rahat) |
| Editör tarzı atomik kaydetme (tmp dışarıda → rename içeri) | 2 olay, kaçırma yok |
| Atomik kaydetme (tmp içeride → üzerine rename) | 5 ham olay, 2'si `.md` — 150 ms debounce bunları doğru toplar |
| 5 dosyalık patlama | 10 olay, hepsi `.md`, kaçırma yok |
| `.txt` dosyası | `.md` filtresiyle eleniyor |
| `stop()`/`close()` sonrası değişiklik | 0 olay (temiz) |
| Var olmayan dizinde `fs.watch` | senkron `ENOENT` (sözleşmenin beklentisi doğru) |
| **Dizin silinip yeniden oluşturulduktan sonra `.md` yazımı** | **0 olay — izleyici kalıcı olarak ölü, hata yok** |
| **Dizin silinip silinmiş kalırsa** | **1 sn'de 112.535 / 3 sn'de 342.548 ham olay, süresiz; ~641 ms kullanıcı CPU / 3 sn. `filename` = `\\?\C:\...\docs\features` mutlak yolu. `close()` fırtınayı durduruyor. Olay döngüsü aç kalmıyor (10 ms `setInterval` 1 sn'de 100 kez ateşledi).** |
| Dizin **yeniden adlandırılırsa** | İzleyici eski tanıtıcıyı izlemeye devam ediyor (yeni addaki dizine yazınca tetikleniyor) — kayıtlı yol ile izlenen dizin ayrışabilir |

Sonuç: sözleşmenin "olay kaçırmaz" öncülü sağlam durumda doğru, **dizin yaşam döngüsü olaylarında yanlış**.

**2) `fs.realpathSync` büyük/küçük harf kanonikleştirmesi.** Aynı gerçek dizine 6 farklı yazımla:

| Girdi | `realpathSync` | `realpathSync.native` |
|---|---|---|
| oluşturulduğu hâl | `...\MyProject` | `...\MyProject` |
| tümü küçük harf | `...\myproject` | `...\MyProject` |
| tümü BÜYÜK harf | `...\MYPROJECT` | `...\MyProject` |
| `/` ayraçlı | `...\MyProject` | `...\MyProject` |
| sondaki ayraçlı | `...\MyProject` | `...\MyProject` |
| `docs\..` içeren | `...\MyProject` | `...\MyProject` |

**Farklı sonuç sayısı: `realpathSync` = 3, `realpathSync.native` = 1.** Sözleşmenin §3 madde 4 iddiası
(`realpathSync` kanonik harfe çözer) **yanlış**; `.native` ile doğru oluyor. Düz dizge eşitliğiyle
tekilleştirme simülasyonunda küçük/büyük harf varyantları tekilleştirmeyi **kaçırdı** (aynı proje
iki kez kaydedilebilirdi).

**3) Uzun yol (>260 karakter).** 324 karakterlik yol: `mkdirSync` başarılı, `existsSync` **true**,
`statSync().isDirectory()` true, `docs/features` bulunuyor, `realpathSync` ve `.native` çalışıyor.
Sözleşmenin §7 vaka 16 beklentisi ("Bu yol bulunamadı.") bu makinede **gerçekleşmiyor**.

**4) `hidden` + Tailwind (kod okuma, ölçüm değil).** `node_modules/tailwindcss/preflight.css:396`
→ `[hidden]:where(:not([hidden='until-found'])) { display: none !important; }` (tailwindcss
**4.3.3**, `package.json:46` `^4`). `!important` sayesinde `flex`/`block` yardımcı sınıfları kuralı
**ezemez** — sözleşmenin `hidden` seçimi bu sürümde güvenlidir. E2E gerçek CSS ile koşuyor
(`playwright.config.ts:19` `npm run build && npm start`), yani doğru assert yazılırsa bu gerçekten
kanıtlanabilir.

### Ölçmeyen test riski (yeşil kalabilecek assert'ler)

1. **`project-watcher.test.ts` "dizin `stop()`'tan önce silinirse hata fırlamaz"** — saniyede
   ~115.000 olay üreten bir fırtına sürerken bu assert **yeşil**dir. "Hata fırlamamak" burada
   sağlık değil, semptomun ta kendisidir (Bulgu 2).
2. **Sil/yeniden-oluştur vakasının hiç olmaması** — planlanan dört watcher vakası da sağlam
   dizin varsayıyor; AC1'i sessizce ihlal eden tek senaryo test edilmiyor (Bulgu 1).
3. **Manifest testi "silinen yol sayısı = 0"** — izlenen projeye dosya **ekleyen** bir mutasyon
   yeşil geçer; CEO kararı B çitsiz kalır (Bulgu 9).
4. **`no-delete-guard.test.ts`** — taranan dosya listesi yanlış/boş olursa test yine yeşil olur
   (körlük assert'i yok, Bulgu 13a).
5. **Panel görünürlüğü** — jsdom CSS yüklemez; `App.interaction.test.tsx`'in `hidden` iddiası
   yalnızca özniteliğin varlığını ölçer. Gerçek `display` yalnızca E2E'de ve yalnızca hesaplanmış
   stil assert'i yazılırsa ölçülür (Bulgu 4).
6. **§7 vaka 16** — beklenti ölçülen davranışla ters olduğu için test yazıldığı gibi KIRMIZI verir;
   düzeltilirken "yolu kabul et"e çevrilirse uzun yol davranışı hakkında hiçbir şey kanıtlamayan
   bir vakaya dönüşme riski var (Bulgu 6).
7. **İzleyici kapanışı** — `stopAll()` hiç çağrılmasa bile, sunucu süreci test sonunda öldüğü için
   entegrasyon testleri yeşil kalır (Bulgu 10).

### Kod turuna geçiş

Bulgu 1, 2 ve 3 kapatıldığında (izleme mekanizmasının dizin yaşam döngüsü kararı + `realpathSync.native`)
ve Bulgu 7 CEO'ya sorulduğunda sözleşme kod turuna hazır. Diğer bulgular sözleşme metninde
düzeltilebilir; yeni bir tasarım turu gerektirmiyor.

---

## Developer düzeltme yanıtı — tur 2 (2026-09-05)

Kapsam: yalnızca bu dosya (`docs/qa/F-005-contract.md`) düzenlendi (`git status` bunu doğrular).
`src/`, `tests/`, `scripts/`, `.claude/`, `package.json`, `.github/workflows/ci.yml`, `docs/02-
architecture.md`, `docs/features/**`, `docs/decisions/**`'te hiçbir değişiklik yok. Bu turda
`npm view` ile `chokidar@{4.0.0,4.0.1,4.0.2,4.0.3,5.0.0}` ve `readdirp@{4.0.0-4.1.2}`'nin
`scripts` (install script) alanları yeniden doğrulandı (registry sorgusu, salt okuma,
`node_modules`'a hiçbir şey kurulmadı) ve `package-lock.json`'daki mevcut `fsevents` transitive
kaydı (`:3331`) okundu. CEO kararları D16-D19'a **itiraz edilmedi**, dördü de birebir uygulandı.

### CEO kararları D16-D19

- **D16 (izleyici `chokidar`'a geri döndü):** §1 madde 1, §2.1 (`project-watcher.ts` satırı +
  `project-watcher.test.ts` satırı), §2.2 (yeni `package.json` satırı), §3 madde 1 (tamamen
  yeniden yazıldı — ölçülen kusurlar, chokidar veri tablosu, iki yeni ampirik doğrulama taahhüdü,
  geri dönüş planı), §6 sonu (ADR-012 taslağı, yeni), §8 (mutasyon açıklamaları chokidar'a göre
  güncellendi), §9 madde 1 (Bulgu 5'in bu geri dönüşle kendiliğinden kapandığı not edildi).
- **D17 (`realpathSync.native`):** §3 madde 4 tamamen yeniden yazıldı (ölçülen kusur + karar +
  `.native` yokluğu/hata davranışı), §3 madde 7 adım 7, §7 vaka 11/13/14 güncellendi.
- **D18 (`hidden` kanıtı):** §6'ya yeni alt bölüm eklendi (tailwindcss 4.3.3 `preflight.css:396`
  dayanağı, dosya:satır ile), `settings.spec.ts`'e gerçek hesaplanmış `display` assert'i planı,
  §8'e mutasyon 8b (`hidden` sabitlenirse E2E KIRMIZI).
- **D19 (ertelenen AC devri):** §9 madde 7 — AC1'in F-007'ye devredilen kısmı artık yalnızca §5
  tablosunun bir hücresinde değil, açık bir devir maddesi olarak CEO'nun F-007 brief'ine
  ekleyeceği tam cümleyle birlikte yazılı. `docs/features/F-007-kanban.md`'ye dokunmadım (bu
  turun dosya sahipliği dışı) — CEO'nun taşıması gerekiyor.

### Bulgu bazlı yanıt

| # | Ne değiştirdim | Bölüm/satır |
|---|---|---|
| 1 (BLOKLAYICI) | D16 uygulandı: izleme `chokidar@^4.0.3`'e döndü. `project-watcher.test.ts`'e "dizin sil → yeniden oluştur → `.md` yaz → `onChange` yine tetiklenir" vakası eklendi (kod turunda ampirik doğrulanacak, chokidar'ın belgelenen "henüz var olmayan yolu izleyebilme" davranışına dayanarak — ama varsayılmıyor, ölçülecek). | §1 madde 1; §2.1 `project-watcher.ts`/`project-watcher.test.ts` satırları; §3 madde 1. |
| 2 (BLOKLAYICI) | Aynı D16 kararının ikinci yarısı: "dizin silinip silinmiş kalırsa" vakası da `project-watcher.test.ts`'e eklendi — bu kez "hata fırlamaz" gibi ölçmeyen bir assert **değil**, 1 sn'lik ham olay sayısına sayısal üst sınır (ör. <100) + CPU farkı ölçümü. Chokidar'ın native modda aynı alt-katman kusurunu miras alma ihtimali açıkça yazıldı (varsayılmadı); başarısız olursa `MC_WATCH_POLLING=1` geri dönüş planı §3 madde 1 sonunda. | §2.1 `project-watcher.test.ts` satırı; §3 madde 1 "kod turunda ampirik doğrulanacak" alt bölümü; §9 "En büyük risk". |
| 3 (BLOKLAYICI) | D17 uygulandı: tekilleştirme/kanonikleştirme her yerde `fs.realpathSync.native`. `.native` yokluğu/hata durumu tanımlandı (Node'da her zaman tanımlı, çağrı hatası mevcut üst-seviye hata yoluna düşer). §7 vaka 11/13/14 `.native` kullanacak şekilde güncellendi, vaka 13 artık ✓ VERIFIED referansı taşıyor. | §3 madde 4 (tamamen yeniden yazıldı); §3 madde 7 adım 7; §7 vaka 11/13/14. |
| 4 (ÖNEMLİ) | D18 uygulandı: tailwindcss 4.3.3 `preflight.css:396` dayanağı §6'ya yazıldı; `settings.spec.ts`'e gerçek hesaplanmış `display` assert'i (`getComputedStyle`) planı eklendi; §8'e mutasyon 8b (`hidden` kaldırılırsa E2E KIRMIZI) eklendi. | §6 yeni alt bölüm "`hidden` özniteliğinin panelini gerçekten görünmez yaptığının kanıtı"; §8 mutasyon 8b. |
| 5 (ÖNEMLİ) | D16'nın doğal sonucu olarak kapandı: chokidar geri döndüğü için `MC_WATCH_POLLING`/risk (y2) azaltımı hiç kaybolmadı, ikili amaçla (orijinal + yeni) kullanılmaya devam ediyor; `docs/02-architecture.md`'ye dokunmaya gerek kalmadı. | §9 madde 1 (D16 alt maddesi); §6 ADR-012 taslağı "Sonuçlar/riskler". |
| 6 (ÖNEMLİ) | Vaka 16 ölçülen davranışla (324 karakter, `docs/features` mevcutsa **KABUL**) yeniden yazıldı; vaka 18 tek beklentiye (**KABUL**) indirildi, çelişkili parantez cümlesi kaldırıldı. | §7 vaka 16/18. |
| 7 (ÖNEMLİ) | Bilgi notundan **açık CEO sorusuna** çevrildi: §9'a madde 0 olarak (a)/(b) seçenekleriyle, artılarıyla/eksileriyle eklendi; §6 "Sekme deseni" bölümü her iki seçenek için ayrı DOM/ARIA taslağı içerecek şekilde yeniden yazıldı; §2.2 `App.tsx`/`App.test.tsx` satırları karara bağlı dallanmayı yansıtacak şekilde güncellendi. CEO cevabı gelmeden kod turu Ayarlar'ın DOM yerleşimini yazmayacak (SettingsScreen içeriği/API/registry karardan bağımsız, paralel ilerleyebilir). | §9 madde 0 (yeni); §6 "Sekme deseni" (tamamen yeniden yazıldı); §2.2 `App.tsx`/`tests/web/App.test.tsx` satırları. |
| 8 (ÖNEMLİ) | UX ekran-3'ün iki eksik öğesi eklendi: (a) "Depo bilgisi" satırı wireframe'e (§6); (b) bozuk kayıt defteri uyarısı `registry.isCorrupt()` → `GET /api/projects`'in `registry_corrupt?:true` alanı → `SettingsScreen` banner'ı (§4.2/§4.3/§6, `handlers.ts`/`projects-registry.ts`/`projects-registry.test.ts`/`SettingsScreen.test.tsx` satırları güncellendi). | §6 (iki yeni alt bölüm); §4.3 GET satırı; §2.1 ilgili dosya satırları. |
| 9 (ÖNEMLİ) | Manifest testi adım 5b eklendi: "eklenen yol kümesi tam olarak harici test aktörünün yazdığı tek `.md`'ye eşittir." §8'e mutasyon 9 eklendi (`addProject`/`removeProject` izlenen köke dosya yazarsa manifest testi KIRMIZI). | §7 "Dosya sistemi manifest testi" adım 5b; §8 mutasyon 9. |
| 10 (ÖNEMLİ) | İzleyici kapanışı artık davranışsal değil doğrudan gözlemlenebilir: mimari §6.6'nın zaten şemasında duran `watchers: n` alanı `handleHealth`'e eklendi, `projectsService.getActiveWatcherCount()` bunu besliyor. `projects-api.test.ts` sunucu kapanışı öncesi/sonrası `/api/health`'i okuyup sayının 0'a düştüğünü assert edecek. §8'e mutasyon 10 eklendi (`stopAll()` kaldırılırsa KIRMIZI). | §2.2 `src/server/index.ts` satırı; §2.1 `service.ts` satırı; §8 mutasyon 10. |
| 11 (NOT) | `build-css.test.ts`'in artık seçilen sınıfların `src/web/**` ve `src/features/events/web/**` içinde **hiç geçmediğini** testin kendisinin programatik olarak (`fs.readFileSync`+`includes`) doğruladığı yazıldı — niyet cümlesi değil, çalışma zamanı kontrolü. | §2.2 `tests/build-css.test.ts` satırı. |
| 12 (NOT) | D19 uygulandı: §9'a madde 7 olarak, F-007'nin sözleşmesine CEO tarafından ekleneceği tam cümleyle açık bir devir maddesi yazıldı. | §9 madde 7. |
| 13 (NOT) | (a) `no-delete-guard.test.ts`'e "taranan dosya sayısı > 0" körlük-karşıtı assert'i eklendi; (b) Host/Origin regresyon testine `GET /api/projects`'in de `isAllowedHost` çitine tabi olduğu vakası eklendi (`src/server/index.ts:235-238`). | §2.1 `no-delete-guard.test.ts` satırı; §2.1 `projects-api.test.ts` satırı. |
| 14 (NOT) | Feature notunun başlığı ("chokidar izleme") D16 sonrası artık **doğru** — düzeltme gerekmiyor. Dosya sahipliği listesine `package.json`'ın (yeni chokidar bağımlılığı için) ekleneceği not §9 madde 2'ye yazıldı; `docs/features/F-005-proje-kayit-izleme.md`'ye bu turda dokunmadım (dosya sahipliği dışı), CEO `status: qa` geçişinde güncelleyebilir. | §9 madde 2. |

### Kalan açık soru

Yalnızca **madde 0 (Bulgu 7 — Ayarlar'ın tablist içinde mi dışında mı olacağı)** CEO cevabı
bekliyor; iki seçenek de tam DOM/ARIA taslağıyla §6'da yazılı, hangisi seçilirse doğrudan
uygulanabilir. Diğer tüm bulgular (1-6, 8-14) bu turda sözleşme içinde kapatıldı, yeni bir tasarım
turu veya CEO kararı gerektirmiyor.

### Riskler (özet, ayrıntı §9)

En büyük risk hâlâ chokidar'ın Windows native modda QA'nın `fs.watch` için ölçtüğü iki kusuru
(dizin yaşam döngüsü ölümü + olay fırtınası) miras alıp almadığı — bu kod turunda iki yeni
`project-watcher.test.ts` vakasıyla ölçülecek, geri dönüş planı (`MC_WATCH_POLLING`) hazır.
İkincil risk değişmedi (chokidar'ın `EBUSY` davranışı test edilmiyor, kabul edilmiş sınıf).

---

## CEO kararı — Ayarlar'ın yeri ve sekme deseninin ertelenmesi (2026-09-05)

Sözleşme §9 madde 0'daki soruya cevap: **UX'in (a) seçeneği — sağda sabit dişli düğmesi.**
`docs/03-ux.md:21` bunu G3'te karara bağlamış:
> "Ayarlar bir izleme ekranı değil, seyrek ziyaret edilen bir yapılandırma ekranıdır; sekme
> çubuğunu kalabalıklaştırmaması için sağda sabit bir dişli ikonu olarak ayrılır, ana sekmelerin
> yanına karışmaz."

Ayarlar'ı üçüncü sekme yapmak onaylanmış bir kapıdan sapma olurdu ve gerekçesi de sağlam:
yapılandırma ekranı izleme ekranlarıyla aynı düzlemde değil.

### Bunun sonucu: CEO kararı A güncellendi — tam `tablist` deseni **F-007'ye** ertelendi

Kararım A "gerçek `tablist`/`tab`/`tabpanel` deseni artık F-005'in işi" diyordu; o varsayım
Ayarlar'ın sekme olacağıydı. Değilse tablo değişiyor:
- `docs/03-ux.md:19` Faz 1 sekme çubuğunu **Zaman Çizelgesi + Kanban** olarak tanımlıyor.
- **Kanban F-007'de geliyor.** Yani F-005 bittiğinde sekme çubuğunda hâlâ tek gerçek sekme var.
- Tek gerçek sekme için `tablist`/`tabpanel`/ok tuşu/roving tabindex kurmak, F-003'te
  reddettiğimiz durumun aynısıdır (CEO kararı D8): bugün olmayan bir şey için desen kurmak.

**Karar:** F-005 `tablist` deseni **kurmaz**. Ayarlar'a geçiş, UX'in tarif ettiği **dişli düğmesiyle**
olur (gerçek `<button>`, `aria-label="Ayarlar"`, etkinken basılı durumu erişilebilir biçimde
belirtilir). Zaman Çizelgesi etiketi F-003'teki gibi `aria-current="page"` taşımaya devam eder.
Tam `tablist` deseni (`role="tablist"`/`tab"`/`tabpanel"`, `aria-controls`, ok tuşları, roving
`tabindex`) **F-007'nin işidir** — Kanban gerçek ikinci sekmeyi getirdiğinde kurulacak.

**Korunan garanti:** panel gizleme yine koşullu render değil `hidden` özniteliğiyle yapılır
(F-003'ün "TimelineScreen hiç unmount olmaz" mutasyon-kanıtlı garantisi bozulmasın). D18'in
kanıt planı (E2E'de gerçek hesaplanmış `display` + mutasyon) aynen geçerlidir.

**F-007'ye devredilen iki taahhüt** (F-005 §9'da ve F-007 brief'inde yer alacak):
1. Tam ve geçerli `tablist` deseni + klavye gezinmesi.
2. AC1'in "kanbanda görünür" kısmının görsel kanıtı (D19).

---

## QA doğrulama — tur 2 (qa-evaluator, 2026-09-05)

KARAR: DÜZELTME
ESKALE: false

Dar doğrulama turu: yalnızca tur 1 bulgularının kapanışı, D16-D19 + en sondaki "CEO kararı —
Ayarlar'ın yeri ve sekme deseninin ertelenmesi" uyumu ve düzeltmenin ürettiği regresyon incelendi.
AC1 daraltmasının meşruluğu, kapsam denetimi, CEO kararları A-H uyumu, stil çitinin tasarımı ve
biçim/üslup **yeniden açılmadı**. Bu turda hiçbir kaynak kodu, config veya `.claude/` dosyası
değiştirilmedi; yalnızca bu bölüm eklendi. `npm view` sorguları salt okuma (registry) yapıldı,
`npm install` çalıştırılmadı, `node_modules`'a hiçbir şey kurulmadı; geçici dizin (8.3 kısa ad
ölçümü) silindi, yetim süreç bırakılmadı.

**Kararın tek nedeni:** sözleşmenin gövdesi, dosyanın en sonundaki **bağlayıcı ve en yeni** CEO
kararından **önce** yazılmış ve o karara göre güncellenmemiş. Developer düzeltme yanıtı (satır 897)
CEO kararından (satır 959) önce geliyor; bu yüzden sözleşme hâlâ CEO'nun F-007'ye ertelediği tam
`tablist` desenini kuruyor ve Bulgu 7'yi "açık CEO sorusu" olarak taşıyor. Diğer 13 bulgunun 11'i
tam, 2'si kısmi kapandı.

### Tur 1 bulgularının kapanış tablosu

| # | Şiddet (tur 1) | Durum | Kanıt |
|---|---|---|---|
| 1 | BLOKLAYICI | **KAPANDI** | D16 uygulanmış: §1 madde 1 (satır 44), §2.1 `project-watcher.ts` (satır 101), §3 madde 1 (satır 157-217) chokidar. `project-watcher.test.ts` satırına (satır 108) "dizin sil → yeniden oluştur → `.md` → `onChange` yine tetiklenir" vakası eklenmiş ve chokidar davranışının **varsayılmadığı**, ölçüleceği açıkça yazılmış (satır 200-206). |
| 2 | BLOKLAYICI | **KAPANDI** (bkz. NOT-2) | §2.1 satır 108: "1 sn boyunca üretilen ham `chokidar` olay sayısı sınırlıdır (üst sınır belirlenip assert edilir, ör. <100)" + "hata fırlamaz gibi ölçmeyen bir assert **kullanılmaz**". Ölçmeyen assert'e geri dönüş yok. Geri dönüş planı somut: `MC_WATCH_POLLING=1` → `usePolling: true` (satır 209-216, §2.1 `project-watcher.ts` satırında da `usePolling: process.env.MC_WATCH_POLLING === '1'` olarak kablolanmış). Tur 1'in "izleyici kapandı" yarısı D16 ile **haklı olarak** düştü (kapatmak, sil+yeniden-oluştur senaryosunu imkânsız kılardı) — çelişki yok. |
| 3 | BLOKLAYICI | **KAPANDI** | `fs.realpathSync.native` tek tanımlayıcı: §3 madde 4 (satır 263-268, `.native` olmayan sürümün "hiçbir yerde çağrılmadığı" açıkça yazılı), §3 madde 7 adım 7 (satır 346), §7 vaka 11 (satır 616), 13 (618), 14 (619), 16 (621). Tekilleştirme testi 6 yazım varyantı: oluşturulduğu hâl · tümü küçük · tümü BÜYÜK · `/` ayraçlı · sondaki ayraçlı · `docs\..` (satır 283-287) → harf farkı ✓, `/` vs `\` ✓. |
| 4 | ÖNEMLİ | **KAPANDI** | Dayanak yazılı ve **kendim doğruladım**: `node_modules/tailwindcss/preflight.css:396` = `[hidden]:where(:not([hidden='until-found'])) { display: none !important; }`, yüklü sürüm `4.3.3` (`node -p "require('./node_modules/tailwindcss/package.json').version"`). §6 satır 322-335: E2E'de **gerçek hesaplanmış `display`** assert'i (`getComputedStyle(el).display === 'none'`), jsdom'un kör olduğu açıkça yazılı; §8 mutasyon 8b (satır 682) `hidden={false}` → E2E KIRMIZI. `playwright.config.ts:19` gerçekten `npm run build && npm start` (doğrulandı) → gerçek CSS. |
| 5 | ÖNEMLİ | **KAPANDI** | §9 madde 1 (satır 713-722) + ADR-012 "Sonuçlar/riskler": `MC_WATCH_POLLING` emekliye ayrılmıyor, iki amaçla yaşıyor; `docs/02-architecture.md`'ye dokunma gereği ortadan kalktı. |
| 6 | ÖNEMLİ | **KAPANDI** | Vaka 16 (satır 621) ölçülen davranışla **KABUL**; vaka 18 (satır 623) tek beklentiye (**KABUL**) indirilmiş, çelişkili parantez yok. |
| 7 | ÖNEMLİ | **KAPANMADI → BLOKLAYICI-1** | CEO cevap verdi ((a) dişli düğmesi + tam tablist F-007'ye ertelendi) ama gövde güncellenmedi. Ayrıntı aşağıda. |
| 8 | ÖNEMLİ | **KAPANDI** | (a) "Depo bilgisi" satırı wireframe'de (satır 468); (b) `registry.isCorrupt()` → §4.3 `registry_corrupt?: true` (satır 419) → §6 banner (satır 483-493) → `SettingsScreen.test.tsx` satırı (satır 118) hem banner'ın göründüğü hem alan yok/`false` iken **hiç** render edilmediği assert'i. |
| 9 | ÖNEMLİ | **KAPANDI** | §7 manifest adım 5b (satır 647-651): "eklenen yol kümesi **tam olarak** harici test aktörünün yazdığı tek `.md`'ye eşittir"; §8 mutasyon 9 (satır 684) izlenen köke dosya **yazan** mutasyon. CEO kararı B artık çitli. |
| 10 | ÖNEMLİ | **KISMİ → YENİ-1** | `watchers` alanı, `getActiveWatcherCount()` ve mutasyon 10 eklendi; ama gözlem mekanizması (`server.close()` **sonrasında** `/api/health` okumak) uygulanamaz. Ayrıntı YENİ-1. |
| 11 | NOT | **KAPANDI** | §2.2 `tests/build-css.test.ts` satırı (satır 141): seçilen sınıfların `src/web/**` ve `src/features/events/web/**` içinde hiç geçmediği `fs.readFileSync`+`includes()` ile **çalışma zamanında** doğrulanıyor, ön koşul sağlanmazsa test kendisi başarısız oluyor — niyet cümlesi değil. |
| 12 | NOT | **KAPANDI** | §9 madde 7 (satır 745-755) — devir maddesi açık, F-007 brief'ine eklenecek cümle yazılı. |
| 13 | NOT | **KAPANDI** | (a) §2.1 `no-delete-guard.test.ts` satırı (satır 110): "taranan dosya sayısı > 0" körlük assert'i, `tests/no-external-host.test.ts:53` deseniyle; (b) §2.1 `projects-api.test.ts` satırı: `GET /api/projects`'in de `isAllowedHost` çitine tabi olduğu. Öncül doğru — `src/server/index.ts:236-240` Host kontrolü tüm `/api/*` yollarını route dispatch'ten önce kapsıyor (okundu). |
| 14 | NOT | **KAPANDI** | §9 madde 2: başlık D16 sonrası doğru; dosya sahipliği satırına `package.json` eklemesi `status: qa` geçişine bağlanmış. |

### D16-D19 + Ayarlar kararı uyum kontrolü

| Karar | Durum | Not |
|---|---|---|
| **D16** — chokidar'a dönüş | **Uygun** (bir kalıntı, NOT-1) | Gövdedeki tüm tasarım/dosya satırları chokidar. Tek kalıntı: §5 AC1 satırı (satır 436) hâlâ "Entegrasyon (gerçek fs + gerçek **`fs.watch`** + gerçek SSE)" diyor. ADR-012 taslağı (satır 564-598) ölçüm sayılarını içeriyor: sağlam dizin 2 ham olay → sil+yeniden-oluştur **0 olay**; fırtına **1 sn'de 112.535 / 3 sn'de 342.548**, ~641 ms CPU/3 sn. Sürüm sabitlemesi `^4.0.3` ve `^5`'in **neden** seçilmediği (engines `>= 20.19.0` vs proje `>=20.11`) yazılı. |
| **D17** — `realpathSync.native` | **Uygun** | Tek tanımlayıcı, §3/§7'de tutarlı (yukarıda Bulgu 3). |
| **D18** — `hidden` kanıtı | **Uygun** | Dayanak + gerçek `display` assert'i + mutasyon 8b; CEO kararı "D18'in kanıt planı aynen geçerlidir" diyor ve plan panel kimliklerinden (`#panel-timeline`/`#panel-settings`) bağımsız olarak korunabilir. |
| **D19** — AC1 devri | **Uygun** | §9 madde 7. |
| **Ayarlar = dişli düğmesi + tam tablist F-007'ye ertelendi** | **UYGULANMADI** | BLOKLAYICI-1. |

### chokidar doğrulaması (kendi ölçümüm, `npm view`, salt okuma)

| Kontrol | Sözleşmenin iddiası | Benim sonucum |
|---|---|---|
| `npm view chokidar@4.0.3 scripts` | install script yok | ✓ DOĞRU — `{lint, test, build, format}`; `preinstall`/`install`/`postinstall` yok |
| `npm view chokidar@4.0.3 dependencies` | yalnızca `readdirp: ^4.0.1`, `fsevents` yok | ✓ DOĞRU |
| `npm view chokidar@4.0.3 engines` | `>= 14.16.0` | ✓ DOĞRU |
| `npm view readdirp@4.0.2 scripts` | install script yok | ✓ DOĞRU — `{nyc, lint, test, build, mocha, format}` |
| `chokidar@5.0.0 engines` | `>= 20.19.0`, projenin `>=20.11` tabanıyla çelişir | ✓ DOĞRU (`readdirp: ^5.0.0`) |
| `fsevents` lock kaydı | `package-lock.json:3331` transitive | ✓ DOĞRU |
| **Ek ölçüm (sözleşmede yok):** `^4.0.1` gerçekte hangi readdirp'i çeker? | — | `readdirp` 4.x'in en yenisi **4.1.2**; `scripts` = `{lint, test, build, format, test:coverage}` → install script **yok**, `dependencies` **boş**, `engines.node >= 14.18.0` → guard yine geçer. Sözleşme 4.0.2'yi doğrulamış ama kurulacak sürüm 4.1.2 (NOT-3). |

**`tests/deps.test.ts` guard değerlendirmesi (dosya okundu, satır 41-67):** üç assert de kod
değişikliği gerektirmeden geçer. (1) `hasInstallScript === true` filtresi — chokidar@4.0.3 ve
readdirp@4.1.2'nin `scripts`'inde install script olmadığı için `package-lock.json`'a
`hasInstallScript` yazılmaz, `offenders` boş kalır; `ALLOWED_INSTALL_SCRIPT_PACKAGES`'a ekleme
**gerekmez**. (2) native derleme aracı assert'i (`node-gyp`/`prebuild-install`/`node-addon-api`/
`nan`) — chokidar v4 → readdirp v4 → **sıfır bağımlılık**, ağaca yeni paket adı girmiyor.
(3) `better-sqlite3` — ilgisiz. `fsevents` özel dalı (`isAllowedFsevents`, satır 26-30) da
etkilenmiyor: chokidar v4 `fsevents`'e bağımlı değil, lock'taki mevcut kayıt `optional:true` +
`os:['darwin']` olarak kalıyor. **Sözleşmenin "guard testi kod değişikliği gerektirmeden geçmeye
devam eder" iddiası doğru.**

### BLOKLAYICI

**BLOKLAYICI-1 — En sondaki CEO kararı (Ayarlar = dişli düğmesi, tam `tablist` F-007'ye ertelendi)
sözleşme gövdesine hiç işlenmemiş; sözleşme hâlâ tablist deseni kuruyor ve Bulgu 7'yi açık soru
olarak taşıyor.**

Beklenen: gövde `role="tablist"`/`tab`/`tabpanel`/roving tabindex/ok tuşu deseni **kurmuyor**;
Ayarlar gerçek bir `<button>` + `aria-label="Ayarlar"` + erişilebilir basılı durum; Zaman Çizelgesi
`aria-current="page"` kalıyor; `hidden` garantisi korunuyor; §6'da **yalnızca dişli seçeneği**.

Gerçek (satır referanslı):

- Satır 61-64 (§1 madde 6): "**Gerçek `tablist`/`tab`/`tabpanel` deseni** (CEO kararı A) —
  `src/web/lib/useTabs.ts` (roving tabindex + ok tuşu gezinmesi)" hâlâ **kapsam içinde**.
- Satır 113 (§2.1): yeni dosya `src/web/lib/useTabs.ts`; satır 122: yeni test
  `tests/web/lib/useTabs.test.ts` — CEO'nun F-007'ye ertelediği iş.
- Satır 123 (§2.1 `settings.spec.ts`): "`Tab`/ok tuşlarıyla sekmeler arası gezinme +
  `aria-selected`/panel görünürlüğünün gerçek DOM'da değiştiği; **Kanban sekmesinin tıklanamadığı
  (gerçek `click()` sonrası aktif sekme değişmez)**" — CEO kararında Kanban statik `<span>` olarak
  kalıyor, `aria-selected` hiç doğmuyor.
- Satır 132 (§2.2 `App.tsx`): "CEO kararı A: gerçek `useTabs(...)` kurulur — **Ayarlar'ın tablist
  içinde mi dışında mı olacağı §9 madde 0'ın açık CEO sorusu**"; satır 137-138 (`App.test.tsx`/
  `App.interaction.test.tsx`) hâlâ (a)/(b) dallanmasına bağlı.
- Satır 300-311 (§3 madde 6): başlık ve gövde `useTabs` otomatik aktivasyon/roving tabindex.
- Satır 441 (§5 test tablosu son satırı): "Sekme deseni (CEO kararı A...) | Birim
  (`useTabs.test.ts`) + ... + E2E (gerçek klavye, gerçek odak)" — güncellenmemiş.
- Satır 501-562 (§6 "Sekme deseni"): başlık hâlâ "**AÇIK SORU**" ve **iki taslak da duruyor**
  ((a) satır 509-525, (b) satır 527-541) → CEO kararıyla doğrudan çelişki. Üstelik hayatta kalması
  gereken (a) taslağı da karara **uymuyor**: içinde `role="tablist"` (satır 511), Zaman Çizelgesi
  için `role="tab" aria-selected="true"` (512-513), Kanban için `role="tab"` (514) ve
  `role="tabpanel"` (518) var; CEO ise Zaman Çizelgesi'nin `aria-current="page"` taşımaya devam
  etmesini istiyor (mevcut `src/web/App.tsx:28` ile aynı).
- Satır 696-711 (§9 madde 0): "**[AÇIK SORU — kod turu başlamadan CEO cevabı gerekiyor]**" —
  cevap dosyanın 40 satır aşağısında duruyor.
- Satır 943-948 ("Kalan açık soru"): "Yalnızca madde 0 ... CEO cevabı bekliyor."

İstenen düzeltme: §1 madde 6'yı "Ayarlar dişli düğmesi + `hidden` ile panel geçişi" olarak yeniden
yaz (tam tablist'i kapsam **dışı** listesine taşı, gerekçe: CEO kararı); `useTabs.ts` ve
`useTabs.test.ts` satırlarını §2.1'den kaldır (App.tsx'te tek bir `activeScreen` state'i yeter —
Karpathy §2); §6'da (b) taslağını sil, (a) taslağını `role="tablist"`/`tab`/`tabpanel`siz hâle
getir (Zaman Çizelgesi/Kanban statik `<span>`, Zaman Çizelgesi `aria-current="page"`, Ayarlar
`<button type="button" aria-label="Ayarlar" aria-pressed={...}>`, paneller `hidden` ile — panel
`id`'leri D18 assert'i için korunmalı); §5'in son satırını ve §2.2'nin `App.tsx`/`App.test.tsx`/
`App.interaction.test.tsx` satırlarını dallanmasız tek bir beklentiye indir; §9 madde 0'ı "CEO
cevabı: (a)" olarak kapat ve "Kalan açık soru" bölümünü güncelle.

### ÖNEMLİ

**ÖNEMLİ-1 — F-007'ye devredilen **iki** taahhütten yalnızca biri §9'da yazılı.**
CEO kararı (satır 989-991): "F-007'ye devredilen iki taahhüt (F-005 §9'da ve F-007 brief'inde yer
alacak): 1. Tam ve geçerli `tablist` deseni + klavye gezinmesi. 2. AC1'in ... görsel kanıtı (D19)."
§9'da yalnızca 2 numaralı taahhüt var (madde 7, satır 745-755). 1 numaralı taahhüt (tam tablist
deseni) §9'un hiçbir maddesinde geçmiyor — ertelenmiş işin kaybolma yolu tam olarak budur (tur 1
Bulgu 12'nin aynısı, bu kez desen tarafında). Düzeltme: §9'a madde 8 olarak, F-007 brief'ine
eklenecek cümleyle birlikte yaz.

**ÖNEMLİ-2 / YENİ-1 (regresyon) — Bulgu 10'un düzeltmesi uygulanamaz bir gözlem yolu tarif ediyor:
`server.close()` **sonrasında** `/api/health` okunamaz.**
- §2.2 `src/server/index.ts` satırı (satır 133): "bu, `stopAll()`'ın gerçekten çağrıldığının **HTTP
  üzerinden gözlemlenebilir tek yolu** (`projects-api.test.ts` `server.close()` öncesi/sonrası
  `/api/health`'in `watchers` alanını okur)".
- §7 (satır 660-666): "N proje eklenir → `watchers === N` → sunucu `server.close()` ile kapatılır →
  `watchers === 0` (veya eşdeğer bir sayaç)".
- Gerçek: `server.close()` yeni bağlantı kabul etmeyi durdurur; kapanıştan sonra atılan
  `GET /api/health` isteği `ECONNREFUSED` alır. Yani tarif edilen assert **hiçbir zaman
  çalıştırılamaz**; mutasyon 10 (satır 686) de bu assert'e dayandığı için kanıtsız kalır.
  "(veya eşdeğer bir sayaç)" kaçış yolu, kod turunda ölçümü keyfî olarak gevşetmeye açık.
- Düzeltme: gözlem yolunu tek ve uygulanabilir biçimde sabitle — ör. `createProjectsService`'in
  döndürdüğü nesnenin `getActiveWatcherCount()`'ı test tarafından **doğrudan** okunur
  (`server.close()` + `'close'` olayı beklendikten sonra `=== 0`); `/api/health`'in `watchers`
  alanı ise **sunucu ayaktayken** ayrı bir assert'le (N proje eklendikten sonra `watchers === N`)
  kapsanır. Aksi hâlde yeni eklenen `watchers` HTTP alanı testsiz kalır.

**ÖNEMLİ-3 / YENİ-2 — Ayarlar dişli düğmesi mevcut E2E çitini kırıyor; `tests/e2e/shell.spec.ts`
§2.2'nin "değişecek dosyalar" listesinde yok.**
- `tests/e2e/shell.spec.ts:41-42`: `page.locator('header button, header a, header [role=button]')
  .count()` → `expect(...).toBe(0)` ("üst çubukta tıklanabilir öğe yok", F-003 CEO kararı D8).
- CEO kararı Ayarlar'ı üst çubukta gerçek bir `<button>` yapıyor → bu assert **yapısal olarak
  KIRMIZI** olur. Aynı sınıf assert jsdom tarafında `tests/web/App.test.tsx:28-37` (`headerHtml`
  `not.toContain('<button')`) için §2.2'de ele alınmış, ama E2E karşılığı hiç anılmıyor; §2.1'de
  `shell.spec.ts` yalnızca `playwright.config.ts` `testMatch` bağlamında geçiyor.
- Düzeltme: `tests/e2e/shell.spec.ts`'i §2.2'ye gerekçesiyle ekle ve yeni beklentiyi tek cümlede
  sabitle (ör. "üst çubukta **tam olarak bir** tıklanabilir öğe var: `aria-label="Ayarlar"`
  düğmesi; `header [role="tab"]` sayısı **0** kalır" — `shell.spec.ts:49-50`'nin `role="tab"`
  sayacı CEO kararıyla artık kalıcı olarak doğru, korunmalı).

### NOT (bloklamıyor, düzeltme turunda birlikte kapatılabilir)

- **NOT-1 (D16 kalıntısı):** §5 AC1 satırı (satır 436) "gerçek `fs.watch`" diyor; chokidar olmalı.
  Gövdedeki tek `fs.watch` kalıntısı bu (diğer tüm geçişler tarihsel/gerekçe bağlamında ve doğru).
- **NOT-2 (fırtına eşiği sabitlenmemiş):** §2.1 satır 108'de üst sınır "ör. <100" ve metrik
  "`process.cpuUsage()` farkı **veya** olay sayacı" olarak **seçenekli** bırakılmış. Sonuca göre
  ayarlama riski: ölçülen `fs.watch` tabanı 1 sn'de 112.535 olay olduğuna göre eşiği tek bir sayıya
  (ör. **1 sn'de < 500 ham olay**) ve tek bir metriğe sözleşmede bağla; ikinci metriği (CPU) ek
  bilgi olarak bırak.
- **NOT-3 (`npm view` referansı):** Sözleşme `readdirp@4.0.2`'yi doğrulamış, ama `chokidar@^4.0.3`
  → `readdirp: ^4.0.1` kurulumda **4.1.2**'yi çeker. Ben doğruladım: 4.1.2'de de install script
  yok, bağımlılığı yok, `engines.node >= 14.18.0` (proje `>=20.11` ile uyumlu) → guard yine geçer.
  Yalnızca §3 madde 1 tablosundaki sürüm referansını 4.1.2 (veya "4.x'in tümü") olarak düzelt.
- **NOT-4 (D17 kapsam kenarı):** Tekilleştirme testinin 6 varyantı 8.3 **kısa ad** (`PROGRA~1`)
  vakasını içermiyor. Bu makinede ölçtüm: `mkdir "Uzun Proje Adi 12345"` sonrası `dir /x` kısa ad
  **üretmiyor** (8dot3 devre dışı) — yani bu depoda reprodüksiyonu yok, bilgi notu olarak
  bırakıyorum, test eklenmesini istemiyorum.

### Kod turuna geçiş

BLOKLAYICI-1 + ÖNEMLİ-1/2/3 kapandığında sözleşme kod turuna hazır; hepsi metin düzeltmesi, yeni
tasarım turu veya yeni CEO kararı gerektirmiyor (CEO kararı zaten verilmiş, yalnızca gövdeye
işlenmemiş). Kod turuna başlamak için eksik olan tek şey, sekme deseninin CEO kararına göre
sözleşmeden çıkarılması.

---

## Developer düzeltme yanıtı — tur 3 (2026-09-05)

Kapsam: yalnızca bu dosya (`docs/qa/F-005-contract.md`) düzenlendi (`git status` bunu doğrular).
`src/`, `tests/`, `scripts/`, `.claude/`, `package.json`, `.github/workflows/ci.yml`,
`docs/02-architecture.md`, `docs/features/**`, `docs/decisions/**`'te hiçbir değişiklik yok. Bu
turda kod çalıştırılmadı, `npm install`/`npm view` çağrılmadı — tur 2'nin ölçümleri (chokidar/
readdirp registry verisi, tailwindcss `preflight.css` dayanağı, `fs.watch`/`realpathSync` ampirik
sonuçları) değişmediği için yeniden doğrulanmadı, yalnızca sözleşme metni CEO kararına göre
yeniden yazıldı.

### Madde bazlı yanıt

| # | Ne değiştirdim | Bölüm/satır |
|---|---|---|
| BLOKLAYICI-1 | Dosya sonundaki CEO kararı ("Ayarlar'ın yeri ve sekme deseninin ertelenmesi") gövdeye işlendi. Gerçek `tablist`/`tab`/`tabpanel`/roving tabindex/ok tuşu deseni (`useTabs.ts` soyutlaması dahil) sözleşmenin **hiçbir yerinde kalmadı**; §1 madde 6 "Ayarlar dişli düğmesi" olarak yeniden yazıldı ve tam desen §1'in kapsam-dışı listesine yeni bir madde olarak taşındı; §2.1'den `src/web/lib/useTabs.ts` ve `tests/web/lib/useTabs.test.ts` satırları kaldırıldı; §2.2'de `App.tsx` satırı tek dallı (`activeScreen` state + `aria-pressed`'li gerçek `<button>`) yeniden yazıldı, `App.test.tsx`/`App.interaction.test.tsx` satırları (a)/(b) dallanmasından kurtarılıp tek beklentiye indirildi; §3 madde 6 başlığı ve gövdesi WAI-ARIA "automatic activation" tartışmasından arındırılıp basit state + CEO kararı gerekçesiyle yeniden yazıldı (D18 kanıt alt bölümü aynen korundu, yalnızca "sekme" → "ekran" terminolojisi düzeltildi); §5'in son satırı "Ayarlar geçişi" olarak yeniden yazıldı; §6'daki (a)/(b) iki taslak tek bir karara uyan taslakla (statik `<span>`lar + `aria-pressed`'li `<button>` + `hidden` panel'ler, `role="tablist"`/`tab`/`tabpanel` yok) değiştirildi; §9 madde 0 "KAPANDI" olarak yeniden yazıldı. | §1 madde 6 (satır 61-70), §1 kapsam dışı (satır 96-99), §2.1 (useTabs satırları kaldırıldı), §2.2 `App.tsx`/`App.test.tsx`/`App.interaction.test.tsx` satırları, §3 madde 6 (satır 309-320), §5 son satır, §6 (satır 513-556), §9 madde 0 (satır 690-699). |
| ÖNEMLİ-1 | §9'a yeni madde 8 eklendi: F-007'ye devredilen **iki** taahhütten eksik kalanı (tam `tablist` deseni + klavye gezinmesi) artık açıkça yazılı — CEO'nun F-007 brief'ine ekleyeceği tam cümleyle birlikte. | §9 madde 8 (satır 746-753). |
| ÖNEMLİ-3 / YENİ-2 | `tests/e2e/shell.spec.ts` §2.2'ye yeni bir satır olarak eklendi: Ayarlar gerçek `<button>` olduğu için mevcut "üst çubukta tıklanabilir öğe yok" (`count()===0`) assert'inin yapısal olarak KIRMIZI olacağı ve yerine geçecek hâlâ ölçen iddia yazıldı — "üst çubukta **tam olarak bir** tıklanabilir öğe var (Ayarlar düğmesi)", `header [role="tab"]` sayısının `0` kalması gerektiği ayrıca korunarak belirtildi. | §2.2 yeni `tests/e2e/shell.spec.ts` satırı. |
| YENİ-1 | Gözlem yolu ikiye ayrıldı çünkü `server.close()` sonrası HTTP isteği atılamaz (`ECONNREFUSED`): (1) sunucu **ayaktayken** `GET /api/health`'in `watchers` alanı N proje eklendikten sonra `=== N` okunur; (2) kapanışın gerçekten olduğu `server.close()`'un `'close'` olayı sonrası `projectsService.getActiveWatcherCount()`'ın **doğrudan** (HTTP'siz) `0` döndüğü assert edilerek kanıtlanır. "(veya eşdeğer bir sayaç)" kaçış yolu kapatıldı — tek, kesin gözlem mekanizması `getActiveWatcherCount()`. | §2.2 `src/server/index.ts` satırı, §7 "İzleyici yaşam döngüsünün gerçek kapanışı" paragrafı, §8 mutasyon 10 satırı. |
| NOT-1 | §5 AC1 satırındaki "gerçek `fs.watch`" ifadesi "gerçek `chokidar`" olarak düzeltildi (D16 sonrası tek kalıntıydı). | §5 AC1 satırı. |
| NOT-2 | Fırtına eşiği tek sayı + tek metriğe sabitlendi: "1 saniyede 500'ün altında ham chokidar olayı" (`watcher.on('all', ...)` ile sayılır), `fs.watch`'ın ölçülen tabanının (1 sn'de 112.535 olay) çok altında; `process.cpuUsage()` farkı yalnızca ek bilgi, assert'in dayanağı değil. Seçenekli "ör. <100"/"CPU **veya** olay sayacı" ifadesi kaldırıldı. | §2.1 `project-watcher.test.ts` satırı. |

### Kalan tutarsızlık

Yok — gövdede (§1-§9) `useTabs`/`tablist`/`role="tab"` hiçbir yerde geçmiyor (tümü ya "F-007'ye
ertelendi" bağlamında bilgi notu ya da tarihsel QA/CEO kayıtlarında, ki onlara bu turda
dokunulmadı); izleyici mekanizması gövdenin her yerinde `chokidar`; fırtına eşiği tek sayı/tek
metrikle sabit. Tarihsel bölümler (tur 1 QA, tur 2 developer yanıtı, CEO kararı, tur 2 QA) zaman
damgalı kayıtlar olduğu için değiştirilmedi — yalnızca bu yeni bölüm eklendi.

---

## CEO onayı — sözleşme KAPANDI (2026-09-05)

QA tur 2'nin açık bıraktığı 6 madde tur 3'te kapatıldı. Dördüncü bir tam QA turu açmak yerine
CEO doğruladı — hepsi dar ve doğrudan denetlenebilirdi:

- **Sekme deseni gövdeden çıktı.** Kalan `tablist` geçişlerinin tamamı **olumsuz** ifadeler
  (satır 68/100/316/544/557: "kurulmaz", "taşımaz", "F-007'ye ertelendi"). §6'da tek taslak kaldı:
  Zaman Çizelgesi `aria-current="page"` ile değişmeden, Kanban statik, Ayarlar gerçek
  `<button aria-label="Ayarlar" aria-pressed={...}>`. `aria-pressed` doğru seçim — Ayarlar bir
  sekme değil, ikili durumu olan bir anahtar düğme.
- **`shell.spec.ts` sahipliğe alındı** ve assert'i ölçmeye devam edecek biçimde güncellendi:
  "üst çubukta **tam olarak bir** tıklanabilir öğe var (Ayarlar)" + `header [role="tab"]` sayısı
  **0 kalır** (CEO kararıyla artık kalıcı olarak doğru). `playwright.config.ts` `testMatch`'i
  `settings.spec.ts`'i de kapsıyor — F-003'te bu unutulsa yeni E2E hiç koşmayacaktı.
- **İzleyici sayacı gözlemi uygulanabilir hâle geldi:** sunucu ayaktayken `/api/health.watchers === N`,
  kapanış sonrası `getActiveWatcherCount()` doğrudan (HTTP'siz) `0`. Önceki plan sunucu
  kapandıktan sonra HTTP okumayı öngörüyordu — hiçbir zaman kanıtlanamazdı.
- **Fırtına eşiği tek sayı, tek metrik:** 1 sn'de **< 500** ham chokidar olayı (satır 129).
  Dayanağı `fs.watch`'ın ölçülen tabanı (1 sn'de 112.535). "Hata fırlamaz" gibi ölçmeyen bir
  assert açıkça yasaklandı.
- **AC1 satırı chokidar'a çevrildi;** gövdedeki `fs.watch` geçişleri yalnızca ADR-012'nin ölçüm
  geçmişinde kaldı.

**Ayrıca kayda değer bir genelleme:** sözleşme, Origin kontrolünü `POST /api/events` özel
durumundan **tüm non-GET `/api/*` uçlarına** çıkarıyor (satır 140). Bu, F-003'ün dersinin
uygulanması: orada `/api/stream` korumadan muaf kalmıştı ve QA'nın mutasyonu 314/314 yeşil
bırakmıştı. Yeni yazma uçları eklenirken aynı boşluğun tekrar açılmasını yapısal olarak engelliyor.

**KARAR: ONAY.** Kod turu başlayabilir.
Bağlayıcı sıra: bu bölüm → `## CEO kararı — Ayarlar'ın yeri...` → CEO kararları **D16-D19** →
CEO kararları **A-H** (A güncellendi) → sözleşme gövdesi → QA tur 2'nin NOT'ları → feature notundaki 6 AC.

**Sözleşme aşaması bilançosu:** 3 developer + 2 QA turu, 14 bulgu + 2 regresyon, **tek satır kod
yazılmadan** kapandı. En pahalı yakalama QA'nın ampirik ölçümüydü: `node:fs.watch` izlenen dizin
silinip yeniden oluşturulunca **sessizce ve kalıcı olarak ölüyor** (2 olay → 0 olay), dizin silinmiş
kalırsa 3 sn'de 342.548 olaylık bir fırtına üretiyor. Bu bir `git checkout` desenidir ve ürün tam
olarak proje depolarını izliyor — yani senaryo günlük. Sözleşme kâğıt üstünde savunulabilirdi;
ölçüm onu çürüttü.

**CEO'nun kendi hatası (kayda geçsin):** Ayarlar/sekme kararı developer'ın turu **bittikten sonra**
sözleşmenin sonuna eklendiği için gövdeye hiç yayılmadı ve yedi yerde çelişki bıraktı. Karar ya
tur başlamadan verilmeli, ya da turun görev listesine "gövdeye yay" maddesi olarak konmalı.

---

## Mutasyon kanıtı (kod turu, 2026-09-05)

Kod ve testler önceki ajan tarafından yazılmıştı ancak hiçbir mutasyon kanıtı diske işlenmemişti;
bu turda §8'in 10 mutasyonunun tamamı sıfırdan koşuldu. Her mutasyon: uygula → izole test dosyasını
çalıştır → KIRMIZI gözlemini kaydet → `Edit` ile birebir geri al → `git diff HEAD -- src/ tests/`
boş olduğunu doğrula. Hiçbiri yeşil kalmadı (testi düzeltme gerektiren yok).

| # | Mutasyon | Koşulan test | KIRMIZI kanıt (hata mesajının ilk satırı) |
|---|---|---|---|
| 1 | `debounce.ts` trailing reset kaldırıldı (`clearTimeout` çağrısı silindi) | `tests/server/watch/debounce.test.ts` | `AssertionError: expected "spy" to not be called at all, but actually been called 2 times` (`callback` 150ms'den önce zaten çağrılmış) |
| 2 | `validate-path.ts`'te `docs/features` varlık kontrolü ters çevrildi (`!fs.existsSync` → `fs.existsSync`) | `tests/features/projects/server/validate-path.test.ts` | `AssertionError: expected false to be true` (vaka 3 dahil 8 vaka KIRMIZI) |
| 3 | `projects-registry.ts` `add()`'teki `findByRealPath` tekilleştirme kontrolü kaldırıldı | `tests/server/store/projects-registry.test.ts` | `AssertionError: expected true to be false` (conflict testi ikinci `add()`'i `ok:true` döndürdü) |
| 4 | `service.ts` `removeProject`'e kasıtlı `fs.unlinkSync(...F-001.md)` eklendi | `tests/integration/projects-api.test.ts` (AC2 manifest testi) | `AssertionError: expected 6 to be 7` (manifest dosya sayısı kaldırma sonrası eksik) |
| 5 | `service.ts`'e gerçek kod olarak `fs.rmSync(target, {recursive:true,force:true})` içeren yeni bir fonksiyon eklendi | `tests/features/projects/no-delete-guard.test.ts` | `AssertionError: expected true to be false` (`service.ts` yasaklı alt dizge `rmSync` içeriyor) |
| 6 | `service.ts`'te `onChange`'e `record.id` yerine sabit `'p_fixed'` geçirildi | `tests/integration/projects-api.test.ts` (AC4 izolasyon + AC5) | `AssertionError: expected 'p_fixed' to be 'p_31a24e'` (3 test KIRMIZI: AC4 izolasyon + AC5 restart) |
| 7 | `index.ts`'teki genelleşmiş Origin kontrolü (`req.method !== 'GET'`) eski özel-duruma (`POST /api/events`) geri alındı | `tests/integration/projects-api.test.ts` (Host/Origin regresyon testi) | `AssertionError: expected 201 to be 403` (cross-origin `POST /api/projects` artık kabul ediliyor) |
| 8 | `App.tsx`'te `hidden` özniteliği yerine koşullu JSX render (`{active==='timeline' && <TimelineScreen/>}`) kullanıldı | `tests/web/App.interaction.test.tsx` | `TestingLibraryElementError: Unable to find an element by: [data-testid="timeline-screen"]` (panel değişince gerçekten unmount oldu) |
| 8b | `App.tsx`'te iki panelin `hidden={...}` ifadesi sabit `hidden={false}`'a değiştirildi | `tests/e2e/settings.spec.ts` (gerçek tarayıcı, `npm run build && npm start`) | `Expected: "none" / Received: "block"` (`#panel-settings`'in gerçek hesaplanmış `display`'i Zaman Çizelgesi aktifken hâlâ `block`) |
| 9 | `service.ts`'in `addProject`'ine izlenen proje köküne `fs.writeFileSync(path.join(added.record.path, '.mc-cache'), 'debug')` eklendi | `tests/integration/projects-api.test.ts` (AC2 manifest testi) | `AssertionError: expected undefined to be defined` (manifest sonrası eklenen `.mc-cache` yolu beklenmeyen bir giriş olarak yakalandı) |
| 10 | `index.ts`'teki `server.on('close', ...)` içinden `projectsService.stopAll()` çağrısı kaldırıldı | `tests/integration/projects-api.test.ts` (izleyici kapanış testi) | `AssertionError: expected 1 to be +0` (`server.close()` sonrası `getActiveWatcherCount()` hâlâ `1`) |

**Sonuç:** 10/10 mutasyon KIRMIZI verdi, hiçbiri testi düzeltmeyi gerektirmedi. Her mutasyon
sonrası `git diff HEAD -- src/ tests/` boş çıktı verdi (geri alma birebir).

### chokidar'ın iki senaryosunun gerçek ölçümü (kod turu, aynı Windows makinesi)

`tests/server/watch/project-watcher.test.ts`'teki iki gerçek-chokidar testi (satır 99, 123)
çalıştırıldı — ikisi de **geçiyor** (`npx vitest run tests/server/watch/project-watcher.test.ts`
→ 5/5 yeşil). Ayrıca sayısal kanıt için bağımsız, tek seferlik bir ölçüm betiği (repo köküne
geçici olarak kopyalanıp çalıştırıldı, sonra silindi — hiçbir dosya kalıcı değil) aynı iki
senaryoyu izole ölçtü:

| Senaryo | `node:fs.watch` (ADR-012 taslağı, tur 1 QA ölçümü) | `chokidar@4.0.3` (bu turda ölçüldü) |
|---|---|---|
| Dizin sil + yeniden oluştur → `.md` yazımı sinyal üretiyor mu | **Hayır** — kalıcı ölüm, 0 olay | **Evet** — `onChange` yine 1 kez tetiklendi (`count === 2` toplamda, testteki ikinci yazım) |
| Dizin silinip silinmiş kalırsa 1 sn'deki ham olay sayısı | 112.535 olay/sn | **0 olay/sn** (`rawEventCount < 500` eşiğinin çok altında) |
| Dizin silinip silinmiş kalırsa 3 sn'deki ham olay sayısı | 342.548 olay | **0 olay** (3 sn boyunca hiç `all` olayı üretmedi) |
| ~3 sn boyunca kullanıcı+sistem CPU | ~641 ms (~%21 çekirdek) | ~3.9 ms (ölçüm hatası payı içinde, ihmal edilebilir) |

**Sonuç:** chokidar, `fs.watch`'ın ölçülen iki kusurunu (kalıcı ölüm + olay fırtınası) **miras
almıyor** — tam tersine, dizin kaybolduğunda kendi iç tanıtıcısını temizce kapatıp yalnızca
`readdirp`'in taramasını durduruyor gibi görünüyor (ham olay sayısı 0). §9'daki "en büyük risk"
kapandı: `MC_WATCH_POLLING=1` geri dönüşüne bu iki senaryo için **gerek kalmadı** — anahtar
mimarideki orijinal amacıyla (ağ sürücüsü/WSL) dokunulmadan duruyor.

---

## Düzeltme turu 2 (2026-09-05) — plan (D25-D28, `docs/qa/F-005-fix1-2026-09-05.md` KOŞULLU GEÇTİ)

QA'nın düzeltme turu 1 doğrulaması KOŞULLU GEÇTİ verdi: 2 ÖNEMLİ açık (ÖNEMLİ-1/ÖNEMLİ-2, CEO
kararlarında D25/D26), + NOT-4 (D27) ve iki NOT (D28) isteğe bağlı. Bu tur SADECE bu dört maddeyi
kapatır; D20-D24 ve önceki turların onaylanan bölümleri yeniden açılmaz.

**D25 (ÖNEMLİ-1) — ne yapılacak:** `src/server/index.ts`'e üretim kodu DEĞİŞTİRİLMEZ (davranış
zaten doğru, QA'nın canlı probu bunu kanıtladı). `tests/integration/projects-api.test.ts`'e gerçek
`createServer()` + gerçek HTTP isteği kullanan yeni bir test eklenir: `handleHealth`'in senkron
çağırdığı gerçek `projectsService.getActiveWatcherCount()` metodu geçici olarak (yalnızca test
içinde, `finally`'de birebir geri alınır) fırlayacak şekilde değiştirilir, `/api/health`'e gerçek
`fetch` yapılır. **Doğrulama:** normal koşuda 500 + `internal_error`, sonra (metot geri alınınca)
200; `index.ts:288`'deki `withDispatchErrorBoundary(` kaldırılırsa (M1) bu test dosyası artık
YEŞİL KALAMAZ (senkron throw dağıtıcının çağrı yığınında sınırsız kalır → süreç/işçi çöker →
kırmızı/hata olarak raporlanır) — mutasyon uygulanıp gözlemlenip geri alınacak.

**D26 (ÖNEMLİ-2) — ne yapılacak:** `useProjects.ts`'in `remove()`'u `add()` ile aynı desene
çevrilir: `{ok:true}` / `{ok:false,message}` döner (yanlış "SSE senkronize eder" yorumu silinir).
`ProjectRow.tsx` sonucu yüzeye çıkarır: `role="alert"` + `docs/03-ux.md` ekran-3 metni ("Liste
kaydedilemedi, tekrar deneyin."), `AddProjectForm`'daki desenle tutarlı. **Doğrulama:**
`useProjects.test.ts`'e 500 vakası (dönen değer + item listede kalır), `SettingsScreen.test.tsx`'e
görünürlük assert'i (alert metni + satır kalır). **Mutasyon:** `if (!res.ok) return`'e geri
dönülür → her iki yeni test KIRMIZI vermeli.

**D27 (NOT-4) — ne yapılacak:** `service.ts`'teki üç çağrı noktası (`addProject`/`removeProject`
sonrası broadcast + `startWatchingIfPossible`'ın debounce callback'indeki `hub.broadcast`)
`safelyNotify()` (küçük, paylaşılan try/catch+log yardımcısı) ile sarılır — yazma zaten başarılı
olduktan sonraki bu yan etkiler süreci düşürmemeli. **Doğrulama:** yeni `tests/features/projects/
server/service.test.ts` — sahte, her zaman fırlayan bir `hub` ile hem senkron (add/remove sonrası)
hem asenkron (gerçek dosya değişikliği + debounce) yolun süreci düşürmediği/sonucu bozmadığı
ölçülür.

**D28 (NOT'lar) — ne yapılacak:** `App.tsx`'teki `style={{minWidth:0}}` + onu haklı çıkaran
yanlış yorum kaldırılır (ölçüm zaten bu satırın gereksiz olduğunu kanıtlamıştı). `no-delete-guard.
test.ts`'teki `projects-registry.ts` istisnası dosya düzeyinden dizge düzeyine daraltılır: yalnızca
tam `unlinkSync(tmpPath)` çağrısına izin verilir, başka herhangi bir `unlinkSync(...)` guard'ı
KIRMIZI vermeye zorlar.

**Kapsam dışı:** F-006, F-007, Faz 2, hook kurulumu, D20-D24'ün yeniden açılması.
