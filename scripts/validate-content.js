// Fails the build if any lesson breaks the content rules. Run: npm run validate
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLesson, countWords } from '../src/lib/lesson.js';

const CONTENT_DIR = 'src/content';
const MAX_WORDS = 120;
const QUIZ_LENGTH = 5;
const OPTION_COUNT = 4;

const errors = [];
const slugs = new Map();
let lessonCount = 0;

for (const subjectDir of readdirSync(CONTENT_DIR).sort()) {
	if (!/^\d+-/.test(subjectDir)) {
		errors.push(`${subjectDir}: subject folders must start with a number, e.g. 01-${subjectDir}`);
		continue;
	}
	for (const file of readdirSync(join(CONTENT_DIR, subjectDir)).filter((f) => f.endsWith('.md'))) {
		const path = `/${CONTENT_DIR}/${subjectDir}/${file}`;
		const fail = (msg) => errors.push(`${path}: ${msg}`);
		let lesson;
		try {
			lesson = parseLesson(path, readFileSync(join(CONTENT_DIR, subjectDir, file), 'utf8'));
		} catch (e) {
			fail(e.message);
			continue;
		}
		lessonCount++;

		if (slugs.has(lesson.slug)) fail(`duplicate slug "${lesson.slug}" (also in ${slugs.get(lesson.slug)})`);
		slugs.set(lesson.slug, path);
		for (const key of ['title', 'subject', 'order']) if (lesson[key] == null) fail(`missing "${key}"`);

		const sourceIds = new Set();
		for (const s of lesson.sources) {
			if (!s.id || !s.label) fail(`source needs an id and label: ${JSON.stringify(s)}`);
			if (!/^https?:\/\//.test(s.url ?? '')) fail(`source "${s.id}" has no URL`);
			sourceIds.add(s.id);
		}

		if (lesson.cards.length === 0) fail('has no cards');
		const cited = new Set();
		lesson.cards.forEach((card, i) => {
			const words = countWords(card.markdown);
			if (words > MAX_WORDS) fail(`card ${i + 1} has ${words} words (max ${MAX_WORDS})`);
			for (const id of card.sourceIds) {
				if (!sourceIds.has(id)) fail(`card ${i + 1} cites unknown source "${id}"`);
				cited.add(id);
			}
		});
		for (const id of sourceIds) if (!cited.has(id)) fail(`source "${id}" is never cited`);

		if (lesson.quiz.length !== QUIZ_LENGTH) fail(`quiz has ${lesson.quiz.length} questions (need ${QUIZ_LENGTH})`);
		lesson.quiz.forEach((q, i) => {
			const n = `question ${i + 1}`;
			if (!q.q) fail(`${n} has no text`);
			if (q.options?.length !== OPTION_COUNT) fail(`${n} needs exactly ${OPTION_COUNT} options`);
			if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length ?? 0))
				fail(`${n} answer index is out of range`);
			if (!q.explain) fail(`${n} has no explanation`);
			if (!Number.isInteger(q.card) || q.card < 1 || q.card > lesson.cards.length)
				fail(`${n} points to card ${q.card}, but the lesson has ${lesson.cards.length} cards`);
		});
	}
}

if (errors.length) {
	console.error(`Content validation failed:\n  ${errors.join('\n  ')}`);
	process.exit(1);
}
console.log(`Content OK: ${lessonCount} lessons.`);
