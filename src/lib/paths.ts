/**
 * Prefix an in-site path with the configured base (e.g. "/pathology-atlas" on
 * GitHub Pages, "/" locally). Always pass a root-relative path like "/datasets/".
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
