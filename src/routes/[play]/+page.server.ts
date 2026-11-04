import { error } from '@sveltejs/kit';
import { catalog, loadPlay } from '#lib/server/plays.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => catalog.map((p) => ({ play: p.slug }));

export const load: PageServerLoad = async ({ params }) => {
	const play = await loadPlay(params.play);
	if (!play) error(404, 'No such play in the repertory.');
	return {
		play: { id: play.id, slug: play.slug, title: play.title, genre: play.genre },
		scenes: play.scenes.map((s) => ({ ref: s.ref, label: s.label, act: s.act })),
		characters: play.characters.map(({ slug, name, desc, order, minor, stats, presence }) => ({
			slug,
			name,
			desc,
			order,
			minor,
			stats,
			presence
		}))
	};
};
