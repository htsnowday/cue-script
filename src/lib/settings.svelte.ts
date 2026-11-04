import type { CueLength } from './play/part';

export type Theme = 'system' | 'light' | 'dark';
export type Hint = 'none' | 'letters';

const KEY = 'cuescript:settings';

/** The cue-length stops offered by the slider. */
export const CUE_STOPS: CueLength[] = [1, 2, 3, 5, 8, 'line', 'speech'];

export function cueLabel(c: CueLength): string {
	if (c === 'line') return 'Last line';
	if (c === 'speech') return 'Whole speech';
	return c === 1 ? '1 word' : `${c} words`;
}

class Settings {
	cueLength = $state<CueLength>(3);
	theme = $state<Theme>('system');
	voice = $state(false);
	hint = $state<Hint>('none');
	lineNumbers = $state(true);
	rate = $state(0.95);

	#loaded = false;

	load() {
		if (this.#loaded || typeof localStorage === 'undefined') return;
		this.#loaded = true;
		try {
			const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
			if (CUE_STOPS.includes(s.cueLength)) this.cueLength = s.cueLength;
			if (['system', 'light', 'dark'].includes(s.theme)) this.theme = s.theme;
			if (typeof s.voice === 'boolean') this.voice = s.voice;
			if (s.hint === 'none' || s.hint === 'letters') this.hint = s.hint;
			if (typeof s.lineNumbers === 'boolean') this.lineNumbers = s.lineNumbers;
			if (typeof s.rate === 'number') this.rate = Math.min(1.5, Math.max(0.6, s.rate));
		} catch {
			/* private mode etc. — defaults are fine */
		}
	}

	save() {
		try {
			localStorage.setItem(
				KEY,
				JSON.stringify({
					cueLength: this.cueLength,
					theme: this.theme,
					voice: this.voice,
					hint: this.hint,
					lineNumbers: this.lineNumbers,
					rate: this.rate
				})
			);
		} catch {
			/* ignore */
		}
	}
}

export const settings = new Settings();
