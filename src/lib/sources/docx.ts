/**
 * Word (.docx) → ScriptLine[].
 *
 * A .docx is a zip of XML. We read the paragraphs and keep the layout hints
 * a play parser cares about: italics (stage directions), centring and
 * capitals (character names), indents, and paragraph style names. Playwriting
 * templates often name their styles "Character", "Dialogue", "Parenthetical"
 * or "Stage Direction", which makes detection nearly certain. Two-column
 * tables (name | speech) become "NAME. speech" lines.
 */
import { strFromU8, unzipSync } from 'fflate';
import type { ScriptLine } from './script';

interface XNode {
	nodeType: number;
	nodeValue: string | null;
	childNodes: ArrayLike<XNode>;
}
interface XEl extends XNode {
	localName: string | null;
	getAttribute(name: string): string | null;
}
interface XDoc {
	documentElement: XEl | null;
}
export interface XmlParser {
	parseFromString(xml: string, type: string): unknown;
}

const isEl = (n: XNode): n is XEl => n.nodeType === 1;
const kids = (n: XNode) => Array.from(n.childNodes as ArrayLike<XNode>).filter(isEl);
const child = (n: XNode, name: string) => kids(n).find((k) => k.localName === name);
const attr = (el: XEl | undefined, name: string) => el?.getAttribute(`w:${name}`) ?? el?.getAttribute(name) ?? null;
/** w:i, w:caps, etc. are "on" unless w:val is false/0. */
const flag = (rPr: XEl | undefined, name: string): boolean | undefined => {
	const el = rPr && child(rPr, name);
	if (!el) return undefined;
	const v = attr(el, 'val');
	return !(v === 'false' || v === '0' || v === 'none');
};

interface StyleInfo {
	name: string;
	italic?: boolean;
	caps?: boolean;
	center?: boolean;
	basedOn?: string;
}

function readStyles(xml: string | undefined, parser: XmlParser): Map<string, StyleInfo> {
	const map = new Map<string, StyleInfo>();
	if (!xml) return map;
	const root = (parser.parseFromString(xml, 'application/xml') as XDoc).documentElement;
	if (!root) return map;
	for (const st of kids(root).filter((k) => k.localName === 'style')) {
		const id = attr(st, 'styleId');
		if (!id) continue;
		const rPr = child(st, 'rPr');
		const pPr = child(st, 'pPr');
		map.set(id, {
			name: attr(child(st, 'name'), 'val') ?? id,
			italic: flag(rPr, 'i'),
			caps: flag(rPr, 'caps'),
			center: attr(pPr && child(pPr, 'jc'), 'val') === 'center' || undefined,
			basedOn: attr(child(st, 'basedOn'), 'val') ?? undefined
		});
	}
	return map;
}

function styleProp<K extends keyof StyleInfo>(styles: Map<string, StyleInfo>, id: string | null, k: K): StyleInfo[K] | undefined {
	for (let s = id ? styles.get(id) : undefined, depth = 0; s && depth < 8; s = s.basedOn ? styles.get(s.basedOn) : undefined, depth++) {
		if (s[k] !== undefined) return s[k];
	}
	return undefined;
}

type Run = { t: string; italic: boolean; caps: boolean };

function paragraphRuns(p: XEl, styles: Map<string, StyleInfo>, pStyleId: string | null): Run[][] {
	const lines: Run[][] = [[]];
	const pItalic = styleProp(styles, pStyleId, 'italic') ?? false;
	const pCaps = styleProp(styles, pStyleId, 'caps') ?? false;
	const walk = (n: XEl) => {
		for (const k of kids(n)) {
			const name = k.localName;
			if (name === 'r') {
				const rPr = child(k, 'rPr');
				const rStyle = attr(rPr && child(rPr, 'rStyle'), 'val');
				const italic = flag(rPr, 'i') ?? styleProp(styles, rStyle, 'italic') ?? pItalic;
				const caps = flag(rPr, 'caps') ?? flag(rPr, 'smallCaps') ?? styleProp(styles, rStyle, 'caps') ?? pCaps;
				for (const c of kids(k)) {
					if (c.localName === 't') lines[lines.length - 1].push({ t: textOf(c), italic, caps });
					else if (c.localName === 'tab') lines[lines.length - 1].push({ t: ' ', italic, caps });
					else if (c.localName === 'br' || c.localName === 'cr') lines.push([]);
				}
			} else if (name === 'del' || name === 'pPr' || name === 'instrText') {
				continue;
			} else {
				walk(k); // hyperlink, ins, smartTag, sdtContent…
			}
		}
	};
	walk(p);
	return lines;
}

function textOf(n: XNode): string {
	let s = '';
	for (const c of Array.from(n.childNodes as ArrayLike<XNode>)) {
		if (c.nodeType === 3 || c.nodeType === 4) s += c.nodeValue ?? '';
		else if (isEl(c)) s += textOf(c);
	}
	return s;
}

function runsToLine(runs: Run[], extra: Omit<ScriptLine, 'text'>): ScriptLine | null {
	const text = runs
		.map((r) => (r.caps ? r.t.toUpperCase() : r.t))
		.join('')
		.replace(/\s+/g, ' ')
		.trim();
	if (!text) return { text: '' };
	const visible = runs.filter((r) => r.t.trim());
	const italic = visible.length > 0 && visible.every((r) => r.italic);
	return { text, ...extra, ...(italic ? { italic: true } : {}) };
}

export function linesFromDocx(data: Uint8Array, parser: XmlParser): ScriptLine[] {
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(data, { filter: (f) => f.name === 'word/document.xml' || f.name === 'word/styles.xml' });
	} catch {
		throw new Error('This doesn’t look like a Word (.docx) file.');
	}
	const docXml = files['word/document.xml'];
	if (!docXml) throw new Error('This Word file has no document body.');
	const styles = readStyles(files['word/styles.xml'] && strFromU8(files['word/styles.xml']), parser);
	const root = (parser.parseFromString(strFromU8(docXml), 'application/xml') as XDoc).documentElement;
	const body = root && child(root, 'body');
	if (!body) throw new Error('This Word file has no document body.');

	const out: ScriptLine[] = [];
	const para = (p: XEl) => {
		const pPr = child(p, 'pPr');
		const styleId = attr(pPr && child(pPr, 'pStyle'), 'val');
		const style = styleId ? (styles.get(styleId)?.name ?? styleId) : undefined;
		const jc = attr(pPr && child(pPr, 'jc'), 'val');
		const centered = jc === 'center' || (!jc && styleProp(styles, styleId, 'center')) || undefined;
		const ind = pPr && child(pPr, 'ind');
		const left = Number(attr(ind, 'left') ?? attr(ind, 'start') ?? 0) / 20; // twips → points
		const extra: Omit<ScriptLine, 'text'> = {
			...(style && !/^normal$/i.test(style) ? { style } : {}),
			...(centered ? { centered: true } : {}),
			...(left ? { indent: Math.round(left) } : {})
		};
		for (const runs of paragraphRuns(p, styles, styleId)) {
			const line = runsToLine(runs, extra);
			if (line) out.push(line);
		}
	};
	const table = (tbl: XEl) => {
		for (const tr of kids(tbl).filter((k) => k.localName === 'tr')) {
			const cells = kids(tr)
				.filter((k) => k.localName === 'tc')
				.map((tc) =>
					kids(tc)
						.filter((k) => k.localName === 'p')
						.map((p) => textOf(p).replace(/\s+/g, ' ').trim())
						.filter(Boolean)
						.join(' ')
				);
			const filled = cells.filter(Boolean);
			if (filled.length >= 2 && cells[0] && cells[0].length <= 40) {
				// Name | speech  →  "NAME. speech"
				out.push({ text: `${cells[0].replace(/[.:]+$/, '')}. ${cells.slice(1).filter(Boolean).join(' ')}` });
			} else if (filled.length) {
				out.push({ text: filled.join(' ') });
			}
			out.push({ text: '' });
		}
	};
	for (const k of kids(body)) {
		if (k.localName === 'p') para(k);
		else if (k.localName === 'tbl') table(k);
		else if (k.localName === 'sdt') for (const c of kids(child(k, 'sdtContent') ?? k)) if (c.localName === 'p') para(c);
	}
	return out;
}
