---
type: qa-contract
gate: G5
date: 2026-09-10
tur: 2 (bağımsız denetimin bulduğu K1-YENİ + iki düşük bulgunun kapatılması)
kaynak: docs/qa/G5-guvenlik-denetimi-2026-09-10-tur2.md
---

# Sözleşme — G5 tur 2 kapanışı (GG1 bloklayıcı + GG2/GG3 düşük)

## GG1 (bloklayıcı) — `isGuarded` harf duyarsızlığı

**Dosya:** `.claude/hooks/gate-check.cjs` (GUARD.ok gerektirir — bu dosya `.claude/hooks/**`
kapsamında, bu turda CEO'dan GUARD.ok istenecek).

**Değişiklik:**
- `isGuarded` regex'ine `/i`: `/^\.claude\/hooks\//i.test(rel) || rel.toLowerCase() === '.claude/settings.json'`.
- `free` listesindeki `/^\.claude\//` deseni de tutarlılık için `/i` alır (aksi halde
  `.CLAUDE/agents/x.md` gibi zararsız bir yol yanlışlıkla G2.ok kontrolüne düşerdi).
- Komut regex'lerine (`block-dangerous.cjs`) DOKUNULMAZ bu maddede — path karşılaştırması ile
  komut karşılaştırması ayrı ele alınıyor (brief kısıtı).
- Diğer yol karşılaştırmaları (`_common.cjs`, varsa başka hook) grep ile taranır; aynı sınıf
  harf-duyarlılık hatası bulunursa raporlanır/düzeltilir, yoksa "kontrol edildi" diye yazılır.

**Doğrulama (`_selftest.cjs`'e en az 4 yeni vaka):**
1. `.CLAUDE/HOOKS/block-dangerous.cjs`, GUARD.ok yok → exit 2 (şu an exit 0, bu YENİ vaka
   önce KIRMIZI, düzeltme sonrası YEŞİL).
2. `.claude/Hooks/block-dangerous.cjs`, GUARD.ok yok → exit 2.
3. `.CLAUDE/HOOKS/block-dangerous.cjs`, GUARD.ok var → exit 0 VE GUARD.ok tüketilir.
4. Regresyon: `.claude/agents/**` ve `.claude/agent-memory/**` (küçük/büyük harf karışık
   varyantlarda da) hâlâ etkilenmiyor — GUARD.ok yokken de geçer, varken tüketilmez.

**Mutasyon kanıtı:** `/i` bayrağını `isGuarded` regex'inden kaldır → vaka 1/2 KIRMIZI
(`cikan=0 beklenen=2`) → elle geri al (metni aynen eski hâline yaz), `git diff`/md5 ile
başlangıç durumuna dönüldüğünü kanıtla (`git checkout` KULLANILMAZ).

## GG2 (düşük) — `ri -rec` PowerShell kısaltması kaçıyor

**Dosya:** `.claude/hooks/block-dangerous.cjs` (aynı GUARD.ok gerekiyor, GG1 ile aynı yazma
turunda yapılacak — tek dosyaya iki ayrı PreToolUse tetiklemek yerine).

**Değişiklik:** `danger` regex'indeki `\bri\b[^\n]*-r(ecurse)?\b` parçası, `-Recurse`'ün
belirsiz olmayan tüm ön eklerini (`-r`, `-re`, `-rec`, `-recu`, `-recur`, `-recurs`,
`-recurse`) kapsayacak şekilde genişletilir: `-r(e(c(u(r(s(e)?)?)?)?)?)?\b`.

**Doğrulama:**
1. `ri -rec build` → exit 2 (şu an exit 0).
2. `ri -recu build`, `ri -recur build`, `ri -recurs build` → exit 2 (ek güvence).
3. Regresyon: mevcut `ri -r build`, `ri -Recurse build` vakaları hâlâ exit 2.
4. Yanlış pozitif: `ri build` (bayraksız), `ri -R build` zaten kapsanan vaka — değişmeden
   exit 2 kalmalı (mevcut davranış, `-R` zaten `-r`'nin harf-duyarsız hâli).
5. Yanlış pozitif: zararsız `ri` kullanımı bayrak içermiyorsa (`ri file.txt`) hâlâ exit 0.

**Mutasyon kanıtı:** genişletilmiş grup yerine eski `-r(ecurse)?\b` metnini geri koy →
vaka 1 KIRMIZI → elle geri al.

## GG3 (düşük) — `pwd=` redakte edilmiyor

**Dosya:** `src/features/events/server/normalize.ts` (GUARD.ok GEREKMEZ — G2.ok kapsamında,
zaten mevcut). Test: `tests/features/events/server/normalize.test.ts` (yalnızca ekleme,
mevcut 25 test değişmeden yeşil kalır).

**Değişiklik:** `KEY_VALUE_SECRET_RE` alan adı grubuna `pwd` eklenir:
`(api[_-]?key|secret|token|password|passwd|pwd|authorization)`.

**Doğrulama (yeni test):**
1. `pwd=SuperSecretPass123456` içeren bir `tool_input.command` → `pwd=[redakte]`, `flags`
   içinde `secrets_redacted`, orijinal değer hiçbir yerde geçmez.
2. Regresyon: mevcut `password`/`passwd`/`api_key` testleri değişmeden yeşil.

**Mutasyon kanıtı:** `pwd` alternatifini regex'ten çıkar → yeni test KIRMIZI → elle geri al.

## Ortak doğrulama

- Üç madde için de önce mutasyonla KIRMIZI, sonra elle geri alma + md5/`git diff` ile
  başlangıç durumuna dönüldüğü kanıtı.
- `node .claude/hooks/_selftest.cjs` → tüm vakalar (eski 33 + yeni ≥9) yeşil, sayı raporlanır.
- `npx tsc --noEmit` = 0, `npx eslint .` = 0, `npm run build` = 0.
- `npm run test` — koşan test sayısı raporlanır; port 7333 kullanıcı sürecine (PID 12932)
  bağlı 2 test hatası **beklenen**, dokunulmaz.
- `npm run e2e` — port çakışması nedeniyle muhtemelen koşulamaz, beklenen, raporlanır.
- `grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` bitişte yalnızca bilinen
  meşru isim + bu turun kendi yorumları.
- Yetim süreç kontrolü her ağır komuttan sonra; port 7333/PID 12932'ye dokunulmaz.

## GUARD.ok akışı

GG1/GG2, `.claude/hooks/gate-check.cjs` ve `.claude/hooks/block-dangerous.cjs`'e yazma
gerektirir → `docs/approvals/GUARD.ok` (tek kullanımlık) şart. Bu dosyayı ben (developer)
YAZMIYORUM — CEO'ya rapor ediyorum, CEO kullanıcıdan onay alıp yazacak. Onay dosyası
yazılmadan bu iki madde kod turuna giremez; GG3 bağımsız olarak ilerler.

## Riskler / bilerek kapsam dışı

- GG2 hâlâ bir kara liste; `Clear-Item`, sürücü harfi olmayan UNC gibi başka PowerShell
  silme yolları bu turun kapsamı dışında (brief yalnızca `-rec` boşluğunu istiyor).
- GG3 hâlâ bir kara liste; Türkçe alan adları, bölünmüş/kodlanmış anahtarlar kapsam dışı
  (denetim raporu bunu "beklenen kara liste sınırı" sayıyor, ADR-015 ile tutarlı).
- UNC uzun-yol öneki (`\\?\...`) atlatması denetim raporunda düşük öncelikli not olarak
  işaretlendi, brief bunu görev listesine almadı — kapsam dışı bırakılıyor, burada tekrar
  not düşülüyor.
