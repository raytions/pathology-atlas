// Regression tests for method <-> dataset relation display logic.
// Run: npm test   (node --test, Node's built-in TypeScript type stripping)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  featuredPathMethods,
  featuredPathProblems,
  methodLink,
  groupMethods,
  relMatchesTask,
  type DatasetLike,
  type Lookup,
  type MethodLike,
  type TaskLike,
} from '../src/lib/relations.ts';

// Fixture: one organ, one clinical task with two datasets A and B.
const tasks: TaskLike[] = [
  { id: 'grading', data: { broader: ['slide-cls'], organs: ['organ-x'], scope: 'specific' } },
  { id: 'slide-cls', data: { broader: [], organs: [], scope: 'general' } },
];
const datasets: DatasetLike[] = [
  { id: 'ds-a', data: { tasks: ['grading'], organs: ['organ-x'] } },
  { id: 'ds-b', data: { tasks: ['grading'], organs: ['organ-x'] } },
];
const lookup: Lookup = {
  task: (id) => tasks.find((t) => t.id === id),
  dataset: (id) => datasets.find((d) => d.id === id),
};

const evaluatedOnBOnly: MethodLike = {
  id: 'evaluated-on-b',
  data: { tasks: ['slide-cls'], datasets: [{ dataset: 'ds-b', use: 'evaluation', task: 'grading', evidence: 'paper' }] },
};
const pretrainedOnA: MethodLike = {
  id: 'pretrained-on-a',
  data: { tasks: ['slide-cls'], datasets: [{ dataset: 'ds-a', use: 'pretraining', task: 'grading', evidence: 'card' }] },
};
const pretrainedNoTask: MethodLike = {
  id: 'pretrained-no-task',
  data: { tasks: ['other-family'], datasets: [{ dataset: 'ds-a', use: 'pretraining', evidence: 'card' }] },
};
const multiUse: MethodLike = {
  id: 'multi-use',
  data: {
    tasks: ['slide-cls'],
    datasets: [
      { dataset: 'ds-a', use: 'pretraining', evidence: 'card' },
      { dataset: 'ds-b', use: 'fine-tuning', task: 'grading', evidence: 'paper' },
      { dataset: 'ds-b', use: 'evaluation', task: 'grading', evidence: 'paper' },
    ],
  },
};

const pathA = { organId: 'organ-x', taskId: 'grading', datasetId: 'ds-a' };
const pathB = { ...pathA, datasetId: 'ds-b' };

test('home path on dataset A never shows a method evaluated only on dataset B as evaluated on A', () => {
  const r = featuredPathMethods([evaluatedOnBOnly], pathA, lookup);
  assert.equal(r.hasEvaluation, false, 'no evaluation on A should be recorded');
  assert.equal(r.direct.length, 0, 'the B-only method must not be a direct relation on A');
  assert.deepEqual(r.familyOnly.map((x) => x.method.id), ['evaluated-on-b']);
  assert.deepEqual(r.familyOnly[0].link.relations, [], 'no relation (and no B result) is carried over to A');
});

test('home path on dataset B shows the evaluation, matched on both task and dataset', () => {
  const r = featuredPathMethods([evaluatedOnBOnly], pathB, lookup);
  assert.equal(r.hasEvaluation, true);
  assert.deepEqual(r.direct[0].link.uses, ['evaluation']);
  assert.ok(r.direct[0].link.relations.every((x) => x.dataset === 'ds-b' && x.task === 'grading'));
});

test('home path ignores relations without an explicit matching task', () => {
  const r = featuredPathMethods([pretrainedNoTask], pathA, lookup);
  assert.equal(r.direct.length, 0);
});

test('pretraining-only relation is shown as pretraining, never as evaluation', () => {
  const onPath = featuredPathMethods([pretrainedOnA], pathA, lookup);
  assert.equal(onPath.hasEvaluation, false);
  assert.deepEqual(onPath.direct[0].link.uses, ['pretraining']);
  assert.equal(onPath.direct[0].link.sameTaskFamily, true, 'still flagged as same task family, since nothing evaluates it');

  const onDataset = methodLink(pretrainedNoTask, { datasetIds: ['ds-a'], familyOf: ['grading'] }, lookup);
  assert.ok(onDataset);
  assert.deepEqual(onDataset.uses, ['pretraining']);
  assert.ok(!onDataset.uses.includes('evaluation'));
});

test('several verified relations keep every use instead of only the strongest', () => {
  const link = methodLink(multiUse, { familyOf: ['grading'] }, lookup);
  assert.ok(link);
  assert.deepEqual(link.uses, ['evaluation', 'fine-tuning', 'pretraining']);
  assert.equal(link.sameTaskFamily, false, 'evaluated, so no "same task family" pointer');

  const forTask = methodLink(multiUse, { taskId: 'grading' }, lookup);
  assert.deepEqual(forTask?.uses, ['evaluation', 'fine-tuning', 'pretraining'], 'pretraining without task matches via the dataset task');
});

test('same task family without evidence is grouped separately from recorded relations', () => {
  const g = groupMethods([evaluatedOnBOnly, pretrainedOnA, multiUse], { datasetIds: ['ds-a'], familyOf: ['grading'] }, lookup);
  assert.deepEqual(g.direct.map((x) => x.method.id).sort(), ['multi-use', 'pretrained-on-a']);
  assert.deepEqual(g.familyOnly.map((x) => x.method.id), ['evaluated-on-b']);
  for (const d of g.direct) assert.ok(!d.link.uses.includes('evaluation'), `${d.method.id} has no evaluation on A`);
});

test('evaluation relations without a task never match a task', () => {
  assert.equal(relMatchesTask({ dataset: 'ds-a', use: 'evaluation', evidence: 'p' }, 'grading', lookup), false);
});

test('featured path must be published and linked', () => {
  const pub = { organs: ['organ-x'], task: lookup.task, dataset: lookup.dataset };
  assert.deepEqual(featuredPathProblems(pathA, pub), []);
  assert.match(featuredPathProblems({ ...pathA, datasetId: 'missing' }, pub).join(), /not a published dataset/);
  assert.match(featuredPathProblems({ ...pathA, organId: 'organ-y' }, { ...pub, organs: ['organ-x', 'organ-y'] }).join(), /not linked to organ/);
  const unlinked = { ...pub, dataset: (id: string) => (id === 'ds-a' ? { id, data: { tasks: ['other'], organs: ['organ-x'] } } : undefined) };
  assert.match(featuredPathProblems(pathA, unlinked).join(), /does not list task/);
});
