const test = require('node:test');
const assert = require('node:assert/strict');
const { check, stamp } = require('../scripts/stamp.js');

test('index.html script stamps match the current app.js / bandsheet.js (run `npm run stamp` if this fails)', () => {
  assert.deepEqual(check(), []);
});
test('stamp() adds, updates and is idempotent', () => {
  const bare = '<script src="bandsheet.js"></script>\n<script src="app.js?v=deadbeef00"></script>';
  const a = stamp(bare);
  assert.equal(a.stale.length, 2);
  assert.match(a.html, /src="bandsheet\.js\?v=[0-9a-f]{10}"/);
  assert.match(a.html, /src="app\.js\?v=[0-9a-f]{10}"/);
  assert.ok(!a.html.includes('deadbeef00'));
  assert.equal(stamp(a.html).stale.length, 0);
  assert.equal(stamp(a.html).html, a.html);
  assert.throws(() => stamp('<html></html>'), /no <script src/);
});
