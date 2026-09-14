# CoRstellation

Fifteen years of European Committee of the Regions photography, as one field
you can move through.

**1,237 albums · 104,515 photographs · 2011 to 2026.**

Open `index.html`. Nothing to install, nothing to build — it works on GitHub
Pages and by opening the file from disk.

## What you are looking at

Albums are laid out along three spiral arms of time: 2011 near the centre, 2026
at the edge. Each disc is one album, sized by how many photographs it holds and
coloured by date — royal blue for the early years, gold for the recent ones.

The shape tells a story on its own. Activity climbs steadily to 2019, collapses
in 2020 and 2021 — no meetings, no photographs — then returns and overtakes what
came before. 2025 is the densest year on record, with 183 albums and 16,657
photographs.

The page opens on the core of the galaxy rather than on the whole field: 1,237
discs seen from very far away are only a haze. **All** zooms out to the full
extent.

## Three levels

| Scale | What you see |
| --- | --- |
| far out | a coloured disc per album |
| closer | the album cover |
| inside | click an album: its photographs, as a field of their own |

Inside an album the photographs are laid out and navigated exactly like the
galaxy — same drag, same zoom, same momentum. Entering an album changes the
contents, not the interface. Clicking a photograph opens it large, with arrow
keys to move through the album and `Esc` to come back.

Photographs are fetched from the Flickr API only when an album is opened, and
covers only for albums actually on screen. Nothing is preloaded: 104,515
thumbnails would be megabytes of images nobody would ever scroll past.

## Moving around

| | |
| --- | --- |
| Mouse | drag to move, scroll to zoom, double-click to dive in |
| Touch | one finger to move, two to pinch |
| Keyboard | `+` `−` zoom, arrows move, `0` shows everything, `Esc` closes |

Zooming keeps the point under the cursor still, which is what stops you getting
lost. Releasing a drag carries a little momentum.

Titles are chosen rather than merely thresholded. On every pass the albums on
screen are ranked by size, and a title is kept only if it does not overlap one
already placed. The number shown therefore adjusts itself to the density of the
moment: a crowded area gives its few largest names, an empty one names
everything in it.

Built for a wall display as much as for a laptop: large hit areas, no
hover-only affordance, nothing that needs a mouse.

## Structure

```
corstellation/
├─ index.html                markup only
├─ assets/
│  ├─ corstellation.css
│  └─ corstellation.js
└─ data/
   └─ albums.js              the album list, exported from the Flickr API
```

No build step, no framework, no runtime dependency. All behaviour and
presentation sit in external files, so the page can be served under a strict
Content-Security-Policy without `unsafe-inline`.

The whole scene is a single transformed layer, so panning and zooming are
composited by the GPU rather than re-laid out on every frame. The view is
animated towards a target rather than set directly — that is what gives the
glide, and what makes it usable on a large screen where abrupt jumps read as
faults.

## The API key

`index.html` carries the Committee's Flickr application key on one line, marked
`METTRE_LA_CLE_ICI` in a fresh checkout. **Replace it, or nothing will load.**

That key identifies the application and grants no write access — any page
calling the API from a browser exposes its own. The application *secret* never
appears here and is not needed to read public photographs.

## Refreshing the album list

```powershell
$key  = "<api key>"
$nsid = "62673028@N02"          # flickr.com/photos/cor-photos

$first = Invoke-RestMethod "https://api.flickr.com/services/rest/?method=flickr.photosets.getList&api_key=$key&user_id=$nsid&per_page=500&format=json&nojsoncallback=1"
$all = @()
foreach ($p in 1..$first.photosets.pages) {
  $u = "https://api.flickr.com/services/rest/?method=flickr.photosets.getList&api_key=$key&user_id=$nsid&per_page=500&page=$p&format=json&nojsoncallback=1"
  $all += (Invoke-RestMethod $u).photosets.photoset
}

$rows = $all | ForEach-Object {
  [pscustomobject]@{
    i = $_.id                   # album id
    t = $_.title._content
    n = [int]$_.photos
    d = (Get-Date '1970-01-01').AddSeconds([int]$_.date_create).ToString('yyyy-MM-dd')
    p = $_.primary              # cover photo id
    s = $_.server               # image server
    c = $_.secret               # url token
  }
} | Sort-Object d

"window.CORSTELLATION_ALBUMS = " + ($rows | ConvertTo-Json -Compress) + ";" |
  Set-Content data\albums.js -Encoding UTF8
```

Run it from the repository folder, so `data\albums.js` lands in the right place.
Expect about 200 KB. The `p`, `s` and `c` fields are what covers are built from:
without them the page still works but stays at coloured discs, and says so.

Read access only. The page never writes to Flickr and stores no images: it keeps
album identifiers and titles, and links back to Flickr for everything else.

## Rights

The albums are the Committee's own, and the conference rooms carry a notice that
photographs are taken and may be reused. That covers reuse by the Committee. If
CoRstellation is ever made public, redistribution by third parties should be
looked at again, with the licence Flickr records for each photograph.

No facial recognition, no image analysis, no identification of people. The page
displays what the photographers published, under the titles they chose.

## What is not here yet

**A search.** Twelve hundred album titles are a corpus of their own — "president
meets", "plenary session", "COTER commission". A filter would make the field
answerable rather than only browsable.

**A link to enCoR.** The quote database covers the same events from the spoken
side. Connecting the two would let a session be illustrated by the photographs
taken at it. Matching at event level can be automatic, since album titles carry
the event name; putting a face to a named speaker stays a manual choice,
deliberately.

**Touch has not been tested** on a real tablet or wall display.
