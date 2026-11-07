/**
 * Build the character list for a play from its scenes.
 *
 * Used by every non-Folger source and by `applyCorrections`, so stats,
 * on-stage presence, name disambiguation and URL slugs are computed the same
 * way however the play arrived.
 */
import type { Character, Scene, TextLine } from './types';
import { slugify, uniqueSlug } from './text';

export interface CharacterDecl {
	name: string;
	desc?: string;
	/** Position in a cast list, if the source had one. */
	order?: number;
	minor?: boolean;
}

const ORDINALS = ['', '', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const GROUP_NAMES = /^(all|both|omnes|others|several|crowd|chorus of|citizens|lords|servants|soldiers|attendants)\b/i;

export function computeCharacters(scenes: Scene[], decls: Map<string, CharacterDecl>): Character[] {
	type Acc = { lines: number; speeches: number; words: number; presence: Set<number>; first: number };
	const acc = new Map<string, Acc>();
	const get = (id: string, si: number) => {
		let a = acc.get(id);
		if (!a) acc.set(id, (a = { lines: 0, speeches: 0, words: 0, presence: new Set(), first: si }));
		return a;
	};
	const speaking = new Set<string>();

	scenes.forEach((scene, si) => {
		for (const b of scene.blocks) {
			if (b.kind === 'sp') {
				const lines = b.items.filter((x): x is TextLine => x.kind === 'line');
				const words = lines.reduce((n, l) => n + l.t.split(/\s+/).filter(Boolean).length, 0);
				for (const id of b.who) {
					speaking.add(id);
					const a = get(id, si);
					a.speeches++;
					a.lines += lines.length;
					a.words += words;
					a.presence.add(si);
				}
				for (const it of b.items) if (it.kind === 'sd') for (const id of it.who ?? []) get(id, si).presence.add(si);
			} else {
				for (const id of b.who) get(id, si).presence.add(si);
			}
		}
	});

	const chars: Character[] = [];
	for (const id of speaking) {
		const a = acc.get(id)!;
		const d = decls.get(id);
		const name = d?.name ?? id;
		chars.push({
			id,
			slug: '',
			name,
			...(d?.desc ? { desc: d.desc } : {}),
			order: d?.order ?? 10_000 + a.first,
			...((d?.minor ?? GROUP_NAMES.test(name)) ? { minor: true } : {}),
			stats: { lines: a.lines, speeches: a.speeches, words: a.words, scenes: a.presence.size },
			presence: [...a.presence].sort((x, y) => x - y)
		});
	}

	// Disambiguate duplicate display names by first scene.
	const byName = new Map<string, Character[]>();
	for (const c of chars) byName.set(c.name, [...(byName.get(c.name) ?? []), c]);
	for (const [, group] of byName) {
		if (group.length < 2) continue;
		const seen = new Map<string, number>();
		for (const c of group) {
			const ref = scenes[c.presence[0]]?.ref ?? '?';
			const k = (seen.get(ref) ?? 0) + 1;
			seen.set(ref, k);
			c.name = `${c.name} (${ref}${k > 1 ? `, ${ORDINALS[k] ?? k}` : ''})`;
		}
	}

	chars.sort((a, b) => a.order - b.order || b.stats.lines - a.stats.lines);
	const used = new Set<string>();
	for (const c of chars) c.slug = uniqueSlug(slugify(c.name).slice(0, 48).replace(/-+$/, ''), used);
	return chars;
}
