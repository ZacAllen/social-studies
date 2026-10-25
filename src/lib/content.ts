import { resolve } from '$app/paths';
import { marked } from 'marked';
import { buildCurriculum, CITATION } from './curriculum.js';
import type { Card, Lesson, Source, Subject } from './curriculum.js';

export type { Lesson, Question, Source, Subject } from './curriculum.js';

// Glob patterns must be literals, so the subject file name is repeated here (see SUBJECT_FILE).
const files = import.meta.glob<string>(['/src/content/*/*.md', '/src/content/*/subject.yml'], {
	query: '?raw',
	import: 'default',
	eager: true
});

/** Typographer's quotes; content is written with straight quotes so quotes stay easy to check. */
function smartQuotes(text: string) {
	return text.replace(/"([^"]+)"/g, '“$1”').replace(/(\w)'/g, '$1’').replace(/'(\w)/g, '‘$1');
}

const curriculum = buildCurriculum(Object.entries(files).map(([path, raw]) => ({ path, raw })));
// `npm run validate` runs first; this is the backstop so a broken curriculum can't build.
if (curriculum.errors.length) throw new Error(`Content errors:\n  ${curriculum.errors.join('\n  ')}`);

export const lessons: Lesson[] = curriculum.lessons.map((lesson) => ({
	...lesson,
	quiz: lesson.quiz.map((q) => ({
		...q,
		q: smartQuotes(q.q),
		options: q.options.map(smartQuotes),
		explain: smartQuotes(q.explain)
	}))
}));

export const subjects: Subject[] = curriculum.subjects.map((subject) => ({
	...subject,
	lessons: lessons.filter((l) => l.subjectSlug === subject.slug)
}));

export function getLesson(slug: string) {
	return lessons.find((l) => l.slug === slug);
}

export function getSubject(slug: string) {
	return subjects.find((s) => s.slug === slug);
}

/** The subject page's URL, with the trailing slash the static build serves. */
export function subjectHref(slug: string) {
	return resolve('/subject/[slug]', { slug }) + '/';
}

export interface RenderedCard {
	html: string;
	citations: Source[];
}

/** Turns [^id] markers into superscript numbers that match the card's citation lines. */
export function renderCard(lesson: Lesson, card: Card): RenderedCard {
	const markdown = smartQuotes(card.markdown).replace(
		new RegExp(`\\s*${CITATION.source}`, 'g'),
		(_, id: string) => `<sup class="cite">${card.sourceIds.indexOf(id) + 1}</sup>`
	);
	return {
		html: marked.parse(markdown, { async: false }),
		citations: card.sourceIds.map((id) => lesson.sources.find((s) => s.id === id)!)
	};
}
