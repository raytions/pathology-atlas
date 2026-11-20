/**
 * Read-side helpers. Pages never repeat facts: they look entries up by ID and
 * derive relations (what a method means for a task / dataset / organ) here.
 * Only `review_status: verified` entries are public.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { RELEVANCE } from './vocab';
import { withBase } from './paths';

export type Organ = CollectionEntry<'organs'>;
export type Disease = CollectionEntry<'diseases'>;
export type Task = CollectionEntry<'tasks'>;
export type Dataset = CollectionEntry<'datasets'>;
export type Method = CollectionEntry<'methods'>;
export type Relevance = keyof typeof RELEVANCE;
export type DatasetRelation = Method['data']['datasets'][number];

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

/** Uses that count as "reported with this dataset" (vs. background). */
const REPORTED_USES = new Set(['evaluation', 'fine-tuning', 'pretraining']);

export class Catalog {
  organs: Organ[];
  diseases: Disease[];
  tasks: Task[];
  datasets: Dataset[];
  methods: Method[];

  constructor(organs: Organ[], diseases: Disease[], tasks: Task[], datasets: Dataset[], methods: Method[]) {
    this.organs = organs;
    this.diseases = diseases;
    this.tasks = tasks;
    this.datasets = datasets;
    this.methods = methods;
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

  /** The task plus every general family it belongs to. */
  taskFamily(taskId: string): string[] {
    const t = this.task(taskId);
    return [taskId, ...(t?.data.broader ?? [])];
  }

  /** Dataset relations of a method, restricted to public datasets. */
  relations(m: Method): DatasetRelation[] {
    return m.data.datasets.filter((r) => this.dataset(r.dataset));
  }

  /**
   * How a method relates to a task:
   *  - benchmark: a cited source reports it on a dataset for exactly this task
   *  - same-task: it targets this task or its family, nothing reported here
   *  - background: only background relations to datasets of this task
   */
  methodRelevanceForTask(m: Method, taskId: string): { relevance: Relevance; relations: DatasetRelation[] } | null {
    const rels = this.relations(m);
    const reported = rels.filter((r) => r.task === taskId && REPORTED_USES.has(r.use));
    if (reported.length) return { relevance: 'benchmark', relations: reported };
    const family = this.taskFamily(taskId);
    if (m.data.tasks.some((t) => family.includes(t))) return { relevance: 'same-task', relations: [] };
    const bg = rels.filter((r) => r.use === 'background' && this.dataset(r.dataset)?.data.tasks.includes(taskId));
    if (bg.length) return { relevance: 'background', relations: bg };
    return null;
  }

  methodsForTask(taskId: string) {
    return this.group(
      this.methods.map((m) => ({ method: m, ...this.methodRelevanceForTask(m, taskId) })),
    );
  }

  /** How a method relates to a dataset page. */
  methodRelevanceForDataset(m: Method, ds: Dataset): { relevance: Relevance; relations: DatasetRelation[] } | null {
    const rels = this.relations(m).filter((r) => r.dataset === ds.id);
    const reported = rels.filter((r) => REPORTED_USES.has(r.use));
    if (reported.length) return { relevance: 'benchmark', relations: reported };
    const family = new Set(ds.data.tasks.flatMap((t) => this.taskFamily(t)));
    if (m.data.tasks.some((t) => family.has(t))) return { relevance: 'same-task', relations: [] };
    const bg = rels.filter((r) => r.use === 'background');
    if (bg.length) return { relevance: 'background', relations: bg };
    return null;
  }

  methodsForDataset(ds: Dataset) {
    return this.group(this.methods.map((m) => ({ method: m, ...this.methodRelevanceForDataset(m, ds) })));
  }

  /** Strongest relevance of a method across all tasks of an organ. */
  methodsForOrgan(organId: string) {
    const tasks = this.tasksForOrgan(organId);
    const order: Relevance[] = ['benchmark', 'same-task', 'background'];
    return this.group(
      this.methods.map((m) => {
        let best: { relevance: Relevance; relations: DatasetRelation[] } | null = null;
        for (const t of tasks) {
          const r = this.methodRelevanceForTask(m, t.id);
          if (!r) continue;
          if (!best || order.indexOf(r.relevance) < order.indexOf(best.relevance)) best = { ...r };
          else if (r.relevance === best.relevance) best.relations = best.relations.concat(r.relations);
        }
        return { method: m, ...best };
      }),
    );
  }

  private group(items: { method: Method; relevance?: Relevance; relations?: DatasetRelation[] }[]) {
    const out: Record<Relevance, { method: Method; relations: DatasetRelation[] }[]> = {
      benchmark: [],
      'same-task': [],
      background: [],
    };
    for (const i of items) if (i.relevance) out[i.relevance].push({ method: i.method, relations: i.relations ?? [] });
    return out;
  }

  diseasesForOrgan = (organId: string) => this.diseases.filter((d) => d.data.organs.includes(organId));
  tasksForOrgan = (organId: string) =>
    this.tasks.filter((t) => t.data.scope === 'specific' && t.data.organs.includes(organId));
  datasetsForOrgan = (organId: string) => this.datasets.filter((d) => d.data.organs.includes(organId));
  datasetsForTask = (taskId: string) => this.datasets.filter((d) => d.data.tasks.includes(taskId));
  tasksForDisease = (diseaseId: string) => this.tasks.filter((t) => t.data.diseases.includes(diseaseId));
  datasetsForDisease = (diseaseId: string) => this.datasets.filter((d) => d.data.diseases.includes(diseaseId));

  /** Organs a method touches through recorded benchmark relations or explicit organs. */
  organsForMethod(m: Method): string[] {
    const s = new Set<string>(m.data.organs);
    for (const r of this.relations(m)) {
      if (REPORTED_USES.has(r.use)) this.dataset(r.dataset)?.data.organs.forEach((o) => s.add(o));
    }
    return [...s];
  }

  /** Tasks shown for a method: its own tasks plus specific tasks it has reported results on. */
  specificTasksForMethod(m: Method): string[] {
    const s = new Set<string>();
    for (const r of this.relations(m)) if (r.task && REPORTED_USES.has(r.use)) s.add(r.task);
    return [...s];
  }
}

export const url = {
  organ: (id: string) => withBase(`/organs/${id}/`),
  disease: (id: string) => withBase(`/diseases/${id}/`),
  task: (id: string) => withBase(`/tasks/${id}/`),
  dataset: (id: string) => withBase(`/datasets/${id}/`),
  method: (id: string) => withBase(`/methods/${id}/`),
};

/** Format "10616" as "10,616". */
export const fmt = (n: number) => n.toLocaleString('en-US');
