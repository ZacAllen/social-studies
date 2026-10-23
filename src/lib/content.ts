import { marked } from 'marked';
import { parseLesson, CITATION } from './lesson.js';
import type { Card, Lesson, Source } from './lesson.js';

export type { Lesson, Question, Source } from './lesson.js';

const files = import.meta.glob<string>('/src/content/*/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

/** Typographer's quotes; content is written with straight quotes so quotes stay easy to check. */
function smartQuotes(text: string) {
	return text.replace(/"([^"]+)"/g, '“$1”').replace(/(\w)'/g, '$1’').replace(/'(\w)/g, '‘$1');
}

export const lessons: Lesson[] = Object.entries(files)
	.map(([path, raw]) => parseLesson(path, raw))
	.map((lesson) => ({
		...lesson,
		quiz: lesson.quiz.map((q) => ({
			...q,
			q: smartQuotes(q.q),
			options: q.options.map(smartQuotes),
			explain: smartQuotes(q.explain)
		}))
	}))
	.sort((a, b) => a.subjectOrder - b.subjectOrder || a.order - b.order);

export const subjects = lessons.reduce<{ name: string; slug: string; lessons: Lesson[] }[]>(
	(acc, lesson) => {
		const last = acc.at(-1);
		if (last?.slug === lesson.subjectSlug) last.lessons.push(lesson);
		else acc.push({ name: lesson.subject, slug: lesson.subjectSlug, lessons: [lesson] });
		return acc;
	},
	[]
);

export function getLesson(slug: string) {
	return lessons.find((l) => l.slug === slug);
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
