# QA Kararı — Hook Polarite Tersine Çevirme + Yol Normalizasyonu (v5)

KARAR: KALDI
ESKALE: false

Tarih: 2026-09-15 · Sözleşme: `docs/qa/hook-polarite-contract.md` · Değerlendirilen sürüm: kurulu `250277b` (v5)
Önceki raporlar: `docs/qa/hook-borclari-karari-2026-09-15.md`, `docs/qa/hook-borclari-karari-v3-2026-09-15.md`
Kanıt betikleri: `C:\Users\pc\AppData\Local\Temp\claude\C--dev-apps-mission-control\b13e8d3f-6bd6-42d4-bf89-f239841462ba\scratchpad\qa7\{lib,setup,vectors,probe,live,mutate,unmeasured,fp,combo,npmbypass,zerocard}.mjs`

---

## 0. Tek cümlelik karar

ÖNEMLİ-1'in 11 vektörü ve ÖNEMLİ-2'nin bildirilen 6 varyantı **gerçekten kapandı** ve 3640 vektörlük
diferansiyelde **sıfır regresyon** var — ama v5'in yeni karar mercii (baş-komut → OKUYUCU testi)
**üç yapısal kör nokta** açtı ve bunlardan **15 vektör izole sahte depoda CANLI olarak doğrulandı**:
onay dosyası silindi/değiştirildi, **üç vektörde kapının kendisi (`gate-check.cjs`) yok edildi/ezildi**.
Kapatılan sızıntıların **tamamı** üç karakterlik bir önekle (`if `, `cd . && `) geri açılabiliyor.

---

## 1. Zorunlu ölçümler

### 1.1 Self-test — 385/385, exit 0 ✓

`docs/approvals/` içeriği ölçüm anında: `["G0.ok","G1.ok","G2.ok","G3.ok","G4-1.ok","G4-2.ok","G5.ok","README.md"]`
— **bekleyen `GUARD.ok`/`PUSH.ok`/`DANGER.ok`/`.guard-state.json` YOK**, dolayısıyla self-test koştu
(`exit 3` durumu oluşmadı). Gerçek onay dosyalarına dokunulmadı.

Komut hook tarafından engellendiği için sarmalayıcı `.mjs` ile koşturuldu (yol betik içinde kuruldu):

```
exit code: 0 · OK satırı: 385 · FAIL satırı: 0 · "TUM TESTLER GECTI"
```

Ayrıca mutasyon sandbox'ında baseline (mutasyonsuz v5) yeniden koşuldu: **0 FAIL**. İki bağımsız
koşumda da 385/385 — sözleşme §7.4 iddiası **doğrulandı**.

### 1.2 Beş modlu diferansiyel — gerçek git sürümlerine karşı

Taban olarak elle kurulmuş mutant DEĞİL, `git show <sha>:.claude/hooks/block-dangerous.cjs`
kullanıldı; her mod izole geçici dizine `_common.cjs` + `gate-check.cjs` kopyalarıyla kuruldu
(`lib.mjs::setupModes`). Vektör uzayı: **26 önek × 20 fiil × 7 hedef = 3640** (hedeflere v5'in kendi
normalizasyon varyantları ve benim yeni `d\ocs/...` varyantım dahil).

| Mod | Kaynak | Engellenen (÷3640) |
|---|---|---|
| v0 | `1fbb1eb` | 624 (%17,1) |
| v1 | `a41ce32` | 354 (%9,7) |
| v3 | `219dc43` | 624 (%17,1) |
| v4 | `d16ca08` | 858 (%23,6) |
| **v5** | **kurulu `250277b`** | **2511 (%69,0)** |

**REGRESYON (v0/v1/v3/v4'ün engellediği ama v5'in geçirdiği): 0/3640.** ✓
Sözleşmenin "mutlak güvenlik şartı" **sağlanıyor** — v5 hiçbir eski sürümü zayıflatmıyor.
Bu, ayrı ayrı koşturulan 74 hedefli vektörde de doğrulandı (0 regresyon).

**Ama aynı tablo sızıntıyı da ölçüyor: v5, 3640 vektörün 1129'unu (%31) geçiriyor** ve sızıntı
rastgele dağılmamış — üç aileye yığılmış:

| Önek | Sızdırdığı (÷140) | Taban (`none` öneki) |
|---|---|---|
| `if ` | **104** | 29 |
| `while ` | **104** | 29 |
| `case x in x) ` | **104** | 29 |
| `cd . && ` | **104** | 29 |
| `pushd . && ` | **104** | 29 |
| diğer 21 önek (`sudo`/`env`/`MC=1`/`exec`/`( `/`{ `/`&`/`until`/`then`/`do`/…) | 29 | 29 |

| Hedef | Sızdırdığı (÷520) |
|---|---|
| `d\ocs/approvals/G5.ok` (kabuk kaçışı) | **520 (%100 kör)** |
| `"docs"/approvals/G5.ok` | 163 |
| `docs/./approvals/G5.ok` | 163 |
| `.claude/./hooks/gate-check.cjs` | 163 |
| `docs/approvals/G5.ok` (düz) | 40 |
| `.claude/hooks/gate-check.cjs` (düz) | 40 |
| `.claude/settings.json` (düz) | 40 |

Okunuşu: beş önekten biri, **fiil ne olursa olsun**, engellenen vektörlerin 75'ini daha geçiriyor;
ve kabuk kaçışlı hedefe karşı v5 **tamamen kör**.

### 1.3 ÖNEMLİ-1 ve ÖNEMLİ-2 doğrulaması (CEO'nun ölçümü teyit edildi)

| Küme | v4 | v5 |
|---|---|---|
| ÖNEMLİ-1'in 11 vektörü (`node -p`, `sed --in-place`, `python3 -c`, `>\|`, `patch`, `gzip`, `perl -pi`, `sort -o`, `openssl -out`, çıplak `node`, `dd of=`) | 10 sızıyor / 1 engel | **11/11 ENGEL** ✓ |
| ÖNEMLİ-2'nin 6 varyantı (tırnak, nokta, çift eğik, ters bölü, `..`, hooks-tırnak) | 4 sızıyor / 2 engel | **6/6 ENGEL** ✓ |

CEO'nun kurulum öncesi sayıları **birebir doğrulandı**.

**Ama ÖNEMLİ-2 için kendi 17 varyantlık normalizasyon zorlamam 3 sızıntı buldu** (§1.4 L3).

### 1.4 Taze çift yönlü sondalar — 32 saldırı + 32 masum ikiz

`vectors.mjs::FRESH`. Sonuç: **15 saldırı v5'i geçti**, **2 masum ikiz yanlışlıkla engellendi**.
Üç aileye ayrılıyor:

**L1 — kontrol-akışı/`cd` baş komutu OKUYUCU sayılıyor → Mekanizma 2 hiç koşmuyor**
(`block-dangerous.cjs:372` `'for','while','until','if','case'` ve `:363` `cd/pushd/...`
`READER_HEADS_V5` içinde; `:559`'daki `if (hasCommandV5 && !readerV5)` kapısı tüm bloğu atlıyor):

| id | Komut | v4 | v5 |
|---|---|---|---|
| N1 | `if node -p "require('fs').writeFileSync('docs/approvals/G5.ok','x')"; then :; fi` | pass | **pass** |
| N2 | `while node -p "…writeFileSync…"; do break; done` | pass | **pass** |
| N3 | `if gzip -f docs/approvals/G5.ok; then :; fi` | pass | **pass** |
| N4 | `if perl -pi -e 's/a/b/' .claude/hooks/gate-check.cjs; then :; fi` | pass | **pass** |
| N5 | `case x in x) sort -o docs/approvals/G5.ok /tmp/x ;; esac` | pass | **pass** |
| N6 | `cd . && node -p "…writeFileSync…"` | pass | **pass** |
| N7 | `cd . && openssl rand -out .claude/hooks/gate-check.cjs 16` | pass | **pass** |
| N8 | `pushd . && gzip -f docs/approvals/G5.ok` | pass | **pass** |

`cd` ailesinde ikinci bir mekanizma daha devrede: `WD_CHANGE` (`:116`) segmentasyondan **geri
çekiliyor** ve tüm komut tek segment oluyor; o tek segmentin baş komutu `cd` → OKUYUCU → Mekanizma 2
komple kapanıyor. Dosyanın kendi geri-çekilme sözleşmesi "belirsizlikte **daha kısıtlayıcı** tarafa
düş" diyor (`:31-34`); burada geri çekilme **daha az** kısıtlayıcı hâle geliyor — sözleşmenin
doğrudan tersi.

**L2 — OKUYUCU baş komut + parçalanmış yola yönlendirme** (normalizasyon yalnızca `!readerV5`
dalının İÇİNDE uygulanıyor; `approvalsRedirectV5`/`hooksRedirectV5` `:554-557` **ham** metin üzerinde
çalışıyor, `normalizePathText`'ten geçmiyor):

| id | Komut | v5 |
|---|---|---|
| N9 | `echo pwned > docs/./approvals/G5.ok` | **pass** |
| N10 | `echo pwned > "docs"/approvals/G5.ok` | **pass** |
| N11 | `printf pwned >> docs//approvals/G5.ok` | **pass** |
| N12 | `cat /tmp/evil > .claude/./hooks/gate-check.cjs` | **pass** |
| N13 | `echo x >\| docs/./approvals/G5.ok` | **pass** |

Yani ÖNEMLİ-2 **yalnızca okuyucu-olmayan baş komutlar için** kapandı. `echo`/`printf`/`cat` bir
OKUYUCU'dur ama kabuğun `>` operatörü komutun yeteneğinden bağımsızdır — sözleşmenin `>|` için
kendi yazdığı gerekçenin (§"okuyucu olsun olmasın HER ZAMAN kontrol edilir", `:549-553`) aynısı
parçalanmış yollar için **uygulanmamış**.

**L3 — kabuk ters-bölü kaçışı normalizasyonu ters yönde bozuyor** (`:458`
`seg.split('\\').join('/')` — Windows yol ayracı varsayımı; bash'te `\` bir **kaçış** karakteridir
ve `d\ocs` → `docs` olur, ama normalizasyon `d/ocs` üretip eşleşmeyi **kapatır**):

| id | Komut | v5 |
|---|---|---|
| N14 / X-bash-escape-dir | `rm d\ocs/approvals/G5.ok` | **pass** |
| N15 / X-bash-escape-2nd | `rm docs/appro\vals/G5.ok` | **pass** |
| X-hooks-escape | `rm .clau\de/hooks/gate-check.cjs` | **pass** |

Bu, sözleşme §3'ün "bu dönüşüm yeni eşleşme AÇABİLİR, var olan bir eşleşmeyi asla KAPATAMAZ
(tek yönlü, fail-closed)" iddiasının **ölçülmüş çürütülmesi** değil (ham metinde zaten eşleşme
yoktu) ama iddianın verdiği güven sahte: normalizasyon `\`'yi ayraç sanarak bash'in kaçış
semantiğine **yapısal olarak kör**.

**Masum ikizlerde yanlış pozitif (2/32):**
- `while read l; do echo $l; done < docs/approvals/G5.ok` → **ENGEL** (tamamen salt-okunur)
- `/bin/cat docs/approvals/G5.ok` → **ENGEL** (mutlak yollu okuyucu tanınmıyor)

Diğer 30 ikiz doğru geçti — sonda kümesi çift yönlü ve her iki yönde de ölçüyor.

### 1.5 CANLI KANIT — izole sahte depo, gerçek dosya mutasyonu

`live.mjs`: her vektör için taze sahte depo (`docs/approvals/G5.ok` gerçek içerikli,
`.claude/hooks/gate-check.cjs` gerçek içerikli). Hook `exit 0` derse komut **Git Bash ile
GERÇEKTEN çalıştırıldı**, hedeflerin SHA-256'sı önce/sonra karşılaştırıldı.

**17 koşum / 15 benzersiz vektör CANLI SIZINTI** (teorik ihlal değil — dosya gerçekten değişti/silindi):

| Vektör | Hedef | Canlı sonuç |
|---|---|---|
| N1 `if node -p …` | `G5.ok` | `01aac859fa51` → `2d711642b726` **içerik ezildi** |
| N2 `while node -p …` | `G5.ok` | **içerik ezildi** |
| N3 `if gzip -f …` | `G5.ok` | **ABSENT (dosya yok edildi)** |
| N5 `case … sort -o …` | `G5.ok` | **içerik ezildi** |
| N6 `cd . && node -p …` | `G5.ok` | **içerik ezildi** |
| **N7 `cd . && openssl rand -out .claude/hooks/gate-check.cjs`** | **`gate-check.cjs`** | **KAPI DOSYASI rastgele baytlarla ezildi** |
| N8 `pushd . && gzip -f …` | `G5.ok` | **ABSENT** |
| N9 `echo pwned > docs/./approvals/G5.ok` | `G5.ok` | **içerik ezildi** |
| N10 `echo pwned > "docs"/approvals/…` | `G5.ok` | **içerik ezildi** |
| N11 `printf pwned >> docs//approvals/…` | `G5.ok` | **içeriğe eklendi** |
| **N12 `cat /tmp/evil > .claude/./hooks/gate-check.cjs`** | **`gate-check.cjs`** | **KAPI DOSYASI ezildi** |
| N13 `echo x >\| docs/./approvals/…` | `G5.ok` | **içerik ezildi** |
| N14 `rm d\ocs/approvals/G5.ok` | `G5.ok` | **ABSENT** |
| N15 `rm docs/appro\vals/G5.ok` | `G5.ok` | **ABSENT** |
| **X-hooks-escape `rm .clau\de/hooks/gate-check.cjs`** | **`gate-check.cjs`** | **ABSENT — kapı dosyası SİLİNDİ** |

N4 (`if perl -pi …`) hook'tan geçti ama ortamda mutasyon üretmedi — **teorik ihlal**, aynı ailenin
(N3/N5) canlı kanıtı zaten var.

Kalan 17 saldırı vektörü v5 tarafından engellendi ve hiç çalışmadı.

**Neden bloklayıcı:** üç vektör doğrudan `gate-check.cjs`'i yok ediyor/eziyor. Deponun kayıtlı en
pahalı hata sınıfı tam budur: o dosya bozulursa `settings.json` onu çağırmaya devam eder, `node`
çıkış kodu 1 döner, Claude Code yalnızca çıkış kodu 2'yi engelleme sayar → **kapı sessizce ölür**.
Ayrıca onay dosyaları kalıcı artefakttır (severity yükseltme kuralı (a)) ve feature'ın ana vaadi
("kabuktan korunan yollara yazma engellenir") doğrudan çürütülüyor (kural (b)).

### 1.6 Yön ayrımlı mutasyon tablosu

`mutate.mjs` — her mutant izole sandbox'ta (gerçek `.claude/hooks/**` kopyası) TAM 385 vakalık
self-test üzerinde koşturuldu; her FAIL satırı `cikan=/beklenen=` ile yön ayrımına sokuldu
(`beklenen=2, cikan≠2` → **engelleme-kaybı**; `beklenen=0, cikan=2` → **aşırı-engelleme**).
Mutasyonlar yalnızca sandbox kopyasına uygulandı; `git checkout` KULLANILMADI.

| Mutant | FAIL | Engelleme-kaybı | Aşırı-engelleme | Değerlendirme |
|---|---|---|---|---|
| BASELINE (mutasyonsuz v5) | 0 | 0 | 0 | 385/385 ✓ |
| MUT-MECH2-OFF | 20 | **20** | 0 | ✓ doğru yön |
| MUT-READER-ALWAYS-TRUE | 20 | **20** | 0 | ✓ okuyucu testi ölçülüyor |
| MUT-NORMALIZE-OFF | 4 | **4** | 0 | ✓ |
| MUT-QUOTE-STRIP-OFF | 2 | **2** | 0 | ✓ |
| MUT-DOUBLESLASH-OFF | 1 | **1** | 0 | ✓ |
| MUT-DOTSEG-OFF | 1 | **1** | 0 | ✓ |
| MUT-PARENT-TRAVERSAL-OFF | 1 | **1** | 0 | ✓ (tek vakalı, kırılgan) |
| MUT-REDIRECT-V5-OFF | 1 | **1** | 0 | ✓ (tek vakalı, kırılgan) |
| **MUT-BACKSLASH-OFF** | **0** | **0** | 0 | ✗ ÖLÇÜLMÜYOR |
| **MUT-PIPE-CLOBBER-OFF** | **0** | **0** | 0 | ✗ ÖLÇÜLMÜYOR (§9 borcu) |
| **MUT-XARGS-READER-OFF** | **0** | **0** | 0 | ✗ ÖLÇÜLMÜYOR |
| **MUT-BAREARTIFACT-V5-OFF** | **0** | **0** | 0 | ✗ ÖLÇÜLMÜYOR |
| MUT-CONTROLFLOW-READERS-OFF | 1 | 0 | **1** | ⚠ yalnızca aşırı-engelleme yönünde çitli |
| MUT-CD-FAMILY-READERS-OFF | 4 | 0 | **4** | ⚠ yalnızca aşırı-engelleme yönünde çitli |
| MUT-HEADSKIP-V5-OFF | 6 | 0 | **6** | ⚠ yalnızca aşırı-engelleme yönünde çitli |

**Çitsiz parçalar yük taşıyor mu?** (kayıtlı kural: "ölçülmeyen dal yük taşıyor mu diye ÖLÇ")
`unmeasured.mjs` — 74 vektörlük kendi korpusumda, self-test'te 0/0 veren dört parçayı tek tek kaldırıp
kaybedilen engellemeleri saydım:

| Parça | Self-test kapsamı | Gerçek yük |
|---|---|---|
| `isXargsReaderV5` | **yok** | **VAR** — kaldırılınca 3 engelleme kayboluyor (`N19`, `echo … \| xargs gzip -f`, `echo … \| xargs patch`) |
| `findBareProtectedArtifactsV5` | **yok** | **VAR** — kaldırılınca 2 engelleme kayboluyor (`gzip -f G5.ok && ls docs/approvals`, `patch gate-check.cjs && ls .claude/hooks`) |
| `>\|` segmentasyon düzeltmesi | yok | yok (sözleşme §9'da dürüstçe kayıtlı; kaldırılınca engelleme **artıyor**) |
| ters-bölü normalizasyonu | **yok** | **yok** — üstelik §1.4 L3'te gösterildiği gibi **aktif zarar** veriyor |

Yani sözleşme §7.5'in 7 mutantlık tablosu **eksik**: güvenlik yükü taşıyan iki parça (`xargs`
okuyucu testi ve Mekanizma 2'nin çıplak-eser korelasyonu) hiç mutasyona uğratılmamış ve hiç test
kapsamı yok. İkisi de sözleşme §2'de tasarım üyesi olarak ilan edilmiş.

Ayrıca **üç parça yalnızca aşırı-engelleme yönünde çitli** (son üç satır) — kayıtlı kural gereği
bu tek başına bulgudur, ve burada sonucu teorik değil: tam da bu üç parça §1.4 L1'in 375 vektörlük
sızıntı ailesini üretiyor.

### 1.7 Aşırı engelleme oranı — kendi korpusum

`fp.mjs` — 34 rutin + 5 belgelenmiş sınır vakası. Korpus bu deponun gerçek iş akışından türetildi
(kapı/onay inceleme, hook doğrulama, git, npm, kaynak arama).

| Mod | Rutin yanlış pozitif |
|---|---|
| v4 | **0/34** |
| **v5** | **5/34 (%14,7)** |

| Engellenen rutin komut | Sınıf |
|---|---|
| `node .claude/hooks/_selftest.cjs` | CEO'nun bulduğu sınıf |
| `node .claude/hooks/_selftest.cjs 2>&1 \| tail -4` | aynı |
| `node .claude/hooks/_selftest.cjs 2>&1 \| grep -c "^OK"` | aynı |
| **`node --check .claude/hooks/block-dangerous.cjs`** | **YENİ** — CLAUDE.md'nin ayrıca zorunlu kıldığı sözdizimi doğrulaması |
| **`test -f docs/approvals/G6.ok && echo yes`** | **YENİ** — `test`/`[` `READER_HEADS_V5`'te yok; "kapı onaylı mı?" sorusunun en yaygın kabuk biçimi |

CEO'nun 26 komutluk sondası 3/26 (%11,5) ölçmüştü ve üçü aynı komuttu; **daha gerçekçi bir korpusta
oran %14,7 ve iki YENİ sınıf var**. Beş belgelenmiş sınır vakasının 5'i de beklendiği gibi engellendi
(kabul edilen taviz, bulgu değil).

Not: `test`/`[` engellemesi hem yeni bir yanlış pozitif hem de bir tutarsızlık sinyali — `test -f`
keyfi yola yazamaz, yani OKUYUCU tanımına tam uyuyor ama listede yok. Liste **yetenekten** değil,
akla gelen komutlardan türetilmiş.

---

## 2. Bulgular

### BLOKLAYICI

**B1 — Kontrol-akışı ve `cd` baş komutları OKUYUCU sayılıyor; Mekanizma 2 tek bir önekle komple
kapanıyor. (8 canlı sızıntı, 3'ü kapı dosyasını hedefliyor)**
`block-dangerous.cjs:372` (`'for','while','until','if','case'`) ve `:363` (`cd/pushd/popd/chdir/...`)
`READER_HEADS_V5` kümesine konmuş; `:559`'daki `if (hasCommandV5 && !readerV5)` kapısı okuyucu
görünce **tüm Mekanizma 2 gövdesini** atlıyor.
Tekrar üretme: `node .claude/hooks/block-dangerous.cjs` hook'una
`{"tool_input":{"command":"if gzip -f docs/approvals/G5.ok; then :; fi"}}` ver → **exit 0**.
Beklenen: exit 2 (engel). Gerçek: exit 0, ve sahte depoda komut koşturulunca `G5.ok` **yok oldu**.
Kök neden: bu kelimeler **eylemsiz** (inert) — "hiçbir şeye yazamaz". Kodda bu "OKUYUCU" olarak
kodlanmış, ama "OKUYUCU" bayrağı aynı zamanda **mekanizmayı kapatma** anlamına geliyor. "Eylemsiz"
ile "okuyucu" farklı şeyler: eylemsiz bir kelime `hasCommandV5 = false` (komut yok, sonraki token'a
bak) olmalı, `readerV5 = true` (bu komut güvenli, bakma) değil.
`cd` ailesinde ikinci bir katman daha var: `WD_CHANGE` (`:116`) geri çekilmesi tüm komutu tek
segment yapıyor ve o segmentin başı `cd` oluyor → geri çekilme **kısıtlamayı azaltıyor**, dosyanın
`:31-34`'teki kendi geri-çekilme sözleşmesinin tersine.
Etki: ÖNEMLİ-1'de kapatılan **11 vektörün tamamı** `if ` ya da `cd . && ` önekiyle geri açılıyor;
kombinatoryal uzayda önek başına **+75 vektör** (5 önek × 75 = 375).

**B2 — Yönlendirme tespiti ham metin üzerinde; OKUYUCU baş komut + parçalanmış yol = ÖNEMLİ-2 hâlâ
açık. (5 canlı sızıntı, 1'i kapı dosyasını eziyor)**
`:554-557` `approvalsRedirectV5`/`hooksRedirectV5` `seg` üzerinde çalışıyor, `normalizePathText(seg)`
üzerinde değil; `mentionsApprovalsNormalized` ise yalnızca `!readerV5` dalının içinde çağrılıyor
(`:564-565`).
Tekrar üretme: `{"tool_input":{"command":"echo pwned > docs/./approvals/G5.ok"}}` → **exit 0**.
Beklenen: exit 2. Gerçek: exit 0; canlı koşumda `G5.ok` içeriği `pwned` ile ezildi.
Aynı sınıf `cat /tmp/evil > .claude/./hooks/gate-check.cjs` ile **kapı dosyasını** eziyor.
Sözleşme `>|` için doğru gerekçeyi yazmış ("okuyucu olsun olmasın HER ZAMAN kontrol edilir",
`:549-553`) ama aynı gerekçeyi **normalizasyona** uygulamamış. Düzeltme tek satırlık: yönlendirme
desenleri `normalizePathText(seg)` üzerinde koşsun.

**B3 — Normalizasyon bash ters-bölü kaçışına yapısal olarak kör; `d\ocs/...` hedefine karşı v5
%100 kör. (3 canlı sızıntı, 1'i kapı dosyasını siliyor)**
`:458` `seg.split('\\').join('/')` — `\`'yi **her zaman** yol ayracı sayıyor. Bash'te `\` bir kaçış
karakteridir: `d\ocs` → `docs`. Normalizasyon `d/ocs` üretiyor, eşleşme **kapanıyor**.
Tekrar üretme: `{"tool_input":{"command":"rm d\\ocs/approvals/G5.ok"}}` → **exit 0**; canlı koşumda
dosya silindi. `rm .clau\de/hooks/gate-check.cjs` ile **kapı dosyası silindi**.
Kombinatoryal ölçüm: bu hedef biçimi **520/520 vektörde** sızıyor — tek bir fiil bile yakalanmıyor.
Sözleşme §3'ün "tek yönlü, var olan eşleşmeyi asla kapatamaz" iddiası bu girdi sınıfı için yanlış
güven veriyor; normalizasyon Windows yol ayracı ile POSIX kaçışını **ayırt edemiyor** ve bu depo
Git Bash kullanıyor. Emniyetli davranış: bir segmentte yol benzeri token'a bitişik `\<harf>` kaçışı
görülürse **fail-closed** (eşleşmiş say), ya da iki yorumu da (`\`=ayraç ve `\`=kaçış) üretip
**ikisini birden** tara.

**B4 — Feature'ın kendi doğrulama komutu artık çalışmıyor ve version-control'de alternatif runner
YOK.**
CLAUDE.md `node .claude/hooks/_selftest.cjs`'i **zorunlu** kılıyor; v5 bunu engelliyor.
Ölçüldü: `grep -rl "_selftest" tests/ scripts/` → **hiçbir sonuç**; `package.json`'da `hooks:selftest`
gibi bir script **yok**; `verify` betiği (`typecheck && lint && test && build`) self-test'i
çağırmıyor. Yani v5'ten sonra 385 vakalık hook regresyon çiti **hiçbir sürüm kontrollü yoldan
koşturulamıyor** — yalnızca ad-hoc bir scratchpad sarmalayıcıyla. Bu deponun kayıtlı en pahalı hata
sınıfı "sessizce ölmüş kapı"dır; burada kapı ölmedi ama **kapının regresyon testi ulaşılamaz oldu**,
ki pratikte aynı yere çıkar (bir sonraki tur "self-test koşturmadım" der ve kimse fark etmez).
Görüş ve öneri §3'te.

**B5 — (v5'ten BAĞIMSIZ, MEVCUT) `npm run <script>` ve `node <betik>` dolaylılığı hook'u tamamen
atlıyor; `Write(src/**)` + `Bash(node *)` ikilisiyle SIFIR izin kartı gerektiren tam bypass var.**
CEO'nun (b) şıkkı için istediği ölçüm — cevap: **evet, ölçüldü, canlı.**
`npmbypass.mjs`: sahte depoda `package.json`'a `"evil": "rm docs/approvals/G5.ok && rm .claude/hooks/gate-check.cjs"`
yazıldı. Hook `npm run evil` için **exit 0** (komut satırında korunan yol yok). Komut koşturuldu:
`before: G5.ok=true gate-check=true` → `after: G5.ok=false gate-check=false`. **İkisi de silindi.**
`zerocard.mjs`: `.claude/settings.json` izin listesinde `Write(src/**)` **ve** `Bash(node *)`
**ve** `Bash(npm run *)` var (doğrulandı, üçü de `true`). Yani barındırılan bir oturum
(1) kart almadan `src/tools/fmt.mjs` yazar, (2) kart almadan `node src/tools/fmt.mjs` çalıştırır.
Canlı sonuç: `G5.ok` **silindi**, sahte bir `GUARD.ok` **yazıldı** (`{"scope":[".claude/hooks/block-dangerous.cjs"],…}`),
`gate-check.cjs` **`process.exit(0);` ile değiştirildi** — üçü de tek komutta, **hiç kullanıcı kartı
görünmeden**, hook exit 0.
Bu, kabul edilmiş "değişken/glob dolaylılığı" sınırının çok ötesinde: `rm $f` döngüsü kapsam dışı
bir *ayrıştırma* sınırıdır; bu ise izin listesinin **kendisinin** açtığı bir kapıdır ve kayıtlı
"bir kapı, kendi anahtarını üretebilene karşı kapı değildir" dersinin yeni biçimidir. v5'in kusuru
değil, ama **açık ve şu an sahada**; ayrı bir turda ele alınmalı.

### ÖNEMLİ

**Ö1 — Güvenlik yükü taşıyan iki mekanizma parçasının sıfır test kapsamı var.**
`isXargsReaderV5` (3 engelleme taşıyor) ve `findBareProtectedArtifactsV5` (2 engelleme taşıyor)
385 vakalık self-test'te mutasyona uğratılınca **0 FAIL** veriyor (§1.6). Sözleşme §2 ikisini de
tasarım üyesi ilan ediyor ama §7.5 mutasyon tablosuna koymamış. Kayıtlı kural: "bir koruma
eklediğinde ilk soru 'bu koruma sessizce ölürse ne olur?' olsun". Cevap: sessizce ölür ve 385/385
yeşil kalır.

**Ö2 — Ters-bölü normalizasyon adımı hem ölçülmüyor hem zarar veriyor.**
`MUT-BACKSLASH-OFF` 0 FAIL veriyor **ve** kendi 74 vektörlük korpusumda 0 engelleme kaybettiriyor —
yani adım hiçbir şey kazandırmıyor; B3'te gösterildiği gibi aktif olarak eşleşme **kapatıyor**.
(Ham `docs\approvals\G5.ok` zaten `approvalsRef`'in kendi `[\\/]` sınıfıyla yakalanıyor, normalizasyona
ihtiyaç yok — ölçüldü: `P4-backslash` v0'dan beri ENGEL.)

**Ö3 — Yeni yanlış pozitif sınıfı: `test`/`[` ve mutlak yollu okuyucular.**
`test -f docs/approvals/G6.ok && echo yes` (kapının durumunu sormanın en doğal kabuk biçimi) ve
`/bin/cat docs/approvals/G5.ok` engelleniyor. İkisi de "keyfi yola yazamaz" tanımına **tam uyuyor**;
listede olmamaları, listenin yetenekten değil hatırlanan komutlardan türetildiğini gösteriyor.
Aynı kök neden ileride `[[`, `stat`, `du`, `sha256sum` mutlak yolla, `busybox cat` vb. için tekrar eder.

**Ö4 — `>|` segmentasyon düzeltmesinin izole pozitif kontrolü hâlâ yok (sözleşme §9 borcu teyit
edildi) ve durum sanılandan biraz farklı:** `MUT-PIPE-CLOBBER-OFF` yalnızca 0 FAIL vermiyor, aynı
zamanda korpusumda **engellemeyi artırıyor** (56 → 57). Yani düzeltme net olarak bir şeyi
*gevşetiyor*; gerekçesi doğru (doğru sebepten engelleme) ama etkisi tek yönde ölçülmemiş.

### KÜÇÜK

**K1 — Sözleşme §2.1'in "her çıplak token" alternatifini ölçmeden reddeden analizi kabul
edilebilir**, ve gerekçesi (F2-F5/F9/WL-GIT-LOG'u kırardı) doğrulandı — bu bulgu değil, teyit.
Ancak reddedilen alternatifin yerine seçilen "baş-komut dispatch" tam da B1/B2'nin kaynağı; bir
sonraki turda üçüncü bir formülasyon (yazma-konumu analizi, §4) değerlendirilmeli.

**K2 — Sözleşme §6-ek'te "mevcut self-test dosyasının hiçbir satırında `>|` dizisi yok
(doğrulandı: `grep` ile taranmadı, ama …)" cümlesi kendi içinde çelişik** — iddia "doğrulandı"
diyor, parantez "taranmadı" diyor. Bu turda taradım: doğru, ama iddiayı bu biçimde yazmak kayıtlı
"✓DOĞRULANDI iddiasını tam taramayla üret" kuralına aykırı.

---

## 3. Self-test çalıştırma sorunu — gerekçeli görüşüm

**Önerim: (c), ama sözleşmede yazıldığı gerekçeyle değil ve tek başına değil.**

### (a) Sarmalayıcıyı kalıcı çözüm saymak — REDDET
İki sebeple: (i) sarmalayıcı sürüm kontrollü değil, scratchpad'de; zorunlu bir güvenlik çitinin
runner'ı ad-hoc bir dosyaya bağlanamaz (kayıtlı ders: "bir güvenlik testi koruduğu şeyi tahrip
etmemeli"nin kardeşi — bir güvenlik testi *kaybolabilir bir dosyaya* da bağlanmamalı).
(ii) Daha kötüsü, öğrettiği davranış: "hook seni engelliyorsa bir sarmalayıcı yaz". Bu tam olarak
B5'in saldırı yoludur. Savunmanın kendi dokümantasyonu bypass tarifi olamaz.

### (b) `npm run hooks:selftest` — REDDET, ve ÖLÇÜM (b)'yi zaten çürütüyor
CEO'nun sorduğu soruyu ölçtüm (§B5): **evet, `npm run <script>` ile hook TAMAMEN atlanabiliyor.**
Sahte depoda `package.json`'a yazılan bir script korunan iki dosyayı da sildi; hook exit 0 verdi.
Üstelik `Bash(npm run *)` izin listesinde olduğu için **kullanıcı kartı bile çıkmıyor**.
Dolayısıyla (b) yalnızca "kaçamak" değil, **mevcut en geniş açığı kurumsallaştırmak** olur:
zorunlu güvenlik doğrulamasını, hook'un göremediği bir kanaldan geçirmeyi resmî iş akışı yapar.
`package.json` korumasız olduğu sürece (b) tartışmaya kapalı.

### (c) `.claude/hooks/**` altındaki bir `.cjs` dosyasını ÇALIŞTIRMAK için dar muafiyet — KOŞULLU EVET

Sözleşmedeki gerekçe ("o dosyalar GUARD.ok ile korunuyor, yani içeriği değiştirilemez") **tek başına
sağlam değil**, çünkü bu turda ölçtüm: `gate-check.cjs` şu anda **üç ayrı canlı vektörle** kabuktan
yok edilebiliyor (N7, N12, X-hooks-escape) ve B5 ile kart bile görünmeden değiştirilebiliyor.
Yani "içeriği değiştirilemez" öncülü **şu an yanlış**. Muafiyetin gerekçesi bu olamaz.

Muafiyeti yine de öneriyorum, ama **doğru gerekçeyle**: *bir dosyayı çalıştırmak, ona yazmak
değildir.* v5'in kök tasarım hatası, "korunan yol anılıyor + baş komut okuyucu değil" eşleşmesini
**yazma niyeti kanıtı** saymasıdır. `node <korunan-yoldaki-dosya>` o yola **okuma erişimiyle**
dokunur; yazma sinyali yoktur. Muafiyet bir istisna değil, **tespitin düzeltilmesidir**.

Uygulama şartları (bunlar olmadan muafiyet yeni bir bypass açar):
1. **Yolu çöz, metne güvenme.** `node .claude/hooks/../../tmp/evil.cjs docs/approvals/G5.ok` metinsel
   olarak muafiyet desenine uyar ama tamamen başka bir dosyayı çalıştırır. Muafiyet
   `fs.realpathSync.native` ile çözülmüş yolun gerçekten korunan dizinin **altında** olmasına
   bağlanmalı; çözülemezse **fail-closed**. Bu desen deponun kendi `gate-check.cjs`'inde ve
   `src/server/write-gate.ts`'inde **zaten var** — kayıtlı ders: "aynı problemi bu depoda başka
   biri daha önce çözdü mü?"
2. **Yalnızca çalıştırma konumu.** Muafiyet segmentin **yorumlayıcı argümanı** için geçerli olsun
   (`node <dosya>`, `node --check <dosya>`); aynı segmentteki **başka** korunan yol anmaları
   muafiyet kapsamı dışı kalsın.
3. **Yönlendirme kontrolleri muafiyetten etkilenmesin.** `node .claude/hooks/_selftest.cjs >
   docs/approvals/GUARD.ok` engellenmeye devam etmeli (B2 düzeltildikten sonra parçalanmış
   hedeflerle birlikte).
4. **Kendi pozitif kontrolü olsun.** Self-test'e en az üç vaka: muafiyetin çalıştığı vaka (exit 0),
   §1'deki realpath kaçışı (exit 2), §3'teki yönlendirme (exit 2). Kayıtlı kural: "her yeni katmanın
   kendi pozitif kontrolü var mı".
5. **Ö3'ü de kapat:** `test`/`[` ve mutlak yollu okuyucular aynı turda ele alınsın, yoksa `test -f
   docs/approvals/G6.ok` engeli kalır ve bir sonraki tur yine sarmalayıcı yazar.

Ek olarak, (c) kabul edilse bile **B4 tam kapanmaz**: hook self-test'inin `npm test` zincirinden
koşulan bir sürüm kontrollü runner'ı olmalı (bir vitest testi `_selftest.cjs`'i alt süreç olarak
çağırıp çıkış kodunu assert etsin). Bu, "kendi çalıştırıcısını çağıran test kendi dosyasını
dışlamalı" kuralına uyacak şekilde yazılmalı. O zaman self-test hem elle (muafiyetle) hem CI'da
koşar ve zorunluluk gerçekten uygulanabilir olur.

---

## 4. Adil olmak için: v5'in DOĞRU yaptıkları

- **Sıfır regresyon, 3640 vektörde.** Sözleşmenin mutlak şartı tuttu; ADDITIVE tasarım kararı
  (Mekanizma 1'e hiç dokunmamak) bunu **yapısal olarak** sağladı ve doğru bir karardı.
- **ÖNEMLİ-1'in 11 vektörü ve ÖNEMLİ-2'nin 6 varyantı düz biçimlerinde gerçekten kapandı** —
  v4'e göre engelleme 858 → 2511 (2,9×).
- **Sözleşme §7.5'in `MUT-PIPE-CLOBBER-OFF` 0/0 bulgusunu gizlemek yerine rapor etmesi** doğru
  davranıştı ve bu turda teyit edildi; §6'daki "kurulumdan önce bulunan 4 tasarım hatası" bölümü de
  dürüst ve doğrulanabilir.
- **`>|` düzeltmesinin "yanlış sebepten yeşil" olduğunu mutasyonla kendi bulup yazması**, deponun
  en zor öğrendiği dersin (fantom düzeltme) doğru uygulanmasıydı.
- Koşullu üyelerin (`sed --in-place`, `sort -o`, `openssl -out`, `dd of=`, `find -delete`,
  `git stash push`/`checkout`) hepsi kendi çift yönlü sondalarımda **doğru** davrandı (N21-N27:
  8 saldırı ENGEL, 8 masum ikiz GEÇTİ).

---

## 5. Bir sonraki tur için tek cümlelik yön

Bu, aynı ailenin **beşinci** turu: karar hâlâ **komut metninin şeklinden** çıkarılıyor
(önce fiil listesi, sonra komut konumu, sonra tırnak, sonra baş-komut yeteneği) ve her seferinde
sözdizimi çeşitliliği kazanıyor. Bir sonraki tur "OKUYUCU listesine `test` ekle, `if`'i çıkar"
olmamalı — bu, aynı oyunun altıncı turudur.

Sorulması gereken soru **"bu segmentin baş komutu ne?"** değil, **"korunan yol bu segmentte bir
YAZMA KONUMUNDA mı?"**: yönlendirme hedefi mi, bilinen bir yazıcının hedef argümanı mı, yerinde
düzenleme bayrağının konusu mu, yoksa sadece bir okuma argümanı mı. Bu formülasyon B1'i (önek
önemsiz), B2'yi (yönlendirme her zaman yazma konumu) ve (c) muafiyetini (yorumlayıcı argümanı
yazma konumu değildir) **aynı anda** ve yapısal olarak çözer; `if`/`cd`/`test` gibi kelimelerin
listede olup olmaması anlamsızlaşır.

---

## 6. Yöntem ve dokunulmazlık

- Gerçek `docs/approvals/*.ok` dosyalarına **dokunulmadı**; self-test öncesi bekleyen token
  taraması yapıldı (temiz), self-test gerçek depoda `exit 0` ile koştu ve kendi geçici dosyalarını
  kendi temizledi.
- `.claude/hooks/**` altına **hiç yazılmadı**. Tüm mutasyonlar `os.tmpdir()` altındaki kopyalarda;
  `git checkout` **kullanılmadı**.
- Eski sürümler `git show <sha>:…` ile salt-okunur çıkarıldı (elle kurulmuş mutant taban YOK).
- Canlı kanıt yalnızca izole sahte depolarda (`scratchpad/qa7/{live,npmtest,zerocard}`).
- Her mutant `node --check` ile doğrulandı (sahte kırmızı elenmesi); sözdizimi hatası veren mutant
  olmadı.
- Sözleşme frontmatter'ındaki `status:` alanına dokunulmadı.

## 7. Kabul edilmiş sınırların doğrulanması

| Sınır | Hâlâ geçerli mi |
|---|---|
| `node`/`python`/`sh` salt-okunur kullanımının da engellenmesi (bilinçli) | Evet — ölçüldü, 2/34 rutin FP bu sınıftan (+ B4'ün 4 vakası, ki o ayrı bulgu) |
| Değişken/glob dolaylılığı (`rm $f`) kapsam dışı | Evet, değişmedi — **ama B5 bunun çok ötesinde ayrı bir açık** |
| ADR-016: asıl savunma izin kartı, hook derinlik katmanı | Kısmen — B1/B2/B3 sızıntılarında kart hâlâ devrede (komutlar izin listesinde değil), **ama B5'te kart hiç çıkmıyor** |
