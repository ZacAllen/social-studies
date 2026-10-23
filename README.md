# Social Studies

Short, mobile-first lessons on socialist, Marxist, Maoist and Black revolutionary theory and history. Each lesson is a few flash cards followed by a five-question quiz.

Live site: https://zacallen.github.io/social-studies/

## Running locally

```sh
npm install
npm run dev
```

## Writing a lesson

Lessons live in `src/content/<nn>-<subject>/<nn>-<lesson>.md`. The number prefixes set the order, and the subject is set by its folder. Copy an existing lesson to start a new one.

- **Frontmatter** holds the `title`, `subject`, `order`, the `sources` (each with an `id`, `label` and `url`), and the `quiz`.
- **Cards** are separated by a line containing only `---`. Each card holds at most 120 words.
- **Citations:** put `[^source-id]` after a quote or claim. It shows as a superscript number, with the source listed at the bottom of the card.
- **Quotes:** put verbatim quotations in straight double quotes (`"..."`) and nothing else, since that's how the quote checker finds them. Use *italics* or single quotes for terms and titles.
- **Quiz:** exactly 5 questions, each with 4 `options`, the `answer` (index of the right option, counting from 0), a one-line `explain`, and the `card` (counting from 1) that covers it.

### Checks

- `npm run validate` checks word counts, quiz shape, citations and card references. It also runs as part of every build, so a broken lesson can't deploy.
- `npm run check-quotes` fetches each cited source and confirms every quoted passage appears in it. Sources that can't be fetched as text (scans, borrow-only books) are marked `manual: true`, and their quotes are listed for a person to check.

## Deploying

Every push to `main` builds the site and deploys it to GitHub Pages (see `.github/workflows/deploy.yml`).
