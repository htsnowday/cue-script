/**
 * The normalized play format.
 *
 * Every script source (Folger TEI today; other editions, plain-text uploads,
 * etc. later) is converted into this shape by an adapter in `#lib/sources/*`.
 * Everything downstream — cue-script generation, rehearsal tools, the
 * playbill — only ever sees a `Play`, so adding a new source never touches
 * the UI.
 */

export const PLAY_SCHEMA_VERSION = 1;

export type Genre = 'comedy' | 'history' | 'tragedy' | 'romance' | 'other';

export interface SourceInfo {
	/** Human name of the edition, e.g. "Folger Shakespeare". */
	name: string;
	/** Who prepared the text. */
	editors?: string[];
	license?: string;
	licenseUrl?: string;
	/** Canonical home of the text. */
	url?: string;
	/** Free-form provenance note, e.g. "Folger TEI Simple via DraCor". */
	via?: string;
}

export interface CharacterStats {
	/** Number of lines (verse lines or Folger prose lines) spoken. */
	lines: number;
	speeches: number;
	words: number;
	/** Number of scenes the character speaks or is named in a stage direction. */
	scenes: number;
}

export interface Character {
	/** Stable id from the source (e.g. "Dion_WT"). */
	id: string;
	/** URL slug, unique within the play (e.g. "dion"). */
	slug: string;
	/** Display name (e.g. "Dion", "Shepherd’s Son"). */
	name: string;
	/** Role description from the cast list ("a Sicilian lord"). */
	desc?: string;
	/** Position in the dramatis personae (lower = earlier). */
	order: number;
	/** True for anonymous / group roles (Servants, Lords, All…). */
	minor?: boolean;
	stats: CharacterStats;
	/** Indices into `Play.scenes` where the character is present. */
	presence: number[];
}

/** A single printed line inside a speech. */
export interface TextLine {
	kind: 'line';
	/** Folger through-line reference, e.g. "1.2.10". */
	n?: string;
	t: string;
	/** Verse (true) or prose (false). */
	verse?: boolean;
	/** Shared verse line: Initial, Medial or Final fragment. */
	part?: 'I' | 'M' | 'F';
	/** Part of a song or other set piece. */
	song?: boolean;
	/**
	 * Present only when a stage direction sits inside the line
	 * ("Thou art the man. [He kneels.] Rise up."). `t` stays clean text.
	 */
	segs?: { t: string; sd?: boolean }[];
}

/** A stage direction embedded within a speech. */
export interface InlineDirection {
	kind: 'sd';
	t: string;
	who?: string[];
}

/** A label inside a speech, e.g. "Song." */
export interface InlineLabel {
	kind: 'label';
	t: string;
}

export type SpeechItem = TextLine | InlineDirection | InlineLabel;

export interface Speech {
	kind: 'sp';
	/** Character ids. More than one for shared speeches ("BOTH", "ALL"). */
	who: string[];
	/** Speaker prefix as printed ("CLEOMENES", "BOTH"). */
	speaker: string;
	items: SpeechItem[];
}

export interface Direction {
	kind: 'sd';
	t: string;
	who: string[];
	/** entrance | exit | business | sound | … */
	type?: string;
}

export type Block = Speech | Direction;

export interface Scene {
	/** Short reference, e.g. "1.2", "Pro.", "4.Cho." */
	ref: string;
	/** Display label, e.g. "Act 1, Scene 2" or "Prologue". */
	label: string;
	act?: number;
	scene?: number;
	blocks: Block[];
}

export interface Play {
	schema: number;
	/** Short code (Folger uses WT, Ham, MND…). */
	id: string;
	slug: string;
	title: string;
	genre: Genre;
	source: SourceInfo;
	characters: Character[];
	scenes: Scene[];
}

/** Compact listing used for browsing and global search. */
export interface CatalogCharacter {
	slug: string;
	name: string;
	desc?: string;
	lines: number;
	minor?: boolean;
}

export interface CatalogPlay {
	id: string;
	slug: string;
	title: string;
	genre: Genre;
	lines: number;
	characters: CatalogCharacter[];
}
