import type { Genre } from './types';

/** Genre per Folger play code (First Folio grouping, with the late romances split out). */
export const GENRES: Record<string, Genre> = {
	AWW: 'comedy',
	AYL: 'comedy',
	Ado: 'comedy',
	Err: 'comedy',
	LLL: 'comedy',
	MM: 'comedy',
	MND: 'comedy',
	MV: 'comedy',
	Shr: 'comedy',
	TGV: 'comedy',
	TN: 'comedy',
	Wiv: 'comedy',
	Tro: 'comedy',
	'1H4': 'history',
	'1H6': 'history',
	'2H4': 'history',
	'2H6': 'history',
	'3H6': 'history',
	H5: 'history',
	H8: 'history',
	Jn: 'history',
	R2: 'history',
	R3: 'history',
	Ant: 'tragedy',
	Cor: 'tragedy',
	Ham: 'tragedy',
	JC: 'tragedy',
	Lr: 'tragedy',
	Mac: 'tragedy',
	Oth: 'tragedy',
	Rom: 'tragedy',
	Tim: 'tragedy',
	Tit: 'tragedy',
	Cym: 'romance',
	Per: 'romance',
	Tmp: 'romance',
	WT: 'romance'
};

export const GENRE_LABELS: Record<Genre, { title: string; blurb: string }> = {
	comedy: { title: 'Comedies', blurb: 'Disguises, mistaken twins, and weddings by the fifth act.' },
	history: { title: 'Histories', blurb: 'Crowns won, crowns lost, and a great deal of shouting.' },
	tragedy: { title: 'Tragedies', blurb: 'Ambition, jealousy, and a stage strewn with bodies.' },
	romance: { title: 'Romances', blurb: 'Shipwrecks, long-lost daughters, and statues that breathe.' },
	other: { title: 'Other Plays', blurb: '' }
};

export const GENRE_ORDER: Genre[] = ['comedy', 'history', 'tragedy', 'romance', 'other'];

/** Friendlier titles than the TEI headers sometimes give. */
export const TITLE_OVERRIDES: Record<string, string> = {
	'1H4': 'Henry IV, Part 1',
	'2H4': 'Henry IV, Part 2',
	'1H6': 'Henry VI, Part 1',
	'2H6': 'Henry VI, Part 2',
	'3H6': 'Henry VI, Part 3'
};

/**
 * Curated fixes for quirks in the DraCor conversion of the Folger texts.
 * Keyed by character id.
 */
export const NAME_OVERRIDES: Record<string, string> = {
	Viola_TN: 'Viola', // persName lists her disguise too ("Viola Cesario")
	HenryV_H5: 'Prince Hal' // in 2H4: "Prince Hal King Henry V"
};

export const DESC_FIXES: [RegExp, string][] = [
	[/King Hamletand/g, 'King Hamlet and'],
	[/([\p{L}.,])\(/gu, '$1 (']
];
