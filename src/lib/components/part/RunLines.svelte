<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { cueToSpeech, trimCue, type RunStep } from '#lib/play/part.ts';
	import { CUE_STOPS, cueLabel, settings } from '#lib/settings.svelte.ts';
	import { hush, speak, voiceSupported } from '#lib/voice.ts';
	import Cue from './Cue.svelte';
	import Speech from './Speech.svelte';

	let {
		steps,
		start = 0,
		character,
		onclose
	}: { steps: RunStep[]; start?: number; character: string; onclose: (at: number) => void } = $props();

	// svelte-ignore state_referenced_locally
	let i = $state(Math.min(start, steps.length));
	let revealed = $state(0);
	let root: HTMLDivElement;
	let canSpeak = $state(false);
	let speaking = $state(false);

	const step = $derived(steps[i] as RunStep | undefined);
	const done = $derived(i >= steps.length);
	const shown = $derived(step ? revealed >= step.words : false);
	const sceneChanged = $derived(!!step && (i === 0 || steps[i - 1]?.scene !== step.scene));

	onMount(() => {
		canSpeak = voiceSupported();
		root.focus();
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
			hush();
		};
	});

	// Read the cue aloud whenever we arrive at a new step.
	$effect(() => {
		const s = step;
		void settings.cueLength;
		if (!s || !settings.voice || !canSpeak || !s.cue) return;
		const text = cueToSpeech(trimCue(s.cue.lines, settings.cueLength));
		speaking = true;
		speak(text, { speaker: s.cue.from, rate: settings.rate }).then(() => (speaking = false));
		return () => hush();
	});

	function go(to: number) {
		i = Math.max(0, Math.min(steps.length, to));
		revealed = 0;
		tick().then(() => root?.querySelector('.stage-body')?.scrollTo({ top: 0 }));
	}
	function advance() {
		if (done) return;
		if (!shown) revealed = Infinity;
		else go(i + 1);
	}
	function hint() {
		if (step && !shown) revealed = Math.min(step.words, revealed + 1);
	}
	function nudgeCue(d: number) {
		const at = CUE_STOPS.indexOf(settings.cueLength);
		settings.cueLength = CUE_STOPS[Math.max(0, Math.min(CUE_STOPS.length - 1, at + d))];
		settings.save();
	}
	function toggleVoice() {
		settings.voice = !settings.voice;
		settings.save();
		if (!settings.voice) hush();
	}
	function close() {
		hush();
		onclose(Math.min(i, steps.length - 1));
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const k = e.key;
		if (k === ' ' || k === 'Enter') {
			if ((e.target as HTMLElement).closest('button')) return;
			e.preventDefault();
			advance();
		} else if (k === 'ArrowRight') {
			e.preventDefault();
			go(i + 1);
		} else if (k === 'ArrowLeft') {
			e.preventDefault();
			go(i - 1);
		} else if (k === 'ArrowUp') {
			e.preventDefault();
			nudgeCue(1);
		} else if (k === 'ArrowDown') {
			e.preventDefault();
			nudgeCue(-1);
		} else if (k.toLowerCase() === 'h') hint();
		else if (k.toLowerCase() === 'v') toggleVoice();
		else if (k === 'Escape') {
			e.preventDefault();
			close();
		}
	}
</script>

<div
	class="stage"
	bind:this={root}
	role="dialog"
	aria-modal="true"
	aria-label="Run lines as {character}"
	tabindex="-1"
	{onkeydown}
>
	<div class="progress" aria-hidden="true"><span style:width="{(i / steps.length) * 100}%"></span></div>

	<header>
		<button class="icon-btn" type="button" onclick={close} aria-label="Leave the stage (Esc)"><Icon name="close" /></button>
		<p class="where">
			{#if step}
				<span class="sc">{step.scene.label}</span>
				<span class="count">speech {i + 1} of {steps.length}</span>
			{:else}
				<span class="sc">Exeunt</span>
			{/if}
		</p>
		<div class="right">
			<div class="cue-len" title="Cue length (↑ ↓)">
				<button type="button" class="icon-btn" onclick={() => nudgeCue(-1)} aria-label="Shorter cue">−</button>
				<span>{cueLabel(settings.cueLength)}</span>
				<button type="button" class="icon-btn" onclick={() => nudgeCue(1)} aria-label="Longer cue">+</button>
			</div>
			{#if canSpeak}
				<button
					class="icon-btn"
					class:on={settings.voice}
					type="button"
					onclick={toggleVoice}
					aria-pressed={settings.voice}
					aria-label="Read cues aloud (V)"
					title="Read cues aloud (V)"
				>
					<Icon name={settings.voice ? 'volume' : 'volume-off'} />
				</button>
			{/if}
		</div>
	</header>

	<div class="stage-body">
		<div class="spot">
			{#if step}
				{#key i}
					<div class="scene-card">
						{#if sceneChanged}
							<p class="scene-title">{step.scene.label}</p>
						{/if}
						{#each step.directions as d, di (di)}
							<p class="dir">{d}</p>
						{/each}

						{#if step.cue}
							<div class="cue-wrap" class:speaking>
								<Cue cue={step.cue} />
							</div>
						{:else}
							<p class="opener">You begin{sceneChanged ? ' the scene' : ''}.</p>
						{/if}

						<div class="yours">
							<p class="label sc">{shown ? character : `${character} — your line`}</p>
							<Speech speech={step.speech} rehearse tools={false} {revealed} onreveal={(n) => (revealed = n)} />
						</div>
					</div>
				{/key}
			{:else}
				<div class="finis">
					<p class="sc big">Finis</p>
					<p>You have run all {steps.length} of {character}’s speeches. Bravely done.</p>
					<button class="btn primary" type="button" onclick={() => go(0)}><Icon name="rewind" /> From the top</button>
					<button class="btn" type="button" onclick={close}>Back to the part</button>
				</div>
			{/if}
		</div>
	</div>

	{#if step}
		<footer>
			<button class="btn" type="button" onclick={() => go(i - 1)} disabled={i === 0} aria-label="Previous speech (←)">
				<Icon name="arrow-left" /><span class="hide-sm">Back</span>
			</button>
			<button class="btn" type="button" onclick={hint} disabled={shown} title="Reveal the next word (H)">Prompt</button>
			<button class="btn primary main" type="button" onclick={advance}>
				{#if shown}Next cue <Icon name="arrow-right" />{:else}<Icon name="eye" /> Reveal{/if}
			</button>
			<p class="keys hide-sm" aria-hidden="true">
				<kbd>Space</kbd> reveal / next · <kbd>H</kbd> prompt · <kbd>↑</kbd><kbd>↓</kbd> cue · <kbd>Esc</kbd> leave
			</p>
		</footer>
	{/if}
</div>

<style>
	/* The stage is always lit by candle, whatever the house lights. */
	.stage {
		--paper: #1b140e;
		--paper-2: #241a12;
		--ink: #efe2c6;
		--ink-soft: #c9b18b;
		--ink-faint: #8f7a5b;
		--ink-ghost: rgba(239, 226, 198, 0.1);
		--rubric: #ec9270;
		--rubric-soft: rgba(236, 146, 112, 0.14);
		--rule: rgba(239, 226, 198, 0.18);
		--rule-strong: rgba(239, 226, 198, 0.45);
		--smudge: rgba(239, 226, 198, 0.16);
		--focus: #8cc4ef;
		color-scheme: dark;
		position: fixed;
		inset: 0;
		z-index: 90;
		display: flex;
		flex-direction: column;
		color: var(--ink);
		background:
			radial-gradient(ellipse 55% 60% at 50% 38%, rgba(255, 176, 92, 0.16), transparent 70%),
			radial-gradient(ellipse 120% 80% at 50% 120%, rgba(0, 0, 0, 0.6), transparent),
			#0c0805;
		outline: none;
		animation: lights 0.45s var(--ease);
	}
	@keyframes lights {
		from {
			opacity: 0;
		}
	}
	.progress {
		height: 2px;
		background: var(--ink-ghost);
	}
	.progress span {
		display: block;
		height: 100%;
		background: var(--rubric);
		transition: width 0.4s var(--ease);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem clamp(0.75rem, 3vw, 1.5rem);
	}
	.where {
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.2;
		text-align: center;
	}
	.where .sc {
		letter-spacing: 0.1em;
	}
	.count {
		font-size: 0.85rem;
		color: var(--ink-faint);
		font-style: italic;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.cue-len {
		display: flex;
		align-items: center;
		gap: 0.1rem;
		font-family: var(--font-sc);
		font-size: 0.9rem;
		color: var(--ink-soft);
	}
	.cue-len span {
		min-width: 6.5rem;
		text-align: center;
	}
	.cue-len .icon-btn {
		width: 2rem;
		height: 2rem;
		font-size: 1.2rem;
	}
	.icon-btn.on {
		color: var(--rubric);
	}

	.stage-body {
		flex: 1;
		overflow-y: auto;
		display: flex;
		padding: 1rem clamp(1rem, 5vw, 2rem);
	}
	.spot {
		margin: auto;
		width: 100%;
		max-width: 38rem;
		padding: 1rem 0 2rem;
	}
	.scene-card {
		animation: enter 0.45s var(--ease);
	}
	@keyframes enter {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
	.scene-title {
		font-family: var(--font-display);
		font-size: 1.6rem;
		text-align: center;
		margin: 0 0 1rem;
		color: var(--ink-soft);
	}
	.dir {
		font-style: italic;
		color: var(--ink-faint);
		text-align: center;
		margin: 0 0 0.35rem;
	}
	.cue-wrap {
		font-size: 1.55rem;
		margin-bottom: 1.75rem;
		transition: text-shadow 0.4s;
	}
	.cue-wrap.speaking {
		text-shadow: 0 0 18px rgba(236, 146, 112, 0.45);
	}
	.cue-wrap :global(.from) {
		font-size: 0.95rem;
	}
	.opener {
		text-align: center;
		font-style: italic;
		color: var(--rubric);
		font-size: 1.4rem;
		margin: 0.5rem 0 1.75rem;
	}
	.yours {
		font-size: 1.35rem;
		line-height: 1.55;
		border-top: 1px solid var(--rule);
		padding-top: 0.9rem;
	}
	.label {
		margin: 0 0 0.4rem;
		font-size: 0.9rem;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.9rem 1rem calc(0.9rem + env(safe-area-inset-bottom));
		border-top: 1px solid var(--rule);
	}
	footer .btn {
		font-size: 1.05rem;
		padding: 0.55em 1.1em;
	}
	footer .btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.main {
		min-width: 9.5rem;
		justify-content: center;
	}
	.keys {
		flex-basis: 100%;
		text-align: center;
		margin: 0.2rem 0 0;
		font-size: 0.82rem;
		color: var(--ink-faint);
	}
	kbd {
		font-family: var(--font-body);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0 0.3rem;
		font-size: 0.78rem;
	}
	.finis {
		text-align: center;
	}
	.finis .big {
		font-size: 2.4rem;
		color: var(--rubric);
		letter-spacing: 0.3em;
		margin: 0 0 0.5rem;
	}
	.finis .btn {
		margin: 0.4rem;
	}
	@media (max-width: 640px) {
		.hide-sm {
			display: none;
		}
		.cue-len span {
			min-width: 4.8rem;
			font-size: 0.8rem;
		}
		.where .sc {
			font-size: 0.9rem;
		}
		header {
			gap: 0.4rem;
		}
		.cue-wrap {
			font-size: 1.3rem;
		}
		.yours {
			font-size: 1.2rem;
		}
	}
</style>
