/**
 * The worked path on the home page. Explicit IDs, never "first item after sorting".
 * Checked by src/lib/validate.ts (all three must be verified and linked to each other)
 * and again at render time in src/pages/index.astro.
 */
export const FEATURED_PATH = {
  organId: 'prostate',
  taskId: 'gleason-grading',
  datasetId: 'panda',
} as const;
