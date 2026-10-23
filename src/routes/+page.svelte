<script lang="ts">
	import { resolve } from '$app/paths';
	import { subjects } from '$lib/content';
	import { progress } from '$lib/progress.svelte';
</script>

<svelte:head>
	<title>Social Studies</title>
</svelte:head>

<header class="masthead band">
	<h1>Social Studies</h1>
	<p>Revolutionary theory and history, one card at a time.</p>
</header>

<main>
	{#each subjects as subject (subject.slug)}
		<section>
			<h2>{subject.name}</h2>
			<ol>
				{#each subject.lessons as lesson, i (lesson.slug)}
					{@const result = progress.results[lesson.slug]}
					<li>
						<a href={resolve('/lesson/[slug]', { slug: lesson.slug }) + '/'}>
							<span class="num">{i + 1}</span>
							<span class="text">
								<span class="title">{lesson.title}</span>
								<span class="meta">{lesson.cards.length} cards · {lesson.quiz.length}-question quiz</span>
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
		</section>
	{/each}
</main>

<style>
	.masthead {
		padding: calc(28px + env(safe-area-inset-top)) var(--gutter) 22px;
	}

	.masthead h1 {
		max-width: var(--max);
		margin: 0 auto;
		font-size: clamp(2.6rem, 13vw, 3.6rem);
		font-weight: 600;
	}

	.masthead p {
		max-width: var(--max);
		margin: 8px auto 0;
		font-family: var(--font-body);
		text-transform: none;
		letter-spacing: 0;
		font-style: italic;
		font-size: 1rem;
		opacity: 0.9;
	}

	main {
		max-width: var(--max);
		margin: 0 auto;
		padding: 8px var(--gutter) calc(40px + env(safe-area-inset-bottom));
	}

	h2 {
		margin: 28px 0 10px;
		padding-bottom: 6px;
		border-bottom: 3px solid var(--ink);
		font-family: var(--font-poster);
		font-weight: 600;
		font-size: 1.3rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
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

	.done {
		flex: none;
		font-family: var(--font-poster);
		font-weight: 600;
		color: var(--red);
		white-space: nowrap;
	}
</style>
