// Turns content files into the curriculum and its list of rule violations. Shared by the app
// (at build time) and the scripts, so it must stay plain JS with no Svelte/Vite imports.
import { parse as parseYaml } from 'yaml';

/**
 * @typedef {{ path: string, raw: string }} ContentFile
 * @typedef {{ id: string, label: string, url: string, manual?: boolean }} Source
 * @typedef {{ q: string, options: string[], answer: number, explain: string, card: number }} Question
 * @typedef {{ markdown: string, sourceIds: string[] }} Card
 * @typedef {{ author: string, title: string, year: number, url: string }} Work
 * @typedef {{
 *   slug: string, title: string, kind: 'reading' | 'study', work?: Work,
 *   sources: Source[], quiz: Question[], cards: Card[],
 *   subjectSlug: string, subjectName: string
 * }} Lesson
 * @typedef {{ slug: string, name: string, description: string, lessons: Lesson[] }} Subject
 * @typedef {{ best: number, total: number, attempts: number }} LessonResult
 */

export const SUBJECT_FILE = 'subject.yml';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const CARD_BREAK = /^\s*---\s*$/m;
const PREFIX = /^\d+-/;
const KINDS = /** @type {const} */ (['reading', 'study']);
const MAX_WORDS = 120;
const QUIZ_LENGTH = 5;
const OPTION_COUNT = 4;
export const CITATION = /\[\^([\w-]+)\]/g;

/**
 * @param {ContentFile[]} files subject metadata files and lesson files
 * @returns {{ subjects: Subject[], errors: string[] }}
 */
export function buildCurriculum(files) {
	/** @type {string[]} */
	const errors = [];
	/** @typedef {{ dir: string, path: string, meta?: Record<string, unknown>, lessons: { file: string, path: string, raw: string }[] }} Folder */
	/** @type {Map<string, Folder>} */
	const folders = new Map();

	for (const { path, raw } of files) {
		const cut = path.lastIndexOf('/');
		const folderPath = path.slice(0, cut);
		const file = path.slice(cut + 1);
		let folder = folders.get(folderPath);
		if (!folder) {
			folder = { dir: folderPath.slice(folderPath.lastIndexOf('/') + 1), path: folderPath, lessons: [] };
			folders.set(folderPath, folder);
		}
		if (file === SUBJECT_FILE) {
			try {
				folder.meta = parseYaml(raw) ?? {};
			} catch (e) {
				errors.push(`${path}: can't be parsed: ${/** @type {Error} */ (e).message}`);
				folder.meta = {};
			}
		} else if (file.endsWith('.md')) folder.lessons.push({ file, path, raw });
	}

	/** @type {Subject[]} */
	const subjects = [];
	/** @type {Map<string, string>} slug → path of the lesson that has it */
	const slugs = new Map();
	const byPrefix = (/** @type {string} */ a, /** @type {string} */ b) => parseInt(a, 10) - parseInt(b, 10);
	const valid = [...folders.values()].filter((f) => {
		if (PREFIX.test(f.dir)) return true;
		errors.push(`${f.path}: subject folders must start with a number, e.g. 01-${f.dir}`);
		return false;
	});
	for (const { dir, path, meta, lessons } of valid.sort((a, b) => byPrefix(a.dir, b.dir))) {
		if (!meta) errors.push(`${path}: missing its ${SUBJECT_FILE} metadata file`);
		else
			for (const key of ['name', 'description'])
				if (!meta[key]) errors.push(`${path}/${SUBJECT_FILE}: missing "${key}"`);
		if (lessons.length === 0) errors.push(`${path}: has no lessons`);
		lessons.sort((a, b) => byPrefix(a.file, b.file));
		const subject = {
			slug: dir.replace(PREFIX, ''),
			name: /** @type {string} */ (meta?.name),
			description: /** @type {string} */ (meta?.description),
			lessons: /** @type {Lesson[]} */ ([])
		};
		for (const { file, path, raw } of lessons) {
			const fail = (/** @type {string} */ msg) => errors.push(`${path}: ${msg}`);
			if (!PREFIX.test(file)) {
				fail(`lesson files must start with a number, e.g. 01-${file}`);
				continue;
			}
			const match = FRONTMATTER.exec(raw);
			if (!match) {
				fail('missing frontmatter');
				continue;
			}
			let fm;
			try {
				fm = parseYaml(match[1]) ?? {};
			} catch (e) {
				fail(`frontmatter can't be parsed: ${/** @type {Error} */ (e).message}`);
				continue;
			}
			if (typeof fm !== 'object' || Array.isArray(fm)) {
				fail('frontmatter must be a set of "key: value" fields');
				continue;
			}
			/** @type {Lesson} */
			const lesson = {
				slug: file.replace(/\.md$/, '').replace(PREFIX, ''),
				title: fm.title,
				kind: fm.kind,
				...(fm.work ? { work: fm.work } : {}),
				sources: fm.sources ?? [],
				quiz: fm.quiz ?? [],
				cards: parseCards(match[2]),
				subjectSlug: subject.slug,
				subjectName: subject.name
			};
			checkLesson(lesson, fm, fail);
			const twin = slugs.get(lesson.slug);
			if (twin) fail(`duplicate slug "${lesson.slug}" (also in ${twin})`);
			else slugs.set(lesson.slug, path);
			subject.lessons.push(lesson);
		}
		subjects.push(subject);
	}
	return { subjects, errors };
}

/**
 * @param {Lesson} lesson
 * @param {Record<string, unknown>} fm the raw frontmatter, for fields the lesson doesn't carry
 * @param {(msg: string) => void} fail
 */
function checkLesson(lesson, fm, fail) {
	if (!KINDS.includes(lesson.kind)) fail(`"kind" must be one of ${KINDS.join(', ')}`);
	for (const key of ['subject', 'order'])
		if (key in fm) fail(`"${key}" is retired: the subject and order come from the folder and filename`);

	if (lesson.title == null) fail('missing "title"');

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

	const { work } = lesson;
	if (lesson.kind === 'study' && fm.work != null) fail('a Study must not declare a main "work"');
	if (lesson.kind === 'reading') {
		if (!work) fail('a Reading must declare its main "work"');
		else {
			for (const key of /** @type {const} */ (['author', 'title', 'year']))
				if (work[key] == null || work[key] === '') fail(`main work is missing "${key}"`);
			if (!/^https?:\/\//.test(work.url ?? '')) fail('main work needs an http(s) "url"');
		}
	}
}

/** @param {string} body */
function parseCards(body) {
	return body
		.split(CARD_BREAK)
		.map((text) => text.trim())
		.filter(Boolean)
		.map((markdown) => ({
			markdown,
			sourceIds: [...new Set([...markdown.matchAll(CITATION)].map((m) => m[1]))]
		}));
}

/**
 * @param {Subject} subject
 * @param {Record<string, LessonResult>} results
 */
export function subjectProgress(subject, results) {
	const done = subject.lessons.filter((l) => (results[l.slug]?.attempts ?? 0) > 0).length;
	return { done, total: subject.lessons.length };
}

/**
 * Words a reader sees on a card: citation markers and Markdown syntax don't count.
 * @param {string} markdown
 */
export function countWords(markdown) {
	return markdown
		.replace(CITATION, '')
		.replace(/[>*_#`]/g, ' ')
		.split(/\s+/)
		.filter((w) => /\w/.test(w)).length;
}

/**
 * Direct quotations on a card: anything in straight double quotes.
 * @param {string} markdown
 */
export function extractQuotes(markdown) {
	return [...markdown.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}
