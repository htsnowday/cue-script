<script lang="ts">
	import type { PartSpeech } from '#lib/play/part.ts';
	import { settings } from '#lib/settings.svelte.ts';

	let {
		speech,
		rehearse = false,
		revealed = Infinity,
		onreveal,
		current = false,
		tools = true
	}: {
		speech: PartSpeech;
		rehearse?: boolean;
		revealed?: number;
		onreveal?: (n: number) => void;
		current?: boolean;
		tools?: boolean;
	} = $props();

	type Tok = { t: string; sd?: boolean; w?: number };
	type Row =
		| {
				kind: 'line';
				toks: Tok[];
				segs: { t: string; sd?: boolean }[];
				n?: string;
				part?: string;
				song?: boolean;
				verse?: boolean;
				first: number;
				last: number;
		  }
		| { kind: 'sd' | 'label'; t: string };

	const layout = $derived.by(() => {
		let w = 0;
		const rows: Row[] = speech.items.map((it) => {
			if (it.kind !== 'line') return { kind: it.kind, t: it.t };
			const segs = it.segs ?? [{ t: it.t }];
			const first = w;
			const toks: Tok[] = [];
			for (const s of segs) {
				if (s.sd) toks.push({ t: s.t, sd: true });
				else for (const word of s.t.split(/\s+/).filter(Boolean)) toks.push({ t: word, w: w++ });
			}
			return { kind: 'line', toks, segs, n: it.n, part: it.part, song: it.song, verse: it.verse, first, last: w - 1 };
		});
		return { rows, total: w };
	});

	/** "’Tis" → ["’T", "is"]: leading punctuation plus the first letter, then the rest. */
	function splitFirst(t: string): [string, string] {
		const head = t.match(/^[^\p{L}\p{N}]*[\p{L}\p{N}]?/u)?.[0] ?? '';
		return [head, t.slice(head.length)];
	}

	const hidden = $derived(rehearse && revealed < layout.total);
	const lineNo = (n?: string) => {
		const last = Number(n?.split('.').pop());
		return Number.isFinite(last) && last % 5 === 0 ? last : null;
	};

	function revealLine() {
		const row = layout.rows.find((r) => r.kind === 'line' && r.last >= revealed);
		onreveal?.(row && row.kind === 'line' ? row.last + 1 : layout.total);
	}
	export function step(kind: 'word' | 'line' | 'all' | 'none') {
		if (kind === 'word') onreveal?.(Math.min(layout.total, revealed + 1));
		else if (kind === 'line') revealLine();
		else if (kind === 'all') onreveal?.(layout.total);
		else onreveal?.(0);
	}
</script>

<div
	class="speech"
	class:rehearse
	class:hidden
	class:current
	class:letters={settings.hint === 'letters'}
	id="speech-{speech.index}"
	data-speech={speech.index}
>
	{#if speech.with?.length}
		<p class="with sc">together with {speech.with.join(' & ')}</p>
	{/if}

	{#if rehearse}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="body"
			role="button"
			tabindex="0"
			aria-label={hidden ? 'Reveal the next line' : 'Speech revealed'}
			onclick={() => hidden && revealLine()}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					if (e.shiftKey) step('all');
					else revealLine();
				} else if (e.key.toLowerCase() === 'w') step('word');
			}}
		>
			{@render rows()}
		</div>
		{#if tools}
		<div class="tools no-print" role="group" aria-label="Reveal">
			{#if hidden}
				<button type="button" onclick={() => step('word')} title="Reveal one word (W)">word</button>
				<button type="button" onclick={() => step('line')} title="Reveal one line (Enter)">line</button>
				<button type="button" onclick={() => step('all')} title="Reveal all (Shift+Enter)">all</button>
			{:else}
				<button type="button" onclick={() => step('none')} title="Hide again">hide</button>
			{/if}
		</div>
		{/if}
	{:else}
		<div class="body">{@render rows()}</div>
	{/if}
</div>

{#snippet rows()}
	{#each layout.rows as row, ri (ri)}
		{#if row.kind === 'line'}
			<p class="line" class:prose={!row.verse} class:song={row.song} class:part-f={row.part === 'F'} class:part-m={row.part === 'M'}>
				{#if settings.lineNumbers && lineNo(row.n)}<span class="num" aria-hidden="true">{lineNo(row.n)}</span>{/if}
				{#if !rehearse}
					{#each row.segs as seg, si (si)}{#if seg.sd}<span class="isd">{seg.t}</span>{' '}{:else}{seg.t}{' '}{/if}{/each}
				{:else}
				{#each row.toks as tok, ti (ti)}
					{#if tok.sd}
						<span class="isd">{tok.t}</span>{' '}
					{:else if rehearse && tok.w! >= revealed}
						{@const [f, r] = splitFirst(tok.t)}
						<span class="w masked" class:next={tok.w === revealed}><span class="f">{f}</span><span class="r">{r}</span></span>{' '}
					{:else}
						<span class="w">{tok.t}</span>{' '}
					{/if}
				{/each}
				{/if}
			</p>
		{:else if row.kind === 'sd'}
			<p class="sd">{row.t}</p>
		{:else}
			<p class="label sc">{row.t}</p>
		{/if}
	{/each}
{/snippet}

<style>
	.speech {
		position: relative;
		margin: 0 0 0.25rem;
		border-radius: 6px;
		transition: background 0.3s var(--ease);
	}
	.speech.current {
		background: var(--rubric-soft);
		box-shadow: 0 0 0 0.6rem var(--rubric-soft);
	}
	.with {
		margin: 0 0 0.15rem;
		font-size: 0.85rem;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
	}
	.body {
		outline: none;
	}
	.rehearse .body {
		cursor: default;
	}
	.rehearse.hidden .body {
		cursor: pointer;
	}
	.rehearse .body:focus-visible {
		box-shadow: 0 0 0 2px var(--focus);
		border-radius: 3px;
	}
	/* Wrapped lines hang, so verse stays legible on a phone. */
	.line {
		position: relative;
		margin: 0;
		padding-left: 1.25em;
		text-indent: -1.25em;
		text-wrap: pretty;
		hanging-punctuation: first;
	}
	.line.part-m {
		text-indent: 1.25em;
	}
	.line.part-f {
		text-indent: 3.75em;
	}
	.line.song {
		font-style: italic;
		padding-left: 2.75em;
	}
	.num {
		position: absolute;
		text-indent: 0;
		left: -3rem;
		width: 2.2rem;
		text-align: right;
		font-size: 0.72rem;
		color: var(--ink-faint);
		font-variant-numeric: lining-nums tabular-nums;
		top: 0.45em;
		user-select: none;
	}
	.isd,
	.sd {
		font-style: italic;
		color: var(--ink-faint);
	}
	.isd {
		font-size: 0.95em;
	}
	.sd {
		margin: 0.1rem 0 0.1rem 2em;
		font-size: 0.98rem;
	}
	.label {
		margin: 0.4rem 0 0.1rem 1.5em;
		color: var(--ink-faint);
		font-size: 0.9rem;
	}

	/* Masked words: an ink smudge the length of the word. */
	.w.masked {
		border-radius: 0.6em 0.45em 0.55em 0.4em;
		background: var(--smudge);
		color: transparent;
		transition:
			color 0.35s var(--ease),
			background 0.35s var(--ease);
		-webkit-box-decoration-break: clone;
		box-decoration-break: clone;
	}
	.w.masked .f,
	.w.masked .r {
		color: transparent;
	}
	.letters .w.masked .f {
		color: var(--ink-soft);
	}
	.w.masked.next {
		background: color-mix(in srgb, var(--rubric) 22%, transparent);
	}
	.w:not(.masked) {
		animation: ink 0.5s var(--ease);
	}
	@keyframes ink {
		from {
			color: var(--rubric);
			filter: blur(1.5px);
		}
	}
	.speech:not(.rehearse) .w {
		animation: none;
	}

	.tools {
		position: absolute;
		top: 0;
		right: -0.5rem;
		transform: translateX(100%);
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.speech:hover .tools,
	.speech:focus-within .tools {
		opacity: 1;
	}
	.tools button {
		border: 1px solid var(--rule);
		background: var(--paper);
		border-radius: 999px;
		font-family: var(--font-sc);
		font-size: 0.8rem;
		letter-spacing: 0.05em;
		padding: 0.05rem 0.55rem;
		color: var(--ink-soft);
	}
	.tools button:hover {
		border-color: var(--rubric);
		color: var(--rubric);
	}
	@media (max-width: 860px), (hover: none) {
		.tools {
			position: static;
			transform: none;
			flex-direction: row;
			justify-content: flex-end;
			opacity: 1;
			margin-top: 0.3rem;
		}
	}
	@media (max-width: 640px) {
		.num {
			display: none;
		}
		.line.part-f {
			text-indent: 2em;
		}
	}

	@media print {
		.w.masked,
		.w.masked .f,
		.w.masked .r {
			color: inherit !important;
			background: none !important;
		}
		.speech.current {
			background: none;
			box-shadow: none;
		}
		.speech {
			break-inside: avoid;
		}
	}
</style>
