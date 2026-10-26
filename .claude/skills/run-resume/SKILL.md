---
name: run-resume
description: Run, preview, screenshot, and check Nabaraj Subedi's academic website (static HTML on GitHub Pages: index/publications/teaching/cv.html) and build the LaTeX CV. Use when asked to start or serve the site, take a screenshot of a page (desktop or mobile), click through it, check for broken links/images, or rebuild cv.pdf.
---

Static HTML/CSS/JS site with no build step, published to GitHub Pages
(`subedinab/subedinab.github.io`, branch `main`). To drive it, use
`.claude/skills/run-resume/driver.mjs`. The driver serves the repo
root, starts headless Chrome over the DevTools protocol, and reads
commands from stdin. It needs no npm install. Paths below are
relative to the repo root.

## Prerequisites

- Node ≥ 22 (it provides the global `WebSocket`). Verified on v22.22.0.
- Google Chrome. The driver looks in
  `/Applications/Google Chrome.app/...` and then
  `/usr/bin/google-chrome` / `chromium`. Set `CHROME=/path` to
  override.
- For the CV only: `pdflatex` (TeX Live / MacTeX).

## Run (agent path)

```bash
node .claude/skills/run-resume/driver.mjs <<'EOF'
nav publications.html
count .publication.has-teaser
click #plansightrag .bibtex summary
text #plansightrag .bibtex pre
ss-el #plansightrag pub-plansightrag
viewport 390 844 mobile
nav index.html
click .nav-toggle
eval document.querySelector('.nav-toggle').getAttribute('aria-expanded')
ss home-mobile
check
errors
EOF
```

The driver prints `ready http://127.0.0.1:<port>/` first. Screenshots
go to `$SHOTS`, which defaults to `$TMPDIR/resume-shots/<name>.png`;
the driver prints each absolute path. The process exits 1 if any
command errored or `check` found problems.

| command | what it does |
|---|---|
| `nav <page>` | load `<page>`, wait for load, force-load lazy images |
| `viewport <w> <h> [mobile]` | device emulation (default 1280×900 desktop) |
| `ss <name>` | full-page screenshot |
| `ss-el <selector> <name>` | screenshot one element, e.g. one publication |
| `click <sel>` / `text <sel>` / `count <sel>` / `eval <js>` | interact and inspect |
| `check` | go through every `*.html`: missing local `href`/`src` files, images that didn't render, JS exceptions/console errors, HTTP ≥400, horizontal overflow at 390px |
| `errors` | console/network problems seen so far |

Before committing any content edit, run `check` at a minimum. Look
at the screenshots yourself, because `check` cannot judge layout.

## Build the CV

`cv.html` links to `assets/Nabaraj_Subedi_CV.pdf`, which is a
committed build of `cv.tex`. To rebuild it:

```bash
O=$(mktemp -d) && pdflatex -interaction=nonstopmode -halt-on-error -output-directory="$O" cv.tex && cp "$O/cv.pdf" assets/Nabaraj_Subedi_CV.pdf
```

Build into a temp dir. A plain `pdflatex cv.tex` leaves
`cv.aux/.log/.out/.synctex.gz/.pdf` untracked in the repo root.

## Publish

Pushing `main` deploys the site. The repo is owned by **subedinab**,
but the active `gh` account is usually **Nabarajsub**, which gets a
403 when it pushes. Push as subedinab without changing the default
account for long:

```bash
gh auth switch -u subedinab && git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main; gh auth switch -u Nabarajsub
```

Do not add `Co-Authored-By: Claude` / `Claude-Session:` trailers to
commits. The owner had them stripped from history so that Claude no
longer shows up as a contributor.

## Gotchas

- **Plain `chrome --headless --window-size=390,...` screenshots are
  wrong for mobile.** Headless Chrome has a minimum window width, so
  the page lays out wider than 390px and gets clipped. That makes
  overflow look real when it isn't. Use the driver's
  `viewport 390 844 mobile`, which sets device metrics instead.
- **Opening the file directly (`file://`) skips real request
  failures.** The driver serves over HTTP so that missing assets
  show up as `HTTP 404`.
- **Publication images use `loading="lazy"`.** Below-the-fold
  teasers are blank in screenshots unless they are forced to load.
  `nav` does this already.
- **Mobile breakpoints:** the nav collapses at 760px (`script.js`
  and CSS), and teaser thumbnails stack at 760px. Other publication
  tweaks start at 480px.
- **Teaser images** live in `assets/teasers/<id>.png`, keyed by the
  publication's `id`. They are copied from the paper sources: ARCC
  `/gscratch/nsubedi1/...` via `ssh arcc`, or from the arXiv
  e-print. MontageFlow deliberately has no teaser.
- **The plansightrag GitHub repo is private,** so the site's Code
  link to it returns 404 for visitors. `check` does not flag this
  because it only tests local links.

## Troubleshooting

- **`remote: Permission to subedinab/subedinab.github.io.git denied to Nabarajsub` (403)**: the wrong `gh` account is active. Use the publish command above.
- **`cv.log already exists, no checkout` when popping a stash**: an editor's LaTeX auto-build recreated the `cv.*` artifacts as soon as `cv.tex` reappeared. The build files are regenerated and safe; everything else was restored.
