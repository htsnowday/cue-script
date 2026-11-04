<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import Icon from '#lib/components/Icon.svelte';
	import Cue from '#lib/components/part/Cue.svelte';
	import RunLines from '#lib/components/part/RunLines.svelte';
	import Speech from '#lib/components/part/Speech.svelte';
	import { runSteps } from '#lib/play/part.ts';
	import { CUE_STOPS, cueLabel, settings } from '#lib/settings.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const part = $derived(data.part);
	const c = $derived(part.character);
	const steps = $derived(runSteps(part));

	let mode = $state<'read' | 'rehearse'>('read');
	let running = $state(false);
	let runFrom = $state(0);
	let highlight = $state<number | null>(null);

	// Rehearsal reveal state: default for every speech, plus per-speech overrides.
	let defaultReveal = $state(0);
	const reveals = new SvelteMap<number, number>();
	const revealedFor = (i: number) => reveals.get(i) ?? defaultReveal;

	// Reset when moving between parts.
	$effect(() => {
		void part.character.id;
		reveals.clear();
		defaultReveal = 0;
		running = false;
	});

	const cueIndex = $derived(Math.max(0, CUE_STOPS.indexOf(settings.cueLength)));
	function setCue(e: Event) {
		settings.cueLength = CUE_STOPS[Number((e.currentTarget as HTMLInputElement).value)];
		settings.save();
	}

	function setMode(m: 'read' | 'rehearse') {
		mode = m;
		if (m === 'rehearse') {
			reveals.clear();
			defaultReveal = 0;
		}
	}
	function revealAll(on: boolean) {
		reveals.clear();
		defaultReveal = on ? Infinity : 0;
	}

	function run(fromSceneIndex?: number) {
		runFrom = fromSceneIndex === undefined ? 0 : Math.max(0, steps.findIndex((s) => s.scene.sceneIndex === fromSceneIndex));
		running = true;
	}
	async function endRun(at: number) {
		running = false;
		const idx = steps[at]?.speech.index;
		if (idx === undefined) return;
		highlight = idx;
		await tick();
		document.getElementById(`speech-${idx}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		setTimeout(() => (highlight = null), 2200);
	}

	const initial = $derived(c.name.charAt(0));
	const rest = $derived(c.name.slice(1));
	const sceneWord = (n: number) => (n === 1 ? 'scene' : 'scenes');
</script>

<svelte:head>
	<title>{c.name} — {part.play.title} · Cue Script</title>
	<meta name="description" content="The cue script for {c.name} in {part.play.title}: {c.stats.lines} lines across {c.stats.scenes} scenes." />
</svelte:head>

<div class="page">
	<nav class="crumbs no-print">
		<a href={resolve('/[play]', { play: part.play.slug })}><Icon name="arrow-left" /> {part.play.title}</a>
	</nav>

	<!-- The prompter's desk -->
	<div class="desk no-print" role="toolbar" aria-label="Cue script tools">
		<div class="group">
			<div class="segmented" role="group" aria-label="Mode">
				<button type="button" aria-pressed={mode === 'read'} onclick={() => setMode('read')}>
					<Icon name="scroll" /> Read
				</button>
				<button type="button" aria-pressed={mode === 'rehearse'} onclick={() => setMode('rehearse')}>
					<Icon name="mask" /> Rehearse
				</button>
			</div>
			<button class="btn primary run" type="button" onclick={() => run()} disabled={!steps.length}>
				<Icon name="play" /> Run lines
			</button>
		</div>

		<label class="cue-ctl">
			<span class="sc">Cue</span>
			<input type="range" min="0" max={CUE_STOPS.length - 1} step="1" value={cueIndex} oninput={setCue} aria-valuetext={cueLabel(settings.cueLength)} />
			<output>{cueLabel(settings.cueLength)}</output>
		</label>

		<div class="group end">
			<button class="icon-btn" type="button" onclick={() => window.print()} aria-label="Print these sides" title="Print these sides">
				<Icon name="print" />
			</button>
		</div>
	</div>

	{#if mode === 'rehearse'}
		<div class="coach no-print">
			<p>
				Your lines are inked over. Tap a speech to reveal it a line at a time, or use <b>word</b> · <b>line</b> ·
				<b>all</b>. Say it aloud first; peeking is allowed.
			</p>
			<div class="coach-tools">
				<button
					class="btn"
					type="button"
					aria-pressed={settings.hint === 'letters'}
					onclick={() => {
						settings.hint = settings.hint === 'letters' ? 'none' : 'letters';
						settings.save();
					}}
					title="Show the first letter of each hidden word">First letters</button
				>
				{#if defaultReveal === 0}
					<button class="btn" type="button" onclick={() => revealAll(true)}><Icon name="eye" /> Reveal all</button>
				{:else}
					<button class="btn" type="button" onclick={() => revealAll(false)}><Icon name="eye-off" /> Hide all</button>
				{/if}
			</div>
		</div>
	{/if}

	<article class="roll sheet" class:rehearsing={mode === 'rehearse'}>
		<div class="roll-end top" aria-hidden="true"></div>

		<header class="title">
			<p class="sc kicker">The part of</p>
			<h1><span class="initial">{initial}</span>{rest}</h1>
			<p class="in">in <a href={resolve('/[play]', { play: part.play.slug })}><em>{part.play.title}</em></a></p>
			{#if c.desc}<p class="desc">{c.desc}</p>{/if}

			<dl class="stats">
				<div><dt>lines</dt><dd>{c.stats.lines.toLocaleString()}</dd></div>
				<div><dt>speeches</dt><dd>{c.stats.speeches.toLocaleString()}</dd></div>
				<div><dt>{sceneWord(c.stats.scenes)}</dt><dd>{c.stats.scenes}<small>/{part.totalScenes}</small></dd></div>
				<div><dt>words</dt><dd>{c.stats.words.toLocaleString()}</dd></div>
			</dl>

			{#if part.cueGivers.length}
				<p class="givers">
					Your cues come from
					{#each part.cueGivers.slice(0, 6) as g, gi (g.name)}
						<span class="giver">{g.name}{#if g.count > 1}<sup>×{g.count}</sup>{/if}</span>{gi < Math.min(6, part.cueGivers.length) - 1 ? ', ' : ''}
					{/each}{part.cueGivers.length > 6 ? `, and ${part.cueGivers.length - 6} more` : ''}.
				</p>
			{/if}

			<nav class="scene-nav no-print" aria-label="Your scenes">
				{#each part.scenes as s (s.sceneIndex)}
					<a href="#scene-{s.ref}" class:silent={s.silent} title={s.label + (s.silent ? ' (silent)' : '')}>{s.ref}</a>
				{/each}
			</nav>
		</header>

		{#each part.scenes as scene (scene.sceneIndex)}
			<section class="scene" id="scene-{scene.ref}" aria-label={scene.label}>
				<h2 class="scene-head">
					<span class="rule" aria-hidden="true"></span>
					<span class="label">{scene.label}</span>
					<span class="rule" aria-hidden="true"></span>
				</h2>
				{#if !scene.silent}
					<button class="run-scene no-print" type="button" onclick={() => run(scene.sceneIndex)}>
						<Icon name="play" /> run this scene
					</button>
				{/if}
				{#each scene.entries as e, ei (ei)}
					{#if e.kind === 'cue'}
						<Cue cue={e} />
					{:else if e.kind === 'speech'}
						<Speech
							speech={e}
							rehearse={mode === 'rehearse'}
							revealed={revealedFor(e.index)}
							onreveal={(n) => reveals.set(e.index, n)}
							current={highlight === e.index}
						/>
					{:else}
						<p class="sd" class:entrance={e.type === 'entrance'} class:exit={e.type === 'exit'}>{e.t}</p>
					{/if}
				{/each}
				{#if scene.silent}
					<p class="silent-note">On stage, but silent.</p>
				{/if}
			</section>
		{/each}

		<p class="finis sc" aria-hidden="true">Finis</p>
		<div class="roll-end bottom" aria-hidden="true"></div>
	</article>

	{#if data.others.length}
		<aside class="others no-print">
			<h2>Other parts in <em>{part.play.title}</em></h2>
			<ul>
				{#each data.others as o (o.slug)}
					<li><a href={resolve('/[play]/[character]', { play: part.play.slug, character: o.slug })}>{o.name}</a></li>
				{/each}
				<li><a class="all" href={resolve('/[play]', { play: part.play.slug })}>the whole company →</a></li>
			</ul>
		</aside>
	{/if}
</div>

{#if running}
	<RunLines {steps} start={runFrom} character={c.name} onclose={endRun} />
{/if}

<style>
	.page {
		max-width: 50rem;
		margin: 0 auto;
		padding: 0 clamp(0.6rem, 3vw, 1.5rem);
	}
	.crumbs {
		margin: 0.25rem 0 0.75rem;
	}
	.crumbs a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-sc);
		letter-spacing: 0.04em;
		color: var(--ink-soft);
		text-decoration: none;
	}
	.crumbs :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	/* ---------- the prompter's desk ---------- */
	.desk {
		position: sticky;
		top: 0.5rem;
		z-index: 15;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem 1rem;
		padding: 0.55rem 0.75rem;
		margin-bottom: 1.25rem;
		background: color-mix(in srgb, var(--paper) 95%, transparent);
		backdrop-filter: blur(8px) saturate(1.2);
		-webkit-backdrop-filter: blur(8px) saturate(1.2);
		border: 1px solid var(--rule);
		border-radius: 999px;
		box-shadow: var(--shadow-md);
	}
	.group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.group.end {
		margin-left: auto;
	}
	.segmented :global(svg) {
		width: 1rem;
		height: 1rem;
		vertical-align: -0.15em;
		margin-right: 0.15rem;
	}
	.run :global(svg) {
		width: 0.85rem;
		height: 0.85rem;
	}
	.cue-ctl {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex: 1 1 14rem;
		max-width: 20rem;
	}
	.cue-ctl .sc {
		color: var(--rubric);
		letter-spacing: 0.08em;
	}
	.cue-ctl output {
		font-family: var(--font-sc);
		font-size: 0.92rem;
		color: var(--ink-soft);
		min-width: 6.6rem;
		white-space: nowrap;
	}
	input[type='range'] {
		flex: 1;
		min-width: 5rem;
		accent-color: var(--rubric);
		height: 1.5rem;
		background: transparent;
		-webkit-appearance: none;
		appearance: none;
	}
	input[type='range']::-webkit-slider-runnable-track {
		height: 2px;
		background: var(--rule-strong);
		border-radius: 1px;
	}
	input[type='range']::-moz-range-track {
		height: 2px;
		background: var(--rule-strong);
	}
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		margin-top: -7px;
		border-radius: 50%;
		background: var(--rubric);
		border: 2px solid var(--paper);
		box-shadow: 0 0 0 1px var(--rubric);
	}
	input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--rubric);
		border: 2px solid var(--paper);
	}
	@media (max-width: 480px) {
		.segmented :global(svg) {
			display: none;
		}
		.desk .group {
			gap: 0.35rem;
		}
	}
	@media (max-width: 720px) {
		.desk {
			border-radius: 18px;
			padding: 0.45rem 0.6rem;
			top: 0.25rem;
		}
		.roll {
			font-size: 1.0625rem;
		}
		.cue-ctl {
			order: 3;
			flex-basis: 100%;
			max-width: none;
		}
	}
	.coach {
		text-align: center;
		margin: -0.25rem auto 1.25rem;
		max-width: 36rem;
		animation: coach-in 0.35s var(--ease);
	}
	@keyframes coach-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
	}
	.coach p {
		font-style: italic;
		color: var(--ink-soft);
		font-size: 1.02rem;
		margin: 0 0 0.6rem;
	}
	.coach-tools {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.coach b {
		font-family: var(--font-sc);
		font-weight: 400;
		font-style: normal;
		color: var(--ink);
	}

	/* ---------- the roll ---------- */
	.roll {
		padding: 2.5rem clamp(1.25rem, 7vw, 5rem) 2.5rem;
		margin: 1.25rem 0 0;
	}
	.roll-end {
		position: absolute;
		left: -10px;
		right: -10px;
		height: 22px;
		border-radius: 11px;
		background: linear-gradient(
			to bottom,
			var(--paper-edge),
			var(--paper-3) 30%,
			var(--paper) 50%,
			var(--paper-3) 70%,
			var(--paper-edge)
		);
		box-shadow: var(--shadow-sm);
	}
	.roll-end.top {
		top: -11px;
	}
	.roll-end.bottom {
		bottom: -11px;
	}

	.title {
		text-align: center;
		margin-bottom: 2.5rem;
	}
	.kicker {
		margin: 0;
		color: var(--ink-faint);
		letter-spacing: 0.25em;
		text-transform: lowercase;
	}
	h1 {
		font-size: clamp(2.8rem, 10vw, 4.8rem);
		margin: 0.25rem 0 0.35rem;
		text-wrap: balance;
	}
	.initial {
		color: var(--rubric);
		font-size: 1.18em;
		line-height: 0.8;
	}
	.in {
		margin: 0;
		font-size: 1.25rem;
		color: var(--ink-soft);
	}
	.in a {
		text-decoration: none;
	}
	.desc {
		font-style: italic;
		color: var(--ink-faint);
		margin: 0.3rem 0 0;
	}
	.stats {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.5rem clamp(1.25rem, 5vw, 2.75rem);
		margin: 1.6rem 0 1rem;
		padding: 0.85rem 0;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}
	.stats div {
		display: flex;
		flex-direction: column-reverse;
	}
	.stats dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.6rem;
		line-height: 1;
		font-variant-numeric: lining-nums;
	}
	.stats small {
		font-size: 0.55em;
		color: var(--ink-faint);
	}
	.stats dt {
		font-family: var(--font-sc);
		font-size: 0.85rem;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}
	.givers {
		font-style: italic;
		color: var(--ink-soft);
		max-width: 32rem;
		margin: 0 auto 1rem;
		text-wrap: balance;
	}
	.giver {
		font-style: normal;
		font-family: var(--font-sc);
		color: var(--ink);
	}
	.giver sup {
		font-family: var(--font-body);
		color: var(--ink-faint);
		font-size: 0.7em;
		margin-left: 0.05em;
	}
	.scene-nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.3rem;
	}
	.scene-nav a {
		font-size: 0.9rem;
		font-variant-numeric: lining-nums;
		text-decoration: none;
		border: 1px solid var(--rule);
		border-radius: 999px;
		padding: 0.05rem 0.6rem;
		color: var(--ink-soft);
		transition:
			border-color 0.15s,
			color 0.15s;
	}
	.scene-nav a:hover {
		border-color: var(--rubric);
		color: var(--rubric);
	}
	.scene-nav a.silent {
		border-style: dashed;
		color: var(--ink-faint);
	}

	.scene {
		position: relative;
		margin: 0 0 2.75rem;
	}
	.scene-head {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-family: var(--font-sc);
		font-size: 1.15rem;
		letter-spacing: 0.12em;
		color: var(--ink-soft);
		margin: 0 0 0.25rem;
	}
	.scene-head .rule {
		flex: 1;
		height: 1px;
		background: var(--rule);
	}
	.scene-head .label {
		text-align: center;
	}
	.run-scene {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0 auto 0.5rem;
		border: 0;
		background: none;
		color: var(--ink-faint);
		font-style: italic;
		font-size: 0.92rem;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
	}
	.run-scene:hover {
		color: var(--rubric);
		background: var(--rubric-soft);
	}
	.run-scene :global(svg) {
		width: 0.7rem;
		height: 0.7rem;
	}
	.sd {
		font-style: italic;
		color: var(--ink-faint);
		margin: 0.6rem 0 0.3rem 2em;
		font-size: 1rem;
	}
	.sd.entrance {
		margin-left: 0;
		text-align: center;
		margin-top: 0.75rem;
	}
	.sd.exit {
		text-align: right;
	}
	.silent-note {
		text-align: center;
		color: var(--ink-faint);
		font-style: italic;
		font-size: 0.98rem;
		margin: 0.3rem 0 0;
	}
	.finis {
		text-align: center;
		color: var(--rubric);
		letter-spacing: 0.35em;
		margin: 3rem 0 0.5rem;
		font-size: 1.15rem;
	}

	.others {
		text-align: center;
		margin: 3rem auto 0;
	}
	.others h2 {
		font-size: 1.35rem;
		margin-bottom: 0.75rem;
		color: var(--ink-soft);
	}
	.others ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.4rem 0.5rem;
	}
	.others a {
		display: inline-block;
		padding: 0.15rem 0.8rem;
		border: 1px solid var(--rule);
		border-radius: 999px;
		text-decoration: none;
		font-family: var(--font-display);
		font-size: 1.1rem;
		background: var(--paper);
	}
	.others a.all {
		font-family: var(--font-body);
		font-style: italic;
		border-style: dashed;
		background: transparent;
	}

	@media print {
		.page {
			max-width: none;
			padding: 0;
		}
		.roll {
			padding: 0;
			margin: 0;
		}
		.roll-end,
		.finis {
			display: none;
		}
		.title {
			margin-bottom: 1.5rem;
		}
		h1 {
			font-size: 30pt;
		}
		.scene {
			margin-bottom: 1.4rem;
		}
		.scene-head {
			break-after: avoid;
		}
	}
</style>
