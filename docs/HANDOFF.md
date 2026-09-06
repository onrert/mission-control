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

## Aktif iş: F-012 CEO sohbet arayüzü
Panel, CEO oturumunu `@anthropic-ai/claude-agent-sdk` ile barındırır ve sohbet arayüzü olur.

**SÖZLEŞME TURU KAPANDI — QA GEÇTİ** (3 tur: 7+13 bulgu → 3 yeni bloklayıcı → kapanış).
`docs/qa/F-012-contract.md` · raporlar `F-012-contract-review-{1,2,3}.md` · UX `docs/03-ux.md` §7.
Feature notu `status: contract`.

**SONRAKİ ADIM: KOD TURU.** Kullanıcı kararı: opus limiti sıfırlanınca (05:00) başlatılacak —
bu tur güvenlik çitlerini kuruyor, sonnet'le yapılmayacak.

**Kod turunun ZORUNLU ilk işi (sözleşme §8a):** `managedSettings` +
`allowManagedPermissionRulesOnly: true` gerçek bir oturumda **iki yönlü** test edilecek
(override varken/yokken, allow-listeli aynı komut). Başarısız olursa **durmadan Yol B'ye geç**
(programatik hook'lar + `settingSources:[]`); K3 pazarlığa kapalı (D10). Eskalasyon yalnızca
Yol B de çalışmazsa.

**⚠ TUZAK:** `allowManagedHooksOnly` ve `strictPluginOnlyCustomization` **asla set edilmeyecek** —
ikisi de proje hook'larını devre dışı bırakır, altı güvenlik kapısı ölür.

**Kod turunda doğrulanacak [T]'ler:** `.claude/settings.json` `env` bloğu spawn'ı eziyor mu ·
Windows'ta yetim `claude.exe` · `"agent":"ceo"` personası yükleniyor mu · admin-tier
`managed-settings.json` var mı.

### CEO'nun F-012 için önden verdiği kararlar (K1-K8, brief'te tam metin)
D1-D11 kararları da sözleşme gövdesine yayıldı (D6 izin deliği, D10 Yol B, D11 bütçe tavanı).
K1 tek oturum · K2 `ANTHROPIC_API_KEY` temizlenir **ve** görünür uyarı (mutasyonla çitli) ·
K3 izin akışı kullanıcıya çıkar, otomatik onay YASAK · K4 olay akışı CEO bağlamına girmez
(prompt injection sınırı) · K5 ikinci `EventSource` yok, gerekçesiz ikinci kanal kabul edilmez ·
K6 sohbet kapatılabilir, panel bugünkü hâline döner · K7 araç isim yüzeyi kurulu sürümden
doğrulanır · K8 görsel düzen `docs/03-ux.md`'nin işi, sözleşmenin değil.

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
