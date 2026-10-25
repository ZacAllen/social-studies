<script lang="ts">
	import { subjects, subjectHref } from '$lib/content';
	import { subjectProgress } from '$lib/curriculum.js';
	import { progress } from '$lib/progress.svelte';
</script>

<svelte:head>
	<title>Social Studies</title>
</svelte:head>

<header class="masthead band">
	<h1>Social Studies</h1>
	<p>Revolutionary theory and history, for study and practice.</p>
</header>

<main>
	<ol>
		{#each subjects as subject, i (subject.slug)}
			{@const { done, total } = subjectProgress(subject, progress.results)}
			<li>
				<a href={subjectHref(subject.slug)}>
					<span class="text">
						<span class="name">
							{subject.name}
							{#if i === 0}<span class="start">Start here</span>{/if}
						</span>
						<span class="description">{subject.description}</span>
						<span class="meta">{total} {total === 1 ? 'lesson' : 'lessons'}</span>
					</span>
					<span class="done">{done} of {total} done</span>
				</a>
			</li>
		{/each}
	</ol>
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
		padding: 18px 0;
		text-decoration: none;
	}

	.text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.name {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		font-family: var(--font-poster);
		font-weight: 600;
		font-size: 1.3rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		line-height: 1.1;
	}

	.start {
		padding: 4px 7px;
		background: var(--red);
		color: var(--red-ink);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		line-height: 1;
	}

	.description {
		line-height: 1.35;
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
