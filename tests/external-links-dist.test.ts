// External links (sources, papers, code, weights) open in a new tab; internal navigation does not.
// Needs `npm run build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

test('built pages: every external link opens in a new tab, internal links do not', { skip: !existsSync(dist) && 'dist/ not built' }, () => {
  let external = 0;
  for (const f of readdirSync(dist, { recursive: true }) as string[]) {
    if (!f.endsWith('.html')) continue;
    for (const [a] of readFileSync(join(dist, f), 'utf8').matchAll(/<a\s[^>]*>/g)) {
      const isExternal = /href="https?:\/\//.test(a);
      if (isExternal) external++;
      assert.equal(/target="_blank"/.test(a), isExternal, `${f}: ${a}`);
      if (isExternal) assert.ok(/rel="[^"]*noopener/.test(a), `${f}: ${a} lacks rel=noopener`);
    }
  }
  assert.ok(external > 0, 'found external links to check');
});
