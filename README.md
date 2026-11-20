# Pathology Atlas

A small, source-checked resource atlas for computational pathology. Researchers browse by
**organ → disease → task** and land on datasets, methods/models and the papers behind them.

Static site: Astro 7 + TypeScript + Tailwind CSS 4, content in Astro Content Collections.
No database, no login, no search service, no slide viewer, no mirrored data.

## Run it

Requires Node ≥ 22.18 (the validator runs with Node's built-in TypeScript type stripping).

```bash
npm install
npm run dev        # http://localhost:4321  (content errors are logged as warnings)
npm run validate   # editorial integrity checks only
npm run check      # astro check: TypeScript + templates
npm run build      # validate + static build into dist/  (fails on any content error)
npm run preview    # serve dist/
```

## Content model

```
src/content/
  organs/*.md       Organ topic: frontmatter + editable Markdown introduction
  diseases/*.yaml   Disease, linked to organs
  tasks/*.yaml      Clinical task (scope: specific) or task family (scope: general)
  datasets/*.yaml   Dataset
  methods/*.yaml    Method or model
```

* **One stable ID per resource.** The `id` field is authoritative (kebab-case, matches the
  filename, unique across all collections). Pages reference each other only by ID; no fact is
  written twice. Topic, task and dataset pages are assembled from the structured entries.
* **Every entry** has `id`, `title`, an original `summary`, `sources`, `review_status` and,
  only if an editor actually checked the sources, `last_verified`.
* **Facts point at sources.** Each `sources[]` item has a local `key`. Scale figures, versions,
  splits, access, terms, limitations and dataset relations carry `source:` (or `evidence:`) with
  one of those keys.
* **Datasets** keep scale per unit (`scale.patients`, `scale.slides`, `scale.rois`,
  `scale.patches`, `scale.centers`, `scale.storage`), never one `size`. `access` (how you get the
  data) and `terms` (licence / redistribution) are separate fields.
* **Methods** keep `code` and `weights` separately, each with its own licence and conditions.
  `datasets[]` records how a source says the method used a dataset: `pretraining`,
  `fine-tuning`, `evaluation` or `background`. `evaluation` / `fine-tuning` must name the `task`.
* **Missing fields render as "Not verified".** Leave a field out rather than guess.

Controlled vocabularies (stains, data units, annotation granularity, access methods, method
categories, uses, ...) live in `src/lib/vocab.ts` and feed both the Zod schema and the validator.

### What the relation labels mean

Computed in `src/lib/catalog.ts`, never typed by hand:

| Label | Rule |
| --- | --- |
| **Benchmark** | The method has an `evaluation` / `fine-tuning` / `pretraining` relation to a dataset for this exact task, with evidence. |
| **Same task family** | The method's `tasks` include this task or one of its `broader` families, but no result is recorded. Not validated. |
| **Background** | Context only (`background` relations, or a task's `background_reading`). |

## Build-time checks

`src/content.config.ts` validates each entry's shape and enums. `src/lib/validate.ts` runs before
every build (`npm run build`, and as an Astro integration in `astro:build:start`) and fails on:

* duplicate IDs across collections, malformed IDs
* invalid enum values
* broken references (organs, diseases, tasks, `broader`, `datasets[].dataset`, `datasets[].task`)
* a `source` / `evidence` / `primary_paper` key that the entry does not define
* `last_verified` on a non-verified entry, or a verified entry without it / with a future date
* a verified source citation without an `accessed` date
* a verified entry linking to a draft / needs-review entry
* an evaluation relation whose task is not one of the dataset's tasks

## Add an entry

1. Copy a similar file (e.g. `src/content/datasets/camelyon16.yaml`) and change `id` and the
   filename together.
2. Set `review_status: draft` and leave out `last_verified`.
3. Use awesome lists only to discover. Fill facts from the original paper, official site,
   official repository, model card or data portal, add each one to `sources` with an
   `accessed` date, and point every fact at its source key.
4. Write the summary yourself. Do not paste abstracts or README text; do not add images
   whose licence is unclear; do not download or mirror slides.
5. `npm run validate`.

Draft and needs-review entries stay in the repository but are excluded from every public page,
list and filter (`getCollection(..., isPublic)` in `catalog.ts`).

## Review an entry

1. Open every source; confirm each sourced field says what the source says.
2. Remove anything you cannot confirm (it will show "Not verified").
3. Check dataset relations: the `use` must be stated by the `evidence` source. "Could be used
   for" is not a relation; the task-family link covers that automatically.
4. Set `review_status: verified` and `last_verified: YYYY-MM-DD` (today), then
   `npm run build`.

## Filters and URLs

`/datasets/` and `/methods/` filter client-side over server-rendered cards
(`src/components/FilterPanel.astro`). Keyword + facets combine with AND; option counts update
live; state is written to the query string (`/datasets/?organ=breast&annotation=lesion-contour`),
so reloads and shared links keep the view. Without JavaScript the full list is shown.

## Seed content (verified 2026-11-20)

Datasets: PANDA, CAMELYON16, CAMELYON17, BRACS. Methods: ABMIL, CLAM, TransMIL, UNI.
Pending (not public): SICAPv2 (draft), CONCH (needs review).
