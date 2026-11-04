<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { CatalogPlay } from '#lib/play/types.ts';
	import { search, type SearchResult } from '#lib/search.ts';
	import Icon from './Icon.svelte';

	let {
		variant = 'hero',
		autofocus = false,
		onnavigate
	}: { variant?: 'hero' | 'compact'; autofocus?: boolean; onnavigate?: () => void } = $props();

	const SUGGESTIONS = ['Hamlet', 'Lady Macbeth', 'Puck', 'Beatrice', 'Falstaff', 'Dion', 'Viola', 'Iago'];

	let catalog = $state<CatalogPlay[] | null>(null);
	let query = $state('');
	let active = $state(0);
	let open = $state(false);
	let input: HTMLInputElement;
	const uid = `search-${Math.random().toString(36).slice(2, 8)}`;

	const results: SearchResult[] = $derived(catalog ? search(catalog, query, variant === 'hero' ? 9 : 10) : []);

	async function ensureCatalog() {
		if (!catalog) catalog = (await import('#lib/data/catalog.json')).default as CatalogPlay[];
	}

	onMount(() => {
		if (autofocus) {
			input.focus();
			ensureCatalog();
		}
	});

	$effect(() => {
		void query;
		active = 0;
	});

	function href(r: SearchResult) {
		return r.kind === 'play'
			? resolve('/[play]', { play: r.play.slug })
			: resolve('/[play]/[character]', { play: r.play.slug, character: r.character!.slug });
	}

	function choose(r: SearchResult | undefined) {
		if (!r) return;
		open = false;
		onnavigate?.();
		goto(href(r));
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			open = true;
			active = Math.min(results.length - 1, active + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(0, active - 1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			choose(results[active]);
		} else if (e.key === 'Escape' && open && query) {
			e.stopPropagation();
			query = '';
		}
	}

	function suggest(s: string) {
		query = s;
		open = true;
		input.focus();
	}

	const showPanel = $derived(open && (results.length > 0 || query.trim().length > 0 || variant === 'compact'));
</script>

<div class="search {variant}" class:open={showPanel}>
	<label class="field">
		<span class="visually-hidden">Search for a character or play</span>
		<Icon name="search" />
		<input
			bind:this={input}
			bind:value={query}
			type="search"
			role="combobox"
			aria-expanded={showPanel}
			aria-controls="{uid}-list"
			aria-activedescendant={results[active] ? `${uid}-${active}` : undefined}
			aria-autocomplete="list"
			autocomplete="off"
			spellcheck="false"
			placeholder={variant === 'hero' ? 'Find a part — try “Dion” or “Lady Macbeth”' : 'Search characters & plays…'}
			onfocus={() => {
				open = true;
				ensureCatalog();
			}}
			onblur={() => setTimeout(() => (open = false), 150)}
			{onkeydown}
		/>
		{#if variant === 'hero'}<kbd class="hint" aria-hidden="true">/</kbd>{/if}
	</label>

	{#if showPanel}
		<div class="panel">
			{#if results.length}
				<ul id="{uid}-list" role="listbox" aria-label="Matches">
					{#each results as r, i (r.kind + r.play.slug + (r.character?.slug ?? ''))}
						<li
							id="{uid}-{i}"
							role="option"
							aria-selected={i === active}
							class:active={i === active}
							onmousedown={(e) => {
								e.preventDefault();
								choose(r);
							}}
							onmousemove={() => (active = i)}
						>
							{#if r.kind === 'character'}
								<span class="name">{r.character!.name}</span>
								<span class="where">in <em>{r.play.title}</em></span>
								<span class="meta">{r.character!.lines.toLocaleString()} lines</span>
							{:else}
								<span class="name play"><em>{r.play.title}</em></span>
								<span class="where">the whole play</span>
								<span class="meta">{r.play.characters.length} parts</span>
							{/if}
						</li>
					{/each}
				</ul>
			{:else if query.trim()}
				<p class="empty">
					{#if !catalog}Unrolling the scrolls…{:else}No such player in our company. <span>Try another spelling?</span>{/if}
				</p>
			{:else}
				<div class="suggest">
					<span class="sc">Perhaps</span>
					{#each SUGGESTIONS as s (s)}
						<button type="button" onmousedown={(e) => { e.preventDefault(); suggest(s); }}>{s}</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.search {
		position: relative;
		width: 100%;
	}
	.field {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: 999px;
		padding: 0 1.1rem;
		box-shadow: var(--shadow-sm);
		transition:
			box-shadow 0.25s var(--ease),
			border-color 0.2s;
		color: var(--ink-faint);
	}
	.field:focus-within {
		border-color: var(--ink);
		box-shadow: var(--shadow-md);
		color: var(--ink);
	}
	.field :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
	}
	input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		outline: none;
		padding: 0.85rem 0;
		font-size: 1.2rem;
		color: var(--ink);
	}
	input::placeholder {
		color: var(--ink-faint);
		font-style: italic;
	}
	input::-webkit-search-cancel-button {
		display: none;
	}
	.hero input {
		font-size: 1.35rem;
		padding: 1.05rem 0;
	}
	.compact .field {
		box-shadow: none;
	}
	kbd.hint {
		font-family: var(--font-body);
		font-size: 0.85rem;
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 0.05rem 0.45rem;
		color: var(--ink-faint);
	}

	.panel {
		position: absolute;
		z-index: 30;
		left: 0;
		right: 0;
		top: calc(100% + 0.5rem);
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: 14px;
		box-shadow: var(--shadow-lg);
		overflow: hidden;
		animation: drop 0.22s var(--ease);
		text-align: left;
	}
	.compact .panel {
		position: static;
		margin-top: 0.75rem;
		box-shadow: none;
		border: 0;
		background: transparent;
		animation: none;
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0.4rem;
		max-height: min(60vh, 28rem);
		overflow: auto;
	}
	li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.55rem 0.85rem;
		border-radius: 9px;
		cursor: pointer;
	}
	li.active {
		background: var(--ink-ghost);
	}
	li.active .name {
		color: var(--rubric);
	}
	.name {
		font-family: var(--font-display);
		font-size: 1.25rem;
		line-height: 1.2;
	}
	.where {
		color: var(--ink-soft);
		font-size: 1rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.meta {
		color: var(--ink-faint);
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums lining-nums;
	}
	.empty {
		margin: 0;
		padding: 1rem 1.25rem;
		font-style: italic;
		color: var(--ink-soft);
	}
	.empty span {
		color: var(--ink-faint);
	}
	.suggest {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		padding: 0.85rem 1rem;
	}
	.suggest .sc {
		color: var(--ink-faint);
		margin-right: 0.3rem;
	}
	.suggest button {
		border: 1px solid var(--rule);
		background: transparent;
		border-radius: 999px;
		padding: 0.15rem 0.7rem;
		font-style: italic;
		font-size: 1rem;
	}
	.suggest button:hover {
		border-color: var(--rubric);
		color: var(--rubric);
	}
	@media (max-width: 560px) {
		li {
			grid-template-columns: 1fr auto;
		}
		.where {
			grid-column: 1;
			grid-row: 2;
			font-size: 0.92rem;
		}
		.meta {
			grid-row: 1 / span 2;
		}
		.hero input {
			font-size: 1.1rem;
		}
		kbd.hint {
			display: none;
		}
	}
</style>
