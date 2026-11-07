<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { buildRecord, type SavedScript } from '#lib/library.ts';
	import { applyCorrections, type Corrections } from '#lib/play/corrections.ts';
	import type { Block, Character } from '#lib/play/types.ts';
	import { parseSource, type ScriptSource } from '#lib/sources/import.ts';
	import type { SpeakerMode } from '#lib/sources/script.ts';

	let {
		source,
		initialMode = 'auto',
		initialCorrections,
		existing,
		onsave,
		oncancel
	}: {
		source: ScriptSource;
		initialMode?: SpeakerMode;
		initialCorrections: Corrections;
		existing?: SavedScript;
		onsave: (rec: SavedScript) => void | Promise<void>;
		oncancel: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let mode = $state<SpeakerMode>(initialMode);
	// svelte-ignore state_referenced_locally
	let corr = $state<Corrections>(structuredClone($state.snapshot(initialCorrections)));
	let focus = $state<string | null>(null);
	let previewLimit = $state(120);
	let saving = $state(false);

	const parsed = $derived.by(() => {
		try {
			return { ok: true as const, ...parseSource(source, { mode }) };
		} catch (e) {
			return { ok: false as const, error: (e as Error).message };
		}
	});
	const raw = $derived(parsed.ok ? parsed.play : null);
	const final = $derived(raw ? applyCorrections(raw, corr) : null);
	const report = $derived(parsed.ok ? parsed.report : null);

	/** Everyone the parser found, in final order, including those merged away or rejected. */
	const rows = $derived.by(() => {
		if (!raw || !final) return [];
		const finalById = new Map(final.characters.map((c) => [c.id, c]));
		const order = new Map(final.characters.map((c, i) => [c.id, i]));
		return raw.characters
			.map((c) => ({
				raw: c,
				final: finalById.get(c.id),
				mergedInto: corr.merge[c.id],
				rejected: corr.notCharacter.includes(c.id),
				firstLine: firstLine(c.id),
				suspicious: c.stats.speeches <= 1 && (c.name.split(' ').length >= 3 || c.name.length > 22)
			}))
			.sort((a, b) => (order.get(a.raw.id) ?? 1e6 + a.raw.order) - (order.get(b.raw.id) ?? 1e6 + b.raw.order));
	});

	function firstLine(id: string): string {
		for (const s of raw?.scenes ?? []) {
			for (const b of s.blocks) {
				if (b.kind === 'sp' && b.who.includes(id)) {
					const l = b.items.find((i) => i.kind === 'line');
					if (l) return l.t;
				}
			}
		}
		return '';
	}

	const nameOf = (id: string) => final?.characters.find((c) => c.id === id)?.name ?? raw?.characters.find((c) => c.id === id)?.name ?? id;
	const activeChars = $derived(rows.filter((r) => !r.mergedInto && !r.rejected).map((r) => r.raw));
	const totals = $derived({
		parts: final?.characters.length ?? 0,
		scenes: final?.scenes.length ?? 0,
		lines: final?.characters.reduce((n, c) => n + c.stats.lines, 0) ?? 0
	});

	function rename(c: Character, v: string) {
		const name = v.trim();
		if (!name || name === c.name) delete corr.rename[c.id];
		else corr.rename[c.id] = name;
	}
	function mergeInto(c: Character, target: string) {
		if (!target) delete corr.merge[c.id];
		else corr.merge[c.id] = target;
		// Anything merged into c follows it.
		for (const [k, v] of Object.entries(corr.merge)) if (v === c.id && target) corr.merge[k] = target;
	}
	function toggleReject(c: Character) {
		corr.notCharacter = corr.notCharacter.includes(c.id)
			? corr.notCharacter.filter((x) => x !== c.id)
			: [...corr.notCharacter, c.id];
	}

	// Preview: the whole script, or just where one character speaks.
	const preview = $derived.by(() => {
		if (!final) return [] as { scene: string; blocks: Block[] }[];
		const target = focus ? (corr.merge[focus] ?? focus) : null;
		let budget = previewLimit;
		const out: { scene: string; blocks: Block[] }[] = [];
		for (const s of final.scenes) {
			if (budget <= 0) break;
			const blocks = s.blocks.filter((b) => !target || (b.kind === 'sp' && b.who.includes(target)));
			if (!blocks.length) continue;
			out.push({ scene: s.label, blocks: blocks.slice(0, budget) });
			budget -= blocks.length;
		}
		return out;
	});
	const previewTotal = $derived(
		final?.scenes.reduce((n, s) => n + s.blocks.filter((b) => !focus || (b.kind === 'sp' && b.who.includes(corr.merge[focus] ?? focus))).length, 0) ?? 0
	);

	async function save() {
		if (!raw) return;
		saving = true;
		try {
			await onsave(buildRecord(raw, source, mode, $state.snapshot(corr) as Corrections, existing));
		} finally {
			saving = false;
		}
	}

	const MODES: { value: SpeakerMode; label: string; eg: string }[] = [
		{ value: 'auto', label: 'Detect automatically', eg: '' },
		{ value: 'inline', label: 'Name, then speech', eg: 'HAMLET. To be, or not to be' },
		{ value: 'own-line', label: 'Name on its own line', eg: 'HAMLET ↵ To be, or not to be' }
	];
</script>

<section class="review sheet">
	<header>
		<p class="sc kicker">Check the cast</p>
		<label class="title-field">
			<span class="visually-hidden">Title</span>
			<input
				value={corr.title ?? raw?.title ?? ''}
				oninput={(e) => (corr.title = e.currentTarget.value)}
				placeholder="Title of the play"
			/>
		</label>
		{#if source.fileName}<p class="file">from <em>{source.fileName}</em></p>{/if}
	</header>

	{#if !parsed.ok}
		<p class="error" role="alert">{parsed.error}</p>
	{:else if final && report}
		<dl class="totals">
			<div><dt>parts</dt><dd>{totals.parts}</dd></div>
			<div><dt>scenes</dt><dd>{totals.scenes}</dd></div>
			<div><dt>lines</dt><dd>{totals.lines.toLocaleString()}</dd></div>
		</dl>

		{#if report.mode !== 'tei'}
			<div class="layout">
				<label for="mode" class="sc">Speaker names</label>
				<select id="mode" bind:value={mode}>
					{#each MODES as m (m.value)}
						<option value={m.value}>
							{m.value === 'auto' ? `${m.label} (${report.mode === 'inline' ? 'name, then speech' : 'own line'})` : m.label}
						</option>
					{/each}
				</select>
				<span class="eg">{MODES.find((m) => m.value === (mode === 'auto' ? report.mode : mode))?.eg}</span>
			</div>
		{/if}

		{#each report.warnings as w (w)}
			<p class="warn" role="status">{w}</p>
		{/each}

		<div class="cols">
			<div class="cast">
				<h2>Who’s in it?</h2>
				<p class="help">
					Fix names, merge two names for one person (“Ham.” and “Hamlet”), or untick anything that isn’t a character.
					Tap a line count to preview everything that character says.
				</p>
				<ul>
					{#each rows as r (r.raw.id)}
						{@const c = r.raw}
						<li class:merged={!!r.mergedInto} class:rejected={r.rejected} class:focused={focus === c.id} class:suspicious={r.suspicious && !r.rejected}>
							<input
								type="checkbox"
								checked={!r.rejected}
								onchange={() => toggleReject(c)}
								aria-label="{c.name} is a character"
								title={r.rejected ? 'Not a character: their lines become stage directions' : 'Is a character'}
							/>
							<div class="who">
								<input
									class="name"
									value={corr.rename[c.id] ?? c.name}
									onchange={(e) => rename(c, e.currentTarget.value)}
									disabled={r.rejected || !!r.mergedInto}
									aria-label="Name"
								/>
								<button type="button" class="peek" onclick={() => (focus = focus === c.id ? null : c.id)} aria-pressed={focus === c.id}>
									<span class="stats">{c.stats.lines} {c.stats.lines === 1 ? 'line' : 'lines'} · {c.stats.speeches} {c.stats.speeches === 1 ? 'speech' : 'speeches'}</span>
									{#if r.firstLine}<span class="sample">“{r.firstLine}”</span>{/if}
								</button>
								{#if r.suspicious && !r.rejected && !r.mergedInto}
									<span class="hint">Speaks once with an unusual name. Is this really a character?</span>
								{/if}
							</div>
							<label class="merge">
								<span class="visually-hidden">Same person as</span>
								<select value={r.mergedInto ?? ''} onchange={(e) => mergeInto(c, e.currentTarget.value)} disabled={r.rejected}>
									<option value="">{r.mergedInto ? '— not merged —' : 'Same person as…'}</option>
									{#each activeChars.filter((o) => o.id !== c.id) as o (o.id)}
										<option value={o.id}>{nameOf(o.id)}</option>
									{/each}
									{#if r.mergedInto && !activeChars.some((o) => o.id === r.mergedInto)}
										<option value={r.mergedInto}>{nameOf(r.mergedInto)}</option>
									{/if}
								</select>
							</label>
						</li>
					{/each}
				</ul>

				{#if report.skipped.length}
					<details class="skipped">
						<summary>Skipped {report.skipped.length} {report.skipped.length === 1 ? 'line' : 'lines'} before the play began</summary>
						<pre>{report.skipped.slice(0, 80).join('\n')}{report.skipped.length > 80 ? '\n…' : ''}</pre>
					</details>
				{/if}
			</div>

			<div class="preview" aria-label="Preview">
				<div class="preview-head">
					<h2>{focus ? `Where ${nameOf(corr.merge[focus] ?? focus)} speaks` : 'The script, as read'}</h2>
					{#if focus}<button type="button" class="btn" onclick={() => (focus = null)}>Show all</button>{/if}
				</div>
				<div class="pane">
					{#each preview as s, si (si)}
						<p class="p-scene sc">{s.scene}</p>
						{#each s.blocks as b, bi (bi)}
							{#if b.kind === 'sd'}
								<p class="p-sd">{b.t}</p>
							{:else}
								<div class="p-sp">
									<span class="p-who sc">{b.who.map(nameOf).join(' & ')}</span>
									{#each b.items as it, ii (ii)}
										{#if it.kind === 'line'}<span class="p-line">{it.t}</span>{:else}<span class="p-line p-isd">{it.t}</span>{/if}
									{/each}
								</div>
							{/if}
						{/each}
					{:else}
						<p class="p-empty">Nothing to show yet.</p>
					{/each}
					{#if previewTotal > previewLimit}
						<button type="button" class="btn more" onclick={() => (previewLimit += 300)}>Show more ({(previewTotal - previewLimit).toLocaleString()} left)</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<footer>
		<button type="button" class="btn" onclick={oncancel}>Cancel</button>
		<button type="button" class="btn primary" onclick={save} disabled={!final || !final.characters.length || saving}>
			{saving ? 'Saving…' : existing ? 'Save changes' : 'Save & choose a part'}
			<Icon name="arrow-right" />
		</button>
	</footer>
</section>

<style>
	.review {
		max-width: 72rem;
		margin: 1rem auto 0;
		padding: 1.75rem clamp(1rem, 4vw, 2.5rem) 1.25rem;
	}
	header {
		text-align: center;
	}
	.kicker {
		margin: 0;
		color: var(--rubric);
		letter-spacing: 0.2em;
		text-transform: lowercase;
	}
	.title-field input {
		width: 100%;
		max-width: 40rem;
		text-align: center;
		border: 0;
		border-bottom: 1px dashed var(--rule-strong);
		background: transparent;
		font-family: var(--font-display);
		font-size: clamp(2rem, 6vw, 3.2rem);
		line-height: 1.15;
		padding: 0.2rem 0.5rem;
	}
	.title-field input:focus {
		outline: none;
		border-bottom-color: var(--rubric);
	}
	.file {
		margin: 0.3rem 0 0;
		color: var(--ink-faint);
		font-size: 0.98rem;
	}
	.totals {
		display: flex;
		justify-content: center;
		gap: 2.5rem;
		margin: 1.25rem 0;
	}
	.totals div {
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
	}
	.totals dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.7rem;
		line-height: 1;
		font-variant-numeric: lining-nums;
	}
	.totals dt {
		font-family: var(--font-sc);
		color: var(--ink-faint);
		font-size: 0.9rem;
		letter-spacing: 0.1em;
	}
	.layout {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem 0.75rem;
		margin-bottom: 1rem;
	}
	.layout .sc {
		color: var(--ink-soft);
		letter-spacing: 0.06em;
	}
	select {
		border: 1px solid var(--rule-strong);
		border-radius: 8px;
		background: var(--paper);
		padding: 0.3rem 0.5rem;
		font-size: 1rem;
		max-width: 100%;
	}
	.eg {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.82rem;
		color: var(--ink-faint);
	}
	.warn,
	.error {
		max-width: 40rem;
		margin: 0 auto 1rem;
		padding: 0.6rem 1rem;
		border-radius: 8px;
		background: var(--rubric-soft);
		color: var(--rubric);
		text-align: center;
	}

	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		gap: 2rem;
		align-items: start;
	}
	@media (max-width: 900px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}
	h2 {
		font-size: 1.45rem;
		margin-bottom: 0.25rem;
	}
	.help {
		color: var(--ink-soft);
		font-size: 1rem;
		font-style: italic;
		margin-bottom: 0.75rem;
	}
	.cast ul {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--rule);
	}
	.cast li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.25rem 0.75rem;
		align-items: start;
		padding: 0.6rem 0.35rem;
		border-bottom: 1px solid var(--rule);
		border-radius: 4px;
		transition:
			background 0.15s,
			opacity 0.2s;
	}
	.cast li.focused {
		background: var(--rubric-soft);
	}
	.cast li.suspicious {
		box-shadow: inset 3px 0 0 var(--gold);
	}
	.cast li.rejected,
	.cast li.merged {
		opacity: 0.55;
	}
	.cast li.rejected .name {
		text-decoration: line-through;
	}
	input[type='checkbox'] {
		width: 1.05rem;
		height: 1.05rem;
		margin-top: 0.45rem;
		accent-color: var(--rubric);
	}
	.who {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		border: 0;
		border-bottom: 1px solid transparent;
		background: transparent;
		font-family: var(--font-display);
		font-size: 1.3rem;
		padding: 0.05rem 0;
		width: 100%;
	}
	.name:hover:not(:disabled),
	.name:focus {
		border-bottom-color: var(--rule-strong);
		outline: none;
	}
	.peek {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		border: 0;
		background: none;
		padding: 0;
		text-align: left;
		min-width: 0;
	}
	.stats {
		font-size: 0.88rem;
		color: var(--ink-faint);
		font-variant-numeric: lining-nums;
	}
	.sample {
		font-style: italic;
		font-size: 0.95rem;
		color: var(--ink-soft);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	.peek:hover .sample {
		color: var(--rubric);
	}
	.hint {
		font-size: 0.85rem;
		color: var(--gold);
		font-style: italic;
	}
	.merge select {
		font-size: 0.92rem;
		max-width: 11rem;
		margin-top: 0.3rem;
	}
	@media (max-width: 560px) {
		.cast li {
			grid-template-columns: auto minmax(0, 1fr);
		}
		.merge {
			grid-column: 2;
		}
	}
	.skipped {
		margin-top: 1rem;
		color: var(--ink-soft);
	}
	.skipped summary {
		cursor: pointer;
		font-style: italic;
	}
	.skipped pre {
		white-space: pre-wrap;
		font-family: var(--font-body);
		font-size: 0.92rem;
		color: var(--ink-faint);
		max-height: 14rem;
		overflow: auto;
		background: var(--paper-2);
		padding: 0.6rem 0.8rem;
		border-radius: 6px;
	}

	.preview {
		position: sticky;
		top: 1rem;
	}
	.preview-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
	}
	.pane {
		margin-top: 0.5rem;
		max-height: min(75vh, 48rem);
		overflow: auto;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: 10px;
		padding: 0.75rem 1rem 1rem;
		font-size: 0.98rem;
		line-height: 1.4;
	}
	.p-scene {
		margin: 0.9rem 0 0.3rem;
		text-align: center;
		color: var(--ink-soft);
		letter-spacing: 0.1em;
	}
	.p-scene:first-child {
		margin-top: 0.2rem;
	}
	.p-sd {
		margin: 0.25rem 0 0.25rem 1.5rem;
		font-style: italic;
		color: var(--ink-faint);
	}
	.p-sp {
		margin: 0.35rem 0;
		display: flex;
		flex-direction: column;
	}
	.p-who {
		color: var(--rubric);
		font-size: 0.88rem;
		letter-spacing: 0.06em;
	}
	.p-line {
		padding-left: 1rem;
	}
	.p-isd {
		font-style: italic;
		color: var(--ink-faint);
	}
	.p-empty {
		font-style: italic;
		color: var(--ink-faint);
	}
	.more {
		margin: 0.75rem auto 0;
		display: flex;
	}
	footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--rule);
		position: sticky;
		bottom: 0;
		background: var(--paper);
		z-index: 2;
	}
	footer :global(svg) {
		width: 1rem;
		height: 1rem;
	}
</style>
