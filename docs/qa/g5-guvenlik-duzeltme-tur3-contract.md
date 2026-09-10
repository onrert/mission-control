---
type: qa-contract
gate: G5
date: 2026-09-10
tur: 3 (GUARD.ok mekanizmasının kendisi + GG1/GG2 kapanışı)
kaynak: kullanıcı kararı (2026-09-10, "kapsamı genişlet, kusuru düzelt") — docs/approvals/GUARD.ok (dört madde)
---

# Sözleşme — G5 tur 3: GUARD.ok tek-kullanımlık kusuru + GG1/GG2 kapanışı

## Ne yapacağım

Dört madde, `docs/approvals/GUARD.ok`'ta onaylı sırayla:

1. **`gate-check.cjs` — `free` listesi harf duyarsız.** Her regex'e `/i` eklenir
   (`isGuarded` zaten önceki turda düzeltildi/kapandı; bu yalnızca `free` dizisi).
2. **`block-dangerous.cjs` — `-Recurse` kısaltma zinciri.** `\bri\b[^\n]*-r(ecurse)?\b`
   yerine `\bri\b[^\n]*-r(e(c(u(r(s(e)?)?)?)?)?)?\b` (-r, -re, -rec, -recu, -recur, -recurs,
   -recurse hepsi kapsanır; zararsız `ri` kullanımı — bayraksız veya farklı bir bayrakla —
   etkilenmez).
3. **`_selftest.cjs` — GUARD.ok'ta listeli 7 vaka (a-g)** eklenir/tamamlanır.
4. **GUARD.ok mekanizmasının kendisi — kapsam listesi + kapsam başına tek tüketim.**
   Aşağıda tasarım.

## Madde 4 — mekanizma tasarımı

**Kapsam çıkarımı:** `gate-check.cjs`, `docs/approvals/GUARD.ok` dosyasının METNİNİ okur ve
içindeki backtick (`` ` ``) ile alıntılanmış, `^[\w-]+\.cjs$` veya
`^\.claude\/settings\.json$` desenine uyan token'ları **kapsam** sayar (örn. metinde
`` `gate-check.cjs` `` geçiyorsa kapsama `.claude/hooks/gate-check.cjs` eklenir). Serbest
metin (backtick dışı) kapsam SAYILMAZ — **fail-closed**: kapsam boş çıkarsa hiçbir guarded
yazmaya izin verilmez (mevcut token'ın kör onayı olarak kullanılamaz).

**Tüketim:** Kapsamdaki bir dosyaya yazmak `docs/approvals/.guard-state.json`'a (git'e
girmez, `docs/` serbest olduğu için kendisi guarded değildir) "bu dosya bu kapsamda
görüldü" diye işlenir. Kapsamdaki **TÜM** dosyalar en az bir kez görülünce GUARD.ok VE state
dosyası silinir (tüketim). Kapsamın bir kısmı görülmüşse GUARD.ok **silinmez** — sıradaki
yazmalar aynı token'la geçer.

**Kapsam dışı reddi:** Yazılan yol, çıkarılan kapsamda yoksa — token dosyası var olsa bile —
`block()` ile reddedilir (state hiç dokunulmaz, token harcanmaz).

**Bilinen sınır (bilerek, bu turda kapatılmıyor):** GUARD.ok metni kapsamı yanlış/eksik
listelerse (örn. zaten tamamlanmış bir dosyayı da anıyorsa) kapsamın tamamı hiç
"görülmeyebilir" ve token kalıcı olarak tükenmeden diskte kalabilir. Bu, eski davranıştan
(her yazmada kör tüketim) DAHA GÜVENLİDİR çünkü kapsam dışı hiçbir şeye izin vermez — ama
"tek kullanımlık" idealini tam karşılamaz. Kapatma: sıradaki GUARD.ok'lar yalnızca henüz
YAPILMAMIŞ dosyaları backtick ile ansın (aşağıda CEO'ya/raporlarda hatırlatılacak).

## Zincirleme sorun (tavuk-yumurta) — kabul edilen maliyet

`gate-check.cjs`'e yapılacak İLK Edit, PreToolUse anında hâlâ ESKİ (yazma başına kör tüketim)
kodla kontrol edilir — dosya henüz değişmemiştir. Yani madde 4'ü kuran Edit, mevcut
GUARD.ok'u ESKİ mekanizmayla (koşulsuz) tüketecektir; bu kaçınılmazdır ve madde 4'ün
metninde de öngörülmüştür ("tavuk-yumurta... önce mekanizmayı düzelt"). Bu yüzden:
- **1. token:** yalnızca `gate-check.cjs`'e (madde 1 + madde 4 TEK Edit'te) yazmak için
  harcanır — eski mekanizmayla.
- **2. token (yeni, istenecek):** madde 4 aktif olduktan SONRA `block-dangerous.cjs` (madde
  2) + `_selftest.cjs` (madde 3) için — YENİ mekanizmayla, İKİ dosya TEK token'la kapanır
  (bu, madde 4'ün asıl kanıtı, vaka f). Bu ikinci GUARD.ok'un metni yalnızca
  `` `block-dangerous.cjs` `` ve `` `_selftest.cjs` `` anmalı (gate-check.cjs'i TEKRAR
  anarsa kapsam 3 dosya olur ama 3.'sü hiç yazılmayacağı için token asla tükenmez —
  yukarıdaki bilinen sınır).

Toplam tahmini token: **2**. 1. token bu sözleşmeyle birlikte zaten mevcut olan GUARD.ok'tur.

## Nasıl doğrulanacak

**7 self-test vakası** (GUARD.ok'ta a-g olarak listeli), `_selftest.cjs`'e eklenir; her biri
`node .claude/hooks/_selftest.cjs` çıktısında `OK` satırı üretir:
- (a) `.CLAUDE/HOOKS/...` engellenir (regresyon, tur2'de zaten var)
- (b) `.claude/Hooks/...` engellenir (regresyon)
- (c) GUARD.ok varken geçer VE tüketilir (harf varyantında da) — tek dosyalık sentetik kapsam
- (d) `.claude/agents/**` / `agent-memory/**` etkilenmez (regresyon)
- (e) **YENİ** — kapsam dışı yol, geçerli (sentetik) GUARD.ok varken bile reddedilir; token
  harcanmaz (dosya hâlâ var, `_selftest.cjs` bunu doğrudan kontrol eder)
- (f) **YENİ** — iki dosyalık sentetik kapsam: ilk yazma geçer + token KALIR, ikinci yazma
  geçer + token TÜKENİR
- (g) GG2 kısaltma zinciri: `-r`,`-re`,`-rec`,`-recu`,`-recur`,`-recurs`,`-recurse` hepsi
  engellenir; bayraksız/farklı bayraklı `ri` kullanımı engellenmez (yanlış pozitif yok)

**Not:** (c)-(f) sentetik testlerde `write(GUARD_OK)` yardımcı fonksiyonu artık düz
`"selftest\n"` değil, test edilecek dosya adlarını backtick ile anan bir metin yazacak
(örn. `` "test onayı: `block-dangerous.cjs` icin" `` ) — yeni kapsam-çıkarım mantığıyla
uyumlu olması için `_selftest.cjs`'in kendisi güncellenir (madde 3 kapsamında, ayrı bir
guarded yazma gerektirmez çünkü zaten madde 3'ün parçası).

**3 mutasyon (KIRMIZI kanıtı), elle geri alma (git checkout YOK), md5/`git diff` ile
başlangıca dönüş kanıtı:**
1. `isGuarded`/`free`'deki `/i` bayraklarından birini kaldır → ilgili vaka(lar) KIRMIZI.
2. GG2 genişletilmiş grubu eski `-r(ecurse)?\b` metnine geri koy → vaka (g)'nin bazı alt
   satırları KIRMIZI.
3. **YENİ — madde 4 çiti:** kapsam kontrolünü (`scope.has(relLower)` bloğunu) kaldır/atla →
   vaka (e) KIRMIZI (kapsam dışı yol artık geçiyor demektir).

**Ortak doğrulama:**
- `node .claude/hooks/_selftest.cjs` → tüm vakalar (tur2'nin ~33'ü + yeni ≥7) yeşil, sayı
  raporlanır.
- `npx tsc --noEmit` = 0, `npx eslint .` = 0, `npm run build` = 0.
- `npm run test` — port 7333/mevcut süreç bağlı beklenen hatalar dışında kırmızı olmamalı;
  koşan/geçen sayı raporlanır. Kırmızı çıkarsa bir kez daha koşulur (vitest fork kararsızlığı
  bilinen risk, CLAUDE.md).
- `npm run e2e` — port 7333 boşsa koşulur, sayı raporlanır.
- Yetim süreç kontrolü (`tasklist` ile node.exe) her ağır komuttan sonra.
- Gerçek `G*.ok`/`DANGER.ok`/`PUSH.ok` dosyalarına dokunulmaz; `data/` değişmez.

## Kapsam dışı / dokunulmayacak

- `_common.cjs` ve diğer hook dosyaları (`asset-guard.cjs`, `stop-check.cjs`, vb.) — GUARD.ok
  metninde anılmıyor, bu turun onaylı 3 dosyasının dışında.
- `.claude/settings.json` içeriği — bu turda değişmiyor (madde 4'ün settings.json deseni zaten
  vardı, korunuyor).
- GG2'nin kara liste doğası (`Clear-Item`, UNC vb.) — kapsam dışı, önceki turlarda not edildi.
