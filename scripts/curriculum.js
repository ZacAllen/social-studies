// Reads the content directory from disk and builds the curriculum, for the Node scripts.
import { readdirSync, readFileSync } from 'node:fs';
import { buildCurriculum } from '../src/lib/curriculum.js';

const CONTENT_DIR = 'src/content';

export function loadCurriculum() {
	// Every subject directory is passed on, so an empty one is still reported.
	const dirs = readdirSync(CONTENT_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => `${CONTENT_DIR}/${d.name}`);
	const files = dirs.flatMap((dir) =>
		readdirSync(dir).map((file) => ({ path: `/${dir}/${file}`, raw: readFileSync(`${dir}/${file}`, 'utf8') }))
	);
	return buildCurriculum(
		files,
		dirs.map((dir) => `/${dir}`)
	);
}
