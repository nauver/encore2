# enCoR — timestamped quotes from EuroPCom

A proof of concept: pull a handful of striking quotes out of each EuroPCom
session, attribute them to the right speaker, and link each one to the exact
second of the video on the CoR webstreaming portal.

Open `index.html`. Nothing to install, nothing to build — it works both on
GitHub Pages and by double-clicking the file on your own machine.

## Why this exists

The portal already publishes the video and its transcript, with full-text
search. What it does not do is tell you **who** said what, or surface the
passages worth quoting. That is the gap this fills.

## Two pages

`index.html` is the public view: read the quotes, filter by speaker, click through to
the exact moment in the video. Nothing to fill in.

`admin.html` is the editing view. It loads the same datasets and lets you play each
quote in a large embedded player, correct the timing, fix the wording, complete the
speaker name, add or refine the English translation, and mark the quote as validated.
Validated quotes rise to the top of the list.

When you are done, **Download data file** exports a `data/<id>.js` containing only the
validated quotes, with the corrected timings. Replace the file in `data/` and the
public page reflects your work. Exporting is the validation — nothing is saved
automatically, so export before closing the tab.

If every quote in a session is off by the same amount, correct **startUTC** or use
**global shift** rather than nudging each quote.

## How it is built

1. The media is downloaded from the Streamovations API, **original floor
   track** (`or`) — never an interpreted track, see below.
2. cScribe produces the SRT.
3. Timecodes from the SRT plus the session programme give the speaker
   attribution.
4. Candidate quotes are extracted, then reviewed by a human.
5. `seek_epoch = startUTC + start_sec - 3` builds the portal link. The
   three-second margin stops the video landing after the first word.

`startUTC` is read from the Transcription panel on the portal: the clock time of
the first line shown, minus the timecode of the first subtitle. It cannot be
derived from the scheduled start — on the 2026 opening, the stream begins
3 min 41 s after the announced time.

## Adding a session

Drop `data/<id>.js` next to the existing one, then list its id in
`data/index.js`. That is all — a tab appears.

```js
registerSession({
  id: "europcom-2025-opening",
  title: "EuroPCom 2025 — Opening session",
  date: "2025-07-03",
  durationSec: 3573,
  reference: "europcom-2025-opening-session",
  startUTC: 0,                       // read from the portal
  track: "or",
  portalUrl: "https://webstreaming.cor.europa.eu/en/cor/...",
  quotes: [
    { id: "q001", speaker: "…", role: "…", theme: "…",
      start_sec: 986, timecode: "00:16:26",
      quote: "…", seek_url: "https://webstreaming.cor.europa.eu/en/cor/.../seek/…" }
  ]
});
```

## Before publishing any quote

**The track matters.** On an interpreted session the transcript carries the
interpreter's words, not the speaker's. Publishing that in quotation marks under
an elected official's name is a real editorial risk. Only the floor track
supports verbatim — and within one session some speakers use the floor language
while others do not, so this is a per-speaker call, not a per-session one.

**Transcripts contain errors.** Proper nouns are often mangled, and French is
transcribed noticeably worse than English. A French quote must be checked
against the audio before publication.

**Watch for quoted material.** A speaker paraphrasing Thucydides should not be
credited with the line. Those passages are dropped at review.

**The floor is not included.** Speakers listed in the programme are public
figures speaking in that capacity; someone asking a question from the audience
is not. Only the former appear here.

**Transcription gaps.** More than twenty seconds between two subtitles signals a
missing passage. Quotes on either side of a gap may be truncated with nothing to
show for it.

## Status

Proof of concept, not a product. The candidate quotes were selected on formal
criteria — self-contained sentence, complete idea, no reference to what came
before. Nobody has yet checked that they match what a communicator would
actually have picked. That is what the review is for.

Keep this repository **private**. It holds speaker names, words attributed to
them, and links to CoR sessions.
