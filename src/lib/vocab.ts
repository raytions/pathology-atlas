/**
 * Controlled vocabularies shared by the Astro content schema (src/content.config.ts)
 * and the standalone validator (src/lib/validate.ts).
 *
 * Every enum is a map of `value -> human label`. Add new values here first;
 * both the schema and the validator pick them up automatically.
 *
 * Keep this file free of non-erasable TypeScript syntax (no enums, no namespaces)
 * so Node can run the validator with built-in type stripping.
 */

export const REVIEW_STATUS = {
  verified: 'Verified',
  'needs-review': 'Needs review',
  draft: 'Draft',
} as const;

export const STAINS = {
  he: 'H&E',
  ihc: 'IHC',
} as const;

export const DATA_UNITS = {
  wsi: 'WSI',
  roi: 'ROI image',
  patch: 'Patch',
  tma: 'TMA core',
} as const;

export const ANNOTATION_GRANULARITY = {
  'slide-label': 'Slide label',
  'patient-label': 'Patient label',
  'roi-label': 'ROI label',
  'region-mask': 'Region mask',
  'lesion-contour': 'Lesion contours',
  'pixel-mask': 'Pixel mask',
} as const;

export const ACCESS_METHOD = {
  'open-download': 'Open download',
  registration: 'Registration required',
  'platform-account': 'Platform account + rules',
  application: 'Application / DUA',
  restricted: 'Restricted',
} as const;

export const SOURCE_KIND = {
  paper: 'Paper',
  preprint: 'Preprint',
  'official-site': 'Official site',
  'challenge-page': 'Challenge page',
  'data-portal': 'Data portal',
  repository: 'Code repository',
  'model-card': 'Model card',
} as const;

export const METHOD_CATEGORY = {
  'mil-aggregator': 'MIL aggregator',
  'foundation-model': 'Foundation model (encoder)',
  'end-to-end-cnn': 'End-to-end CNN',
  'segmentation-model': 'Segmentation model',
} as const;

export const INPUT_GRANULARITY = {
  patch: 'Image patches',
  'patch-features': 'Pre-extracted patch features (bag per WSI)',
  wsi: 'Whole-slide image',
} as const;

export const OUTPUT_GRANULARITY = {
  'patch-embedding': 'Patch embedding',
  'slide-label': 'Slide-level prediction',
  'attention-map': 'Patch attention scores / heatmap',
  'roi-label': 'ROI-level prediction',
} as const;

/** How a method used a dataset. Only record what a cited source states. */
export const DATASET_USE = {
  pretraining: 'Pretraining',
  'fine-tuning': 'Fine-tuning',
  evaluation: 'Evaluation',
  background: 'Background',
} as const;

export const WEIGHTS_AVAILABILITY = {
  public: 'Public download',
  gated: 'Gated (request access)',
  'none-found': 'None found in official sources',
} as const;

export const TASK_SCOPE = {
  specific: 'Clinical task',
  general: 'Task family',
} as const;

/**
 * Computed relevance of a method to a task / dataset page. Not stored in content:
 * derived by src/lib/catalog.ts from the structured relations.
 */
export const RELEVANCE = {
  benchmark: {
    label: 'Reported on this benchmark',
    short: 'Benchmark',
    help: 'A cited source reports using this method with the dataset for this task (see the use and evidence).',
  },
  'same-task': {
    label: 'Applicable to the same task family',
    short: 'Same task family',
    help: 'Designed for this kind of task. No result on this dataset is recorded here; do not read it as validated.',
  },
  background: {
    label: 'Background reading',
    short: 'Background',
    help: 'Context only: definitions, grading systems or related work. Not a method or benchmark result.',
  },
} as const;

export type Vocab = Record<string, string>;
export const keysOf = <T extends Record<string, unknown>>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const ALL_VOCABS = {
  REVIEW_STATUS,
  STAINS,
  DATA_UNITS,
  ANNOTATION_GRANULARITY,
  ACCESS_METHOD,
  SOURCE_KIND,
  METHOD_CATEGORY,
  INPUT_GRANULARITY,
  OUTPUT_GRANULARITY,
  DATASET_USE,
  WEIGHTS_AVAILABILITY,
  TASK_SCOPE,
} as const;
