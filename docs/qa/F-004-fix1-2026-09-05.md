KARAR: GEÇTİ
ESKALE: false

# F-004 QA — düzeltme turu 1 doğrulaması (qa-evaluator, 2026-09-05)

Dar tur. Kapsam: yalnızca **B1 · Ö1 · Ö2 · N1 · N2**'nin kapanışı + düzeltmenin ürettiği regresyon.
Yeniden açılmayanlar (önceki turda denetlendi): AC1-AC4, AC6, CEO kararları A/B/C/D,
`install-hook` güvenliği, kapsam denetimi, güvenlik taraması, AC5 kanıtının kendisi.
BUG-001 karara katılmadı (F-002 kodu, kapsam dışı).
Önceki tur: `docs/qa/F-004-2026-09-05.md` (KALDI). Düzeltme commit'i: `777b997`.

**Tek cümlelik karar:** Kaçan iki mutasyonun ikisi de artık **kendi ölçtüğüm** mutasyonlarla
KIRMIZI veriyor, ürün kodu değişmedi, AC5 yazımı tamamlandı; 145 ms eşiğinin dar olduğu doğru
ama 70+ örnekte (yük altında dahil) **bir kez bile** kırılmadı — kalan iki risk NOT seviyesinde.

---

## 1. Komutlar ve gerçek çıktılar

| Komut | Çıkış kodu | Sonuç |
|---|---|---|
| `npm run verify` | **0** | `Test Files 14 passed (14)` · `Tests 185 passed (185)` · `vite build ✓ built in 925ms` |
| `npm run e2e` | **0** | `1 passed (5.5s)` — `tests\e2e\shell.spec.ts:9` |
| `npm run e2e:dev` | **0** | `1 passed (4.4s)` — `tests\e2e\dev-shell.spec.ts:6` |
| `npx vitest run tests/integration/send-event-hook.test.ts` ×10 (art arda) | **0** ×10 | `Tests 17 passed (17)` — **10/10** |
| `npx vitest run …` ×3 (24 süreçlik CPU yükü altında) | 1 · 1 · **0** | Kıran assert **her seferinde eski** `elapsedMs < 1000` (1042-1552 ms); **yeni 145 ms assert'leri hiç kırılmadı** |

Test sayısı 185'te sabit — düzeltme yeni test eklemedi, mevcut iki teste assert ekledi
(`send-event-hook.test.ts:240` ve `:264`). Bu doğru karar: ölçülen davranış aynı senaryonun
parçası, ayrı test yeni bir süreç doğuşu ve yeni jitter demek olurdu.

## 2. Kapanış tablosu

| # | Bulgu | Durum | Kanıt |
|---|---|---|---|
| **B1** | `clearTimeout(stdinGuard)` düzeltmesi korumasız | **KAPANDI** | `send-event-hook.test.ts:255-264` alt sınır assert'i. Kendi mutasyonum (M1) KIRMIZI: `AssertionError: expected 129 to be greater than or equal to 145` (4 koşuda 129/122/133/123) |
| **Ö1** | idle bekçisi ölçülmüyor, iki katman ayırt edilmiyor | **KAPANDI** | `send-event-hook.test.ts:234-240` üst sınır assert'i. Kendi mutasyonum (M2) KIRMIZI: `expected 151 to be less than 145` (3 koşuda 151/150/162). **Ayırt etme kanıtı:** idle silinince sessiz senaryonun süresi 103-117 ms bandından 150-162 ms bandına, yani **toplam bekçiye kaydı** — iki katman fiilen ayrışıyor |
| **Ö2** | AC5'in "`KURULUM.md`'ye yazılır" yarısı | **KAPANDI** | `KURULUM.md:92-100`: tarih (2026-09-05) · gözlenen alanlar (`PreToolUse` · `tool_name: Bash` · `session_id` · `transcript_path` dolu · `client_version: 1` · `flags: []`) · `.seq` tutarlılığı (4 → 9) · altı güvenlik hook'unun adı. Bağımsız teyidim: `.seq = 15`, `2026-09-04.jsonl` 13 + `2026-09-05.jsonl` 2 = **15 satır**, kayma yok |
| **N1** | geliştirici notu kullanıcı akışının önünde | **KAPANDI** | Blok `KURULUM.md:1-10`'dan `:102-113` "## Not (geliştirici notu, kod turu)" başlığına taşındı; dosya artık `:3` "Bu belge … nasıl kuracağınızı … anlatır" ile açılıyor. İçerik korunmuş (silinmemiş) |
| **N2** | BUG-001 kapsam dışı | **DOĞRU İŞLEM** | Dokunulmadı; `docs/progress.md` gerekçeyi yineliyor. Bu turda da karara katılmadı |

## 3. Kendi mutasyon turum (düzeltmenin gerçekten ölçtüğünü kanıtlayan)

| # | Mutasyon | Kırmızı veren test | Hata mesajının ilk satırı | Geri alındı |
|---|---|---|---|---|
| **M1** | `send-event.cjs:251` `clearTimeout(stdinGuard)` silindi | `send-event-hook.test.ts` › "damla sunucu (b) — yalnızca toplam süre bekçisi tetiklenir" | `AssertionError: expected 129 to be greater than or equal to 145` | ✓ `git checkout --` (2 kez uygulandı, 2 kez geri alındı) |
| **M2** | `send-event.cjs:172-175` `req.setTimeout(IDLE_TIMEOUT_MS, …)` bloğu silindi | `send-event-hook.test.ts` › "sessiz sunucu (a) — yalnızca idle bekçisi tetiklenir" | `AssertionError: expected 151 to be less than 145` | ✓ `git checkout --` |

Her iki mutasyonda da **yalnızca hedeflenen test** kırmızı oldu (16 passed | 1 failed) — assert'ler
dar, yanlış yere dokunmuyor. Önceki turda bu iki mutasyon 185/185 yeşil geçiyordu; **kaçak kapandı.**

## 4. 145 ms eşiği kırılganlık analizi

Ölçüm yöntemi: testteki `startDripServer`/`startSilentServer` birebir kopyalanarak bağımsız bir
harness'ta (`…scratchpad\measure.cjs`, depo dışında) çalıştırıldı; `socketLifetimeMs` aynı şekilde
TCP kabulünden soket `'close'`'una ölçüldü (`Date.now()` ve `process.hrtime` birlikte — sapma <1 ms).

| Senaryo | n | Ölçülen `socketLifetimeMs` min/maks | Ortalama | Eşiğe pay |
|---|---|---|---|---|
| Damla, **düzeltme yerinde**, boşta makine | 20 | **148 / 164** | 155.4 | +3 ms (alt) |
| Damla, **düzeltme yerinde**, 24 süreç CPU yükü | 20 | **147 / 184** | 158.7 | +2 ms (alt) |
| Damla, **düzeltme yerinde**, 32 süreç CPU yükü | 18 | **148 / 163** | 154.2 | +3 ms (alt) |
| Damla, **B1 mutasyonlu** | 15 | **114 / 133** | 125.4 | −12 ms (üst) |
| Sessiz, düzeltme yerinde, boşta | 20 | **103 / 117** | 111.7 | −28 ms |
| Sessiz, düzeltme yerinde, yük altında | 10 | **107 / 118** | 113.3 | −27 ms |
| Sessiz, **Ö1 mutasyonlu** | 3 (test) | **150 / 162** | — | +5 ms |

**Toplam 70+ doğru-kod örneği ve 13 gerçek test koşusunda eşik bir kez bile kırılmadı.**
İki dağılım arasındaki boşluk 133 → 147 = **14 ms**; eşik bu boşluğun ortasında değil, **üst
ucuna yakın** (145) duruyor: mutasyon tarafında 12 ms, doğru-kod tarafında yalnızca 2-3 ms pay var.
Yani hata modu asimetrik — kırılırsa **yanlış KIRMIZI** (sağlam kodu suçlar), yanlış YEŞİL değil.

**Kayma yönü ölçüldü:** yük arttıkça ortalama **yukarı** gidiyor (155.4 → 158.7), yani alt sınırdan
**uzaklaşıyor**. Yapısal neden: ölçülen süre `TOTAL_TIMEOUT_MS`(150) − bağlanma gecikmesi +
kapanış gözlem gecikmesi; yavaş makinede ikinci terim birinciden hızlı büyüyor. Ayrıca ölçüm
spawn'dan değil TCP kabulünden başladığı için Node soğuk başlangıcı (bu makinede ~120 ms, yük
altında ~1.5 s) tamamen dışarıda — **eski `elapsedMs < 1000` kapısından belirgin biçimde daha
sağlam.** Yük altında ilk kırılan hep o eski kapı oldu (§1, 1042-1552 ms), yeni assert'ler değil.

**Karar:** kırılganlık **kanıtlanamadı** → GEÇTİ bu maddeye takılmıyor. Kalan ince pay iki NOT
olarak kaydedildi (N3, N4).

## 5. `socketLifetimeMs` doğru şeyi mi ölçüyor? (yan bulgu denetimi)

Developer'ın `socket.resume()` gerekçesi **doğru ve gerekli** — ölçtüm:

| Kurulum | Damla `socketLifetimeMs` | Sessiz `socketLifetimeMs` |
|---|---|---|
| `socket.resume()` **var** (yayınlanan) | 148-164 ms | 103-117 ms |
| `socket.resume()` **yok** | **228-240 ms** | **hiç gelmedi (>6000 ms)** — çocuk süreç 213-237 ms'de çıkmış olmasına rağmen |

Yani `resume()` olmadan ölçüm tamamen test altyapısının artefaktı olurdu (sessizde `'close'` hiç
tetiklenmiyor, damlada ~80 ms şişiyor). `resume()` ile ölçülen değerler ürün sabitlerine oturuyor:
sessiz ≈ `IDLE_TIMEOUT_MS`(100) + ~10 ms, damla ≈ `TOTAL_TIMEOUT_MS`(150) + ~5 ms. Sunucu tarafında
okunan baytlar istemcinin idle sayacını etkilemiyor (idle, istemcinin kendi soket etkinliğine bakar;
damla senaryosunda sayacı ayakta tutan şey sunucunun **yazması**, tüketmesi değil) — dolayısıyla
`resume()` **hangi bekçinin ateşlediğini değiştirmiyor**, yalnızca kapanışın gözlenmesini sağlıyor.
Ölçüm scriptin gerçek yaşam süresini (daha doğrusu `req.destroy()` + `exit(0)` anını) ölçüyor. ✓

## 6. Regresyon ve kapsam

- `git diff 777b997~1..777b997 --stat` → yalnızca 4 dosya: `KURULUM.md` (32) ·
  `docs/features/F-004-send-event-hook.md` (2) · `docs/progress.md` (69) ·
  `tests/integration/send-event-hook.test.ts` (70). `src/` ve `scripts/` yok.
- `git diff bcb48dc..HEAD -- .claude/hooks/ scripts/` → **tamamen boş**. Ürün kodunda kalıcı
  değişiklik yok, developer'ın iddiası doğrulandı.
- Yeni assert'ler mevcut testlerin sonuna eklendi; diğer 183 test etkilenmedi (185/185 yeşil).
- Yeni testler bir kez kırıldığında hata mesajı ölçülen değeri yazıyor (`expected 129 to be …`) —
  gelecekte eşik yeniden kalibre edilmesi gerekirse gereken sayı hatanın kendisinde.

## 7. Bulgular (0 BLOKLAYICI · 0 ÖNEMLİ · 2 yeni NOT)

**N3 — 145 ms eşiği iki dağılımın ortasında değil, üst ucunda**
- **Dosya:** `tests/integration/send-event-hook.test.ts:240` ve `:264`
- **Ölçüm:** doğru kod 147-184 (n=58), B1 mutasyonlu 114-133 (n=15). Boşluk 14 ms; eşik alt sınıra
  **2-3 ms**, üst sınıra 12 ms uzakta.
- **Etki:** bugün kırılmıyor (70+ örnek, yük altı dahil) ve kayma yönü yukarı, ama pay dar.
  Kırılırsa yanlış KIRMIZI verir — güvenli yön, yine de gürültü.
- **Öneri (ucuz):** eşiği **140**'a çek (her iki yönde ~7 ms pay) **veya** `:519`'daki sabit
  testinin zaten kaynaktan okuduğu değerlerden türet (ör. `STDIN_TIMEOUT_MS` ile
  `TOTAL_TIMEOUT_MS`'in ortası). Şu hâlde 145 iki yerde çıplak sabit ve sabitler değişirse
  sessizce anlamsızlaşır.

**N4 — `await socketLifetimeMs` sınırsız: aşırı yük altında assert yerine 5 sn'lik asılma**
- **Dosya:** `tests/integration/send-event-hook.test.ts:239` ve `:263`
- **Tekrar üretme:** 32 süreçlik CPU doygunluğu altında harness'ı çalıştır → 18 koşunun 3'ünde
  sunucu tarafı `'close'` olayı çocuk süreç çıktıktan (`exitCode 0`, 1.2-2.4 s) sonra **15 sn
  içinde hiç gelmedi**. Damla `setInterval`'ı ölü akrana yazmaya devam ettiği için soket
  kapanışının gözlenmesi gecikiyor.
- **Etki sınırlı:** gözlenen tüm asılma vakalarında çocuk süreç >1000 ms sürmüştü, yani aynı testte
  **önce gelen** `expect(result.elapsedMs).toBeLessThan(1000)` zaten kırmızı veriyor. Pratikte yeni
  bir kırılganlık eklemiyor, yalnızca sıralama değişirse hata mesajı anlaşılmaz bir timeout olur.
- **Öneri:** `await Promise.race([socketLifetimeMs, timeout(2000)])` ve `null` gelirse açık bir
  assert mesajı ("soket kapanışı gözlenemedi") — tek satır, teşhis değerini korur.

*(Bilgi, kapsam dışı, bulgu değil:* eski `expect(result.elapsedMs).toBeLessThan(1000)` kapısı ağır
yük altında ilk kırılan şey; 24 süreçlik yükte 3 koşunun 2'si bu yüzden kırmızı oldu. Bu assert
önceki turda onaylandı ve ürün davranışını doğru koruyor — CI donanımı zayıfsa ilk kalibre
edilecek yer burasıdır, 145 ms değil.)*

## 8. Çalışma ağacı ve süreç temizliği

- `git status --porcelain` → **boş**. `git diff HEAD` → **boş** (`--stat` çıktısı yok).
  `git diff HEAD -- .claude/ scripts/ src/ tests/ package.json` → **boş**. Üç mutasyon uygulaması
  (M1 ×2, M2 ×1) `git checkout --` ile geri alındı, her birinden sonra `grep` ile teyit edildi
  (`251:  clearTimeout(stdinGuard)`, `172: req.setTimeout(IDLE_TIMEOUT_MS, …)`).
- Commit atılmadı, `git push` çalıştırılmadı, `install-hook` hiçbir hedefe çalıştırılmadı.
  Ölçüm harness'ı depo dışında (scratchpad) tutuldu.
- **Portlar:** `netstat -ano | grep -E ":(7333|7334|7433|7434)\s"` → dördü de **boş** (dinleyici de
  `TIME_WAIT` de yok).
- **Süreçler:** kalan iki `node.exe` (PID 28140, 31612) `@playwright/mcp` araç sunucusudur
  (`Win32_Process.CommandLine` ile doğrulandı, 04:29'da oturum başında doğdu). Yük üretmek için
  açtığım 80 geçici `node` süreci kendi kendini sonlandırdı (`wait` ile beklendi); yetim
  `npm run dev` / `tsx` / `vite` / `vitest` süreci **yok**.

## 9. Puanlar

| Boyut | Puan | Önceki | Gerekçe |
|---|---|---|---|
| **İşlevsellik** | **8** / 10 | 8 | Değişmedi (ürün kodu değişmedi); `verify`/`e2e`/`e2e:dev` üçü de 0, canlı hat hâlâ olay üretiyor (`.seq = 15`, kayma yok). |
| **Özellik bütünlüğü** | **9** / 10 | 8 | AC5'in açık kalan yarısı (`KURULUM.md`'ye yazım) kapandı; 6 AC'nin altısı da tam. |
| **Görsel / UX** (`KURULUM.md`) | **9** / 10 | 8 | Belge artık kullanıcı cümlesiyle açılıyor, doğrulanmış sonuç somut alan listesiyle yazılı, geliştirici notu sona taşındı ama silinmedi (geçmiş korunuyor). |
| **Kod kalitesi** (testler, hata yönetimi) | **8** / 10 | 6 | Önceki turun iki kaçağı da kapandı ve bunu **kendi mutasyonlarımla** doğruladım; ölçüm tekniği (TCP kabulünden kapanışa) süreç doğuşu jitter'ını dışarıda bırakarak mevcut `elapsedMs` kapısından daha sağlam bir kanıt üretiyor, `socket.resume()` gerekçesi ölçümle teyitli ve yorumlarda belgeli. 10 değil: 145 iki yerde çıplak sabit ve dağılımın ortasında değil (N3), `await socketLifetimeMs` sınırsız (N4). |

**Karar gerekçesi (tek paragraf):** Düzeltme turu, önceki turun tek bloklayıcısını ve iki önemli
bulgusunu kanıt üreterek kapattı: developer'ın kendi bulduğu yetim-zamanlayıcı hatasını geri
koyduğumda artık 185 test yeşil kalmıyor, "damla sunucu (b)" testi `expected 129 to be greater
than or equal to 145` ile kırmızı veriyor; idle bekçisini sildiğimde "sessiz sunucu (a)" kırmızı
veriyor ve süre 103-117 ms bandından 150-162 ms bandına, yani toplam bekçiye kayıyor — sözleşmenin
"iki katman bağımsız olarak kanıtlanır" iddiası ilk kez fiilen doğru. Bunu ürün kodunda tek satır
değiştirmeden, yalnızca test enstrümantasyonuyla yaptılar (`git diff bcb48dc..HEAD -- .claude/hooks/
scripts/` boş), AC5'in eksik kalan yazım yarısını gözlenen alanlarla `KURULUM.md:92-100`'e işlediler
ve N1'i içeriği silmeden taşıyarak kapattılar. En çok şüphelendiğim yer olan 145 ms eşiğini 70'ten
fazla örnekle, boşta ve 24/32 süreçlik CPU doygunluğu altında ölçtüm: bir kez bile kırılmadı, kayma
yönü alt sınırdan uzağa (yukarı) ve yük altında ilk kırılan şey yeni assert değil, önceki turda
onaylanmış eski `elapsedMs < 1000` kapısı oldu; payın dar (2-3 ms) ve asimetrik olması gerçek ama
hata modu yanlış-KIRMIZI, yani sağlam kodu yanlışlıkla geçiren değil, gürültü üreten yönde — bu
yüzden spekülasyonla değil ölçümle NOT'a indirdim. Açık BLOKLAYICI/ÖNEMLİ kalmadı, dört boyutun
en düşüğü 8, karar **GEÇTİ**; N3 (eşiği 140'a çek veya sabitlerden türet) ve N4 (`socketLifetimeMs`
beklemesini sınırla) bir sonraki dokunuşta ucuza kapanır, F-003'ü bloklamaz.

---

**Sonraki adım:** feature notu `status: done`. F-004 kapandı. Sıradaki: **F-003 (SSE)** — öncesinde
BUG-001 (F-002 `deriveSummary` 200 karakter kırpmıyor) kapatılmalı, çünkü 732 karakterlik özet
SSE zaman çizelgesinin satır düzeni varsayımını bozar.
