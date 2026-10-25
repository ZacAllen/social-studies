// Checks every direct quotation on a card against the text of the sources that card cites.
// Needs network access, so it is not part of the build. Run: npm run check-quotes
//
// Only HTML sources can be checked automatically. Quotes from sources marked `manual: true`
// (scans, borrow-only books) or that aren't HTML are listed as "manual" for a reviewer.
import { extractQuotes } from '../src/lib/curriculum.js';
import { loadCurriculum } from './curriculum.js';

/** Lowercase letters and digits only, so punctuation, curly quotes and line breaks don't matter. */
const normalize = (text) =>
	text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

const pageCache = new Map();
async function fetchText(url) {
	if (!pageCache.has(url)) {
		pageCache.set(
			url,
			fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (social-studies quote checker)' } }).then(
				async (res) => {
					const type = res.headers.get('content-type') ?? '';
					if (!res.ok || !type.includes('html')) return null;
					const html = await res.text();
					return normalize(
						html
							// Footnote markers like <sup>(2)</sup> sit mid-sentence on marxists.org.
						.replace(/<(script|style|sup)[\s\S]*?<\/\1>/gi, ' ')
							.replace(/<[^>]+>/g, ' ')
							.replace(/&[a-z#0-9]+;/gi, ' ')
					);
				},
				() => null
			)
		);
	}
	return pageCache.get(url);
}

let missing = 0;
for (const lesson of loadCurriculum().subjects.flatMap((s) => s.lessons)) {
	for (const [i, card] of lesson.cards.entries()) {
		const sources = lesson.sources.filter((s) => card.sourceIds.includes(s.id));
		const texts = (await Promise.all(sources.filter((s) => !s.manual).map((s) => fetchText(s.url)))).filter(Boolean);
		for (const quote of extractQuotes(card.markdown)) {
			const where = `${lesson.slug} card ${i + 1}`;
			const pieces = quote.split(/…|\.\.\./).map(normalize).filter(Boolean);
			if (pieces.every((p) => texts.some((t) => t.includes(p)))) {
				console.log(`ok       ${where}: "${quote.slice(0, 60)}${quote.length > 60 ? '…' : ''}"`);
			} else if (texts.length < sources.length) {
				console.log(`manual   ${where}: "${quote}"`);
			} else {
				missing++;
				console.log(`MISSING  ${where}: "${quote}"`);
			}
		}
	}
}

if (missing) {
	console.error(`\n${missing} quote(s) not found in their cited sources.`);
	process.exit(1);
}
