<script lang="ts">
	type Name =
		| 'search' | 'sun' | 'moon' | 'candle' | 'print' | 'eye' | 'eye-off' | 'play' | 'pause'
		| 'volume' | 'volume-off' | 'arrow-left' | 'arrow-right' | 'chevron-down' | 'close'
		| 'mask' | 'scroll' | 'quill' | 'shuffle' | 'rewind';
	let { name, label }: { name: Name; label?: string } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden={label ? undefined : 'true'}
	role={label ? 'img' : undefined}
	aria-label={label}
>
	{#if name === 'search'}
		<circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" />
	{:else if name === 'sun'}
		<circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
	{:else if name === 'moon'}
		<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
	{:else if name === 'candle'}
		<path d="M12 3c1.6 1.8 2 3 2 4a2 2 0 0 1-4 0c0-1 .4-2.2 2-4Z" /><rect x="9" y="11" width="6" height="9" rx="1" /><path d="M12 9v2M6 21h12" />
	{:else if name === 'print'}
		<path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" />
	{:else if name === 'eye'}
		<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
	{:else if name === 'eye-off'}
		<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
	{:else if name === 'play'}
		<path d="M7 4.5v15l12.5-7.5L7 4.5Z" fill="currentColor" stroke="none" />
	{:else if name === 'pause'}
		<path d="M8 5v14M16 5v14" stroke-width="3" />
	{:else if name === 'volume'}
		<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
	{:else if name === 'volume-off'}
		<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" />
	{:else if name === 'arrow-left'}
		<path d="M19 12H5M11 6l-6 6 6 6" />
	{:else if name === 'arrow-right'}
		<path d="M5 12h14M13 6l6 6-6 6" />
	{:else if name === 'chevron-down'}
		<path d="m6 9 6 6 6-6" />
	{:else if name === 'close'}
		<path d="M6 6l12 12M18 6 6 18" />
	{:else if name === 'mask'}
		<path d="M3 5c3 1.3 6 1.3 9 0 3 1.3 6 1.3 9 0v5c0 5-4 9-9 9s-9-4-9-9z" /><path d="M7.5 10.5c.8-.6 1.7-.6 2.5 0M14 10.5c.8-.6 1.7-.6 2.5 0M9 15c1.8 1.3 4.2 1.3 6 0" />
	{:else if name === 'scroll'}
		<path d="M8 3h11a2 2 0 0 1 2 2v1H10M8 3a2 2 0 0 0-2 2v13a2 2 0 0 1-2 2h11a2 2 0 0 0 2-2V6M8 3a2 2 0 0 1 2 2v1" /><path d="M10 10h4M10 14h4" />
	{:else if name === 'quill'}
		<path d="M20 3C10 4 6 10 5 20M20 3c-1 6-5 9-10 10M20 3l-6 9M5 20l2-2" />
	{:else if name === 'shuffle'}
		<path d="M3 7h3c5 0 7 10 12 10h3M3 17h3c2 0 3.5-1.6 4.8-3.6M21 7h-3c-2 0-3.5 1.6-4.8 3.6M18 4l3 3-3 3M18 14l3 3-3 3" />
	{:else if name === 'rewind'}
		<path d="M11 6 4 12l7 6zM20 6l-7 6 7 6z" />
	{/if}
</svg>
