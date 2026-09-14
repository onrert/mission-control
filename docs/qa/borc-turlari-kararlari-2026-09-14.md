KARAR: KALDI
ESKALE: false

# Altı borç sözleşmesi — QA kararları (2026-09-14)

Bileşik karar **KALDI**: altı sözleşmeden beşi GEÇTİ, biri (`hook-borclari-contract.md`)
bloklayıcı bir bulguyla KALDI. Kural gereği biri bile KALDI ise bileşik karar KALDI.

| # | Sözleşme | Karar |
|---|---|---|
| 1 | `docs/qa/hook-borclari-contract.md` | **KALDI** (bloklayıcı) |
| 2 | `docs/qa/grup2-kapilar-borclari-contract.md` | GEÇTİ |
| 3 | `docs/qa/test-izolasyon-contract.md` | GEÇTİ |
| 4 | `docs/qa/grup3-transkript-thread-contract.md` | GEÇTİ (eşikli borçla) |
| 5 | `docs/qa/o7-agent-satirlari-contract.md` | GEÇTİ |
| 6 | `docs/qa/b4-test-kararsizligi-contract.md` | GEÇTİ (negatif sonuç kabul edildi) |

## 0. Tur hijyeni ve taban ölçümler

**Onay dosyaları — dokunulmadı.** Sekiz dosyanın SHA-256'sı tur başında ve sonunda birebir aynı:

| Dosya | SHA-256 (başta = sonda) |
|---|---|
| `docs/approvals/G0.ok` | `3b21fd8e7c4b2d1f3797275eb18dfe476a7f2c83435b905df3d6f31824148565` |
| `docs/approvals/G1.ok` | `72bcf9757aec9ca5ba76f1a02bddad85f3051d1110d7e7a62189c1dc8d5b5234` |
| `docs/approvals/G2.ok` | `a87cd696dd44424084594e2a32e83f0f32b4fc797cbb0148ef8b3cbdefba1bf5` |
| `docs/approvals/G3.ok` | `36b18d582ac02afd3d0709d908ef256079b6ff147f09c08afccda5757bf9eef2` |
| `docs/approvals/G4-1.ok` | `08d0fe3aaa80ed11a1eece6956a4c48272903ebadcb74974aa09c8fffba0d82b` |
| `docs/approvals/G4-2.ok` | `6bf5be0828d071a215dfff9aa9b01c210f26709b10799f5f0b93250c9c862ace` |
| `docs/approvals/G5.ok` | `ee81a95012579b60583e592c8f56f430fd9e3520d3bd7bab90dbe8d9668b02f1` |
| `docs/approvals/README.md` | `cf662987bc1570cea8e5c02faa8a7e1d6c3367022b9269144e760aa3b2c94bdb` |

Bekleyen tek kullanımlık token (`GUARD.ok`/`PUSH.ok`/`DANGER.ok`) **yok** — bu yüzden
`_selftest.cjs` reddetmeden koştu (exit 3 olmadı).

**Taban ölçümler (bu turda bizzat koşuldu):**

| Ölçüm | Sonuç |
|---|---|
| `node .claude/hooks/_selftest.cjs` | **206 OK / 0 FAIL**, exit 0 |
| `npm run test` (koşu 1-4) | **1851 geçti / 4 atlandı (86 dosya, 1855 test)** — yeşil |
| `npm run test` (koşu 5) | KIRMIZI — `Worker forks emitted error`, assert **sıfır**, çit "1 dosya sessizce eksik" diyerek doğru kırmızı verdi |
| `npm run e2e` (izole) | **55/55** (43.6 sn) |
| `npm run e2e:chat` (izole) | **5/5** |
| `npx tsc --noEmit` | 0 |
| `npx eslint .` | 0 |
| `git status --short` (tur sonu) | temiz |

Toplam **5** tam suite koşusu yaptım; 1 kırmızı (%20), tamamı Sınıf A. Bu, B-4'ün ölçtüğü
%25 tabanıyla tutarlı (bkz. §6).

**Süreç hijyeni:** `chrome.exe` **0**. `node.exe` 14 adet — hepsi oturum altyapısı; test
portlarında (7333/7433/7434/7435) **hiç `LISTENING` yok**, yalnızca `TIME_WAIT`. Yetim
sunucu/tarayıcı bırakılmadı. Sandbox artıkları (`qa-blob-mutant`, `live-demo`) silindi.

**Mutasyon disiplini:** Gerçek `.claude/` dosyalarına hiç yazılmadı; hook mutasyonları MD5'i
doğrulanmış sandbox kopyalarda yapıldı. `src/`/`tests/` mutasyonları gerçek dosyada yapıldı ve
**elle** geri alındı (`git checkout`/`git restore` **kullanılmadı**); her geri almadan sonra
kaynak-doğrusuyla `diff` **birebir aynı** ve `git diff` **boş** doğrulandı.

**Sandbox doğruluğu:** `scratchpad/verify-json-repo/.claude/hooks/` kopyaları kurulu gerçek
hook'larla **MD5 olarak birebir aynı** — yani sandbox'ta ölçtüğüm şey sevk edilen koddur:

| Dosya | MD5 (kurulu = sandbox) |
|---|---|
| `block-dangerous.cjs` | `afb186a31086f791868582d3e4c95f33` |
| `gate-check.cjs` | `d5d94edac81f24ac333f4ba8b112c03d` |
| `_common.cjs` | `41c4be2337f72053b71fd91703ecebaf` |

---

## 1. `docs/qa/hook-borclari-contract.md` — **KARAR: KALDI**

**Puanlar:** İşlevsellik **4** · Özellik bütünlüğü **4** · Görsel/UX yok say · Kod kalitesi **6**
→ iki puan 7'nin altında, KALDI.

### 1.1 Karşılanan kabul kriterleri

| Kriter | Kanıt |
|---|---|
| §6.1 `_selftest.cjs` (206 vaka) | **206 OK / 0 FAIL**, exit 0 — kurulu dosyada doğrulandı |
| §8-ek `probe-segment.mjs` 24/24 | **24/24 GECTI** (sahte depo kökünden koşuldu) |
| §8-ek `probe-json-guard.mjs` 14/14 | **14/14 GECTI, 0 KALDI** |
| §8-ek `probe-m1-m2.mjs` 9/9 | **9/9 GECTI, 0 KALDI** |
| B-2 (P6 çiti + beş "fazlalık" yorumu) | `gate-check.cjs`'te `B-2 KAPANIŞI` etiketleri ve `D-NO-SCOPE-FIELD-REAL` vakası kurulu dosyada mevcut |
| B-3 ("tek kullanımlık" ifadesi) | `gate-check.cjs:11-15` ve `docs/approvals/README.md:10-12` düzeltilmiş; `README.md:1`'deki `DANGER.ok (tek kullanımlık)` **doğru** bırakılmış — ayrım korunmuş |
| B-5 (obje derinlik dalı) | `D-SCANNER-DEPTH-OBJECT-*` vakaları selftest'te mevcut |
| §6.8 onay dosyası SHA-256 değişmemiş | §0 tablosu |

### 1.2 B1 — **BLOKLAYICI**: segmentasyon engelleme gücünü azalttı (12/12 → 0/12)

**Tekrar üretme.** Sahte depo kökünde (`scratchpad/verify-json-repo/`), kurulu
`block-dangerous.cjs` ile 12 komut çalıştırıldı. Hepsi **gerçek** saldırı: yazma/silme fiili
gerçekten korumalı hedefe iniyor, fiil ile hedef farklı kabuk segmentlerinde.

**Beklenen** (sözleşme §2.3/§2.4): "Belirsizlik daima bu kısıtlayıcı davranışa çözülür, hiçbir
zaman daha az kısıtlayıcıya değil" → 12/12 ENGEL.
**Gerçek:** **0/12 ENGEL** (hepsi exit 0, sessizce geçti).

Kontrol deneyi (aynı sonda kümesi, `splitCommandSegments` her zaman `null` dönecek şekilde
mutasyona uğratılmış = segmentasyon **öncesi** blob davranışı): **12/12 ENGEL**.

| # | Komut | Blob (öncesi) | Segmentli (sevk edilen) |
|---|---|---|---|
| R1 | `cd docs/approvals && rm G5.ok` | ENGEL | **GEÇER** |
| R2 | `cd docs/approvals && cp /tmp/evil G5.ok` | ENGEL | **GEÇER** |
| R3 | `cd docs/approvals && mv /tmp/evil G5.ok` | ENGEL | **GEÇER** |
| R4 | `cd docs/approvals ; echo x \| tee G5.ok` | ENGEL | **GEÇER** |
| R5 | `cd docs/approvals && sed -i s/a/b/ G5.ok` | ENGEL | **GEÇER** |
| R6 | `cd .claude/hooks && rm gate-check.cjs` | ENGEL | **GEÇER** |
| R7 | `cd .claude/hooks && cp /tmp/evil gate-check.cjs` | ENGEL | **GEÇER** |
| R8 | `cd .claude/hooks && mv /tmp/evil gate-check.cjs` | ENGEL | **GEÇER** |
| R9 | `ls docs/approvals && node -e "…writeFileSync('G5.ok','x')"` | ENGEL | **GEÇER** |
| R10 | `cd .claude/hooks && node -e "…writeFileSync('gate-check.cjs','x')"` | ENGEL | **GEÇER** |
| R11 | `echo docs/approvals ; rm G5.ok` | ENGEL | **GEÇER** |
| R12 | `cat docs/approvals/G5.ok \| head -1 ; rm G5.ok` | ENGEL | **GEÇER** |

Mutasyon MD5'leri: kaynak `afb186a31086f791868582d3e4c95f33` → mutant
`2498d5d59afc3c9bb74ea293f70b6a9b`. Mutasyon ayrı bir sandbox dizininde yapıldı; gerçek
`.claude/` dosyasına dokunulmadı.

**Canlı uçtan uca doğrulama (kopya değil, KURULU hook).** Scratchpad'de izole bir
`docs/approvals/G5.ok` oluşturuldu (içerik `ORIJINAL`), sonra tek bir gerçek Bash çağrısı:

```
cd <scratchpad>/docs/approvals && echo SAHTE-ONAY | tee G5.ok
```

Sonuç: komut **engellenmedi**, dosya içeriği `ORIJINAL` → `SAHTE-ONAY` oldu. Yani bu bir
kâğıt üstü açık değil; kurulu Katman B bir onay dosyasının üzerine kabuktan yazılmasına izin
veriyor. (Karşılaştırma: aynı turda `rm -rf` ve tek segmentli `echo x > docs/approvals/G5.ok`
doğru şekilde engellendi — kapı çalışıyor, ama yanlış şeyi ölçüyor.)

**Kök neden.** `block-dangerous.cjs:222-228` iki-sinyalli kontrolü artık her iki sinyali de
**aynı segmentten** talep ediyor. Bu, sözleşmenin hedeflediği çapraz-segment *yanlış
pozitifini* gerçekten kapatıyor — ama aynı anda çapraz-segment *gerçek pozitifini* de kapatıyor,
ve `cd <korumalı dizin> && <fiil> <göreli ad>` egzotik bir dolaylama değil, en sıradan kabuk
deyimidir.

**Neden bloklayıcı (severity yükseltme kuralı):**
- **(a) Kalıcı artefakt:** R1-R5, R9, R11, R12 doğrudan `docs/approvals/*.ok` onay dosyalarına
  yazıyor/siliyor. R6-R8, R10 `gate-check.cjs`'i siliyor/değiştiriyor — `settings.json` onu
  çağırmaya devam eder, `node` çıkış kodu **1** döner, Claude Code yalnızca **2**'yi engelleme
  sayar → kapı **sessizce ölür**. Bu, `CLAUDE.md`'de kayıtlı en pahalı hata sınıfı ve sözleşmenin
  §8-ek'te `rm` boşluğunu kapsam-içine almak için **kendi** kullandığı gerekçe.
- **(b) Ana vaadin çürütülmesi:** sözleşmenin merkezi güvenlik iddiası §2.3/§2.4'te
  "engellemeyi asla azaltmaz / daima daha kısıtlayıcıya düşer" olarak yazılı. Ölçüm bu iddiayı
  yanlışlıyor.
- Brief'in açık talimatı: *"bir gerçek pozitifi kaçırdıysa tur başarısızdır"* — 12 kaçırılmış
  gerçek pozitif.

**ADR-016 sınırı bu bulguyu kurtarmıyor.** Doğru: izin kartı komutun tamamını dürüstçe
gösteriyor, yani bu "pratik sızıntı" değil "teorik ihlal" sayılabilir. Ama Katman B'nin **var
olma sebebi** zaten karttan sonraki derinlik katmanı olmak; bu tur onu kurmak/genişletmek için
yapıldı (Y4) ve ölçüm, katmanın **geriye** gittiğini gösteriyor. Sınır, bir katmanın kendi
kapsamında zayıflamasını mazur göstermez.

**Not (kapsam ayrımı, dürüstlük için):** Q1/Q2/Q5/Q6/Q7 gibi bazı vektörler **her iki modda da**
geçiyor — yani segmentasyonun suçu değil, **önceden var olan** bir boşluk: çıplak `>`
yönlendirmesi `writeVerb` listesinde yok, yalnızca `approvalsRedirect`/`hooksRedirect` (yani
`>` hemen ardından korumalı yol) yakalıyor. `cd docs/approvals && echo x > G5.ok` bu yüzden
önce de sonra da geçiyor. Bu ayrı bir borç; yukarıdaki 12 vaka **yalnızca** bu turda regresyona
uğrayanlardır.

### 1.3 B2 — ÖNEMLİ: sözleşmenin yanlış-pozitif iddiası yanlış (aşırı engelleme yönü)

Sözleşme §2.5: *"Okuma (`cat`/`ls`/`git add`/`git commit`/`git diff`) **hiçbir zaman**
engellenmez çünkü bu komutlar `writeVerb`/`inlineEval` listesinde yoktur."*

Bu cümle yanlış: engelleme komutun **fiiline** değil, segmentin **tüm metnine** bakıyor. Bir
okuma komutunun *argümanı* bir fiil kelimesi içerdiğinde komut engelleniyor. Bunu bu turda
**canlı yaşadım**: `grep -c "RM-[1-7]\|UNLINK-[1-3]\|GITRM-[1-2]" .claude/hooks/_selftest.cjs`
— tamamen salt-okunur bir komut — `unlink` ve `RM-` kelimeleri `\b(del|erase|rm|unlink)\b`
deseniyle eşleştiği için engellendi.

Ölçüm (10 salt-okunur komut, hepsi GEÇER bekleniyor): **5 GEÇER / 5 ENGEL**.

| Sonda | Komut | Sonuç |
|---|---|---|
| F2 | `grep -n "unlink" .claude/hooks/_selftest.cjs` | **ENGEL** (yanlış pozitif) |
| F3 | `grep -c "RM-1" .claude/hooks/_selftest.cjs` | **ENGEL** (yanlış pozitif) |
| F4 | `grep -n "Remove-Item" .claude/hooks/block-dangerous.cjs` | **ENGEL** (bu tur öncesi de vardı) |
| F5 | `grep -rn "rm" docs/approvals/README.md` | **ENGEL** (yanlış pozitif) |
| F9 | `awk '/rm/{n++} END{print n}' .claude/hooks/_selftest.cjs` | **ENGEL** (yanlış pozitif) |
| F1, F6, F7, F8, F10 | `cat` / `ls -la` / `git diff` / `wc -l` / bölünmüş dize | GEÇER (doğru) |

Bu, turun **birincil amacına** (yanlış pozitifleri azaltmak) ters düşüyor: RM KAPANIŞI yeni bir
yanlış-pozitif sınıfı açtı ve sözleşme bunu ölçmedi. Tek başına bloklayıcı değil, ama B1 ile
birlikte turun her iki ekseninde de başarısız olduğunu gösteriyor.

### 1.4 Geri çekilme (retreat) doğrulaması — ÇALIŞIYOR

Heredoc/`$( )`/sonlandırılmamış tırnak durumlarında blob'a düşüş **doğrulandı**; hatta bu turda
kendi sonda dosyamı `cat > … <<'EOF'` heredoc'uyla yazmaya çalıştığımda hook beni engelledi
(heredoc gövdesinde korumalı yol + `rm`/`tee` kelimeleri vardı) — retreat'in canlı kanıtı.
Sonda dosyası `Write` aracıyla yazıldı. Bu davranış **doğru ve kasıtlı** (aşırı engelleme).

### 1.5 Açık kalan eşikli borçlar (bu sözleşme)

1. Çıplak `>`/`>>` yönlendirmesi `writeVerb` ailesinde yok (§1.2 sonundaki not) — `cd` + göreli
   yazma her iki modda da geçiyor. **Eşik:** B1 düzeltilirken aynı ailede ele alınmalı, yoksa
   düzeltme yarım kalır.
2. `writeVerb` kelimelerinin okuma komutlarının **argümanlarında** yanlış pozitif üretmesi (§1.3).

---

## 2. `docs/qa/grup2-kapilar-borclari-contract.md` — **KARAR: GEÇTİ**

**Puanlar:** İşlevsellik **8** · Özellik bütünlüğü **8** · Görsel/UX **8** · Kod kalitesi **8**.

### 2.1 Kabul kriterleri ve kanıt

| Kriter | Kanıt (bu turda bizzat ölçüldü) |
|---|---|
| §3.1 S1 — küçük harfli kapı dosyasında kalıcı 500 kapandı | `src/server/write-gate.ts:39,40,45` — `approval`/`denial`/`archive` desenlerinde `i` bayrağı mevcut, güvenlik gerekçesi yorumda. `tests/integration/gates-api.test.ts`'te "S1 borç kapatma" bloğu var; tam suite (1851 test) yeşil |
| §3.2 S2 — tam küme normalizasyon çiti | `tests/features/gates/shared/gate-id.test.ts` — 457 normalizasyon + 1 öz-kontrol |
| §3.3 N6 — gerçek klavye ölçümü | `tests/e2e/kanban.spec.ts:629-641` — `page.keyboard.press('Tab')` döngüsü + `document.activeElement`, `.focus()` yok |
| §3.5 yeşil suite / tsc / eslint | §0 tablosu |

### 2.2 Kendi saldırım — S2 çiti kaynaktan mı türüyor?

**Soru (brief §4.3):** kapı kimliği kümesi elle kopyalanmış bir liste mi?
**Beklenen:** kaynaktan türetilmiş olmalı. **Gerçek:** türetilmiş — `enumerateValidGateIds()`
geniş bir aday uzayını (`G0-G9` × 9 sonek + `ASSETS`/`assets`) **`isValidGateId`'nin kendisiyle**
süzüyor, sabit dizi yok. Ayrıca bir **kabul-et-hepsini karşı kontrolü** var: `VALID_IDS`
`'assets'`, `'G7'`, `'G2-1000'` içermemeli — yani süzgecin gerçekten kaynağı kullandığı
kanıtlanıyor. Bu, bu depoda daha önce iki kez yenilen "elle kopyalanmış liste" desenini
kapatıyor.

**Kalan sınır (eşikli borç):** aday **uzayı** hâlâ elle yazılı. Kaynak deseni bir gün `G10`
ya da yeni bir anahtar kelime (`RELEASE` gibi) kabul ederse süzgeç onu üretemez ve çit sessizce
o kimliği ölçmez. Öz-kontrol bunu yakalamaz (yalnızca kabul-et-hepsini vakasını yakalar).

### 2.3 Mutasyonlar

| Mutasyon | Beklenen | Gerçek |
|---|---|---|
| `parseGateFileName`'in iki `.toUpperCase()` çağrısı kaldırıldı | yeni çit KIRMIZI | **228 KIRMIZI / 229 geçti (457)** — sözleşmenin iddiasıyla birebir |
| Aynı mutasyonla ESKİ 7 dosya (`tests/features/gates/` + `gates-api`) | YEŞİL kalmalı (borcun gerçek olduğunu kanıtlar) | **7/7 dosya, 93 test YEŞİL** — borç gerçekti, çit olmasa mutasyon görünmezdi |
| `FeatureDetailModal.tsx:175` `tabIndex={0}` kaldırıldı | K6 KIRMIZI | **tam olarak 1 KIRMIZI** (K5/K6), diğer **12 test etkilenmedi** |

Her mutasyon elle geri alındı; `diff` kaynak-doğrusuyla **birebir aynı**, `git diff` **boş**.

### 2.4 Küçük tutarsızlık (bloklayıcı değil)

Sözleşme §1.2 eski 7 dosya için "toplam 322 test" diyor; benim ölçümüm aynı 7 dosyada **93
test**. Dosya sayısı ve sonuç (hepsi yeşil) uyuşuyor, yalnızca test sayısı farklı — muhtemelen
farklı bir yol kümesi sayılmış. Kanıtın anlamını değiştirmiyor.

### 2.5 Eşikli borç

- `OPERATION_PATTERNS.featureStatus` (`write-gate.ts:38`) **harfe duyarlı kaldı** — S1'in
  düzelttiğiyle birebir aynı sınıf. Pratik risk düşük (feature dosya adları diskten okunan
  listeden geliyor, yani zaten kanonik), ama `CLAUDE.md`'nin "her yol karşılaştırması ya harfe
  duyarsız olacak ya da gerekçelendirilecek" kuralı bu satır için uygulanmamış. **Eşik:** feature
  dosya adı kullanıcı girdisinden ya da harici bir kaynaktan gelmeye başlarsa kapatılmalı.
- §2.2'deki aday uzayı sınırı.

---

## 3. `docs/qa/test-izolasyon-contract.md` — **KARAR: GEÇTİ**

**Puanlar:** İşlevsellik **8** · Özellik bütünlüğü **8** · Görsel/UX yok say · Kod kalitesi **8**.

### 3.1 Kabul kriterleri ve kanıt

| Kriter | Kanıt |
|---|---|
| §3 — 19 dosyadaki **tüm** recursive temizlik çağrılarına retry | Bizzat tarandı: `maxRetries: 5, retryDelay: 50` → **61 tek satırlık + 1 çok satırlık = 62 çağrı, 19 dosya**. Retry'sız kalan `recursive: true, force: true })` → **0** |
| §4.1 ≥10 ardışık koşuda ENOTEMPTY assert kırmızısı yok | Sözleşme 30/30 ölçmüş; ben 5 koşu ekledim: **0 ENOTEMPTY, 0 assert kırmızısı** |
| §4.3 `_selftest.cjs` 206/206 | doğrulandı |
| §4.4 tsc/eslint 0 | doğrulandı |
| §4.5 `npm run e2e` 55/55 izole | doğrulandı |

### 3.2 Kendi doğrulamam — kapsam gerçekten tam mı?

**Soru:** desen taraması bir çağrı noktasını kaçırdı mı?
**Yöntem:** `rmSync|fs.rm(` için TÜM `tests/`, `src/`, `scripts/` tarandı, `maxRetries` içerenler
düşüldü.
**Gerçek:** geriye kalan her çağrı ya **tek dosya silme** (`recursive` YOK — `ENOTEMPTY` bu
çağrılarda yapısal olarak imkânsız, o hata özyinelemeli dizin silmeye özgü) ya da
`no-delete-guard.test.ts`/`no-write-gate-bypass.test.ts` içindeki **tarama dizeleri** (çağrı
değil). `tests/build-css.test.ts:275` çok satırlı biçimde yazıldığı için tek satırlık grep'e
takılmıyor ama **korumalı** (satır 277-278). Yani kapsam iddiası doğru; sözleşmedeki "61
çağrı / 19 dosya" sayısı yalnızca sayım yöntemi farkından "62 / 19" olarak çıkıyor.

**Teşhis kalitesi.** Sözleşme, CEO'nun hipotezini (paylaşılan geçici dizin) ölçerek **reddediyor**
ve `projects.json okunamadı` satırının **40/40 koşuda** (yani başarılı koşularda da) çıktığını
göstererek nedensellik kurmuyor. Bu, `CLAUDE.md`'nin "bu satır BAŞARILI koşularda da çıkıyor mu?"
kuralının doğru uygulanması. Gerçek kök neden (run 36/40'ta **canlı yakalanmış** `ENOTEMPTY`)
ayrı bir metinle belgelenmiş.

### 3.3 Mutasyon kanıtının dürüstçe zayıf yanı — kabul ediliyor

Sözleşme §6 mutasyon kanıtının **dolaylı** olduğunu kendisi söylüyor: `maxRetries` geri alınınca
20 koşuda ENOTEMPTY tekrar üretilemedi, ve bunun `(1-0.025)^20 ≈ %60` ile beklenen olduğu
istatistiksel olarak gösteriliyor. Bu **doğru bir dürüstlük beyanı**, uydurma bir "kanıtlandı"
iddiası değil. Asıl dayanak: (a) canlı yakalanmış olay, (b) `maxRetries`/`retryDelay`'in Node'un
**bu hata için belgelenmiş** çözümü olması. Bunu kabul ediyorum — transient bir yarışta
deterministik mutasyon kanıtı talep etmek karşılanamaz bir ölçüt olurdu.

### 3.4 Eşikli borç

- `tests/e2e/**` altındaki **7** aynı desenli çağrı bilinçli kapsam dışı (Playwright, ayrı
  runner). Ama aynı sınıf orada da **assert kırmızısı** üretebilir. **Eşik:** `npm run e2e`'de
  bir `ENOTEMPTY`/`EBUSY` kırmızısı görülürse aynı iki satırlık düzeltme oraya da taşınmalı.

---

## 4. `docs/qa/grup3-transkript-thread-contract.md` — **KARAR: GEÇTİ** (eşikli borçla)

**Puanlar:** İşlevsellik **8** · Özellik bütünlüğü **8** · Görsel/UX yok say · Kod kalitesi **8**.

### 4.1 Kabul kriterleri ve kanıt

| Madde | Kanıt (bizzat ölçüldü) |
|---|---|
| 1 — Latin-dışı kör nokta | `TOKEN_RE = /[\p{L}\p{N}:._-]+/gu` kurulu. Kendi sondam: 8 gerçekçi taşıyıcının **8'i de YAKALANDI** (§4.2) |
| 2 — `.gitattributes` muafiyeti yola bağlı | `transcripts-privacy-guard.test.ts:51,178` — `GIT_ATTRIBUTES_EXEMPT_PATH` tek mutlak yol; `walk()` `full !== …` ile karşılaştırıyor, `entry.name` değil. Satır 740-741 muafiyetin kendi öz-kontrolü |
| 3 — 4 desene sınır testi | `isApprovedToken` sınır vakaları mevcut; kendi sondamda `:1234`, `1234.1.1` vb. reddediliyor |
| 4 — D8/D9 eskalasyon rozeti | Mutasyonla doğrulandı (§4.3) |
| 5 — ölü `retry` kaldırıldı | `useProjectFeatureList.ts`'te `retry` alanı yok (yalnızca kaldırıldığını anlatan yorum satır 49); tsc/eslint 0 |

### 4.2 Kendi saldırım — okunabilir metin hâlâ sızıyor mu?

Geçici bir sonda testiyle (`tokenize`/`isApprovedToken` **gerçek modülden** import edilerek, kendi
yeniden uygulamam kullanılmadan) 10 vektör ölçüldü. "Sızdı" = üretilen her token onaylı.

| Vektör | Sonuç |
|---|---|
| V1 Kiril düz metin (`Иванов Иван домашний адрес Москва`) | **YAKALANDI** |
| V2 CJK (`田中太郎の自宅住所は東京都渋谷区`) | **YAKALANDI** |
| V3 Arapça | **YAKALANDI** |
| V4 Yunanca | **YAKALANDI** |
| V5 Türkçe düz metin (kontrol) | **YAKALANDI** |
| V6 İngilizce prompt (kontrol) | **YAKALANDI** |
| V9 Matematiksel kalın Latin (`𝐇𝐞𝐫𝐨𝐧`) | **YAKALANDI** (`\p{L}` kapsıyor — sözleşmenin iddia ettiğinden geniş) |
| V10 Tam genişlik Latin (`Ｖｅｒｏｎ`) | **YAKALANDI** |
| **V7 Daireli harfler** (`ⓗⓔⓛⓛⓞ ⓦⓔⓡⓞⓝ`) | **SIZDI** |
| **V8 Kare harfler** (`🅐🅑🅒`) | **SIZDI** |

Sonuç: **8/8 gerçekçi taşıyıcı yakalanıyor.** Sızan ikisi Unicode `\p{So}` (Enclosed
Alphanumerics / Squared Latin) bloğunda ve sözleşme §3 madde 1 emoji/`\p{S}`'yi **açıkça** kapsam
dışı bırakmış — yani ilan edilmiş sınırın içinde.

**Ama sözleşmenin gerekçesi dar:** *"emoji JSON transkript metninde pratik taşıyıcı değil"*.
Daireli/kare Latin harfler emoji değil, **okunabilir harf benzeridir** ve gerçek metin taşır.
Bloklayıcı saymıyorum çünkü tehdit modeli "birinin yanlışlıkla gerçek kişisel veri içeren bir
fixture eklemesi" ve öyle bir veri **düz metin** olur (8/8 yakalanıyor); daireli harfe
dönüştürme ancak **kasıtlı** bir kaçınmadır. Yine de gerekçe düzeltilmeli.

### 4.3 Mutasyonlar

| Mutasyon | Beklenen | Gerçek |
|---|---|---|
| D8 tek nokta: `Math.min(delimiterIndex, MAX_HEADER_LINES)` → `delimiterIndex` | yalnızca D8 KIRMIZI | **1 KIRMIZI / 19 geçti (20)** |
| + D9 yığılmış: `lines[0]?.trim() === '---'` → `false` (tam fix-öncesi davranış) | D8 **ve** D9 KIRMIZI | **2 KIRMIZI / 18 geçti (20)** |

İki düzeltmenin **bağımsız** çitlendiği doğrulandı (kaskad değil). Elle geri alındı; `diff`
kaynak-doğrusuyla birebir aynı, `git diff` boş.

### 4.4 Eşikli borçlar

1. **`\p{So}` harf benzerleri okunabilir metin geçiriyor** (§4.2). **Eşik:** sözleşmedeki
   gerekçe "emoji taşıyıcı değil" yerine "Enclosed/Squared/Symbol harf benzerleri **kasıtlı**
   kaçınma sayılır, tehdit modelinin dışında" olarak düzeltilmeli; gerçek bir fixture'da bu
   karakterler görülürse tokenizer `\p{S}`'ye açılmalı.
2. **`MAX_HEADER_LINES = 10`** — sözleşme §5'te açıkça not edilmiş. Rapor biçimi değişip
   `KARAR:`/`ESKALE:` 10. satırın altına inerse rozet sessizce ölür. (Bu rapor satır 1-2'de
   tutuyor.)
3. `GIT_ATTRIBUTES_EXEMPT_PATH` karşılaştırması harfe **duyarlı** — Windows'ta `.GITATTRIBUTES`
   adlı bir dosya muafiyete girmez, **taranır**. Bu fail-closed (güvenli) yön, borç değil, ama
   kayda geçiyorum.

---

## 5. `docs/qa/o7-agent-satirlari-contract.md` — **KARAR: GEÇTİ**

**Puanlar:** İşlevsellik **8** · Özellik bütünlüğü **8** · Görsel/UX **8** · Kod kalitesi **8**.

Ana vaat (sözleşmenin kendi cümlesi): *"alt agent'lar çalışırken ne yaptıklarını görmek — bu
görüntü sayfa yenilemesinde kaybolursa panel kendi ana vaadini bozar."* Ana vaadin **doğrudan**
çitini bizzat ölçtüm.

### 5.1 "Tek render yolu" iddiası — DOĞRULANDI

Kod okundu: `useChatSession.ts:659-664` — `toolRows` artık ayrı bir `useState` **değil**,
`entriesMap` üzerinde bir `useMemo`; `messages` (satır 655) **birebir aynı** `entriesMap`'ten
türüyor. `toToolRow` (satır 187) tek dönüşüm fonksiyonu. **İkinci bir yol kalmamış** —
`toolRows` için `useState` araması sonuçsuz.

### 5.2 Kendi saldırım — reload sonrası biçim ve kronoloji

Mevcut e2e yalnızca `toBeVisible()` + metin eşleşmesi ölçüyordu. Kendi Playwright spec'imi yazıp
**tam sıralı DOM anlık görüntüsünü** canlı akış ve reload sonrası için karşılaştırdım.

| Ölçüm | Beklenen | Gerçek |
|---|---|---|
| Araç satırı metni (canlı) | — | `TOOL\|✓ Bash tamamlandı (0 sn) — Klasörü listele` |
| Araç satırı metni (reload sonrası) | canlıyla birebir | **birebir aynı** |
| Araç satırının günlükteki göreli indeksi | korunmalı | canlı=0, reload=0 — **korundu** |

**Dar genişlik** (`toBeVisible()` kaydırma kabında yalan söylediği için **kırpılmış görünür
genişlik** ile, kabın `overflow-x` kesişimi hesaplanarak):

| Viewport | Kırpılmış görünür genişlik | Metin |
|---|---|---|
| 320px | **296px** | `✓ Bash tamamlandı (0 sn) — Klasörü listele` |
| 375px | **351px** | aynı |
| 480px | **456px** | aynı |

Hiçbirinde kırpılma/0 piksel yok. 4/4 sonda yeşil.

**Kendi sondamın dürüstçe zayıf yanı:** DOM seçicim yalnızca araç satırını yakaladı (mesaj
balonlarında `data-chat-role` gibi bir öznitelik yok), yani "mesajlara göre göreli konum"
iddiasını benim sondam **zayıf** ölçtü (1 elemanlı liste). Bu yüzden kronolojiyi ayrıca mutasyonla
doğruladım (§5.3, Mutasyon C).

### 5.3 Mutasyon

| Mutasyon | Beklenen | Gerçek |
|---|---|---|
| C: `toToolRow`'da `tsMs - entry.elapsed_ms` geri hesabı kaldırıldı (`startedAtMs = tsMs`) | sıralama testi KIRMIZI | **tam olarak 1 KIRMIZI** — *"sıralama: geç BİTEN ama erken BAŞLAYAN bir araç, arada kalan bir metin mesajından ÖNCE render edilir"*, diğer 29 test etkilenmedi |

Kronoloji **gerçekten çitli**. Bu, bu depoda beş feature boyunca sessizce bozulmuş olan hata
sınıfının (F-010) doğrudan çiti. Elle geri alındı, `diff` birebir aynı, `git diff` boş.

### 5.4 Diğer doğrulamalar

- `npm run e2e:chat` **5/5** (izole) — 320px Ö7 testi `clippedVisibleWidth` tekniğini kullanıyor
  (doğru teknik, `toBeVisible()` değil).
- Gizlilik (§7): persist edilen tek serbest metin alanının SDK şemasında yalnızca
  `AgentInput`/`BashInput`'ta bulunduğu, dosya yolu/komut/içerik taşıyan araçların şemasında
  `description` **olmadığı** gerekçesi makul ve ölçülmüş; güven sınırı argümanı (aynı modelin
  zaten redaksiyonsuz gösterilen metni) tutarlı. Yeniden ele alınma eşiği açıkça yazılı.

### 5.5 Eşikli borçlar (sözleşmenin kendi listesi kabul edildi)

1. `parent_tool_use_id` persist edilmiyor — bugün okuyan yol yok; gruplayan bir görünüm eklenirse
   şemaya girmeli.
2. Hacim/gruplama kapsam dışı — tek turda >50 araç satırı görülürse ele alınmalı.
3. Dangling `started` koruması yalnızca birim testte doğrulandı, gerçek sunucu çökmesiyle canlı
   ölçülmedi. Düşük risk (metin girdilerinin kanıtlı emsalinin kopyası).

---

## 6. `docs/qa/b4-test-kararsizligi-contract.md` — **KARAR: GEÇTİ** (negatif sonuç)

**Puanlar:** İşlevsellik **8** · Özellik bütünlüğü **8** · Görsel/UX yok say · Kod kalitesi **8**.

Bu bir düzeltme sözleşmesi değil; bir **ölçüm** sözleşmesi. Onu "düzeltme çalışmadı" diye
değerlendirmedim; brief'in dört sorusuna göre değerlendirdim.

### 6.1 Ölçüm yeterince titiz mi? — **EVET**

- **54 koşu** (44 + threads turu 10), üç ayrı tur, hepsi "temiz" (eşzamanlı iş yokken) ya da
  kirliliği açıkça etiketlenmiş.
- **Sınıflandırma gerçek:** Sınıf A (worker-fork çökmesi, assert **sıfır**) / Sınıf B (ENOTEMPTY,
  gerçek assert) / Sınıf C (threads zaman aşımı) / Sınıf D (tam sessiz çökme) ayrı ayrı sayılmış.
- **Kendi hatasını yakalamış ve ilan etmiş:** tur 2-4'te kullanılan `poolOptions.forks` vitest
  5'te **yok**; `tsc --noEmit` yakalamış, o üç tur **GEÇERSİZ** ilan edilip ölçüm tekrarlanmış.
  Bu, sahte bir "iyileştirme" iddiasını önlemiş.
- **A priori red ölçüme çevrilmiş:** `pool:'threads'` önce varsayımla reddedilmişti; ölçüldü ve
  **orijinal gerekçenin YANLIŞ olduğu** (env sızıntısı yok — writer/reader sonda çifti, 4 koşu)
  itiraf edilmiş, ama bağımsız ve çok daha büyük bir gerekçeyle (%25 → %100) red korunmuş.
- **Yoğunlaşma analizi ile hipotez çürütülmüş:** `maxWorkers: 1` oranı %40'tan **%100'e**
  çıkarmış → "paralellik/kaynak baskısı kök nedendir" hipotezi çürütülmüş (sezgiye aykırı ama
  ölçülmüş bulgu).
- **Alt süreç hipotezi hipergeometrik beklentiyle** değerlendirilmiş (beklenen 0.65, gözlenen 1)
  ve **doğrulanmadı** denmiş; zayıf korelasyonda manipülasyon denenmemiş — doğru duruş.

**Bağımsız çapraz kontrolüm:** 5 tam suite koşusu, **1 kırmızı (%20)**, tamamı Sınıf A
(`Worker forks emitted error`, assert sıfır). Sözleşmenin %25 tabanıyla tutarlı. Kırmızı koşuda
çıktı `Test Files 85 passed | 1 skipped (87)` gösterdi ve `scripts/verify-test-run.mjs`
*"1 silently missing"* diyerek **doğru şekilde kırmızı verdi** — yani sessiz atlama gerçekten
yok, çitin çalıştığını sözleşmeye güvenmeden doğruladım.

### 6.2 "Yönetilen risk" kararı savunulabilir mi? — **EVET, erken pes edilmemiş**

Dört farklı yapılandırma gerçekten denendi (`maxForks` — geçersiz, `maxWorkers: 8`,
`maxWorkers: 1`, `pool:'threads'`); hiçbiri iyileştirmedi, ikisi kötüleştirdi. `vitest.config.ts`
**değiştirilmedi** ve `git diff` boş bırakıldı — yani "bir şey yaptım" görüntüsü için kozmetik
bir değişiklik bırakılmamış. Uydurma bir "buldum" yerine ölçülmüş bir "bilmiyorum" tercih
edilmiş; brief'in ve `CLAUDE.md`'nin istediği tam olarak budur.

Bir eleştirim var ama bloklayıcı değil: `isolate: false` hâlâ **a priori** reddedilmiş durumda
(§2 tablosu: *"Ölçülmedi, aynı gerekçe"*). Bu, aynı sözleşmenin `pool:'threads'` için mahkûm
ettiği hatanın tekrarı. **Eşik:** B-4 yeniden açılırsa ilk iş `isolate: false`'u ölçmek olmalı
(çıktının kendisi "~1.97s faster with isolate: false" diye öneriyor).

### 6.3 Bağlayıcı kural yeterli mi? — **KISMEN. G6 için yetersiz, sertleştirilmeli.**

Sözleşmedeki kural: *assert kırmızısı = gerçek hata, her zaman bloklayıcı; worker çökmesi
(assert sıfırken) yeniden koşturur; yayın kanıtı için ardışık iki tam yeşil koşu.*

İlk iki yarısı **doğru ve yeterli** — ve artık daha da güvenli, çünkü assert kırmızısı üretebilen
tek bilinen izolasyon sınıfı (ENOTEMPTY) 3 numaralı sözleşmeyle kapatıldı. Yani bugün "assert
kırmızısı" sinyalini taklit edebilen bilinen bir ortamsal sınıf **kalmadı**; bu, kuralın
aşınmasını önleyen kritik koşul.

Üçüncü yarısı (**iki** ardışık yeşil) G6 için yetersiz. Sözleşmenin kendisi hesabı veriyor:
%20-25 taban oranında iki ardışık koşunun ikisinin de Sınıf A'ya çarpması **%4-6**. G6 tek
yönlü bir yayın kapısı; %4-6'lık "kanıt kalitesi kaybı" oranı bir kapı için yüksek değil ama
kapının dayanağı **tek** iddia ("testler yeşil") olduğu için payı düşürmek ucuz.

### 6.4 G6'yı taşıyabilir mi? — **Sertleştirilmiş hâliyle EVET**

qa-evaluator kararı (sözleşme §3.6 bu kararı açıkça bana bırakıyor):

> **G6 test kanıtı kuralı.** (1) Herhangi bir **assert kırmızısı** — koşu sayısından bağımsız —
> gerçek hatadır ve G6'yı bloklar; "tekrar koş" ile geçilemez. (2) Yalnızca `Worker forks
> emitted error` imzalı, assert **sıfır** olan çökme ortamsal sayılır ve yeniden koşulabilir.
> (3) G6 kanıtı için **üç ardışık tam yeşil** `npm run test` koşusu gerekir (86 dosya / 1855
> test tam olarak hesaplanmış), ve her koşunun ham özeti rapora yazılır. (4) Bir kırmızı
> görüldüğünde sayaç **sıfırlanır** (üç ardışık = gerçekten ardışık).

Gerekçe: %20-25 taban oranında üç ardışık yeşilin şans eseri bir gerçek regresyonu maskeleme
ihtimali %1'in altına iner; maliyet koşu başına ~15 sn olduğu için toplam ~1 dakika. Bu turda
**5 koşuluk** örneklem (4 yeşil, 1 Sınıf A) bunun pratikte ulaşılabilir olduğunu gösterdi.

### 6.5 Eşikli borçlar

1. **B-4 kapanmadı** — kök neden hâlâ bilinmiyor, oran ~%20-25. Yönetilen risk olarak kalıyor.
2. `isolate: false` hâlâ ölçülmemiş (§6.2).
3. Sözleşmenin §3.4/§6d'sindeki `_selftest.cjs = 165/165` rakamı bugün **206/206** — o turda
   doğruydu, bugün bayat. Bilgilendirme.

---

## CEO'nun uygulaması gereken frontmatter değişiklikleri

```
docs/qa/hook-borclari-contract.md          → status: fix
docs/qa/grup2-kapilar-borclari-contract.md → status: done
docs/qa/test-izolasyon-contract.md         → status: done
docs/qa/grup3-transkript-thread-contract.md→ status: done
docs/qa/o7-agent-satirlari-contract.md     → status: done
docs/qa/b4-test-kararsizligi-contract.md   → status: done
```

(Sözleşme dosyalarına bu turda hiç yazılmadı — kararı CEO uygular.)

---

## G6 kapısı için kalan engeller

**Engel VAR — G6 bugün açılamaz.** Kalanlar:

1. **BLOKLAYICI — §1.2 (B1).** Kabuktan `docs/approvals/**` ve `.claude/hooks/**` üzerine
   yazma/silme, fiil ile hedef farklı kabuk segmentlerinde olduğunda engellenmiyor (12/12 gerçek
   saldırı geçiyor, segmentasyon öncesi 12/12 engelleniyordu). Bir onay dosyasının kurulu hook
   altında canlı olarak üzerine yazıldığı gösterildi. G5 güvenlik kapısının dayandığı Katman B
   bu turda **zayıfladı**; düzeltilmeden G6 açılmamalı.
   - Düzeltmenin ölçütü ölçülebilir olsun: yukarıdaki **R1-R12 sondalarının 12'si de ENGEL**
     olmalı, **ve** §1.3'teki **F1-F10 salt-okunur sondalarının 10'u da GEÇER** olmalı
     (aşırı engelleme yeniden açılmasın). İki yön birlikte ölçülmeli; tek yön düzeltmek bu turun
     hatasını simetrik olarak tekrarlar.
   - Kök neden "çıplak `>` yönlendirmesi `writeVerb`'de yok" boşluğuyla (§1.5 madde 1) **aynı
     turda** ele alınmalı, yoksa düzeltme yarım kalır.

2. **G6 test kanıtı kuralı henüz yazılı değil.** §6.4'teki dört maddelik kural `CLAUDE.md`'ye
   ya da G6 kontrol listesine geçirilmeli; aksi hâlde G6 "tek koşu yeşil" ile açılma riski taşır.

**Engel OLMAYANLAR (kayıt için):** 2, 3, 4, 5 ve 6 numaralı sözleşmeler G6 önünde engel
oluşturmuyor. §2.5, §3.4, §4.4, §5.5, §6.5'teki eşikli borçların hiçbiri G6'yı bloklamaz;
hepsi tetikleyici koşulu açıkça yazılmış, ölçülmüş borçlardır.
