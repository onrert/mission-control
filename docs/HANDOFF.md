# HANDOFF — oturum kesilirse buradan devam et

> Her zaman güncel "nerede kaldık" notu. `docs/progress.md` tarihsel kayıttır; burası yalnızca
> **şu anki durumu** anlatır. Yeni oturumda önce bunu oku.

**Son güncelleme:** 2026-09-05 · CEO

---

## Tek cümle
**F-001, F-002, F-004, F-003 bitti** (dördü de QA GEÇTİ, hepsi push'lu, CI yeşil).
Panel kendini izliyor ve **canlı zaman çizelgesi çalışıyor**. Sırada **F-005** (proje kayıt + izleme),
sözleşme turu başladı.

## Güvende olan
- Depo: `onrert/mission-control` (private). Son push: **`c3cc928`**. CI **yeşil** (verify + ayrı E2E job'ı).
- `npm run verify` = 0 → **27 dosya / 326 test** · `npm run e2e` = 0 → **9** · `npm run e2e:dev` = 0 → **1**.
- Kapılar G0-G3 onaylı. **G4-1 kilometre taşı Faz 1 sonunda** (F-007'den sonra).
- Panel kendini izliyor: `.claude/settings.json`'da `send-event.cjs` kurulu, 6 güvenlik hook'u sağlam.
- Ekran kanıtı: `docs/qa/screens/F-003-fix1-2026-09-05.png` (stilli, canlı akan zaman çizelgesi).

## Faz 1 durumu
| Feature | Durum |
|---|---|
| F-001 iskelet | done |
| F-002 olay alma + JSONL depo + retention | done |
| F-004 send-event hook + kurulum | done |
| F-003 SSE + canlı zaman çizelgesi + filtreler | done |
| **F-005 proje kayıt + izleme + Ayarlar** | **sözleşme turunda** |
| F-006 yazma kapısı | todo — F-007'den ÖNCE bitmeli |
| F-007 kanban | todo |

Faz 2: F-008 kapılar paneli · F-009 transkript spike · F-010 thread · F-011 token.

## F-005 için CEO'nun önden verdiği kararlar (A-H)
Sözleşme brief'inde tam metin var; özeti:
- **A:** Gerçek `tablist`/`tab`/`tabpanel` + ok tuşu + roving tabindex deseni **artık F-005'in işi**
  (F-003 tek ekran olduğu için bilinçli kurmadı — D8).
- **B:** Kayıt defteri panelin kendi verisi, `MC_DATA_DIR` altında, atomik yazma; **izlenen projelere
  hiçbir şey yazılmaz**.
- **C:** Proje çıkarma diskte hiçbir şeyi silmez — **dosya sistemi manifest testiyle** kanıtlanacak.
- **D:** Geçmiş olaylar depoda kalır (ADR-001 karar 6).
- **E:** Yol doğrulaması savunmacı (yok/dosya/`..`/symlink/UNC/kök/yinelenen; Windows harf duyarsızlığı
  ve `/` vs `\`), **elle regex YASAK**, `node:path` zorunlu.
- **F:** İzleme yalnızca `docs/features/*.md` alt kümesini kapsar, `node_modules` dışlanır.
- **G:** `chokidar` mi `node:fs.watch` mi — veriyle karar verilecek (native derleme yasağı, ADR-009 Windows-only).
- **H:** Kapsam dışı: yazma kapısı, kanban, Faz 2, izlenen projelere hook kurulumu.

## Kullanıcıda bekleyen
- **F-005 sonunda:** hangi proje klasörleri izlenecek? Ve o projelere hook kurulacak mı? (Depo dışına
  yazma — her biri ayrı onay gerektirir.)
- **F-006'da:** ADR-008 ekindeki artık risk yeniden değerlendirilecek (aynı makinedeki başka bir yerel
  sayfa panele istek atabiliyor; F-006 sunucuya kullanıcı adına diske yazdırdığı için tehdit modeli değişiyor).
- **G4-1:** Faz 1 bitince kilometre taşı onayı.
- **Push:** her seferinde sorulur; onay verilirse CEO `docs/approvals/PUSH.ok` yazar, hook kullanınca siler.

## Bu projede tekrar eden ders: "yeşil ama hiçbir şey ölçmeyen test"
Şimdiye kadar **on kez** çıktı. En pahalı üçü:
1. **Stil boru hattı sessizce kopmuştu** (F-003): `vite.config.ts` kökü `src/web` olduğu için Tailwind
   `src/features/**`'i taramıyordu; ekran stilsiz çıktı. Üç katman aynı anda kördü — jsdom CSS yüklemez,
   `toBeVisible()` stilsiz öğe için de doğrudur, `shell.spec.ts` renk assert'i `bg-zinc-950` `App.tsx`'te
   de geçtiği için tesadüfen yeşildi. Artık üretim CSS'ini denetleyen bir çit var.
2. **Protokol sessiz veri kaybı** (F-003 sözleşmesi): `hello` çerçevesi `id:` taşıyordu; tarayıcının
   `Last-Event-ID`'si telafi çerçeveleri gelmeden ring'in sonuna sıçrıyordu.
3. **`since_seq=-1`** (F-003 kod turu): sözleşme sunucunun **400** döndüğü bir URL yazmıştı; istemci
   birim testi `fetch`'i mock'ladığı için sunucuya hiç sormamıştı.

**Kural:** her feature'da mutasyon testi zorunlu (uygula → KIRMIZI gör → geri al). Yeşil kalan
mutasyon = ölçmeyen test = bulgu. Mock'lanmış istemci testi, sunucunun kabul ettiğini kanıtlamaz.

## Alt agent yönetimi (üç kez tur sınırına takıldık)
- Uzun feature brief'lerine **"her 2-3 adımdan sonra ara commit at"** yaz. Sona bırakan iki agent
  tüm işi commit edemeden kesildi.
- Kesilen agent devam ettirilemez (bu ortamda SendMessage yok) → **diskteki gerçek durumu ölç**,
  yeni agent'a eksiksiz devir brief'i yaz.
- **Kesinti sonrası ilk iş: mutasyon artığı ara.** Bir agent mutasyon uygularken kesildi ve ürün
  kodunda bıraktı (`grep -rn "MUTATION\|MUTASYON" src/ tests/`).

## Çalışma düzeni (kullanıcı kararları)
- Platform **yalnızca Windows** (ADR-009); CI tek `windows-latest` + ayrı E2E job'ı.
- Her feature: sözleşme turu → kod turu → QA → düzeltme. Sözleşme turu pahalı ama işe yarıyor
  (F-002'de 13, F-004'te 12, F-003'te 14+3 bulgu kod yazılmadan kapandı).
- Kullanıcı **ara demo istemiyor**; kesintisiz ilerle, doğal kilometre taşlarında göster.
- Masaüstü uygulaması fikri **ertelendi** (ADR-011, G6'da karara bağlanacak).
