import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { buildCurriculum, subjectProgress } from './curriculum.js';

const ROOT = '/src/content';

/** @param {string} dir @param {Record<string, unknown>} [meta] */
const subjectFile = (dir, meta = { name: 'Foundations', description: 'Where to begin.' }) => ({
	path: `${ROOT}/${dir}/subject.yml`,
	raw: stringify(meta)
});

const quiz = (n = 5) =>
	Array.from({ length: n }, (_, i) => ({
		q: `Question ${i + 1}?`,
		options: ['a', 'b', 'c', 'd'],
		answer: 0,
		explain: 'Because.',
		card: 1
	}));

const VALID_META = {
	title: 'A Lesson',
	kind: 'study',
	sources: [{ id: 'src', label: 'A Source', url: 'https://example.org/source' }],
	quiz: quiz()
};

/**
 * @param {string} path relative to the content root, e.g. "01-foundations/01-alpha.md"
 * @param {Record<string, unknown>} [overrides] frontmatter fields; undefined removes one
 * @param {string[]} [cards]
 */
function lessonFile(path, overrides = {}, cards = ['A claim.[^src]']) {
	const meta = Object.fromEntries(
		Object.entries({ ...VALID_META, ...overrides }).filter(([, v]) => v !== undefined)
	);
	return { path: `${ROOT}/${path}`, raw: `---\n${stringify(meta)}---\n${cards.join('\n\n---\n\n')}\n` };
}

/**
 * Some error starts with the path and matches the gist of the problem.
 * @param {string[]} errors @param {string} path @param {RegExp} gist
 */
function expectError(errors, path, gist) {
	expect(errors.filter((e) => e.startsWith(path) && gist.test(e)), errors.join('\n')).not.toEqual([]);
}

describe('buildCurriculum', () => {
	it('builds a valid subject and lesson with no errors', () => {
		const { subjects, errors } = buildCurriculum([
			subjectFile('01-foundations'),
			lessonFile('01-foundations/01-historical-materialism.md', { title: 'Historical Materialism' })
		]);
		expect(errors).toEqual([]);
		expect(subjects).toHaveLength(1);
		expect(subjects[0]).toMatchObject({
			slug: 'foundations',
			name: 'Foundations',
			description: 'Where to begin.'
		});
		expect(subjects[0].lessons[0]).toMatchObject({
			slug: 'historical-materialism',
			title: 'Historical Materialism',
			kind: 'study',
			subjectSlug: 'foundations',
			subjectName: 'Foundations',
			sources: [{ id: 'src', label: 'A Source', url: 'https://example.org/source' }],
			cards: [{ markdown: 'A claim.[^src]', sourceIds: ['src'] }]
		});
		expect(subjects[0].lessons[0].quiz).toHaveLength(5);
	});

	describe('ordering', () => {
		it('orders subjects by folder prefix, numerically', () => {
			const { subjects } = buildCurriculum([
				subjectFile('10-lenin', { name: 'Lenin', description: 'd' }),
				lessonFile('10-lenin/01-a.md'),
				subjectFile('2-foundations', { name: 'Foundations', description: 'd' }),
				lessonFile('2-foundations/01-b.md')
			]);
			expect(subjects.map((s) => s.slug)).toEqual(['foundations', 'lenin']);
		});

		it('orders lessons by filename prefix, numerically', () => {
			const { subjects } = buildCurriculum([
				subjectFile('01-foundations'),
				lessonFile('01-foundations/10-later.md'),
				lessonFile('01-foundations/02-earlier.md')
			]);
			expect(subjects[0].lessons.map((l) => l.slug)).toEqual(['earlier', 'later']);
		});

		it('lists every lesson in one flat list, in subject then lesson order', () => {
			const { lessons } = buildCurriculum([
				subjectFile('10-lenin', { name: 'Lenin', description: 'd' }),
				lessonFile('10-lenin/01-c.md'),
				subjectFile('2-foundations', { name: 'Foundations', description: 'd' }),
				lessonFile('2-foundations/05-b.md'),
				lessonFile('2-foundations/01-a.md')
			]);
			expect(lessons.map((l) => l.slug)).toEqual(['a', 'b', 'c']);
		});

		it('strips the prefix from subject and lesson slugs', () => {
			const { subjects } = buildCurriculum([
				subjectFile('07-black-panther-party'),
				lessonFile('07-black-panther-party/03-ten-point-program.md')
			]);
			expect(subjects[0].slug).toBe('black-panther-party');
			expect(subjects[0].lessons[0].slug).toBe('ten-point-program');
		});
	});

	describe('subject rules', () => {
		it('rejects a subject folder without a numeric prefix', () => {
			const { errors } = buildCurriculum([subjectFile('lenin'), lessonFile('lenin/01-a.md')]);
			expectError(errors, `${ROOT}/lenin`, /number|prefix/i);
		});

		it('rejects a subject folder without a metadata file', () => {
			const { errors } = buildCurriculum([lessonFile('02-lenin/01-a.md')]);
			expectError(errors, `${ROOT}/02-lenin`, /subject\.yml/);
		});

		it('rejects a metadata file without a name', () => {
			const { errors } = buildCurriculum([
				subjectFile('02-lenin', { description: 'd' }),
				lessonFile('02-lenin/01-a.md')
			]);
			expectError(errors, `${ROOT}/02-lenin/subject.yml`, /name/);
		});

		it('rejects a metadata file without a description', () => {
			const { errors } = buildCurriculum([
				subjectFile('02-lenin', { name: 'Lenin' }),
				lessonFile('02-lenin/01-a.md')
			]);
			expectError(errors, `${ROOT}/02-lenin/subject.yml`, /description/);
		});

		it('rejects a subject folder with no lessons', () => {
			const { errors } = buildCurriculum([subjectFile('02-lenin')]);
			expectError(errors, `${ROOT}/02-lenin`, /no lessons/);
		});

		it('rejects a subject folder holding neither a metadata file nor lessons', () => {
			const { subjects, errors } = buildCurriculum([], [`${ROOT}/03-empty`]);
			expectError(errors, `${ROOT}/03-empty`, /subject\.yml/);
			expectError(errors, `${ROOT}/03-empty`, /no lessons/);
			expect(subjects.map((s) => s.slug)).toEqual(['empty']);
		});

		it('reports an unparseable metadata file as an error rather than throwing', () => {
			const { errors } = buildCurriculum([
				{ path: `${ROOT}/02-lenin/subject.yml`, raw: 'name: [unclosed' },
				lessonFile('02-lenin/01-a.md')
			]);
			expectError(errors, `${ROOT}/02-lenin/subject.yml`, /./);
		});
	});

	describe('lesson rules', () => {
		/** Errors for a single lesson in an otherwise valid subject. */
		const errorsFor = (/** @type {ReturnType<typeof lessonFile>} */ file) =>
			buildCurriculum([subjectFile('01-foundations'), file]).errors;
		const PATH = `${ROOT}/01-foundations/01-alpha.md`;

		it('rejects a lesson file without a numeric prefix', () => {
			const file = lessonFile('01-foundations/alpha.md');
			expectError(errorsFor(file), file.path, /number|prefix/i);
		});

		it('reports a file without frontmatter as one error for that file', () => {
			const errors = errorsFor({ path: PATH, raw: 'Just a card.' });
			expect(errors).toHaveLength(1);
			expectError(errors, PATH, /frontmatter/);
		});

		it('reports unparseable frontmatter as one error for that file', () => {
			const errors = errorsFor({ path: PATH, raw: '---\ntitle: [unclosed\n---\nA card.\n' });
			expect(errors).toHaveLength(1);
			expectError(errors, PATH, /./);
		});

		it('reports frontmatter that is not a mapping as one error for that file', () => {
			const errors = errorsFor({ path: PATH, raw: '---\njust a string\n---\nA card.\n' });
			expect(errors).toHaveLength(1);
			expectError(errors, PATH, /frontmatter/);
		});

		it('requires a kind', () => {
			expectError(errorsFor(lessonFile('01-foundations/01-alpha.md', { kind: undefined })), PATH, /kind/);
		});

		it('rejects a kind other than reading or study', () => {
			expectError(errorsFor(lessonFile('01-foundations/01-alpha.md', { kind: 'survey' })), PATH, /kind/);
		});

		describe('main work', () => {
			const WORK = {
				author: 'Lenin',
				title: 'What Is to Be Done?',
				year: 1902,
				url: 'https://www.marxists.org/archive/lenin/works/1901/witbd/'
			};
			const reading = (/** @type {unknown} */ work) =>
				lessonFile('01-foundations/01-alpha.md', { kind: 'reading', work });

			it('returns a Reading with its main work', () => {
				const { subjects, errors } = buildCurriculum([subjectFile('01-foundations'), reading(WORK)]);
				expect(errors).toEqual([]);
				expect(subjects[0].lessons[0]).toMatchObject({ kind: 'reading', work: WORK });
			});

			it('rejects a Reading without a main work', () => {
				expectError(errorsFor(reading(undefined)), PATH, /work/);
			});

			for (const key of ['author', 'title', 'year']) {
				it(`rejects a main work without its ${key}`, () => {
					expectError(errorsFor(reading({ ...WORK, [key]: undefined })), PATH, new RegExp(key));
				});
			}

			it('rejects a main work without a web link', () => {
				expectError(errorsFor(reading({ ...WORK, url: 'marxists.org/lenin' })), PATH, /url|link/i);
			});

			it('rejects a Study that declares a main work', () => {
				expectError(
					errorsFor(lessonFile('01-foundations/01-alpha.md', { kind: 'study', work: WORK })),
					PATH,
					/work/
				);
			});
		});

		it('rejects the retired "subject" field', () => {
			expectError(errorsFor(lessonFile('01-foundations/01-alpha.md', { subject: 'Old' })), PATH, /subject/);
		});

		it('rejects the retired "order" field', () => {
			expectError(errorsFor(lessonFile('01-foundations/01-alpha.md', { order: 1 })), PATH, /order/);
		});

		it('requires a title', () => {
			expectError(errorsFor(lessonFile('01-foundations/01-alpha.md', { title: undefined })), PATH, /title/);
		});

		it('rejects a duplicate slug across subjects, naming both files', () => {
			const { errors } = buildCurriculum([
				subjectFile('01-foundations'),
				lessonFile('01-foundations/01-alpha.md'),
				subjectFile('02-lenin'),
				lessonFile('02-lenin/04-alpha.md')
			]);
			expectError(errors, `${ROOT}/02-lenin/04-alpha.md`, /duplicate.*01-foundations\/01-alpha\.md/);
		});

		describe('sources and citations', () => {
			const withSources = (/** @type {unknown[]} */ sources, cards = ['A claim.[^src]']) =>
				errorsFor(lessonFile('01-foundations/01-alpha.md', { sources }, cards));

			it('rejects a source without an id', () => {
				expectError(withSources([{ label: 'L', url: 'https://x.org' }]), PATH, /id and label/);
			});

			it('rejects a source without a label', () => {
				expectError(withSources([{ id: 'src', url: 'https://x.org' }]), PATH, /id and label/);
			});

			it('rejects a source without an http(s) URL', () => {
				expectError(withSources([{ id: 'src', label: 'L', url: 'ftp://x.org' }]), PATH, /"src".*URL/);
			});

			it('rejects a card citing an unknown source', () => {
				const cards = ['A claim.[^src] Another.[^ghost]'];
				expectError(withSources(VALID_META.sources, cards), PATH, /card 1.*unknown source "ghost"/);
			});

			it('rejects a source that is never cited', () => {
				const sources = [...VALID_META.sources, { id: 'spare', label: 'L', url: 'https://x.org' }];
				expectError(withSources(sources), PATH, /"spare".*never cited/);
			});
		});

		describe('cards', () => {
			it('rejects a lesson with no cards', () => {
				expectError(errorsFor(lessonFile('01-foundations/01-alpha.md', { sources: [] }, [])), PATH, /no cards/);
			});

			it('accepts a card of 120 words', () => {
				const card = `${Array(119).fill('word').join(' ')} end.[^src]`;
				expect(errorsFor(lessonFile('01-foundations/01-alpha.md', {}, [card]))).toEqual([]);
			});

			it('rejects a card over 120 words', () => {
				const card = `${Array(120).fill('word').join(' ')} end.[^src]`;
				expectError(errorsFor(lessonFile('01-foundations/01-alpha.md', {}, [card])), PATH, /card 1 has 121 words/);
			});

			it("doesn't count citation markers or Markdown syntax as words", () => {
				const card = `> **${Array(119).fill('word').join(' ')}** _end_.[^src]`;
				expect(errorsFor(lessonFile('01-foundations/01-alpha.md', {}, [card]))).toEqual([]);
			});
		});

		describe('quiz', () => {
			const withQuiz = (/** @type {unknown[]} */ q) => errorsFor(lessonFile('01-foundations/01-alpha.md', { quiz: q }));
			const edit = (/** @type {Record<string, unknown>} */ change) => {
				const q = quiz();
				q[1] = { ...q[1], ...change };
				return withQuiz(q);
			};

			it('rejects a quiz without exactly five questions', () => {
				expectError(withQuiz(quiz(4)), PATH, /4 questions/);
				expectError(withQuiz(quiz(6)), PATH, /6 questions/);
			});

			it('rejects a question with no text', () => {
				expectError(edit({ q: '' }), PATH, /question 2 has no text/);
			});

			it('rejects a question without exactly four options', () => {
				expectError(edit({ options: ['a', 'b', 'c'] }), PATH, /question 2.*4 options/);
			});

			it('rejects an answer index out of range', () => {
				expectError(edit({ answer: 4 }), PATH, /question 2 answer/);
				expectError(edit({ answer: -1 }), PATH, /question 2 answer/);
				expectError(edit({ answer: 1.5 }), PATH, /question 2 answer/);
			});

			it('rejects question text, options or explanation that YAML reads as a number', () => {
				expectError(edit({ options: ['a', 1917, 'c', 'd'] }), PATH, /question 2 options must all be text/);
				expectError(edit({ q: 1917 }), PATH, /question 2 has no text/);
				expectError(edit({ explain: 1917 }), PATH, /question 2 has no explanation/);
			});

			it('rejects a question with no explanation', () => {
				expectError(edit({ explain: undefined }), PATH, /question 2 has no explanation/);
			});

			it('rejects a question pointing past the last card', () => {
				expectError(edit({ card: 2 }), PATH, /question 2 points to card 2/);
				expectError(edit({ card: 0 }), PATH, /question 2 points to card 0/);
			});
		});
	});
});

describe('subjectProgress', () => {
	const { subjects } = buildCurriculum([
		subjectFile('01-foundations'),
		lessonFile('01-foundations/01-alpha.md'),
		lessonFile('01-foundations/02-beta.md'),
		lessonFile('01-foundations/03-gamma.md')
	]);
	const [subject] = subjects;

	it('counts nothing done with no results', () => {
		expect(subjectProgress(subject, {})).toEqual({ done: 0, total: 3 });
	});

	it('counts a lesson with one submitted attempt as done, even with a zero score', () => {
		expect(subjectProgress(subject, { beta: { best: 0, total: 5, attempts: 1 } })).toEqual({ done: 1, total: 3 });
	});

	it('counts a lesson with several attempts once', () => {
		const results = {
			alpha: { best: 5, total: 5, attempts: 3 },
			gamma: { best: 2, total: 5, attempts: 1 }
		};
		expect(subjectProgress(subject, results)).toEqual({ done: 2, total: 3 });
	});

	it("ignores results for lessons outside the subject", () => {
		expect(subjectProgress(subject, { elsewhere: { best: 5, total: 5, attempts: 1 } })).toEqual({ done: 0, total: 3 });
	});
});
