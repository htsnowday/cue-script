import { error } from '@sveltejs/kit';
import { buildPart } from '#lib/play/part.ts';
import { catalog, loadPlay } from '#lib/server/plays.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () =>
	catalog.flatMap((p) => p.characters.map((c) => ({ play: p.slug, character: c.slug })));

export const load: PageServerLoad = async ({ params }) => {
	const play = await loadPlay(params.play);
	if (!play) error(404, 'No such play in the repertory.');
	const part = buildPart(play, params.character);
	if (!part) error(404, `No such part in ${play.title}.`);
	const others = play.characters
		.filter((c) => !c.minor && c.slug !== part.character.slug)
		.sort((a, b) => b.stats.lines - a.stats.lines)
		.slice(0, 8)
		.map((c) => ({ slug: c.slug, name: c.name }));
	return { part, others };
};
