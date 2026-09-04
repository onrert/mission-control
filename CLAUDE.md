# App Factory — Proje Kuralları

Bu klasör agent tabanlı bir uygulama üretim hattıdır. Ana oturum `ceo` agent'ıdır; kullanıcı (Veron) yalnızca CEO ile konuşur.

## Süreç (özet — ayrıntı docs/PROCESS.md)
- Kaynak gerçeği `docs/` altındaki dosyalardır; sohbet geçmişine göre kod yazma.
- Kapılar: G0 fikir → G1 PRD → G2 mimari → G3 UX → G4 kilometre taşı → G5 güvenlik/kalite → G6 yayın. Onay = `docs/approvals/<G>.ok` dosyası. Onay dosyasını yalnızca kullanıcı "onaylıyorum" dedikten sonra CEO yazar.
- Tek seferde tek feature. Feature bitti = testler yeşil + commit + `docs/progress.md` güncel + feature notunda `status: done`.
- GEÇTİ/KALDI kararını yalnızca `qa-evaluator` verir; developer kendi işini "geçti" ilan edemez.
- Geri alınamaz işlem (main'e push, deploy, veri silme, ücret/kredi, harici API anahtarı) her zaman kullanıcı onayı ister.
- Kullanıcıyla Türkçe konuş; kod, commit mesajı ve teknik doküman İngilizce.

## Karpathy kuralları
1. Önce düşün: varsayımları açıkça yaz; belirsizse sor; seçenekleri ve tercihini sun.
2. Önce basitlik: istenmeyen soyutlama, konfigürasyon, "ileride lazım olur" kodu yok. Test: "kıdemli bir mühendis bunu aşırı karmaşık bulur mu?"
3. Cerrahi değişiklik: yalnızca görevle ilgili dosyalara dokun; alakasız refactor yapma; kendi bıraktığın ölü kodu temizle.
4. Hedef odaklı: her görevin doğrulanabilir bitti tanımı var; kriter yoksa önce kriteri yaz.

## Stack varsayılanları (architect G2'de günceller)
- Web: TypeScript, Next.js (App Router) veya React + Vite, Tailwind; backend: Next route handlers + Supabase (Postgres/Auth/RLS) veya FastAPI
- Mobil: Expo (React Native) + TypeScript; yayın EAS Build/Submit
- Test: Vitest + Playwright (web), pytest (Python), Maestro (mobil E2E, opsiyonel)
- Yapı: `src/features/<feature>/...`, testler yanında. `docs/` klasörü Obsidian vault'tur; `docs/wiki/` çok-projeli mühendislik hafızası.

## Çalıştırma
- Komutlar `package.json` (dev, test, e2e, lint, typecheck) içinde tanımlıdır. Değiştirirsen bu bölümü güncelle.

## Öğrenilen kurallar (her hatadan sonra buraya ekle — /retro)
- Bash aracı heredoc içinde çift ters bölüyü teke düşürüyor; ters bölü içeren JS regex'li dosyaları (ör. Windows yol ayracını değiştiren `replace`) Bash ile yazma — Write aracını kullan ve `node --check` ile doğrula. Bu kuralın kendisi de ilk yazımda aynı hataya takıldı.
- Hook'lar yazıldıkları anda aynı oturumda devreye giriyor: hook kuran/dokümante eden komutlar kendi regex'lerine takılabilir. Tetikleyici komut metnini Bash'e gömme, dosyayı Write ile yaz.
- Bu ortamda ToolSearch kapalı → SendMessage yok. Bir alt agent'a devam ettirmek yerine yeni agent aç ve brief'i eksiksiz tekrar yaz (agent geçmişi görmez).
- `claude plugin validate <dizin>` plugin manifesti bekler, agent klasörüne uygulanmaz; agent/skill frontmatter'ını `name` + `description` grep'iyle elle doğrula.
- Hook regex'lerinde `/i` bayrağına dikkat: `-f` (force) ile `-F` (dosyadan oku) duyarsız eşleşmede karışır ve zararsız komutlar yıkıcı sanılır. Yanlış pozitifte DANGER.ok YAZMA — regex'i daralt ve `.claude/hooks/_selftest.js` ile regresyon testi çalıştır.
- PRD'nin açık sorularını toptan kullanıcıya yıkma: düşük etkili olanları PROCESS §3 uyarınca CEO karara bağlayıp ADR'ye yazsın, yalnızca ürün davranışını değiştirenleri sor.
- Sözleşme turu (developer → qa-evaluator → düzeltme) gerçekten işe yarıyor: F-001'de 26 bulgu tek satır kod yazılmadan kapandı. Ama pahalı (3 tur ≈ 800k token). İkinci turdan sonra QA brief'ini DARALT: yalnızca açık bulgulara baksın, onaylanmış bölümleri yeniden açmasın, "yalnızca kodda görülebilecek belirsizlik için düzeltme isteme" kuralını ver.
- QA'ya mutasyon testi yaptır. "41 test geçiyor" tek başına hiçbir şey kanıtlamaz; kritik testleri kasten bozdurup KIRMIZI verdiğini gördür, sonra geri aldır. F-001'de bu, yeşil görünen ama hiçbir şey ölçmeyen bir E2E assert'ini ortaya çıkardı.
- `lang="tr"` sayfada CSS `text-transform: uppercase` kullanma: Türkçe locale'de `i` → `İ` (U+0130) olur ve marka adı bozulur ("MİSSİON CONTROL"). Playwright'ın `toContainText`/`textContent` assert'i DOM metnini okur, CSS dönüşümünü GÖRMEZ — render edilen metni doğrulamak için `innerText()` kullan. Büyük harfli metni kaynağa literal yaz.
- Alt agent 150 tur sınırına takılabilir ve devam ettirilemez (bu ortamda SendMessage yok). Uzun feature brief'lerine "tur sınırına yaklaşırsan önce commit at, sonra raporla" talimatını koy; kesilirse diskteki gerçek durumu ölç ve yeni agent'a eksiksiz devir brief'i yaz.
- Uygulamayı çalıştıran agent turları (developer/qa) arkada yetim `npm run dev` süreç ağaçları bırakıyor. Tur sonunda kontrol et; port tutmasalar bile dosya izleyicileri açık kalıyor.
