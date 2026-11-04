import type { CatalogPlay, Play } from '#lib/play/types.ts';
import catalogJson from '#lib/data/catalog.json';

const modules = import.meta.glob<{ default: Play }>('../data/plays/*.json');

export const catalog = catalogJson as CatalogPlay[];

export async function loadPlay(slug: string): Promise<Play | null> {
	const mod = modules[`../data/plays/${slug}.json`];
	return mod ? (await mod()).default : null;
}
