---
status: qa
---

# hook-borçları-contract.md — B-2, B-3, B-5, B-6, Y4 kapanışı

Kaynak brief: CEO turu 2026-09-11 (G6 öncesi borç kapatma). Kapsam: `.claude/hooks/gate-check.cjs`,
`.claude/hooks/block-dangerous.cjs`, `.claude/hooks/_selftest.cjs`. B-4 (test kararsızlığı) bu
turun KAPSAMI DIŞINDA — ayrı, zaten "ölçülmüş ve yönetilen risk" olarak kapanmış (docs/blockers.md
2026-09-11 B-4 KAPANIŞ girdisi).

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
- `rm dosya` (bayraksız) hem `docs/approvals` hem `.claude/hooks/**` için hâlâ kaçırılabilir
  (§2.5, önceden var olan, paylaşılan sınır — bu turun beş maddesinde yok, kapsam dışı).
- Segmentasyon bir kabuk PARSER'I değildir; alias/fonksiyon/değişken genişletme gibi kabuk
  seviyesi dolaylamalar hâlâ metinsel taramanın doğal sınırları içindedir (ADR-016'nın zaten
  kabul ettiği sınırla aynı sınıf).

## 9. Teslim ve dosya sahipliği

- `scratchpad/hook-borclari/gate-check-borc.cjs` → kurulacağı yer: `.claude/hooks/gate-check.cjs`
  (DEĞİŞTİ: B-2 yorumları + B-3 wording).
- `scratchpad/hook-borclari/block-dangerous-borc.cjs` → `.claude/hooks/block-dangerous.cjs`
  (DEĞİŞTİ: segmentasyon + Y4).
- `scratchpad/hook-borclari/selftest-borc.cjs` → `.claude/hooks/_selftest.cjs`
  (DEĞİŞTİ: 165 → 194 vaka).
- `docs/approvals/README.md` (bu tur içinde, developer tarafından düzenlendi — `docs/` serbest).
- Kurulum sırası serbest (GUARD.ok artık zaman pencereli, tek yazmada tükenmiyor).
