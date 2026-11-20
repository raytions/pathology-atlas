# Model inbox

The inbox is the **candidate pool** for new computational pathology models. It is not part of the
catalogue: nothing here is rendered on the site, and nothing here has been verified.

```
discovery (automatic, weekly)  ->  docs/inbox/YYYY-MM-DD.md   (candidates, unverified)
review (human or agent)        ->  src/content/methods/*.yaml (draft / needs-review, own branch + Draft PR)
publication (human decision)   ->  review_status: verified    (only then on the public site)
```

## Layer 1: automatic discovery

- Script: `scripts/discover-models.ts`, configured by `scripts/discover-models.config.json`
  (arXiv queries, GitHub topics, Hugging Face organisations and model IDs, look-back window).
- Run locally: `node scripts/discover-models.ts --date 2026-11-20` (add `--dry-run` to print instead
  of writing). Node 22.18+ runs the TypeScript directly.
- Schedule: `.github/workflows/discover-models.yml`, Mondays 06:00 UTC and on demand. It reads the
  catalogue from `main`, writes only `docs/inbox/<date>.md`, commits to the `content-inbox` branch and
  opens (or reuses) a Draft PR. It never pushes to `main`, never merges and never deploys.
- What it requests: metadata only (arXiv Atom API, GitHub search API, Hugging Face model API).
  It does not download weights or data, does not open README files, and does not execute anything
  from external pages. Text from those sources is used as input to simple heuristics, never as
  instructions.
- Re-running on the same day replaces only the block between `<!-- discover:start -->` and
  `<!-- discover:end -->`. Reviewer notes outside that block are kept.

## Candidate fields

| Field | Meaning |
| --- | --- |
| Discovered | Date the candidate entered the inbox |
| Type | `foundation model`, `task-specific model`, `vision-language model` or `other` (heuristic until reviewed) |
| Organ / task scope | Keyword-based guess until reviewed |
| Discovery source | Where it was found (arXiv query, GitHub topic, Hugging Face org / ID) |
| Primary links | Paper, official model card, official repository. Machine-found links are marked unverified |
| Duplicate / version relation | Match against `src/content/methods` by URL (same resource) or name family (possible version, e.g. UNI vs UNI2-h, Virchow vs Virchow2) |
| Suggested action | `new`, `extend` (already catalogued), `verify` (possible version / variant, or facts to check), `defer` (no public artefact or out of scope) |
| Missing evidence | What a reviewer still has to open before drafting |
| Fit for next batch | Reviewer's call; automatic runs only say "needs triage" or "no" |

Suggested actions are hints. The automatic layer never proposes `verified`.

## Layer 2: review

1. Pick a small batch (3 to 6) from one or more inbox files. Prefer, in order:
   1. models whose paper or official results page reports results on a dataset already published
      here (needs a table / figure / page location);
   2. models with public weights, code and licence, even without such an evaluation;
   3. high-impact models whose evaluations on catalogued data are not yet checked;
   4. paper-only models (defer or keep in the inbox).
2. Open the primary sources: paper (peer-reviewed version if one exists), official model card,
   official repository. Lists, blog posts and mirrors are discovery only.
3. Watch for renamed models, version bumps and wrong citations in third-party lists (one example
   from the first pass: a list links Phikon to an arXiv ID that belongs to an unrelated mathematics
   paper).
4. Write entries with the existing schema on a branch cut from `main`, with
   `review_status: draft` or `needs-review` and no `last_verified`. Record paper, model card, repository,
   weights, code, licence and access conditions separately. Version relations (supersedes,
   variant of, related to) go in the summary and `reviewer_notes` until the schema has a field for
   them.
5. Dataset relations only when a source states them, with the exact dataset / subset and task and a
   locatable piece of evidence. Evaluation code, released features or a fine-tuning example are not
   results.
6. Open a Draft PR with the evidence locations, conflicts and open questions. Promotion to
   `verified` is a separate, explicit decision.

## Statuses used in inbox files

Reviewers can add a line under a candidate: `Status: picked (PR #n)`, `Status: drafted`,
`Status: deferred (reason)` or `Status: duplicate of <id>`.
