/**
 * Pure relation logic: how a method relates to a task / dataset / organ context.
 * No Astro imports, so it runs under `node --test` (see tests/relations.test.ts).
 *
 * Rules
 *  - Direct relations come only from a method's `datasets[]` entries (each has a
 *    `use` and an `evidence` source). Every matching relation is kept, so a method
 *    with evaluation + pretraining relations shows both.
 *  - "Same task family" is inferred from task lists and never implies a result.
 *    It is shown only when no evaluation / fine-tuning relation matches the context.
 *  - A relation matches a task when `rel.task === task`. Pretraining / background
 *    relations may omit `task`; they then match a task the dataset lists, unless
 *    `explicitTask` is set (the home-page worked path requires an exact match).
 */
import type { DatasetUse } from './vocab.ts';

export type Use = DatasetUse;
export const USE_ORDER: Use[] = ['evaluation', 'fine-tuning', 'pretraining', 'background'];
const RESULT_USES: Use[] = ['evaluation', 'fine-tuning'];

export interface Rel {
  dataset: string;
  use: Use;
  task?: string;
  evidence: string;
  note?: string;
}
export interface MethodLike {
  id: string;
  data: { tasks: string[]; datasets: Rel[] };
}
export interface DatasetLike {
  id: string;
  data: { tasks: string[]; organs: string[] };
}
export interface TaskLike {
  id: string;
  data: { broader: string[]; organs: string[]; scope: string };
}

export interface Context {
  /** Restrict to relations reported for this task. */
  taskId?: string;
  /** Restrict to relations on these datasets. */
  datasetIds?: string[];
  /** Task ids whose family membership triggers "same task family". */
  familyOf?: string[];
  /** Require rel.task === taskId even for pretraining / background. */
  explicitTask?: boolean;
}

export interface MethodLink {
  relations: Rel[];
  uses: Use[];
  sameTaskFamily: boolean;
}

export interface Lookup {
  dataset: (id: string) => DatasetLike | undefined;
  task: (id: string) => TaskLike | undefined;
}

/** A task plus every general family it belongs to. */
export function taskFamily(taskId: string, lookup: Lookup): string[] {
  return [taskId, ...(lookup.task(taskId)?.data.broader ?? [])];
}

export function relMatchesTask(r: Rel, taskId: string, lookup: Lookup, explicitTask = false): boolean {
  if (r.task) return r.task === taskId;
  if (explicitTask || RESULT_USES.includes(r.use)) return false;
  return lookup.dataset(r.dataset)?.data.tasks.includes(taskId) ?? false;
}

const byUse = (a: Rel, b: Rel) => USE_ORDER.indexOf(a.use) - USE_ORDER.indexOf(b.use);

export function methodLink(m: MethodLike, ctx: Context, lookup: Lookup): MethodLink | null {
  let rels = m.data.datasets.filter((r) => lookup.dataset(r.dataset));
  if (ctx.datasetIds) rels = rels.filter((r) => ctx.datasetIds!.includes(r.dataset));
  if (ctx.taskId) rels = rels.filter((r) => relMatchesTask(r, ctx.taskId!, lookup, ctx.explicitTask));
  rels = [...rels].sort(byUse);
  const uses = USE_ORDER.filter((u) => rels.some((r) => r.use === u));
  const family = new Set((ctx.familyOf ?? (ctx.taskId ? [ctx.taskId] : [])).flatMap((t) => taskFamily(t, lookup)));
  const inFamily = m.data.tasks.some((t) => family.has(t));
  const hasResult = uses.some((u) => RESULT_USES.includes(u));
  const sameTaskFamily = inFamily && !hasResult;
  if (!rels.length && !sameTaskFamily) return null;
  return { relations: rels, uses, sameTaskFamily };
}

export interface Grouped<M> {
  /** Methods with at least one recorded relation in this context (all uses kept). */
  direct: { method: M; link: MethodLink }[];
  /** Same task family, no recorded relation in this context. */
  familyOnly: { method: M; link: MethodLink }[];
}

export function groupMethods<M extends MethodLike>(methods: M[], ctx: Context, lookup: Lookup): Grouped<M> {
  const out: Grouped<M> = { direct: [], familyOnly: [] };
  for (const method of methods) {
    const link = methodLink(method, ctx, lookup);
    if (!link) continue;
    (link.relations.length ? out.direct : out.familyOnly).push({ method, link });
  }
  const rank = (l: MethodLink) => (l.uses.length ? USE_ORDER.indexOf(l.uses[0]) : USE_ORDER.length);
  out.direct.sort((a, b) => rank(a.link) - rank(b.link));
  return out;
}

/** Stable anchor id for a relation row on the method detail page. */
export function relAnchor(r: Pick<Rel, 'dataset' | 'use' | 'task'>): string {
  return ['rel', r.dataset, r.use, r.task].filter(Boolean).join('-');
}

/* ------------------------------------------------------------------ */
/* Home-page worked path                                               */
/* ------------------------------------------------------------------ */

export interface PathConfig {
  organId: string;
  taskId: string;
  datasetId: string;
}

/** Problems with a featured path, given only public entries. Empty = valid. */
export function featuredPathProblems(
  cfg: PathConfig,
  pub: { organs: string[]; task: (id: string) => TaskLike | undefined; dataset: (id: string) => DatasetLike | undefined },
): string[] {
  const p: string[] = [];
  const task = pub.task(cfg.taskId);
  const ds = pub.dataset(cfg.datasetId);
  if (!pub.organs.includes(cfg.organId)) p.push(`organ "${cfg.organId}" is not a published organ`);
  if (!task) p.push(`task "${cfg.taskId}" is not a published task`);
  if (!ds) p.push(`dataset "${cfg.datasetId}" is not a published dataset`);
  if (task && !task.data.organs.includes(cfg.organId)) p.push(`task "${cfg.taskId}" is not linked to organ "${cfg.organId}"`);
  if (ds && !ds.data.organs.includes(cfg.organId)) p.push(`dataset "${cfg.datasetId}" is not linked to organ "${cfg.organId}"`);
  if (ds && !ds.data.tasks.includes(cfg.taskId)) p.push(`dataset "${cfg.datasetId}" does not list task "${cfg.taskId}"`);
  return p;
}

/**
 * Methods for the worked path. Direct relations must match BOTH the path's task and
 * dataset. Results on other datasets of the same task are never used to fill in.
 */
export function featuredPathMethods<M extends MethodLike>(methods: M[], cfg: PathConfig, lookup: Lookup) {
  const grouped = groupMethods(
    methods,
    { taskId: cfg.taskId, datasetIds: [cfg.datasetId], familyOf: [cfg.taskId], explicitTask: true },
    lookup,
  );
  const hasEvaluation = grouped.direct.some((d) => d.link.uses.includes('evaluation'));
  return { ...grouped, hasEvaluation };
}
