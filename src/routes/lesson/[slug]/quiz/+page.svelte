<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { progress } from '$lib/progress.svelte';

	let { data } = $props();
	const lesson = $derived(data.lesson);
	const quiz = $derived(lesson.quiz);
	const lessonHref = $derived(resolve('/lesson/[slug]', { slug: lesson.slug }) + '/');

	// orders[q] lists option indices in display order; answers[q] is the chosen original index.
	let orders = $state<number[][] | null>(null);
	let answers = $state<(number | null)[]>([]);
	let submitted = $state(false);

	const answeredCount = $derived(answers.filter((a) => a !== null).length);
	const score = $derived(answers.filter((a, i) => a === quiz[i].answer).length);

	function shuffled(n: number) {
		const a = [...Array(n).keys()];
		for (let i = n - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	function start() {
		orders = quiz.map((q) => shuffled(q.options.length));
		answers = quiz.map(() => null);
		submitted = false;
	}

	// Shuffle in the browser only, so each attempt gets a fresh order.
	onMount(start);

	async function submit() {
		submitted = true;
		progress.record(lesson.slug, score, quiz.length);
		await tick();
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function retake() {
		start();
		await tick();
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>Quiz: {lesson.title} · Social Studies</title>
</svelte:head>

<header class="band">
	<div class="inner">
		<h1>{lesson.subject}</h1>
		<a class="close" href={resolve('/')} aria-label="Back to all lessons">✕</a>
	</div>
</header>

<main class="inner">
	<p class="kicker">Quiz · {lesson.title}</p>

	{#if submitted}
		<section class="result" aria-live="polite">
			<p class="score"><strong>{score}</strong>/{quiz.length}</p>
			<p>
				{score === quiz.length
					? 'Perfect. Solid grasp of the material.'
					: score >= quiz.length - 1
						? 'Strong work. Review what you missed below.'
						: 'Worth another pass. Each answer below links back to its card.'}
			</p>
			<div class="actions">
				<button class="btn primary" onclick={retake}>Retake</button>
				<a class="btn ghost" href={lessonHref}>Review Cards</a>
			</div>
		</section>
	{/if}

	{#if orders}
		<ol class="questions">
			{#each quiz as question, qi (qi)}
				{@const chosen = answers[qi]}
				<li class="question">
					<fieldset disabled={submitted}>
						<legend><span class="qn">{qi + 1}.</span> {question.q}</legend>
						{#each orders[qi] as oi (oi)}
							<label
								class="option"
								class:selected={chosen === oi}
								class:right={submitted && oi === question.answer}
								class:wrong={submitted && chosen === oi && oi !== question.answer}
							>
								<input type="radio" name="q{qi}" value={oi} bind:group={answers[qi]} />
								<span>{question.options[oi]}</span>
							</label>
						{/each}
					</fieldset>
					{#if submitted}
						<div class="feedback" class:missed={chosen !== question.answer}>
							<p>
								<strong>{chosen === question.answer ? 'Correct.' : 'Not quite.'}</strong>
								{question.explain}
							</p>
							<a href="{lessonHref}?card={question.card}">See card {question.card} →</a>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	{#if !submitted}
		<div class="submit">
			<button class="btn primary" onclick={submit} disabled={answeredCount < quiz.length}>Submit</button>
			{#if answeredCount < quiz.length}
				<p class="hint">{answeredCount} of {quiz.length} answered</p>
			{/if}
		</div>
	{:else}
		<section class="originals">
			<h2>Read the originals</h2>
			<ul>
				{#each lesson.sources as source (source.id)}
					<li><a href={source.url} target="_blank" rel="noopener">{source.label}</a></li>
				{/each}
			</ul>
		</section>
		<div class="actions end">
			<button class="btn primary" onclick={retake}>Retake</button>
			<a class="btn ghost" href={lessonHref}>Review Cards</a>
			<a class="btn ghost" href={resolve('/')}>Back to Lessons</a>
		</div>
	{/if}
</main>

<style>
	.inner {
		max-width: var(--max);
		margin: 0 auto;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 1;
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

	main {
		padding: 16px var(--gutter) calc(40px + env(safe-area-inset-bottom));
	}

	.kicker {
		margin: 0 0 12px;
		font-family: var(--font-poster);
		font-weight: 600;
		font-size: 0.9rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--red);
	}

	.result {
		margin-bottom: 20px;
		padding: 18px;
		background: var(--paper-deep);
		border-top: 4px solid var(--red);
	}

	.score {
		margin: 0;
		font-family: var(--font-poster);
		font-size: 1.6rem;
	}

	.score strong {
		font-size: 3.2rem;
		color: var(--red);
	}

	.result p:not(.score) {
		margin: 4px 0 14px;
	}

	.questions {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.question {
		padding: 18px 0;
		border-top: 1px solid var(--rule);
	}

	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	legend {
		padding: 0;
		margin-bottom: 12px;
		font-size: 1.08rem;
		font-weight: 600;
		line-height: 1.35;
	}

	.qn {
		font-family: var(--font-poster);
		color: var(--red);
	}

	.option {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin-top: 8px;
		padding: 12px 14px;
		border: 2px solid var(--rule);
		line-height: 1.35;
		cursor: pointer;
	}

	.option input {
		flex: none;
		margin: 2px 0 0;
		width: 18px;
		height: 18px;
		accent-color: var(--red);
	}

	.option.selected {
		border-color: var(--ink);
	}

	.option.right {
		border-color: var(--right);
		box-shadow: inset 4px 0 0 var(--right);
	}

	.option.wrong {
		border-color: var(--wrong);
		box-shadow: inset 4px 0 0 var(--wrong);
		text-decoration: line-through;
		text-decoration-color: var(--wrong);
	}

	fieldset:disabled .option {
		cursor: default;
	}

	.feedback {
		margin-top: 12px;
		padding: 10px 14px;
		background: var(--paper-deep);
		border-left: 4px solid var(--right);
		font-size: 0.95rem;
		line-height: 1.45;
	}

	.feedback.missed {
		border-left-color: var(--wrong);
	}

	.feedback p {
		margin: 0 0 6px;
	}

	.feedback a {
		font-family: var(--font-poster);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-size: 0.85rem;
		color: var(--red);
		text-decoration: none;
	}

	.submit {
		padding-top: 18px;
		border-top: 1px solid var(--rule);
	}

	.submit .btn {
		width: 100%;
	}

	.hint {
		margin: 8px 0 0;
		text-align: center;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.actions .btn {
		flex: 1 1 120px;
		padding: 0 12px;
	}

	.originals {
		padding-top: 18px;
		border-top: 1px solid var(--rule);
	}

	.originals h2 {
		margin: 0 0 8px;
		font-family: var(--font-poster);
		font-weight: 600;
		font-size: 1.2rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.originals ul {
		margin: 0 0 20px;
		padding-left: 1.2em;
		line-height: 1.45;
	}

	.originals li + li {
		margin-top: 6px;
	}
</style>
