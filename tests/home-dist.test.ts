// Checks the built home page against the content: every relation badge in the worked
// path must be backed by a relation on the featured dataset AND task. Needs `npm run build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { FEATURED_PATH } from '../src/data/featured.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = join(root, 'dist', 'index.html');

test('built home page: worked path badges match recorded relations', { skip: !existsSync(html) && 'dist/ not built' }, () => {
  const page = readFileSync(html, 'utf8');
  const section = page.slice(page.indexOf('data-featured-path'), page.indexOf('id="legend-h"'));
  assert.ok(section.includes(`data-dataset="${FEATURED_PATH.datasetId}"`), 'path uses the explicit dataset id');
  assert.ok(section.includes(`data-task="${FEATURED_PATH.taskId}"`), 'path uses the explicit task id');
  assert.ok(!/biopsy WSIs/.test(section), 'no hard-coded unit text');

  const methodsDir = join(root, 'src', 'content', 'methods');
  const expected = new Map<string, string[]>();
  for (const f of readdirSync(methodsDir)) {
    const m = parse(readFileSync(join(methodsDir, f), 'utf8'));
    if (m.review_status !== 'verified') continue;
    const uses = (m.datasets ?? [])
      .filter((r: any) => r.dataset === FEATURED_PATH.datasetId && r.task === FEATURED_PATH.taskId)
      .map((r: any) => r.use);
    expected.set(m.id, [...new Set<string>(uses)]);
  }

  const shown = [...section.matchAll(/data-method="([^"]+)" data-uses="([^"]*)"/g)];
  assert.ok(shown.length > 0, 'path lists methods');
  for (const [, id, uses] of shown) {
    const got = uses.split(' ').filter(Boolean).sort();
    assert.deepEqual(got, (expected.get(id) ?? []).sort(), `${id}: badges must equal its relations on this dataset+task`);
  }
  const anyEvaluation = [...expected.values()].some((u) => u.includes('evaluation'));
  assert.equal(section.includes('data-no-evaluation'), !anyEvaluation, '"not recorded yet" notice iff no evaluation');
});
