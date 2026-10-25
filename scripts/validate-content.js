// Fails the build if any lesson breaks the content rules. Run: npm run validate
import { loadCurriculum } from './curriculum.js';

const { subjects, lessons, errors } = loadCurriculum();

if (errors.length) {
	console.error(`Content validation failed:\n  ${errors.join('\n  ')}`);
	process.exit(1);
}
console.log(`Content OK: ${subjects.length} subjects, ${lessons.length} lessons.`);
