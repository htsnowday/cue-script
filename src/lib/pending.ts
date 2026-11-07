import type { ScriptSource } from './sources/import';

/** Hands a just-read file from the library page to the review page. */
let pending: ScriptSource | null = null;

export function setPending(s: ScriptSource) {
	pending = s;
}

export function takePending(): ScriptSource | null {
	const s = pending;
	pending = null;
	return s;
}
