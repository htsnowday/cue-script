import type { CatalogPlay } from './play/types';

export interface SearchResult {
	kind: 'character' | 'play';
	play: CatalogPlay;
	character?: CatalogPlay['characters'][number];
	score: number;
}

export const norm = (s: string) =>
	s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[’'`]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

/** 0 = no match; higher is better. */
function scoreText(hay: string, q: string): number {
	if (!q) return 0;
	if (hay === q) return 100;
	if (hay.startsWith(q)) return 80;
	if ((' ' + hay).includes(' ' + q)) return 65;
	if (hay.includes(q)) return 40;
	// every query word must prefix some word in hay
	const hw = hay.split(' ');
	const qw = q.split(' ');
	if (qw.length > 1 && qw.every((w) => hw.some((h) => h.startsWith(w)))) return 55;
	// loose subsequence (typo-ish tolerance) for longer queries
	if (q.length >= 4) {
		let i = 0;
		for (const ch of hay) if (ch === q[i]) i++;
		if (i === q.length) return 12;
	}
	return 0;
}

export function search(catalog: CatalogPlay[], query: string, limit = 12): SearchResult[] {
	const q = norm(query);
	if (!q) return [];
	const out: SearchResult[] = [];
	for (const play of catalog) {
		const pt = norm(play.title);
		const ps = Math.max(scoreText(pt, q), scoreText(pt.replace(/^the /, ''), q), scoreText(norm(play.id), q) && 70);
		if (ps) out.push({ kind: 'play', play, score: ps + 5 });
		for (const character of play.characters) {
			let s = scoreText(norm(character.name), q);
			// "macbeth lady" / "dion winter"
			if (!s) {
				const combo = norm(`${character.name} ${play.title}`);
				const words = q.split(' ');
				if (words.length > 1 && words.every((w) => combo.includes(w))) s = 50;
			}
			// "Puck" lives in Robin Goodfellow's description.
			if (!s && character.desc && q.length >= 3 && (' ' + norm(character.desc)).includes(' ' + q)) s = 35;
			if (!s) continue;
			// Big parts float up; walk-ons sink.
			if (s >= 35) s += Math.min(18, Math.log2(1 + character.lines) * 1.8);
			if (character.minor) s -= 10;
			if (s <= 0) continue;
			out.push({ kind: 'character', play, character, score: s });
		}
	}
	return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
