<script lang="ts">
	import { resolve } from '$app/paths';
	import Fleuron from '#lib/components/Fleuron.svelte';
	import Search from '#lib/components/Search.svelte';
	import { GENRE_LABELS, GENRE_ORDER } from '#lib/play/catalog-meta.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const shelves = $derived(
		GENRE_ORDER.map((g) => ({ genre: g, ...GENRE_LABELS[g], plays: data.plays.filter((p) => p.genre === g) })).filter(
			(s) => s.plays.length
		)
	);
</script>

<svelte:head>
	<title>Cue Script — Shakespeare’s parts, as the players had them</title>
</svelte:head>

<section class="hero">
	<Fleuron width="9rem" />
	<p class="kicker sc">Every part in Shakespeare</p>
	<h1>as the players <span class="rubric">had</span> it.</h1>
	<p class="lede">
		Elizabethan actors never saw the whole play. They learned from a <em>part</em>: their own lines, each one
		waiting on a few words of <em>cue</em>. Choose a character and rehearse just like that.
	</p>

	<div class="search-wrap">
		<Search variant="hero" />
	</div>

	<figure class="epigraph">
		<blockquote>When my cue comes, call me, and I will answer.</blockquote>
		<figcaption>— Bottom, <cite>A Midsummer Night’s Dream</cite>, 4.1</figcaption>
	</figure>

	<dl class="tally">
		<div><dt>plays</dt><dd>{data.totals.plays}</dd></div>
		<div><dt>parts</dt><dd>{data.totals.parts.toLocaleString()}</dd></div>
		<div><dt>lines</dt><dd>{data.totals.lines.toLocaleString()}</dd></div>
	</dl>
</section>

<section class="how" aria-label="How it works">
	<ol>
		<li>
			<span class="num">i.</span>
			<h3>Choose your part</h3>
			<p>Search above, or browse the shelves below and open a play’s <em>dramatis personæ</em>.</p>
		</li>
		<li>
			<span class="num">ii.</span>
			<h3>Read your cues</h3>
			<p>Only your lines, each with the last words of the speech before. Make the cue as long as you like.</p>
		</li>
		<li>
			<span class="num">iii.</span>
			<h3>Rehearse</h3>
			<p>Hide your lines and reveal them a word at a time, or run lines with a voice that reads your cues.</p>
		</li>
	</ol>
</section>

<section class="byo" aria-labelledby="byo-title">
	<a class="byo-card sheet" href={resolve('/my')}>
		<span class="byo-text">
			<span class="sc byo-kicker">New</span>
			<span id="byo-title" class="byo-title">Bring your own script</span>
			<span class="byo-blurb">
				Upload your production’s cut, a classic, or a new play (Word, PDF or text) and get a cue script for every
				part. Then send it to your whole cast.
			</span>
		</span>
		<span class="byo-go" aria-hidden="true">→</span>
	</a>
</section>

{#each shelves as shelf (shelf.genre)}
	<section class="shelf" aria-labelledby="shelf-{shelf.genre}">
		<header>
			<h2 id="shelf-{shelf.genre}">{shelf.title}</h2>
			<p>{shelf.blurb}</p>
		</header>
		<ul class="grid">
			{#each shelf.plays as play, i (play.slug)}
				<li style:--i={i}>
					<a class="quarto sheet" href={resolve('/[play]', { play: play.slug })}>
						<span class="frame">
							<span class="genre sc">{shelf.title.replace(/s$/, '').replace(/ie$/, 'y')}</span>
							<span class="title">{play.title}</span>
							<span class="orn" aria-hidden="true">❧</span>
							<span class="leads">{play.leads.join(' · ')}</span>
							<span class="count sc">{play.parts} parts</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/each}

<style>
	.hero {
		text-align: center;
		max-width: 46rem;
		margin: 0 auto;
		padding: clamp(2rem, 7vw, 5rem) 1.25rem 2.5rem;
	}
	.kicker {
		margin: 1.25rem 0 0.25rem;
		color: var(--ink-soft);
		letter-spacing: 0.22em;
		font-size: 1.05rem;
		text-transform: lowercase;
	}
	h1 {
		font-size: clamp(2.9rem, 9vw, 5.4rem);
		line-height: 1;
		letter-spacing: -0.01em;
		margin-bottom: 1.25rem;
		font-style: italic;
	}
	.rubric {
		color: var(--rubric);
	}
	.lede {
		font-size: 1.25rem;
		color: var(--ink-soft);
		max-width: 36rem;
		margin: 0 auto 2rem;
		text-wrap: pretty;
	}
	.search-wrap {
		max-width: 36rem;
		margin: 0 auto;
	}
	.epigraph {
		margin: 2.5rem auto 0;
	}
	blockquote {
		margin: 0;
		font-family: var(--font-display);
		font-style: italic;
		font-size: 1.35rem;
		color: var(--ink);
	}
	figcaption {
		color: var(--ink-faint);
		font-size: 1rem;
		margin-top: 0.25rem;
	}
	.tally {
		display: flex;
		justify-content: center;
		gap: clamp(1.5rem, 6vw, 3.5rem);
		margin: 2.25rem 0 0;
	}
	.tally div {
		display: flex;
		flex-direction: column-reverse;
	}
	.tally dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.9rem;
		line-height: 1;
		font-variant-numeric: lining-nums;
	}
	.tally dt {
		font-family: var(--font-sc);
		color: var(--ink-faint);
		letter-spacing: 0.12em;
		font-size: 0.95rem;
	}

	.how {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1rem 1.25rem 2rem;
	}
	.how ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 1.5rem 2.5rem;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: 1.75rem 0;
	}
	.how li {
		position: relative;
		padding-left: 2.4rem;
	}
	.num {
		position: absolute;
		left: 0;
		top: -0.1rem;
		font-family: var(--font-display);
		font-style: italic;
		color: var(--rubric);
		font-size: 1.5rem;
	}
	.how h3 {
		font-size: 1.35rem;
		margin-bottom: 0.3rem;
	}
	.how p {
		margin: 0;
		color: var(--ink-soft);
		font-size: 1.05rem;
	}

	.byo {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1rem 1.25rem 0;
	}
	.byo-card {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 1.4rem 1.75rem;
		text-decoration: none;
		color: var(--ink);
		border-left: 3px solid var(--rubric);
		transition:
			transform 0.3s var(--ease),
			box-shadow 0.3s var(--ease);
	}
	.byo-card:hover {
		color: var(--ink);
		transform: translateY(-3px);
		box-shadow: var(--shadow-lg);
	}
	.byo-text {
		display: flex;
		flex-direction: column;
		flex: 1;
	}
	.byo-kicker {
		color: var(--rubric);
		letter-spacing: 0.18em;
		text-transform: lowercase;
		font-size: 0.9rem;
	}
	.byo-title {
		font-family: var(--font-display);
		font-size: 1.9rem;
		line-height: 1.1;
		margin: 0.1rem 0 0.35rem;
	}
	.byo-card:hover .byo-title {
		color: var(--rubric);
	}
	.byo-blurb {
		color: var(--ink-soft);
		font-size: 1.05rem;
	}
	.byo-go {
		font-family: var(--font-display);
		font-size: 2.4rem;
		color: var(--rubric);
		transition: transform 0.3s var(--ease);
	}
	.byo-card:hover .byo-go {
		transform: translateX(6px);
	}
	.shelf {
		max-width: 76rem;
		margin: 0 auto;
		padding: 2.5rem clamp(1rem, 4vw, 2.5rem) 1rem;
	}
	.shelf header {
		display: flex;
		align-items: baseline;
		gap: 1.25rem;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}
	.shelf h2 {
		font-size: 2.1rem;
	}
	.shelf header p {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
		gap: 1.25rem;
	}
	.grid li {
		animation: settle 0.6s var(--ease) both;
		animation-delay: calc(var(--i) * 40ms);
	}
	@keyframes settle {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
	.quarto {
		display: block;
		height: 100%;
		padding: 0.55rem;
		text-decoration: none;
		color: var(--ink);
		transition:
			transform 0.35s var(--ease),
			box-shadow 0.35s var(--ease);
	}
	.quarto:hover {
		color: var(--ink);
		transform: translateY(-4px) rotate(-0.6deg);
		box-shadow: var(--shadow-lg);
	}
	.grid li:nth-child(even) .quarto:hover {
		transform: translateY(-4px) rotate(0.6deg);
	}
	.frame {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		height: 100%;
		min-height: 12.5rem;
		padding: 1.1rem 0.9rem 0.9rem;
		border: 1px solid var(--rule-strong);
		outline: 1px solid var(--rule);
		outline-offset: -5px;
	}
	.genre {
		color: var(--ink-faint);
		font-size: 0.85rem;
		letter-spacing: 0.18em;
		text-transform: lowercase;
	}
	.title {
		font-family: var(--font-display);
		font-size: 1.55rem;
		line-height: 1.08;
		margin: 0.6rem 0 0.35rem;
		text-wrap: balance;
	}
	.quarto:hover .title {
		color: var(--rubric);
	}
	.orn {
		color: var(--rubric);
		font-size: 1.1rem;
		margin-bottom: 0.4rem;
	}
	.leads {
		font-style: italic;
		color: var(--ink-soft);
		font-size: 0.98rem;
		line-height: 1.35;
		text-wrap: balance;
	}
	.count {
		margin-top: auto;
		padding-top: 0.75rem;
		color: var(--ink-faint);
		font-size: 0.88rem;
		letter-spacing: 0.1em;
	}
</style>
