status: qa (developer turu tamamlandı — qa-evaluator kararı bekliyor)

# G5 Tur 4 — İzin kartı önizlemesi (4-Ek3) düzeltmesi

Kaynak: `docs/qa/G5-guvenlik-denetimi-2026-09-10-tur4.md` madde 2 (4-Ek3). Bu sözleşme YALNIZCA
o maddeyi kapsar. Maddeler 1 (gate-check.cjs realpath), 3 (`mklink` Katman B) ve 4 (ADR kararı)
**bu turun kapsamı DIŞINDADIR** — brief'in dosya sahipliği `session.ts`/`ChatScreen.tsx`/ilgili
testler ile sınırlı; `.claude/**` paralel bir turun elinde.

## Neden var — tek cümle

**Kartta görünen komut, onaylanınca çalışacak komutun tamamı olmalıdır** — aksi hâlde "kullanıcı
komutu okur, sonra onaylar/reddeder" varsayımı (ADR-014, ADR-016) 500 karakterden uzun her
komutta sessizce yanlış hâle gelir.

## Bulgunun teyidi (bu turda okunarak doğrulandı)

`src/features/chat/server/session.ts:137-142` (`buildInputPreview`):
```ts
const singleLine = raw.replace(/\s+/g, ' ').trim()
return singleLine.length > 500 ? `${singleLine.slice(0, 500)}…` : singleLine
```
`src/features/chat/web/ChatScreen.tsx:107-109,130-136` (`PermissionCard`): bu önizlemeyi
`truncate` (CSS tek satır + `text-overflow:ellipsis`) sınıfıyla gösterir, tam metne erişimin TEK
yolu `title` hover tooltip'idir (kısaltılmış metnin KENDİSİ zaten 500 karakterle sınırlı — hover
da yardımcı olmuyordu). Onaylanan komut ise SDK'ya `input.command`'ın TAM hâliyle gider —
`updatedInput` verilmediği sürece kırpma yalnızca GÖRÜNÜMÜ etkiler, yürütmeyi etkilemez.

## Tasarım kararı

### 1. Kırpma tamamen kaldırılır (veri katmanı)
`buildInputPreview` artık normal boyuttaki (`≤ INPUT_PREVIEW_HARD_CAP`) komutları **hiç
kesmeden** döndürür. Kartın taşıdığı `input_preview` alanı = çalışacak komutun tamamı (ya da
`Bash` dışındaki araçlar için `JSON.stringify(input)`'ın tamamı — bkz. madde 4).

### 2. Uzunluk uyarısı — eşik `500` karakter (`INPUT_PREVIEW_WARN_THRESHOLD`)
Denetimin kendi önerisiyle aynı değer korunur (davranış değişmeyen bir referans noktası, ölçmesi
kolay). `input_preview.length > 500` iken kartta **ayrı, göze çarpan** (kehribar renkli, `role="alert"`)
bir şerit çıkar: `"⚠ Bu komut olağandışı uzun ({N} karakter). Onaylamadan önce TAMAMINI okuyun."`
Yeni bir sunucu alanı EKLENMEZ — `chat_permission_request`/`chat_status` payload'ının kapalı alan
allowlist'i (`tests/integration/chat-api.test.ts` "Ö3") korunur; istemci uzunluğu doğrudan
`input_preview.length`'ten hesaplar (sunucunun gösterdiği metin = çalışacak metin olduğu için bu
DOĞRU bir ölçüm, ayrı bir alan taşımaya gerek yok).

### 3. Fail-closed üst sınır — `INPUT_PREVIEW_HARD_CAP = 20_000` karakter
Gerekçe: gerçek bir tek `Bash` komutu (heredoc'lu çok satırlı betikler dahil) pratikte birkaç bin
karakteri nadiren aşar; 20.000 hem gerçekçi kullanım için bolca pay bırakır hem de patolojik
(SSE/DOM şişirme) durumları sınırlar. Bu sınır AŞILIRSA önizleme metni **sessizce kesilmez** —
`OVERSIZED_INPUT_PREVIEW_MARKER` (`src/shared/types.ts`) ile başlayan sabit, içerikten bağımsız
bir uyarı metnine dönüşür: `"⚠ GÜVENLİK: Bu komut önizlemesi güvenli şekilde gösterilemeyecek
kadar uzun (N karakter)"`. İstemci bu deseni tanıyıp:
  - kırmızı/`role="alert"` bir uyarı gösterir ("ONAYLAMAYIN, komutun tamamı gösterilemiyor"),
  - **Onayla butonunu devre dışı bırakır** (yalnızca Reddet mümkün kalır) — belirsizlikte
    varsayılan reddet yönünde (brief §2.2 madde 3).
Bu, gerçek bir komutun içeriğini asla ASLA sessizce gizlemez: 20.000 karakterin altındaki HER
komut tam olarak gösterilir; üstündeki HİÇBİR komut yanlışlıkla "güvenli" görünmez.

Sahte-pozitif riski: bir saldırganın GERÇEK (kısa) komutunun `OVERSIZED_INPUT_PREVIEW_MARKER` ile
bit bit eşleşmesi gerekir ki bu kendi kendini bloke eder (fail-safe yönünde, açık değil).

### 4. `Write`/`Edit` gibi araçların içerik önizlemesi — AYNI KOD YOLU, AYRICA DÜZELTME GEREKMEDİ
`buildInputPreview` `command` alanı yoksa `JSON.stringify(input)`'ın TAMAMINI alıp (madde 1
sayesinde artık kesmeden) döndürür — yani `Write`/`Edit`'in `content`/`new_string` alanları da
**aynı** kırpmasız yoldan geçer. Ayrı bir kod dalı YOKTU, YAZILMAYACAK (madde 1 zaten kapsıyor).
Test: `tests/features/chat/server/session.test.ts` `Write` aracı için 500+ karakterlik `content`
ile bir vaka ekler, önizlemenin TAMAMINI taşıdığını doğrular.

### 5. Boşluk normalizasyonu — satır sonları KORUNUR
Eski davranış (`raw.replace(/\s+/g, ' ')`) `\n`'i de boşluğa çeviriyordu — çok satırlı bir
komutu (heredoc, `&&` zinciri okunaklı hâle getiren satır kırılımları) tek bir okunaksız satıra
yığıyordu; bu da CLAUDE.md'nin "sözdizimi çeşitliliğine yenilme" dersiyle aynı sınıf bir okunabilirlik
kaybı. Yeni davranış: yalnızca satır-İÇİ boşluk/tab dizileri tek boşluğa indirgenir, `\r\n` → `\n`
normalize edilir, her satırın uçları kırpılır; satır sonları (`\n`) AYNEN KORUNUR. Kart artık
çok satırlı bir komutu okunabilir biçimde (satır satır) gösterebilir.

### 6. Arayüz — kaydırılabilir kutu, `truncate` KALDIRILIR
`PermissionCard` artık komutu `<pre data-testid="permission-command-preview">` içinde,
`max-h-40 overflow-y-auto whitespace-pre-wrap break-all` ile gösterir: içerik DOM'da TAM olarak
var, görsel olarak dikey kaydırma ile erişilebilir (CLAUDE.md dersi: `truncate` + yalnızca
`title` hover, kaydırma kabında `toBeVisible()` yalanına benzer bir "görünür ama okunamaz" tuzağı
kurar). `title` özniteliği DE eklenir (yedek, hover-kopyalama kolaylığı) ama TEK erişim yolu o
DEĞİLDİR.

`ResolvedPermissionRow` (karardan SONRAKİ, tek satırlık kolaps özeti — `"Onaylandı — X çalıştı"`)
için KOZMETİK bir 120 karakter kısaltması UYGULANIR. Bu, güvenlik sınırı DEĞİLDİR (karar zaten
verilmiş) — yalnızca geçmiş kayıt listesinin bir satırı bozmasını engeller. Sözleşmede açıkça
ayrılıyor ki QA bunu "kırpma geri geldi" diye yanlış sınıflandırmasın.

## Ölçülebilir kabul kriterleri

1. Denetimin sondasını (500+ karakter, sonda ayırt edici iz) birebir tekrarla: `buildInputPreview`
   çıktısı izi İÇERİYOR (`toContain`).
2. `INPUT_PREVIEW_WARN_THRESHOLD` altı/üstü için uyarı şeridi sırasıyla YOK/VAR.
3. `INPUT_PREVIEW_HARD_CAP` üstü girdi → çıktı `OVERSIZED_INPUT_PREVIEW_MARKER` ile başlıyor, ham
   içerikten HİÇBİR alt dize İÇERMİYOR (sessiz kısmi sızıntı yok).
4. Arayüz: uzun komutun tam metni `permission-command-preview` `textContent`'inde var; kutunun
   `overflow-y` hesaplanmış stili `auto`/`scroll`; içerik kutu yüksekliğini aşıyorsa
   `scrollHeight > clientHeight` (gerçek tarayıcıda, kırpma DEĞİL kaydırma). Dar genişlikte
   (320/375/480px) tekrarlanır.
5. Oversized durumda "Onayla" butonu `disabled`.
6. Mutasyon 1: kırpmayı geri getir (`slice(0,500)`) → kriter 1 testinin KIRMIZI olduğunu göster,
   elle geri al.
   Mutasyon 2: uzunluk uyarı şeridini/`isLong` dalını kaldır → kriter 2 testinin KIRMIZI olduğunu
   göster, elle geri al.

## Kapsam dışı

- `gate-check.cjs` realpath/junction düzeltmesi (madde 1) — `.claude/**`, başka tur.
- `mklink` Katman B eklemesi (madde 3) — `.claude/**`, başka tur.
- `/api/gates/*/approve` tehdit modeli ADR kararı (madde 4) — CEO kararı, kod değişikliği değil.
- `history-log.ts` disk boyutu sınırı — bu turun kapsamında değil, ayrı bir sertleştirme konusu
  (gözlemlendi, `docs/blockers.md`'ye YAZILMADI çünkü bu turun sahipliği dışında; CEO'nun
  ilgili paralel tur raporunu okuyunca değerlendirmesi gerekir).
- `INPUT_PREVIEW_HARD_CAP` SDK/Bash aracının gerçekten bu kadar uzun `command` kabul edip
  etmediğini test etmek — kapsam dışı (denetimin kendi notu, 4-Ek): hook/uygulama davranışını
  test ediyoruz, SDK'nın iç sınırlarını değil.

## Sonuç (developer turu)

**Kod:** `src/features/chat/server/session.ts` (`buildInputPreview`), `src/features/chat/web/
ChatScreen.tsx` (`PermissionCard`, `ResolvedPermissionRow`), `src/shared/types.ts` (3 yeni sabit),
`src/features/chat/web/useChatSession.ts` (yalnızca yorum güncellemesi).

**Testler:** `tests/features/chat/server/session.test.ts` (+6, denetimin sondasını birebir
tekrar eden vaka dahil), `tests/features/chat/web/ChatScreen.test.tsx` (+4), gerçek tarayıcı E2E
`tests/e2e/chat.spec.ts` (+3, 320/375/480px) + `tests/e2e/helpers/chat-fake-server.ts` (opt-in
uzun komut senaryosu) + yeni `tests/e2e/helpers/chat-long-command.ts` (yan etkisiz paylaşılan
sabitler — `chat-fake-server.ts`'in koşulsuz `main()` çağrısını test dosyasına İTHAL ETMEMEK
için ayrı dosya).

**Mutasyon kanıtları (2/2, elle geri alındı, `git diff` temiz):**
1. Kırpmayı geri getirdim (`slice(0,500)`) → `session.test.ts`'in 4 yeni testi KIRMIZI oldu
   (denetim-sondası tekrarı, Write içerik testi, iki satır-sonu testi).
2. `isLong` dalını `false`'a sabitledim → `ChatScreen.test.tsx`'in uzunluk-şeridi testi KIRMIZI
   oldu.

**Doğrulama:** `npx tsc --noEmit` 0 hata, `npx eslint .` 0 hata, `npm run test` 1371 geçti / 4
atlandı (başlangıç 1361/4 + bu turun 10 yeni testi), `npm run e2e` 55/55 yeşil, `npm run e2e:chat`
4/4 yeşil (gerçek tarayıcı, kota 0). Tur sonunda yetim `node`/`chrome` süreci yok (`tasklist`
boş döndü), 7333/7435 portlarında dinleyen kalmadı.

**Kapanmayan risk (CEO'ya, eşiğiyle):** `check-ports.test.ts` bir kez EADDRINUSE ile kırmızı
verdi (port 7333'te bu turdan bağımsız, geçici bir dinleyici vardı — muhtemelen paralel `.claude`
turunun kendi canlı denetimi). İkinci koşuda ve tam `npm run test`'te temiz geçti; kodda hiçbir
değişiklik yapılmadı. Gerçek bir regresyon DEĞİL, ama bu depoda port 7333 paylaşımlı bir kaynak —
paralel turlar aynı anda gerçek sunucu başlatırsa `npm run e2e`/`check-ports` testleri flake
verebilir (eşik: yalnızca aynı anda iki turun ikisi de gerçek sunucu/E2E çalıştırırsa görülür,
tek başına çalışan bir tur için sıfır risk).
