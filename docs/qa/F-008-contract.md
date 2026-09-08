---
feature: F-008
title: Kapılar paneli — G0-G6/ASSETS onay, red, arşiv akışı
author: developer
status: draft
date: 2026-09-09
---

# F-008 Sözleşmesi — Kapılar paneli

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").
Bu turda `src/`, `tests/`, `package.json` altında **hiçbir dosya değiştirilmedi**; yalnızca bu
belge yazıldı. `git status --porcelain` bunu doğrular.

**Neden sözleşme turu zorunlu:** bu feature panele "kullanıcı adına kapı onaylama" yetkisi
veriyor (G0 kararı: "panelden verilen kapı onayı kullanıcının onayı sayılır") — güvenlik sınırını
değiştiren bir feature, `CLAUDE.md` kuralı gereği sözleşme turu atlanamaz.

Okunan kaynaklar: `docs/features/F-008-kapilar-paneli.md`, `docs/PROCESS.md` (tamamı), `docs/03-ux.md`
ekran 4 + akışlar (d)(e) + §7 (Sohbet — izin isteği kartı, `canUseTool` bağlamı), ADR-001 (G0.ok
içeriği + karar 7), ADR-005 (tam metin + F-012 eki "iki güven seviyesi"), ADR-013 (tam metin),
ADR-014 (bkz. aşağıda ✓ VERIFIED liste), `docs/approvals/{G0,G1,G2,G3,G4-1}.ok` (gerçek format
örnekleri), `CLAUDE.md` "Öğrenilen kurallar" (tamamı).

Mevcut kod **okunarak** doğrulandı (✓ VERIFIED): `src/server/write-gate.ts` (tam dosya),
`src/server/index.ts` (dağıtıcı, route sırası, `withDispatchErrorBoundary`, Host/Origin/`x-mc-write`
kontrolü), `src/shared/types.ts` (`ApiResponse`, `ErrorCode`, `WRITE_HEADER_*`), `src/features/
projects/server/{service,handlers}.ts`, `src/features/kanban/server/handlers.ts` (async IIFE +
yarı-başarı deseni — bu sözleşmenin handler tasarımı bunu birebir taklit eder), `src/server/watch/
project-watcher.ts` (tam dosya), `src/web/App.tsx` (tab inşası, `useEventStream` kullanımı),
`src/web/lib/useEventStream.ts` (`onFeatures` deseni), `src/features/chat/server/session.ts` (tam
dosya — `canUseTool`, `managedSettings.permissions.ask:['Bash']`), `.claude/settings.json` (`ceo`
agent `permissions.allow/deny`, hook kayıtları), `.claude/agents/ceo.md` (`tools:` alanı),
`.claude/hooks/{gate-check,block-dangerous}.cjs` (tam dosya), `tests/no-write-gate-bypass.test.ts`
(tarama kökü `src/` özyinelemeli — yeni `src/features/gates/**` otomatik kapsanır), `tests/server/
write-gate-manifest.test.ts` (manifest test deseni).

---

## 1. Kapsam

**İçinde:**
1. `GET /api/gates?project_id=…` — seçili projenin kapı durum listesi.
2. `POST /api/gates/:project_id/:gate/approve` — iki adımlı onay, ikinci adımda diske yazar.
3. `POST /api/gates/:project_id/:gate/deny` — zorunlu gerekçeli red.
4. Kapılar ekranı: proje seçici (tek, zorunlu dropdown), kapı tablosu, onay modalı, satır içi red
   formu, çelişkili durum rozeti, canlı güncelleme (mevcut SSE hub'ına yeni `gates` kanalı).
5. `archiveDenial`'ın (F-006, mevcut) ilk kez bir HTTP akışına bağlanması — G4-1.ok'ta CEO'ya
   devredilmiş taahhüt (bkz. §3 "L4").

**Kapsam DIŞI (bilinçli):**
- Kapı **oluşturma**/silme — yalnızca G0-G6/ASSETS ve bunların bilinen soneki (`G4-1` gibi)
  üzerinden **var olan** onay/red akışı. Yeni bir kapı türü tanımlamak PROCESS.md değişikliğidir.
- Thread (F-009), Token (F-010/F-011).
- `docs/PROCESS.md`'nin kendisini düzenleme.
- `write-gate.ts`'e yeni bir niyet fonksiyonu eklemek — dört mevcut fonksiyon (`writeGateApproval`,
  `writeGateDenial`, `archiveDenial`, dolaylı olarak `setFeatureStatus`) yeterli, ✓ VERIFIED.
- **L5'in yapısal kapatılması** — mekanizma bu sözleşmede **önerilir**, doğrulanır, ama
  uygulanması `src/features/gates/**` dosya sahipliğinin dışında kalıyor (bkz. §6, ayrı karar
  gerektirir).

---

## 2. CEO kararlarının (L1-L8) gövdeye yayılması — harita

| Karar | Nerede uygulanıyor |
|---|---|
| L1 (sabit liste değil) | §3 "Durum türetme" |
| L2 (iki adım, iptal hiçbir şey yazmaz) | §4 uçlar + §7 test planı mutasyon 1 |
| L3 (yeni yazma yolu yok) | §2.1/§2.2 dosya listesi + §7 mutasyon 6 |
| L4 (`archiveDenial` senkron mu) | §5 (cevap: **evet, tamamen senkron**) |
| L5 (barındırılan oturum) | §6 (ayrı, öne çıkarılmış bölüm) |
| L6 (çelişki otomatik çözülmez) | §3 + §7 mutasyon 4 |
| L7 (red gerekçesi zorunlu) | §4 + §7 mutasyon 5 |
| L8 (Türkçe metin önce UX'e) | §8 "Türkçe metinler" |

---

## 3. Durum türetme (madde 1)

**Kaynak ikili:** hem `docs/approvals/` dizin içeriği hem `docs/PROCESS.md` §2'nin kapı tablosu.

**"Her zaman gösterilen" temel katalog** (`BASE_CATALOG`) — 7 giriş: `G0, G1, G2, G3, ASSETS, G5,
G6`. `G4` **bilerek dışarıda bırakıldı**: PROCESS.md §2'nin kendisi (`docs/PROCESS.md:30`) G4'ü
`approvals/G4-<n>.ok` biçiminde, yalnızca sonek ile tanımlıyor — bare `G4` diye bir dosya adı
sözleşmesi projede hiç yok (G4-1.ok tek örnek). Bu yüzden G4 satırı yalnızca **dosya varsa**
görünür (aşağıya bkz.), sabit bir "G4 bekliyor" satırı **uydurulmaz** — henüz numaralanmamış bir
kilometre taşı için sahte bir "Bekliyor" göstermek yanıltıcı olurdu.

Etiketler `<proje kökü>/docs/PROCESS.md`'nin **kendi** `## 2. Kapılar` tablosundan türetilir
(hedef projenin dosyası — Mission Control'ünki değil): tablo satırının ilk hücresi (`G0 Fikir`,
`G4 Kilometre taşı` gibi) `^(\S+)\s+(.+)$` ile `id`/`label`'a bölünür, `id` `BASE_CATALOG`
kümesiyle eşleşmeyenler atlanır. PROCESS.md okunamaz/tablo bulunamazsa: `process_doc_readable:
false` döner, `BASE_CATALOG` küçük bir **gömülü yedek etiket tablosuyla** (7 satır, PROCESS.md'nin
şu anki metniyle birebir) gösterilir — panel asla çökmez, yalnızca etiketler proje-özel
olmayabilir.

**Dosya taraması** (`docs/approvals/`, yalnızca üst düzey — `archive/` alt dizini **okunmaz**, o
yalnızca yazma tarafında hedef, listede görünmez):
- `^(G[0-6](-\d{1,3})?|ASSETS)\.ok$` veya `…\.deny\.md$` ile eşleşen her dosya bir "kapı" olarak
  ele alınır (id = eşleşen grup). `BASE_CATALOG`'da yoksa (ör. `G4-1`, `G4-2`, bare `G4`, ya da
  ileride `G5-1` gibi beklenmedik ama **desene uyan** bir sonek) yine de kendi satırı olarak
  gösterilir — label yoksa id'nin kendisi kullanılır (ör. "G4-1").
- Bu desene **hiç uymayan** bir dosya (`README.md`, yanlış yazılmış `g2.ok`, `.gitkeep` vb.)
  sessizce atlanmaz: `unrecognized: string[]` listesine ham dosya adıyla eklenir, ekranda ayrı bir
  "Tanınmayan dosyalar" notu olarak gösterilir (L1 "sessiz kalma yok").

**Tek bir kapı için durum:**
| `.ok` var mı | `.deny.md` var mı | `status` |
|---|---|---|
| hayır | hayır | `pending` |
| evet | hayır | `approved` |
| hayır | evet | `denied` |
| evet | evet | `conflict` |

`conflict` durumunda `newer_side: 'ok' \| 'deny'` — **karşılaştırma `fs.statSync(...).mtime`
ile** yapılır (dosya İÇERİĞİNDEKİ "Tarih:" satırı **parse edilmez** — hem CEO'nun hem panelin
yazdığı içerik serbest metin/markdown, düzenli ayrıştırma güvenilir değil; mtime zaten dosya
sisteminin kendi, ücretsiz, tartışmasız kaynağı). Aynı sebeple tablodaki "Tarih" sütunu da
`mtime`'dan `YYYY-MM-DD`'ye biçimlenir. Hiçbir dosya **otomatik silinmez/taşınmaz** — `list-gates`
salt okunur, `fs` yazma/silme çağrısı içermez (bu iddia `tests/no-write-gate-bypass.test.ts`'in
statik taramasıyla **ve** ayrı bir dinamik "salt-okunur" testiyle çitlenir, §7).

---

## 4. Uçlar (madde 2)

Tümü `ApiResponse<T>` deseninde (`src/shared/types.ts`, mevcut). Yeni tipler eklenir:
```ts
export type GateStatus = 'pending' | 'approved' | 'denied' | 'conflict'
export interface GateStatusItem {
  id: string            // "G2", "ASSETS", "G4-1"
  label: string
  status: GateStatus
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
`write_failed` yeterli (✓ VERIFIED, `src/shared/types.ts:37-52`).

### `GET /api/gates?project_id=<id>`
- `project_id` yoksa/boşsa → 400 `invalid_body` (Kanban'ın aksine Kapılar **her zaman tek
  proje** ister, UX §"Proje kapsamı" tablosu; boş bırakmak "tüm projeler" anlamına gelmez).
- Proje kayıtlı değilse → 404 `not_found`.
- Aksi halde 200, `ApiResponse<GatesListResponse>`.
- `x-mc-write` **gerekmiyor** (GET, dağıtıcı zaten yalnızca non-GET'i zorluyor).

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
     500 `write_failed`, **`writeGateApproval` hiç çağrılmaz** (yarı-başarıyı önlemek için).
  3. `writeGateApproval(project.path, gate, buildApprovalBody(...))` çağrılır (asenkron).
  4. Başarılı → taze `GateStatusItem` yeniden hesaplanır (dosyaları tekrar `stat`leyerek), 200.
  5. Başarısız (adım 2 zaten arşivlemişse) → **yarı-başarı** (bkz. §5), 500 `write_failed`,
     gövdede `data: <taze GateStatusItem>` de döner (kanban'ın `conflict` dalıyla aynı desen) ki
     istemci gerçek durumu (muhtemelen `pending`) hemen görsün.
  6. Beklenmeyen `throw` → dış `catch`, 500 `write_failed`, ham hata istemciye sızmaz.

### `POST /api/gates/:project_id/:gate/deny`
Gövde: `{ reason: string }`. Ayrı bir doğrulama adımı **yok** (UX akış e, madde 1-4).
- `reason` boş/yalnızca boşluk veya >4000 karakter → 400 `invalid_body`, dosya yazılmaz.
- Zaten bir `.ok` varsa **engellenmez** — ADR-005 madde 9 ("panel bir onay dosyasını kendiliğinden
  silmez/üzerine yazmaz") ve AC4 (çelişkili durum) birlikte okunduğunda, red işlemi `.ok`'a hiç
  dokunmadan `.deny.md` yazar; sonuç bilerek bir `conflict` durumudur, bug değildir — bu, panelin
  zaten göstermesi gereken bir senaryo (§3 tablosu).
- `writeGateDenial(project.path, gate, buildDenialBody(...))` — başarı/başarısızlık kodları
  approve ile aynı desende.

---

## 5. `.ok`/`.deny.md` içerik formatı (madde 3) — ve L4'ün cevabı

**L4 — `archiveDenial` senkron bekleme içeriyor mu?** **Hayır, hiç içermiyor.** ✓ VERIFIED
(`src/server/write-gate.ts:342-372`): imza `export function archiveDenial(...): WriteResult`
— `Promise` **değil**. Gövde yalnızca `fs.existsSync`, `fs.mkdirSync`, `fs.renameSync` çağırıyor;
`atomicWrite`/`delay()`/`Atomics.wait` **hiçbiri kullanılmıyor** (bunlar yalnızca `atomicWrite`'ın
kendisinde, `writeGateApproval`/`writeGateDenial`/`setFeatureStatus`'un dolaylı olarak kullandığı
yol). F-007 sözleşmesinin kendi notu da bunu doğruluyor (§1: "archiveDenial'ın async'e çevrilmesi
— kendi retry döngüsü yok, kanban onu hiç çağırmıyor"). Sonuç: bu fonksiyonu bir HTTP handler'a
bağlamak **bloklayıcı değil** — senkron `fs` çağrıları zaten kanban'ın `rereadCard`'ında da
(§4, madde "Başarılı" adım 4) aynı async IIFE içinde kullanılan, precedent'i olan bir desen.
G4-1.ok'un devrettiği taahhüt burada **kapanır**.

**`.ok` biçimi** — `docs/PROCESS.md` §2 ("tarih + onaylanan özet + kullanıcının kararı") ile
birebir, mevcut `.ok` örnekleriyle aynı düz-metin üslup (bkz. `docs/approvals/G2.ok`). Panel
projenin PRD/mimari içeriğini bilmediği için "onaylanan özet" **mekanik** üretilir — bu dürüst bir
tasarım kararıdır, CEO'nun kendi yazdığı zengin özetlerle karıştırılmamalı:

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
dosya). İkisi de **YAML round-trip içermez** — `setFeatureStatus`'un aksine tüm dosya gövdesi
yazıldığı için `safeYamlValue` tarzı bir kaçış sorunu **yok** (bu dosyalar frontmatter değil, kimse
onları makine olarak geri ayrıştırmıyor — §3'ün "durum" kararı zaten mtime'a dayanıyor, içerik
metnine değil).

---

## 6. Arşivleme akışı + hata semantiği (madde 4-5)

**Sıra (L2/AC9):** deny varsa önce `archiveDenial`, SONRA `writeGateApproval`. Asla ters sıra
(onay yazılıp sonra arşivleme başarısız olursa iki dosya kalıcı olarak çelişir, kullanıcı
"onayladım" sanır ama panel hâlâ `conflict` gösterebilir — kafa karıştırıcı). Bu yüzden sıra
**arşiv → onay**, adım 2 başarısızsa adım 3 hiç denenmez (§4).

**Yarı-başarı (F-007'nin dersi — dürüstçe raporlanır, sessizce "başarılı" denmez):** arşivleme
başarılı, `writeGateApproval` başarısız olursa disk durumu şudur: `.deny.md` artık
`docs/approvals/archive/`'de, `.ok` **yok**. Yani kapı şu an **`pending`** — ne onaylı ne reddedilmiş,
kullanıcının önceki reddi "kaybolmuş" gibi görünür (aslında arşivde duruyor, silinmedi). Yanıt
`success:false, error:{code:'write_failed', message:'Red kaydı arşivlendi ama onay yazılamadı;
kapı şu an "Bekliyor" durumunda. Tekrar deneyin.'}, data:<taze GateStatusItem, status:'pending'>`
döner. İstemci bu `data`'yı **gerçek** kabul edip UI'ı buna göre çizer (rollback/optimistic
tahmin **yapmaz** — kanban'ın `conflict` dalıyla aynı ilke).

**Genel hata semantiği (AC5):**
- Yazma hatasında buton durumu geri alınır: onay modalı **kapanmaz**, hata satır içi gösterilir,
  "Onayı Yaz" tekrar tıklanabilir hale döner (kullanıcının yazdığı karar metni **kaybolmaz** —
  yeniden yazdırmak kötü UX olurdu). Red formunda aynı: gerekçe metni korunur, buton tekrar aktif.
- Asenkron handler'ın **kendisi** kendi `try/catch`'ini taşır (dış `withDispatchErrorBoundary`
  yalnızca senkron dağıtım hatalarını yakalar, `src/server/index.ts:161-188` — F-007'nin
  `handlePatchFeatureStatus`'unun aynı gerekçeyle sardığı IIFE deseni burada da birebir
  tekrarlanır, §4).
- Panel çökmez: `GatesScreen` mevcut `ScreenErrorBoundary` deseninin içine yerleşir (App.tsx'in
  diğer tabpanel'leri gibi).

---

## 7. Canlı güncelleme (madde 6)

Mevcut SSE hub'ı (`createSseHub`, tek bağlantı — ADR-004 madde 1) **yeniden kullanılır**, yeni bir
mekanizma icat edilmez:
- Panelin **kendi** yazması (approve/deny sonrası) → handler başarı yolunda
  `hub.broadcast('gates', { project_id })` çağırır (tıpkı `features`/`projects` kanalları gibi).
- **Dışarıdan** değişiklik (CEO'nun kendi Bash/Write'ı, elle düzenleme) → `docs/approvals/`
  bugün **hiç izlenmiyor** (✓ VERIFIED, `src/features/projects/server/service.ts:93-103` yalnızca
  `docs/features`'ı izliyor). Bunun için `src/features/gates/server/gates-watcher.ts` adında
  **yeni, küçük bir dosya** eklenir — `project-watcher.ts`'in **kopyası değil**, o dosyaya
  dokunulmuyor (dosya sahipliği sınırı) ama aynı `chokidar` kurulumunu (depth:0, ignoreInitial,
  `awaitWriteFinish`, 150ms debounce — `createDebouncer` zaten paylaşılan bir yardımcı,
  `src/server/watch/debounce.ts`, o da değişmiyor, yalnızca import edilir) tekrarlar. **Fark:**
  `project-watcher.ts` yalnızca `.md` uzantılı değişiklikleri debounce'a sokuyor (kanban için
  doğru, ama `docs/approvals/*.ok` `.md` **değil** — bu filtre gates için yanlış olurdu); gates
  izleyicisi bu yüzden **filtresiz** — `docs/approvals/` içindeki (yalnızca üst düzey, `depth:0`)
  HERHANGİ bir değişiklik tetikler, çünkü tanınmayan dosyalar bile listeye (`unrecognized`)
  girmeli. ~20 satırlık bilinçli bir kopya; iki dosyayı ortak bir parametreli yardımcıya
  soyutlamak (tek kullanıcı + tek farkı bir filtre olan iki çağıran) Karpathy §2 ihlali olurdu ve
  `project-watcher.ts`'e dokunmak dosya sahipliğini aşardı — bu genelleme kararı o dosyanın
  sahibine bırakılıyor.
- `src/web/lib/useEventStream.ts`'e `onGates?: (signal: {project_id:string}) => void` eklenir
  (`onFeatures` ile **birebir aynı desen**, ✓ VERIFIED `useEventStream.ts:94`).

---

## 8. L5 — Barındırılan CEO oturumu kendi kapılarını onaylayabilir mi? (en kritik soru)

**Kısa cevap: teorik olarak EVET, HTTP yolu açık; ama pratikte HER Bash çağrısı kullanıcının
tek tek onayladığı bir izin kartına düşüyor — otomatik/sessiz self-approval YOK. Yapısal olarak
tam kapatma bu sözleşmenin/dosya sahipliğinin dışında; mekanizma önerilir, [T] işaretlenir.**

**Yol neden açık — ✓ VERIFIED:**
1. `ceo.md` `tools:` alanında `WebFetch`/genel bir `fetch` aracı **yok** — ağa çıkabilecek tek araç
   `Bash` (`.claude/agents/ceo.md:7`). Yani hosted oturumun panele istek atmasının tek yolu bir
   kabuk komutu (curl/node) çalıştırmak.
2. `x-mc-write` başlığının değeri **sır değil** — `src/shared/types.ts:96`'da düz metin sabit
   (`'1'`), hosted oturum kendi `Read` aracıyla bunu okuyabilir.
3. `isAllowedOrigin` (`src/server/index.ts:133-144`) `Origin` başlığı **yoksa** `true` döner —
   `curl` varsayılan olarak `Origin` göndermez, geçer. `isAllowedHost` `127.0.0.1:<port>` için zaten
   `true`.
4. `.claude/hooks/block-dangerous.cjs` (✓ VERIFIED, tam dosya okundu) yalnızca `git push`,
   yayın komutları (`vercel`, `npm publish` vb.) ve klasik yıkıcı komutları (`rm -rf`, `git reset
   --hard` vb.) regex'le yakalıyor — bir `curl http://127.0.0.1:7333/api/gates/...` deseni
   **hiçbirine uymaz**, engellenmez. `gate-check.cjs` yalnızca `Edit|Write`'ı, yalnızca G2 onayı
   yokken kod dizinine yazmayı engelliyor — bu API çağrısıyla ilgisiz.
5. İki adımlı onay (L2) yalnızca **UI sözleşmesi**; API'nin kendisi `confirmed:true` ile TEK bir
   istekte tatmin olur (§4) — bir Bash komutu bu alanı zaten `true` göndererek "iki adımı" tek
   seferde atlatabilir.

**Yol neden tam olarak sessiz/otomatik değil — ✓ VERIFIED:**
`src/features/chat/server/session.ts:498-501` — `buildOptions` her oturumda
`managedSettings: { allowManagedPermissionRulesOnly: true, permissions: { ask: ['Bash'] } }`
ayarlıyor. Koddaki yorum (satır 484-497), F-012 QA turunda **canlı ölçülmüş** bir bulguya
dayanıyor: bu ayar, `.claude/settings.json`'ın kendi ince taneli `Bash(node *)` gibi izin
kalıplarından **bağımsız olarak**, hosted oturumda **HER** `Bash` çağrısını `canUseTool`'a
düşürüyor — yani kullanıcı, sohbet ekranında beliren "🔒 İzin isteği" kartına (docs/03-ux.md §7
madde 3) tıklamadan hiçbir Bash komutu çalışmıyor. Otomatik onay/"hepsine izin ver" kısayolu SDK
tarafında da yok (ADR-014 K3, ✓ VERIFIED — bu iddia F-012 kapsamında zaten canlı doğrulanmış,
tekrar test edilmiyor).

**Gerçek artık risk (kalan boşluk):** izin kartı yalnızca `buildInputPreview` (session.ts:137-142)
ile üretilen, **500 karaktere kırpılmış, tek satıra indirgenmiş** bir komut önizlemesi gösteriyor
— "bu bir kapı onayı" demiyor, sadece ham komut metni. Kullanıcı, göze çarpmayan/uzun bir komutun
içine gömülü bir `curl … /api/gates/G2/approve …` çağrısını fark etmeden onaylayabilir. Yani koruma
"otomatik onay yok" seviyesinde var, ama Kapılar ekranının **kendi özel** iki-adım modalının
(dosya yolu + özet + kullanıcının kendi karar metni) sağladığı **okunabilirlik** seviyesinde değil.

**Önerilen mekanizma (mühendislik olarak makul, ama kod turunun İLK işi olarak, ayrı onayla —
[T] TAHMİN, bu sözleşmede uygulanmıyor):** `.claude/hooks/block-dangerous.cjs`'e (ya da yeni bir
hook dosyasına) `docs/approvals` yolunu VEYA `/api/gates` yolunu hedefleyen bir Bash komutunu
**koşulsuz** engelleyen bir kural eklemek — mevcut "regex eşleşirse `docs/approvals/DANGER.ok`
olmadan engelle" desenin bir varyantı, ama burada **hiçbir override yok** (hosted oturumun bu API'yi
çağırmasının hiçbir meşru senaryosu yok — kapı onayı yalnızca insan etkileşiminden gelmeli, CEO
kararı). Bu, permission-kartının okunabilirlik zayıflığına güvenmek yerine, riski **hook katmanında**
(izin isteği görüntülenmeden ÖNCE) kapatır — ADR-005'in F-012 ekinin "sınır artık *kim izin
veriyor*" ilkesiyle tutarlı, tıpkı hook'ların zaten diğer üç korumayı (yıkıcı komut, push, kapı
kilidi) aynı katmanda tuttuğu gibi.

**Neden bu sözleşmede uygulanmıyor:** `.claude/hooks/**` `src/features/gates/**` dosya
sahipliğinin **dışında** ve tüm agent oturumlarını (yalnızca gates'i değil) etkileyen paylaşılan
bir altyapı — feature notunun dosya sahipliği maddesi bunu kapsamıyor. Bu, CEO/architect'in ayrı
bir karar olarak (muhtemelen ADR-005/ADR-014'e küçük bir ek olarak) onaylaması gereken bir iş;
F-008'in kod turu bunu **paralel bir görev** olarak (gates dizini dışında, ayrı commit'te) yapabilir
ama bu sözleşme onu F-008'in "bitti" tanımının **parçası** saymıyor — aksi halde dosya sahipliği
ihlali olur. **Açık soru §10'a taşındı.**

---

## 9. Dokunacağım dosyalar

### 9.1 Yeni (`src/features/gates/**`, `tests/features/gates/**`, `tests/e2e/gates.spec.ts`, `tests/integration/gates-api.test.ts`)

| Dosya | Amaç |
|---|---|
| `src/features/gates/shared/format-approval.ts` | `buildApprovalBody`, `buildDenialBody` — saf, `fs` yok, hem web hem server import eder (§5). |
| `src/features/gates/shared/gate-id.ts` | `isValidGateId` (ön-doğrulama, otorite değil, §4), `parseGateFileName`. |
| `src/features/gates/server/list-gates.ts` | `docs/PROCESS.md` + `docs/approvals/` okur, `GatesListResponse` üretir. Salt okunur (§3). |
| `src/features/gates/server/handlers.ts` | `handleListGates`, `handleApproveGate`, `handleDenyGate` (§4). |
| `src/features/gates/server/gates-watcher.ts` | `docs/approvals/`'a özel chokidar sarmalayıcı (§7). |
| `src/features/gates/web/GatesScreen.tsx` | Ekran kompozisyonu, proje seçici, tablo. |
| `src/features/gates/web/ProjectSelect.tsx` | Tek-seçim proje dropdown'u (FilterChips'ten farklı, tek tüketici — ayrı bileşen). |
| `src/features/gates/web/GateRow.tsx` | Tek satır — rozet, tarih, aksiyon butonları. |
| `src/features/gates/web/ApproveModal.tsx` | İki adımlı onay modalı (§4/§5). |
| `src/features/gates/web/DenyInlineForm.tsx` | Satır içi zorunlu gerekçe formu. |
| `src/features/gates/web/useGates.ts` | Veri katmanı: yükleme, `onGates` SSE yenilemesi, `approve`/`deny` çağrıları + rollback. |
| `src/features/gates/web/icons.tsx` | 4 durum ikonu (mevcut `events/web/icons.tsx` deseni). |
| `tests/features/gates/server/list-gates.test.ts` | Birim — fixture `docs/approvals/`, 4 durum + conflict + unrecognized + PROCESS.md okunamama. |
| `tests/features/gates/server/format-approval.test.ts` | Birim — golden string karşılaştırması (§5 şablonları). |
| `tests/features/gates/server/handlers.test.ts` | Birim — gövde doğrulama, `confirmed`/`reason` zorunluluğu, hata kod eşlemesi. |
| `tests/features/gates/server/gates-watcher.test.ts` | Birim — gerçek geçici dizin + chokidar, `.ok`/`.deny.md`/tanınmayan dosya değişiminde tetikleme. |
| `tests/features/gates/server/gates-manifest.test.ts` | Manifest — gerçek `approve`/`deny` akışı, izin verilenler dışında hiçbir dosya değişmiyor, arşiv **taşıma** (silme değil). |
| `tests/features/gates/web/GatesScreen.test.tsx` | jsdom — 4 durum render, conflict "hangisi daha yeni", boş proje listesi durumu. |
| `tests/features/gates/web/useGates.test.ts` | jsdom — iptal → sıfır fetch çağrısı (AC7), yazma hatası → rollback + karar metni korunur. |
| `tests/integration/gates-api.test.ts` | Gerçek `createServer()` + HTTP — mutlu yol, `x-mc-write` eksikliği (403), `confirmed` eksik (400), boş `reason` (400), 404 proje, yarı-başarı fault injection (§7 test planı). |
| `tests/e2e/gates.spec.ts` | Gerçek tarayıcı — onay modalı iptal (fs değişmez), onay yazma, red, çelişkili durum görüntüsü, canlı güncelleme (harici dosya yazımı → panel yenilenir). |

### 9.2 Değiştireceğim (gates dizini dışı — mekanik, F-005/F-007 emsali)

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `src/server/index.ts` | `GET /api/gates`, `POST /api/gates/:project_id/:gate/approve`, `POST /api/gates/:project_id/:gate/deny` route'ları eklenir (mevcut `startsWith`/split deseniyle, `PATCH /api/features/:project_id/:file` emsali). Güvenlik satırı **eklenmiyor** — `x-mc-write`/Host/Origin zaten tüm non-GET `/api/*`'i kapsıyor. | Her feature kendi ucunu burada açar (F-002/F-003/F-005/F-007 emsali). |
| `src/shared/types.ts` | `GateStatus`, `GateStatusItem`, `GatesListResponse` eklenir. | Paylaşılan tip deposu (F-005/F-007 aynı dosyaya `FeatureCard` eklemişti). |
| `src/web/App.tsx` | `TabScreen` birleşimine `'gates'` eklenir, `buildTabs` "Sohbet"ten hemen sonra "Kapılar" ekler (docs/03-ux.md sekme sırası), üçüncü/dördüncü `tabpanel`, `useEventStream`'e `onGates: setGatesSignal`. | Her ekran ekleyen feature bu dosyaya dokunur (F-005/F-007 emsali). |
| `src/web/lib/useEventStream.ts` | `onGates?: (signal:{project_id:string}) => void` + `es.addEventListener('gates', ...)`, `onFeatures` ile **birebir**. | ADR-004 madde 1 — tek bağlantı, çok kanal. |
| `src/web/index.css` | `@source "../features/gates/web";` eklenir. | F-003/F-005/F-007 emsali (Tailwind v4 tarama kapsamı). |
| `tests/build-css.test.ts` | Yeni blok: gates/web'e özgü ≥3 sınıf. | Aynı B1 sınıfı regresyonunu önleyen zorunlu çit (F-003/F-005/F-007 emsali). |

**Dokunulmayacağını doğruladığım dosyalar (olumsuz iddia, ✓ VERIFIED):** `src/server/write-gate.ts`
(dört mevcut fonksiyon yeterli — hiçbiri değişmiyor), `src/server/watch/project-watcher.ts`
(kopyalanıyor, değiştirilmiyor — §7), `tests/no-write-gate-bypass.test.ts`/`tests/server/
write-gate-manifest.test.ts` (özyinelemeli tarama kökü zaten `src`/testleri kapsıyor, yeni satır
gerekmiyor), `.claude/hooks/**` (L5 mekanizması bu sözleşmenin **dışında**, §6/§10).

---

## 10. Test planı ve mutasyon listesi (madde 7)

| AC | Test |
|---|---|
| AC1 (durum türetme) | `list-gates.test.ts` (4 durum + conflict + unrecognized + PROCESS.md yok/bozuk) |
| AC2 (`.ok` formatı) | `format-approval.test.ts` (golden string) |
| AC3 (red zorunlu gerekçe) | `handlers.test.ts` + `gates-api.test.ts` (boş/whitespace reddedilir, dosya yazılmaz) |
| AC4 (çelişkili durum) | `list-gates.test.ts` + `GatesScreen.test.tsx` (rozet + "hangisi daha yeni") |
| AC5 (yazma hatası → geri al, çökmez) | `useGates.test.ts` (rollback, karar metni korunur) + `gates-api.test.ts` (yarı-başarı fault injection) |
| AC6 (F-006 kapısından geçer) | statik guard (mevcut, otomatik) + kod incelemesi notu |
| AC7 (iki adım, iptal yazmaz) | `useGates.test.ts` (sıfır fetch) + `gates.spec.ts` (gerçek fs değişmez) |
| AC8 (red gerekçesi olduğu gibi geçer) | `format-approval.test.ts` + `gates.spec.ts` |
| AC9 (arşiv sonra onay) | `gates-manifest.test.ts` (taşıma, silme değil) |
| Canlı güncelleme | `gates-watcher.test.ts` + `gates.spec.ts` (harici yazım → SSE → yeniden yükleme) |

**Mutasyon listesi (≥7, her biri "şunu boz → şu test KIRMIZI" + korumanın kaynaktan türediği not):**

1. **İki adımlı onayın atlanması** — `handleApproveGate`'te `confirmed !== true` kontrolünü kaldır
   → `handlers.test.ts` "confirmed olmadan 400 döner, dosya yazılmaz" KIRMIZI. Kaynak: L2/AC7,
   API'nin kendi gövde doğrulaması (totoloji değil — gerçek `writeGateApproval` çağrısının önüne
   geçen kod yolunu test ediyor).
2. **`x-mc-write` muafiyeti** — dağıtıcıya (varsayımsal) `/api/gates` yolunu `x-mc-write`
   kontrolünden hariç tutan bir satır ekle → `gates-api.test.ts` "başlıksız POST 403 döner"
   KIRMIZI. Bu, YENİ rotaların paylaşılan ADR-013 sınırına gerçekten bağlı olduğunu (F-003'ün
   `/api/stream` muafiyet emsali gibi sessiz delinmediğini) doğrulayan **regresyon** testi.
3. **Arşivin silmeye dönmesi** — `handleApproveGate`'in arşivleme adımını, `archiveDenial`
   çağırmak yerine doğrudan `.deny.md`'yi (varsayımsal) `fs.unlinkSync` ile silen bir kodla
   değiştir → hem `tests/no-write-gate-bypass.test.ts` (statik, `unlinkSync(` yeni dosyada
   yakalanır, ✓ VERIFIED tarama kökü) hem `gates-manifest.test.ts` ("silinen yol sayısı sıfır"
   iddiası) KIRMIZI.
4. **Çelişkili durumun otomatik çözülmesi** — `list-gates.ts`'e, iki dosya da varsa eskisini
   "temizleyen" bir (varsayımsal) `fs.unlinkSync` ekle → `no-write-gate-bypass.test.ts` (statik)
   ve `list-gates.test.ts`'in "list-gates hiçbir fs yazma/silme çağrısı yapmaz" dinamik
   manifest-diff testi (before/after `docs/approvals/` snapshot'ı eşit) ikisi de KIRMIZI.
5. **Red gerekçesi zorunluluğunun kalkması** — `handleDenyGate`'te boş-string kontrolünü kaldır
   → `handlers.test.ts` + `gates-manifest.test.ts` ("boş gerekçeyle çağrı sonrası hiçbir dosya
   değişmedi") KIRMIZI.
6. **Manifest/no-delete çitinin bypass'ı** — `list-gates.ts`'e (varsayımsal) doğrudan
   `fs.writeFileSync(...)` çağrısı ekle (write-gate.ts'i atlayarak) → **hiçbir test dosyası
   değiştirilmeden** `tests/no-write-gate-bypass.test.ts` KIRMIZI (bu, mevcut altyapının yeni
   `src/features/gates/**`'i otomatik kapsadığının kanıtı, §9.1 notu).
7. **L5'in koruması — YER TUTUCU, kod turunda gerçek teste dönüştürülecek.** Mekanizma seçilip
   uygulandığında (§6, muhtemelen bir hook kuralı): test iki yönlü olmalı — hook aktifken bir
   Bash komutuyla `/api/gates/.../approve`'a POST **engellenir**; hook geçici olarak no-op
   yapılınca **aynı komut geçer** (ADR-014 M2'nin "hook aktifken engellendi, no-op'ta geçti"
   kanıt deseni, ✓ VERIFIED daha önce bu projede kullanılmış). Bu mutasyon **bu sözleşmede
   yazılamaz** çünkü mekanizmanın kendisi henüz onaylanmadı (§6) — kod turunun ilk işi bu
   kararı almak, sonra bu testi yazmaktır.

---

## 11. Açık sorular (CEO/kullanıcı cevaplayacak)

1. **L5 mekanizması onayı.** §6'da önerilen hook-katmanı çözümü (ya da başka bir alternatif)
   CEO/architect tarafından onaylanmalı — bu, `src/features/gates/**` dosya sahipliğinin dışında
   bir karar. Onaylanmazsa F-008 kod turu bu boşluğu **bilinen, kabul edilmiş bir risk** olarak
   G4/G5 kapısına taşımalı (ADR-005 F-012 ekindeki "iki güven seviyesi" çerçevesine yeni bir not).
2. **Proje seçilmemiş/hiç proje yokken Kapılar ekranı ne gösterir?** Kanban'ın "proje eklenmemiş"
   boş durumuyla aynı metni mi kullanmalı, yoksa Kapılar'a özel mi (doğrudan Ayarlar'a yönlendiren
   bir bağlantı önerilir, ama tam metin `docs/03-ux.md`'ye eklenmeli — L8).
3. **Türkçe metin sözlüğü eksiği (L8):** bu sözleşmede önerilen yeni metinler ("Tanınmayan
   dosyalar", "PROCESS.md okunamadı, varsayılan adlar gösteriliyor", yarı-başarı hata metni, boş
   proje durumu) `docs/03-ux.md`'ye kod turundan **önce** eklenmeli mi (F-007/F-013 emsali gibi
   ayrı bir UX-onay adımı) yoksa kod turu sırasında geliştirici mi ekleyip CEO'ya rapor eder
   (F-013'ün "QA düzeltme turu" metin sözlüğü ekleme deseni)? İkinci yol daha hızlı, ilk yol
   PROCESS.md'nin "kaynak gerçeği docs/'tur" ilkesine daha sadık — CEO karar versin.

**Doğrulayamadıklarım:** L5'in mekanizması için önerdiğim hook regex'inin gerçek dünyada kaç
false-positive üreteceği (ör. geliştiricinin meşru bir `curl` ile sağlık kontrolü yapması) — bu
ancak gerçek bir hook yazılıp `_selftest.cjs`'e eklenince ölçülebilir, bu sözleşme kapsamında
**[T] TAHMİN** olarak bırakılıyor.
