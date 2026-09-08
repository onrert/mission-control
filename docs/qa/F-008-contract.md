---
feature: F-008
title: Kapılar paneli — G0-G6/ASSETS onay, red, arşiv akışı
author: developer
status: draft
date: 2026-09-09
---

# F-008 Sözleşmesi — Kapılar paneli (tur 3 — dar kapsamlı düzeltme)

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").
Bu turda da `src/`, `tests/`, `package.json` altında **hiçbir dosya değiştirilmedi**; yalnızca bu
belge düzeltildi. `git status --porcelain` bunu doğrular.

**Bu tur, `docs/qa/F-008-contract-review-1.md`'nin (KALDI, 6 bloklayıcı + 11 önemli + 4 not) ve
CEO'nun bu bulgular üzerine verdiği kararların (N1-N7) gövdeye yayılmasıdır.** Onaylanmış bölümler
(L4'ün cevabı, statik çit kapsamı, `x-mc-write`, hata sınırı deseni, `@source` çiti, AC1-AC9
haritasının temeli) **yeniden açılmadı**; yalnızca QA'nın işaret ettiği 21 bulgu ve bunların ürettiği
regresyonlar düzeltildi.

**Tur 3 — dar kapsamlı ek düzeltme (`docs/qa/F-008-contract-review-2.md`, KALDI: 2 bloklayıcı + 1
önemli, tur 2'nin 21 bulgusunun 20'si zaten kapanmıştı, bunlar yeniden açılmadı):**
- **Y1 (B5 kalıntısı, bloklayıcı):** dördüncü sekme (Kapılar) mevcut sabit sekme-sayacı çitlerini
  kıran dört iddia daha vardı, biri (`tests/web/App.chat-tab.test.tsx`) sözleşmede hiç geçmiyordu.
  §10.2'ye dördü de görev kalemi olarak eklendi, yeni değerleri yazıldı (aşağıda).
- **Y2 (M6 ters, bloklayıcı):** §11 M6'nın mutasyon iddiası yönü §6'nın yarı-başarı sırasıyla
  çelişiyordu (doğru kodda kırmızı, mutantta yeşil verirdi). M6 §6 ile tutarlı hâle getirildi.
- **Y3 (Ö4 kalıntısı, önemli):** `includeMtime` yeteneğini ölçen mutasyon yoktu (F-013'ün aynı
  sınıf boşluğu). §11'e M11 eklendi.
- M9 (broadcast mutasyonu) hangi test dosyasının kırılacağı netleştirildi; M10 mutasyon listesinde
  kalıyor ama "kod mutasyonu değil, SDK regresyon ölçümü" olduğu daha açık yazıldı.

**Neden sözleşme turu zorunlu:** bu feature panele "kullanıcı adına kapı onaylama" yetkisi
veriyor (G0 kararı: "panelden verilen kapı onayı kullanıcının onayı sayılır") — güvenlik sınırını
değiştiren bir feature, `CLAUDE.md` kuralı gereği sözleşme turu atlanamaz.

Okunan/yeniden doğrulanan kaynaklar (tur 2): `docs/qa/F-008-contract-review-1.md` (tam metin),
`docs/qa/F-008-write-izin-olcumu.md` (tam metin, canlı ölçüm), `docs/decisions/ADR-014-*.md` (Ek
bölümü, 2026-09-09), `docs/decisions/ADR-001-*.md` (karar 7), `docs/decisions/ADR-005-*.md`
(madde 9), `docs/decisions/ADR-004-*.md` (madde 5), `docs/01-prd.md` (AC4/AC6/AC9, satır 73/75/78),
`docs/03-ux.md` (ekran 4, satır 188-209, 454-467, 507-518, 730-736, 800-805), `docs/PROCESS.md`
§2 (tam tablo), `src/features/projects/server/service.ts` (tam dosya — izleyici yaşam döngüsü),
`src/web/lib/useEventStream.ts:82-94` (`onFeatures` sapma deseni), `tests/helpers/manifest.ts`
(tam dosya), `tests/integration/chat-hooks-live.test.ts` (canlı test deseni + `package.json:30`
`test:chat-live` betiği). Tur 1'de okunan geri kalan kaynaklar (§ dip not) geçerliliğini korur.

---

## 1. Kapsam

**İçinde:**
1. `GET /api/gates?project_id=…` — seçili projenin kapı durum listesi.
2. `POST /api/gates/:project_id/:gate/approve` — iki adımlı onay, ikinci adımda diske yazar.
3. `POST /api/gates/:project_id/:gate/deny` — zorunlu gerekçeli red; **onaylı bir kapı için
   reddedilir** (bkz. §4 "Aksiyon durum makinesi", B6 düzeltmesi).
4. Kapılar ekranı: proje seçici (tek, zorunlu dropdown), kapı tablosu, onay modalı, satır içi red
   formu, çelişkili durum satırı (`[Detay]` — salt okunur genişleyen alt satır), aksiyon durum
   makinesi (dört durum → dört farklı buton kümesi), yerel toast bileşeni, canlı güncelleme
   (mevcut SSE hub'ına yeni `gates` kanalı).
5. `archiveDenial`'ın (F-006, mevcut) ilk kez bir HTTP akışına bağlanması — G4-1.ok'ta CEO'ya
   devredilmiş taahhüt (bkz. §5 "L4").
6. **L5'in (barındırılan CEO oturumu self-approval riski) canlı ölçümle kapatılmış olduğunun
   otomatik bir regresyon testine dönüştürülmesi** (bkz. §8, §11 mutasyon M10). Mekanizma zaten
   var (SDK'nın kendi `canUseTool` davranışı); bu sözleşme yeni bir hook/kod **eklemiyor**, yalnızca
   ölçümü tekrarlanabilir hale getiriyor.

**Kapsam DIŞI (bilinçli):**
- Kapı **oluşturma**/silme — yalnızca G0-G6/ASSETS ve bunların bilinen soneki (`G4-1` gibi)
  üzerinden **var olan** onay/red akışı. Yeni bir kapı türü tanımlamak PROCESS.md değişikliğidir.
- Thread (F-009), Token (F-010/F-011).
- `docs/PROCESS.md`'nin kendisini düzenleme.
- `write-gate.ts`'e yeni bir niyet fonksiyonu eklemek — dört mevcut fonksiyon (`writeGateApproval`,
  `writeGateDenial`, `archiveDenial`, dolaylı olarak `setFeatureStatus`) yeterli, ✓ VERIFIED.
- **`.claude/hooks/**` değişikliği YOK.** CEO kararı N2: M1'in önerdiği ek hook kuralı **iptal
  edildi** — canlı ölçüm (§8) korumanın zaten var olduğunu gösterdiği için gereksiz karmaşıklık
  (Karpathy §2) sayıldı. `.claude/hooks/**` bu feature'ın dosya sahipliğine hiçbir biçimde girmiyor.
- Çelişkili (`conflict`) durumun panelden **çözülmesi** — UX'te bu duruma yalnızca `[Detay]`
  (salt okunur) atanmış; çözüm (dosyalardan birini elle silmek/taşımak) panelin dışında kalır. Bu,
  F-008'in eklediği bir kısıt değil, `docs/03-ux.md:207`'nin zaten çizdiği sınır (bkz. §4).

---

## 2. CEO kararlarının gövdeye yayılması — harita

### Tur 1 kararları (L1-L8)

| Karar | Nerede uygulanıyor |
|---|---|
| L1 (sabit liste değil) | §3 "Durum türetme" |
| L2 (iki adım, iptal hiçbir şey yazmaz) | §4 uçlar + §11 mutasyon M1 |
| L3 (yeni yazma yolu yok) | §10.1/§10.2 dosya listesi + §11 mutasyon M4 |
| L4 (`archiveDenial` senkron mu) | §5 (cevap: **evet, tamamen senkron**) |
| L5 (barındırılan oturum self-approval) | §8 (canlı ölçümle kapatıldı) |
| L6 (çelişki otomatik çözülmez) | §3 + §11 mutasyon M4 |
| L7 (red gerekçesi zorunlu) | §4 + §11 mutasyon M5 |
| L8 (Türkçe metin önce UX'e) | §9 "Türkçe metinler" |

### Tur 2 kararları (N1-N7, `docs/qa/F-008-contract-review-1.md`'ye yanıt)

| Karar | Nerede uygulanıyor |
|---|---|
| N1 (B1 kapandı — `Write` her koşulda karta düşüyor, ölçüldü) | §8 tamamen yeniden yazıldı |
| N2 (M1 hook iptal) | §1 "Kapsam DIŞI", §8 son paragraf, §11 mutasyon M10 |
| N3 (B4+B5 — E2E katmanı + sekme sayacı çitleri) | §10.2 (config + 3 test dosyası), §11 test planı |
| N4 (B6 — aksiyon durum makinesi UX'e uydurulur) | §4 "Aksiyon durum makinesi" |
| N5 (B2+B3 — önceki kararlar gövdeye yayılmamıştı) | bu belgenin tamamı (M1 kaldırıldı, M2 §9'da somutlaştı) |
| N6 (ASSETS regex, `docs/approvals/` sınıflandırması, `mtime`) | §3, §10.2 (`tests/helpers/manifest.ts`) |
| N7 (mutasyon listesi totolojisiz + L5 ölçümü otomatikleşsin) | §11 |

---

## 3. Durum türetme (madde 1)

**Kaynak ikili:** hem `docs/approvals/` dizin içeriği hem `docs/PROCESS.md` §2'nin kapı tablosu.

**"Her zaman gösterilen" temel katalog** (`BASE_CATALOG`) — 7 giriş: `G0, G1, G2, G3, ASSETS, G5,
G6`. `G4` **bilerek dışarıda bırakıldı**: PROCESS.md §2'nin kendisi (`docs/PROCESS.md` §2, `G4
Kilometre taşı` satırı) G4'ü `approvals/G4-<n>.ok` biçiminde, yalnızca sonek ile tanımlıyor — bare
`G4` diye bir dosya adı sözleşmesi projede hiç yok (`G4-1.ok` tek örnek, ✓ VERIFIED
`docs/approvals/G4-1.ok`). Bu yüzden G4 satırı yalnızca **dosya varsa** görünür, sabit bir
"G4 bekliyor" satırı **uydurulmaz**.

**Sıralama** (Ö1 düzeltmesi) — `docs/03-ux.md:192`'ye göre **sabit**: `G0, G1, G2, G3, ASSETS,
G4-N (varsa, sayısal artan sırayla), G5, G6` (✓ VERIFIED, mockup birebir bu sırayı çiziyor,
`docs/03-ux.md:198-208`). Birden çok kilometre taşı varsa (`G4-1`, `G4-2`, `G4-10`) **sayısal**
sıralama kullanılır (dizge sıralaması değil — `G4-10` `G4-2`'den sonra gelir); bu, G4 sonek
numarasını `parseInt` ile karşılaştıran bir `sort` ile sağlanır. `BASE_CATALOG`'un ASSETS ile G5
arasındaki boşluğa G4 grubu **dinamik olarak** eklenir.

**Etiket türetme** (Ö1 düzeltmesi — gerçek `PROCESS.md`'ye göre) — `docs/PROCESS.md` §2 bir
markdown tablosudur; satırlar önce `|` ile hücrelere bölünür (mevcut markdown-tablo ayrıştırma
yaklaşımıyla aynı — hücre sınırları `|`, ilk/son boş hücreler atılır). İlk hücre (`G0 Fikir`,
`G4 Kilometre taşı`, ama **`ASSETS`** — tek kelime, boşluk yok, ✓ VERIFIED `docs/PROCESS.md` §2
ASSETS satırının ilk hücresi tam olarak `ASSETS`) üzerinde `^(\S+)(?:\s+(.+))?$` çalıştırılır: ilk
grup `id`, ikinci grup (varsa) `label`. Grup 2 yoksa (ASSETS gibi tek-kelimelik hücreler) `label =
id`. Eski `^(\S+)\s+(.+)$` deseni (tur 1'in hatası) ASSETS'i **atlıyordu** çünkü zorunlu boşluk +
grup istiyordu; yeni desen geriye dönük uyumlu (diğer yedi satırda davranış değişmiyor) ve ASSETS'i
de kapsıyor. `id`, `BASE_CATALOG ∪ {"G4"}` kümesiyle eşleşmeyen satırlar (ör. "1. Persona
Assignment" tablosu — farklı bir bölüm) atlanır.

PROCESS.md okunamaz/tablo bulunamazsa: `process_doc_readable: false` döner, `BASE_CATALOG` küçük
bir **gömülü yedek etiket tablosuyla** (7 satır — `G0 Fikir, G1 PRD, G2 Mimari, G3 UX, ASSETS
Higgsfield kredi bütçesi, G5 Güvenlik/kalite, G6 Yayın`, `docs/PROCESS.md` §2'nin **G4 hariç**
diğer yedi satırıyla birebir) gösterilir — panel asla çökmez, yalnızca etiketler proje-özel
olmayabilir. (Tur 1'in "7 satır, PROCESS.md'nin tamamıyla birebir" iddiası yanlıştı — gerçek tablo
8 satır, G4 kasıtlı olarak dışarıda; bu düzeltildi.)

**Dosya taraması** (`docs/approvals/`, yalnızca üst düzey — `archive/` alt dizini **okunmaz**, o
yalnızca yazma tarafında hedef, listede görünmez):
- `^(G[0-6](-\d{1,3})?|ASSETS)\.ok$` veya `…\.deny\.md$` ile eşleşen her dosya bir "kapı" olarak
  ele alınır (id = eşleşen grup). `BASE_CATALOG ∪ {"G4"}`'te yoksa (ör. `G4-1`, `G4-2`) yine de
  kendi satırı olarak gösterilir — label yoksa id'nin kendisi kullanılır.
- Bu desene **hiç uymayan** bir dosya/dizin sessizce atlanmaz, ama **açık bir hariç tutma kümesi**
  (Ö2 düzeltmesi) tanınmayan listesine düşmeden önce filtrelenir. Gerçek `docs/approvals/` içeriği
  ölçüldü (✓ VERIFIED, QA raporu + `docs/approvals/README.md` + `.claude/hooks/block-dangerous.cjs:
  43-46`): `README.md` (belge, kapı değil), `archive/` (dizin, yazma hedefi), `DANGER.ok`/`PUSH.ok`
  (`block-dangerous.cjs`'in tek kullanımlık, kendi tükettiği onay dosyaları — kapı onayı **değil**),
  `.gitkeep`, `.`ile başlayan/`.tmp` ile biten her şey (write-gate.ts'in **kendi** atomik yazma
  geçici dosyası, `write-gate.ts:144-148` ile aynı dizinde açılıyor, ✓ VERIFIED). Bu altı sınıf
  `unrecognized` listesine **hiç girmez** (kod: sabit bir `EXCLUDED` regex/liste, dizin girdileri
  `isDirectory()` ile ayrıca elenir). Geri kalan, desene uymayan her şey (`g2.ok` yanlış yazım gibi)
  `unrecognized: string[]`'e ham dosya adıyla eklenir ve ekranda "Tanınmayan dosyalar" notu olarak
  gösterilir (L1 "sessiz kalma yok" — ama artık panelin **kendi** geçici/altyapı dosyalarını kendi
  kendine "tanınmayan" diye raporlamıyor).
- İzleyicide (`gates-watcher.ts`, §7) **aynı** hariç tutma kümesi uygulanır — aksi hâlde her onay
  kendi `.tmp` dosyası yüzünden 2-3 kez SSE yayını yapar (Ö2).

**Tek bir kapı için durum:**
| `.ok` var mı | `.deny.md` var mı | `status` |
|---|---|---|
| hayır | hayır | `pending` |
| evet | hayır | `approved` |
| hayır | evet | `denied` |
| evet | evet | `conflict` |

`conflict` durumunda `newer_side: 'ok' | 'deny'` — **karşılaştırma `fs.statSync(...).mtimeMs`
ile** yapılır (dosya İÇERİĞİNDEKİ "Tarih:" satırı **parse edilmez** — hem CEO'nun hem panelin
yazdığı içerik serbest metin/markdown, düzenli ayrıştırma güvenilir değil; `mtime` zaten dosya
sisteminin kendi, ücretsiz, tartışmasız kaynağı — PRD AC4 zaten "değiştirilme zamanı" diyor, ✓
VERIFIED `docs/01-prd.md:73`). Aynı sebeple tablodaki "Tarih" sütunu da `mtime`'dan `YYYY-MM-DD`'ye
biçimlenir. **Kenar durum (N2, tur 1'in notu, korunuyor):** `git clone`/`checkout` sonrası `mtime`
içerikteki tarihten farklı olabilir; UX metnine bir cümlelik açıklama eklenmesi §9'a taşındı.

**Satır bazlı hata izolasyonu** (B3 sorun 3 düzeltmesi) — tek bir dosyanın `fs.statSync`'i
başarısız olursa (ör. izin hatası, yarış durumunda dosya silinmiş) yalnızca o kapının satırı gri
"Durum belirlenemedi" gösterir (metin `docs/03-ux.md:516` ile **birebir**, ✓ VERIFIED); ekranın
geri kalanı (diğer kapılar, proje seçici) normal çalışmaya devam eder. `list-gates.ts` bu satırı
`status: undefined`/ayrı bir `error: true` alanıyla işaretler, tüm listeyi patlatmaz.

Hiçbir dosya **otomatik silinmez/taşınmaz** — `list-gates` salt okunur, `fs` yazma/silme çağrısı
içermez (bu iddia `tests/no-write-gate-bypass.test.ts`'in statik taramasıyla **ve** ayrı bir
dinamik manifest-diff testiyle çitlenir, §11 mutasyon M4).

---

## 4. Uçlar (madde 2)

Tümü `ApiResponse<T>` deseninde (`src/shared/types.ts`, mevcut). Yeni tipler eklenir:
```ts
export type GateStatus = 'pending' | 'approved' | 'denied' | 'conflict'
export interface GateStatusItem {
  id: string            // "G2", "ASSETS", "G4-1"
  label: string
  status: GateStatus
  error?: boolean        // stat başarısız oldu, "Durum belirlenemedi" (§3)
  ok_date?: string       // "YYYY-MM-DD", mtime kaynaklı
  deny_date?: string
  newer_side?: 'ok' | 'deny'   // yalnızca status === 'conflict'
}
export interface GatesListResponse {
  gates: GateStatusItem[]
  unrecognized: string[]
  process_doc_readable: boolean
}
```
Yeni bir `ErrorCode` **gerekmiyor** — mevcut `invalid_body`, `not_found`, `write_denied`,
`write_failed`, `conflict` yeterli (✓ VERIFIED, `src/shared/types.ts:37-52` — `conflict` zaten
kanban'ın 409 dalında kullanılan mevcut bir kod, B6 düzeltmesi için yeni kod eklemiyoruz).

### `GET /api/gates?project_id=<id>`
- `project_id` yoksa/boşsa → 400 `invalid_body` (Kanban'ın aksine Kapılar **her zaman tek
  proje** ister, UX §"Proje kapsamı" tablosu; boş bırakmak "tüm projeler" anlamına gelmez).
- Proje kayıtlı değilse → 404 `not_found`.
- Aksi halde 200, `ApiResponse<GatesListResponse>`.
- `x-mc-write` **gerekmiyor** (GET, dağıtıcı zaten yalnızca non-GET'i zorluyor).

### Aksiyon durum makinesi (B6 düzeltmesi — `docs/03-ux.md:196-206`'dan birebir)

`GateRow.tsx` dört durumun her birinde **farklı** butonlar çizer; sunucu da aynı kuralı çitler
(salt istemci tarafı kontrolü yeterli değil, aksi hâlde `curl` ile UI atlanabilir):

| `status` | Görünen aksiyon | Sunucu izin veriyor mu |
|---|---|---|
| `pending` | `[Onayla]` `[Reddet]` | approve ve deny ikisi de |
| `approved` | **`(kilitli)`, hiçbir buton yok** | `deny` çağrılırsa → **409 `conflict`, dosya yazılmaz** (yeni kural, aşağıda); `approve` (yeniden onay) UI'dan erişilemez ama API düzeyinde engellenmiyor (bkz. gerekçe) |
| `denied` | `[Onayla]` (yalnızca) | approve (AC9 arşiv→onay akışı) |
| `conflict` | `[Detay]` (salt okunur, genişleyen alt satır) | approve/deny UI'dan erişilemez; API düzeyinde de **hiçbir yeni davranış eklenmiyor** — bu durumdan çıkışın tek yolu manuel dosya müdahalesi, UX kapsamı bunu tanımlamıyor (§1 "Kapsam DIŞI") |

**Neden `deny` onaylı bir kapıda 409 döner:** `docs/03-ux.md:200-202`'nin mockup'ı onaylı satırda
`Reddet` butonunu **hiç göstermiyor** (yalnızca `(kilitli)`), `ADR-001` karar 7 ve PRD AC9
("çelişkili durum kendiliğinden oluşmaz") bunu destekliyor — panelin kendi eylemiyle bir `conflict`
üretmesi istenmiyor. `handleDenyGate` bu yüzden yazmadan önce **taze** bir `.ok` kontrolü yapar;
varsa `success:false, error:{code:'conflict', message:'Bu kapı zaten onaylı, reddedilemez.'},
data:<taze GateStatusItem>` döner (kanban'ın `conflict` dalıyla aynı desen).

**Neden `approve` (yeniden onay) API düzeyinde engellenmiyor:** `ADR-005` madde 9 (✓ VERIFIED,
tam metin) — "Panel **hiçbir zaman** bir onay dosyasını kendiliğinden silmez veya üzerine
yazmaz — **mevcut bir `.ok` üzerine yeniden onay yazmak açık bir kullanıcı eylemidir** ve yine
doğrulama adımından geçer." Bu, `deny`'nin aksine, ADR tarafından **açıkça meşru** sayılmış bir
eylem. UI onaylı satırda `Onayla` butonunu göstermediği için bu yol **bugün** panelden hiç
tetiklenemez (kilitli satırda tıklanacak bir şey yok) — çelişki değil, kullanılmayan bir kapasite:
mekanizma (write-gate.ts'in `renameSync`'i zaten üzerine yazabiliyor) ADR'nin izin verdiği gibi
durur, ama F-008 bunu UI'dan **açmıyor**. İleride bir "yeniden onayla" özelliği istenirse bu, ayrı
bir karar/feature olur.

**`[Detay]` görünümü (B6 sorun 2 düzeltmesi, önceden hiç tanımlı değildi):** ayrı bir modal
**değil** — satıra tıklanınca satırın altında genişleyen, salt okunur bir alt satır: proje adı,
kapı adı, `.ok` tarihi, `.deny.md` tarihi, hangisinin daha yeni olduğu vurgulu (`newer_side`), ve
sabit not: *"Bu durum panelden düzeltilemez; dosyaları `docs/approvals/` altında elle inceleyin."*
(metin §9'da). Ekstra bir bileşen/route gerekmiyor — `GateRow.tsx` kendi state'inde
`expanded: boolean` tutar (Karpathy §2 — ayrı modal bileşeni bu kadar küçük bir içerik için
gereksiz soyutlama olurdu).

### `POST /api/gates/:project_id/:gate/approve`
Gövde: `{ confirmed: true, decision: string }`.
- `x-mc-write` zorunlu (dağıtıcı, ADR-013, otomatik — bu uç için ek kod **gerekmiyor**, mevcut
  genel kural zaten kapsıyor, ✓ VERIFIED `src/server/index.ts:363`).
- `confirmed !== true` → 400 `invalid_body` (istemci hiçbir zaman `false` göndermemeli, ama
  sunucu istemciye güvenmez — L2'nin sunucu tarafı çiti).
- `decision` boş/yalnızca boşluk veya >4000 karakter → 400 `invalid_body`.
- `gate` yerel ön-doğrulama deseniyle (`/^(G[0-6](-\d{1,3})?|ASSETS)$/`, write-gate.ts'in
  `GATE_PATTERN`'iyle **aynı metin**, ayrı kopya — gerçek güvenlik sınırı write-gate.ts'in
  kendisidir, bu yalnızca daha iyi bir 400 mesajı içindir) eşleşmezse → 400 `invalid_body`.
- Proje yoksa → 404 `not_found`.
- Akış (tek async IIFE, tam `try/catch` — kanban `handlePatchFeatureStatus` deseni **birebir**):
  1. Disk üzerinde **taze** `.deny.md` var mı kontrol edilir (istemcinin önbelleklediği duruma
     güvenilmez).
  2. Varsa `archiveDenial(project.path, gate)` çağrılır (senkron, §5). Başarısızsa (`ok:false`) →
     500 `write_failed`, **`writeGateApproval` hiç çağrılmaz** (yarı-başarıyı önlemek için, AC9
     sırası — bu sıra §11 mutasyon M6 ile çitlenir).
  3. `writeGateApproval(project.path, gate, buildApprovalBody(...))` çağrılır (asenkron).
  4. Başarılı → taze `GateStatusItem` yeniden hesaplanır (dosyaları tekrar `stat`leyerek), 200.
  5. Başarısız (adım 2 zaten arşivlemişse) → **yarı-başarı** (bkz. §6), 500 `write_failed`,
     gövdede `data: <taze GateStatusItem>` de döner (kanban'ın `conflict` dalıyla aynı desen) ki
     istemci gerçek durumu (muhtemelen `pending`) hemen görsün.
  6. Beklenmeyen `throw` → dış `catch`, 500 `write_failed`, ham hata istemciye sızmaz.

### `POST /api/gates/:project_id/:gate/deny`
Gövde: `{ reason: string }`. Ayrı bir doğrulama adımı **yok** (UX akış e, madde 1-4).
- `reason` boş/yalnızca boşluk veya >4000 karakter → 400 `invalid_body`, dosya yazılmaz.
- **Taze bir `.ok` varsa** → 409 `conflict`, dosya yazılmaz (yukarıdaki "Aksiyon durum makinesi").
  Bu, tur 1'in "engellenmez, bilerek conflict üretir" kararının **tersidir** — B6 düzeltmesi,
  UX+ADR-001+PRD AC9 üçlüsü kazandı (N4).
- Aksi halde `writeGateDenial(project.path, gate, buildDenialBody(...))` — başarı/başarısızlık
  kodları approve ile aynı desende.

---

## 5. `.ok`/`.deny.md` içerik formatı (madde 3) — ve L4'ün cevabı

*(Bu bölüm tur 1'de onaylandı, değişmedi.)*

**L4 — `archiveDenial` senkron bekleme içeriyor mu?** **Hayır, hiç içermiyor.** ✓ VERIFIED
(`src/server/write-gate.ts:342-372`): imza `export function archiveDenial(...): WriteResult`
— `Promise` **değil**. Gövde yalnızca `fs.existsSync`, `fs.mkdirSync`, `fs.renameSync` çağırıyor;
`atomicWrite`/`delay()`/`Atomics.wait` **hiçbiri kullanılmıyor**. Sonuç: bu fonksiyonu bir HTTP
handler'a bağlamak **bloklayıcı değil** — senkron `fs` çağrıları zaten kanban'ın `rereadCard`'ında
da aynı async IIFE içinde kullanılan, precedent'i olan bir desen. G4-1.ok'un devrettiği taahhüt
burada **kapanır**.

**`.ok` biçimi** — `docs/PROCESS.md` §2 ("tarih + onaylanan özet + kullanıcının kararı") ile
birebir, mevcut `.ok` örnekleriyle aynı düz-metin üslup (bkz. `docs/approvals/G2.ok`):

```
G2 — Mimari kapısı ONAYLANDI
Tarih: 2026-09-09
Onaylayan: Panel kullanıcısı (Kapılar ekranı, iki adımlı onay)

Onaylanan özet: Panel Kapılar ekranından "G2 — Mimari" kapısı onaylandı (proje: mission-control).

Kullanıcının kararı: <kullanıcının yazdığı serbest metin, olduğu gibi>
```

Saf fonksiyon: `buildApprovalBody(gateId, label, projectLabel, isoDate, decision): string`
(`src/features/gates/shared/format-approval.ts`, `fs` importu **yok** — hem sunucu hem istemci
tarafından import edilebilir, böylece adım-1 modalındaki önizleme ile adım-2'de gerçekten
yazılan içerik **bayt bayt aynı** olur; ayrı bir `POST …/preview` ucu **gerekmiyor**, Karpathy §2).

**`.deny.md` biçimi** (yeni — önceden hiç örnek yok, `write-gate.ts`'in kendi regex'i `.deny.md`
uzantısını zaten bekliyor, markdown üslubu seçildi):

```markdown
# G2 — Mimari kapısı REDDEDİLDİ

- **Tarih:** 2026-09-09
- **Reddeden:** Panel kullanıcısı (Kapılar ekranı)
- **Proje:** mission-control

## Red gerekçesi

<kullanıcının yazdığı gerekçe, olduğu gibi>
```

Saf fonksiyon: `buildDenialBody(gateId, label, projectLabel, isoDate, reason): string` (aynı
dosya). İkisi de **YAML round-trip içermez** — bu dosyalar frontmatter değil, kimse onları makine
olarak geri ayrıştırmıyor (§3'ün "durum" kararı `mtime`'a dayanıyor, içerik metnine değil).

---

## 6. Arşivleme akışı + hata semantiği (madde 4-5)

**Sıra (L2/AC9):** deny varsa önce `archiveDenial`, SONRA `writeGateApproval`. Asla ters sıra
(onay yazılıp sonra arşivleme başarısız olursa iki dosya kalıcı olarak çelişir). Bu yüzden sıra
**arşiv → onay**, adım 2 başarısızsa adım 3 hiç denenmez (§4). Bu sıranın ters çevrilmesi **ayrı
bir mutasyonla** çitlenir (§11 mutasyon M6) — tur 1'de bu sıra yalnızca anlatılıyordu, ölçülmüyordu.

**Yarı-başarı (F-007'nin dersi — dürüstçe raporlanır, sessizce "başarılı" denmez):** arşivleme
başarılı, `writeGateApproval` başarısız olursa disk durumu şudur: `.deny.md` artık
`docs/approvals/archive/`'de, `.ok` **yok**. Kapı şu an **`pending`**. Yanıt gövdesi (Ö9
düzeltmesi — **gerçek arşiv yolu** metne gömülür, `archiveDenial`'ın döndürdüğü
`{ok:true, path: archiveResolved.targetPath}` değeri kullanılır, ✓ VERIFIED
`write-gate.ts:371`):

```
success:false
error: { code:'write_failed', message:'Red kaydı docs/approvals/archive/G2-2026-09-09-14-32.deny.md
  altına taşındı ama onay yazılamadı; kapı şu an "Bekliyor" durumunda. Tekrar deneyin.' }
data: <taze GateStatusItem, status:'pending'>
```

**Yeniden deneme güvenli/idempotenttir:** ikinci denemede adım 1'in taze kontrolü artık
`.deny.md` bulamaz (arşivlendi), adım 2 (`archiveDenial`) hedef yoksa `{ok:true, path:''}`
no-op döner (✓ VERIFIED `write-gate.ts:351-353`) — bu, kullanıcının "Tekrar deneyin" butonuna
güvenle basabileceği anlamına gelir, ikinci arşivleme denemesi hataya düşmez.

**Genel hata semantiği (AC5):**
- Yazma hatasında buton durumu geri alınır: onay modalı **kapanmaz**, hata satır içi gösterilir,
  "Onayı Yaz" tekrar tıklanabilir hale döner (kullanıcının yazdığı karar metni **kaybolmaz**).
  Red formunda aynı: gerekçe metni korunur, buton tekrar aktif.
- Asenkron handler'ın **kendisi** kendi `try/catch`'ini taşır (dış `withDispatchErrorBoundary`
  yalnızca senkron dağıtım hatalarını yakalar, `src/server/index.ts:161-188` — F-007'nin
  `handlePatchFeatureStatus`'unun aynı gerekçeyle sardığı IIFE deseni burada da birebir
  tekrarlanır, §4).
- Panel çökmez: `GatesScreen` mevcut `ScreenErrorBoundary` deseninin içine yerleşir (App.tsx'in
  diğer tabpanel'leri gibi).

---

## 7. Canlı güncelleme (madde 6)

Mevcut SSE hub'ı (`createSseHub`, tek bağlantı — ADR-004 madde 1) **yeniden kullanılır**:
- Panelin **kendi** yazması (approve/deny sonrası) → handler başarı yolunda
  `hub.broadcast('gates', { project_id })` çağırır. **Payload yalnızca `{project_id}` taşır** —
  bu, ADR-004 madde 5'in metniyle ("her mesaj kartların tam listesini taşır") birebir uyuşmuyor,
  ama F-008'in **icat ettiği** bir sapma değil: `features` kanalı bugün zaten aynı şeyi yapıyor
  (✓ VERIFIED `src/features/projects/server/service.ts:99` — `hub.broadcast('features',
  {project_id: record.id})`) ve bu, `useEventStream.ts:88-93`'te **zaten dokümante edilmiş**
  bilinçli bir sapma ("mimari §6.1'den bilinçli sapma… kartların kendisi `GET` ile ayrıca
  çekilir"). `gates` kanalı `onFeatures` ile **birebir aynı** deseni tekrarlıyor — yeni bir sapma
  değil, mevcut bir emsalin tekrarı. ADR-004 madde 5'in metninin kendisi güncellenmemiş kalıyor
  (F-007'den beri var olan, F-008'e ait olmayan bir borç); bu, F-008'in "bitti" tanımının parçası
  değil.
- **Dışarıdan** değişiklik (CEO'nun kendi Bash/Write'ı, elle düzenleme) → `docs/approvals/`
  bugün **hiç izlenmiyor** (✓ VERIFIED, `src/features/projects/server/service.ts:93-103` yalnızca
  `docs/features`'ı izliyor). Bunun için `src/features/gates/server/gates-watcher.ts` adında
  **yeni, küçük bir dosya** eklenir — `project-watcher.ts`'in **kopyası değil**, o dosyaya
  dokunulmuyor (dosya sahipliği sınırı) ama aynı `chokidar` kurulumunu (depth:0, ignoreInitial,
  `awaitWriteFinish`, 150ms debounce — `createDebouncer` zaten paylaşılan bir yardımcı,
  `src/server/watch/debounce.ts`, o da değişmiyor, yalnızca import edilir) tekrarlar. **Fark:**
  `project-watcher.ts` yalnızca `.md` uzantılı değişiklikleri debounce'a sokuyor; gates izleyicisi
  bu yüzden **filtresiz** ama §3'teki hariç tutma kümesini (Ö2) uygular — `docs/approvals/`
  içindeki (yalnızca üst düzey, `depth:0`) tanınan bir değişiklik veya tanınmayan-ama-hariç-
  tutulmayan bir dosya değişikliği tetikler; kendi `.tmp` dosyaları ve `README.md`/`archive/`
  değişiklikleri tetiklemez.

**İzleyici yaşam döngüsü (Ö3 düzeltmesi — önceden tanımsızdı):** `startWatchingIfPossible`
deseninin `docs/approvals` için bir eşleniği `service.ts`'e eklenir (✓ VERIFIED, gerçek desen
`src/features/projects/server/service.ts:93-108`, `startWatchingIfPossible`/açılış döngüsü/
`watchers: Map`). `service.ts` §10.2'ye (mekanik değişiklik listesi) eklenir — dosya sahipliği
ihlali değil, F-005/F-007'nin de aynı dosyaya dokunma emsali (§10.2 girişi):
- Yeni bir `gatesWatchers: Map<string, GatesWatcher>` (mevcut `watchers` map'inden **ayrı** —
  farklı bir kaynak dizinini izliyor, karıştırmamak için ayrı isim).
- `startWatchingGatesIfPossible(record)`: `docs/approvals` dizini yoksa hiç başlatmaz (yeni proje
  senaryosu — dizin sonradan oluşursa şu an için yeniden taranmaz, bu F-008'in bilinen bir sınırı,
  §12 açık soru değil çünkü kullanıcı etkisi düşük: proje eklenip `docs/approvals` sonradan
  oluşturulması nadir bir sıra).
- Proje silinince (`removeProject`) `gatesWatchers.get(id)?.stop()` çağrılır, tıpkı mevcut
  `watchers` için yapıldığı gibi.
- `getActiveWatcherCount()` her iki map'in toplamını döner (`/api/health`'in `watchers` alanı,
  ✓ VERIFIED `src/server/index.ts:373`) — sağlık uç noktası tek bir toplam sayı bekliyor, ayrım
  gerekmiyor.

- `src/web/lib/useEventStream.ts`'e `onGates?: (signal: {project_id:string}) => void` eklenir
  (`onFeatures` ile **birebir aynı desen**, ✓ VERIFIED `useEventStream.ts:94`).

---

## 8. L5 — Barındırılan CEO oturumu kendi kapılarını onaylayabilir mi? (tamamen yeniden yazıldı)

**Tur 1'in hatası (B1):** bu soruyu yalnızca "hosted oturum bir Bash komutuyla `/api/gates`'e HTTP
isteği atabilir mi" sorusuna indirgemişti ve "otomatik/sessiz self-approval YOK" cümlesini bu dar
kapsamda ✓ VERIFIED işaretlemişti. QA, daha kısa bir yolun (`ceo.md`'nin `Write` aracıyla
`docs/approvals/G5.ok`'u **doğrudan** yazmak) teorik olarak izin kartını atlayabileceğini gösteren
statik bir zincir buldu (`ceo.md:7` `Write` var → `gate-check.cjs`'in `free` listesi `docs/`'u
muaf tutuyor → `.claude/settings.json`'ın `Write(docs/**)` allow kuralı → `settingSources:
['project']` bunu yüklüyor → `permissions.ask` yalnızca `['Bash']`).

**N1 — bu zincir canlı ölçümle çürütüldü.** `docs/qa/F-008-write-izin-olcumu.md` (tam metin, bu
turda okundu): gerçek `@anthropic-ai/claude-agent-sdk` `query()` çağrısı, sandbox çalışma dizini,
proje `.claude/settings.json` ile birebir aynı `Write(docs/**)` allow kuralı, iki yapılandırma
(`allowManagedPermissionRulesOnly: true` VE `false`). **İkisinde de** `canUseTool` callback'i
`Write` çağrısında tetiklendi, kart çıktı, reddedildiğinde dosya oluşmadı (`WRITE_CARD_FIRED:
true`, sandbox `docs/` klasörü boş kaldı — ✓ DOĞRULANDI, canlı ölçüm, statik çıkarım değil). Yani
tur 1'in statik zinciri **mantıken tutarlıydı ama SDK'nın gerçek çalışma zamanı davranışı onu
geçersiz kılıyor**: proje allow kuralı `Write(docs/**)`'a tam uysa da, mutasyon aracı olan `Write`
her koşulda karta düşüyor.

Bu ölçüm, `.claude/agents/ceo.md:7`'de `Write`/`Edit` araçlarının varlığını (Bash'in ağa çıkabilen
tek araç olmadığını) **doğruluyor**, ama bunun bir güvenlik açığı olmadığını da **aynı ölçümle**
kapatıyor — SDK, allow listesinden bağımsız olarak `Write`'ı zaten karta düşürüyor. `ADR-014`'e bu
turda eklenmiş "Ek — `Write` de izin kartına uğruyor" bölümü (✓ VERIFIED, tarih 2026-09-09) bu
sonucu ve tur 1'in zincirinin nerede koptuğunu zaten kayda geçirmiş durumda; bu sözleşme sadece
o kaydı referans alıyor, tekrar ölçmüyor.

**Sonuç — iki bilinen yol, ikisi de karta düşüyor:**
1. `Write`/`Edit` ile doğrudan `docs/approvals/G5.ok` yazımı → **her koşulda** `canUseTool`'a
   düşer, kullanıcı reddedebilir (yukarıdaki ölçüm).
2. `Bash` + `curl`/HTTP ile `/api/gates/.../approve` çağrısı → `session.ts:498-501`'in
   `managedSettings.permissions.ask:['Bash']` ayarı zaten her `Bash` çağrısını karta düşürüyor
   (F-012'de canlı ölçülmüş, ✓ VERIFIED, `ADR-014` K3 — bu turda yeniden ölçülmedi, önceden
   doğrulanmış bir bulgu).

**Dürüst sınır (N1'in istediği cümle):** bu, kabuk erişimli yerel bir agent'a karşı savunmanın
**mutlak** olduğu anlamına gelmez — kullanıcı kartı okumadan/dikkatsizce onaylarsa (özellikle
`buildInputPreview`'in 500 karaktere kırpılmış, tek satıra indirgenmiş önizlemesinde gömülü bir
komutu fark etmezse, `session.ts:137-142`) yazma yine de gerçekleşir. **Anlamı, kapı dosyasını
yazan HER yolun kullanıcının gördüğü izin kartından geçtiğidir** — otomatik/sessiz bir bypass
mevcut yapılandırmada yok. Asıl koruma katmanı budur; `.claude/hooks/**` katmanı (gate-check.cjs,
block-dangerous.cjs) bu soruyla ilgisizdir (kapı onayı dosyalarını değil, kod dizinini ve
yıkıcı/yayın komutlarını korur — bu terminoloji karışıklığı tur 1'in B1 bulgusunun kaynağıydı ve
artık `ADR-014` ekinde düzeltilmiş durumda).

**N2 — ek hook önerisi (M1) iptal edildi.** Tur 1 `.claude/hooks/block-dangerous.cjs`'e `/api/gates`
yolunu hedefleyen koşulsuz bir Bash-engelleme kuralı önermişti. Ölçüm korumanın zaten (izin kartı
katmanında) var olduğunu gösterdiği için bu ek katman **gereksiz karmaşıklık** (Karpathy §2) —
özellikle bu depoda koşulsuz metin eşleşmesinin daha önce iki kez masum komutları/dosya yazımlarını
engellediği göz önüne alınırsa (`CLAUDE.md` "Öğrenilen kurallar"). **Bu sözleşme hiçbir hook
dosyasına dokunmuyor** (§1 "Kapsam DIŞI").

**Kod turunun işi (yer tutucu değil, §11 mutasyon M10):** bu ölçümü tekrarlanabilir bir regresyon
testine çevirmek — `tests/integration/chat-hooks-live.test.ts`'in `describe.skipIf` desenini
(kota harcamayan varsayılan `verify` dışı, yalnızca `MC_GATES_LIVE_TESTS=1` ile koşan) taklit eden
yeni bir dosya, `tests/integration/gates-write-permission-live.test.ts`.

---

## 9. Türkçe metinler (L8/M2 — kod turundan ÖNCE `docs/03-ux.md`'ye eklenecek, birebir)

CEO kararı M2 (aynen geçerli): kullanıcıya görünen tüm yeni Türkçe metinler kod turundan **önce**
`docs/03-ux.md`'ye eklenir; kod ile belge birebir aynı olur. Aşağıdaki metinlerin **çoğu zaten**
`docs/03-ux.md`'de var (kaynak olarak alınır, yeniden icat edilmez); yalnızca yıldızlı olanlar
**yeni** ve kod turundan önce eklenmesi gerekiyor.

| Metin | Kaynak |
|---|---|
| "Önce bir proje seçin." (boş durum) | ✓ zaten var, `docs/03-ux.md:516` |
| "Kapı durumları okunamadı. [Tekrar dene]" (hata) | ✓ zaten var, `docs/03-ux.md:516` |
| "Durum belirlenemedi" (tek satır hatası, gri) | ✓ zaten var, `docs/03-ux.md:516` |
| `docs/approvals/G2.ok yazıldı` (onay toast) | ✓ zaten var, `docs/03-ux.md:459` |
| `docs/approvals/G2.deny.md yazıldı` (red toast) | ✓ zaten var, `docs/03-ux.md:466` |
| "(kilitli)" (onaylı satır aksiyon sütunu) | ✓ zaten var, `docs/03-ux.md:202` mockup |
| **"Tanınmayan dosyalar: {liste}"** | ★ yeni — Ö2 |
| **"PROCESS.md okunamadı, varsayılan adlar gösteriliyor."** | ★ yeni — Ö1 |
| **"Red kaydı {arşiv yolu} altına taşındı ama onay yazılamadı; kapı şu an \"Bekliyor\" durumunda. Tekrar deneyin."** (yarı-başarı) | ★ yeni — Ö9, §6 |
| **"Bu kapı zaten onaylı, reddedilemez."** (409 conflict, deny) | ★ yeni — B6/N4, §4 |
| **"Bu durum panelden düzeltilemez; dosyaları `docs/approvals/` altında elle inceleyin."** ([Detay] alt satırı) | ★ yeni — B6 sorun 2, §4 |
| **"Tarih, dosyanın son değiştirilme zamanıdır; klonlama/checkout sonrası içerikteki tarihten farklı olabilir."** (kenar durum notu, tooltip/açıklama) | ★ yeni — N2 (tur 1'in notu) |
| Genel yazma hatası (approve/deny 500) | ✓ zaten var desende — mevcut ekranların "Liste kaydedilemedi, tekrar deneyin." üslubuyla tutarlı, Kapılar'a özel metin: **"Kaydedilemedi, tekrar deneyin."** ★ yeni ama mevcut üslubun doğrudan tekrarı |

Kod turu başlamadan önce bu ★ işaretli altı metin `docs/03-ux.md`'nin "Durum tasarımı"/"Türkçe
metin sözlüğü" bölümlerine eklenmelidir (bu sözleşmenin dosya sahipliği dışı — CEO/architect ya da
kod turunu üstlenen developer bu adımı **ilk iş** olarak yapar, sonra koda geçer).

**Toast bileşeni kararı:** bugün toast yalnızca `src/features/kanban/web/KanbanScreen.tsx`
içinde **yerel** olarak var (paylaşılan bir bileşen değil, ✓ VERIFIED `KanbanScreen.tsx:92,
382-397`). Kanban dosyalarına dokunmak dosya sahipliği sınırını aşar; bu yüzden gates kendi **küçük,
yerel** toast state'ini taşır (`GatesScreen.tsx` içinde `useState<string|null>` + 3 saniyelik
otomatik kapanma — ayrı bir `Toast.tsx` bileşeni bile gerekmez, tek kullanıcı için Karpathy §2).
Paylaşılan bir toast sistemine geçiş **ayrı bir refactor kararı**, F-008'in kapsamında değil.

**Buton devre-dışı kuralları (Ö11):** "Onayı Yaz →" `decision` boşken/yalnızca boşlukken devre
dışı (`docs/03-ux.md:458`); "Reddet - Kaydet" `reason` boşken/yalnızca boşlukken devre dışı
(`docs/03-ux.md:465`). `useGates.test.ts`/`GatesScreen.test.tsx` planına bu iki buton için
devre-dışı/aktifleşme assert'i eklenir (§11 test planı).

---

## 10. Dokunacağım dosyalar

### 10.1 Yeni (`src/features/gates/**`, `tests/features/gates/**`, `tests/e2e/gates.spec.ts`, `tests/integration/gates-*.test.ts`)

| Dosya | Amaç |
|---|---|
| `src/features/gates/shared/format-approval.ts` | `buildApprovalBody`, `buildDenialBody` — saf, `fs` yok, hem web hem server import eder (§5). |
| `src/features/gates/shared/gate-id.ts` | `isValidGateId` (ön-doğrulama, otorite değil, §4), `parseGateFileName`. |
| `src/features/gates/server/list-gates.ts` | `docs/PROCESS.md` + `docs/approvals/` okur, `GatesListResponse` üretir. Salt okunur (§3). |
| `src/features/gates/server/handlers.ts` | `handleListGates`, `handleApproveGate`, `handleDenyGate` (§4, aksiyon durum makinesi dahil). |
| `src/features/gates/server/gates-watcher.ts` | `docs/approvals/`'a özel chokidar sarmalayıcı (§7). |
| `src/features/gates/web/GatesScreen.tsx` | Ekran kompozisyonu, proje seçici, tablo, yerel toast state (§9). |
| `src/features/gates/web/ProjectSelect.tsx` | Tek-seçim proje dropdown'u (FilterChips'ten farklı, tek tüketici — ayrı bileşen). |
| `src/features/gates/web/GateRow.tsx` | Tek satır — rozet, tarih, aksiyon durum makinesi (§4), `[Detay]` genişleyen alt satır. |
| `src/features/gates/web/ApproveModal.tsx` | İki adımlı onay modalı (§4/§5). |
| `src/features/gates/web/DenyInlineForm.tsx` | Satır içi zorunlu gerekçe formu. |
| `src/features/gates/web/useGates.ts` | Veri katmanı: yükleme, `onGates` SSE yenilemesi, `approve`/`deny` çağrıları + rollback. |
| `src/features/gates/web/icons.tsx` | 4 durum ikonu (mevcut `events/web/icons.tsx` deseni). |
| `tests/features/gates/server/list-gates.test.ts` | Birim — fixture `docs/approvals/`, 4 durum + conflict + unrecognized (hariç tutma kümesi dahil) + PROCESS.md okunamama + ASSETS etiketi + G4-N sayısal sıralama + tek satır stat hatası. |
| `tests/features/gates/server/format-approval.test.ts` | Birim — golden string karşılaştırması (§5 şablonları). |
| `tests/features/gates/server/handlers.test.ts` | Birim — gövde doğrulama, `confirmed`/`reason` zorunluluğu, hata kod eşlemesi, onaylı kapıda `deny` → 409. |
| `tests/features/gates/server/gates-watcher.test.ts` | Birim — gerçek geçici dizin + chokidar, `.ok`/`.deny.md`/tanınmayan dosya değişiminde tetikleme, kendi `.tmp` dosyasında tetiklenmeme. |
| `tests/features/gates/server/gates-manifest.test.ts` | Manifest — gerçek `approve`/`deny` akışı, `before` anlık görüntüsü **tüm çağrılardan önce** alınır, izin verilenler dışında hiçbir dosya değişmiyor, arşiv **taşıma** (silme değil), `mtimeMs` karşılaştırması dahil (§10.2, Ö4). |
| `tests/features/gates/web/GatesScreen.test.tsx` | jsdom — 4 durum render, `[Detay]` genişleme, boş proje listesi durumu. |
| `tests/features/gates/web/useGates.test.ts` | jsdom — iptal → sıfır fetch çağrısı (AC7), yazma hatası → rollback + karar metni korunur, buton devre-dışı durumları (Ö11). |
| `tests/integration/gates-api.test.ts` | Gerçek `createServer()` + HTTP — mutlu yol, `x-mc-write` eksikliği (403), `confirmed` eksik (400), boş `reason` (400), 404 proje, onaylı kapıda `deny` → 409, yarı-başarı fault injection (§6), AC9 sıra doğrulaması (§11 M6), `data` alanının varlığı (§11 M8). |
| `tests/integration/gates-write-permission-live.test.ts` | **Yeni, kota harcayan** — `describe.skipIf(!process.env.MC_GATES_LIVE_TESTS)`, `chat-hooks-live.test.ts` deseni; §8 ölçümünün otomasyonu (§11 mutasyon M10). `npm run verify`'nin **normal** parçası değil. |
| `tests/e2e/gates.spec.ts` | Gerçek tarayıcı — onay modalı iptal (fs değişmez), onay yazma, red, çelişkili durum `[Detay]`, canlı güncelleme (harici dosya yazımı → panel yenilenir), 320px/375px dar genişlik (§11 test planı). |

### 10.2 Değiştireceğim (gates dizini dışı — mekanik, F-005/F-007 emsali)

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `src/server/index.ts` | `GET /api/gates`, `POST /api/gates/:project_id/:gate/approve`, `POST /api/gates/:project_id/:gate/deny` route'ları eklenir (mevcut `startsWith`/split deseniyle, `PATCH /api/features/:project_id/:file` emsali). Güvenlik satırı **eklenmiyor** — `x-mc-write`/Host/Origin zaten tüm non-GET `/api/*`'i kapsıyor. | Her feature kendi ucunu burada açar (F-002/F-003/F-005/F-007 emsali). |
| `src/shared/types.ts` | `GateStatus`, `GateStatusItem`, `GatesListResponse` eklenir. | Paylaşılan tip deposu. |
| `src/features/projects/server/service.ts` | `gatesWatchers` map'i, `startWatchingGatesIfPossible`, `stopAll`/`getActiveWatcherCount` güncellemesi (§7, Ö3). | Proje kaydı yaşam döngüsüne bağlı ikinci bir izleyici türü; dosya zaten bu orkestrasyonun sahibi. |
| `src/web/App.tsx` | `TabScreen` birleşimine `'gates'` eklenir, `buildTabs` "Sohbet"ten hemen sonra "Kapılar" ekler (docs/03-ux.md sekme sırası, ✓ VERIFIED `docs/03-ux.md:735` altı sekmeyi zaten bu sırayla listeliyor), dördüncü `tabpanel`, `useEventStream`'e `onGates: setGatesSignal`. | Her ekran ekleyen feature bu dosyaya dokunur (F-005/F-007 emsali). |
| `src/web/lib/useEventStream.ts` | `onGates?: (signal:{project_id:string}) => void` + `es.addEventListener('gates', ...)`, `onFeatures` ile **birebir**. | ADR-004 madde 1 — tek bağlantı, çok kanal. |
| `src/web/index.css` | `@source "../features/gates/web";` eklenir. | F-003/F-005/F-007 emsali (Tailwind v4 tarama kapsamı); `tests/build-css.test.ts`'in dizin-numaralandırma çiti (F-012 dersi) bunu otomatik yakalar, ek satır gerekmez. |
| `tests/build-css.test.ts` | Yeni blok: gates/web'e özgü ≥3 sınıf. | Aynı sınıf regresyonunu önleyen zorunlu çit. |
| `tests/helpers/manifest.ts` | `snapshotDir(dir, { includeMtime?: boolean })` — ikinci, **opsiyonel** parametre; verilirse her `ManifestEntry`'ye `mtimeMs?: number` eklenir. Varsayılan davranış (parametre verilmezse) **değişmez** — mevcut çağıranlar (F-005/F-006 manifest testleri) etkilenmez. | Ö4: bu paylaşılan yardımcı bilinçli olarak `mtimeMs` taşımıyordu (`tests/helpers/manifest.ts:6-9` yorumu, ✓ VERIFIED); F-008'in `mtime`-only bir dokunuşu (içerik/`sha256` aynı kalırken yalnızca `mtime` değişmesi) yakalaması gerekiyor (PRD AC4 zaten `mtime`'ı zorunlu kılıyor). Additive/opsiyonel parametre — mevcut davranış bozulmaz. **[tur 3 ek — Y3]** Bu yeteneği ölçen mutasyon §11 M11'de eklendi; eklenmeden önce `includeMtime` parametresinin kendisi hiçbir testte doğrulanmıyordu (F-013'ün aynı sınıf boşluğu, bkz. M11 gerekçesi). |
| `playwright.config.ts` | `testMatch` listesine `'gates.spec.ts'` eklenir. `webServer.command` zaten `npm run build && npm start` (üretim build'i, ✓ VERIFIED — bu config diğer üç config'den farklı olarak zaten prod build kullanıyor); gates E2E'sinin hiçbir probu `import.meta.env.MODE !== 'production'` koşuluna bağlanmaz. | N3/B4: dört config'in **hiçbiri** `gates.spec.ts`'i içermiyordu (✓ VERIFIED, tur 1 QA ölçümü); `tests/e2e-config-guard.test.ts:32,37,59` bu eksiklikte `verify`'yi kırardı. |
| `tests/web/App.interaction.test.tsx` | **(a)** Satır 266: `toHaveLength(3)` → `toHaveLength(4)` (chat açık senaryo). **(b)** Satır 251-272 (`End` tuşu, chat açık): sekme sırası artık `[Zaman Çizelgesi, Kanban, Sohbet, Kapılar]` (Kapılar Sohbet'ten **sonra** eklenir, `docs/03-ux.md:735`) — `End` artık Sohbet'i değil **Kapılar**'ı seçer; `chatTab` yerine `gatesTab = screen.getByRole('tab', {name:'Kapılar'})`, satır 270-271'in hedefi buna güncellenir, test adı "son sekme artık Kapılar" olarak değişir. **(c) [tur 3 ek — Y1 madde 2]** Satır 237-239 (ayrı `describe`, chat **kapalı** senaryo, `stubGlobals()`): bugün `End` → `kanbanTab` bekliyor; Kapılar koşulsuz eklendiği için tablar `[Zaman Çizelgesi, Kanban, Kapılar]` olur, son sekme **Kapılar**'dır — yeni `gatesTab = screen.getByRole('tab', {name:'Kapılar'})` eklenir, satır 238-239'un beklentisi `kanbanTab` → `gatesTab` olur (`ArrowRight`/`ArrowLeft`/`Home` iddiaları — satır 227-235, 241-243 — **değişmez**, yalnızca `End`). | (a)/(b) N3/B5, ✓ VERIFIED ölçüm tur 1 QA. (c) `F-008-contract-review-2.md` Y1 madde 2, ✓ VERIFIED `tests/web/App.interaction.test.tsx:237-239` — tur 2 sözleşmesi yalnızca chat-açık `End` testini kapsamıştı, chat-kapalı `End` testi (ayrı `describe`) atlanmıştı. |
| `tests/web/App.chat-tab.test.tsx` **[tur 3 ek — Y1 madde 1]** | Satır 78: chat kapalı senaryo `toHaveLength(2)` → `toHaveLength(3)` (test adı/amacı "Sohbet hiç yok" değişmiyor, yalnızca sayı). Satır 92: chat açık senaryo `toHaveLength(3)` → `toHaveLength(4)`. Satır 97 (`tabs[2]).toBe(chatTab)`, sıra iddiası) **değişmez** — Kapılar Sohbet'ten sonra eklendiği için Sohbet hâlâ 3. sırada. | `F-008-contract-review-2.md` Y1 madde 1, ✓ VERIFIED — bu dosya tur 2 sözleşmesinin §10.1/§10.2 listelerinin hiçbirinde geçmiyordu (`grep -n "chat-tab" docs/qa/F-008-contract.md` sıfır sonuç veriyordu); B5'in tam kapsadığı, gözden kaçmış bir dosya. |
| `tests/e2e/shell.spec.ts` | **(a)** Satır 46: `clickableCount` beklentisi `3` → `4`. Satır 60: `tabRoleCount` beklentisi `2` → `3`. **(b) [tur 3 ek — Y1 madde 4, doktrin kararı]** Satır 127-130: `expect(bodyText).not.toContain('Kapılar')` **silinir**, yerine `expect(bodyText).toContain('Kapılar')` yazılır; `Thread`/`Token` `not.toContain` iddiaları **korunur** (ikisi hâlâ eklenmedi). Kapalı-küme koruması zaten (a)'daki `tabRoleCount`/`clickableCount` tam-sayı iddialarından geliyor — beşinci bir sekme eklenirse o sayılar kırılır; bu satırın rolü yalnızca doktrini E2E katmanında da güncel tutmak. | (a) N3/B5, ✓ VERIFIED ölçüm tur 1 QA. (b) `F-008-contract-review-2.md` Y1 madde 4, ✓ VERIFIED `tests/e2e/shell.spec.ts:127-130` — `App.test.tsx`'teki aynı doktrin çitinin E2E kopyası, tur 2 sözleşmesinde anılmamıştı. |
| `tests/web/App.test.tsx` | **(a)** Satır 48: `headerHtml.match(/role="tab"/g)` beklentisi `toHaveLength(2)` → `toHaveLength(3)` — değer artık **belirlenebilir** (tahmin değil, ✓ VERIFIED): `renderToStaticMarkup` efekt çalıştırmaz → `chat.status` hep `null` → `chatUiEnabled=false` (`src/web/App.tsx:34`) → `buildTabs(false)` = `[timeline, kanban]` + koşulsuz eklenen `gates` = **3** (`src/web/App.tsx:15-22`). **(b) [tur 3 ek — Y1 madde 3, doktrin kararı]** Satır 22-26 (`it('Faz 2 ekranları hiç görünmez (Kapılar, Thread, Token)')`) yeniden yazılır: `expect(html).not.toContain('Kapılar')` **silinir**; `Thread`/`Token` `not.toContain` iddiaları **korunur**. Yerine, iddiayı düz tersine çevirmek yerine (bu, ileride kazara eklenecek 5. bir sekmeyi yakalamaz) test **kapalı kümeyi** doğrular: `expect(html).toContain('Zaman Çizelgesi')`, `toContain('Kanban')`, `toContain('Kapılar')` **ve** aynı testte satır 48'in `toHaveLength(3)` iddiası tekrar çağrılır/referans verilir — üç bilinen etiketin varlığı + tam sekme sayısının 3 olması birlikte "bu üçü, başkası yok" garantisini verir (dördüncü bilinmeyen bir sekme eklenirse sayı 4'e çıkar, KIRMIZI). Test adı: `'Faz 1 kabuğu üç sekme: Zaman Çizelgesi, Kanban, Kapılar; Thread/Token hâlâ Faz 2, hiç görünmez'`. | (a)/(b) `F-008-contract-review-2.md` Y1 madde 3 + tablo, ✓ VERIFIED `tests/web/App.test.tsx:22-26,48` ve `src/web/App.tsx:15-22,34`. Doktrin gerekçesi: Kapılar bu feature ile Faz 2'den Faz 1 kabuğuna geçiyor (G0 kararı) — bu mekanik bir sayı güncellemesi değil, testin öncülünün kendisi değişiyor. |

**Dokunulmayacağını doğruladığım dosyalar (olumsuz iddia, ✓ VERIFIED):** `src/server/write-gate.ts`
(dört mevcut fonksiyon yeterli), `src/server/watch/project-watcher.ts` (deseni kopyalanıyor,
dosyanın kendisi değiştirilmiyor — §7), `tests/no-write-gate-bypass.test.ts`/`tests/server/
write-gate-manifest.test.ts` (özyinelemeli tarama kökü zaten `src`/testleri kapsıyor), `.claude/
hooks/**` (§1/§8 — N2 ile bu turda da kapsam dışı kaldı), `src/features/kanban/web/
KanbanScreen.tsx` (toast paylaşılmıyor, §9), `docs/PROCESS.md` (yalnızca **okunuyor**, satır
ayrıştırması düzeltildi, dosyanın kendisine dokunulmuyor).

---

## 11. Test planı ve mutasyon listesi (madde 7)

| AC | Test |
|---|---|
| AC1 (durum türetme) | `list-gates.test.ts` (4 durum + conflict + unrecognized/hariç tutma + PROCESS.md yok/bozuk + ASSETS etiketi + G4-N sayısal sıralama + tek satır stat hatası) |
| AC2 (`.ok` formatı) | `format-approval.test.ts` (golden string) |
| AC3 (red zorunlu gerekçe) | `handlers.test.ts` + `gates-api.test.ts` (boş/whitespace reddedilir, dosya yazılmaz) |
| AC4 (çelişkili durum) | `list-gates.test.ts` + `GatesScreen.test.tsx` (rozet + `[Detay]` + "hangisi daha yeni") |
| AC5 (yazma hatası → geri al, çökmez) | `useGates.test.ts` (rollback, karar metni korunur) + `gates-api.test.ts` (yarı-başarı fault injection) |
| AC6 (F-006 kapısından geçer, **otomatik test** — PRD'nin kendi şartı) | statik guard (`no-write-gate-bypass.test.ts`, mevcut, otomatik) + `gates-manifest.test.ts` (Ö7 düzeltmesi: "kod incelemesi notu" **değil**, gerçek otomatik test) |
| AC7 (iki adım, iptal yazmaz) | `useGates.test.ts` (sıfır fetch) + `gates.spec.ts` (gerçek fs değişmez) |
| AC8 (red gerekçesi olduğu gibi geçer) | `format-approval.test.ts` + `gates.spec.ts` |
| AC9 (arşiv sonra onay, sıra) | `gates-manifest.test.ts` (taşıma, silme değil) + `gates-api.test.ts` (sıra assert'i, mutasyon M6) |
| Canlı güncelleme | `gates-watcher.test.ts` + `gates.spec.ts` (harici yazım → SSE → yeniden yükleme) |
| Dar genişlik (Ö8) | `gates.spec.ts` — 320px ve 375px'te kapı tablosu + sekme çubuğu; sekme çubuğu iddiası **kırpılmış görünür genişlikle** (`boundingBox` kesişimi) ölçülür, `toBeVisible()` ile **değil** (F-007 dersi — kaydırma kabında yalan söylüyor). |
| Buton devre-dışı (Ö11) | `useGates.test.ts`/`GatesScreen.test.tsx` — `decision`/`reason` boşken buton `disabled`. |

**Mutasyon listesi (11 madde, her biri bağımsız bir mekanizma, "şunu boz → şu test KIRMIZI" +
korumanın kaynaktan türediği not — Ö5 düzeltmesi: eski liste 7 maddeden 3'ü aynı mekanizmayı
ölçüyordu ve 1'i yer tutucuydu, ikisi de kapatıldı; tur 3'te M6'nın yönü düzeltildi, M9'un hedef
dosyası netleştirildi, M11 eklendi — Y2/Y3):**

**M1. İki adımlı onayın atlanması** — `handleApproveGate`'te `confirmed !== true` kontrolünü kaldır
→ `handlers.test.ts` "confirmed olmadan 400 döner, dosya yazılmaz" KIRMIZI. Kaynak: L2/AC7, API'nin
kendi gövde doğrulaması.

**M2. `x-mc-write` muafiyeti** — dağıtıcıya (varsayımsal) `/api/gates` yolunu `x-mc-write`
kontrolünden hariç tutan bir satır ekle → `gates-api.test.ts` "başlıksız POST 403 döner" KIRMIZI.
ADR-013 sınırının yeni rotalara gerçekten bağlı olduğunu doğrulayan regresyon testi.

**M3. Arşivin silmeye dönmesi** — `handleApproveGate`'in arşivleme adımını, `archiveDenial`
çağırmak yerine doğrudan `.deny.md`'yi (varsayımsal) `fs.unlinkSync` ile silen bir kodla değiştir
→ hem `tests/no-write-gate-bypass.test.ts` (statik, ✓ VERIFIED tarama kökü) hem
`gates-manifest.test.ts` ("silinen yol sayısı sıfır" iddiası, `mtimeMs` dahil) ikisi de KIRMIZI.

**M4. Statik tarama genelliği** (Ö5'in "4 ve 6'yı birleştir" talebi — eski iki madde tek maddeye
indirildi) — `list-gates.ts`'e (varsayımsal) doğrudan bir `fs.writeFileSync`/`fs.unlinkSync`
çağrısı ekle (ör. çelişkili durumu "temizlemek" için ya da write-gate.ts'i atlayarak) →
`tests/no-write-gate-bypass.test.ts` **hiçbir yeni test dosyası eklenmeden** KIRMIZI. Bu, mevcut
statik taramanın `src/features/gates/**`'i otomatik kapsadığının **tek** kanıtı olarak yeterli
(tekrarlanan kanıt sayı şişirir, Ö5).

**M5. Red gerekçesi zorunluluğunun kalkması** — `handleDenyGate`'te boş-string kontrolünü kaldır
→ `handlers.test.ts` + `gates-manifest.test.ts` ("boş gerekçeyle çağrı sonrası hiçbir dosya
değişmedi") KIRMIZI.

**M6. AC9 sırasının ters çevrilmesi** (yeni, Ö5'in eksik saydığı kategori; **tur 3 düzeltmesi —
Y2: eski metnin assert yönü ters ve §6 ile çelişiyordu, aşağıdaki metin düzeltilmiş hâlidir**) —
`handleApproveGate`'te adım sırası (doğrusu: `archiveDenial` → `writeGateApproval`, §6) yerine
(varsayımsal) `writeGateApproval` → `archiveDenial` olarak değiştirilir. Çit: `gates-api.test.ts`'e
eklenen fault-injection senaryosu — `writeGateApproval`'ı geçici olarak başarısız olacak şekilde
mock'la, ardından şunu assert et: **`.deny.md` onay başarısız olsa bile zaten arşive taşınmış
olmalı** (`docs/approvals/archive/` altında dosya var, orijinal `docs/approvals/<gate>.deny.md`
artık yok). Doğru kodda bu assert **YEŞİL**dir — §6'nın tarif ettiği gibi `archiveDenial` her zaman
`writeGateApproval`'dan ÖNCE ve ondan bağımsız çalışır, onay başarısız olsa da arşivleme zaten
gerçekleşmiştir. Sırası ters çevrilen mutantta (onay önce denenir, o başarısız olduğu için
`archiveDenial`'a hiç sıra gelmez) `.deny.md` orijinal konumunda kalır, arşive taşınmaz → assert
**KIRMIZI**. (Eski metnin önerdiği "`archiveDenial` hiç çağrılmadı" assert'i **yanlış yöndeydi**:
doğru kodda da `archiveDenial` çağrılıp dosya taşındığı için o assert doğru kodda kırmızı verirdi —
bkz. §6 yarı-başarı paragrafı, "`.deny.md` artık `docs/approvals/archive/`'de".) Kaynak: §6 "sıra"
paragrafı, AC9.

**M7. AC2/AC8 içerik kaçış/kırpma** (yeni) — `buildApprovalBody`/`buildDenialBody`'ye kullanıcı
metnini (varsayımsal) `.slice(0, N)` ile kırpan veya özel karakterleri kaçan bir "temizleme" adımı
ekle → `format-approval.test.ts`'in golden string testi (kullanıcı metni satır sonu/özel karakter
içeren bir fixture ile) KIRMIZI. Kaynak: AC8 "olduğu gibi geçer".

**M8. Yarı-başarı `data` alanının düşürülmesi** (yeni) — `handleApproveGate`'in yarı-başarı
dalından (varsayımsal) `data: <taze GateStatusItem>` alanını kaldır → `gates-api.test.ts`'in fault
injection senaryosu "yanıt gövdesinde taze durum var" assert'i KIRMIZI. Kaynak: §6, kanban'ın
`conflict` dalıyla aynı ilke.

**M9. İzleyici/SSE broadcast'in silinmesi** (yeni; **tur 3 düzeltmesi — hedef dosya netleştirildi**)
— `handleApproveGate`/`handleDenyGate`'in başarı yolundan (varsayımsal) `hub.broadcast('gates', …)`
çağrısını kaldır → `gates-api.test.ts`'e eklenen "yazma sonrası `gates` olayı yayınlanır" assert'i
KIRMIZI (**`gates-watcher.test.ts` değil** — o dosya yalnızca dosya sistemi izleyicisini test eder,
`handleApproveGate`/`handleDenyGate`'i hiç çağırmaz, bu yüzden bu mutasyonu asla yakalayamaz).
Kaynak: §7.

**M10. L5 ölçümünün regresyonu** (N2/N7 — eski #7 yer tutucusunun yerine, artık somut) —
`gates-write-permission-live.test.ts` içindeki canlı probe, `docs/qa/F-008-write-izin-olcumu.md`'nin
sandbox desenini otomatikleştirir: gerçek SDK `query()`, proje `.claude/settings.json`'daki
`Write(docs/**)` allow kuralı yüklü, `canUseTool` **her zaman reddet** — test, `CANUSETOOL_CALLED`
olayının `Write` için tetiklendiğini VE sandbox'ta dosyanın oluşmadığını assert eder. Bu, "hook
aktif/no-op" tarzı bir yer tutucu değil — mekanizma zaten var (SDK'nın kendi davranışı, hiçbir yeni
kod eklenmiyor), test onu **otomatikleştiriyor**. `describe.skipIf(!process.env.
MC_GATES_LIVE_TESTS)` ile sarılı, `npm run verify`'nin normal parçası değil (`chat-hooks-live.
test.ts` emsali, ✓ VERIFIED desen + `package.json:30` betiği), `package.json`'a
`"test:gates-live": "vitest run tests/integration/gates-write-permission-live.test.ts"` eklenir.
**Model çıktısına assert etmiyor** — yalnızca `canUseTool` callback'inin çağrılıp çağrılmadığını ve
dosya sisteminin durumunu ölçüyor (`CLAUDE.md`'nin "canlı testte modelin ne söyleyeceğine assert
etme" dersi). **(Not — dürüstlük, tur 3'te aynen korunuyor:** yukarıdaki dokuz maddenin/M11'in
aksine bu madde bir **kod mutasyonu** değil; F-008 hiçbir yeni koruma kodu eklemiyor, ölçtüğü şey
SDK'nın kendi `canUseTool` davranışı. Listeye organizasyonel bütünlük için (L5'in otomatikleşmiş
regresyon kanıtı olarak) dahil edildi, "mutasyon" başlığı altında sayılması kavramsal olarak gevşek
bir kullanımdır — kod turu bunu bir mutasyon çiti gibi raporlamamalı.)

**M11. `mtime`-only dokunuşun manifestte görünmez kalması** (yeni — Y3/Ö4'ün kalan yarısı, tur 3
eklemesi) — `list-gates.ts`'in okuduğu bir `.ok` dosyasına (varsayımsal, testte `fs.utimesSync` ile
simüle edilir) yalnızca `mtime` değiştirilir, içerik/`sha256`/boyut/yol **aynı** kalır →
`gates-manifest.test.ts`'in `includeMtime:true` ile aldığı `before`/`after` karşılaştırması
(`tests/helpers/manifest.ts`, Ö4 düzeltmesi) KIRMIZI verir. `includeMtime` **olmadan** (varsayılan,
kapalı) çağrılan aynı testte bu mutasyon **hiçbir katmandan** kırmızı almaz — yol/sha256/boyut
değişmediği için — yani `includeMtime`'ı ölçen **tek** çit budur. Bu, F-013'ün ölçtüğü aynı sınıf
boşluğun (`docs/qa/F-013-2026-09-08-tur2.md:126` — içerik-nötr bir dokunuş manifest testinden yeşil
geçmişti) burada tekrarlamadığının kanıtıdır. Kaynak: Ö4, PRD AC4 (`mtime` tabanlı "hangisi daha
yeni").

---

## 12. Açık sorular (CEO/kullanıcı cevaplayacak)

Tur 1'in üç açık sorusundan ikisi bu turda **kapandı**: L5 mekanizması onayı sorusu artık gereksiz
(N2 — ek mekanizma önerilmiyor), Türkçe metin sözlüğü sırası sorusu M2 ile cevaplandı (önce belge,
sonra kod), proje seçilmemiş/hiç proje yokken durum sorusu `docs/03-ux.md:516`'nın mevcut tek
metniyle ("Önce bir proje seçin.") kapandı (hem "hiç proje yok" hem "proje var, seçilmemiş"
durumları aynı metni kullanır — UX bu ayrımı yapmıyor, F-008 icat etmiyor).

**Geriye kalan tek açık soru:**
1. **`docs/approvals` yeni oluşturulursa izleyicinin yeniden taranması.** §7'de not düşüldü: proje
   eklendiğinde `docs/approvals` henüz yoksa izleyici o proje için hiç başlamıyor; dizin sonradan
   (ör. ilk G0 onayında CEO tarafından) oluşturulursa mevcut tasarım bunu yakalamıyor — kullanıcı
   panel yeniden başlatılana/proje yeniden eklenene kadar canlı güncelleme göremez (statik
   `GET /api/gates` her zaman doğru sonucu verir, yalnızca **anlık** SSE bildirimi eksik kalır).
   Etkisi düşük (nadir sıra: yeni proje + ilk kapı onayı aynı oturumda) ama CEO isterse kapsam
   içine alınabilir (ör. proje izleyicisi zaten `docs/features` için periyodik yeniden kontrol
   yapıyorsa aynı desen `docs/approvals` için de eklenir — bu, `service.ts`'in mevcut
   davranışına bağlı, kod turunda doğrulanmalı).

**Doğrulayamadıklarım (tur 3, devam eden):**
- `npm run verify` / `npm run e2e` çıktısı — sözleşme turu, kod yok, koşturmadım.
- Gerçek tarayıcıda dar genişlik ölçümü (Ö8) — kod olmadığı için ölçülemez, kod turunda zorunlu.
- `gates-write-permission-live.test.ts`'in gerçek dünyada tekrar çalıştırıldığında aynı sonucu
  verip vermeyeceği (SDK sürüm değişikliğine karşı kırılganlık) — tek ölçümle doğrulandı, kod
  turunda otomatikleşince zaman içinde kendi kendini teyit edecek.

**Tur 3'te belirlenen (artık tahmin değil):** `tests/web/App.test.tsx:48`'in yeni `role="tab"`
sayısı **3**'tür — `src/web/App.tsx:15-22,34` okunarak türetildi (§10.2), kod turunda yeniden
ölçmeye gerek yok.
