<script lang="ts">
	/** A printer's ornament rule:  ——— ❦ ——— */
	let { width = '12rem', glyph = '❦' }: { width?: string; glyph?: string } = $props();
</script>

<div class="fleuron" style:--w={width} aria-hidden="true">
	<span class="line"></span>
	<span class="glyph">{glyph}</span>
	<span class="line"></span>
</div>

<style>
	.fleuron {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: var(--w);
		max-width: 100%;
		margin-inline: auto;
		color: var(--rubric);
	}
	.line {
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--rule-strong) 30%, var(--rule-strong) 70%, transparent);
	}
	.glyph {
		font-family: 'EB Garamond', serif;
		font-size: 1.35em;
		line-height: 1;
		transform: translateY(-0.05em);
	}
</style>
