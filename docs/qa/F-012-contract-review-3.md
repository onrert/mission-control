---
feature: F-012
title: F-012 sözleşme denetimi — tur 3 (kapanış doğrulaması, yalnızca 5 madde)
author: qa-evaluator
date: 2026-09-06
verdict: GEÇTİ
---

# KARAR: GEÇTİ
# ESKALE: false

Denetlenen belge: `docs/qa/F-012-contract.md` (1031 satır, `status: draft`, `revision: 3`).
Bu tur **en dar kapsamlıdır**: yalnızca `docs/qa/F-012-contract-review-2.md`'nin açtığı Y-B1, Y-B2,
Y-B3, Ö5, Ö6 maddelerinin kapanıp kapanmadığı denetlendi. Kapanmış bölümler yeniden açılmadı.
`npm install` yapılmadı, oturum açılmadı, `src/`/`tests/` altında hiçbir dosyaya dokunulmadı —
yalnızca bu rapor dosyası yazıldı. Tüm satır referansları kurulu SDK paketinin `sdk.d.ts`'inde
(`...\scratchpad\sdk-probe\node_modules\@anthropic-ai\claude-agent-sdk\sdk.d.ts`) `sed -n`/`grep -n`
ile tek tek açılıp doğrulandı.

---

## Beş maddenin durumu

| # | Konu | Durum | Kanıt |
|---|---|---|---|
| Y-B1 | Yanlış `sdk.d.ts:6391` atfı silindi mi, yerine konan kanıt doğru mu | **KAPANDI (bir citation nitiyle)** | `docs/qa/F-012-contract.md:691-693` yanlış atfı açıkça belirtip siliyor. Yerine konan üç kanıt: `allowManagedPermissionRulesOnly` doc `sdk.d.ts:6320-6322` (contract:701-708) — **verbatim doğrulandı**, gerçekten "user/project/local/`--settings`'ten gelen izin kuralları ve `--allowedTools`'tan gelen allow kuralları YOK SAYILIR" diyor, K3'ü kapatan asıl alan bu iddia doğru. `resolveSettings()`/`ResolveSettingsOptions` `sdk.d.ts:2989-3054` (contract:711-718) — **verbatim doğrulandı** (fonksiyon imzası, `@remarks` "raw settings cascade, not a security decision" uyarısı dahil). `managedSettings` admin-tier metni `sdk.d.ts:2052-2061` (contract:769-772, ayrı bir yerde) — **verbatim doğrulandı**. Aşağıda bir citation kusuru var, bkz. "Yeni bulgu".|
| Tuzak uyarısı | `allowManagedHooksOnly`/`strictPluginOnlyCustomization` KESİNLİKLE set edilmeyecek mi, görünür mü | **KAPANDI** | `docs/qa/F-012-contract.md:720-729`, `⚠ TUZAK` başlığıyla ayrı, göze çarpan bir blok (dipnot değil, §8a'nın ana akışında, mekanizma açıklamasının hemen ardında). `allowManagedHooksOnly` doc `sdk.d.ts:6307-6310` — **verbatim doğrulandı**. `strictPluginOnlyCustomization` doc `sdk.d.ts:6331-6334` — **verbatim doğrulandı**. Kapanış cümlesi net: *"`session.ts`'in `managedSettings` nesnesi yalnızca `{ permissions: { allowManagedPermissionRulesOnly: true } }` içerir — başka hiçbir anahtar eklenmez."* (contract:728-729) — kod örneği (§8a "Güncellenmiş önerilen yapılandırma", satır 733-739) da bununla birebir tutarlı. |
| Y-B2 | D10 gövdeye yayılmış mı, "K3'ü gevşet" akışı tamamen çıkmış mı, §13 hâlâ eski soru mu | **KAPANDI** | `docs/qa/F-012-contract.md:777-811` ("Yol B — koşullu olarak plana dahil", "D6/D10 sonucu") D10'u tam uyguluyor: canlı test başarısız olursa **durmadan** Yol B'ye geçiliyor, K3/UX§7.3 gevşetme "kesin REDDEDİLDİ" ve "pazarlığa kapalı" olarak iki ayrı yerde (satır 782, 811) yazılı. §13 (satır 1004-1031) eski soru 1'i üstü çizili ("Kapanan (D10, Y-B2 düzeltmesi)") gösteriyor, kalan tek açık soru artık persona doğrulaması (madde 3b) — K3/§7.3 gevşetmesiyle ilgisiz. `grep -n "gevşet\|7\.3"` tüm belgede 6 sonuç verdi, hepsi "kapalı/reddedildi/gevşetilmez" bağlamında — hiçbir kalıntı/çelişki yok. |
| Y-B3 | Bütçe tavanı: ayarlanabilir mi, sessizce durmuyor mu, mutasyonda sessiz-durma çiti var mı | **KAPANDI** | `docs/qa/F-012-contract.md:315-342` üç şartı da karşılıyor: (a) `MC_CHAT_MAX_BUDGET_USD` env değişkeni, geçersiz/negatif/tanımsızsa güvenli varsayılana ($20) düşüyor + stderr uyarısı (satır 325-329, Ö12'nin `isChatEnabled` deseniyle tutarlı) — sabit gömülü değil; (b) ayrı `last_error: 'budget_exceeded'` kodu (genel "crashed" ile karışmıyor), §10 tablosunda (satır 860) kullanıcıya özel Türkçe metin ("...bütçe tavanına ulaştı") + "Yeniden bağlan" gösteriliyor, oturum `restart` ile devam edebiliyor (satır 336-338) — sessizce durmuyor; (c) mutasyon 14 (satır 962-968) `error_max_budget_usd` case'i kaldırılırsa `session.test.ts`'in KIRMIZI vermesini şart koşuyor, AC8'e bağlanmış (§11.1 satır 900). `sdk.d.ts:1774-1777` (`maxBudgetUsd` doc) ve `sdk.d.ts:4957-4964` (`SDKResultError` tip tanımı, `subtype` alanı `'error_max_budget_usd'` içeriyor) **ikisi de verbatim doğrulandı**. |
| Ö5 | "Yeniden bağlan" davranışı net mi | **KAPANDI** | `docs/qa/F-012-contract.md:867-883` net: buton `POST /api/chat/restart`'ı çağırır, yeni `EventSource` açmaz, SSE taşıması (tarayıcı varsayılan reconnect) ile oturum-seviyesi çökme arasındaki farkı açıkça ayırıyor. |
| Ö6 | `chat_permission_request`/`chat_permission_resolved` şemaları tam mı, ham veri sızmıyor mu | **KAPANDI** | `docs/qa/F-012-contract.md:481-519` iki arayüzü de tam alan listesiyle (hepsi zorunlu, opsiyonel işareti yok) tanımlıyor: `ChatPermissionRequestEvent{request_id, turn_id, tool_name, input_preview, ts}`, `ChatPermissionResolvedEvent{request_id, turn_id, outcome, ts}`. `input_preview`'ın sunucu tarafında üretilen ≤500 karakterlik özet olduğu, ham `tool_input`/`result` nesnesinin **hiçbirine kopyalanmadığı** açıkça yazılı (satır 514-515). Enforcement (mutasyon 12'nin kapsamının genişletilmesi) kod turuna bırakılmış ama bu, Ö6'nın round-2'de "bloklayıcı değil" diye işaretlenmiş isteğiyle tutarlı — şema artık tanımsız değil. |

---

## Yeni bulgu (ÖNEMLİ, bloklayıcı değil — GEÇTİ kararını değiştirmiyor)

### N-B1 — Y-B1'in "Bulunan mekanizma" madde 1'inde satır↔alıntı eşleşmesi yanlış (aynı hata sınıfının küçük bir tekrarı)

- **Nerede:** `docs/qa/F-012-contract.md:696-700`, madde 1: *"**`Options.managedSettings`
  (`sdk.d.ts:2051-2074`, ✓ DOĞRULANDI):** 'Restrictive policy-tier settings … Feeds the
  lowest-precedence policy sub-source and is filtered through a restrictive-key allowlist
  (`allowManaged*Only` locks, `permissions.deny`/`ask`, sandbox restrictions); non-restrictive keys
  such as `model`, `env`, `cleanupPeriodDays` are silently dropped.'"*
- **Doğrulama:** `sdk.d.ts:2051-2074` (kurulu paket, satır satır okundu) bu metni **taşımıyor**.
  O aralıktaki gerçek metin: *"Policy-tier settings supplied by the spawning parent process. When
  an IT-controlled managed-settings tier … exists on the user's machine, these are dropped by
  default — they only layer in if that admin opts in via `parentSettingsBehavior: 'merge'` …"*
  (bu metin belgenin kendisinde **başka bir yerde**, satır 769-772'de, doğru satır aralığıyla
  `sdk.d.ts:2052-2061` olarak zaten doğru alıntılanmış). Madde 1'de gerçekten alıntılanan cümle
  ("Restrictive policy-tier settings … Feeds the lowest-precedence…") `sdk.d.ts:3037-3045`'te
  bulunuyor — bu, `ResolveSettingsOptions.managedSettings` alanının JSDoc'u (`Options.
  managedSettings` değil) ve zaten aynı bölümde madde 3'ün kapsadığı aralığın (`sdk.d.ts:2989-
  3054`) içinde. Yani belge **aynı satır aralığını (2051-2074/2052-2061) iki farklı yerde iki
  farklı — ve birbiriyle uyumsuz — alıntıyla** kullanıyor; madde 1'in alıntısı o aralıkta yok.
- **Etki (neden bloklayıcı değil):** madde 1'in vardığı sonuç ("`permissions.ask` ve
  `allowManaged*Only` kilitleri bu filtreden geçer") yanlış değil — çünkü gerçekte alıntılanan
  metin (`sdk.d.ts:3037-3045`) kendi içinde *"equivalent to `Options.managedSettings` on
  `query()`"* diyor, yani SDK'nın kendisi bu iki alanın eşdeğer olduğunu belgeliyor. K3'ü fiilen
  kapatan asıl kanıt madde 2'dir (`allowManagedPermissionRulesOnly`, `sdk.d.ts:6320-6322`) ve o
  kanıt **verbatim doğru**. Dolayısıyla D6/Yol A'nın sonucu bu hatadan etkilenmiyor — yalnızca
  madde 1'in etiketlemesi (alan adı + satır aralığı) yanlış.
- **Neden yine de rapor ediyorum:** görev talimatı açıkça "satır numaraları doğru mu ve iddiayı
  destekliyor mu, kendin aç ve oku" dedi ve bu üç kanıttan biri (madde 1) bu testi **literal
  olarak** geçmiyor — tam da Y-B1'in kendisinin eleştirdiği hata sınıfı (yanlış yere atıf), bu kez
  daha küçük ölçekte (tamamen ilgisiz bir alan değil, komşu/eşdeğer bir alan) aynı fix içinde
  tekrarlanmış.
- **Önerilen düzeltme (kod turu başlamadan, tek satır, opsiyonel):** madde 1'in başlığını
  `Options.managedSettings (sdk.d.ts:2051-2074)` yerine `ResolveSettingsOptions.managedSettings
  (sdk.d.ts:3037-3045, "equivalent to Options.managedSettings on query()")` olarak düzelt. Bu bir
  **bloklayıcı değildir** — K3'ün kapanma iddiası madde 2'ye dayanıyor ve o doğru; bu yalnızca bir
  dipnot düzeltmesi, kod turunu geciktirmemeli.

---

## Ek kontrol — mutasyon listesi 17 madde, D9 uyumu

Yeni eklenen iki madde (`docs/qa/F-012-contract.md:955-968`):
- **Mutasyon 13** (çevrimdışı çit, offline fence): `resolveSettings(...)` çağrısının döndürdüğü
  `ResolvedSettings`'te bayrağın etkili olmadığını görür. **Elle yazılmış beklenti** olarak
  işaretlenmiş, gerekçesi de doğru: yapılandırma literali sözleşmenin kendisinde tek kaynak
  (kodda henüz yok), D9'un "kaynaktan türetilemiyorsa açıkça söyle" şartını karşılıyor (mutasyon
  1'in aynı gerekçe deseniyle tutarlı).
- **Mutasyon 14** (bütçe sessiz-durma): `session.test.ts`'in enjekte sahte `query`'sinin
  `SDKResultError{subtype:'error_max_budget_usd'}` yayınlamasıyla tetiklenir, **kaynaktan
  türetilmiş** olarak işaretlenmiş — "gerçek `session.ts`'in mesaj işleme dalı taranır, sahte mesaj
  tipi SDK'nın kendi tipinden (`sdk.d.ts:4957-4964`) kopyalanır" diyor; bu iddia doğru: mesaj tipi
  gerçekten SDK tipinden kopyalanıyor (verbatim doğrulandı), assert edilen davranış (case kaldırılırsa
  yayın kaybolur) da `session.ts`'in henüz yazılmamış kodunun **planlanan** switch yapısına atıfta
  bulunuyor — bu, mutasyon 3/8b gibi diğer "henüz yazılmamış kod" mutasyonlarıyla aynı, kabul
  edilebilir bir örüntü.

İki madde de D9'un iki şartını (hangi test kırmızı verecek + türetilmiş mi/elle mi) taşıyor. Toplam
17 madde sayımı (`1,2,2b,3,4,5,6,7,7b,8,8b,9,10,11,12,13,14`) doğru sayıldı.

**İç çelişki taraması (yalnızca bu turun değişiklikleri):** `grep -n "gevşet\|7\.3"` ve budget/D11
ile ilgili tüm bölümler (§0.1, §3, §10, §11.1, §11.2, §13) karşılıklı okundu — hiçbir çelişki
bulunamadı. §0'ın "değişen bölümler" listesi (satır 22-25) ile gerçekte değişen bölümler eşleşiyor.

---

## Karar

**KARAR: GEÇTİ.** Gerekçe: Y-B1'in ana iddiası (K3'ü fiilen kapatan mekanizma) artık doğru ve
verbatim doğrulanabilir bir kanıta (`allowManagedPermissionRulesOnly`, `sdk.d.ts:6320-6322`)
dayanıyor; tuzak bayrakları (`allowManagedHooksOnly`, `strictPluginOnlyCustomization`) açıkça ve
göze çarpar biçimde hariç tutulmuş. Y-B2 (D10) ve Y-B3 (D11) CEO kararları gövdeye tam olarak
yayılmış, eski/çelişkili metin kalıntısı yok, her ikisi de somut çitlerle (mutasyon 13, 14)
desteklenmiş ve AC eşlemesine bağlanmış. Ö5/Ö6 tam olarak kapatılmış. Tek bulgu (N-B1) bir citation
etiketleme hatasıdır, sonucu değiştirmiyor ve talimatın "önemsiz stil hatası için bulgu açma"
kısıtına takılmayacak kadar somut olsa da (gerçek bir satır↔alıntı uyumsuzluğu) tek başına üçüncü
bloklayıcı bulgu sınıfında değil — düzeltmesi tek satır, kod turunu geciktirmemeli. Bu üçüncü ve son
tur; kapanışı geciktirecek yeni bir engel yok.

---

## Doğruladıklarım

| İddia | Kanıt |
|---|---|
| `allowManagedPermissionRulesOnly` metni verbatim | `sdk.d.ts:6320-6322` (grep+sed ile açıldı) |
| `allowManagedHooksOnly` metni verbatim | `sdk.d.ts:6307-6310` |
| `strictPluginOnlyCustomization` metni verbatim | `sdk.d.ts:6331-6334` |
| `resolveSettings()`/`ResolveSettingsOptions` metni ve uyarısı verbatim | `sdk.d.ts:2989-3054` |
| `Options.managedSettings` admin-tier metni verbatim (contract satır 769-772'nin kullandığı yer) | `sdk.d.ts:2051-2074` |
| Madde 1'in (contract:696-700) alıntısı `sdk.d.ts:2051-2074`'te YOK, gerçek yeri `sdk.d.ts:3037-3045` | grep+sed karşılaştırması |
| `maxBudgetUsd` doc metni verbatim | `sdk.d.ts:1774-1777` |
| `SDKResultError` tip tanımı ve `subtype` alanı verbatim | `sdk.d.ts:4957-4964` |
| §13'te D10/D11 dışında hiç eski/çelişkili "K3'ü gevşet" kalıntısı yok | `grep -n "gevşet\|7\.3"` tüm belge |
| Mutasyon listesi 17 madde, 13/14 D9 formatında (hangi test + türetilmiş mi) | `docs/qa/F-012-contract.md:905-968` |
| Ö5/Ö6 şemaları alan-bazında tam, ham `tool_input`/`result` yok | `docs/qa/F-012-contract.md:481-519, 867-883` |

## Doğrulayamadıklarım

1. **`managedSettings`/`allowManagedPermissionRulesOnly`'nin gerçek çalışma zamanı davranışı** —
   yalnızca tip tanımları okundu, hiçbir SDK oturumu açılmadı (görev kısıtı, kota). Bu zaten
   sözleşmenin kendisinin de kabul ettiği ve canlı testle kapatılacak [T] TAHMİN.
2. **D6/Yol A'nın canlı test sonucu, admin-tier/`parentSettingsBehavior` koşulunun bu makinede
   geçerli olup olmadığı** — kod turunun ilk işi, bu turda ölçülmedi.
3. **Uygulamanın çalışan hâli / davranışsal iddialar** — bu tur da belge denetimidir, hiçbir sunucu
   başlatılmadı, Playwright koşulmadı (görev kısıtı, dar kapsam).
