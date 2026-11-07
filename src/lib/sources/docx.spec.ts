import { DOMParser } from '@xmldom/xmldom';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { linesFromDocx } from './docx';
import { parseScript } from './script';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const p = (text: string, o: { style?: string; italic?: boolean; center?: boolean; caps?: boolean } = {}) =>
	`<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.center ? '<w:jc w:val="center"/>' : ''}</w:pPr>` +
	`<w:r><w:rPr>${o.italic ? '<w:i/>' : ''}${o.caps ? '<w:caps/>' : ''}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

function docx(body: string, styles = '') {
	return zipSync({
		'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`),
		'word/styles.xml': strToU8(`<?xml version="1.0"?><w:styles ${W}>${styles}</w:styles>`)
	});
}

describe('linesFromDocx', () => {
	it('reads styles, italics, centring and capitals', () => {
		const styles =
			'<w:style w:type="paragraph" w:styleId="Character"><w:name w:val="Character"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:caps/></w:rPr></w:style>';
		const body = [
			p('Scene 1'),
			p('A kitchen. Morning.', { italic: true }),
			p('Ada', { style: 'Character' }),
			p('Is the kettle on?'),
			p('Ben', { style: 'Character' }),
			p('(not looking up)'),
			p('It’s always on.'),
			p('Ada', { style: 'Character' }),
			p('Then pour.'),
			p('He pours.', { italic: true })
		].join('');
		const lines = linesFromDocx(docx(body, styles), new DOMParser());
		expect(lines[2]).toEqual({ text: 'ADA', style: 'Character', centered: true });
		expect(lines[1]).toMatchObject({ italic: true });

		const { play, report } = parseScript(lines);
		expect(report.mode).toBe('own-line');
		expect(play.characters.map((c) => c.name)).toEqual(['Ada', 'Ben']);
		const blocks = play.scenes[0].blocks;
		expect(blocks[0]).toMatchObject({ kind: 'sd', t: 'A kitchen. Morning.' });
		expect(blocks.at(-1)).toMatchObject({ kind: 'sd', t: 'He pours.' });
		const ben = blocks.find((b) => b.kind === 'sp' && b.speaker === 'BEN');
		expect(ben?.kind === 'sp' && ben.items.map((i) => i.kind)).toEqual(['sd', 'line']);
	});

	it('turns two-column name | speech tables into inline speeches', () => {
		const row = (a: string, b: string) => `<w:tr><w:tc>${p(a)}</w:tc><w:tc>${p(b)}</w:tc></w:tr>`;
		const body = `<w:tbl>${row('HAMLET', 'To be, or not to be.')}${row('OPHELIA', 'Good my lord.')}${row('HAMLET', 'Get thee to a nunnery.')}</w:tbl>`;
		const { play, report } = parseScript(linesFromDocx(docx(body), new DOMParser()));
		expect(report.mode).toBe('inline');
		expect(play.characters.map((c) => [c.name, c.stats.speeches])).toEqual([
			['Hamlet', 2],
			['Ophelia', 1]
		]);
	});

	it('rejects files that are not Word documents', () => {
		expect(() => linesFromDocx(strToU8('hello'), new DOMParser())).toThrow(/Word/);
	});
});
