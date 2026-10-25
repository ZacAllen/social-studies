# Architecture

Social Studies is a static, offline-capable, mobile-first site of short lessons on socialist and revolutionary theory. A **lesson** is a Markdown file; the app turns each one into a swipeable stack of **cards** followed by a five-question **quiz**. There is no backend, no database and no accounts. Everything is built ahead of time and served from GitHub Pages, and the only per-user state is quiz results kept in the browser.

For how to *write* a lesson, see [README.md](README.md). This document covers how the code fits together.

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

- **Subject**: a group of lessons (e.g. "Marxism-Leninism"). Defined by a folder under `src/content/`.
- **Lesson**: one Markdown file. Has a title, sources, cards and a quiz.
- **Card**: one screen of a lesson. Cards are separated by a `---` line and capped at 120 words.
- **Source**: a citable primary or secondary text with an `id`, `label` and `url`. Cards cite sources with `[^id]`.
- **Quiz / Question**: exactly 5 multiple-choice questions per lesson, each with 4 options, an answer index, a one-line explanation, and the card that covers it.

## Directory map

```
src/
  content/<nn>-<subject>/<nn>-<lesson>.md   Lesson content (the only place content lives)
  lib/
    lesson.js          Pure parser for a lesson file + word/quote helpers (plain JS, no Vite/Svelte)
    content.ts         App-side content module: loads all lessons, groups into subjects, renders cards
    progress.svelte.ts Quiz results store backed by localStorage
  routes/
    +layout.svelte     Imports global CSS, renders children
    +layout.ts         prerender = true, trailingSlash = 'always'
    +page.svelte       Home: lessons grouped by subject, with best-score badges
    lesson/[slug]/
      +page.ts         Looks up the lesson; declares which slugs to prerender
      +page.svelte     Card viewer (swipe, keys, buttons)
      quiz/
        +page.ts       Same loader as the lesson page
        +page.svelte   Quiz UI, scoring, review
  service-worker.ts    Offline cache
  app.html / app.css   HTML shell; design tokens, fonts, light/dark theme
scripts/
  validate-content.js  Build-time content rules (runs in `npm run build`)
  check-quotes.js      Network-based quote verification (manual, not in the build)
static/                Icon and web app manifest
.github/workflows/deploy.yml
```

## Content pipeline

```
src/content/*/*.md
   │  import.meta.glob('?raw', eager)      (content.ts, at build time)
   ▼
parseLesson(path, raw)                      (lesson.js)
   │  frontmatter → title, subject, order, sources, quiz
   │  body split on `---` lines → cards, each with the source ids it cites
   ▼
lessons[]  sorted by (subjectOrder, order)  (content.ts)
   ├─ subjects[]  consecutive lessons grouped by subject slug
   ├─ getLesson(slug)
   └─ renderCard(lesson, card)   [^id] → <sup> numbers, marked → HTML, plus the card's citation list
```

Key points:

- **`lesson.js` is shared on purpose.** The app and the Node scripts (`validate-content.js`, `check-quotes.js`) all call the same `parseLesson`, so the build, the validator and the quote checker can never disagree about what a lesson is. That is why it is plain JS with no `$lib`, Svelte or Vite imports.
- **Identity comes from file paths.** A lesson's `slug` is its filename minus the `nn-` prefix and `.md`. A subject's `slug` and sort position come from its folder name (`01-general-socialist-theory` → slug `general-socialist-theory`, order `1`). Lesson order *within* a subject comes from the frontmatter `order`, not the filename prefix. The subject's display name comes from the frontmatter `subject`.
- **Slugs are global.** Lesson URLs are `/lesson/<slug>/` with no subject segment, so slugs must be unique across all subjects. The validator enforces this.
- **Smart quotes are applied at render time.** Content is authored with straight quotes so the quote checker and the `"..."` extraction stay simple. `smartQuotes` converts them to typographic quotes for cards and quiz text just before display.
- **Cards are rendered to HTML with `{@html}`.** This is safe only because all Markdown is authored in this repo at build time. If content ever comes from users or a remote source, this needs sanitising.

## Routes and screens

All routes are prerendered. `trailingSlash = 'always'` because GitHub Pages serves `/lesson/foo/index.html` for `/lesson/foo/`; internal links append `/` explicitly.

- **Home (`/`)**: reads `subjects` and `progress.results`, lists each lesson with its card count and a `✓ best/total` badge once attempted.
- **Lesson (`/lesson/[slug]/`)**: one card at a time. Navigation is by Back/Next buttons, left/right arrow keys, or a horizontal swipe (≥50px and mostly horizontal). Going past the last card navigates to the quiz. Reads `?card=N` after mount to jump to a card; this has to happen client-side because prerendered pages have no query string. The quiz review links use it.
- **Quiz (`/lesson/[slug]/quiz/`)**: options are shuffled in the browser on mount (and on retake) so each attempt differs; the shuffle is client-only to keep prerendered HTML deterministic. Submitting is disabled until every question is answered. On submit it records the score, shows per-question feedback with a link back to the relevant card, and lists the lesson's sources as "Read the originals".

The lesson and quiz `+page.ts` loaders are identical (look up by slug, 404 otherwise, and `entries` enumerates every lesson for prerendering).

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
| `npm run validate` | Folder naming, required frontmatter, unique slugs, source shape and URLs, every cited id exists, every source is cited, cards ≤120 words, quiz is 5 questions × 4 options, answer and card indices in range | Automatically as part of `npm run build`, so CI cannot deploy a broken lesson |
| `npm run check` | `svelte-check` / TypeScript | Manually |
| `npm run check-quotes` | Fetches each cited HTML source and confirms every `"..."` quote on a card appears in it (case, punctuation and `…` elisions normalised). Sources marked `manual: true`, or not HTML, are listed for human checking | Manually; needs network, so deliberately not in the build |

There is no automated test suite for the app code.

## Build and deploy

1. Push to `main` (or trigger the workflow manually).
2. CI runs `npm ci`, then `npm run build` (validate, then `vite build`) with `BASE_PATH=/<repo-name>`.
3. `adapter-static` writes the site to `build/`, which is uploaded and deployed to GitHub Pages.

`BASE_PATH` is the only environment-specific setting. It is empty locally and the repo name in CI, because Pages serves the site under `/<repo>/`. Internal links go through `resolve()` from `$app/paths` so they respect it.

## Design system

`src/app.css` defines the look as CSS custom properties: paper, ink and red palette, "poster" (Oswald) and body (Source Serif 4) fonts, a 560px max content width and a 16px gutter. Dark mode follows `prefers-color-scheme` (with a `data-theme='light'` escape hatch). Layouts respect `env(safe-area-inset-*)` for notched phones. Page components carry their own scoped CSS and lean on these tokens.

## Extending the app

- **New lesson:** add a Markdown file in an existing subject folder, following the README. Nothing else to register; the glob picks it up.
- **New subject:** add a new `<nn>-<name>/` folder under `src/content/`. Use the same `subject:` string in every lesson in it. Subject folders must start with a number.
- **New per-lesson field:** extend the `Lesson` typedef and `parseLesson` in `lesson.js`, then add its rule to `validate-content.js`.
- **New persisted state:** extend `progress.svelte.ts`, or add a sibling store with its own versioned key.

## Observations (current quirks)

These describe the code as it is today; none is necessarily a bug.

- **Subject name is stored twice.** The folder gives the slug and sort order; each lesson's frontmatter gives the display name. Nothing validates that lessons in one folder agree. `subjects` groups by slug, so the first lesson's `subject` string wins.
- **Two ordering mechanisms for lessons.** Subjects sort by folder prefix, lessons by frontmatter `order`. The filename prefix is stripped from the slug but not otherwise used, so it can drift from `order`.
- **`subjects` groups consecutive lessons only.** This works because `lessons` is sorted by subject first; it would split a subject if that sort ever changed.
- **Duplicated route loaders** for lesson and quiz.
- **The README mentions Maoist theory**, but no Maoist subject exists yet.
- **Mixed indentation style** across files: tabs in most, two spaces in `src/routes/+page.svelte`.
