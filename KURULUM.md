# KURULUM.md — send-event.cjs hook kurulumu ve masaüstü uygulaması

Bu belge, Mission Control'ün izlediği projelere `send-event.cjs` hook scriptini nasıl
kuracağınızı ve kurulumu nasıl doğrulayacağınızı anlatır. Arka plan: `docs/02-architecture.md`
§8, `docs/decisions/ADR-006-hook-tasima-bicimi.md`.

## Masaüstü uygulaması (Electron) — nasıl elde edilir (F-014, QA Ö5 düzeltmesi)

`release/` depoya girmez (`.gitignore`); `.exe`'yi elde etmek için bu deponun kökünden iki komut
gerekir (`npm run dev`/`npm start` gibi bir sunucu adımı **gerekmez**, `.exe` kendi sunucusunu
içeride başlatır):

```sh
npm run electron:fetch    # Electron ikilisini indirir (yalnızca ilk kurulumda gerekli)
npm run electron:package  # dist/web'i derler + Windows-only .exe üretir (ADR-009)
```

Çıktı: `release\Mission Control-win32-x64\mission-control.exe`. Çift tıklayın — terminal
komutu, ortam değişkeni bilmeniz gerekmez (AC1). Paketleme betiği (`scripts/package-electron.mjs`)
çıktıyı kendi kendine doğrular (yasaklı klasör sızıntısı varsa paketleme başarısız olur) ve
paket boyutunu (MB) yazdırır.

**Bilinen davranış (QA F-014 Ö3 — hata DEĞİL, tasarım gereği):** masaüstü uygulaması kendi
kullanıcı veri klasörünü kullanır (`%APPDATA%\mission-control\data`), bu deponun `./data`
klasöründen **ayrıdır** (sözleşme §1.4). Yani ilk açılışta Kanban/Zaman Çizelgesi **boş**
görünür — bu, H1 düzeltmesiyle (barındırılan sohbet oturumunun çalışma dizini) **ilgisiz** bir
davranıştır, ölçüldü (temiz bir `userData` ile `/api/projects` → `[]`). İzlemek istediğiniz
projeleri panelden **yeniden ekleyin** (aynı `npm run install-hook -- <proje-yolu>` adımı,
yukarıya bakınız).

**Masaüstü kabuğunun kullanıcıya görünen metinleri, tepsi davranışı ve açılışta başlama
ayarı:** `docs/03-ux.md` "Masaüstü kabuğu metinleri" bölümü.

## Ne yapar

`.claude/hooks/send-event.cjs`, Claude Code'un hook olaylarını (stdin'den JSON) okuyup
`POST http://127.0.0.1:<MC_PORT>/api/events`'e gönderen, bağımlılıksız tek bir Node scriptidir.
Panel kapalıysa veya sunucu erişilemezse **sessizce ve hızlıca** (≤400 ms tasarım bütçesi)
başarısız olur; oturumu asla bloklamaz veya çökertmez (`docs/qa/F-004-contract.md`).

## Gereksinimler

- İzlenen projede Node.js kurulu olmalı (script `node .claude/hooks/send-event.cjs` olarak
  çalıştırılır, `npm install` **gerekmez**).
- Mission Control sunucusu çalışıyor olmalı (`npm run dev` veya `npm start`, varsayılan port
  `7333`).

## Kurulum

Mission Control deposunun kökünden, izlenen projenin yoluna karşı:

```sh
npm run install-hook -- <izlenen-proje-yolu>
```

Örnek (Windows):

```sh
npm run install-hook -- C:\dev\apps\benim-projem
```

Bu komut:

1. `<izlenen-proje-yolu>\.claude\settings.json`'ı okur (yoksa sıfırdan oluşturur; bozuksa
   hiçbir dosyaya dokunmadan hata verir).
2. İlk çalıştırmada `settings.json.bak` yedeğini alır (yalnızca ilk kez — sonraki
   çalıştırmalarda üzerine yazılmaz).
3. `send-event.cjs`'i `<izlenen-proje-yolu>\.claude\hooks\`'a kopyalar.
4. `settings.json`'daki 13 hook olay tipine (`SessionStart`, `PreToolUse`, `PostToolUse`, vb.)
   `send-event.cjs` kaydını ekler — **mevcut hook'lara dokunmaz**, yalnızca yanına ekler.
5. Türkçe bir özet yazdırır (kaç kayıt eklendi, kaç zaten vardı).

Komut idempotenttir: aynı hedefe tekrar çalıştırmak çift kayıt oluşturmaz.

Değişiklikleri yazmadan önce görmek isterseniz:

```sh
npm run install-hook -- <izlenen-proje-yolu> --dry-run
```

**Önemli:** bu komutu yalnızca kendi bilerek izlemek istediğiniz proje yollarına karşı
çalıştırın. Mission Control'ün kendi deposu dışındaki bir yola kurulum, sizin açıkça
çalıştırdığınız bir kullanıcı adımıdır — otomatik/agent tarafından tetiklenmez.

## Ortam değişkenleri (izlenen projede)

| Değişken | Varsayılan | Etki |
|---|---|---|
| `MC_PORT` | `7333` | Mission Control sunucusunun dinlediği port. |
| `MC_MAX_PAYLOAD` | `65536` | Bu boyutu aşan olaylar küçük bir özet zarfına indirgenir (özet alanı yine dolu kalır). |
| `MC_DISABLE` | *(boş)* | `1` yapılırsa hook hiçbir şey yapmadan çıkar — paneli geçici olarak susturmak için. |

## Gizlilik — ne saklanır (G5 güvenlik denetimi, 2026-09-10)

Bu hook, izlediğiniz projede çalışan Claude Code oturumunun hook olaylarını **olduğu gibi**
Mission Control'e gönderir: `Bash` komutunun tam metni, `Edit`/`Write` çağrılarının dosya
yolu ve içeriği (`old_string`/`new_string` dahil), kullanıcı prompt'unuz ve son asistan
mesajı. Bunlar Mission Control'ün **kendi yerel diskine** (`data/*.jsonl`, varsayılan
30 gün / 20.000 olay saklanır) yazılır ve panelde canlı gösterilir — dışarıya (üçüncü bir
servise) **gönderilmez**.

Sunucu tarafı (`normalize.ts`, `docs/decisions/ADR-015-olay-akisi-redaksiyonu.md`) bilinen
sır biçimlerini (API anahtarı önekleri, `Bearer`/`api_key`/`token`/`password` gibi alanlar)
`[redakte]` ile görünür şekilde maskeler ve tek bir alanın 4000 karakterden uzun kısmını
görünür bir işaretle (`…[içerik kırpıldı]`) keser. **Bu bir kara listedir ve tam değildir** —
listede olmayan bir sır biçimi (ör. özel bir şirket token formatı) redakte edilmeden
kaydedilebilir. İzlediğiniz projede gerçekten hassas bir komut çalıştırdıysanız (ör. bilinmeyen
biçimli bir sır), bunu `data/*.jsonl`'den elle temizlemeniz gerekebilir.

## Geri alma

`.claude/settings.json.bak`, kurulumdan önceki hâli taşır. Geri almak için elle
`settings.json.bak`'ı `settings.json` üzerine kopyalayın ve `.claude/hooks/send-event.cjs`'i
silin.

## Doğrulama (AC5 — kullanıcı adımı)

Kurulum scriptinin kendisi otomatik testlerle doğrulanmıştır (`tests/scripts/install-hook.test.ts`,
`tests/integration/send-event-hook.test.ts`). Ama gerçek bir Claude Code oturumunda olayın
panele düştüğü **elle** doğrulanmalıdır — bu, otomatikleştirilemeyen tek adımdır:

1. `npm run dev` (veya `npm start`) ile Mission Control'ü çalıştırın.
2. Hook'u izlemek istediğiniz projeye kurun: `npm run install-hook -- <proje-yolu>`.
3. O projede yeni bir Claude Code oturumu açın (veya mevcut oturumda bir araç çağırın —
   ör. bir dosya okuyun/düzenleyin).
4. Mission Control panelini açın (`http://127.0.0.1:<MC_WEB_PORT>`, varsayılan `7334`) ve
   az önceki olayın (ör. `PreToolUse`/`PostToolUse`) listede göründüğünü kontrol edin.
5. Sonucu bu bölüme bir satırla ekleyin (tarih + gözlemlenen olay tipi + ekran görüntüsü yolu
   varsa).

**Bu depoya kurulum:** F-004 kod turunda `npm run install-hook -- .` bu deponun kendi köküne
karşı bir kez çalıştırıldı (sözleşme §3 madde 7, önceden onaylı istisna) — panel artık kendi
oturumlarını da izliyor. Yukarıdaki 5 adımı bu depoda bir Claude Code oturumu açarak
tamamlayabilirsiniz.

**Doğrulanmış sonuç (2026-09-05, CEO):** kullanıcı bu depoda `npm run install-hook -- .`
çalıştırdı, panel açıldı ve gerçek oturumda araç çağrıları yapıldı — olaylar canlı düştü
(dosya 4 satırdan 9 satıra çıktı, `GET /api/events` yeni olayları döndürdü). Örnek gerçek olay:
`hook_event_name: PreToolUse` · `tool_name: Bash` · `session_id: b13e8d3f-…` ·
`project_name: mission-control` · `transcript_path` dolu · `client_version: 1` · `flags: []`.
`.seq` kayması yok (kurulum öncesi 4 → sonrası 9, satır sayısıyla tutarlı). Ayrıntı ve altı
güvenlik hook'unun (`session-start`, `gate-check`, `block-dangerous`, `asset-guard`,
`post-format`, `stop-check`) korunduğu denetim: `docs/features/F-004-send-event-hook.md`
"AC5 doğrulama kanıtı" ve `docs/qa/F-004-2026-09-05.md` §3 (qa-evaluator'ın bağımsız denetimi).

## Not (geliştirici notu, kod turu)

Bu dosyanın önceki içeriği `C:\dev\app-factory` şablonundan kopyanın kalıntısıydı (App
Factory'nin kendi bootstrap talimatı — yeni bir proje klasörünü agent/hook/skill iskeletiyle
doldurmak için, bu projenin kendisiyle ilgisi yok; ne README.md ne başka bir Mission Control
dokümanı ona referans veriyordu). `docs/02-architecture.md` §16, `docs/decisions/
ADR-006-hook-tasima-bicimi.md` ve `docs/features/F-004-send-event-hook.md` bu dosyanın
**hook kurulum belgesi** olmasını bekliyordu (üçü de bu adı bu amaçla anıyor); F-001'de
`F-000-template.md`'nin silinmesiyle aynı gerekçeyle (kalıntı şablon içeriği gerçek amacıyla
karışmasın), içerik burada gerçek amacına göre değiştirildi. Aynı gerekçe `docs/progress.md`'de
de tutuluyor; bu not yalnızca dosya geçmişini merak eden biri için burada, kullanıcı akışının
önünde değil (QA F-004 kod turu, bulgu N1).
