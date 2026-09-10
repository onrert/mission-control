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
const path = require('path');
const fs = require('fs');
const { readInput, exists, block } = require('./_common.cjs');

const GUARD_OK = 'docs/approvals/GUARD.ok';
const GUARD_STATE = 'docs/approvals/.guard-state.json';

function consume(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

// GUARD.ok metnindeki backtick-alıntılı `*.cjs` / `.claude/settings.json` dosya adlarını
// kapsam olarak çıkarır. Backtick dışı serbest metin kapsam SAYILMAZ.
function parseGuardScope(guardPath) {
  let text = '';
  try { text = fs.readFileSync(guardPath, 'utf8'); } catch (_) { return new Set(); }
  const scope = new Set();
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(text))) {
    const tok = m[1].trim();
    if (/^[\w-]+\.cjs$/i.test(tok)) scope.add(('.claude/hooks/' + tok).toLowerCase());
    else if (/^\.claude\/settings\.json$/i.test(tok)) scope.add('.claude/settings.json');
  }
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

readInput((j) => {
  const f = (j.tool_input && (j.tool_input.file_path || j.tool_input.path)) || '';
  if (!f) process.exit(0);
  let rel = path.relative(process.cwd(), path.resolve(f)).replace(/\\/g, '/');
  if (rel.startsWith('..')) process.exit(0); // proje dışı: karışma

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
      block(`Engellendi: "${rel}" GUARD.ok kapsamı dışında. GUARD.ok yalnızca içinde backtick ile andığı .cjs/.claude/settings.json dosyalarını kapsar (madde 4) — bu yol o listede yok. Kapsamı genişletmek için yeni/güncel bir GUARD.ok gerekir.`);
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
