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
