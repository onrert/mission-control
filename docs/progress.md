# progress.md — kaldığımız yer

Her oturum sonu CEO/developer ekler: tarih · ne yapıldı · nasıl doğrulandı · kalan risk · sonraki adım.

> Bu klasör `C:\dev\app-factory` şablonundan kopyalandı. Şablonun kendi kurulum/kalibrasyon geçmişi orada durur; buradaki kayıtlar yalnızca **Mission Control** projesine aittir.

---

## 2026-09-04 — G0 geçildi (fikir kapısı)

**Ne yapıldı**
- `/new-app` akışı `C:\dev\app-factory` oturumunda başlatıldı; gerçek proje bu kopya klasörde (`C:\dev\apps\mission-control`) yürüyecek.
- Kullanıcı kararları alındı: kapsam **2 fazlı** · panel **tam yazma** yetkili (kanban frontmatter + kapı `.ok`/`.deny.md`) · arayüz **Türkçe** · fikir doğrulaması **tam** yapıldı.
- `docs/00-idea.md` dolduruldu (problem, başarı ölçütü, Faz 1/Faz 2, kesinlikle olmayacaklar, doğrulama özeti, G2'yi bağlayan kısıtlar).
- `idea-validator` çalıştırıldı → `docs/00-idea-validation.md` (7 benzer araç, yap-yerine-kullan değerlendirmesi, 4 teknik risk, MVP önerisi). Karar: **DARALT**.
- Kullanıcı G0'ı onayladı → `docs/approvals/G0.ok` yazıldı.

**Nasıl doğrulandı**
- Kopya klasör şablonla birebir aynıydı (`diff -rq` farksız), yani temiz başlangıç.
- Doğrulama raporundaki her iddia kaynak linkiyle verildi (resmi Claude Code hooks/observability dokümanları + 12 OSS proje).

**Nerede durduk**
- G0 onaylı. **G1 (PRD) başlamadı** — `pm` agent'ı henüz çalıştırılmadı, `docs/01-prd.md` boş şablon.
- Kod yok, `src/` yok, git deposu yok (kopyada `.git` bulunmuyor — ilk feature'da `git init` + iskelet commit'i gerekecek).

**Kalan risk**
- `~/.claude/projects/**/*.jsonl` transkript formatı belgesiz (YÜKSEK): Faz 2'nin Thread + Token ekranlarını tehdit ediyor. Kod yazmadan önce kurulu Claude Code sürümünde gerçek dizin yapısı elle doğrulanmalı (`.../subagents/agent-*.jsonl` yolu varsayım).
- Hook payload şeması stabilite garantisiz (ORTA): `send-event.js` savunmacı yazılmalı, ham olay saklanmalı.
- Port 4000 en az iki benzer araçla çakışıyor: varsayılan değiştirilmeli, env ile yapılandırılabilir olmalı.
- `better-sqlite3` Windows'ta native derleme sürtünmesi (ORTA): düz JSONL depo tercih edilecek — architect G2'de karara bağlayacak.

**Sonraki adım**
1. Bu klasörde (`C:\dev\apps\mission-control`) yeni bir Claude oturumu aç — hook'lar (özellikle G2 kod yazma koruması) yalnızca proje kendi çalışma dizininde açıldığında işler.
2. CEO `pm` agent'ına PRD brief'i versin: kaynak `docs/00-idea.md` + `docs/00-idea-validation.md` + `docs/specs/mission-control.md`; Faz 1/Faz 2 ayrımı ve G0.ok'taki daraltmalar bağlayıcı.
3. PRD sonrası G1 onayı → `docs/approvals/G1.ok`.
4. Ardından `ux` + `architect` paralel; architect'in **açık ADR görevi**: olay sunucusunu sıfırdan yazmak mı, mevcut OSS'i (disler/claude-code-hooks-multi-agent-observability) uyarlamak mı — lisans, stack uyumu (onlar Bun+Vue, biz Node+Vite/React) ve bakım yükü karşılaştırılacak.

---

## 2026-09-04 — G1, G2, G3 geçildi; kod öncesi tüm dokümanlar hazır

**Ne yapıldı**
- PRD yazıldı ve onaylandı (`docs/01-prd.md`, 6 özellik, ölçülebilir kabul kriterleri) → `approvals/G1.ok`.
- PRD'nin 8 açık sorusu kapatıldı: 3'ü kullanıcıya soruldu (yalnızca localhost · tüm olay tipleri + filtre · onayda doğrulama, rette zorunlu gerekçe), 5'i CEO kararı olarak `ADR-001`'e yazıldı.
- `ux` → `docs/03-ux.md` (474 satır): 6 ekran, 7 kritik akış, durum tasarımı, koyu "sefer tablosu" teması, Türkçe metin sözlüğü, erişilebilirlik. → `approvals/G3.ok`.
- `architect` → `docs/02-architecture.md` (1019 satır, 17 bölüm) + ADR-002…ADR-007. → `approvals/G2.ok`.
- Kullanıcı G2'de 3 kararı verdi: kendi minimal token okuyucumuz (ADR-007, G0 daralmasından onaylı sapma) · Faz 2'de önce F-008 kapılar paneli, sonra F-009 spike · veri deposu repo içinde `data/` (gitignore'lu).
- CEO 11 feature notu oluşturdu: `docs/features/F-001…F-011.md`, hepsi `status: todo`.

**Nasıl doğrulandı**
- `src/` oluşmadı, kod yazılmadı (G2 öncesi kısıt korundu).
- ADR-002 iddiaları kaynakla doğrulandı: `disler/...` deposu lisanssız (türev çalışma üretilemez), `hook-lab` Elixir+Phoenix+Docker → "lisans uygunsa uyarla" koşulu sağlanmadı, sunucu sıfırdan yazılacak.
- ADR-007'deki transkript yolları diskte gerçekten gözlemlendi (tahmin değil): `<session-uuid>/subagents/agent-<id>.jsonl` + `agent-<id>.meta.json` içinde `agentType`; dizin adı kodlaması harf duyarsız eşleşmeli.
- Tahmini aylık maliyet 0 TL, 8 kalemli tabloyla doğrulandı.

**Nerede durduk**
- G0, G1, G2, G3 onaylı. Kod yazımı serbest ama HENÜZ BAŞLAMADI.
- Sıradaki iş: **F-001 iskelet** (git init, Vite/React/TS/Tailwind kabuğu, `node:http` sunucusu + `/api/health`, Vitest + Playwright, CI, `npm run verify`).
- Faz 1 sırası: F-001 → F-002 → F-004 → F-003 → F-005 → F-006 → F-007. (F-006 yazma kapısı F-007'den önce bitmek zorunda.)

**Kalan risk**
- Bu klasörde hâlâ git deposu yok; tüm dokümanlar versiyonsuz. F-001'in ilk işi `git init` + baseline commit.
- G0–G3 arası tüm çalışma `C:\dev\app-factory` oturumundan mutlak yollarla yürütüldü (şablona yazılmadı, doğrulandı). Kod aşaması için bu KABUL EDİLEMEZ: hook'lar yalnızca proje kendi çalışma dizininde açıldığında devreye girer.
- `docs/features/F-000-template.md` silindi (kullanıcı onayıyla, 2026-09-04) — panel kendini izlediğinde kanbanda hayalet kart oluşturmasın diye. Şablonun aslı `C:/dev/app-factory/docs/features/F-000-template.md` içinde duruyor.
- Faz 2'nin transkript bağımlılığı hâlâ en kırılgan yer; F-009 spike'ı bunu ölçecek.

**Sonraki adım**
1. `C:\dev\apps\mission-control` klasöründe yeni Claude oturumu aç.
2. CEO'ya "F-001'i başlat" de → developer sözleşmesi (`docs/qa/F-001-contract.md`) → kod → qa-evaluator → G4-1.

---

## 2026-09-04 — F-001 (iskelet) KOŞULLU GEÇTİ

**Ne yapıldı**
- Sözleşme turu: 3 tur (developer ↔ qa-evaluator), 26 bulgu kod yazılmadan kapatıldı. Sözleşme `docs/qa/F-001-contract.md` (ONAY, tur 3).
- Kod turu: iskelet yazıldı — Vite/React/TS/Tailwind koyu kabuk, `node:http` sunucusu (`/api/health`), self-host fontlar (4 woff2 + OFL lisansları), Vitest + Playwright (prod ve dev ayrı config), `.github/workflows/ci.yml`, `npm run verify`.
- QA kod turu: **KALDI** — 1 bloklayıcı (AC10) + bağımsız bulgular.
- Düzeltme turu 1 → QA doğrulama: **KOŞULLU GEÇTİ**. Puanlar: İşlevsellik 9 · Bütünlük 9 · Görsel/UX 8 · Kod kalitesi 8.
- Commit'ler: `803e466` scaffold · `658f692` README lisans notu · `bfd907b` düzeltme turu 1.

**Nasıl doğrulandı**
- `npm run verify` (typecheck + lint + 41 test/6 dosya + build) = 0 · `npm run e2e` = 0 · `npm run e2e:dev` = 0 · temiz `git clone` + `npm ci` + `verify` = 0 · `npm audit` = **0 zafiyet**.
- QA 4 mutasyon çalıştırdı, 4'ü de kırmızı verdi: başlık geri alınınca E2E `Received: "MİSSİON CONTROL"`, `fsevents.optional=false` → guard kırmızı, `os:[darwin,linux]` → kırmızı, sahte `node-gyp` → kardeş assert kırmızı. Testler gerçekten ölçüyor.
- Ekran görüntüleriyle gözle doğrulandı: `docs/qa/screens/fix1-desktop-1280.png`, `fix1-mobile-390.png`.

**Yakalanan en önemli hata**
- Başlık ekranda **"MİSSİON CONTROL"** görünüyordu: sayfa `lang="tr"` + CSS `uppercase` → Türkçe locale'de `i` → `İ` (U+0130). Playwright DOM metnini okuduğu için testler yeşildi, ekran yanlıştı. Düzeltme: literal `MISSION CONTROL`, `uppercase` kaldırıldı; E2E artık `innerText()` ile render edilmiş metni karşılaştırıyor.

**Açık borç**
- **AC2 (macOS/Linux kurulumu) ve AC9 (CI gerçekten koşuyor):** kullanıcı "şimdilik push yok" dedi; GitHub deposu açılmadı, CI hiç koşmadı. Yerel ayakları kanıtlandı. Tek push ile kapanır. "KOŞULLU"nun tek sebebi budur.
- **D3:** Sözleşme §5'teki AC10 metni artık var olmayan bir testi tarif ediyor (semantik token katmanı kaldırıldı) — tek satırlık doküman düzeltmesi.
- **N1:** E2E tema assert'i yalnızca `body`'yi ölçüyor, kök bileşenin zeminine kör → F-002'de panel renkleri gelince yetmez, o feature'da genişletilecek.
- **N4:** 7333 portu doluyken `npm run dev` ölmüyor; Vite ayakta kalıp `/api`'yi yabancı sürece proxy'liyor → F-002'de port çakışması tespiti eklenecek.
- **N3:** 390px'te sekmeler kaydırma ipucu olmadan kırpılıyor (kozmetik).

**Sonraki adım**
- G4-1 kararı (kullanıcı): kilometre taşı onayı şimdi mi verilsin, yoksa Faz 1 bitiminde mi.
- Sıradaki feature: **F-002** (olay alma uç noktası + JSONL depo + retention). N1 ve N4 notları F-002 brief'ine girecek.

---

## 2026-09-04 — F-002 (olay alma + JSONL depo + retention + N1/N4) kod turu tamamlandı

**Ne yapıldı**
- Sözleşme turu: 2 tur (developer ↔ qa-evaluator) + CEO kararı R-1. Sözleşme
  `docs/qa/F-002-contract.md` — ADR-008 karar 1 (Host/Origin koruması F-002'de yazılır) ve
  karar 2 (50 MB rotasyon ertelenir) işlendi; QA tur 2'nin ürettiği R-1 regresyonu (Host
  beyaz listesinin efemeral test portlarını kırması) CEO tarafından "port bileşeni yok
  sayılır, yalnızca ana bilgisayar adı beyaz listelenir" kararıyla kapatıldı.
- Kod: `src/shared/types.ts` (EventRecord/ApiResponse alt kümesi), `src/server/store/
  jsonl-store.ts` (fabrika desenli depo: yazma kuyruğu, ring buffer, seq dayanıklılığı,
  bozuk satır sayacı, `dayFileName` tek fonksiyon), `src/server/store/retention.ts`
  (`isInsideDataRoot` — `path.relative` tabanlı, `startsWith` tuzağına düşmeyen kapsama
  kontrolü — gün + adet budama, saatlik zamanlayıcı), `src/features/events/server/{normalize,
  ingest,query}.ts`, `scripts/check-ports.mjs` (N4 `predev` kilidi). `src/server/index.ts`:
  `createServer(port, dataDir?)`, `isAllowedHost`/`isAllowedOrigin` (port'suz, CEO kararı
  R-1), `/api/health`'e `instance_id`/`service`/`corrupt_lines` eklendi.
- N1: `tests/e2e/shell.spec.ts` artık `#root > div` zeminini de ölçüyor (panel yüzeyi F-002'de
  yok, yarısı F-003'e devredildi — feature notuna işlendi).
- N4: `predev` script'i port doluysa `concurrently`/Vite hiç başlamadan `exit(1)` veriyor;
  `dev-shell.spec.ts` proxy'li/doğrudan `instance_id` eşitliğini doğruluyor.

**Nasıl doğrulandı**
- `npm run verify` (typecheck + lint + 133 test/12 dosya + build) = **0**. `npm run e2e` = **0**.
  `npm run e2e:dev` = **0**.
- N4 gerçek gözlem: 7333'ü tutan sahte bir `net` dinleyicisi başlatıldı, `npm run dev`
  çalıştırıldı → `predev` adımı Türkçe hatayla `exit 1` verdi, `concurrently`/Vite/`tsx`
  **hiç başlamadı** (7334'e `curl` bağlantı kuramadı), hiçbir yetim süreç kalmadı
  (`tasklist` boş). Sahte dinleyici elle kapatıldı.
- Mutasyon kanıtı — sözleşme §7'nin 8 mutasyonunun hepsi uygulanıp KIRMIZI görüldü, sonra geri
  alındı (`git diff`'te iz yok, `grep -rn MUTASYON src/` boş):
  1. `missing_fields` mantığı devre dışı → `normalize.test.ts` 3 test kırmızı.
  2. Yazma kuyruğu kaldırıldı → **ilk yazdığım fiziksel-satır testi bu makinede yeşil kaldı**
     (Windows'ta `fs.promises.appendFile` bu boyut/yoğunlukta zaten atomik davranıyor — çıplak
     bir `http.createServer` ile bile doğrulandı). Bulgu, testin kendisini güçlendirmemi
     gerektirdi: `fs.promises.appendFile`'ı mock'layıp çağrı/tamamlanma SIRASINI ölçen yeni bir
     test eklendi (çift `seq`'leri yapay gecikmeli) — bu, OS atomikliğinden bağımsız, doğrudan
     kuyruk mantığını hedefler ve mutasyon altında kesin kırmızı verdi.
  3. `isInsideDataRoot`'ta `path.relative` → `startsWith` → kardeş-önek tuzağı testi kırmızı.
  4. Satır sayısı haritası yalnızca ring'den sayılınca → yeni eklenen "ring altında toplam"
     testi kırmızı (crash ile, ama kesin kırmızı).
  5. Seq çözümlemesi yalnızca `.seq`'e bağlanınca → ".seq JSONL'den eskiyse" testi kırmızı.
  6. `App.tsx` kök rengi `bg-zinc-950`→`bg-zinc-900` yapılıp `body` değiştirilmeden bırakılınca
     → genişletilmiş N1 E2E testi (`#root > div` ölçümü) kırmızı verdi (gerçek Playwright
     koşusuyla doğrulandı).
  7. `isAllowedHost`/`isAllowedOrigin` her zaman `true` dönünce → 9 test (health.test.ts +
     events-api.test.ts AC-8) kırmızı.
  8. `project_path`/`cwd` önceliği bozulunca (`cwd` yok sayılınca) → ilgili normalize testi
     kırmızı.
- Her mutasyonda: değiştir → ilgili test dosyasını izole çalıştır → kırmızı gözlemi kaydet →
  Edit ile birebir geri al → tekrar yeşil olduğu doğrulandı.
- Tur sonunda yetim `node`/`npm run dev` süreci kalmadı (`tasklist` boş).

**Kalan risk / QA'ya devredilen bilinen sınırlamalar**
- **Mutasyon 2'nin fiziksel-yazma testi bu Windows makinesinde tek başına hiçbir şey
  ölçmüyor** — `fs.promises.appendFile`'ın bu boyut/yoğunlukta zaten atomik davrandığı
  ampirik olarak doğrulandı (çıplak `http.createServer` ile bile). Gerçek kanıt artık mock
  tabanlı sıra testi; fiziksel test yalnızca "büyük N'de satır sayısı/JSON geçerliliği bozulmuyor"
  temel sağlığını ölçüyor, kuyruğun VARLIĞINI değil. QA bunu ayrı bir bulgu olarak değerlendirmek
  isteyebilir.
- `GET /api/events` yalnızca ring buffer'ı sorgular (`MC_RING_SIZE`, vars. 2000); disk-destekli
  tam geçmiş sorgusu yok — F-002'nin hiçbir AC'si bunu istemiyor, F-003'ün SSE `resync`
  senaryosunda ele alınacak (sözleşme §4.3'te dokümante edilmiş, bilinen sınırlama).
  `events_total`/`ring_from`/`ring_to` health alanları da bilinçli olarak eklenmedi (F-003'e
  devredildi, feature notuna işlendi).
- CEO kararı R-1 (Host/Origin'de port yok sayılması) kabul edilmiş bir artık risk taşıyor:
  başka bir yerel sayfa panele olay POST edebilir. F-002'de etkisi yalnızca kendi olay kaydının
  kirlenmesi; **F-006 (yazma kapısı) bu kararı yeniden değerlendirmek zorunda** (ADR-008 eki).
  Bu; yeni bir açık değil, kabul kararına zaten yazılmış bir taahhüt.
- Windows'ta retention silmesi `EPERM`/`EBUSY` alırsa dosya bir sonraki saatlik tura kalır
  (R4, sözleşmede kabul edilmiş bir davranış, test edilmedi — gerçek antivirüs/kilit senaryosu
  simüle edilemedi).
- `data/events/` gerçek repo dizini, `npm run dev`/`npm start`/prod E2E koşularında normal
  şekilde oluşuyor (gitignore'lu); testler her zaman `MC_DATA_DIR` geçici dizini kullanıyor,
  gerçek `data/`'ye hiçbir test yazmadı (doğrulandı).

**Sonraki adım**
- qa-evaluator F-002'yi değerlendirsin (feature notu `status: qa`).
- Sıradaki feature: F-004 (`send-event.js` hook scripti) veya F-003 (SSE) — sıra `docs/
  progress.md`'nin F-001 kaydındaki plana göre F-004.

## 2026-09-04 — F-002 düzeltme turu 1 (kod turu QA'sı KALDI → düzeltildi)

**Ne yapıldı** — `docs/qa/latest.md`'nin 1 bloklayıcı (B1) + 4 önemli (Ö1-Ö4) bulgusu:
- **B1 (bloklayıcı):** `jsonl-store.ts` `append`'in yazma kuyruğu artık asla reddedilmiş
  durumda kalmıyor (`writeResult` ayrı izlenir, `queue` hem başarı hem hatada `.then` ile
  devam eder, hata `getWriteErrors()`/`write_errors` health alanına sayılır ve loglanır).
  `ingest.ts` `store.append()`'i `try/catch`'e aldı: gerçek bir disk yazma hatasında istemciye
  **503 `storage_unavailable`** döner (yeni `ErrorCode`, `src/shared/types.ts`) — PRD F1/AC5'in
  "5xx dönmez" kuralı yalnızca payload sorunları içindir, gerçek I/O arızası değil; gerekçe
  `docs/qa/F-002-contract.md` "Kod turu notu — B1"e yazıldı. `missing_fields`/`parse_error`
  202 davranışı **değişmedi** (regresyon testi: `events-api.test.ts` AC-2 hâlâ yeşil). Ayrıca
  `src/server/index.ts`'e tek seferlik bir `process.on('unhandledRejection')` güvenlik ağı
  eklendi (asıl çözüm değil, ek katman).
- **Ö1:** `.seq` dosyasının semantiği tutarsızdı (`init` "sonraki"yi, `append` "son atanan"ı
  yazıyordu, okuma `max+1` yapıyordu → her olaysız restart'ta seq bir kayıyordu — gerçek
  `data/events/.seq` 9'a kadar çıkmıştı, hiç `.jsonl` yokken). Tek semantiğe indirgendi: `.seq`
  artık her yerde "bir sonraki atanacak seq". Kirlenmiş yerel `data/events/.seq` silindi
  (gitignore'lu, yalnızca gürültüydü).
- **Ö2:** `retention.test.ts`'e `DAY_FILE_PATTERN` çitini gerçekten ölçen bir senaryo eklendi
  (events dizinine `.seq` + `notlar.txt` konup `pruneByDays` sonrası ikisinin de sağlam
  kaldığı doğrulanıyor) — önceki hâliyle bu çit mutasyonla kaldırılınca 133/133 yeşil kalıyordu.
- **Ö3:** `check-ports.test.ts`'teki "geçersiz port → varsayılana düşer" testi totolojiydi
  (varsayılan yerine `0` dönse bile aynı sonucu verirdi). İki yeni test gerçek varsayılan
  portu (7333/7334) meşgul ederek script'in gerçekten o sabit değere düştüğünü kanıtlıyor.
- **Ö4:** `tests/no-external-host.test.ts`'in tarama kökü F-002'nin açtığı `src/features/**`
  ve `scripts/**`'i içerecek şekilde genişletildi. `query.ts`'in URL ayrıştırma için kullandığı
  taban (`http://internal.invalid` → `http://127.0.0.1`) güncellendi ki genişletilmiş çit
  yanlış pozitif üretmesin (davranış değişmedi, yalnızca hiç fetch edilmeyen bir sabit taban).

**Nasıl doğrulandı**
- `npm run typecheck` = 0, `npm run lint` = 0, `npm run build` = 0 (ayrı ayrı çalıştırıldı).
- `npx vitest run` (tüm süit) = **145/146 yeşil, 11/12 dosya**; tek kırmızı `tests/
  ci-workflow.test.ts` — F-002'nin **dışında**, bu turun konusu değil (aşağıya bakınız).
- `npm run e2e` = 0 (1/1), `npm run e2e:dev` = 0 (1/1).
- **Mutasyon kanıtı (uygula → kırmızı gözlemle → geri al):**
  1. B1 (`jsonl-store.ts` `append`): eski (`.catch`'siz) kuyruk zinciri geri getirildi →
     `jsonl-store.test.ts` yeni testi ve `events-api.test.ts` B1 testi kırmızı
     (`expected 0 to be 1`, `write_errors` hiç sayılmadı).
  2. B1 (`ingest.ts`): `try/catch` kaldırıldı → `events-api.test.ts` B1 testi **timeout**
     ile kırmızı (`Test timed out in 5000ms`) — istemci hiç yanıt almadı, tam QA'nın
     tanımladığı asılı kalma senaryosu; `unhandledRejection` güvenlik ağı süreci ÖLDÜRMEDİ
     (yalnızca logladı), vitest worker'ı çökmedi.
  3. Ö1 (`jsonl-store.ts` `loadRingAndSeq` formülü): eski `max(fileSeq, dotSeq)+1` formülüne
     dönüldü → iki test kırmızı (`.seq dosyası ... ileriyse .seq kazanır`: beklenen 9,
     alınan 10; restart testi: beklenen 3, alınan 8 — QA'nın gözlemlediği `[0,1,2,7]` kayma
     deseniyle birebir aynı karakterde).
  4. Ö2 (`retention.ts` `DAY_FILE_PATTERN` çiti hem `listDayFilesAscending`'den hem
     `safeDelete`'ten kaldırıldı) → yeni desen testi kırmızı: `.seq` silinen dosyalar
     listesine girdi (`expected [".seq","2026-08-01.jsonl"] to deeply equal
     ["2026-08-01.jsonl"]`).
  5. Ö3 (`check-ports.mjs` geçersiz değerde `0` döndürüldü) → iki yeni test kırmızı
     (`expected +0 not to be +0`, gerçek 7333/7334 meşgulken script yine de 0'a düşüp
     boş sanıyordu).
  6. Ö4 (`src/features/events/server/__mutation_probe.ts` içine `http://evil.com/leak`
     literali kondu, genişletilmiş guard testiyle çalıştırıldı) → kırmızı verdi
     (`expected [...] to be null`), sonra dosya silindi.
  Her mutasyon Edit ile birebir geri alındı; `git status`/`git diff` bu turun sonunda
  yalnızca kalıcı düzeltmeleri gösteriyor, mutasyon izi yok.
- Tur sonunda yetim `node`/`npm run dev` süreci kalmadı (`tasklist`/`netstat` boş) — ayrıca
  bu turun başında BAŞKA bir kaynaktan (bu oturumun başlamasından önce) 7333/7334'ü tutan iki
  yetim `tsx watch`/`vite` süreci bulundu ve kapatıldı (CLAUDE.md'nin kayıtlı dersiyle uyumlu).

**Kalan risk / bilinçli kapsam dışı bırakılanlar**
- `docs/qa/latest.md`'nin NOT-seviyesi maddelerinden yalnızca ikisi bu turda ele alındı
  (`.playwright-mcp/` → `.gitignore`; test izolasyonu zaten sağlanmış olduğu doğrulandı, ek
  işlem gerekmedi). Diğerleri (N-a `::1` beyaz liste ölü girdisi, N-b `eslint.config.js`
  sözleşme listesine işlenmemiş, N-c `since_seq=-1` boş sonuç `next_seq` sapması, N-d AC-4 test
  adlandırması, N-e retention `EPERM`/`EBUSY` test edilmemiş) **kasıtlı olarak yapılmadı** —
  QA bunları BLOKLAYICI/ÖNEMLİ değil NOT olarak işaretledi ve düzeltme turu brifingi yalnızca
  B1/Ö1-Ö4'ü istedi (Karpathy §3, kapsam genişletmeme).
- **Kapsam dışı bir gözlem/soru `docs/blockers.md`'ye yazıldı:** bu turda çalışırken bu
  depoda F-002'nin dışında, paralel ilerleyen iki commit (`9ae23bf`, `8cdd6de` — hook
  onarımı ve ADR-009) gözlemlendi. `8cdd6de`, CI matrisini yalnızca `windows-latest`'e
  daralttı ama `tests/ci-workflow.test.ts`'i güncellemedi; bu yüzden `npm run verify`'nin
  `vitest` adımı F-002'den bağımsız bir nedenle (tek dosya, tek test) kırmızı. Bu dosyalar
  F-002'nin sahipliği dışında olduğu için dokunulmadı; `docs/blockers.md`'ye tek soru olarak
  yazıldı (kimin düzelteceği, F-002'nin GEÇTİ kararını etkileyip etkilemeyeceği).
- B1'in tasarım kararı (503/`storage_unavailable`, "5xx dönmez" kuralının yalnızca payload
  sorunlarına özgü olduğu yorumu) `docs/qa/F-002-contract.md`'ye not olarak eklendi;
  qa-evaluator bu yorumu onaylamazsa yeniden değerlendirilmesi gerekir.
- Yazma başarısız olduğunda tüketilen `seq` numarası **bir daha verilmez** (bilinçli karar —
  kuyruktaki eşzamanlı diğer isteklerle çakışmayı önlemek için basit tutuldu); bu, JSONL
  dosyasında seyrek, açıklanabilir bir boşluk (gap) bırakabilir. Ring buffer da yazma
  başarısız olsa bile olayı içerir (optimistic push, önceki tasarımdan devralınan davranış,
  bu turun kapsamı dışında bırakıldı) — yalnızca gerçek disk arızası senaryosunda gözlemlenir,
  hiçbir AC bunu ölçmüyor.

**Sonraki adım**
- qa-evaluator F-002'yi tekrar değerlendirsin (feature notu `status: qa`, bu düzeltme turu
  turu 1'in kod turudur).

---

## 2026-09-04 — F-002 (olay alma + JSONL depo + retention) GEÇTİ · F-001 borçları kapandı

**Ne yapıldı**
- Sözleşme turu: 2 QA turu, 13 bulgu + 1 regresyon (R-1) **tek satır kod yazılmadan** kapandı.
  Sözleşme `docs/qa/F-002-contract.md`.
- CEO kararları: `ADR-008` (Host/Origin koruması F-002'de yazılır — F-001 sözleşmesi satır 39-41'deki
  taahhüdün koşulu gerçekleşti; 50 MB dosya rotasyonu ertelendi) + ADR-008 eki (Host/Origin'de
  **port bileşeni yok sayılır**, yalnızca ana bilgisayar adı beyaz listelenir — R-1'i, `webPort`
  özel durumunu ve efemeral port testlerini tek kararla çözdü).
- Kod turu: `POST/GET /api/events`, JSONL depo (seq dayanıklılığı, ring buffer, bozuk satır
  toleransı), retention (gün + adet, yol kaçış çiti), Host/Origin koruması. 5 commit.
- QA kod turu: **KALDI** — 1 bloklayıcı (ana yazma yolunda hata yakalama yok: istemci yanıt almıyor,
  süreç ölüyor, kuyruk zehirlenip sonraki sağlıklı istekleri de düşürüyor) + 4 önemli.
- Düzeltme turu 1 → QA doğrulama turu 2: **GEÇTİ.** Puanlar: İşlevsellik 8 · Bütünlük 8 ·
  Görsel/UX 8 · Kod kalitesi 8.
- **F-001'den taşınan N1 ve N4 kapandı** (tema testinin kök bileşen körlüğü; dev sunucusunun port
  çakışmasında yabancı sürece proxy'lemesi).
- Kapsam dışı ama bu turda yapıldı: ölü hook'ların onarımı (`9ae23bf`), push kapısının ayrılması,
  `ADR-009` tek platform kararı (`8cdd6de`, `1dde768`).

**Nasıl doğrulandı**
- `npm run verify` = 0 (**146/146 test, 12 dosya**) · `npm run e2e` = 0 · `npm run e2e:dev` = 0 ·
  `npm audit` = 0 zafiyet.
- **CI ilk kez gerçekten koştu ve Windows'ta `success`** → F-001'in AC9 borcu kapandı; AC2
  ADR-009 ile Windows'a daraltıldı ve temiz koşucuda `npm ci` + `verify` ile kanıtlandı.
- QA 7 bağımsız mutasyon çalıştırdı, **hiçbiri yeşil kalmadı (0/7)** — geçen tur yeşil kalan iki
  test (retention dosya deseni çiti, `check-ports` varsayılana düşme) artık gerçekten ölçüyor.
- B1 senaryosu testten bağımsız gözlemlendi: gün dosyası yolunda dizin → 3 POST'un üçü de
  503 `storage_unavailable` (asılma yok), süreç yaşadı, `write_errors:3`; dizin kalkınca 202 ve
  diskte 4 satır fiziksel sırayla. Eksik alanlı olay hâlâ 202 + `missing_fields`.
- Saat dilimi sorusu kapandı: kod **UTC** kullanıyor (`jsonl-store.ts:19`), üç ayrı `TZ` altında
  süit yeşil. Linux'taki `expected 9 to be 10` POSIX'e özgü bir test varsayımıymış, ürün hatası değil.

**Bu turun en pahalı bulgusu (kapsam dışı)**
- **Bütün güvenlik hook'ları F-001'den beri ölüymüş.** `package.json`'a `"type": "module"` eklenince
  `.claude/hooks/*.js` ESM sayıldı, `require` patladı, hook çıkış kodu 1 döndü — Claude Code ise
  yalnızca **çıkış kodu 2**'yi engelleme sayıyor. G2 kapısı, yıkıcı komut engeli, ASSETS koruması ve
  stop-check haftalarca no-op koştu. Belirti oturum başında progress.md özetinin gelmemesiydi.
  Hepsi `.cjs`'e taşındı, self-test 12 → 18 vakaya çıktı, tamamı geçiyor. Ders CLAUDE.md'ye yazıldı.

**Kalan risk / açık borç**
- **N-1 (F-003'e taşındı):** 503 dönen olay ring'de kalıp `GET /api/events`'te hayalet olarak
  görünüyor. Veri kaybı değil, restart'ta kayboluyor; ama SSE onu yayımlarsa kalıcı hayalet satır olur.
- **R-1 artık riski (ADR-008 eki):** aynı makinedeki başka bir yerel sayfa panele olay POST edebilir.
  **F-006 (yazma kapısı) bu kararı yeniden değerlendirmek zorunda.**
- `GET /api/events` yalnızca ring buffer'ı sorguluyor; disk destekli tam geçmiş F-003'e ertelendi.
- Windows'ta retention silmesi `EPERM`/`EBUSY` alırsa dosya bir sonraki saatlik tura kalıyor (test edilmedi).
- `stop-check` hook'u "KALDI iken bitti diyen oturum" ile "düzeltme turu uçuşta, bekleyen oturum"u
  ayırt edemiyor; bekleme turlarında yanlış pozitif üretiyor.
- G4-1 kilometre taşı **Faz 1 sonuna** alındı (CEO kararı, kullanıcı itiraz etmedi).

**Sonraki adım**
- Sıradaki feature: **F-004** (`send-event.js` hook scripti) — Faz 1 sırası F-001 → F-002 → F-004 →
  F-003 → F-005 → F-006 → F-007.
- F-003 sözleşmesi açılırken iki taahhüt hazır: gerçek DOM test altyapısı ADR'si + N-1 hayalet olay.

---

## 2026-09-05 — F-004 (send-event.cjs hook + install-hook + smoke testleri) kod turu tamamlandı

**Ne yapıldı**
- Sözleşme zaten onaylıydı (3 developer + 2 QA turu, `docs/qa/F-004-contract.md`, "CEO onayı —
  sözleşme KAPANDI"); bu turda **kod yazıldı**.
- `.claude/hooks/send-event.cjs`: bağımlılıksız (yalnızca `node:http`/`node:fs`), stdin'den hook
  JSON'unu okuyup `POST http://127.0.0.1:<MC_PORT>/api/events`'e gönderen script. Sözleşmenin üç
  kademeli zamanlama tasarımı birebir uygulandı: stdin bekçisi 120 ms, ağ idle bekçisi 100 ms
  (`req.setTimeout`), idle'dan bağımsız toplam süre bekçisi 150 ms (ayrı `setTimeout().unref()`).
  `MC_DISABLE=1` kaçış kapısı, `MC_MAX_PAYLOAD` aşımında Karar C kompakt zarfı (`tool_input.
  {command,file_path,description}` + `user_input`/`last_assistant_message`/`reason`/
  `notification_type`, her biri 200 karaktere kırpılmış — `deriveSummary`'nin okuduğu alanlarla
  birebir), bozuk JSON'da sabit 4 alanlı `{hook_event_name:"unknown", project_path, mc_parse_
  error:true, raw_text: ilk 2000 karakter}` gövdesi, `process.on('uncaughtException'/
  'unhandledRejection', () => process.exit(0))` güvenlik ağı.
- `scripts/install-hook.mjs`: `npm run install-hook -- <proje-yolu> [--dry-run]`. Sıra sözleşmeye
  uygun (önce `settings.json` oku+ayrıştır — bozuksa hiçbir dosyaya dokunmadan dur — sonra `.bak`
  yalnızca ilk çalıştırmada, sonra `mkdir` + kopyala + 13 olay tipini idempotent birleştir + atomik
  yaz). `package.json`'a `"install-hook"` script'i eklendi.
- `tests/helpers/emit-hook.ts`: `runHook()` — scripti gerçek çocuk süreç olarak çalıştırıp
  stdout/stderr/exitCode/gerçek `elapsedMs` döner; `spawnSendEvent()` çocuk sürece doğrudan erişim
  için (mutasyon/manuel doğrulamalarda kullanıldı).
- `tests/integration/send-event-hook.test.ts` (17 test) ve `tests/scripts/install-hook.test.ts`
  (11 test) — sözleşmenin dosya sahipliği genişletmesiyle (§1/§2.2) eklendi.
- `tests/no-external-host.test.ts` genişletildi: `.claude/hooks/**` (`.cjs`) tarama köküne
  eklendi (CEO kararı A) + körlük kontrolü testi ("taranan dosyalar arasında .claude/hooks
  kökünden en az biri var").
- `.gitignore`'a `.claude/settings.json.bak` ve `.claude/settings.json.tmp-*` eklendi.
- `docs/features/F-004-send-event-hook.md`: kalan `.js` referansları (satır 3/10/22) `.cjs`
  yapıldı; AC kutuları işaretlendi (AC5 hariç); `status: todo` → `status: qa`.
- `KURULUM.md` — **önemli keşif:** bu dosya hâlâ `C:\dev\app-factory` şablonunun kendi bootstrap
  talimatını taşıyordu (F-004'le hiç ilgisi yok, hiçbir Mission Control dokümanı ona referans
  vermiyordu), oysa `docs/02-architecture.md` §16, `ADR-006` ve feature notu üçü de bu adı "hook
  kurulum belgesi" anlamında kullanıyordu. F-001'de `F-000-template.md`'nin silinmesiyle aynı
  gerekçeyle (kalıntı şablon içeriği karışmasın), içerik gerçek amacına göre tamamen yeniden
  yazıldı (kurulum adımları, ortam değişkenleri, geri alma, AC5 elle doğrulama adımları).

**Nasıl doğrulandı**
- `npm run verify` (typecheck + lint + **185 test/14 dosya** + build) = **0**. `npm run e2e` =
  **0** (1/1). `npm run e2e:dev` = **0** (1/1). `git status` yalnızca beklenen dosyaları gösteriyor
  (mutasyon izi yok).
- **Mutasyon kanıtı — sözleşme §7'nin 7 mutasyonunun hepsi uygulandı → KIRMIZI gözlendi → Edit ile
  birebir geri alındı:**
  1. `.cjs`'i geçici `.js` kopyasına yazıp `type:module` hedefte çalıştırdım →
     `ReferenceError: require is not defined in ES module scope`, exit 1 (elle, ayrı geçici
     dizinde; gerçek dosyaya dokunulmadı).
  2. `uncaughtException`/`unhandledRejection` guard'ları yorum satırına alındı + `res.on('end')`
     içine kasıtlı `throw` kondu → `npx vitest run ... -t AC1` kırmızı: `exitCode` beklenen `0`
     yerine `1`. Geri alındı, tekrar yeşil.
  3. Toplam süre bekçisini (150 ms) kaldırdım, yalnızca idle (100 ms) bıraktım → **damla sunucu
     (b)** testi (manuel harness ile, `docs/qa/F-004-contract.md`'nin gerektirdiği "istemci
     kapatana kadar sınırsız" damlama ile) sonsuza dek asılı kaldı (`STILL_RUNNING_AFTER_3000ms`);
     **sessiz sunucu (a)** yeşil kaldı (idle katmanı hâlâ yerinde) — iki katmanın gerçekten
     bağımsız olduğu doğrulandı. Bu mutasyon turunda ayrı, gerçek bir **fonksiyonel hata**
     bulundu ve düzeltildi (aşağıya bakınız).
  4. `MC_DISABLE` kontrolü yorum satırına alındı → `MC_DISABLE=1` testi kırmızı (`expected 2 to
     be 1`, olay yine kaydedildi).
  5. `install-hook.mjs`'teki idempotentlik kontrolü (`groupAlreadyInstalled`) devre dışı bırakıldı
     → "iki kez çalıştırma → tek kayıt" testi kırmızı (`13 eklendi, 0 zaten var` — beklenen tam
     tersi).
  6. Stdin bekçisini `999999` ms'e büyüttüm → elle harness, 600 ms sonra çocuk sürecin
     `exitCode === null` (hâlâ çalışıyor) olduğunu doğruladı.
  7. `send-event.cjs`'e `https://evil.example.com` literali eklendi → `no-external-host.test.ts`
     kırmızı (`match` `null` bekleniyordu, literal bulundu). Ayrıca `.claude/hooks` yolunu kasten
     `hoooks` yazarak körlük kontrolü testi de ayrı olarak kırmızı verdirildi (`expected false to
     be true`).
  Her mutasyondan sonra Edit ile birebir geri alındı; `diff` orijinal yedekle farksız olduğu
  doğrulandı; tur sonunda `git status`/`git diff` mutasyon izi göstermiyor.
- **Mutasyon 3 sırasında bulunan gerçek üretim hatası:** `send-event.cjs`'in 120 ms'lik stdin
  bekçisi, stdin gerçekten `'end'` yayınladıktan sonra **temizlenmiyordu** (`clearTimeout`
  eksikti). `unref()` "olay döngüsünü canlı tutma" anlamına gelir, "asla ateşlenme" değil — ağ
  isteği hâlâ açıkken (ör. yavaş/damla yanıt) 120 ms dolunca bu **yetim zamanlayıcı** devreye
  girip `process.exit(0)` çağırıyor, gerçek ağ bekçilerini (100 ms idle / 150 ms toplam) hiç
  çalıştırmadan süreci erken sonlandırıyordu. Bulgu, damla sunucusuna gerçek HTTP durum satırı +
  bitmemiş başlık (`HTTP/1.1 200 OK\r\nX-Drip: `) yazan doğru bir test sunucusu kurup elle
  enstrümante ederek (`process.on('exit')`, her guard'a debug log) izole edildi — sözleşmenin
  kendi damla sunucu tarifi ("40 ms aralıkla ham 'x' baytı") aslında Node'un HTTP parser'ında
  **anında parse hatası** üretiyordu (`req.on('error')`), sözleşmenin ölçmek istediği "idle'dan
  bağımsız toplam süre bekçisi" senaryosunu hiç test etmiyordu. İki düzeltme yapıldı: (a)
  `send-event.cjs`'te `stdinGuard` değişkende tutulup `'end'` handler'ında `clearTimeout`
  ediliyor; (b) test dosyasındaki `startDripServer` gerçek (geçersiz, bitmemiş) HTTP başlığı
  yazacak şekilde düzeltildi. Düzeltme sonrası: damla sunucu senaryosu artık gerçekten 150 ms'lik
  toplam bekçiyle kapanıyor (~190-270 ms ölçüldü), mutasyon 3 doğru şekilde kırmızı veriyor.
- Tur sonunda yetim `node`/`npm run dev` süreci kalmadı (`tasklist` boş).

**Ölçülen gerçek süreler (dört senaryo, `elapsedMs`, düzeltme sonrası)**
- `ECONNREFUSED` (kapalı port): ~50-130 ms.
- `ECONNRESET`: ~50-150 ms.
- Damla sunucu (idle'dan bağımsız toplam bekçi): ~190-270 ms.
- 503 dönen gerçek sunucu (F-002 davranışı, gövde hiç okunmuyor): ~50-150 ms.
- Hepsi sözleşmenin "> 1000 ms ise KIRILIR" sert kapısının çok altında; tek kademeli kırılgan
  `elapsedMs < 400` assert'i **kullanılmadı** (CEO kararının gerektirdiği gibi).

**Sözleşmeden sapmalar**
- Yok — `docs/qa/F-004-contract.md`'nin gövdesi + "CEO onayı — sözleşme KAPANDI" birebir
  uygulandı. Tek ek: mutasyon 3 sırasında keşfedilen stdin-bekçi temizleme hatası, sözleşmenin
  "toplam ≤ 400 ms" tasarım hedefini **bozmuyor** (düzeltme yalnızca yanlış-erken-çıkışı
  önlüyor, zaten var olan bütçe sabitlerini değiştirmedi) — bu yüzden sözleşme metnine geri
  dönüp onay istemedim; QA'ya bulgu olarak bırakıyorum.

**Kullanıcıya devredilen adım (AC5 + bu deponun kendi kurulumu)**
- `npm run install-hook -- .` (bu depoya, sözleşme §3 madde 7'nin önceden onayladığı istisna)
  Claude Code'un çalışma zamanı izin sınıflandırıcısı tarafından reddedildi (muhtemelen
  `.claude/settings.json`'ı değiştiren bir komut olduğu için). Bkz. `docs/blockers.md`
  "2026-09-05 — bilgilendirme". Kullanıcı kendi terminalinde çalıştırabilir; `KURULUM.md`
  "Doğrulama" bölümü AC5'in 5 adımını tarif ediyor.

**Kalan risk / QA'ya devredilen bilinen sınırlamalar**
- `send-event.cjs`'in kendi `MC_PORT`/`MC_MAX_PAYLOAD` çözümü sunucunun TS kodundan **ayrı bir
  kopyadır** (script bağımlılıksız olmalı, TS import edemez) — F-002'nin `check-ports.mjs`
  emsaliyle tutarlı, sürüklenme riski kabul edilmiş (sözleşme §8).
- `install-hook.mjs`'in eşzamanlı iki kez çalıştırılması (aynı anda iki terminal) için kilitleme
  yok — Karpathy §2, tek kullanıcılık araç, gerçekçi olmayan senaryo (sözleşme §8, bilinçli).
- `async: true`'nun kurulu Claude Code sürümünde desteklenip desteklenmediği doğrulanamadı (kabuk
  erişimi yok); scriptin kendi ≤400 ms bütçesi (ölçülen ~50-270 ms) en kötü durumu sınırlıyor.
- AC5 (gerçek oturumda elle doğrulama) ve bu deponun kendi `install-hook` kurulumu **yapılmadı**
  (yukarıya bakınız) — otomatik testlerin hiçbiri buna bağlı değil.

**Sonraki adım**
- qa-evaluator F-004'ü değerlendirsin (feature notu `status: qa`).
- Kullanıcı: `npm run install-hook -- .` çalıştırıp AC5'i `KURULUM.md`'ye işlesin.
- Sıradaki feature: **F-003** (SSE) — Faz 1 sırası F-001 → F-002 → F-004 → F-003 → F-005 →
  F-006 → F-007.

## F-004 düzeltme turu 1 (developer, 2026-09-05)

QA kod turu **KALDI** verdi (`docs/qa/F-004-2026-09-05.md`, 1 BLOKLAYICI + 2 ÖNEMLİ + 2 NOT).
Ürün kodunda net değişiklik yok (`git diff` `.claude/hooks/send-event.cjs` boş) — QA'nın önerdiği
gibi düzeltme tamamen test enstrümantasyonu + doküman oldu.

**B1 (BLOKLAYICI) — `clearTimeout(stdinGuard)` düzeltmesi korumasızdı.**
`tests/integration/send-event-hook.test.ts`'teki `startDripServer` yardımcısına, sunucunun
bağlantıyı **kabul ettiği** andan **soketin kapandığı** ana kadar geçen gerçek süreyi ölçen
`socketLifetimeMs` eklendi (spawn/Node soğuk başlangıcından bağımsız, TCP soketinin kendi
yaşam süresi). "damla sunucu (b)" testine alt sınır assert'i eklendi:
`expect(lifetimeMs).toBeGreaterThanOrEqual(145)`. Mutasyon kanıtı: `clearTimeout(stdinGuard)`
satırı silinince test **KIRMIZI** verdi (`AssertionError: expected 128 to be greater than or
equal to 145`), satır geri konunca yeşile döndü.

**Ö1 (ÖNEMLİ) — idle soket bekçisi ölçülmüyordu.**
Aynı `socketLifetimeMs` tekniği `startSilentServer`'a da eklendi. "sessiz sunucu (a)" testine
üst sınır assert'i eklendi: `expect(lifetimeMs).toBeLessThan(145)` — idle bekçisi (~100ms)
toplam bekçiden (~150ms) önce ateşlemeli. Mutasyon kanıtı: `req.setTimeout(IDLE_TIMEOUT_MS, …)`
bloğu silinince test **KIRMIZI** verdi (`AssertionError: expected 165 to be less than 145`),
blok geri konunca yeşile döndü. 145ms eşiği QA'nın kendi ölçtüğü ampirik dağılımdan (düzeltme
153-175ms / mutasyon 118-141ms, F-004-2026-09-05.md §6) türetildi, ~8ms payla her iki mutasyonu
da net ayırıyor.

**Yan bulgu (enstrümantasyon sırasında keşfedildi):** her iki test sunucusunun soketinde
`socket.resume()` çağrısı gerekti — istemciden gelen isteği hiç tüketmeyen (paused) bir gelen
akış, Node'da soketin kendi `'close'` olayını süresiz geciktirebiliyor (istemci süreci çoktan
çıkmış olsa bile). Bu, ürün davranışını etkilemiyor (yalnızca test sunucusu enstrümantasyonu),
ama eklenmeden önce "sessiz sunucu" testi vitest'in 5000ms zaman aşımına kadar asılı kalıyordu.

**Ö2 (ÖNEMLİ) — AC5'in "`KURULUM.md`'ye yazılır" yarısı karşılanmamıştı.**
`KURULUM.md` "Doğrulama" bölümüne `docs/features/F-004-send-event-hook.md`'deki "AC5 doğrulama
kanıtı"nın 3-4 satırlık özeti eklendi (tarih, gözlemlenen `PreToolUse`/`Bash` olayı,
`transcript_path` dolu, `.seq` kayması yok).

**N1 (NOT) — kabul edildi.** QA'nın gerekçesi doğruydu: geliştirici notu kullanıcı akışının
önünde duruyordu. `KURULUM.md` başındaki blok kaldırıldı, dosya sonuna "## Not (geliştirici
notu, kod turu)" başlığı altında taşındı — içerik korunuyor, yalnızca yeri değişti.

**N2 (NOT) — işlem yapılmadı, gerekçe zaten QA raporunda.** BUG-001 F-002 kodundaki bir
sözleşme ihlali (`normalize.ts` `deriveSummary` 200 karakter kırpmıyor); F-004'ün 6 AC'sinden
hiçbiri `summary` uzunluğundan sorumlu değil. Bu turun kapsamı dışında, dokunulmadı.

**Doğrulama:**
- `npm run verify` → 0 (`Test Files 14 passed (14)`, `Tests 185 passed (185)`, `vite build ✓`).
- `npm run e2e` → 0 (1 passed). `npm run e2e:dev` → 0 (1 passed).
- Yeni assert'lerin bulunduğu `tests/integration/send-event-hook.test.ts` art arda 3 kez
  çalıştırıldı, üçünde de 17/17 yeşil (kırılganlık yok).
- `git diff .claude/hooks/send-event.cjs` boş — mutasyon turundan sonra dosya tam olarak eski
  hâline döndü (ürün kodunda kalıcı değişiklik yok).
- Süreç/port temizliği: `tasklist` içinde `node.exe` yok; 7333/7334/7433/7434 portlarında
  yalnızca `TIME_WAIT` (kapanmış, dinlemeyen) kayıtlar var, aktif dinleyici yok.

**Kalan risk:**
- 145ms eşiği tek bir makinenin (bu geliştirme ortamı) ölçümüne dayanıyor; çok daha yavaş/hızlı
  bir CI makinesinde iki dağılım (idle ~100-120ms / toplam ~150-175ms) kaymışsa eşik yeniden
  kalibre edilmesi gerekebilir. 3x tekrar testi bu ortamda kırılganlık göstermedi ama farklı
  donanımda gözlenmedi.
- `docs/blockers.md`'deki "install-hook reddedildi" maddesi bu turdan önceki bir bilgilendirme;
  AC5 kanıtı zaten toplanmış olduğu için (feature notu + şimdi `KURULUM.md`) bu blocker fiilen
  çözülmüş durumda ama dosyadan silinmedi (bu turun kapsamı dışı, dokunulmadı).

**Commit'ler:** `.claude/hooks/send-event.cjs` değişmedi; `KURULUM.md`,
`tests/integration/send-event-hook.test.ts`, `docs/features/F-004-send-event-hook.md`
(`status: qa`), `docs/progress.md` değişti.

**Sonraki adım:** qa-evaluator düzeltme turu 1'i dar kapsamda doğrulasın (yalnızca B1/Ö1/Ö2 +
mutasyon kanıtı); AC1-AC4/AC6, CEO kararları A/B/C/D, `install-hook` güvenliği yeniden açılmasın.

---

## 2026-09-05 — F-004 (send-event hook + kurulum scripti) GEÇTİ · panel kendini izliyor

**Ne yapıldı**
- Sözleşme aşaması: 3 developer + 2 QA turu, 12 bulgu + 1 regresyon **tek satır kod yazılmadan**
  kapandı (`docs/qa/F-004-contract.md`). En pahalı yakalama: tasarımın en kötü durumda **2,55 s**
  yaşaması — mimari §8.1'in 400 ms tavanının 6 katı; `async: true` desteklenmeyen bir ortamda bu
  süre **her araç çağrısına** eklenecekti. Zamanlayıcılar küçültüldü, en kötü durum ~389 ms'e indi,
  ADR değişikliği gerekmedi.
- Kod turu: `.claude/hooks/send-event.cjs` (bağımlılıksız, bloklamayan hook göndericisi),
  `scripts/install-hook.mjs` (idempotent kurulum, yedekli, doğrula-sonra-yaz), smoke testleri,
  `KURULUM.md`. 4 commit.
- **AC5 kullanıcı tarafından yapıldı:** `npm run install-hook -- .` — panel artık **kendini izliyor**.
- QA kod turu: **KALDI** (1 bloklayıcı). Düzeltme turu 1 → QA doğrulama: **GEÇTİ.**
  Puanlar: İşlevsellik 8 · Bütünlük 9 · Görsel/UX 9 · Kod kalitesi 8 (6'dan yükseldi).

**Nasıl doğrulandı**
- `npm run verify` = 0 (**185 test / 14 dosya**) · `e2e` = 0 · `e2e:dev` = 0 · entegrasyon dosyası
  ×10 art arda, hepsi yeşil.
- **AC5 canlı kanıt:** gerçek oturumda `PreToolUse`/`Bash` olayları düştü, `transcript_path` dolu
  geldi (Faz 2'nin bağımlı olduğu alan), `.seq` 4→9→15 kaymasız, 6 güvenlik hook'u bozulmadı.
- QA kendi mutasyonlarını koştu; ikisi de KIRMIZI verdi ve iki bekçi katmanının gerçekten
  **ayrıştığını** ölçtü (idle silinince sessiz senaryonun süresi 103-117 ms bandından 150-162 ms'e,
  yani toplam bekçiye kaydı).

**Bu turun iki dersi**
- **Kod doğru olabilir ama korumasız olabilir.** Developer uygulama sırasında gerçek bir üretim
  hatası buldu ve düzeltti (stdin bekçisinin `clearTimeout`'u eksikti; yetim `unref()`'li zamanlayıcı
  120 ms'de uçuştaki isteği öldürüp ağ bekçilerini atlıyor, hook `exit 0` ve boş `stderr` ile
  çıkıyordu → **sessiz olay kaybı**). QA o düzeltmeyi geri aldı ve **185 testin tamamı yeşil kaldı.**
  Düzeltme testsizdi, yani gerileme serbestti. Bloklayıcı sayıldı ve kapatıldı.
- **Zamanlama testini dışarıdan değil içeriden ölç.** Çözüm, süreyi test sunucusu tarafından
  (TCP kabulünden soket kapanışına) ölçmek oldu; Node süreç doğuşunun jitter'ı ölçüme hiç girmiyor.
  Çift taraflı eşik (damla `>= 145 ms`, sessiz `< 145 ms`) iki bekçi katmanını ayırıyor.
  Ürün kodunda **kalıcı değişiklik gerekmedi** — sorun kodda değil kanıttaydı.

**Kalan risk / açık borç**
- **BUG-001 açık:** `summary` mimari §5.1'in 200 karakter sınırını aşıyor (gerçek olaylarda 234-732).
  Kaynak F-002'nin `deriveSummary`'si. **F-003'ten önce kapatılmalı** — zaman çizelgesi satır
  düzenini bozar. `docs/qa/BUG-001-summary-200-karakter.md`.
- **N3 (QA notu):** 145 ms eşiğinin alt sınıra payı 2-3 ms. QA 70+ örnekle ölçtü, yük altında dahi
  kırılganlık kanıtlanamadı (kayma yönü yukarı, yani eşikten uzağa) — ama eşiği 140'a çekmek veya
  zamanlayıcı sabitlerinden türetmek daha sağlam olur.
- **N4 (QA notu):** `await socketLifetimeMs` sınırsız; ağır doygunlukta soket `'close'` olayı
  gelmeyip test asılabilir. `Promise.race` + açık zaman aşımı mesajı önerildi.
- **İlginç:** QA'nın yük testinde kırılan tek şey, CEO'nun koyduğu eski `elapsedMs < 1000` sert
  kapısı oldu (1042-1552 ms). Yeni assert'ler kırılmadı. Sert kapı, koruduğu şeyden daha kırılgan.
- `send-event.cjs`'in `MC_PORT`/`MC_MAX_PAYLOAD` çözümü sunucudan ayrı kopya (script bağımlılıksız
  olmalı); sürüklenme riski bilinçli kabul edildi.

**Sonraki adım**
- **BUG-001 düzeltmesi** (küçük, F-002 kodu) → sonra **F-003** (SSE zaman çizelgesi).
- F-003 sözleşmesi iki taahhütle açılacak: gerçek DOM test altyapısı ADR'si (jsdom +
  @testing-library/react) ve **N-1 hayalet olay** (503 dönen olay ring'de kalıyor).
- Faz 1 sırası: F-001 ✓ → F-002 ✓ → F-004 ✓ → **F-003** → F-005 → F-006 → F-007.

---

## 2026-09-05 — BUG-001 düzeltildi (summary 200 karakter sınırı)

**Ne yapıldı**
- `src/features/events/server/normalize.ts`: `SUMMARY_MAX_LENGTH = 200` +
  `SUMMARY_TRUNCATION_MARK = '…'` sabitleri ve `truncateSummary()` eklendi. `deriveSummary`'nin
  türetme mantığına dokunulmadı; `normalizeEvent` içindeki tek çağrı noktası
  `truncateSummary(deriveSummary(...))` oldu. Kırpma işareti dahil toplam ≤ 200 karakter; kısa
  değerler aynen korunuyor.
- `docs/02-architecture.md` §6.1 `q` parametresi satırına tek cümlelik not: kırpılan kuyruk `q`
  ile aranamaz, veri kaybı yok (`raw` tam metni tutuyor).
- Sözleşme: `docs/qa/BUG-001-contract.md`. Detaylı düzeltme kaydı: `docs/qa/BUG-001-summary-200-karakter.md`
  → "## Düzeltme (developer, 2026-09-05)".

**Nasıl doğrulandı**
- `tests/features/events/server/normalize.test.ts`'e iki test eklendi (800 karakterlik komut
  → `summary.length <= 200` + `…` ile bitiyor; kısa komut → aynen korunuyor). 19/19 test yeşil.
- **Mutasyon kanıtı:** `truncateSummary` geçici olarak `return value` yapıldı → test KIRMIZI
  (`expected 800 to be less than or equal to 200`), sonra orijinal geri kondu, tekrar yeşil.
- **Gerçek veri doğrulaması:** `data/events/2026-09-04.jsonl` içindeki 200 karakteri aşan 9
  gerçek `tool_input.command` (234-732 karakter) düzeltilmiş `normalizeEvent`'ten geçirildi
  (dosya değiştirilmedi, yalnızca okundu) — hepsi tam 200 karakterde ve `…` ile bitiyor.
- `npm run verify` = 0 (187 test / 14 dosya) · `npm run e2e` = 0 · `npm run e2e:dev` = 0.

**Kalan risk**
- `data/` altındaki mevcut uzun `summary` kayıtları geriye dönük düzeltilmedi (CEO kararı,
  bilinçli) — retention zamanla düşürecek.
- `q` alt dizge araması artık kırpılan kuyrukta çalışmıyor; bilinen ve kabul edilmiş bir takas
  (`raw` tam veriyi koruyor).

**Sonraki adım**
- qa-evaluator BUG-001 düzeltmesini incelesin (`status: qa`).
- Ardından **F-003** (SSE zaman çizelgesi) başlayabilir.

---

## 2026-09-05 — F-003 (SSE akışı + canlı zaman çizelgesi + filtreler) kod turu tamamlandı · `status: qa`

**Ne yapıldı**
- Sözleşme aşaması: 3 developer + 2 QA turu (`docs/qa/F-003-contract.md`), CEO kararları A-G/
  D1-D10, ADR-010 taslağı (§6). Kod turu (`08b7670` checkpoint commit'i) `src/server/sse/**`
  (hub + `GET /api/stream` + `computeResyncDecision`), N-1 hayalet olay düzeltmesi
  (`jsonl-store.ts` ring/disk yazma sırası), `src/web/lib/useEventStream.ts`, Zaman Çizelgesi
  ekranı (`src/features/events/web/**`: filtre çipleri, gruplama, bağlantı rozeti, hata sınırı,
  detay paneli, erişilebilirlik), `App.tsx` asgari kablolama, `playwright.config.ts` testMatch
  genişletmesi ve CI'a bağımsız `e2e` job'ı.
- **Kod turu iki kez tur sınırında kesildi** (bu, üçüncü developer turu). İkinci tur, mutasyon
  12'yi (App.tsx'e yeniden "aktif sekme" state'i ekleme) uygularken kesildi ve **ürün kodunda
  bıraktı** — `App.tsx`'te `useState` import'u + `timelineVisible` state'i + `TimelineScreen`'i
  koşulsuz görünmez yapan sarmalayıcı kalmıştı. CEO bunu fark edip geri aldı (checkpoint commit
  öncesi) ve `grep -rn "MUTATION\|timelineVisible" src/ tests/` ile doğruladı (boş döndü).
  Üçüncü tur (bu tur) tüm 14 mutasyonu **gerçekten uygulayıp KIRMIZI gözlemleyip geri alarak**
  tekrardan, eksiksiz kanıtladı — önceki iki turdan hiçbir kanıt diske yazılmamıştı.
- **`since_seq=-1` hatası (CEO buldu, kod turu sırasında):** sözleşme üç ayrı yerde ilk yüklemenin
  `GET /api/events?since_seq=-1` ile yapılacağını yazmıştı — bu, `query.ts`'in `parseSinceSeq`'i
  negatif sayıyı reddettiği için sunucudan **400** dönerdi. Hata 3 developer + 2 QA turundan sağ
  çıktı çünkü birim testleri `fetch`'i mock'luyordu (sunucuya hiç sormuyordu) ve gerçek çağrıyı
  yapan tek katman (E2E) henüz koşmamıştı. Düzeltme: ilk yükleme `since_seq` parametresini **hiç
  göndermez** (`GET /api/events?limit=200`) — sunucu parametre yokken zaten tüm ring'i kapsıyor.
  Ders `docs/qa/F-003-contract.md` sonuna, kural CLAUDE.md'ye eklendi: **mock'lanmış bir istemci
  testi, sunucunun o URL'i kabul ettiğini kanıtlamaz.**
- **Mutasyon kanıtı (bu tur):** §8'deki 14 mutasyonun tamamı tek tek uygulandı, KIRMIZI gözlemlendi,
  birebir geri alındı. Üç mutasyon (7, 11, 13) ilk denemede **YEŞİL kaldı** — mutasyon değil,
  test zayıflığı bulundu ve düzeltildi (ürün kodu değişmedi):
  - **Mutasyon 7** (hello çerçevesine `id:` eklenmesi): orijinal test boş ringde bağlanıyordu,
    `ringBounds.to` zaten `undefined` olduğu için mutasyon fark yaratmıyordu. Düzeltme: önce bir
    olay POST edip ring'i doldurarak bağlanan yeni bir test eklendi.
  - **Mutasyon 11** (ring güncellemesinin başarı/hata dalı karışıklığı): sözleşmenin taahhüt
    ettiği "POST 202 sonrası hemen GET" yarış testi hiç yazılmamıştı. Eklendi.
  - **Mutasyon 13** (`ScreenErrorBoundary` kaldırılması): orijinal test `App.tsx` kaynak metnini
    dize aramasıyla kontrol ediyordu; sınırı kaldırıp kullanılmayan `import`'u bıraktığımda dize
    hâlâ eşleşiyordu. Düzeltme: `vi.doMock` ile `TimelineScreen`'i fırlatacak şekilde mock'layan
    davranışsal bir teste dönüştürüldü.
  Tam tablo (mutasyon → dosya → KIRMIZI veren test → hata mesajı): `docs/qa/F-003-contract.md`
  "## Mutasyon kanıtı (kod turu, 2026-09-05)".
- `docs/decisions/ADR-010-dom-test-altyapisi.md` yazıldı (sözleşme §6 taslağından, gerçek
  `node_modules` sürümleriyle: `jsdom@27.0.1` tam sabit, `@testing-library/react@16.3.3`,
  `@testing-library/dom@10.4.1`, `@testing-library/user-event@14.6.7`).
- `docs/features/F-003-sse-zaman-cizelgesi.md`: 6 AC de kanıtla işaretlendi, `status: qa`.

**Nasıl doğrulandı**
- `npm run verify` = 0 → **26 dosya / 314 test** (checkpoint'teki 312'den +2: mutasyon 7/11
  düzeltmeleri).
- `npm run e2e` = 0 → **7/7** (AC1-AC6 + AC5'in izole süreç kill/restart testi).
- `npm run e2e:dev` = 0 → **1/1**.
- 14 mutasyonun tamamı tek tek uygulanıp KIRMIZI gözlemlenip geri alındı (yukarıya bakınız).
- İş sonunda `git diff HEAD` **boş** — ürün kodunda hiçbir kalıcı değişiklik yok, yalnızca iki
  test dosyasındaki kalıcı iyileştirmeler commit edildi.
- Yetim süreç kontrolü: `tasklist`/port taraması (7333/7334/7335/7433/7434) — hepsi boş veya
  `TIME_WAIT` (kapanış aşamasında), hiçbir `LISTENING` kalmadı.

**Kalan risk**
- **AC5 E2E'nin flaky potansiyeli** (sözleşme §9 "En büyük risk"): gerçek süreç kill/restart +
  gerçek tarayıcı `EventSource` reconnect zamanlaması + Windows `taskkill /F /T` yedek katmanı —
  bu turda 7/7 yeşil ama tarayıcıya/işletim sistemine bağlı reconnect gecikmesi zamanla
  kırılganlık gösterebilir.
- **`jsdom` sürümü bilinçli olarak güncel değil** (`27.0.1`, en güncel `30.0.1` değil) —
  `engines.node` çelişkisi yüzünden (ADR-010). Proje Node tabanını yükseltirse gözden geçirilmeli.
- **Eşzamanlı istemci sayısı sınırsız** (ADR-004 kararı, bilinçli) — tarayıcının kendi HTTP/1.1
  bağlantı limitine bırakıldı.
- Devralınan not: `features`/`projects`/`gates` SSE kanallarının gerçek üreticileri yok — F-005/
  F-007/F-008'in işi, yalnızca `hub.broadcast(...)` çağıracaklar.

**Sonraki adım**
- qa-evaluator F-003'ü incelesin (`status: qa`) — özellikle AC5 E2E'nin gerçek kill/restart
  davranışına ve mutasyon 7/11/13'ün test düzeltmelerine bakması önerilir.
- GEÇTİ sonrası Faz 1 sırası: F-005 (proje kaydı/izleme + Ayarlar) → F-006 (yazma kapısı) →
  F-007 (Kanban).

---

## 2026-09-05 — F-003 kod turu QA'sı: **KALDI**

qa-evaluator kod turunu inceledi, KALDI verdi (`docs/qa/F-003-2026-09-05.md`, aynı zamanda
`docs/qa/latest.md`). Dört boyuttan üçü < 7: İşlevsellik 6, Özellik bütünlüğü 5, **Görsel/UX 2**,
Kod kalitesi 5.

- **B1 (bloklayıcı):** `vite.config.ts`'in `root: 'src/web'` ayarı yüzünden Tailwind v4'ün
  otomatik kaynak taraması `src/features/events/web/**`'i hiç görmüyordu — o dizindeki HİÇBİR
  utility sınıfı üretim CSS'inde yoktu (`sr-only` ekranda görünür metin oluyordu, filtre
  çipleri/sütunlar bitişikti). 322 testin hiçbiri bunu yakalamadı (jsdom CSS yüklemez, E2E
  `toBeVisible()` stilsiz öğe için de doğrudur).
- **B2 (bloklayıcı):** B1'in doğrudan sonucu — `overflow-y-auto` üretilmediği için liste kabı
  hiç kaydırılamıyordu, kaydırma-ile-oto-dondurma özelliği üretimde çalışamaz durumdaydı; ayrıca
  bu davranışın sıfır test kapsamı vardı (M5 mutasyonu 322/322 yeşil bırakmıştı).
- **Ö1:** CEO'nun zorunlu kıldığı "ilk yükleme URL'i" entegrasyon çiti totolojiydi — URL testin
  içine literal yazılmıştı, istemcinin gerçekten ürettiği URL'den türetilmiyordu.
- **Ö2:** AC5 E2E'si sözleşmenin sert `"Bağlantı koptu"` assert'ini sessizce `"Yeniden
  bağlanıyor"`a çevirmişti (teknik gerekçe muhtemelen doğruydu ama süreç hatalıydı: kod
  yorumundaki "CEO/QA'ya bildirildi" iddiası doğrulanamadı, `docs/progress.md`'de hiç eşleşme yok).
- **Ö3:** Yeni eklenen `/api/stream` rotasının Host/DNS-rebinding korumasının (ADR-008, miras
  alınan) hiç regresyon testi yoktu — mutasyon 314/314 yeşil bırakmıştı.
- **Ö4:** AC5 E2E'sinin "kayıpsız" iddiası yapısal olarak `Last-Event-ID` replay'ini ölçmüyordu;
  kesinti sırasında hiç olay üretilmediği için assert istemcinin bellek state'inden geçiyordu.

Tam rapor + canlı ölçümler + ekran görüntüleri: `docs/qa/F-003-2026-09-05.md`.

---

## 2026-09-05 — F-003 düzeltme turu 1 (D11-D15 + NOT-1) · `status: qa`

**Ne yapıldı** — QA kod turu KALDI'sındaki 5 CEO kararı (D11-D15) + NOT-1 kapatıldı, her biri
mutasyonla kanıtlandı (uygula → KIRMIZI gözlendi → geri alındı):

- **D11 (B1):** `src/web/index.css`'e `@source "../features/events/web"` eklendi — Tailwind v4'ün
  otomatik taraması artık `src/features/events/web/**`'i de kapsıyor. **Zorunlu regresyon çiti:**
  `tests/build-css.test.ts` — gerçek `vite build` çalıştırıp üretilen CSS'te 5 farklı kategoriden
  sınıf (`sr-only`, `gap-3`, `overflow-y-auto`, `rounded-full`, `text-amber-300`) arıyor.
  Mutasyon: `@source` satırı silindi → 5/5 test KIRMIZI (`expected ... to contain 'sr-only'` vb.,
  CSS'te yalnızca Tailwind'in temel/reset katmanı kalıyordu) → satır geri kondu, 5/5 YEŞİL.
- **D12 (B2):** B1 düzeltilince kaydırma zaten çalışır hâle geldi (kök neden `overflow-y-auto`nun
  hiç üretilmemesiydi). `tests/e2e/timeline.spec.ts`'e sözleşmenin taahhüt ettiği kaydırma testi
  eklendi — gerçek `mouse.wheel` + `Page.evaluate` ile `scrollTop`/`scrollHeight` ölçüyor, "N yeni
  olay ↑" rozetini ve "Devam et"/rozet ile başa dönüşü kontrol ediyor.
  Mutasyon: `TimelineScreen.tsx` `handleScroll`'daki `stream.setScrolledAway(el.scrollTop > 0)` →
  `stream.setScrolledAway(false)` → yeni test KIRMIZI (`Expected: 0, Received: 1` — dondurulması
  gereken olay listede göründü) → geri alındı, YEŞİL.
- **D13 (Ö3):** `tests/integration/sse-stream.test.ts`'e `/api/stream`'in ADR-008 Host
  allowlist'ine tabi olduğunu kanıtlayan bir test eklendi (ham `node:http` ile sahte `Host`
  başlığı, `tests/server/health.test.ts`'teki desenin aynısı).
  Mutasyon: `index.ts:237`'de `/api/stream`'i kontrolden muaf tutmak → yeni test KIRMIZI (bu kez
  bir assertion hatası değil, **timeout** — mutasyonlu kod isteği 403 yerine açık bir SSE akışı
  olarak kabul ettiği için `res.on('end')` hiç ateşlenmedi) → geri alındı, YEŞİL.
- **D14 (Ö1):** `useEventStream.ts`'ten saf bir `buildInitialLoadUrl(eventsUrl)` fonksiyonu dışa
  aktarıldı; `tests/integration/events-api.test.ts`'in zorunlu çiti artık URL'i literal yazmak
  yerine bu fonksiyondan türetiyor.
  Mutasyon: `buildInitialLoadUrl`'a `since_seq=-1` geri kondu → test KIRMIZI (`expected 400 to be
  200`) → geri alındı, YEŞİL.
- **D15 (Ö2):** İki ayrı, gerçek tarayıcı senaryosu birbirinden ayrıldı: (a) **geçici kopma**
  (mevcut AC5 testi, gerçek süreç kill/restart) → "Yeniden bağlanıyor" — yanlış "CEO/QA'ya
  bildirildi" iddiası içeren kod yorumu düzeltildi; (b) **kalıcı başarısızlık** (yeni test,
  `page.route` ile gerçek Chromium ağ katmanında kontrollü 2xx-dışı yanıt — WHATWG "fail the
  connection") → "Bağlantı koptu", bir daha yeniden bağlanmayı denemiyor (3 sn boyunca tek
  istek doğrulandı). Ayrıca AC5'in "kayıpsız" iddiası artık yapısal: kesinti sırasında aynı
  `MC_DATA_DIR`'e yazan geçici bir sunucu örneğiyle GERÇEKTEN bir olay üretiliyor, reconnect'te
  `Last-Event-ID` replay'iyle geldiği doğrulanıyor.
  Mutasyon 1 (kalıcı hata): `useEventStream.ts`'te `readyState === CLOSED` dalı da
  `'reconnecting'`e eşlendi → yeni test KIRMIZI (`Received: "Yeniden bağlanıyor"`) → geri alındı.
  Mutasyon 2 (yapısal replay): `stream.ts`'in replay döngüsü olayları hiç yazmayacak şekilde
  bozuldu → AC5 testindeki `rowDuring` assert'i KIRMIZI (`element(s) not found`) → geri alındı.
- **NOT-1:** `aria-live="polite"` canlı bölgesinin hiç testi yoktu.
  `tests/features/events/web/TimelineScreen.test.tsx`'e eklendi: bölgenin tek olduğu, `sr-only`
  taşıdığı, 4 `connectionStatus` değeri için rozetle birebir aynı 3 metne eşlendiği kontrol
  ediliyor. Mutasyon: `aria-live` özniteliği kaldırıldı → 5/5 test KIRMIZI → geri alındı.
- **Ele alınmayanlar (gerekçeli):**
  - **NOT-2** (vitest worker çökmesi, `exit code 3221226505`) — bu turda da bir kez tekrar
    gözlemlendi, hemen ardından 3/3 yeniden koşuda üretilemedi. Ortam kaynaklı, tekil bir kod
    değişikliğiyle giderilemeyecek bir flake; izlemeye devam.
  - **NOT-3** (`npm run e2e` bir kez sessiz `exit 127`) — bu turda tekrarlanmadı, aynı ortam
    flake sınıfı.
  - **NOT-4** (satırda yalnızca saat, tarih yok) — QA'nın kendisi "ileriki bir tur için not"
    diyor; bu turun kapsamı yalnızca D11-D15 + NOT-1, kapsam genişletilmedi.

**Nasıl doğrulandı**
- `npm run verify` = 0 → **27 dosya / 326 test** (314 baseline + 5 `build-css.test.ts` + 2 Host
  guard + 5 aria-live).
- `npm run e2e` = 0 → **9/9** (önceki 7 + yeni kaydırma testi + yeni "kalıcı hata" testi).
- `npm run e2e:dev` = 0 → **1/1**.
- Her bulgu için mutasyon uygulanıp KIRMIZI gözlemlenip birebir geri alındı (tabloyu yukarıda
  görebilirsiniz); her geri almadan sonra `git diff --stat` ilgili dosya için boş doğrulandı.
- **Görsel doğrulama:** `npm run build` + `npm start` (izole geçici veri dizini), gerçek
  olaylarla ekran görüntüsü: `docs/qa/screens/F-003-fix1-2026-09-05.png`. Filtre çipleri
  ayrık/yuvarlak, sütunlar (saat/proje/agent/araç/özet) ayrık boşluklu, "Duraklat" butonu
  çerçeveli, bağlantı rozeti ikon+metin+renk ile doğru, `sr-only` metni ekranda görünmüyor.
- Yetim süreç kontrolü: ekran görüntüsü sonrası `taskkill /F /T` ile 4 `node.exe` kapatıldı,
  `netstat` 7333/7334/7335/7433/7434'te `LISTENING` yok, `tasklist` yalnızca oturumun temel 2
  `node.exe`'sine döndü.

**Kalan risk**
- NOT-2/NOT-3 ortam flake'leri hâlâ açık (yukarıya bakınız) — kod değişikliğiyle kapatılamaz,
  yalnızca izlenebilir.
- `tests/build-css.test.ts` gerçek bir `vite build` çalıştırıyor (~1-2 sn) — test suite'e sabit
  bir süre ekliyor, kabul edilebilir ama büyürse (daha fazla build-bağımlı test) izlenmeli.
- Kaydırma E2E testi sabit bir viewport (900×500) ve 30 satır dolgusuna dayanıyor — ekran
  boyutu/satır yüksekliği varsayımları değişirse (ör. `min-h-8` başka bir değere çekilirse)
  testin taşma koşulunu yeniden doğrulamak gerekir.
- "Kalıcı hata" testi Playwright'ın `page.route` ile gerçek bir sunucu yanıtını simüle ediyor
  (gerçek production Host-allowlist 403'ü değil) — davranışsal olarak eşdeğer (ikisi de "ilk
  yanıt 2xx değil") ama sunucunun KENDİSİ bu testte hiç devrede değil; production'da bu yolu
  gerçekten tetikleyen tek bilinen senaryo ADR-008 Host guard'ı (D13'te ayrıca test edildi).

**Sonraki adım**
- qa-evaluator düzeltme turu 1'i incelesin (`status: qa`).

---

## 2026-09-05 — F-003 (SSE + canlı zaman çizelgesi) GEÇTİ · panel artık görülebilir

**Ne yapıldı**
- Sözleşme aşaması: 3 developer + 2 QA turu, 14 bulgu + 3 regresyon **kod yazılmadan** kapandı.
- Kod turu **iki kez** 150 tur sınırına takıldı; ikinci kesinti ürün kodunda **MUTATION-12** bıraktı
  (`TimelineScreen`'i `false` bayrağın arkasına saklayan `useState`). CEO geri aldı, doğruladı ve
  işi checkpoint olarak commit etti (`08b7670`) — iki agent üst üste commit edemeden kesilmişti.
- Uygulanan: SSE hub + `GET /api/stream` · `Last-Event-ID` telafisi + `resync` · zarif kapanış
  (`closeAll()` önce, `server.close()` sonra) · N-1 hayalet olay düzeltmesi · canlı zaman çizelgesi
  ekranı, filtreler, duraklat, kaydırma ile otomatik dondurma, bağlantı durumu (3 durum) ·
  DOM test altyapısı (ADR-010: jsdom 27.0.1 + Testing Library) · CI'ye ayrı E2E job'ı.
- QA kod turu: **KALDI** (Görsel/UX 2/10). Düzeltme turu 1 → QA doğrulama: **GEÇTİ**, 8·8·8·8.

**Nasıl doğrulandı**
- `npm run verify` = 0 (**27 dosya / 326 test**) · `npm run e2e` = 0 (**9**) · `e2e:dev` = 0 ·
  `npm audit` 0 açık.
- QA 6 bağımsız mutasyon koştu, **6'sı da KIRMIZI** (önceki turda 2'si tam, 1'i kısmi yeşil kalmıştı).
- **Canlı gözlem:** gerçek oturum olayları hook üzerinden akıp sayfa yenilenmeden göründü; duraklat
  ölçüldü (wheel → `scrollTop 500`, olay girmedi, "5 yeni olay ↑" rozeti, tıklama → başa dön + olay
  göründü); `sr-only` bölge gerçekten gizli (`1×1 px`, `clip-path: inset(50%)`); 390 px'te bozulma yok.
- Ekran görüntüleri: `docs/qa/screens/F-003-fix1-2026-09-05.png` ve QA'nın üç ekranı.

**Bu turun en pahalı bulgusu: stil boru hattı sessizce kopmuştu**
`vite.config.ts` kökü `src/web` olduğu için Tailwind v4'ün kaynak taraması `src/features/events/web/**`'i
hiç görmüyordu. Ölçüm: yalnızca `App.tsx`'te geçen 8 sınıfın 8'i CSS'te vardı, yalnızca `features/**`'de
geçen 9 sınıfın **0'ı**. Ekran çalışıyordu ama stilsizdi — `sr-only` canlı bölge görünür metin oluyordu.
**Üç test katmanı aynı anda kördü:** jsdom CSS yüklemez · `toBeVisible()` stilsiz öğe için de doğrudur ·
`shell.spec.ts`'in renk assert'i `bg-zinc-950` `App.tsx`'te de geçtiği için **tesadüfen** yeşildi.
Düzeltme + üretim CSS'ini denetleyen çit eklendi (5 sınıf, hepsi yalnızca `features/**`'de geçtiği
QA tarafından doğrulandı; üretim CSS'i 8,5 → 14,9 kB).

**Diğer iki ders**
- **Kendi zorunlu kıldığım çit dişsiz çıktı.** CEO'nun `since_seq` için istediği entegrasyon testi
  URL'i literal yazıyordu; istemci yanlış URL üretse yine yeşil kalırdı. Artık URL istemcinin kendi
  `buildInitialLoadUrl` fonksiyonundan türetiliyor.
- **Kodda doğrulanmamış iddia bırakılmasına izin verilmedi.** Bir E2E testi sözleşmenin assert'ini
  sessizce değiştirmiş ve yorumda "CEO/QA'ya bildirildi" demişti; `grep` sonucu sıfırdı. Semantik
  karara bağlandı (geçici kopma → "Yeniden bağlanıyor", kalıcı başarısızlık → "Bağlantı koptu"),
  ikisi de test edildi, yanlış yorum silindi.

**Kalan risk (hepsi NOT, bloklamıyor)**
- Stil çiti 69 özgün sınıfın 5'ini örnekliyor — dizin kanaryası, tam kapsama değil.
- Vitest içinde ikinci bir tam `vite build` koşuyor (süre maliyeti).
- E2E'de ara sıra worker/exit-127 gürültüsü; satırda tarih gösterilmiyor; replay ile `resync` ayrımı
  E2E'de ayrıştırılmıyor.

**Sonraki adım**
- **Faz 1'de kalan:** F-005 (proje kayıt + izleme) → F-006 (yazma kapısı) → F-007 (kanban), sonra
  **G4-1 kilometre taşı**.
- F-005'te **kullanıcı kararı gerekiyor:** hangi proje klasörleri izlenecek ve o projelere hook
  kurulacak mı (depo dışına yazma, her biri ayrı onay).
- F-006 **ADR-008 ekindeki artık riski** yeniden değerlendirmek zorunda.

---

## 2026-09-05 — F-005 (proje kayıt defteri + chokidar izleme + Ayarlar ekranı) kod turu tamamlandı

**Ne yapıldı**
- Sözleşme aşaması: 3 developer + 2 QA turu, 14 bulgu + 2 regresyon **tek satır kod yazılmadan**
  kapandı (`docs/qa/F-005-contract.md`, "KARAR: ONAY"). En pahalı yakalama QA'nın ampirik
  ölçümüydü: tur 1'in "yeni bağımlılık gerekmiyor, `node:fs.watch` yeter" kararı, aynı Windows
  makinesinde ölçülünce çürüdü — izlenen dizin silinip yeniden oluşturulunca `fs.watch` **kalıcı
  olarak ölüyor** (0 olay), dizin silinmiş kalırsa 1 sn'de 112.535 / 3 sn'de 342.548 olaylık bir
  fırtına üretiyor. CEO kararı D16 ile `chokidar@^4.0.3`'e geri dönüldü (mimari §3.4'ün zaten
  onayladığı kapalı listeden).
- Kod turu (önceki bir developer ajanı tarafından yazıldı, bu turda **kanıt** tamamlandı):
  `src/server/store/projects-registry.ts` (kayıt defteri, atomik yazma, `isCorrupt()`),
  `src/server/watch/{debounce,project-watcher}.ts` (150 ms trailing debounce + chokidar
  sarmalayıcı), `src/features/projects/server/{validate-path,handlers,service}.ts` (yol
  doğrulama — `fs.realpathSync.native` ile Windows büyük/küçük harf kanonikleştirmesi (D17),
  `GET/POST/DELETE /api/projects`, izleyici orkestrasyonu), `src/features/projects/web/
  {SettingsScreen,ProjectRow,AddProjectForm,useProjects}.tsx` (Ayarlar ekranı), `App.tsx`'e
  dişli düğmesi + `hidden` özniteliğiyle panel geçişi (CEO kararı — tam `tablist` deseni
  F-007'ye ertelendi), `useEventStream`'e `onProjects` kanalı, `index.ts`'te Origin kontrolünün
  tüm non-GET `/api/*` uçlarına genelleşmesi. 4 commit (`77e4e3a`, `174c3c6`, `96b9444`, `6ce35d2`).
- Bu turda tamamlanan: **§8'in 10 mutasyonunun tamamı** sıfırdan koşulup KIRMIZI gözlemlendi ve
  geri alındı (önceki ajan tur sınırına takılmıştı, kanıt diske hiç yazılmamıştı — bkz.
  `docs/qa/F-005-contract.md` "Mutasyon kanıtı (kod turu, 2026-09-05)"); chokidar'ın iki kritik
  senaryosunun (dizin sil+yeniden-oluştur, dizin silinmiş kalırsa olay fırtınası) **gerçek
  sayılarla** ölçümü; `docs/decisions/ADR-012-proje-izleme-mekanizmasi.md` kalıcı ADR'ye
  çevrildi; feature notu 6 AC kanıtla işaretlendi, `status: todo` → `status: qa`.

**Nasıl doğrulandı**
- `npm run verify` = 0 (**36 dosya / 425 test**, typecheck+lint+build dahil).
- `npm run e2e` = 0 (**14 geçti** — önceki feature'da 9'du, `settings.spec.ts`'in 5 testi
  gerçekten koşuyor: proje ekleme, geçersiz yol hatası, kaldırma+manifest, 3 proje, gerçek
  hesaplanmış `display` + `aria-pressed`).
- `npm run e2e:dev` = 0 (1 geçti).
- **Mutasyon kanıtı — 10/10 KIRMIZI, hiçbiri yeşil kalmadı** (tam tablo `docs/qa/F-005-contract.md`
  sonunda): debounce coalesce (1), AC3 çekirdek reddi (2), registry tekilleştirme (3), kaldırma
  yolunda kasıtlı `unlinkSync` → manifest testi kırmızı (4), gerçek `fs.rmSync` kodu → statik
  guard kırmızı (5), çoklu proje izolasyonu (6), Origin genelleşmesi regresyonu (7), `hidden`→
  koşullu render → unmount garantisi kırmızı (8), `hidden={false}` → gerçek tarayıcı `display`
  assert'i kırmızı (8b), izlenen proje köküne yazma → manifest "eklenen küme" testi kırmızı (9),
  `stopAll()` kaldırma → izleyici sayacı `server.close()` sonrası hâlâ `1` (10). Her mutasyondan
  sonra `git diff HEAD -- src/ tests/` boş doğrulandı.
- **chokidar'ın iki senaryosu gerçek sayılarla ölçüldü** (`tests/server/watch/
  project-watcher.test.ts` 5/5 yeşil + bağımsız tek seferlik ölçüm betiği, hiçbir kalıntı
  bırakmadan): dizin sil+yeniden-oluştur sonrası `.md` yazımı **hâlâ sinyal üretiyor** (fs.watch
  tam tersine kalıcı ölüyordu); dizin silinip silinmiş kalırsa 1 sn'de **0** ham olay, 3 sn'de
  **0** ham olay, CPU ~3.9 ms (fs.watch'ta 1 sn'de 112.535 olay, ~641 ms CPU idi). chokidar,
  `fs.watch`'ın iki kusurunu **miras almıyor** — `MC_WATCH_POLLING=1` geri dönüşüne gerek kalmadı.
- Yetim süreç/port kontrolü: `tasklist` içinde `node.exe` yok, 7333/7334/7335/7433/7434'te yalnızca
  `TIME_WAIT` (kapanmış) kayıtlar var, aktif dinleyici yok.

**Sözleşme turunun en pahalı bulgusu (kod yazılmadan yakalandı)**
- `node:fs.watch`'ın ölçülen iki kusuru (kalıcı ölüm + olay fırtınası) + `fs.realpathSync`'in
  (`.native` olmadan) Windows'ta büyük/küçük harfi kanonikleştirmediği (aynı gerçek dizine 6
  farklı yazımla çağrılınca 3 farklı dizge üretiyordu — `.native` ile **1**). İkisi de tur 1'in
  kâğıt üstünde savunulabilir ama ölçülmemiş varsayımlarıydı; QA'nın ampirik ölçümü onları çürüttü.

**Kalan risk / bilinçli kapsam dışı bırakılanlar**
- **AC1'in "kanbanda görünür" kısmı F-007'ye devredildi** (sözleşme §9 madde 7, CEO kararı D19) —
  Kanban henüz yok; bu feature'ın payı `features` SSE sinyalinin event-driven üretildiğinin
  kanıtlanmasıdır. F-007'nin kendi sözleşmesi bu sinyalin gerçek kart görünürlüğüne dönüştüğünü
  uçtan uca doğrulamalı.
- Tam `role="tablist"`/`tab`/`tabpanel` deseni + roving tabindex + ok tuşu gezinmesi **bu
  feature'da kurulmadı** (CEO kararı, Karpathy §2 — bugün tek gerçek ekran var) — F-007'ye
  devredildi (sözleşme §9 madde 8).
- chokidar'ın polling **olmayan** modda dosya kilitliyken (`EBUSY`, Windows/antivirüs) davranışı
  test edilmedi — gerçek kilit senaryosu simüle edilemiyor (F-002'nin retention riskiyle aynı
  sınıf, kabul edilmiş).
- Kayıp/geri gelen proje klasörü için otomatik yeniden izleme yok (periyodik "yeniden dene" —
  hiçbir AC istemiyor, kullanıcı projeyi kaldırıp yeniden eklemeli).
- `features` SSE payload'ı yalnızca `{project_id}` taşıyor, mimarinin literal `cards` alanını
  içermiyor (F-005'in dosya sahipliği `FeatureCard` türetimini kapsamıyor, F-007'nin işi).
- `EventRecord.project_id` hâlâ hiç doldurulmuyor (AC4 bugün `project_name` ile karşılanıyor).

**Sonraki adım**
- qa-evaluator F-005'i değerlendirsin (feature notu `status: qa`).
- Sıradaki feature: **F-006** (yazma kapısı) — Faz 1 sırası F-005 → F-006 → F-007, sonra G4-1
  kilometre taşı. F-006 ADR-008 ekindeki Origin/Host artık riskini yeniden değerlendirmek zorunda.

---

## 2026-09-05 — F-005 düzeltme turu 1: QA KALDI kararının 1 BLOKLAYICI + 4 ÖNEMLİ bulgusu kapatıldı

**Karar geçmişi**: qa-evaluator kod turunu **KALDI** verdi (`docs/qa/F-005-2026-09-05.md` =
`docs/qa/latest.md`) — İşlevsellik 6, Kod kalitesi 6, bir bloklayıcı. Bu turda o raporun "Düzeltme
turu için istenenler" bölümündeki 5 madde ele alındı.

**Ne yapıldı**

- **D20 (BLOKLAYICI-1) — kayıt defteri yazma hatası artık süreci öldürmüyor, iki katmanlı savunma:**
  1. *Yerel katman* (`src/features/projects/server/service.ts`): `addProject`/`removeProject`
     artık `resolveProjectPath`/`registry.add`/`registry.remove`'un fırlatabileceği her hatayı
     `try/catch` ile yakalar, UX'in istediği `storage_unavailable` / "Liste kaydedilemedi, tekrar
     deneyin." sonucuna çevirir (`handlers.ts` bunu 500'e eşler). Bu, `ingest.ts`'in mevcut
     `storage_unavailable` desenindeki "hata kaynağında yakalanır" ilkesiyle aynı katman.
  2. *Sistemik katman* (`src/server/index.ts`): yeni `withDispatchErrorBoundary` — dağıtıcının
     `http.createServer` geri çağrımını sarar, **hangi handler olursa olsun** senkron fırlayan
     her hatayı yakalayıp genel bir `500 internal_error` döner (yeni `ErrorCode` üyesi,
     `src/shared/types.ts`). Bu `process.on('uncaughtException')` DEĞİL — hata dağıtıcının kendi
     çağrı yığınında yakalanıyor (CLAUDE.md dersi: uncaughtException "asıl çözüm olamaz").
     Asenkron yol (`req.on('end')` içi, POST) bu sınırın kapsamı dışında kalır — onu yerel katman
     kapatıyor; iki katman birlikte hem senkron (DELETE, sistemik) hem asenkron (POST, yerel)
     yolu kapatıyor.
  - Ek: `projects-registry.ts`'in `writeAtomic`'i artık (a) bellek disk yazımı BAŞARILI
    olduktan SONRA güncelleniyor (önceden önce güncelleniyordu → bellek-disk ayrışması), (b)
    başarısız `renameSync` sonrası artakalan `.tmp` dosyasını `unlinkSync` ile temizliyor (tek
    istisna, no-delete-guard'a ayrı dar bir testle tanıtıldı — izlenen proje köklerine değil).
- **D21 (ÖNEMLİ-1)** — `tests/integration/projects-api.test.ts`'e "kaldırma sonrası
  `/api/health.watchers === N-1`" testi eklendi (QA'nın M7 mutasyonu artık kırmızı verir).
- **D22 (ÖNEMLİ-2)** — `no-delete-guard.test.ts` artık yazma alt dizgelerini de tarıyor
  (`writeFileSync`/`appendFileSync`/`mkdirSync`), `projects-registry.ts` için ayrı dar bir
  istisna testi var (yalnızca tehlikeli/özyinelemeli silme çağrıları — `rmSync`/`rmdirSync`/
  `fs.rm(` — hâlâ yasaklı). Yorum artık gerçekle tutarlı.
- **D23 (ÖNEMLİ-3)** — `src/web/App.tsx`'te başlık iki bölgeye ayrıldı: yalnızca
  başlık+nav `overflow-x-auto` ile kayar, Ayarlar dişlisi `shrink-0` ile bu kaydırma alanının
  **dışında**, sağda sabit kalır (`docs/03-ux.md:17`/`:21`). Yeni E2E testi 375px viewport'ta
  düğmenin `boundingBox()`'ının viewport sınırları içinde kaldığını (kaydırmaya gerek kalmadan)
  ölçüyor.
- **D24 (ÖNEMLİ-4 + NOT)** — manifest testi (`tests/integration/projects-api.test.ts`) artık
  boş dizinleri de `(relPath, kind)` olarak kaydediyor, böylece bir dizin silinse `after.length`
  sapması yakalanır. Feature notunun dosya sahipliği listesi sözleşme §2.2'deki paylaşılan
  dosyalarla güncellendi.
- **Ele alınmayanlar (gerekçeli):** NOT-1 (`feature_count` canlı tazelenmiyor) hiçbir AC
  istemiyor, F-007'nin `features` tüketimiyle doğal kapanacak. NOT-2a/b (test sayısı/yol
  dokümantasyon sapmaları) kapsam sızması değil, davranışı etkilemiyor — düzeltilmedi.

**Nasıl doğrulandı**

- `npm run verify` = 0 (**36 dosya / 430 test**, +5 yeni test — 2 BLOKLAYICI-1 HTTP testi
  (POST/DELETE), 2 sistemik sınır birim testi, 1 izleyici N-1 testi; typecheck+lint+build dahil).
- `npm run e2e` = 0 (**15 geçti**, +1 — 375px dar genişlik testi).
- `npm run e2e:dev` = 0 (1 geçti).
- **Mutasyon kanıtı (uygula → KIRMIZI → birebir geri al, her biri ayrı ayrı koşuldu):**

  | # | Mutasyon | Test | Kırmızı kanıt |
  |---|---|---|---|
  | D20-yerel | `service.ts`: `registry.add` çağrısındaki `try/catch` kaldırıldı | HTTP POST testi | Test 5s timeout ile patladı, Vitest "Uncaught Exception: EPERM... rename" yakaladı — QA'nın orijinal çökme izini birebir üretti |
  | D20-sistemik | `withDispatchErrorBoundary`'nin `try/catch`'i devre dışı bırakıldı | 2 birim testi | `expected [Function] to not throw an error but 'Error: boom' was thrown` |
  | D20-sistemik (dolaylı) | Yalnızca yerel katman (`removeProject`) kaldırıldı, sistemik katman sağlam bırakıldı | HTTP DELETE testi | `expected 'internal_error' to be 'storage_unavailable'` — sistemik katmanın gerçekten devreye girdiğinin kanıtı |
  | D20-tmp temizliği | `writeAtomic`'teki `.tmp` temizleme bloğu kaldırıldı | registry birim testi | `expected [ '.projects.....tmp' ] to have a length of +0 but got 1` |
  | D20-bellek sırası | `projects = [...projects, record]` yazımdan ÖNCEye taşındı | registry birim testi | `expected [...] to have a length of 1 but got 2` (bellek-disk ayrışması yeniden üretildi) |
  | D21 | `service.ts`: `watchers.delete(id)` kaldırıldı | yeni N-1 testi | `expected 2 to be 1` |
  | D22 | `service.ts`'e geçici `fs.appendFileSync(...)` eklendi | no-delete-guard | `expected true to be false` — artık STATİK olarak yakalanıyor (önceden yalnızca dinamik manifest testi yakalıyordu) |
  | D23 | Header eski tek-`overflow-x-auto` yapısına geri alındı | 375px E2E testi | `Expected: <= 375, Received: 593.98` |
  | D24 | `removeProject`'e geçici boş dizin silme (`docs/approvals`) eklendi | AC2 manifest testi | `expected 11 to be 12` |

  Her mutasyondan sonra `git diff` ile birebir geri alma doğrulandı; tüm mutasyonlar geri
  alındıktan sonra `npm run verify` + `npm run e2e` + `npm run e2e:dev` tekrar 0/430/15/1 verdi.
- **Görsel doğrulama:** `npm run build` + izole `MC_DATA_DIR` + gerçek fixture proje ile
  `tsx src/server/index.ts` (port 7433) çalıştırıldı, Playwright ile 375px viewport'ta
  Ayarlar ekranı ekran görüntüsü alındı: `docs/qa/screens/F-005-fix1-2026-09-05.png`. Ayarlar
  dişlisi (amber, aktif durumda) başlığın kesilmesine rağmen tam görünür ve sağda sabit —
  ÖNEMLİ-3 gözle de kapandı.
- Yetim süreç kontrolü: `tasklist`'te bırakılan `node`/`tsx` yok, 7333/7334/7335/7433/7434'te
  `LISTENING` yok (yalnızca kapanmış bağlantıların `TIME_WAIT` kayıtları).

**Kalan bilinen sınırlamalar**

- Sistemik hata sınırının (`withDispatchErrorBoundary`) kendisi yalnızca izole, deterministik bir
  birim testle kanıtlandı (gerçek bir `uncaughtException`'ı canlı `createServer` üzerinden
  tetiklemek Vitest worker'ının kendisini çökertme riski taşıdığı için tercih edilmedi — bkz.
  D20-sistemik mutasyonunun "dolaylı" kanıtı, DELETE HTTP testi üzerinden). Üretimde iki katman
  birlikte çalışıyor; yalnızca sistemik katmanın gerçek bir HTTP isteğiyle canlı ölçümü yapılmadı.
  Bu, önceki QA turunun "genel 500 yolu" iddiasının artık **gerçek** olduğunu değiştirmiyor.
  - **Not:** Bunun için tarayıcı DELETE testinde yerel katmanı geçici olarak kaldırdığımda
    sistemik katmanın devreye girdiği (`internal_error`) doğrudan gözlemlendi — dolaylı ama
    canlı bir kanıt.
- QA'nın NOT-1/NOT-2 maddeleri bilinçli olarak ele alınmadı (gerekçe yukarıda).
- Kod turunda önceki ajanın devrettiği diğer bilinen sınırlamalar (chokidar `EBUSY` senaryosu
  test edilmedi, otomatik yeniden izleme yok, `features` payload'ı `cards` içermiyor,
  `EventRecord.project_id` boş) değişmedi — bu turun kapsamı yalnızca QA'nın KALDI bulgularıydı.

**Sonraki adım**
- qa-evaluator bu düzeltme turunu değerlendirsin (feature notu `status: qa`).

---

## 2026-09-05 — F-005 düzeltme turu 2 (D25-D28, QA'nın KOŞULLU GEÇTİ kararı kapatıldı)

**Ne yapıldı** — QA'nın düzeltme turu 1 doğrulaması (`docs/qa/F-005-fix1-2026-09-05.md`)
KOŞULLU GEÇTİ verdi: 2 ÖNEMLİ (D25/D26) + NOT-4 (D27) + iki NOT (D28). Sözleşme
`docs/qa/F-005-contract.md`'nin "Düzeltme turu 2" bölümüne planlandı, sonra uygulandı.

- **D25 (ÖNEMLİ-1) — dağıtıcı sınırının bağlantısı artık davranışsal olarak çitli.** Üretim kodu
  değişmedi (davranış zaten doğruydu). `tests/integration/projects-api.test.ts`'e gerçek
  `createServer()` + gerçek HTTP isteği kullanan yeni bir test eklendi: `handleHealth`'in
  senkron çağırdığı gerçek `projectsService.getActiveWatcherCount()` metodu test içinde geçici
  olarak fırlayacak şekilde değiştirilir (üretim kodu dokunulmaz, `finally`'de birebir geri
  alınır), gerçek `fetch('/api/health')` yapılır → 500 `internal_error` + sonraki istek 200.
- **D26 (ÖNEMLİ-2) — "Kaldır" hatası artık kullanıcıya görünür.** `useProjects.ts`'in
  `remove()`'u `add()` ile birebir aynı desene çevrildi: `{ok:true}` / `{ok:false,message}`
  döner (yanlış "SSE zaten senkronize edecek" yorumu silindi — yazma başarısızken `service.ts`
  o kanalda hiç yayın yapmıyor). `ProjectRow.tsx` sonucu `role="alert"` ile yüzeye çıkarır
  (`AddProjectForm`'daki desenle tutarlı), buton kaldırma sırasında devre dışı kalır
  ("kaldırılıyor…").
- **D27 (NOT-4) — chokidar debounce yolundaki SSE broadcast artık süreci düşürmüyor.**
  `service.ts`'e küçük, paylaşılan bir `safelyNotify(action, fn)` yardımcısı eklendi (try/catch
  + Türkçe uyarı logu); yazma zaten başarılı olduktan SONRA çalışan üç yan etki bununla sarıldı:
  `addProject`'in izleme başlatma+broadcast'i, `removeProject`'in izleme durdurma+broadcast'i, ve
  — asıl risk — `startWatchingIfPossible`'ın chokidar'ın debounce zamanlayıcısından tetiklenen
  `onChange` callback'i (`hub.broadcast('features', ...)`, kapanmış bir SSE soketine `res.write`
  fırlarsa artık süreç ölmüyor).
- **D28 (NOT'lar) — iki ölü/yanlış doküman temizlendi.** `App.tsx`'teki `style={{minWidth:0}}`
  + onu haklı çıkaran 10 satırlık yanlış gerekçe yorumu kaldırıldı (QA'nın M11a mutasyonu zaten
  satırın gereksiz olduğunu kanıtlamıştı). `no-delete-guard.test.ts`'teki `projects-registry.ts`
  istisnası dosya düzeyinden **dizge düzeyine** daraltıldı: yalnızca tam `unlinkSync(tmpPath)`
  çağrısına izin verilir, başka herhangi bir `unlinkSync(...)` (ör. izlenen bir projenin
  `README.md`'sini silen bir regresyon) artık guard'ı KIRMIZI vermeye zorlar.

**Nasıl doğrulandı**

- `npm run typecheck` = 0, `npm run lint` = 0 (ayrı ayrı çalıştırıldı).
- `npx vitest run` (tüm süit) = **37 dosya / 437 test** (+7 yeni test — D25 1, D26 2, D27 3,
  D28 1), art arda 2 kez tertemiz.
- `npm run verify` = 0 (typecheck+lint+437 test+build dahil). `npm run e2e` = 0 (**15/15**).
  `npm run e2e:dev` = 0 (1/1).
- **Mutasyon kanıtı (uygula → hedef testi koş → KIRMIZI gözlemle → `Edit` ile birebir geri al —
  her biri ayrı çalıştırıldı, `git diff` geri alma sonrası boş):**

  | # | Mutasyon (dosya) | Koşulan test | Kırmızı kanıt (ilk satır) |
  |---|---|---|---|
  | D25 | `index.ts:288` — `withDispatchErrorBoundary(` sarmalayıcısı kaldırıldı | yeni D25 testi | `Error: Test timed out in 5000ms` + Vitest "Uncaught Exception: qa-probe-sync" (senkron throw dağıtıcının çağrı yığınında sınırsız kaldı, istek hiç yanıt alamadı) |
  | D26 | `useProjects.ts`: `remove()` eski `if (!res.ok) return`'e döndürüldü | `useProjects.test.ts` + `SettingsScreen.test.tsx` (yeni ikisi) | `expected {ok:true} to deeply equal {ok:false,…}`; `findByTestId('remove-project-error')` timeout ile patladı |
  | D27 | `service.ts`: debounce callback'indeki `safelyNotify` sarmalayıcısı kaldırıldı | yeni `service.test.ts` (mock tabanlı, chokidar zamanlamasına bağımlı değil) | `expected [Function] to not throw an error but 'Error: sse yayını başarısız (qa-probe)' was thrown` |
  | D28 | `projects-registry.ts`: `unlinkSync(tmpPath)` → `unlinkSync(path.join(dataDir,'README.md'))` | genişletilmiş `no-delete-guard.test.ts` | `expected 'unlinkSync(path.join(dataDir, \'README.md\')' to be 'unlinkSync(tmpPath)'` |

  Not: D27'nin ilk denemesi gerçek chokidar dosya değişikliği + 600ms bekleme kullanıyordu ama
  bu, mutasyonu YAKALAMADI (assertion, broadcast'in gerçekten çağrılıp çağrılmadığından
  bağımsızdı) — QA'nın "yeşil kalan mutasyon = ölçmeyen test" dersi (CLAUDE.md) burada da
  tekrarladı. Test, `watchProjectFeatures`'ı `vi.mock` ile sahteleyip `service.ts`'in geçirdiği
  gerçek `onChange` closure'ını doğrudan yakalayıp çağıran deterministik bir teste çevrildi;
  bu hem zamanlamaya bağımlı değil hem de mutasyonu güvenilir şekilde kırmızı veriyor.
- Süreç/port temizliği: `tasklist`'te `node.exe` yok; 7333/7334/7335/7433/7434'te yalnızca
  kapanmış bağlantıların `TIME_WAIT` kayıtları var, `LISTENING` yok.

**Kalan risk / bilinçli kapsam dışı bırakılanlar**
- D20-D24 ve önceki turların onaylanan bölümleri (manifest içerik değişikliği, chokidar ölçümü,
  sekme deseni, `hidden`, görsel akış) bilerek yeniden açılmadı (QA'nın kapsam sınırı).
- `docs/qa/latest.md`'nin NOT-3 (375px'te marka kırpılması + nav etiketlerinin kaydırma şeridinde
  kalması) ve NOT-5 (bir kerelik `vitest-pool` worker hatası) ve NOT-6 (`storage_unavailable`
  mesajının yol-yarışı senaryosunda semantik olarak isabetsiz olması) bu turun kapsamı dışında
  bırakıldı — QA bunları kapanış listesine koymadı.
- `safelyNotify`'ın logladığı uyarılar yalnızca stderr'e yazılıyor; kalıcı bir metrik/alarm yok
  (mevcut mimaride başka hiçbir hata yolu da böyle bir mekanizma kullanmıyor, kapsam dışı).

**Sonraki adım**
- qa-evaluator bu düzeltme turunu dar kapsamda doğrulasın (yalnızca D25-D28 + mutasyon kanıtı);
  D20-D24 ve önceki turların onaylanan bölümleri yeniden açılmasın.

---

## 2026-09-05 — F-005 (proje kayıt + chokidar izleme + Ayarlar) GEÇTİ

**Ne yapıldı**
- Sözleşme: 3 developer + 2 QA turu, 14 bulgu + 2 regresyon **kod yazılmadan** kapandı.
- Kod: kayıt defteri (`data/projects.json`, atomik), yol doğrulama, chokidar izleyici,
  `GET/POST/DELETE /api/projects`, Ayarlar ekranı + dişli düğmesi, Origin korumasının **tüm
  non-GET `/api/*` uçlarına** genelleşmesi.
- QA kod turu **KALDI** (1 bloklayıcı) → düzeltme 1 → **KOŞULLU GEÇTİ** (2 önemli) → düzeltme 2 →
  **GEÇTİ**. Puanlar: İşlevsellik 9 · Bütünlük 9 · Görsel/UX 8 · Kod kalitesi 8.

**Nasıl doğrulandı**
- `npm run verify` = 0 (**37 dosya / 437 test**) · `e2e` = 0 (15) · `e2e:dev` = 0 (1) · `npm audit` 0.
- QA 6 bağımsız mutasyon koştu, 5'i kırmızı; tek yeşil kalan NOT seviyesinde (guard `fs.promises.unlink`
  biçimine kör, dinamik manifest yakalıyor).
- **Canlı doğrulama:** üretim build'i + izole veri dizini + gerçek geçici fixture ile ekle → canlı
  `features` SSE → kaldır akışının tamamı tarayıcıdan koştu; kaldırma sonrası fixture'ın dosyaları ve
  hash'leri değişmedi, `watchers` 1→0.

**Bu feature'ın üç dersi**
1. **Ölçüm, kâğıt üstündeki mantığı çürüttü.** Sözleşme "Windows-only olduğumuz için `chokidar`
   gereksiz, `node:fs.watch` yeter" diyordu; savunulabilir görünüyordu. QA denedi: izlenen dizin
   silinip yeniden oluşturulunca `fs.watch` **sessizce ve kalıcı olarak ölüyor** (2 olay → 0), dizin
   silinmiş kalırsa 1 sn'de **112.535** olay üretiyor. Bu bir `git checkout` desenidir ve ürün tam
   olarak proje depolarını izliyor. chokidar aynı senaryolarda: sinyal geri geliyor, fırtına
   **0 olay/sn**. Karar geri alındı, ADR-012 ölçümlerle yazıldı.
2. **Yakalanmamış yazma hatası sunucuyu öldürdü — ikinci kez.** F-002'de kuyruk zehirlenmesi,
   burada kayıt defteri yazımı. İki çağrıyı sarmak yerine **HTTP dağıtıcısına üst düzey hata sınırı**
   kondu (hangi handler fırlarsa fırlasın 500, süreç yaşar) ve sınırın **bağlandığı** davranışsal
   testle çitlendi — çünkü ilk denemede sarmalayıcı silinince 430/430 yeşil kalıyordu.
3. **Sessiz başarısızlık yine çıktı.** Yazma engelliyken "Kaldır" hiçbir geri bildirim vermiyordu;
   "Ekle" ise doğru banner'ı gösteriyordu — desen vardı, uygulanmamıştı.

**Kalan risk (hepsi NOT)**
- `safelyNotify` closure granülerliği: `watcher.stop()` fırlarsa `watchers.delete(id)` atlanabilir.
- `stopAll()` sarılmamış (çağıranı kapanış dinleyicisi).
- `no-delete-guard` `fs.promises.unlink(` biçimine kör (dinamik manifest yakalıyor).
- vitest worker fork kararsızlığı ara sıra tekrarlıyor (zincir duruyor, sessiz yeşil değil).
- 375px'te marka adı kırpılıyor — F-007'ye taşındı.

**Sonraki adım**
- **F-006 yazma kapısı** (F-007'den ÖNCE bitmek zorunda), sonra **F-007 kanban**, sonra **G4-1**.
- F-006 sözleşmesinde **kullanıcı kararı gerekiyor:** ADR-008 ekindeki artık risk (aynı makinedeki
  başka bir yerel sayfa panele istek atabiliyor) yeniden değerlendirilecek — F-006 sunucuya kullanıcı
  adına diske yazdırdığı için tehdit modeli değişiyor.
