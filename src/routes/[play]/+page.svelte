<script lang="ts">
	import { resolve } from '$app/paths';
	import Playbill from '#lib/components/Playbill.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Playbill
	play={data.play}
	scenes={data.scenes}
	characters={data.characters}
	backHref={resolve('/')}
	partHref={(slug) => resolve('/[play]/[character]', { play: data.play.slug, character: slug })}
/>
