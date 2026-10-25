// Fails the build if any lesson breaks the content rules. Run: npm run validate
import { loadCurriculum } from './curriculum.js';

const { subjects, errors } = loadCurriculum();

if (errors.length) {
	console.error(`Content validation failed:\n  ${errors.join('\n  ')}`);
	process.exit(1);
}
const lessonCount = subjects.reduce((n, s) => n + s.lessons.length, 0);
console.log(`Content OK: ${subjects.length} subjects, ${lessonCount} lessons.`);
