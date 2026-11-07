/**
 * "Your scripts": uploaded plays, stored privately in this browser
 * (IndexedDB), plus the .cuescript production file a director sends the cast.
 */
import type { Play } from './play/types';
import { applyCorrections, emptyCorrections, type Corrections } from './play/corrections';
import { slugify } from './play/text';
import type { SpeakerMode } from './sources/script';
import type { ScriptSource } from './sources/import';

export interface SavedScript {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	source: ScriptSource;
	mode: SpeakerMode;
	corrections: Corrections;
	/** The finished play (parse + corrections), cached so pages open instantly. */
	play: Play;
	/** Set when this copy came from a director's production file. */
	importedAt?: number;
}

export type ScriptSummary = Pick<SavedScript, 'id' | 'title' | 'createdAt' | 'updatedAt' | 'importedAt'> & {
	parts: number;
	lines: number;
	format: ScriptSource['format'];
	fileName?: string;
};

const DB = 'cue-script';
const STORE = 'scripts';
const memory = new Map<string, SavedScript>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve) => {
		try {
			if (typeof indexedDB === 'undefined') return resolve(null);
			const req = indexedDB.open(DB, 1);
			req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve(null);
			req.onblocked = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
	return dbPromise;
}

/** False when the browser won't let us save (e.g. some private modes). */
export async function isPersistent() {
	return (await db()) !== null;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	return db().then(
		(d) =>
			new Promise<T>((resolve, reject) => {
				if (!d) return reject(new Error('no-db'));
				const req = fn(d.transaction(STORE, mode).objectStore(STORE));
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			})
	);
}

export async function listScripts(): Promise<ScriptSummary[]> {
	let all: SavedScript[];
	try {
		all = await tx<SavedScript[]>('readonly', (s) => s.getAll());
	} catch {
		all = [...memory.values()];
	}
	return all
		.map((r) => ({
			id: r.id,
			title: r.title,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
			importedAt: r.importedAt,
			parts: r.play.characters.length,
			lines: r.play.characters.reduce((n, c) => n + c.stats.lines, 0),
			format: r.source.format,
			fileName: r.source.fileName
		}))
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getScript(id: string): Promise<SavedScript | null> {
	try {
		return (await tx<SavedScript | undefined>('readonly', (s) => s.get(id))) ?? null;
	} catch {
		return memory.get(id) ?? null;
	}
}

export async function saveScript(rec: SavedScript): Promise<void> {
	// IndexedDB can't store Svelte proxies; store a plain copy.
	const plain = JSON.parse(JSON.stringify(rec)) as SavedScript;
	try {
		await tx('readwrite', (s) => s.put(plain));
	} catch {
		memory.set(rec.id, plain);
	}
}

export async function deleteScript(id: string): Promise<void> {
	try {
		await tx('readwrite', (s) => s.delete(id));
	} catch {
		memory.delete(id);
	}
}

export function newId(): string {
	const rand = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(2)) : [Math.random() * 2 ** 32, Date.now()];
	return Array.from(rand, (n) => Math.floor(n).toString(36)).join('').slice(0, 12);
}

export function buildRecord(
	parsed: Play,
	source: ScriptSource,
	mode: SpeakerMode,
	corrections: Corrections = emptyCorrections(),
	existing?: SavedScript
): SavedScript {
	const play = applyCorrections(parsed, corrections);
	const now = Date.now();
	return {
		id: existing?.id ?? newId(),
		title: play.title,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
		source,
		mode,
		corrections,
		play,
		...(existing?.importedAt ? { importedAt: existing.importedAt } : {})
	};
}

/* ------------------------------------------------------------------ */
/* Production files                                                    */
/* ------------------------------------------------------------------ */

const KIND = 'cue-script/production';

export interface ProductionFile {
	kind: typeof KIND;
	version: 1;
	id: string;
	title: string;
	exportedAt: number;
	source: ScriptSource;
	mode: SpeakerMode;
	corrections: Corrections;
	play: Play;
}

export function productionFile(rec: SavedScript): { blob: Blob; fileName: string } {
	const file: ProductionFile = {
		kind: KIND,
		version: 1,
		id: rec.id,
		title: rec.title,
		exportedAt: Date.now(),
		source: rec.source,
		mode: rec.mode,
		corrections: rec.corrections,
		play: rec.play
	};
	return {
		blob: new Blob([JSON.stringify(file)], { type: 'application/json' }),
		fileName: `${slugify(rec.title) || 'script'}.cuescript`
	};
}

export function isProductionFile(text: string): boolean {
	return text.slice(0, 200).includes(`"kind":"${KIND}"`);
}

/** Add or update a script from a director's production file. */
export async function importProduction(text: string): Promise<{ record: SavedScript; status: 'added' | 'updated' | 'unchanged' }> {
	let f: ProductionFile;
	try {
		f = JSON.parse(text);
	} catch {
		throw new Error('This production file is damaged and can’t be opened.');
	}
	if (f?.kind !== KIND || !f.play?.scenes || !f.id) throw new Error('This isn’t a Cue Script production file.');
	if (f.version > 1) throw new Error('This production file was made by a newer version of Cue Script. Please reload the page and try again.');
	const existing = await getScript(f.id);
	if (existing && existing.updatedAt >= f.exportedAt && existing.importedAt) {
		return { record: existing, status: 'unchanged' };
	}
	const now = Date.now();
	const record: SavedScript = {
		id: f.id,
		title: f.title,
		createdAt: existing?.createdAt ?? now,
		updatedAt: f.exportedAt,
		importedAt: now,
		source: f.source,
		mode: f.mode,
		corrections: f.corrections ?? emptyCorrections(),
		play: f.play
	};
	await saveScript(record);
	return { record, status: existing ? 'updated' : 'added' };
}
