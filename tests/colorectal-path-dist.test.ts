// Published colorectal batch: colorectum topic -> tissue classification task -> CRC-VAL-HE-7K ->
// evidence rows on CONCH, UNI and H0-mini. Needs `npm run build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const page = (p: string) => readFileSync(join(dist, p, 'index.html'), 'utf8');
// Links may carry a base path (e.g. /pathology-atlas) on GitHub Pages builds.
const linksTo = (html: string, path: string) => new RegExp(`href="(?:/[^"/]+)?${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(html);

const anchor = 'rel-crc-val-he-7k-evaluation-colorectal-tissue-classification';

test('colorectum topic -> task -> CRC-VAL-HE-7K -> model evidence rows', { skip: !existsSync(join(dist, 'organs')) && 'dist/ not built' }, () => {
  const organ = page('organs/colorectum');
  assert.ok(linksTo(organ, '/tasks/colorectal-tissue-classification/'), 'colorectum topic links to the task');
  assert.ok(linksTo(organ, '/datasets/nct-crc-he-100k/'), 'colorectum topic lists NCT-CRC-HE-100K');
  assert.ok(linksTo(organ, '/datasets/crc-val-he-7k/'), 'colorectum topic lists CRC-VAL-HE-7K');

  const task = page('tasks/colorectal-tissue-classification');
  assert.ok(linksTo(task, '/datasets/crc-val-he-7k/'), 'task page links to CRC-VAL-HE-7K');

  const ds = page('datasets/crc-val-he-7k');
  for (const [m, src, table] of [['conch', 'conch-preprint', /Table 19/], ['uni', 'uni-preprint', /Extended Data Table 27/], ['h0-mini', 'h0mini-preprint', /Table 1/]] as const) {
    assert.ok(linksTo(ds, `/methods/${m}/#${anchor}`), `dataset page links to the ${m} relation record`);
    assert.ok(new RegExp(`data-method="${m}" data-uses="evaluation"`).test(ds), `${m} is listed with an evaluation relation only`);
    const mp = page(`methods/${m}`);
    // Check the CRC relation row itself, not the whole page: other rows cite the same source.
    const row = mp.match(new RegExp(`<tr id="${anchor}"[\\s\\S]*?</tr>`))?.[0];
    assert.ok(row, `${m} page has the relation row`);
    assert.ok(row.includes(`href="#src-${src}"`), `${m} CRC row links its evidence source`);
    assert.ok(table.test(row), `${m} CRC row shows the evidence location`);
    assert.ok(mp.includes(`id="src-${src}"`), `${m} evidence source is listed on the page`);
  }
  assert.ok(!/data-method="h-optimus-0" data-uses="evaluation"/.test(ds), 'H-optimus-0 has no CRC relation (conflicting description)');
});

test('dataset cards show verified patch counts', { skip: !existsSync(join(dist, 'organs')) && 'dist/ not built' }, () => {
  const organ = page('organs/colorectum');
  assert.ok(organ.includes('7,180 patches'), 'CRC-VAL-HE-7K card shows its patch count');
  assert.ok(organ.includes('100,000 patches from 86 source slides'), 'NCT-CRC-HE-100K card names 86 as source slides');
  // The scale tag must not read as 86 downloadable slides (the summary text may still say "cut from ... 86 slides").
  assert.ok(!/86 slides(?: ·|<\/span>)/.test(organ), 'NCT-CRC-HE-100K scale tag does not suggest 86 downloadable slides');
  const ds = page('datasets/nct-crc-he-100k');
  assert.ok(ds.includes('Source slides (not released)'), 'dataset page labels the slide count as a source count');
});

test('the four models from #8 are public', { skip: !existsSync(join(dist, 'methods')) && 'dist/ not built' }, () => {
  for (const m of ['h-optimus-0', 'h0-mini', 'prov-gigapath', 'phikon']) {
    assert.ok(existsSync(join(dist, 'methods', m, 'index.html')), `${m} page is built`);
  }
});

test('draft colorectal polyp path stays off the public build', { skip: !existsSync(join(dist, 'organs')) && 'dist/ not built' }, () => {
  for (const p of ['datasets/mhist', 'tasks/colorectal-polyp-classification', 'diseases/colorectal-polyps', 'methods/kather2019-vgg19']) {
    assert.ok(!existsSync(join(dist, p, 'index.html')), `${p} is draft and not built`);
  }
});
