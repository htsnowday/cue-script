/**
 * Cast-review corrections, kept separate from the parsed play.
 *
 * The parser's output is never edited in place. Instead the user's fixes are
 * stored as a small list of corrections and re-applied whenever the play is
 * rebuilt (e.g. after switching the speaker layout). A future full script
 * editor can add new kinds of correction here without changing anything else.
 */
import type { Block, Direction, Play, Scene, Speech } from './types';
import { computeCharacters, type CharacterDecl } from './characters';
import { slugify, titleCaseSpeaker } from './text';

export interface Corrections {
	/** New play title. */
	title?: string;
	/** Character id → display name. */
	rename: Record<string, string>;
	/** Character id → id it should be merged into ("HAM." → "HAMLET"). */
	merge: Record<string, string>;
	/** Ids that aren't characters at all; their "speeches" become stage directions. */
	notCharacter: string[];
}

export const emptyCorrections = (): Corrections => ({ rename: {}, merge: {}, notCharacter: [] });

export function hasCorrections(c: Corrections): boolean {
	return !!c.title || Object.keys(c.rename).length > 0 || Object.keys(c.merge).length > 0 || c.notCharacter.length > 0;
}

/** Strip the "(2.3)" / "(2.3, second)" suffix added to tell duplicate names apart. */
const baseName = (n: string) => n.replace(/ \((?:[\w.]+)(?:, \w+)?\)$/, '');

export function applyCorrections(play: Play, c: Corrections): Play {
	const target = (id: string): string => {
		const seen = new Set<string>();
		let cur = id;
		while (c.merge[cur] && !seen.has(cur)) {
			seen.add(cur);
			cur = c.merge[cur];
		}
		return cur;
	};
	const notChar = new Set(c.notCharacter.map(target));
	const mapWho = (who: string[]) => [...new Set(who.map(target))].filter((id) => !notChar.has(id));

	const scenes: Scene[] = play.scenes.map((s) => ({
		...s,
		blocks: s.blocks.map((b): Block => {
			if (b.kind === 'sd') return { ...b, who: mapWho(b.who) };
			const who = mapWho(b.who);
			if (!who.length) return speechToDirection(b);
			return {
				...b,
				who,
				items: b.items.map((it) => (it.kind === 'sd' && it.who ? { ...it, who: mapWho(it.who) } : it))
			};
		})
	}));

	const decls = new Map<string, CharacterDecl>();
	for (const ch of play.characters) {
		const id = target(ch.id);
		if (decls.has(id) && id !== ch.id) continue; // keep the merge target's own details
		decls.set(id, {
			name: c.rename[id] ?? baseName(ch.name),
			...(ch.desc ? { desc: ch.desc } : {}),
			order: ch.order,
			...(ch.minor ? { minor: true } : {})
		});
	}
	for (const [id, name] of Object.entries(c.rename)) {
		const t = target(id);
		const d = decls.get(t);
		if (d && t === id) d.name = name;
	}

	const title = c.title?.trim() || play.title;
	return { ...play, title, slug: slugify(title), scenes, characters: computeCharacters(scenes, decls) };
}

function speechToDirection(sp: Speech): Direction {
	const label = sp.speaker === sp.speaker.toUpperCase() ? titleCaseSpeaker(sp.speaker) : sp.speaker;
	const text = sp.items.map((it) => it.t).join(' ');
	const t = [label, text].filter(Boolean).join('. ').replace(/\.\.+/g, '.');
	const d: Direction = { kind: 'sd', t, who: [] };
	if (/^(enter|re-?enter)\b/i.test(t)) d.type = 'entrance';
	else if (/^(exit|exeunt)\b/i.test(t)) d.type = 'exit';
	return d;
}
