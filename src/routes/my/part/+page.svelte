<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PartView from '#lib/components/PartView.svelte';
	import Missing from '#lib/components/upload/Missing.svelte';
	import { getScript, type SavedScript } from '#lib/library.ts';
	import { buildPart } from '#lib/play/part.ts';

	const id = $derived(page.url.searchParams.get('id') ?? '');
	const slug = $derived(page.url.searchParams.get('c') ?? '');
	let record = $state<SavedScript | null | undefined>(undefined);
	$effect(() => {
		const want = id;
		getScript(want).then((r) => (record = r));
	});

	const part = $derived(record ? buildPart(record.play, slug) : null);
	const others = $derived(
		record
			? record.play.characters
					.filter((c) => !c.minor && c.slug !== slug)
					.sort((a, b) => b.stats.lines - a.stats.lines)
					.slice(0, 8)
					.map((c) => ({ slug: c.slug, name: c.name }))
			: []
	);
	const playHref = $derived(`${resolve('/my/play')}?id=${encodeURIComponent(id)}`);
</script>

{#if record && part}
	<PartView
		{part}
		{others}
		{playHref}
		partHref={(s) => `${resolve('/my/part')}?id=${encodeURIComponent(id)}&c=${encodeURIComponent(s)}`}
	/>
{:else if record === null || (record && !part)}
	<Missing />
{/if}
