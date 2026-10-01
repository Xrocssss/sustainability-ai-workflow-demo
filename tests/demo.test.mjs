import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('static preview has no active network, storage, or provider path', () => {
  const files = ['index.html', 'app.js', 'styles.css'];
  const source = files.map(read).join('\n');
  assert.doesNotMatch(source, /\/api\/|\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|process\.env|child_process|CAREER_OPS_ROOT|api[_-]?key|auth[_-]?token/i);
  assert.doesNotMatch(source, /<form\b|type=["']submit["']|<script[^>]+src=["']https?:/i);
  assert.match(read('index.html'), /Content-Security-Policy[^>]+connect-src 'none'/);
});

test('all fixture data is marked synthetic and the public actions stay disabled', () => {
  const html = read('index.html');
  const js = read('app.js');
  assert.match(html, /Synthetic records\. AI and document generation are disabled/);
  assert.match(html, /no live vacancies/i);
  assert.match(html, /Document generation is unavailable/);
  assert.match(js, /AI scoring is disabled in this public preview/);
  for (const name of ['Example Energy', 'Sample Finance', 'Demo Advisory']) assert.ok(js.includes(name));
});

test('only the reviewed project screenshot crops are bundled', () => {
  const assets = fs.readdirSync(path.join(root, 'assets')).sort();
  assert.deepEqual(assets, ['run-active-project-crop.png', 'run-desktop-project-crop.png']);
  for (const asset of assets) {
    const bytes = fs.readFileSync(path.join(root, 'assets', asset));
    assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.ok(bytes.length < 150_000);
  }
});

test('there is no private path or identifying candidate content in shipped text', () => {
  const source = ['index.html', 'app.js', 'styles.css', 'README.md', 'ATTRIBUTION.md'].map(read).join('\n');
  assert.doesNotMatch(source, /[A-Z]:\\|localhost|127\.0\.0\.1:3000|tailscale|\bSaad\b|\bKPMG\b|\bPwC\b|\bEY\b|\bgho_[A-Za-z0-9]+/i);
});
