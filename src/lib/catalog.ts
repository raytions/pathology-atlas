/**
 * Read-side helpers. Pages never repeat facts: they look entries up by ID and
 * derive relations here (logic lives in ./relations.ts so it can be unit tested).
 * Only `review_status: verified` entries are public.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { withBase } from './paths';
import {
  featuredPathMethods,
  featuredPathProblems,
  groupMethods,
  methodLink,
  taskFamily,
  type Lookup,
  type PathConfig,
} from './relations';

export type Organ = CollectionEntry<'organs'>;
export type Disease = CollectionEntry<'diseases'>;
export type Task = CollectionEntry<'tasks'>;
export type Dataset = CollectionEntry<'datasets'>;
export type Method = CollectionEntry<'methods'>;
export type DatasetRelation = Method['data']['datasets'][number];
export type { MethodLink, Grouped } from './relations';

const isPublic = (e: { data: { review_status: string } }) => e.data.review_status === 'verified';
const byTitle = (a: { data: { title: string } }, b: { data: { title: string } }) =>
  a.data.title.localeCompare(b.data.title);

export async function loadCatalog() {
  const [organs, diseases, tasks, datasets, methods] = await Promise.all([
    getCollection('organs', isPublic),
    getCollection('diseases', isPublic),
    getCollection('tasks', isPublic),
    getCollection('datasets', isPublic),
    getCollection('methods', isPublic),
  ]);
  return new Catalog(
    organs.sort(byTitle),
    diseases.sort(byTitle),
    tasks.sort(byTitle),
    datasets.sort(byTitle),
    methods.sort(byTitle),
  );
}

export class Catalog {
  organs: Organ[];
  diseases: Disease[];
  tasks: Task[];
  datasets: Dataset[];
  methods: Method[];
  lookup: Lookup;

  constructor(organs: Organ[], diseases: Disease[], tasks: Task[], datasets: Dataset[], methods: Method[]) {
    this.organs = organs;
    this.diseases = diseases;
    this.tasks = tasks;
    this.datasets = datasets;
    this.methods = methods;
    this.lookup = { dataset: (id) => this.dataset(id), task: (id) => this.task(id) };
  }

  organ = (id: string) => this.organs.find((e) => e.id === id);
  disease = (id: string) => this.diseases.find((e) => e.id === id);
  task = (id: string) => this.tasks.find((e) => e.id === id);
  dataset = (id: string) => this.datasets.find((e) => e.id === id);
  method = (id: string) => this.methods.find((e) => e.id === id);

  title(id: string): string {
    return (
      this.organ(id) ?? this.disease(id) ?? this.task(id) ?? this.dataset(id) ?? this.method(id)
    )?.data.title ?? id;
  }

  taskFamily = (taskId: string) => taskFamily(taskId, this.lookup);

  /** Dataset relations of a method, restricted to public datasets. */
  relations(m: Method): DatasetRelation[] {
    return m.data.datasets.filter((r) => this.dataset(r.dataset));
  }

  /** All recorded relations for this task (every use kept) + same-family flag. */
  methodLinkForTask = (m: Method, taskId: string) => methodLink(m, { taskId }, this.lookup);
  methodsForTask = (taskId: string) => groupMethods(this.methods, { taskId }, this.lookup);

  methodsForDataset = (ds: Dataset) =>
    groupMethods(this.methods, { datasetIds: [ds.id], familyOf: ds.data.tasks }, this.lookup);

  methodsForOrgan = (organId: string) =>
    groupMethods(
      this.methods,
      {
        datasetIds: this.datasetsForOrgan(organId).map((d) => d.id),
        familyOf: this.tasksForOrgan(organId).map((t) => t.id),
      },
      this.lookup,
    );

  /** Methods with at least one evaluation relation for this task (any dataset). */
  evaluatedForTask = (taskId: string) =>
    this.methodsForTask(taskId).direct.filter((d) => d.link.uses.includes('evaluation'));

  /** Resolve the explicit home-page path; throws if it is not published and linked. */
  featuredPath(cfg: PathConfig) {
    const problems = featuredPathProblems(cfg, {
      organs: this.organs.map((o) => o.id),
      task: this.task,
      dataset: this.dataset,
    });
    if (problems.length) throw new Error(`Featured path is invalid: ${problems.join('; ')}`);
    return {
      organ: this.organ(cfg.organId)!,
      task: this.task(cfg.taskId)!,
      dataset: this.dataset(cfg.datasetId)!,
      methods: featuredPathMethods(this.methods, cfg, this.lookup),
    };
  }

  diseasesForOrgan = (organId: string) => this.diseases.filter((d) => d.data.organs.includes(organId));
  tasksForOrgan = (organId: string) =>
    this.tasks.filter((t) => t.data.scope === 'specific' && t.data.organs.includes(organId));
  datasetsForOrgan = (organId: string) => this.datasets.filter((d) => d.data.organs.includes(organId));
  datasetsForTask = (taskId: string) => this.datasets.filter((d) => d.data.tasks.includes(taskId));
  tasksForDisease = (diseaseId: string) => this.tasks.filter((t) => t.data.diseases.includes(diseaseId));
  datasetsForDisease = (diseaseId: string) => this.datasets.filter((d) => d.data.diseases.includes(diseaseId));
}

/** Structured scale as "value unit" parts, in a fixed order. Never invents units. */
export const SCALE_UNITS = [
  ['slides', 'slides (WSIs)'],
  ['patients', 'patients'],
  ['rois', 'ROIs'],
  ['patches', 'patches'],
  ['centers', 'centres'],
] as const;

export function scaleParts(ds: Dataset, keys: readonly (typeof SCALE_UNITS)[number][0][] = ['slides', 'patients', 'rois']) {
  return SCALE_UNITS.filter(([k]) => keys.includes(k))
    .map(([k, unit]) => {
      const c = ds.data.scale[k];
      return c ? `${fmt(c.value)} ${unit}` : null;
    })
    .filter((x): x is string => Boolean(x));
}

export const url = {
  organ: (id: string) => withBase(`/organs/${id}/`),
  disease: (id: string) => withBase(`/diseases/${id}/`),
  task: (id: string) => withBase(`/tasks/${id}/`),
  dataset: (id: string) => withBase(`/datasets/${id}/`),
  method: (id: string) => withBase(`/methods/${id}/`),
};

/** Format "10616" as "10,616". */
export function fmt(n: number) {
  return n.toLocaleString('en-US');
}
