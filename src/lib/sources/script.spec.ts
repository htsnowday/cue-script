import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPart } from '../play/part';
import { linesFromText, parseScript } from './script';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const parse = (name: string, opts = {}) => parseScript(linesFromText(fixture(name)), opts);
const names = (r: ReturnType<typeof parse>) => r.play.characters.map((c) => c.name);

describe('parseScript: inline speakers (old Gutenberg Shakespeare)', () => {
	const r = parse('hamlet-gutenberg.txt');

	it('detects the layout, title and cast list', () => {
		expect(r.report.mode).toBe('inline');
		expect(r.play.title).toBe('Hamlet');
		expect(r.report.castListFound).toBe(true);
	});

	it('expands abbreviated speakers using the dramatis personae', () => {
		expect(names(r)).toContain('Hamlet');
		expect(names(r)).toContain('Polonius');
		const hamlet = r.play.characters.find((c) => c.name === 'Hamlet')!;
		expect(hamlet.desc).toMatch(/Son to the former/);
		expect(hamlet.stats.speeches).toBe(3);
	});

	it('reads act/scene headings and the location', () => {
		expect(r.play.scenes.map((s) => s.label)).toEqual(['Act 1, Scene 2']);
		expect(r.play.scenes[0].blocks[0]).toMatchObject({ kind: 'sd', type: 'location' });
	});

	it('keeps bracketed and right-hand directions out of the spoken text', () => {
		const sp = r.play.scenes[0].blocks.find((b) => b.kind === 'sp' && b.speaker === 'HAM');
		const line = sp?.kind === 'sp' ? sp.items.find((i) => i.kind === 'line') : undefined;
		expect(line).toMatchObject({ t: 'A little more than kin, and less than kind!' });
		const exits = r.play.scenes[0].blocks.filter((b) => b.kind === 'sd' && b.type === 'exit');
		expect(exits[0]).toMatchObject({ t: 'Exeunt all but Hamlet.' });
		expect(exits[0].kind === 'sd' && exits[0].who).toContain('c:HAMLET');
	});

	it('produces a usable part with cues', () => {
		const slug = r.play.characters.find((c) => c.name === 'Hamlet')!.slug;
		const part = buildPart(r.play, slug)!;
		const cues = part.scenes[0].entries.filter((e) => e.kind === 'cue');
		expect(cues[0]).toMatchObject({ from: 'King' });
	});
});

describe('parseScript: names on their own line (modern play)', () => {
	const r = parse('lighthouse-modern.txt');

	it('detects the layout, title and characters', () => {
		expect(r.report.mode).toBe('own-line');
		expect(r.play.title).toBe('The Lighthouse Keeper');
		expect(names(r)).toEqual(['Margaret', 'Tom']);
		expect(r.play.characters[0].desc).toBe('a lighthouse keeper, 60s');
	});

	it('treats parentheticals and action lines as directions', () => {
		const blocks = r.play.scenes[0].blocks;
		const tom = blocks.find((b) => b.kind === 'sp' && b.speaker === 'TOM');
		expect(tom?.kind === 'sp' && tom.items[0]).toMatchObject({ kind: 'sd', t: 'shaking off rain' });
		expect(blocks.some((b) => b.kind === 'sd' && b.t === 'She hands Tom a towel.')).toBe(true);
		expect(blocks.at(-1)).toMatchObject({ kind: 'sd', t: 'Lights fade.' });
		expect(r.play.characters.find((c) => c.name === 'Margaret')!.stats.lines).toBe(3);
	});
});

describe('parseScript: other layouts', () => {
	it('handles modern Gutenberg Shakespeare (NAME. on its own line)', () => {
		const r = parse('hamlet-modern-gutenberg.txt');
		expect(r.report.mode).toBe('own-line');
		expect(r.play.scenes.map((s) => s.ref)).toEqual(['1.1', '1.2']);
		expect(names(r)).toEqual(expect.arrayContaining(['Barnardo', 'Francisco', 'King', 'Hamlet']));
		expect(r.play.characters.find((c) => c.name === 'Barnardo')!.stats.speeches).toBe(2);
	});

	it('handles "NAME: speech" with no headings at all', () => {
		const r = parseScript(
			linesFromText('ROMEO: But soft, what light through yonder window breaks?\nJULIET: Ay me.\nROMEO: She speaks.\n')
		);
		expect(names(r)).toEqual(['Romeo', 'Juliet']);
		expect(r.play.scenes).toHaveLength(1);
		expect(r.play.scenes[0].label).toBe('The Play');
	});

	it('honours an explicit layout override', () => {
		expect(parse('lighthouse-modern.txt', { mode: 'inline' }).report.mode).toBe('inline');
	});

	it('warns when it finds nobody speaking', () => {
		const r = parseScript(linesFromText('Just some prose.\nNothing dramatic here.'));
		expect(r.report.warnings.length).toBeGreaterThan(0);
	});
});
