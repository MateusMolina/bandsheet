#!/usr/bin/env node
/* Cache-busting for the static site. GitHub Pages / its CDN cache scripts for hours (index.html only 10 minutes), so a
 * browser can end up with a new index.html and an OLD app.js, which half-works (e.g. buttons that exist only in the new
 * page do nothing). Putting a content hash in each script URL (app.js?v=<hash>) makes any change fetch a fresh copy.
 * Run `npm run stamp` after editing app.js or tabsprint.js; the test suite fails if the stamps are stale.
 *   node scripts/stamp.js           rewrite the ?v= stamps in index.html
 *   node scripts/stamp.js --check   exit 1 if any stamp is stale */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const SCRIPTS = ['tabsprint.js', 'app.js'];
const hashOf = (f) => crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 10);

/** -> { html, stale:[{file, have, want}] } with html rewritten to the correct stamps */
function stamp(html) {
  const stale = [];
  for (const f of SCRIPTS) {
    const want = hashOf(f);
    const re = new RegExp(`(<script src=")${f.replace('.', '\\.')}(?:\\?v=([0-9a-f]+))?(")`);
    const m = re.exec(html);
    if (!m) throw new Error(`index.html has no <script src="${f}">`);
    if (m[2] !== want) stale.push({ file: f, have: m[2] || null, want });
    html = html.replace(re, `$1${f}?v=${want}$3`);
  }
  return { html, stale };
}

function check() { return stamp(fs.readFileSync(INDEX, 'utf8')).stale; }

if (require.main === module) {
  const cur = fs.readFileSync(INDEX, 'utf8');
  const { html, stale } = stamp(cur);
  if (process.argv.includes('--check')) {
    if (stale.length) { console.error('stale script stamps in index.html (run: npm run stamp):', JSON.stringify(stale)); process.exit(1); }
    console.log('stamps up to date');
  } else if (html !== cur) {
    fs.writeFileSync(INDEX, html);
    console.log('stamped:', stale.map((s) => `${s.file} ${s.have || '(none)'} -> ${s.want}`).join(', '));
  } else console.log('stamps already up to date');
}
module.exports = { stamp, check };
