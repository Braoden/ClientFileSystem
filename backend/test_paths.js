// Minimal self-check for the path-traversal guard. Run: node backend/test_paths.js
const assert = require('assert');
const path = require('path');

function safeJoin(base, ...parts) {
  const root = path.resolve(base);
  const target = path.resolve(base, ...parts);
  if (target !== root && !target.startsWith(root + path.sep)) {
    const err = new Error('Invalid path');
    err.status = 400;
    throw err;
  }
  return target;
}

const BASE = path.resolve('/data/clients');

// Legitimate paths resolve fine.
assert.ok(safeJoin(BASE, 'alice-123', 'profile.json').startsWith(BASE + path.sep));
assert.strictEqual(safeJoin(BASE), BASE);

// Traversal attempts must throw.
for (const evil of ['../settings.json', '..', '../../etc/passwd', 'a/../../escape', '/etc/passwd']) {
  assert.throws(() => safeJoin(BASE, evil), /Invalid path/, `expected reject: ${evil}`);
}

console.log('ok — safeJoin blocks traversal');
