KARAR: KALDI
ESKALE: false

# G5 — Sözleşme kararları, tur 4 (beş sözleşmenin bileşik kararı)

Tarih: 2026-09-10 · Değerlendiren: qa-evaluator · Kapsam: DAR karar turu (yeni tam denetim yapılmadı)

**Bileşik karar KALDI'dır çünkü 1 numaralı sözleşme KALDI aldı. Diğer dördü GEÇTİ.**

> **ESKALE neden `false`?** Y1 ("kapsam dışı anılan bir ad yetkilendiriliyor") **kapandı** —
> dört bağımsız yoldan ölçtüm (§1.4). 1 numaradaki KALDI, Y1'in dördüncü tekrarı **değil**;
> tamamen yeni ve farklı bir bulgudur (§1.5: yük taşıyan bir kontrolün çitsiz olması + sözleşmenin
> kendi kabul kriterinde **ölçülebilir biçimde yanlış** bir mutasyon iddiası). Y1 dört turdur
> kapanmıyor değil; Y1 kapandı. Eskalasyon gerekmiyor.

---

## 0. Tur güvenliği ve kısıtlara uyum

| Kontrol | Tur başı | Tur sonu | Durum |
|---|---|---|---|
| `docs/approvals/G0.ok` | `3b21fd8e…8565` | `3b21fd8e…8565` | değişmedi |
| `docs/approvals/G1.ok` | `72bcf975…5234` | `72bcf975…5234` | değişmedi |
| `docs/approvals/G2.ok` | `a87cd696…1bf5` | `a87cd696…1bf5` | değişmedi |
| `docs/approvals/G3.ok` | `36b18d58…9eef` | `36b18d58…9eef` | değişmedi |
| `docs/approvals/G4-1.ok` | `08d0fe3a…0d82b` | `08d0fe3a…0d82b` | değişmedi |
| `docs/approvals/G4-2.ok` | `6bf5be08…2ace` | `6bf5be08…2ace` | değişmedi |
| `docs/approvals/README.md` | `8d9c8762…871d7` | `8d9c8762…871d7` | değişmedi |

- **Bekleyen token durumu (tur başı ve sonu): YOK.** `GUARD.ok`/`PUSH.ok`/`DANGER.ok` onay
  dizininde hiç bulunmadı; dolayısıyla `_selftest.cjs` emniyet kemeri (exit 3) tetiklenmedi ve
  betik normal koştu. Hiçbir token bu turda tüketilmedi/harcanmadı.
- Hiçbir kaynak dosya değiştirilmedi. `git status --short` tur başı ve tur sonu **boş**.
- Tüm mutasyonlar depo dışı bir **aynada** yapıldı; ayna kurulurken dokuz hook dosyasının
  **MD5'i birebir doğrulandı** (`gate-check.cjs = 2cf47329ca3d42aa4401f411d4b20ed2`, `TUM MD5 ESIT: true`).
  Her mutasyon **pristine kopyadan yeniden yazılarak** geri alındı (`git checkout`/`restore`
  KULLANILMADI — kayıtlı ders), her turda "bayt-bayt aynı = true" doğrulandı.
- Ayna tur sonunda silindi. Kalan `node.exe` süreci: **2** (tur başındakiyle aynı, yetim süreç yok).

---

## 1. `docs/qa/g5-guard-json-contract.md` — **KARAR: KALDI**

### Puanlar
| Eksen | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | 9 | Kurulu kod tüm saldırılarımı doğru karşıladı (66/66), CEO sondası 14/14, self-test 157/157. |
| Özellik bütünlüğü | 9 | Ana vaat kapandı, zaman penceresi modeli çalışıyor, README + hata mesajları tam. |
| Görsel/UX | yok say | Hook/CLI, arayüz yok. |
| **Kod kalitesi (testler)** | **6** | Yük taşıyan bir kontrol (`normalizeScopeEntry`) **sıfır** test kapsamına sahip; sözleşmenin kabul kriteri onun çitli olduğunu **iddia ediyor** ve bu iddia yanlış; altı test **yanlış nedenle** yeşil. |

**6 < 7 → KALDI.**

### 1.1 Kendi doğrulamalarım (sayılarla)

| Ölçüm | Sonuç |
|---|---|
| `node .claude/hooks/_selftest.cjs` (gerçek depo) | **exit 0, 157 OK / 0 FAIL** — beklenen 157/157 ile birebir |
| CEO saldırı sondası `probe-json-guard.mjs` (kurulu gerçek `gate-check.cjs` kopyalanmış sandbox'ta) | **14/14 GEÇTİ, exit 0** |
| **Kendi saldırı takımım (66 vaka)** | **66 OK / 0 HATA** |

### 1.2 Kendi saldırılarım — beklenen/gerçek (66 vaka, tamamı tuttu)

Aşağıda yalnızca ayırt edici olanlar; hepsi `scratchpad/qa4-attack.mjs`'de.

| Saldırı | Beklenen | Gerçek |
|---|---|---|
| Yinelenen `scope` (kök, gizli ad) | RED | exit 2 |
| Yinelenen `created_at` / `valid_minutes` / üç kez `scope` | RED | exit 2 (3/3) |
| İç içe yinelenen (`reason` bir object / dizi içindeki object) | RED | exit 2 (2/2) |
| Unicode kaçışlı `\u0073cope` + literal `scope` birlikte | RED | exit 2 |
| **Yalnız** unicode kaçışlı `\u0073cope` (aşırı engelleme sondası) | **KABUL** | exit 0 |
| **Dize değeri içinde anahtar gibi görünen metin** (aşırı engelleme sondası) | **KABUL** | exit 0 |
| Bilinmeyen kök alan (`notes`) | RED | exit 2 |
| `scope` dize / karışık tipli dizi / iç içe dizi eleman | RED | exit 2 (3/3) |
| Yol varyantları: `..`, mutlak, UNC, `\\?\`, ters bölü, Kiril homoglif, `./` öneki, sondaki boşluk, alt dizin, uzantısız, tam-genişlik nokta, sıfır-genişlik birleşim | RED | **exit 2 (12/12)** |
| BÜYÜK HARF `scope` girdisi (harf duyarsızlık) | **KABUL** | exit 0 |
| Süresi dolmuş (41 dk) / gelecekte (10 dk) | RED | exit 2 (2/2) |
| Saat kayması +30 sn (60 sn tolerans içinde) | **KABUL** | exit 0 |
| `valid_minutes` 121 / 0 / `"30"` / `null` / `1e999` | RED | exit 2 (5/5) |
| `valid_minutes` `30.0` ve `3e1` (aşırı engelleme sondası) | **KABUL** | exit 0 (2/2) |
| Artık veri / iki JSON belgesi / aşırı büyük (8300 B) | RED | exit 2 (3/3) |
| BOM / CRLF (aşırı engelleme sondası) | **KABUL** | exit 0 (2/2) |
| Ham NUL / kaçışlı NUL | RED | exit 2 (2/2) |
| Kök dizi / kök dize / kök null / boş `scope` / `scope` yok | RED | exit 2 (5/5) |
| Uzun `reason` içinde tam bir eski biçim `## Kapsam` bloğu + backtickli ad | **KABUL, ama yalnızca `scope`'taki dosya** | exit 0; gömülü ad reddedildi |
| Süresi dolmuş token + **kapsam dışı** hedef | RED **ve dosya silinir** | exit 2, `dosyaSilindi=true` |
| Pencere içinde aynı dosyaya iki yazma | İkisi de KABUL, token **yaşar** | exit 0/0, `kaldi=true/true` |
| Bozuk JSON | RED, dosya **korunur** | exit 2, `kaldi=true` |

**Kapsam dışı bir adı kabul ettiremedim.** (Brief'in sorusu: hayır.)

### 1.3 Özgün saldırı — özyinelemeli tarayıcı vs. native ayrıştırıcı (sızıntı YOK, ama borç)

`scanForDuplicateKeys` **JS'de yazılmış özyinelemeli** bir tarayıcı; `JSON.parse` ise native.
Tarayıcı fırlatırsa `parseGuardDoc` onu `catch (_) { dup = null; }` ile yutar — yani **yinelenen
anahtar katmanı bu durumda açık düşer (fail-open)**. Bunu sömürmeye çalıştım:

```
derinlik  8000 (16039 B): tarayici=FIRLATTI[RangeError: Maximum call stack size exceeded] | JSON.parse=basarili
derinlik 12000 (24039 B): tarayici=FIRLATTI[RangeError] | JSON.parse=basarili
derinlik 40000 (80039 B): tarayici=FIRLATTI[RangeError] | JSON.parse=basarili
```

Yani derin iç içe bir belgede tarayıcı ölüyor, `JSON.parse` yaşıyor ve gizli ikinci `scope`
kazanırdı. **Ama ulaşılamıyor:**

- Tarayıcının dayandığı en derin seviye (ikili arama ile ölçüldü): **5074**
- `MAX_GUARD_BYTES = 8192` içine sığan en derin yapı (dizi = seviye başına 2 bayt): **4038**
- Uçtan uca deneme (derinlik 3838 / 3988 / 4038, 8191 bayta kadar): **3/3 exit 2**,
  red nedeni doğrulandı → `yinelenen anahtar var: "scope" (seviye 1)`

**Sonuç: pratik sızıntı YOK.** Ama **`MAX_GUARD_BYTES` bir DoS önlemi değil, yinelenen-anahtar
katmanının taşıyıcı kolonu** — ve koddaki yorumu yalnızca DoS gerekçesi veriyor. Emniyet payı
yalnızca **~1,26x** (4038'e karşı 5074). Biri `reason`'a yer açmak için sınırı ~10 KB'ye çıkarırsa
katman **sessizce ölür**. Hiçbir test bu bağı ölçmüyor. → **Eşikli borç B-1.**

### 1.4 Ana vaat kapandı mı? EVET — dört bağımsız yoldan

Sözleşmenin tek cümlesi: *"kapsam yalnızca `scope`'tan okunur; `reason` dahil hiçbir alan ad için
taranmaz."*

1. `M-b` mutasyonu (`scope` dışındaki alanları da tara) → **D-REASON-CANNOT-LEAK KIRMIZI**. Çit var.
2. Kendi A14 saldırım: `reason` içine tam bir `## Kapsam` bloğu + backtickli ad → ad **reddedildi**.
3. CEO P1a sondası → geçti.
4. `M-a`/`M-e` kaskadları (5 ve 7 kırmızı) → JSON kimlik katmanı bağlı.

### 1.5 BULGU (KALDI gerekçesi) — beyaz liste yük taşıyor ama **çitsiz**, ve sözleşme aksini iddia ediyor

Sözleşme **§5 mutasyon 1** ve **§8 kabul kriteri 4** aynen şunu taahhüt ediyor:

> "**Beyaz liste kontrolünü kaldıran mutasyon** (`isWhitelistedScopeEntry` her dizeyi olduğu gibi
> kabul etsin) → D-TRAVERSAL/D-ABS/D-UNC/D-LONGPREFIX/D-BACKSLASH/D-UNI **KIRMIZI**."

**Ölçtüm — bu iddia yanlış:**

```
node --check: gecerli (sahte kirmizi degil)
M-f ile selftest: exit=0 OK=157 FAIL=0        <-- iddia: 6 KIRMIZI, gercek: 0 KIRMIZI
```

Beyaz liste (`normalizeScopeEntry`) tamamen kaldırıldığında **157/157 yeşil**, CEO sondası
**14/14 geçiyor**, benim 66 saldırım da **66/66 geçiyor**. Yani çit yok.

**Neden altı test yanlış nedenle yeşil:** D-TRAVERSAL/D-ABS/D-UNC/D-LONGPREFIX/D-BACKSLASH/D-UNI
vakalarının hepsi **hedefi adlandırmayan** bir `scope` girdisi yazıp (`../evil.cjs`,
`C:/Temp/evil.cjs`, …) sonra **`HOOK_FILE`'a** yazmayı deniyor. Beyaz liste kalksa bile kapsam
**üyelik** kontrolü (`parsed.scope.has(relLower)`) tek başına reddediyor. Ölçtükleri şey beyaz
liste değil, üyelik kontrolü.

**Ayırt edici sonda yazdım** — beyaz listeye **uymayan** ama hedefin kanonik yoluna **birebir eşit**
girdiler (hepsi `isGuarded`'a giriyor):

| `scope` girdisi = hedef | Kurulu kod | Beyaz liste kaldırılınca (M-f) |
|---|---|---|
| `.claude/hooks/sub/evil.cjs` | exit 2 | **exit 0 SIZINTI** |
| `.claude/hooks/notes.md` | exit 2 | **exit 0 SIZINTI** |
| `.claude/hooks/config.json` | exit 2 | **exit 0 SIZINTI** |
| `.claude/hooks/evil file.cjs` | exit 2 | **exit 0 SIZINTI** |
| `.claude/hooks/evil.payload.cjs` | exit 2 | **exit 0 SIZINTI** |
| `.claude/hooks/a/b/c.cjs` | exit 2 | **exit 0 SIZINTI** |
| | **0/6 sızıntı** | **6/6 sızıntı** |

Yani beyaz liste **gerçek** bir kontrol: tek bir onayın yetkilendirebileceği yol kümesini
"düz, `.cjs`, `.claude/hooks/` altında" ile sınırlıyor. Kaldırılırsa `.claude/hooks/**` altındaki
**her** yol (alt dizinler, her uzantı) tek onayla yazılabilir hâle geliyor — ve **hiçbir test
kırmızı vermiyor**.

**Bugün sızıntı yok** (kontrol yerinde ve çalışıyor: 12 yol-varyantı saldırım + 6 ayırt edici
vakanın hepsi reddedildi). Bulgu, kontrolün **sessizce ölebilir** olmasıdır — `CLAUDE.md`'nin
kendi ifadesiyle *"deponun en pahalı hata sınıfı"*, ve *"her çitin KENDİ pozitif kontrolü olmalı"*
kuralının doğrudan ihlali. Buna **bir de sözleşmenin kabul kanıtında yanlış bir iddia** eşlik
ediyor; bu, dört tur süren bir güvenlik kusurunun kapanış turunda kabul edilemez.

**Kapanış için gereken (küçük):** yukarıdaki tablodaki gibi, `scope` girdisi hedefin kanonik
yoluna **eşit** olan ama beyaz liste **şekline uymayan** en az 4-6 vaka ekleyin. Bunlar
`normalizeScopeEntry` kaldırıldığında kırmızı verir; mevcut altı D-* vakası vermez. Ayrıca
§5 mutasyon 1'in metnini ölçülen sonuca göre düzeltin.

### 1.6 Tek nokta mutasyon taraması — 17 karar noktası (CLAUDE.md F-009 dersi)

Kaskad kırmızı "katman bağlı" der, "her nokta ölçülüyor" demez. Her karar noktasını **tek tek**
gevşettim:

| Nokta | Kırmızı | Nokta | Kırmızı |
|---|---|---|---|
| P1 boyut sınırı | 1 | P10 `created_at` ayrıştırılabilir | 1 |
| **P2 ham NUL reddi** | **0** | P11 `created_at` gelecekte olamaz | 1 |
| P3 yinelenen anahtar | 5 | P12 `valid_minutes` tip/pozitiflik | 3 |
| P4 kök object olmalı | 1 | P13 `valid_minutes` üst sınırı | 1 |
| P5 bilinmeyen kök alan | 2 | P14 süre dolmuş kontrolü | 3 |
| **P6 `scope` dizi/boş kontrolü** | **0** | P15 kapsam üyelik kontrolü | 6 |
| **P7 beyaz liste** | **0** | **P16 `isGuarded` harf duyarsızlığı** | **0** |
| **P8 ters bölü açık reddi** | **0** | **P17 GUARD.ok varlık kontrolü** | **0** |
| **P9 `created_at` dize olmalı** | **0** | | |

**7/17 çitsiz.** Dürüst ayrım (hepsini eşit ağırlıkta saymıyorum):

- **P7 — yük taşıyan ve çitsiz.** §1.5'te kanıtlandı. **KALDI'nın gerekçesi.**
- **P6 — yük taşıyan ve çitsiz, ayrıca yanlış yönde bozuluyor.** `D-NO-SCOPE-FIELD` testi
  `{ note: '…', created_at: … }` belgesi kullanıyor — `note` **bilinmeyen bir kök alan**, yani
  test P5'e takılıyor, P6'ya hiç ulaşmıyor. Gerçek "`scope` alanı yok" yolunu ölçtüm:

  ```
  KURULU (mutasyonsuz)                : cikis kodu = 2 -> ENGELLER
  P6 mutasyonu (kontrol kaldirildi)   : cikis kodu = 1 -> ENGELLEMEZ (fail-OPEN)
  ```

  `for (const item of undefined)` fırlatıyor, süreç **exit 1** veriyor — ve Claude Code
  **yalnızca exit 2**'yi engelleme sayıyor (deponun kayıtlı dersi: hook'lar bu yüzden iki feature
  boyunca ölü koştu). Yani bu noktanın bozulma biçimi fail-closed değil **fail-open**. Bugün kod
  doğru (exit 2), sızıntı yok — ama test bu dalı hiç görmüyor. → **Eşikli borç B-2.**
- **P2, P8, P16, P17 — gerçekten fazlalık (savunma derinliği), borç değil.** Sırasıyla:
  ham NUL zaten `JSON.parse`'ın artık-veri/kaçışsız-kontrol-karakteri hatasına düşüyor; ters bölü
  reddini regex zaten yapıyor (kodun yorumu bunu açıkça söylüyor); `isGuarded`'ın `/i`'si
  `realpathSync.native` yolu zaten kanonik harflere çevirdiği için gereksiz; GUARD.ok varlık
  kontrolü kalkarsa `parseGuardDoc` "dosya okunamadı" ile fail-closed dönüyor. Bunları bulgu
  saymıyorum.
- **P9 — kısmen fazlalık.** `created_at` dize değilse `Date.parse` genelde NaN veriyor (P10
  yakalıyor); dar bir kenar durum (`created_at: 2026` → yıl olarak ayrışır) geçmişte kalacağı için
  P14'e takılıyor. Düşük risk, borç olarak kaydediyorum (B-2 ile birlikte).

### 1.7 Sözleşmenin kendi mutasyon iddiaları — doğrulama

**§9.4'ün üç mutasyonu birebir tuttu** (bu, sözleşmenin dürüst kısmı):

| Sözleşme iddiası | Ölçtüğüm |
|---|---|
| Yinelenen-anahtar kaldır → **5 kırmızı**: D-DUP-KEY, D-DUP-KEY-CREATED-AT, D-DUP-KEY-VALID-MINUTES, D-DUP-KEY-NESTED, D-UNICODE-ESCAPED-KEY-DUP | **5 kırmızı, birebir aynı isimler** |
| Bilinmeyen-kök-anahtar kaldır → **2 kırmızı**: D-UNKNOWN-ROOT-KEY, D-PROTO | **2 kırmızı, birebir** |
| İkisi birden → **7 kırmızı**, birleşim, kesişim yok | **7 kırmızı, tam olarak birleşim** |

**§5'in iddiaları ise iki yerde tutmadı:**

| §5 iddiası | Ölçtüğüm |
|---|---|
| Mutasyon 1 (beyaz liste) → 6 kırmızı | **0 kırmızı** ← §1.5, KALDI gerekçesi |
| Mutasyon 3 (zaman penceresi) → T-EXPIRED-DEFAULT, T-BOUNDARY-EXPIRED, **T-OVER-MAX, T-FUTURE, T-NEGATIVE-MINUTES** kırmızı | **3 kırmızı**: T-EXPIRED-DEFAULT, T-BOUNDARY-EXPIRED, T-EXPIRED-OUT-OF-SCOPE. Diğer üçü ayrı dallar (P11/P12/P13) ve **kendi çitleri var** (1/3/1 kırmızı) — yani koruma tam, **iddianın metni yanlış**. Bunu bulgu saymıyorum, yalnızca düzeltilmesi gereken bir kanıt cümlesi. |

### 1.8 Kabul kriterleri tablosu (§8)

| # | Kriter | Sonuç |
|---|---|---|
| 1 | self-test exit 0, vaka sayısı raporlanır | ✅ 157/157, exit 0 (gerçek depo **ve** ayna) |
| 2 | D-REASON-CANNOT-LEAK geçer | ✅ geçer, **ve** M-b ile kırmızıya döner (çitli) |
| 3 | T-REGRESSION-MULTI-WRITE geçer | ✅ (kendi A18 sondam da bağımsız doğruladı) |
| 4 | **§5'teki dört mutasyonun her biri belirtilen testleri KIRMIZI'ya çevirir** | ❌ **KARŞILANMADI** — mutasyon 1: 0 kırmızı (§1.5) |
| 5 | README güncel ve tam örnekli | ✅ gövde doğru ve eksiksiz (aşağıda küçük bir tutarsızlık notu) |
| 6 | Gerçek onay dosyalarının SHA-256'sı değişmemiş, `git status` temiz | ✅ 7/7 aynı, ağaç temiz |

**Kriter 4 karşılanmadığı için sözleşme kendi tanımına göre kapanmadı.**

### 1.9 Eşikli borçlar (1 numaralı sözleşme)

- **B-1 — `MAX_GUARD_BYTES` gizli taşıyıcı kolon.** 8192 baytlık sınır, yinelenen-anahtar
  katmanının tek koruyucusu (emniyet payı ~1,26x). Koddaki yorum yalnızca DoS gerekçesi veriyor.
  **Eşik:** sınırı büyüten ya da tarayıcıyı değiştiren **ilk** tur; o turda ya özyinelemeyi
  yinelemeli (iteratif) hâle getirin ya da açık bir derinlik sınırı + testini ekleyin.
- **B-2 — P6/P9 çitsiz, P6'nın bozulma biçimi fail-open (exit 1).** `D-NO-SCOPE-FIELD` P5'e
  takıldığı için gerçek dalı ölçmüyor. **Eşik:** `gate-check.cjs`'e dokunan bir sonraki tur;
  belgeyi yalnızca izin verilen alanlarla kurup (`{reason, created_at}`) `code === 2` assert edin.
- **B-3 — "tek kullanımlık" ifadesi yanlış (düşük).** `docs/approvals/README.md` başlığı ve
  9. satırı hâlâ "tek kullanımlık" diyor; gövde ise doğru biçimde *"tek bir yazmada tükenmez"*
  diyor. `gate-check.cjs`'in engelleme mesajı da kendi içinde çelişik: *"(tek kullanımlık, JSON,
  zaman pencereli)"*. Gövde net olduğu için bloklayıcı değil, ama kullanıcıya gösterilen metin bu.
  **Eşik:** bu dosyalara dokunan bir sonraki tur.

---

## 2. `docs/qa/g5-guvenlik-duzeltme-tur3-contract.md` — **KARAR: GEÇTİ**

**Mekanizma notu (brief §2 gereği): bu sözleşmenin kusuru, kendi önerdiği mekanizmayla (metindeki
backtick'li adları tarama + kapsam başına tüketim/`.guard-state.json`) DEĞİL, JSON tasarımıyla
(`ca4ce4c`) kapandı.** Kendi mekanizması yürürlükten kalktı; bunu kusur saymıyorum, sorduğum soru
"vaat edilen kusur bugün kapalı mı" oldu.

| Eksen | Puan |
|---|---|
| İşlevsellik | 9 |
| Özellik bütünlüğü | 8 (madde 4'ün mekanizması terk edildi, ama çözdüğü kusur kapalı) |
| Görsel/UX | yok say |
| Kod kalitesi | 8 |

**Dört maddenin bugünkü durumu:**

1. **`free` listesi harf duyarsız** → ✅ doğrulandı, kodda `gate-check.cjs:449` yedi desenin
   **yedisinde de** `/i` var.
2. **`-Recurse` kısaltma zinciri** → ✅ doğrulandı, `block-dangerous.cjs:41`'de genişletilmiş grup
   yerinde: `\bri\b[^\n]*-r(e(c(u(r(s(e)?)?)?)?)?)?\b`.
3. **7 self-test vakası (a–g)** → ✅ JSON karşılıklarına çevrildi, 157 vakanın parçası, hepsi yeşil.
4. **Kapsam listesi + tüketim** → ✅ kusur (kör tüketim + kapsam sızıntısı) kapalı; yerine
   `scope` alanı + zaman penceresi geldi. Sözleşmenin kendi "bilinen sınır"ı (kapsam eksik
   listelenirse token asla tükenmez, diskte kalır) **tamamen ortadan kalktı** — token artık zamanla
   ölüyor. Bunu bağımsız ölçtüm: süresi dolmuş token, **kapsam dışı** bir hedefe yazma denemesinde
   bile siliniyor (`dosyaSilindi=true`).

Sözleşmenin ana kabul kriteri Y1'di; Y1 kapandı (§1.4). **GEÇTİ.**

---

## 3. `docs/qa/g5-tur5-kapsam-siniri-tur2-contract.md` — **KARAR: GEÇTİ**

**Mekanizma notu: bu sözleşmenin kusuru, kendi önerdiği mekanizmayla (başlıktan sonraki "kapalı
biçimli liste maddeleri") DEĞİL, JSON tasarımıyla kapandı.** Sözleşmenin kendi tespiti
("desen eklemek dördüncü bir varyantla yenilir") doğru çıktı; çözüm bir katman yukarıda —
ayrıştırılacak metnin kendisini kaldırmakta — bulundu.

| Eksen | Puan |
|---|---|
| İşlevsellik | 9 |
| Özellik bütünlüğü | 8 |
| Görsel/UX | yok say |
| Kod kalitesi | 8 |

**Vaat ettiği kusur bugün kapalı mı? EVET — ve yapısal olarak.** Bu sözleşmenin hedeflediği
"başlık kimliğinin devralınması" sınıfı artık **tanımsız**: JSON'da başlık kavramı yok, kapsam
tek bir alandan okunuyor. Bağımsız doğrulama: A14 saldırımda `reason` alanına **tam bir
`## Kapsam` bloğu + backtickli dosya adı** gömdüm; belge kabul edildi ama gömülü ad **hiçbir
yetki kazanmadı** — yalnızca `scope`'taki dosya yetkilendi. Ayrıca `M-b` mutasyonu
(`scope` dışındaki alanları tara) D-REASON-CANNOT-LEAK'i kırmızıya çeviriyor, yani çit gerçek.

**Sözleşmenin kendi eşikli borcu hâlâ AÇIK ve bu turda büyüdü.** §"Eşikli borç" şöyle diyordu:
*"Y3'ün iki koruma katmanı kendi başına ölçülmüyor — biri sökülse `_selftest.cjs` yine 106/106
verir."* Aynı sınıfı bu turda `gate-check.cjs`'te ölçtüm: **17 karar noktasının 7'si çitsiz**
(§1.6), biri (beyaz liste) yük taşıyor. Borç kapanmadı, kapsamı genişledi — 1 numaralı sözleşmenin
KALDI gerekçesi bu.

---

## 4. `docs/qa/g5-tur5-kapsam-ve-selftest-contract.md` — **KARAR: GEÇTİ**

| Eksen | Puan |
|---|---|
| İşlevsellik | 9 |
| Özellik bütünlüğü | 9 |
| Görsel/UX | yok say |
| Kod kalitesi | 8 |

### Y1 kısmı
**Mekanizma notu: `## Kapsam` blok sınırı mekanizması terk edildi; kusur JSON'la kapandı** (§1.4).
Sözleşmenin kendi "bilinen sınır"ı (`### Kapsam` üç `#` ile tanınmıyor) **konusuz kaldı** —
başlık kavramı yok.

### Y3 kısmı — yeniden açmadım, yalnızca **hâlâ geçerli olduğunu** doğruladım

Bekleyen her onay tipi için ayrı ayrı ölçtüm (aynada, gerçek `_selftest.cjs` ile):

```
OK   GUARD.ok           exit=3 (beklenen 3) | dosya duruyor=true | icerik ayni=true
OK   PUSH.ok            exit=3 (beklenen 3) | dosya duruyor=true | icerik ayni=true
OK   DANGER.ok          exit=3 (beklenen 3) | dosya duruyor=true | icerik ayni=true
OK   .guard-state.json  exit=3 (beklenen 3) | dosya duruyor=true | icerik ayni=true
OK   bekleyen onay yokken normal kosu: exit=0 OK=157 FAIL=0   <-- negatif kontrol
ayna onay dizininde kalan dosyalar: ["G2.ok"]                 <-- sandbox artigi yok
```

Dört koruma tipinin dördü de: **exit 3**, dosya **duruyor**, içerik **MD5 birebir aynı**.
Negatif kontrol (aşırı engelleme yok): bekleyen onay yokken betik normal koşuyor. İzolasyon
katmanı da doğrulandı — gerçek depoda `_selftest.cjs` koştuğunda `docs/approvals/` yedi dosyasının
SHA-256'sı **değişmedi** (§0).

**Not:** Y3'ün iki katmanı hâlâ **kendi başlarına** ölçülmüyor (sözleşme bunu kendi eşikli borcu
olarak kaydetmişti, §3'te tekrarlandı). Bu turda yeniden açmadım.

---

## 5. `docs/qa/test-skip-gate-izolasyon-contract.md` — **KARAR: GEÇTİ**

| Eksen | Puan |
|---|---|
| İşlevsellik | 8 |
| Özellik bütünlüğü | 8 |
| Görsel/UX | yok say |
| Kod kalitesi | 8 |

### Bağımsız doğrulama — hiçbir depo dosyasına dokunmadan

Sözleşmenin ana iddiası: iç içe koşum, paylaşılan sabit portlara (7333/7334) ve `dist/web`'e
çarpıyordu; iki `--exclude` bunu yapısal olarak kaldırıyor. Bunu **kaynak dosyayı değiştirmeden**
ölçtüm: port 7333'ü harici olarak tutup, **eski** (2 bayrak) ve **yeni** (4 bayrak) komutu
birebir kurup koşturdum.

```
7333 harici olarak TUTULUYOR

ESKI komut (2 --exclude)
  exit=1 | "check-ports" gecis sayisi = 7 | EADDRINUSE = 1
  Test Files  1 failed | 82 passed | 1 skipped (84)
  cit dogru sekilde kirmizi ("does not match the") = true

YENI komut (4 --exclude)
  exit=1 | "check-ports" gecis sayisi = 0 | EADDRINUSE = 0
  Test Files  80 passed | 1 skipped (82)
  cit dogru sekilde kirmizi ("does not match the") = true
```

Bu, **hem kabul kriteri 3'ü hem de mutasyon (madde 6) talebini** karşılıyor: bayrakları kaldırmak
çakışmayı **aynen geri getiriyor** (7 geçiş + EADDRINUSE), eklemek sıfırlıyor. Çitin kendisi
her iki durumda da **doğru şekilde kırmızı** — daraltma testin ölçtüğü şeyi bozmuyor.

### Kabul kriterleri

| # | Kriter | Sonuç |
|---|---|---|
| 1 | İki yeni `--exclude` eklendi | ✅ `tests/verify-test-run.test.ts:451-459` dört bayrak yerinde |
| 2 | Test hâlâ kırmızı bekliyor | ✅ `not.toBe(0)` + `toContain('does not match the')` korunmuş |
| 3 | Deterministik kanıt: `"check-ports"` hiç geçmemeli | ✅ **0 geçiş** (eski komutta 7) |
| 4 | **Beş ardışık koşu aynı sonucu vermeli** | ❌ **KARŞILANMADI** — aşağıya bakınız |
| 5 | `npm run test -- --exclude tests/scripts/check-ports.test.ts` hâlâ kırmızı | ✅ exit 1, *"reported by vitest (85) does not match … on disk (86)"* |
| 6 | Mutasyon | ✅ yukarıda |
| 7 | `npx tsc --noEmit` = 0 | ✅ exit 0 |
| 8 | self-test çalıştırılır | ✅ 157/157 exit 0 |

### Kriter 4 — yedi koşu, dürüst sonuç

| Koşu | Sonuç | Not |
|---|---|---|
| 1 | YEŞİL | `Test Files 85 passed \| 1 skipped (86)`, `Tests 1371 passed \| 4 skipped (1375)` — tur başı tabanla birebir |
| 2 | KIRMIZI | `Worker forks emitted error` |
| 3 | KIRMIZI | `Worker forks emitted error` |
| 4 | KIRMIZI | `Worker forks emitted error` — teşhis: `Vitest caught 1 unhandled error`, **hiçbir assert kırmızı değil** (1367 passed / 0 failed), 1 dosya sessizce kayıp |
| 5 | YEŞİL | 1371 / 4 |
| 6 | YEŞİL | 1371 / 4 |
| 7 | YEŞİL | 1371 / 4 |

**4 yeşil / 3 kırmızı — sözleşmenin kendi 7 koşuluk ölçümüyle (4/3) birebir aynı oran.**

Kırmızıların **hiçbirinde** `check-ports`, `EADDRINUSE`, `build-css` ya da `dist/web` geçmiyor;
hiçbirinde başarısız bir assert yok. Yani **bu sözleşmenin hedeflediği çakışma sınıfı 0/7 koşuda
görüldü** — düzeltme hedefini tutuyor. Kalan kırmızılar, deponun `CLAUDE.md`'de kayıtlı organik
worker-fork çökmesi sınıfı. Ortam: 32.535 MB toplam bellek, **10.313 MB boş** (~%68 kullanımda) —
sözleşmenin not ettiği baskının aynısı. Tur başında yalnızca **2** `node.exe` vardı, yani bu benim
sondalarımın artığı değil.

Kriter 4'ün karşılanmaması bu sözleşmenin **dosya sahipliği dışındaki**, önceden var olan bir
sınıftan kaynaklanıyor ve sözleşme bunu dürüstçe beyan etmiş; deliverable'ın kendisi
(izolasyon) kanıtlanmış durumda. Bu yüzden GEÇTİ veriyorum — ama borcu aşağıya yazıyorum,
çünkü %43 kırmızı veren bir test kapısı gerçek bir sorundur.

### Eşikli borç (5 numaralı sözleşme)

- **B-4 — `npm run test` koşularının %43'ü `Worker forks emitted error` ile kırmızı.** Bu
  sözleşmenin kapsamı dışı ama proje geneli bir engel: "bir kez daha koştur" bir teşhis değil.
  Belirti tutarlı — assert kırmızısı yok, 1 dosya sessizce kayboluyor, kapı bunu doğru yakalıyor.
  **Eşik:** G6/yayın öncesi ya da kırmızı oranı iki ardışık turda >%50 olursa; kendi sözleşmesini
  hak ediyor (kök neden: pool/isolate yapılandırması ve bellek baskısı).

---

## 6. Bilinen, yeni sayılmayan bulgu

`block-dangerous.cjs`'in komutun tamamını tek metin olarak tarayıp ilgisiz parçaları birleştirmesi
**bu turda bana da iki kez vurdu** (biri tamamen salt-okunur bir `sha256sum` çağrısıydı, yalnızca
komutun başka bir yerinde ilgisiz bir `rmSync` bulunduğu için engellendi). `docs/blockers.md`'de
eşiğiyle kayıtlı olduğu için **yeni bulgu saymıyorum**; yalnızca maliyetinin biriktiğini not
ediyorum (bugün toplam üç+iki kez gerçek işi kilitledi). Aşırı engelleme de kusurdur.

---

## 7. CEO'nun uygulaması gereken frontmatter değişiklikleri

```
docs/qa/g5-guard-json-contract.md              → status: fix
docs/qa/g5-guvenlik-duzeltme-tur3-contract.md  → status: done
docs/qa/g5-tur5-kapsam-siniri-tur2-contract.md → status: done
docs/qa/g5-tur5-kapsam-ve-selftest-contract.md → status: done
docs/qa/test-skip-gate-izolasyon-contract.md   → status: done
```

---

## 8. G5 kapısı için kalan engeller

**Bir engel var:**

1. **`docs/qa/g5-guard-json-contract.md` KALDI** — kabul kriteri 4 karşılanmadı. Kapanması için
   gereken iş küçük ve iyi tanımlı (§1.5 sonu): `normalizeScopeEntry` için **ayırt edici** en az
   4-6 test vakası (girdi = hedefin kanonik yolu, ama beyaz liste şekline uymuyor) + §5 mutasyon 1
   metninin ölçülen sonuca göre düzeltilmesi. Kabul ölçütü ölçülebilir: **beyaz listeyi kaldıran
   mutasyon en az 4 vakayı KIRMIZI yapmalı** (bugün 0 yapıyor).

**Engel olmayan, taşınan eşikli borçlar:** B-1 (`MAX_GUARD_BYTES` gizli taşıyıcı kolon),
B-2 (P6/P9 çitsiz, P6 fail-open bozuluyor), B-3 ("tek kullanımlık" ifadesi yanlış),
B-4 (`npm run test` %43 kırmızı). Ayrıca 3 ve 4 numaralı sözleşmelerin devrettiği
"Y3'ün iki katmanı kendi başına ölçülmüyor" borcu **hâlâ açık**.

Diğer dört sözleşme G5'in önünde durmuyor.
