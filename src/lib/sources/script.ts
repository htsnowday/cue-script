/**
 * Source adapter: a play script as a list of lines → normalized `Play`.
 *
 * Plain text, Word and PDF extractors all produce `ScriptLine[]` (text plus
 * whatever layout hints the format offers), and this module works out who is
 * speaking, where acts and scenes begin, and what is a stage direction.
 *
 * Two speaker layouts are recognised:
 *   inline     HAMLET. To be, or not to be…      Ham. To be…     Hamlet: To be…
 *   own-line   HAMLET                             (name alone, speech below)
 */
import type { Block, Direction, Play, Scene, Speech, SpeechItem, TextLine } from '../play/types';
import { PLAY_SCHEMA_VERSION } from '../play/types';
import { computeCharacters, type CharacterDecl } from '../play/characters';
import { slugify, titleCaseSpeaker } from '../play/text';

export interface ScriptLine {
	text: string;
	italic?: boolean;
	bold?: boolean;
	centered?: boolean;
	/** Left indent in arbitrary units (spaces for text, points for PDF/Word). */
	indent?: number;
	/** Paragraph style name from a word processor ("Character", "Dialogue"…). */
	style?: string;
}

export type SpeakerMode = 'auto' | 'inline' | 'own-line';

export interface ParseOptions {
	title?: string;
	mode?: SpeakerMode;
}

export interface ParseReport {
	/** The speaker layout actually used ('tei' when speakers were marked up). */
	mode: 'inline' | 'own-line' | 'tei';
	/** Lines before the play proper (title page, notes…), shown for review. */
	skipped: string[];
	castListFound: boolean;
	warnings: string[];
}

export interface ParsedScript {
	play: Play;
	report: ParseReport;
}

/* ------------------------------------------------------------------ */
/* Plain text → lines                                                  */
/* ------------------------------------------------------------------ */

export function linesFromText(text: string): ScriptLine[] {
	return text
		.replace(/\r\n?/g, '\n')
		.replace(/ /g, ' ')
		.split('\n')
		.map((raw) => {
			const expanded = raw.replace(/\t/g, '    ');
			const indent = expanded.length - expanded.trimStart().length;
			return { text: expanded.trim(), ...(indent ? { indent } : {}) };
		});
}

/* ------------------------------------------------------------------ */
/* Recognisers                                                         */
/* ------------------------------------------------------------------ */

const NUMBER_WORDS: Record<string, number> = {
	one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
	first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
	prima: 1, secunda: 2, tertia: 3, quarta: 4, quinta: 5
};

function toNumber(s: string): number | undefined {
	const t = s.toLowerCase().replace(/\.$/, '');
	if (/^\d+$/.test(t)) return Number(t);
	if (NUMBER_WORDS[t]) return NUMBER_WORDS[t];
	if (/^[ivxlc]+$/.test(t)) {
		const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };
		let n = 0;
		for (let i = 0; i < t.length; i++) {
			const cur = v[t[i]], next = v[t[i + 1]] ?? 0;
			n += cur < next ? -cur : cur;
		}
		return n || undefined;
	}
	return undefined;
}

const NUM = String.raw`(\d+|[ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|prima|secunda|tertia|quarta|quinta)`;
const ACT_RE = new RegExp(String.raw`^(?:act|actus)\s+${NUM}\b\.?[,:;.\s]*(.*)$`, 'i');
const SCENE_RE = new RegExp(String.raw`^(?:scene|scena|sc\.)\s+${NUM}\b\.?[,:;.\s—–-]*(.*)$`, 'i');
const SPECIAL_RE = /^(?:the\s+)?(prologue|epilogue|induction|chorus)\.?$/i;

interface Heading {
	act?: number;
	scene?: number;
	special?: string;
	/** Text after the number, usually a location: "A room in the castle." */
	rest?: string;
}

function readHeading(t: string): Heading | null {
	if (t.length > 120) return null;
	let m = t.match(ACT_RE);
	if (m) {
		const act = toNumber(m[1]);
		if (act === undefined) return null;
		const rest = m[2].trim();
		const sm = rest.match(SCENE_RE);
		if (sm) return { act, scene: toNumber(sm[1]), rest: sm[2].trim() || undefined };
		if (rest && !/^[A-Z(\[]/.test(rest)) return null; // "Act one of my plan…" in dialogue
		return { act, rest: rest || undefined };
	}
	m = t.match(SCENE_RE);
	if (m) {
		const scene = toNumber(m[1]);
		if (scene === undefined) return null;
		return { scene, rest: m[2].trim() || undefined };
	}
	m = t.match(SPECIAL_RE);
	if (m) return { special: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() };
	return null;
}

const CAST_HEADER_RE =
	/^(dramatis\s+person(ae|æ|e)|the\s+persons\s+of\s+the\s+play|persons\s+represented|(the\s+)?characters(\s+in\s+the\s+play)?|cast(\s+of\s+characters)?|the\s+cast)\s*[.:]?$/i;

/** Lines that are never speaker names even though they look like one. */
const NOT_SPEAKER =
	/^(the end|end|finis|curtain|blackout|black ?out|intermission|interval|end of (the )?(act|scene|play).*|lights?( up| down| fade.*)?|fade (in|out).*|silence|pause|beat|music|thunder|darkness|dramatis person(ae|æ)|characters|cast|setting|time|place|scene|act|prologue|epilogue|induction|contents|copyright.*|all rights reserved)\.?$/i;

/** Common sentence openers that "Word." might be mistaken for an inline speaker. */
const STOP_WORDS = new Set(
	'o oh ah ay aye no yes yea nay well why what how who where when sir madam lord lady come go now then so thus alas good peace look here there farewell adieu ha ho hark fie pray indeed true nothing and but if or the a i you he she we they it this that my thy his her our your their mr mrs ms dr st well, yes, act scene enter exit exeunt note'
		.split(' ')
);

const DIRECTION_START =
	/^(enter|enters|re-?enter|exit|exits|exeunt|exeunt omnes|manet|manent|flourish|alarum|alarums|sennet|tucket|hautboys|trumpets sound|thunder|thunder and lightning|lights|blackout|curtain|music|song|dance|a (noise|knocking|flourish|shout|cry))\b/i;

const key = (s: string) =>
	s
		.toUpperCase()
		.replace(/[’‘`]/g, "'")
		.replace(/\s+/g, ' ')
		.replace(/[.:,;]+$/, '')
		.trim();

interface SpeakerHit {
	name: string;
	paren?: string;
	rest?: string;
	caps: boolean;
}

// "HAMLET. To be…"  "Ham. To be…"  "FIRST LORD: …"  "1. Lord. …"  "LADY M. (aside) …"
const INLINE_RE =
	/^((?:\d\.?\s*)?[A-Z][A-Za-z'’\-]*(?:\.?\s+(?:of|the|de|du|la|le|von|van|[A-Z][A-Za-z'’\-]*)){0,4})\s*(?:\(([^)]{1,60})\))?\s*[.:]\s+(\S.*)$/;
// "HAMLET"  "HAMLET."  "FIRST LORD:"  "HAMLET (aside)"  "LADY MACBETH (reading)"
const OWN_LINE_RE =
	/^((?:\d\.?\s*)?[A-Z][A-Z'’\-.&]*(?:\s+(?:[A-Z][A-Z'’\-.&]*|of|the|de|and)){0,4})\s*(?:\(([^)]{1,60})\))?\s*[.:]?$/;

function inlineSpeaker(t: string): SpeakerHit | null {
	const m = t.match(INLINE_RE);
	if (!m) return null;
	const name = m[1].trim();
	if (name.length > 32) return null;
	const caps = name === name.toUpperCase() && /[A-Z]{2}/.test(name);
	if (!caps && STOP_WORDS.has(name.toLowerCase().replace(/\.$/, ''))) return null;
	if (NOT_SPEAKER.test(name)) return null;
	return { name, paren: m[2], rest: m[3], caps };
}

function ownLineSpeaker(line: ScriptLine): SpeakerHit | null {
	const t = line.text;
	if (t.length > 48 || NOT_SPEAKER.test(t)) return null;
	if (line.style && /character|speaker|name/i.test(line.style)) {
		const m = t.match(/^(.+?)\s*(?:\(([^)]{1,60})\))?\s*[.:]?$/);
		if (m) return { name: m[1].trim(), paren: m[2], caps: true };
	}
	const m = t.match(OWN_LINE_RE);
	if (!m || !/[A-Z]{2}|^[A-Z]$/.test(m[1])) return null;
	return { name: m[1].replace(/[.:]+$/, '').trim(), paren: m[2], caps: true };
}

function wrapped(t: string) {
	return /^\[[^\]]*\][.,;:]?$/.test(t) || /^\([^)]*\)[.,;:]?$/.test(t);
}

function isDirection(line: ScriptLine): boolean {
	const t = line.text;
	if (line.style && /action|direction|stage|parenthetical/i.test(line.style)) return true;
	if (wrapped(t)) return true;
	if (line.italic && t.length > 1) return true;
	return DIRECTION_START.test(t) && t.length < 160;
}

const unwrap = (t: string) => t.replace(/^[[(]\s*/, '').replace(/\s*[\])]([.,;:]?)$/, '$1').trim();

/** Split dialogue text around [bracketed], (parenthetical) and trailing "Exit." directions. */
function dialogue(t: string, n: string): SpeechItem | null {
	const segs: { t: string; sd?: boolean }[] = [];
	let rest = t;
	// Old-style right-hand exits:  "…my lord.            Exit."
	const tail = rest.match(/^(.*\S)\s{3,}((?:exit|exeunt|exit\s+\w.*|exeunt\s+\w.*)\.?)$/i);
	let trailing: string | undefined;
	if (tail) {
		rest = tail[1];
		trailing = tail[2];
	}
	const re = /\[([^\]]+)\]|\(([^)]+)\)/g;
	let last = 0;
	for (let m; (m = re.exec(rest)); ) {
		if (m.index > last) segs.push({ t: rest.slice(last, m.index) });
		segs.push({ t: (m[1] ?? m[2]).trim(), sd: true });
		last = m.index + m[0].length;
	}
	if (last < rest.length) segs.push({ t: rest.slice(last) });
	if (trailing) segs.push({ t: trailing, sd: true });

	const clean = segs.map((s) => ({ ...s, t: s.t.replace(/\s+/g, ' ').trim() })).filter((s) => s.t);
	const text = clean.filter((s) => !s.sd).map((s) => s.t).join(' ').trim();
	if (!text) {
		const sd = clean.map((s) => s.t).join(' ');
		return sd ? { kind: 'sd', t: sd } : null;
	}
	const line: TextLine = { kind: 'line', t: text, n };
	if (clean.some((s) => s.sd)) line.segs = clean;
	return line;
}

/* ------------------------------------------------------------------ */
/* Front matter                                                        */
/* ------------------------------------------------------------------ */

function stripGutenberg(lines: ScriptLine[]): { lines: ScriptLine[]; title?: string } {
	let title: string | undefined;
	const start = lines.findIndex((l) => /^\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG/i.test(l.text));
	const end = lines.findIndex((l) => /^\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG/i.test(l.text));
	for (const l of lines.slice(0, Math.max(0, start))) {
		const m = l.text.match(/^Title:\s*(.+)$/);
		if (m) title = m[1].trim();
	}
	if (start >= 0) return { lines: lines.slice(start + 1, end > start ? end : undefined), title };
	return { lines, title };
}

interface CastEntry {
	key: string;
	name: string;
	desc?: string;
	order: number;
}

function readCastList(lines: ScriptLine[], from: number): { entries: CastEntry[]; end: number } {
	const entries: CastEntry[] = [];
	let i = from + 1;
	let blanks = 0;
	for (; i < lines.length; i++) {
		const t = lines[i].text;
		if (!t) {
			if (++blanks > 3 && entries.length) break;
			continue;
		}
		blanks = 0;
		if (readHeading(t) || /^(scene|setting|time|place)\b[.:]/i.test(t)) break;
		if (t.length > 140) break;
		const m = t.match(/^([A-Z][A-Za-z'’\-. ]{0,40}?)\s*(?:,|—|–|\s-\s|:|\s{2,}|\.\s)\s*(.+)$/);
		const name = (m ? m[1] : t).replace(/[.,:]+$/, '').trim();
		if (!/[A-Za-z]{2}/.test(name) || name.split(' ').length > 6) continue;
		entries.push({
			key: key(name),
			name: name === name.toUpperCase() ? titleCaseSpeaker(name) : name,
			desc: m?.[2]?.replace(/[.;]$/, '').trim() || undefined,
			order: entries.length
		});
		if (entries.length > 120) break;
	}
	return { entries, end: i };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export function parseScript(input: ScriptLine[], opts: ParseOptions = {}): ParsedScript {
	const warnings: string[] = [];
	const gut = stripGutenberg(input);
	const lines = gut.lines.map((l) => ({ ...l, text: l.text.trim() }));

	// 1. Cast list (optional)
	let cast: CastEntry[] = [];
	let castRange: [number, number] | null = null;
	const castAt = lines.findIndex((l, i) => i < lines.length * 0.4 && CAST_HEADER_RE.test(l.text));
	if (castAt >= 0) {
		const r = readCastList(lines, castAt);
		cast = r.entries;
		castRange = [castAt, r.end];
	}
	const inCast = (i: number) => !!castRange && i >= castRange[0] && i < castRange[1];

	// 2. Canonical names: match abbreviations ("HAM") to cast list entries ("HAMLET").
	const canon = new Map<string, CastEntry | undefined>();
	const castEntry = (k: string): CastEntry | undefined => {
		if (canon.has(k)) return canon.get(k);
		const bare = k.replace(/\./g, '').trim();
		let hit = cast.find((c) => c.key === k || c.key.replace(/\./g, '') === bare);
		if (!hit && bare.length >= 2) {
			// Prefer the whole name ("HAM" → "HAMLET"), then any word ("MACB" → "LADY MACBETH").
			const whole = cast.filter((c) => c.key.replace(/\./g, '').startsWith(bare));
			const word = cast.filter((c) => bare.length >= 3 && c.key.split(' ').some((w) => w.startsWith(bare)));
			if (whole.length === 1) hit = whole[0];
			else if (!whole.length && word.length === 1) hit = word[0];
		}
		canon.set(k, hit);
		return hit;
	};
	const resolve = (k: string) => castEntry(k)?.key ?? k;

	// 3. Count speaker candidates in both layouts.
	type Count = { n: number; caps: boolean; first: number };
	const inlineCounts = new Map<string, Count>();
	const ownCounts = new Map<string, Count>();
	let firstHeading = Infinity;
	const nextText = (i: number) => {
		for (let j = i + 1; j < lines.length; j++) if (lines[j].text) return lines[j];
		return null;
	};
	const bump = (m: Map<string, Count>, k: string, caps: boolean, i: number) => {
		const c = m.get(k) ?? { n: 0, caps, first: i };
		c.n++;
		m.set(k, c);
	};
	lines.forEach((l, i) => {
		if (!l.text || inCast(i)) return;
		if (readHeading(l.text)) {
			firstHeading = Math.min(firstHeading, i);
			return;
		}
		const inl = inlineSpeaker(l.text);
		if (inl) bump(inlineCounts, key(inl.name), inl.caps, i);
		const own = ownLineSpeaker(l);
		const nx = nextText(i);
		if (own && nx && !readHeading(nx.text) && !ownLineSpeaker(nx)) bump(ownCounts, key(own.name), true, i);
	});

	const acceptor = (counts: Map<string, Count>) => {
		// The play "body" starts at the first heading or the first recurring speaker,
		// so title-page lines in capitals aren't mistaken for one-line parts.
		const recurring = [...counts].filter(([k, c]) => c.n >= (c.caps ? 2 : 3) || castEntry(k));
		const body = Math.min(firstHeading, castRange ? castRange[1] : Infinity, ...recurring.map(([, c]) => c.first));
		return (k: string, c: Count) =>
			!!castEntry(k) || c.n >= (c.caps ? 2 : 3) || (c.caps && c.n === 1 && c.first >= body);
	};
	const acceptInline = acceptor(inlineCounts);
	const acceptOwn = acceptor(ownCounts);
	const score = (counts: Map<string, Count>, ok: (k: string, c: Count) => boolean) =>
		[...counts].filter(([k, c]) => ok(k, c)).reduce((s, [, c]) => s + c.n, 0);
	const inlineScore = score(inlineCounts, acceptInline);
	const ownScore = score(ownCounts, acceptOwn);

	const mode: 'inline' | 'own-line' =
		opts.mode && opts.mode !== 'auto' ? opts.mode : ownScore > inlineScore ? 'own-line' : 'inline';
	if (!inlineScore && !ownScore) warnings.push('No speaker names were recognised. Try the other speaker layout, or check the file’s text.');

	const accepted = new Set(
		mode === 'inline'
			? [...inlineCounts].filter(([k, c]) => acceptInline(k, c)).map(([k]) => k)
			: [...ownCounts].filter(([k, c]) => acceptOwn(k, c)).map(([k]) => k)
	);

	// 4. Walk the script.
	const scenes: Scene[] = [];
	const skipped: string[] = [];
	const labels = new Map<string, Map<string, number>>(); // id → printed labels
	let scene: Scene | null = null;
	let act: number | undefined;
	let speech: Speech | null = null;
	let speechIndent: number | undefined;
	let sawBlank = false;
	let started = false;
	let lineNo = 0;

	const newScene = (h: Heading) => {
		closeSpeech();
		// "ACT I" immediately followed by "SCENE I": drop the empty act-only scene.
		if (scene && !scene.blocks.length && scenes[scenes.length - 1] === scene) scenes.pop();
		if (h.act !== undefined) act = h.act;
		const special = h.special;
		const sc = h.scene;
		const ref = special
			? [act !== undefined && scenes.length ? act : undefined, special.slice(0, 3)].filter((x) => x !== undefined).join('.')
			: [h.act !== undefined || sc !== undefined ? act : undefined, sc].filter((x) => x !== undefined).join('.');
		const label = special
			? special
			: [act !== undefined ? `Act ${act}` : null, sc !== undefined ? `Scene ${sc}` : null].filter(Boolean).join(', ');
		scene = { ref: ref || String(scenes.length + 1), label: label || `Scene ${scenes.length + 1}`, blocks: [] };
		if (act !== undefined) scene.act = act;
		if (sc !== undefined) scene.scene = sc;
		scenes.push(scene);
		lineNo = 0;
		if (h.rest) pushDirection(unwrap(h.rest), 'location');
	};
	const ensureScene = () => {
		if (!scene) {
			scene = { ref: '1', label: act !== undefined ? `Act ${act}` : 'The Play', blocks: [] };
			if (act !== undefined) scene.act = act;
			scenes.push(scene);
			lineNo = 0;
		}
		return scene;
	};
	const closeSpeech = () => {
		if (speech && speech.items.length) ensureScene().blocks.push(speech);
		speech = null;
		speechIndent = undefined;
	};
	const pushDirection = (t: string, type?: string) => {
		if (!t) return;
		const d: Direction = { kind: 'sd', t, who: [] };
		const ty = type ?? (/^(enter|enters|re-?enter)\b/i.test(t) ? 'entrance' : /^(exit|exits|exeunt)\b/i.test(t) ? 'exit' : undefined);
		if (ty) d.type = ty;
		ensureScene().blocks.push(d);
	};
	const openSpeech = (hit: SpeakerHit) => {
		closeSpeech();
		const k = resolve(key(hit.name));
		const id = `c:${k}`;
		const label = hit.name.replace(/[.:]+$/, '');
		const m = labels.get(id) ?? new Map<string, number>();
		m.set(label, (m.get(label) ?? 0) + 1);
		labels.set(id, m);
		speech = { kind: 'sp', who: [id], speaker: label.toUpperCase(), items: [] };
		if (hit.paren) speech.items.push({ kind: 'sd', t: hit.paren.trim() });
		ensureScene();
	};
	const addLine = (t: string, indent?: number) => {
		const item = dialogue(t, `${scene?.ref ?? '1'}.${lineNo + 1}`);
		if (!item) return;
		if (item.kind === 'line') lineNo++;
		speech!.items.push(item);
		if (speechIndent === undefined && item.kind === 'line') speechIndent = indent ?? 0;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const t = line.text;
		if (!t) {
			sawBlank = true;
			continue;
		}
		if (inCast(i)) continue;
		const blankBefore = sawBlank;
		sawBlank = false;

		const h = readHeading(t);
		const hit = mode === 'inline' ? inlineSpeaker(t) : ownLineSpeaker(line);
		const isSpeaker = !!hit && accepted.has(key(hit.name)) && !(h && !accepted.has(key(t)));

		if (!started) {
			if (h || isSpeaker) started = true;
			else {
				skipped.push(t);
				continue;
			}
		}

		if (h && !isSpeaker) {
			newScene(h);
			continue;
		}
		if (isSpeaker) {
			openSpeech(hit!);
			if (mode === 'inline' && hit!.rest) addLine(hit!.rest, line.indent);
			continue;
		}
		if (isDirection(line)) {
			const text = unwrap(t);
			const nx = nextText(i);
			const nextIsDialogue =
				!!nx &&
				!readHeading(nx.text) &&
				!isDirection(nx) &&
				!(mode === 'inline' ? inlineSpeaker(nx.text) : ownLineSpeaker(nx));
			const parenOnly = /^\(/.test(t) && !(mode === 'own-line' && blankBefore);
			if (speech && (parenOnly || (nextIsDialogue && !(mode === 'own-line' && blankBefore)))) {
				(speech as Speech).items.push({ kind: 'sd', t: text });
			} else {
				closeSpeech();
				pushDirection(text);
			}
			continue;
		}
		// Ordinary text.
		if (speech) {
			const offIndent =
				mode === 'own-line' && blankBefore && line.indent !== undefined && speechIndent !== undefined && Math.abs(line.indent - speechIndent) > 2;
			if (offIndent) {
				closeSpeech();
				pushDirection(t);
			} else addLine(t, line.indent);
		} else {
			// Text outside any speech: modern "action" paragraphs.
			pushDirection(t);
		}
	}
	closeSpeech();

	// 5. Names, descriptions and who's mentioned in directions.
	const decls = new Map<string, CharacterDecl>();
	const castByKey = new Map(cast.map((c) => [c.key, c]));
	for (const [id, ls] of labels) {
		const k = id.slice(2);
		const c = castByKey.get(k);
		const printed = [...ls.entries()].sort((a, b) => b[1] - a[1])[0][0];
		const longest = [...ls.keys()].sort((a, b) => b.length - a.length)[0];
		const base = c?.name ?? (printed === printed.toUpperCase() ? titleCaseSpeaker(longest) : longest);
		decls.set(id, { name: base.replace(/\.$/, ''), ...(c?.desc ? { desc: c.desc } : {}), ...(c ? { order: c.order } : {}) });
	}
	const mentionables = [...decls].flatMap(([id, d]) => {
		const words = new Set([d.name, ...(labels.get(id)?.keys() ?? [])].filter((w) => w.replace(/\./g, '').length >= 3));
		return [...words].map((w) => ({ id, re: new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu') }));
	});
	for (const sc of scenes as Scene[]) {
		for (const b of sc.blocks as Block[]) {
			if (b.kind !== 'sd') continue;
			b.who = [...new Set(mentionables.filter((m) => m.re.test(b.t)).map((m) => m.id))];
		}
	}

	if (!scenes.length) warnings.push('No speeches were found in this script.');
	const title = opts.title ?? gut.title ?? guessTitle(skipped) ?? 'Untitled play';
	const characters = computeCharacters(scenes, decls);

	return {
		play: {
			schema: PLAY_SCHEMA_VERSION,
			id: `u-${slugify(title).slice(0, 24)}`,
			slug: slugify(title),
			title,
			genre: 'other',
			source: { name: 'Your script' },
			characters,
			scenes
		},
		report: { mode, skipped, castListFound: cast.length > 0, warnings }
	};
}

function guessTitle(front: string[]): string | undefined {
	const t = front.find((l) => l.length > 2 && l.length < 90 && !/^(by|written by|a play|copyright|©|draft)\b/i.test(l) && /[A-Za-z]/.test(l));
	if (!t) return undefined;
	return t === t.toUpperCase() ? titleCaseSpeaker(t.replace(/^THE (TRAGEDY|COMEDY|HISTORY|LIFE) OF /, '')) : t;
}
