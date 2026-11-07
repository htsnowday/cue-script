<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<div class="missing sheet">
	<h1>Script not found</h1>
	<p>
		It isn’t on this device. Scripts live only in the browser they were added in. If someone sent you a
		<em>.cuescript</em> file, add it from <a href={resolve('/my')}>Your scripts</a>.
	</p>
</div>

<style>
	.missing {
		max-width: 34rem;
		margin: 3rem auto 0;
		padding: 2rem;
		text-align: center;
	}
	h1 {
		font-size: 2.2rem;
		margin-bottom: 0.75rem;
	}
	p {
		color: var(--ink-soft);
		margin: 0;
	}
</style>
