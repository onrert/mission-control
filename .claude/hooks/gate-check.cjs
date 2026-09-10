// PreToolUse (Edit|Write): G2 onayı yokken kod dizinine yazılamaz.
// GUARD.ok: `.claude/hooks/**` ve `.claude/settings.json` kendi güvenlik zincirini (bu hook
// dahil) taşır. Bunlar G2'nin "mimari onayı" kapsamına GİRMEZ — meşru bakım (hook `.cjs`'e
// taşınması, kredi kapısı düzeltmesi gibi) G2 onayı olmadan da olur — ama G2.ok'a hiç bakmadan
// "docs/" gibi tamamen serbest bırakılmaları da yanlıştı (bkz. docs/qa/G5-guvenlik-denetimi-
// 2026-09-10.md K1: barındırılan CEO oturumu kendi hook'unu G2 onayı olmadan sessizce
// zayıflatabiliyordu). Bu yüzden ayrı, DANGER.ok/PUSH.ok ile aynı desende, tek kullanımlık bir
// onay: docs/approvals/GUARD.ok. `.claude/agents/**` ve `.claude/agent-memory/**` güvenlik
// sınırı değildir, serbest kalır.
//
// Madde 4 (docs/qa/g5-guvenlik-duzeltme-tur3-contract.md — onay yorgunluğu kusuru): GUARD.ok
// artık "her Edit/Write'ta kör tüketilen bayrak" değil, backtick ile açıkça dosya listeleyen
// bir onay metnidir. Token, metinde `*.cjs` / `.claude/settings.json` olarak anılan
// dosyaların TAMAMI için (kapsam) geçerlidir; kapsamdaki bir dosyaya yazmak token'ı HEMEN
// tüketmez — kapsamın TÜMÜ en az bir kez yazılınca (docs/approvals/.guard-state.json ile
// izlenir) tüketilir. Kapsam DIŞINDA bir guarded yola yazmak, token geçerli olsa bile
// reddedilir (token bir DEĞİŞİKLİĞİ yetkilendirir, bir YAZMAYI değil). Kapsam çıkarılamazsa
// (backtick'li dosya adı yoksa) fail-closed: hiçbir guarded yazmaya izin verilmez.
//
// Y1 düzeltmesi tur 1 (docs/qa/g5-tur5-kapsam-ve-selftest-contract.md): önceki `parseGuardScope`
// metnin TAMAMINDAKİ backtick'li adları kapsam sayıyordu; tur 1 bunu "## Kapsam" başlığının
// bloğuna (bir sonraki "##" başlığına ya da dosya sonuna kadar) daralttı.
//
// Y1 düzeltmesi tur 2 (docs/qa/g5-tur5-kapsam-siniri-tur2-contract.md): tur 1'in "blok NEREDE
// BİTER" tanımı, başlığa BENZEYEN her şeye yeniliyordu (başlıksız kuyruk düzyazı, "# Gerekçe"
// h1, "**Gerekçe**" kalın sözde-başlık) — QA gerçek bir CEO onay metniyle, "kapsam dışıdır" diye
// AÇIKÇA reddedilen iki dosyanın sessizce (exit 0, kart yok) yetkilendirildiğini gösterdi. Bu
// çit ikinci kez aynı aileye ("nasıl biçimlendiği sayılıyor") yenildi; bu yüzden tur 2 "nerede
// biter" sorusunu TERK EDİP "hangi satırlar SAYILIR" sorusuna geçti (kapalı biçim / beyaz
// liste): kapsam adları YALNIZCA "## Kapsam" başlığının hemen ardından (boş satırlar şeffaf)
// gelen, `-`/`*` ile başlayan ve her satırında TEK backtick'li ad taşıyan liste maddelerinden
// okunur. Liste maddesi OLMAYAN ilk boş-olmayan satır taramayı bitirir — o satırın başlık,
// kalın, tablo ya da düzyazı olması ÖNEMSİZDİR, çünkü hiçbiri liste maddesi değildir; kalan
// metin hiç ayrıştırılmaz. Kapalı biçimi bozan bir madde (ör. iki ad tek satırda, ya da bir
// dışlama notu madde işaretiyle yazılmış: "- Not: `x.cjs` kapsam dışı") TÜM kapsamı geçersiz
// kılar — o ana kadar toplanan geçerli adlar dahil (belirsizlik her zaman sıfır erişime
// çözülür). Başlık yok / birden fazla kez geçiyorsa (belirsiz) / hemen ardından liste hiç
// gelmiyorsa: fail-closed (boş kapsam → hiçbir guarded yazmaya izin yok). Başlık harf/boşluk
// varyantlarına duyarsızdır (`## Kapsam`, `##Kapsam`, `## KAPSAM` hepsi tanınır) — bu depoda
// Windows harf duyarsızlığı dört kez tuzak oldu, aynı disiplin başlık eşleştirmesine de
// uygulanıyor.
const path = require('path');
const fs = require('fs');
const { readInput, exists, block } = require('./_common.cjs');

const GUARD_OK = 'docs/approvals/GUARD.ok';
const GUARD_STATE = 'docs/approvals/.guard-state.json';

function consume(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

// GUARD.ok metninde YALNIZCA "## Kapsam" başlığının hemen ardından gelen, kapalı biçimli
// (`- \`ad.cjs\`` / `* \`ad.cjs\``, satır başına TEK ad) liste maddelerini kapsam kaynağı
// sayar. Blok dışındaki (ör. gerekçe/açıklama) backtick'li adlar kapsam SAYILMAZ; biçimi bozan
// herhangi bir madde TÜM kapsamı geçersiz kılar. Başlık yok / birden fazla (belirsiz) / hemen
// ardından liste yok / biçim bozuk → fail-closed (boş küme — çağıran taraf boş kümeyi "hiçbir
// yola izin yok" olarak yorumlar).
function parseGuardScope(guardPath) {
  let text = '';
  try { text = fs.readFileSync(guardPath, 'utf8'); } catch (_) { return new Set(); }
  const scope = new Set();

  const lines = text.split(/\r\n|\r|\n/);
  const kapsamHeaderRe = /^\s*##\s*kapsam\s*$/i;
  const listItemRe = /^\s*[-*]\s+(.*)$/;
  const strictItemRe = /^`[^`]+`$/; // kapalı biçim: satır TAM OLARAK tek backtick'li ad
  const blankRe = /^\s*$/;

  let headerLine = -1;
  let headerCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (kapsamHeaderRe.test(lines[i])) {
      headerCount++;
      if (headerCount === 1) headerLine = i;
    }
  }
  if (headerCount !== 1) return scope; // başlık yok ya da belirsiz (>1) → fail-closed

  let matchedAnyItem = false;
  for (let i = headerLine + 1; i < lines.length; i++) {
    if (blankRe.test(lines[i])) continue; // boş satırlar şeffaf, hiçbir veri taşımaz
    const m = listItemRe.exec(lines[i]);
    if (!m) break; // liste maddesi OLMAYAN ilk boş-olmayan satır → blok biter (içeriği önemsiz)
    matchedAnyItem = true;
    const rest = m[1].trim();
    if (!strictItemRe.test(rest)) return new Set(); // kapalı biçimi bozan madde → TÜM kapsam geçersiz
    const tok = rest.slice(1, -1).trim();
    if (/^[\w-]+\.cjs$/i.test(tok)) scope.add(('.claude/hooks/' + tok).toLowerCase());
    else if (/^\.claude\/settings\.json$/i.test(tok)) scope.add('.claude/settings.json');
  }
  if (!matchedAnyItem) return new Set(); // başlık var ama hemen ardından liste hiç gelmedi → fail-closed
  return scope;
}

function loadGuardState(scopeKey) {
  try {
    const s = JSON.parse(fs.readFileSync(GUARD_STATE, 'utf8'));
    if (s && s.scopeKey === scopeKey && Array.isArray(s.touched)) return s;
  } catch (_) {}
  return { scopeKey, touched: [] };
}

function saveGuardState(state) {
  try { fs.writeFileSync(GUARD_STATE, JSON.stringify(state)); } catch (_) {}
}

function clearGuardState() {
  try { fs.unlinkSync(GUARD_STATE); } catch (_) {}
}

// docs/qa/g5-onay-dosyasi-korumasi-contract.md Katman A — `docs/approvals/` altındaki HER
// dosya (GUARD.ok/DANGER.ok/PUSH.ok/G*.ok/README.md/archive/** dahil) bir güvenlik kapısı ya
// da o kapının kaydıdır. `free` listesi `docs/` yolunun TAMAMINI serbest bıraktığı için bu
// dizin hiçbir hook tarafından korunmuyordu (docs/qa/G5-guvenlik-denetimi-2026-09-10-tur3.md
// §0) — barındırılan bir oturum kendi onay dosyasını kullanıcıya hiç sormadan üretebiliyordu.
// Bu kontrol `free` kontrolünden ÖNCE çalışır. `.guard-state.json` (GUARD.ok tüketim izleyicisi)
// bir iç durum kaydıdır, kullanıcı onayı gerektiren bir şey DEĞİLDİR — o yüzden `ask`'a
// düşürülmez, doğrudan ve koşulsuz sert engellenir. Diğer her şey `permissionDecision:'ask'`
// ile harness'e devredilir (bkz. ask() — sözleşme §c: headless bir oturumda bu otomatik REDDE
// dönüşür, interaktif bir oturumda kullanıcıya bir onay kartı gösterir).
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

// docs/qa/g5-tur4-yol-kanoniklestirme-contract.md — K-A/K-B düzeltmesi. Önceki kod hedefi salt
// dize düzeyinde (`path.relative(cwd, path.resolve(f))`) değerlendiriyordu; bu, Windows'un
// `\\?\` uzun-yol öneğini normalize edemiyordu (ne "proje dışı" ne "docs/approvals içinde"
// sayılıp sessizce izin veriliyordu) VE bir NTFS junction/symlink'in ARKASINDA gerçekte nereye
// yazıldığını hiç göremiyordu. `write-gate.ts`'in `resolveInsideRoot`'undaki desen (en yakın var
// olan atayı bul, `fs.realpathSync.native` ile çöz) buraya taşındı — hedef henüz var olmayan
// yeni bir `.ok` dosyası olabileceği için ayrıca "en yakın var olan ata" adımı gerekli.
// Fail-closed: realpath çözülemezse (ELOOP, erişim reddi, kopuk reparse point, dosya sistemi
// köküne ulaşılması) sessiz izin YERİNE sert engel — gerekçe sözleşme §2'de.
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
      block(`Engellendi: "${rel}" GUARD.ok tüketim durumunu izleyen iç bir kayıt dosyasıdır. Hiçbir araç bunu doğrudan yazamaz/düzenleyemez.`);
    }
    ask(`UYARI: bu yazma bir GÜVENLİK KAPISINI AÇIYOR/DEĞİŞTİRİYOR ("${rel}", docs/approvals/ altında — onay/red dosyası ya da bu dizinin kaydı). Bunu SEN (kullanıcı) istemediysen REDDET.`);
  }

  // Harf duyarsız (docs/qa/G5-guvenlik-denetimi-2026-09-10-tur2.md K1-YENİ): NTFS büyük/küçük
  // harf duyarsızdır, regex'in duyarlı olması ".CLAUDE/HOOKS/..." gibi bir varyantla kapıyı
  // tamamen atlatıyordu.
  const isGuarded = /^\.claude\/hooks\//i.test(rel) || /^\.claude\/settings\.json$/i.test(rel);
  if (isGuarded) {
    if (!exists(GUARD_OK)) {
      block(`Engellendi: "${rel}" kendi güvenlik korumanızı değiştiriyor — docs/approvals/GUARD.ok (tek kullanımlık, kapsamı backtick ile listeleyen) gerekli. Kullanıcıya AskUserQuestion ile sor; onaylarsa GUARD.ok yaz ve komutu tekrar dene.`);
    }
    const scope = parseGuardScope(GUARD_OK);
    const relLower = rel.toLowerCase();
    if (scope.size === 0 || !scope.has(relLower)) {
      block(`Engellendi: "${rel}" GUARD.ok kapsamı dışında. GUARD.ok yalnızca "## Kapsam" başlığı altında backtick ile andığı .cjs/.claude/settings.json dosyalarını kapsar (madde 4 + Y1 düzeltmesi) — bu yol o bölümde yok (ya da "## Kapsam" başlığı hiç yok/birden fazla/boş). Kapsamı genişletmek için yeni/güncel bir GUARD.ok gerekir.`);
    }
    const scopeKey = JSON.stringify(Array.from(scope).sort());
    const state = loadGuardState(scopeKey);
    if (!state.touched.includes(relLower)) state.touched.push(relLower);
    const allTouched = Array.from(scope).every((p) => state.touched.includes(p));
    if (allTouched) {
      consume(GUARD_OK);
      clearGuardState();
    } else {
      saveGuardState(state);
    }
    process.exit(0);
  }

  // Harf duyarsız (aynı K1-YENİ sınıfı): ".CLAUDE/agents/x.md" gibi bir varyant yanlışlıkla
  // G2.ok kontrolüne düşmemeli.
  const free = [/^docs\//i, /^\.claude\//i, /^assets\//i, /^README\.md$/i, /^\.gitignore$/i, /^CLAUDE\.md$/i, /^KURULUM\.md$/i];
  if (free.some((r) => r.test(rel))) process.exit(0);
  if (!exists('docs/approvals/G2.ok')) {
    block(`Engellendi: "${rel}" yazılamaz — G2 (mimari) onayı yok. Önce kullanıcıdan G2 onayı al ve docs/approvals/G2.ok oluştur.`);
  }
  process.exit(0);
});
