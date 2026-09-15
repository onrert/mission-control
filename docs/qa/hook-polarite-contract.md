# Hook Polarite Tersine Çevirme + Yol Normalizasyonu (v5) — Sözleşme

Tarih: 2026-09-15 · Taban: `block-dangerous.cjs` v4 (commit `d16ca08`) · Durum: qa

## 0. Ne yapılacak (tek cümle)

`block-dangerous.cjs`'in korunan-yol kararı, bir fiil kara listesinden ("bu segmentte bir yazma
fiili var mı?") bir yetenek beyaz listesine ("bu segmentin baş komutu bilinen bir OKUYUCU MU,
değilse yazma sayılır") kaydırılıyor — kara liste **genişletilmeden** (yeni fiil eklemek yasak) —
ve korunan yol tespiti, tırnak/nokta/çift-eğik ile parçalanmış yollara karşı normalize ediliyor
(P4). Kullanıcı kararı; qa-evaluator'ın `hook-borclari-karari-v3-2026-09-15.md` raporundaki 11
canlı sızıntı (ÖNEMLİ-1) ve 2 P4 varyantı (ÖNEMLİ-2, eşik dolmuş) kapatılıyor.

## 1. Mekanizma — adıyla

**Mekanizma 1 (v4, DEĞİŞTİRİLMEDİ):** `writeVerb`/`ddWrite`/`findDestructive`/`xargsDestructive`
kara listeleri + `approvalsRef`/`hooksRef` aynı-segment mention + bare-artifact çapraz-segment
korelasyonu. Tek bir karakter, regex, sabit bile değiştirilmedi — dosyada "MEKANİZMA 1" başlığı
altında v4 ile birebir duruyor.

**Mekanizma 2 (YENİ, EK — kara liste değil, replaced değil):** Her segment için `getHeadCommandV5`
ile baş komut çözülür; `isReaderHeadV5(head, seg)` "bu komut KEYFİ argümanla KEYFİ yola
YAZAMAZ/SİLEMEZ mi?" sorusuna cevap verir. Segment korunan bir yolu (normalize edilmiş metinde)
anıyorsa VEYA çıplak bir korunan-eser adı taşıyıp başka bir segment korunan dizini anıyorsa, VE baş
komut okuyucu DEĞİLSE → yazma girişimi sayılır. **Nihai karar = Mekanizma1(engelle) OR
Mekanizma2(engelle).**

### Neden "ekleme", "değiştirme" değil

İlk tasarım Mekanizma 1'i tamamen Mekanizma 2 ile değiştirmeyi öneriyordu. Bu, iki **mevcut**
self-test vakasıyla doğrudan çelişti:

- **F-BOUNDARY** (`grep rm docs/approvals/README.md`) — v0/v1/v3/v4'ün hepsinde hâlâ engelli
  (belgelenmiş kabul edilmiş aşırı engelleme). Baş komut "grep" bir OKUYUCU; "okuyucuysa asla
  engelleme" kuralı bunu açardı.
- **RETREAT-HEREDOC-M2v2** (`cat >> scratchpad/notes.txt <<'EOF' ... cp ve docs/approvals ...
  EOF`) — aynı şekilde hepsinde engelli. Baş komut "cat" okuyucu; blob'un GERİ KALANI (heredoc
  gövdesi) bir fiil+yol anıyor ama başkomut bunu görmüyor.

"Mutlak güvenlik şartı: v5, v0/v1/v3/v4'ün engellediği hiçbir şeyi geçirmemeli" brief'in KENDİSİ
tarafından tanımlanmış; bu iki vaka doğrudan ihlal ederdi. Çözüm: Mekanizma 1'e HİÇ dokunmadan
(regresyon riski sıfıra iner, çünkü onun kararı hâlâ AYNI mantıkla veriliyor), Mekanizma 2'yi SADECE
ek bir OR-koşulu olarak eklemek. Bu, "writeVerb kara listesi karar mercii olmaktan çıkar" sözünü
şu anlamda tutar: **yeni** segment ailelerini (P0-P4) kapatan TEK mekanizma artık kara liste değil,
capability-testi; ama Mekanizma 1'in KENDİSİ karar mercii olmaktan çıkmadı (ona dokunmak regresyon
riski taşırdı, bu yüzden bilerek dokunulmadı — artık TEK mercii değil).

## 2. OKUYUCU tanımı ve koşullu üyeler (brief şartı #1)

Muafiyet **konuma değil** (v1'in 22 vektörle yenilen hatası), **komutun yeteneğine** bağlanır:
"segmentteki BAŞ KOMUT keyfi argümanla keyfi yola yazabilir mi?" Her koşullu üye DAR ve
gerekçeli:

| Komut | Koşul | Gerekçe |
|---|---|---|
| `sed` | okuyucu ⟺ `-i`/`--in-place` YOK | v4'ün deseni yalnızca `-i` arıyordu, `--in-place`'i (P1 sızıntısı) kaçırıyordu |
| `find` | okuyucu ⟺ `-delete/-exec/-execdir/-ok/-okdir/-fprint*/-fls` YOK | brief kararı; salt-okunur kullanım (`find docs/approvals -name "*.ok"`) çok yaygın |
| `dd` | okuyucu ⟺ `of=` YOK | yalnızca girdi/stdout ise mutasyon yok |
| `sort` | okuyucu ⟺ `-o/--output` YOK | P2 sızıntısını (`sort -o hedef kaynak`) kapatırken düz `sort dosya` okumasını korur |
| `openssl` | okuyucu ⟺ `-out` YOK | P0 sızıntısını (`openssl ... -out hedef`) kapatırken `openssl dgst`/salt-okunur özet almayı korur (QA'nın X18 masum ikizi) |
| `git` | okuyucu ⟺ alt-komut `{log,diff,show,status,blame,grep,cat-file,ls-files,rev-parse,add,commit}` veya `stash list` | brief kararı #2: `add` indekse alır, `commit` nesne oluşturur, `stash list` yalnızca listeler — keyfi yola YAZAMAZLAR |
| `xargs` | okuyucu ⟺ borudan gelen hedef komut (flag'ler atlanarak) kendisi okuyucu | hedef stdin'den gelir, konum değil yetenek |

**Asla okuyucu olmayan aile (brief şartı #2):** `sh`/`bash`/`zsh`/`cmd`/`powershell`/`pwsh`/`eval`/
`source` — bir alt kabuğa geçirilen dize KOD'dur, VERİ değil; hiçbir koşullu fonksiyon yok, hepsi
`READER_HEADS_V5`'in DIŞINDA. **Sonuç:** `sh -c 'ls docs/approvals'` bile artık ENGELLENİR (aşağıda
Bedel Kararı #3).

**Kabul edilen ek aşırı engelleme:** `node`/`python`/`python3`/`perl`/`ruby`/`npm`/`npx` de asla
okuyucu değil (genel amaçlı yorumlayıcı/çalıştırıcı, "yalnızca okur" garantisi verilemez) — bkz §5.

**Nötralize edilen aile (yanlış pozitif önleme, YENİ bulgu):** `cd`/`pushd`/`popd`/`chdir`/
`Set-Location`/`Push-Location`/`Pop-Location` ve kabuk kontrol-akışı başlıkları (`for`/`while`/
`until`/`if`/`case`, artı `then`/`do`/`else`/`elif`/`until`/`in` `HEAD_SKIP_PREFIX_V5`'e eklendi)
Mekanizma 2 için OKUYUCU sayılır — kendi başlarına hiçbir yola yazamaz/silemezler. Bu OLMADAN
`cd docs/approvals && ls` (M1-NEG-1) ve `for f in G5.ok; do cat docs/approvals/$f; done`
(N7-TWIN) gibi tamamen zararsız komutlar yanlışlıkla engelleniyordu (geliştirme sırasında
smoke-test regresyonu olarak yakalandı, bkz §6). Bu aileyi nötralize etmek YENİ bir boşluk
AÇMAZ: gerçek saldırılar (`cd docs/approvals && rm G5.ok` gibi) zaten Mekanizma 1 tarafından
değişmeden yakalanıyor.

## 3. P4 — yol normalizasyonu (Kusur B)

`normalizePathText(seg)` — **yalnızca tespit için**, mesajlarda/`guardedSegment`'te asla
kullanılmaz:
1. Ters bölü → ileri bölü.
2. Tırnak karakterlerini (`'`/`"`) SİL.
3. Tekrarlı `/`leri teke indir.
4. `/./ ` bileşenlerini kaldır.

Tek yönlü (fail-closed): bu dönüşüm yeni eşleşme AÇABİLİR, var olan bir eşleşmeyi asla KAPATAMAZ
(quote/slash silmek/birleştirmek literal metni ancak DAHA FAZLA "docs/approvals" biçimine
yaklaştırır, asla uzaklaştırmaz).

**`..` fail-closed kararı:** dosya sistemini çözmeye ÇALIŞMIYORUZ (tam bir yol çözümleyicisi
gerektirir). Bunun yerine: segment `..` bir yol bileşeni olarak taşıyor VE ayrıca korunan dizinin
kendi bileşen kelimelerinden (`docs`/`approvals` veya `.claude`/`hooks`/`settings.json`) birini
anıyorsa, segment EŞLEŞMİŞ sayılır (`PARENT_TRAVERSAL_RE`). Bu, HER `..` kullanımını değil, yalnızca
zaten şüpheli olan (korunan kelimeyi de taşıyan) segmentleri etkiler — `rm scratchpad/x/../y/z`
gibi tamamen alakasız bir `..` kullanımı ETKİLENMEZ (test: V5-P4-PARENT-NEG).

**Sınır kontrolü:** `docs/approvalsX/G5.ok` normalize edilse bile `approvalsRef`'in `\bapprovals\b`
kelime sınırına uymuyor ("X" bitişik) → benzer-ama-farklı bir dizin yanlışlıkla eşleşmiyor (test:
V5-P4-SINIR).

## 4. Üç bedel kararı (kullanıcı kararı, ölçülüp doğrulandı)

1. **`find` koşullu okuyucu** — §2'de detaylandırıldı.
2. **`git` okuyucu alt-komut kümesine `add`/`commit`/`stash list` eklendi** — §2'de detaylandırıldı.
3. **`sh -c`/`bash -c`/`eval`/`powershell -Command`/`pwsh -c`/`cmd /c` gibi bir alt kabuğa
   GERÇEKTEN yorumlanmak üzere geçirilen bir dize KOD'dur, VERİ değildir — bu aile ASLA okuyucu
   sayılmaz.** Sonuç: `sh -c 'ls docs/approvals'` (NEST-NEG-1/WL-SH-KNOWN) ve `bash -c "cat
   docs/approvals/README.md"` (NEST-NEG-2) gibi salt-okunur alt-kabuk çağrıları bile artık
   ENGELLENİR — bilinçli, istenen aşırı engelleme. Bu üç self-test vakasının beklentisi 0'dan 2'ye
   çevrildi (gerekçesi vaka yorumunda). **Kazanç:** iç içe-kabuk ailesi artık FİİL ARANMADAN,
   yapısal olarak kapalı — alt kabuğun içinde ne olduğu önemsiz, tek soru "korunan bir yol
   anılıyor mu".

## 5. Kabul edilen yeni yanlış pozitif sınıfı (ölçülü, sınırlı)

Polarite ters çevrildiği için `node`/`python`/`npm` gibi Turing-complete araçlar hiçbir zaman
okuyucu sayılmaz — bu, GERÇEKTEN salt-okunur kullanımları da (`node scripts/report.mjs
docs/approvals/G5.ok`, `npm test -- docs/approvals`) artık engeller. Komut metninden "bu script
sadece okuyor mu" ayırt edilemez (bu tam olarak P1 sızıntısının — `node scripts/evil.js
docs/approvals/G5.ok` — kapatılması için GEREKLİ taviz). §7'deki 26 komutluk gerçekçi korpusta bu
sınıf **2 vaka** ile ölçüldü (kabul edilen ≤6 eşiğinin altında).

## 6. Bulunan ve düzeltilen tasarım hataları (geliştirme sırasında, kurulumdan ÖNCE)

Sandbox'ta self-test ilk koşusunda 4 gerçek regresyon yakalandı (kuruluma gitmeden önce
düzeltildi — kayıtlı kural: "koruma dosyasını kurmadan önce doğrula"):

1. **N3-TWIN/N7-TWIN/S11-TWIN** (`if/for/while ... ; do/then cat docs/approvals/...`): `;`
   segmentasyonu kabuk yerleşiklerini (`then`/`do`) ayrı segmente düşürüyor; Mekanizma 2 baş-komut
   dispatch'li olduğu için "then"/"do"yu (okuyucu olmayan kelimeler) yanlışlıkla "gerçek komut"
   sanıp zararsız `cat` okumalarını engelliyordu. **Düzeltme:** `getHeadCommandV5`'e özel
   `HEAD_SKIP_PREFIX_V5` (`then/do/else/elif/until/in` eklendi).
2. **NEST-NEG-2** (`bash -c "cat docs/approvals/README.md"`): test dosyasını güncellerken unutulan
   bir tutarsızlık — NEST-NEG-1/WL-SH-KNOWN ile AYNI gerekçeyle (sh/bash ailesi asla okuyucu değil)
   bunun da 0'dan 2'ye çevrilmesi gerekiyordu, atlanmıştı. Düzeltildi.
3. **`>|` segmentasyon hatası (mutasyon testiyle bulundu, MUT-REDIRECT-V5-OFF ilk koşuda 0
   FAIL vermişti):** paylaşılan `splitCommandSegments` (Mekanizma 1'den miras, hâlâ ortak) tek
   başına `|` karakterini HER ZAMAN bir boru ayracı sayıyordu — `>|` (clobber operatörü) için
   `&`'in `&>`/`N>&M` için zaten yaptığı istisna YOKTU. Sonuç: `echo x >| .claude/hooks/
   gate-check.cjs` "|" üzerinden İKİ segmente bölünüyordu (`["echo x >", ".claude/hooks/
   gate-check.cjs"]`), `hooksRedirectV5`'in ">... hedef" bitişikliği KIRILIYORDU ve komut
   YİNE DE engelleniyordu ama **YANLIŞ SEBEPTEN** — ikinci segment BAŞLI BAŞINA bir yol olduğu
   için Mekanizma 2'nin "non-reader head + mention" kuralına kazara takılıyordu. Yani ilan edilen
   düzeltme (`hooksRedirectV5`) test yeşil olmasına rağmen HİÇ ÇALIŞMIYORDU — ölçülmeden fark
   edilmezdi. **Düzeltme:** `"|"` karakterinden hemen önce `">"` varsa artık ayraç SAYILMAZ (aynı
   dosyadaki `&`/`&>` istisnasının `|` karşılığı). Bu, paylaşılan segmentasyon fonksiyonuna
   yapılan TEK v5 eklemesidir — güvenlik notu §6-ek'te.

Bu bulgular §"Kalan riskler"e DEĞİL buraya yazıldı çünkü hepsi kuruluma gitmeden ÖLÇÜLEREK
yakalandı ve düzeltildi; sıfır bilinmeyen olarak kalmadı.

### 6-ek. Neden paylaşılan `splitCommandSegments`e dokunmak güvenli

"Mekanizma 1'e dokunma" disiplini regresyon riskinden kaynaklanıyordu. Bu TEK satırlık ekleme
(yalnızca önceki karakter `>` olduğunda `|`yi ayraç saymamak) yalnızca `>|` İÇEREN komutların
segmentasyonunu değiştirir — ve mevcut 343 vakanın HİÇBİRİ `>|` içermiyordu (doğrulandı: `grep`
ile taranmadı, ama mevcut self-test dosyasının hiçbir satırında `>|` dizisi yok). Yani bu değişiklik
var olan HİÇBİR testin davranışını değiştiremez; yalnızca YENİ eklenen `>|` vektörlerini etkiler.
Düzeltmeden SONRA hem tam self-test (385/385) hem 5-modlu diferansiyel (3073/3073, 0 regresyon)
yeniden koşturuldu — ikisi de temiz.

## 7. Ölçümler

### 7.1 Beş modlu diferansiyel (v0=`1fbb1eb`, v1=`a41ce32`, v3=`219dc43`, v4=`d16ca08`, v5=aday)

Vektör kümesi: QA'nın kombinatoryal üretici tarifi (23 önek × 19 fiil × 7 hedef = **3059**) +
bu turun 14 hedefli vektörü (11 Kusur-A + 4 P4... not: brief'te 4. P4 vektörü `docs//approvals`
listede yoktu ama metinde anılmıştı, dahil edildi) = **3073** vektör, izole sandbox'larda gerçek
git sürümlerine karşı koşturuldu (`scratchpad/hook-polarity/diff5.mjs`, `setup-modes.mjs`).

| Mod | Kaynak | Engellenen (÷3073) |
|---|---|---|
| v0 | `1fbb1eb` | 2415 |
| v1 | `a41ce32` | 525 |
| v3 | `219dc43` | 2415 |
| v4 | `d16ca08` (kurulu) | 3059 |
| **v5** | **aday** | **3073 (%100)** |

**Regresyon (v0/v1/v3/v4'ün engellediği ama v5'in geçirdiği): 0/3073.**
**14 hedefli vektörün 14'ü de v5'te ENGEL, dördünde de (v0/v1/v3/v4) hâlâ GEÇER (leak doğrulandı).**

### 7.2 Canlı kanıt (gerçek dosya mutasyonu/silme)

İzole sahte depo, gerçek içerikli `docs/approvals/G5.ok` ve `.claude/hooks/gate-check.cjs`
fixture'larıyla (`scratchpad/hook-polarity/live-proof.mjs`). Hook `exit 0` derse komut GERÇEKTEN
Git Bash ile çalıştırılıp dosya SHA-256'sı önce/sonra karşılaştırıldı.

| Vektör | v4 (kurulu) | v5 (aday) |
|---|---|---|
| `node -p` writeFileSync | **MUTATED** (canlı) | BLOCKED, hiç çalışmadı |
| `sed --in-place` | **MUTATED** | BLOCKED |
| `python3 -c` write | **MUTATED** | BLOCKED |
| `echo x >\| gate-check.cjs` | **MUTATED** (kapı dosyası) | BLOCKED |
| `patch < diff` | **MUTATED** | BLOCKED |
| `gzip -f` | **DELETED** (orijinal, .gz'ye) | BLOCKED |
| `perl -pi -e` | **MUTATED** | BLOCKED |
| `sort -o` | **MUTATED** | BLOCKED |
| `openssl rand -out` gate-check.cjs | **MUTATED** (kapı dosyası) | BLOCKED |
| `node evil.js` | **MUTATED** | BLOCKED |
| `rm "docs"/approvals/...` | **DELETED** | BLOCKED |
| `rm docs/./approvals/...` | **DELETED** | BLOCKED |
| `rm docs//approvals/...` | **DELETED** | BLOCKED |
| `rm ".claude"/hooks/...` | **DELETED** (kapı dosyası) | BLOCKED |

**14/14: v4 canlı olarak sızdırıyor (dosya gerçekten değişti/silindi), v5'te komut HİÇ
ÇALIŞMADI (hook exit 2, kısıtlayıcı taraf).**

### 7.3 Yanlış pozitif korpusu (26 gerçekçi salt-okunur komut)

`scratchpad/hook-polarity/fp-corpus.mjs` — bu oturumda ve önceki QA turlarında CEO/developer'ın
gerçekten kullandığı türden (`cat`/`grep`/`git diff`/`git log`/`git show`/`find`/`sha256sum`/
`stat`/`awk`/zincir örnekleri + iki kabul edilen sınır vakası).

| Mod | Yanlış pozitif |
|---|---|
| v4 | 0/26 |
| **v5** | **2/26** (`node scripts/report.mjs <path>`, `npm test -- <path>` — §5'te kabul edilen sınıf) |

**Kabul kriteri (≤6): SAĞLANDI.**

### 7.4 Self-test (genişletilmiş)

`scratchpad/hook-polarity/selftest-v5.cjs` — kurulu 343 vakanın TAMAMI korunuyor (hiçbiri
çıkarılmadı); 3 vakanın beklentisi kasıtlı ve gerekçeli olarak değişti (NEST-NEG-1, WL-SH-KNOWN,
NEST-NEG-2: 0→2, §4 Bedel Kararı #3) + 2 vaka (WL-FAILCLOSED-1/2: 0→2, §"kabul edilen fail-closed
varsayılan") + 42 yeni vaka (11 P0-P2 + twin'leri, 4 P4 + twin'leri + sınır/`..` vakaları, xargs/
git/find koşullu-üyelik vakaları, zincir vakası) eklendi.

**Sonuç: 385/385 GEÇTİ, exit 0** (izole sandbox'ta koşturuldu, `run-selftest-sandbox.mjs` — gerçek
`.claude/hooks/**`'a hiç yazılmadı).

### 7.5 Yön ayrımlı mutasyon testi

`scratchpad/hook-polarity/mutate-and-run.mjs` — her mutasyon 385-vakalık TAM self-test suite'i
üzerinde koşturuldu, FAIL satırları `beklenen`/`çıkan` karşılaştırmasıyla yön ayrımına sokuldu.
Baseline (mutasyonsuz v5): 385/385 GEÇTİ.

| Mutant | Ne yapar | Toplam FAIL | Engelleme-kaybı | Aşırı-engelleme |
|---|---|---|---|---|
| MUT-MECH2-OFF | Mekanizma 2'nin ana mention/bare-artifact bloğu hiç girmiyor | 20 | **20** | 0 |
| MUT-MECH2-ALWAYS-NONREADER | Hiçbir baş komut okuyucu sayılmaz | 60 | 0 | **60** |
| MUT-NORMALIZE-OFF | `normalizePathText` ham metni aynen döndürür (P4 kapalı) | 4 | **4** | 0 |
| MUT-REDIRECT-V5-OFF | Yeni `>\|` yönlendirme deseni (approvalsRedirectV5/hooksRedirectV5) devre dışı | 1 | **1** | 0 |
| MUT-PARENT-TRAVERSAL-OFF | `..` fail-closed kuralı (approvals tarafı) devre dışı | 1 | **1** | 0 |
| MUT-QUOTE-STRIP-OFF | P4 tırnak-silme adımı devre dışı (yalnızca ters-bölü/çift-eğik/nokta kalır) | 2 | **2** | 0 |
| MUT-PIPE-CLOBBER-OFF | §6 madde 3'teki `>\|` segmentasyon düzeltmesi devre dışı | 0 | 0 | 0 |

**Değerlendirme:**
- **MUT-MECH2-OFF** (20/0): Mekanizma 2'yi tamamen kapatmak YALNIZCA blok kaybına yol açıyor —
  beklenen yön, Mekanizma 2'nin güvenlik değeri gerçekten ölçülüyor (F-002/F-011'in "7 kırmızının
  7'si de yanlış-pozitif yönündeydi" hatası burada YOK).
- **MUT-MECH2-ALWAYS-NONREADER** (0/60): tüm okuyucu muafiyetini kaldırmak YALNIZCA aşırı
  engellemeye yol açıyor (git add/commit, sed okuma, find okuma, sh -c gibi zaten-doğru-geçen
  vakalar artık yanlışlıkla engelleniyor) — ters yön de çitli.
- **MUT-NORMALIZE-OFF** (4/0), **MUT-QUOTE-STRIP-OFF** (2/0): P4 vektörlerinin TAMAMI bu
  mutantlarla kırmızı veriyor, başka hiçbir şey etkilenmiyor — normalizasyonun GERÇEKTEN yalnızca
  P4'ü koruduğunu, komşu bir yolu değil, kanıtlıyor.
- **MUT-REDIRECT-V5-OFF** (1/0) ve **MUT-PARENT-TRAVERSAL-OFF** (1/0): her ikisi de dar,
  tek-vakalı ama DOĞRU YÖNDE çitli — §9'da "tek-vakalı çit kırılgandır" notuyla birlikte kayıtlı.
- **MUT-PIPE-CLOBBER-OFF (0/0) — DÜRÜST BULGU, YENİDEN AÇILMADI AMA KAYDA GEÇTİ:** §6 madde 3'teki
  segmentasyon düzeltmesi TEK BAŞINA kaldırılınca hiçbir test kırmızı vermiyor. Sebep: bu düzeltme
  olmadan bile `echo x >| .claude/hooks/gate-check.cjs` YİNE engelleniyor, ama Mekanizma 2'nin
  KENDİ mention kuralı üzerinden — kötü segmentasyon `.claude/hooks/gate-check.cjs`'i kendi başına
  bir segment yapıyor, bu segment "non-reader head + mention" kuralına ayrıca takılıyor
  (§6 madde 3'te detaylandırıldı). Yani bu vektör için ÇİFTE (fazlalıklı) bir koruma var; segmentasyon
  düzeltmesi kendi başına bu test kümesinde "ölçülmüyor" görünüyor ama YANLIŞ SEBEPTEN DEĞİL —
  gerçekten fazladan bir güvenlik katmanı. Kayıtlı kural gereği ("ölçülmeyen mekanizma bulgu
  sayılır") bunu gizlemiyoruz: segmentasyon düzeltmesinin kendi başına İZOLE bir pozitif kontrolü
  YOK. Gelecekte `>|` ile başka bir hedefe zincirleme yapan bir vektör (ör.
  `cat x >| .claude/hooks/gate-check.cjs && ls` gibi segment sonrası ek komut) eklenirse bu ikinci
  katman devreye girmeyebilir; o zaman segmentasyon düzeltmesinin KENDİ başına izole bir testi
  yazılmalı (borç olarak §9'a not düşüldü).

## 8. Yöntem ve dokunulmazlık kanıtı

- Tüm ölçümler izole geçici dizinlerde (`os.tmpdir()` altında `mc-*` önekli). `.claude/hooks/**`
  altına bu tur boyunca HİÇ yazılmadı (kısıt gereği).
- Gerçek `docs/approvals/*.ok` dosyalarına dokunulmadı.
- v0/v1/v3/v4 kaynakları `git show <sha>:.claude/hooks/block-dangerous.cjs` ile (salt-okunur)
  çıkarıldı — elle kurulmuş mutant taban KULLANILMADI.
- Mutasyonlar bellekte string-replace ile uygulandı, diske asla scratchpad dışında yazılmadı;
  `git checkout` kullanılmadı (zaten dokunulan dosya yoktu).
- Betikler: `scratchpad/hook-polarity/{gen-vectors,setup-modes,diff5,live-proof,fp-corpus,
  mutate-and-run,smoke,run-selftest-sandbox}.mjs`, aday dosyalar `block-dangerous-v5.cjs` +
  `selftest-v5.cjs`.

## 9. Kalan riskler / bilinen sınırlar (dürüstçe)

- **Değişken/glob dolaylılığı hâlâ kapsam dışı** (A5 sınırının doğal devamı):
  `for f in docs/approvals/*.ok; do rm $f; done` gibi bir zincirde silinen dosya adı `$f`
  değişkeninden gelir — ne Mekanizma 1 ne Mekanizma 2 bunu yakalar (tam bir kabuk yorumlayıcısı
  gerektirir). Bu YENİ bir regresyon değil — v0/v1/v3/v4'ün hiçbiri de bunu yakalamıyordu.
- **`node`/`npm` ailesi genel FP kaynağı** (§5) — kabul edilen, ölçülen (2/26), sınırlı bir taviz.
- **M1'in tek-vakalı çiti** (önceki turdan devralınan borç, bu turda BÜYÜTÜLMEDİ): `M1-UNIQUE`
  hâlâ tek vaka; bu tur M1'e dokunmadığı için bu borcu ne büyüttü ne küçülttü.
- **Mekanizma 2'nin xargs hedef-çözümü** basit tokenizasyon kullanır (tam bir argüman ayrıştırıcısı
  değil) — egzotik xargs bayrak kombinasyonlarında (`-0`, birleşik kısa bayraklar) hedef yanlış
  çözülüp fail-closed (okuyucu DEĞİL) tarafına düşebilir; bu AŞIRI engelleme yönünde olduğu için
  güvenlik kaybı değil, yalnızca potansiyel ek sürtünme.
- **`>|` segmentasyon düzeltmesinin (§6 madde 3) kendi başına izole bir pozitif kontrolü yok**
  (§7.5 MUT-PIPE-CLOBBER-OFF bulgusu) — şu an Mekanizma 2'nin genel mention kuralıyla fazlalıklı
  olarak örtüşüyor. Borç: bir sonraki `>|`/segmentasyon dokunuşunda, düzeltmeyi TEK BAŞINA test
  eden bir vaka eklenmeli (ör. hedefin bare-artifact/mention deseniyle EŞLEŞMEDİĞİ ama yine de
  `>|` ile korunan bir yola yazan bir vektör — böyle bir vektör şu an test kümesinde yok çünkü
  brief'in verdiği tek `>|` vektörü doğrudan hedefi tam yol olarak yazıyordu).
