// Discovery pipeline helpers: family detection, catalogue matching, inbox merging.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classify,
  familyKey,
  mergeInbox,
  relationToCatalogue,
  renderCandidates,
  suggestAction,
  toCandidate,
  START,
  END,
  type CatalogueEntry,
  sameUrl,
  type RawHit,
} from '../scripts/lib/discover-core.ts';

const catalogue: CatalogueEntry[] = [
  { id: 'uni', title: 'UNI', shortName: 'UNI', urls: ['https://huggingface.co/MahmoodLab/UNI'], status: 'verified' },
  { id: 'virchow', title: 'Virchow', shortName: 'Virchow', urls: ['https://huggingface.co/paige-ai/Virchow'], status: 'verified' },
  { id: 'phikon-v2', title: 'Phikon-v2', urls: ['https://huggingface.co/owkin/phikon-v2'], status: 'verified' },
];
const hf = (name: string, extra: Partial<RawHit> = {}): RawHit => ({ source: 'Hugging Face', via: 't', name, url: `https://huggingface.co/${name}`, text: name, ...extra });

test('family keys group versions and size variants', () => {
  assert.equal(familyKey('MahmoodLab/UNI2-h'), 'uni');
  assert.equal(familyKey('UNI'), 'uni');
  assert.equal(familyKey('paige-ai/Virchow2'), 'virchow');
  assert.equal(familyKey('owkin/phikon'), familyKey('Phikon-v2'));
  assert.equal(familyKey('bioptimus/H-optimus-1'), familyKey('H-optimus-0'));
  assert.notEqual(familyKey('CONCH'), familyKey('UNI'));
});

test('catalogue matching: same resource, family member, unrelated', () => {
  assert.equal(relationToCatalogue(hf('MahmoodLab/UNI'), catalogue).kind, 'same');
  // A new version must not be hidden as an already-catalogued resource.
  assert.notEqual(relationToCatalogue(hf('owkin/phikon-v3'), catalogue).kind, 'same');
  assert.ok(sameUrl('https://arxiv.org/abs/2501.16652v1', 'https://arxiv.org/abs/2501.16652'));
  assert.ok(!sameUrl('https://github.com/bioptimus/releases/tree/main/models/h-optimus/v0', 'https://github.com/bioptimus/releases/tree/main/models/h-optimus/v1'));
  const fam = relationToCatalogue(hf('MahmoodLab/UNI2-h'), catalogue);
  assert.equal(fam.kind, 'family');
  assert.equal(fam.match?.id, 'uni');
  assert.equal(relationToCatalogue(hf('bioptimus/H-optimus-0'), catalogue).kind, 'none');
});

test('suggested actions never claim verification', () => {
  assert.equal(suggestAction(hf('x/y'), 'same'), 'extend');
  assert.equal(suggestAction(hf('x/y'), 'family'), 'verify');
  assert.equal(suggestAction(hf('x/y'), 'none'), 'new');
  const paperOnly: RawHit = { source: 'arXiv', via: 'q', name: 'Some model', url: 'https://arxiv.org/abs/1', text: 'foundation model' };
  assert.equal(suggestAction(paperOnly, 'none'), 'defer');
  const withCode = { ...paperOnly, links: ['https://github.com/a/b'] };
  assert.equal(suggestAction(withCode, 'none'), 'new');
});

test('candidate rows carry every inbox field and flag the variant relation', () => {
  const c = toCandidate([hf('MahmoodLab/UNI2-h', { text: 'self-supervised foundation model pathology' })], catalogue, '2026-11-20');
  assert.equal(c.type, 'foundation model');
  assert.match(c.relation, /variant of catalogued `uni`/);
  assert.equal(c.action, 'verify');
  const md = renderCandidates([c]);
  for (const field of ['Discovered', 'Type', 'Organ / task scope', 'Discovery source', 'Primary links', 'Duplicate / version relation', 'Suggested action', 'Missing evidence', 'Fit for next batch']) {
    assert.ok(md.includes(`| ${field}`), field);
  }
});

test('vision-language and task-specific classification', () => {
  assert.equal(classify('contrastive image-text pretraining with captions'), 'vision-language model');
  assert.equal(classify('a multiple instance learning model for grading'), 'task-specific model');
  assert.equal(classify('a viewer application'), 'other');
});

test('regenerating an inbox keeps reviewer notes outside the generated block', () => {
  const first = mergeInbox(null, 'auto v1', '# Inbox');
  const edited = first.replace('# Inbox', '# Inbox\n\nReviewer: picked #2 for the next batch.') + '\n## Triage\nkeep\n';
  const second = mergeInbox(edited, 'auto v2', '# Inbox');
  assert.ok(second.includes('Reviewer: picked #2'));
  assert.ok(second.includes('## Triage\nkeep'));
  assert.ok(second.includes(`${START}\nauto v2\n${END}`));
  assert.ok(!second.includes('auto v1'));
});

test('discovery script only writes to docs/inbox, never to src/content', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'discover-models.ts'), 'utf8');
  assert.match(src, /'docs', 'inbox'/);
  const writes = [...src.matchAll(/writeFileSync\(([^,]+),/g)].map((m) => m[1].trim());
  assert.deepEqual(writes, ['file']);
  assert.ok(!/writeFileSync\([^)]*src[^)]*content/.test(src));
});
