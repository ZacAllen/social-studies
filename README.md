# Social Studies

Short, mobile-first lessons on socialist, Marxist, Maoist and Black revolutionary theory and history. Each lesson is a few flash cards followed by a five-question quiz.

Live site: https://zacallen.github.io/social-studies/

## Running locally

```sh
npm install
npm run dev
```

## Writing a lesson

Lessons live in `src/content/<nn>-<subject>/<nn>-<lesson>.md`. Number prefixes set the order: subjects by folder, lessons by filename. Prefixes needn't be contiguous. Copy an existing lesson to start a new one. Words like *Reading*, *Study* and *main work* are defined in [GLOSSARY.md](GLOSSARY.md), and the editorial stance and curriculum scope are recorded in [docs/adr/](docs/adr/).

- **Subject file:** each subject folder holds a `subject.yml` with the subject's `name` and a one-line `description`.
- **Frontmatter** holds the `title`, the `kind` (`reading` or `study`), the `sources` (each with an `id`, `label` and `url`), and the `quiz`. A Reading also has a `work` (its main work) with an `author`, `title`, `year` and `url`; a Study must not have one. The old `subject` and `order` fields are retired and rejected: both now come from the folder and filename.
- **Cards** are separated by a line containing only `---`. Each card holds at most 120 words.
- **Citations:** put `[^source-id]` after a quote or claim. It shows as a superscript number, with the source listed at the bottom of the card.
- **Quotes:** put verbatim quotations in straight double quotes (`"..."`) and nothing else, since that's how the quote checker finds them. Use *italics* or single quotes for terms and titles.
- **Quiz:** exactly 5 questions, each with 4 `options`, the `answer` (index of the right option, counting from 0), a one-line `explain`, and the `card` (counting from 1) that covers it.

### Sourcing

- A Reading's main work must be free to read online, so "Read the originals" never leads to a paywall. A key work that isn't free online is taught as a Study instead. The validator only checks that the work has a link; whether it is free is checked in review.
- Mark a source `manual: true` when its quotes can't be verified automatically (scans, borrow-only books). It doesn't mean "not free".

### Slugs are permanent

A lesson's slug is its filename minus the number prefix and `.md`, and a subject's is its folder name minus the prefix. Saved progress and shared links depend on lesson slugs, so once a lesson is published you may renumber its prefix but never change the rest of the name. Slugs must be unique across all subjects.

### Checks

- `npm run validate` checks subject files, frontmatter, word counts, quiz shape, citations and card references. It also runs as part of every build, so a broken lesson can't deploy.
- `npm test` runs the curriculum module's unit tests. CI runs it before every build.
- `npm run check-quotes` fetches each cited source and confirms every quoted passage appears in it. Quotes from `manual: true` sources, or from sources that can't be fetched as HTML, are listed for a person to check.

### Review

New content merges once `npm run validate` and `npm run check-quotes` pass and the owner has signed off the quotes (including every `manual` one) and the historical claims.

## Deploying

Every push to `main` builds the site and deploys it to GitHub Pages (see `.github/workflows/deploy.yml`).
