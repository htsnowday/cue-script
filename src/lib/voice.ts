/**
 * A scene partner on demand: reads cues aloud with the browser's speech
 * synthesis. Each character who gives cues gets their own consistent voice
 * (and pitch), so Leontes never sounds like Paulina.
 */

export const voiceSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let voices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
	if (!voiceSupported()) return;
	const all = speechSynthesis.getVoices();
	const en = all.filter((v) => /^en(-|_|$)/i.test(v.lang));
	// Prefer British voices for the company, then any English.
	const gb = en.filter((v) => /GB|UK|IE/i.test(v.lang));
	voices = [...gb, ...en.filter((v) => !gb.includes(v))];
	if (!voices.length) voices = all;
}

if (voiceSupported()) {
	refreshVoices();
	speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

function hash(s: string) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
}

export function speak(text: string, opts: { speaker?: string; rate?: number } = {}): Promise<void> {
	if (!voiceSupported() || !text.trim()) return Promise.resolve();
	speechSynthesis.cancel();
	if (!voices.length) refreshVoices();
	const u = new SpeechSynthesisUtterance(text);
	const h = hash(opts.speaker ?? '');
	if (voices.length) {
		u.voice = voices[h % voices.length];
		u.lang = u.voice.lang;
	} else {
		u.lang = 'en-GB';
	}
	u.pitch = 0.8 + ((h >> 8) % 40) / 100; // 0.80 – 1.19
	u.rate = opts.rate ?? 0.95;
	return new Promise((res) => {
		u.onend = () => res();
		u.onerror = () => res();
		speechSynthesis.speak(u);
	});
}

export function hush() {
	if (voiceSupported()) speechSynthesis.cancel();
}
