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
