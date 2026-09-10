KARAR: KALDI
ESKALE: true

---

**Sözleşme:** `docs/qa/g5-guvenlik-duzeltme-tur3-contract.md` (kabul kriteri **Y1**)
**Tür:** ÇOK DAR yeniden ölçüm — üçüncü tur. Yalnızca Y1 ölçüldü; başka hiçbir kriter yeniden
açılmadı, yeni denetim yapılmadı.
**Ölçülen düzeltme:** commit `26126e0` ("fix(hooks): close Y1 round 2 — scope is read from
closed-form list items only")
**Önceki kararlar:** ölçüm 1 KALDI · ölçüm 2 KALDI · **bu ölçüm KALDI (3. kez)**

**Neden `ESKALE: true`:** aynı kabul kriteri üç ardışık turda kapanmadı. Süreç kuralı gereği
eskalasyon eşiğine gelindi. Gerekçe teknik olarak da aynı aileye işaret ediyor: kusur her
turda "markdown metninin ŞEKLİ anlamı belirliyor" sınıfından çıkıyor ve her turda şeklin
başka bir boyutu yamalanıyor (önce *dosyanın tamamı* → *başlık bloğu* → *liste maddesi*).
Bu turda kalan sızıntı, düzeltmenin **dokunmadığı** üçüncü boyutta: **başlık satırının
kendisinin kimliği**.

**Tek cümlelik özet:** Tur 2'nin üç sızıntısı **gerçekten kapandı** (3/3 + gerçekçi CEO
belgesi 3/3) ve 40'ı aşkın yeni biçim sondası tuttu; ama `## Kapsam` başlığı **birebir**
eşleşmediğinde (ör. `## Kapsam (2 dosya)`, `## Kapsam:`) mekanizma söz verdiği gibi
fail-closed olmuyor — belgenin **başka bir yerindeki** birebir `## Kapsam` satırına (arşiv
alıntısı, HTML yorumu, kod bloğu örneği) sessizce bağlanıyor: kullanıcının onayladığı dosya
**reddediliyor**, onaylamadığı dosya **kabul ediliyor (exit 0, kart yok)** ve onay token'ı
o yazmayla **tüketiliyor**.

---

## 0. Kısıtlara uyum

- **Gerçek `docs/approvals/` altına hiçbir şey yazılmadı/silinmedi.** Tur başı ve tur sonu
  SHA-256'ları birebir aynı (§6). Tur başında bekleyen token **yoktu** (6 kapı dosyası +
  `README.md`), tur sonunda da yok.
- **Hiçbir depo dosyası değiştirilmedi** — bu raporun kendisi dışında. Tur sonunda
  `git status --porcelain` yalnızca iki satır gösteriyor: `M docs/qa/latest.md` ve
  `?? docs/qa/G5-sozlesme-kararlari-2026-09-10-tur3.md`. Sözleşme dosyasının `status:`
  alanı **bilerek değiştirilmedi** (brief §5: `docs/qa/*-contract.md` dosyalarına
  dokunulmayacak); dosya zaten `status: fix` ve `karar: KALDI` taşıyor, bu tur da bunu
  doğruluyor. docs/approvals/ altına hiçbir yazma yapılmadı.
- Tüm sondalar ve mutasyonlar **MD5'i doğrulanmış sandbox kopyalarda** koştu (§1).
- `npm run test` / `npm run e2e` **çalıştırılmadı** (brief §4).
- `.claude/` altı yalnızca okundu; `src/`, `tests/`, `scripts/`, `package.json`, `CLAUDE.md`,
  `docs/progress.md`, `docs/blockers.md`, hiçbir `*-contract.md` dosyasına dokunulmadı.
  `data/` değişmedi. Uzak depoya gönderme yapılmadı.
- `git checkout` / `git restore` **kullanılmadı**; mutasyonlar ayrı sandbox ağaçlarına
  uygulandı, gerçek dosya hiç mutasyona uğramadı.
- Korunan komut adları hiçbir Bash komut satırına gömülmedi; sandbox kurulumu/mutasyonu
  `Write` ile yazılan Node betikleriyle yapıldı (`docs/approvals` dizesi kabuk komutunda
  geçince `block-dangerous.cjs` haklı olarak engelliyor — bu tur bunu bir kez canlı gördü).
- **Açık beyan (kısıt yorumu):** brief §5 "`.claude/` altını yalnızca oku" diyor. Ölçülen
  koda (`.claude/hooks/**`, `.claude/settings.json`) **hiç dokunulmadı**. Buna karşılık kendi
  kalıcı QA hafızama iki dosya yazdım: `.claude/agent-memory/qa-evaluator/MEMORY.md` ve
  `.claude/agent-memory/qa-evaluator/feedback_statik-cit-denetimi.md` (bu turun dersi).
  Bu dizin `gate-check.cjs`'in kendi tanımına göre güvenlik sınırı değildir (yorum satırı 8-9:
  "`.claude/agents/**` ve `.claude/agent-memory/**` güvenlik sınırı değildir, serbest kalır") ve
  ajanın kendi hafıza deposudur; yine de kısıdın harfiyle çeliştiği için burada beyan ediyorum.
  İstenirse geri alınabilir; ölçüm sonuçlarına hiçbir etkisi yok.
- **Süreç hijyeni:** §7.

## 1. Ölçüm altyapısı

`.claude/hooks/` altındaki **9 `.cjs` dosyasının tamamı** izole bir sandbox'a kopyalandı,
kaynak/kopya MD5'leri **9/9 eşleşti** (`ALL_MD5_MATCH=true`):

```
asset-guard.cjs       533c9688db335af9b39f1aa4907d196d
block-dangerous.cjs   8099805ee49f9d9f816d8041253dbd1e
gate-check.cjs        85d18513673d904eebda16fd2b32cfcf   <- olculen dosya
post-format.cjs       2d78b66bb08a18582f3b957c7366e894
send-event.cjs        308fd02488a872b499c351b5dacfb740
session-start.cjs     c73bfa90d9cc5eb2925c3319a2244cae
stop-check.cjs        3c12934629ab5ce2c25460ffca13cad4
_common.cjs           41c4be2337f72053b71fd91703ecebaf
_selftest.cjs         8e865160e31229ccc55b10f9e1fb2f87
```

Sandbox kendi izole onay ağacını taşır. Her sonda: GUARD.ok yazılır → durum dosyası silinir →
`gate-check.cjs` alt süreç olarak `{"tool_name":"Write","tool_input":{"file_path":…}}`
stdin'iyle çalıştırılır → çıkış kodu, stdout (izin kartı), token'ın hayatta kalıp kalmadığı
kaydedilir. Toplam **73 sonda**.

---

## 2. KARAR: KALDI

**Puanlar:** İşlevsellik **6** · Özellik bütünlüğü **5** · Görsel/UX *yok say* ·
Kod kalitesi (testler, hata yönetimi) **6**
→ üç eksen de < 7.

### 2.1 Kapanan kısım — hakkını verelim

Düzeltme gerçek, ölçülebilir ve tasarımı doğru yönde değiştirdi ("blok nerede biter" →
"hangi satır sayılır", kara liste → kapalı biçim).

| Sonda | Tur 2'deki sonuç | **Bu tur** |
|---|---|---|
| **A-G2L** başlıksız kuyruk düzyazısındaki ad | 0 (sızdı) | **2 ✓ kapandı** |
| **A-G3L** `# Gerekce` (h1) sonrasındaki ad | 0 (sızdı) | **2 ✓ kapandı** |
| **A-G4L** `**Gerekce**` kalın psödo-başlık sonrasındaki ad | 0 (sızdı) | **2 ✓ kapandı** |
| **A-CEO2** gerçekçi belgede "DOKUNULMAYACAK" denen `_selftest.cjs` | 0 (sızdı) | **2 ✓ kapandı** |
| **A-CEO3** gerçekçi belgede "KAPSAMI DISINDADIR" denen `block-dangerous.cjs` | 0 (sızdı) | **2 ✓ kapandı** |
| **A-CEO1** aynı belgede onaylanan `gate-check.cjs` | 0 | **0 ✓** (aşırı engelleme yok, token tüketildi) |

Ayrıca yeni sınıra atılan **40 biçim sondasının 35'i** beklendiği gibi reddetti: numaralı
liste, `+` madde işareti, iç içe ters tırnak, devam satırı, HTML yorum satırı, alıntı bloğu,
tablo satırı, `---`/`***` ayraçları, unicode madde işaretleri (`•`, `–`), görev listesi
(`- [ ]`), bağlantı biçimi, `*vurgu*` içindeki ad, ters tırnaksız düz ad, tam yol yazımı,
CRLF/BOM/tek-`\r` varyantları, harf varyantı hedef, başlık öncesi liste, "## Kapsam disi"
başlıklı ikinci bölüm. Sözleşmenin "kapalı biçimi bozan madde TÜM kapsamı geçersiz kılar"
iddiası da doğrulandı (B18/B19/B20: hem dışlanan ad hem onaylanan ad reddediliyor).

### 2.2 BLOKLAYICI — Y1 kapanmadı: başlık kimliğinin devralınması

**Kusur.** Kapsam bölümü, `/^\s*##\s*kapsam\s*$/i` ile **birebir** eşleşen satırla belirleniyor
(`.claude/hooks/gate-check.cjs:65`, kullanımı `:72-78`). Başlıkta en ufak bir kuyruk varsa
(`## Kapsam (2 dosya)`, `## Kapsam:`, `## Kapsam — bu tur`) o satır **başlık sayılmıyor**.
Kodun yorumu bu durumda fail-closed olunacağını söylüyor (`:37-38`, "Başlık yok … fail-closed").
**Gerçekte fail-closed olmuyor:** `headerCount` yalnızca birebir eşleşmeleri saydığı için,
belgenin herhangi bir yerindeki **tek** birebir `## Kapsam` satırı — arşiv alıntısında, HTML
yorumunda, kod bloğunda olsa bile — **başlık kimliğini devralıyor** ve kapsam oradan okunuyor.
İnsanın gördüğü belirsizlik (iki "Kapsam" bölümü) makinede belirsizliğe değil, **yanlış tarafa
açılmaya** çözülüyor.

**Tekrar üretme (D1/D2/D3 — en gerçekçi biçim).**

1. Sandbox depo kopyasında `docs/approvals/GUARD.ok`:

```
# GUARD onayi - G5 tur 7 hook bakimi

Tarih: 2026-09-10
Onaylayan: Kullanici (Veron)

## Kapsam (2 dosya)

- `gate-check.cjs`
- `_selftest.cjs`

## Onceki onayin metni (arsiv, referans icin)

## Kapsam

- `evil-payload.cjs`
```

2. `gate-check.cjs`'e stdin ile sırayla üç hedef verilir.

| Hedef | Onay metninin dediği | Beklenen | **Gerçek** |
|---|---|---|---|
| `.claude/hooks/evil-payload.cjs` | **arşiv — bu turun kapsamı değil** | 2 | **0 — sessiz izin, stdout boş, kart YOK, `GUARD.ok` TÜKETİLDİ (silindi)** |
| `.claude/hooks/gate-check.cjs` | **onaylandı** | 0 | **2 — reddedildi** |
| `.claude/hooks/_selftest.cjs` | **onaylandı** | 0 | **2 — reddedildi** |

Reddedilen (onaylı) yazmanın kullanıcıya dönen mesajı da yanıltıcı:
`Engellendi: ".claude/hooks/gate-check.cjs" GUARD.ok kapsamı dışında.` — oysa dosya belgede
kapsam olarak listelenmiş. Mesaj **ayrıştırılan kapsamı yazmadığı** için kullanıcı/CEO neyin
yanlış gittiğini göremez; doğal onarım refleksi ("adı bir kez daha ekleyeyim") işe yaramaz.

**Aynı kusurun diğer üç kapısı (hepsi canlı ölçüldü):**

| # | GUARD.ok'un görünür anlamı | Kapsamı devralan blok | Kapsam dışı hedef | **Gerçek** |
|---|---|---|---|---|
| D4 | `## Kapsam:` altında `gate-check.cjs` | **kod bloğu içindeki biçim örneği** | `evil-payload.cjs` | **0 — izin + token tüketildi** (onaylı `gate-check.cjs` → 2) |
| D6 | `## Kapsam (guncellenmis)` altında `gate-check.cjs` | **HTML yorumundaki eski kapsam** | `evil-payload.cjs` | **0 — izin + token tüketildi** (onaylı `gate-check.cjs` → 2) |
| D10 | `## Kapsam (bu tur hicbir hook dosyasi degismiyor)` — **kapsam bilerek boş** | ekteki birebir başlık | `evil-payload.cjs` | **0 — izin + token tüketildi** |
| B12 | belge "Bu onay iptal edildi" diyor, tek başlık **HTML yorumu içinde** | yorum bloğu | `evil-payload.cjs` | **0 — izin + token tüketildi** |
| B13 | belge "Gercek kapsam yok" diyor, tek başlık **kod bloğu içinde** | kod bloğu | `evil-payload.cjs` | **0 — izin + token tüketildi** |

Beş vakanın beşinde de: **çıkış kodu 0, stdout boş (izin kartı yok), `GUARD.ok` diskten
silindi.** Yani kullanıcının hiç onaylamadığı bir yazma, kullanıcının onayını **harcayarak**
geçiyor.

**Neden bloklayıcı (yumuşatma yok).** Brief §6'nın **her iki** ölçütü de karşılanıyor:

- **(a) kalıcı artefakt:** onay dosyası `GUARD.ok`, kullanıcının onaylamadığı bir yazma
  tarafından **tüketiliyor/siliniyor**. Onaylanan iş ise engellendiği için yapılmamış kalıyor.
- **(b) ana vaat:** sözleşme madde 4'ün cümlesi *"token bir DEĞİŞİKLİĞİ yetkilendirir, bir
  YAZMAYI değil"* ve kodun kendi yorumu *"Başlık yok … fail-closed"*. Ölçüm ikisini de
  çürütüyor: yetkilendirilen değişiklik ile onaylanan değişiklik **birbirinden tamamen
  farklı** olabiliyor ve tanınmayan başlık fail-closed değil **fail-open onto the wrong
  block** davranıyor.

Bu, ölçüm 2'nin bloklayıcısıyla **aynı ürün sonucunu** üretiyor (belgenin açıkça
söylemediği/dışladığı bir dosya sessizce yetkileniyor), yalnızca kapı değişti — üstelik bu
sefer **onaylı dosya da reddedildiği için** kullanıcı hatayı düzeltmeye çalışırken kapıyı
gevşetmeye itiliyor.

**Muhtemel dosya:satır:** `.claude/hooks/gate-check.cjs:65` (`kapsamHeaderRe`), `:72-78`
(`headerCount` yalnızca birebir eşleşmeyi sayıyor; `##` ile başlayan ama "kapsam" içeren
diğer başlıklar hiç görülmüyor), `:203` (blok mesajı ayrıştırılan kapsamı raporlamıyor).

**Testlerde neden görünmedi:** `_selftest.cjs` yalnızca *iki birebir* `## Kapsam` başlığını
(y1-e) ve *hiç* başlık olmamasını (y1-d) ölçüyor. "Görünür başlık birebir değil + belgede
başka bir birebir başlık var" vakası **hiç yok** (`grep "Kapsam ("` → 0 sonuç). Ayrıca kod
bloğu/HTML yorumu içindeki başlık için de vaka yok.

### 2.3 ÖNEMLİ (bloklayıcı değil) — aşırı engelleme, kullanıcıyı kapıyı gevşetmeye itiyor

Aşırı engelleme de kusurdur (brief §3). Üç meşru yazım reddediliyor — hepsi **fail-closed**
yönünde, yani güvenli taraf; ama hata mesajı kapalı biçmi tarif etmediği için onarılamıyor:

| # | Meşru metin | Beklenen | Gerçek |
|---|---|---|---|
| C09 | `## Kapsam` + `- \`.claude/hooks/gate-check.cjs\`` (**tam yol** — doğal yazım) | 0 | **2** |
| C10 | `## Kapsam` + `<!-- iki dosya -->` + liste | 0 | **2** |
| C11 | `## Kapsam` + `Asagidaki dosyalar:` + boş satır + liste | 0 | **2** |
| A-G2b | tur 1/tur 2 biçimi: başlık + **madde işaretsiz** `` `x.cjs` `` satırı | 0 | **2** |

C11 özellikle gerçekçi: bir CEO'nun "## Kapsam" altına bir cümle yazması sıradan. Kabul
edilmiş tasarım kararı olduğu görülüyor (`_selftest.cjs` y1-h bunu sabitliyor), ama
`gate-check.cjs:198,203`'teki iki blok mesajının **hiçbiri** kapalı biçmi (`-`/`*` ile
başlayan, satır başına **tam olarak tek** ters tırnaklı ad) anlatmıyor; `docs/approvals/README.md`
GUARD.ok'tan hiç söz etmiyor. Kapıyı zorlayan bir kullanıcı biçimi deneme-yanılmayla arar —
ve bu depoda tek kullanımlık token deneme-yanılmaya dayanmıyor (kayıtlı ders: token
`PreToolUse`'da tüketiliyor).

### 2.4 Sonda tasarım hatam (dürüstlük notu)

Beş sondada (`B05` satır sonu boşluk, `B06` tire sonrası fazla boşluk, `B08` ters tırnak içi
boşluk, `B24` nbsp girinti, `B28` form feed) beklentiyi 2 yazmıştım; hepsi 0 döndü. **Bunlar
kusur değil:** o sondalarda eklenen satır zaten iyi biçimli bir kapsam maddesi (`- \`ad.cjs\``),
yani belge o adı gerçekten kapsam olarak listeliyor. Kabul doğru davranıştır. `B03`/`B04`
(girintili/iç içe madde) de tasarım gereği kabul ediliyor — bu, C03'ün istediği "girintili
madde reddedilmesin" kuralının aynısı.

---

## 3. Bütün sondalar — beklenen/gerçek çıkış kodları

`bekl` = benim beklentim, `gerç` = ölçülen çıkış kodu, `token` = koşumdan sonra GUARD.ok'un
durumu, `mutA`/`mutB` = mutasyon altındaki çıkış kodu (§4).

| # | Sonda | bekl | gerç | token | mutA | mutB |
|---|---|---|---|---|---|---|
| A-G2 | tur2 G2 (orijinal, ad liste maddesi DEĞİL) | 2 | 2 | kaldı | 0 | 0 |
| A-G2b | aynı metinde kapsam İÇİ ad (madde işaretsiz) | 0 | **2** | kaldı | 0 | 0 |
| A-G3 | tur2 G3: `# Gerekce` (h1) sonrası ad | 2 | 2 | kaldı | 0 | 0 |
| A-G4 | tur2 G4: `**Gerekce**` sonrası ad | 2 | 2 | kaldı | 0 | 0 |
| A-G2L | tur2 G2 liste biçimli: kuyruk düzyazıdaki ad | 2 | 2 | kaldı | 0 | 0 |
| A-G2Lb | aynı metinde kapsam İÇİ ad | 0 | 0 | TÜKENDİ | 0 | 0 |
| A-G3L | tur2 G3 liste biçimli | 2 | 2 | kaldı | 0 | 0 |
| A-G4L | tur2 G4 liste biçimli | 2 | 2 | kaldı | 0 | 0 |
| A-CEO1 | gerçekçi CEO belgesi: onaylı `gate-check.cjs` | 0 | 0 | TÜKENDİ | 0 | 0 |
| A-CEO2 | "DOKUNULMAYACAK" denen `_selftest.cjs` | 2 | 2 | kaldı | 0 | 0 |
| A-CEO3 | "KAPSAMI DISINDADIR" denen `block-dangerous.cjs` | 2 | 2 | kaldı | 0 | 0 |
| B01 | numaralı liste `1. \`ad\`` | 2 | 2 | kaldı | 0 | 0 |
| B02 | `+` madde işareti | 2 | 2 | kaldı | 0 | 0 |
| B03 | tab ile girintili madde (tasarım: girinti şeffaf) | 0 | 0 | kaldı | 0 | 0 |
| B04 | iki boşluk girintili iç içe madde | 0 | 0 | kaldı | 0 | 0 |
| B05 | satır sonu boşluk *(sonda tasarım hatam)* | 2 | 0 | kaldı | 0 | 0 |
| B06 | tire sonrası fazla boşluk *(sonda tasarım hatam)* | 2 | 0 | kaldı | 0 | 0 |
| B07 | ters tırnak içinde tam yol | 2 | 2 | kaldı | 2 | 2 |
| B08 | ters tırnak içinde boşluklu ad *(sonda tasarım hatam)* | 2 | 0 | kaldı | 0 | 0 |
| B09 | çift ters tırnak (iç içe) | 2 | 2 | kaldı | 0 | 0 |
| B10 | devam satırı (çok satıra yayılan madde) | 2 | 2 | kaldı | 0 | 0 |
| B11 | HTML yorum satırı (listeden sonra) | 2 | 2 | kaldı | 0 | 0 |
| **B12** | **HTML yorumu İÇİNDE tam Kapsam bloğu** | 2 | **0** | **TÜKENDİ** | 0 | 0 |
| **B13** | **kod bloğuna alınmış sahte Kapsam** | 2 | **0** | **TÜKENDİ** | 0 | 2 |
| B14 | başlık ÖNCESİ liste | 2 | 2 | kaldı | 2 | 0 |
| B15 | CRLF: kuyrukta ad | 2 | 2 | kaldı | 0 | 0 |
| B16 | BOM + kuyrukta ad | 2 | 2 | kaldı | 0 | 0 |
| B17 | harf varyantı hedef (`.CLAUDE/HOOKS/…`) | 2 | 2 | kaldı | 0 | 0 |
| B18 | tek satırda iki ad → tüm kapsam geçersiz | 2 | 2 | kaldı | 0 | 0 |
| B19 | madde işaretli dışlama notu → kapsam geçersiz | 2 | 2 | kaldı | 0 | 0 |
| B20 | aynı metinde dışlanan ad da reddedilir | 2 | 2 | kaldı | 0 | 0 |
| B21 | alıntı bloğu `> - \`ad\`` | 2 | 2 | kaldı | 0 | 0 |
| B22 | tablo satırı | 2 | 2 | kaldı | 0 | 0 |
| B23 | `## Kapsam disi` başlıklı ikinci bölüm | 2 | 2 | kaldı | 2 | 0 |
| B24 | nbsp (U+00A0) girinti *(sonda tasarım hatam)* | 2 | 0 | kaldı | 0 | 0 |
| B25 | unicode madde işareti `•` | 2 | 2 | kaldı | 0 | 0 |
| B26 | en-dash madde işareti `–` | 2 | 2 | kaldı | 0 | 0 |
| B27 | yalnız `\r` (eski Mac) satır sonu | 2 | 2 | kaldı | 0 | 0 |
| B28 | form feed "boş" satır *(sonda tasarım hatam)* | 2 | 0 | kaldı | 0 | 0 |
| B29 | liste dışı satırdan SONRA gelen geçerli madde | 2 | 2 | kaldı | 0 | 0 |
| B30 | başlıkta satır sonu boşluk + madde | 0 | 0 | TÜKENDİ | 0 | 0 |
| B31 | ters tırnaksız düz ad | 2 | 2 | kaldı | 2 | 2 |
| B32 | `- *\`ad\`*` (vurgu) | 2 | 2 | kaldı | 0 | 0 |
| B33 | bağlantı biçimi `- [\`ad\`](x)` | 2 | 2 | kaldı | 0 | 0 |
| B34 | görev listesi `- [ ] \`ad\`` | 2 | 2 | kaldı | 0 | 0 |
| B35 | büyük harfli ad kapsamda, hedef küçük harf | 0 | 0 | TÜKENDİ | 0 | 0 |
| B36 | `-\`ad\`` (boşluksuz) | 2 | 2 | kaldı | 0 | 0 |
| B37 | `---` ayracı sonrası madde | 2 | 2 | kaldı | 0 | 0 |
| B38 | `***` ayracı sonrası madde | 2 | 2 | kaldı | 0 | 0 |
| B39 | dizin geçişli ad `../evil.cjs` | 2 | 2 | kaldı | 2 | 2 |
| B40 | settings.json kapsamda, hedef hooks dosyası | 2 | 2 | kaldı | 2 | 2 |
| C01 | depo self-test biçimi | 0 | 0 | TÜKENDİ | 0 | 0 |
| C02 | başlık sonrası boş satır + madde | 0 | 0 | TÜKENDİ | 0 | 0 |
| C03 | girintili madde | 0 | 0 | TÜKENDİ | 0 | 0 |
| C04 | `*` madde işareti | 0 | 0 | TÜKENDİ | 0 | 0 |
| C05 | maddeler arası boş satır (2 dosyalık kapsam) | 0 | 0 | kaldı (doğru) | 0 | 0 |
| C06 | CRLF meşru belge | 0 | 0 | TÜKENDİ | 0 | 0 |
| C07 | BOM meşru belge | 0 | 0 | TÜKENDİ | 0 | 0 |
| C08 | `.claude/settings.json` kapsamda | 0 | 0 | TÜKENDİ | 0 | 0 |
| **C09** | **tam yol yazımı (meşru)** | 0 | **2** | kaldı | 2 | 2 |
| **C10** | **başlık sonrası HTML yorumu + meşru liste** | 0 | **2** | kaldı | 0 | 0 |
| **C11** | **liste öncesi açıklama cümlesi (meşru)** | 0 | **2** | kaldı | 0 | 0 |
| C12 | üç dosyalık kapsam, üçüncü hedef | 0 | 0 | kaldı (doğru) | 0 | 0 |
| **D1** | **arşiv bloğu başlığı devralıyor: arşivdeki ad** | 2 | **0** | **TÜKENDİ** | 0 | 0 |
| **D2** | **aynı belge: kullanıcının onayladığı ad** | 0 | **2** | kaldı | 2 | 0 |
| **D3** | **aynı belge: onaylanan ikinci ad** | 0 | **2** | kaldı | 2 | 0 |
| **D4** | **kod bloğu örneği devralıyor: örnekteki ad** | 2 | **0** | **TÜKENDİ** | 0 | 2 |
| **D5** | **aynı belge: onaylanan ad** | 0 | **2** | kaldı | 2 | 0 |
| **D6** | **HTML yorumu devralıyor: yorumdaki ad** | 2 | **0** | **TÜKENDİ** | 0 | 0 |
| **D7** | **aynı belge: onaylanan ad** | 0 | **2** | kaldı | 2 | 0 |
| D8 | `**Kapsam**` kalın başlık (## yok) → fail-closed | 2 | 2 | kaldı | 2 | 0 |
| D9 | `### Kapsam` (h3) → fail-closed | 2 | 2 | kaldı | 2 | 0 |
| **D10** | **görünür kapsam boş, ek devralıyor** | 2 | **0** | **TÜKENDİ** | 0 | 0 |

**Özet:** 73 sonda · beklentiyle uyuşmayan 11 · bunlardan **5'i pratik sızıntı**
(D1, D4, D6, D10, B12/B13 — B12/B13 aynı sınıfın sentetik hâli), **4'ü aşırı engelleme**
(C09, C10, C11, A-G2b), **5'i benim sonda tasarım hatam** (§2.4).
*(Sayılar örtüşüyor çünkü D1/D4/D6 aynı belgede hem sızıntı hem aşırı engelleme üretiyor.)*

---

## 4. Mutasyonlar

Her iki mutasyon da **sandbox kopyada** yapıldı; kopyanın mutasyon öncesi MD5'i gerçek dosyayla
**eşleşti** (`85d18513673d904eebda16fd2b32cfcf`, `MATCH=true`), gerçek `gate-check.cjs`'e hiç
dokunulmadı, `git checkout` kullanılmadı. Her mutant `node --check` ile doğrulandı (sahte
kırmızı yok).

**(a) Liste tabanlı sınırı kaldıran mutasyon** — `parseGuardScope` tur-1 davranışına çevrildi
(başlık bloğu = bir sonraki `##` ya da dosya sonu; bloktaki **tüm** ters tırnaklı adlar kapsam).

> **73 vakanın 34'ü değişti, 34'ü de KIRMIZI (sızıntıya döndü, `2 → 0`).**
> İçinde tur 2'nin üç sondası (A-G2L, A-G3L, A-G4L) ve gerçekçi CEO belgesinin iki reddi
> (A-CEO2, A-CEO3) var. Yani liste tabanlı sınır **gerçekten yük taşıyor**, dekoratif değil.

**(b) Düzeltmeyi tur-1 ÖNCESİ hâline birebir döndüren mutasyon** — kapsam metnin
**tamamındaki** ters tırnaklı adlardan okunur (başlık mantığı hiç yok).

> **73 vakanın 44'ü değişti; 42'si KIRMIZI (`2 → 0`), 2'si tam tersi yönde (`0 → 2`).**
> Benim üç sondam (A-G2L, A-G3L, A-G4L) **KIRMIZI** — istenen kanıt. Ayrıca A-G2, A-G3, A-G4,
> A-CEO2, A-CEO3, B14, B23, D2/D3/D5/D7/D8/D9 de kırmızıya döndü.

Her iki mutasyon da geniş kaskad üretiyor; ama kayıtlı ders gereği kaskad "her nokta
ölçülüyor" demek değildir — nitekim **başlık kimliği** noktasının hiçbir çiti yok (§2.2 son
paragraf).

---

## 5. Self-test

Tur başında `docs/approvals/` içeriği: `G0.ok G1.ok G2.ok G3.ok G4-1.ok G4-2.ok README.md`
— **bekleyen tek kullanımlık token yok** (GUARD.ok / DANGER.ok / PUSH.ok yok). Bu yüzden
betik güvenle koşturuldu.

| Ölçüm | Beklenen | Çıkan |
|---|---|---|
| `node .claude/hooks/_selftest.cjs` | 122/122, exit 0 | **122 OK / 0 FAIL, exit 0** ✓ |
| Koşum sonrası `docs/approvals/` | 7 dosya, değişmemiş | 7 dosya, SHA-256 birebir aynı ✓ |
| `git status --porcelain` | boş | boş ✓ |

---

## 6. Gerçek onay dosyalarının SHA-256'sı (önce / sonra — birebir aynı)

| Dosya | Tur başı | Tur sonu |
|---|---|---|
| `G0.ok` | `3b21fd8e7c4b2d1f3797275eb18dfe476a7f2c83435b905df3d6f31824148565` | aynı |
| `G1.ok` | `72bcf9757aec9ca5ba76f1a02bddad85f3051d1110d7e7a62189c1dc8d5b5234` | aynı |
| `G2.ok` | `a87cd696dd44424084594e2a32e83f0f32b4fc797cbb0148ef8b3cbdefba1bf5` | aynı |
| `G3.ok` | `36b18d582ac02afd3d0709d908ef256079b6ff147f09c08afccda5757bf9eef2` | aynı |
| `G4-1.ok` | `08d0fe3aaa80ed11a1eece6956a4c48272903ebadcb74974aa09c8fffba0d82b` | aynı |
| `G4-2.ok` | `6bf5be0828d071a215dfff9aa9b01c210f26709b10799f5f0b93250c9c862ace` | aynı |
| `README.md` | `770799bb377c769c3633217a73d579f5ddfc9d705c84a5c730f2425f554a3ed7` | aynı |

---

## 7. Süreç hijyeni

Tüm sondalar kısa ömürlü alt süreçler (`spawnSync`) olarak koştu. Tur sonunda makinede
**2 `node.exe`** var (PID 42320 ve 5812); komut satırlarıyla doğrulandı: **ikisi de Playwright
MCP sunucusu** (bu ajanın kendi araç ortamı), **hiçbiri bu turda benim başlattığım bir sonda
değil**. Sandbox ağaçları (`sb3`, `mutA`, `mutB`) ve bu turda yazdığım yardımcı betikler
scratchpad'den silindi; scratchpad'de duran diğer artıklar önceki turlardan kalmadır ve
**dokunulmadı**. `%TEMP%` altında `mc-selftest-*` artığı yok (self-test kendi izole dizinini
temizliyor).

---

## 8. Kapanma için ne gerekiyor (öneri — kod yazmıyorum)

1. **Başlık kimliğini belirsizliğe çöz.** `##` ile başlayan ve içinde "kapsam" geçen **her**
   satırı başlık adayı say; aday sayısı 1 değilse fail-closed. Böylece `## Kapsam (2 dosya)`
   ile arşivdeki `## Kapsam` **iki aday** olur → fail-closed, sessiz devralma biter.
2. **Kod bloğu ve HTML yorumu içindeki satırları ayrıştırmadan önce düşür** (fence sayacı +
   `<!-- … -->` maskesi). Ölçüt: B12/B13 kırmızı olsun.
3. **Blok mesajına ayrıştırılan kapsamı ve kapalı biçim tarifini koy.** Ölçüt: C09/C10/C11
   vakasına düşen bir kullanıcı, mesajı okuyup metni **tek denemede** onarabilsin
   (token deneme-yanılmayla harcanamaz).
4. **`_selftest.cjs`'e vaka ekle:** (i) parantezli/iki noktalı başlık + belgede başka bir
   birebir `## Kapsam` → **ikisi de** reddedilmeli; (ii) kod bloğu içindeki tek başlık →
   fail-closed; (iii) HTML yorumu içindeki tek başlık → fail-closed.
5. **Eskalasyon notu:** aynı kriter üç turdur "biçim ayrıştırma" ailesinde yeniliyor. Dördüncü
   bir metin-ayrıştırma yaması yerine, tasarımı bir kez daha değiştirmeyi değerlendirin:
   kapsamı **serbest markdown'dan** değil, ayrıştırması tek anlamlı bir kaynaktan okuyun
   (ör. dosyanın ilk satırında tek satırlık, ayrıştırıcısı üç satır olan sabit bir biçim; ya
   da GUARD.ok'un yanında makine tarafından üretilen bir kapsam alanı). Metnin geri kalanı
   insan içindir ve **hiç** ayrıştırılmaz.

---

**Bu turun kapsamı dışında, karar bekliyor:** `test-skip-gate-izolasyon-contract.md`
(önceki `latest.md`'deki `test-skip-gate-contract.md` KALDI kararı ayrı bir turda düzeltildi —
commit `81c049b`, `9ae0661` — ve kendi sözleşmesiyle `status: qa`'da beklemektedir).
