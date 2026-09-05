# ADR-012 — Proje `docs/features` izleme mekanizması: `chokidar@4.0.3`

- **Tarih:** 2026-09-05
- **Durum:** Kabul edildi
- **Karar veren:** CEO (`docs/qa/F-005-contract.md` §3 madde 1, §6 "ADR-012 taslağı", CEO kararı
  D16 — sözleşme onayı "KARAR: ONAY")

## Bağlam

F-005'in tur 1 sözleşmesi, izlenen projelerin `docs/features` dizinini izlemek için mimari
§3.4'ün zaten onayladığı `chokidar` bağımlılığı yerine, yeni bağımlılık eklemeden `node:fs.watch`
kullanmayı önermişti. Gerekçe: ADR-009 tek-platform (Windows-only) kararı + düz-dizin izleme
(alt dizin yok) chokidar'ın asıl kazancı olan çapraz-platform tutarlılığını sıfırlıyor, Node'un
Windows `fs.watch` implementasyonu zaten stabil kabul ediliyordu.

QA bu kararı bu Windows makinesinde **ölçerek** çürüttü.

## Ölçüm (QA, sözleşme turu, geçici dizin, temizlendi)

Aynı Windows makinesinde, aynı `docs/features` dizininde, `node:fs.watch` ile:

- Sağlam dizinde `.md` yazımı: 2 ham olay, ilk olay 3 ms içinde (beklenen davranış).
- **Dizin silinip yeniden oluşturulduktan sonra** `.md` yazımı: **0 olay**, hata da yok —
  izleyicinin tuttuğu tanıtıcı **kalıcı olarak ölüyor**. Bu bir `git checkout`/dal değişimi
  desenidir ve bu ürün tam olarak proje depolarını izlediği için senaryo günlük, teorik değil.
- **Dizin silinip silinmiş kalırsa:** 1 sn'de 112.535 / 3 sn'de 342.548 ham olay, ~641 ms
  kullanıcı+sistem CPU / 3 sn (~%21 çekirdek), **süresiz** olay fırtınası. `filename` bu
  olaylarda dosya adı değil `\\?\C:\...\docs\features` mutlak yolu (bir başka yanlış varsayımı
  da çürüttü).

## Kod turunda yeniden ölçüldü (2026-09-05, aynı iki senaryo, gerçek `chokidar@4.0.3`)

`tests/server/watch/project-watcher.test.ts`'teki iki entegrasyon testi (gerçek geçici dizin +
gerçek chokidar, `depth:0, ignoreInitial:true, usePolling:false, awaitWriteFinish:{stabilityThreshold:200,pollInterval:50}`
— üretim ayarlarıyla birebir) ve bağımsız bir tek seferlik ölçüm betiğiyle (repoya geçici
kopyalanıp koşulup silindi, hiçbir kalıntı bırakmadı) doğrulandı:

| Senaryo | `node:fs.watch` (yukarıdaki ölçüm) | `chokidar@4.0.3` (bu turda ölçüldü) |
|---|---|---|
| Dizin sil + yeniden oluştur → `.md` yazımı sinyal üretiyor mu | Hayır — kalıcı ölüm, 0 olay | **Evet** — `onChange` yine tetiklendi |
| Dizin silinip silinmiş kalırsa 1 sn'deki ham olay | 112.535 | **0** (< 500 eşiğinin çok altında) |
| Dizin silinip silinmiş kalırsa 3 sn'deki ham olay | 342.548 | **0** |
| ~3 sn CPU (kullanıcı+sistem) | ~641 ms (~%21 çekirdek) | ~3.9 ms (ihmal edilebilir) |

chokidar, `fs.watch`'ın iki kusurunu miras almıyor — dizin kaybolduğunda kendi iç tanıtıcısını
temizce kapatıp `readdirp`'in taramasını durduruyor (ham olay üretmiyor), dizin geri gelince de
otomatik yakalıyor.

## Bağımlılık verisi (`npm view` ile gerçek registry'den, bu turda `package-lock.json`'da
gerçek kurulu sürümlerle teyit edildi)

| Kontrol | Sonuç |
|---|---|
| Kurulu sürüm (`package.json`) | `chokidar: "^4.0.3"` |
| Kurulu sürüm (`package-lock.json`, gerçek) | `chokidar@4.0.3`, `readdirp@4.1.2` |
| `chokidar@4.0.3` bağımlılıkları | Yalnızca `readdirp: ^4.0.1` — `fsevents` **yok** (v4 macOS native izlemeyi bıraktı, saf JS) |
| `chokidar@4.0.3`/`readdirp@4.1.2` `scripts` | `preinstall`/`install`/`postinstall` **yok** → `hasInstallScript` `package-lock.json`'da `true` yazılmıyor, `tests/deps.test.ts` guard'ı kod değişikliği gerektirmeden geçiyor (✓ VERIFIED, `npm run verify` yeşil) |
| `chokidar@4.0.3` `engines.node` | `>= 14.16.0` — projenin `>=20.11` tabanıyla (`package.json:7`) çelişmiyor |
| `chokidar@5.0.0` (bilgi, **seçilmedi**) | `readdirp: ^5.0.0`, `engines.node: >= 20.19.0` — projenin `>=20.11` tabanıyla **çelişir** (20.11-20.18 aralığındaki makineler dışlanır), bu yüzden sürüm `^4.0.3`'te sabitlendi |
| `fsevents` (mevcut lock) | Zaten vite/rollup'ın transitive bağımlılığı, `optional:true`+`os:['darwin']` — chokidar v4 buna bağımlı değil, yeni bir native-paket kategorisi eklenmedi |

## Karar

`chokidar@^4.0.3` bağımlılığı `package.json`'a eklendi (mimari §3.4'ün zaten onayladığı kapalı
listeden — kapsam genişlemesi değil, eksik uygulamanın tamamlanması). `src/server/watch/
project-watcher.ts`, `chokidar.watch(dir, { depth:0, ignoreInitial:true, usePolling:
process.env.MC_WATCH_POLLING === '1', awaitWriteFinish: { stabilityThreshold:200, pollInterval:50
} })` sarmalayıcısı üzerine kuruldu. `depth:0` — `docs/features` düz bir dizin (mimari §5.3
`FeatureCard.file` "yalnızca dosya adı" varsayımıyla tutarlı), alt dizinlere inilmiyor.

`project-watcher.ts` kendi 150 ms trailing debounce'unu (`src/server/watch/debounce.ts`) chokidar'ın
`awaitWriteFinish`'inin üstüne bindiriyor — ikisi farklı sorunları çözüyor: biri "dosya hâlâ
yazılıyor mu", diğeri "aynı mantıksal değişiklik kaç olay üretti" (mimari §6.1'in zaten yazdığı
150 ms sayısı).

## Alternatifler ve neden reddedildi

| Seçenek | Gerekçe (kabul/red) |
|---|---|
| `chokidar@^4.0.3` | **Seçildi** — ölçülen iki kusuru (dizin yaşam döngüsü ölümü + olay fırtınası) miras almıyor, native derleme gerektirmiyor, mimari §3.4'ün zaten onayladığı bağımlılık. |
| `node:fs.watch` (tur 1'in kararı) | Reddedildi — yukarıdaki iki gerçek ölçüm yüzünden (AC1'i sessizce ihlal eder, kaynak tüketen sonsuz döngü riski taşır). |
| Kendi üst-dizin-izleyip-yeniden-kur mantığımızı yazmak | Reddedildi — chokidar'ın zaten sınanmış çözdüğü bir problemi (dizin yaşam döngüsü) kötü kopyalamak olurdu (Karpathy §2 — burada tersine, "ölçülmüş bir gereksinimi karşılayan bağımlılık gereksiz değildir"). |
| `chokidar@5.0.0` | Reddedildi — `engines.node >= 20.19.0` projenin `>=20.11` tabanıyla çelişiyor, sürüm sabitlemesi bu yüzden `^4.0.3`'te kaldı. |

## Native derleme / install-script durumu

Ne `chokidar@4.0.3` ne de `readdirp@4.1.2` bir `preinstall`/`install`/`postinstall` script'i
taşıyor (native derleme riski yok, S2/ADR-003 ile çakışmıyor). `tests/deps.test.ts`'in kapalı
bağımlılık + install-script guard'ı bu iki paketi kapsayacak şekilde **hiçbir kod değişikliği
gerektirmeden** yeşil kaldı — beyaz listeye (`ALLOWED_INSTALL_SCRIPT_PACKAGES`) yeni bir giriş
eklenmedi.

## Geri dönüş planı

İki ölçülen senaryodan biri ileride (farklı bir Windows sürümü/antivirüs kombinasyonu, vb.)
tekrar ederse, mimari §3.5'in zaten tanımladığı `MC_WATCH_POLLING=1` ortam değişkeni
(`usePolling: true`) devreye alınabilir — bu anahtar zaten var, yeni bir konfigürasyon yüzeyi
eklenmiyor, emekliye ayrılmıyor; hem orijinal amacıyla (ağ sürücüsü/WSL) hem de bu ikinci
amaçla (Windows dizin yaşam döngüsü) aynı anahtar üzerinden kullanılabilir. Bu kod turunda
**hiçbir geri dönüşe ihtiyaç duyulmadı** — chokidar her iki senaryoda da native (polling
olmayan) modda temiz sonuç verdi (bkz. yukarıdaki tablo).

## Sonuçlar / kalan risk

- chokidar'ın polling **olmayan** modda bazı Windows/antivirüs kombinasyonlarında dosya
  kilitliyken (`EBUSY`) olay üretme davranışı bu turda test edilmedi — gerçek bir kilit
  senaryosu simüle edilemiyor (F-002'nin retention `EPERM`/`EBUSY` riskiyle aynı sınıf, kabul
  edilmiş, düşük olasılık).
- `MC_WATCH_POLLING`'in kayıtlı gerekçesi ("ağ sürücüsü/WSL sorunu") artık ikinci bir amaca
  (Windows dizin yaşam döngüsü) da hizmet ediyor; mimari §3.5'in açıklama cümlesinin
  genişletilip genişletilmeyeceği (`docs/02-architecture.md`'ye dokunmak bu ADR'nin kapsamı
  dışı) ayrı bir küçük görev.
