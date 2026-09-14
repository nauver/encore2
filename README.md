# CoRstellation

Fifteen years of European Committee of the Regions photography, as one field you
can move through.

1,237 albums · 104,515 photographs · 2011 to 2026.

Open `index.html`. Nothing to install, nothing to build — it works on GitHub
Pages and by opening the file from disk.

## What you are looking at

Albums are laid out along a spiral of time: 2011 at the centre, 2026 at the
edge. Each disc is one album, sized by how many photographs it holds and
coloured by year.

The shape tells a story on its own. Activity climbs steadily to 2019, collapses
in 2020 and 2021 — no meetings, no photographs — then returns and overtakes
what came before. 2025 is the densest year on record, with 183 albums and
16,657 photographs.

Click any album to open it on Flickr.

## Three levels of detail

Zooming does not only make things bigger — it changes what is shown.

| Scale | What you see |
| --- | --- |
| far out | a coloured disc per album, sized by its number of photographs |
| closer | the album cover |
| close in | the photographs themselves, in a ring around the album |

The photographs are fetched from the Flickr API only for albums actually on
screen, and only once you are close enough to look at them. Nothing is
preloaded: 104,515 thumbnails would be several megabytes for images nobody
would ever scroll past. Clicking a photograph opens it on Flickr.

## Moving around

| | |
| --- | --- |
| Mouse | drag to move, scroll to zoom, double-click to dive in |
| Touch | one finger to move, two to pinch, double-tap to dive in |
| Keyboard | `+` `−` to zoom, arrows to move, `0` to fit, `Esc` to close |

Zooming keeps the point under the cursor still, which is what stops you getting
lost. Releasing a drag carries a little momentum. Labels appear once the scale
makes them legible, and only for the larger albums — twelve hundred captions at
once would be unreadable.

Built for a wall display as much as for a laptop: large hit areas, no
hover-only affordance, nothing that needs a mouse.

## Structure

```
corstellation/
├─ index.html
├─ assets/
│  ├─ corstellation.css
│  └─ corstellation.js
└─ data/
   └─ albums.js        the album list, exported from the Flickr API
```

No build step, no framework, no runtime dependency. All behaviour and
presentation sit in external files, so the page can be served under a strict
Content-Security-Policy without `unsafe-inline`.

The whole scene is a single transformed layer, so panning and zooming are
composited by the GPU rather than re-laid out on every frame. The view is
animated towards a target rather than set directly — that is what gives the
glide, and what makes it usable on a large screen where abrupt jumps read as
faults.

## Refreshing the data

The album list comes from the Flickr API, using the Committee's own application
key. In PowerShell:

```powershell
$key  = "<api key>"
$nsid = "62673028@N02"          # flickr.com/photos/cor-photos

$all = @()
$first = Invoke-RestMethod "https://api.flickr.com/services/rest/?method=flickr.photosets.getList&api_key=$key&user_id=$nsid&per_page=500&format=json&nojsoncallback=1"
foreach ($p in 1..$first.photosets.pages) {
  $u = "https://api.flickr.com/services/rest/?method=flickr.photosets.getList&api_key=$key&user_id=$nsid&per_page=500&page=$p&format=json&nojsoncallback=1"
  $all += (Invoke-RestMethod $u).photosets.photoset
}

$rows = $all | ForEach-Object {
  [pscustomobject]@{
    i = $_.id
    t = $_.title._content
    n = [int]$_.photos
    d = (Get-Date '1970-01-01').AddSeconds([int]$_.date_create).ToString('yyyy-MM-dd')
    p = $_.primary          # identifiant de la photo de couverture
    s = $_.server           # serveur d'images
    c = $_.secret           # jeton de l'URL
  }
} | Sort-Object d

"window.CORSTELLATION_ALBUMS = " + ($rows | ConvertTo-Json -Compress) + ";" |
  Set-Content data\albums.js -Encoding UTF8
```

The `p`, `s` and `c` fields are what album covers are built from:
`https://live.staticflickr.com/{s}/{p}_{c}_q.jpg`. Without them the page still
works, but stays at coloured discs.

Read access only. The page never writes to Flickr and stores no images: it keeps
album identifiers and titles, and links back to Flickr for everything else.

## The API key

`index.html` carries the Committee's Flickr application key in a one-line
script. That key identifies the application and grants no write access — any
page calling the API from a browser exposes its own. The application *secret*
never appears here and is not needed for reading public photos.

## What is not here yet

**A search.** Twelve hundred album titles are a corpus of their own — "president
meets", "plenary session", "COTER commission". A filter would make the field
answerable rather than only browsable.

**A link to enCoR.** The quote database covers the same events from the spoken
side. Connecting the two would let a session be illustrated by the photographs
taken at it.
