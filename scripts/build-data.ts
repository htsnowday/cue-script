/**
 * Build the normalized play data from Folger TEI Simple texts.
 *
 *   npm run data            # clones the texts (if needed) and regenerates JSON
 *   TEI_DIR=/path npm run data
 *
 * Source: Folger Shakespeare TEI Simple, as mirrored by DraCor
 * (https://github.com/dracor-org/shakedracor). © Folger Shakespeare Library,
 * CC BY-NC 3.0.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { parseFolgerTei } from '../src/lib/sources/folger-tei';
import { DESC_FIXES, GENRES, NAME_OVERRIDES, TITLE_OVERRIDES } from '../src/lib/play/catalog-meta';
import type { CatalogPlay } from '../src/lib/play/types';

const root = resolve(import.meta.dirname, '..');
const vendor = join(root, '.sources', 'shakedracor');
const teiDir = process.env.TEI_DIR ?? join(vendor, 'tei');
const outDir = join(root, 'src', 'lib', 'data');

/** Pinned so the generated data is reproducible. Bump deliberately. */
const DRACOR_REPO = 'https://github.com/dracor-org/shakedracor';
const DRACOR_COMMIT = '7381f58e9d81c222461ee24533e1dbe8e89c6197';

if (!process.env.TEI_DIR && !existsSync(teiDir)) {
	console.log(`Fetching Folger TEI texts from DraCor @ ${DRACOR_COMMIT.slice(0, 7)}…`);
	mkdirSync(vendor, { recursive: true });
	const git = (...args: string[]) => execFileSync('git', ['-C', vendor, ...args], { stdio: 'inherit' });
	git('init', '-q');
	git('remote', 'add', 'origin', DRACOR_REPO);
	git('fetch', '-q', '--depth', '1', 'origin', DRACOR_COMMIT);
	git('checkout', '-q', 'FETCH_HEAD');
}

rmSync(join(outDir, 'plays'), { recursive: true, force: true });
mkdirSync(join(outDir, 'plays'), { recursive: true });

const files = readdirSync(teiDir).filter((f) => f.endsWith('.xml')).sort();
const catalog: CatalogPlay[] = [];
const warnings: string[] = [];

for (const file of files) {
	const xml = readFileSync(join(teiDir, file), 'utf8');
	const doc = new DOMParser({
		onError: (level, msg) => {
			if (level !== 'warning') warnings.push(`${file}: ${msg}`);
		}
	}).parseFromString(xml, 'text/xml');
	const slug = file.replace(/\.xml$/, '');
	// Read the code first so we can look up genre & title overrides.
	const probe = parseFolgerTei(doc as never, { slug, via: 'DraCor (dracor.org)', nameOverrides: NAME_OVERRIDES });
	const play = {
		...probe,
		genre: GENRES[probe.id] ?? 'other',
		title: TITLE_OVERRIDES[probe.id] ?? probe.title
	};
	for (const c of play.characters) {
		if (c.desc) for (const [re, to] of DESC_FIXES) c.desc = c.desc.replace(re, to);
	}
	writeFileSync(join(outDir, 'plays', `${slug}.json`), JSON.stringify(play));
	catalog.push({
		id: play.id,
		slug: play.slug,
		title: play.title,
		genre: play.genre,
		lines: play.characters.reduce((n, c) => n + c.stats.lines, 0),
		characters: play.characters.map((c) => ({
			slug: c.slug,
			name: c.name,
			...(c.desc ? { desc: c.desc } : {}),
			lines: c.stats.lines,
			...(c.minor ? { minor: true } : {})
		}))
	});
	console.log(
		`${play.id.padEnd(4)} ${play.title.padEnd(36)} ${String(play.scenes.length).padStart(3)} scenes ${String(play.characters.length).padStart(3)} parts`
	);
}

catalog.sort((a, b) => a.title.replace(/^The /, '').localeCompare(b.title.replace(/^The /, '')));
writeFileSync(join(outDir, 'catalog.json'), JSON.stringify(catalog));
if (warnings.length) console.warn(`\n${warnings.length} XML warnings:\n` + warnings.slice(0, 10).join('\n'));
console.log(`\nWrote ${catalog.length} plays, ${catalog.reduce((n, p) => n + p.characters.length, 0)} parts.`);
