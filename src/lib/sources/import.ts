/**
 * One entry point for every kind of script a user can bring:
 * pasted text, .txt, .docx, .pdf and TEI XML. Runs entirely in the browser.
 */
import type { Play } from '../play/types';
import { parseFolgerTei } from './folger-tei';
import { linesFromText, parseScript, type ParseReport, type ScriptLine, type SpeakerMode } from './script';

export type SourceFormat = 'text' | 'docx' | 'pdf' | 'tei';

/** What we keep of the original upload, so it can be re-parsed later. */
export interface ScriptSource {
	format: SourceFormat;
	fileName?: string;
	/** Extracted lines (text, Word, PDF). */
	lines?: ScriptLine[];
	/** Raw XML (TEI). */
	xml?: string;
}

export interface ImportResult {
	play: Play;
	report: ParseReport;
}

export const ACCEPT = '.txt,.text,.md,.fountain,.docx,.pdf,.xml,.tei';

export async function readScriptFile(file: File, onProgress?: (msg: string) => void): Promise<ScriptSource> {
	const name = file.name;
	const ext = name.toLowerCase().split('.').pop() ?? '';
	const buf = await file.arrayBuffer();
	const head = new Uint8Array(buf.slice(0, 8));
	const magic = String.fromCharCode(...head);

	if (magic.startsWith('%PDF') || ext === 'pdf') {
		onProgress?.('Reading the PDF…');
		const { linesFromPdf } = await import('./pdf');
		const lines = await linesFromPdf(buf, (d, t) => onProgress?.(`Reading page ${d} of ${t}…`));
		return { format: 'pdf', fileName: name, lines };
	}
	if (magic.startsWith('PK') || ext === 'docx') {
		onProgress?.('Opening the Word document…');
		const { linesFromDocx } = await import('./docx');
		return { format: 'docx', fileName: name, lines: linesFromDocx(new Uint8Array(buf), new DOMParser()) };
	}
	if (ext === 'doc' || head[0] === 0xd0) throw new Error('Older Word files (.doc) can’t be read. Please save it as .docx and try again.');
	if (ext === 'pages') throw new Error('Pages files can’t be read. Please export it as Word (.docx) or PDF.');
	if (ext === 'rtf' || magic.startsWith('{\\rtf')) throw new Error('RTF files can’t be read. Please save it as .docx or plain text.');

	const text = decode(buf);
	if (ext === 'xml' || ext === 'tei' || /^\s*(<\?xml|<TEI)/.test(text.slice(0, 500))) {
		return { format: 'tei', fileName: name, xml: text };
	}
	return { format: 'text', fileName: name, lines: linesFromText(text) };
}

export function sourceFromText(text: string): ScriptSource {
	return /^\s*(<\?xml|<TEI)/.test(text.slice(0, 500))
		? { format: 'tei', xml: text }
		: { format: 'text', lines: linesFromText(text) };
}

/** UTF-8, falling back to Windows-1252 for older text files. */
function decode(buf: ArrayBuffer): string {
	const utf8 = new TextDecoder('utf-8').decode(buf);
	const bad = (utf8.match(/�/g) ?? []).length;
	if (bad > 3) return new TextDecoder('windows-1252').decode(buf);
	return utf8.replace(/^﻿/, '');
}

export function parseSource(src: ScriptSource, opts: { title?: string; mode?: SpeakerMode } = {}): ImportResult {
	if (src.format === 'tei') {
		const doc = new DOMParser().parseFromString(src.xml ?? '', 'application/xml');
		if (doc.getElementsByTagName('parsererror').length) throw new Error('This XML file couldn’t be read; it may be damaged.');
		const play = parseFolgerTei(doc as never, {});
		const folger = /folger/i.test(src.xml?.slice(0, 5000) ?? '');
		const out: Play = {
			...play,
			title: opts.title ?? play.title,
			genre: 'other',
			source: folger ? play.source : { name: 'Your script (TEI)' }
		};
		return {
			play: out,
			report: { mode: 'tei', skipped: [], castListFound: true, warnings: out.characters.length ? [] : ['No speeches were found in this XML file.'] }
		};
	}
	return parseScript(src.lines ?? [], opts);
}
