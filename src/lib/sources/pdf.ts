/**
 * PDF → ScriptLine[] (browser only; pdf.js is loaded on demand).
 *
 * PDFs store positioned fragments of text, not lines. We rebuild lines from
 * their baselines, mark centred lines (character names in modern scripts),
 * keep indents, insert blank lines at large vertical gaps, and drop page
 * furniture: page numbers, running headers/footers, and margin line numbers.
 */
import type { ScriptLine } from './script';

interface Frag {
	str: string;
	x: number;
	y: number;
	w: number;
	h: number;
}
interface PageLine {
	text: string;
	x0: number;
	x1: number;
	y: number;
	h: number;
}

export async function linesFromPdf(
	data: ArrayBuffer,
	onProgress?: (done: number, total: number) => void
): Promise<ScriptLine[]> {
	const pdfjs = await import('pdfjs-dist');
	const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
	pdfjs.GlobalWorkerOptions.workerSrc = worker;

	const task = pdfjs.getDocument({ data: new Uint8Array(data) });
	const doc = await task.promise;
	const pages: { lines: PageLine[]; width: number; height: number }[] = [];
	for (let p = 1; p <= doc.numPages; p++) {
		const page = await doc.getPage(p);
		const vp = page.getViewport({ scale: 1 });
		const content = await page.getTextContent();
		const frags: Frag[] = [];
		for (const it of content.items) {
			if (!('str' in it) || !it.str.trim()) continue;
			frags.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height || 10 });
		}
		pages.push({ lines: groupLines(frags), width: vp.width, height: vp.height });
		onProgress?.(p, doc.numPages);
	}
	await task.destroy();
	return assemble(pages);
}

function groupLines(frags: Frag[]): PageLine[] {
	frags.sort((a, b) => b.y - a.y || a.x - b.x);
	const rows: Frag[][] = [];
	for (const f of frags) {
		const row = rows.find((r) => Math.abs(r[0].y - f.y) < Math.max(2, f.h * 0.45));
		if (row) row.push(f);
		else rows.push([f]);
	}
	return rows
		.map((row) => {
			row.sort((a, b) => a.x - b.x);
			// Margin line numbers ("5", "10" …) sitting well apart from the text.
			if (row.length > 1 && /^\d{1,4}$/.test(row[row.length - 1].str.trim())) {
				const last = row[row.length - 1], prev = row[row.length - 2];
				if (last.x - (prev.x + prev.w) > 24) row.pop();
			}
			if (row.length > 1 && /^\d{1,4}$/.test(row[0].str.trim())) {
				const first = row[0], next = row[1];
				if (next.x - (first.x + first.w) > 24) row.shift();
			}
			let text = '';
			let end = -Infinity;
			for (const f of row) {
				const gap = f.x - end;
				if (text && gap > f.h * 0.15 && !text.endsWith(' ') && !f.str.startsWith(' ')) text += ' ';
				text += f.str;
				end = f.x + f.w;
			}
			return {
				text: text.replace(/\s+/g, ' ').trim(),
				x0: row[0].x,
				x1: end,
				y: row[0].y,
				h: Math.max(...row.map((f) => f.h))
			};
		})
		.filter((l) => l.text)
		.sort((a, b) => b.y - a.y);
}

const unclosed = (t: string) => (t.match(/[([]/g)?.length ?? 0) > (t.match(/[)\]]/g)?.length ?? 0);
const norm = (t: string) => t.replace(/\d+/g, '#').toLowerCase();
const isPageNumber = (t: string) => /^(page\s*)?[-–—(]?\s*\d{1,4}\s*[-–—)]?$/i.test(t) || /^\d+\s*(of|\/)\s*\d+$/i.test(t);

function assemble(pages: { lines: PageLine[]; width: number; height: number }[]): ScriptLine[] {
	// Running headers/footers: text near the top/bottom edge repeated on many pages.
	const edgeCounts = new Map<string, number>();
	for (const pg of pages) {
		const seen = new Set<string>();
		for (const l of pg.lines) {
			if (l.y > pg.height * 0.85 || l.y < pg.height * 0.15) seen.add(norm(l.text));
		}
		for (const s of seen) edgeCounts.set(s, (edgeCounts.get(s) ?? 0) + 1);
	}
	const furniture = new Set([...edgeCounts].filter(([, n]) => n >= 2 && n >= pages.length * 0.3).map(([s]) => s));

	const out: ScriptLine[] = [];
	for (const pg of pages) {
		const body = pg.lines.filter((l) => !isPageNumber(l.text) && !furniture.has(norm(l.text)));
		if (!body.length) continue;
		const left = Math.min(...body.map((l) => l.x0));
		const gaps = body.slice(1).map((l, i) => body[i].y - l.y).filter((g) => g > 0).sort((a, b) => a - b);
		const typical = gaps[Math.floor(gaps.length / 2)] ?? 14;
		let prev: (ScriptLine & { x0: number }) | null = null;
		body.forEach((l, i) => {
			const gap = i > 0 && body[i - 1].y - l.y > typical * 1.6;
			if (gap) {
				out.push({ text: '' });
				prev = null;
			}
			// Re-join prose that the PDF wrapped: same indent, and the next line starts in
			// lowercase or closes a bracket left open. Verse lines start with a capital,
			// so they stay as they are.
			if (prev && Math.abs(prev.x0 - l.x0) < 3 && (/^[a-z]/.test(l.text) || unclosed(prev.text))) {
				// "well-" + "known" keeps its hyphen; everything else joins with a space.
				prev.text += (prev.text.endsWith('-') ? '' : ' ') + l.text;
				return;
			}
			const mid = (l.x0 + l.x1) / 2;
			const centered = Math.abs(mid - pg.width / 2) < pg.width * 0.06 && l.x0 - left > pg.width * 0.12;
			const indent = Math.round(l.x0 - left);
			const line: ScriptLine & { x0: number } = { text: l.text, x0: l.x0, ...(centered ? { centered: true } : {}), ...(indent > 3 ? { indent } : {}) };
			out.push(line);
			prev = line;
		});
		out.push({ text: '' });
	}
	return out.map(({ x0: _x0, ...l }: ScriptLine & { x0?: number }) => l);
}
