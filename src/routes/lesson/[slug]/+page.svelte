<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { renderCard } from '$lib/content';

	let { data } = $props();
	const lesson = $derived(data.lesson);
	const cards = $derived(lesson.cards.map((c) => renderCard(lesson, c)));

	let index = $state(0);
	let direction = $state(1);
	const card = $derived(cards[index]);
	const isLast = $derived(index === cards.length - 1);
	const quizHref = $derived(resolve('/lesson/[slug]/quiz', { slug: lesson.slug }) + '/');

	// Quiz review links open a specific card with ?card=N. Read it after mount
	// because pages are prerendered without a query string.
	onMount(() => {
		const n = Number(new URL(location.href).searchParams.get('card'));
		if (n >= 1 && n <= cards.length) index = n - 1;
	});

	function go(step: number) {
		const next = index + step;
		if (next < 0) return;
		if (next >= cards.length) {
			goto(quizHref);
			return;
		}
		direction = step;
		index = next;
	}

	// Swipe: a mostly-horizontal drag of 50px or more turns the page.
	let start: { x: number; y: number } | null = null;
	function onpointerdown(e: PointerEvent) {
		start = { x: e.clientX, y: e.clientY };
	}
	function onpointerup(e: PointerEvent) {
		if (!start) return;
		const dx = e.clientX - start.x;
		const dy = e.clientY - start.y;
		start = null;
		if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') go(1);
		if (e.key === 'ArrowLeft') go(-1);
	}
</script>

<svelte:head>
	<title>{lesson.title} · Social Studies</title>
</svelte:head>

<svelte:window {onkeydown} />

<div class="screen">
	<header class="band">
		<div class="inner">
			<h1>{lesson.subjectName}</h1>
			<a class="close" href={resolve('/')} aria-label="Back to all lessons">✕</a>
		</div>
	</header>

	<main
		class="stage"
		{onpointerdown}
		{onpointerup}
		onpointercancel={() => (start = null)}
		aria-live="polite"
	>
		{#key index}
			<article class="card" in:fly={{ x: direction * 48, duration: 220 }}>
				<p class="kicker">{lesson.title}</p>
				<div class="body">{@html card.html}</div>
				{#if card.citations.length}
					<ol class="citations">
						{#each card.citations as source (source.id)}
							<li><a href={source.url} target="_blank" rel="noopener">{source.label}</a></li>
						{/each}
					</ol>
				{/if}
			</article>
		{/key}
	</main>

	<footer>
		<div class="inner">
			<button class="back" onclick={() => go(-1)} disabled={index === 0}>← Back</button>
			<div class="position">
				<div class="dots" aria-hidden="true">
					{#each cards as _, i (i)}
						<span class:on={i === index}></span>
					{/each}
				</div>
				<span class="count">{index + 1}/{cards.length}</span>
			</div>
			{#if isLast}
				<a class="btn primary" href={quizHref}>Take Quiz</a>
			{:else}
				<button class="btn primary" onclick={() => go(1)}>Next Page</button>
			{/if}
		</div>
	</footer>
</div>

<style>
	.screen {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.inner {
		max-width: var(--max);
		margin: 0 auto;
	}

	header {
		flex: none;
		padding: calc(10px + env(safe-area-inset-top)) var(--gutter) 8px;
	}

	header .inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.35rem, 6.5vw, 1.8rem);
		font-weight: 600;
	}

	.close {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		margin-right: -8px;
		font-family: var(--font-body);
		font-size: 1.3rem;
		text-decoration: none;
	}

	.stage {
		flex: 1;
		min-height: 0;
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
		overflow: hidden;
	}

	.card {
		height: 100%;
		max-width: var(--max);
		margin: 0 auto;
		padding: 10px var(--gutter) 4px;
		display: flex;
		flex-direction: column;
		/* Cards are capped at 120 words so they fit; this is only a safety net for tiny screens. */
		overflow-y: auto;
		font-size: clamp(14px, 2.4dvh, 18px);
		line-height: 1.45;
	}

	.kicker {
		margin: 0 0 2px;
		font-family: var(--font-poster);
		font-weight: 600;
		font-size: 0.85em;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--red);
	}

	.body :global(p) {
		margin: 0 0 0.6em;
	}

	.body :global(blockquote) {
		margin: 0 0 0.6em;
		padding: 0.1em 0 0.1em 0.9em;
		border-left: 4px solid var(--red);
		font-style: italic;
	}

	.body :global(blockquote p) {
		margin: 0;
	}

	.body :global(strong) {
		font-weight: 600;
	}

	.body :global(.cite) {
		font-style: normal;
		font-size: 0.65em;
		font-weight: 600;
		color: var(--red);
		margin-left: 1px;
	}

	.citations {
		margin: auto 0 0;
		padding: 6px 0 0 1.3em;
		border-top: 1px solid var(--rule);
		font-size: 0.72em;
		line-height: 1.35;
		color: var(--ink-soft);
		user-select: text;
		-webkit-user-select: text;
	}

	.citations a {
		text-decoration-color: var(--rule);
	}

	footer {
		flex: none;
		padding: 10px var(--gutter) calc(10px + env(safe-area-inset-bottom));
		border-top: 1px solid var(--rule);
		background: var(--paper);
	}

	footer .inner {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.position {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.dots {
		display: flex;
		gap: 5px;
	}

	.dots span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--rule);
		transition: background 0.2s;
	}

	.dots span.on {
		background: var(--red);
	}

	.count {
		font-family: var(--font-poster);
		font-size: 0.8rem;
		line-height: 1;
		color: var(--ink-soft);
	}

	.back {
		flex: none;
		min-height: 48px;
		padding: 0 4px;
		border: 0;
		background: none;
		font-family: var(--font-poster);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.back:disabled {
		visibility: hidden;
	}

	footer .btn {
		flex: none;
		width: 9.5em;
		padding: 0 12px;
	}
</style>
