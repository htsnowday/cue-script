<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Dropzone from '#lib/components/upload/Dropzone.svelte';
	import CastReview from '#lib/components/upload/CastReview.svelte';
	import { isProductionFile, importProduction, saveScript, type SavedScript } from '#lib/library.ts';
	import { emptyCorrections } from '#lib/play/corrections.ts';
	import { takePending } from '#lib/pending.ts';
	import { readScriptFile, sourceFromText, type ScriptSource } from '#lib/sources/import.ts';

	let source = $state<ScriptSource | null>(takePending());
	let busy = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function onfile(file: File) {
		error = null;
		try {
			if (/\.(cuescript|json)$/i.test(file.name)) {
				const text = await file.text();
				if (isProductionFile(text)) {
					const { record } = await importProduction(text);
					return goto(`${resolve('/my/play')}?id=${encodeURIComponent(record.id)}`);
				}
			}
			busy = 'Reading your script…';
			source = await readScriptFile(file, (m) => (busy = m));
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = null;
		}
	}

	async function onsave(rec: SavedScript) {
		await saveScript(rec);
		await goto(`${resolve('/my/play')}?id=${encodeURIComponent(rec.id)}`);
	}
</script>

<svelte:head>
	<title>New script · Cue Script</title>
</svelte:head>

{#if source}
	<CastReview {source} initialCorrections={emptyCorrections()} {onsave} oncancel={() => goto(resolve('/my'))} />
{:else}
	<div class="page">
		<h1>Bring a script</h1>
		<Dropzone {onfile} ontext={(t) => (source = sourceFromText(t))} {busy} />
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</div>
{/if}

<style>
	.page {
		max-width: 44rem;
		margin: 2rem auto 0;
		padding: 0 1.25rem;
	}
	h1 {
		text-align: center;
		font-size: 2.6rem;
		margin-bottom: 1.25rem;
	}
	.error {
		margin-top: 1rem;
		padding: 0.6rem 1rem;
		border-radius: 8px;
		background: var(--rubric-soft);
		color: var(--rubric);
		text-align: center;
	}
</style>
