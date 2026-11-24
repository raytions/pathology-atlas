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

/**
 * What one released label is attached to.
 *  - slide-label / patient-label: one label per slide / per patient
 *  - roi-label: one label per region of interest (variable-size crop chosen by an annotator)
 *  - patch-label: one class label per fixed-size patch (tile), e.g. a 224 x 224 tile with a
 *    tissue-type label; use this, not roi-label, when the released unit is a tile grid
 *  - region-mask / pixel-mask / lesion-contour: spatial annotations shipped with the data
 */
export const ANNOTATION_GRANULARITY = {
  'slide-label': 'Slide label',
  'patient-label': 'Patient label',
  'roi-label': 'ROI label',
  'patch-label': 'Patch label',
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
  'patch-label': 'Patch-level prediction',
  'slide-embedding': 'Slide embedding',
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

export type DatasetUse = keyof typeof DATASET_USE;

/**
 * Display vocabulary for method <-> dataset links. The four uses come straight
 * from a cited relation; "same-task" is inferred from task lists and is never a result.
 */
export const RELATION_KIND = {
  evaluation: {
    label: 'Evaluated on',
    short: 'Evaluation',
    help: 'A cited source reports evaluating the method on this dataset for the stated task.',
  },
  'fine-tuning': {
    label: 'Fine-tuned on',
    short: 'Fine-tuning',
    help: 'A cited source reports fine-tuning or training the method on this dataset. Not by itself an evaluation result.',
  },
  pretraining: {
    label: 'Pretrained on',
    short: 'Pretraining',
    help: 'The dataset was part of the pretraining data. Says nothing about downstream performance on it.',
  },
  background: {
    label: 'Background',
    short: 'Background',
    help: 'Context only: definitions, grading systems or related work. Not a method result.',
  },
  'same-task': {
    label: 'Same task family, no recorded relation',
    short: 'Same task family',
    help: 'Built for this kind of task. No relation to this dataset is recorded; do not read it as evaluated.',
  },
} as const;
export type RelationKind = keyof typeof RELATION_KIND;

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
