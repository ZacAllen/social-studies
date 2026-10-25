// Reads the content directory from disk and builds the curriculum, for the Node scripts.
import { readdirSync, readFileSync } from 'node:fs';
import { buildCurriculum } from '../src/lib/curriculum.js';

const CONTENT_DIR = 'src/content';

export function loadCurriculum() {
	const files = readdirSync(CONTENT_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.flatMap((d) =>
			readdirSync(`${CONTENT_DIR}/${d.name}`).map((file) => {
				const path = `${CONTENT_DIR}/${d.name}/${file}`;
				return { path: `/${path}`, raw: readFileSync(path, 'utf8') };
			})
		);
	return buildCurriculum(files);
}
