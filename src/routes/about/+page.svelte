<script lang="ts">
	import { resolve } from '$app/paths';
	import Fleuron from '#lib/components/Fleuron.svelte';
</script>

<svelte:head>
	<title>About · Cue Script</title>
</svelte:head>

<article class="about sheet">
	<p class="sc kicker">About</p>
	<h1>What is a cue script?</h1>
	<Fleuron width="10rem" />

	<p class="drop">
		In Shakespeare’s playhouse, paper was dear and plays were jealously guarded. So no actor was handed the
		whole script. Each player got a <em>part</em>: a long strip of paper, rolled up (hence <em>role</em>), with
		only his own speeches written out. Before each speech came a <em>cue</em>, the last word or three of
		whatever was said before it, set off by a long rule.
	</p>
	<p>
		The player learned the part alone, and often first heard the rest of the play at rehearsal. You can still
		feel the method in the verse. A cue such as “…<em>praise it bears</em>” is all the warning you get, so
		you <em>listen</em> on stage in a way that reading the full text never teaches.
	</p>
	<p>
		This site makes a cue script for every speaking part in 37 plays. In <b>Read</b> mode you see your part as
		a player of 1610 might have. Slide the cue length from a single word up to the whole preceding speech. In
		<b>Rehearse</b> mode your lines are inked over, and you uncover them a word or line at a time. <b>Run
		lines</b> takes you onto a candle-lit stage where the cues can be read aloud and you answer them.
	</p>

	<h2>The text</h2>
	<p>
		The plays are the <a href="https://www.folger.edu/explore/shakespeares-works/">Folger Shakespeare</a>
		editions, edited by Barbara A. Mowat and Paul Werstine, © Folger Shakespeare Library. They are used under
		a <a href="https://creativecommons.org/licenses/by-nc/3.0/">Creative Commons Attribution-NonCommercial 3.0</a>
		licence. We read the Folger’s TEI Simple encoding as mirrored by
		<a href="https://dracor.org/shake">DraCor</a>, and generate each part from it. The idea comes from the
		Folger’s own <a href="https://www.folgerdigitaltexts.org/">parts tool</a>.
	</p>
	<p>
		Line numbers in the margin are Folger Through Line Numbers by act and scene, so you can find your place in
		any Folger edition.
	</p>

	<h2>Your own scripts</h2>
	<p>
		Under <a href={resolve('/my')}>Your scripts</a> you can bring any play: a cut of Shakespeare, another classic,
		or a new play, as a Word document, PDF, plain text or TEI XML. Cue Script works out who speaks when, lets you
		check and correct the cast, and makes every part. A director can then send the cast a small
		<em>.cuescript</em> file so everyone rehearses from the same version.
	</p>
	<p>
		Your scripts are read and stored only in your browser. Nothing is uploaded to a server, so nobody else can
		see them. That also means they live on one device: to move a script, send yourself its file.
	</p>

	<p class="back"><a href={resolve('/')}>← Choose a part</a></p>
</article>

<style>
	.about {
		max-width: 44rem;
		margin: 1rem auto 0;
		padding: 2.5rem clamp(1.25rem, 6vw, 4rem);
	}
	.kicker {
		text-align: center;
		color: var(--ink-faint);
		letter-spacing: 0.25em;
		margin: 0;
	}
	h1 {
		text-align: center;
		font-size: clamp(2.3rem, 7vw, 3.4rem);
		margin: 0.2rem 0 1rem;
	}
	h2 {
		font-size: 1.6rem;
		margin: 2rem 0 0.6rem;
	}
	.drop {
		margin-top: 1.75rem;
	}
	.drop::first-letter {
		float: left;
		font-family: var(--font-display);
		color: var(--rubric);
		font-size: 4.1em;
		line-height: 0.8;
		padding: 0.08em 0.1em 0 0;
	}
	b {
		font-family: var(--font-sc);
		font-weight: 400;
	}
	.back {
		margin-top: 2rem;
		text-align: center;
		font-family: var(--font-sc);
	}
</style>
