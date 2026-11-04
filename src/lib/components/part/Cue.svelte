<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { trimCue, cueToSpeech, type Cue } from '#lib/play/part.ts';
	import { settings } from '#lib/settings.svelte.ts';
	import { speak, voiceSupported } from '#lib/voice.ts';

	let { cue }: { cue: Cue } = $props();

	const trimmed = $derived(trimCue(cue.lines, settings.cueLength));
	const long = $derived(trimmed.lines.length > 1);
	let speaking = $state(false);

	async function hear() {
		speaking = true;
		await speak(cueToSpeech(trimmed), { speaker: cue.from, rate: settings.rate });
		speaking = false;
	}
</script>

<div class="cue" class:long>
	{#if cue.effects?.length}
		<p class="effects">{cue.effects.join(' ')}</p>
	{/if}
	<div class="from">
		<span class="sc">{cue.from}</span>
		{#if voiceSupported()}
			<button class="hear no-print" type="button" onclick={hear} aria-label="Hear this cue" title="Hear this cue" class:speaking>
				<Icon name="volume" />
			</button>
		{/if}
	</div>
	{#if long}
		<div class="text">
			{#each trimmed.lines as l, i (i)}<span class="ln">{#if i === 0 && trimmed.elided}<span class="ell" aria-hidden="true">… </span>{/if}{l}</span>{/each}
		</div>
	{:else}
		<div class="text short">
			{#if trimmed.elided}<span class="rule" aria-hidden="true"></span>{/if}
			<span class="words">{trimmed.lines[0]}</span>
		</div>
	{/if}
</div>

<style>
	.cue {
		margin: 1.4rem 0 0.35rem;
		color: var(--rubric);
	}
	.effects {
		margin: 0 0 0.2rem;
		text-align: right;
		font-style: italic;
		color: var(--ink-faint);
		font-size: 0.95rem;
	}
	.from {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.85rem;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
		line-height: 1;
		margin-bottom: 0.1rem;
	}
	.hear {
		border: 0;
		background: transparent;
		color: var(--ink-faint);
		padding: 0.15rem;
		border-radius: 50%;
		display: inline-grid;
		place-items: center;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.cue:hover .hear,
	.hear:focus-visible,
	.hear.speaking {
		opacity: 1;
	}
	@media (hover: none) {
		.hear {
			opacity: 0.7;
		}
	}
	.hear:hover,
	.hear.speaking {
		color: var(--rubric);
	}
	.hear :global(svg) {
		width: 0.95rem;
		height: 0.95rem;
	}
	.text.short {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		justify-content: flex-end;
	}
	.rule {
		flex: 1;
		height: 0;
		border-bottom: 1.5px solid currentColor;
		opacity: 0.55;
		max-width: 70%;
		transform: translateY(-0.3em);
	}
	.words {
		font-style: italic;
		font-size: 1.08em;
		text-align: right;
	}
	.text:not(.short) {
		font-style: italic;
		border-right: 2px solid var(--rubric-soft);
		padding-right: 0.85rem;
		text-align: right;
		display: flex;
		flex-direction: column;
		font-size: 1rem;
		line-height: 1.45;
		color: color-mix(in srgb, var(--rubric) 82%, var(--ink-soft));
	}
	.ell {
		opacity: 0.6;
	}
</style>
