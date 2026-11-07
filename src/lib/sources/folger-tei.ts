/**
 * Source adapter: Folger Shakespeare TEI Simple → normalized `Play`.
 *
 * Works against any W3C-style DOM (browser `DOMParser`, or `@xmldom/xmldom`
 * in Node), so the same adapter can power both the build-time data pipeline
 * and, later, user uploads of TEI files in the browser.
 */
import type {
	Block,
	Character,
	Genre,
	InlineDirection,
	Play,
	Scene,
	SourceInfo,
	Speech,
	SpeechItem,
	TextLine
} from '../play/types';
import { PLAY_SCHEMA_VERSION } from '../play/types';
import { slugify, titleCaseSpeaker, uniqueSlug } from '../play/text';

// Minimal DOM surface we rely on (satisfied by browser DOM and xmldom).
interface XNode {
	nodeType: number;
	nodeValue: string | null;
	childNodes: ArrayLike<XNode>;
	parentNode: XNode | null;
}
interface XElement extends XNode {
	localName: string | null;
	getAttribute(name: string): string | null;
	textContent: string | null;
}
interface XDocument {
	documentElement: XElement | null;
}

const ELEMENT = 1;
const TEXT = 3;
const CDATA = 4;

function isEl(n: XNode): n is XElement {
	return n.nodeType === ELEMENT;
}
function kids(el: XNode): XElement[] {
	const out: XElement[] = [];
	for (let i = 0; i < el.childNodes.length; i++) {
		const c = el.childNodes[i];
		if (isEl(c)) out.push(c);
	}
	return out;
}
function child(el: XNode, name: string): XElement | undefined {
	return kids(el).find((k) => k.localName === name);
}
function descendants(el: XNode, name: string, out: XElement[] = []): XElement[] {
	for (const k of kids(el)) {
		if (k.localName === name) out.push(k);
		descendants(k, name, out);
	}
	return out;
}
function find(el: XNode, path: string[]): XElement | undefined {
	let cur: XNode | undefined = el;
	for (const p of path) {
		cur = cur && child(cur, p);
		if (!cur) return undefined;
	}
	return cur as XElement;
}

const ws = (s: string) => s.replace(/\s+/g, ' ');
const clean = (s: string | null | undefined) => ws(s ?? '').trim();
const ids = (attr: string | null) =>
	(attr ?? '')
		.split(/\s+/)
		.map((s) => s.replace(/^#/, ''))
		.filter(Boolean);

/* ------------------------------------------------------------------ */
/* Speech content                                                      */
/* ------------------------------------------------------------------ */

type Seg = { t: string; sd?: boolean };

/** Collect the text of an element as segments, keeping inline stage directions apart. */
function segments(el: XNode, out: Seg[] = []): Seg[] {
	for (let i = 0; i < el.childNodes.length; i++) {
		const n = el.childNodes[i];
		if (n.nodeType === TEXT || n.nodeType === CDATA) {
			out.push({ t: n.nodeValue ?? '' });
		} else if (isEl(n)) {
			if (n.localName === 'stage') out.push({ t: n.textContent ?? '', sd: true });
			else if (n.localName === 'note' || n.localName === 'gap') continue;
			else segments(n, out);
		}
	}
	return out;
}

function lineFromSegs(
	segs: Seg[],
	extra: Omit<TextLine, 'kind' | 't'>
): TextLine | InlineDirection | null {
	const merged: Seg[] = [];
	for (const s of segs) {
		const t = ws(s.t);
		if (!t.trim()) {
			if (merged.length && t) merged[merged.length - 1].t += ' ';
			continue;
		}
		const last = merged[merged.length - 1];
		if (last && !!last.sd === !!s.sd) last.t += t;
		else merged.push({ t, ...(s.sd ? { sd: true } : {}) });
	}
	const textOnly = merged.filter((s) => !s.sd);
	const text = clean(textOnly.map((s) => s.t).join(' '));
	if (!text) {
		const sd = clean(merged.map((s) => s.t).join(' '));
		return sd ? { kind: 'sd', t: sd } : null;
	}
	const line: TextLine = { kind: 'line', t: text, ...extra };
	if (merged.some((s) => s.sd)) {
		line.segs = merged.map((s) => ({ ...s, t: s.t.trim() })).filter((s) => s.t);
	}
	return line;
}

function speechItems(el: XElement, ctx: { song: boolean }, out: SpeechItem[] = []): SpeechItem[] {
	for (const k of kids(el)) {
		switch (k.localName) {
			case 'speaker':
			case 'note':
			case 'gap':
				break;
			case 'l': {
				const part = k.getAttribute('part');
				const extra: Omit<TextLine, 'kind' | 't'> = { verse: true };
				const n = k.getAttribute('n');
				if (n) extra.n = n;
				if (part === 'I' || part === 'M' || part === 'F') extra.part = part;
				if (ctx.song) extra.song = true;
				const item = lineFromSegs(segments(k), extra);
				if (item) out.push(item);
				break;
			}
			case 'p':
				proseLines(k, ctx, out);
				break;
			case 'stage': {
				// Speech-prefix directions print as "HAMLET, aside" — drop the joining comma.
				const raw = clean(k.textContent).replace(/^[,;:.]\s*/, '');
				const t = raw.charAt(0).toUpperCase() + raw.slice(1);
				if (t) {
					const who = ids(k.getAttribute('who'));
					out.push({ kind: 'sd', t, ...(who.length ? { who } : {}) });
				}
				break;
			}
			case 'label': {
				const t = clean(k.textContent);
				if (t) out.push({ kind: 'label', t });
				break;
			}
			case 'q':
			case 'lg':
				speechItems(k, { song: ctx.song || k.getAttribute('type') === 'song' }, out);
				break;
			default:
				// ab, and anything else that wraps content
				speechItems(k, ctx, out);
		}
	}
	return out;
}

/** Split a prose paragraph into Folger's printed lines using <lb/> markers. */
function proseLines(p: XElement, ctx: { song: boolean }, out: SpeechItem[]) {
	let segs: Seg[] = [];
	let n: string | undefined;
	const flush = () => {
		const extra: Omit<TextLine, 'kind' | 't'> = {};
		if (n) extra.n = n;
		if (ctx.song) extra.song = true;
		const item = lineFromSegs(segs, extra);
		if (item) out.push(item);
		segs = [];
	};
	const walk = (el: XNode) => {
		for (let i = 0; i < el.childNodes.length; i++) {
			const c = el.childNodes[i];
			if (c.nodeType === TEXT || c.nodeType === CDATA) segs.push({ t: c.nodeValue ?? '' });
			else if (isEl(c)) {
				const name = c.localName;
				if (name === 'lb' || (name === 'milestone' && c.getAttribute('unit') === 'ftln')) {
					flush();
					n = c.getAttribute('n') ?? undefined;
				} else if (name === 'stage') segs.push({ t: c.textContent ?? '', sd: true });
				else if (name === 'note' || name === 'gap') continue;
				else walk(c);
			}
		}
	};
	walk(p);
	flush();
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

const DIV_NAMES: Record<string, [string, string]> = {
	prologue: ['Prologue', 'Pro'],
	epilogue: ['Epilogue', 'Epi'],
	induction: ['Induction', 'Ind'],
	chorus: ['Chorus', 'Cho']
};

function sceneFromDiv(div: XElement, parents: XElement[]): Omit<Scene, 'blocks'> {
	const chain = [...parents, div];
	let act: number | undefined;
	let scene: number | undefined;
	const labelParts: string[] = [];
	const refParts: string[] = [];
	for (const d of chain) {
		const type = d.getAttribute('type') ?? '';
		const n = d.getAttribute('n') ?? '';
		if (type === 'act') {
			act = Number(n) || undefined;
			labelParts.push(`Act ${n}`);
			refParts.push(n);
		} else if (type === 'scene') {
			scene = Number(n) || undefined;
			labelParts.push(`Scene ${n}`);
			refParts.push(n);
		} else if (DIV_NAMES[type]) {
			labelParts.push(DIV_NAMES[type][0]);
			refParts.push(DIV_NAMES[type][1]);
		} else {
			const head = clean(child(d, 'head')?.textContent);
			if (head) labelParts.push(head);
			if (n) refParts.push(n);
		}
	}
	return {
		ref: refParts.join('.'),
		label: labelParts.join(', ') || 'Scene',
		...(act !== undefined ? { act } : {}),
		...(scene !== undefined ? { scene } : {})
	};
}

function collectScenes(body: XElement): Scene[] {
	const scenes: Scene[] = [];
	const visit = (div: XElement, parents: XElement[]) => {
		let loose: Block[] = [];
		const flushLoose = () => {
			if (loose.some((b) => b.kind === 'sp')) {
				scenes.push({ ...sceneFromDiv(div, parents), blocks: loose });
			} else if (loose.length && scenes.length) {
				// stray directions (e.g. a lone "Flourish") attach to the previous scene
				scenes[scenes.length - 1].blocks.push(...loose);
			}
			loose = [];
		};
		for (const k of kids(div)) {
			if (k.localName === 'div') {
				flushLoose();
				visit(k, div === body ? parents : [...parents, div]);
			} else if (k.localName === 'sp') {
				loose.push(readSpeech(k));
			} else if (k.localName === 'stage') {
				const t = clean(k.textContent);
				if (t) {
					const type = k.getAttribute('type');
					loose.push({ kind: 'sd', t, who: ids(k.getAttribute('who')), ...(type ? { type } : {}) });
				}
			}
		}
		flushLoose();
	};
	visit(body, []);
	return scenes;
}

function readSpeech(sp: XElement): Speech {
	const speaker = clean(child(sp, 'speaker')?.textContent).replace(/[.:]+$/, '');
	let who = ids(sp.getAttribute('who'));
	// Non-Folger TEI may omit @who; derive an id from the printed speaker name.
	if (!who.length) who = [`spk:${speaker.toUpperCase() || 'UNKNOWN'}`];
	return { kind: 'sp', who, speaker, items: speechItems(sp, { song: false }) };
}

/* ------------------------------------------------------------------ */
/* Characters                                                          */
/* ------------------------------------------------------------------ */

const ORDINALS = ['', '', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const looksLikeId = (s: string) => /_|^[A-Z0-9]+(\.[A-Z0-9]+)+$/.test(s) || /^Indistinct|^Indeterminate/.test(s);

function readCharacters(
	tei: XElement,
	scenes: Scene[],
	code: string,
	overrides: Record<string, string> = {}
): Character[] {
	// Declared people
	const persons = new Map<string, { name?: string; group: boolean }>();
	const listPerson = find(tei, ['teiHeader', 'profileDesc', 'particDesc', 'listPerson']);
	for (const p of listPerson ? kids(listPerson) : []) {
		const id = p.getAttribute('xml:id') ?? p.getAttribute('id');
		if (!id) continue;
		const name = clean((child(p, 'persName') ?? child(p, 'name'))?.textContent);
		persons.set(id, { name: name && !looksLikeId(name) ? name : undefined, group: p.localName === 'personGrp' });
	}

	// Cast list: order + descriptions
	const order = new Map<string, number>();
	const desc = new Map<string, string>();
	const castList = descendants(tei, 'castList')[0];
	let i = 0;
	const walkCast = (el: XElement, groupDesc?: string) => {
		for (const k of kids(el)) {
			if (k.localName === 'castGroup') {
				const gd = clean(child(k, 'roleDesc')?.textContent) || groupDesc;
				walkCast(k, gd);
			} else if (k.localName === 'castItem') {
				const targets = [
					...ids(k.getAttribute('sameAs')),
					...ids(k.getAttribute('xml:id') ?? k.getAttribute('id'))
				];
				const role = child(k, 'role');
				const rd = clean(child(k, 'roleDesc')?.textContent);
				const loose = role ? '' : clean(k.textContent);
				for (const t of targets) {
					if (!order.has(t)) order.set(t, i++);
					const d = rd || loose || groupDesc;
					if (d && !desc.has(t)) desc.set(t, d);
				}
			}
		}
	};
	if (castList) walkCast(castList);

	// Gather stats from the text
	type Acc = {
		labels: Map<string, number>;
		lines: number;
		speeches: number;
		words: number;
		presence: Set<number>;
		first: number;
	};
	const acc = new Map<string, Acc>();
	const get = (id: string, sceneIdx: number) => {
		let a = acc.get(id);
		if (!a) {
			a = { labels: new Map(), lines: 0, speeches: 0, words: 0, presence: new Set(), first: sceneIdx };
			acc.set(id, a);
		}
		return a;
	};
	const spoken = new Set<string>();
	scenes.forEach((scene, si) => {
		for (const b of scene.blocks) {
			if (b.kind === 'sp') {
				const lines = b.items.filter((x): x is TextLine => x.kind === 'line');
				const words = lines.reduce((n, l) => n + l.t.split(/\s+/).filter(Boolean).length, 0);
				for (const id of b.who) {
					spoken.add(id);
					const a = get(id, si);
					a.speeches++;
					a.lines += lines.length;
					a.words += words;
					a.presence.add(si);
					if (b.who.length === 1 && b.speaker) a.labels.set(b.speaker, (a.labels.get(b.speaker) ?? 0) + 1);
				}
			}
			const sdWho = b.kind === 'sd' ? b.who : b.items.flatMap((x) => (x.kind === 'sd' ? (x.who ?? []) : []));
			for (const id of sdWho) if (acc.has(id) || persons.has(id)) get(id, si).presence.add(si);
		}
	});

	const chars: Character[] = [];
	for (const id of spoken) {
		const a = acc.get(id)!;
		const p = persons.get(id);
		const topLabel = [...a.labels.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
		const bare = id.replace(new RegExp(`_${code}$`), '');
		const anonymous = /^[A-Z]+\.(\d|X)/.test(bare) || /^[A-Z]+$/.test(bare);
		const derived = id.startsWith('spk:');
		const minor = !!p?.group || anonymous || (!p && !derived);
		// Group members often carry the whole cast-group blurb as a name
		// ("Lords, Ladies, Attendants, …"); the printed speech prefix is better.
		const usable = p?.name && !/,/.test(p.name) && p.name.length <= 40 && /^\P{Ll}/u.test(p.name);
		const fromLabel = topLabel ? titleCaseSpeaker(topLabel) : undefined;
		const name =
			(anonymous || p?.group ? (fromLabel ?? (usable ? p!.name : undefined)) : (usable ? p!.name : fromLabel)) ??
			titleCaseSpeaker(bare.replace(/\..*/, ''));
		const d = desc.get(id);
		const finalName = overrides[id] ?? name;
		chars.push({
			id,
			slug: '',
			name: finalName,
			...(d && !looksLikeId(d) && d.length <= 90 ? { desc: d } : {}),
			order: order.get(id) ?? 10_000 + a.first,
			...(minor ? { minor: true } : {}),
			stats: { lines: a.lines, speeches: a.speeches, words: a.words, scenes: a.presence.size },
			presence: [...a.presence].sort((x, y) => x - y)
		});
	}

	// Disambiguate duplicate display names ("Servant" ×3) by first scene.
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

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export interface FolgerTeiOptions {
	slug?: string;
	genre?: Genre;
	title?: string;
	via?: string;
	/** Display-name corrections keyed by character id. */
	nameOverrides?: Record<string, string>;
}

export function parseFolgerTei(doc: XDocument, opts: FolgerTeiOptions = {}): Play {
	const tei = doc.documentElement;
	if (!tei || tei.localName !== 'TEI') throw new Error('Not a TEI document');

	const fileDesc = find(tei, ['teiHeader', 'fileDesc'])!;
	const title = (opts.title ?? clean(find(fileDesc, ['titleStmt', 'title'])?.textContent) ?? 'Untitled').replace(/'/g, '’');
	const pub = child(fileDesc, 'publicationStmt');
	const code = clean(pub && child(pub, 'idno')?.textContent) || slugify(title);
	const licence = pub && descendants(pub, 'licence')[0];
	const editors = descendants(child(fileDesc, 'titleStmt')!, 'editor').map((e) => clean(e.textContent));

	const source: SourceInfo = {
		name: 'Folger Shakespeare',
		editors,
		license: clean(licence?.textContent) || undefined,
		licenseUrl: licence?.getAttribute('target') ?? undefined,
		url: 'https://www.folger.edu/explore/shakespeares-works/',
		...(opts.via ? { via: opts.via } : {})
	};

	const body = find(tei, ['text', 'body']);
	if (!body) throw new Error('TEI has no <body>');
	const scenes = collectScenes(body);
	const characters = readCharacters(tei, scenes, code, opts.nameOverrides);

	return {
		schema: PLAY_SCHEMA_VERSION,
		id: code,
		slug: opts.slug ?? slugify(title),
		title,
		genre: opts.genre ?? 'other',
		source,
		characters,
		scenes
	};
}
