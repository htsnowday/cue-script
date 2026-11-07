<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Playbill from '#lib/components/Playbill.svelte';
	import Missing from '#lib/components/upload/Missing.svelte';
	import ShareDialog from '#lib/components/upload/ShareDialog.svelte';
	import { getScript, type SavedScript } from '#lib/library.ts';

	const id = $derived(page.url.searchParams.get('id') ?? '');
	let record = $state<SavedScript | null | undefined>(undefined);
	let sharing = $state(false);
	$effect(() => {
		const want = id;
		getScript(want).then((r) => (record = r));
	});

	const q = (extra = '') => `?id=${encodeURIComponent(id)}${extra}`;
	const scenesWord = (n: number) => `${n} ${n === 1 ? 'scene' : 'scenes'}`;
</script>

{#if record}
	{@const play = record.play}
	<Playbill
		play={play}
		scenes={play.scenes}
		characters={play.characters}
		backHref={resolve('/my')}
		backLabel="Your scripts"
		kicker={`Your script · ${scenesWord(play.scenes.length)}`}
		partHref={(slug) => `${resolve('/my/part')}${q(`&c=${encodeURIComponent(slug)}`)}`}
	>
		{#snippet actions()}
			<a class="btn" href="{resolve('/my/edit')}{q()}">Edit cast</a>
			<button class="btn" type="button" onclick={() => (sharing = true)}>Send to cast</button>
		{/snippet}
	</Playbill>
	{#if sharing}<ShareDialog {record} onclose={() => (sharing = false)} />{/if}
{:else if record === null}
	<Missing />
{/if}
