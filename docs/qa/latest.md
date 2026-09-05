KARAR: KALDI
ESKALE: false

# F-004 QA — kod turu (qa-evaluator, 2026-09-05)

Kapsam: `.claude/hooks/send-event.cjs` · `scripts/install-hook.mjs` · `tests/helpers/emit-hook.ts` ·
`tests/integration/send-event-hook.test.ts` · `tests/scripts/install-hook.test.ts` ·
`tests/no-external-host.test.ts` genişletmesi · `KURULUM.md`.
Ölçüt: `docs/features/F-004-send-event-hook.md` (6 AC + CEO kararları A/B/C/D + AC5 kanıtı) ·
`docs/qa/F-004-contract.md` (öncelik: "CEO onayı — sözleşme KAPANDI" → "CEO kararı — DÜZELTME
(zamanlama assert'i)" → "CEO kararı — zamanlama testlerinin kırılganlığı" 1. ve 3. madde → gövde) ·
`docs/02-architecture.md` §8.1/§8.2/§8.3/§6.1/§5.1 · ADR-006 · `CLAUDE.md` öğrenilen kurallar.

**Tek cümlelik karar:** Kod çalışıyor ve canlı hat kanıtlı, ama developer'ın kendi bulduğu gerçek
üretim hatasının düzeltmesi **hiçbir test tarafından korunmuyor** — mutasyonu 185 testin tamamı
yeşil geçiyor. Bu, brief'in önceden bloklayıcı ilan ettiği durumdur.

---

## 1. Çalıştırdığım komutlar ve gerçek çıktılar

| Komut | Çıkış kodu | Sonuç |
|---|---|---|
| `npm run verify` (typecheck + lint + test + build) | **0** | `Test Files 14 passed (14)` · `Tests 185 passed (185)` · `vite build ✓ built in 924ms` |
| `npm run e2e` | **0** | `1 passed (5.5s)` — `tests\e2e\shell.spec.ts:9` |
| `npm run e2e:dev` | **0** | `1 passed (3.5s)` — `tests\e2e\dev-shell.spec.ts:6` |
| `npm audit` | **0** | `found 0 vulnerabilities` |

Developer'ın bildirdiği **185 test / 14 dosya** teyit edildi (birebir aynı).
Test koşusundaki `Uyarı: MC_PORT ... geçersiz` ve `Hata: ... EISDIR` satırları kasıtlı negatif
senaryoların (geçersiz port toleransı, 503 `storage_unavailable`) beklenen çıktısıdır, bulgu değildir.

---

## 2. AC1–AC6 kanıt tablosu

| AC | Durum | Kanıt |
|---|---|---|
| **AC1** — stdin'den okur, alanları çıkarır, `POST /api/events`'e gönderir, `transcript_path` dahil | GEÇTİ | `send-event.cjs:147-156` (`path: '/api/events'`, `host: '127.0.0.1'`), `sendPayload` (`:197-218`) orijinal alanları **silmeden** iletir. Test: `send-event-hook.test.ts:127` gerçek `createServer` + gerçek çocuk süreç, 403 almıyor. **Canlı kanıt:** `data/events/2026-09-04.jsonl` seq 12 → `transcript_path` dolu. |
| **AC2** — sunucu kapalıyken hata basmaz, bloklamaz, exit 0 | GEÇTİ | 6 alt senaryo (`:159` ECONNREFUSED, `:171` ECONNRESET, `:186` sessiz, `:201` damla, `:216` 503, `:241` stdin kapanmıyor); hepsinde `exitCode===0`, `stdout===''`, `stderr===''`. `send-event.cjs` içinde **hiç** `console.*`/`process.stdout`/`process.stderr` yok (grep: NONE) → mimari §8.1 "Asla stdout'a yazma" sağlanıyor. Ölçülen süreler §4'te. |
| **AC3** — bilinmeyen/eksik alanda çökmez, bilinmeyenler ham iletilir | GEÇTİ | `:269` boş stdin, `:281` `x_custom_field` sunucudaki `raw`'da, `:297` bozuk JSON → `raw.raw_text`. `send-event.cjs:220-237` üç dalı da kapsıyor; `PARSE_ERROR_RAW_TEXT_CAP=2000` (`:29`) sözleşmeye uygun. |
| **AC4** — `install-hook` kopyalar + kayıt ekler, bozmaz, çift kayıt yapmaz | GEÇTİ | §5'teki bağımsız sandbox denetimim + `install-hook.test.ts` 11 testi. İki koşu sonrası `send-event` esas sayısı **13** (çift yok), yabancı hook ve `permissions` korunuyor. |
| **AC5** — gerçek oturumda elle doğrulama **+ `KURULUM.md`'ye yazılır** | **KISMİ** | Doğrulamanın kendisi GEÇTİ (denetimim §3). Ancak AC metninin ikinci yarısı ("`KURULUM.md`'ye yazılır") **karşılanmadı** — bkz. bulgu Ö2. |
| **AC6** — smoke test: sahte payload → sunucuya ulaştığı otomatik doğrulanır | GEÇTİ | `send-event-hook.test.ts:313` (`emit-hook.ts` `runHook` ile gerçek çocuk süreç) → olay `GET /api/events`'te görünüyor. |

### Ek (CEO kararları) kontrolü

| Karar | Durum | Kanıt |
|---|---|---|
| **A** — `no-external-host` çiti `.claude/hooks/**` + `.cjs` kapsar | GEÇTİ | `tests/no-external-host.test.ts:33` `walk(path.join(ROOT,'.claude','hooks'), ['.cjs'])` + `:60` körlük kontrolü testi. Mutasyon M3 ile KIRMIZI verdiği doğrulandı. |
| **B** — ≤400 ms bütçe | GEÇTİ | Sabitler `send-event.cjs:20-22` (120/100/150); ölçülen en kötü senaryo (damla) 153-175 ms. |
| **C** — kompakt zarf `summary`'yi boş bırakmaz | GEÇTİ | `buildCompactEnvelope` (`:95-128`) `command`/`file_path`/`description` + `user_input`/`last_assistant_message`/`reason`/`notification_type`, her biri `truncate200`. Mutasyon M6 ile KIRMIZI. |
| **D** — `install-hook` yalnızca geçici dizinlere / bu deponun köküne | GEÇTİ | Testler `os.tmpdir()` kullanıyor; ben yalnızca scratchpad sandbox'a çalıştırdım, bu deponun `.claude/settings.json`'ına **dokunmadım**. |

---

## 3. AC5 kanıtının denetimi (yeniden kurulum YAPILMADI)

Feature notundaki "AC5 doğrulama kanıtı" bölümünün her iddiası diskte kontrol edildi:

| İddia | Sonuç |
|---|---|
| `.claude/hooks/send-event.cjs` yerinde, 8246 bayt | ✓ `ls -l` → `8246 Sep 5 00:13 send-event.cjs` |
| `.claude/settings.json` geçerli JSON, 13 olay tipi | ✓ `JSON.parse` başarılı, `Object.keys(hooks).length === 13` |
| 6 orijinal güvenlik hook'unun **altısı da** duruyor | ✓ `session-start` (SessionStart + PostCompact), `gate-check` (PreToolUse `Edit\|Write`), `block-dangerous` (PreToolUse `Bash`), `asset-guard` (PreToolUse `mcp__higgsfield__.*`), `post-format` (PostToolUse `Edit\|Write`), `stop-check` (Stop) — hepsi kendi matcher'ıyla, `send-event.cjs` **yanlarına** eklenmiş |
| `settings.json.bak` yedeği alınmış | ✓ 2124 bayt; `.gitignore:19-20` ile depo dışında tutuluyor, `git status` temiz |
| `data/events/` içinde `transcript_path` dolu gerçek olay | ✓ seq 12: `PreToolUse` · `tool_name: Bash` · `session_id: b13e8d3f-…` (bu oturumun gerçek kimliği) · `project_name: mission-control` · `transcript_path: C:\Users\pc\.claude\projects\...jsonl` · `client_version: 1` · `flags: []` |
| `.seq` kayması yok | ✓ `.seq = 13`, dosya 13 satır, son kayıt `seq 12` — tutarlı |

**Ek canlı kanıt (bu turda kendiliğinden üretildi):** sandbox denetimim sırasında `rm -rf` komutum
bu deponun kendi `block-dangerous.cjs` hook'u tarafından engellendi — yani 6 güvenlik hook'u
`send-event.cjs` kurulumundan sonra da **fiilen çalışıyor**, yalnızca dosyada durmuyorlar.

AC5'in **doğrulama** yarısı sağlam. Yazım yarısı için bulgu Ö2.

---

## 4. Zamanlama kanıtının denetimi

| Gereklilik (CEO kararı — DÜZELTME) | Durum |
|---|---|
| (a) Dört senaryoda dış duvar saati **> 1000 ms → KIRILIR** | ✓ VAR. `toBeLessThan(1000)` altı senaryoda: `:169`, `:181`, `:195`, `:210`, `:232`, `:250` (sözleşmenin istediği dördün üstünde). |
| (b) Zamanlayıcı sabitlerinin **saat kullanmayan** birim testi (120 · 100 · 150) | ✓ VAR. `send-event-hook.test.ts:465` kaynağı okuyup regex ile `STDIN_TIMEOUT_MS=120`, `IDLE_TIMEOUT_MS=100`, `TOTAL_TIMEOUT_MS=150` doğruluyor. Saat yok. |
| Kırılgan tek kademeli `elapsedMs < 400` assert'i **olmamalı** | ✓ YOK. Tüm dosyada `400` yalnızca `'z'.repeat(400_000)` (test verisi) olarak geçiyor. |
| `MC_TIMING_FILE` gibi test-amaçlı yan kanal **olmamalı** | ✓ YOK. `send-event.cjs`'te hiçbir dosya yazma/teşhis kanalı yok (`fs` yalnızca `realpathSync` için). |
| Damla test sunucusu **istemci kapatana kadar** damlatmalı (sonlu sınır kaçak üretir) | ✓ DOĞRU KURULMUŞ. `startDripServer` (`:100-120`) `setInterval(…, 40)` ile **üst sınırsız** damlatıyor, yalnızca `socket.destroyed`/`'close'` ile duruyor. Ayrıca gerçek HTTP durum satırı + bitmemiş başlık (`'HTTP/1.1 200 OK\r\nX-Drip: '`) yazıyor — ham baytların Node HTTP parser'ında anında parse hatası üretip senaryoyu geçersiz kılması sorunu çözülmüş. |
| (c) Her bekçi için ayrı mutasyon | **KISMİ** — bkz. bulgu Ö1: idle bekçisini ayırt eden bir test yok. |

**Ölçtüğüm gerçek süreler** (damla sunucusuna karşı, TCP bağlantısından süreç çıkışına, 5 koşu):
`[171, 166, 175, 153, 169]` ms → 150 ms'lik toplam bekçiyle tutarlı, 400 ms bütçesinin ve
1000 ms sert kapısının altında. Developer'ın bildirdiği ~190-270 ms ile aynı büyüklük sırasında.

**Kurulum doğru, kanıt gücü eksik:** (a) ve (b) yerinde ama her ikisi de yalnızca **üst sınır**
ölçüyor. Hiçbir assert "hangi bekçinin ateşlediğini" ölçmüyor; bu, B1 ve Ö1'in kök nedeni.

---

## 5. `install-hook` güvenlik denetimi (bağımsız, yalnızca geçici sahte dizinlerde)

Sandbox: `…\scratchpad\sb1` ve `…\scratchpad\sb2`. Bu deponun `.claude/settings.json`'ına ve
depo dışına **hiç çalıştırılmadı** (CEO kararı D).

| Kontrol | Sonuç |
|---|---|
| Temiz hedefte kurulum | ✓ `Kurulum tamamlandı: 13 eklendi, 0 zaten var.` exit 0 |
| **İdempotentlik** (iki kez çalıştır) | ✓ 2. koşu `0 eklendi, 13 zaten var.` — `send-event` esası tam **13** kez, çift kayıt yok |
| **Mevcut hook kayıtlarının korunması** | ✓ `PreToolUse` 2 gruba çıktı: yabancı `{matcher:"Bash", …my-security-hook.cjs}` **birebir duruyor**, `{matcher:"*", …send-event.cjs, async:true, timeout:5}` yanına eklendi |
| `hooks` dışı anahtarların korunması | ✓ `permissions: {allow:["Bash(ls:*)"]}` aynen duruyor |
| **Yedek** (`.bak`) | ✓ 1. koşuda oluştu ve `diff` ile kurulum-öncesi orijinalle **birebir aynı**; 2. koşuda üzerine yazılmadı |
| **Bozuk JSON'da hiç yazmama** | ✓ exit 1 + Türkçe hata; `.claude/` içinde **yalnızca** orijinal `settings.json` kaldı — `hooks/` dizini oluşmadı, `send-event.cjs` kopyalanmadı, `.bak` alınmadı, `settings.json` `diff` ile değişmemiş |
| **Adım sırası** (önce doğrula sonra yaz) | ✓ `install-hook.mjs:108-123` okuma+parse, `:150-155` ilk yazma — sözleşme §6'nın tur 2 düzeltmesi doğru uygulanmış |
| Argüman doğrulama | ✓ argümansız / olmayan yol / **dizin yerine dosya** → üçü de exit 1, yazma yok |
| Geçici dosya sızıntısı | ✓ `settings.json.tmp-<pid>` kalıntısı yok (atomik `rename`), `.gitignore:20` ayrıca çitliyor |

---

## 6. Kendi mutasyon turum (6 mutasyon, developer'ın 7'siyle çakışmayan)

| # | Mutasyon | Kırmızı veren test | Hata mesajının ilk satırı | Geri alındı |
|---|---|---|---|---|
| **M1** | `send-event.cjs:251` `clearTimeout(stdinGuard)` kaldırıldı (developer'ın bulduğu gerçek üretim hatası) | **HİÇBİRİ — 185/185 YEŞİL** | — (kaçak) | ✓ `git checkout` |
| **M2** | `install-hook.mjs:65` `existing.slice()` → `[]` (mevcut kayıtlar korunmuyor) | `install-hook.test.ts` › "iki kez çalıştırma → tek kayıt" **ve** "mevcut yabancı hook'lar korunur" | `AssertionError: expected 'Kurulum tamamlandı: 13 eklendi, 0 zat…' to contain '0 eklendi'` | ✓ |
| **M3** | `no-external-host.test.ts:33` `.claude/hooks` tarama kökü kaldırıldı (CEO kararı A) | "taranan dosyalar arasında .claude/hooks kökünden en az biri var" | `AssertionError: expected false to be true // Object.is equality` | ✓ |
| **M4** | `send-event.cjs:141` `finish()` içinde `process.exit(0)` → `exit(1)` (çıkış kodu 0 garantisi) | 15 test birden | `AssertionError: expected 1 to be +0 // Object.is equality` | ✓ |
| **M5** | `send-event.cjs:172-175` idle soket bekçisi (`req.setTimeout`) tamamen kaldırıldı | **HİÇBİRİ — 185/185 YEŞİL** | — (kaçak) | ✓ |
| **M6** | `send-event.cjs:98` kompakt zarftan `tool_input.command` düşürüldü (Karar C) | "200 KB tool_input (Bash) → … summary boş değil" **ve** "MC_MAX_PAYLOAD=0 → … summary yine dolu kalır" | `AssertionError: expected '' to be 'npm test' // Object.is equality` | ✓ |

**4 yakalandı, 2 kaçtı.** İki kaçağın ikisi de featureın çekirdek güvenlik özelliğinde
(bloklamama bekçileri) — yani en çok korunması gereken yerde.

### M1'in kaçağı neden bloklayıcı (ölçülmüş kanıt)

Brief bu mutasyonu önceden bloklayıcı ilan etti; ölçtüm ve gerçekten zararlı olduğunu doğruladım.

1. **Hiçbir test görmüyor:** mutasyon uygulanmışken `npx vitest run` → `Test Files 14 passed (14)`,
   `Tests 185 passed (185)`. Damla sunucu testi dahil hepsi yeşil.
2. **Ağ bekçileri gerçekten atlanıyor** (damla sunucusuna karşı, TCP bağlantısından çıkışa, 5'er koşu):

   | Kod | Ölçüm (ms) | Ateşleyen bekçi |
   |---|---|---|
   | Yayınlanan (düzeltme yerinde) | `171, 166, 175, 153, 169` | toplam süre bekçisi (150 ms) |
   | M1 mutasyonlu | `141, 137, 126, 132, 118` | **yetim stdin zamanlayıcısı (120 ms)** |

   İki dağılım örtüşmüyor; bir alt sınır assert'i (ör. bağlantıdan çıkışa `>= 145 ms`) bu
   gerilemeyi kesin yakalardı. Mevcut assert yalnızca `elapsedMs < 1000` — 30 kat gevşek.
3. **Sessiz olay kaybı gözlendi:** stdin'i ~110 ms'ye yayılmış parçalarla besleyen bir harness'ta
   (büyük `tool_input`, gerçekçi bir yavaş hook çerçevesi) mutasyonlu kod
   `EVENT_DELIVERED: false`, `exitCode: 0`, `stderr: ''` üretti — sunucu **tam istek almadı**
   (`conns: 0`), yani olay hiç gönderilmeden süreç sonlandı. Hata sessiz: exit 0, boş stderr.

Düzeltmenin kendisi kodda **doğru ve yerinde** (`send-event.cjs:250-256`, açıklayıcı yorumla).
Sorun, `CLAUDE.md`'nin kendi kuralının ihlali: *"41 test geçiyor tek başına hiçbir şey kanıtlamaz"*.
Bu hata bir kez zaten oluştu; onu yakalayan şey bir test değil, developer'ın elle enstrümantasyonuydu.
Aynı satır yarın bir refactor'da silinirse hiçbir kapı çalmaz.

---

## 7. Bulgular (1 BLOKLAYICI · 2 ÖNEMLİ · 2 NOT)

### BLOKLAYICI

**B1 — stdin bekçisi `clearTimeout` düzeltmesinin hiçbir testi yok (yetim zamanlayıcı gerilemesi serbest)**
- **Dosya:** `.claude/hooks/send-event.cjs:250-256` (düzeltme) · `tests/integration/send-event-hook.test.ts:201-215` (onu ölçmesi gereken damla testi)
- **Tekrar üretme:** `send-event.cjs:251`'deki `clearTimeout(stdinGuard)` satırını sil → `npx vitest run`
- **Beklenen:** en az bir test KIRMIZI (bekçi katmanı gerilemesi)
- **Gerçek:** `Test Files 14 passed (14)` · `Tests 185 passed (185)` — tam yeşil
- **Etki:** yetim zamanlayıcı, süreç başlangıcından 120 ms sonra uçuştaki isteği öldürüp ağ
  bekçilerini (100 ms idle / 150 ms toplam) atlar; ölçülen kanıt §6. Yavaş stdin'de **sessiz olay
  kaybı** (exit 0, boş stderr) — panelin tüm amacı olan görünürlüğü baltalar, `CLAUDE.md`'deki
  "sessizce ölen hook" hata sınıfının aynısı.
- **İstenen düzeltme:** damla senaryosuna **alt sınır** bir assert ekle (scriptin gerçekten toplam
  bekçiye kadar yaşadığını ölçen, ör. TCP bağlantısından çıkışa `>= 145 ms`) **veya** stdin bekçisinin
  `'end'` sonrası temizlendiğini doğrudan ölçen ayrı bir test. Assert, `clearTimeout` silindiğinde
  KIRMIZI vermeli — düzeltmeyi geri alıp doğrulayın.
- **Ekran görüntüsü:** yok (CLI bulgusu; ölçüm çıktıları §6'da tablolu).

### ÖNEMLİ

**Ö1 — idle soket bekçisi tamamen kaldırılabiliyor, hiçbir test görmüyor (sözleşmenin kanıt iddiası yanlış)**
- **Dosya:** `.claude/hooks/send-event.cjs:172-175` · `tests/integration/send-event-hook.test.ts:186-200` ("sessiz sunucu (a)")
- **Tekrar üretme:** `req.setTimeout(IDLE_TIMEOUT_MS, …)` bloğunu sil → `npx vitest run`
- **Beklenen:** "sessiz sunucu (a)" KIRMIZI (sözleşme §3 madde 3 bu testin "yalnızca idle katmanının
  varlığını kanıtladığını" açıkça iddia ediyor)
- **Gerçek:** `Tests 185 passed (185)` — çünkü sessiz sunucuyu 150 ms'lik **toplam** bekçi de
  yakalıyor; sessiz senaryo iki katmanı ayırt etmiyor.
- **Etki:** İki katmanın bağımsızlık kanıtı **tek yönlü**: toplam bekçinin varlığı damla testiyle
  kanıtlanmış (developer'ın mutasyon 3'ü), ama idle katmanı için hiçbir ayırt edici kanıt yok.
  Davranışsal gerileme yok (toplam bekçi 150 ms sert sınırı koruyor), ama ölçülmeyen bir katman
  ya çitlenmeli ya da Karpathy §2 uyarınca gerekçesi yazılmalı.
- **İstenen düzeltme:** idle katmanını ayırt eden bir senaryo ekle (ör. bağlantı kurulup hiç bayt
  yazılmayan sunucuda çıkışın ~100 ms'de, 150 ms'den **önce** olduğunu ölçen alt/üst sınır çifti);
  ya da katmanın gereksiz olduğuna karar verilip kaldırılması sözleşmeye işlensin.

**Ö2 — AC5'in "`KURULUM.md`'ye yazılır" yarısı karşılanmadı**
- **Dosya:** `KURULUM.md:81-99` · AC metni `docs/features/F-004-send-event-hook.md:18`
- **Beklenen:** AC5 iki şey istiyor: (1) gerçek oturumda elle doğrulama, (2) sonucun
  `KURULUM.md`'ye yazılması. `KURULUM.md:93-94` kullanıcıya "Sonucu bu bölüme bir satırla ekleyin
  (tarih + gözlemlenen olay tipi …)" diyor.
- **Gerçek:** Doğrulama yapıldı (kanıtı denetledim, sağlam — §3) ama sonuç **feature notuna**
  yazıldı; `KURULUM.md`'de gözlem satırı yok. `:96-99` yalnızca kurulumun yapıldığını söylüyor ve
  5 adımı hâlâ kullanıcıya **yapılacak iş** olarak sunuyor.
- **Etki:** AC kutusu işaretli ama AC metninin yarısı açık; `KURULUM.md`'yi tek başına okuyan biri
  hattın gerçekten doğrulandığını göremiyor.
- **İstenen düzeltme:** §3'teki kanıtın 2-3 satırlık özetini (tarih · `PreToolUse`/`Bash` ·
  `session_id` · `transcript_path` dolu · `.seq` kayması yok) `KURULUM.md` "Doğrulama" bölümüne ekle.

### NOT

**N1 — `KURULUM.md` kullanıcı belgesi geliştirici notuyla açılıyor**
- `KURULUM.md:3-10`: dosyanın önceki içeriğinin `C:\dev\app-factory` kalıntısı olduğunu anlatan
  8 satırlık blok, kullanıcının gördüğü **ilk** içerik. Gerekçe meşru ve kararı doğru (eski içerik
  hiçbir dokümandan referans almıyordu, doğruladım), ama yeri burası değil — `docs/progress.md`
  zaten aynı gerekçeyi taşıyor. Belgenin gerisi (adımlar, env tablosu, geri alma, doğrulama)
  net ve kullanıcı için yeterli.

**N2 — BUG-001 F-004'ün kusuru değil (kapsam kararım aşağıda)**

---

## 8. BUG-001 kapsam kararı

**Karar: BUG-001, F-004'ün GEÇTİ/KALDI kararını etkilememeli. CEO'nun görüşüne katılıyorum.**

Bağımsız doğrulamam:
- `data/events/2026-09-04.jsonl` 13 olayın **9'unda** `summary` > 200 karakter (234 · 234 · 487 ·
  487 · 732 · 732 · 567 · 567 · 263). CEO'nun bildirdiği 234-732 aralığı teyit edildi.
- Kaynak **F-002 kodu**: `src/features/events/server/normalize.ts:42-68` `deriveSummary`, dönüş
  yollarının hiçbirinde kırpma yok (`stringField(toolInput,'command') ?? ''` ham dizgeyi döndürüyor).
  Okudum, grep'e güvenmedim.
- **F-004 kendi yolunda kurala uyuyor:** `send-event.cjs:42-44` `truncate200` ve
  `buildCompactEnvelope` (`:95-128`) her alanı 200 karaktere kırpıyor. Yani hook, sınırı aşan
  `summary`'nin **kaynağı değil**; sunucu normalizasyonu kırpmıyor.
- F-004'ün 6 AC'sinin hiçbiri `summary` uzunluğundan söz etmiyor; sözleşme §3 madde 6 `summary`'yi
  bilinçli olarak **sunucunun işi** sayıyor.

Gerekçe: bir feature, başka bir feature'ın kodundaki sözleşme ihlalinden sorumlu tutulamaz;
aksi hâlde "tek seferde tek feature" kuralı anlamını yitirir. **Ama kaydediyorum:** BUG-001'i
görünür kılan şey tam olarak F-004'ün AC5'idir (gerçek olay üreten ilk hat) — bu, elle
doğrulama adımının değerinin somut kanıtı. **F-003'ten (SSE zaman çizelgesi) önce kapatılmalı;**
732 karakterlik bir özet, UX dokümanının 200 karakter varsayımıyla tasarlanmış satır düzenini bozar.
Bu turda **düzeltmedim** (kapsamım dışı, kod düzenlemiyorum).

---

## 9. Kapsam denetimi

`git diff 83a0f51..HEAD --stat` (sözleşme onayından bugüne), 15 dosya:

```
.claude/hooks/send-event.cjs   | 257 ++    scripts/install-hook.mjs                  | 176 ++
.claude/settings.json          | 285 ++    tests/helpers/emit-hook.ts                |  65 ++
.gitignore                     |   2 ++    tests/integration/send-event-hook.test.ts | 471 ++
KURULUM.md                     |1283 +-    tests/scripts/install-hook.test.ts        | 236 ++
docs/HANDOFF.md                |  80 ++    tests/no-external-host.test.ts            |  12 ++
docs/blockers.md               |  32 ++    package.json                              |   3 +-
docs/features/F-004-…          |  36 +-    docs/progress.md                          | 126 ++
docs/qa/BUG-001-…              |  57 ++
```

- **`src/` altında sıfır değişiklik.** SSE (F-003), proje kayıt (F-005), yazma kapısı (F-006),
  kanban, UI kodu — hiçbirine sızma yok. ✓
- `package.json` değişikliği yalnızca `"install-hook": "node scripts/install-hook.mjs"` script satırı. ✓
- `KURULUM.md`'nin 1242 satırlık silmesi kapsam sızması **değil**: dosya sözleşme §1'de F-004'ün
  sahipliğinde; içerik App Factory şablon kalıntısıydı ve `docs/PROCESS.md` + `CLAUDE.md` olarak
  zaten depoda materyalize edilmiş durumda (kontrol ettim, kayıp yok).
- `.claude/settings.json`'ın 285 satırlık büyümesi = AC5 kurulumunun beklenen sonucu (13 kayıt),
  sözleşme §3 madde 7'nin önceden onayladığı istisna. ✓

## 10. Güvenlik taraması

| Kontrol | Sonuç |
|---|---|
| Sabit kodlanmış sır (`api_key`, `secret`, `token`, `password`, `bearer`, `sk-`) | ✓ YOK (`send-event.cjs`, `install-hook.mjs`, `KURULUM.md`) |
| `127.0.0.1` dışı ağ literali | ✓ YOK — tek literal `send-event.cjs:148 host: '127.0.0.1'`; `no-external-host` çiti artık bu dosyayı da tarıyor |
| `send-event.cjs` stdout/stderr sessizliği | ✓ Hiç `console.*` / `process.stdout` / `process.stderr` yok — mimari §8.1 kuralı sağlanıyor, testlerde de assert ediliyor |
| `.bak` / geçici dosya depoya sızması | ✓ `.gitignore:19-20` çitliyor; `git status --porcelain` boş |
| `npm audit` | ✓ `found 0 vulnerabilities` |
| Yıkıcı davranış (`install-hook`) | ✓ Yalnızca ekleyici; silme/üzerine yazma yok (§5'te ampirik doğrulandı) |

## 11. Çalışma ağacı ve süreç temizliği

- `git status --porcelain` → **boş**; `git diff HEAD` → **boş**. Altı mutasyonun tamamı
  `git checkout --` ile geri alındı, her birinden sonra teyit edildi.
- Commit atılmadı, `git push` çalıştırılmadı, `install-hook` bu depoya veya depo dışına
  çalıştırılmadı (yalnızca scratchpad sandbox'larına).
- **Portlar:** `netstat -ano | grep -E ":(7333|7334|7433|7434)\s"` → **dördü de boş**.
- **Süreçler:** kalan iki `node.exe` (PID 19160, 33324) Playwright **MCP** araç sunucusudur
  (oturum başında 00:39'da başladı, komut satırlarıyla doğrulandı) — uygulamadan kalan yetim
  `npm run dev` / `tsx` / `vite` süreci **yok**.

---

## 12. Puanlar

| Boyut | Puan | Gerekçe |
|---|---|---|
| **İşlevsellik** | **8** / 10 | Uçtan uca hat gerçekten çalışıyor (canlı olaylar, `transcript_path` dolu, `.seq` kaymasız). Bloklamama bekçileri ölçülen sürelerde bütçenin içinde. Fonksiyonel bir kusur bulamadım. |
| **Özellik bütünlüğü** | **8** / 10 | 6 AC'nin 5'i tam; AC5'in "`KURULUM.md`'ye yazılır" yarısı açık (Ö2). CEO kararları A/B/C/D'nin dördü de uygulanmış. |
| **Görsel / UX** (`KURULUM.md`) | **8** / 10 | Kullanıcı için gerçekten anlaşılır: tek komut, numaralı adımlar, env tablosu, geri alma yolu, doğrulama listesi, "yalnızca kendi projelerinize kurun" uyarısı. Eksi: geliştirici notuyla açılması (N1) ve doğrulama sonucunun yazılmamış olması (Ö2). |
| **Kod kalitesi** (testler, hata yönetimi) | **6** / 10 | Hata yönetimi örnek düzeyde (her yol `exit(0)`, `uncaughtException`/`unhandledRejection` ağı, sessiz stdout/stderr, `install-hook`'ta doğrula-sonra-yaz sırası, atomik yazma, yalnızca-ekleyici birleştirme). Ama **altı mutasyonumun ikisi kaçtı ve ikisi de featureın çekirdek güvenlik özelliğinde**: developer'ın kendi bulduğu üretim hatasının düzeltmesi korumasız (B1) ve idle katmanı ölçülmüyor (Ö1). Zamanlama assert'leri yalnızca üst sınır ölçüyor; sözleşmenin "her bekçi ayrı mutasyonla kanıtlanır" ödevi kâğıtta kalmış. |

**Karar gerekçesi (tek paragraf):** F-004'ün kodu iyi yazılmış, savunmacı ve gerçek dünyada
çalıştığı kanıtlı — canlı oturumda olaylar panele düşüyor, `install-hook` bu deponun altı güvenlik
hook'unu bozmadan 13 kayıt ekledi, kurulum scripti bozuk JSON'da hiçbir dosyaya dokunmuyor ve
`npm run verify`/`e2e`/`e2e:dev`/`audit` dördü de temiz. Buna rağmen KALDI veriyorum, çünkü bu
featureın **var oluş nedeni olan tek güvenlik özelliği** — "hook hiçbir koşulda oturumu bloklamaz
ve olayı sessizce kaybetmez" — testlerle çitlenmemiş: developer'ın uygulama sırasında elle
keşfettiği gerçek yetim-zamanlayıcı hatasını geri koyduğumda 185 testin tamamı yeşil kaldı, üstelik
o hatanın sessiz olay kaybına yol açtığını ve ağ bekçilerini fiilen atladığını ölçerek gösterdim;
ikinci bir kaçak (idle bekçisinin tamamen silinebilmesi) sözleşmenin "iki katman bağımsız olarak
kanıtlanır" iddiasının yalnızca yarısının doğru olduğunu ortaya koydu. Kod kalitesi boyutu 6 (<7)
olduğu için karar kuralı gereği de KALDI. Düzeltme dar ve ucuz: iki assert eklemek (damla
senaryosuna alt sınır, idle katmanına ayırt edici ölçüm) ve AC5 kanıtının üç satırını
`KURULUM.md`'ye yazmak; ürün kodunda değişiklik gerekmiyor. BUG-001 bu kararın dışındadır ama
F-003'ten önce kapatılmalıdır.

---

**Sonraki adım:** feature notu `status: fix`. Düzeltme turu B1 + Ö1 + Ö2'ye baksın; onaylanmış
bölümler (AC1-AC4, AC6, CEO kararları A/B/C/D, `install-hook` güvenliği, kapsam, güvenlik taraması)
yeniden açılmasın.
