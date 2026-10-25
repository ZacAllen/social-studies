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
		}
		else if (file.endsWith('.md')) folder.lessons.push({ file, path, raw });
	}

	/** @type {Subject[]} */
	const subjects = [];
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
		for (const { file, raw } of lessons) {
			const match = FRONTMATTER.exec(raw);
			if (!match) continue;
			const fm = parseYaml(match[1]) ?? {};
			subject.lessons.push({
				slug: file.replace(/\.md$/, '').replace(PREFIX, ''),
				title: fm.title,
				kind: fm.kind,
				...(fm.work ? { work: fm.work } : {}),
				sources: fm.sources ?? [],
				quiz: fm.quiz ?? [],
				cards: parseCards(match[2]),
				subjectSlug: subject.slug,
				subjectName: subject.name
			});
		}
		subjects.push(subject);
	}
	return { subjects, errors };
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
	return { done: 0, total: subject.lessons.length };
}
