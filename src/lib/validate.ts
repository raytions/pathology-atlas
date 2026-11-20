/**
 * Editorial integrity checks that go beyond the per-entry Zod schema:
 *  - duplicate IDs across all collections (one stable ID = one resource)
 *  - invalid enum values (same vocab as the schema)
 *  - broken in-site references (organs, diseases, tasks, datasets)
 *  - facts pointing at a source key the entry does not define
 *  - review rules: last_verified only on verified entries, verified entries
 *    must not link to pending ones, relations need evidence
 *
 * Runs in two places: `npm run validate` (Node with type stripping) and the
 * Astro integration in astro.config.mjs (fails `astro build`).
 * Uses only erasable TypeScript so Node can execute it directly.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  ACCESS_METHOD,
  ANNOTATION_GRANULARITY,
  DATASET_USE,
  DATA_UNITS,
  INPUT_GRANULARITY,
  METHOD_CATEGORY,
  OUTPUT_GRANULARITY,
  REVIEW_STATUS,
  SOURCE_KIND,
  STAINS,
  TASK_SCOPE,
  WEIGHTS_AVAILABILITY,
} from './vocab.ts';
import { featuredPathProblems } from './relations.ts';
import { FEATURED_PATH } from '../data/featured.ts';

type Entry = {
  collection: string;
  file: string;
  data: Record<string, any>;
};

export type ValidationResult = {
  errors: string[];
  warnings: string[];
  stats: Record<string, { total: number; public: number }>;
};

const COLLECTIONS = ['organs', 'diseases', 'tasks', 'datasets', 'methods'] as const;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function walk(dir: string): string[] {
  let out: string[] = [];
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(ya?ml|md)$/.test(name)) out.push(p);
  }
  return out;
}

function parseFile(path: string): Record<string, any> {
  const raw = readFileSync(path, 'utf8');
  if (extname(path) === '.md') {
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) throw new Error('missing frontmatter');
    return parseYaml(m[1]) ?? {};
  }
  return parseYaml(raw) ?? {};
}

/** Collect every value stored under a `source` / `evidence` / `primary_paper` key. */
function sourceRefs(node: unknown, path: string, out: { path: string; key: string }[]) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => sourceRefs(v, `${path}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (path === '' && k === 'sources') continue;
      if ((k === 'source' || k === 'evidence' || k === 'primary_paper') && typeof v === 'string') {
        out.push({ path: path ? `${path}.${k}` : k, key: v });
      } else {
        sourceRefs(v, path ? `${path}.${k}` : k, out);
      }
    }
  }
}

export function validateContent(root: string, today = new Date()): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const contentDir = join(root, 'src', 'content');
  const entries: Entry[] = [];

  for (const collection of COLLECTIONS) {
    for (const file of walk(join(contentDir, collection))) {
      const rel = relative(root, file);
      try {
        entries.push({ collection, file: rel, data: parseFile(file) });
      } catch (e) {
        errors.push(`${rel}: cannot parse (${(e as Error).message})`);
      }
    }
  }

  // ---- IDs: format, filename match, global uniqueness -------------------
  const byId = new Map<string, Entry>();
  for (const e of entries) {
    const id = e.data.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      errors.push(`${e.file}: missing or malformed id ${JSON.stringify(id)}`);
      continue;
    }
    const stem = basename(e.file).replace(/\.(ya?ml|md)$/, '');
    if (stem !== id) warnings.push(`${e.file}: filename "${stem}" differs from id "${id}"`);
    const prev = byId.get(id);
    if (prev) errors.push(`duplicate id "${id}" in ${prev.file} and ${e.file}`);
    else byId.set(id, e);
  }

  const isPublic = (e: Entry | undefined) => e?.data.review_status === 'verified';
  const todayIso = today.toISOString().slice(0, 10);

  const checkEnum = (e: Entry, field: string, value: unknown, vocab: Record<string, unknown>) => {
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const v of values) {
      if (typeof v !== 'string' || !(v in vocab)) {
        errors.push(`${e.file}: ${field} has invalid value ${JSON.stringify(v)} (allowed: ${Object.keys(vocab).join(', ')})`);
      }
    }
  };

  const checkRef = (e: Entry, field: string, value: unknown, collection: string) => {
    const ids = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const ref of ids) {
      const target = typeof ref === 'string' ? byId.get(ref) : undefined;
      if (!target) {
        errors.push(`${e.file}: ${field} -> "${ref}" does not exist`);
      } else if (target.collection !== collection) {
        errors.push(`${e.file}: ${field} -> "${ref}" is a ${target.collection} entry, expected ${collection}`);
      } else if (isPublic(e) && !isPublic(target)) {
        errors.push(`${e.file}: verified entry links to "${ref}", which is ${target.data.review_status} (not public)`);
      }
    }
  };

  for (const e of entries) {
    const d = e.data;
    const tag = e.file;

    // ---- shared fields ----------------------------------------------------
    for (const f of ['title', 'summary', 'review_status']) {
      if (!d[f]) errors.push(`${tag}: missing ${f}`);
    }
    checkEnum(e, 'review_status', d.review_status, REVIEW_STATUS);

    const sources: any[] = Array.isArray(d.sources) ? d.sources : [];
    if (sources.length === 0) errors.push(`${tag}: needs at least one source`);
    const keys = new Set<string>();
    for (const s of sources) {
      if (!s?.key) errors.push(`${tag}: source without key`);
      else if (keys.has(s.key)) errors.push(`${tag}: duplicate source key "${s.key}"`);
      else keys.add(s.key);
      checkEnum(e, `sources.${s?.key}.kind`, s?.kind, SOURCE_KIND);
      if (d.review_status === 'verified' && !s?.accessed) {
        errors.push(`${tag}: verified entry cites "${s?.key}" without an accessed date`);
      }
    }
    const refs: { path: string; key: string }[] = [];
    sourceRefs(d, '', refs);
    for (const r of refs) {
      if (!keys.has(r.key)) errors.push(`${tag}: ${r.path} points to unknown source "${r.key}"`);
    }

    if (d.review_status === 'verified') {
      if (!d.last_verified) errors.push(`${tag}: verified entry needs last_verified`);
      else if (String(d.last_verified) > todayIso) errors.push(`${tag}: last_verified ${d.last_verified} is in the future`);
    } else if (d.last_verified) {
      errors.push(`${tag}: last_verified is only allowed on verified entries (status: ${d.review_status})`);
    }

    // ---- per collection ---------------------------------------------------
    if (e.collection === 'diseases') checkRef(e, 'organs', d.organs, 'organs');

    if (e.collection === 'tasks') {
      checkEnum(e, 'scope', d.scope, TASK_SCOPE);
      checkRef(e, 'organs', d.organs, 'organs');
      checkRef(e, 'diseases', d.diseases, 'diseases');
      checkRef(e, 'broader', d.broader, 'tasks');
      for (const b of d.broader ?? []) {
        if (byId.get(b)?.data.scope !== 'general') errors.push(`${tag}: broader -> "${b}" must be a general task family`);
      }
    }

    if (e.collection === 'datasets') {
      checkRef(e, 'organs', d.organs, 'organs');
      checkRef(e, 'diseases', d.diseases, 'diseases');
      checkRef(e, 'tasks', d.tasks, 'tasks');
      checkEnum(e, 'stains', d.stains, STAINS);
      checkEnum(e, 'data_units', d.data_units, DATA_UNITS);
      checkEnum(e, 'annotation_granularity', d.annotation_granularity, ANNOTATION_GRANULARITY);
      if (d.access) checkEnum(e, 'access.method', d.access.method, ACCESS_METHOD);
      if (d.size !== undefined) errors.push(`${tag}: use unit-specific scale fields (patients, slides, ...) instead of "size"`);
    }

    if (e.collection === 'methods') {
      checkEnum(e, 'category', d.category, METHOD_CATEGORY);
      checkRef(e, 'tasks', d.tasks, 'tasks');
      checkRef(e, 'organs', d.organs, 'organs');
      checkEnum(e, 'input_granularity', d.input_granularity, INPUT_GRANULARITY);
      checkEnum(e, 'output_granularity', d.output_granularity, OUTPUT_GRANULARITY);
      if (d.weights) checkEnum(e, 'weights.availability', d.weights.availability, WEIGHTS_AVAILABILITY);
      for (const [i, rel] of (d.datasets ?? []).entries()) {
        const f = `datasets[${i}]`;
        checkEnum(e, `${f}.use`, rel.use, DATASET_USE);
        checkRef(e, `${f}.dataset`, rel.dataset, 'datasets');
        if (!rel.evidence) errors.push(`${tag}: ${f} needs an evidence source`);
        if (rel.use === 'evaluation' || rel.use === 'fine-tuning') {
          if (!rel.task) {
            errors.push(`${tag}: ${f} (${rel.use}) must name the task the result was reported for`);
          } else {
            checkRef(e, `${f}.task`, rel.task, 'tasks');
            const ds = byId.get(rel.dataset);
            if (ds && !(ds.data.tasks ?? []).includes(rel.task)) {
              errors.push(`${tag}: ${f}.task "${rel.task}" is not one of ${rel.dataset}'s tasks`);
            }
          }
        }
      }
    }
  }

  // ---- home-page worked path: explicit IDs, published, linked ------------
  const pub = (id: string, collection: string) => {
    const e = byId.get(id);
    return e && e.collection === collection && isPublic(e) ? (e.data as any) : undefined;
  };
  for (const problem of featuredPathProblems(FEATURED_PATH, {
    organs: entries.filter((e) => e.collection === 'organs' && isPublic(e)).map((e) => e.data.id),
    task: (id) => (pub(id, 'tasks') ? { id, data: { broader: [], organs: [], scope: '', ...pub(id, 'tasks') } } : undefined),
    dataset: (id) => (pub(id, 'datasets') ? { id, data: { tasks: [], organs: [], ...pub(id, 'datasets') } } : undefined),
  })) {
    errors.push(`src/data/featured.ts: ${problem}`);
  }

  const stats: ValidationResult['stats'] = {};
  for (const c of COLLECTIONS) {
    const inC = entries.filter((e) => e.collection === c);
    stats[c] = { total: inC.length, public: inC.filter(isPublic).length };
  }
  return { errors, warnings, stats };
}
