---
type: qa-contract
gate: G5
date: 2026-09-10
kaynak: docs/qa/G5-guvenlik-denetimi-2026-09-10.md (K1/K2/K3, üç YÜKSEK bulgu)
---

# Sözleşme — G5 üç YÜKSEK bulgunun kapatılması (FF1/FF2/FF3)

Bu tur kod yazmadan önce ne yapılacağını ve her davranışın nasıl ölçüleceğini sabitler.
CEO kararları brief'te bağlayıcı olarak verildi; bu belge onları uygulama planına çevirir.

## FF1 — `.claude/hooks/**` + `.claude/settings.json` için GUARD.ok kapısı

**Dosya:** `.claude/hooks/gate-check.cjs` (tek dosya).

**Değişiklik:** `free` listesindeki `/^\.claude\//` deseni kaldırılır. Yerine:
- `rel` `.claude/hooks/` ile başlıyorsa VEYA `rel === '.claude/settings.json'` ise → **korumalı**:
  `docs/approvals/GUARD.ok` yoksa `block()` (exit 2); varsa geçer VE dosya **tüketilir**
  (tek kullanımlık, `DANGER.ok`/`PUSH.ok` ile aynı desen).
- Diğer `.claude/**` yolları (`.claude/agents/**`, `.claude/agent-memory/**`, `.claude/skills/**`,
  `.claude/launch.json` vb.) **serbest kalır** — güvenlik sınırı değil, brief'in kapsamı yalnızca
  hooks/settings.json.
- `docs/`, `assets/`, `README.md`, `.gitignore`, `CLAUDE.md`, `KURULUM.md` serbest listesi
  değişmez.

**Doğrulama (`_selftest.cjs`'e yeni vaka grubu, gate-check.cjs için):**
1. `GUARD.ok` yokken `.claude/hooks/block-dangerous.cjs`'e yazma isteği → exit 2.
2. `GUARD.ok` yokken `.claude/settings.json`'a yazma isteği → exit 2.
3. `GUARD.ok` varken aynı istek → exit 0 VE `GUARD.ok` diskten silinmiş olmalı (tüketildi).
4. `GUARD.ok` yazılmış ama hedef `.claude/agents/foo.md` (korumalı değil) → exit 0 VE
   `GUARD.ok` **tüketilmemeli** (yanlış pozitif / boşuna harcama yok).
5. Regresyon: `src/server/index.ts`'e yazma, G2.ok yokken hâlâ exit 2 (mevcut davranış bozulmadı).
6. Regresyon: `.claude/agents/foo.md`'ye GUARD.ok hiç yokken yazma → exit 0 (agents serbest).

**Mutasyon kanıtı:** GUARD.ok kontrolünü `false &&` ile devre dışı bırak → vaka 1/2 KIRMIZI
(exit 0 dönmeli iken hook artık hep 0 döner, selftest FAIL yakalar) → elle geri al, md5 karşılaştır.

## FF2 — `block-dangerous.cjs` Windows silme komutları

**Dosya:** `.claude/hooks/block-dangerous.cjs` (tek dosya, yalnızca `danger` regex'i + başa
yorum).

**Değişiklik:** `danger` regex'ine eklenir:
- `\b(rd|rmdir)\b[^\n]*\/s\b` — bayrak sırasından bağımsız, `/s` içeren her `rd`/`rmdir`.
- `del`/`erase` için sıra bağımsız hale getirme: `\b(del|erase)\b(?=[^\n]*\/[sq]\b)`
  (lookahead — `/s` veya `/q` komutun herhangi bir yerinde olabilir).
- PowerShell `ri` (Remove-Item kısaltması) `-r`/`-Recurse` ile: `\bri\b[^\n]*-r(ecurse)?\b`.
- Dosyanın başına yorum: bu bir **kara liste**, derinlik katmanıdır — mutlak engel değil;
  asıl koruma kullanıcının gördüğü `canUseTool` onay kartıdır (ADR-014).

**Doğrulama (`_selftest.cjs`, mevcut dosyaya yeni vakalar):**
1. `rd /s /q build` → exit 2.
2. `rmdir /s /q build` → exit 2.
3. `del /f /s /q build` → exit 2 (denetimde kaçan bayrak-sırası vakası).
4. Regresyon: `del /s /q build`, `del /q /s build` → exit 2 (önceden de geçiyordu).
5. Yanlış pozitif: `git commit -m "rd klasoru icin readme guncelle"` (bare "rd" kelimesi,
   `/s`/`/q` yok) → exit 0.
6. Yanlış pozitif: `rmdir emptydir` (recursive flag yok, zararsız) → exit 0.
7. Regresyon: mevcut `_selftest.cjs` tablosundaki 15 vakanın hepsi değişmeden geçer.

**Mutasyon kanıtı:** yeni regex parçasını `false &&` ile devre dışı bırak → vaka 1-3 KIRMIZI
→ elle geri al, md5 karşılaştır.

## FF3 — Olay yutma hattı redaksiyonu

**Dosya:** `src/features/events/server/normalize.ts` (tek dosya) + `docs/00-idea.md` /
yeni `docs/decisions/ADR-015-olay-akisi-redaksiyonu.md` (belgeleme) + `KURULUM.md` (kullanıcıya
görünür kısa not). Mevcut testler (`tests/features/events/server/normalize.test.ts`) **yeşil
kalmalı** — hiçbiri değiştirilmeyecek, yalnızca yeni test eklenecek.

**Değişiklik (`normalize.ts`):**
- `payload` JSON.parse edildikten hemen sonra, tüm ağaç (string yaprak değerler, iç içe
  obje/dizi) derinlemesine gezilir (`redactDeep`). Yapı (anahtarlar, sayı/boolean/null
  değerler) **değişmez** — yalnızca string yaprakların içeriği işlenir.
- **Sır redaksiyonu:** bilinen anahtar/token önekleri (`sk-…`, `AKIA…`/`ASIA…`, `ghp_…`/
  `github_pat_…`, `xox[a-z]-…`, `AIza…`), PEM private key blokları, `Bearer <token>` ve
  `api_key`/`secret`/`token`/`password`/`authorization` gibi alan adı + değer çiftleri
  **görünür** biçimde maskelenir (`[redakte]`), tüm dizge silinmez — yalnızca eşleşen kısım.
  Eşleşme olursa `flags`'e `secrets_redacted` eklenir.
- **İçerik kırpma:** tek bir string alan 4000 karakteri aşarsa 4000'de kesilip görünür bir
  işaretle (`…[içerik kırpıldı]`) işaretlenir (BUG-001'in `summary` kırpma deseniyle aynı ilke,
  ayrı bir sabit — mevcut `SUMMARY_MAX_LENGTH=200` davranışı değişmez, o zaten ayrı ve daha sıkı
  bir sınırdır). Kırpma olursa `flags`'e `content_truncated` eklenir.
- `deriveSummary`/`resolveProjectPath`/`raw` hepsi **redakte edilmiş payload** üzerinden
  hesaplanır (tek noktadan uygulama — summary da secret sızdırmasın).
- Mevcut `raw_truncated` (toplam boyut aşımı) mekanizması **değişmeden** kalır; bu, redaksiyon
  sonrası serialize edilen boyuta bakar (redaksiyon boyutu küçültebilir de büyütebilir de,
  sıralama önemli değil çünkü ayrı bir amaç: toplam gövde sınırı vs tekil alan sınırı).

**Doğrulama (yeni testler, `tests/features/events/server/normalize.test.ts`'e ekleme):**
1. `tool_input.command` içinde `sk-ant-…` biçimli bir dizge → `raw`'daki karşılık gelen alan
   `[redakte]` içerir, orijinal secret **hiçbir yerde** (raw, summary) geçmez; `flags` içinde
   `secrets_redacted`.
2. Aynı payload'da secret olmayan kısımlar (ör. `echo` öneki) **korunur** — tüm dizge silinmiyor.
3. `Authorization: Bearer xxxxxxxxxxxxxxxxxxxx` içeren bir `tool_input.command` → `Bearer
   [redakte]`.
4. `api_key=abcdef123456` biçimli bir alan → `api_key=[redakte]` (anahtar adı korunur).
5. 5000 karakterlik zararsız (secret içermeyen) bir string alan → 4000 karakterde kırpılır,
   `…[içerik kırpıldı]` ile biter, `flags` içinde `content_truncated`.
6. Regresyon: mevcut BUG-001 testleri (800 'a' karakterlik komut, 200 karaktere kırpma) hiç
   değişmeden yeşil kalır (secret deseniyle eşleşmiyor, 4000 alan sınırının altında).
7. Regresyon: `custom_marker: 'xyz123'` testi değişmeden yeşil kalır (6 karakter, hiçbir
   desenle eşleşmiyor).

**Mutasyon kanıtı:** `redactDeep` çağrısını devre dışı bırak (payload'ı olduğu gibi geçir) →
test 1/3/4 KIRMIZI (ham secret `raw`'da görünür hale gelir) → elle geri al, md5 karşılaştır.

**Belgeleme:** `docs/00-idea.md`'ye "Kesinlikle olmayacaklar" altına bir dipnot/çapraz referans;
yeni `ADR-015` bu kararı ve redaksiyon desenlerinin **bir kara liste olduğunu, dolayısıyla
tam olmadığını** (cit-tasarimi.md §1 ile tutarlı) kayıt altına alır; `KURULUM.md`'ye kullanıcıya
görünür kısa bir "ne saklanır" notu eklenir.

**Kapsam dışı / dokunulmayan:** `data/*.jsonl`'e **daha önce** yazılmış kayıtlar (geçmiş veri,
ADR-001 karar 6 gereği dokunulmaz) — bu, `docs/blockers.md`'ye eşiğiyle not düşülür.

## Ortak doğrulama

- Her üç madde için önce **mutasyonla KIRMIZI**, sonra elle geri alma + `git diff`/md5 ile
  başlangıç durumuna dönüldüğü kanıtı (`git checkout` kullanılmaz).
- `node .claude/hooks/_selftest.cjs` → tüm vakalar (eski + yeni) yeşil.
- `npm run verify` = 0 (typecheck + lint + test + build), koşan test sayısı raporlanır.
- `npm run e2e` = 0.
- `grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` bitişte yalnızca bilinen meşru
  isim (`write-gate-manifest.test.ts:124`) + bu turun kendi yorumlarını içerir.
- Yetim süreç kontrolü (`tasklist`/`Get-CimInstance`) her ağır komuttan sonra; port 7333'teki
  kullanıcı sürecine (PID 12932/33964) ve `hayat-mentoru`'ya dokunulmaz.

## Riskler / bilerek kapsam dışı bırakılanlar

- FF2 hâlâ bir kara liste; PowerShell'in tüm silme yollarını (ör. `Clear-Item`, sürücü harfi
  olmadan UNC yol biçimleri) kapsamıyor — brief'in istediği üç somut vektör + iki PS örneği
  kapatılıyor, "tüm olası silme komutları" iddiası yapılmıyor.
- FF3'ün sır desenleri de bir kara liste — yeni bir sır biçimi (ör. özel bir şirketin token
  formatı) listede yoksa redakte edilmez. Bu, ADR-015'te açıkça yazılacak.
- FF1/FF3 CEO'nun barındırılan oturumunun `canUseTool` onay kartı davranışını **tekrar
  ölçmüyor** (bu turun brief'i "npm run dev kullanma" kısıtıyla orantısız sayıyor, önceki
  turlarda zaten ölçülmüş — ADR-014 eki).
