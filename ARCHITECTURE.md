# Architecture

Social Studies is a static, offline-capable, mobile-first site of short lessons on socialist and revolutionary theory. A **lesson** is a Markdown file; the app turns each one into a swipeable stack of **cards** followed by a five-question **quiz**. There is no backend, no database and no accounts. Everything is built ahead of time and served from GitHub Pages, and the only per-user state is quiz results kept in the browser.

For how to *write* a lesson, see [README.md](README.md). Terms are defined in [GLOSSARY.md](GLOSSARY.md), and content decisions are recorded in [docs/adr/](docs/adr/). This document covers how the code fits together.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | SvelteKit 2 with Svelte 5 (runes mode forced on in `svelte.config.js`) |
| Rendering | Fully prerendered static site (`adapter-static`, `prerender = true`, 404 fallback) |
| Content | Markdown files with YAML frontmatter, parsed with `yaml` and rendered with `marked` |
| State | `localStorage`, via a Svelte 5 `$state` class |
| Offline | A service worker that precaches the whole site |
| Hosting | GitHub Pages, deployed by GitHub Actions on every push to `main` |

## Domain terms

- **Subject**: a group of lessons (e.g. "Lenin"). Defined by a folder under `src/content/` holding a `subject.yml` with its `name` and `description`.
- **Lesson**: one Markdown file. Has a title, a kind, sources, cards and a quiz.
- **Reading / Study**: the two kinds of lesson. A Reading is centred on one main **work** (`author`, `title`, `year`, `url`); a Study draws on several and has no main work.
- **Card**: one screen of a lesson. Cards are separated by a `---` line and capped at 120 words.
- **Source**: a citable primary or secondary text with an `id`, `label` and `url`. Cards cite sources with `[^id]`.
- **Quiz / Question**: exactly 5 multiple-choice questions per lesson, each with 4 options, an answer index, a one-line explanation, and the card that covers it.

## Directory map

```
src/
  content/<nn>-<subject>/
    subject.yml        Subject name and description
    <nn>-<lesson>.md   Lesson content (the only place content lives)
  lib/
    curriculum.js      The curriculum module: content files → subjects, lessons and rule errors, plus helpers (plain JS, no Vite/Svelte)
    curriculum.test.js Unit tests for the curriculum module (Vitest)
    content.ts         App-side adapter: globs the content, builds the curriculum, smart-quotes quizzes, renders cards
    progress.svelte.ts Quiz results store backed by localStorage
  routes/
    +layout.svelte     Imports global CSS, renders children
    +layout.ts         prerender = true, trailingSlash = 'always'
    +page.svelte       Home: the subject index, with lessons-done counts
    subject/[slug]/
      +page.ts         Looks up the subject; declares which slugs to prerender
      +page.svelte     Subject page: its lessons, with kind labels and best-score badges
    lesson/[slug]/
      +page.ts         Looks up the lesson; declares which slugs to prerender
      +page.svelte     Card viewer (swipe, keys, buttons)
      quiz/
        +page.ts       Same loader as the lesson page
        +page.svelte   Quiz UI, scoring, review
  service-worker.ts    Offline cache
  app.html / app.css   HTML shell; design tokens, fonts, light/dark theme
scripts/
  curriculum.js        Reads src/content from disk and calls buildCurriculum, for the scripts
  validate-content.js  Build-time content rules (runs in `npm run build`)
  check-quotes.js      Network-based quote verification (manual, not in the build)
static/                Icon and web app manifest
.github/workflows/deploy.yml
```

## Content pipeline

```
src/content/*/*.md + src/content/*/subject.yml
   │  import.meta.glob('?raw', eager)          (content.ts, at build time)
   │  or readdirSync                           (scripts/curriculum.js)
   ▼
buildCurriculum([{ path, raw }])               (curriculum.js)
   │  subject.yml → name, description; folder prefix → order, rest → slug
   │  frontmatter → title, kind, work, sources, quiz; filename prefix → order, rest → slug
   │  body split on `---` lines → cards, each with the source ids it cites
   │  every content rule checked → errors[]
   ▼
{ subjects[], errors[] }
   ├─ content.ts: throws if errors[]; exports subjects, lessons (flattened), getSubject, getLesson
   ├─ renderCard(lesson, card)   [^id] → <sup> numbers, marked → HTML, plus the card's citation list
   └─ subjectProgress(subject, results) → { done, total }   (home page badges)
```

Key points:

- **The curriculum module is the content seam.** `buildCurriculum` is a pure function from `{ path, raw }` files to `{ subjects, errors }`. The app, the validator and the quote checker all call it, so they can never disagree about what a lesson is or which rules it breaks. That is why it is plain JS with no `$lib`, Svelte or Vite imports, and why the unit tests go through it (and `subjectProgress`) alone.
- **Identity and order come from file paths.** A subject's slug and sort position come from its folder name (`02-lenin` → slug `lenin`, order `2`); a lesson's come from its filename the same way. Prefixes are compared numerically and needn't be contiguous, so renumbering never changes a slug. The subject's display name and description come from its `subject.yml`. The retired frontmatter fields `subject` and `order` are rejected.
- **Slugs are global and permanent.** Lesson URLs are `/lesson/<slug>/` with no subject segment, so slugs must be unique across all subjects; the validator enforces this. Progress is keyed by slug, so a published slug must never change.
- **Smart quotes are applied in the app only.** Content is authored with straight quotes so the quote checker and the `"..."` extraction stay simple. `content.ts` converts quiz text when it builds `subjects`, and `renderCard` converts card text just before display.
- **Cards are rendered to HTML with `{@html}`.** This is safe only because all Markdown is authored in this repo at build time. If content ever comes from users or a remote source, this needs sanitising.

## Routes and screens

All routes are prerendered. `trailingSlash = 'always'` because GitHub Pages serves `/lesson/foo/index.html` for `/lesson/foo/`; internal links append `/` explicitly.

- **Home (`/`)**: the subject index. Lists each subject with its description, lesson count, a "Start here" tag on the first, and a `done/total ✓` badge (from `subjectProgress`) once any of its lessons has been attempted.
- **Subject (`/subject/[slug]/`)**: the subject's description and numbered lessons, each with its kind label, card count, quiz length and a `✓ best/total` badge once attempted.
- **Lesson (`/lesson/[slug]/`)**: one card at a time. The header shows the subject name and, for a Reading, "Reading · author, year"; the close button goes back to the subject page. Navigation is by Back/Next buttons, left/right arrow keys, or a horizontal swipe (≥50px and mostly horizontal). Going past the last card navigates to the quiz. Reads `?card=N` after mount to jump to a card; this has to happen client-side because prerendered pages have no query string. The quiz review links use it.
- **Quiz (`/lesson/[slug]/quiz/`)**: options are shuffled in the browser on mount (and on retake) so each attempt differs; the shuffle is client-only to keep prerendered HTML deterministic. Submitting is disabled until every question is answered. On submit it records the score, shows per-question feedback with a link back to the relevant card, and lists the lesson's sources as "Read the originals", headed by a full-text link to the main work for a Reading. Its close button also goes back to the subject page.

The lesson and quiz `+page.ts` loaders are identical (look up by slug, 404 otherwise, and `entries` enumerates every lesson for prerendering). The subject loader does the same for subjects.

## State

`progress` (`progress.svelte.ts`) is the only mutable state. It maps `slug → { best, total, attempts }`, loaded from `localStorage` under the key `social-studies:progress:v1` and written on every quiz submit. Notes:

- It is browser-local: no sync between devices, and clearing site data erases it.
- Reads and writes are wrapped in `try/catch`, so private mode or a full quota degrades to "progress doesn't persist" rather than an error.
- `load()` returns `{}` during prerender (`!browser`); the store hydrates on the client.
- Only the *best* score is kept, plus an attempt count. Individual answers are not stored.
- The `v1` in the key is the migration hook if the shape ever changes.

## Offline support

SvelteKit registers `src/service-worker.ts` automatically. On install it precaches `build` (JS/CSS), `files` (static assets) and `prerendered` (every HTML page), under a cache named by the build `version`. On activate it deletes older caches. On fetch it serves cache-first for same-origin GETs (ignoring query strings, so `?card=N` still hits the cache), falls through to the network, and on a network failure falls back to the home page. Because every deploy changes `version`, users get a fresh cache per release. The manifest in `static/` makes the site installable as a standalone app.

## Quality gates

| Gate | What it checks | When it runs |
| --- | --- | --- |
| `npm run validate` | Folder and filename prefixes; each subject has a `subject.yml` with `name` and `description`, and at least one lesson; frontmatter parses and has a `title`; `kind` is `reading` or `study`; a Reading has a main `work` with `author`, `title`, `year` and an http(s) `url`, and a Study has none; no retired `subject`/`order` fields; unique slugs; source shape and URLs; every cited id exists; every source is cited; cards ≤120 words; quiz is 5 questions × 4 options; answer and card indices in range | Automatically as part of `npm run build`, so CI cannot deploy a broken lesson. `content.ts` also throws on any error, as a backstop |
| `npm test` | Vitest unit tests of `buildCurriculum` and `subjectProgress`: ordering, slugs, kinds, main works, done counts and every content rule | In CI before the build; manually |
| `npm run check` | `svelte-check` / TypeScript | Manually |
| `npm run check-quotes` | Fetches each cited HTML source and confirms every `"..."` quote on a card appears in it (case, punctuation and `…` elisions normalised). Sources marked `manual: true`, or not HTML, are listed for human checking | Manually; needs network, so deliberately not in the build |

The Svelte screens and `content.ts` have no tests of their own: they are thin views over the curriculum module, and the build prerenders every page. Whether a main work's link is actually free to read isn't checked automatically; review covers it, along with `manual` quotes and historical claims.

## Build and deploy

1. Push to `main` (or trigger the workflow manually).
2. CI runs `npm ci`, `npm test`, then `npm run build` (validate, then `vite build`) with `BASE_PATH=/<repo-name>`.
3. `adapter-static` writes the site to `build/`, which is uploaded and deployed to GitHub Pages.

`BASE_PATH` is the only environment-specific setting. It is empty locally and the repo name in CI, because Pages serves the site under `/<repo>/`. Internal links go through `resolve()` from `$app/paths` so they respect it.

## Design system

`src/app.css` defines the look as CSS custom properties: paper, ink and red palette, "poster" (Oswald) and body (Source Serif 4) fonts, a 560px max content width and a 16px gutter. Dark mode follows `prefers-color-scheme` (with a `data-theme='light'` escape hatch). Layouts respect `env(safe-area-inset-*)` for notched phones. Page components carry their own scoped CSS and lean on these tokens.

## Extending the app

- **New lesson:** add a Markdown file in an existing subject folder, following the README. Nothing else to register; the glob picks it up.
- **New subject:** add a new `<nn>-<name>/` folder under `src/content/` with a `subject.yml` (`name`, `description`) and at least one lesson. Subject folders must start with a number.
- **New per-lesson field:** extend the `Lesson` typedef and `buildCurriculum` (and its rules) in `curriculum.js`, with a test in `curriculum.test.js`. The validator and the app pick it up from there.
- **New persisted state:** extend `progress.svelte.ts`, or add a sibling store with its own versioned key.

## Observations (current quirks)

These describe the code as it is today; none is necessarily a bug.

- **The subject file name is written twice.** `curriculum.js` exports `SUBJECT_FILE`, but `import.meta.glob` patterns must be literals, so `content.ts` repeats `subject.yml`.
- **Duplicated route loaders** for lesson and quiz.
- **The README mentions Maoist theory**, but no Maoist subject exists yet.
