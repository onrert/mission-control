# ADR-016: Onay dosyalarının (`docs/approvals/`) korunması

- **Tarih:** 2026-09-10
- **Durum:** kabul

- **Bağlam:**
  `docs/qa/G5-guvenlik-denetimi-2026-09-10-tur3.md` §0 (KRİTİK): `gate-check.cjs`'in `free`
  listesi `docs/` yolunun TAMAMINI serbest bırakıyordu. `docs/approvals/` — GUARD.ok, DANGER.ok,
  PUSH.ok, her `G*.ok`, `.guard-state.json` — bu yüzden HİÇBİR hook tarafından korunmuyordu.
  Barındırılan bir oturum kendi güvenlik kapısını kendi anahtarıyla açabiliyordu: sıfırdan bir
  onay dosyası yazabiliyor (§0.2), var olan gerçek bir onayın kapsamını tüketilmeden önce
  genişletebiliyor (§0.3), ya da `.guard-state.json`'ı elle düzenleyip "kapsam tamamlandı"
  yalanını söyleyebiliyordu. **Kapı, kendi anahtarını üretebilene karşı kapı değildi.**

- **Karar:**
  `docs/approvals/` altındaki her dosya artık iki bağımsız katmanla korunuyor (detay: `docs/qa/
  g5-onay-dosyasi-korumasi-contract.md`):

  1. **`gate-check.cjs` (Katman A).** `docs/approvals/` altındaki her yazma (`.guard-state.json`
     hariç) `permissionDecision:'ask'` ile harness'e devredilir — hook artık sessizce
     izin vermez, kararı kullanıcının izin kartına bırakır. `.guard-state.json` (GUARD.ok'un iç
     tüketim izleyicisi) kullanıcı onayı gerektiren bir şey DEĞİLDİR; koşulsuz sert engellenir
     (hiçbir araç onu elle değiştiremez).
  2. **`block-dangerous.cjs` (Katman B).** Kabuktan `docs/approvals/` altına yönelik yazma/silme
     (yönlendirme, `cp`/`mv`/`tee`/`sed -i`, Windows/PowerShell eşdeğerleri, satır içi betikler —
     `node -e`, `npx tsx -e`, `python -c`) sert engellenir. Bu bir KARA LİSTEdir, derinlik
     katmanıdır.
  3. **`.claude/settings.json` `permissions.ask` (Katman D).** `Edit(docs/approvals/**)` /
     `Write(docs/approvals/**)` harness'in kendi izin sistemine ikinci, bağımsız bir "sor"
     kuralı ekler; mevcut geniş `Write(docs/**)`/`Edit(docs/**)` `allow` kuralını daha spesifik
     bir desenle önceliklendirerek geçersiz kılar.

  **Mimari sınır — bilerek belgeleniyor ki bir sonraki tur bunu varsaymasın:**

  - **Onay dosyaları yalnızca kullanıcının kendi izin kartı üzerinden yazılır.** Hook'lar bunu
    ZORUNLU KILAR (harness'e "sor" sinyali gönderir), ama harness'in "sor" kararını gerçekten
    bir insana sorup sormadığını (yoksa headless bir alt-agent'ı otomatik mi reddettiğini) bu
    turun içinden canlı olarak doğrulamak mümkün değildi (bu turun kendisi headless bir
    geliştirici turu). `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` (satır 2564)
    bunu belgeliyor: *"ask asks the user to confirm (a headless session refuses instead)"* —
    ama bu ÇIKARIM'dır, canlı bir interaktif oturumla ÖLÇÜLMEMİŞTİR.
  - **Yerel kabuk erişimi olan bir barındırılan oturuma karşı mutlak koruma yoktur.** Katman
    B bir kara listedir; komut metninde `docs/approvals` dizesi hiç geçmeyen, harici bir
    betiğin İÇİNDE gömülü bir yazma (ör. `node scripts/x.mjs` — hedef yol betiğin içinde)
    metin eşleştirmesiyle görülemez. Kapatmak çalışma-zamanı gözlemi (dosya sistemi çağrı
    sentinel'i, F-011'in ağ sentinel'i emsali) gerektirir.
  - **Panelin kendi HTTP onay ucu (`POST /api/gates/:project_id/:gate/approve`) bilerek KAPSAM
    DIŞI bırakıldı.** Kod okunarak doğrulandı (`src/features/gates/**`, `src/server/index.ts`,
    `src/server/write-gate.ts`): bu uç `GUARD.ok`/`DANGER.ok`/`PUSH.ok` üretemez (`isValidGateId`
    yalnızca `G0-6`/`ASSETS` kabul eder) ama gerçek bir `G*.ok`'u (G5 dahil) `confirmed:true` +
    doğru `expectedBody` ile üretebilir; `Host`/`Origin` kontrolü ve sabit `x-mc-write` başlığı
    gerçek bir tarayıcı tıklamasını `node -e "fetch(...)"` çağrısından ayırt etmez. **Bu yeni
    bir açık değil** — ADR-005 ekinin (F-012, satır 52) BİLEREK kabul ettiği *"`.ok` dosyası
    panelden yazıldığında kullanıcının onayı sayılır"* kararının doğal, öngörülmemiş bir
    sonucu. Kapatmak `src/features/gates/**`'e (CSRF token, gerçek-tarayıcı-kanıtı gibi mimari
    bir değişiklik) dokunmayı gerektirir — bu turun dosya sahipliği bunu yasaklıyor.

- **Alternatifler ve neden reddedildi:**
  - **`docs/approvals/**`'ı harness `deny` listesine eklemek:** CEO'nun kendi meşru görevini
    (kullanıcı onayladıktan SONRA `G*.ok` yazmak, `CLAUDE.md`: "Onay dosyasını yalnızca kullanıcı
    onayladıktan sonra CEO yazar") imkânsız hâle getirirdi. **Red.**
  - **Onay dosyalarını tamamen ayrı bir kanaldan (kullanıcının kendi çalıştırdığı bir CLI
    komutu, harici bir onay sunucusu) üretmek:** Kalıcı çözüm olabilir ama mevcut "agent kendi
    onayını `AskUserQuestion` sonrası kendi yazar" desenini TEMELDEN değiştirir — küçük bir yama
    değil, ayrı bir mimari karar/tur gerektirir. Bu turun kapsamı dışında.
  - **Çalışma-zamanı dosya sistemi sentinel'i (F-011 ağ sentinel'i emsali) kurmak:** §(b) madde
    4'ü de kapatırdı ama `src/`'e (ya da yeni bir izleme altyapısına) dokunmayı gerektirir —
    brief'in açık kısıtı. Bir sonraki tur için not edildi.
  - **Panelin HTTP onay ucuna CSRF token eklemek:** §(b) madde 5'i kapatırdı ama
    `src/features/gates/**`'e dokunmayı gerektirir — brief'in açık kısıtı. Bir sonraki tur için
    not edildi (bkz. `docs/blockers.md`).

- **Sonuçlar / riskler:**
  - Kalan risk 1: `docs/approvals` metnini hiç içermeyen, harici bir betik içine gömülü bir
    yazma (§(b) madde 4) — kabul edilmiş sınır.
  - Kalan risk 2: panelin kendi HTTP onay ucu (§(b) madde 5) — kabul edilmiş, ÖNCEDEN
    var olan bir mimari kararın sonucu, kapsam dışı, `docs/blockers.md`'de eşikle takip
    ediliyor.
  - Kalan risk 3 (küçük, kasıtlı): Katman B'nin satır-içi betik kuralı (`node -e`/`--eval`/
    `npx tsx -e`/`python -c` + `docs/approvals` aynı komutta) kasıtlı olarak geniştir —
    docs/approvals'ı yalnızca OKUYAN meşru bir satır-içi betik de (nadir) yanlış pozitif alır.
    Kabul edilen maliyet.
  - `permissions.ask`'ın `allow`'u gerçekten geçersiz kıldığı SDK tip tanımından ÇIKARILDI,
    canlı bir interaktif oturumla DOĞRULANMADI (headless bu turun kendisi). Asıl/birincil
    savunma bu yüzden Katman A/B'nin hook kararlarıdır — bunlar `execFileSync` ile doğrudan
    ölçülebilir; Katman D ikinci, doğrulanmamış bir katmandır.

- **Kullanıcı onayı gerekli mi:** Hayır — bu ADR mevcut onaylı güvenlik sınırını
  DARALTMIYOR/GENİŞLETMİYOR, yalnızca G5 tur-3'ün KRİTİK bulgusunu (kullanıcının zaten
  "Üç katmanı da yap" diyerek onayladığı `GUARD.ok`, bkz. `docs/approvals/GUARD.ok` geçmişi)
  nasıl kapattığını belgeliyor.

---

## Güncelleme — 2026-09-15: ölçülmüş sınır, yedi turun sonucu

Bu ADR *"asıl savunma kullanıcının izin kartıdır; hook bir derinlik katmanıdır"* diyordu. Yedi
turluk sertleştirmenin ardından bu öncülün **ölçülmüş** hâli aşağıdadır. Kullanıcı kararı
(2026-09-15): **hat burada durur, sınır dürüstçe yazılır, G6'ya geçilir.**

### 1. Öncül kısmen yanlıştı: kart her zaman çıkmıyor
qa-evaluator canlı gösterdi (`docs/qa/hook-writepos-karari-2026-09-15.md`):
`.claude/settings.json`'daki `Write(src/**)` + `Bash(node *)` izinleri birlikte **sıfır izin
kartıyla** tam yetki veriyor. Tek bir `node src/tools/fmt.mjs` çağrısı:
- `docs/approvals/G5.ok`'u sildi,
- `.claude/hooks/gate-check.cjs`'i `process.exit(0);` yaptı (kapı sessizce ölür),
- **sahte bir `docs/approvals/GUARD.ok` yazdı.**

Yani hook hattı, kabuk erişimi olan bir agent'a karşı **atlanabilir**. Bu, bu ADR'nin dayandığı
"kart çıkar, kullanıcı görür" öncülünün karşılanmadığı bir yol olduğunu gösterir.

### 2. Kısmen kapatıldı (commit `810ed06`)
`Bash(npm run *)` joker izni kaldırılıp `package.json`'daki gerçek script adlarından bir allowlist
kondu; `package.json` ve `.claude/**` `ask` listesine alındı; `node -e`/`-p`/`--eval`/`--print`
deny'a eklendi. Bu, QA'nın gösterdiği `npm run evil` yolunu kapattı.

**Kapatılmayan:** `Bash(node *)` ve `Write(src|tests/**)`. Gerekçe ölçülmüş bir takastır — arka
planda koşan alt agent turları sonda/teşhis betiklerini `node <betik>.mjs` ile çalıştırıyor ve
izin kartı **veremiyorlar**; bu izni kaldırmak üretim hattını kilitler. Ayrıca `node --eval=<kod>`
biçimi mevcut deny desenlerini atlıyor (desenler yalnızca boşluklu biçimi kapsıyor).

### 3. Bu ADR'nin güncellenmiş konumu
- **Hook hattı bir KAZA ÖNLEYİCİDİR, bir SALDIRI ÖNLEYİCİ DEĞİLDİR.** Yanlışlıkla yazılmış bir
  komutu, bir alt agent'ın dikkatsizliğini, kopyala-yapıştır bir zinciri yakalar. Kasıtlı ve
  bilgili bir aktöre karşı — ki yerel, kabuk erişimli bir agent tanımı gereği öyledir — **mutlak
  koruma yoktur ve olamaz.**
- Ölçülen koruma değeri yine de gerçektir: v6, v0'dan bu yana 16 + 11 + 8 + 6 vektörlük sızıntı
  ailesini kapattı, 420 vakalık sürüm kontrollü bir çite sahip ve gerçekçi iş akışı korpusunda
  **%0 aşırı engelleme** üretiyor.
- **Açık kalan borç** (`docs/blockers.md`'de kayıtlı): QA'nın 24 canlı vektörü (Q1 blob-ilk-token
  körlüğü · Q2 `awk`/`sed` yazma biçimleri · Q3 `>&dosya` ve satır-devamı yönlendirmesi ·
  Q4 `git --output=`), artı yukarıdaki izin açığı ve `--eval=` deny boşluğu.
- **Yeniden açma ölçütü:** (a) bu depoda gerçek bir sızıntı yaşanırsa, (b) hat çok kullanıcılı ya
  da uzak bir ortama taşınırsa (o zaman öncül tamamen değişir), ya da (c) onay artefaktları
  agent'ın yazabildiği alandan çıkarılırsa — bu sonuncusu, yedi turun çözemediği şeyi tek turda
  çözen yapısal seçenektir ve değerlendirildi, ertelendi.
