// Run with: npm run validate   (node scripts/validate-content.ts)
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateContent } from '../src/lib/validate.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { errors, warnings, stats } = validateContent(root);

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);

const summary = Object.entries(stats)
  .map(([c, s]) => `${c} ${s.public}/${s.total}`)
  .join(' · ');
console.log(`content: ${summary} (public/total)`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} content error(s).`);
  process.exit(1);
}
console.log('✓ content valid');
