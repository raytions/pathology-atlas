// Published prostate ROI-level Gleason batch: the public build must let a reader click from the
// prostate topic to the task, the dataset and CONCH's evidence row. Needs `npm run build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const page = (p: string) => readFileSync(join(dist, p, 'index.html'), 'utf8');
// Links may carry a base path (e.g. /pathology-atlas) on GitHub Pages builds.
const linksTo = (html: string, path: string) => new RegExp(`href="(?:/[^"/]+)?${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(html);

const anchor = 'rel-sicapv2-evaluation-gleason-pattern-classification';

test('prostate topic -> task -> SICAPv2 -> CONCH evidence row', { skip: !existsSync(join(dist, 'organs')) && 'dist/ not built' }, () => {
  const organ = page('organs/prostate');
  assert.ok(linksTo(organ, '/tasks/gleason-pattern-classification/'), 'prostate topic links to the task');
  assert.ok(linksTo(organ, '/datasets/sicapv2/'), 'prostate topic lists SICAPv2');

  const task = page('tasks/gleason-pattern-classification');
  assert.ok(linksTo(task, '/datasets/sicapv2/'), 'task page links to SICAPv2');
  assert.ok(linksTo(task, `/methods/conch/#${anchor}`), 'task page links to the CONCH relation record');

  const ds = page('datasets/sicapv2');
  assert.ok(linksTo(ds, `/methods/conch/#${anchor}`), 'dataset page links to the CONCH relation record');
  assert.ok(/data-method="conch" data-uses="evaluation"/.test(ds), 'CONCH is listed with an evaluation relation only');

  const conch = page('methods/conch');
  assert.ok(conch.includes(`id="${anchor}"`), 'CONCH page has the relation anchor');
  assert.ok(conch.includes('href="#src-conch-preprint"'), 'relation row points to its evidence source');
  assert.ok(conch.includes('id="src-conch-preprint"'), 'evidence source is listed on the page');
  assert.ok(/Table 5/.test(conch) && /Table 18/.test(conch), 'evidence location (tables) is shown');
});
