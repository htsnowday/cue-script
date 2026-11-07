/** Small text helpers shared by sources and UI. */

export function slugify(s: string): string {
	return s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[’'`]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'x';
}

export function uniqueSlug(base: string, used: Set<string>): string {
	let s = base;
	for (let i = 2; used.has(s); i++) s = `${base}-${i}`;
	used.add(s);
	return s;
}

const ROMAN = /^(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/;
const SMALL = new Set(['of', 'the', 'and', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'upon', 'a', 'an', 'de', 'du', 'la', 'le', 'von']);

/** "SHEPHERD’S SON" → "Shepherd’s Son", "KING HENRY VI" → "King Henry VI". */
export function titleCaseSpeaker(s: string): string {
	return s
		.trim()
		.toLowerCase()
		.split(/(\s+|-)/)
		.map((w, i) => {
			if (/^\s+$|^-$/.test(w)) return w;
			if (ROMAN.test(w.toUpperCase()) && w.length <= 4 && i > 0) return w.toUpperCase();
			if (i > 0 && SMALL.has(w)) return w;
			return w.charAt(0).toUpperCase() + w.slice(1);
		})
		.join('');
}

export function words(s: string): string[] {
	return s.split(/\s+/).filter(Boolean);
}
