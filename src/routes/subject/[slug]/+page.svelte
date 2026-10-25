<script lang="ts">
	import { resolve } from '$app/paths';
	import { progress } from '$lib/progress.svelte';

	let { data } = $props();
	const subject = $derived(data.subject);
</script>

<svelte:head>
	<title>{subject.name} · Social Studies</title>
</svelte:head>

<header class="band">
	<div class="inner">
		<h1>{subject.name}</h1>
		<a class="close" href={resolve('/')} aria-label="Back to all subjects">✕</a>
	</div>
</header>

<main>
	<p class="description">{subject.description}</p>
	<ol>
		{#each subject.lessons as lesson, i (lesson.slug)}
			{@const result = progress.results[lesson.slug]}
			<li>
				<a href={resolve('/lesson/[slug]', { slug: lesson.slug }) + '/'}>
					<span class="num">{i + 1}</span>
					<span class="text">
						<span class="title">{lesson.title}</span>
						<span class="meta">
							<span class="kind">{lesson.kind === 'reading' ? 'Reading' : 'Study'}</span>
							· {lesson.cards.length} cards · {lesson.quiz.length}-question quiz
						</span>
					</span>
					{#if result}
						<span class="done" aria-label="Completed, best score {result.best} of {result.total}">
							✓ {result.best}/{result.total}
						</span>
					{/if}
				</a>
			</li>
		{/each}
	</ol>
</main>

<style>
	.inner {
		max-width: var(--max);
		margin: 0 auto;
	}

	header {
		padding: calc(14px + env(safe-area-inset-top)) var(--gutter) 12px;
	}

	header .inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.6rem, 8vw, 2.2rem);
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

	main {
		max-width: var(--max);
		margin: 0 auto;
		padding: 8px var(--gutter) calc(40px + env(safe-area-inset-bottom));
	}

	.description {
		margin: 12px 0 6px;
		padding-bottom: 12px;
		border-bottom: 3px solid var(--ink);
		font-style: italic;
		line-height: 1.4;
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li + li {
		border-top: 1px solid var(--rule);
	}

	a {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 0;
		text-decoration: none;
	}

	.num {
		flex: none;
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-poster);
		font-weight: 600;
	}

	.text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.title {
		font-size: 1.1rem;
		font-weight: 600;
		line-height: 1.25;
	}

	.meta {
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	.kind {
		font-family: var(--font-poster);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--red);
	}

	.done {
		flex: none;
		font-family: var(--font-poster);
		font-weight: 600;
		color: var(--red);
		white-space: nowrap;
	}
</style>
