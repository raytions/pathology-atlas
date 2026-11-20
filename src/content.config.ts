import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
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
  keysOf,
} from './lib/vocab';

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'IDs are lowercase kebab-case, e.g. "gleason-grading"');

/** YAML may parse 2026-11-20 as a Date; normalise both forms to a YYYY-MM-DD string. */
const isoDate = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));

/** A citable source. `key` is local to the entry; facts point at it via `source`. */
const source = z.object({
  key: id,
  title: z.string().min(3),
  url: z.url(),
  kind: z.enum(keysOf(SOURCE_KIND)),
  accessed: isoDate.optional(),
  note: z.string().optional(),
});

/** A single fact that must be traceable to one of the entry's sources. */
const sourcedText = z.object({
  value: z.string().min(1),
  source: id,
  note: z.string().optional(),
});

const count = z.object({
  value: z.number().int().positive(),
  source: id,
  note: z.string().optional(),
});

/** Fields every entry carries. */
const base = {
  id,
  title: z.string().min(2),
  /** Original editorial summary. Never paste abstracts or README text. */
  summary: z.string().min(40),
  sources: z.array(source).min(1),
  review_status: z.enum(keysOf(REVIEW_STATUS)),
  /** Only set when an editor actually checked the sources on that date. */
  last_verified: isoDate.optional(),
  reviewer_notes: z.string().optional(),
};

const loaderFor = (dir: string, pattern = '**/*.{yaml,yml}') =>
  glob({
    pattern,
    base: `./src/content/${dir}`,
    // The `id` inside the file is authoritative, not the filename.
    generateId: ({ data, entry }) => (typeof data.id === 'string' ? data.id : entry),
  });

/* ------------------------------------------------------------------ */
/* Taxonomy: organs, diseases, tasks                                   */
/* ------------------------------------------------------------------ */

const organs = defineCollection({
  loader: loaderFor('organs', '**/*.md'),
  schema: z.object({
    ...base,
    featured: z.boolean().default(false),
    /** Short line used on cards and the home page. */
    tagline: z.string().optional(),
  }),
});

const diseases = defineCollection({
  loader: loaderFor('diseases'),
  schema: z.object({
    ...base,
    organs: z.array(id).min(1),
    synonyms: z.array(z.string()).default([]),
  }),
});

const reading = z.object({
  title: z.string(),
  url: z.url(),
  why: z.string(),
  source: id,
});

const tasks = defineCollection({
  loader: loaderFor('tasks'),
  schema: z.object({
    ...base,
    scope: z.enum(keysOf(TASK_SCOPE)),
    organs: z.array(id).default([]),
    diseases: z.array(id).default([]),
    /** General task families this task is an instance of (e.g. gleason-grading -> wsi-classification). */
    broader: z.array(id).default([]),
    prediction_target: z.string().optional(),
    /** Context-only reading. Always rendered as "Background reading". */
    background_reading: z.array(reading).default([]),
  }),
});

/* ------------------------------------------------------------------ */
/* Datasets                                                            */
/* ------------------------------------------------------------------ */

const datasets = defineCollection({
  loader: loaderFor('datasets'),
  schema: z.object({
    ...base,
    aliases: z.array(z.string()).default([]),
    organs: z.array(id).min(1),
    diseases: z.array(id).default([]),
    tasks: z.array(id).min(1),
    specimen: z.string().optional(),
    stains: z.array(z.enum(keysOf(STAINS))).min(1),
    data_units: z.array(z.enum(keysOf(DATA_UNITS))).min(1),
    annotation_granularity: z.array(z.enum(keysOf(ANNOTATION_GRANULARITY))).min(1),
    /** Scale, one field per unit. Never collapse into a single "size". */
    scale: z
      .object({
        patients: count.optional(),
        slides: count.optional(),
        rois: count.optional(),
        patches: count.optional(),
        centers: count.optional(),
        storage: sourcedText.optional(),
      })
      .default({}),
    version: sourcedText.optional(),
    splits: sourcedText.optional(),
    evaluation_protocol: sourcedText.optional(),
    /** How you obtain the data. Independent from redistribution terms. */
    access: z
      .object({
        method: z.enum(keysOf(ACCESS_METHOD)),
        details: z.string(),
        source: id,
      })
      .optional(),
    /** Licence / terms of use and what they allow. Independent from access. */
    terms: z
      .object({
        license: z.string(),
        redistribution: z.string().optional(),
        source: id,
        note: z.string().optional(),
      })
      .optional(),
    official_url: z.url().optional(),
    /** Key of the primary publication in `sources`. */
    primary_paper: id.optional(),
    limitations: z.array(sourcedText).default([]),
  }),
});

/* ------------------------------------------------------------------ */
/* Methods & models                                                    */
/* ------------------------------------------------------------------ */

const artifact = z.object({
  url: z.url().optional(),
  license: z.string().optional(),
  conditions: z.string().optional(),
  source: id,
});

const methods = defineCollection({
  loader: loaderFor('methods'),
  schema: z.object({
    ...base,
    short_name: z.string().optional(),
    category: z.enum(keysOf(METHOD_CATEGORY)),
    tasks: z.array(id).min(1),
    organs: z.array(id).default([]),
    input_granularity: z.array(z.enum(keysOf(INPUT_GRANULARITY))).min(1),
    output_granularity: z.array(z.enum(keysOf(OUTPUT_GRANULARITY))).min(1),
    year: z.number().int().optional(),
    venue: sourcedText.optional(),
    primary_paper: id,
    code: artifact.optional(),
    weights: artifact
      .extend({ availability: z.enum(keysOf(WEIGHTS_AVAILABILITY)) })
      .optional(),
    /**
     * Dataset relations. `use` must be stated by the cited `evidence` source.
     * `evaluation` / `fine-tuning` require the `task` the result was reported for.
     */
    datasets: z
      .array(
        z.object({
          dataset: id,
          use: z.enum(keysOf(DATASET_USE)),
          task: id.optional(),
          evidence: id,
          note: z.string().optional(),
        }),
      )
      .default([]),
    limitations: z.array(sourcedText).default([]),
  }),
});

export const collections = { organs, diseases, tasks, datasets, methods };
