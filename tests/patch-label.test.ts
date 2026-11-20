// The patch-level label is a first-class annotation granularity: the validator accepts it,
// rejects near-misses, and the dataset list exposes it as a filter option.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../src/lib/validate.ts';
import { ANNOTATION_GRANULARITY } from '../src/lib/vocab.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Copy the real content into a temp project and add one fixture dataset. */
function withFixture(annotation: string[], fn: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-vocab-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    cpSync(join(root, 'src', 'content'), join(dir, 'src', 'content'), { recursive: true });
    writeFileSync(
      join(dir, 'src', 'content', 'datasets', 'tile-fixture.yaml'),
      [
        'id: tile-fixture',
        'title: Tile fixture',
        'summary: Fixture dataset used only by tests to exercise the patch-level label value.',
        'organs: [prostate]',
        'tasks: [gleason-grading]',
        'stains: [he]',
        'data_units: [patch]',
        `annotation_granularity: [${annotation.join(', ')}]`,
        'review_status: draft',
        'sources:',
        '  - key: s',
        '    title: Fixture source',
        '    url: https://example.org/',
        '    kind: paper',
        '',
      ].join('\n'),
    );
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('patch-label is in the vocabulary with a display label', () => {
  assert.equal(ANNOTATION_GRANULARITY['patch-label'], 'Patch label');
});

test('validator accepts patch-label', () => {
  withFixture(['patch-label'], (dir) => {
    const { errors } = validateContent(dir);
    assert.deepEqual(errors, []);
  });
});

test('validator rejects near-miss spellings of patch-label', () => {
  withFixture(['patch-labels'], (dir) => {
    const { errors } = validateContent(dir);
    assert.ok(errors.some((e) => e.includes('annotation_granularity') && e.includes('"patch-labels"')), errors.join('\n'));
  });
});
