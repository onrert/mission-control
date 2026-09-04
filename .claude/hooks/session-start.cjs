// SessionStart / PostCompact: kaldığımız yeri bağlama enjekte eder (stdout = context).
const fs = require('fs');
const path = require('path');
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } }
const out = [];
const prog = read('docs/progress.md').trim().split('\n').filter(Boolean);
if (prog.length > 3) out.push('## progress.md (son 30 satır)\n' + prog.slice(-30).join('\n'));
const fdir = 'docs/features';
if (fs.existsSync(fdir)) {
  const open = [];
  for (const f of fs.readdirSync(fdir)) {
    if (!f.endsWith('.md') || f.startsWith('F-000')) continue;
    const t = read(path.join(fdir, f));
    const s = (t.match(/^status:\s*(.+)$/m) || [])[1];
    if (s && s.trim() !== 'done') open.push(`- ${f}: ${s.trim()}`);
  }
  if (open.length) out.push("## Açık feature'lar\n" + open.join('\n'));
}
const adir = 'docs/approvals';
if (fs.existsSync(adir)) {
  const g = fs.readdirSync(adir).filter((f) => f.endsWith('.ok')).sort();
  out.push('## Onaylı kapılar: ' + (g.length ? g.join(', ') : 'henüz yok'));
}
const qa = read('docs/qa/latest.md');
const k = (qa.match(/KARAR:\s*(\S+)/) || [])[1];
if (k && k !== 'YOK') out.push('## Son QA kararı: ' + k);
const bl = read('docs/blockers.md').trim().split('\n').filter(Boolean);
if (bl.length > 3) out.push('## blockers.md (son 10 satır)\n' + bl.slice(-10).join('\n'));
if (out.length) console.log('[app-factory durum]\n' + out.join('\n\n'));
