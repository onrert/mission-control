# hook-allowlist-contract.md — v4 OKUMA-KOMUTU BEYAZ LİSTESİ (2026-09-15)

Kapsam: yalnızca `.claude/hooks/block-dangerous.cjs`. `gate-check.cjs`, `_common.cjs`,
`.claude/settings.json` bu turda **değişmedi**. Bu belge `docs/qa/hook-borclari-contract.md` ve
`docs/blockers.md`'nin **yerine geçmez** — onlar paralel bir turda değerlendiriliyor, bu yüzden
onlara dokunulmadı; CEO bu bulguları sonra oraya yayacak.

Taban (v3, şu an kurulu, commit `219dc43`): `git show 219dc43:.claude/hooks/block-dangerous.cjs`
ile çıkarılıp bayt-bayt doğrulandı (`scratchpad/hook-allowlist/block-dangerous-v3-219dc43.cjs`).
Aday (v4): `scratchpad/hook-allowlist/block-dangerous-v4.cjs`.

## 0. Bu turun tek cümlelik amacı

İki borç aynı anda kapatılıyor çünkü zıt yönde çekiyorlar: **Etki 1** (daha az engelleme — v3'ün
tırnak-muafiyetini kaldırmasıyla geri gelen 6 yanlış pozitifi + 1 ek FP'yi geri kazanmak) ve
**Etki 2** (daha çok engelleme — `find`/`xargs`/`dd`/`install`/`ln`/`chmod`/`chown`/`truncate`
ailesinin `writeVerb` kara listesinde hiç yer almamasından doğan 8 mutlak sızıntıyı kapatmak).
Merkezi kriter: **v4, v0/v1/v3'ün hiçbirinin engellediği hiçbir şeyi geçirmesin.**

## 1. Mekanizma (adıyla)

Her segment için **baş komut** (`getHeadCommand`) çıkarılır: baştaki boşluk/gruplama
(`(`, `{`, `!`), `VAR=değer` atamaları ve önek kelimeleri (`sudo`, `env`, `time`, `exec`,
`command`, `nice`, `nohup`, `builtin`) atlanarak ilk gerçek token bulunur.

**OKUYUCU tanımı:** bir komut, KEYFİ argümanlarla çağrıldığında KEYFİ bir yola yazamıyor/silemiyorsa
okuyucudur. Şüphe varsa okuyucu DEĞİLDİR (fail-closed) — `getHeadCommand` çözemezse (`''` döner)
ya da baş komut listede yoksa, okuyucu sayılmaz.

**OKUYUCU BEYAZ LİSTESİ** (`READER_HEADS`): `cat, head, tail, less, more, wc, grep, egrep, fgrep,
rg, findstr, awk, nl, od, xxd, strings, stat, file, cmp, diff, ls, dir, tree, basename, dirname,
realpath, readlink, echo, printf, type, which, where, Get-Content, Select-String, Get-ChildItem,
Get-Item`. Her üye "keyfi argümanla keyfi yola yazamaz" testini geçer.

**Koşullu üyeler:**
- `sed` → yalnızca `-i` YOKSA okuyucu (`-i` varsa zaten `writeVerb`'in `\bsed\b[^\n]*-i\b` deseni
  onu yakalıyor; okuyucu sayılmaması hiçbir şeyi değiştirmez).
- `git` → yalnızca alt komut `log/diff/show/status/blame/grep/cat-file/ls-files/rev-parse` ise.
  Diğer alt komutlar (`add`, `commit`, `rm`, `push`, ...) okuyucu DEĞİL ama zaten kendi
  mekanizmalarıyla (gitForce, `writeVerb`'in `\brm\b` eşleşmesi, `pushCmd`) yönetiliyorlar.

**Kesinlikle okuyucu DEĞİL** (her biri gerekçeli): `find` (`-delete`/`-exec` var — ama salt-okunu
kullanımı YAYGIN, bu yüzden READER_HEADS'e değil kendi dar `findDestructive` desenine alındı),
`xargs` (keyfi komut çalıştırır — kendi `xargsDestructive` + pipe-korelasyonuna alındı),
`sh/bash/zsh/cmd/powershell/pwsh/eval/source/.` (alt kabuk — NEST ailesini v3'ün ham taramasıyla
kapalı tutmak için bilerek dışarıda), `node/python/perl/ruby/npx` (keyfi kod — `inlineEval`),
`dd/install/truncate/ln/chmod/chown` (istisnasız mutasyon — `writeVerb`'e eklendi, aşağıya bkz).

### Etki 1 — MUAFİYET (Effect 1, daha az engelleme)

Baş komut okuyucuysa, o segmentin **yalnızca tırnaklanmış argümanlarındaki** `writeVerb`/
`inlineEval` eşleşmeleri sayılmaz (`maskQuoted` — tek/çift tırnak içindeki karakterleri boşlukla
değiştirir, tırnak karakterlerinin kendisi ve tırnak dışı metin olduğu gibi kalır). **Yönlendirme
(`>`/`>>`) kontrolleri BUNDAN HİÇBİR ZAMAN ETKİLENMEZ** — her zaman ham metin üzerinde çalışır,
çünkü bir okuyucu bile `> docs/approvals/G5.ok` ile hedefe yazabilir (`echo` okuyucu listesinde
ama `echo x > docs/approvals/GUARD.ok` yine engellenir — approvalsRedirect ham metni tarar).

### Etki 2 — GENİŞLETİLMİŞ YAZMA SİNYALLERİ (daha çok engelleme)

Brief'in orijinal tasarımı ("baş komut beyaz listede DEĞİLSE VE segment bir yol anıyorsa,
`writeVerb` kara listesinden bağımsız olarak engelle") **ÖLÇÜLDÜ VE REDDEDİLDİ** — §2'de
gerekçelendirildiği gibi bu, `find docs/approvals -name "*.ok"` (ceo-fresh.mjs U2), `git add`
(mevcut Y4-READ-3), `sh -c 'ls docs/approvals'` (NEST-NEG-1) gibi ONLARCA mevcut/prob vakayı YENİ
yanlış pozitife çevirirdi. Bunun yerine 6 vektör için (find/xargs DIŞINDAKİ hepsi) `writeVerb`'e
**hedefli** yeni üyeler eklendi — bunlar find'ın aksine "salt-okunur kullanım biçimi" taşımaz,
istisnasız mutasyon fiilleridir:

```
writeVerb += install | ln | chmod | chown | truncate(?!\s+table\b)
ddWrite   = /\bdd\b[^\n]*\bof=/i           (yalnızca "of=" cikti bayragi varsa)
```

`find` ve `xargs` kendi dar mekanizmalarına alındı (ayrı §2.1/§2.2).

## 2. "Neden brief'in orijinal Etki 2 tasarımı reddedildi?" (ölçülmüş gerekçe)

Denendi: `head bilinmiyor (reader whitelist'te yok) VE segment mention taşıyor ⇒ engelle`. Bu,
mevcut/prob test setinde şu YENİ yanlış pozitifleri açardı (hepsi ölçüldü):

| Vektör | Neden kırılırdı |
|---|---|
| `find docs/approvals -name "*.ok"` (ceo-fresh U2) | `find` reader değil, mention var → bloke olurdu, ama bu SALT-OKUNUR bir listeleme |
| `git add docs/approvals/G5.ok` (Y4-READ-3) | `git add` reader-alt-komut değil, mention var → bloke olurdu |
| `sh -c 'ls docs/approvals'` (NEST-NEG-1) | `sh` bilinçli olarak reader değil (NEST ailesini kapalı tutmak için), mention var → bloke olurdu |

**Çözüm:** "bilinmeyen baş komut" kovası yalnızca gerçekten OPAK/nadir komutlara (find'ın
destructive-flag'li hâli, xargs, dd, install, ln, chmod, chown, truncate) daraltıldı; `git`,
`sh/bash/eval/powershell/cmd`, `npm/npx/node/python` gibi **zaten başka bir mekanizmayla
yönetilen** baş komutlar `KNOWN_NONREADER_HEADS` kümesine alınıp Etki 2'nin kapsamı dışına
çıkarıldı. Bu üç vektörün üçü de v4'te doğru şekilde GEÇER (bkz §5 WL-* satırları).

### 2.1 `find` — dar, flag-bağlı desen

```
findDestructive = /\bfind\b[^\n]*(-delete\b|-exec\b[^\n]*\b(rm|mv|cp|tee|unlink|del|erase|chmod|dd|truncate|ln)\b)/i
```

Yalnızca `-delete` ya da `-exec ... <yıkıcı-fiil>` varsa sinyal sayılır — salt-okunur `find X -name
Y` asla tetiklemez. Ek olarak: bu desen eşleştiğinde **bare** bir korunan-eser adı (`*.ok`/hook
dosya adı) taşıyorsa, cross-segment mention şartı ARANMADAN engellenir (`find . -name G5.ok -exec
rm {} \;` gibi, komutun hiçbir yerinde "docs/approvals" dizin adı geçmeyen ama bare "G5.ok" taşıyan
vektörleri de kapatmak için — find'ın kendi flag-şartı zaten yeterince dar/nadir bir sinyal).

### 2.2 `xargs` — pipe-öncesi segment korelasyonu

`xargs`'ın kendi argümanı KORUNAN bir yol taşımaz (stdin'den gelir): `echo docs/approvals/G5.ok |
xargs rm` içinde "rm" segmenti sadece `xargs rm` metnini taşır, mention BAŞKA (önceki, pipe ile
bağlı) segmenttedir. `checkXargsPipeLeak(segments, idx)`: baş komut `xargs` ve segment
`xargsDestructive` (`\bxargs\b[^\n]*\b(rm|mv|cp|tee|unlink|del|erase|chmod|chown|dd|truncate|ln|sed)\b`)
ile eşleşiyorsa, **dizide hemen önceki** segmentin (hangi ayraçla ayrıldığından bağımsız) mention
taşıyıp taşımadığına bakılır. Bu, B-6/Y2'nin "iki ayrı segmentteki sinyalin GENEL OLARAK
birleşmesi" hatasını tekrarlamaz: yalnızca `xargs` (nadir, stdin-argüman-enjeksiyonu semantiği
kendine özgü tek komut) ve yalnızca **hemen komşu** segmente bakıyor — bare-artifact
korelasyonunun "herhangi bir segment" genişliğinden çok daha dar.

**Kabul edilen sınır:** `cmd1 && xargs rm` gibi `&&`/`;` ile bağlı (pipe DEĞİL) bir öncül de bu
korelasyonu tetikler — semantik olarak `&&`/`;` stdin aktarmaz, xargs boş/terminal stdin okur, bu
yüzden gerçek bir saldırı senaryosu değildir. Ama bu, tek yönde (aşırı engelleme) bir sınırdır,
güvenlik kaybı değildir ve ölçülen vektör kümesinde hiçbir yanlış pozitif üretmedi (bkz §5).

## 3. `&` kararı — tek ayraç olarak eklendi (ölçülmüş)

Brief'in 6. FP vektörü (`sleep 0 & grep -n "rm" docs/approvals/README.md`) Etki 1'i tetiklemek
için `grep -n ...` kısmının KENDİ segmenti olması gerektiriyordu — aksi hâlde baş komut "sleep"
kalır (reader değil) ve muafiyet hiç uygulanmaz. **Karar: tek `&` (arka plana alma) yeni bir
segment ayracı oldu**, iki istisnayla:

- `N>&M` (dosya tanıtıcı çoğaltma, ör. `2>&1`) — `&` hemen `>`'den SONRA geliyorsa ayraç sayılmaz.
- `&>`/`&>>` (bash "hem stdout hem stderr" kısayolu) — `&` hemen `>`'den ÖNCE geliyorsa ayraç
  sayılmaz.

**Ölçüm:** kurulu 312 vakalık self-test'te `2>&1` DIŞINDA hiçbir vaka tek `&` içermiyor
(`scratchpad/hook-allowlist/scan-ampersand.mjs` ile tarandı). `ls -la docs/approvals/ 2>&1` testi
değişmeden geçmeye devam ediyor (yeni istisna sayesinde). **Zorunlu regresyon kontrolü:** `sleep 0
& rm docs/approvals/G5.ok` (N1) hâlâ ENGEL — segment 2'nin baş komutu artık "rm" (reader değil),
mention+writeVerb aynı segmentte → mevcut mekanizma değişmeden blokluyor. Doğrulandı (bkz §4/§6).

## 4. Dört modlu diferansiyel ölçüm

`scratchpad/hook-allowlist/four-mode-diff-v4.mjs` — v0(`1fbb1eb`)/v1(`a41ce32`)/v3(`219dc43`,
bayt-bayt doğrulandı)/v4. Vektör kümesi: önceki turların `probe-diff.mjs` (64) + `ceo-nested.mjs`
(12+4) + bu turun 8 ABS vektörü + ikizleri + `ceo-fresh.mjs`'nin T/U ailesi (14+12) + WL
(beyaz liste fail-closed/koşullu üyelik) vakaları.

```
Saldırı vektörü toplam: 76, v4'de ENGEL: 76, FAIL: 0
v0'a karşı regresyon (v0 ENGEL, v4 GEÇER): 0
v1'e karşı regresyon (v1 ENGEL, v4 GEÇER): 0
v3'e karşı regresyon (v3 ENGEL, v4 GEÇER): 0

Masum vektör toplam: 60, beklenen davranışa uyan: 60, FAIL: 0
Beklenmeyen (yeni) yanlış pozitif: 0

TOPLAM FAIL: 0
```

Not: `WL-SED-READ` (`sed 's/rm/delete/' docs/approvals/README.md`) v0/v3'te ENGEL, v4'te GEÇER —
bu brief'in isim verdiği 6 vektörden biri DEĞİL ama AYNI mekanizmanın (sed koşullu okuyucu
üyeliği) doğal, kasıtlı sonucu; `-i` olmadığı için gerçekten dosyaya yazamaz, güvenlik kaybı yok
(ayrıntı §7).

## 5. Canlı kanıt (izole sahte depo, gerçek dosya, `scratchpad/hook-allowlist/live-proof.mjs`)

Her 8 vektör için gerçek `docs/approvals/G5.ok` / `.claude/hooks/gate-check.cjs` kuruldu, hook
çağrıldı; hook GEÇER (exit 0) derse komut GERÇEKTEN çalıştırıldı (git-bash alt süreç) ve dosya
durumu ölçüldü:

| Vektör | v3 hook | v3 komut çalıştı mı | v3 dosya bozuldu mu | v4 hook | v4 komut çalıştı mı |
|---|---|---|---|---|---|
| ABS-1 xargs | GEÇER | evet | **evet** (G5.ok silindi) | ENGEL | hayır |
| ABS-2 find -delete | GEÇER | evet | **evet** | ENGEL | hayır |
| ABS-3 find -exec rm | GEÇER | evet | **evet** | ENGEL | hayır |
| ABS-4 truncate | GEÇER | evet | **evet** (0 bayt) | ENGEL | hayır |
| ABS-5 install | GEÇER | evet | **evet** (0 bayt) | ENGEL | hayır |
| ABS-6 dd of= (hook) | GEÇER | evet | **evet** (NUL bayt) | ENGEL | hayır |
| ABS-7 ln -sf (hook) | GEÇER | evet | **evet** (içerik "evil content"'e döndü — bu ortamda gerçek NTFS symlink yetkisi yok, MSYS sessizce kaynağı kopyalıyor; saldırının GERÇEK etkisi aynı: hedef dosyanın içeriği saldırganın verdiğine dönüşüyor) | ENGEL | hayır |
| ABS-8 chmod 000 (hook) | GEÇER | evet | **evet** (mod değişti) | ENGEL | hayır |

`Sorunlu satır: 0` — v3'te 8/8 gerçekten çalışıp dosyayı bozdu, v4'te 8/8 hiç çalışmadı, dosyalar
değişmedi.

## 6. Self-test (`scratchpad/hook-allowlist/selftest-v4.cjs`, taban: kurulu 312 vaka)

Taban dosyadan **hiçbir vaka çıkarılmadı**. Değişenler:
- 6 vaka (F2/F3/F4/F5/F9/N1-TWIN) beklenen 2→0 çevrildi ("v4 GERİ KAZANILDI" notuyla).
- 1 yeni sınır vakası: `grep rm docs/approvals/README.md` (tırnaksız "rm") → hâlâ ENGEL (Etki 1
  yalnızca tırnaklı argümanları kapsar).
- 8 ABS vektörü + 8+ masum ikizi + fail-closed (`foo ...`) + koşullu üyelik (sed/git) + find/xargs
  salt-okunur + `sh` known-nonreader vakaları eklendi.

```
343 OK, 0 FAIL
TUM TESTLER GECTI
```

## 7. Yön ayrımlı mutasyon testi (`scratchpad/hook-allowlist/mutation-test-v4.mjs`)

Dört mekanizma ayrı ayrı öldürüldü (`scratchpad/hook-allowlist/mutants/`), 65 vektörlük ortak
küme üzerinde iki yönde de sayıldı:

| Mekanizma | Aşırı-engelleme kırmızı | Engelleme-kaybı kırmızı |
|---|---|---|
| A — Reader whitelist (Etki 1) devre dışı | 6 | 0 |
| B — Etki 2 genişletmeleri (find/xargs/dd/install/ln/chmod/chown/truncate) devre dışı | 0 | 9 |
| C — M1 (`cd`/`pushd`/... retreat) devre dışı | 0 | 1 |
| D — Bare-artifact korelasyonu devre dışı | 0 | 5 |

**A ve B'nin karşı yöndeki sıfırı bir ölçüm boşluğu DEĞİL, yapısal bir sonuçtur:** Etki 1 saf bir
GEVŞETME mekanizmasıdır (yalnızca tırnaklı metni maskeler, asla yeni bir engel EKLEMEZ) — bu
yüzden "engelleme-kaybı" yönünde asla kırmızı ÜRETEMEZ, sıfır beklenen sonuçtur. Etki 2 saf bir
SIKILAŞTIRMA mekanizmasıdır (yalnızca yeni `writeVerb`/`ddWrite`/`findDestructive` üyeleri ekler)
— bu yüzden "aşırı-engelleme" yönünde asla kırmızı ÜRETEMEZ. C (M1) ve D (bare-artifact) ise HER
İKİ yönde de kırmızı üretebilecek mekanizmalar olduğu için sıfır olmayan bir "engelleme-kaybı"
sütunu göstermeleri gerçek bir doğrulamadır (ikisi de gösteriyor: M1-UNIQUE ve R9/R11/R12/A5/
ABS-3).

Adayın kendisi (mutasyonsuz) bu 65 vektörün tamamında beklenen sonucu verdi (script başında
ayrıca doğrulandı, `candMismatch.length === 0`).

## 8. Kabul edilen sınırlar (dürüstçe)

1. **`xargs` yalnızca hemen-önceki segmente bakar** (§2.2) — `cmd1 ; cmd2 && xargs rm` gibi uzun
   zincirlerde ARADA başka bir segment varsa (mention iki segment önce), korelasyon KAÇIRABİLİR.
   Ölçülen vektör kümesinde böyle bir vektör yok; bu genişletilmiş korelasyon B-6/Y2'nin
   tekrarlanan "geniş çapraz-segment birleşmesi" hatasına düşme riski taşıdığı için BİLİNÇLİ
   olarak dar tutuldu.
2. **`WL-SED-READ` ve benzeri isimlendirilmemiş FP düzeltmeleri** (§4 not) — brief'in 6 vektörü
   dışında, aynı mekanizmanın doğal sonucu olarak başka salt-okunur komutlar da (whitelist'teki
   herhangi biri + tırnaklı destructive-görünümlü argüman) artık geçebilir. Hepsi "gerçekten
   yazamaz mı?" testinden geçiyor (whitelist üyeliği zaten bu şartı taşıyor).
3. **`grep rm docs/approvals/README.md` (tırnaksız) hâlâ engelli** — Etki 1 yalnızca TIRNAKLI
   argümanları kapsar; bu bilinçli, dar bir muafiyet, "her grep argümanı güvenlidir" değil.
4. **A1/A10 parçalı yol ailesi** (`cd docs && cd approvals && rm G5.ok`) — bu turun kapsamı
   dışında, `docs/qa/hook-borclari-contract.md`'de zaten kayıtlı, dokunulmadı.
5. **ADR-016** — asıl savunma kullanıcının izin kartı; bu hook bir derinlik katmanıdır.

## 9. Teslim

- `.claude/hooks/block-dangerous.cjs` kurulumu **CEO tarafından** yapılacak (alt agent
  `.claude/hooks/**` altına yazamıyor — harness kategorik olarak reddediyor). Kaynak:
  `scratchpad/hook-allowlist/block-dangerous-v4.cjs` (syntax-checked, NUL bayt yok, bayt-bayt
  teslime hazır).
- `.claude/hooks/_selftest.cjs` güncellemesi de CEO tarafından yapılacak — kaynak:
  `scratchpad/hook-allowlist/selftest-v4.cjs` (yalnızca `dangerCases` bloğu değişti; `gateCases`
  ve GUARD.ok JSON testleri BİREBİR, dokunulmadı).
- Bu iki dosya kurulduktan sonra `node .claude/hooks/_selftest.cjs` gerçek depoda çalıştırılıp
  343/343 doğrulanmalı.
