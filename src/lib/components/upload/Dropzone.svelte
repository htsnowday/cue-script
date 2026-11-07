<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { ACCEPT } from '#lib/sources/import.ts';

	let {
		onfile,
		ontext,
		busy = null,
		compact = false
	}: {
		onfile: (file: File) => void;
		ontext: (text: string) => void;
		/** Progress message while a file is being read. */
		busy?: string | null;
		compact?: boolean;
	} = $props();

	let input = $state<HTMLInputElement>();
	let over = $state(false);
	let pasting = $state(false);
	let pasted = $state('');

	function drop(e: DragEvent) {
		e.preventDefault();
		over = false;
		const f = e.dataTransfer?.files?.[0];
		if (f) onfile(f);
		else {
			const t = e.dataTransfer?.getData('text/plain');
			if (t?.trim()) ontext(t);
		}
	}
</script>

<div class="wrap" class:compact>
	{#if !pasting}
		<button
			type="button"
			class="zone"
			class:over
			disabled={!!busy}
			onclick={() => input?.click()}
			ondragover={(e) => {
				e.preventDefault();
				over = true;
			}}
			ondragleave={() => (over = false)}
			ondrop={drop}
		>
			{#if busy}
				<span class="quill spinning" aria-hidden="true"><Icon name="quill" /></span>
				<span class="big">{busy}</span>
			{:else}
				<span class="quill" aria-hidden="true"><Icon name="scroll" /></span>
				<span class="big">Drop a script here, or <u>choose a file</u></span>
				<span class="formats">Word · PDF · plain text · TEI XML · a <em>.cuescript</em> from your director</span>
			{/if}
		</button>
		<input bind:this={input} type="file" accept="{ACCEPT},.cuescript,.json" hidden onchange={(e) => {
				const f = e.currentTarget.files?.[0];
				e.currentTarget.value = ''; // so choosing the same file again still works
				if (f) onfile(f);
			}} />
		<p class="or">
			or <button type="button" class="link" onclick={() => (pasting = true)} disabled={!!busy}>paste the text of a script</button>
		</p>
	{:else}
		<div class="paste">
			<label for="paste-area" class="sc">Paste your script</label>
			<textarea
				id="paste-area"
				bind:value={pasted}
				rows="12"
				placeholder={'ACT 1\n\nSCENE 1. A ruined castle.\n\nHAMLET. To be, or not to be…\n\n(or names on their own line, above each speech)'}
			></textarea>
			<div class="row">
				<button type="button" class="btn" onclick={() => (pasting = false)}>Cancel</button>
				<button type="button" class="btn primary" disabled={!pasted.trim()} onclick={() => ontext(pasted)}>
					Read this script <Icon name="arrow-right" />
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.zone {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 2.5rem 1.5rem;
		border: 1.5px dashed var(--rule-strong);
		border-radius: 14px;
		background: color-mix(in srgb, var(--paper) 70%, transparent);
		color: var(--ink);
		text-align: center;
		transition:
			border-color 0.2s,
			background 0.2s,
			transform 0.2s var(--ease);
	}
	.compact .zone {
		padding: 1.5rem 1rem;
	}
	.zone:hover:not(:disabled),
	.zone.over {
		border-color: var(--rubric);
		background: var(--rubric-soft);
	}
	.zone.over {
		transform: scale(1.01);
	}
	.zone:disabled {
		cursor: progress;
	}
	.quill {
		color: var(--rubric);
	}
	.quill :global(svg) {
		width: 2.2rem;
		height: 2.2rem;
	}
	.spinning {
		animation: write 1.2s ease-in-out infinite;
	}
	@keyframes write {
		50% {
			transform: translate(6px, -2px) rotate(-8deg);
		}
	}
	.big {
		font-family: var(--font-display);
		font-size: 1.45rem;
		line-height: 1.2;
	}
	.big u {
		text-decoration-color: var(--rubric);
		text-underline-offset: 0.2em;
	}
	.formats {
		color: var(--ink-faint);
		font-size: 0.98rem;
	}
	.or {
		text-align: center;
		margin: 0.6rem 0 0;
		color: var(--ink-faint);
		font-style: italic;
	}
	.link {
		border: 0;
		background: none;
		padding: 0;
		font-style: italic;
		color: var(--ink-soft);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 0.18em;
	}
	.link:hover {
		color: var(--rubric);
	}
	.paste label {
		display: block;
		margin-bottom: 0.4rem;
		color: var(--ink-soft);
		letter-spacing: 0.06em;
	}
	textarea {
		width: 100%;
		border: 1px solid var(--rule-strong);
		border-radius: 10px;
		background: var(--paper);
		padding: 0.85rem 1rem;
		font-family: var(--font-body);
		font-size: 1.02rem;
		line-height: 1.45;
		resize: vertical;
	}
	textarea:focus {
		outline: none;
		border-color: var(--ink);
	}
	textarea::placeholder {
		color: var(--ink-faint);
		font-style: italic;
	}
	.row {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.6rem;
	}
	.row :global(svg) {
		width: 1rem;
		height: 1rem;
	}
</style>
