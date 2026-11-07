<script lang="ts">
	import { resolve } from '$app/paths';
	import PartView from '#lib/components/PartView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PartView
	part={data.part}
	others={data.others}
	playHref={resolve('/[play]', { play: data.part.play.slug })}
	partHref={(slug) => resolve('/[play]/[character]', { play: data.part.play.slug, character: slug })}
/>
