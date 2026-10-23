// Parses a lesson Markdown file. Shared by the app (at build time) and
// scripts/validate-content.js, so it must stay plain JS with no Svelte/Vite imports.
import { parse as parseYaml } from 'yaml';

/**
 * @typedef {{ id: string, label: string, url: string }} Source
 * @typedef {{ q: string, options: string[], answer: number, explain: string, card: number }} Question
 * @typedef {{ markdown: string, sourceIds: string[] }} Card
 * @typedef {{
 *   slug: string, title: string, subject: string, subjectSlug: string,
 *   subjectOrder: number, order: number,
 *   sources: Source[], quiz: Question[], cards: Card[]
 * }} Lesson
 */

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const CARD_BREAK = /^\s*---\s*$/m;
export const CITATION = /\[\^([\w-]+)\]/g;

/**
 * @param {string} path e.g. "/src/content/01-general-socialist-theory/01-historical-materialism.md"
 * @param {string} raw file contents
 * @returns {Lesson}
 */
export function parseLesson(path, raw) {
	const parts = path.split('/');
	const [subjectDir, file] = parts.slice(-2);
	const match = FRONTMATTER.exec(raw);
	if (!match) throw new Error(`${path}: missing frontmatter`);
	const meta = parseYaml(match[1]) ?? {};

	const cards = match[2]
		.split(CARD_BREAK)
		.map((text) => text.trim())
		.filter(Boolean)
		.map((markdown) => ({
			markdown,
			sourceIds: [...new Set([...markdown.matchAll(CITATION)].map((m) => m[1]))]
		}));

	return {
		slug: file.replace(/\.md$/, '').replace(/^\d+-/, ''),
		title: meta.title,
		subject: meta.subject,
		subjectSlug: subjectDir.replace(/^\d+-/, ''),
		subjectOrder: parseInt(subjectDir, 10),
		order: meta.order,
		sources: meta.sources ?? [],
		quiz: meta.quiz ?? [],
		cards
	};
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
