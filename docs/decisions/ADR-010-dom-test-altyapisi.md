# ADR-010 — DOM test altyapısı: jsdom + Testing Library

- **Tarih:** 2026-09-05
- **Durum:** Kabul edildi
- **Karar veren:** CEO (`docs/qa/F-003-contract.md` §6 taslağı onaylandı, "CEO onayı — sözleşme
  KAPANDI" bölümü)
- **Bağlam:** F-001/F-002/F-004 yalnızca `renderToStaticMarkup` (DOM'suz, SSR) kullanıyordu.
  F-003 projenin ilk etkileşimli ekranını (tıklama, klavye, state geçişleri, `EventSource`
  yaşam döngüsü) getiriyor — gerçek bir DOM ortamı ve etkileşim simülasyonu gerekiyor.

## Karar

`jsdom` (test ortamı) + `@testing-library/react` (render/query) +
`@testing-library/user-event` (gerçekçi tıklama/klavye simülasyonu) + `@testing-library/dom`
(peer, explicit). `@testing-library/jest-dom` **eklenmedi** — native `expect(el.textContent)`/
`el !== null`/`el.getAttribute(...)` yeterli, bir bağımlılık daha azaltıldı (mimari §3.4 kapalı
bağımlılık listesi felsefesi).

## Sürüm seçimi — `engines` çelişkisi

Tur 1, en güncel `jsdom@30.0.1`'i öneriyordu ama bu sürümün `engines.node` alanı
`^22.22.2 || ^24.15.0 || >=26.0.0` — projenin `package.json engines.node: ">=20.11"` beyanı ve
`src/server/index.ts`'in `isSupportedNodeVersion` kontrolüyle **çelişiyordu** (Node
20/21/22.0-22.22.1/23/24.0-24.14/25'te `npm ci` EBADENGINE uyarısı verirdi).

Sözleşme turunda gerçek veriyle ölçüldü (`npm view`/`npm pack` ile canlı registry'den,
`nodejs.org/dist/index.json`'dan gerçek Node sürüm listesiyle):

| Kontrol | Sonuç |
|---|---|
| `jsdom` sürüm geçmişinde `engines` daralması | `27.0.0`/`27.0.1`: `{node:'>=20'}` — çelişmiyor; `27.1.0`'dan itibaren `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`'a daraldı (20.11-20.18 dışlanıyor) — tekrar çelişiyor |
| `ci.yml`'nin kurduğu Node sürümü | `setup-node@v4` ile `node-version: '22'` — kayan etiket, `jsdom@30` ile CI'da çalışırdı, ama yerel/contributor ortamları (Node 20.11+) için çelişki kalıcı kalırdı |

**Karar:** `jsdom` **tam sabitlenmiş `27.0.1`** (caret/tilde DEĞİL — `^27`/`~27.0.1` gelecekte
`27.1.0`'a yükselip çelişkiyi geri getirebilirdi). Gerekçe: projenin beyan ettiği Node tabanını
(`>=20.11`) ya da `isSupportedNodeVersion`/`ci.yml`'i değiştirmek bu kararın kapsamını aşan,
alakasız bir yan etki olurdu; `27.0.1` mevcut hiçbir dosyaya dokunmadan çelişkiyi ortadan
kaldırıyor. Yaklaşık bir yıl önce yayınlanmış olması (`30.0.1`'e göre) kabul edilebilir bir
taviz — proje ileride Node tabanını yükseltirse (ayrı bir karar/ADR) bu pin gözden geçirilebilir.

`package.json`'da bugün kurulu gerçek sürümler (✓ VERIFIED, `node_modules/*/package.json`):

| Paket | Sürüm | `engines.node` |
|---|---|---|
| `jsdom` | `27.0.1` (tam sabit, caret yok) | `>=20` — projenin `>=20.11` tabanıyla çelişmiyor |
| `@testing-library/react` | `16.3.3` (`^16` aralığı) | `>=18` — çelişki yok |
| `@testing-library/dom` | `10.4.1` (`^10` aralığı, peer) | `>=18` — çelişki yok |
| `@testing-library/user-event` | `14.6.7` (`^14` aralığı) | `>=12` — çelişki yok |

Projenin kendi `engines.node` alanı (`>=20.11`) **değişmedi**.

## Native derleme durumu

`jsdom@27.0.1`, `@testing-library/react`, `@testing-library/user-event` — üçünde de
`hasInstallScript` tanımsız (yok). `jsdom@27.0.1`'in tek native-derleme riski taşıyan bağlantısı
`canvas` — opsiyonel bir peer dependency (`peerDependenciesMeta.canvas.optional === true`), npm
bunu otomatik kurmaz; F-003 hiçbir yerde `canvas`/`getContext('2d')` API'si kullanmıyor. Kod
turunda `npm install` sonrası `tests/deps.test.ts` yeşil kaldı — kapalı bağımlılık listesi
guard'ı bu dört yeni paketi de kapsıyor.

## Reddedilen alternatifler

| Seçenek | Gerekçe (kabul/red) |
|---|---|
| `jsdom@27.0.1` | **Seçildi** — `engines` çelişkisi olmayan tek güncel sürüm; `@testing-library/react` + Vitest'in resmi örneklerinde varsayılan, devasa kullanım hacmi. |
| `jsdom@30.0.1` | Reddedildi — `engines.node` `>=20.11` tabanıyla çelişiyor (yukarı bakınız). |
| `happy-dom` | Reddedildi — iddia edilen performans avantajı bu projenin birkaç düzine bileşen testi ölçeğinde anlamsız; `EventSource`'u ikisi de desteklemiyor (✓ VERIFIED, `npm pack` ile indirilip incelendi — `Window`'da `EventSource` `undefined`), yani asıl karar faktörü olgunluk/dokümantasyon/topluluk büyüklüğü oldu — jsdom + Testing Library en çok denenmiş kombinasyon. |
| Vitest Browser Mode (`@vitest/browser` + Playwright provider) | Reddedildi — tek gerçek avantajı (gerçek `EventSource`) bu sözleşmenin ihtiyaç duymadığı bir şey: SSE protokolü zaten ham `node:http` ile (`tests/helpers/sse-client.ts`, F-002/F-004 deseniyle) doğrulanıyor; DOM testleri yalnızca render mantığını ölçüyor ve enjekte edilebilir bir sahte `EventSource` (`tests/helpers/fake-event-source.ts`) ile yeterli. Ayrıca `vitest.config.ts`'e workspace/provider kurulumu + her test dosyasında gerçek tarayıcı bağlamı açma maliyeti (mevcut node-ortamlı testlere göre gözle görülür yavaşlama) gerektirirdi — kullanılmayacak altyapı kurmak olurdu. |

## Enjekte edilebilirlik

`useEventStream(streamUrl, eventsUrl, { EventSourceImpl = window.EventSource } = {})` —
üretimde varsayılan gerçek tarayıcı API'si kullanılır; testlerde `tests/helpers/fake-event-source.ts`
enjekte edilir. Bu, jsdom'un `EventSource` eksikliğini (✓ VERIFIED, `jsdom@27.0.1` `lib` içinde
"EventSource" dizgesi 0 kez geçiyor) DOM-testi seviyesinde aşmanın tek yolu — bir polyfill paketi
eklemek yerine tercih edildi (ek bağımlılık yok).

## Mevcut guard'lara etkisi

- `tests/deps.test.ts` — kapalı bağımlılık listesi; dört yeni paket eklendikten sonra
  `npm run verify` yeşil kaldı (✓ VERIFIED, kod turunda çalıştırıldı).
- `tests/no-external-host.test.ts` — yeni `.tsx`/`.ts` dosyaları zaten taranan köklerin
  (`src/features/**`, `src/server/**`) altında; dosyaya dokunulmadı.
- Vitest ortam ayarı: `vitest.config.ts`'in global `environment: 'node'`'una dokunulmadı — yeni
  bileşen/hook test dosyalarının her birinin başına `// @vitest-environment jsdom` docblock'u
  eklendi (Vitest'in resmi dosya-bazlı geçersiz kılma mekanizması). Bu, mevcut node-ortamlı
  testlerin hızını/davranışını etkilemedi.

## Sonuçlar

- F-003 kapsamında `package.json`'a dört `devDependencies` satırı eklendi, script değişikliği
  olmadı.
- Yeniden açılma tetikleyicisi: proje Node tabanını `>=22.22.2`/`>=24.15.0`'a yükseltirse (ayrı
  bir karar) bu pin gözden geçirilip `jsdom@30.x`'e yükseltilebilir.
