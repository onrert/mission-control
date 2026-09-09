---
type: hata
updated: 2026-09-10
sources: [CLAUDE.md, docs/progress.md, docs/qa/test-skip-gate-contract.md]
---
# Claude Code araç tuzakları (App Factory kurulumu)

Kurulum sırasında (bkz. [[desen/app-factory-hatti]]) rastlanan tekrar eden araç davranışları ve
çözümleri; CLAUDE.md "Öğrenilen kurallar" bölümünden derlendi.

## 1. Bash heredoc çift ters bölüyü teke düşürüyor
**Belirti:** Ters bölü içeren JS regex'li dosyalar (ör. Windows yol ayracını değiştiren `replace`) Bash heredoc ile yazılınca bozuluyor.
**Kök neden:** Bash heredoc içeriği shell tarafından işleniyor, `\\` → `\`'ya düşüyor.
**Çözüm:** Ters bölü içeren dosyaları Bash ile yazma; Write aracını kullan ve `node --check` ile doğrula. Not: bu kuralın kendisi de ilk yazımda aynı hataya takıldı — kural yazılırken bile tuzağa düşüldü.

## 2. Heredoc içindeki kaçış dizileri kontrol karakterine dönüşüyor
**Belirti:** `\a` gibi diziler heredoc içinde literal metin değil kontrol karakteri olarak yorumlanıyor.
**Kök neden:** Shell heredoc genişletmesi kaçış dizilerini işliyor, dosya içeriği bozuluyor.
**Çözüm:** Aynı çözüm — Write aracı kullan, dosya içeriğini Bash heredoc'a gömme.

## 3. Hook'lar yazıldıkları oturumda anında aktifleşiyor
**Belirti:** Hook kuran/dokümante eden komutlar kendi regex'lerine takılıp kendini engelliyor.
**Kök neden:** Hook dosyaya yazılır yazılmaz aynı oturumda devreye giriyor; kurulum komutunun metni de hook'un taradığı girdiye dahil oluyor.
**Çözüm:** Tetikleyici komut metnini Bash'e gömme, dosyayı Write ile yaz.

## 4. ToolSearch/SendMessage yok
**Belirti:** Bir alt agent'ın işini başka bir agent'a "devam ettir" diye aktarmak mümkün değil.
**Kök neden:** Bu ortamda ToolSearch kapalı, dolayısıyla SendMessage de yok; agent'lar birbirinin geçmişini görmüyor.
**Çözüm:** Yeni agent aç, brief'i eksiksiz tekrar yaz.

## 5. `claude plugin validate` agent klasörüne uygulanmıyor
**Belirti:** Komut agent/skill klasörlerini doğrulamıyor.
**Kök neden:** Komut plugin manifesti bekliyor, agent klasörü manifest formatında değil.
**Çözüm:** Agent/skill frontmatter'ını `name` + `description` grep'iyle elle doğrula.

## Çelişki (2026-09-10, kaynak: CLAUDE.md "Öğrenilen kurallar")
Madde 4 ("ToolSearch/SendMessage yok") bu projede **geçersiz** hâle geldi. İlerleyen fazlarda
(F-012'de dokuz kez) `SendMessage`'ın bu ortamda **var olduğu** ve tur sınırına takılan bir alt
agent'ın bağlamı korunarak devam ettirilebildiği ölçüldü — bu, brief'i sıfırdan yazmaktan çok
daha ucuz ve güvenli. Devam brief'i kısa tutulmalı: (1) diskteki ölçülmüş durum, (2) commit
edilmemiş dosyaların listesi, (3) "önce commit at" talimatı **turun ilk maddesi** olarak (yalnızca
"ara sıra commit at" demek dokuz turun dokuzunda da 150 tur sınırına takılmayı önlemedi), (4)
kalan iş. Kesilen agent'ın kendi son cümlesini brief'e koymak nerede kalındığını en iyi anlatır.
Madde 4 silinmedi; bu blok onu geçersiz kılıyor, orijinal ortamda (ToolSearch kapalıyken) hâlâ
doğru olabilir.

## 6. Tek kullanımlık onay dosyası, komut hiç çalışmasa bile tüketiliyor
**Belirti:** Onay gerektiren bir komut zincirinin (`onay-dosyası-ekle && komut`) ilk parçası
başarısız olduğunda bile, hook'un ürettiği tek kullanımlık onay dosyası siliniyor; asıl komut hiç
çalışmadan onay boşa gidiyor. İki kez gözlendi; ikincisinde zincir `git add` "pathspec did not
match" ile patladığı için `&&` kırıldı ve asıl komut **hiç çalışmadı**.
**Kök neden:** Onay token'ı `PreToolUse` aşamasında, komutun çalışıp çalışmadığına bakılmaksızın
tüketiliyor.
**Çözüm:** Onay gerektiren komutu **tek başına, kendi çağrısında** çalıştır — öncesine/sonrasına
hiçbir şey zincirleme. Token boşa gittiyse kullanıcı onayı hâlâ geçerlidir: onay dosyasını aynı
kapsamla yeniden yaz (neden yenilendiğini içine not düş) ve komutu tekrar çalıştır; yeniden onay
isteme.

## 7. Korunan komut adını anan her metin hook'a takılabilir
**Belirti:** Yalnızca korunan komutun kendisini çalıştırmak değil, o komutun adını **anan** bir
metni (bir commit mesajı, bir ADR'nin açıklama paragrafı) Bash'e göndermek de aynı hook'u
tetikleyip komut zincirinin tamamını (dosya yazımı dahil) engelledi.
**Kök neden:** `PreToolUse` hook'u komutun **tümünü** metin olarak görüyor; hook regex'i komutu
çalıştırma niyetini değil, o dizgenin **varlığını** arıyor.
**Çözüm:** Korunan komut adlarını (yayın, uzak depoya gönderme, yıkıcı silme) içeren hiçbir metni
Bash komut satırına gömme — ne heredoc gövdesinde ne commit mesajında. Metni önce bir dosyaya
(Write aracıyla) yaz, sonra dosya üzerinden uygula (`git commit -F dosya` gibi).

## 8. Gerçek test suite'ini alt süreç olarak çalıştıran bir test, kendini dışlamazsa fork bomb üretir
**Belirti:** Bir bütünlük çitini ("test dosyası düşürülürse fark edilir mi") gerçek `vitest`
komutunu gerçek suite üzerinde çalıştırarak doğrulayan kalıcı bir regresyon testi eklenince,
185+ `node.exe` süreci birden ortaya çıktı.
**Kök neden:** Spawn edilen suite'in kendisi, o testi barındıran dosyayı da kapsıyordu; test
kendi kendini yeniden tetikleyip yeni bir suite daha başlattı — üstel büyüme.
**Çözüm:** Gerçek suite'i alt süreç olarak çalıştıran her test, kendi dosyasını **açıkça**
`--exclude` listesine eklemeli. (`docs/qa/test-skip-gate-contract.md` madde 3b.)

## 9. `.gitattributes`'ın `eol=lf` normalizasyonu bozuk-satır-sonu fixture'ını sessizce düzeltebilir
**Belirti:** CRLF/BOM içermesi **gerekli** bir test fixture'ı, commit edildikten sonra (veya temiz
bir klonda) satır sonlarının LF'ye normalize edilmesiyle amacını kaybedebilir.
**Kök neden:** Depo kökündeki genel `eol=lf` kuralı, `text` özelliği `unset` olmadığı sürece metin
dosyası sayılan her şeyi normalize eder; bir "bozuk format" fixture'ı için bu normalizasyon
sessizce çalışır ve kimse fark etmez.
**Çözüm:** Bu tür fixture'ların bulunduğu dizine kendi `.gitattributes`'ını (`* -text`) koy ve
normalizasyonun etkisiz kaldığını **üç noktada** ölç: diskte, `git show`'un döndürdüğü blob'da,
ve temiz bir `git clone`'da (`docs/qa/F-009-2026-09-09.md`, "bom-crlf fixture'ı gerçekten CRLF
mi" ölçümü).

İlgili: [[desen/app-factory-hatti]] [[proje/gorev-listesi-denemesi]] [[desen/cit-tasarimi]]
