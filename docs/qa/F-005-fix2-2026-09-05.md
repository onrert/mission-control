# QA — F-005 (proje kayıt defteri + chokidar izleme + Ayarlar), düzeltme turu 2 doğrulaması

KARAR: GEÇTİ
ESKALE: false

Tarih: 2026-09-05 · Değerlendiren: qa-evaluator · Tur: düzeltme turu 2 (dar doğrulama, F-005'in 3. QA turu)
Değerlendirilen commit: `b71f3e0` (düzeltmeler: `623a7bb` D25 · `10bb034` D26 · `c0d2c76` D27 · `9c47afc` D28)
Önceki raporlar: `docs/qa/F-005-2026-09-05.md` (KALDI), `docs/qa/F-005-fix1-2026-09-05.md` (KOŞULLU GEÇTİ)
Kapsam: yalnızca D25-D28'in kapanışı + düzeltmenin ürettiği regresyon. D20-D24, chokidar ölçümü,
manifest testi, kapsam/güvenlik denetimi, 375px görsel teyidi ve sekme deseni **yeniden açılmadı**.

**GEÇTİ ne demek:** Önceki turun iki açık ÖNEMLİ bulgusunun (ÖNEMLİ-1 ölçülmeyen çit, ÖNEMLİ-2
sessiz "Kaldır") ikisi de kendi mutasyonlarımla kapandığı ölçüldü; açık BLOKLAYICI/ÖNEMLİ yok,
dört boyutun hiçbiri < 7. Kalan altı madde NOT seviyesindedir ve karar üzerinde etkisi yoktur.

## Puanlar

| Boyut | Puan (önceki) | Gerekçe |
|---|---|---|
| İşlevsellik | **9** (8) | Önceki turun tek işlevsel kusuru (başarısız DELETE'in istemcide sessizce yutulması) kapandı ve **gerçek tarayıcıda** doğrulandı: 375px'te `role="alert"` ile "Liste kaydedilemedi, tekrar deneyin." göründü, satır yerinde kaldı, düğme yeniden etkinleşti, engel kalkınca aynı düğme başarıyla sildi (§4). Ayrıca D27 ile gerçek chokidar debounce yolundan fırlayan bir `hub.broadcast` artık süreci düşürmüyor — canlı harness ile ölçüldü (§3, M3). |
| Özellik bütünlüğü | **9** (8) | D25-D28'in dördü de uygulanmış **ve ölçülüyor**; feature notu ile `progress.md` turu doğru anlatıyor, ertelenen maddeler (F-007 375px sekme kriteri) sözleşmeye taşınmış. Kalan yüzeyler (NOT-1/NOT-2) yeni değil, aynı sınıfın kenar dalları. |
| Görsel/UX | **8** (7) | Hata geri bildirimi artık dar panelde de tam görünür ve sayfa yatay taşmıyor (`scrollWidth 375 = viewport 375`). "Kaldır" düğmesi istek sırasında `kaldırılıyor…` olup devre dışı kalıyor, hata sonrası geri dönüyor. Marka kırpılması (NOT-4) bilinçli borç olarak F-007'ye taşındı. |
| Kod kalitesi | **8** (7) | 6 bağımsız mutasyonun **5'i KIRMIZI**. Önceki turda yeşil kalan iki mutasyon (sınırın bağlantısı, guard'ın registry istisnası) artık kırmızı; ölü satır ve gerçeğe uymayan yorum gitmiş. Tek yeşil kalan (M5) statik guard'ın dar bir kör noktası ve dinamik manifest testi bunu zaten yakalıyor. Kalan puan kaybı: `safelyNotify` closure granülerliği ve `stopAll`'ın sarılmamış olması (NOT-1/NOT-2). |

**Karar kuralı:** açık BLOKLAYICI/ÖNEMLİ yok + tüm puanlar ≥ 7 → **GEÇTİ**.

## 1. Komutlar ve gerçek çıktılar (hepsi kendim çalıştırdım)

| Komut | Sonuç | Çıkış |
|---|---|---|
| `npm run verify` (temiz ağaç, tur başı) | **Test Files 37 passed (37)** · **Tests 437 passed (437)** · `vite build ✓ built in 955ms` (`dist/web/assets/index-BoXlmb-4.css` 15.34 kB) | 0 |
| `npm run verify` (temiz ağaç, tüm mutasyonlar geri alındıktan sonra) | **37 passed (37)** · **437 passed (437)** · `✓ built in 951ms` | 0 |
| `npm run e2e` | **15 passed (15.8s)** | 0 |
| `npm run e2e:dev` | **1 passed (4.4s)** | 0 |

Developer'ın ve CEO'nun bildirdiği sayılar (**37 dosya / 437 test**, e2e 15, e2e:dev 1) **birebir
doğrulandı**. Feature notu frontmatter'ı tur başında `status: qa` idi (doğrulandı), rapor sonrası
`status: done` yapıldı.

## 2. D25-D28 kapanış tablosu

| Karar | Durum | Kanıt |
|---|---|---|
| **D25** (ÖNEMLİ-1) — dağıtıcı sınırının **bağlantısı** ölçülsün | **KAPANDI** | `tests/integration/projects-api.test.ts:619-653`. Test **davranışsal**, kaynak metni taramıyor: gerçek `createServer(0, dataDir)` + gerçek `fetch(baseUrl + '/api/health')`; üretim kodu değişmiyor, yalnızca `handle.server.projectsService.getActiveWatcherCount` test içinde geçici olarak fırlatacak şekilde değiştirilip `finally`'de geri alınıyor. Assert'ler: `500` + `error.code === 'internal_error'`, ardından metot geri alınınca ikinci istek `200` (süreç yaşıyor). **M1 mutasyonu artık KIRMIZI** (§3). |
| **D26** (ÖNEMLİ-2) — başarısız "Kaldır" kullanıcıya görünsün | **KAPANDI** | `src/features/projects/web/useProjects.ts:97-118` (`remove()` artık `add()` ile aynı `{ok:true}` / `{ok:false,message}` sözleşmesini döndürüyor, yanlış "SSE senkronize eder" yorumu silinmiş), `src/features/projects/web/ProjectRow.tsx:40-53, 83-95` (`role="alert"` + `data-testid="remove-project-error"`, istek sırasında `disabled`). Testler: `tests/features/projects/web/useProjects.test.ts:75-116`, `tests/features/projects/web/SettingsScreen.test.tsx:127-156`. **M2 mutasyonu ikisini de KIRMIZI yapıyor** (§3). **Canlı tarayıcı gözlemi §4'te.** |
| **D27** (NOT-4) — asenkron yan etki yüzeyi | **KAPANDI** | `src/features/projects/server/service.ts:74-81` `safelyNotify()`; **üç çağrı noktasının üçü de sarılı**: `:97-100` (chokidar debounce geri çağrımındaki `features` yayını), `:145-148` (`addProject` → izleme başlatma + `projects` yayını), `:162-169` (`removeProject` → izleme durdurma + `projects` yayını). `grep -n "broadcast\|watchProjectFeatures"` ile sayıldı: sarılmamış `hub.broadcast` **yok**. Test: `tests/features/projects/server/service.test.ts:1-112`. **M3: hem birim testi KIRMIZI hem canlı harness'ta süreç ölüyor** (§3). |
| **D28** (NOT-1/NOT-2) — doğrulanmamış iddia kalmasın | **KAPANDI** | (a) `src/web/App.tsx:38` — `style={{ minWidth: 0 }}` **kaldırılmış**, `grep -n minWidth src/web/App.tsx` → yalnızca `:34`'teki "burada daha önce vardı, ölçüm doğrulamadı, kaldırıldı" açıklaması. Gerçeğe uymayan 10 satırlık gerekçe yorumu gitmiş. (b) `tests/features/projects/no-delete-guard.test.ts:68-75` — istisna **dize seviyesinde**: `content.match(/unlinkSync\([^)]*\)/g)` ile bulunan **her** çağrı `unlinkSync(tmpPath)` olmak zorunda, ayrıca `calls.length > 0` körlük assert'i var. **M4 KIRMIZI** (§3). |

## 3. Kendi mutasyon tablom

Her mutasyon: yedekten uygula → hedef testi/harness'ı koş → gözlem → **birebir geri al** (md5 karşılaştırmalı).
Developer'ın listesini kopyalamadım; M5 ve M6 onun planında olmayan iki ek prob.

| # | Mutasyon (dosya:satır) | Koşulan şey | Sonuç · hata mesajının ilk satırı | Geri alındı |
|---|---|---|---|---|
| M1 | `src/server/index.ts:289` — sınırın **bağlantısı** kaldırıldı (`withDispatchErrorBoundary((req,res)=>{` → `((req,res)=>{`) | tüm süit + tek dosya | **KIRMIZI** — `Test Files 1 failed \| 36 passed (37)` · `Tests 1 failed \| 436 passed (437)` · `Errors 1`; tek dosyada `FAIL … D20/ÖNEMLİ-1 bağlantı kanıtı` + `Error: Test timed out in 5000ms.` + `Uncaught Exception: Error: qa-probe-sync` (yığın: `src/server/index.ts:314` → `handleHealth :215` → `Server.<anonymous> :308`). **Önceki turda aynı mutasyon 430/430 YEŞİL kalıyordu.** | ✓ |
| M2 | `useProjects.ts:107-118` — `remove()` `if (!res.ok) return` hâline döndürüldü (hata yutuluyor) | `tests/features/projects/web` | **KIRMIZI (2)** — `FAIL SettingsScreen > Kaldır hatası…` + `FAIL useProjects — remove() (D26…)`; `AssertionError: expected { ok: true } to deeply equal { ok: false, …(1) }` | ✓ |
| M3 | `service.ts:97-100` — debounce geri çağrımındaki `safelyNotify` sarmalayıcısı kaldırıldı, `hub.broadcast` fırlatıyor | (a) `service.test.ts` (b) **canlı harness: gerçek chokidar + gerçek dosya yazımı** | (a) **KIRMIZI** — `AssertionError: expected [Function] to not throw an error but 'Error: sse yayını başarısız (qa-probe)' was thrown`. (b) **Süreç ÖLDÜ** — `UNCAUGHT (would normally kill process): sse yayini basarisiz (qa-live-probe)` · `EXIT=3`. Mutasyonsuz hâlde aynı harness: `STEP3 SURVIVED: process alive after debounce fired; watchers= 1` · `EXIT=0`. **İkisi de ölçüldü.** | ✓ |
| M4 | `projects-registry.ts:83` — `fs.unlinkSync(tmpPath)` → `fs.unlinkSync(path.join(projects[0]?.path ?? tmpPath, 'README.md'))` (izlenen proje dosyasını hedefliyor) | `no-delete-guard.test.ts` | **KIRMIZI** — `AssertionError: expected 'unlinkSync(path.join(projects[0]?.pat…' to be 'unlinkSync(tmpPath)'`. Önceki turda aynı sınıf mutasyon (M7) guard'dan geçiyordu. | ✓ |
| M5 | `projects-registry.ts:83` sonrası — hiç çağrılmayan `fs.promises.unlink(path.join('C:/qa-nonexistent','README.md'))` eklendi | `no-delete-guard.test.ts` | **YEŞİL — 12/12** ⚠ NOT-3: daraltılmış istisna yalnızca `unlinkSync(` desenine bakıyor, `fs.promises.unlink(` statik olarak hâlâ görünmez. (Dinamik manifest testi bunu yakalar — risk kapalı, çit dar.) | ✓ |
| M6 | `service.ts:166` — `safelyNotify` closure'ının **içindeki** `watchers.delete(id)` kaldırıldı (D21 çitinin restrüktürden sağ çıkıp çıkmadığı) | tüm süit | **KIRMIZI (2)** — `FAIL … izleyici sayacı: kaldırma sonrası /api/health.watchers === N-1 (QA M7 çiti)` · `AssertionError: expected 2 to be 1`; ayrıca `FAIL service.test.ts > removeProject…` · `expected 1 to be +0`. D27'nin yeniden düzenlemesi D21 çitini **nötrleştirmemiş**. | ✓ |

**Sonuç: 5 KIRMIZI / 1 YEŞİL.** Önceki turun iki yeşil mutasyonu (M1 sınır bağlantısı, guard
registry istisnası) artık kırmızı; tek yeşil kalan M5, önceki turun NOT-1'inin daralttıktan sonra
geriye kalan dar kalıntısıdır.

**Mutasyon koşularında bir kez altyapı gürültüsü (NOT-5):** M6 koşusunda bir vitest worker'ı
`Worker exited unexpectedly with exit code 3221226505 … tests/integration/sse-stream.test.ts`
ile düştü (`Test Files 2 failed | 34 passed (37)`, yani 37 yerine 36 dosya raporlandı). Önceki
turda da bir kez görülmüştü (NOT-5). Temiz ağaçtaki **iki** tam `verify` koşusu ve iki e2e koşusu
tertemiz; ürün kodu bulgusu değil.

## 4. "Kaldır" hatasının canlı gözlemi (görev maddesi 2)

Kurulum: `npm run build` sonrası üretim build'i, `MC_PORT=7433` + **izole `MC_DATA_DIR`**
(scratchpad; gerçek `data/` klasörüne dokunulmadı), fixture proje scratchpad altında
(`qa2proj/docs/features/F-100.md`). Tarayıcı: Playwright chromium, **375×700**.

Adımlar ve gerçek çıktılar:

```
1) POST /api/projects              -> {"success":true,...,"id":"p_6adeff","feature_count":1}
2) projects.json bir DİZİNLE işgal edildi   -> blocked: true
3) curl -X DELETE /api/projects/p_6adeff    -> 500          (sunucu yarısı doğru)
4) Tarayıcı: Ayarlar dişlisi -> "Kaldır" tıklandı
   alertCount            : 1
   alerts                : ["⚠ Liste kaydedilemedi, tekrar deneyin."]
   remove-project-error  : "⚠ Liste kaydedilemedi, tekrar deneyin."
   project-row sayısı    : 1        (satır YERİNDE kaldı)
   buton metni/durumu    : "Kaldır" / disabled=false   (yeniden ETKİN)
5) İkinci tıklama                  -> aynı tek alert, satır duruyor, alert çoğalmıyor
   document.scrollWidth 375 = viewport 375   (yatay taşma yok)
6) Engel kaldırıldı -> "Kaldır"    -> alerts: [], project-row: 0,
                                      "Henüz izlenen proje yok…" boş durumu
7) GET /api/health                 -> ok:true, watchers:0, uptime_s 106  (süreç hiç ölmedi)
   disk: {"version":1,"projects":[]}          ".tmp" artığı: 0
```

**Üç sorunun üçü de EVET:** hata mesajı görünüyor · satır yerinde kalıyor · düğme yeniden
etkinleşiyor. Üstüne kurtarma yolu da çalışıyor (engel kalkınca ilk tıklama başarılı).

Ekran görüntüsü: `docs/qa/screens/F-005-fix2-2026-09-05.png` (375px, kırmızı `⚠ Liste
kaydedilemedi, tekrar deneyin.` satırı, altında proje satırı ve "Kaldır" düğmesi duruyor).

Önceki turda aynı senaryoda ölçüm `role="alert"` sayısı **0**, sayfa metninde "Liste
kaydedilemedi" **yok** idi — ÖNEMLİ-2 kapandı.

## 5. Regresyon kontrolü (görev maddesi 5)

- `verify` (2×), `e2e`, `e2e:dev` — hepsi 0 çıkış, sayılar §1'de. **Ekle yolu** bozulmadı
  (`tests/e2e/settings.spec.ts:70` geçersiz yol satır içi kırmızı hata + canlı ekranda Ekle formu
  yerinde), **SSE `projects`/`features` çerçeveleri** bozulmadı (`timeline.spec.ts:327` kopma/
  toparlanma ve `:429` kalıcı hata testleri geçti; `sse-stream.test.ts` süitte), **izleyici
  sayacı** çiti hâlâ ölçüyor (M6 KIRMIZI), **shutdown** yolu geçti (`graceful-shutdown.test.ts`).
- `settings.spec.ts:82` "kaldırma: satır kalkar + fixture disk manifesti değişmez" geçiyor —
  yani D26'nın `res.json()` ayrıştırmaya geçişi **mutlu yolu** bozmadı.
- D27'nin yeniden düzenlemesi `addProject`/`removeProject`'in dönüş sözleşmesini değiştirmedi
  (`ok:true` + `item`/`removed`), M6 ve canlı ölçüm (watchers 1 → 0) bunu doğruladı.
- `git diff b71f3e0..HEAD` boş (yeni commit atılmadı); düzeltme commit'lerinin dokunduğu dosya
  kümesi sözleşmenin ilan ettiğiyle örtüşüyor, kapsam sızması yok.

## 6. Bulgular (0 BLOKLAYICI · 0 ÖNEMLİ · 6 NOT)

### NOT-1 — `safelyNotify` closure'ının granülerliği: bir hata, kardeş yan etkiyi de yutuyor
`src/features/projects/server/service.ts:145-148` ve `:162-169`. İki yan etki (izleme başlatma/
durdurma **ve** SSE yayını) **tek** closure içinde. Sonuçları: (a) `removeProject`'te
`watcher.stop()` fırlarsa hemen ardındaki `watchers.delete(id)` hiç çalışmaz → kayıt silinmiş
olmasına rağmen `watchers` haritasında ölü giriş kalır (`/api/health.watchers` yalan söyler);
(b) `addProject`'te `startWatchingIfPossible` fırlarsa `hub.broadcast('projects', …)` atlanır →
bağlı istemciler yeni projeyi yeniden yükleyene kadar görmez. Bilinen tetikleyicisi yok
(chokidar hataları event olarak yayılır, `stop()` fırlatmaz), süreç ölmüyor, veri güvende —
bu yüzden NOT. Öneri: her yan etkiyi ayrı `safelyNotify` çağrısına al (`stop`, `delete`,
`broadcast`), böylece biri diğerini bloklamaz.

### NOT-2 — `stopAll()` hâlâ sarmalayıcısız, üstelik kapanış yolunda
`src/features/projects/server/service.ts:173-178` içindeki `watcher.stop()` `safelyNotify`
dışında; çağıranı `src/server/index.ts:369-370`'teki `server.on('close', …)` dinleyicisi, yani
D27'nin kapattığı yüzeyle **aynı sınıf** bir asenkron yığın. Buradan fırlayacak bir hata
`graceful shutdown`'ı yarıda keser. D27 üç çağrı noktasını kapsıyordu ve brief de üçünü
istiyordu; bu dördüncüsü kapsam dışıydı — bu yüzden bulgu değil, kalıntı NOT.

### NOT-3 — daraltılmış guard istisnası `fs.promises.unlink(` için hâlâ kör
`tests/features/projects/no-delete-guard.test.ts:70` deseni `/unlinkSync\([^)]*\)/g`. **M5**:
`projects-registry.ts`'e hiç çağrılmayan bir `fs.promises.unlink(...)` eklendi → guard **12/12
yeşil**. D28 istenen daraltmayı yaptı (dosya → dizge seviyesi) ve `unlinkSync` için artık
sağlam; asenkron `fs.promises.*` ailesi taranmıyor. Risk dinamik manifest testiyle kapalı.
Öneri (ucuz): registry istisnasına `expect(content.includes('promises.unlink')).toBe(false)`
satırı ekle.

### NOT-4 — 375px kozmetik borcu (önceki turdan devir)
Marka "MISSION CONTRO" olarak kırpılıyor, nav etiketleri kaydırma şeridinde. Bu turda da aynı
(ekran görüntüsünde görünüyor). F-007'nin kabul kriterine taşınması `docs/qa/F-005-contract.md`
ve `cdd4bd9` ile zaten kayıt altında. Karar üzerinde etkisi yok.

### NOT-5 — vitest worker fork kararsızlığı bir kez daha görüldü
M6 koşusunda `Worker exited unexpectedly with exit code 3221226505` (`sse-stream.test.ts`).
Önceki turda da 5 koşudan 1'inde benzeri olmuştu. Zincir sessizce yeşile dönmüyor (dosya sayısı
37 yerine 36 raporlanıyor, koşu hata veriyor), ama **sayıları okumadan "geçti" demek riskli** —
CI'da `Test Files 37 passed (37)` ifadesini birebir doğrulayan bir kontrol düşünülebilir.

### NOT-6 — `remove()` hata mesajı gövde ayrıştırılamadığında tahmine düşüyor
`src/features/projects/web/useProjects.ts:107-118`: yanıt gövdesi JSON değilse (`res.json()`
fırlarsa) `catch` sabit "Liste kaydedilemedi, tekrar deneyin." döndürür — ağ kopması ve
"sunucu JSON dışı 502 döndü" durumları aynı metni gösterir. Bugünkü sunucu her hata yolunda JSON
döndürdüğü için pratik etkisi yok; `add()` de aynı deseni kullanıyor, yani tutarlı.

## 7. Temizlik kanıtı

- **Çalışma ağacı:** 6 mutasyonun tamamı yedekten geri alındı; her dosyanın **md5'i** tur başındaki
  değerine birebir eşit — `index.ts 207db7ac…`, `service.ts 466243c5…`, `useProjects.ts b2157610…`,
  `ProjectRow.tsx de785019…`, `projects-registry.ts 6e3c0af8…`, `App.tsx 1209fbef…`,
  `no-delete-guard.test.ts 9bfb419b…`. **`git diff HEAD` tamamen boş.** `git status --porcelain`
  yalnızca bu turda eklenen ekran görüntüsünü (`?? docs/qa/screens/F-005-fix2-2026-09-05.png`)
  listeliyor. Ürün kodu **kalıcı olarak değiştirilmedi**; commit atılmadı, `git push` /
  `install-hook` çalıştırılmadı. Geri alma sonrası `npm run verify` yeniden **37/437 + build ✓**.
- **Süreçler/portlar:** QA sunucusu (pid 21324, tsx sarmalayıcısı 36756) `taskkill /T /F` ile
  düşürüldü; ikisi de `tasklist`'te yok. `netstat -ano | grep LISTENING` →
  **7333/7334/7335/7433/7434'te dinleyen yok**. Kalan iki `node.exe` (pid 13600, 31104) oturum
  başında açılan Playwright MCP sunucusuna ait, benim bıraktığım yetim değil.
- **Veri:** tüm geçici veri dizinleri, fixture projeler ve canlı harness (`d27-harness.mts`)
  yalnızca scratchpad altında; **gerçek proje klasörlerine ve `data/`'ya hiçbir şey yazılmadı**.
  `.playwright-mcp/` zaten `.gitignore`'da.

## 8. Kapanış

Açık madde yok. Feature notu `status: done` yapıldı. NOT-1/NOT-2/NOT-3 isteğe bağlı ve tek
satırlık iyileştirmeler; F-006/F-007 sırasında aynı dosyaya dokunulduğunda ele alınabilir.
NOT-4 zaten F-007 sözleşmesine taşındı.
