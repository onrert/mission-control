# HANDOFF — oturum kesilirse buradan devam et

> Her zaman güncel "nerede kaldık" notu. `docs/progress.md` tarihsel kayıttır; burası yalnızca
> **şu anki durumu** anlatır. Yeni oturumda önce bunu oku.

**Son güncelleme:** 2026-09-06 · CEO

---

## Tek cümle
**Faz 1 bitti (7/7 feature `done`).** Kullanıcı paneli denedi ve yön değiştirdi: panel artık
salt-izleyici kalmayacak, **CEO oturumunu kendi içinde barındıracak** (`ADR-014`). Sırada
**F-012 sohbet arayüzü**, sözleşme + UX turu **şu anda çalışıyor**.

## Güvende olan
- Faz 1: 7 feature `done`, **732 birim + 23 E2E testi**, CI Windows'ta yeşil, 14 ADR.
- Kapılar G0-G3 onaylı. **G4-1 ONAYLANMADI** — kullanıcı "henüz değil" dedi, gerekçesini
  söylemedi. Sorulacak; `docs/approvals/G4-1.ok` YAZILMAYACAK.
- **Push güncel:** 2026-09-06'da 37 commit push'landı (`eb1e415`). Kapı yeniden kapalı —
  her push ayrı onay ister; CEO `docs/approvals/PUSH.ok` yazar, hook kullanınca **siler**
  (tüketildiği doğrulandı).

## Son biten: F-014 masaüstü uygulaması — **QA GEÇTİ, `done`**
Panel artık Electron uygulaması. Çift tıkla açılıyor, **terminal komutu gerekmiyor**, sohbet
varsayılan açık, pencere kapanınca tepside çalışmaya devam ediyor, tepsiden "Çıkış" her şeyi
kapatıyor.

**Ölçülen kapanış:** `verify` = 0 (**892 test + 2 atlandı / 65 dosya**) · `e2e` = 0 (23/23) ·
`e2e:electron` = 0 (3/3) · `tests/electron` = 27/27 · puanlar 8/8/7/8.
Paket **631 MB**, `release/Mission Control-win32-x64/mission-control.exe`
(2026-09-06 20:42'de düzeltmelerle **yeniden paketlendi**; `diff -rq` ile depo ağacıyla birebir
aynı olduğu doğrulandı).

**Turlar:** ölçüm+sözleşme → 2 kod turu → 3 QA turu → 3 düzeltme turu.

**QA'nın yakaladığı üç ciddi şey:**
1. **Masaüstü oturumunda güvenlik kapıları KAPALIYDI** — oturum paketlenmiş kopyada çalışıyordu,
   orada `.claude/settings.json` yoktu. Bu deponun en pahalı hata sınıfının tekrarı. Artık oturum
   gerçek proje dizininde çalışıyor **ve hook bulunamazsa oturum hiç açılmıyor**.
2. **Port doluyken hiç diyalog çıkmıyordu**, 7 sn sonra sessiz ölüm (F-001'in N4 dersinin tekrarı).
3. **Açılışta kullanıcı yazmadan ücretli tur koşuyordu** — uygulama Windows açılışında da
   başladığı için her gün kota yakacaktı. Oturum artık **tembel**: ilk mesaja kadar sıfır çağrı,
   gerçek `.exe` ile canlı kanıtlandı.

**Kalan açık maddeler (bloklayıcı değil):**
- Masaüstünde Kanban boş (`userData/data` ayrı veri kaynağı) — kabul edilmiş sınırlama.
- Ö1 açılış marker'ı bu makinede duruyor; N3 hata penceresi metni kırpılıyor.
- Sohbette araç satırları yenilemede kayboluyor (F-010'a devredildi).

## Faz 2 sırası (kullanıcı kararlarıyla güncel)
| # | Feature | Durum |
|---|---|---|
| F-012 | CEO sohbet arayüzü | **aktif** — sözleşme + UX turu |
| F-013 | Feature penceresinde içerik (gövde + sözleşme + QA raporları) | todo — F-012'den sonra |
| F-008 | Kapılar paneli | todo |
| F-009 | Transkript keşif turu | todo |
| F-010 | Thread görünümü (agent mesajları) | todo |
| F-011 | Token kullanımı | todo |

**F-013 neden var:** kullanıcı 2026-09-06'da "feature'ların içinde neler yapıldığı görünmüyor"
dedi. Pencere şu an yalnızca frontmatter gösteriyor, gövde sunucuda hiç okunmuyor. Ucuz yarısı
(bizim markdown'larımız) F-013; pahalı yarısı (agent transkriptleri, belgesiz format) F-009+F-010.
Sıralamayı kullanıcı seçti.

## Kullanıcıda bekleyen
- **G4-1:** Faz 1 kilometre taşı — "henüz değil" dedi, **nedenini sormak lazım**.
- **Push:** ~14 commit bekliyor.
- **F-012'nin politika riski** kabul edildi (`ADR-014`): araç dağıtılmayacak. Dağıtım gündeme
  gelirse ADR yeniden açılır.

## Bu projede tekrar eden ders: "yeşil ama hiçbir şey ölçmeyen test"
Faz 1 boyunca **on ikiden fazla** kez çıktı. **Kural:** her feature'da mutasyon zorunlu
(uygula → KIRMIZI gör → geri al). Yeşil kalan mutasyon = ölçmeyen test = bulgu.

Aynı kural spike'lara da uygulandı: F-012'nin Aşama 0 ölçümünde hook engellemesi **iki yönlü**
kanıtlandı (hook aktifken engellendi, hook no-op yapılınca aynı komut geçti). Tek yön hiçbir şey
kanıtlamaz.

## Alt agent yönetimi
- Brief'lere **"her 2-3 adımda ara commit at"** yaz — tur sınırında iş kaybını ölçülür biçimde
  azalttı.
- Kesilen agent devam ettirilemez → diskteki gerçek durumu ölç, yeni agent'a eksiksiz devir yaz.
- **Kesinti sonrası ilk iş: mutasyon artığı ara** (`grep -rn "MUTATION\|MUTASYON" src/ tests/`).
- Alt agent'lar çalışırken onların sahip olduğu dosyalara **dokunma**; CEO commit'lerinde
  `git add -A` yerine kendi dosyalarını tek tek ekle.

## Çalışma düzeni (kullanıcı kararları)
- Platform **yalnızca Windows** (ADR-009); CI tek `windows-latest` + ayrı E2E job'ı.
- Her feature: sözleşme turu → kod turu → QA → düzeltme.
- Kullanıcı **ara demo istemiyor**; kesintisiz ilerle.
- Kullanıcı **kısa ve sade cevap** istiyor; uzun teknik anlatım değil.
- Alt agent'lar **arka planda** çalıştırılır — CEO'nun boşta kalma oranını (%87.5) bu sağlıyor
  ve F-012'nin "agent çalışırken konuşabilme" gereksinimi buna bağlı (`SPIKE-001` §7).
