---
type: hata
updated: 2026-09-16
sources: [docs/blockers.md, docs/qa/test-skip-gate-contract.md, docs/progress.md, docs/qa/b4-havuz-contract.md, docs/qa/b4-test-kararsizligi-contract.md, CLAUDE.md]
---
# Ölçüm kirliliği — ölçenin kendisi ölçümü bozuyor

Bir eşiği/kapıyı "geçti mi kaldı mı" diye ölçerken, ölçüm ortamının **kendisi** sonucu
kirletebilir — paralel çalışan başka bir süreç, ölçülen mekanizmanın kendi testinin kendi
kaynağına çarpması, ya da art arda koşulan bir "kampanya"nın kendi eşzamanlılığı. Bu depoda üç
bağımsız örnekte kirli bir ölçüm neredeyse yanlış bir "bozuk"/"geçilemez" kararına yol açıyordu;
üçünde de **tek, izole, temiz bir koşum** gerçeği ortaya çıkardı. İlgili: [[desen/cit-tasarimi]]
[[desen/onay-mekanizmasi-tasarimi]] [[desen/app-factory-hatti]] [[hata/claude-code-arac-tuzaklari]].

## 1. Paralel ağır turlar e2e'yi kirletti — 8/55 kırmızı → izole 55/55
B-4 test kararsızlığı araştırılırken (`docs/blockers.md` "2026-09-11 — CEO — B-4 GÜNCELLEME") aynı
makinede ağır süreçler (başka bir agent turu) koşarken `npm run e2e` **8/55 hata** verdi; hemen
ardından izole koşulduğunda **55/55**. Bu depoda geçmişte "kararsız e2e" diye kaydedilen bazı
kırmızıların bir kısmının, ürün kodundan değil, **eşzamanlı çalışan başka bir turdan** kaynaklanmış
olabileceği bu ölçümle ortaya çıktı.

## 2. Test kapısının kendi testi kendi kaynağına çarptı — sabit port 7333/7334 + paylaşılan `dist/web`
`tests/verify-test-run.test.ts`'in B1 kalıcı regresyon testi, kendi `npm run test`'ini sararken
**gerçek suite'i eşzamanlı ikinci kez** çalıştırıyordu; bu nested koşu izole olmayan paylaşılan
kaynaklara çarpıyordu: sabit port 7333/7334 (`tests/scripts/check-ports.test.ts`) ve ortak
`dist/web` derleme çıktısı (`tests/build-css.test.ts`'in gerçek `vite build` çağrıları +
`vite.config.ts`'in `emptyOutDir: true`'su). Bu, daha önce bir paralel `.claude` turunun "canlı
denetimi" diye **yanlış teşhis edilmiş** bir `EADDRINUSE`'un gerçek kaynağıydı
(`docs/qa/test-skip-gate-contract.md`, CLAUDE.md). Port/dist çakışması nested koşumdan bu iki dosya
**`--exclude`** edilerek **yapısal olarak** (olasılık azaltılarak değil) kapatıldı; önce/sonra
ölçüldü: kapatmadan önce 2/6 test EADDRINUSE ile kırmızı, kapattıktan sonra dosyalar nested koşuma
hiç girmiyor.

## 3. G6 kanıtı için 8 ardışık `verify` koşumu %50 çökme ölçtü — temiz tek koşum 3/3 yeşil
B-4'ün üçüncü ölçüm turunda (`docs/qa/b4-havuz-contract.md`, `test.projects` havuz bölme denemesi)
CEO'nun kirli ortamda (başka işler koşarken) yaptığı ölçüm **%50 çökme**, en uzun ardışık yeşil
zincir **2** verdi — bu, G6'nın "üç ardışık tam yeşil koşu" yayın şartının **karşılanamaz** ilan
edilmesine yol açabilirdi. Aynı config, aynı makine, **hiçbir şey koşmazken** yapılan ölçüm **3/3
tam yeşil** çıktı (`docs/progress.md` "2026-09-16 — G6 ONAYLANDI" §"B-4 hakkında bu turun
kesinleştirdiği iki şey"). Kayıtlı kural bir kez daha doğrulandı: kök neden hâlâ açık (üçüncü tur,
bkz. [[proje/mission-control]]) ama **hangi ortamda ölçüldüğü**, tek başına, "geçilebilir" ile
"geçilemez" arasındaki farkı belirliyordu.

## Genel kural
Bir eşik/kapı ölçümünde **önce tek, izole, temiz bir koşum** yap; kampanya (art arda N koşum,
paralel turlar) **sonra** gelsin ve yalnızca oranı/kararsızlığı karakterize etmek için kullanılsın.
İkisi çelişirse **temiz tek koşuma güven** — kirli bir kampanyanın "geçilemez" sonucu, çoğu zaman
ölçümün kendisinin kirlendiğinin kanıtıdır, mekanizmanın bozuk olduğunun değil. Bir kırmızıyı
"flaky" ilan etmeden önce her zaman sor: *"o sırada başka ne koşuyordu, ve bu ölçüm başka bir
şeyle kaynak mı paylaşıyordu (port, dizin, dosya)?"* Bu, [[desen/cit-tasarimi]] §9'daki hook
diferansiyellerinde de bir kez daha doğrulandı: paylaşılan bir scratchpad dizininin eşzamanlı
silinip yeniden kurulması, tek koşuda 3640 vektörün 2'sinde geçici/sahte bir "sızıntı" görünümü
üretti; tamamen izole, eşzamansız bir yeniden koşumda aynı 2 vektör de ENGEL çıktı (0/3640).

İlgili: [[desen/cit-tasarimi]] [[desen/onay-mekanizmasi-tasarimi]] [[desen/app-factory-hatti]]
[[hata/claude-code-arac-tuzaklari]] [[proje/mission-control]]
