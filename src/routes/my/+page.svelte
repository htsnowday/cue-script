<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import Fleuron from '#lib/components/Fleuron.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Dropzone from '#lib/components/upload/Dropzone.svelte';
	import ShareDialog from '#lib/components/upload/ShareDialog.svelte';
	import {
		deleteScript,
		getScript,
		importProduction,
		isPersistent,
		isProductionFile,
		listScripts,
		type SavedScript,
		type ScriptSummary
	} from '#lib/library.ts';
	import { setPending } from '#lib/pending.ts';
	import { readScriptFile, sourceFromText } from '#lib/sources/import.ts';

	let scripts = $state<ScriptSummary[] | null>(null);
	let persistent = $state(true);
	let busy = $state<string | null>(null);
	let message = $state<{ text: string; tone: 'ok' | 'error' } | null>(null);
	let highlight = $state<string | null>(null);
	let sharing = $state<SavedScript | null>(null);
	let confirming = $state<string | null>(null);

	const href = (path: '/my/play' | '/my/edit', id: string) => `${resolve(path)}?id=${encodeURIComponent(id)}`;

	async function refresh() {
		scripts = await listScripts();
	}
	onMount(async () => {
		persistent = await isPersistent();
		await refresh();
	});

	async function onfile(file: File) {
		message = null;
		try {
			if (/\.(cuescript|json)$/i.test(file.name)) {
				const text = await file.text();
				if (isProductionFile(text)) return openProduction(text);
				if (/\.cuescript$/i.test(file.name)) throw new Error('This .cuescript file is damaged and can’t be opened.');
			}
			busy = 'Reading your script…';
			const source = await readScriptFile(file, (m) => (busy = m));
			setPending(source);
			await goto(resolve('/my/new'));
		} catch (e) {
			message = { text: (e as Error).message, tone: 'error' };
		} finally {
			busy = null;
		}
	}

	async function ontext(text: string) {
		if (isProductionFile(text)) return openProduction(text);
		setPending(sourceFromText(text));
		await goto(resolve('/my/new'));
	}

	async function openProduction(text: string) {
		try {
			const { record, status } = await importProduction(text);
			await refresh();
			highlight = record.id;
			message = {
				tone: 'ok',
				text:
					status === 'added'
						? `Added “${record.title}”. Open it and choose your part.`
						: status === 'updated'
							? `Updated “${record.title}” to the latest version from your director.`
							: `You already have the latest “${record.title}”.`
			};
		} catch (e) {
			message = { text: (e as Error).message, tone: 'error' };
		}
	}

	async function share(id: string) {
		sharing = await getScript(id);
	}
	async function remove(id: string) {
		await deleteScript(id);
		confirming = null;
		await refresh();
	}

	const when = (t: number) => {
		const d = (Date.now() - t) / 86400000;
		if (d < 1 / 24) return 'just now';
		if (d < 1) return `${Math.round(d * 24)} h ago`;
		if (d < 7) return `${Math.round(d)} ${Math.round(d) === 1 ? 'day' : 'days'} ago`;
		return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
	};
	const FORMAT: Record<string, string> = { text: 'text', docx: 'Word', pdf: 'PDF', tei: 'TEI' };
</script>

<svelte:head>
	<title>Your scripts · Cue Script</title>
</svelte:head>

<div class="page">
	<header>
		<Fleuron width="8rem" />
		<h1>Your scripts</h1>
		<p class="lede">
			Bring any play: your production’s cut, a classic, or a brand-new script. You’ll get a cue script for every part.
		</p>
		<p class="private"><Icon name="eye-off" /> Scripts are read and kept in this browser. They’re never uploaded anywhere.</p>
	</header>

	{#if !persistent}
		<p class="banner error">This browser won’t let Cue Script save files (private browsing?). Scripts will be forgotten when you close the tab.</p>
	{/if}

	<Dropzone {onfile} {ontext} {busy} />

	{#if message}
		<p class="banner {message.tone}" role="status">{message.text}</p>
	{/if}

	{#if scripts && scripts.length}
		<section class="shelf" aria-label="Saved scripts">
			<h2>On your shelf</h2>
			<ul>
				{#each scripts as s (s.id)}
					<li class:highlight={highlight === s.id}>
						<a class="card sheet" href={href('/my/play', s.id)}>
							<span class="title">{s.title}</span>
							<span class="meta">
								{s.parts} parts · {s.lines.toLocaleString()} lines
								{#if s.importedAt}· <em>from your director</em>{:else if s.fileName}· from <em>{s.fileName}</em>{:else}· {FORMAT[s.format]}{/if}
							</span>
							<span class="when">updated {when(s.updatedAt)}</span>
						</a>
						<div class="tools">
							<a class="btn" href={href('/my/edit', s.id)}>Edit cast</a>
							<button class="btn" type="button" onclick={() => share(s.id)}>Send to cast</button>
							{#if confirming === s.id}
								<span class="confirm">
									Delete?
									<button class="btn danger" type="button" onclick={() => remove(s.id)}>Delete</button>
									<button class="btn" type="button" onclick={() => (confirming = null)}>Keep</button>
								</span>
							{:else}
								<button class="icon-btn" type="button" onclick={() => (confirming = s.id)} aria-label="Delete {s.title}" title="Delete">
									<Icon name="close" />
								</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{:else if scripts}
		<p class="empty">Nothing on your shelf yet. Your first script will appear here.</p>
	{/if}

	<section class="tips" aria-label="Tips">
		<h2>Getting the best results</h2>
		<ul>
			<li><b>Word</b> works best, especially scripts using “Character” and “Dialogue” styles.</li>
			<li><b>Speaker names</b> can be in capitals before the speech (<code>HAMLET. To be…</code>) or on their own line above it.</li>
			<li><b>Stage directions</b> are recognised in <i>italics</i>, (parentheses) or [brackets], or when they start with <i>Enter</i>, <i>Exit</i> or <i>Exeunt</i>.</li>
			<li><b>Acts and scenes</b> are found from headings like <code>ACT 2</code> and <code>Scene 3</code>.</li>
			<li><b>PDFs</b> vary a lot. If one reads badly, copy its text and paste it instead.</li>
		</ul>
	</section>
</div>

{#if sharing}
	<ShareDialog record={sharing} onclose={() => (sharing = null)} />
{/if}

<style>
	.page {
		max-width: 46rem;
		margin: 0 auto;
		padding: 1rem clamp(1rem, 4vw, 1.5rem) 0;
	}
	header {
		text-align: center;
		margin: 1.5rem 0 1.75rem;
	}
	h1 {
		font-size: clamp(2.6rem, 8vw, 3.8rem);
		margin: 0.6rem 0 0.5rem;
	}
	.lede {
		font-size: 1.2rem;
		color: var(--ink-soft);
		max-width: 34rem;
		margin: 0 auto 0.6rem;
	}
	.private {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.95rem;
		color: var(--ink-faint);
		font-style: italic;
		margin: 0;
	}
	.private :global(svg) {
		width: 1rem;
		height: 1rem;
	}
	.banner {
		margin: 1rem 0;
		padding: 0.65rem 1rem;
		border-radius: 10px;
		text-align: center;
		animation: pop 0.3s var(--ease);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}
	.banner.ok {
		background: color-mix(in srgb, var(--gold) 16%, transparent);
	}
	.banner.error {
		background: var(--rubric-soft);
		color: var(--rubric);
	}
	h2 {
		font-size: 1.6rem;
		margin-bottom: 0.75rem;
	}
	.shelf {
		margin-top: 2.25rem;
	}
	.shelf ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1rem;
	}
	.shelf li.highlight .card {
		box-shadow:
			0 0 0 2px var(--rubric),
			var(--shadow-md);
	}
	.card {
		display: flex;
		flex-direction: column;
		padding: 1rem 1.25rem;
		text-decoration: none;
		color: var(--ink);
		transition:
			transform 0.25s var(--ease),
			box-shadow 0.25s var(--ease);
	}
	.card:hover {
		color: var(--ink);
		transform: translateY(-2px);
		box-shadow: var(--shadow-lg);
	}
	.title {
		font-family: var(--font-display);
		font-size: 1.6rem;
		line-height: 1.15;
	}
	.card:hover .title {
		color: var(--rubric);
	}
	.meta {
		color: var(--ink-soft);
		font-size: 1rem;
	}
	.when {
		color: var(--ink-faint);
		font-size: 0.9rem;
		font-style: italic;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin-top: 0.5rem;
		padding-left: 0.25rem;
	}
	.tools .btn {
		font-size: 0.88rem;
		text-decoration: none;
	}
	.confirm {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-style: italic;
		color: var(--rubric);
	}
	.btn.danger {
		background: var(--rubric);
		border-color: var(--rubric);
		color: var(--paper);
	}
	.empty {
		text-align: center;
		color: var(--ink-faint);
		font-style: italic;
		margin: 2rem 0;
	}
	.tips {
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--rule);
	}
	.tips h2 {
		font-size: 1.3rem;
	}
	.tips ul {
		padding-left: 1.2rem;
		color: var(--ink-soft);
		font-size: 1.02rem;
	}
	.tips li {
		margin-bottom: 0.35rem;
	}
	.tips b {
		font-family: var(--font-sc);
		font-weight: 400;
		color: var(--ink);
	}
	code {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.85em;
		background: var(--paper-2);
		padding: 0.05rem 0.3rem;
		border-radius: 3px;
	}
</style>
