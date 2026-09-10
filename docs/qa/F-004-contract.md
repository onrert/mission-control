---
feature: F-004
title: send-event.cjs hook scripti + install-hook.mjs + hook smoke testleri
author: developer
status: approved
date: 2026-09-04
---

# F-004 Sözleşmesi — hook olay göndericisi + kurulum scripti

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").
Kaynaklar: `docs/features/F-004-send-event-hook.md`, `docs/02-architecture.md` §3.5, §8, §11.2,
`docs/decisions/ADR-006-hook-tasima-bicimi.md`, `docs/decisions/ADR-001-...md`,
`docs/decisions/ADR-008-f002-kapsam-kararlari.md` (özellikle "CEO kararı — R-1"),
`docs/qa/F-002-contract.md` (biçim örneği + §4 API sözleşmesi + R-1), `CLAUDE.md` (Karpathy
kuralları + Öğrenilen kurallar), mevcut kod: `src/features/events/server/{ingest,normalize}.ts`,
`src/server/index.ts`, `src/shared/types.ts`, `scripts/check-ports.mjs`, `package.json`,
`.claude/settings.json`, `tests/no-external-host.test.ts`, `tests/scripts/check-ports.test.ts`,
`tests/integration/events-api.test.ts`, `tests/helpers/temp-data-dir.ts`.

Bu turda `src/`, `tests/`, `scripts/`, `.claude/` altında **hiçbir dosya değiştirilmedi**;
yalnızca bu sözleşme metni yazıldı.

---

## 1. Kapsam

**İçinde:**
- `.claude/hooks/send-event.cjs` — bağımlılıksız, stdin'den hook JSON'u okuyup
  `POST http://127.0.0.1:<MC_PORT>/api/events`'e gönderen script. Ayrıntı §3 madde 1, §4.
- `scripts/install-hook.mjs` — `npm run install-hook -- <proje-yolu>`: hedef projeye
  `send-event.cjs`'i kopyalar + `.claude/settings.json`'daki 13 hook olay tipine kayıt ekler
  (idempotent, yedekli). Ayrıntı §6.
- `tests/helpers/emit-hook.ts` — sahte hook payload'ı ile scripti çocuk süreç olarak
  çalıştıran, stdout/stderr/exit code/süre yakalayan test yardımcısı.
- `KURULUM.md` — Türkçe kullanıcı dokümanı. İçerik planı §10.
- **Genişletme (gerekçeli, §2'de detaylı):** `tests/integration/send-event-hook.test.ts` ve
  `tests/scripts/install-hook.test.ts` — feature notunun dosya sahipliği listesi bir yardımcı
  (`emit-hook.ts`) sayıyor ama onu kullanan gerçek `.test.ts` dosyalarını **saymıyor**; AC6
  ("otomatik doğrulanır") ve AC4 ("iki kez çalıştırılınca çift kayıt oluşturmaz") ancak gerçek
  test dosyalarıyla karşılanabilir. F-002 sözleşmesi de emsal: feature notu "ilgili testler"
  demiş, sözleşme kendi test dosya listesini türetmiş (`docs/qa/F-002-contract.md` §2.1). Yeni
  klasör AÇILMIYOR — ikisi de zaten var olan `tests/integration/` ve `tests/scripts/` köklerine
  ekleniyor (bkz. `find tests -maxdepth 4 -type d` çıktısı, ✓ VERIFIED).
- **`tests/no-external-host.test.ts`'in tarama kapsamının genişletilmesi (CEO kararı A,
  tekrar edilen bağlayıcı karar).** Feature notunun "CEO kararları" bölümü (satır 33-36) bunu
  açıkça F-004 kapsamına aldı; tur 1'de "sahiplik dışı" diye kapsam dışı bırakılması **hatalıydı**
  ve geri alınıyor. Guard `.claude/hooks/**` kökünü ve `.cjs` uzantısını da tarayacak şekilde
  genişletilir (§2.2, §5, §7). Gerekçe: bu depodaki 8 `.cjs` dosyasının (`_common.cjs`,
  `_selftest.cjs`, `asset-guard.cjs`, `block-dangerous.cjs`, `gate-check.cjs`, `post-format.cjs`,
  `session-start.cjs`, `stop-check.cjs`) hiçbirinde `http` alt dizgesi bile geçmiyor
  (✓ VERIFIED — `grep -c http .claude/hooks/*.cjs` hepsinde `0` döndü), yani genişletme mevcut
  hiçbir testi kırmaz; `scripts/install-hook.mjs` zaten `scripts/**/*.mjs` kökünde taranıyor
  (aynı dosya satır 29), ayrıca kopyalanan `send-event.cjs` içinde ayrı bir "şablon dizgesi" yok —
  `install-hook.mjs` dosyayı **byte-kopyalar**, bir JS string şablonu gömmez (§6 adım 2), yani
  taranacak tek ek yüzey gerçek `.claude/hooks/send-event.cjs` dosyasının kendisidir.

**Dışında:**
- Gerçek bir Claude Code oturumunda elle doğrulama (AC5) — bu bir **kullanıcı/CEO adımıdır**,
  otomatik testlerden ayrı işaretlidir (§5, AC5 satırı).
- SSE (`GET /api/stream`) → F-003. `send-event.cjs` yalnızca `POST /api/events`'e yazar.
- Proje kayıt defteri / `project_id` doldurma → F-005 (F-002'de zaten kapsam dışı bırakıldı,
  bu feature de değiştirmiyor).
- Yazma kapısı (`write-gate.ts`) → F-006. Bu feature izlenen projenin **yalnızca**
  `.claude/hooks/send-event.cjs` dosyasını ve `.claude/settings.json`'ını değiştirir — ikisi de
  kullanıcının **açıkça çalıştırdığı bir kurulum komutuyla** olur (ADR-006 "Kullanıcı onayı
  gerekli mi" bölümü), panelin çalışma zamanı yazması değildir; yazma kapısı kapsamının dışında.
- `src/server/**`, `src/features/events/server/**` içinde **hiçbir davranış değişikliği**.
  Bu dosyalar yalnızca **okunur** (mevcut sözleşmeyi doğrulamak için); sunucuda gerçek bir eksik
  görülürse CEO'ya §9'da soru olarak yazılır, kod değiştirilmez.
- UI, herhangi bir `src/web/**` dosyası.

---

## 2. Dokunacağım dosyalar

### 2.1 Yeni dosyalar

| Dosya | Amaç |
|---|---|
| `.claude/hooks/send-event.cjs` | Hook script (§4). Bu depoda kurulu haliyle de durur — panel kendi kendini izlerken kullanacağı gerçek dosya budur (§3 madde 7). |
| `scripts/install-hook.mjs` | Kurulum scripti (§6). `.mjs` (ESM) — bu depo zaten `"type":"module"`, mevcut `check-ports.mjs` ile aynı desendedir. |
| `tests/helpers/emit-hook.ts` | `runHook(opts)`: `send-event.cjs`'i `child_process.spawn('node', [scriptPath], {env, stdio:'pipe'})` ile çalıştırır, stdin'e JSON yazar/kapatır, `{stdout, stderr, exitCode, elapsedMs}` döner. Sunucu spawn ETMEZ — çağıran test kendi `createServer`'ını kurar (F-002 `tests/integration/events-api.test.ts`'in `startServer` deseniyle tutarlı, bkz. o dosya satır 16-24). |
| `tests/integration/send-event-hook.test.ts` | AC1/AC2/AC3/AC6 + item 3/4/7/8'in tamamı — gerçek `createServer` (F-002'nin `src/server/index.ts`'i, **değiştirilmeden** import edilir) + gerçek `send-event.cjs` çocuk süreci. |
| `tests/scripts/install-hook.test.ts` | AC4 — idempotentlik, yedek, bozuk JSON, eksik dosya, bu reponun **kopyalanmış** gerçek `settings.json`'ı üzerinde regresyon testi (§6). `tests/scripts/check-ports.test.ts`'in `execFileSync`/geçici dizin desenini izler. |
| `KURULUM.md` | §10. |

### 2.2 Değişecek dosyalar

`src/server/index.ts`, `src/features/events/server/{ingest,normalize}.ts`,
`src/shared/types.ts` bu turda **okunuyor, değişmiyor** — F-004'ün script'i sunucunun mevcut
sözleşmesine (256 KB sert sınır, `MC_MAX_PAYLOAD` yumuşak kırpma, Host/Origin kuralı) uyum
sağlıyor, tersi değil (KISITLAR: "sunucuda gerçekten bir eksik görürsen §9'da sor, kendin karar
verme"). Aşağıdaki dosyalar ise bu turda (tur 2 düzeltmesi, CEO kararı A/D + bulgu 7/9)
**değişecek dosyalar** listesine alınıyor:

| Dosya | Değişiklik |
|---|---|
| `tests/no-external-host.test.ts` | `files` dizisine `...walk(path.join(ROOT, '.claude', 'hooks'), ['.cjs'])` eklenir (satır 25-30 bloğu). Kod turu ayrıca yeni bir `it` ile "taranan dosyalar arasında `.claude/hooks` kökünden en az biri var" pozitif kontrolünü ekler (körlük kontrolü, bkz. §8 risk maddesi 6). |
| `.gitignore` | `.claude/settings.json.bak` ve `.claude/settings.json.tmp-*` satırları eklenir (bulgu 7 — kod turunda bu reponun kendi `.claude/settings.json`'ına `install-hook` çalıştırılınca oluşacak yedek/geçici dosyalar commit'e sızmasın diye). |
| `docs/features/F-004-send-event-hook.md` | **Yalnızca kalan `.js` referansları** düzeltilir: başlık satır 3 (`send-event.js` → `send-event.cjs`), açıklama satır 10 (`send-event.js` → `send-event.cjs`), dosya sahipliği satır 22 (`.claude/hooks/send-event.js` → `.claude/hooks/send-event.cjs`). **Satır 14 zaten `POST /api/events` diyor** (✓ VERIFIED, tur 1 QA sonrası CEO'nun feature notuna eklediği "CEO kararları" bölümüyle birlikte düzeltilmiş durumda) — bu satırda kod turunda yapılacak bir şey yok, önceki tur bulgusu (bulgu 9) bu noktada artık geçersiz. |

**Not — dokunulmayan ama incelenen dosyalar:** `.claude/settings.json` (bu reponun kendi
dosyası — testler bunun bir **kopyasını** kullanır, kod turu da kurulum scriptini bu dosyaya
karşı **bir kez elle** (`npm run install-hook -- .`) çalıştırıp sonucu commit'e dahil edecektir;
bu "değişecek dosya" değil, kod turunda kurulum scriptinin kullanıcı tarafından çalıştırılmasının
bir sonucudur — ADR-006 "yazma kapısı kapsamı dışında" notuyla tutarlı, ve CEO kararı D'nin
"deponun kendi kökü" istisnasıyla örtüşür, §6'ya bakınız), `eslint.config.js` (`scripts/**/*.mjs`
zaten `process` global'ıyla lint ediliyor, `.mjs` dosyası eklemek konfigürasyon değişikliği
gerektirmiyor — doğrulandı), `tsconfig.json` (`.claude/**` ve `scripts/**` `include` listesinde
yok, yani `send-event.cjs` ve `install-hook.mjs` typecheck'e hiç girmiyor — bilinçli, ikisi de düz
JS). **`docs/02-architecture.md` §8.2/§8.3/§4 bu turda da değiştirilmiyor** — G2 onaylı mimari
dokümanı developer'ın sahiplik alanı dışında; kalan `.js`/`POST /events` referansları için CEO
onayı §9'da isteniyor (bulgu 9).

---

## 3. Tasarım kararları

### 1) Dosya uzantısı — `.cjs`, `.js` DEĞİL (en kritik karar)

**Karar: `send-event.cjs` (ve varsa yardımcı dosyalar `.cjs`).** Feature notu ve mimari §8.2
"`send-event.js`" diyor — bilinçli sapma.

Gerekçe:
- **Bu depo zaten `"type": "module"`** (`package.json:5`, ✓ VERIFIED). Bir `.js` dosyası bu
  kökte ESM sayılır; script `require('node:http')` kullanıyorsa (mimari §8.2 örneği tam olarak
  bunu yapıyor) `ReferenceError: require is not defined in ES module scope` ile patlar.
- **Script izlenen yabancı projelere kopyalanacak** (F-004'ün asıl amacı). O projelerin
  `package.json`'ında `"type": "module"` olup olmadığını **bilemeyiz** — proje sahibinin
  kararı. `.js` uzantısı Node'un modül sistemini **en yakın `package.json`'ın `type` alanına**
  göre seçmesine bırakır; bu, kurulum hedefine göre davranışı değiştiren, test edilemeyen bir
  belirsizlik yaratır.
- **Bu tam olarak bugün bu projede yaşanan hatadır** (`CLAUDE.md` "Öğrenilen kurallar",
  commit `9ae23bf`): `package.json`'a `"type":"module"` eklenince `.claude/hooks/*.js`
  dosyalarının tamamı ESM sayıldı, `require` patladı, hook **çıkış kodu 1** döndü ve Claude
  Code yalnızca çıkış kodu **2**'yi engelleyici saydığı için tüm güvenlik kapıları (G2, yıkıcı
  komut engeli, ASSETS koruması, stop-check) **haftalarca sessizce no-op koştu**. `send-event.js`
  için özdeş bir hata sınıfı: script `require` patlarsa **çıkış kodu 1** ile döner — bu bloklayıcı
  değildir (mimari §8.1: yalnızca `exit(≠0)` ≠ 2 oturumu durdurmaz) ama **olay hiç gönderilmez**,
  sessizce ve fark edilmeden — panelin tüm amacını (görünürlük) baltalar.
- **Bu reponun kendi `.claude/hooks/*.cjs` dosyaları zaten bu dersi uyguluyor**
  (`.claude/settings.json` satır 29-47, ✓ VERIFIED — `session-start.cjs`, `gate-check.cjs`,
  `block-dangerous.cjs`, `asset-guard.cjs`, `post-format.cjs`, `stop-check.cjs`, hepsi `.cjs`).
  `.cjs` seçimi bu depoda zaten **kurulu bir hijyen kuralı**; `send-event.cjs` bunu bozmadan
  takip ediyor.
- **`.cjs` uzantısı Node'da modül sistemini `package.json`'dan tamamen bağımsız, her zaman
  CommonJS olarak sabitler** (Node dokümantasyonu — `.cjs` her koşulda CommonJS, `.mjs` her
  koşulda ESM; bu davranış `type` alanından etkilenmez). Bu, kurulum hedefinin `type` alanı ne
  olursa olsun scriptin **her zaman aynı şekilde** çalışacağının garantisidir — tahmin değil,
  Node'un belgelenmiş, sürüm bağımsız davranışı.
- Alternatif (`.mjs`, ESM `import` ile yazmak): reddedildi. Sebep yok değil ama gereksiz
  karmaşıklık: `.cjs` + `require` mevcut fabrika deseniyle (bu reponun kendi hook'ları) birebir
  tutarlı; `.mjs`'e geçmek script içeriğini mimari §8.2 örneğinden daha fazla uzaklaştırırdı,
  kazanç yok (ikisi de "type"tan bağımsız çalışır).
- `scripts/install-hook.mjs` **`.mjs` kalıyor** — bu, Mission Control'ün **kendi** deposunun
  bir parçası (`package.json:5` zaten `"type":"module"`), izlenen projeye kopyalanmıyor;
  `check-ports.mjs` ile aynı emsal (`ecmaFeatures`/`eslint.config.js:27` zaten `.mjs`'i
  kapsıyor). Uzantı tuzağı yalnızca **kopyalanan** dosya (`send-event.cjs`) için geçerli.

**Zorunlu test (§5 AC6 + §7 mutasyon 1):** `tests/scripts/install-hook.test.ts` içinde iki
sahte hedef proje kurulur — biri `package.json: { "type": "module" }`, diğeri `package.json`
hiç `type` alanı olmadan (varsayılan CommonJS). Kurulum sonrası **her iki hedefte de**
`node .claude/hooks/send-event.cjs` gerçekten çalıştırılır (stdin'e geçerli JSON verilip
kapatılır, `MC_PORT` boş bir porta ayarlanır) ve **her ikisinde de** `exitCode === 0`,
`stderr === ''` doğrulanır. Bu, uzantı kararının doğru çalıştığının **çalışan koda** dayalı
kanıtıdır — yalnızca dosya adına bakmak yeterli değildir.

### 2) Uç nokta yolu — `POST /api/events`, `POST /events` DEĞİL

Feature notu satır 14 `POST /events` diyor; **kod** `POST /api/events` kullanıyor
(`src/server/index.ts:251`, ✓ VERIFIED: `if (pathname === '/api/events' && req.method ===
'POST')`) ve mimari §6.1 de `/api/events` diyor. Feature notu bu noktada **güncel değil**
(muhtemelen F-002'den önce, mimari finalize olmadan yazılmış). **Karar: kod ve mimari
kazanır, feature notu bir yazım/güncelleme borcudur** — CLAUDE.md "kaynak gerçeği docs'tur"
ilkesi burada iki doküman arasında çelişiyor; mimari (`02-architecture.md`, G2 onaylı, daha
ayrıntılı ve kodla doğrulanmış) feature notundan (kısa özet, onay kapısı yok) üstündür. Kod
turu `docs/features/F-004-send-event-hook.md` satır 14'ü düzeltecek (tek satır, dosya sahipliği
listesinde olmasa da bu **kendi feature notumuzun** bir yazım hatası düzeltmesidir, Karpathy §3
"kendi bıraktığın ölü kodu/hatayı temizle" ilkesiyle örtüşür — başka bir feature'ın dosyasına
dokunmuyoruz).

### 3) Bloklamama garantisi — toplam ≤ 400 ms bütçesi (CEO kararı B, tur 2 tam yeniden tasarım)

**Tur 1 hatası (bloklayıcı 3, kapatıldı):** eski tasarımda stdin bekçisi (2000 ms) ile ağ
bekçisi (450 ms) **ardışık** fazlardı → en kötü durum ~2,55 s, mimari §8.1'in "asla 400 ms'ten
uzun bekleme" kuralının 6 katı ve ADR-006'nın (satır 42) bağlayıcı "1 s'yi aşarsa CEO'ya bildir"
eşiğinin üstünde. **CEO kararı B bağlayıcı bir bütçe koydu: süreç açılışından çıkışa kadar
toplam duvar saati her yolda ≤ 400 ms.** Aşağıdaki tasarım, tüm zamanlayıcıları küçülterek ve
fazları gerçekten ardışık sayarak bu bütçeye **fiilen** uyuyor (hesap: bkz. yeni "## Süre
bütçesi" bölümü, dosya sonu).

Mimari §8.1'in katman **fikrini** korur (idle bazlı soket zaman aşımı + hata yakalama), ama
sayısal değerleri ≤400 ms toplamına sığacak şekilde küçültür ve tur 1'in eksik bıraktığı
"toplam süre" katmanını **ayrı, idle'dan bağımsız bir mekanizma** olarak ekler (soket idle
zamanlayıcısı, aktivite gördükçe sıfırlanır — bu yüzden damla damla veri gönderen bir sunucuya
karşı **tek başına yetersizdir**; toplam süre bekçisi aktiviteden bağımsız çalışır ve bu boşluğu
kapatır):

| Katman | Değer | Ne zaman tetiklenir | Neyi kapatır |
|---|---|---|---|
| `MC_DISABLE` kontrolü | — | script başında, stdin okumadan **önce** | Kullanıcı paneli kapattı |
| stdin boşta kalma bekçisi | **120 ms**, `unref()` (tur 1'deki 2000 ms'den küçültüldü) | stdin hiç `'end'` yaymazsa | Claude Code stdin'i hiç kapatmazsa (öngörülemeyen bir hook çerçevesi hatası). Bu dalda ağ isteği **hiç gönderilmez**. Küçültme gerekçesi: Claude Code hook JSON'unu stdin'e anında yazar (CEO kararı B), 120 ms zaten cömert bir üst sınır. |
| soket etkinsizlik zaman aşımı | `req.setTimeout(100)` | istek gönderildikten sonra 100 ms boyunca **hiç** veri alışverişi olmazsa | Sunucu kapalı / bağlantı kurulamıyor / sunucu tamamen **sessiz** (hiçbir bayt yazmıyor). Her yeni bayt bu sayacı sıfırlar — bu yüzden damla damla akan bir sunucuya karşı **hiçbir zaman tetiklenmeyebilir**, aşağıdaki bağımsız katman bunun içindir. |
| **toplam ağ süresi bekçisi (idle'dan bağımsız)** | `setTimeout(150).unref()`, istek nesnesi oluşturulduğu an kurulur, soket aktivitesinden **bağımsız** çalışır | istek gönderildikten 150 ms sonra, yanıt tamamlanmamışsa (soket etkin olsa bile) | **"Sunucu yavaş/damla damla yanıt veriyor" senaryosu** — bu tam olarak idle bazlı zaman aşımının **yakalayamadığı** durumdur. Başarılı yanıt (`res.on('end')`) veya `req.on('error')` bu zamanlayıcıyı temizler. |
| `process.on('uncaughtException'/'unhandledRejection', () => process.exit(0))` | — | her zaman aktif | Beklenmeyen istisna |
| `req.on('error', () => process.exit(0))` | — | `ECONNREFUSED`, `ECONNRESET`, `ENOTFOUND`, vb. | Sunucu kapalı/erişilemez |

İki ağ katmanı **kasıtlı olarak ayrı tutuluyor** (birleştirilmiyor) — Bloklayıcı 2'nin istediği
kanıt tam olarak budur: "sessiz sunucu" testi yalnızca idle katmanının varlığını kanıtlar (toplam
süre bekçisi kaldırılsa bile sessiz sunucu testi **yeşil kalmalı**, çünkü idle zaten 100 ms'de
yakalıyor); "damla sunucu" testi yalnızca toplam süre bekçisinin varlığını kanıtlar (bu katman
kaldırılırsa damla testi **kırmızı** vermeli, idle hiç tetiklenmediği için script asılır kalır).

**Alt senaryoların her biri ayrı test alır (§5, §7) — Bloklayıcı 2 düzeltmesi: tek "yavaş sunucu"
testi yerine iki bağımsız test:**
- **Sunucu kapalı (hiçbir şey dinlemiyor):** `ECONNREFUSED` → `req.on('error')` → `exit(0)`.
- **Sunucu portu bağlı ama bağlantıyı hemen kesiyor (`ECONNRESET`):** çıplak bir
  `net.createServer()` bağlantıyı `socket.destroy()` ile hemen kapatır → `req.on('error')` yine
  yakalar.
- **DNS yok:** yapısal olarak **imkânsız** — script her zaman `127.0.0.1` **IP literaline**
  bağlanır (`localhost` gibi bir ad **değil**), Node bu durumda hiç DNS çözümlemesi yapmaz
  (`net`/`http` modülü IP literalini doğrudan kullanır). Bu, mimarinin kendi kararıyla
  (`MC_HOST` yok, sabit loopback) yapısal olarak elenmiş bir senaryo — test yerine bu gerekçe
  dokümante edilir (? INFERRED değil, Node'un IP-literal-vs-hostname davranışı belgelenmiştir).
- **(a) Sessiz sunucu:** çıplak bir `http.createServer` isteği kabul eder, **hiçbir bayt
  yazmadan** yanıtı sonsuza kadar açık bırakır (test içinde güvenlik ağı olarak ~2 s sonra sunucu
  taraflı zorla kapatılır, ama script bundan çok önce, ~100 ms'de kendi idle bekçisiyle çıkmış
  olmalı). Yalnızca **idle katmanının** varlığını kanıtlar.
- **(b) Damla sunucu:** aynı çıplak sunucu, bağlantıyı kabul eder ve **istemci (test) bağlantıyı
  kapatana kadar, 40 ms aralıkla sınırsız** 1'er bayt yazmaya devam eder — **üst sınır yok**
  (40 ms < 100 ms idle eşiği, yani idle zamanlayıcısı her seferinde sıfırlanır ve **hiç
  tetiklenmez**); yalnızca 150 ms'lik toplam süre bekçisi scripti durdurabilir. Test, script
  kendi `exit(0)`'ını verdikten sonra sunucu bağlantısını kapatır; sunucu tarafı `socket.on(
  'error', () => {})` ile döşenir (script çıktıktan sonra kapanan sokete düşen yazma hatalarını
  yutmak için — bkz. "Kod turuna devredilen notlar" madde 1). Yalnızca **toplam süre
  katmanının** varlığını kanıtlar (§7 mutasyon 3 bunu hedefler): mutasyon sonrası (toplam bekçi
  yok) damlama sınırsız sürdüğü için idle hiçbir zaman tetiklenmez, script sonsuza kadar asılı
  kalır ve test **vitest'in kendi test zaman aşımıyla** güvenilir biçimde kırmızı verir — "en az
  5 kez" gibi sonlu bir sınır bu kanıtı geçersiz kılardı (5 damla bitince idle 100 ms sonra
  devreye girip mutasyonu yeşile çevirirdi).
- **(c) stdin hiç kapanmıyor:** `emit-hook.ts`'e stdin'i asla `end()` etmeyen bir mod eklenir;
  script 120 ms'de `exit(0)` ile çıkar, **hiçbir ağ isteği hiç gönderilmemiştir** (sunucudaki
  olay sayısı değişmez), `stdout/stderr === ''`. Bloklayıcı 3'ün istediği, daha önce hiç testi
  olmayan stdin bekçisi katmanının kanıtıdır.
- **Sunucu 503 dönüyor (`storage_unavailable`, gerçek F-002 davranışı):** script durum kodunu
  **hiç okumaz** — `res.resume()` ile gövdeyi tüketip `exit(0)` verir. Test, F-002'nin gerçek
  `createServer`'ını gün dosyası yolunda bir dizin engeliyle 503'e zorlayıp scriptin yine de
  `exit(0)` + boş stdout/stderr verdiğini doğrular.
- **Tüm senaryolarda stdout/stderr boş:** her testte `stdout === '' && stderr === ''` assert
  edilir (Claude Code hook çıktısı sızıntısı — mimari §8.1: "Asla stdout'a yazma").
- **Ölçüm zorunlu (ADR-006'nın "F-004 bunu ölçer" ödevi, bloklayıcı 3; kanıt biçimi CEO kararı
  — DÜZELTME (zamanlama assert'i) ile bağlayıcı olarak güncellendi):** `emit-hook.ts`'in
  döndürdüğü `elapsedMs` (spawn'dan process çıkışına kadar gerçek duvar saati — `Date.now()`
  farkı, muhakeme değil) dört senaryoda (**kapalı sunucu** `ECONNREFUSED`, **`ECONNRESET`**,
  **damla sunucu** senaryo b, **503 dönen sunucu**) `> 1000` ise test KIRILIR (sert kapı,
  ADR-006'nın "1 s'yi aşarsa CEO'ya bildirilir" eşiği) — kırılgan tek kademeli `elapsedMs < 400`
  duvar saati assert'i **kullanılmaz**. Ayrıca zamanlayıcı sabitleri (stdin 120 · idle 100 ·
  toplam 150) saat kullanmayan bir birim testiyle, her bekçinin gerçekten ateşlendiği ise ayrı
  mutasyonlarla (§7 madde 3, 6) kanıtlanır. 400 ms'lik tasarım bütçesi bu üçünün toplamından
  aritmetik olarak türetilir — ayrıntı "## Süre bütçesi" bölümünde.

### 4) Host/Origin uyumu — kodu okuyarak doğrulanmış, varsayılmamış

- `src/server/index.ts:89-100` `isAllowedHost(hostHeader)` — **port'u yok sayar** (CEO kararı
  R-1, `docs/qa/F-002-contract.md` "CEO kararı — R-1"), yalnızca ana bilgisayar adının
  `127.0.0.1`/`localhost`/`::1`/`[::1]` kümesinde olmasını ister.
- Script `http.request({ host: '127.0.0.1', port: <MC_PORT>, ... })` kullanır (host **hostname
  değil, IP literali**). Node'un `http.request` istemcisi, `options.host`/`port` **varsayılan
  olmayan bir port** (80 değil) olduğunda `Host` başlığını `<host>:<port>` olarak **otomatik**
  kurar (Node çekirdek davranışı, `Host` başlığı elle **verilmez** — script bunu üstüne
  yazmaz). Sonuç: `Host: 127.0.0.1:<port>` → `isAllowedHost` ana bilgisayar adını
  (`127.0.0.1`) çıkarır → port ne olursa olsun `true`.
- `src/server/index.ts:109-120` `isAllowedOrigin(originHeader)` — başlık **yoksa** `true`
  döner. Node'un çekirdek `http` istemcisi (tarayıcı `fetch`/`XHR`'ın aksine) **hiçbir zaman**
  bir `Origin` başlığı eklemez (✓ VERIFIED — Node http.ClientRequest header kümesi tarayıcı
  CORS katmanına özgü `Origin` mantığı içermez, yalnızca elle `headers`'a eklenirse gider;
  script bunu eklemiyor). Sonuç: `req.headers.origin === undefined` → `isAllowedOrigin` her
  zaman `true`.
- **Ampirik kanıt (varsayıma güvenilmiyor):** `tests/integration/send-event-hook.test.ts`
  gerçek `createServer(0, tempDataDir)` açar, gerçek `send-event.cjs`'i çocuk süreç olarak o
  porta karşı çalıştırır ve olayın `GET /api/events`'te göründüğünü (yani **403 almadığını**,
  aksi hâlde hiç kaydedilmezdi) doğrular. Ayrıca ayrı bir assert: sunucu tarafında
  `req.headers.host`/`req.headers.origin` bir test-only middleware ile **loglanmaz** (F-004
  sunucu kodunu değiştirmiyor) — kanıt dolaylı: 202/olayın varlığı üzerinden.

### 5) Payload boyutu — istemci tarafında önceden kırpma (ADR-006 gerekçe 3'ün gerçek uygulaması)

**Gözlem (kod okunarak, ? INFERRED değil):** F-002'nin gerçek `normalizeEvent` fonksiyonu
(`normalize.ts:114-123`), gövdenin **tamamını** (`payload`) `EventRecord.raw` olarak saklar ve
`JSON.stringify(payload).length > maxPayload` ise **yalnızca `raw` alanını** `{truncated,
byte_length, keys}` ile değiştirir — bu, `MC_MAX_PAYLOAD`'ın (vars. 65536) **üstünde ama**
`ingest.ts`'in sert 256 KB (`262144` bayt, `ingest.ts:7`) sınırının **altında** kalan gövdeler
içindir. **256 KB'ı aşan bir gövde `ingest.ts`'te akış hâlinde kesilir, JSON hiç ayrıştırılmaz,
olay hiç kaydedilmez** (mimari §6.1, ✓ VERIFIED `ingest.ts:29-46`).

Sonuç: büyük bir `tool_input`/`tool_response` (ör. `Write`/`Read` aracının içerik dizesi) hook
tarafından olduğu gibi iletilirse ve 256 KB'ı aşarsa **olay tamamen kaybolur** — sunucunun
yumuşak kırpması bu durumda hiç devreye giremez. Bu, ADR-006 gerekçe 3'ün ("kırpmanın kaynakta
olması doğru yer... oversize payload'lar ağa çıkmasın") **tam olarak önlemek istediği** senaryo.

**Karar:** `send-event.cjs`, gönderilecek gövdeyi **serileştirip** boyutunu `MC_MAX_PAYLOAD`
(env, vars. 65536 — sunucudakiyle **aynı isim ve varsayılan**, tutarlılık için) ile karşılaştırır:
- **Sınırın altındaysa:** gövde = orijinal stdin JSON'u (üstüne yalnızca çözümlenmiş
  `project_path` **eklenir/üzerine yazılır** — bkz. madde 6) **olduğu gibi**, top-level alanlarla
  (mimari §8.2 şablonundaki gibi `raw:` adlı iç içe bir sarmalayıcı **kullanılmaz** — bkz. madde
  6, F-002'nin gerçek sözleşmesiyle uyum).
- **Sınırı aşıyorsa (KARAR C, tur 2 düzeltmesi — bulgu 4, `summary` gerilemesi kapatıldı):**
  gövde, küçük/skaler alanları koruyan kompakt bir zarfa **değiştirilir**. Tur 1'in zarfı
  `tool_input`'u tamamen düşürüyordu; sunucunun `deriveSummary`'si (`normalize.ts:42-67`,
  ✓ VERIFIED) özeti **yalnızca** şu alanlardan okur: `tool_input.command` (Bash),
  `tool_input.file_path` (Edit/Write/Read), `tool_input.description` (Task), `user_input`
  (UserPromptSubmit), `last_assistant_message` (Stop/SubagentStop), `reason`
  (SessionStart/SessionEnd), `notification_type` (Notification) — bunların dışında hiçbir alanı
  okumaz, yani `path`/`pattern` gibi başka `tool_input` alanlarını korumanın `summary` için bir
  değeri yok (Karpathy §2: yalnızca gerçekten okunan alanlar korunur). Yeni zarf:
  `hook_event_name`, `project_path`, `session_id`, `agent_id`, `agent_type`, `tool_name`,
  `tool_use_id`, `permission_mode`, `transcript_path`, `prompt_id` (var olanlar, değişmedi) +
  `mc_client_truncated: true` + `mc_original_keys: Object.keys(orijinalPayload)` + **yeni:**
  `tool_input: { command, file_path, description }` (yalnızca var olan ve dizge olan alanlar,
  her biri **200 karaktere** kırpılır — mimari §8.2'nin kendi `summarize` fonksiyonunun zaten
  kullandığı `.slice(0, 200)` değeriyle aynı, yeni bir sabit icat edilmiyor) + üst düzeyde
  `user_input`, `last_assistant_message`, `reason`, `notification_type` (var olanlar, aynı
  şekilde 200 karaktere kırpılır — bu alanların kendisi büyük olabileceği için, aksi hâlde
  zarfın kendisi yeniden şişebilirdi). Diğer büyük alanlar (`tool_response`, tam `tool_input`,
  vb.) **düşürülmeye devam eder**. Zarf yine birkaç yüz bayt civarında kalır, 256 KB sert
  sınırının çok altında → **olay her koşulda kaydedilir** ve **`summary` artık boş kalmaz**
  (yalnızca 200 karakterden uzun kısmı kırpılmış olur — bu, bilinen/kabul edilen bir ayrıntı
  kaybıdır, gerileme değildir).
- **Test (§5 AC1/AC3, §7 mutasyon):** 200 KB'lık sahte bir `tool_input.command` (Bash aracı) ile
  hook çalıştırılır (256 KB sert sınırın altında ama `MC_MAX_PAYLOAD`'ın çok üstünde) → sunucuya
  ulaşan olay `mc_client_truncated: true` taşır, olayın kendisi kayıtlıdır (kaybolmamıştır) **ve**
  `GET /api/events`'teki kaydın `summary` alanı **boş değildir** (`command`'ın ilk 200 karakterine
  eşittir). İkinci bir test: `UserPromptSubmit` olayında 200 KB'lık `user_input` ile aynı doğrulama
  (`summary` boş değil). Üçüncü test (mevcut, değişmedi): 400 KB'lık payload (256 KB sert sınırın
  üstünde bile olsa istemci kırpması onu zaten küçülttüğü için) → yine kaydedilir, **400 hiç
  alınmaz**.

**Parse hatası gövdesiyle ilişkisi (tur 3 düzeltmesi — QA regresyonu):** yukarıdaki "Sınırın
altındaysa/aşıyorsa" karşılaştırması **her** giden gövdeye koşulsuz uygulanır — §4'ün parse hatası
zarfı bir istisna değildir. Ama §4'te tanımlanan zarf, `raw_text`'in **sabit 2000 karaktere**
kırpılması sayesinde serileştirilmiş hâliyle her zaman `MC_MAX_PAYLOAD`'ın (vars. 65536) çok
altında kalır (birkaç bin bayt), yani her zaman **"Sınırın altındaysa"** dalına düşer ve **hiçbir
zaman** buradaki kompakt zarfa dönüştürülmez — iki zarf birbirine karışmaz, biri diğerinin içine
gömülmez. Ayrıntı ve reddedilen alternatifler için §4'e bakınız.

**Gizlilik notu (item 7'nin ikinci yarısı):** `transcript_path` ve diğer alanlar potansiyel
olarak dosya yollarını/agent kimliklerini taşır ama **serbest metin içermez** (mimari §5.1
alan tablosu — `transcript_path` bir dosya **yolu**dur, transkript **içeriği** değil).
`user_input`/`last_assistant_message` gibi serbest metin alanları (özet kaynağı) sunucuya
gider ama panel **yalnızca `127.0.0.1`'de dinler ve dışarıya hiçbir şey göndermez** (mimari
§10: "Panel dışarıya hiçbir şey göndermez"). Bu feature bu sınırı **değiştirmiyor**; ek bir
redaksiyon/maskeleme katmanı eklemek hiçbir AC tarafından istenmiyor ve Karpathy §2 ihlali
olurdu — mevcut mimari kararına güveniliyor.

### 6) `project_path` zenginleştirme ve `raw` sarmalayıcısının KULLANILMAMASI

Mimari §8.2 şablonu, gövdeyi `{ client_ts, client_version, project_path, ..., summary,
flags, raw }` biçiminde, **`raw` adlı ayrı bir alanın içine** orijinal payload'ı gömerek
gönderiyor ve `summary`'yi **istemci tarafında** hesaplıyor. **Gerçek F-002 kodu bunu
beklemiyor:** `normalize.ts`'in `deriveSummary` fonksiyonu (satır 42-68) `payload.tool_input`/
`payload.tool_name`'i **top-level**'den okur ve `summary`'yi **her zaman kendisi yeniden
hesaplar** — gelen bir `summary` alanını **hiç okumaz**. Ve `EventRecord.raw` sunucuda **tüm
gövdedir** (`payload` değişkeninin kendisi, `normalize.ts:115`), gövdenin bir alt alanı değil.

**Karar:** `send-event.cjs` **top-level, düz bir zarf** gönderir (F-002 sözleşmesinin §4.2
örnek isteğiyle birebir aynı şekil): orijinal stdin JSON'unun alanları + üstüne yalnızca
`project_path` eklenir/üzerine yazılır (öncelik: stdin'in kendi `project_path`'i varsa
**dokunulmaz** — normalize.ts zaten bunu tercih ediyor — yoksa `cwd`||`CLAUDE_PROJECT_DIR`||
`process.cwd()` üzerinden `fs.realpathSync` denenir, başarısızsa ham değer kullanılır — bu,
`normalize.ts`'in kendi `resolveProjectPath`'iyle (satır 23-35) **kasıtlı olarak aynı
algoritmadır**, çünkü sunucu zaten bunu yapıyor; hook'un amacı yalnızca `cwd` **hiç yoksa**
en iyi tahmini önceden sağlamaktır). `client_ts`/`client_version` gövdeye eklenir (sunucu
tarafından okunmaz ama `raw` içinde durur, gelecekte sürüm sürüklenmesi teşhisi için — ADR-006
"Sonuçlar/riskler" notunda öngörülmüş). **`summary` istemci tarafında hesaplanmaz** (mimari
şablonunun aksine, bilinçli sapma) — sunucu zaten hesaplıyor, istemci tarafında tekrarlamak
ölü kod olurdu (hiçbir zaman okunmaz) ve Karpathy §2 ihlali olurdu.

### 7) Bu depoya kurulum ve kendi kendini izleme

`send-event.cjs` bu depoda `.claude/hooks/send-event.cjs` olarak **durur** (mimari §4 klasör
ağacı: "`.claude/hooks/send-event.js` — izlenen projelere kopyalanacak şablon"). Kod turunun
son adımı `npm run install-hook -- .` (bu reponun kendi kökü) çalıştırmaktır — bu, panelin
kendi oturumlarını da izlemesini sağlar (AC5'in "gerçek bir Claude Code oturumu" doğrulaması
zaten bu depoda çalışan oturumla yapılabilir). Kanıt testi (§5/§6): kurulum öncesi/sonrası
`.claude/settings.json`'ın **kopyası** üzerinde 6 mevcut hook kaydının (`session-start.cjs`,
`gate-check.cjs`, `block-dangerous.cjs`, `asset-guard.cjs`, `post-format.cjs`, `stop-check.cjs`)
**birebir korunduğu** + yeni 13 `send-event.cjs` kaydının eklendiği doğrulanır. **Gerçek
`.claude/settings.json` dosyasına kod turunda elle bir kez uygulanır ve commit'e dahil edilir**
(bu bir "değişecek dosya" değil, kurulum scriptinin kullanıcı tarafından çalıştırılmasının doğal
sonucudur — madde 2.2 notu).

### 8) `install-hook.mjs` — birleştirme algoritması (özet, ayrıntı §6)

Mimari §8.3 son not: "Mevcut hook'lar... silinmez; aynı olay tipinde ikinci bir matcher grubu
olarak eklenir." Algoritma bunu **birebir** uygular: her 13 olay tipi için, `settings.hooks
[olayTipi]` (yoksa `[]`) dizisine, komutu `node .claude/hooks/send-event.cjs` olan bir grup
**zaten var mı** diye bakılır (komut dizgesi + `matcher` alanı eşleşmesiyle); yoksa mimari
§8.3'teki tam grup nesnesi **eklenir** (mevcut grup(lar) **dokunulmadan** kalır). `matcher: "*"`
kullanan olay tiplerinde bu, mevcut dar `matcher`'lı (`Edit|Write`, `Bash`, vb.) grupların
**yanına**, ayrı bir grup olarak eklenir.

---

## 4. Script sözleşmesi (`send-event.cjs`)

**Girdi:** stdin, UTF-8, Claude Code hook JSON'u (bilinen alanlar: `hook_event_name`, `cwd`,
`session_id`, `agent_id`, `agent_type`, `tool_name`, `tool_input`, `tool_use_id`,
`permission_mode`, `transcript_path`, `prompt_id`, `user_input`, `last_assistant_message`,
`reason`, `notification_type` — hiçbiri zorunlu değil, script hiçbirini doğrulamaz).

**stdin okuma tavanı (tur 2 düzeltmesi — bulgu 6, tanımsızlık kapatıldı):** okunan veri
**1.000.000 karaktere** ulaşınca (JS string uzunluğu, mimari §8.2 örneğindeki `buf.length <
1_000_000` sabitiyle **birebir aynı**, yeni bir sayı icat edilmiyor) sonraki veri **atılır**,
o ana kadar biriken metin `'end'` geldiğinde ayrıştırılmaya çalışılır. Bu, geçerli bir JSON'u
ortasından kesip bozabilir — aşağıdaki "parse hatası" yolu tam olarak bunun için tanımlanır.

**Parse hatası gövde şekli (tur 2 düzeltmesi — bulgu 6; tur 3 düzeltmesi — QA'nın bulduğu
regresyon, bkz. "Kod turuna devredilen" altındaki gerekçe):** stdin metni boşsa (`''`) `{}` olarak
kabul edilir (mevcut davranış, değişmedi). stdin metni **boş değil ama** `JSON.parse` başarısız
oluyorsa veya sonuç bir "plain object" değilse, sunucuya gönderilecek gövde şu **sabit şekle**
sahiptir (kendisi her zaman geçerli JSON'dur, sunucu tarafında normal yoldan işlenir):
```json
{
  "hook_event_name": "unknown",
  "project_path": "<cwd/CLAUDE_PROJECT_DIR/process.cwd() üzerinden en iyi tahmin, madde 6 ile aynı algoritma>",
  "mc_parse_error": true,
  "raw_text": "<orijinal stdin metninin ilk 2000 karakteri — SABİT bir sayı, MC_MAX_PAYLOAD DEĞİL>"
}
```
**Karar (tur 3 — üç seçenek arasından):** `raw_text` `MC_MAX_PAYLOAD` (vars. 65536) yerine
**sabit 2000 karaktere** kırpılır. Gerekçe: `MC_MAX_PAYLOAD` kadar uzun bir `raw_text` ile
serileştirilmiş zarfın toplam boyutu neredeyse her zaman `MC_MAX_PAYLOAD`'ın **kendisini aşar**
(diğer alanlar + JSON kaçış karakterleri eklenince) — bu da iki farklı kırpma katmanını art arda
tetikler ve `raw_text`'i tamamen kaybettirir: (1) istemci tarafında §3 madde 5'in KARAR C zarfı
devreye girer, o zarfın korunan alan listesinde (§3 madde 5, satır ~305-313) `raw_text` **yok**;
(2) istemci kırpması bir şekilde atlansa bile sunucu tarafında `normalize.ts:114-123`
(`serialized.length > maxPayload`) `raw`'ı `{truncated, byte_length, keys}` ile değiştirir, yine
`raw_text` kaybolur. **Diğer iki seçenek reddedildi:** `raw_text`'i KARAR C zarfının korunan
alanları listesine eklemek (o zarf farklı bir amaca hizmet ediyor — büyük `tool_input`/
`user_input` gibi özet kaynaklarını kırpıp korumak, ham parse-hatası metnini değil; ekleme
kavramsal karışıklık yaratırdı) ve parse hatası yolunu kırpma zarfından tamamen muaf tutmak
(ayrı bir kod dalı/bayrak gerektirir, Karpathy §2 gereksiz soyutlama). Sabit 2000 karakter,
zarfın toplam serileştirilmiş boyutunu (diğer alanlarla birlikte, kaçış payı dahil) `MC_MAX_
PAYLOAD`'ın varsayılan değerinin (65536) **çok altında** (birkaç bin bayt) tutar — bu yüzden ne
istemci tarafı KARAR C zarfı ne de sunucu tarafı `normalize.ts:114-123` truncation'ı tetiklenir;
`raw_text` her iki katmandan da **değişmeden** geçer. `normalize.ts`'in **kendi** parse-hatası
fallback'i (satır 94-105, `raw: { raw_text: rawBody.slice(0, maxPayload) }`, bu farklı bir yol —
sunucunun ham HTTP gövdesini hiç ayrıştıramadığı durum, bizim gönderdiğimiz zarf her zaman
geçerli JSON olduğu için bu dala hiç düşülmez) ile aynı **alan adını** (`raw_text`) kullanır ama
**farklı bir kırpma sınırı** taşır — bu kasıtlıdır, ikisi farklı senaryolar (istemcinin kendi
stdin'i parse edememesi vs. sunucunun HTTP gövdesini parse edememesi). Sonuç: `raw_text` alanı
sunucuda güvenilir biçimde `EventRecord.raw.raw_text` olarak saklanır.

**Ortam değişkenleri:**
| Değişken | Vars. | Etki |
|---|---|---|
| `MC_PORT` | `7333` | Hedef sunucu portu. Geçersiz/boşsa varsayılana düşer (server'ın `resolvePort`'uyla aynı tolerans, kod tekrarı küçük ve kasıtlı — `.cjs` bağımsız dosya, TS import edemez, `check-ports.mjs`'in kendi kopyasını taşıma emsaliyle aynı, bkz. F-002 sözleşmesi §2.2 "kod turu notu N2"). |
| `MC_MAX_PAYLOAD` | `65536` | İstemci tarafı kırpma eşiği (§3 madde 5) ve stdin/`raw_text` kırpma sınırı (yukarı). NOT 11 (kod turu, sözleşme değişikliği gerekmez): sunucunun `resolveEnvInt`'i (`src/server/index.ts:73-80`) `0`'ı geçerli bir değer sayıyor; istemci okuması `Number(...) \|\| 65536` yerine aynı `Number.isInteger(parsed) && parsed >= 0` kontrolünü taklit edecek, `0`'ı sessizce 65536'ya çevirmeyecek. |
| `MC_DISABLE` | *(boş)* | `"1"` ise script **hiçbir şey yapmadan** `exit(0)` — stdin bile okunmaz. |

**Çıktı:** yalnızca ağ isteği (`POST http://127.0.0.1:<MC_PORT>/api/events`,
`Content-Type: application/json`). **stdout/stderr'e hiçbir koşulda yazmaz.**

**Çıkış kodları:** **her zaman `0`**. Hiçbir dal `process.exit` ile 0 dışı bir değer
döndürmez; `process.exitCode` de ayarlanmaz. (Node'un varsayılan davranışı olası bir
`require`/senkron hata durumunda niha kodu 1 yapabilir — bu, §3 madde 1'in test ettiği tam
olarak budur; normal çalışan kodda bu yol hiç işlemez.)

**Hata davranışları ve süre bütçesi:** §3 madde 3 tablosu + dosya sonundaki "## Süre bütçesi".

---

## 5. Kabul kriteri → test eşlemesi

| AC | Test | Not |
|---|---|---|
| AC1 (stdin okur, alanları çıkarır, `POST /api/events`'e gönderir, `transcript_path` dahil) | `tests/integration/send-event-hook.test.ts` › `"geçerli payload → sunucuya 202, transcript_path korunur"` | Gerçek `createServer` + gerçek çocuk süreç; `GET /api/events` ile doğrulanır. |
| AC2 (sunucu kapalı → hata yok, blok yok, exit 0) | `send-event-hook.test.ts` › 5 alt senaryo, **tur 2'de bölündü (bulgu 2)**: `"ECONNREFUSED"`, `"ECONNRESET"`, `"sessiz sunucu (a)"`, `"damla sunucu (b)"`, `"stdin hiç kapanmıyor (c)"` — hepsi `exitCode===0`, `stdout/stderr===''`, ilk dördü ayrıca `elapsedMs > 1000` ise KIRILIR (sert kapı, CEO kararı — DÜZELTME); ayrı bir zamanlayıcı-sabitleri birim testi (stdin 120 · idle 100 · toplam 150) saat kullanmadan doğrulanır (bkz. "## Süre bütçesi") | §3 madde 3. |
| AC3 (bilinmeyen/eksik alanda çökmez, bilinmeyenler ham iletilir) | `send-event-hook.test.ts` › `"boş stdin → yine 202"`, `"bilinmeyen alanlar (ör. x_custom_field) sunucudaki raw'da görünür"`, **yeni (bulgu 6, tur 3'te `raw_text` 2000 karaktere sabitlenerek kırpma çakışması giderildi — §4):** `"bozuk JSON stdin → 202 + sunucuda raw.raw_text görünür"` | `raw`'ın sunucu tarafında saklandığı zaten F-002'nin işi; burada yalnızca hook'un bu alanları **silmediği** doğrulanır. |
| AC4 (`install-hook` kopyalar + settings.json satırlarını ekler; bozmaz; çift çalıştırmada çift kayıt yok) | `tests/scripts/install-hook.test.ts` › `"temiz hedefte kurulum"`, `"iki kez çalıştırma → tek kayıt (pozitif kontrol: exitCode===0 ve özet '0 eklendi/13 zaten var' diyor)"`, `"mevcut yabancı hook'lar korunur (bu reponun settings.json kopyası)"`, `"bozuk JSON → hiçbir şey yazmadan hata, .claude/hooks/send-event.cjs OLUŞMAMIŞ"`, `"settings.json hiç yokken → sıfırdan oluşturur"`, **yeni (bulgu 7):** `".bak ilk koşuda kurulum-öncesi içerikle oluşur"`, `".bak ikinci koşuda değişmez"` | §6. |
| AC5 (gerçek oturumda elle doğrulama + KURULUM.md) | **Otomatik test YOK — kullanıcı/CEO adımı.** `KURULUM.md` §"Doğrulama" bu adımı tarif eder. Kod turu bu depoda `npm run install-hook -- .` çalıştırıp CEO'ya "gerçek oturumda bir olay panelde görünüyor mu" sorusunu bırakır. | Bilinçli, otomatikleştirilemez adım — brief'in kendi talimatı. |
| AC6 (smoke test: sahte payload → script → sunucuya ulaştığı otomatik doğrulanır) | `send-event-hook.test.ts` › `"AC6 smoke: emit-hook.ts ile sahte payload, GET /api/events'te görünür"` | `tests/helpers/emit-hook.ts` kullanılır. |
| (Ek, brief madde 1) uzantı tuzağı | `install-hook.test.ts` › `"type:module hedefte çalışır"`, `"type yok (CJS varsayılan) hedefte çalışır"` | §3 madde 1. |
| (Ek, brief madde 4) Host/Origin 403 almama | `send-event-hook.test.ts` › `"gerçek sunucuya POST 403 almaz"` (AC1 testinin bir parçası, ayrı assert) | §3 madde 4. |
| (Ek, brief madde 5/6) bu reponun kendi settings.json'ı bozulmaz | `install-hook.test.ts` › `"bu reponun gerçek settings.json'ının KOPYASI — 6 mevcut hook korunur"` | §3 madde 7. |
| (Ek, brief madde 7) `MC_MAX_PAYLOAD` aşımı kırpar, `summary` boş kalmaz | `send-event-hook.test.ts` › `"200 KB tool_input (Bash) → istemci kırpar, olay kaydedilir, summary boş değil"`, **yeni (KARAR C/bulgu 4):** `"200 KB user_input (UserPromptSubmit) → aynı doğrulama"` | §3 madde 5. |
| (Ek, brief madde 8) `MC_DISABLE=1` | `send-event-hook.test.ts` › `"MC_DISABLE=1 → sunucuya hiç istek gitmez"` — **tur 2'de pozitif kontrol eklendi (bulgu 8):** aynı test önce `MC_DISABLE` **olmadan** çalıştırıp olay sayısının **+1 arttığını**, sonra `MC_DISABLE=1` ile **artmadığını** aynı test içinde ölçer | Sunucudaki olay sayısı POST öncesi/sonrası **değişmez** olarak doğrulanır. |
| (Ek, CEO kararı A) `no-external-host` çitinin `.claude/hooks/**`+`.cjs` kapsaması | `tests/no-external-host.test.ts` › mevcut `it.each(files)` bloğu yeni köke otomatik uygulanır + yeni `"taranan dosyalar arasında .claude/hooks kökünden en az biri var"` körlük kontrolü | §1, §2.2, §8, §7 mutasyon 6. |

---

## 6. Kurulum scripti sözleşmesi (`install-hook.mjs`)

**Bağlayıcı kural (CEO kararı D, tur 2 — bulgu 10, feature notu "CEO kararları" satır 39-40):**
hiçbir agent `install-hook`'u bu deponun dışındaki bir yola karşı CEO/kullanıcı onayı olmadan
çalıştıramaz. Bu yüzden §5 AC4'ün **tüm** testleri yalnızca testin kendi oluşturduğu geçici
dizinlere (`os.tmpdir()` altında, `tests/helpers/temp-data-dir.ts` deseniyle) kurulum yapar;
kod turunda gerçek bir hedefe yapılan **tek** çalıştırma bu reponun **kendi köküdür** (§3 madde 7,
feature spesifikasyonunun kendisi tarafından önceden onaylanmış istisna) — gerçek bir kullanıcı
projesine kurulum her zaman ayrı bir kullanıcı/CEO onayı gerektiren, bu feature'ın dışında bir
adımdır.

**Çağrı:** `npm run install-hook -- <proje-yolu>` (npm scripts alanına eklenir:
`"install-hook": "node scripts/install-hook.mjs"`).

**Argüman doğrulama:**
- Argüman yoksa → Türkçe hata + `process.exitCode = 1`, hiçbir dosyaya dokunulmaz.
- Yol yoksa (`fs.existsSync` false) veya bir dizin değilse (`fs.statSync(...).isDirectory()`
  false) → Türkçe hata + `exitCode = 1`, hiçbir yazma yapılmaz. **`docs/features` klasörünün
  varlığı doğrulanmaz** — bu, Mission Control'ün kendi proje-kayıt kavramıdır (F-005),
  `install-hook`'un işiyle ilgisizdir; herhangi bir Claude Code çalışma dizinine kurulabilir.

**Adımlar (sırayla, ilk hatada dur, kısmi yazma bırakma — tur 2'de sıra düzeltildi, bulgu 5):**

Tur 1 hatası: `send-event.cjs` adım 2'de **kopyalanıyordu**, `settings.json`'ın
ayrıştırılabilirliği adım 3'te (sonra) kontrol ediliyordu — yani bozuk JSON durumunda "hiçbir
şey yazılmadı" iddiası **yanlıştı**: hedefte kayıtsız bir hook dosyası kalıyordu. Yeni sıra,
**hiçbir dosya sistemi yazma işlemi** `settings.json`'ın okunup ayrıştırılabilir olduğu
kanıtlanmadan **önce** olmayacak şekilde:

1. `<hedef>/.claude/settings.json` oku ve ayrıştırmayı dene:
   - **Dosya yoksa:** `{ hooks: {} }` ile başla (yedek **alınmaz** — korunacak bir şey yok),
     devam et.
   - **Dosya var ama `JSON.parse` patlıyorsa:** **hiçbir dosyaya dokunmadan** dur — `.claude/
     hooks/` dizini oluşturulmaz, `send-event.cjs` kopyalanmaz, yedek alınmaz — Türkçe hata
     mesajıyla `exitCode = 1` dön ("`.claude/settings.json` bozuk, elle düzeltin"). Kullanıcının
     bozuk dosyasının üzerine "düzeltilmiş" bir tahminle yazmak, sessiz veri kaybı riski taşır.
   - **Dosya var ve geçerli JSON:** eğer `<hedef>/.claude/settings.json.bak` **henüz yoksa**,
     mevcut içeriği oraya kopyala (yalnızca **ilk** kurulumdan önceki saf durumu yakalar —
     ikinci/üçüncü çalıştırmalarda `.bak` **üzerine yazılmaz**). **Neden yalnızca ilk çalıştırma
     (bulgu 7'nin sorduğu "geri dönüş kayboluyor mu?" sorusunun cevabı):** `install-hook`'un
     kendi birleştirme algoritması **kanıtlanmış biçimde yalnızca ekleyicidir** (bkz. "Yıkıcı
     davranış değerlendirmesi" aşağıda) — hiçbir çalıştırma, önceki bir çalıştırmanın eklediği
     veriyi bozamaz/silemez. Dolayısıyla "2. çalıştırma bir şeyi bozarsa" senaryosunda geri
     dönülecek en anlamlı nokta zaten **kullanıcının hiç `install-hook` çalıştırmadığı orijinal
     hâldir** — 1. çalıştırma öncesi `.bak` bunu tam olarak sağlar. "2. çalıştırma öncesi hâle"
     ayrı bir yedek almak (ör. her çalıştırmada üzerine yazmak) yalnızca 1. çalıştırmanın kendi
     eklediği kayıtları "orijinal" sayma riski taşırdı — bu daha kötü bir varsayılan olurdu. Tek
     gerçek risk, `install-hook` DIŞINDA bir aktörün (kullanıcının elle düzenlemesi) 1. ve 2.
     çalıştırma arasında dosyayı değiştirip sonra kaybetmesidir — bu senaryo `install-hook`'un
     sorumluluğu dışındadır (script kendi yazdığı satırların dışına hiç dokunmaz).
2. `<hedef>/.claude/hooks/` yoksa `fs.mkdirSync(recursive:true)` ile oluştur.
3. `send-event.cjs`'in **bu depodaki** kaynağını (`.claude/hooks/send-event.cjs`, tek doğruluk
   kaynağı) oku, `<hedef>/.claude/hooks/send-event.cjs`'e **koşulsuz üzerine yaz** (idempotent —
   içerik her zaman üretilen/sabit, kullanıcı elle düzenlemez; ADR-006 "install-hook üzerine
   yazarak günceller" notuyla tutarlı).
4. `settings.hooks` yoksa `{}` ile başlat. Mimari §8.3'teki 13 olay tipinin her biri için:
   - O olay tipi için dizi yoksa `[]` ile başlat.
   - Dizide `hooks[].command === 'node .claude/hooks/send-event.cjs'` **ve** (varsa) aynı
     `matcher` değerine sahip bir grup **zaten varsa** → atla (idempotentlik).
   - Yoksa mimari §8.3'teki tam grup nesnesini (varsa `matcher: "*"` dahil) diziye **ekle**
     (mevcut grup(lar) dokunulmaz, sırası korunur).
5. Sonucu **atomik** yaz: `tmp = <hedef>/.claude/settings.json.tmp-<pid>`, `writeFileSync` +
   `renameSync` (mimari §3.6/§7.2'nin atomik yazma desenine tutarlı, gerçi burada bir güvenlik
   sınırı değil, yalnızca yarım yazılmış JSON riskine karşı ucuz bir önlem). NOT 12 (kod turu,
   sözleşme değişikliği gerekmez): `JSON.stringify(merged, null, 2)` kullanılacak; testler
   dosyanın ham metnini değil `JSON.parse` edilmiş yapısını karşılaştıracak (bu reponun elle
   biçimlendirilmiş `settings.json`'ı yeniden biçimlenir ama anlamsal kayıp olmaz).
6. Türkçe özet yazdır (kaç yeni kayıt eklendi, kaç zaten vardı, yedek nereye alındı).

**`--dry-run` bayrağı (opsiyonel, varsayılan KAPALI):** `npm run install-hook -- <yol>
--dry-run` verilirse yukarıdaki 2-5. adımlar **hiçbir dosyaya yazmadan** planlanan değişiklikleri
(kopyalanacak dosya, eklenecek olay tipi sayısı, zaten var olanlar) stdout'a Türkçe yazar ve
`exitCode = 0` ile döner. **Varsayılan gerçek yazmadır** (dry-run değil) — AC4'ün kendisi
"kopyalar ve ekler" diyor, yani varsayılan davranış budur; `--dry-run` yalnızca ihtiyaten
eklenen, ucuz (aynı kod yolunun `if` ile atlanması) bir önizleme seçeneğidir, ayrı bir alt
komut/soyutlama katmanı değildir.

**Yıkıcı davranış değerlendirmesi:** Bu script izlenen projenin **tek** dosyasını
(`settings.json`) **ekleyerek** değiştirir — hiçbir mevcut anahtar/değer silinmez veya
üzerine yazılmaz (yalnızca `hooks[olayTipi]` dizilerine **push**). En kötü senaryo: kullanıcı
`.claude/settings.json`'ını elle çok özel bir biçimde düzenlemişse (ör. `hooks` bir dizi değil
farklı bir şema) — script `Array.isArray` kontrolüyle böyle bir alanı **atlayıp** Türkçe bir
uyarı basar, o olay tipine dokunmaz, süreci durdurmaz (defensive, crash yok). Geri dönüş yolu:
`.bak` dosyası her zaman kurulum-öncesi hâli taşır (yukarıdaki gerekçe).

---

## 7. Mutasyon planı (kasıtlı bozup KIRMIZI görülecek 7 kritik test — tur 2'de +2)

1. **Uzantı tuzağı:** `install-hook.test.ts`'in "type:module hedefte çalışır" testinde,
   kopyalanan dosyanın içeriğini geçici olarak `.js` uzantılı bir kopyaya yazıp çalıştırarak
   (script içeriği aynı `require` tabanlı kalır) `type:module` hedefte gerçekten patladığını
   (`exitCode !== 0`, stderr'de `ReferenceError`/`require is not defined`) doğrula → bu,
   `.cjs` kararının **gerçekten** işe yaradığının kanıtı. Sonra `.cjs` gerçek kopyasına dönülür,
   test tekrar yeşil olur.
2. **`process.on('uncaughtException', ...)` guard'ını kaldır** (send-event.cjs'de bir satır
   yorumla) + `send()` fonksiyonunun içine bilerek `throw`'a düşen bir kod yolu tetikleyen bir
   payload gönder → mutasyonla script **0 dışı** bir kodla çıkmalı/stderr'e yazmalı → ilgili
   test (AC2/AC3 grubu) kırmızı vermeli. Geri al, tekrar yeşil doğrula.
3. **Toplam ağ süresi bekçisini (150 ms, idle'dan bağımsız katman) kaldır**, yalnızca
   `req.setTimeout(100)` (idle) bırak → **tur 2 düzeltmesi (bulgu 2): hedef yalnızca "damla
   sunucu (b)" testine sabitlendi** — bu test 40 ms aralıkla veri damlatan bir sunucu kullandığı
   için idle zamanlayıcısı her defasında sıfırlanır ve **hiç tetiklenmez**; mutasyon sonrası
   script asılı kalır, test **timeout** ile kırmızı verir. **"Sessiz sunucu (a)" testi bu
   mutasyondan etkilenmemeli ve yeşil kalmalıdır** (idle katmanı hâlâ yerinde, 100 ms'de
   tetiklenir) — bu, iki katmanın gerçekten bağımsız ve her ikisinin de gerekli olduğunun kanıtı.
4. **`MC_DISABLE` kontrolünü kaldır** → `"MC_DISABLE=1 → sunucuya hiç istek gitmez"` testi
   kırmızı vermeli (sunucuda olay sayısı artar, pozitif kontrol sayesinde ölçülebilir — bulgu 8).
5. **`install-hook.mjs`'teki idempotentlik kontrolünü (adım 4'teki "zaten var mı" kontrolü)
   kaldır** → `"iki kez çalıştırma → tek kayıt"` testi kırmızı vermeli (kayıt sayısı 2 olur,
   pozitif kontrol sayesinde ölçülebilir — bulgu 8).
6. **(Yeni, bulgu 3) stdin boşta kalma bekçisini (120 ms) kaldır** → `"stdin hiç kapanmıyor (c)"`
   testinde script hiçbir zaman çıkmaz (stdin `'end'` yayınlanmadığı için sonsuza kadar bekler);
   test sınırlı bir üst bekleme (ör. 600 ms) sonunda çocuk sürecin **hâlâ çalıştığını**
   (`exitCode === null`) doğrulayıp süreci elle sonlandırır — bu, daha önce hiç testi olmayan
   katmanın gerçekten gerekli olduğunun kanıtı.
7. **(Yeni, CEO kararı A/bulgu 1) `send-event.cjs`'e geçici bir dış host literali ekle**
   (`https://evil.example.com`, string olarak, kod yolunda hiç çalıştırılmadan) → genişletilmiş
   `no-external-host` testi (`.claude/hooks/**.cjs` kökü dahil) bu dosyada eşleşme bulup
   **kırmızı** vermeli. Ayrıca guard'ın **kör olmadığını** kanıtlayan "taranan dosyalar arasında
   `.claude/hooks` kökünden en az biri var" testi, `.claude/hooks` yolunu kasten yanlış yazarak
   (ör. `'.claude', 'hoooks'`) **kırmızı** verdirilip doğrulanır.

Her mutasyon: uygula → ilgili test dosyasını izole çalıştır (`npx vitest run <dosya>`) →
kırmızı gözlemi kaydet → Edit ile birebir geri al → tekrar yeşil olduğu doğrulanır. `git diff`
turun sonunda mutasyon izi göstermemeli.

---

## 8. Riskler

- **(Tur 1'de risk olarak listelenmişti, tur 2'de KAPATILDI — CEO kararı A)**
  `tests/no-external-host.test.ts` artık `.claude/hooks/**` + `.cjs` uzantısını da tarıyor
  (§1, §2.2, §5, §7 mutasyon 7). Kalan tek artık-risk-olmayan not: guard yalnızca **statik
  metin** taraması yapar, çalışma zamanı davranışını doğrulamaz — ama script zaten yalnızca
  `127.0.0.1` IP literaline bağlanıyor (§3 madde 4), bu ikisi birlikte yeterli kapsam sağlıyor.
- Kurulum scripti `settings.json`'ı **her çalıştırmada** okuyup yeniden yazıyor; kullanıcı iki
  farklı terminalde aynı anda iki kez çalıştırırsa (çok düşük olasılık, tek kullanıcılık araç)
  bir yarış durumu (son yazan kazanır) mümkün — kilitleme mekanizması **eklenmiyor**
  (Karpathy §2, hiçbir AC bunu istemiyor, senaryo gerçekçi değil).
- `send-event.cjs`'in kendi `MC_PORT` çözümü `src/server/index.ts`'in `resolvePort`'undan
  **ayrı bir kopyadır** (TS import edilemediği için) — ikisi sürüklenirse (biri değişip diğeri
  değişmezse) tutarsızlık oluşabilir. F-002'nin `check-ports.mjs` için aynı riski zaten kabul
  ettiği emsalle tutarlı (bkz. F-002 sözleşmesi kod turu notu N2).
- Gerçek Claude Code sürümünde `async: true`'nun desteklenip desteklenmediği bu ortamda
  doğrulanamıyor (kabuk erişimi yok, ADR-006 gerekçe 5). Desteklenmiyorsa hook senkron çalışır;
  scriptin kendi ≤400 ms toplam bütçesi (§3 madde 3, "## Süre bütçesi") en kötü durumu sınırlar.
- **(Tur 2'de açılmıştı, tur 3'te CEO kararı — DÜZELTME ile kapatıldı) Ölçüm jitter'ı:** eski
  tek kademeli `elapsedMs < 400` assert'i CI'da nadiren gevşek (flaky) kırmızı verebilirdi.
  Çözüm: §5/§7 artık gerçek duvar saatine yalnızca **> 1000 ms** sert kapıda bakıyor (ADR-006
  eşiği, soğuk başlangıç jitter'ına dayanıklı) ve 400 ms'lik tasarım bütçesi saat kullanmayan bir
  zamanlayıcı-sabitleri birim testi + her bekçi için ayrı mutasyonla (§7 madde 3, 6) kanıtlanıyor.
  Kalan risk yalnızca teorik: bir CI makinesi 1 s'yi aşacak kadar yavaşsa (loopback'te ağ
  gecikmesi olmadığından gerçekçi değil).

---

## 9. CEO'ya sorular

1. ~~`tests/no-external-host.test.ts` çitinin genişletilmesi~~ — **CEO kararı A ile kapandı.**
   Çit artık F-004 kapsamında, §1/§2.2/§5/§7 mutasyon 7'de işlendi. Açık soru kalmadı.
2. ~~Feature notunun `POST /events` yazımı~~ — **CEO kararı 1 ile (uyum kontrolü tablosu)
   kapandı.** Feature notu satır 14 zaten `POST /api/events` diyor (✓ VERIFIED); kod turunda bu
   satırda yapılacak bir şey yok. Açık soru kalmadı.
3. **(Yeni, bulgu 9 — eylem talebi, CEO onayı gerektirir, kod değişikliği değil)**
   `docs/02-architecture.md` §8 başlığı, §8.2 örnek kodu, §8.3 `settings.json` şablonu ve §4
   klasör ağacı hâlâ `send-event.js` diyor (13 yerde, ✓ VERIFIED: satır 42, 77, 162, 164, 219,
   378, 584, 588, 666, 674-711 arası 13 JSON satırı, 717-720, 829, 906, 967, 988); §8.3 ayrıca
   `install-hook`'un **birebir kopyaladığı TAM metin** olduğu için düzeltilmezse bir sonraki
   okuyucu yanlışlıkla `.js` kaydı kurar. Bu, G2 onaylı bir doküman — developer'ın sahiplik
   alanı dışında (KISITLAR), bu yüzden kendim değiştirmiyorum. **Talep: CEO (veya architect)
   `docs/02-architecture.md` §8.2/§8.3/§4'teki `send-event.js` geçtiği yerleri `send-event.cjs`
   olarak güncellesin** (uç nokta zaten her yerde doğru, `/api/events` — bulgu 9'un bu kısmı
   zaten kapalı). Kod turu bu doküman güncellenmeden de ilerleyebilir (mimari sözleşmenin geri
   kalanı doğru), ama güncellenmezse doküman borcu kalıcı olarak yanlış bir şablon taşımaya
   devam eder.

Yukarıdakiler dışında açık soru yok.

---

## Bitti tanımı (bu tur)

- `docs/qa/F-004-contract.md` yazıldı, §1-§9 dolduruldu, her mimari iddia dosya:satır
  referanslıdır.
- `git status` yalnızca bu dosyayı yeni gösteriyor; `src/`, `tests/`, `scripts/`, `.claude/`
  altında hiçbir değişiklik yok.
- Sıradaki adım: qa-evaluator bu sözleşmeyi inceler; onaylanırsa kod turu başlar.

---

## QA sözleşme incelemesi — tur 1 (qa-evaluator, 2026-09-04)

KARAR: DÜZELTME
ESKALE: false

Kapsam: yalnızca sözleşme metni incelendi; kod yazılmadı, uygulama çalıştırılmadı, hiçbir
kaynak/config dosyası değiştirilmedi. Aşağıdaki her iddia dosya okunarak doğrulandı
(grep sonucuna güvenilmedi).

### Bulgular (3 BLOKLAYICI · 7 ÖNEMLİ · 2 NOT)

| # | Şiddet | Sözleşme yeri | Bulgu | İstenen düzeltme (tek cümle) |
|---|---|---|---|---|
| 1 | BLOKLAYICI | §1 "Dışında" son madde (satır 60-61), §2.2 (satır 86-91), §8 ilk madde, §9 soru 1 | `no-external-host` çitinin genişletilmesi hâlâ kapsam dışı bırakılmış ve CEO'ya soru olarak sorulmuş; oysa feature notunun "CEO kararları" bölümü (satır 33-36) bunu **F-004 kapsamı** ilan etti, tartışmaya kapalı. Ek olarak korku yersiz: `.claude/hooks/` altındaki 8 `.cjs` dosyasının hiçbirinde `http(s)://` literali yok (hepsi okundu), yani çit genişletmesi mevcut testleri kırmıyor. | §1'i "İçinde"ye taşı, §2.2'ye `tests/no-external-host.test.ts`'i **değişecek dosya** olarak ekle (`.claude/hooks` kökü + `.cjs` uzantısı; `scripts/**/*.mjs` zaten kapsanıyor, o dosyanın satır 29'u), §5'e AC satırı, §7'ye "send-event.cjs'e dış host literali ekle → çit KIRMIZI" mutasyonunu ekle ve §9 soru 1'i sil. |
| 2 | BLOKLAYICI | §3 madde 3 son satır (satır 186-188) + §7 mutasyon 3 (satır 426-428) | "Yavaş sunucu" testi **iki farklı sunucu** arasında seçim bırakıyor ("hiç yanıt göndermeyen **veya** 300 ms'lik parçalar hâlinde gönderen"). Sessiz sunucu seçilirse `req.setTimeout(400)` zaten tetiklenir; mutasyon 3 (450 ms sert bekçiyi kaldır) **YEŞİL kalır** ve developer'ın kendi eklediği tek yeni katman hiçbir zaman kanıtlanmaz. | §3 madde 3 ve §5 AC2'yi iki **ayrı** teste böl — (a) "sessiz sunucu" (hiç bayt yok, 400 ms soket bekçisini kanıtlar), (b) "damla sunucu" (bağlantıdan sonra tam 300 ms aralıkla 1 bayt, en az 5 kez, sonsuza kadar) — ve §7 mutasyon 3'ün hedefini yalnızca (b) olarak sabitle. |
| 3 | BLOKLAYICI | §3 madde 3 tablosu (satır 167-174), §4 (satır 330-333), §8 son madde | En kötü durum süre bütçesi hiç hesaplanmamış: stdin bekçisi (2000 ms) ile ağ bekçisi (450 ms) **ardışık** fazlardır, dolayısıyla script en kötü ~2,5 s yaşar. ADR-006 "Sonuçlar / riskler" (o dosyanın satır 42'si) F-004'e bağlayıcı bir görev veriyor: "F-004 bunu **ölçer**; ölçüm 1 s'yi aşarsa CEO'ya bildirilir." Sözleşmede ne ölçüm, ne bütçe, ne CEO bildirimi var; ayrıca 2000 ms'lik stdin katmanının **hiçbir testi ve hiçbir mutasyonu yok** (§5 ve §7'de geçmiyor), yani "her yolda exit 0" iddiasının bu dalı kanıtsız. | §3 madde 3'e en kötü durum tablosunu (süreç açılışı + faz A + faz B) yaz, mimari §8.1'in "asla 400 ms'ten uzun" kuralından sapmayı gerekçelendir ya da stdin bekçisini düşür, §5'e "stdin hiç kapanmıyor → exit 0, stdout/stderr boş" testini ve §7'ye "stdin bekçisini kaldır → test asılır" mutasyonunu ekle, ADR-006'nın 1 s eşiği aşıldığı için §9'a CEO bildirimi koy. |
| 4 | ÖNEMLİ | §3 madde 5 (satır 235-253) | İstemci kırpması `tool_input`'u **tamamen düşürüyor**; sunucunun `deriveSummary`'si özeti her zaman `tool_input`/`user_input`'tan **kendisi** türetiyor (`normalize.ts:42-68` ve `:139`), yani bugün 64 KB-256 KB arası bir olayda **doğru çalışan** `summary` F-004'ten sonra kalıcı olarak boş kalacak — ADR-006 gerekçe 3 tam tersini varsayıyordu (özet istemcide, kırpmadan **önce** hesaplanır). Sözleşme bunu "kabul edilen sonuç" diye geçiştiriyor ama bu bir davranış **gerilemesi**. | Kırpma zarfına `tool_input`'un yalnızca özet üreten skaler alanlarını (`command`, `file_path`, `path`, `description`, `pattern`) ve `user_input`/`last_assistant_message`/`reason`/`notification_type` alanlarını 200 karaktere kırpılmış hâlde **koru**, ve 200 KB testine "sunucudaki `summary` boş DEĞİL" assert'ini ekle. |
| 5 | ÖNEMLİ | §6 Adımlar 2 ve 3 (satır 370-379) | Adım sırası kendi iddiasıyla çelişiyor: `send-event.cjs` adım 2'de **kopyalanıyor**, `settings.json`'ın ayrıştırılabilirliği adım 3'te kontrol ediliyor; bozuk JSON'da "hiçbir şey yazma" iddiası yanlış — hedefte kayıtsız bir hook dosyası kalır ("kısmi yazma bırakma" kuralının ihlali). | Sırayı ters çevir (önce `settings.json` oku + parse et, hata varsa hiç yazmadan çık; sonra kopyala) ve §5 AC4'teki "bozuk JSON" testine "hedefte `.claude/hooks/send-event.cjs` OLUŞMAMIŞTIR" assert'ini ekle. |
| 6 | ÖNEMLİ | §3 madde 6 (satır 274-285), §4 "Girdi" (satır 315-318) | `raw` sarmalayıcısı kaldırıldığı için **stdin geçerli JSON değilse** gönderilecek gövdenin şekli hiçbir yerde tanımlı değil (mimari §8.2 şablonu bunu `raw.raw_text` ile çözüyordu). Ayrıca şablonun 1 MB'lık stdin okuma tavanı sözleşmede hiç geçmiyor — bu tavan büyük bir payload'ı **JSON'u bozacak şekilde** keser, yani parse hatası gerçek bir yol, teorik değil. | §4'e stdin tavanını sayısal olarak yaz ve parse hatası gövdesini birebir tanımla (ör. `hook_event_name: "unknown"` + `project_path` + `mc_parse_error: true` + `raw_text` = metnin `MC_MAX_PAYLOAD` kadarı), §5'e "bozuk JSON stdin → 202 + sunucuda `raw_text` görünür" testini ekle. |
| 7 | ÖNEMLİ | §6 adım 3 üçüncü alt madde (satır 380-384), §5 AC4 satırı | Yedek (`.bak`) sözleşmenin tek geri dönüş yolu ama **hiç test edilmiyor**: ne "ilk çalıştırmada kurulum öncesi içerikle oluşur", ne "ikinci çalıştırmada üzerine yazılmaz" assert'i var. Ayrıca `.gitignore` (okundu, 18 satır) `.claude/settings.json.bak` ve `settings.json.tmp-*` desenlerini içermiyor; §7'deki "kod turunda `npm run install-hook -- .` çalıştırılıp commit'e dahil edilecek" adımı bu yedeği depoya sokar. | §5 AC4'e iki assert'li bir test ekle (ilk koşudan sonra `.bak` = kurulum öncesi içerik; ikinci koşudan sonra `.bak` **değişmemiş**) ve §2.2'de `.gitignore`'a `.claude/settings.json.bak` + `.claude/settings.json.tmp-*` satırlarının ekleneceğini yaz. |
| 8 | ÖNEMLİ | §5 AC4 "iki kez çalıştırma → tek kayıt" ve §5 son satır (`MC_DISABLE=1`) | İki test de **totoloji riski** taşıyor: idempotentlik testi ikinci koşu baştan patlasa da yeşil kalır (kayıt sayısı 1'dir), `MC_DISABLE` testi script herhangi bir sebeple bozuksa da yeşil kalır (olay sayısı değişmez). | Her iki teste pozitif kontrol ekle: idempotentlik testinde ikinci koşunun `exitCode === 0` olduğu **ve** özet çıktısının "0 eklendi / 13 zaten var" dediği doğrulansın; `MC_DISABLE` testi önce değişkensiz koşup sayacın **+1 arttığını**, sonra `MC_DISABLE=1` ile **artmadığını** aynı test içinde ölçsün. |
| 9 | ÖNEMLİ | §3 madde 2 (satır 149-161), §9 soru 2 | Doküman borcu eksik sayılmış: feature notu satır 14 **hâlâ** `POST /events`, satır 22 **hâlâ** `send-event.js` yazıyor (CEO kararı "yukarıda düzeltildi" dese de metin düzeltilmemiş); mimari §8.2/§8.3/§4 de baştan sona `send-event.js` diyor — üstelik §8.3 install-hook'un birebir uyguladığı "TAM metin"dir, yani düzeltilmezse bir sonraki okuyucu `.js` kurar. §9 soru 2 ise CEO'nun zaten verdiği kararı tekrar soruyor. | §2.2'ye doküman güncellemelerini ekle (feature notu satır 14 ve 22), mimari §8.2/§8.3/§4'teki `.js` → `.cjs` düzeltmesi için §9'da **onay iste** (G2 onaylı doküman), ve §9 soru 2'yi "CEO kararı 1 ile kapandı" olarak işaretle. |
| 10 | ÖNEMLİ | §6 (tamamı), §7 | CEO kararı 4'ün ikinci yarısı ("hiçbir agent bu scripti bu deponun dışındaki bir yola karşı onaysız çalıştıramaz") sözleşmeye hiç işlenmemiş; §5 AC4 testleri hedef dizinleri `os.tmpdir()` altında açacak (`tests/helpers/temp-data-dir.ts` deseni), yani depo dışına yazılıyor. | §6'ya bağlayıcı kural olarak yaz: kurulum scripti yalnızca (a) testin kendi oluşturduğu geçici dizinlere ve (b) kod turunda bu deponun köküne karşı çalıştırılır; gerçek bir kullanıcı projesine kurulum CEO/kullanıcı adımıdır. |
| 11 | NOT | §4 ortam değişkenleri tablosu (satır 321-325) | `MC_MAX_PAYLOAD` için istemci toleransı yazılmamış; sunucu `resolveEnvInt` ile `0` değerini **geçerli** kabul ediyor (`src/server/index.ts:75-81` ve `:218`), şablonun `Number(...) || 65536` deyimi ise `0`'ı sessizce 65536'ya çevirir — küçük ama gerçek bir davranış sürüklenmesi. Kod turunda tek satırda kapatılabilir. | (kod turu notu, sözleşme düzeltmesi gerekmez) |
| 12 | NOT | §6 adım 5 (satır 391-393) | Atomik yazma `JSON.stringify` çıktısı olduğu için bu deponun elle biçimlendirilmiş `settings.json`'ını (`permissions.allow` satırları tek satırda gruplanmış) baştan sona yeniden biçimlendirir; anlamsal kayıp yok ama güvenlik dosyasının diff'i büyür. Kod turunda 2 boşluk girintili `JSON.stringify` + testin **ayrıştırılmış** yapıyı karşılaştırması yeterli. | (kod turu notu, sözleşme düzeltmesi gerekmez) |

### CEO kararları uyum kontrolü

| # | CEO kararı | Durum | Kanıt |
|---|---|---|---|
| 1 | Uç nokta `/api/events` | UYUYOR | §3 madde 2 ve §4 `/api/events` diyor; `src/server/index.ts:251` ile birebir. Kalan iş yalnızca feature notu satır 14'ün metni (bulgu 9). |
| 2 | Uzantı `.cjs`, düz `.js` yasak | UYUYOR | §3 madde 1 gerekçeli, §5'te iki hedef projede (type:module / type yok) **çalıştırma** testi, §7 mutasyon 1 `.js` kopyasının gerçekten patladığını kanıtlıyor. Sözleşmenin en güçlü bölümü. Yalnız mimari §8.2/§8.3 hâlâ `.js` (bulgu 9). |
| 3 | `no-external-host` çiti F-004 kapsamındadır | **UYMUYOR** | §1 satır 60-61 açıkça kapsam dışı bırakıyor, §9 soru 1 CEO'ya geri soruyor. Bulgu 1 — bloklayıcı. |
| 4 | `--dry-run` kapalı kalabilir; ama depo dışına onaysız çalıştırma yok | KISMEN | Birinci yarı uyuyor (§6 `--dry-run` varsayılan kapalı, koruma katmanları sayılmış); ikinci yarı sözleşmede hiç yok (bulgu 10). |

### Ölçmeyen test riski (yeşil kalabilecek assert'ler)

1. **§7 mutasyon 3 — 450 ms sert bekçi.** Sessiz sunucu seçilirse 400 ms'lik soket bekçisi
   devreye girer ve mutasyon yeşil kalır. En tehlikelisi budur: sözleşmenin mimariye eklediği
   **tek yeni koruma** kanıtsız kalır (bulgu 2).
2. **"iki kez çalıştırma → tek kayıt".** İkinci koşu hiç çalışmasa bile yeşil (bulgu 8).
3. **`MC_DISABLE=1` → olay sayısı değişmez.** Script'in her tür bozukluğu da aynı sonucu
   verir; pozitif kontrol yok (bulgu 8).
4. **`.bak` geri dönüş yolu.** Hiç assert edilmiyor; yedek hiç yazılmasa da tüm testler yeşil
   (bulgu 7).
5. **2000 ms stdin bekçisi.** Ne testi ne mutasyonu var; kaldırılsa hiçbir test kırmızıya
   dönmez (bulgu 3).
6. **`no-external-host` genişletmesi.** Çit genişletilse bile "dış host ekle → KIRMIZI"
   mutasyonu olmadan, yolu yanlış yazılmış (hiçbir dosya bulmayan) bir genişletme yeşil kalır —
   F-002'de "taranacak en az bir dosya bulundu" assert'i (`tests/no-external-host.test.ts:49-51`)
   tam bu yüzden eklenmişti; yeni kök için de aynı körlük kontrolü gerekir (bulgu 1).
7. **Host/Origin 403 almama.** Dolaylı ama geçerli: `src/server/index.ts:225-233` 403'te gövdeyi
   hiç okumaz, olay kaydedilmez; "olay `GET /api/events`'te görünüyor" assert'i 403'ü gerçekten
   dışlar. Bu madde risk **değil** — doğrulandı, itirazım yok.

### En kötü durum süre bütçesi (hesap)

Fazlar **ardışıktır**, dışlayıcı değil — 2000 ms'lik stdin bekçisi 450 ms'lik sert bekçiyle
çelişmez, üstüne biner:

| Faz | Süre | Not |
|---|---|---|
| Node süreç açılışı + `require('node:http')` | ~40-120 ms | Windows'ta soğuk başlangıç; script kontrolünde değil. |
| Faz A — stdin | 0 ms ... 2000 ms | Normalde `end` hemen gelir; bekçi 2000 ms'de `exit(0)` (bu dalda ağ isteği HİÇ gönderilmez). |
| Faz B — ağ | 0 ms ... 450 ms | Sert bekçi istek gönderildiği anda kurulur; 400 ms'lik soket bekçisi bunun bir alt kümesidir. |

- En kötü **gönderen** yol: stdin 1999 ms'de kapanır (bekçi tetiklenmez) + ağ 450 ms + açılış
  ~100 ms = **~2,55 s**.
- En kötü **göndermeyen** yol: stdin bekçisi 2000 ms + açılış ~100 ms = **~2,1 s**.
- Sunucu kapalı (beklenen günlük durum): açılış + `ECONNREFUSED` (loopback'te anında) =
  **~60-150 ms**.
- Sessiz sunucu: **~500 ms**. Damla sunucu: **~550 ms**.

Sonuç: Claude Code hook `timeout: 5` (mimari §8.3, saniye cinsinden) **aşılmaz**, oturum
bloklanmaz — ama (a) mimari §8.1'in "asla 400 ms'ten uzun bekleme" kuralı 6 katına çıkar ve
(b) ADR-006'nın "1 s'yi aşarsa CEO'ya bildirilir" eşiği aşılır. İkisi de sözleşmede
gerekçelendirilmeli (bulgu 3). `async: true` desteklenmiyorsa bu süre **her araç çağrısına**
eklenir; ADR-006'nın senkron alternatifi reddederken kullandığı gerekçe ("gözlemci gözlenene
zarar vermez") tam olarak bunu yasaklıyor.

### Kod turuna geçmek için

Bulgu 1, 2 ve 3 kapatılmalı; 4-10 aynı turda sözleşmeye işlenmeli. 11 ve 12 kod turunda
çözülür, sözleşme düzeltmesi gerektirmez. Tur 2 yalnızca bu 10 maddeye bakacak; onaylanmış
bölümler (§3 madde 1, §3 madde 4, §5 AC1/AC3/AC6, §8 riskler) yeniden açılmayacak.

---

## Süre bütçesi (tur 2, CEO kararı B'nin bağlayıcı ≤ 400 ms kuralına göre yeniden tasarlandı)

Tasarım, mimarinin katman fikrini korur ama sayıları küçültür: stdin bekçisi 2000 ms → **120
ms**; ağ tarafında tek bir 400/450 ms çifti yerine **idle (100 ms) + idle'dan bağımsız toplam
süre bekçisi (150 ms)**. Fazlar hâlâ **ardışıktır** (bütçe faz başına değil toplamdır — QA'nın
uyarısı korunuyor), ama artık üç fazın toplamı ≤ 400 ms'e sığıyor.

| Faz | Üst sınır | Not |
|---|---|---|
| Süreç açılışı (Node cold start + `require('node:http')`) | ~40-120 ms | Script'in kontrolünde değil (önceki turdan değişmedi); ölçüme dahildir, tasarım bütçesi bunun üstüne eklenir. |
| Faz A — stdin bekçisi | 0-120 ms | `MC_DISABLE` kontrolünden hemen sonra kurulur. Normal yolda stdin `'end'` neredeyse anında gelir (~0 ms); yalnızca hiç gelmezse 120 ms'de `exit(0)`, bu dalda **ağ isteği hiç gönderilmez**. |
| Faz B — ağ (idle 100 ms + toplam 150 ms, ikisinden ilk tetiklenen kazanır) | 0-150 ms | İstek nesnesi oluşturulur oluşturulmaz her iki zamanlayıcı da kurulur; başarı/hata/timeout hangisi önce gelirse ikisi de temizlenir. |
| **TOPLAM — en kötü "gönderen" yol** | **~40 + 0 + 150 = 190 ms** (stdin normal kapanırsa) **… en kötü ~40-120 + ~119 + 150 ≈ 309-389 ms** (stdin'in kapanması olağandışı gecikirse, 120 ms bekçisine çok yaklaşıp yine de normal kapanırsa) | Stdin bekçisi TETİKLENMEDİĞİ sürece (yani stdin gerçekten kapandığı sürece) ağ fazı her zaman çalışır; iki fazın süresi toplanır çünkü ardışıktırlar. |
| **TOPLAM — en kötü "göndermeyen" yol (stdin hiç kapanmıyor)** | **~40-120 + 120 = 160-240 ms** | Ağ hiç denenmez, script daha erken çıkar. |
| **TOPLAM — günlük/beklenen yol (sunucu kapalı, `ECONNREFUSED`)** | **~40-120 + 0 + <10 ms = ~50-130 ms** | Loopback'te bağlantı reddi anında gelir, hiçbir zamanlayıcı beklemez. |

**En kötü durum tüm yollarda ~389 ms'in altında kalır** (120 ms açılış + 119 ms sınıra çok
yakın stdin + 150 ms ağ üst sınırı toplamı), CEO kararı B'nin ≤ 400 ms bağlayıcı kuralının
**altında**, yaklaşık 10-15 ms güvenlik payıyla. Bu, önceki turun ~2,55 s'lik hesabına göre
~6,5 kat iyileşme.

**Bu nasıl kanıtlanır (§5/§7, CEO kararı — DÜZELTME (zamanlama assert'i) uyarınca üç parça —
tek kademeli `elapsedMs < 400` duvar saati assert'i artık YOK):**

1. **Sert kapı (dış duvar saati, CI-güvenli):** dört senaryonun (kapalı sunucu `ECONNREFUSED`,
   `ECONNRESET`, damla sunucu (b), 503 dönen sunucu) her birinde `emit-hook.ts`'in döndürdüğü
   gerçek `elapsedMs` **> 1000** ise test KIRILIR (ADR-006'nın 1 s eşiği). Soğuk başlangıç
   jitter'ına dayanıklıdır, gerçek bir gerilemeyi (bekçinin kaldırılması, eski 2000 ms'e dönülmesi)
   kesin yakalar.
2. **Zamanlayıcı sabitleri birim testi (deterministik, saat kullanmaz):** `send-event.cjs`'in
   yapılandırılmış sabitleri — stdin 120 · idle 100 · toplam 150 — doğrudan (script çalıştırılmadan,
   sabit değerler okunarak) doğrulanır.
3. **Bekçilerin gerçekten ateşlendiğinin kanıtı (§7 mutasyon 3, 6):** toplam süre bekçisi
   kaldırılınca damla sunucu (b) testi asılı kalır ve **vitest'in kendi test zaman aşımıyla**
   kırmızı verir (idle hiç tetiklenmez, çünkü item 1 düzeltmesiyle damlama artık sınırsız sürer);
   stdin bekçisi kaldırılınca "(c) stdin hiç kapanmıyor" testi çocuk sürecin sınırlı bir bekleme
   (ör. 600 ms) sonunda **hâlâ çalıştığını** (`exitCode === null`) gözlemler.

Sabitler doğru **ve** bekçiler ateşliyorsa 400 ms'lik tasarım bütçesi yukarıdaki faz tablosundan
aritmetik olarak zaten türer; bu yüzden ayrıca kırılgan bir `elapsedMs < 400` duvar saati assert'i
**kullanılmaz** — duvar saatine bakan tek kontrol 1. maddenin > 1000 ms sert kapısıdır, o da
CI-güvenlidir. Sessiz sunucu (a) testi kendi 100 ms idle bekçisiyle zaten çok daha erken kapanır;
bu katman mimari §8.1'den devralınan, bu feature'ın yeni eklemediği bir mekanizma olduğu için ayrı
bir mutasyonu yoktur, yalnızca 1. maddenin > 1000 ms sert kapısıyla ölçülür.

**Sonuç (CEO kararı B'ye cevap):** 400 ms bütçesi **tutturulabiliyor** — ADR-006/mimari §8.1
değişikliği talep edilmiyor. Kanıt biçimi CEO kararı — DÜZELTME ile kırılgan olmayan iki kademeye
bölündü; script içine test-amaçlı bir ölçüm yan kanalı (ör. `MC_TIMING_FILE`) **eklenmedi** — §4'ün
"stdout/stderr'e hiçbir koşulda yazma" kuralıyla çelişeceği için bu fikir geri çekildi.

---

## Developer düzeltme yanıtı — tur 2 (2026-09-04)

| Bulgu # | Ne değiştirdim | Bölüm/satır |
|---|---|---|
| 1 (BLOKLAYICI) | `no-external-host` genişletmesi "İçinde"ye taşındı, "Dışında"dan çıkarıldı; §2.2'ye `tests/no-external-host.test.ts` "değişecek dosya" olarak eklendi (`.claude/hooks/**` kökü + `.cjs`); §5'e yeni satır (körlük kontrolü dahil); §7'ye mutasyon 7 eklendi; §9 soru 1 kapatıldı. | §1 (İçinde son madde), §2.2 tablo satır 1, §5 son satır, §7 madde 7, §9 madde 1 |
| 2 (BLOKLAYICI) | "Yavaş sunucu" tek testi ikiye bölündü: (a) sessiz sunucu — yalnızca idle katmanını kanıtlar, (b) damla sunucu (40 ms aralık, ≥5 tekrar) — yalnızca toplam süre bekçisini kanıtlar. İki katman ayrı zamanlayıcılar olarak tutuldu (birleştirilmedi) ki mutasyon hedefi (b)'ye sabitlenebilsin. §7 mutasyon 3 yeniden yazıldı: yalnızca toplam süre bekçisi kaldırılır, idle bırakılır; (a) testinin yeşil kalması, (b) testinin kırmızı vermesi ayrı ayrı belirtildi. | §3 madde 3 (tablo + alt senaryolar a/b/c), §5 AC2 satırı, §7 madde 3 |
| 3 (BLOKLAYICI) | Tüm zamanlayıcılar küçültüldü (stdin 2000→120 ms, ağ idle 400→100 ms, yeni toplam süre bekçisi 450→150 ms) ve fazların ardışık olduğu hesaba katılarak en kötü durum ~389 ms'e indirildi (≤400 ms, CEO kararı B). Yeni "## Süre bütçesi" bölümü eklendi (faz tablosu + 4 senaryoluk gerçek `elapsedMs` ölçüm testleri). Stdin bekçisi için ilk kez test (§5 AC2 "(c)") ve mutasyon (§7 madde 6) eklendi. ADR-006 değişikliği istenmiyor — bütçe tutturuldu. | §3 madde 3 (tüm tablo), §4 ("Hata davranışları ve süre bütçesi" satırı), §5 AC2, §7 madde 6, yeni "## Süre bütçesi" bölümü |
| 4 (ÖNEMLİ) | Kırpma zarfına, `deriveSummary`'nin (`normalize.ts:42-67`) gerçekten okuduğu alanlar eklendi: `tool_input.{command,file_path,description}` + üst düzey `user_input`/`last_assistant_message`/`reason`/`notification_type`, her biri 200 karaktere kırpılmış (mimari §8.2'nin kendi `.slice(0,200)` sabitiyle aynı). `path`/`pattern` gibi `deriveSummary`'nin okumadığı alanlar bilinçli olarak eklenmedi (Karpathy §2). 200 KB testine `summary` boş-değil assert'i + yeni `user_input` senaryosu eklendi. | §3 madde 5 ("Sınırı aşıyorsa" alt maddesi + test alt maddesi), §5 madde 7 satırı |
| 5 (ÖNEMLİ) | Adım sırası ters çevrildi: artık önce `settings.json` okunup ayrıştırılıyor (parse hatasında **hiçbir dosyaya dokunulmadan** çıkılıyor — dizin oluşturma ve `send-event.cjs` kopyalama işlemleri parse başarılı olana kadar hiç çalışmıyor), sonra dizin oluşturuluyor + dosya kopyalanıyor + birleştirme yapılıyor. §5 AC4'e "bozuk JSON → `.claude/hooks/send-event.cjs` OLUŞMAMIŞ" assert'i eklendi. | §6 "Adımlar" (tamamen yeniden numaralandı, 1↔2/3 yer değiştirdi), §5 AC4 satırı |
| 6 (ÖNEMLİ) | §4'e stdin okuma tavanı (1.000.000 karakter, mimari §8.2'nin kendi sabitiyle aynı) ve parse hatası gövde şekli (`hook_event_name:"unknown"`, `project_path`, `mc_parse_error:true`, `raw_text` = orijinal metnin `MC_MAX_PAYLOAD` karakteri) tam olarak tanımlandı. §5 AC3'e "bozuk JSON stdin → 202 + sunucuda `raw.raw_text` görünür" testi eklendi. | §4 (iki yeni paragraf, "Girdi" ile "Ortam değişkenleri" arası), §5 AC3 satırı |
| 7 (ÖNEMLİ) | §6 adım 1'e (yeni sıradaki ilk adım) `.bak` ile ilgili iki assert'li test planı eklendi (ilk koşu = kurulum öncesi içerik, ikinci koşu = değişmez) + "yalnızca ilk çalıştırma" kararının gerekçesi genişletildi (rollback kaybı sorusuna doğrudan cevap: birleştirme algoritması kanıtlanmış biçimde yalnızca ekleyici olduğu için tek anlamlı referans nokta zaten "hiç kurulmamış" hâldir). §2.2'ye `.gitignore` satırları (`settings.json.bak`, `settings.json.tmp-*`) eklendi. | §6 adım 1 (uzun paragraf), §2.2 tablo satır 2, §5 AC4 satırı (yeni iki test) |
| 8 (ÖNEMLİ) | İki teste pozitif kontrol eklendi: idempotentlik testi artık ikinci koşunun `exitCode===0` **ve** özet metninin "0 eklendi/13 zaten var" dediğini doğruluyor; `MC_DISABLE` testi önce değişkensiz koşup sayacın +1 arttığını, sonra `MC_DISABLE=1` ile artmadığını aynı test içinde ölçüyor. §7 mutasyon 4/5 metinleri bu pozitif kontrole atıf yapacak şekilde güncellendi. | §5 AC4 ve `MC_DISABLE` satırları, §7 madde 4-5 |
| 9 (ÖNEMLİ) | Feature notu satır 14'ün **zaten düzeltilmiş olduğu** doğrulandı (✓ VERIFIED, artık düzeltme gerekmiyor); kalan `.js` referansları (feature notu satır 3/10/22) §2.2'ye "değişecek dosya" olarak eklendi; mimari §8.2/§8.3/§4'teki 13+ `.js` referansı için §9'da CEO'dan doküman güncelleme talebi eklendi (developer kendisi mimariye dokunmuyor); §9 soru 1 ve 2 "kapandı" olarak işaretlendi. | §2.2 tablo satır 3, §9 madde 1/2/3 |
| 10 (ÖNEMLİ) | CEO kararı D §6 başına bağlayıcı kural olarak eklendi: testler yalnızca geçici dizinlere, kod turunun tek gerçek-hedef çalıştırması yalnızca bu reponun kendi köküne (önceden onaylı istisna). | §6 (yeni "Bağlayıcı kural" paragrafı, bölüm başında) |
| 11 (NOT) | Tek satırlık kod turu planı `MC_MAX_PAYLOAD` satırına eklendi: istemci `resolveEnvInt` ile aynı `Number.isInteger(parsed) && parsed >= 0` kontrolünü taklit edecek, `\|\|` kullanmayacak. | §4 ortam değişkenleri tablosu, `MC_MAX_PAYLOAD` satırı |
| 12 (NOT) | Tek satırlık kod turu planı adım 5'e eklendi: `JSON.stringify(merged, null, 2)`, testler ayrıştırılmış yapıyı karşılaştıracak. | §6 adım 5 |

**CEO kararları A/B/C/D:** hiçbirine itiraz edilmedi, dördü de yukarıdaki tabloda ilgili bulgu
satırlarıyla birlikte sözleşmeye işlendi (A→bulgu 1, B→bulgu 3, C→bulgu 4, D→bulgu 10).

**Yeniden açılmayan bölümler (QA'nın "onaylanmış" listesi):** §3 madde 1, §3 madde 4, §5
AC1/AC3/AC6 (AC3'e yalnızca **yeni bir satır eklendi**, mevcut satırlar değişmedi), §8 riskler
(yalnızca kapanan/yeni risk maddeleri güncellendi, mevcut 3 risk maddesi metni değişmedi).

**Bitti tanımı (bu tur, güncellenmiş):**
- §1, §2, §3, §4, §5, §6, §7, §9 düzeltildi; yeni "## Süre bütçesi" bölümü eklendi.
- `git status` yalnızca `docs/qa/F-004-contract.md`'yi değişmiş gösteriyor; `src/`, `tests/`,
  `scripts/`, `.claude/`, `docs/02-architecture.md`, `docs/features/**` altında hiçbir değişiklik
  yok.
- Sıradaki adım: qa-evaluator tur 2'yi inceler; onaylanırsa kod turu başlar.

---

## CEO kararı — zamanlama testlerinin kırılganlığı (2026-09-04)

Developer §9'da haklı bir risk bildirdi: CI'da Node soğuk-başlangıç jitter'ı `elapsedMs < 400`
assert'lerini nadiren gevşek kırabilir (~130 ms pay). Kırılgan test, ölçmeyen testten sonra en
pahalı ikinci şeydir: kırmızıya alışırız ve gerçek gerilemeyi görmeyiz.

**Karar: iki kademeli assert.**

1. **Sert kapı (CI-güvenli):** dört senaryonun her birinde duvar saati **> 1000 ms** ise test
   KIRILIR. 1000 ms rastgele değil — ADR-006'nın "ölçüm 1 s'yi aşarsa CEO'ya bildirilir"
   eşiğidir. Bu assert soğuk başlangıç jitter'ına dayanıklıdır ve gerçek bir gerilemeyi
   (ör. bekçinin kaldırılması, 2000 ms'e dönülmesi) kesin yakalar.
2. **Tasarım bütçesi (deterministik):** 400 ms'lik bütçe, scriptin **kendi içinden** ölçülen
   süreye karşı assert edilir (ilk satırdan `exit`e; Node süreç doğuşu hariç) **ve** yapılandırılmış
   zamanlayıcı sabitlerine karşı birim testiyle doğrulanır (stdin 120 · idle 100 · toplam 150).
   Süreç doğuşu scriptin kontrolünde değildir; onu bütçeye dahil edip testi kırılgan yapmak yerine
   §"Süre bütçesi" tablosunda ayrı kalem olarak belgeliyoruz.

Mutasyon kanıtı ikisini de kapsamalı: toplam-süre bekçisi kaldırıldığında **damla damla yanıt
veren sunucu** senaryosunda hem (1) hem (2) KIRMIZI vermeli. Sessiz sunucu senaryosu yeşil
kalmalı — o `req.setTimeout` katmanını ölçer, farklı bir kanıttır.

Bu, mimari §8.1'in 400 ms kuralını gevşetmez; kuralı **ölçülebilir ve kırılgan olmayan** iki
assert'e böler.

## CEO eylem kaydı — mimari doküman borcu KAPANDI (2026-09-04)
Developer §9'da mimari §8.2/§8.3/§4'teki 13+ `send-event.js` referansının güncellenmesini istedi
(sahiplik dışı, doğru davranış). CEO yaptı: `docs/02-architecture.md` içinde 26, `ADR-006` içinde
3 referans `.cjs` olarak güncellendi; §8 başlığına gerekçeli düzeltme notu eklendi. Tasarım
değişmedi. Kod turu artık mimariyle çelişmeyen bir sözleşmeye bakıyor.

---

## QA doğrulama — tur 2 (qa-evaluator, 2026-09-04)

KARAR: DÜZELTME
ESKALE: false

Dar doğrulama turu: yalnızca tur 1 bulgularının kapanışı denetlendi. `.cjs` kararı,
`/api/events`, `--dry-run` varsayılanı ve biçim/üslup yeniden açılmadı. Kod yazılmadı,
uygulama çalıştırılmadı, sözleşme dışında hiçbir dosya değiştirilmedi. Her iddia dosya
okunarak doğrulandı.

### Kapanış tablosu (tur 1 bulguları)

| # | Durum | Gerekçe (dosya:satır) |
|---|---|---|
| 1 (BLOKLAYICI, çit) | KAPANDI | §1 "İçinde" son maddesi (contract:45-56) çiti kapsama aldı, "Dışında" listesinde (contract:58-71) artık yok; §2.2 tablosu `tests/no-external-host.test.ts`'i değişecek dosya sayıyor ve `walk(ROOT/.claude/hooks, ['.cjs'])` ekini yazıyor (contract:99); §5 son satırı AC olarak kaydediyor (contract:452); §7 madde 7 hem "dış host literali ekle → KIRMIZI" hem yolu kasten yanlış yazma körlük mutasyonunu içeriyor (contract:559-565); §9 madde 1 kapatıldı (contract:600-602). Kapsam iddiası doğrulandı: `walk` özyinelemeli (`tests/no-external-host.test.ts:7-18`), kurulum şablonunun kendisi `.claude/hooks/send-event.cjs` (aynı dosya), `install-hook.mjs` zaten `scripts/**/*.mjs` kökünde (`tests/no-external-host.test.ts:29`) — üçü de kapsanıyor. |
| 2 (BLOKLAYICI, mutasyon 3) | KISMİ | Bölme yapıldı: (a) sessiz sunucu contract:226-229, (b) damla sunucu contract:230-233; mutasyon 3 hedefi yalnızca (b)'ye sabitlendi ve (a)'nın yeşil kalması şart koşuldu (contract:548-554). **Ama damla sunucunun süresi sınırlı yazılmış:** "40 ms aralıkla, **en az 5 kez**" (contract:230-231) — tur 1'in istediği "sonsuza kadar" ibaresi düştü. 5 damla t=200 ms'de biter; mutasyon altında (toplam bekçi yok) idle 100 ms son damladan sonra t=300 ms'de tetiklenir, script `exit(0)` verir ve mutasyon **YEŞİL kalabilir** — tur 1'in kapatmak istediği kaçağın aynısı. §7 madde 3'ün kendi iddiası ("mutasyon sonrası script asılı kalır, test timeout ile kırmızı verir", contract:552-553) yalnızca damlama istemci bağlantıyı kapatana kadar sürerse doğrudur. Düzeltme (tek cümle): (b)'de "sunucu, istemci bağlantıyı kapatana kadar 40 ms aralıkla damlatmayı **sürdürür** (üst sınır yok; en az ~2 s)" yaz. |
| 3 (BLOKLAYICI, süre bütçesi) | KISMİ | Sayısal kısım kapandı: yeni sabitler (stdin 120 · idle 100 · toplam 150) contract:203-205, faz tablosu ve ~309-389 ms hesabı "## Süre bütçesi" bölümünde; aritmetik tutuyor (aşağıda). Stdin katmanı ilk kez test (§5 AC2 "(c)", contract:441) ve mutasyon (§7 madde 6, contract:556-558) aldı. **Kapanmayan kısım: `## CEO kararı — zamanlama testlerinin kırılganlığı` sözleşmeye hiç işlenmemiş.** Sözleşme hâlâ tek kademeli duvar saati assert'i taşıyor: contract:244-249 ("dört senaryoda ayrı ayrı `< 400`"), §5 AC2 satırı (contract:441), "## Süre bütçesi" > "Bu ölçen testler" beş maddesinin hepsi `elapsedMs < 400`. Sert kapı (> 1000 ms, `ADR-006:42` eşiği) hiçbir yerde geçmiyor; scriptin **kendi iç ölçümü** ve **zamanlayıcı sabitlerinin birim testi** de tanımsız — üstelik §4 "Çıktı" (contract:423-424) her koşulda stdout/stderr yazımını yasakladığı için iç ölçümün hangi kanaldan okunacağı (ör. `require.main === module` koruması + `module.exports = { TIMEOUTS }`, ya da bir `MC_TIMING_FILE`) bir **script sözleşmesi** kararıdır, kod turuna bırakılamaz. Düzeltme: §5 AC2 + §7 madde 3 + "## Süre bütçesi"ni iki kademeli assert'e göre yeniden yaz ve iç ölçüm kanalını §4'te tanımla. |
| 4 (ÖNEMLİ, `summary` gerilemesi) | KAPANDI | Korunan alan listesi (contract:304-313) `deriveSummary`'nin fiilen okuduğu alanlarla **birebir** örtüşüyor (karşılaştırma tablosu aşağıda). Kanıt testleri var: 200 KB `tool_input.command` → `summary` boş değil + 200 KB `user_input` senaryosu (contract:318-323; §5 madde 7 satırı contract:449). |
| 5 (ÖNEMLİ, adım sırası) | KAPANDI | §6 "Adımlar" yeniden numaralandı: adım 1 oku+ayrıştır, bozuk JSON'da "dizin oluşturulmaz, kopyalanmaz, yedek alınmaz" (contract:495-501); mkdir adım 2, kopyalama adım 3. §5 AC4 satırında "`.claude/hooks/send-event.cjs` OLUŞMAMIŞ" assert'i var (contract:442). |
| 6 (ÖNEMLİ, parse hatası + stdin tavanı) | KAPANDI (ama regresyon üretti — aşağıya bakınız) | §4'te 1.000.000 karakter tavanı (contract:392-396; mimari `docs/02-architecture.md:612` sabitiyle aynı — doğrulandı) ve parse hatası gövde şekli (contract:398-414) tanımlı; §5 AC3'e "bozuk JSON stdin → 202 + `raw.raw_text` görünür" testi eklendi (contract:440). |
| 7 (ÖNEMLİ, `.bak` + `.gitignore`) | KAPANDI | §5 AC4 satırında iki assert (".bak ilk koşuda kurulum-öncesi içerikle oluşur", ".bak ikinci koşuda değişmez", contract:442); §6 adım 1'de "yalnızca ilk çalıştırma" kararının gerekçesi (birleştirme kanıtlanmış biçimde yalnızca ekleyici → tek anlamlı geri dönüş noktası "hiç kurulmamış" hâldir, contract:502-515) tatmin edici; §2.2'de `.gitignore` satırları planlandı (contract:100) — `.gitignore` bugün bu desenleri **içermiyor** (18 satır okundu), yani ek gerçekten gerekli. |
| 8 (ÖNEMLİ, totoloji/pozitif kontrol) | KAPANDI | İdempotentlik testi ikinci koşuda `exitCode===0` + "0 eklendi/13 zaten var" özetini doğruluyor (contract:442); `MC_DISABLE` testi önce değişkensiz +1, sonra `MC_DISABLE=1` ile değişmez ölçümü yapıyor (contract:450); §7 mutasyon 4-5 bu pozitif kontrollere atıf yapıyor (contract:544-547). |
| 9 (ÖNEMLİ, doküman borcu) | KAPANDI | `grep -c "send-event\.js"`: `docs/02-architecture.md` → **1**, `docs/decisions/ADR-006-hook-tasima-bicimi.md` → **0**. Kalan tek eşleşme `docs/02-architecture.md:570`, CEO'nun kendi düzeltme notunun gövdesidir ("Bu bölümdeki tüm `send-event.js` referansları `send-event.cjs` olarak güncellendi") — kalıntı değil, kasıtlı. Karşı sayım: `.cjs` mimaride 26, ADR-006'da 3 satırda geçiyor; §8.3 şablonundaki 13 olay tipi kaydı da `.cjs` (`docs/02-architecture.md:683-719`). Feature notundaki 3 kalıntı (satır 3/10/22) §2.2'de kod turu işi olarak planlı (contract:101). |
| 10 (ÖNEMLİ, CEO kararı D) | KAPANDI | §6 başındaki bağlayıcı kural cümlesi birebir var: "hiçbir agent `install-hook`'u bu deponun dışındaki bir yola karşı CEO/kullanıcı onayı olmadan çalıştıramaz" (contract:461-463); testler yalnızca `os.tmpdir()` altındaki geçici dizinlere kuruyor, tek gerçek hedef bu deponun kökü (contract:463-468). |
| 11 (NOT) | KAPANDI | §4 `MC_MAX_PAYLOAD` satırında `Number.isInteger(parsed) && parsed >= 0` taklidi yazılı (contract:420). |
| 12 (NOT) | KAPANDI | §6 adım 5'te `JSON.stringify(merged, null, 2)` + testin ayrıştırılmış yapıyı karşılaştırması yazılı (contract:526-529). |

### YENİ (regresyon) — bulgu 6'nın gövdesi bulgu 4'ün zarfıyla çelişiyor

**Şiddet: ÖNEMLİ.** §4'ün parse hatası gövdesi `raw_text` alanını "orijinal stdin metninin ilk
**`MC_MAX_PAYLOAD`** karakteri" olarak tanımlıyor (contract:407). Bu gövde serileştirildiğinde
uzunluğu her zaman `MC_MAX_PAYLOAD`'ı (65536) **aşar** (65536 karakter + zarf anahtarları +
tırnak/kaçış). Sonuç iki katmanda birden:

1. **İstemci tarafı:** §3 madde 5'in kuralı "gönderilecek gövde" için koşulsuzdur — serileştirilmiş
   boyut sınırı aştığı için gövde kompakt zarfa **değiştirilir** (contract:290-296). Zarfın korunan
   alan listesinde `raw_text` **yok** (contract:305-313) → parse hatası metni tamamen düşer.
2. **Sunucu tarafı:** istemci kırpması atlansa bile `src/features/events/server/normalize.ts:114-123`
   `serialized.length > maxPayload` olduğu için `raw`'ı `{truncated, byte_length, keys}` ile
   değiştirir → yine `raw.raw_text` yok.

Yani §5 AC3'ün yeni testi ("bozuk JSON stdin → 202 + sunucuda `raw.raw_text` görünür",
contract:440) **yapısal olarak kırmızı** doğar. Bu, tur 2'de eklenen iki düzeltmenin (bulgu 4
zarfı + bulgu 6 gövdesi) birbirine karşı sınanmamış olmasından doğan bir regresyondur.

Düzeltme (tek cümle): `raw_text`'i `MC_MAX_PAYLOAD` yerine küçük ve sabit bir üst sınıra
(ör. 2000 karakter) kırp **veya** `raw_text`'i kompakt zarfın korunan alanları listesine ekle —
hangisi seçilirse §4 ile §3 madde 5 aynı cümlede uyumlu hâle getirilsin.

### Aritmetik kontrol

**Damla senaryosu (b), mutasyonsuz — TUTUYOR.** t=0'da istek yazılır; `req.setTimeout(100)` (idle)
ve `setTimeout(150)` (toplam) birlikte kurulur. Sunucu t=40 · 80 · 120'de birer bayt yazar; her
yazım idle sayacını sıfırlar, en uzun sessizlik 40 ms < 100 ms → **idle hiç tetiklenmez**. t=150'de
toplam bekçi tetiklenir → `exit(0)`. Duvar saati ≈ açılış (40-120) + 150 = **190-270 ms** < 400 ✓.
Damla aralığı ile eşiklerin ilişkisi doğru seçilmiş.

**Damla senaryosu (b), mutasyonlu (toplam bekçi kaldırıldı) — TUTMUYOR.** "En az 5 kez" ifadesi,
5 damlada (t=200) biten bir sunucuya izin verir. Son damladan sonra idle 100 ms sayar ve t=300'de
tetiklenir → script `exit(0)`, duvar saati ≈ 340-420 ms. Ne "> 1000 ms" sert kapısı ne de
"< 400 ms" bütçesi güvenilir biçimde kırılır (ikincisi 340-420 aralığında **kırılgan**: makineye
göre yeşil de kırmızı da olabilir). Mutasyon 3'ün kanıt değeri ancak damlama sınırsız olursa doğar.

**Süre bütçesi — iç tutarlılık TUTUYOR, dış varsayım kırılgan.** Fazlar gerçekten ardışıktır (gövde,
stdin tam okunmadan gönderilemez). En kötü gönderen yol: açılış 120 + stdin 119 (bekçiye değmeden
kapanır) + ağ 150 = **389 ms**; alt uç 40 + 119 + 150 = **309 ms** — sözleşmenin yazdığı 309-389
aralığı doğru ve açılış payı dahil edilmiş. Göndermeyen yol: 120 + 120 = **240 ms** ✓. Beklenen yol
(`ECONNREFUSED`): 40-120 + ~0 = **50-130 ms** ✓. Uyarı: 400 ms'e pay yalnızca ~11 ms ve tamamen
"soğuk başlangıç ≤ 120 ms" varsayımına dayanıyor — CEO'nun süreç doğuşunu bütçe dışına alan iki
kademeli assert'i tam da bunu çözüyor; işlenmemiş olması bulgu 3'ün kapanmamasının nedenidir.
İki kademeli hâliyle tasarım bütçesi 119 + 150 = **269 ms** olur, 131 ms payla.

### `deriveSummary` alan karşılaştırması (Karar C)

`src/features/events/server/normalize.ts:42-68`'in okuduğu alanlar → sözleşme zarfının koruduğu
alanlar (contract:304-313):

| deriveSummary okuması | normalize.ts satır | Zarfta korunuyor mu |
|---|---|---|
| `hook_event_name` (switch anahtarı) | 46, 109-110 | EVET (contract:305) |
| `tool_name` (dal seçimi) | 44, 49-53 | EVET (contract:306) |
| `tool_input.command` | 49 | EVET, 200 karaktere kırpılmış |
| `tool_input.file_path` | 51 | EVET, 200 karaktere kırpılmış |
| `tool_input.description` | 53 | EVET, 200 karaktere kırpılmış |
| `user_input` | 56 | EVET, 200 karaktere kırpılmış |
| `last_assistant_message` | 59 | EVET, 200 karaktere kırpılmış |
| `reason` | 62 | EVET, 200 karaktere kırpılmış |
| `notification_type` | 64 | EVET, 200 karaktere kırpılmış |

Eksik alan **yok**; `deriveSummary` bunların dışında hiçbir alan okumuyor (fonksiyonun tamamı
okundu). `path`/`pattern`'in dışarıda bırakılması doğru karar. `project_path` da zarfta korunduğu
için `resolveProjectPath` (`normalize.ts:23-35`) boş dönmez. Karar C **kapandı**.

### Kod turuna devredilen notlar

1. Damla sunucusunun `socket.write()` çağrıları, script çıktıktan sonra kapanmış sokete düşer;
   test sunucusuna `socket.on('error', () => {})` koy — aksi hâlde test süreci `EPIPE`/`ECONNRESET`
   ile düşer ve kırmızıyı yanlış nedene bağlarsın.
2. `unref()`'li toplam süre bekçisi yalnızca olay döngüsünü canlı tutan başka bir tutamaç varken
   (açık soket / açık stdin) tetiklenir; her iki bekçinin de `unref()` ile kurulduğunda gerçekten
   ateşlendiğini mutasyon turunda **gözlemle**, varsayma.
3. Bulgu 11'in `MC_MAX_PAYLOAD=0` toleransını yukarıdaki regresyonla birlikte düşün: `0` geçerli
   sayılırsa istemci kırpma eşiği 0 olur ve **her** olay kompakt zarfa düşer — `summary` yine dolu
   kalmalı. Bu kombinasyonu bir testle geçir.

---

## CEO kararı — DÜZELTME (zamanlama assert'i, 2026-09-04, tur 2 QA üzerine)

QA haklı: yukarıdaki `## CEO kararı — zamanlama testlerinin kırılganlığı` bölümünün ikinci
kademesi **kendi içinde çelişkiliydi.** "Scriptin kendi içinden ölçülen süre" dedim, ama §4'ün
"hiçbir koşulda stdout/stderr'e yazma" kuralı bu ölçümün dışarı çıkacağı kanalı kapatıyor.
Yalnızca test için `MC_TIMING_FILE` benzeri bir yan kanal açmak, üretimde hiç kullanılmayan bir
kod yolu eklemek olurdu — Karpathy §2 ihlali. **O kademeyi geri çekiyorum.**

**Yürürlükteki kural (yukarıdaki bölümün 2. maddesinin yerine geçer):**

1. **Sert kapı (dış duvar saati, CI-güvenli):** dört senaryonun her birinde toplam süre
   **> 1000 ms** ise test KIRILIR. Eşik ADR-006'nın "1 s'yi aşarsa CEO'ya bildirilir"
   sınırıdır. Soğuk başlangıç jitter'ına dayanıklıdır ve gerçek gerilemeyi (bekçinin
   kaldırılması, 2000 ms'e dönülmesi) kesin yakalar.
2. **Zamanlayıcı sabitleri (deterministik, zamanlama içermez):** birim testi yapılandırılmış
   sabitleri doğrular — stdin 120 · idle 100 · toplam 150. Bu test saat kullanmaz, kırılgan
   değildir.
3. **Bekçilerin gerçekten ateşlendiği kanıtı:** her bekçi için ayrı mutasyon. Sabitler doğru
   **ve** bekçiler ateşliyorsa 400 ms'lik bütçe aritmetik olarak zaten sağlanır; onu ayrıca
   duvar saatiyle assert etmeye gerek yok. `## Süre bütçesi` tablosu türetilmiş belge olarak
   kalır.

Sözleşmenin gövdesindeki **beş yerdeki tek kademeli `elapsedMs < 400` assert'i** bu üç maddeye
göre yeniden yazılacak. 400 ms'lik tasarım hedefi değişmedi; yalnızca **nasıl kanıtlandığı**
değişti.

---

## Developer düzeltme yanıtı — tur 3 (2026-09-04)

Dar tur: yalnızca QA'nın tur 2 doğrulamasında açık bıraktığı 3 madde kapatıldı. Kod yazılmadı,
`docs/qa/F-004-contract.md` dışında hiçbir dosya değiştirilmedi; QA'nın kapandı saydığı 10 bulgu
ve iki CEO zamanlama kararının kendisi yeniden açılmadı.

| # | Ne değiştirdim | Bölüm/satır |
|---|---|---|
| 1 (KISMİ→KAPANDI, damla sunucu süresiz olmalı) | §3 madde 3 alt madde (b)'deki "40 ms aralıkla, en az 5 kez" ifadesi "istemci (test) bağlantıyı kapatana kadar, 40 ms aralıkla sınırsız" olarak değiştirildi; üst sınır kaldırıldı. Mutasyon 3'ün kanıt zincirini netleştiren bir cümle eklendi: sınırsız damlama olmadan mutasyon idle'ın gecikmeli tetiklenmesiyle yanlışlıkla yeşil kalabilirdi, artık script sonsuza kadar asılı kalır ve kanıt vitest'in kendi test zaman aşımına dayanır. | §3 madde 3, "(b) Damla sunucu" alt maddesi |
| 2 (KISMİ→KAPANDI, zamanlama assert'leri) | `## CEO kararı — DÜZELTME (zamanlama assert'i)`'nin üç maddeli kuralı (sert kapı `> 1000 ms` + saat kullanmayan zamanlayıcı-sabitleri birim testi + her bekçi için ayrı mutasyon) gövdeye işlendi; tek kademeli `elapsedMs < 400` duvar saati assert'i **kaldırıldı**. Script içine test-amaçlı bir ölçüm yan kanalı (`MC_TIMING_FILE` vb.) **eklenmedi** — CEO'nun kendi geri çekme gerekçesiyle (§4'ün "stdout/stderr'e hiçbir koşulda yazma" kuralıyla çelişir) tutarlı. | §3 madde 3 "Ölçüm zorunlu" paragrafı, §5 AC2 satırı, §8 "Ölçüm jitter'ı" risk maddesi, "## Süre bütçesi" > "Bu nasıl kanıtlanır" bölümü (tamamen yeniden yazıldı) |
| 3 (YENİ regresyon→KAPANDI, parse hatası gövdesi) | **Seçilen çözüm: `raw_text`'i `MC_MAX_PAYLOAD` yerine sabit 2000 karaktere kırp.** Gerekçe: diğer iki seçenek (zarfın korunan alan listesine `raw_text` eklemek; parse hatası yolunu kırpma zarfından muaf tutmak) sırasıyla kavramsal karışıklık (KARAR C zarfı farklı bir amaca — özet kaynaklarını korumaya — hizmet ediyor, ham parse-hatası metni değil) ve gereksiz bir kod dalı/bayrak (Karpathy §2 ihlali) gerektirirdi. Sabit 2000 karakter, zarfın serileştirilmiş toplam boyutunu `MC_MAX_PAYLOAD` varsayılanının (65536) çok altında tutarak hem istemci tarafı KARAR C zarfını (§3 madde 5) hem de sunucu tarafı `normalize.ts:114-123` truncation'ını **kodu okuyarak doğrulanmış biçimde** devre dışı bırakır (her ikisi de yalnızca serileştirilmiş boyut eşiği aşılırsa devreye giriyor — bkz. `normalize.ts:116` `if (serialized.length > maxPayload)`) — `raw.raw_text` böylece güvenilir biçimde sunucuya ulaşır. | §4 "Parse hatası gövde şekli" (JSON örneği + yeni "Karar (tur 3...)" paragrafı), §3 madde 5 (yeni "Parse hatası gövdesiyle ilişkisi" notu), §5 AC3 satırı |

**Gövde tutarlılığı:** üç madde için aynı sayı/kural artık tek yerde tanımlı ve diğer yerlerden
ona referans veriliyor (zamanlama kuralı için "## CEO kararı — DÜZELTME" + "## Süre bütçesi";
`raw_text` sınırı için §4 + §3 madde 5 çapraz notu). `git status` yalnızca bu dosyayı değişmiş
gösteriyor.

**Bitti tanımı (bu tur):** 3 madde kapandı, sözleşme gövdesi kendi içinde tutarlı. Sıradaki adım:
qa-evaluator tur 3'ü inceler.

---

## CEO onayı — sözleşme KAPANDI (2026-09-04)

QA tur 2'nin açık bıraktığı 3 madde (damla sunucusunun sonlu olması · zamanlama assert'lerinin
gövdeye işlenmemesi · parse hatası gövdesinin kendi testini kırması) tur 3'te kapatıldı.
Üçüncü bir tam QA turu açmak yerine CEO doğruladı — düzeltmeler dar ve doğrudan denetlenebilirdi:

- **Damla sunucusu:** satır 238-240 — damlama artık istemci kapatana kadar sürüyor, sonlu sınırın
  neden kaçak ürettiği de gerekçeyle yazılmış.
- **Zamanlama:** satır 479 (AC2) sert kapıyı (`elapsedMs > 1000` → KIRILIR) ve saat kullanmayan
  zamanlayıcı-sabitleri birim testini içeriyor; satır 794 tek kademeli `elapsedMs < 400`
  assert'inin kaldırıldığını açıkça kaydediyor. `MC_TIMING_FILE` benzeri yan kanal eklenmemiş.
- **Parse hatası:** `raw_text` sabit 2000 karaktere kırpılıyor (satır 428, 431-447); seçim
  `normalize.ts:114-123` okunarak gerekçelendirilmiş, reddedilen iki alternatif yazılmış.

**KARAR: ONAY.** Kod turu başlayabilir. Bağlayıcı olanlar: bu sözleşmenin gövdesi ·
feature notundaki "CEO kararları" (A/B/C/D) · `## CEO kararı — DÜZELTME (zamanlama assert'i)` ·
QA tur 2'nin "Kod turuna devredilen notlar" bölümü.

Sözleşme aşaması bilançosu: 3 developer turu + 2 QA turu, 12 bulgu + 1 regresyon, **tek satır kod
yazılmadan** kapandı. En pahalı yakalama: tasarımın en kötü durumda 2,55 s yaşaması — mimari
§8.1'in 400 ms kuralının 6 katı. `async: true` desteklenmeyen bir ortamda bu süre her araç
çağrısına eklenecekti; yani gözlemevi, gözlediği oturumu yavaşlatacaktı.
