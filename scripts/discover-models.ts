// Model discovery: scan public metadata (arXiv, GitHub topics, Hugging Face orgs / model IDs)
// and write candidates to docs/inbox/YYYY-MM-DD.md for review.
//
//   node scripts/discover-models.ts [--date 2026-11-20] [--config scripts/discover-models.config.json]
//                                   [--out docs/inbox] [--dry-run]
//
// Safety rules (see docs/inbox/README.md):
//  - Only metadata APIs are requested (JSON / Atom). No weights, no slides, no README execution.
//  - Text from external pages is treated as data for heuristics, never as instructions.
//  - Never writes to src/content/. Output is a candidate pool, not catalogue entries.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  classify,
  dedupe,
  sortCandidates,
  mergeInbox,
  relationToCatalogue,
  renderCandidates,
  toCandidate,
  type CatalogueEntry,
  type RawHit,
} from './lib/discover-core.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

interface Config {
  lookbackDays: number;
  maxPerQuery: number;
  arxiv: string[];
  githubTopics: string[];
  hfAuthors: string[];
  hfModels: string[];
}

const UA = { 'User-Agent': 'pathology-atlas-discovery (+https://github.com/raytions/pathology-atlas)' };

async function getText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const r = await fetch(url, { headers: { ...UA, ...headers } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

const findUrls = (s: string) =>
  [...new Set((s.match(/https?:\/\/(?:github\.com|huggingface\.co)\/[\w.\-/]+/gi) ?? []).map((u) => u.replace(/[.)\],;]+$/, '')))];

export async function fromArxiv(query: string, cfg: Config, since: Date): Promise<RawHit[]> {
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=${cfg.maxPerQuery}`;
  const xml = await getText(url);
  const entries = xml.split('<entry>').slice(1);
  const out: RawHit[] = [];
  for (const e of entries) {
    const pick = (tag: string) => (e.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) ?? [])[1]?.replace(/\s+/g, ' ').trim() ?? '';
    const id = pick('id').replace(/v\d+$/, '').replace('http://', 'https://');
    const published = pick('published');
    if (published && new Date(published) < since) continue;
    const summary = pick('summary');
    const comment = pick('arxiv:comment');
    out.push({
      source: 'arXiv',
      via: query,
      name: pick('title'),
      url: id,
      text: `${pick('title')} ${summary} ${comment}`,
      date: published.slice(0, 10),
      links: findUrls(`${summary} ${comment}`),
    });
  }
  return out;
}

export async function fromGithubTopic(topic: string, cfg: Config, since: Date): Promise<RawHit[]> {
  const q = `topic:${topic} pushed:>=${since.toISOString().slice(0, 10)}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${cfg.maxPerQuery}`;
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const data = JSON.parse(await getText(url, headers));
  return (data.items ?? []).map((r: any) => ({
    source: 'GitHub' as const,
    via: `topic:${topic}`,
    name: r.full_name,
    url: r.html_url,
    text: `${r.name} ${r.description ?? ''} ${(r.topics ?? []).join(' ')}`,
    date: (r.pushed_at ?? '').slice(0, 10),
    links: [r.homepage, ...findUrls(r.description ?? '')].filter(Boolean),
    license: r.license?.spdx_id ?? undefined,
  }));
}

function hfHit(m: any, via: string): RawHit {
  const tags: string[] = m.tags ?? [];
  const arxiv = tags.filter((t) => t.startsWith('arxiv:')).map((t) => `https://arxiv.org/abs/${t.slice(6)}`);
  const license = m.cardData?.license ?? tags.find((t) => t.startsWith('license:'))?.slice(8);
  return {
    source: 'Hugging Face',
    via,
    name: m.id,
    url: `https://huggingface.co/${m.id}`,
    text: `${m.id} ${m.pipeline_tag ?? ''} ${tags.join(' ')}`,
    date: (m.lastModified ?? m.createdAt ?? '').slice(0, 10),
    links: arxiv,
    gated: m.gated,
    license,
  };
}

export async function fromHfAuthor(author: string, cfg: Config, since: Date): Promise<RawHit[]> {
  const url = `https://huggingface.co/api/models?author=${encodeURIComponent(author)}&sort=lastModified&direction=-1&limit=${cfg.maxPerQuery}&full=true&cardData=true`;
  const data = JSON.parse(await getText(url));
  return data.filter((m: any) => !m.lastModified || new Date(m.lastModified) >= since).map((m: any) => hfHit(m, `author:${author}`));
}

export async function fromHfModel(id: string): Promise<RawHit[]> {
  const data = JSON.parse(await getText(`https://huggingface.co/api/models/${id}`));
  return [hfHit(data, `model:${id}`)];
}

/** Current catalogue (any review status) from src/content/methods, for duplicate checks. */
export function loadCatalogue(dir = join(root, 'src', 'content', 'methods')): CatalogueEntry[] {
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => {
      const d = parseYaml(readFileSync(join(dir, f), 'utf8')) ?? {};
      const urls = [...(d.sources ?? []).map((s: any) => s.url), d.code?.url, d.weights?.url].filter(Boolean);
      return { id: d.id, title: d.title, shortName: d.short_name, urls, status: d.review_status };
    });
}

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function main() {
  const date = arg('date', new Date().toISOString().slice(0, 10))!;
  const cfgPath = arg('config', join(root, 'scripts', 'discover-models.config.json'))!;
  const outDir = arg('out', join(root, 'docs', 'inbox'))!;
  const dry = process.argv.includes('--dry-run');
  const cfg: Config = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const since = new Date(new Date(`${date}T00:00:00Z`).getTime() - cfg.lookbackDays * 864e5);

  const jobs: [string, () => Promise<RawHit[]>][] = [
    ...cfg.arxiv.map((q) => [`arXiv ${q}`, () => fromArxiv(q, cfg, since)] as [string, () => Promise<RawHit[]>]),
    ...cfg.githubTopics.map((t) => [`GitHub topic:${t}`, () => fromGithubTopic(t, cfg, since)] as [string, () => Promise<RawHit[]>]),
    ...cfg.hfAuthors.map((a) => [`HF author:${a}`, () => fromHfAuthor(a, cfg, since)] as [string, () => Promise<RawHit[]>]),
    ...cfg.hfModels.map((m) => [`HF model:${m}`, () => fromHfModel(m)] as [string, () => Promise<RawHit[]>]),
  ];
  const hits: RawHit[] = [];
  const log: string[] = [];
  for (const [label, job] of jobs) {
    try {
      const h = await job();
      hits.push(...h);
      log.push(`- ${label}: ${h.length} hit(s)`);
    } catch (e) {
      log.push(`- ${label}: failed (${(e as Error).message})`);
    }
    if (label.startsWith('arXiv')) await new Promise((r) => setTimeout(r, 3000)); // arXiv API etiquette
  }

  const catalogue = loadCatalogue();
  // GitHub topics are noisy: keep repositories that look like models, drop curated lists.
  const kept = hits.filter((h) => h.source !== 'GitHub' || (!/awesome|curated list/i.test(h.text) && classify(h.text) !== 'other'));
  const groups = dedupe(kept);
  const known = groups.filter((g) => g.some((h) => relationToCatalogue(h, catalogue).kind === 'same'));
  const fresh = groups.filter((g) => !known.includes(g));
  const cands = sortCandidates(fresh.map((g) => toCandidate(g, catalogue, date)));

  const generated = [
    `## Automatic discovery (${new Date().toISOString().slice(0, 16)}Z)`,
    '',
    `Lookback: ${cfg.lookbackDays} days (since ${since.toISOString().slice(0, 10)}). ${hits.length} raw hits, ${kept.length} after filtering, ${groups.length} after de-duplication, ${known.length} already catalogued.`,
    '',
    '<details><summary>Queries run</summary>',
    '',
    ...log,
    '',
    '</details>',
    '',
    renderCandidates(cands),
    known.length ? '#### Already catalogued (source URL matches an entry)\n\n' + known.map((g) => {
      const r = relationToCatalogue(g.find((h) => relationToCatalogue(h, catalogue).kind === 'same')!, catalogue);
      return `- ${g[0].name}: \`${r.match!.id}\` (${r.match!.status}). Check only if the upstream record changed.`;
    }).join('\n') + '\n' : '',
  ].join('\n');

  const header = `# Model inbox ${date}\n\nCandidate pool, **not verified**. Machine-generated fields below are hints for triage; see [README](./README.md) for the review flow. Nothing here is published.`;
  const file = join(outDir, `${date}.md`);
  const merged = mergeInbox(existsSync(file) ? readFileSync(file, 'utf8') : null, generated, header);
  if (dry) {
    process.stdout.write(merged);
  } else {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(file, merged);
    console.log(`wrote ${file}: ${cands.length} candidate(s), ${known.length} already catalogued`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
