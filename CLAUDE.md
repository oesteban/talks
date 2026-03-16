# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A collection of presentation slide decks built with [remark.js](https://remarkjs.com/), a Markdown-driven in-browser slideshow tool. There is no build system, no package manager, no tests—each talk is a self-contained `index.html` served as a static site via GitHub Pages at `oesteban.github.io/talks/`.

## Architecture

Each talk lives in its own directory (named by date or event, e.g. `20260210-ISC/`, `CDT-UCL-2025/`). Every talk directory contains:

- `index.html` — the entire presentation: HTML head, inline slide content in a `<textarea id="source">`, and the remark.js bootstrap script at the bottom.
- `images/` — talk-specific images (PNGs, SVGs, QR codes).

Slide content is written in **remark.js Markdown** inside the `<textarea id="source">` block. Slides are separated by `---`. Speaker notes go after `???`. Incremental reveals use `--`. Slide properties (`count: false`, `layout: true`, `class:`, `name:`) appear at the top of each slide.

### Shared Presentation Engine (`remark-engine/` submodule)

The shared engine lives in a git submodule at `remark-engine/` (repo: `oesteban/remark-engine`). It provides:

- `core/base.css` — theme-agnostic layout, typography, utilities using CSS custom properties
- `core/engine.js` — macros (`![:img]`, `![:video]`, `![:doi]`) + `remark.create()` wrapper + MathJax auto-config
- `themes/chuv.css` — green accent (`#009933`)
- `themes/hes-so.css` — magenta accent (`#dc0069`)
- `themes/nipreps.css` — blue accent (`#1c487b`)
- `ext/stepwise-svg.js` — progressive SVG element reveal
- `ext/asciicasts.js` — auto-discover & mount .cast terminal recordings
- `ext/timer.js` — countdown timer for slides
- `ext/roulette.js` + `ext/roulette.css` — timed speaking roulette
- `vendor/asciinema-player/` — vendored player CSS + JS

Recent talks (2025+) use the engine. Older talks (pre-2025) use legacy inline CSS or `css/slides.css` (deprecated).

### Legacy Shared Resources (deprecated)

- `css/slides.css` — deprecated green theme (kept for archival talks with inline CSS)
- `css/hes-so.css` — deprecated magenta theme (kept for archival talks)
- `assets/` — shared images, SVGs, videos. Still used by some talks via `../assets/`.

### Custom remark.js Macros

Defined in `remark-engine/core/engine.js`:
- `![:img Alt text, 50%](url)` — image with alt text and width
- `![:video](url)` — video element with controls
- `![:doi](10.xxxx/yyyy)` — DOI hyperlink

### Layout Classes

The CSS (`remark-engine/core/base.css`) provides a consistent layout vocabulary:
- `.perma-sidebar` — colored left sidebar with rotated text
- `.boxed-content` / `.bottom-box` — content containers
- `.pull-left` / `.pull-right` — 45/45 split
- `.left-column` / `.right-column` — 23/65 split
- `.left-column2` / `.right-column2` — 35/50 split
- `.left-column3` / `.right-column3` — auto/30 split
- `.left-column-mid` / `.right-column-mid` — 45/45 even split
- `.dim`, `.gray-text`, `.blur` — visual emphasis/de-emphasis
- `.small`, `.larger`, `.large`, `.huge` — font size modifiers

### Theming via CSS Custom Properties

Themes override `:root` variables defined in `core/base.css`:
- `--accent` — primary color (sidebar, emphasis, icons)
- `--accent-dim` — dimmed variant
- `--accent-dark` — links
- `--heading-color` — h1/h2/h3
- `--logo-url`, `--logo-width`, `--logo-opacity`, `--logo-offset-x/y`, `--logo-aspect` — logo overlay

## Creating a New Talk

1. Create a directory named by date or event.
2. Copy `TEMPLATE.html` to `NEW_DIR/index.html`.
3. Create an `images/` subdirectory for talk-specific assets.
4. Update the `<title>`, QR code, slide content, and theme CSS link.
5. Reuse shared assets from `../assets/` via relative paths.

## Serving Locally

Open any `index.html` directly in a browser, or use a local HTTP server (e.g. `python3 -m http.server`) from the repo root for proper relative path resolution. No build step required.

## Frozen Archival Talks

These talks use inline CSS and will not be migrated to the engine: BHD2023, CIBM-BnS-2024, DataEngWorkshop2024, ISMRM2024, Mat-TechLab-2024, OSU2024, teaching-20240208, 20250206, 20250306, 20250313. DIPY2024 uses Reveal.js (different framework).

## License

CC-BY 4.0.
