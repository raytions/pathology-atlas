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
npm test           # relation regression tests (+ a check of dist/index.html when built)
npm run preview    # serve dist/
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci`, validate, check, build
with `BASE_PATH=/<repo>` and `SITE_URL=https://<owner>.github.io`, then publishes `dist/` to the
`gh-pages` branch. In the repository settings, Pages should serve from the `gh-pages` branch
(root). Live site: https://raytions.github.io/pathology-atlas/

In-site links go through `withBase()` (`src/lib/paths.ts`), so the same code works at `/`
locally and under `/pathology-atlas/` on Pages. To preview the Pages build locally:

```bash
BASE_PATH=/pathology-atlas npm run build && BASE_PATH=/pathology-atlas npm run preview
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

Annotation granularity says what one released label is attached to. Pick the value that matches
the release, not the paper's experiment:

| Value | Use when the release ships |
| --- | --- |
| `slide-label` / `patient-label` | one label per slide / per patient |
| `roi-label` | one label per annotator-chosen region of interest (variable size), e.g. BRACS ROIs |
| `patch-label` | one class label per fixed-size patch or tile, e.g. 224 x 224 tissue-type tiles |
| `region-mask` / `pixel-mask` | spatial masks (regions or per-pixel classes) |
| `lesion-contour` | polygon outlines of lesions |

A dataset can list several (for example patch images with masks and per-patch labels).

### What the relation labels mean

Each method-dataset relation is one row in the method's `datasets[]` with a `use` and an
`evidence` source. The display never merges uses: a method with evaluation and pretraining
relations shows both labels, and every relation row on the method page has a stable anchor
(`#rel-<dataset>-<use>[-<task>]`) next to its evidence source. Task, dataset and organ pages
link each relation back to that row.

| Label | Comes from | Meaning |
| --- | --- | --- |
| **Evaluation** | `use: evaluation` + `task` + evidence | A cited source reports evaluating the method on that dataset for that task. |
| **Fine-tuning** | `use: fine-tuning` + `task` + evidence | Trained / fine-tuned on the dataset. Not by itself a result. |
| **Pretraining** | `use: pretraining` + evidence | Part of the pretraining data. Says nothing about performance on it. |
| **Background** | `use: background`, or a task's `background_reading` | Context only. |
| **Same task family** | inferred: the method's `tasks` include the task or one of its `broader` families | No relation to this dataset is recorded. Shown only when nothing evaluates or fine-tunes the method in that context; never phrased as "evaluated". |

The logic lives in `src/lib/relations.ts` (pure, unit tested) and is wrapped by
`src/lib/catalog.ts` for pages. A relation matches a task only when `task` equals it;
pretraining / background relations without `task` match the tasks their dataset lists.

### Home-page worked path

`src/data/featured.ts` names the organ, task and dataset explicitly. The validator (and the home
page at build time) fail if any of them is unpublished, if the task or dataset is not linked to
the organ, or if the dataset does not list the task. Methods on the path show only relations
that match **both** the task and the dataset (with an explicit `task`). If none is an
evaluation, the page says that no evaluation is recorded yet; results on other datasets of the
same task are never used to fill the gap. Scale and access come from the structured `scale.*`
and `access.method` fields.

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
* a home-page featured path (`src/data/featured.ts`) that is unpublished or not linked

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
