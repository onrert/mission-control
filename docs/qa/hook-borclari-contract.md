---
status: done
---

<!-- KARAR: GEÇTİ (qa-evaluator, 2026-09-15, v3 / commit 219dc43).
     Kanıt: docs/qa/hook-borclari-karari-v3-2026-09-15.md — self-test 312/312 · üç modlu
     diferansiyel 3 143 vektörde v0/v1'e karşı 0 regresyon · v1'in 22 bypass'ı 24/24 engel ·
     iç içe kabuk 12/12 engel · yön ayrımlı mutasyonda her mekanizmanın engelleme-kaybı sütunu
     sıfırdan farklı. Bloklayıcı bulgu yok.
     İKİ ÖNEMLİ BULGU AÇIK BIRAKILDI ve docs/blockers.md'ye TAŞINDI — bu sözleşmenin kapsamı
     değiller (hiçbiri bu turun regresyonu değil, üçü de v0'da da açıktı):
       P0-P3  kapalı fiil listesinin sızıntı sınıfı 8 değil 25+ (üçü gate-check.cjs'i canlı yok etti)
       P4     yol parçalama ailesi (A1/A10) — EŞİK DOLDU, yeniden açıldı -->


# hook-borçları-contract.md — B-2, B-3, B-5, B-6, Y4 kapanışı (+ 2026-09-14 B1/B2 regresyon düzeltmesi)

Kaynak brief: CEO turu 2026-09-11 (G6 öncesi borç kapatma). Kapsam: `.claude/hooks/gate-check.cjs`,
`.claude/hooks/block-dangerous.cjs`, `.claude/hooks/_selftest.cjs`. B-4 (test kararsızlığı) bu
turun KAPSAMI DIŞINDA — ayrı, zaten "ölçülmüş ve yönetilen risk" olarak kapanmış (docs/blockers.md
2026-09-11 B-4 KAPANIŞ girdisi).

**GÜNCELLEME (2026-09-14, ayrı tur).** `docs/qa/borc-turlari-kararlari-2026-09-14.md` bu
sözleşmeye **KALDI** verdi: 2026-09-11 turunun segmentasyon düzeltmesi (§2 aşağıda) B1 (12/12
gerçek saldırı vektörü kaçırıldı) ve B2 (5/10 salt-okunur komut yanlış pozitif aldı) olarak
BLOKLAYICI bulundu. Bu güncelleme o iki bulguyu kapatır — bkz **§10** (yeni bölüm, M1/M2/
bare-artifact kapanışı, R1-R12/F1-F10 diferansiyel matrisi). §2.3/§2.4/§2.5'teki ORİJİNAL metin
**silinmedi** (tarihî kayıt) ama şimdi YANLIŞLANMIŞ olduğu ölçümle **düzeltme notu** ile
işaretlendi — güncel doğru davranış için §10'a bakın.

**GÜNCELLEME (bu tur, dar düzeltme).** CEO'nun diferansiyel sondası (`probe-extra.mjs` A5:
`X=docs/approvals; rm $X/G5.ok`) yukarıdaki segmentasyon düzeltmesinde TEK bir regresyon buldu —
değişken/göreli-dizin önekli bare hedefler bare-artifact korelasyonundan muaf tutuluyordu. Kapatıldı,
bkz **§9** (A5 KAPANIŞI) ve **§9-ek** (A1/A10 — kabul edilmiş, önceden var olan sınır, bu turun
regresyonu DEĞİL). Bu paragraftaki diğer tüm içerik (§1-§8, §8-ek) DEĞİŞMEDİ.

**GÜNCELLEME (2026-09-15, ayrı düzeltme turu).** `docs/qa/hook-borclari-karari-2026-09-15.md`
yukarıdaki §11'in (M2v2) kendisine **KALDI** verdi: CEO'nun bağımsız iç içe-kabuk sondası, §11.7'de
"kabul edilmiş sınır, henüz canlı ölçülmedi, hipotez" diye kaydedilen `sh -c`/`bash -c`/
`powershell -Command` ailesinin gerçekte ÖLÇÜLEN bir REGRESYON olduğunu kanıtladı (12/12 vektörün
11'i `prev`e göre geçiyordu). §11'in metni **silinmedi** (tarihî kayıt) ama §11.3/§11.6/§11.7
şimdi YANLIŞLANMIŞ olduğu ölçümle işaretlenmelidir — güncel doğru davranış için **§12**'ye bakın
(tırnak muafiyeti TAMAMEN kaldırıldı, iki adımlı düzeltmenin 1. adımı).

**§0 kısıtı gereği** (`.claude/hooks/**`'a otonom yazma bu ortamda kategorik olarak engellenir,
dört kez doğrulandı) gerçek hook dosyalarına HİÇ dokunulmadı. Tüm geliştirme ve doğrulama izole
bir sahte depoda (`scratchpad/verify-json-repo/`, gerçek hook'ların birebir kopyası + izole
`docs/approvals/G2.ok` fixture'ı) ve ayrı mutasyon sandbox'larında yapıldı. Nihai dosyalar
scratchpad'e bırakılıyor; kurulumu CEO yapacak.

## 1. Beş maddenin diskte doğrulanmış durumu (kod okuma ile, kayda değil)

Hepsi **AÇIK** — kayıtla (docs/blockers.md) tam uyumlu, "kayıt yanlış" bulunan madde yok.

| Madde | Doğrulama yöntemi | Sonuç |
|---|---|---|
| B-2 (6 çitsiz nokta) | `gate-check.cjs` okundu; P2/P6/P8/P9/P16/P17 kod satırları QA'nın tur-4 raporundaki satırlarla birebir eşleşti, hiçbirinde ek yorum/test yoktu | AÇIK |
| B-3 ("tek kullanımlık" yanlış) | `grep -n "tek kullan" .claude/hooks/*.cjs docs/approvals/README.md` — `gate-check.cjs:6,476` ve `README.md:1(başlık),4,9` GUARD.ok'u "tek kullanımlık" olarak anıyordu | AÇIK |
| B-5 (obje derinlik dalı çitsiz) | `_selftest.cjs`'te `nestedObjectJson`/`D-SCANNER-DEPTH-OBJECT-*` hiç yoktu (yalnızca `nestedArrayJson` vardı) | AÇIK |
| B-6 (çapraz-segment yanlış pozitif) | `block-dangerous.cjs` tüm kontrolleri (`isApprovalsWrite`, `danger`, `gitForce`) `cmd` (tüm komut metni) üzerinde çalıştırıyordu, segment kavramı yoktu | AÇIK |
| Y4 (kabuktan hook yazma Katman B'siz) | `block-dangerous.cjs`'te `docs/approvals` DIŞINDA hiçbir "guarded path" ailesi yoktu; `.claude/hooks`/`settings.json` metni hiç aranmıyordu | AÇIK |

## 2. Segmentasyon mekanizması (B-6/Y2 + Y4 ortak çözüm)

### 2.1 Kök neden
`danger`/`gitForce`/`approvalsWriteVerb` gibi desenler `[^\n]*` (yalnızca satır sonuna kadar)
kullanıyor; iki-sinyalli `touchesApprovals && writeVerb` deseni tüm komut metnini TEK BLOB
sayıyordu. Kabuk ayracı (`&&`, `;`, `|`) hiçbir zaman bir SINIR sayılmıyordu — bu yüzden farklı,
ilgisiz alt komutlardaki sinyaller (bir segmentteki yazma fiili + başka segmentteki korunan yol
adı, ya da bir segmentteki `git` + başka segmentteki `--force`) yanlışlıkla birleşiyordu.

### 2.2 Algoritma (adım adım) — `splitCommandSegments(cmd)`
1. **Retreat kontrolleri ÖNCE** (sırayla, herhangi biri tetiklenirse `null` döner):
   a. `cmd.indexOf('<<') !== -1` → heredoc/herestring şüphesi.
   b. `cmd.indexOf('$(') !== -1 || cmd.indexOf('`') !== -1` → komut ikamesi (alt kabuk).
   c. `/\\\r?\n/.test(cmd)` → fiziksel satır devamı.
2. Tek geçişli karakter taraması, `inSingle`/`inDouble` durum bayraklarıyla:
   - Tek/çift tırnak içindeyken hiçbir ayıraç kontrolü YAPILMAZ (karakterler doğrudan mevcut
     segmente eklenir); çift tırnak içinde `\` bir sonraki karakteri kaçışlar.
   - Tırnak DIŞINDA `\` bir sonraki karakteri literal sayar (kaçışlı ayıraç asla bölünmez).
   - Tırnak DIŞINDA `&&`, `||`, tek `|`, `;`, `\n` birer segment sınırıdır.
3. Tarama bitince `inSingle || inDouble` hâlâ true ise (sonlandırılmamış tırnak) → `null`.
4. Aksi hâlde segmentler `trim()` edilip boşlar atılır; sonuç dizisi döner.

### 2.3 Geri çekilme (retreat) → bugünkü davranış
`splitCommandSegments` `null` dönerse çağıran `[cmd]` (TEK segment = TÜM metin) kullanır — bu,
AYNEN segmentasyon-öncesi blob taraması. **Belirsizlik daima bu kısıtlayıcı davranışa çözülür**,
hiçbir zaman daha az kısıtlayıcıya değil. Kabul edilmiş sonuç: heredoc gövdesinde ya da `$(...)`
içinde geçen bir "docs/approvals" mention + fiil kelimesi hâlâ (kasıtlı olarak) engellenebilir —
bu AŞIRI ENGELLEME'dir, ATLATMA değildir, ve mevcut (segmentasyon-öncesi) davranışın AYNISIDIR.

**DÜZELTME (2026-09-14, §10'a bakın).** Yukarıdaki "Belirsizlik daima bu kısıtlayıcı davranışa
çözülür, hiçbir zaman daha az kısıtlayıcıya değil" cümlesi 2026-09-14 diferansiyel ölçümüyle
(docs/qa/borc-turlari-kararlari-2026-09-14.md §1.2) **YANLIŞLANDI**: `cd docs/approvals && rm
G5.ok` gibi çalışma-dizini-değiştiren zincirlerde retreat mekanizması hiç TETİKLENMİYORDU (bu
liste yalnızca heredoc/`$(...)`/satır devamı/sonlandırılmamış tırnağı sayıyordu, `cd` yoktu) —
segment-yerel akıl yürütme geçersiz bir varsayım altında (görece yol hedefinin `cd` sonrası
NEREYE gittiğini bilmeden) çalışmaya devam etti ve 12/12 gerçek saldırıyı kaçırdı. §10'daki M1
bu listeye BEŞİNCİ bir retreat koşulu (çalışma dizini değiştiren komutlar) ekleyerek düzeltir.

### 2.4 Güvenlik şartı (nasıl korunuyor)
- Her segment AYNI kural kümesiyle taranır — hiçbir segment muaf değildir.
- İki-sinyalli kontroller (`isApprovalsWrite`, `isHooksWrite`) sinyallerin İKİSİNİ DE AYNI
  segmentten talep eder — bu, çapraz-segment birleşmesini yapısal olarak imkânsız kılar.
- Tek-sinyalli kontroller (`isDestructive`, `isRelease`, `isPush`) segmentler üzerinde OR'lanır:
  herhangi bir segment eşleşirse komutun TAMAMI engellenir (segmentasyon bunları ASLA gevşetmez,
  yalnızca `[^\n]*`'in artık BAŞKA bir segmente sızmamasını sağlar — bkz `gitForce` SEG-5 testi).
- Bir saldırganın gerçek fiil+hedefi AYNI segmente koyması hâlinde (asıl tehdit) segmentasyon
  hiçbir şey DEĞİŞTİRMEZ — o segment yine tam metniyle taranır (bkz SEG-*-TWIN testleri).
- Tırnak takibi TAM bir kabuk grameri DEĞİLDİR (pipe/redirect/glob semantiğini anlamaya
  çalışmaz) — yalnızca "şu an tırnak içinde miyim" sorusuna cevap vererek ayıraç aramasını
  güvenli hâle getirir. Daha karmaşık her şey (2.1'deki liste) retreat tetikler.

### 2.5 Y4 — Katman B kapsam genişletmesi
`block-dangerous.cjs`'in Katman B'si (kabuktan yazma/silme engeli) artık İKİ AYRI aile için ayrı
ayrı çalışır: `docs/approvals/**` (DEĞİŞMEDİ) ve `.claude/hooks/**` + `.claude/settings.json`
(YENİ). Her iki ailede de aynı mekanizma: `(hedefe DOĞRUDAN yönlendirme) OR (mention AYNI
segmentte + yazma fiili/satır-içi betik)`. Okuma (`cat`/`ls`/`git add`/`git commit`/`git diff`)
hiçbir zaman engellenmez çünkü bu komutlar `writeVerb`/`inlineEval` listesinde yoktur.

**DÜZELTME (2026-09-14, §10'a bakın).** "Okuma hiçbir zaman engellenmez" cümlesi EKSİKTİ:
engelleme komutun fiiline değil, segmentin TÜM METNİNE bakıyordu — bir okuma komutunun ARGÜMANI
(ör. `grep -n "unlink" dosya`) bir fiil KELİMESİ taşıdığında komut yanlışlıkla engelleniyordu
(ölçüm: 10 salt-okunur sondadan 5'i yanlış pozitif aldı, docs/qa/borc-turlari-kararlari-2026-09-14.md
§1.3). Doğru cümle: "okuma, fiil kelimesi KOMUT KONUMUNDA (segment/metin başı ya da bir ayıraçtan
hemen sonra) geçmediği sürece hiçbir zaman engellenmez" — §10'daki M2 bunu düzeltir.

**Kabul edilen, PAYLAŞILAN sınır (Y4 için yeni değil):** `rm dosya` (bayraksız, `-rf` olmadan)
ne `danger` ne `writeVerb` listesinde var — bu ÖNCEDEN docs/approvals için de böyleydi (kara
liste, derinlik katmanı, mutlak değil). Y4 aynı listeyi yeniden kullandığı için AYNI boşluğu
`.claude/hooks/**` için de miras alıyor. Kapsam dışı bırakıldı (brief'in beş maddesinde yok,
scope creep olur) — asıl savunma zaten `canUseTool` izin kartıdır.

## 3. B-2 — altı noktanın sınıflandırması

| Nokta | Kod konumu | Sınıf | Gerekçe / yapılan |
|---|---|---|---|
| **P6** (`scope` dizi/boş kontrolü) | `parseGuardDoc`, `!Array.isArray(doc.scope)...` | **YÜK TAŞIYOR** | Kaldırılırsa `for (const item of doc.scope)` `undefined` üzerinde `TypeError` fırlatır → YAKALANMAZ → exit 1 → Claude Code yalnızca exit 2'yi engelleme sayar → **FAIL-OPEN**. Çit eklendi: `D-NO-SCOPE-FIELD-REAL` (yalnızca izin verilen kök alanlarla, "scope" GERÇEKTEN yok). Mutasyon kanıtı §5. |
| P2 (ham NUL reddi) | `parseGuardDoc`, NUL kontrolü | Fazlalık | `JSON.parse` zaten kaçışsız kontrol karakteri/NUL içeren dizeyi reddeder. Kod yorumu eklendi. |
| P8 (ters bölü açık reddi) | `normalizeScopeEntry`, `indexOf('\\')` | Fazlalık | Regex (`/^\.claude\/hooks\/[\w-]+\.cjs$/i`) zaten `\` içeren hiçbir dizeyle eşleşmez (sabit `/` bekler). Kod yorumu eklendi. |
| P9 (`created_at` dize olmalı) | `parseGuardDoc`, `typeof !== 'string'` | Kısmen fazlalık | Çoğu durumda P10 (`Date.parse` → NaN) yakalar; tek ayırt edici kenar durum (`created_at: 2026` sayısal) P9 kaldırılsa bile P14 (süre dolmuş) üzerinden yine fail-closed kalır — sızıntı yok. Test eklendi: `D-CREATED-AT-NUMERIC-YEAR` (P9'un bugün doğru çalıştığını doğrular). |
| P16 (`isGuarded` harf duyarsızlığı) | `readInput` callback, `/i` bayrağı | Fazlalık | `rel` zaten `resolveCanonicalRel()`'in (realpath tabanlı) ürünü — NTFS zaten kanonik harflere çevirir. Kod yorumu eklendi. |
| P17 (GUARD.ok varlık kontrolü) | `readInput` callback, `!exists(GUARD_OK)` | Fazlalık | Kaldırılsa `parseGuardDoc`'un kendi `readFileSync` hatası `{ok:false, error:'dosya okunamadi:...'}` ile aynı fail-closed dala düşer — yalnızca mesaj daha az spesifik olurdu. Kod yorumu eklendi. |

Her "fazlalık" nokta için kod yorumu **B-2 KAPANIŞI** etiketiyle işaretlendi; gelecekte biri
"çitsiz" diye tekrar açmasın diye gerekçe kalıcı olarak koda yazıldı (yalnızca QA raporunda değil).

## 4. B-3 — "tek kullanımlık" ifadesi düzeltmesi

**Değişmeyen (doğru kalan):** `block-dangerous.cjs`'teki DANGER.ok/PUSH.ok referansları — bunlar
GERÇEKTEN tek kullanımlıktır (her yazmada `consume()` ile silinir), ifade DOKUNULMADI.

**Düzeltilen (GUARD.ok referansları):**
- `gate-check.cjs:6` (dosya başı yorum) — "tek kullanımlık bir onay" → "AYNI DESENDE ama TÜKETİM
  MODELİ FARKLI bir onay" + yeni bir açıklayıcı paragraf (B-3 KAPANIŞI etiketli).
- `gate-check.cjs:~483` (`block()` mesajı, kullanıcıya gösterilen metin) — "(tek kullanımlık,
  JSON, zaman pencereli)" → "(JSON, zaman pencereli — TEK KULLANIMLIK DEĞİL)".
- `docs/approvals/README.md:1` — "DANGER.ok (tek kullanımlık)" cümlesi GUARD.ok'u ANMIYOR,
  dokunulmadı (doğru).
- `docs/approvals/README.md:4` (başlık) — "tek kullanımlık, JSON, zaman pencereli onay" →
  "JSON, zaman pencereli onay (TEK KULLANIMLIK DEĞİL)".
- `docs/approvals/README.md:9` — "ayrı, tek kullanımlık bir onay dosyası" → "ayrı, AYNI DESENDE
  ama TÜKETİM MODELİ FARKLI bir onay dosyası".

## 5. B-5 — obje derinlik dalı

`_selftest.cjs`'e `nestedObjectJson(depth)` (yalnızca `{"a":...}` iç içe geçmesi, DİZİ hiç
kullanılmıyor) + iki vaka eklendi: `D-SCANNER-DEPTH-OBJECT-OK` (50 seviye, kabul) ve
`D-SCANNER-DEPTH-OBJECT-EXCEEDED` (400 seviye, ~800B — bayt sınırının ÇOK altında — fail-closed).
Kod DEĞİŞMEDİ (zaten doğru); yalnızca test eksikliği kapatıldı.

## 6. Kabul kriterleri (ölçülebilir)

1. Sandbox'ta `node .claude/hooks/_selftest.cjs` → **194/194 GEÇTİ** (165 mevcut + 29 yeni),
   exit 0.
2. B-2/P6 mutasyonu (`!Array.isArray(doc.scope)...` kontrolü kaldırılır) → **tam olarak 1**
   test KIRMIZI (`D-NO-SCOPE-FIELD-REAL`), başka hiçbiri etkilenmez.
3. B-5 mutasyonu (`parseObject`'in `depth + 1` → `depth`, YALNIZCA object dalı) → **tam olarak
   1** test KIRMIZI (`D-SCANNER-DEPTH-OBJECT-EXCEEDED`).
4. Segmentasyonun kendisini kaldıran mutasyon (`splitCommandSegments` her zaman `null` döner) →
   **tam olarak 7** test KIRMIZI (SEG-1,2,3,4,5, QUOTE-AWARE, Y4-SEG-1) — TWIN'ler ve
   RETREAT-* testleri ETKİLENMEZ (segmentasyona bağımlı değiller, bu da izolasyonu kanıtlar).
5. Y4 mutasyonu (`hooksRedirect.test(seg) || (hooksRef.test(seg) && hasWrite)` → `false`) →
   **tam olarak 4** test KIRMIZI (Y4-1,2,4,5) — Y4-3 ETKİLENMEZ (`danger` deseni bağımsız olarak
   zaten yakalıyor, bu ikinci bir savunma katmanı olduğunu KANITLAR).
6. Bugün kilitlenen dört komut sınıfının (kopyalama+okuma, sha256sum+yazma, sed-i+commit,
   kendini-anlatan-not+cp) birebir karşılığı artık **exit 0**; her birinin TWIN pozitif kontrolü
   (aynı aile, fiil+hedef AYNI segmentte) hâlâ **exit 2**.
7. `.claude/hooks/**`/`.claude/settings.json` için okuma (cat/ls/git add/git commit/git diff)
   **exit 0**; yazma/silme (cp/mv/tee/node -e) **exit 2**.
8. Gerçek `docs/approvals/*.ok` dosyalarının SHA-256'sı DEĞİŞMEMİŞ; `git status --short`
   yalnızca bu turun kendi teslim dosyalarını (contract + README.md) gösteriyor.

## 7. Test/mutasyon sonuçları (bu tur, sandbox'ta ölçüldü)

- Sandbox: `scratchpad/verify-json-repo/` (gerçek hook'ların birebir kopyası + izole
  `docs/approvals/G2.ok`).
- Değiştirilmemiş `_selftest.cjs` + değiştirilmiş `gate-check.cjs`/`block-dangerous.cjs` →
  **165/165 GEÇTİ** (regresyon yok, B-2/B-3 yorum değişiklikleri ve B-6/Y4 segmentasyonu mevcut
  hiçbir vakayı bozmadı).
- Yeni `_selftest.cjs` (194 vaka) → **194/194 GEÇTİ**.
- Mutasyon kanıtları (§6 madde 2-5) — dört ayrı izole mutasyon sandbox'ında ölçüldü, HİÇBİRİNDE
  `git checkout`/`restore` kullanılmadı (mutasyonlar ayrı kopyalarda yapıldı, gerçek dosyalara
  hiç dokunulmadı).

## 8. Kabul edilen sınırlar (dürüstçe açık)

- Heredoc/`$(...)` içeren komutlarda aşırı engelleme kasıtlı olarak KORUNUYOR (retreat, §2.3).
- Segmentasyon bir kabuk PARSER'I değildir; alias/fonksiyon/değişken genişletme gibi kabuk
  seviyesi dolaylamalar hâlâ metinsel taramanın doğal sınırları içindedir (ADR-016'nın zaten
  kabul ettiği sınırla aynı sınıf).

## 8-ek. RM KAPANIŞI (önceki turun "kapsam dışı" notu geçersiz kılındı)

**Önceki not** ("`rm dosya` bayraksız hem docs/approvals hem .claude/hooks/** için hâlâ
kaçırılabilir, kapsam dışı") CEO'nun bağımsız sondası (`probe-segment.mjs` E1/E2) tarafından
ölçülüp reddedildi: bu boşluk kapsam dışı bırakılamaz, çünkü (1) `del`/`erase`/`rd`/`rmdir`/`ri`
zaten bayraksız TEK dosya sildiğinde engelleniyordu — eksik olan tek fiil, bu ortamın VARSAYILAN
kabuğunun (Git Bash, POSIX) birincil silme komutuydu, yani en olası saldırı biçimi listenin
dışındaydı; (2) `gate-check.cjs` silinirse `.claude/settings.json` onu çağırmaya devam eder,
`node` çıkış kodu 1 döner, Claude Code yalnızca çıkış kodu 2'yi engelleme saydığı için kapı
SESSİZCE ölür (`CLAUDE.md`'de kayıtlı en pahalı hata sınıfı).

**Yapılan değişiklik:** `block-dangerous.cjs`'in `writeVerb` deseni `\b(del|erase|rm|unlink)\b`
oldu (önceden yalnızca `del|erase`). `\brm\b` kelime-sınırlı olduğu için `git rm` de OTOMATİK
kapsanır (ek desen gerekmedi). `rm -rf` zaten bağımsız `danger` deseninde ayrı yakalanıyordu ve
bu değişiklik onu etkilemedi (regresyon testiyle doğrulandı, aşağıya bkz).

**Bilerek EKLENMEYENLER** (aynı boşluk ailesinde değerlendirilip reddedildi, gerekçeleri
`block-dangerous.cjs`'te "RM KAPANIŞI" yorumunda da kalıcı olarak yazılı):
- `shred` — ADR-009 bu projeyi yalnızca Windows hedefliyor; Git for Windows'un minimal coreutils
  alt kümesinde standart olarak bulunmaz. Eklemek tutarlılığı değil listeyi büyütür.
- `truncate` (dosya sıfırlama) — silme değil, farklı bir tehdit sınıfı (içerik boşaltma). Bu
  turun brief'i açıkça "bayraksız SİLME" idi; eklemek scope creep olurdu.
- `find ... -delete` — bileşik bir deyim. Bare `find` kelimesini eklemek okuma/arama amaçlı
  sayısız zararsız komutu (`find . -name x`) yanlış pozitif engeller; hedefli bir
  `\bfind\b[^\n]*-delete\b` deseni ayrı bir desen ailesi açar, bu turun kapsamı dışında bırakıldı.

**Ölçülmüş sonuçlar:**
- `probe-segment.mjs` (CEO'nun bağımsız sondası): **24/24** (önceden 22/24 — yalnızca E1/E2
  kapandı, A/B/C/D/F blokları etkilenmedi).
- `probe-json-guard.mjs`: 14/14 (regresyon yok).
- `probe-m1-m2.mjs`: 9/9 (regresyon yok).
- Sandbox self-test: **206/206** (194 + 12 yeni: RM-1..7, UNLINK-1..3, GITRM-1..2).
- Mutasyon kanıtı: `writeVerb`'den yalnızca `rm` çıkarılıp `unlink` bırakıldığında (`\b(del|erase|
  rm|unlink)\b` → `\b(del|erase|unlink)\b`) **tam olarak 5** test KIRMIZI oldu: RM-1, RM-2, RM-3,
  RM-4, GITRM-1 (hepsi `rm`'in bizzat gerektiği vakalar). RM-5/6/7 (yanlış pozitif kontrolleri,
  zaten 0 bekliyorlardı), UNLINK-1/2/3 ve GITRM-2 ETKİLENMEDİ — bu, `rm` eklemesinin tam olarak
  iddia edilen 5 vakayı koruduğunu ve komşu hiçbir testi yanlışlıkla geçirmediğini kanıtlıyor.
  Mutasyon sandbox'ta (gerçek `.claude/hooks/` dışında) uygulandı, elle geri alındı (`git
  checkout` kullanılmadı), geri alınan dosya kaynak-doğrusuyla `diff` ile bit-bit karşılaştırıldı.
- `gate-check-borc.cjs`: bu turda DEĞİŞMEDİ (`diff` ile doğrulandı, önceki teslimle birebir aynı).

## 9. A5 KAPANIŞI (CEO'nun diferansiyel sondası — segmentasyon regresyonunun son maddesi)

**Bulgu (CEO, probe-extra.mjs A5):** `X=docs/approvals; rm $X/G5.ok` blob taramasında (segmentasyon-
öncesi, tüm metin tek parça) **ENGELLENİYORDU** ama sevk edilen adayda **GEÇİYORDU** — turun merkezî
şartını ("aday, blob'un engellediği hiçbir saldırı vektörünü geçirmemeli") ihlal eden tek madde.

**Kök neden:** "BARE-ARTIFACT KORELASYONU" mekanizması bir eşleşmenin hemen ÖNCESİNDEKİ karakter `/`
ya da `\` ise hedefi "açık yol, belirsiz DEĞİL" sayıp taramadan MUAF tutuyordu (`findBareProtectedArtifacts`,
`before === '/' ... continue`). `$X/G5.ok` içinde "G5.ok" öncesindeki `/` bir kabuk DEĞİŞKENİNİN
(`$X`) genişlemesinden geliyordu — görünüşte "açık yol" ama gerçekte hedef hâlâ ÇÖZÜLMEMİŞ (X başka
bir segmentte, ya da hiç, atanmış olabilir). Aynı belirsizlik göreli-dizin kısayolu (`./G5.ok`) ve
tırnaklı değişken (`"$DIR"/G5.ok`) için de geçerli.

**Düzeltme (`scratchpad/hook-borclari/block-dangerous-borc.cjs`, `findBareProtectedArtifacts`):**
`/`/`\` öncesindeki hemen önceki TOKEN bir kabuk değişkeni (`$X`, `${X}`, tırnaklı `"$X"`/`'$X'`) ya da
göreli-dizin kısayolu (`.`/`..`) İSE, `AMBIGUOUS_PREFIX_RE` bunu yakalar ve önündeki `/` artık "açık
yol" SAYILMAZ — segment normal bare-artifact akışına (cross-segment mention + write-action şartı
DEĞİŞMEDİ) girer. Literal bir dizin adı (`/tmp/`, `build/`, `docs/approvals/` bizzat) ÖNCEKİ gibi açık
yol sayılır ve atlanır.

**Diferansiyel ölçüm (sandbox `scratchpad/verify-json-repo/`, `probe-differential.mjs` +
`probe-extra.mjs`, aday vs blob-mutant `block-dangerous-blob.cjs`):**

| Sonda kümesi | Blob (segmentasyon-öncesi) | Aday (düzeltme sonrası) | Not |
|---|---|---|---|
| R1-R14 (saldırı, `probe-differential.mjs`) | 14/14 ENGEL | 14/14 ENGEL | regresyon yok |
| F1-F10 (masum, `probe-differential.mjs`) | 10/10 GEÇER | 10/10 GEÇER | regresyon yok |
| A5 (`X=docs/approvals; rm $X/G5.ok`) | **ENGEL (exit 2)** | **ENGEL (exit 2)** | ✅ düzeltildi (önceden GEÇİYORDU) |
| A1 (iki adımlı `cd`) | GEÇİYOR (exit 0) | GEÇİYOR (exit 0) | ⚠ kabul edilmiş sınır — HER İKİ modda da açık, bu turun regresyonu DEĞİL (§9-ek) |
| A10 (`cd .claude && rm settings.json`) | GEÇİYOR (exit 0) | GEÇİYOR (exit 0) | ⚠ kabul edilmiş sınır — HER İKİ modda da açık, bu turun regresyonu DEĞİL (§9-ek) |
| A2-A4/A6-A9 (diğer saldırı varyantları) | 7/7 ENGEL | 7/7 ENGEL | regresyon yok |
| B1/B7 (masum, iki-adımlı zincir) | **YANLIŞ POZİTİF (exit 2)** | GEÇER (exit 0) | blob'un ÖNCEDEN VAR OLAN aşırı-engellemesi, segmentasyonun asıl amacı — bu turun kapsamı DIŞINDA, iyileşme |
| B2/B3/B4/B5/B6/B8 (masum) | 6/6 GEÇER | 6/6 GEÇER | regresyon yok |

Sonuç: **aday, blob'un engellediği HİÇBİR saldırı vektörünü (R/A ailesi) geçirmiyor** — tek regresyon
(A5) düzeltildi. Aday'ın B1/B7'de blob'dan FARKLI davranması (daha az engelleme) bu turun ölçtüğü
şart değil — segmentasyonun bizzat var olma sebebi (§2), CEO'nun "blob'un engellediği hiçbir şeyi
geçirmemeli" iddiası SALDIRI vektörleri için geçerli, blob'un kendi yanlış pozitifleri için tersi
yönde bir taahhüt YOKTUR.

**Aşırı engelleme kontrolü (B4, `echo not > build/G5.ok.txt`):** hâlâ GEÇER (exit 0) — segmentte
`docs/approvals`/`.claude/hooks` hiç anılmıyor, `anyMentionsApprovals`/`anyMentionsHooks` false kalıyor,
düzeltme bu segmentin taranma yoluna hiç girmiyor.

**Yeni test vakaları (`scratchpad/hook-borclari/selftest-borc.cjs`, `dangerCases` sonuna eklendi,
ölçülen: `dangerCases` 151 → 157, TAM sandbox self-test — `block-dangerous.cjs`+`gate-check.cjs`
birlikte — bu turda 256/256 GEÇTİ, exit 0):**
`BARE-A5-1` (birebir A5 regresyonu), `BARE-A5-2` (`./` göreli-dizin varyantı), `BARE-A5-3` (tırnaklı
`"$DIR"/` varyantı), `BARE-A5-hooks` (A5 ile simetrik, hooks ailesi), `BARE-A5-NEG-1` (değişken-önekli
hedef ama hiçbir segmentte mention yok → geçer), `BARE-A5-NEG-2` (literal dizin adları, "tmp"/"sub" —
değişken/nokta DEĞİL → geçer, düzeltmeden etkilenmiyor).

**Mutasyon kanıtı (`scratchpad/mutants/no-a5-fix.cjs` — `AMBIGUOUS_PREFIX_RE` kontrolü
`if (false && ...)` ile devre dışı bırakılarak eski davranışa dönüldü, elle yazıldı, `git
checkout`/`restore` KULLANILMADI):** sandbox self-test'te (256 vaka) **tam olarak 4** test KIRMIZI
oldu — `BARE-A5-1`, `BARE-A5-2`, `BARE-A5-3`, `BARE-A5-hooks` (dördü de yalnızca düzeltmenin
gerektirdiği pozitif vakalar). `BARE-A5-NEG-1`/`BARE-A5-NEG-2` ve önceki 250 vaka ETKİLENMEDİ — bu,
düzeltmenin iddia edilen 4 vakayı tam olarak koruduğunu ve komşu hiçbir testi yanlışlıkla
bozmadığını kanıtlıyor. `probe-extra.mjs` ile çapraz doğrulandı: mutasyonlu hook'ta A5 tekrar
GEÇİYOR (exit 0), diğer 9 A/B sonucu değişmedi (3 EK SONDA BAŞARISIZ: A1, A5, A10 — A5'in mutasyonla
birlikte geri döndüğü, A1/A10'un ise HER İKİ hâlde de zaten açık olduğu doğrulandı).

## 9-ek. A1/A10 — kabul edilmiş sınır (iki adımlı `cd`, önceden var olan boşluk)

`cd docs && cd approvals && rm G5.ok` (A1) ve `cd .claude && rm settings.json` (A10) hem BLOB hem
ADAY modunda GEÇİYOR (exit 0) — bu turun ÖNCESİNDE de böyleydi, segmentasyon ya da A5 düzeltmesi
bunu DEĞİŞTİRMEDİ. Kök neden ortak: korunan yol TEK bir metinde bir arada bulunmuyor, iki ayrı `cd`
adımıyla parça parça kuruluyor (M1'in `WD_CHANGE` retreat'i bunu YAKALAR ama retreat sonrası blob
taraması yine de "approvals"+"rm" ayrı `cd` çağrılarında olduğu için ilişkilendiremiyor — segment
metninin KENDİSİ hiçbir zaman "docs/approvals" ya da ".claude" TEK PARÇA halinde "rm" ile aynı
segmentte/blobda değil).

**Eşik (bu sözleşmeye yazılı, kabul edilmiş):** bu aile ÜÇÜNCÜ kez görülürse (bir başka sonda ailesi
de aynı "çok adımlı `cd`" desenini bulursa) ya da GERÇEK bir sızıntı olayı yaşanırsa yeniden açılır.
Tam çözüm çalışma dizinini uçtan uca modellemeyi gerektirir (kabuk yorumlayıcısı) — bu depoda
bilinçli olarak kaçınılan bir oyun (bkz dosya başı SEGMENTASYON yorumu, "tam bir kabuk grameri
DEĞİLDİR"). Asıl savunma kullanıcının gördüğü izin kartıdır (`canUseTool`, ADR-014/ADR-016) — bu hook
yalnızca erken/okunaklı bir derinlik katmanıdır, mutlak engel değildir.

## 10. Teslim ve dosya sahipliği

- `scratchpad/hook-borclari/gate-check-borc.cjs` → kurulacağı yer: `.claude/hooks/gate-check.cjs`
  (bu turda DEĞİŞMEDİ, önceki turdan kalan hâliyle: B-2 yorumları + B-3 wording).
- `scratchpad/hook-borclari/block-dangerous-borc.cjs` → `.claude/hooks/block-dangerous.cjs`
  (önceki turda segmentasyon + Y4 + RM KAPANIŞI; BU TURDA EK: A5 KAPANIŞI — `findBareProtectedArtifacts`
  artık değişken/göreli-dizin önekli hedefleri de bare sayıyor, §9).
- `scratchpad/hook-borclari/selftest-borc.cjs` → `.claude/hooks/_selftest.cjs`
  (`dangerCases` — block-dangerous.cjs vakaları — önceki turlarda 165 → 194 → 206 → 151; BU TURDA
  EK: 151 → 157 vaka, BARE-A5-1/2/3/hooks/NEG-1/NEG-2. TAM sandbox self-test, block-dangerous.cjs +
  gate-check.cjs birlikte, bu turda ölçüldü: 256/256 GEÇTİ).
- `docs/approvals/README.md` (önceki turda developer tarafından düzenlendi — bu turda dokunulmadı).
- Kurulum sırası serbest (GUARD.ok artık zaman pencereli, tek yazmada tükenmiyor).

## 11. M2v2 KAPANIŞI (2026-09-15 düzeltme turu — QA KALDI: docs/qa/hook-borclari-karari-2026-09-15.md)

**Kaynak:** QA'nın karar turu 22 gerçek saldırı vektörü buldu (`N1-N7`, `N14`, `S1-S16`), 8'i
canlı olarak ölçüldü (izole sahte depoda gerçek dosya silindi/üzerine yazıldı, hook `exit 0`
verdi). Kök neden: v1'in "komut konumu" mekanizması (`CMD_PREFIX_WORDS` = beş önek kelimesi +
`CMD_POS_RE` = dört ayraç) **kapalı bir liste**ydi; kabuk grameri bundan çok daha geniş (`&`,
`|&`, `VAR=x`, `(`/`{`/`!`/`\`, `then`/`do`, `command`/`nice`/`nohup`). Bu depo kapalı listeleri
**dört kez** kaybetti (`docs/wiki/pages/desen/cit-tasarimi.md` §1); bir önek/ayraç daha eklemek
beşinci kaybı garantilerdi — o yüzden brief bilerek "kapalı listeyi büyütme" yolunu **yasakladı**.

### 11.1 Mekanizma (adıyla): tırnak-konumu muafiyeti, komut-konumu DEĞİL

`hasMatchAtCommandPosition` (v1) **tamamen kaldırıldı**, yerine `hasMatchOutsideQuotes` (v2)
geldi. Kural artık ikili ve kapalı bir sayım değil: **bir fiil eşleşmesi yalnızca tırnaklanmış bir
dize İÇİNDE (tek ya da çift) geçiyorsa SAYILMAZ; tırnak DIŞINDAKİ her eşleşme, önünde ne olduğuna
BAKILMAKSIZIN SAYILIR.** Tırnak durumu `scanQuotedRanges(text)` ile hesaplanır — bu,
`splitCommandSegments`'in kullandığı AYNI tek-geçişli tırnak/kaçış durum makinesidir (ikinci bir
tırnak ayrıştırıcısı YAZILMADI, tek kaynak ilkesi). Fail-closed: bir metnin tırnak durumu güvenle
çözülemiyorsa (sonlandırılmamış tırnak) hiçbir eşleşme muaf tutulmaz — retreat felsefesiyle aynı,
belirsizlik daima daha kısıtlayıcı tarafa çözülür.

**Neden bu, B2'yi de hâlâ çözüyor:** QA'nın ölçtüğü 5 yanlış-pozitif vakasının (F2-F5, F9)
HEPSİNDE fiil kelimesi (`unlink`/`RM-1`/`Remove-Item`/`rm`) bir OKUMA komutunun (`grep`/`awk`)
TIRNAKLI ARGÜMANI içinde geçiyordu — yani B2'yi çözmek için "komut konumunu" tanımaya hiç gerek
yoktu, gereken tek şey "bu eşleşme bir dize sabitinin içinde mi" sorusuydu. Aynı zamanda N/S
ailesinin **tamamı** (22 vektör) hiçbir önek/ayraç listesi büyütülmeden kendiliğinden kapanıyor:
`MC=1 rm ...`, `sleep 0 & rm ...`, `(rm ...)`, `\rm ...`, `command rm ...` vb. hepsinde "rm"
TIRNAK DIŞINDA geçiyor, dolayısıyla önünde "sudo" mu "MC=1" mi "(" mi olduğu artık önemsiz.

### 11.2 Kapalı-liste yaklaşımının reddedilme gerekçesi

QA'nın kendi önerisi (§7 madde 4) "okuma araçlarının kapalı bir listesini... segmentin ilk
kelimesinden tanımak" idi — bu da REDDEDİLDİ, çünkü bu da bir kapalı liste (`grep`/`awk`/`sed`/
`cat`/`head`/`tail`/`wc`/`findstr`/...) ve "ilk kelime" varsayımı `if true; then grep ...; fi`
gibi durumlarda kırılır (ilk kelime "then" olur, "grep" değil). Tırnak durumu bunun aksine
**yapısal bir özellik** — kaç farklı okuma aracı/önek/ayraç kelimesi olduğundan bağımsız, "şu an
bir dize sabitinin içinde miyim" ikili sorusu. ADR-013'ün "allowlist zorunlu, denylist değil"
kararıyla aynı derste: burada "allowlist" kavramı bile gerekmiyor, çünkü ayırt edici özellik bir
liste değil bir sözdizim durumu.

### 11.3 Kabul edilen takas (dürüstçe, aşırı engelleme yönünde — güvenlik kaybı DEĞİL)

`grep -n unlink dosya` (TIRNAKSIZ, argüman çıplak) artık yanlış pozitif alır — fiil tırnak
dışında olduğu için koşulsuz sayılır. Bu YENİ bir kayıp DEĞİL: segmentasyon-öncesi (M2-öncesi)
orijinal davranış da böyleydi. Pratikte `grep`in arama deseni normalde tırnaklanır (F2-F5/F9'un
hepsi tırnaklı), gerçek sürtünme düşük öngörülüyor.

**Davranış değişikliği (bilinçli, `_selftest.cjs`'te işaretli):**
- `RETREAT-HEREDOC-M2` → adı `RETREAT-HEREDOC-M2v2` oldu, beklenen değer **0'dan 2'ye** değişti.
  Heredoc gövdesi gerçek bir tırnak çifti DEĞİL (yalnızca `<<'EOF'` sınırlayıcısının kendi tek
  tırnak çifti var, gövde metninin dışında) — bu yüzden gövde içindeki "cp" kelimesi v2'nin
  tırnak taramasında "tırnak dışı" sayılır ve artık engellenir. Bu, retreat/blob modunun kendi
  "kasıtlı aşırı engelleme" felsefesiyle (dosya başı SEGMENTASYON yorumu) TUTARLI — heredoc/`$()`
  retreat'i zaten "kabul edilmiş sınır: aşırı engelleyebilir" diyordu, M2v2 bu sınırı sadece
  tutarlı hale getiriyor.
- `M2-PREFIX-KABUL-EDILEN-SINIR` → adı `M2-PREFIX-BONUS-KAPANIS` oldu, beklenen değer **0'dan
  2'ye** değişti (BONUS KAPANIŞ). `foo rm docs/approvals/GUARD.ok` v1'de "tanınmayan önek"
  sınırıydı (kapalı liste `foo`'yu bilmiyordu); v2'de önek/ayraç kavramı kalmadığı için bu sınıf
  artık yok — "rm" tırnak dışında olduğu için önündeki kelime ne olursa olsun sayılır.

### 11.4 Üç modlu diferansiyel ölçüm (64 vektör × 3 mod, `scratchpad/hook-m2/probe-diff.mjs`)

| Mod | Tanım |
|---|---|
| `prev` | `git show 1fbb1eb:.claude/hooks/block-dangerous.cjs` — bu turun ZİNCİRİNİN başlangıcı (M1/M2/bare-artifact YOK) |
| `installed` | şu an kurulu, regresyonlu sürüm (`a41ce32`) |
| `cand` | bu turun adayı (v2, tırnak-konumu muafiyeti) |

| Küme | N (vektör) | cand sonucu | Not |
|---|---|---|---|
| N1-N7,N14 (yeni sızıntı) | 8 | 8/8 ENGEL | QA'nın §1.3 ailesi |
| S1-S16 (aile büyüklüğü) | 16 | 16/16 ENGEL | QA'nın §1.4 ailesi (S12/S13 zaten v1'de de engelliydi, regresyon değildi) |
| F1-F10 (masum) | 10 | 10/10 GEÇER | B2 kapalı kalıyor |
| R1-R12+A5 (önceki tur regresyonu) | 13 | 13/13 ENGEL | M1/bare-artifact/A5 hâlâ sağlam |
| TWIN (N/S'nin masum ikizleri, okuma) | 16 | 16/16 GEÇER | aşırı engelleme YOK |
| BONUS (`foo rm ...`) | 1 | ENGEL | v1'in kabul edilmiş sınırı kapandı |

**Merkezi kriter (SALDIRI vektörleri, N/S/R/A5/BONUS — F/TWIN hariç, gerekçe: F/TWIN'de
`prev`in kendi orijinal B2 hatası zaten yanlış pozitifti, "blob'un kendi yanlış pozitifi" için
ters yönlü bir taahhüt yok, bkz §9): `prev` ENGEL → `cand` GEÇER: **0 vektör**. `installed` ENGEL
→ `cand` GEÇER: **0 vektör**.** F/TWIN kümesinde `prev`in kendi yanlış pozitifi düzelen 6 vektör
(F2-F5, F9, N1-TWIN) — bu bir regresyon değil, B2'nin iyileşme yönü.

### 11.5 Canlı kanıt (izole sahte depo, gerçek dosya, `scratchpad/hook-m2/live-proof.mjs`)

Gerçek `docs/approvals/G5.ok` (`ORIJINAL-ONAY-ICERIGI`) ve `.claude/hooks/gate-check.cjs`
(`ORIJINAL-GATE-CHECK-ICERIGI`) içerikli izole geçici depolarda 10 N/S vektörü (N1-N7,N14,S3,S16)
`installed` ve `cand` ile ayrı ayrı çalıştırıldı; hook `exit 0` verdiğinde komut GERÇEKTEN Git
Bash ile çalıştırıldı:

| Mod | Pratik sızıntı |
|---|---|
| `installed` (kurulu, regresyonlu) | **10/10** (8'i SİLİNDİ, 2'si ÜZERİNE YAZILDI) |
| `cand` (v2) | **0/10** |
| Pozitif kontrol (`rm docs/approvals/G5.ok`, tırnaksız doğrudan) | her iki modda da ENGEL, dosya DEĞİŞMEDİ |

### 11.6 Mutasyon testi — YÖN AYRIMIYLA (`scratchpad/hook-m2/mutation-full-selftest.mjs`, tam 296-vaka self-test üzerinde)

QA'nın ÖNEMLİ-2 bulgusu ("M2'nin hiçbir çiti engelleme yönünü ölçmüyor") burada iki mutantla
kapatıldı — biri mekanizmayı kaldırıyor (aşırı-engelleme yönü), diğeri TERSİNE çeviriyor
(engelleme-kaybı yönü, yani "mekanizma gerçek bir yazmayı görünmez yapıyor mu"):

| Mutant | Ne yapar | Kırmızı (296 vaka üzerinde) | Yön |
|---|---|---|---|
| `mutant-always-count` | tırnak kontrolü KALDIRILIR (her eşleşme sayılır, `.test()` eşdeğeri) | **6** (F2-F5, F9, N1-TWIN) | yanlış-pozitif (aşırı engelleme) |
| `mutant-always-exempt` | tırnak kontrolü TERSİNE ÇEVRİLİR (hiçbir eşleşme sayılmaz) | **86** (b1/b2/N/S/R/A5/BARE-* ailelerinin tamamı) | **ENGELLEME KAYBI** — mekanizma gerçek yazmaları görünmez yapıyor, self-test bunu YAKALIYOR |

`mutant-always-exempt`'in 86 kırmızısı, brief'in istediği "mekanizma gerçek bir yazmayı görünmez
yapmasın" pozitif kontrolünü (≥5 vaka şartını 17× aşarak) doğrular — v1'in en büyük açığı tam
olarak buydu (7 kırmızının 7'si de yanlış-pozitif yönündeydi, engelleme yönünde SIFIR çit vardı).
Mutasyonlar sandbox'taki candidate dosyasında elle uygulanıp (`git checkout`/`restore`
KULLANILMADI) her ölçümden sonra orijinal içerikle **bit-bit** karşılaştırılarak geri yazıldı.

### 11.7 Yeni, dürüstçe kabul edilen sınır: `sh -c '...'` / `bash -c "..."` / `powershell -Command "..."`

Tırnaklı bir dize kendisi GERÇEKTEN yorumlayan bir alt kabuğa geçiriliyorsa (`sh -c 'rm
docs/approvals/G5.ok'`) fiil tırnak İÇİNDE olduğu için v2 tarafından muaf sayılır — ama kabukta
GERÇEKTEN çalıştırılır (teorik değil, pratik sızıntı riski taşır). Bu, tam bir kabuk
yorumlayıcısı yazmadan (bilinçli kaçınılan oyun) çözülemez — ADR-016'nın zaten kabul ettiği
sınırla aynı sınıf (asıl savunma kullanıcının izin kartıdır). Bu turun brief'i bu vektör ailesini
kapsamına almadı (22 vektörün hiçbiri bu değil); ayrı bir tur olarak bırakılıyor, `docs/blockers.md`'ye
eşik olarak kaydedilecek: "bir sonraki `.claude/hooks/**` turu ya da gerçek bir `sh -c`/`bash -c`
sızıntı olayı."

### 11.8 Teslim

- `scratchpad/hook-m2/block-dangerous-m2.cjs` → kurulacağı yer: `.claude/hooks/block-dangerous.cjs`.
- `scratchpad/hook-m2/selftest-m2.cjs` → `.claude/hooks/_selftest.cjs` (`dangerCases` 157 → 197:
  +22 QA vektörü (N1-N7,N14,S1-S16) + 16 TWIN masum negatif kontrol + 2 vaka adı/beklenti
  güncellemesi RETREAT-HEREDOC-M2v2/M2-PREFIX-BONUS-KAPANIS, §11.3; hiçbir eski vaka çıkarılmadı).
  Tam self-test (block-dangerous.cjs + gate-check.cjs): **296/296 GEÇTİ**, exit 0.
- `gate-check.cjs` bu turda DEĞİŞMEDİ (kapsam dışı, brief §"Dokunma").
- Kurulum: CEO `Write` aracıyla yapacak (`.claude/hooks/**`'a otonom yazma bu ortamda kategorik
  engelli). Kurulumdan ÖNCE aday izole sahte depoda doğrulandı (§11.4-§11.6).

## 12. M2 v3 KAPANIŞI (2026-09-15, iki adımlı düzeltme kararının 1. adımı — QA'nın §11'in KALDI'sı
sonrası CEO'nun bağımsız iç içe-kabuk sondası)

**Kaynak/sözleşme (kodlamadan önce):** Bu bölüm hem sözleşme hem sonuç kaydı olarak yazıldı —
`hook-borclari-contract.md` bu feature'ın G5 sürecinde tur-bazlı canlı sözleşme dosyası olarak
kullanılıyor (§1, §9, §11 aynı deseni izledi). **Ne yapılacak:** M2 v2'nin "tırnak içi = muaf"
mekanizması TAMAMEN kaldırılacak (v0/`prev` davranışına dönüş — fiil eşleşmesi metnin HER YERİNDE
sayılır). **Nasıl doğrulanacak:** (a) dört modlu diferansiyel (`prev`/`installed`/`v2`/`safe`, 80
vektör) — `safe` tüm saldırı vektörlerini engellemeli, `prev` ve `installed`'a karşı 0 regresyon;
(b) izole sahte depoda canlı kanıt — NEST-1..12 gerçekten çalıştırılıp dosyaların değişmediği
gösterilecek + pozitif kontrol (hook yokken gerçekten değiştiği); (c) self-test tam yeşil; (d) yön
ayrımlı mutasyon — her mekanizmanın (tırnak-kaldırma, M1, bare-artifact) kaldırılması self-test'i
SADECE "engelleme kaybı" yönünde kırmalı, "aşırı engelleme" yönünde sıfır olmamalı.

### 12.1 Regresyon: CEO'nun iç içe-kabuk sondası (`ceo-nested.mjs`, 12 saldırı + 4 masum ikiz)

QA'nın KALDI kararından sonra CEO bağımsız bir sonda çalıştırdı: v2'nin "tırnak içi = muaf"
kuralı, tırnaklı bir dizeyi GERÇEKTEN yorumlayan bir alt kabuğa (`sh -c '...'`, `bash -c "..."`,
`eval "..."`, `powershell -Command "..."`) geçirildiğinde YANLIŞ sonuç veriyordu — o dize kabuk
için VERİ değil KODDUR. Ölçüm: `prev` (1fbb1eb) N1-N12'nin **12/12**'sini ENGELLİYORDU, v2
**11/12**'sini GEÇİRİYORDU (yalnızca N8, `echo x > ...` yönlendirmesi zaten tırnak-farkında
olmayan `approvalsRedirect`'ten dolayı tek geçen vakaydı). Bu, "kabul edilmiş sınır" değil
**REGRESYON**dur — v2 "yalnızca yanlış pozitifi azaltabilir, engellemeyi asla azaltamaz" şartını
ihlal etti.

**Kullanıcı kararı (tartışma kapalı, iki adım):** Bu turda SADECE tırnak muafiyetini kaldır (v0
davranışına dön). Okuma-komutu beyaz listesi (segment başındaki komut salt-okunur bir araçsa o
segmentin tırnaklı argümanları muaf) **SONRAKİ turun kapsamı** — bu turda hiç yazılmadı.

### 12.2 Değişiklik (adıyla): tırnak-muafiyeti mekanizması SİLİNDİ, `.test()` doğrudan çağrılıyor

`scanQuotedRanges` ve `hasMatchOutsideQuotes` fonksiyonları **tamamen kaldırıldı** (ölü kod
bırakılmadı — CLAUDE.md ilkesi). Dört çağrı noktası (`segmentHasWriteAction` içindeki iki çağrı +
ana döngüdeki `hasWrite` hesaplaması, iki yer) doğrudan `writeVerb.test(seg)` /
`inlineEval.test(seg)` ile değiştirildi. `splitCommandSegments`'in kendi tırnak takibi (segment
SINIRLARINI bulmak için) DEĞİŞMEDİ — o ayrı bir mekanizma, M1/segmentasyon hâlâ sağlam.

### 12.3 Dört modlu diferansiyel (80 vektör: önceki turun 64'ü + CEO'nun 16'sı, `scratchpad/hook-safe/four-mode-diff.mjs`)

| Mod | Tanım |
|---|---|
| `prev` | `git show 1fbb1eb:...` — zincirin başlangıcı |
| `installed` | şu an kurulu, regresyonlu sürüm (`a41ce32`) |
| `v2` | önceki turun KALDI alan adayı (tırnak-muafiyetli) |
| `safe` | bu turun adayı (tırnak-muafiyeti kaldırılmış) |

**Saldırı vektörleri (50 toplam: N8+S16+R12+A5+BONUS1 + NEST12):** `safe`'de **50/50 ENGEL**.
`prev`'e karşı regresyon: **0**. `installed`'a karşı regresyon: **0**. `v2`'ye karşı regresyon
(bilgi amaçlı, beklenen 0): **0**.

**Masum vektörler (30 toplam: F10+TWIN16+NEST-NEG4):** `safe`'de **30/30 beklenen davranışa
uygun** — 24'ü GEÇER, 6'sı (F2, F3, F4, F5, F9, N1-TWIN) BİLİNÇLİ KABUL EDİLMİŞ GEÇİCİ aşırı
engelleme ile ENGEL (bir sonraki turda okuma-komutu beyaz listesiyle geri kazanılacak).
Beklenmeyen (yeni) yanlış pozitif: **0**.

### 12.4 Canlı kanıt (izole sahte depo, gerçek dosya, `scratchpad/hook-safe/live-proof-safe.mjs`)

Gerçek içerikli `docs/approvals/G5.ok`, `.claude/hooks/gate-check.cjs`, `.claude/settings.json`
fixture'ları izole geçici depolarda kuruldu. NEST-1..NEST-12 ÖNCE `safe` hook'a soruldu; hook
`exit 2` verdiğinde komut **hiç çalıştırılmadı** (gerçek Claude Code akışının taklidi — PreToolUse
hook'u bloklarsa Bash aracı komutu hiç yürütmez):

| Aşama | Sonuç |
|---|---|
| A: Korumalı (hook önce soruluyor) | **12/12** — hiçbiri dosya değiştirmedi, `FAIL: 0` |
| B: Pozitif kontrol (hook YOK, komut GERÇEKTEN çalıştırıldı, ayrı korumasız depo) | **10/10** gerçekten değişti/silindi (2 atlandı: NEST-6 bu ortamda `pwsh` kurulu değil; NEST-11 bu ortamda Git-Bash'in MSYS `/c` bayrağını POSIX-yol sanıp dönüştürmesi nedeniyle `cmd.exe` hiçbir modda (hook olsun olmasın) silme yapmadı — bu hook'un özelliği değil, ortamın `cmd`-çağırma kısıtlaması; hook bloğu METİN eşleşmesiyle çalışıyor ve Aşama A'da NEST-11 için de zaten kanıtlandı) |

### 12.5 Self-test (`scratchpad/hook-safe/selftest-safe.cjs`, taban: 296 vaka + 16 yeni = 312)

- F2/F3/F4/F5/F9 ve N1-TWIN: beklenen **0'dan 2'ye** değişti, açıklamasına "KABUL EDİLMİŞ GEÇİCİ
  AŞIRI ENGELLEME — bir sonraki turda okuma-komutu beyaz listesiyle geri kazanılacak" notu düşüldü.
- NEST-1..NEST-12 (12 saldırı, beklenen 2) + NEST-NEG-1..4 (4 masum ikiz, beklenen 0) eklendi.
- Hiçbir eski vaka çıkarılmadı. İzole sandbox'ta (gerçek `docs/approvals/**`'a dokunulmadan)
  çalıştırıldı: **312/312 GEÇTİ**, exit 0 (213 block-dangerous.cjs + 99 gate-check.cjs, bu ikincisi
  değişmedi).

### 12.6 Yön ayrımlı mutasyon (`scratchpad/hook-safe/mutate-and-test.mjs`)

QA'nın tekrarlayan bulgusu ("bir mekanizmanın kaldırılması self-test'i SADECE aşırı-engelleme
yönünde kırıyorsa, o mekanizmanın engelleme-yönü çitsizdir") burada üç ayrı mutantla ölçüldü:

| Mutant | Ne yapar | Toplam FAIL | ENGELLEME-KAYBI | AŞIRI-ENGELLEME |
|---|---|---|---|---|
| MUT-A: tırnak muafiyeti GERİ EKLENDİ (v2 hatası yeniden üretildi, iki çağrı noktası birlikte) | 17 | **17** | **0** |
| MUT-B: M1 (`WD_CHANGE` retreat) devre dışı | 1 | **1** | **0** |
| MUT-C: bare-artifact korelasyonu devre dışı | 12 | **12** | **0** |

Üçünde de ikinci sütun (ENGELLEME-KAYBI) **sıfır değil** — yani her mekanizmanın engelleme yönü
self-test tarafından gerçekten ölçülüyor, F002/F011'de tekrarlayan "7 kırmızının 7'si de
yanlış-pozitif yönündeydi" hatası burada YOK. Baseline (mutasyonsuz `safe`): 0 FAIL (312/312).
Mutasyonlar `SAFE_SRC`'nin bellek içi string kopyası üzerinde uygulandı (needle bulunamazsa
betik fırlatır); gerçek `.claude/hooks/**`'a hiç yazılmadı.

### 12.7 Kalan bilinen sınırlar (dürüstçe)

- **6 bilinçli kabul edilmiş geçici aşırı engelleme** (§12.3): `grep`/`awk` gibi salt-okunur
  komutların tırnaklı argümanında fiil kelimesi geçerse artık yanlış pozitif alır. Kalıcı tasarım
  DEĞİL — **bir sonraki turun kapsamı**: okuma-komutu beyaz listesi (segment başındaki komut
  bilinen salt-okunur bir araçsa o segmentin tırnaklı argümanları muaf).
- **NEST-11 pozitif kontrolü ölçülemedi** (§12.4) — bu ortamın Git-Bash/MSYS `cmd /c` argüman
  dönüştürme kısıtlaması nedeniyle; hook bloğu bağımsız olarak Aşama A'da doğrulandı.
- **NEST-6 pozitif kontrolü ölçülemedi** — bu ortamda `pwsh` kurulu değil; hook bloğu metin
  eşleşmesiyle çalıştığı için `pwsh`'ın gerçekte kurulu olup olmaması hook'un doğruluğunu
  etkilemez, yalnızca canlı-kanıt tam demosunu bir vektörde sınırlar.
- `sh -c`/`bash -c` içindeki tırnaklı dize artık HER ZAMAN taranıyor (tırnak-dışı/-içi ayrımı
  YOK) — bu "alt kabuğu tanıyıp içeriğini gerçekten yorumlama" DEĞİL, sadece "artık hiçbir tırnak
  muaf değil" sonucu. Sonraki turda beyaz liste eklenince bu davranış gözden geçirilmeli (`sh -c
  '...'` kendisi salt-okunur bir araç SAYILMAYACAĞI için N-ailesi o turda da kapalı kalmalı).
- A1/A10 (parçalı yol ailesi, `cd docs && cd approvals && rm G5.ok`) hâlâ kapsam dışı, önceki
  turlardan eşikli borç (§9-ek).

### 12.8 Teslim

- `scratchpad/hook-safe/block-dangerous-safe.cjs` → kurulacağı yer: `.claude/hooks/block-dangerous.cjs`.
- `scratchpad/hook-safe/selftest-safe.cjs` → `.claude/hooks/_selftest.cjs` (`dangerCases` 197 → 213:
  +12 NEST saldırı vektörü + 4 NEST-NEG masum ikiz; F2/F3/F4/F5/F9/N1-TWIN beklenen değeri 0→2;
  hiçbir eski vaka çıkarılmadı). Tam self-test: **312/312 GEÇTİ**, exit 0.
- `gate-check.cjs` bu turda DEĞİŞMEDİ (kapsam dışı).
- Kurulum: CEO `Write` aracıyla yapacak (`.claude/hooks/**`'a otonom yazma bu ortamda kategorik
  engelli). Kurulumdan ÖNCE aday izole sahte depoda doğrulandı (§12.3-§12.6).
