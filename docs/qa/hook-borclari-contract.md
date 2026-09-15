---
status: qa
---

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
