// PreToolUse (Edit|Write): G2 onayı yokken kod dizinine yazılamaz.
// GUARD.ok: `.claude/hooks/**` ve `.claude/settings.json` kendi güvenlik zincirini (bu hook
// dahil) taşır. Bunlar G2'nin "mimari onayı" kapsamına GİRMEZ — meşru bakım (hook `.cjs`'e
// taşınması, kredi kapısı düzeltmesi gibi) G2 onayı olmadan da olur — ama G2.ok'a hiç bakmadan
// "docs/" gibi tamamen serbest bırakılmaları da yanlıştı (bkz. docs/qa/G5-guvenlik-denetimi-
// 2026-09-10.md K1). Bu yüzden ayrı, DANGER.ok/PUSH.ok ile AYNI DESENDE ama TÜKETİM MODELİ
// FARKLI bir onay: docs/approvals/GUARD.ok. `.claude/agents/**` ve `.claude/agent-memory/**`
// güvenlik sınırı değildir, serbest kalır.
//
// B-3 KAPANIŞI (docs/qa/hook-borclari-contract.md, docs/blockers.md B-3): GUARD.ok ARTIK
// "tek kullanımlık" DEĞİLDİR — DANGER.ok/PUSH.ok'tan FARKLI olarak zaman pencereli (bkz §2.2
// yorumu, aşağıda `parseGuardDoc`): pencere boyunca kapsamdaki her dosyaya istenildiği kadar
// yazılabilir, token bir YAZMADA tükenmez. Bu dosyada "tek kullanımlık" ifadesi yalnızca
// DANGER.ok/PUSH.ok (block-dangerous.cjs) için doğrudur; GUARD.ok için kullanılırsa yanlış bir
// zihinsel model üretir (gelecekteki bir değişiklik "zaten tek kullanımlık, tükeniyor" varsayımıyla
// hatalı bir karar verebilir) — bu yüzden aşağıda GUARD.ok'u anan HİÇBİR yerde bu ifade geçmez.
//
// TARİHÇE (Y1 kapsam-sızıntısı ailesi, üç tur boyunca "metnin ŞEKLİ kapsamı belirliyor"
// kusuruyla üç kez yenildi — sırasıyla: dosyanın tamamındaki backtick'li adlar → "## Kapsam"
// blok sınırı ("nerede biter" belirsizdi: başlıksız kuyruk düzyazı/h1/kalın sözde-başlık blok
// sınırını taklit edebiliyordu) → kapalı biçimli liste maddeleri ("## Kapsam" başlığının
// KENDİSİNİN kimliği belirsizdi: birebir eşleşmeyen bir başlık — "## Kapsam (2 dosya)" gibi —
// belgenin başka bir yerindeki, arşiv/kod-bloğu/HTML-yorumu içindeki birebir "## Kapsam" satırına
// sessizce bağlanabiliyordu, bkz. docs/qa/G5-sozlesme-kararlari-2026-09-10-tur3.md). Üçü de aynı
// aileden: serbest metinden makine kararı çıkarmak. KULLANICI KARARI (docs/qa/
// g5-guard-json-contract.md): dördüncü bir metin-ayrıştırma yaması YOK — kaynağın kendisi
// ortadan kaldırıldı. GUARD.ok artık bir JSON belgesidir; kapsam YALNIZCA "scope" alanından
// okunur, başka HİÇBİR alan (özellikle "reason") hiçbir zaman ad için taranmaz. Bu, "başlık
// kimliği" kavramını yapısal olarak imkânsız kılar — ayrıştırılacak bir "başlık" yok.
//
// Tüketim modeli de değişti (aynı sözleşme, §2.2): token artık kapsamdaki dosyalar bir kez
// yazıldığında TÜKENMEZ (eski model onay-yorgunluğuna yol açıyordu: bir düzeltmede üç dosya =
// üç ayrı kullanıcı onayı). Bunun yerine ZAMAN PENCERELİ: token, "created_at" + "valid_minutes"
// penceresi boyunca kapsamındaki HER dosyaya istenildiği kadar yazma izni verir; pencere
// dolunca dosya bir sonraki guarded-yol değerlendirmesinde SİLİNİR. Bu, bilinçli bir takastır
// (dürüst maliyet: pencere boyunca birden fazla yazma yetkilenir) — gerekçe sözleşmede.
// `docs/approvals/.guard-state.json` artık HİÇBİR yol tarafından yazılmıyor/okunmuyor (kısmi
// tüketim izleme mantığı kaldırıldı) ama savunma-derinliği için sert engeli KORUNUYOR.
//
// TUR 5 (docs/qa/g5-guard-json-contract.md, "M2" kapanışı — QA'nın G5-sozlesme-kararlari-
// 2026-09-10-tur4.md §1.3 bulgusu): `scanForDuplicateKeys`'in kendi çağrı-yığını taşmasını
// (RangeError) yutan `catch (_) { dup = null; }` artık AYRIŞTIRILDI — bkz. aşağıdaki
// `parseGuardDoc` içindeki catch bloğu ve `MAX_SCAN_DEPTH` sabiti.
const path = require('path');
const fs = require('fs');
const { readInput, exists, block } = require('./_common.cjs');

const GUARD_OK = 'docs/approvals/GUARD.ok';
const GUARD_STATE = 'docs/approvals/.guard-state.json'; // artık yazılmıyor; yalnızca sert engel için anılıyor

const MAX_GUARD_BYTES = 8192; // meşru bir GUARD.ok birkaç yüz bayttır; bu, DoS/aşırı okumaya karşı cömert bir üst sınır
const DEFAULT_VALID_MINUTES = 30;
const MAX_VALID_MINUTES = 120; // sınırsız pencere yok; üst sınır CEO'nun çok adımlı bakımına esneklik tanır
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000; // yazan/okuyan arasındaki saniyeler mertebesindeki saat farkını tolere eder

// docs/qa/g5-guard-json-contract.md M2 kapanışı (G5-sozlesme-kararlari-2026-09-10-tur4.md §1.3):
// `scanForDuplicateKeys` JS'de yazılmış ÖZYİNELEMELİ bir tarayıcı, kendi JS çağrı yığını sınırına
// çarpıp RangeError fırlatabilir (QA ölçümü: ~5074 seviyede). Bu sınır ESKİDEN yalnızca
// `MAX_GUARD_BYTES`'in (8192 bayt, YALNIZCA DoS gerekçesiyle seçilmiş) o derinliğe erişmeye
// YETMEMESİNE güveniyordu (emniyet payı ~1.26x, 4038'e karşı 5074) — yani yinelenen-anahtar
// koruması, DEĞERİ herhangi bir an büyütülebilecek BAŞKA bir sabite GİZLİCE bağımlıydı. Aşağıdaki
// sınır bunu KOPARIR: tarayıcı, meşru bir GUARD.ok'un olabileceğinden (iç içe derinlik 2-3) çok
// daha cömert ama gerçek çağrı-yığını sınırından ÇOK ÖNCE, KENDİ KARARIYLA durur — MAX_GUARD_BYTES
// değişse bile bu sınır sabit kalır.
const MAX_SCAN_DEPTH = 200;

// docs/qa/g5-guard-json-contract.md P7b kapanışı — kapalı liste (allowlist), YENİ bir alan
// eklemek isteyen biri bu listeyi de güncellemek ZORUNDA kalsın diye kasıtlı olarak dar tutuldu.
// "approved_by" şu an hiçbir yerde OKUNMUYOR (yalnızca insana yönelik serbest metin gibi kabul
// edilir, "reason" ile aynı muamele) — ama gelecekte provenance için kullanılabilir diye
// şemaya önceden eklendi; davranışı YOK, yalnızca "bilinmeyen alan" reddinden muaf.
const ALLOWED_ROOT_KEYS = new Set(['scope', 'reason', 'approved_by', 'created_at', 'valid_minutes']);

// Kayıpsız ayrıştırma zorunluluğu (docs/qa/g5-guard-json-contract.md P7b kapanışı):
// `JSON.parse` yinelenen bir anahtarla karşılaşınca (herhangi bir iç içe seviyede) SESSİZCE
// sonuncu değeri alır — hata FIRLATMAZ. Bu, "insanın belgede gördüğü" ile "makinenin
// yetkilendirdiği" arasında Y1 ailesiyle AYNI SINIFTA (biçim insanı yanıltıyor, makine farklı
// bir şeyi uyguluyor) ama farklı bir mekanizmada bir uyumsuzluk açar: görünürde `"scope":
// [".../gate-check.cjs"]` yazan bir belge, ikinci bir `"scope"` anahtarıyla aslında
// `evil-payload.cjs`'i yetkilendirebilir. `JSON.parse`'a ULAŞMADAN, ham metin üzerinde çalışan
// bu küçük ve KESİN tarayıcı, sözdizimsel olarak geçerli her JSON belgesinde HER SEVİYEDE
// (kök + her iç içe nesne, kendi başına) yinelenen anahtar arar. Neden "her seviye" (yalnızca
// kök değil): belirsizlik burada da "sıfır erişime" çözülmeli — `scope` alanının kendisi kök
// düzeyinde tekilse ama içine gömülü (örn. gelecekte eklenebilecek bir iç içe yapı ya da bu
// turda `reason` gibi tip-doğrulanmayan bir alana gizlenmiş) bir yinelenme varsa, bunu YOK
// SAYMAK gelecekteki bir alanın aynı sınıfta yenilmesine kapı bırakır.
//
// Bu tarayıcı NEDEN kapalı bir problem (üç turdur kaybedilen markdown-ayrıştırma oyununa
// GİRMİYOR): JSON'un grameri RFC 8259 ile SONLU ve TAM olarak tanımlı — "bu bir başlık mı,
// yoksa başlık gibi görünen bir düzyazı mı" türünde YORUMA açık hiçbir durum yok (markdown'da
// "## Kapsam" hem gerçek başlık hem alıntı hem kod bloğu hem HTML yorumu içinde görünebiliyordu
// ve HANGİSİ olduğu bağlama bakmadan anlaşılamıyordu). JSON'da bir `{` HER ZAMAN bir nesne açar,
// bir `"..."` HER ZAMAN (kaçış kurallarıyla) bir dizedir — biçim tek bir şekilde okunur. Bu
// yüzden tarayıcı bir "yorum" motoru değil, RFC'nin kendisini birebir uygulayan bir durum
// makinesidir; doğruluğu "JSON grameri neyi tanımlıyorsa onu tanır, başka hiçbir şeyi
// tanımaz" ilkesiyle kanıtlanır (aşağıdaki `parseString`, dize İÇİNDEKİ `{`/`"scope"` gibi
// metinleri asla yapı sanmaz — çünkü ayraç/anahtar arayışı yalnızca STRING TOKENİ DIŞINDAYKEN
// yapılır, tıpkı gerçek bir JSON ayrıştırıcısı gibi).
//
// Alternatif değerlendirildi ve REDDEDİLDİ: `JSON.parse` sonucunu `JSON.stringify` ile geri
// yazıp girdinin boşluk-normalize hâliyle round-trip karşılaştırması. Yinelenen anahtarı da
// yakalardı (ikinci geçişte tek değer kalır, dolayısıyla stringify çıktısı orijinalden farklı
// olurdu) ama YANLIŞ POZİTİF üretirdi: sayı biçimleri (`30.0` `JSON.parse` sonrası `30` olarak
// stringify edilir → round-trip eşitsiz ama belge GEÇERLİ), `+1e1` gibi üstel gösterimler,
// anahtar SIRASI (`{"a":1,"b":2}` vs `{"b":2,"a":1}` — aynı anlam, farklı metin) hep meşru
// belgeleri reddederdi. Bu, "aşırı engelleme yok" ilkesini (brief §2.1) doğrudan ihlal eder.
// Kendi yazdığımız tarayıcı bunların HİÇBİRİNE dokunmaz — yalnızca anahtar KİMLİĞİNE bakar,
// değer biçimine/sırasına karışmaz.
function scanForDuplicateKeys(text) {
  const n = text.length;
  let i = 0;

  function ws() {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) i++;
      else break;
    }
  }
  function fail(msg) {
    const e = new Error(msg);
    e.__scanErr = true;
    throw e;
  }
  function parseString() {
    if (text[i] !== '"') fail('string bekleniyordu');
    i++;
    let out = '';
    while (true) {
      if (i >= n) fail('sonlandirilmamis dize');
      const c = text[i];
      if (c === '"') { i++; return out; }
      if (c === '\\') {
        i++;
        if (i >= n) fail('sonlandirilmamis kacis dizisi');
        const e = text[i];
        if (e === '"') { out += '"'; i++; }
        else if (e === '\\') { out += '\\'; i++; }
        else if (e === '/') { out += '/'; i++; }
        else if (e === 'b') { out += '\b'; i++; }
        else if (e === 'f') { out += '\f'; i++; }
        else if (e === 'n') { out += '\n'; i++; }
        else if (e === 'r') { out += '\r'; i++; }
        else if (e === 't') { out += '\t'; i++; }
        else if (e === 'u') {
          const hex = text.slice(i + 1, i + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('gecersiz \\u kacisi');
          out += String.fromCharCode(parseInt(hex, 16));
          i += 5;
        } else fail('gecersiz kacis dizisi: \\' + e);
      } else if (c.charCodeAt(0) < 0x20) {
        fail('dize icinde kacissiz kontrol karakteri');
      } else {
        out += c; i++;
      }
    }
  }
  function parseLiteral(word) {
    if (text.substr(i, word.length) !== word) fail('gecersiz sabit deger');
    i += word.length;
  }
  function isDigit(ch) { return ch >= '0' && ch <= '9'; }
  function parseNumber() {
    const start = i;
    if (text[i] === '-') i++;
    if (text[i] === '0') { i++; }
    else if (isDigit(text[i])) { i++; while (i < n && isDigit(text[i])) i++; }
    else fail('gecersiz sayi');
    if (text[i] === '.') {
      i++;
      if (!isDigit(text[i])) fail('gecersiz sayi (nokta sonrasi rakam yok)');
      while (i < n && isDigit(text[i])) i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!isDigit(text[i])) fail('gecersiz sayi (us sonrasi rakam yok)');
      while (i < n && isDigit(text[i])) i++;
    }
    if (i === start) fail('gecersiz sayi');
  }
  let duplicate = null;
  // `level`: yinelenen-anahtar raporlaması için SEMANTİK iç içe geçme seviyesi (yalnızca OBJECT
  // sınırlarında artar — orijinal davranış DEĞİŞMEDİ). `depth`: MAX_SCAN_DEPTH kontrolü için ayrı
  // bir GERÇEK ÖZYİNELEME SAYACI — hem object hem ARRAY iç içe geçmesinde artar, çünkü JS çağrı
  // yığını her iki durumda da büyür (QA'nın sızıntı denemesi tam olarak DİZİ iç içe geçmesiyle
  // RangeError üretmişti; `level` yalnızca object'lerde arttığı için diziler onu HİÇ artırmazdı ve
  // bir derinlik sınırı `level` üzerinden yazılsaydı diziler için işlemezdi).
  function parseObject(level, depth) {
    i++; // '{'
    ws();
    const seen = new Set();
    if (text[i] === '}') { i++; return; }
    while (true) {
      ws();
      const key = parseString();
      if (!duplicate && seen.has(key)) duplicate = { key, level };
      seen.add(key);
      ws();
      if (text[i] !== ':') fail('": " bekleniyordu');
      i++;
      ws();
      parseValue(level + 1, depth + 1);
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === '}') { i++; break; }
      fail('"," veya "}" bekleniyordu');
    }
  }
  function parseArray(level, depth) {
    i++; // '['
    ws();
    if (text[i] === ']') { i++; return; }
    while (true) {
      ws();
      parseValue(level, depth + 1);
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === ']') { i++; break; }
      fail('"," veya "]" bekleniyordu');
    }
  }
  function parseValue(level, depth) {
    if (depth > MAX_SCAN_DEPTH) {
      const e = new Error(`izin verilen en fazla ic ice derinlik (${MAX_SCAN_DEPTH}) asildi (seviye ${depth})`);
      e.__scanDepthExceeded = true;
      throw e;
    }
    ws();
    const c = text[i];
    if (c === '{') return parseObject(level, depth);
    if (c === '[') return parseArray(level, depth);
    if (c === '"') { parseString(); return; }
    if (c === 't') return parseLiteral('true');
    if (c === 'f') return parseLiteral('false');
    if (c === 'n') return parseLiteral('null');
    if (c === '-' || isDigit(c)) return parseNumber();
    fail('beklenmeyen jeton');
  }
  ws();
  parseValue(1, 1);
  ws();
  if (i !== n) fail('JSON degerinden sonra fazladan veri');
  return duplicate; // null: yinelenen anahtar yok; {key, level}: bulundu
}

function consume(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

const GUARD_FORMAT_HELP =
  'GUARD.ok artik bir JSON belgesi olmali, ornek:\n' +
  '{\n' +
  '  "scope": [".claude/hooks/gate-check.cjs", ".claude/hooks/_selftest.cjs"],\n' +
  '  "reason": "insan icin serbest metin - HICBIR ZAMAN taranmaz",\n' +
  '  "created_at": "2026-09-10T19:05:00+03:00",\n' +
  '  "valid_minutes": 30\n' +
  '}\n' +
  'Kurallar: kok bir JSON object olmali; "scope" dolu bir dize dizisi olmali ve HER eleman ' +
  'tam olarak ".claude/hooks/<ad>.cjs" ya da ".claude/settings.json" bicimine uymali (harf ' +
  'duyarsiz, tek eleman bile kurala uymazsa TUM kapsam gecersiz sayilir); "created_at" ISO 8601 ' +
  'dize olmali ve gelecekte olamaz; "valid_minutes" (opsiyonel, varsayilan ' + DEFAULT_VALID_MINUTES +
  ', en fazla ' + MAX_VALID_MINUTES + ') dakika sonra dosya otomatik silinir. "scope" DISINDAKI ' +
  'hicbir alan (ozellikle "reason") kapsam icin TARANMAZ - dilediginiz kadar serbest metin yazabilirsiniz. ' +
  'Izin verilen kok alanlar SADECE: scope, reason, approved_by, created_at, valid_minutes - baska ' +
  'HERHANGI bir kok alan (yazim hatasi dahil) belgeyi gecersiz kilar. Belgede (hangi seviyede olursa ' +
  'olsun) YINELENEN bir anahtar varsa belge TAMAMEN gecersizdir (JSON.parse sessizce sonuncuyu alir, ' +
  'bu gorunen ile yetkilendirilen arasinda uyusmazlik yaratabilecegi icin reddedilir).';

// Bir scope elemanının beyaz listeye uyup uymadığını kontrol eder; uyuyorsa normalize edilmiş
// (küçük harfli) hâlini döner, uymuyorsa null döner. Elemanlar YOL OLARAK ÇÖZÜLMEZ (resolve/
// realpath edilmez) — sabit beyaz liste dizeleridir; çözmek tur-4'te kapatılan junction/uzun-yol
// sınıfını geri açar. `\w` bayraksızdır (Unicode değil) — yalnızca ASCII harf/rakam/alt çizgi/
// tire kabul edilir, bu da ayrı bir Unicode-normalizasyon adımına gerek KALMADAN homoglif/
// aksanlı-karakter saldırılarını karakter sınıfı düzeyinde eler.
function normalizeScopeEntry(item) {
  if (typeof item !== 'string') return null;
  // B-2 KAPANIŞI (docs/qa/hook-borclari-contract.md, QA P8): bu satır FAZLALIKTIR, borç DEĞİL.
  // Aşağıdaki `/^\.claude\/hooks\/[\w-]+\.cjs$/i` regex'i ters bölü içeren HİÇBİR dizeyle
  // (regex sabit `/` bekliyor, `\w` ters bölüyü kapsamıyor) zaten eşleşmez — bu `indexOf('\\')`
  // kontrolü kaldırılsa bile aynı girdiler regex tarafından reddedilir (QA tur-4 taramasında
  // tek nokta mutasyonu 0 kırmızı verdi, ama regex'in kendisi bağımsız olarak doğrulandı).
  // Savunma-derinliği olarak KORUNUYOR (regex gelecekte değişirse ikinci bir engel kalsın diye).
  if (item.indexOf('\\') !== -1) return null; // ters bolu acikca reddedilir (regex zaten reddederdi)
  if (/^\.claude\/hooks\/[\w-]+\.cjs$/i.test(item)) return item.toLowerCase();
  if (/^\.claude\/settings\.json$/i.test(item)) return '.claude/settings.json';
  return null;
}

// GUARD.ok'u JSON olarak ayrıştırır. Dönüş biçimleri:
//   { ok:true, scope:Set }                              -> gecerli, kapsam kullanilabilir
//   { ok:false, expired:true, createdAtIso, validMinutes } -> suresi dolmus (CAGIRAN dosyayi SILMELI)
//   { ok:false, error:'...' }                            -> ayristirilamadi/semaya uymuyor (dosya SILINMEZ)
function parseGuardDoc(guardPath) {
  let buf;
  try { buf = fs.readFileSync(guardPath); } catch (e) {
    return { ok: false, error: 'dosya okunamadi: ' + e.message };
  }
  if (buf.length > MAX_GUARD_BYTES) {
    return { ok: false, error: `dosya cok buyuk (${buf.length} bayt > ${MAX_GUARD_BYTES} bayt ust siniri)` };
  }
  let text = buf.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // UTF-8 BOM soyulur (mesru editor artefakti)
  // NOT: burada NUL karakteri için kaçış dizisi YERİNE `String.fromCharCode(0)` kullanılıyor. Kaçış
  // dizisi, bu dosya araçlar arasında taşınırken bir kez HAM bir NUL baytına dönüştü ve git
  // dosyayı ikili saymaya başladı — yani bir güvenlik hook'unun diff'i incelenemez hâle geldi.
  // Bu biçim aynı şeyi yapar ama kodda hiçbir kaçış dizisi barındırmaz.
  // B-2 KAPANIŞI (QA P2): bu kontrol de FAZLALIKTIR, borç DEĞİL. Ham (kaçışsız) bir NUL baytı
  // içeren bir metin zaten `JSON.parse` tarafından reddedilir (V8: "Unexpected token" ya da
  // "Bad control character in string literal" — NUL bir JSON dize DEĞERİNİN içinde kaçışsız
  // bir kontrol karakteridir, RFC 8259 bunu yasaklar). QA tur-4 taramasında bu satır kaldırılınca
  // 0 kırmızı ölçüldü. Savunma-derinliği olarak KORUNUYOR: hatayı `JSON.parse`'ın jenerik hata
  // mesajından ÖNCE, daha OKUNABİLİR bir tanı ile yakalar (kullanıcı deneyimi, güvenlik değil).
  if (text.indexOf(String.fromCharCode(0)) !== -1) {
    return { ok: false, error: 'dosya metninde ham NUL bayt var' };
  }

  // P7b kapanışı: JSON.parse'a ULAŞMADAN önce ham metinde yinelenen anahtar ara (yukarıdaki
  // `scanForDuplicateKeys` yorumuna bkz). Tarayıcı SÖZDİZİMSEL OLARAK GEÇERSİZ bir belgede
  // (örn. yarım kalmış bir dize) kendi hatasını fırlatabilir — bu durumda tarayıcıya GÜVENME,
  // sessizce vazgeç (null say) ve aşağıdaki `JSON.parse` zaten kendi "gecerli JSON degil"
  // hatasını versin. Tarayıcının TEK sorumluluğu, SÖZDİZİMSEL OLARAK GEÇERLİ bir belgede
  // JSON.parse'ın kaybedeceği bir yinelenmeyi ONDAN ÖNCE yakalamaktır.
  let dup = null;
  try {
    dup = scanForDuplicateKeys(text);
  } catch (e) {
    if (e && e.__scanErr) {
      // GERÇEK bir JSON sözdizim hatası (parseString/parseNumber/vb. sırasında, örn. yarım kalmış
      // bir dize): JSON.parse zaten AYNI belgeyi kendi "geçerli JSON değil" hatasıyla reddedecek,
      // tarayıcının burada sessizce vazgeçmesi GÜVENLİDİR — asıl kabul/red kararını JSON.parse verir.
      dup = null;
    } else {
      // docs/qa/g5-guard-json-contract.md M2 kapanışı: ESKİDEN buradaki `catch (_) { dup = null; }`
      // HER hatayı (RangeError DAHİL) yutuyordu — yani tarayıcı GÖREVİNİ TAMAMLAYAMADIĞINDA (çok
      // derin iç içe bir yapıda JS çağrı yığını taşması, ya da MAX_SCAN_DEPTH'in yukarıdaki KASITLI
      // reddi) sessizce "yinelenen anahtar yok" SAYILIYORDU (fail-OPEN) — bu da korumayı
      // MAX_GUARD_BYTES'in DEĞERİNE gizlice bağımlı kılıyordu. Artık tarayıcının KENDİ sözdizim
      // hatası (__scanErr) DIŞINDAKİ her şey "tarayıcı çalışamadı" anlamına gelir ve belge
      // MAX_GUARD_BYTES'İN DEĞERİNDEN BAĞIMSIZ olarak FAIL-CLOSED reddedilir (dosya SİLİNMEZ).
      return {
        ok: false,
        error: `yinelenen-anahtar tarayicisi calisamadi (${e && e.message ? e.message : String(e)}) - ` +
          'tarayici gerekli kontrolu TAMAMLAYAMADIGI icin belge guvenlik geregi FAIL-CLOSED reddedildi',
      };
    }
  }
  if (dup) {
    return {
      ok: false,
      error: `belgede yinelenen anahtar var: ${JSON.stringify(dup.key)} (seviye ${dup.level}) - ` +
        'JSON.parse boyle bir belgede sessizce sonuncu degeri alir; bu, belgenin gorunen ile ' +
        'yetkilendirilen arasinda uyusmazlik yaratabilecegi icin fail-closed',
    };
  }

  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'gecerli JSON degil: ' + e.message };
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, error: 'kok deger bir JSON object olmali (dizi/dize/sayi/null degil)' };
  }

  // P7b kapanışı: bilinmeyen kök alan → fail-closed (brief'in "gizli alan" saldırısı önerisi).
  // Kapalı liste `__proto__` gibi own-property olarak beliren egzotik anahtarları da otomatik
  // reddeder (JSON.parse `__proto__`'yu prototipe DEĞİL own-property'ye yazar, bkz. §3 tablosu).
  for (const k of Object.keys(doc)) {
    if (!ALLOWED_ROOT_KEYS.has(k)) {
      const allowed = Array.from(ALLOWED_ROOT_KEYS).sort().join(', ');
      return { ok: false, error: `bilinmeyen kok alan: ${JSON.stringify(k)} (izin verilenler: ${allowed})` };
    }
  }

  // B-2 KAPANIŞI (docs/qa/hook-borclari-contract.md, QA P6 — YÜK TAŞIYAN, ÇİTLİ hâle getirildi):
  // bu kontrol OLMADAN `doc.scope` `undefined` kalabilir (ör. "scope" alanı hiç yoksa — kalan
  // izin verilen alanlar `created_at`/`reason`/`approved_by`/`valid_minutes` tek başlarına
  // ALLOWED_ROOT_KEYS'i geçer, P5'e HİÇ TAKILMAZ). Bu durumda aşağıdaki `for (const item of
  // doc.scope)` `TypeError: doc.scope is not iterable` fırlatır — YAKALANMAZ, süreç Node'un
  // varsayılanıyla **exit 1** ile çöker. Claude Code YALNIZCA exit 2'yi engelleme sayar (bu
  // deponun kayıtlı dersi: hook'lar `.js` uzantısı yüzünden iki feature boyunca aynı sınıftan
  // ölü koşmuştu) — yani bu kontrolün bozulma biçimi fail-closed DEĞİL, **fail-open**'dır. QA
  // tur-4 taramasında bu satır kaldırılınca ölçülen: "scope" alanı gerçekten hiç olmayan bir
  // belge (yalnızca izin verilen BAŞKA alanlarla) ENGELLEMİYORDU (exit 1 → sessiz izin). Çit:
  // _selftest.cjs "(D-NO-SCOPE-FIELD)" — YALNIZCA izin verilen kök alanları kullanan (böylece
  // P5'e HİÇ TAKILMAYAN), "scope" alanı gerçekten eksik bir belge. Mutasyon kanıtı (bu satırın
  // kaldırılması) docs/qa/hook-borclari-contract.md'de kayıtlıdır.
  if (!Array.isArray(doc.scope) || doc.scope.length === 0) {
    return { ok: false, error: '"scope" alani yok, dizi degil, ya da bos' };
  }
  const scope = new Set();
  for (const item of doc.scope) {
    const norm = normalizeScopeEntry(item);
    if (norm === null) {
      return { ok: false, error: `"scope" icinde beyaz listeye uymayan eleman: ${JSON.stringify(item)}` };
    }
    scope.add(norm);
  }

  // B-2 KAPANIŞI (QA P9 — KISMEN FAZLALIK): `created_at` bir dize DEĞİLSE (ör. sayı) bu kontrol
  // olmadan da çoğu durumda `Date.parse(doc.created_at)` (aşağıda) `NaN` üretip P10'a takılır —
  // ör. `created_at: 20260910` (sayı) → `String(20260910)` → `Date.parse("20260910")` → NaN.
  // AYIRT EDİCİ dar kenar durum (QA'nın tur-4 notu): `created_at: 2026` (yalnızca 4 haneli bir
  // SAYI) → `Date.parse("2026")` YIL olarak GEÇERLİ bir tarihe ayrışır (2026-01-01) — bu durumda
  // P10 YAKALAMAZ. Ama sonuç yine fail-closed KALIR: 2026-01-01, "şimdi"nin (2026 sonrası
  // herhangi bir ay) ÇOK gerisinde kalacağı için P14 (süre dolmuş kontrolü) devreye girer ve
  // belge yine reddedilir (yalnızca farklı bir hata koduyla: `expired`, `error` değil). Yani bu
  // kontrol kaldırılsa bile SIZINTI YOK — düşük risk borç olarak kaydedildi, çit:
  // _selftest.cjs "(D-CREATED-AT-NUMERIC-YEAR)".
  if (typeof doc.created_at !== 'string') {
    return { ok: false, error: '"created_at" alani yok ya da dize degil' };
  }
  const createdMs = Date.parse(doc.created_at);
  if (Number.isNaN(createdMs)) {
    return { ok: false, error: `"created_at" ayristirilamiyor: ${JSON.stringify(doc.created_at)}` };
  }
  const now = Date.now();
  if (createdMs > now + CLOCK_SKEW_TOLERANCE_MS) {
    return { ok: false, error: '"created_at" gelecekte (saat farki toleransini asiyor)' };
  }

  let validMinutes = DEFAULT_VALID_MINUTES;
  if (doc.valid_minutes !== undefined) {
    if (typeof doc.valid_minutes !== 'number' || !Number.isFinite(doc.valid_minutes) || doc.valid_minutes <= 0) {
      return { ok: false, error: '"valid_minutes" sayisal ve pozitif olmali' };
    }
    if (doc.valid_minutes > MAX_VALID_MINUTES) {
      return { ok: false, error: `"valid_minutes" ust siniri asiyor (max ${MAX_VALID_MINUTES})` };
    }
    validMinutes = doc.valid_minutes;
  }

  const expiresAt = createdMs + validMinutes * 60000;
  if (now > expiresAt) {
    return { ok: false, expired: true, createdAtIso: new Date(createdMs).toISOString(), validMinutes };
  }

  return { ok: true, scope };
}

// docs/qa/g5-onay-dosyasi-korumasi-contract.md Katman A — `docs/approvals/` altındaki HER
// dosya (GUARD.ok/DANGER.ok/PUSH.ok/G*.ok/README.md/archive/** dahil) bir güvenlik kapısı ya
// da o kapının kaydıdır. Bu kontrol `free` kontrolünden ÖNCE çalışır. `.guard-state.json` bir
// iç durum kaydı İDİ (yeni tasarımda hiç yazılmıyor, ama sert engeli savunma-derinliği için
// korunuyor) — kullanıcı onayı gerektiren bir şey DEĞİLDİR, `ask`'a düşürülmez, doğrudan ve
// koşulsuz sert engellenir. Diğer her şey `permissionDecision:'ask'` ile harness'e devredilir.
function ask(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

// docs/qa/g5-tur4-yol-kanoniklestirme-contract.md — K-A/K-B düzeltmesi. Hedefin gerçek dosya
// sistemi konumu `fs.realpathSync.native` ile çözülür (Windows `\\?\` uzun-yol öneki ve NTFS
// junction/symlink arkasındaki gerçek konum dahil). Fail-closed: realpath çözülemezse sessiz
// izin YERİNE sert engel.
function resolveCanonicalRel(f) {
  let candidate;
  try {
    candidate = path.resolve(f);
  } catch (_) {
    return null;
  }
  const pending = [];
  let anc = candidate;
  while (true) {
    let hit;
    try { hit = fs.existsSync(anc); } catch (_) { hit = false; }
    if (hit) break;
    const parent = path.dirname(anc);
    if (parent === anc) return null; // dosya sistemi köküne ulaşıldı, var olan ata yok
    pending.push(path.basename(anc));
    anc = parent;
  }
  let resolvedAnc;
  let resolvedRoot;
  try {
    resolvedAnc = fs.realpathSync.native(anc);
    resolvedRoot = fs.realpathSync.native(process.cwd());
  } catch (_) {
    return null;
  }
  const resolvedCandidate = pending.length
    ? path.join(resolvedAnc, ...pending.reverse())
    : resolvedAnc;
  return path.relative(resolvedRoot, resolvedCandidate).replace(/\\/g, '/');
}

readInput((j) => {
  const f = (j.tool_input && (j.tool_input.file_path || j.tool_input.path)) || '';
  if (!f) process.exit(0);
  const rel = resolveCanonicalRel(f);
  if (rel === null) {
    block(`Engellendi: "${f}" yolu çözülemedi (realpath hatası/döngü/erişim reddi/dosya sistemi köküne ulaşıldı). Hedefin gerçek dosya sistemi konumu doğrulanamadığı için güvenlik kararı verilemiyor — güvenli taraf: sert engel.`);
  }
  if (rel.startsWith('..')) process.exit(0); // proje dışı (çözülmüş yola göre): karışma

  const isApprovalsPath = /^docs\/approvals\//i.test(rel);
  if (isApprovalsPath) {
    const baseLower = rel.toLowerCase().split('/').pop();
    if (baseLower === '.guard-state.json') {
      block(`Engellendi: "${rel}" eski bir iç durum dosyasının adıdır (artık hiçbir yol tarafından yazılmıyor, savunma-derinliği için korunuyor). Hiçbir araç bunu doğrudan yazamaz/düzenleyemez.`);
    }
    ask(`UYARI: bu yazma bir GÜVENLİK KAPISINI AÇIYOR/DEĞİŞTİRİYOR ("${rel}", docs/approvals/ altında — onay/red dosyası ya da bu dizinin kaydı). Bunu SEN (kullanıcı) istemediysen REDDET.`);
  }

  // Harf duyarsız: NTFS büyük/küçük harf duyarsızdır, regex'in duyarlı olması
  // ".CLAUDE/HOOKS/..." gibi bir varyantla kapıyı tamamen atlatıyordu.
  // B-2 KAPANIŞI (QA P16 — FAZLALIK): `/i` bayrağı burada tek başına yük taşımaz, çünkü `rel`
  // zaten `resolveCanonicalRel()`'in ürünüdür ve `fs.realpathSync.native` Windows'ta dosya
  // sisteminin KENDİ kanonik (genelde küçük) harflerine çevirir — yani `rel` bu noktaya
  // ULAŞMADAN önce zaten normalize olmuştur. Savunma-derinliği olarak KORUNUYOR (realpath
  // çözümü bir gün değişirse/atlanırsa ikinci bir engel kalsın diye).
  const isGuarded = /^\.claude\/hooks\//i.test(rel) || /^\.claude\/settings\.json$/i.test(rel);
  if (isGuarded) {
    // B-2 KAPANIŞI (QA P17 — FAZLALIK): bu `exists()` kontrolü kaldırılsa bile aşağıdaki
    // `parseGuardDoc(GUARD_OK)` kendi `fs.readFileSync` çağrısında dosya yoksa
    // `{ ok:false, error:'dosya okunamadi: ...' }` döner ve akış `if (!parsed.ok)` dalına düşüp
    // yine ENGELLER (fail-closed) — yalnızca hata mesajı daha az spesifik olurdu ("dosya
    // okunamadi: ENOENT" vs "GUARD.ok gerekli"). Savunma-derinliği + daha okunabilir hata mesajı
    // için KORUNUYOR, güvenlik açığı değildir.
    if (!exists(GUARD_OK)) {
      block(`Engellendi: "${rel}" kendi güvenlik korumanızı değiştiriyor — docs/approvals/GUARD.ok (JSON, zaman pencereli — TEK KULLANIMLIK DEĞİL) gerekli. Kullanıcıya AskUserQuestion ile sor; onaylarsa GUARD.ok yaz ve komutu tekrar dene.\n\n${GUARD_FORMAT_HELP}`);
    }
    const parsed = parseGuardDoc(GUARD_OK);
    if (parsed.expired) {
      consume(GUARD_OK);
      block(`Engellendi: GUARD.ok süresi dolmuş (oluşturulma: ${parsed.createdAtIso}, geçerlilik: ${parsed.validMinutes} dk) — dosya silindi. Yeniden onay gerekir.\n\n${GUARD_FORMAT_HELP}`);
    }
    if (!parsed.ok) {
      block(`Engellendi: GUARD.ok ayrıştırılamadı (${parsed.error}). Dosya DEĞİŞTİRİLMEDİ, düzeltip tekrar deneyin.\n\n${GUARD_FORMAT_HELP}`);
    }
    const relLower = rel.toLowerCase();
    if (!parsed.scope.has(relLower)) {
      const scopeList = Array.from(parsed.scope).sort().join(', ') || '(boş)';
      block(`Engellendi: "${rel}" GUARD.ok kapsamı dışında. Ayrıştırılan kapsam (yalnızca "scope" alanından): [${scopeList}]. Kapsamı genişletmek için yeni bir GUARD.ok yazın.\n\n${GUARD_FORMAT_HELP}`);
    }
    // İzin verildi. Token TÜKETİLMEZ — zaman penceresi boyunca kapsamdaki her dosyaya
    // istenildiği kadar yazılabilir (docs/qa/g5-guard-json-contract.md §2.2, bilinçli takas).
    process.exit(0);
  }

  // Harf duyarsız (aynı sınıf): ".CLAUDE/agents/x.md" gibi bir varyant yanlışlıkla
  // G2.ok kontrolüne düşmemeli.
  const free = [/^docs\//i, /^\.claude\//i, /^assets\//i, /^README\.md$/i, /^\.gitignore$/i, /^CLAUDE\.md$/i, /^KURULUM\.md$/i];
  if (free.some((r) => r.test(rel))) process.exit(0);
  if (!exists('docs/approvals/G2.ok')) {
    block(`Engellendi: "${rel}" yazılamaz — G2 (mimari) onayı yok. Önce kullanıcıdan G2 onayı al ve docs/approvals/G2.ok oluştur.`);
  }
  process.exit(0);
});
