<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { productionFile, type SavedScript } from '#lib/library.ts';

	let { record, onclose }: { record: SavedScript; onclose: () => void } = $props();

	let dialog: HTMLDialogElement;
	const file = $derived(productionFile(record));
	const canShare = $derived.by(() => {
		try {
			return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [new File([file.blob], file.fileName)] });
		} catch {
			return false;
		}
	});
	const size = $derived(file.blob.size < 1e6 ? `${Math.max(1, Math.round(file.blob.size / 1e3))} KB` : `${(file.blob.size / 1e6).toFixed(1)} MB`);

	$effect(() => {
		dialog.showModal();
	});

	function download() {
		const url = URL.createObjectURL(file.blob);
		const a = Object.assign(document.createElement('a'), { href: url, download: file.fileName });
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	async function share() {
		try {
			await navigator.share({
				files: [new File([file.blob], file.fileName, { type: 'application/json' })],
				title: record.title,
				text: `The script for ${record.title}. Open Cue Script, choose "Your scripts", and drop this file in to get your part.`
			});
		} catch {
			/* cancelled */
		}
	}
</script>

<dialog bind:this={dialog} class="share" onclose={onclose} onclick={(e) => e.target === dialog && dialog.close()}>
	<div class="inner sheet">
		<button class="icon-btn close" type="button" onclick={() => dialog.close()} aria-label="Close"><Icon name="close" /></button>
		<p class="sc kicker">Send to your cast</p>
		<h2>{record.title}</h2>
		<ol>
			<li>Save the production file and send it to your company by email, a group chat or a shared drive.</li>
			<li>Each actor opens <b>Cue Script → Your scripts</b> and drops the file in.</li>
			<li>They get this exact script with your cast corrections, and choose their own part.</li>
		</ol>
		<p class="note">
			Made changes later? Send the new file. Opening it <em>updates</em> everyone’s copy instead of adding a second one.
			The file contains the script text, so share it only with people who may have it.
		</p>
		<div class="row">
			<button class="btn primary" type="button" onclick={download}><Icon name="arrow-right" /> Save {file.fileName} <span class="size">({size})</span></button>
			{#if canShare}<button class="btn" type="button" onclick={share}>Share…</button>{/if}
		</div>
	</div>
</dialog>

<style>
	.share {
		border: 0;
		padding: 0;
		background: transparent;
		width: min(34rem, calc(100vw - 2rem));
		color: var(--ink);
	}
	.share::backdrop {
		background: rgba(20, 12, 5, 0.45);
		backdrop-filter: blur(3px);
	}
	.inner {
		padding: 1.75rem 1.75rem 1.5rem;
		animation: rise 0.25s var(--ease);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}
	.close {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
	}
	.kicker {
		margin: 0;
		color: var(--rubric);
		letter-spacing: 0.15em;
		text-transform: lowercase;
	}
	h2 {
		font-size: 2rem;
		margin: 0.2rem 0 0.9rem;
	}
	ol {
		margin: 0 0 1rem;
		padding-left: 1.3rem;
	}
	li {
		margin-bottom: 0.4rem;
	}
	b {
		font-family: var(--font-sc);
		font-weight: 400;
	}
	.note {
		font-size: 0.98rem;
		color: var(--ink-soft);
		font-style: italic;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.row :global(svg) {
		width: 1rem;
		height: 1rem;
	}
	.size {
		opacity: 0.7;
		font-family: var(--font-body);
		font-size: 0.85em;
	}
</style>
