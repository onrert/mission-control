// Ortak yardımcılar: stdin'den hook JSON'unu okur.
const fs = require('fs');
function readInput(cb) {
  let d = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (d += c));
  process.stdin.on('end', () => {
    let j = {};
    try { j = JSON.parse(d || '{}'); } catch (_) {}
    cb(j);
  });
}
function exists(p) { try { return fs.existsSync(p); } catch (_) { return false; } }
function block(msg) { console.error(msg); process.exit(2); }
module.exports = { readInput, exists, block };
