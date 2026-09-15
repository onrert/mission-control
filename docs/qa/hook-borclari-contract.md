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

## 9. Teslim ve dosya sahipliği

- `scratchpad/hook-borclari/gate-check-borc.cjs` → kurulacağı yer: `.claude/hooks/gate-check.cjs`
  (bu turda DEĞİŞMEDİ, önceki turdan kalan hâliyle: B-2 yorumları + B-3 wording).
- `scratchpad/hook-borclari/block-dangerous-borc.cjs` → `.claude/hooks/block-dangerous.cjs`
  (önceki turda segmentasyon + Y4; BU TURDA EK: `writeVerb`'e `rm`/`unlink` eklendi — RM KAPANIŞI,
  §8-ek).
- `scratchpad/hook-borclari/selftest-borc.cjs` → `.claude/hooks/_selftest.cjs`
  (önceki turda 165 → 194 vaka; BU TURDA EK: 194 → 206 vaka, RM-1..7/UNLINK-1..3/GITRM-1..2).
- `docs/approvals/README.md` (önceki turda developer tarafından düzenlendi — bu turda dokunulmadı).
- Kurulum sırası serbest (GUARD.ok artık zaman pencereli, tek yazmada tükenmiyor).
