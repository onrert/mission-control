# ADR-004: Gerçek zamanlı taşıma — SSE

- **Tarih:** 2026-09-04
- **Durum:** kabul

- **Bağlam:**
  Panelin üç canlı akışı var: yeni hook olayları, izlenen projelerdeki dosya değişiklikleri (feature kartları, kapı durumları) ve proje kayıt defteri değişiklikleri. Hepsi **tek yönlüdür: sunucudan tarayıcıya**. Tarayıcıdan sunucuya giden her şey (kart sürükleme, kapı onayı, proje ekleme) sıradan bir POST/PATCH isteğidir ve **yanıtı beklenmesi gereken**, hata kodu döndürebilen bir işlemdir — yani zaten kalıcı bir soketten geçmemesi gerekir.

  Kabul kriterleri gecikme sınırı koyuyor: olaylar ≤ 2 s (PRD F1/AC2), dosya değişiklikleri ≤ 2 s (F2/AC3), proje ekleme/çıkarma ≤ 5 s (F3/AC1-2). Ayrıca F1/AC4: 50 olay/dakika akışında **%99 kayıpsızlık ve sıra korunumu**.

  Referans araç (`disler/...`) WebSocket kullanıyor; bu, uyarlama yapılsaydı miras alınacak seçimdi. ADR-002 ile sunucuyu kendimiz yazdığımız için taşıma da serbest bir karardır.

- **Karar:**
  **Server-Sent Events (SSE)**, tek uç nokta: `GET /api/stream`.

  1. **Tek bağlantı, çok kanal.** Ayrı akışlar açılmaz; `event:` alanı ile ayrılır: `hello`, `event` (yeni hook olayı), `features`, `projects`, `gates`, `resync`.
  2. **`id:` = olay `seq`'i.** JSONL deposundaki monoton sıra numarası (ADR-003) doğrudan SSE olay kimliği olarak kullanılır. Böylece "istemci nereye kadar gördü" sorusu tek bir tam sayıyla cevaplanır.
  3. **Yeniden bağlanma tarayıcıya bırakılır.** `EventSource` bağlantı koptuğunda otomatik olarak yeniden dener ve son gördüğü `id`'yi `Last-Event-ID` başlığında geri gönderir. Bizim yazacağımız yeniden bağlanma/geri çekilme kodu **yoktur**.
  4. **Kaçırılan olayların telafisi.**
     ```
     Last-Event-ID = L
     L >= ring.from  →  ring buffer'dan (L, son] aralığındaki olaylar sırayla gönderilir, sonra canlı akış
     L <  ring.from  →  event: resync gönderilir; istemci GET /api/events ile tam yeniden yükleme yapar
     başlık yok      →  hello + son N olay (ilk yükleme)
     ```
     `MC_RING_SIZE` = 2000 varsayılan; 50 olay/dakika hızında bu ≈ 40 dakikalık kesinti toleransı demektir. Pratikte kopma sebebi laptop uykuya geçmesidir ve `resync` yolu da kayıpsızdır — yalnızca daha pahalıdır.
  5. **Yalnızca `event` (hook olayı) kanalı sıra garantisi verir.** `features`/`gates`/`projects` kanalları **durum anlık görüntüsüdür** (delta değil): her mesaj ilgili projenin kartlarının tam listesini taşır. Böylece bir mesaj kaçsa bile bir sonraki durumu düzeltir; bu kanallar için telafi mekanizmasına gerek yoktur. `features` mesajları 150 ms debounce edilir (bir developer aynı anda 5 dosya yazarsa 5 değil 1 mesaj gider).
  6. **Canlılık:** 15 saniyede bir `: keepalive` yorum satırı (ara katman yok ama uyku/uyanma sonrası ölü bağlantıyı tespit ettirir). İstemci 45 saniye hiçbir şey almazsa bağlantıyı kapatır ve `EventSource`'un yeniden bağlanmasını tetikler.
  7. **Başlıklar:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`. Yanıt akışı `flushHeaders()` ile hemen açılır.
  8. **Kütüphane yok.** `res.write()` ile ~40 satırlık bir hub (abone kümesi + yayınla + kapanışta temizle). `ws`/`socket.io` bağımlılığı alınmaz.

- **Alternatifler ve neden reddedildi:**
  - **WebSocket (`ws` paketi):** Çift yönlülük bizde kullanılmıyor; tek yönlü bir akış için mesaj çerçeveleme, ping/pong, yeniden bağlanma ve geri çekilme mantığını **kendimiz** yazmamız gerekir (tarayıcının `WebSocket`'i otomatik yeniden bağlanmaz). Ayrıca kaçırılan mesaj telafisi için `Last-Event-ID`'nin karşılığı yok, kendi "son gördüğüm seq" el sıkışmamızı tanımlamamız gerekir. Vite dev proxy'sinde WS için ek `ws: true` yapılandırması gerekir. Karşılığında kazandığımız tek şey (istemci→sunucu düşük gecikme) ihtiyacımız olmayan şeydir; yazma işlemleri hata kodu ve gövde döndürmeli, yani HTTP olmalıdır. **Red.**
  - **Polling (`GET /api/events?since_seq=` her 1 sn):** En basit seçenek ve ≤2 s kriterini karşılar. Ancak: (a) her dosya değişikliğinde ve her olay için ortalama 500 ms gereksiz gecikme, (b) panel gün boyu açık kalacak bir araç — dakikada 60, günde ~86.000 boş istek, (c) "canlı" hissi PRD'nin başarı ölçütünün merkezinde ("5 saniye içinde ne oluyor sorusuna cevap"). Yedek plan olarak değerli: SSE bağlantısı üç kez üst üste kurulamazsa istemci 5 saniyelik polling'e düşer (degrade mod, UI'da "canlı bağlantı yok" rozeti). **Ana taşıma olarak red, fallback olarak kabul.**
  - **Long polling:** Polling'in karmaşıklığı + SSE'nin sunucu tarafı yükü, ikisinin de faydası olmadan. **Red.**
  - **Her kanal için ayrı SSE bağlantısı:** Tarayıcının host başına eşzamanlı HTTP/1.1 bağlantı limiti (6) bir sayfada 4 akış açmayı riskli kılar; ayrıca `Last-Event-ID` yönetimi dörde çıkar. Tek bağlantı + `event:` alanı yeterlidir. **Red.**

- **Sonuçlar / riskler:**
  - **HTTP/1.1 bağlantı limiti:** SSE tek bir kalıcı bağlantı tüketir; aynı origin'de 5 eşzamanlı istek hakkımız kalır — panelin ihtiyacının çok üzerinde. Aynı paneli **birden çok sekmede** açmak her sekmede bir bağlantı demektir; 6. sekmede sıkışma olur. Tek kullanıcılık araçta kabul edilebilir; UI "başka bir sekmede açık" uyarısı vermez (gereksiz karmaşıklık).
  - **Ring buffer bellek maliyeti:** 2000 × ~3 KB ≈ 6 MB. Kabul edilebilir. `MC_RING_SIZE` ile ayarlanabilir.
  - **`resync` yolu test edilmelidir**, çünkü nadiren tetiklenir: birim testinde `Last-Event-ID` ring'den küçük verilerek zorlanır (§11.1).
  - **Sürükle-bırak yarışı:** Aktif sürükleme sırasında gelen `features` mesajı kartı elden kaçırabilir. Azaltım `docs/02-architecture.md` §15 (y4): sürükleme sürerken `features` mesajları kuyruğa alınır, bırakıldığında uygulanır.
  - **Dev modunda proxy:** Vite `/api` proxy'si SSE'yi olduğu gibi geçirir (`changeOrigin` yeterli); tampon devre dışı bırakmak için sunucu `X-Accel-Buffering: no` gönderir. E2E prod modunda (tek port) çalıştığı için bu risk testte de kapanır.

- **Kullanıcı onayı gerekli mi:** Hayır. Ücret, hesap veya geri alınamaz sonuç yok; tamamen iç teknik karar.
