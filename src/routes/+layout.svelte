<script lang="ts">
	import '@fontsource/eb-garamond/400.css';
	import '@fontsource/eb-garamond/400-italic.css';
	import '@fontsource/eb-garamond/500.css';
	import '@fontsource/eb-garamond/600.css';
	import '@fontsource/im-fell-english/400.css';
	import '@fontsource/im-fell-english/400-italic.css';
	import '@fontsource/im-fell-english-sc/400.css';
	import '../app.css';

	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import favicon from '#lib/assets/favicon.svg';
	import Icon from '#lib/components/Icon.svelte';
	import Search from '#lib/components/Search.svelte';
	import { settings } from '#lib/settings.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	let dialog: HTMLDialogElement;
	let searching = $state(false);
	let systemDark = $state(false);

	const isHome = $derived(page.route.id === '/');
	const dark = $derived(settings.theme === 'dark' || (settings.theme === 'system' && systemDark));

	onMount(() => {
		settings.load();
		const mq = matchMedia('(prefers-color-scheme: dark)');
		systemDark = mq.matches;
		const onChange = () => (systemDark = mq.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	$effect(() => {
		const t = settings.theme;
		if (t === 'system') delete document.documentElement.dataset.theme;
		else document.documentElement.dataset.theme = t;
		settings.save();
	});

	function toggleTheme() {
		settings.theme = dark ? 'light' : 'dark';
	}

	function openSearch() {
		if (isHome) {
			document.querySelector<HTMLInputElement>('.search.hero input')?.focus();
			return;
		}
		searching = true;
		dialog.showModal();
	}
	function closeSearch() {
		searching = false;
		dialog.close();
	}

	function onkeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		const typing = t.closest('input, textarea, select, [contenteditable="true"]');
		if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
			e.preventDefault();
			openSearch();
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Cue Script — Shakespeare’s parts, as the players had them</title>
	<meta
		name="description"
		content="Cue scripts for every character in Shakespeare: just your lines and your cues, with tools to rehearse them."
	/>
</svelte:head>

<svelte:window {onkeydown} />

<a class="skip no-print" href="#main">Skip to content</a>

<header class="masthead no-print" class:home={isHome}>
	<a class="wordmark" href={resolve('/')} aria-label="Cue Script — home">
		<span class="mark" aria-hidden="true">C</span>
		<span class="words">Cue&nbsp;Script</span>
	</a>
	<nav>
		{#if !isHome}
			<button class="search-btn" type="button" onclick={openSearch}>
				<Icon name="search" />
				<span class="label">Find a part</span>
				<kbd>/</kbd>
			</button>
		{/if}
		<a class="nav-link" href={resolve('/my')} aria-current={page.route.id?.startsWith('/my') ? 'page' : undefined}
			><span class="hide-sm">Your scripts</span><span class="show-sm">Scripts</span></a
		>
		<a class="nav-link hide-sm" href={resolve('/about')}>About</a>
		<button
			class="icon-btn"
			type="button"
			onclick={toggleTheme}
			aria-label={dark ? 'Switch to daylight' : 'Switch to candlelight'}
			title={dark ? 'Daylight' : 'Candlelight'}
		>
			<Icon name={dark ? 'sun' : 'candle'} />
		</button>
	</nav>
</header>

<main id="main">
	{@render children()}
</main>

<footer class="colophon no-print">
	<p class="sc">Finis</p>
	<p>
		Texts from <a href="https://www.folger.edu/explore/shakespeares-works/">Folger Shakespeare</a>, ed. Barbara
		Mowat &amp; Paul Werstine, © Folger Shakespeare Library, used under
		<a href="https://creativecommons.org/licenses/by-nc/3.0/">CC BY-NC 3.0</a>. TEI via
		<a href="https://dracor.org/shake">DraCor</a>.
	</p>
	<p><a href={resolve('/about')}>About this project</a></p>
</footer>

<dialog
	bind:this={dialog}
	class="search-dialog"
	onclose={() => (searching = false)}
	onclick={(e) => e.target === dialog && closeSearch()}
>
	<div class="dialog-inner sheet">
		<div class="dialog-head">
			<h2>Find a part</h2>
			<button class="icon-btn" type="button" onclick={closeSearch} aria-label="Close"><Icon name="close" /></button>
		</div>
		{#if searching}
			<Search variant="compact" autofocus onnavigate={closeSearch} />
		{/if}
	</div>
</dialog>

<style>
	.skip {
		position: absolute;
		left: -999px;
		top: 0.5rem;
		z-index: 200;
		background: var(--ink);
		color: var(--paper);
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
	}
	.skip:focus {
		left: 0.5rem;
	}

	.masthead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem clamp(1rem, 4vw, 2.5rem);
		position: relative;
		z-index: 20;
	}
	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		text-decoration: none;
		color: var(--ink);
	}
	.wordmark:hover {
		color: var(--ink);
	}
	.mark {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border: 1px solid var(--rubric);
		border-radius: 3px;
		font-family: var(--font-display);
		font-size: 1.55rem;
		line-height: 1;
		color: var(--rubric);
		background: var(--rubric-soft);
		padding-top: 0.15rem;
		transition: transform 0.35s var(--ease);
	}
	.wordmark:hover .mark {
		transform: rotate(-6deg);
	}
	.words {
		font-family: var(--font-sc);
		font-size: 1.25rem;
		letter-spacing: 0.08em;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.nav-link {
		font-family: var(--font-sc);
		letter-spacing: 0.05em;
		text-decoration: none;
		color: var(--ink-soft);
		padding: 0.3rem 0.6rem;
	}
	.nav-link[aria-current='page'] {
		color: var(--rubric);
	}
	.show-sm {
		display: none;
	}
	@media (max-width: 560px) {
		.hide-sm {
			display: none;
		}
		.show-sm {
			display: inline;
		}
		.nav-link {
			padding-inline: 0.3rem;
		}
	}
	.search-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		border-radius: 999px;
		padding: 0.35rem 0.5rem 0.35rem 0.85rem;
		color: var(--ink-soft);
		font-style: italic;
		font-size: 1rem;
		transition: border-color 0.15s;
	}
	.search-btn:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	.search-btn :global(svg) {
		width: 1rem;
		height: 1rem;
	}
	.search-btn kbd {
		font-family: var(--font-body);
		font-style: normal;
		font-size: 0.8rem;
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 0 0.4rem;
	}
	@media (max-width: 560px) {
		.search-btn .label,
		.search-btn kbd {
			display: none;
		}
		.search-btn {
			padding: 0.45rem;
		}
		.words {
			font-size: 1.1rem;
		}
	}

	.colophon {
		text-align: center;
		color: var(--ink-faint);
		font-size: 0.95rem;
		padding: 4rem 1.5rem 3rem;
		max-width: 42rem;
		margin: 0 auto;
	}
	.colophon .sc {
		color: var(--rubric);
		font-size: 1.2rem;
		letter-spacing: 0.3em;
		margin-bottom: 0.75rem;
	}
	.colophon p {
		margin: 0 0 0.5rem;
	}

	.search-dialog {
		border: 0;
		padding: 0;
		background: transparent;
		width: min(40rem, calc(100vw - 2rem));
		max-height: 85vh;
		margin: 10vh auto auto;
		overflow: visible;
		color: var(--ink);
	}
	.search-dialog::backdrop {
		background: rgba(20, 12, 5, 0.45);
		backdrop-filter: blur(3px);
	}
	.search-dialog[open] .dialog-inner {
		animation: rise 0.25s var(--ease);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.98);
		}
	}
	.dialog-inner {
		padding: 1.25rem 1.25rem 0.75rem;
	}
	.dialog-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	.dialog-head h2 {
		font-size: 1.6rem;
	}
</style>
