<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CastReview from '#lib/components/upload/CastReview.svelte';
	import Missing from '#lib/components/upload/Missing.svelte';
	import { getScript, saveScript, type SavedScript } from '#lib/library.ts';

	const id = $derived(page.url.searchParams.get('id') ?? '');
	let record = $state<SavedScript | null | undefined>(undefined);
	$effect(() => {
		const want = id;
		getScript(want).then((r) => (record = r));
	});
	const playHref = $derived(`${resolve('/my/play')}?id=${encodeURIComponent(id)}`);

	async function onsave(rec: SavedScript) {
		await saveScript({ ...rec, importedAt: undefined });
		await goto(playHref);
	}
</script>

<svelte:head>
	<title>Edit cast · Cue Script</title>
</svelte:head>

{#if record}
	<CastReview
		source={record.source}
		initialMode={record.mode}
		initialCorrections={record.corrections}
		existing={record}
		{onsave}
		oncancel={() => goto(playHref)}
	/>
{:else if record === null}
	<Missing />
{/if}
