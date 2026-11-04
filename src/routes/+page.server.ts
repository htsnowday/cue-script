import { catalog } from '#lib/server/plays.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	plays: catalog.map((p) => ({
		slug: p.slug,
		title: p.title,
		genre: p.genre,
		parts: p.characters.length,
		lines: p.lines,
		leads: [...p.characters]
			.sort((a, b) => b.lines - a.lines)
			.slice(0, 3)
			.map((c) => c.name)
	})),
	totals: {
		plays: catalog.length,
		parts: catalog.reduce((n, p) => n + p.characters.length, 0),
		lines: catalog.reduce((n, p) => n + p.lines, 0)
	}
});
