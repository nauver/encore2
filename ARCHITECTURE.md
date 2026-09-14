# enCoR — code structure

No build step, no framework, no runtime dependency. Three static pages sharing
one data folder. Every file has a single responsibility and states it in its
header comment.

```
encor/
├─ index.html          landing page      — what enCoR is, and where to start
├─ read.html           reading view      — quotes, search, context
├─ corpus.html         corpus view       — themes as a constellation
├─ albums.html         album view        — fifteen years of photo albums
├─ admin.html          editing view      — timing, wording, validation
├─ assets/
│  ├─ landing.css / landing.js     landing page
│  ├─ encor.css / core.js / vocabulary.js / context.js / read.js
│  │                                reading view and its search
│  ├─ corpus.css / corpus.js       theme constellation
│  ├─ albums.css / albums.js       album constellation
│  └─ admin.css / admin.js         editing view
└─ data/
   ├─ index.js         list of quote datasets to load
   ├─ transcripts.js   full transcripts, ~900 KB, loaded on demand only
   ├─ flickr-albums.js 1,237 albums, loaded only by albums.html
   └─ <session>.js     one validated dataset per session
```

## Load order

`read.html` loads, in this order: `core.js`, `vocabulary.js`, `context.js`,
then the datasets, then `read.js`. Dependencies only ever point downwards —
`core.js` knows nothing about the views, the views know nothing about each
other.

`index.html`, `corpus.html`, `admin.html` and `albums.html` each load only
their own data and their own module.

**One check that matters.** A module can be valid on its own and still break
the page: two modules declaring the same name in global scope raise a
redeclaration error at load, and the whole file is skipped. The test is to
concatenate the modules of one page and parse the result:

```
cat assets/core.js assets/vocabulary.js assets/context.js assets/read.js | node --check
```

Ten lines in a GitHub Actions workflow would catch this before it ships.

## Security notes

**No inline script, no inline style.** All behaviour and presentation live in
external files, so the pages can be served under a strict
Content-Security-Policy without `unsafe-inline`. A workable policy:

```
default-src 'self';
style-src 'self' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
script-src 'self';
frame-src https://webstreaming.cor.europa.eu;
```

`frame-src` is only needed by `admin.html`, which embeds the portal player.

**No `eval`, no `new Function`, no dynamic code.** Datasets are plain scripts
calling `registerSession()`; they are data, not logic.

**Every value interpolated into the DOM is escaped** through `esc()` in
`core.js`, including the search-term highlighter, which escapes before it
marks. The only unescaped insertions are literal strings written in the code.

**No browser storage, no cookies, no network calls** from the public pages
beyond loading their own assets. Nothing is sent anywhere; nothing is kept
between visits.

**Datasets are scripts rather than JSON** so the pages work when opened from
disk, where `fetch()` is blocked. The trade-off is accepted deliberately: the
files are produced by the pipeline and reviewed before being committed, so
they are trusted input.

## Conventions

- One concern per file; the header comment states the purpose and what the
  file exposes.
- Sections inside a file are separated by `/* --- n. name --- */` banners.
- Comments explain *why*, not *what* — the reasons behind a choice, the
  constraint that forced it, the trap it avoids.
- French in the code comments where the reasoning was developed in French;
  English in everything the reader sees.
