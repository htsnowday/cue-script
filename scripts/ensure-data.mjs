// Generate the play data on first run (it is not committed).
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync(new URL('../src/lib/data/catalog.json', import.meta.url))) {
	execSync('npm run data', { stdio: 'inherit' });
}
