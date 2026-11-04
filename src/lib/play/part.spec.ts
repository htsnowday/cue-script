import { describe, expect, it } from 'vitest';
import { buildPart, trimCue } from './part';
import type { Play } from './types';
import wt from '../data/plays/the-winters-tale.json';
import ham from '../data/plays/hamlet.json';

describe('trimCue', () => {
	const lines = ['O, the sacrifice,', 'How ceremonious, solemn, and unearthly', 'It was i’ th’ off’ring!'];
	it('takes the last N words across line breaks', () => {
		expect(trimCue(lines, 3)).toEqual({ lines: ['i’ th’ off’ring!'], elided: true });
		expect(trimCue(lines, 6)).toEqual({ lines: ['unearthly', 'It was i’ th’ off’ring!'], elided: true });
	});
	it('returns whole speech without elision when N covers it', () => {
		expect(trimCue(['Beseech you—'], 5)).toEqual({ lines: ['Beseech you—'], elided: false });
	});
	it('supports line and speech modes', () => {
		expect(trimCue(lines, 'line')).toEqual({ lines: ['It was i’ th’ off’ring!'], elided: true });
		expect(trimCue(lines, 'speech')).toEqual({ lines, elided: false });
	});
});

describe('buildPart', () => {
	it('builds Dion like the Folger parts tool', () => {
		const part = buildPart(wt as Play, 'dion')!;
		expect(part.character.stats.speeches).toBe(5);
		expect(part.scenes.map((s) => s.ref)).toEqual(['3.1', '3.2', '5.1']);
		const speeches = part.scenes.flatMap((s) => s.entries).filter((e) => e.kind === 'speech');
		expect(speeches).toHaveLength(5);
		expect(speeches[0].index).toBe(0);
		const shared = speeches.find((s) => s.kind === 'speech' && s.with);
		expect(shared && shared.kind === 'speech' && shared.with).toEqual(['Cleomenes']);
		expect(part.cueGivers[0]).toEqual({ name: 'Cleomenes', count: 3 });
	});

	it('gives every speech except scene-openers a cue', () => {
		const part = buildPart(ham as Play, 'hamlet')!;
		let speeches = 0;
		let cued = 0;
		for (const s of part.scenes) {
			s.entries.forEach((e, i) => {
				if (e.kind !== 'speech') return;
				speeches++;
				if (s.entries.slice(0, i).reverse().find((x) => x.kind !== 'sd')?.kind === 'cue') cued++;
			});
		}
		expect(part.character.stats.lines).toBeGreaterThan(1400);
		expect(cued / speeches).toBeGreaterThan(0.9);
	});

	it('returns null for unknown characters', () => {
		expect(buildPart(wt as Play, 'nobody')).toBeNull();
	});
});
