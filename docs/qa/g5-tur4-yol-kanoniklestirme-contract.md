# G5 tur-4 yol kanonikleştirme — sözleşme

**Kaynak:** `docs/qa/G5-guvenlik-denetimi-2026-09-10-tur4.md` — K-A (`\\?\` uzun-yol öneki) ve
K-B (NTFS junction) kritik bulguları. Üçüncü kritik (500 karakter kırpma,
`src/features/chat/**`) bu sözleşmenin kapsamı DIŞINDA — paralel bir tur ele alıyor.

## 0. Bu düzeltme neden var (tek cümle)

`gate-check.cjs`, bir yolun `docs/approvals/` altında olup olmadığına dize karşılaştırmasıyla
(`path.relative(cwd, path.resolve(f))`) karar veriyor, ama Windows dosya sisteminde AYNI hedefe
birden çok dize temsili (verbatim `\\?\` önekli yol, ya da bir junction/symlink'in arkası) ulaşabilir
— bu düzeltmenin var olma sebebi, hook'un karar verirken **dizeyi değil hedefin gerçek dosya
sistemi kimliğini** görmesini sağlamak.

## 1. Kanonikleştirme algoritması (adım adım)

Girdi: `f` (hook'a `tool_input.file_path`/`path` olarak gelen ham dize).

1. `candidate = path.resolve(f)` — göreli ise cwd'ye göre mutlaklaştır (mevcut davranış korunur).
2. **En yakın var olan atayı bul:** `anc = candidate`, boş bir `pending` yığını ile başla.
   `fs.existsSync(anc)` `false` olduğu sürece: `pending.push(path.basename(anc))`,
   `parent = path.dirname(anc)`; `parent === anc` ise (dosya sistemi köküne ulaşıldı, var olan
   hiçbir ata bulunamadı) **çözülemedi** say (bkz. §3, fail-closed). Değilse `anc = parent`,
   döngüye devam et. (Not: proje kökü `process.cwd()` her zaman var olduğundan, pratikte bu
   döngü en kötü ihtimalle kökte durur — dosya sistemi kökü sınırına gerçek işleyişte hiç
   ulaşılmaz.)
   - Hedef zaten varsa (`.ok` dosyası üzerine yeniden yazma) döngü hiç çalışmaz, `anc = candidate`,
     `pending = []`.
3. `resolvedAnc = fs.realpathSync.native(anc)` — bu TEK çağrı hem `\\?\` önekini normalize eder
   (Windows'un verbatim yol sözdizimini çözüp normal bir mutlak yola indirger) hem de `anc`'nin
   kendisi ya da herhangi bir ata dizini bir NTFS junction/symlink/reparse point ise gerçek
   hedefi takip eder. `realpathSync` fırlatırsa → **çözülemedi** say (bkz. §3).
4. Kalan segmentleri geri ekle: `resolvedCandidate = pending.length ? path.join(resolvedAnc,
   ...pending.reverse()) : resolvedAnc`. (`pending` LIFO sırayla dolduruldu, geri eklerken
   ters çevrilir — orijinal alt yol sırası korunur.)
5. **Proje kökünü de aynı şekilde çöz:** `resolvedRoot = fs.realpathSync.native(process.cwd())`.
   Kök de bir junction/symlink üzerinden geliyor olabilir; kök çözülmezse karşılaştırma kayar.
   Bu çağrı fırlarsa → **çözülemedi** say (kökün kendisi bile çözülemiyorsa hiçbir karara
   güvenilemez).
6. `rel = path.relative(resolvedRoot, resolvedCandidate).replace(/\\/g, '/')`.
7. Bu noktadan sonra hook'un TÜM kararları (proje-dışı `..` kontrolü, `isApprovalsPath`,
   `.guard-state.json` sert engeli, `isGuarded`, `free` listesi, `G2.ok` kontrolü) **yalnızca bu
   çözülmüş `rel` üzerinden** verilir — önceki `path.relative(process.cwd(), path.resolve(f))`
   satırı tamamen bu değerle değiştirilir, ikinci bir dize yoluna düşülmez.
8. Tüm karşılaştırmalar (regex'ler) mevcut kodda olduğu gibi `/i` bayrağıyla harf duyarsız kalır
   — `realpathSync.native`'in döndürdüğü harf biçimine güvenilmez (CLAUDE.md: Windows harf
   duyarsızlığı dört kez tuzak oldu).

**Döngüsel bağlantı (symlink loop):** `fs.realpathSync.native` böyle bir döngüde Node/libuv
düzeyinde `ELOOP` fırlatır — bu da §3'teki genel "realpath fırlarsa" dalına düşer, ayrı bir kod
yolu gerekmez.

**Hedef zaten var olan bir junction/symlink'in KENDİSİYSE** (yani `Edit`/`Write` doğrudan
junction girişinin üzerine yazıyor, örn. `assets/link` klasörünün adını değiştirmeye çalışıyor
değil, `assets/link/G5.ok` gibi İÇİNE yazıyor): adım 2'de `anc` reparse point'i (junction'ın
kendisi bir dizin girdisi olarak `existsSync`'te `true` döner) bulur, adım 3 onu `realpath` ile
çözer — davranış aynı, ayrı bir dal gerekmez. Hedefin doğrudan kendisi bir symlink DOSYASIYSA
(nadir, bu depoda üretim kodu böyle bir şey oluşturmuyor) `realpathSync.native` yine hedefi
takip eder; `write-gate.ts`'in aksine burada `lstat` ile "hedefin kendisi symlink mi" ayrımı
YAPILMIYOR çünkü bu hook'un amacı "bu yazma NEREYE gerçekte ulaşıyor" sorusudur, "hedef sembolik
mi" sorusu değil — nihai gerçek konum neresiyse karar ona göre verilir.

## 2. Fail-closed kararı ve gerekçesi

`realpathSync.native` (adım 3 veya 5) fırlatırsa (ELOOP, EACCES, kopuk reparse point, vb.) ya da
adım 2'de dosya sistemi köküne ulaşılıp var olan hiçbir ata bulunamazsa: **hook `block()` ile
sert engeller** (exit 2), sessizce `process.exit(0)` ile GEÇMEZ.

**Gerekçe:** Bu hook'un tasarım amacı zaten "belirsizlikte güvenli tarafta hata yap" — mevcut
kod da proje-dışı olmayan ama sınıflandırılamayan yollarda `G2.ok` kontrolüne düşüp güvenli
tarafta kalıyor. Yol çözülemiyorsa hook'un HİÇBİR sınıflandırması (proje-içi/dışı, approvals,
guarded, free) güvenilir değildir; en güvenli hareket sessiz izin (mevcut hatanın ta kendisi)
DEĞİL, deterministik ve açık bir reddir. `ask()` (yumuşak, kullanıcıya kart) yerine `block()`
seçildi çünkü: (a) `ask()` headless bir oturumda otomatik REDDE dönüşse de bu hook'un kendi
davranışı belirsiz durumlarda zaten `block()` kullanıyor (ör. `.guard-state.json`), tutarlılık
için aynı desen izlenir; (b) çözülemeyen bir yol pratikte yalnızca bozuk/döngüsel bir
reparse point ya da erişim hatası anlamına gelir — bu, kullanıcıya "onaylıyor musun" diye
sorulacak meşru bir senaryo değil, ortamda bir şeylerin bozuk olduğunun işaretidir.

## 3. Kabul kriterleri (ölçülebilir)

Aşağıdaki her sonda **denetimin birebir kullandığı senaryo** tekrarlanacak:

1. `\\?\<proje-kökü>\docs\approvals\<gate>.ok` → `gate-check.cjs` çıkış kodu **0**, stdout
   `permissionDecision:'ask'` JSON'u (sessiz izin DEĞİL).
2. Sandbox'ta kurulan bir junction (`assets/<link>` → `docs/approvals`) üzerinden
   `assets/<link>/<gate>.ok` → aynı şekilde çıkış kodu **0** + `ask` JSON'u (junction'ın
   arkasındaki gerçek hedef görülüyor, `assets/**` serbest listesine düşmüyor).
3. `mklink /J <hedef> <proje-kökü>\docs\approvals` komutu → `block-dangerous.cjs` çıkış kodu
   **2** (junction kurulumunun kendisi de artık kabuk seviyesinde engelleniyor — derinlik
   katmanı).
4. Regresyon: mevcut 88 `_selftest.cjs` vakasının TAMAMI hâlâ geçiyor; ayrıca aşağıdaki yanlış
   pozitif kontrolleri KIRMIZI VERMİYOR: `cat docs/approvals/G2.ok`, `ls docs/approvals`,
   `git add docs/`, `git commit -m ...`, `git status`, `src/server/index.ts`'e normal yazma
   (G2.ok mevcutken serbest).
5. `realpathSync` yapay olarak fırlatıldığında (birim test seviyesinde, gerçek bir bozuk yol
   fixture'ı veya mock ile) hook **block** (exit 2) verir, sessiz geçmez.

## 4. Kabul edilmiş sınır

Bu düzeltme, **yerel kabuk erişimi olan barındırılan bir ajana karşı MUTLAK bir koruma
sağlamaz** (`ADR-016`'nın zaten kabul ettiği sınırın bir devamı). Hook derinlik katmanıdır;
asıl savunma kullanıcının gördüğü Bash izin kartıdır (`canUseTool`, ADR-014). Bu turun kapattığı
şey, hook'un KENDİSİNİN iki spesifik dize/dosya-sistemi hilesine (`\\?\` öneki, junction) karşı
KÖR olmasıdır — hook artık bu iki hileyi görüyor ve aynı karara (ask/block) tabi tutuyor. Hook
hâlâ bir kara liste + dize/regex sınıflandırmasıdır (Katman B özelinde); `block-dangerous.cjs`'in
zaten dürüstçe belgelenmiş kör noktaları (ayrı dosyaya yazılmış betik çalıştırma, npm script
üzerinden yazma, HTTP endpoint'i) bu turda KAPATILMIYOR — onlar Soru 1'in Bash kartına
dayanıyor ve bu sözleşmenin kapsamı dışında (500 karakter kırpma düzeltmesi ayrı bir tur).

`mklink` eklemesi tek başına yeterli değildir (brief madde 3.3) — asıl düzeltme §1'deki
kanonikleştirmedir; `mklink`'in engellenmesi yalnızca derinlik katmanını tutarlı hale getirir
(aynı sonucu üreten `New-Item -ItemType Junction` zaten engelleniyordu, `mklink /J` engellenmiyordu).
