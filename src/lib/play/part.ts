/**
 * Cue-script generation: turn a normalized `Play` into one actor's part.
 *
 * Like an Elizabethan "part", the result holds only what the actor needs:
 * their own speeches, the cue that comes before each one, and the stage
 * directions that concern them. The cue keeps the *whole* preceding speech
 * so the UI can trim it to any length (one word → full speech) on the fly.
 */
import type { Character, Play, SourceInfo, Speech, SpeechItem } from './types';
import { titleCaseSpeaker, words } from './text';

export interface Cue {
	kind: 'cue';
	/** Display name of whoever gives the cue ("Leontes", "Both"). */
	from: string;
	/** Character ids giving the cue (used e.g. to pick a voice). */
	fromIds: string[];
	/** Every line of the preceding speech, in order. */
	lines: string[];
	/** Line reference of the cue's final line. */
	n?: string;
	/** Sound / music cues that sit between the cue speech and ours. */
	effects?: string[];
}

export interface PartSpeech {
	kind: 'speech';
	/** 0-based index of this speech within the whole part. */
	index: number;
	speaker: string;
	/** Others speaking this speech in unison ("BOTH", "ALL"). */
	with?: string[];
	items: SpeechItem[];
	lineCount: number;
}

export interface PartDirection {
	kind: 'sd';
	t: string;
	type?: string;
}

export type PartEntry = Cue | PartSpeech | PartDirection;

export interface PartScene {
	ref: string;
	label: string;
	/** Index into the play's scene list. */
	sceneIndex: number;
	/** True when the character is on stage but never speaks. */
	silent: boolean;
	entries: PartEntry[];
}

export interface Part {
	play: { id: string; slug: string; title: string; source: SourceInfo };
	character: Character;
	scenes: PartScene[];
	/** Who gives this character their cues, most frequent first. */
	cueGivers: { name: string; count: number }[];
	totalScenes: number;
}

export function buildPart(play: Play, characterSlug: string): Part | null {
	const character = play.characters.find((c) => c.slug === characterSlug);
	if (!character) return null;
	const me = character.id;
	const byId = new Map(play.characters.map((c) => [c.id, c]));

	const nameFor = (sp: Speech): string => {
		if (sp.who.length === 1) {
			const c = byId.get(sp.who[0]);
			if (c && !c.minor) return c.name;
		}
		return sp.speaker ? titleCaseSpeaker(sp.speaker) : (byId.get(sp.who[0])?.name ?? 'Another');
	};

	const scenes: PartScene[] = [];
	const givers = new Map<string, number>();
	let speechIndex = 0;

	play.scenes.forEach((scene, sceneIndex) => {
		if (!character.presence.includes(sceneIndex)) return;
		const entries: PartEntry[] = [];
		let prev: Speech | null = null;
		let effects: string[] = [];
		let spoke = false;

		for (const block of scene.blocks) {
			if (block.kind === 'sd') {
				if (block.who.includes(me)) {
					entries.push({ kind: 'sd', t: block.t, ...(block.type ? { type: block.type } : {}) });
				} else if (block.type === 'sound' || block.type === 'music') {
					effects.push(block.t);
				}
				continue;
			}

			if (!block.who.includes(me)) {
				// Directions inside someone else's speech that name us (e.g. "He hands Dion a letter").
				for (const it of block.items) {
					if (it.kind === 'sd' && it.who?.includes(me)) entries.push({ kind: 'sd', t: it.t });
				}
				prev = block;
				effects = [];
				continue;
			}

			// One of ours.
			if (prev && !prev.who.includes(me)) {
				const lines = prev.items.flatMap((it) => (it.kind === 'line' ? [it.t] : []));
				const lastLine = [...prev.items].reverse().find((it) => it.kind === 'line');
				const from = nameFor(prev);
				givers.set(from, (givers.get(from) ?? 0) + 1);
				entries.push({
					kind: 'cue',
					from,
					fromIds: prev.who,
					lines,
					...(lastLine && lastLine.kind === 'line' && lastLine.n ? { n: lastLine.n } : {}),
					...(effects.length ? { effects } : {})
				});
			}
			const others = block.who.filter((w) => w !== me).map((w) => byId.get(w)?.name ?? w);
			entries.push({
				kind: 'speech',
				index: speechIndex++,
				speaker: block.speaker,
				...(others.length ? { with: others } : {}),
				items: block.items,
				lineCount: block.items.filter((it) => it.kind === 'line').length
			});
			spoke = true;
			prev = block;
			effects = [];
		}

		if (entries.length) {
			scenes.push({ ref: scene.ref, label: scene.label, sceneIndex, silent: !spoke, entries });
		}
	});

	return {
		play: { id: play.id, slug: play.slug, title: play.title, source: play.source },
		character,
		scenes,
		cueGivers: [...givers.entries()]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count),
		totalScenes: play.scenes.length
	};
}

/* ------------------------------------------------------------------ */
/* Cue trimming                                                        */
/* ------------------------------------------------------------------ */

/**
 * How much of the cue to show.
 *  - a number: that many final words (Elizabethan parts gave 1–3)
 *  - 'line':   the final printed line
 *  - 'speech': the whole preceding speech
 */
export type CueLength = number | 'line' | 'speech';

export interface TrimmedCue {
	/** Lines to show, in order. */
	lines: string[];
	/** True when earlier text was cut off (show a leading rule / ellipsis). */
	elided: boolean;
}

export function trimCue(lines: string[], length: CueLength): TrimmedCue {
	if (!lines.length) return { lines: [], elided: false };
	if (length === 'speech') return { lines, elided: false };
	if (length === 'line') return { lines: [lines[lines.length - 1]], elided: lines.length > 1 };

	const n = Math.max(1, Math.floor(length));
	const out: string[] = [];
	let remaining = n;
	for (let i = lines.length - 1; i >= 0 && remaining > 0; i--) {
		const w = words(lines[i]);
		if (w.length <= remaining) {
			out.unshift(w.join(' '));
			remaining -= w.length;
			if (i === 0) return { lines: out.filter(Boolean), elided: false };
		} else {
			out.unshift(w.slice(w.length - remaining).join(' '));
			remaining = 0;
		}
	}
	const all = lines.reduce((acc, l) => acc + words(l).length, 0);
	return { lines: out.filter(Boolean), elided: all > n };
}

/** Flatten a cue to a single string, for speech synthesis. */
export function cueToSpeech(trimmed: TrimmedCue): string {
	return trimmed.lines.join(' ').replace(/[—–]+$/, '');
}

/* ------------------------------------------------------------------ */
/* Rehearsal sequence                                                  */
/* ------------------------------------------------------------------ */

export interface RunStep {
	scene: PartScene;
	cue?: Cue;
	/** Directions between the cue and the speech (entrances, business). */
	directions: string[];
	speech: PartSpeech;
	words: number;
}

export function speechWordCount(speech: PartSpeech): number {
	let n = 0;
	for (const it of speech.items) {
		if (it.kind !== 'line') continue;
		for (const s of it.segs ?? [{ t: it.t }]) if (!('sd' in s && s.sd)) n += words(s.t).length;
	}
	return n;
}

/** Flatten a part into the cue → speech pairs an actor drills through. */
export function runSteps(part: Part): RunStep[] {
	const steps: RunStep[] = [];
	for (const scene of part.scenes) {
		let cue: Cue | undefined;
		let directions: string[] = [];
		for (const e of scene.entries) {
			if (e.kind === 'cue') {
				cue = e;
				directions = [];
			} else if (e.kind === 'sd') directions.push(e.t);
			else {
				steps.push({ scene, cue, directions, speech: e, words: speechWordCount(e) });
				cue = undefined;
				directions = [];
			}
		}
	}
	return steps;
}
