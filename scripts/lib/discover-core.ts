/**
 * Pure helpers for the model discovery pipeline (no network, no file system).
 * The CLI in scripts/discover-models.ts fetches metadata and calls these.
 *
 * Everything produced here is a *candidate* for human / agent review. Nothing in this
 * module writes to src/content/ or decides that a model is verified.
 */

export type CandidateType = 'foundation model' | 'task-specific model' | 'vision-language model' | 'other';
export type Action = 'new' | 'extend' | 'verify' | 'defer';

export interface RawHit {
  /** Where the hit came from: "arXiv", "GitHub", "Hugging Face". */
  source: 'arXiv' | 'GitHub' | 'Hugging Face';
  /** Query / topic / org that produced the hit. */
  via: string;
  name: string;
  url: string;
  /** Short metadata text used only for heuristics (title + abstract / description / tags). */
  text: string;
  /** ISO date the item was published or last updated upstream, if known. */
  date?: string;
  /** Extra links found in metadata (code, model card, paper). Never fetched or executed. */
  links?: string[];
  /** Hugging Face only: whether the repo is gated, if the API says so. */
  gated?: boolean | string;
  license?: string;
}

export interface CatalogueEntry {
  id: string;
  title: string;
  shortName?: string;
  urls: string[];
  status: string;
}

export interface Candidate {
  discovered: string;
  name: string;
  type: CandidateType;
  scope: string;
  sources: string[];
  primaryLinks: string[];
  relation: string;
  action: Action;
  missing: string[];
  nextBatch: string;
}

const ORGAN_WORDS: [RegExp, string][] = [
  [/prostat|gleason/i, 'prostate'],
  [/breast|camelyon|bracs|her2/i, 'breast'],
  [/colo(n|rectal)|crc\b|polyp/i, 'colorectal'],
  [/lung|luad|lusc|nsclc/i, 'lung'],
  [/kidney|renal|rcc\b/i, 'kidney'],
  [/glioma|brain|ebrains/i, 'brain'],
  [/skin|melanom/i, 'skin'],
  [/cervi|cytolog/i, 'cervix / cytology'],
];

const TASK_WORDS: [RegExp, string][] = [
  [/segment/i, 'segmentation'],
  [/nucle|cell (detection|classification)/i, 'nucleus / cell analysis'],
  [/surviv|prognos/i, 'survival / prognosis'],
  [/mutation|biomarker|msi\b|gene expression|transcript/i, 'biomarker / molecular prediction'],
  [/report generation|captioning|vqa|question answering/i, 'text generation / VQA'],
  [/slide[- ]level|whole[- ]slide|wsi/i, 'slide-level analysis'],
];

export function classify(text: string): CandidateType {
  if (/(vision[- ]language|clip\b|contrastive.*(caption|text)|image[- ]text|caption|multimodal large language|\bvlm\b|llava)/i.test(text)) {
    return 'vision-language model';
  }
  if (/(foundation model|self[- ]supervised|pretrain(ed|ing)?|general[- ]purpose|encoder|dinov2|masked image model)/i.test(text)) {
    return 'foundation model';
  }
  if (/(segmentation|classification|detection|grading|prediction|mil\b|multiple instance)/i.test(text)) {
    return 'task-specific model';
  }
  return 'other';
}

export function scopeOf(text: string): string {
  const organs = ORGAN_WORDS.filter(([re]) => re.test(text)).map(([, o]) => o);
  const tasks = TASK_WORDS.filter(([re]) => re.test(text)).map(([, t]) => t);
  const parts = [organs.length ? organs.join(', ') : 'cross-organ or unstated', ...(tasks.length ? [tasks.join(', ')] : [])];
  return parts.join(' / ');
}

/** Normalise a model name for duplicate / family detection: "UNI2-h" -> "uni", "Virchow2" -> "virchow". */
export function familyKey(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/^.*\//, '') // drop HF org prefix
    .replace(/[-_ ]?(v\d+(\.\d+)?|\d+(\.\d+)?)([-_ ]?[a-z]{1,2})?$/i, '') // trailing version / size tag
    .replace(/[-_ ]?(base|large|huge|giant|small|tiny|preview|h|g|l|b)$/i, '')
    .replace(/[^a-z0-9]+/g, '');
  return base || name.toLowerCase();
}

export function sameUrl(a: string, b: string): boolean {
  const n = (u: string) => u.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/(\.git)?\/?(#.*)?$/, '').replace(/v\d+$/, '');
  return n(a) === n(b);
}

/** How a hit relates to the existing catalogue. */
export function relationToCatalogue(hit: RawHit, catalogue: CatalogueEntry[]): { relation: string; match?: CatalogueEntry; kind: 'same' | 'family' | 'none' } {
  const urls = [hit.url, ...(hit.links ?? [])];
  for (const e of catalogue) {
    if (e.urls.some((u) => urls.some((h) => sameUrl(u, h)))) {
      return { relation: `Same resource as catalogued \`${e.id}\` (${e.status}); a source URL matches.`, match: e, kind: 'same' };
    }
  }
  const key = familyKey(hit.name);
  for (const e of catalogue) {
    if ([e.id, e.title, e.shortName ?? ''].some((n) => n && familyKey(n) === key)) {
      return {
        relation: `Possible version or variant of catalogued \`${e.id}\` (${e.status}); name family "${key}". Check whether it is a separate model.`,
        match: e,
        kind: 'family',
      };
    }
  }
  return { relation: 'No match in the catalogue.', kind: 'none' };
}

export function suggestAction(hit: RawHit, kind: 'same' | 'family' | 'none'): Action {
  if (kind === 'same') return 'extend';
  if (kind === 'family') return 'verify';
  const hasArtifact =
    hit.source !== 'arXiv' || (hit.links ?? []).some((l) => /github\.com|huggingface\.co/i.test(l));
  return hasArtifact ? 'new' : 'defer';
}

export function missingEvidence(hit: RawHit, kind: 'same' | 'family' | 'none'): string[] {
  const m = ['Not opened by a reviewer: all fields are machine-extracted from metadata.'];
  if (hit.source === 'arXiv') m.push('Preprint only so far: check for a peer-reviewed version, official model card and code.');
  if (hit.source !== 'Hugging Face') m.push('Weights location and access terms not checked.');
  if (hit.source === 'Hugging Face' && !hit.license) m.push('Licence not stated in API metadata.');
  m.push('No evaluation on catalogued datasets checked (needs a table / figure location).');
  if (kind !== 'none') m.push('Version relation to the catalogued entry must be confirmed from official sources.');
  return m;
}

/** Merge hits that point at the same model (same URL or same family key + source pairing). */
export function dedupe(hits: RawHit[]): RawHit[][] {
  const groups: RawHit[][] = [];
  for (const h of hits) {
    const g = groups.find((grp) =>
      grp.some(
        (x) =>
          sameUrl(x.url, h.url) ||
          (x.links ?? []).some((l) => sameUrl(l, h.url)) ||
          (h.links ?? []).some((l) => sameUrl(l, x.url)) ||
          x.name.toLowerCase() === h.name.toLowerCase(),
      ),
    );
    if (g) g.push(h);
    else groups.push([h]);
  }
  return groups;
}

export function toCandidate(group: RawHit[], catalogue: CatalogueEntry[], discovered: string): Candidate {
  const lead = group.find((h) => h.source === 'Hugging Face') ?? group.find((h) => h.source === 'GitHub') ?? group[0];
  const text = group.map((h) => `${h.name} ${h.text}`).join(' ');
  const rel = group.map((h) => relationToCatalogue(h, catalogue)).sort((a, b) => ['same', 'family', 'none'].indexOf(a.kind) - ['same', 'family', 'none'].indexOf(b.kind))[0];
  const primary = [...new Set(group.flatMap((h) => [h.url, ...(h.links ?? [])]))].filter((u) => /arxiv\.org\/abs|huggingface\.co|github\.com|doi\.org|nature\.com/i.test(u));
  const action = suggestAction(lead, rel.kind);
  return {
    discovered,
    name: lead.name,
    type: classify(text),
    scope: scopeOf(text),
    sources: [...new Set(group.map((h) => `${h.source} (${h.via})`))],
    primaryLinks: primary.slice(0, 5),
    relation: rel.relation,
    action,
    missing: missingEvidence(lead, rel.kind),
    nextBatch: action === 'defer' ? 'No: no public artefact found yet.' : 'Needs triage: open the primary links first.',
  };
}

/** Model-like, artefact-backed candidates first; defer last. */
export function sortCandidates(c: Candidate[]): Candidate[] {
  const actionRank = { extend: 0, verify: 1, new: 2, defer: 3 } as const;
  const srcRank = (x: Candidate) => (x.sources.some((s) => s.startsWith('Hugging Face')) ? 0 : x.sources.some((s) => s.startsWith('GitHub')) ? 1 : 2);
  const typeRank = (x: Candidate) => (x.type === 'other' ? 1 : 0);
  return [...c].sort((a, b) => actionRank[a.action] - actionRank[b.action] || typeRank(a) - typeRank(b) || srcRank(a) - srcRank(b));
}

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function renderCandidates(cands: Candidate[]): string {
  if (!cands.length) return '_No new candidates from automatic discovery in this run._\n';
  return cands
    .map(
      (c, i) => `### ${i + 1}. ${esc(c.name)}

| Field | Value |
| --- | --- |
| Discovered | ${c.discovered} |
| Type | ${c.type} |
| Organ / task scope | ${esc(c.scope)} |
| Discovery source | ${esc(c.sources.join('; '))} |
| Primary links (unverified) | ${c.primaryLinks.length ? c.primaryLinks.map((u) => `<${u}>`).join('<br>') : 'Not found'} |
| Duplicate / version relation | ${esc(c.relation)} |
| Suggested action | \`${c.action}\` |
| Missing evidence | ${esc(c.missing.join(' '))} |
| Fit for next batch | ${esc(c.nextBatch)} |
`,
    )
    .join('\n');
}

export const START = '<!-- discover:start -->';
export const END = '<!-- discover:end -->';

/** Replace only the generated block; keep any reviewer text outside the markers. */
export function mergeInbox(existing: string | null, generated: string, header: string): string {
  const block = `${START}\n${generated.trimEnd()}\n${END}`;
  if (!existing) return `${header.trimEnd()}\n\n${block}\n`;
  if (existing.includes(START) && existing.includes(END)) {
    return existing.slice(0, existing.indexOf(START)) + block + existing.slice(existing.indexOf(END) + END.length);
  }
  return `${existing.trimEnd()}\n\n${block}\n`;
}
