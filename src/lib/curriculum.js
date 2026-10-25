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
export const KINDS = /** @type {const} */ (['reading', 'study']);
/** @type {Record<Lesson['kind'], string>} How each kind is labelled to readers. */
export const KIND_LABELS = { reading: 'Reading', study: 'Study' };
const MAX_WORDS = 120;
const QUIZ_LENGTH = 5;
const OPTION_COUNT = 4;
export const CITATION = /\[\^([\w-]+)\]/g;

/**
 * @param {ContentFile[]} files subject metadata files and lesson files
 * @param {string[]} [subjectDirs] subject folder paths, so a folder holding no files is still reported
 * @returns {{ subjects: Subject[], lessons: Lesson[], errors: string[] }}
 */
export function buildCurriculum(files, subjectDirs = []) {
	/** @type {string[]} */
	const errors = [];
	/** @type {Subject[]} */
	const subjects = [];
	/** @type {Map<string, string>} slug → path of the lesson that has it */
	const slugs = new Map();
	const numbered = [...groupFolders(files, subjectDirs, errors).values()].filter((folder) => {
		if (PREFIX.test(folder.dir)) return true;
		errors.push(`${folder.path}: subject folders must start with a number, e.g. 01-${folder.dir}`);
		return false;
	});
	for (const { dir, path, meta, lessons } of numbered.sort((a, b) => byPrefix(a.dir, b.dir))) {
		if (!meta) errors.push(`${path}: missing its ${SUBJECT_FILE} metadata file`);
		else
			for (const key of ['name', 'description'])
				if (!meta[key]) errors.push(`${path}/${SUBJECT_FILE}: missing "${key}"`);
		if (lessons.length === 0) errors.push(`${path}: has no lessons`);
		/** @type {Subject} */
		const subject = {
			slug: dir.replace(PREFIX, ''),
			name: /** @type {string} */ (meta?.name),
			description: /** @type {string} */ (meta?.description),
			lessons: []
		};
		for (const file of lessons.sort((a, b) => byPrefix(a.file, b.file))) {
			const fail = (/** @type {string} */ msg) => errors.push(`${file.path}: ${msg}`);
			const lesson = parseLesson(file, subject, fail);
			if (!lesson) continue;
			const firstPath = slugs.get(lesson.slug);
			if (firstPath) fail(`duplicate slug "${lesson.slug}" (also in ${firstPath})`);
			else slugs.set(lesson.slug, file.path);
			subject.lessons.push(lesson);
		}
		subjects.push(subject);
	}
	return { subjects, lessons: subjects.flatMap((s) => s.lessons), errors };
}

/** @param {string} a @param {string} b */
const byPrefix = (a, b) => parseInt(a, 10) - parseInt(b, 10);

/**
 * @typedef {{ file: string, path: string, raw: string }} LessonFile
 * @typedef {{ dir: string, path: string, meta?: Record<string, unknown>, lessons: LessonFile[] }} Folder
 */

/**
 * Groups files by their subject folder, parsing each folder's metadata file.
 * @param {ContentFile[]} files
 * @param {string[]} subjectDirs
 * @param {string[]} errors
 */
function groupFolders(files, subjectDirs, errors) {
	/** @type {Map<string, Folder>} */
	const folders = new Map();
	const folderAt = (/** @type {string} */ path) => {
		let folder = folders.get(path);
		if (!folder) {
			folder = { dir: path.slice(path.lastIndexOf('/') + 1), path, lessons: [] };
			folders.set(path, folder);
		}
		return folder;
	};
	for (const dir of subjectDirs) folderAt(dir);
	for (const { path, raw } of files) {
		const cut = path.lastIndexOf('/');
		const folder = folderAt(path.slice(0, cut));
		const file = path.slice(cut + 1);
		if (file === SUBJECT_FILE) {
			try {
				folder.meta = parseYaml(raw) ?? {};
			} catch (e) {
				errors.push(`${path}: can't be parsed: ${/** @type {Error} */ (e).message}`);
				folder.meta = {};
			}
		} else if (file.endsWith('.md')) folder.lessons.push({ file, path, raw });
	}
	return folders;
}

/**
 * Parses one lesson file and checks it, or returns nothing if it can't be read as a lesson.
 * @param {LessonFile} lessonFile
 * @param {Subject} subject
 * @param {(msg: string) => void} fail
 * @returns {Lesson | undefined}
 */
function parseLesson({ file, raw }, subject, fail) {
	if (!PREFIX.test(file)) return void fail(`lesson files must start with a number, e.g. 01-${file}`);
	const match = FRONTMATTER.exec(raw);
	if (!match) return void fail('missing frontmatter');
	let frontmatter;
	try {
		frontmatter = parseYaml(match[1]) ?? {};
	} catch (e) {
		return void fail(`frontmatter can't be parsed: ${/** @type {Error} */ (e).message}`);
	}
	if (typeof frontmatter !== 'object' || Array.isArray(frontmatter))
		return void fail('frontmatter must be a set of "key: value" fields');
	/** @type {Lesson} */
	const lesson = {
		slug: file.replace(/\.md$/, '').replace(PREFIX, ''),
		title: frontmatter.title,
		kind: frontmatter.kind,
		...(frontmatter.work ? { work: frontmatter.work } : {}),
		sources: frontmatter.sources ?? [],
		quiz: frontmatter.quiz ?? [],
		cards: parseCards(match[2]),
		subjectSlug: subject.slug,
		subjectName: subject.name
	};
	checkLesson(lesson, frontmatter, fail);
	return lesson;
}

/**
 * @param {Lesson} lesson
 * @param {Record<string, unknown>} frontmatter the raw frontmatter, for fields the lesson doesn't carry
 * @param {(msg: string) => void} fail
 */
function checkLesson(lesson, frontmatter, fail) {
	if (!KINDS.includes(lesson.kind)) fail(`"kind" must be one of ${KINDS.join(', ')}`);
	for (const key of ['subject', 'order'])
		if (key in frontmatter) fail(`"${key}" is retired: the subject and order come from the folder and filename`);

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
	if (lesson.kind === 'study' && frontmatter.work != null) fail('a Study must not declare a main "work"');
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
