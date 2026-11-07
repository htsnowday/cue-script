import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { linesFromText, parseScript } from '../sources/script';
import { applyCorrections, emptyCorrections } from './corrections';
import { buildPart } from './part';

const text = readFileSync(new URL('../sources/fixtures/lighthouse-modern.txt', import.meta.url), 'utf8');
// A script where the parser can't know "MAGS" is Margaret, and "SOUND OF GULLS" isn't a person.
const messy = parseScript(
	linesFromText(text.replace("MARGARET\nThere's always tea.", "MAGS\nThere's always tea.") + '\nSOUND OF GULLS\nFar off, then close.\n\nTOM\nHello?\n')
).play;

describe('applyCorrections', () => {
	it('leaves the play alone with no corrections', () => {
		expect(applyCorrections(messy, emptyCorrections()).characters).toEqual(messy.characters);
	});

	it('merges an alias into the real character', () => {
		const ids = Object.fromEntries(messy.characters.map((c) => [c.name, c.id]));
		const fixed = applyCorrections(messy, { ...emptyCorrections(), merge: { [ids.Mags]: ids.Margaret } });
		expect(fixed.characters.map((c) => c.name)).not.toContain('Mags');
		expect(fixed.characters.find((c) => c.name === 'Margaret')!.stats.speeches).toBe(3);
		const part = buildPart(fixed, 'margaret')!;
		expect(part.scenes[0].entries.filter((e) => e.kind === 'speech')).toHaveLength(3);
	});

	it('turns a non-character into a stage direction', () => {
		const lights = messy.characters.find((c) => c.name === 'Sound of Gulls')!;
		const fixed = applyCorrections(messy, { ...emptyCorrections(), notCharacter: [lights.id] });
		expect(fixed.characters.map((c) => c.name)).not.toContain('Sound of Gulls');
		const blocks = fixed.scenes.flatMap((s) => s.blocks);
		expect(blocks).toContainEqual(expect.objectContaining({ kind: 'sd', t: 'Sound of Gulls. Far off, then close.' }));
	});

	it('renames characters and the play, updating slugs', () => {
		const tom = messy.characters.find((c) => c.name === 'Tom')!;
		const fixed = applyCorrections(messy, { ...emptyCorrections(), title: 'Keeper', rename: { [tom.id]: 'Thomas' } });
		expect(fixed.title).toBe('Keeper');
		expect(fixed.slug).toBe('keeper');
		expect(fixed.characters.find((c) => c.id === tom.id)).toMatchObject({ name: 'Thomas', slug: 'thomas' });
	});
});
