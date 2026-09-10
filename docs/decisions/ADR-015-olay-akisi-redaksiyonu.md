# ADR-015: Olay akışı (hook payload) redaksiyonu

- **Tarih:** 2026-09-10
- **Durum:** kabul

- **Bağlam:**
  `docs/qa/G5-guvenlik-denetimi-2026-09-10.md` K3 (YÜKSEK): izlenen projelerden gelen ham hook
  payload'ı (`.claude/hooks/send-event.cjs` → `POST /api/events` → `normalize.ts`) — Bash
  komutları, dosya yolları, Edit/Write içerikleri (`old_string`/`new_string` dahil), kullanıcı
  promptları — hiçbir redaksiyon olmadan `data/*.jsonl`'e **kalıcı** yazılıyor ve SSE ile canlı
  panelde gösteriliyordu. Yalnızca toplam gövde boyutu (`MC_MAX_PAYLOAD`, varsayılan 64 KB)
  sınırlanıyordu; hiçbir aşamada bir secret/token deseni taranmıyordu.

  Mission Control'ün kendi amacı, izlediği HER app-factory projesine bu hook'u kurmaktır
  (`KURULUM.md`) — yani bu risk bu depoya özgü değil, izlenen her projedeki her `Bash`/
  `Edit`/`Write` çağrısının komutunu/dosya yolunu/içeriğini kapsar. Gerçekçi senaryo: izlenen
  bir projede bir agent `curl -H "Authorization: Bearer sk-live-…"` çalıştırır veya bir `.env`
  dosyasını `Write` ile oluşturur — komut/içerik event hattından geçip Mission Control'ün
  diskine ve ekranına redaksiyonsuz düşer.

- **Karar:**
  `src/features/events/server/normalize.ts`'e, `payload` JSON.parse edildikten hemen sonra
  uygulanan bir **derinlemesine redaksiyon adımı** (`redactDeep`) eklendi. Bu adım:
  1. Yalnızca string yaprak değerleri işler; obje/dizi yapısı ve string-olmayan değerler
     değişmez (payload'ın ANLAMI korunur, yalnızca hassas KISIMLARI maskelenir).
  2. **Sır redaksiyonu:** bilinen anahtar/token önekleri (`sk-…`, `AKIA…`/`ASIA…`, `ghp_…`/
     `github_pat_…`, `xox[a-z]-…`, `AIza…`), PEM özel anahtar blokları, `Bearer <token>` ve
     `api_key`/`secret`/`token`/`password`/`authorization` alan adı + değer çiftleri **görünür**
     biçimde maskelenir (`[redakte]`) — sessizce silinmez, yalnızca eşleşen kısım değişir.
     Eşleşme olursa kayda `secrets_redacted` bayrağı eklenir.
  3. **İçerik kırpma:** tek bir string alan 4000 karakteri aşarsa görünür bir işaretle
     (`…[içerik kırpıldı]`) kesilir; `content_truncated` bayrağı eklenir. Bu, mevcut
     `summary` alanının 200 karakterlik ayrı ve daha sıkı sınırından (BUG-001) bağımsızdır.
  4. Redaksiyon **tek noktada** uygulanır: `summary` (panelde canlı gösterilir) ve `raw`
     (diske yazılır) aynı redakte edilmiş `payload`'dan türetilir — ikisi arasında tutarsız bir
     sızıntı yolu bırakılmaz.
  5. Mevcut toplam-gövde-boyutu kırpması (`raw_truncated`, `MC_MAX_PAYLOAD`) değişmeden kalır;
     redaksiyondan SONRA serialize edilen boyuta bakar.

  **Bu bir KARA LİSTEdir ve tam değildir** (`docs/wiki/pages/desen/cit-tasarimi.md` §1 ile
  tutarlı bir kabul): rastgele metinde her sır biçimini önceden bilemeyiz. Yeni bir sır biçimi
  (ör. özel bir şirketin token formatı, farklı bir bulut sağlayıcısının anahtar deseni) listede
  yoksa redakte edilmez. Bu, "kapandı" değil, "daraltıldı" bir risktir — yeni bir sonda turunda
  listenin büyümesi beklenen bir maliyettir.

- **Alternatifler ve neden reddedildi:**
  - **Yalnızca `KURULUM.md`'ye uyarı eklemek, kod değiştirmemek:** en ucuz seçenek ama K3'ün
    "pratik risk" değerlendirmesini karşılamıyor — kullanıcı uyarıyı okumasa bile secret diskte
    kalırdı. **Red** (asgari önlem olarak yine de bir kullanıcı notu eklendi, aşağıya bak).
  - **Tüm `raw` alanını sakla, yalnızca UI'da maskele:** disk hâlâ ham secret taşırdı — retention
    süresi boyunca (varsayılan 30 gün) sızıntı riski sürerdi. **Red.**
  - **Retention süresini kısaltmak (ör. 1 güne indirmek):** riski azaltır ama ortadan kaldırmaz,
    ve F-002/F-003'ün zaman çizelgesi ihtiyacını (geçmişe bakma) zayıflatır. **Red** (kod
    tarafı düzeltmesi tercih edildi, retention konfigüre edilebilir kalmaya devam ediyor).
  - **Beyaz liste (yalnızca bilinen zararsız alanları geçir, gerisini reddet):** `tool_input`
    şeması (Bash `command`, Edit `old_string`/`new_string`, vb.) çok çeşitli ve serbest metin
    içeriyor; bir beyaz liste ürünü işlevsiz bırakırdı (zaman çizelgesi boş kalırdı). **Red.**

- **Sonuçlar / riskler:**
  - **Geçmiş veri dokunulmadı:** `data/*.jsonl`'e bu karardan ÖNCE yazılmış kayıtlar hâlâ
    redaksiyonsuz (ADR-001 karar 6: geçmiş olaylar depoda kalır, panel geriye dönük değiştirmez).
    Eşik ve risk `docs/blockers.md`'ye not düşüldü.
  - **Kara liste kaçakları:** yeni/bilinmeyen bir sır biçimi hâlâ redaksiyonsuz geçebilir. Bu
    hook'un `send-event.cjs`'e (izlenen projeye kurulan taraf) değil, sunucu tarafına
    (`normalize.ts`) yazılmış olması bir avantaj: yeni bir desen eklendiğinde tüm izlenen
    projeler için TEK bir dosyanın güncellenmesi yeterli, her projeye yeniden hook kurulumu
    gerekmez.
  - **4000 karakterlik alan sınırı** çok büyük diff'leri (ör. tüm bir dosyanın `new_string`'i)
    kısaltır — zaman çizelgesinde tam diff yerine kırpılmış bir önizleme görünür. Bu, F-002/
    F-003'ün "ne oldu" sorusuna cevap verme amacını bozmaz (özet hâlâ okunabilir), yalnızca tam
    metni görmek isteyen biri transkript dosyasına (`~/.claude/projects/**`) bakmalı.

- **Kullanıcı onayı gerekli mi:** Hayır — bu, mevcut "telemetri yok / dış servise gönderilmiyor"
  ilkesini DARALTAN (genişleten değil) bir değişiklik; ücret/hesap/geri alınamaz bir işlem yok.
  Ürünün ne sakladığı `docs/00-idea.md` ve `KURULUM.md`'de kullanıcıya görünür şekilde belgelendi.
