# Sözleşme — K3 çevrimdışı çit `permissions.ask` iddiasını gevşetme (bakım, yeni feature değil)

**Kaynak:** `docs/blockers.md` "### Kapsam dışı bırakılan test kırmızısı — `tests/features/
chat/server/session.test.ts`" (G5 turunda düşülen not). CEO ölçümü brief'te verildi: G5'in
`.claude/settings.json`'a eklediği `permissions.ask` genişlemesi (`Edit(docs/approvals/**)`,
`Write(docs/approvals/**)`) K3 testindeki tam-eşitlik iddiasını (`toEqual(['Bash'])`) kırıyor.
Bu bir güvenlik regresyonu değil — eklenen kurallar `ask` (daha kısıtlayıcı), `allow` değil.

**Dosya sahipliği (bu tur):** yalnızca `tests/features/chat/server/session.test.ts` (satır ~543
civarı, K3 `describe` bloğu). `src/features/chat/server/session.ts`'e yalnızca §3'teki iki
mutasyon için **geçici** dokunulacak, birebir geri alınacak — kalıcı değişiklik yok. `.claude/`
altına dokunulmayacak. `docs/blockers.md`'deki ilgili madde "kapandı" olarak güncellenecek.

## 1. Ne yapılacak

`expect(resolved.effective.permissions?.ask).toEqual(['Bash'])` satırı tam eşitlikten
kapsayıcılığa çevrilir:

```ts
expect(resolved.effective.permissions?.ask).toContain('Bash')
```

İddianın hemen üstüne, neden tam eşitlik kullanılmadığını açıklayan bir Türkçe yorum eklenir:
`resolveSettings` proje kademesinin (`.claude/settings.json`) TÜM `permissions.ask`/`allow`
kurallarını ham birleştirmeye dahil eder (CEO ölçümü: `effective.allow` içinde proje ayarlarının
`Write(docs/**)` kuralı da görünüyor); `allowManagedPermissionRulesOnly` bir **karar anı**
bayrağıdır (izin motorunun hangi kademeye uyacağını belirler), kademe birleştirmesini
filtrelemez. Bu testin görevi `managedSettings`'in (`session.ts`'in `buildOptions()` çıktısı)
`resolveSettings`'e sessizce kaybolmadan ulaştığını kanıtlamaktır — `.claude/settings.json`'ın
tam güncel içeriğini değil. Proje ayarlarına gelecekte eklenecek başka `ask`/`allow` kuralları bu
testi bir daha kırmamalı.

## 2. Davranışlar nasıl doğrulanacak (qa-evaluator için)

- **Statik:** `git diff` yalnızca `tests/features/chat/server/session.test.ts`'i gösterir;
  `toEqual` → `toContain` değişikliği ve eklenen yorum satırları görünür.
- **Yeşil koşu:** `npx vitest run tests/features/chat/server/session.test.ts` → tüm testler
  (27/27 beklenen) yeşil; özellikle K3 `describe` bloğundaki tek `it` yeşil.
- **Tam suite:** `npm run test` (veya `npm run verify` test adımı) tam yeşil; dosya/test
  sayıları raporlanır.
- **Mutasyon kanıtı (çitin hâlâ bir şey ölçtüğünü kanıtlamak için, `src/` geçici):**
  1. (m1) `session.ts`'teki `managedSettings.permissions.ask` dizisinden `'Bash'` çıkarılır
     (`ask: []` veya alanın kaldırılması) → K3 testi **KIRMIZI** olmalı (`toContain('Bash')`
     artık sağlanmıyor). Gözlemlenip elle geri alınır.
  2. (m2) `managedSettings`'ten `allowManagedPermissionRulesOnly: true` alanı kaldırılır →
     aynı testteki `expect(resolved.effective.allowManagedPermissionRulesOnly).toBe(true)` VE
     `managedSource!.settings...allowManagedPermissionRulesOnly).toBe(true)` iddiaları
     **KIRMIZI** olmalı. Gözlemlenip elle geri alınır.
  - Her iki mutasyonda da geri alma `git checkout`/`git restore` İLE YAPILMAZ (bu depoda daha
    önce commit'siz gerçek düzeltmeleri sildiği kayıtlı) — elle ters `Edit` uygulanır, sonra
    `git diff -- src/features/chat/server/session.ts` boş çıktı vermesi doğrulanır.
- **Regresyon:** `npm run test` (tam suite) turun başında ve sonunda karşılaştırılır; mutasyon
  turları hariç `src/` hiç değişmemiş olmalı (`git status --short` temiz, yalnızca test dosyası
  ve `docs/` değişikliği commit'te).

## 3. Kapsam dışı / bilinçli yapılmayanlar

- `.claude/settings.json`'daki `permissions.ask` içeriğini değiştirmek — bu G5'in kasıtlı
  düzeltmesi, geri alınmayacak.
- K3 testinin diğer iddialarını (`allowManagedPermissionRulesOnly`, `managedSource` varlığı)
  gevşetmek — bunlar hâlâ tam eşitlik/kesin doğru, brief bunları değiştirmiyor.
- Yeni bir soyutlama/yardımcı fonksiyon eklemek — tek satırlık `toEqual`→`toContain` değişimi
  ve bir yorum yeterli.
