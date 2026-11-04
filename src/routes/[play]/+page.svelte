<script lang="ts">
	import { resolve } from '$app/paths';
	import Fleuron from '#lib/components/Fleuron.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { GENRE_LABELS } from '#lib/play/catalog-meta.ts';
	import { norm } from '#lib/search.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Sort = 'cast' | 'size' | 'name';
	let sort = $state<Sort>('cast');
	let showMinor = $state(false);
	let filter = $state('');

	const maxLines = $derived(Math.max(...data.characters.map((c) => c.stats.lines)));
	const minorCount = $derived(data.characters.filter((c) => c.minor).length);

	const shown = $derived.by(() => {
		const q = norm(filter);
		let list = data.characters.filter((c) => (showMinor || !c.minor || q) && (!q || norm(`${c.name} ${c.desc ?? ''}`).includes(q)));
		if (sort === 'size') list = [...list].sort((a, b) => b.stats.lines - a.stats.lines);
		else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
		return list;
	});

	// Group scenes by act for the presence strip.
	const acts = $derived.by(() => {
		const out: { act: string; idx: number[] }[] = [];
		data.scenes.forEach((s, i) => {
			const key = s.act ? String(s.act) : s.ref;
			const last = out[out.length - 1];
			if (last && last.act === key) last.idx.push(i);
			else out.push({ act: key, idx: [i] });
		});
		return out;
	});

	const genreWord = $derived(GENRE_LABELS[data.play.genre].title.replace(/s$/, '').replace(/ie$/, 'y'));
	const article = $derived(/^[aeiou]/i.test(genreWord) ? 'An' : 'A');
</script>

<svelte:head>
	<title>{data.play.title} — Choose a part · Cue Script</title>
	<meta name="description" content="Cue scripts for every part in {data.play.title}." />
</svelte:head>

<article class="playbill sheet">
	<nav class="crumbs no-print"><a href={resolve('/')}><Icon name="arrow-left" /> All plays</a></nav>

	<header>
		<p class="genre sc">{article} {genreWord.toLowerCase()} by William Shakespeare</p>
		<h1>{data.play.title}</h1>
		<Fleuron width="14rem" />
		<h2 class="dp">Dramatis Personæ</h2>
		<p class="instruct">Choose the part you are to play.</p>
	</header>

	<div class="controls">
		<label class="filter">
			<Icon name="search" />
			<span class="visually-hidden">Filter characters</span>
			<input type="search" bind:value={filter} placeholder="Filter the company…" />
		</label>
		<div class="segmented" role="group" aria-label="Order">
			<button type="button" aria-pressed={sort === 'cast'} onclick={() => (sort = 'cast')}>Cast list</button>
			<button type="button" aria-pressed={sort === 'size'} onclick={() => (sort = 'size')}>Largest</button>
			<button type="button" aria-pressed={sort === 'name'} onclick={() => (sort = 'name')}>A–Z</button>
		</div>
		{#if minorCount}
			<label class="toggle">
				<input type="checkbox" bind:checked={showMinor} />
				<span>Include {minorCount} lesser parts <em>(Servants, Lords…)</em></span>
			</label>
		{/if}
	</div>

	<ol class="cast">
		{#each shown as c (c.slug)}
			<li>
				<a href={resolve('/[play]/[character]', { play: data.play.slug, character: c.slug })}>
					<span class="who">
						<span class="name">{c.name}</span>
						{#if c.desc}<span class="desc">{c.desc}</span>{/if}
					</span>
					<span class="size" aria-label="{c.stats.lines} lines in {c.stats.scenes} scenes">
						<span class="lines"><b>{c.stats.lines.toLocaleString()}</b> {c.stats.lines === 1 ? 'line' : 'lines'}</span>
						<span class="bar"><span style:width="{Math.max(2, (c.stats.lines / maxLines) * 100)}%"></span></span>
					</span>
					<span class="presence" aria-hidden="true" title="Scenes on stage">
						{#each acts as a (a.act)}
							<span class="act">
								{#each a.idx as i (i)}
									<span class="dot" class:on={c.presence.includes(i)} title={data.scenes[i].label}></span>
								{/each}
							</span>
						{/each}
					</span>
				</a>
			</li>
		{:else}
			<li class="none">No one by that name in this company.</li>
		{/each}
	</ol>
	<p class="legend no-print">
		<span class="dot on"></span> each mark is a scene, grouped by act. Filled marks show where the character is on stage.
	</p>
</article>

<style>
	.playbill {
		max-width: 56rem;
		margin: 1rem auto 0;
		padding: 1.5rem clamp(1.1rem, 5vw, 3.5rem) 2.5rem;
	}
	.crumbs a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-sc);
		letter-spacing: 0.05em;
		color: var(--ink-soft);
		text-decoration: none;
	}
	.crumbs :global(svg) {
		width: 1rem;
		height: 1rem;
	}
	header {
		text-align: center;
		margin: 1.25rem 0 2rem;
	}
	.genre {
		color: var(--ink-faint);
		letter-spacing: 0.14em;
		margin: 0 0 0.5rem;
	}
	h1 {
		font-size: clamp(2.6rem, 8vw, 4.6rem);
		margin-bottom: 1rem;
		text-wrap: balance;
	}
	.dp {
		font-family: var(--font-sc);
		font-size: 1.4rem;
		letter-spacing: 0.2em;
		margin-top: 1rem;
		color: var(--rubric);
	}
	.instruct {
		font-style: italic;
		color: var(--ink-soft);
		margin: 0.25rem 0 0;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.5rem;
	}
	.filter {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid var(--rule-strong);
		border-radius: 999px;
		padding: 0 0.85rem;
		background: var(--paper);
		color: var(--ink-faint);
		flex: 1 1 14rem;
		max-width: 20rem;
	}
	.filter :global(svg) {
		width: 1rem;
		height: 1rem;
	}
	.filter input {
		border: 0;
		background: transparent;
		outline: none;
		padding: 0.4rem 0;
		width: 100%;
		font-size: 1.05rem;
	}
	.filter input::placeholder {
		font-style: italic;
		color: var(--ink-faint);
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 1rem;
		color: var(--ink-soft);
		cursor: pointer;
	}
	.toggle input {
		accent-color: var(--rubric);
		width: 1rem;
		height: 1rem;
	}

	.cast {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--rule);
	}
	.cast li {
		border-bottom: 1px solid var(--rule);
	}
	.cast a {
		display: grid;
		grid-template-columns: 1fr 9rem;
		grid-template-areas: 'who size' 'presence presence';
		gap: 0.3rem 1.5rem;
		align-items: center;
		padding: 0.85rem 0.75rem;
		text-decoration: none;
		color: var(--ink);
		border-radius: 4px;
		transition: background 0.15s;
	}
	.cast a:hover {
		background: var(--ink-ghost);
	}
	.cast a:hover .name {
		color: var(--rubric);
	}
	.who {
		grid-area: who;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.75rem;
		min-width: 0;
	}
	.name {
		font-family: var(--font-display);
		font-size: 1.45rem;
		line-height: 1.2;
		transition: color 0.15s;
	}
	.desc {
		font-style: italic;
		color: var(--ink-soft);
		font-size: 1.02rem;
	}
	.size {
		grid-area: size;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
	}
	.lines {
		font-size: 0.95rem;
		color: var(--ink-faint);
		font-variant-numeric: lining-nums tabular-nums;
	}
	.lines b {
		font-weight: 500;
		color: var(--ink);
	}
	.bar {
		width: 100%;
		height: 3px;
		background: var(--ink-ghost);
		border-radius: 2px;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--rubric);
		border-radius: 2px;
		transform-origin: left;
		animation: grow 0.8s var(--ease) both;
	}
	@keyframes grow {
		from {
			transform: scaleX(0);
		}
	}
	.presence {
		grid-area: presence;
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.55rem;
	}
	.act {
		display: inline-flex;
		gap: 2px;
	}
	.dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 1.5px;
		border: 1px solid var(--rule-strong);
		opacity: 0.55;
	}
	.dot.on {
		background: var(--ink);
		border-color: var(--ink);
		opacity: 1;
	}
	.none {
		padding: 2rem;
		text-align: center;
		font-style: italic;
		color: var(--ink-soft);
	}
	.legend {
		margin: 1rem 0 0;
		color: var(--ink-faint);
		font-size: 0.95rem;
		font-style: italic;
		text-align: center;
	}
	.legend .dot {
		vertical-align: middle;
		margin-right: 0.3rem;
	}
	@media (max-width: 560px) {
		.cast a {
			grid-template-columns: 1fr 5.5rem;
			gap: 0.3rem 0.75rem;
			padding-inline: 0.25rem;
		}
		.name {
			font-size: 1.3rem;
		}
	}
</style>
