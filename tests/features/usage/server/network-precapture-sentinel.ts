// F-011 QA tur 6 (BLOKLAYICI CC1, `docs/qa/F-011-2026-09-10-tur6.md` §1.3) — bu modül aynı
// klasördeki `usage-aggregator.test.ts`'in İLK import'u OLMAK ZORUNDADIR. Neden: ağ sentinel'i
// (`installNetworkCapabilitySentinel`) test GÖVDESİ içinde kuruluyor, yani ürün modülü
// (`usage-aggregator.ts`) zaten import edilip DEĞERLENDİRİLDİKTEN SONRA. Ürün modülünün gövdesi
// (bir fonksiyon içinde değil, modül yüklenirken) `process.binding`/`process.dlopen`
// referansını KENDİ İÇİNDE yakalarsa, o referans sentinel kurulmadan ÖNCEKİ orijinali tutar ve
// sentinel'i tamamen atlayarak gerçek TCP/HTTP isteği atabilir — QA canlı kanıtladı: `tsc` 0,
// `eslint` 0, 1305/1309 test yeşil iken bağımsız bir dinleyiciye 111 gerçek TCP+HTTP isteği
// teslim edildi.
//
// Bu modül `process.binding`/`process.dlopen`'ı, ürün modülü DEĞERLENDİRİLMEDEN önce, kayıt
// eden ama fırlatmayan (orijinale delege eden) bir sarmalayıcıyla değiştirir. ESM modül
// değerlendirme sırası gereği (import'lar dosyada yazıldıkları sırayla değerlendirilir) bu
// modül ürün modülünden ÖNCE çalışırsa, ürün modülünün gövdesinde alınan her referans artık bu
// sarmalanmış sürümü yakalar — yakalanmış-referans kaçış yolu kapanır. Sarmalayıcı FIRLATMAZ
// (orijinali çağırır) çünkü burada amaç ihlali ENGELLEMEK değil, GÖRÜNÜR kılmaktır; asıl
// engelleme/fırlatma katmanı `installNetworkCapabilitySentinel`'dedir (çağrı anında arama yapan
// biçimler için) — bu modül yalnızca o katmanın atlanabildiği tek boşluğu (modül-yükleme-zamanlı
// yakalama) kapatır.
export const qaPreCalls: string[] = []

const qaPreCaptureTarget = process as unknown as Record<string, unknown>
for (const qaPreCaptureKey of ['binding', 'dlopen']) {
  const original = qaPreCaptureTarget[qaPreCaptureKey] as
    ((...args: unknown[]) => unknown) | undefined
  if (typeof original !== 'function') continue
  qaPreCaptureTarget[qaPreCaptureKey] = function (...args: unknown[]) {
    qaPreCalls.push(`process.${qaPreCaptureKey}`)
    return original.apply(process, args)
  }
}
