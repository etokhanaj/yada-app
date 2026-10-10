# More translations: plan

Status: approved by John 10 Oct 2026; sent to the build session. Canvas frames MT-01–06 (v2 page,
https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc). Needs John's go-ahead before any build.

## What the reader gets

- **Built in, offline from day one:** BSB, WEB, KJV, LSV (core bundle).
- **Download, then offline:** public-domain versions, one file each: about 3.4 MB to download (sent gzipped), 7.5 MB on the phone with its search index.
- **Online:** NIV, NKJV, NLT via API.Bible (dev flag; display-only, CLAUDE.md rule 9).

## Screens (canvas)

| Frame | What |
|---|---|
| MT-01 | Contents: the switch becomes one value row, `Translation        BSB ›`; the current book is marked with a tick and semibold (no wash, bar or "Reading"; same in C-01) (four segments is the most that fits; downloads would break it) |
| MT-02 | Translations sheet: **On your iPhone** (current one: tick + semibold), **Download** (name; `3.4 MB`, the download size only, John 10 Oct 2026; download glyph), **Online** (one line "Needs a connection."; `NIV · Biblica`) |
| MT-03 | Downloading: a progress ring with a stop square replaces the glyph; the line reads `Downloading · 0.6 of 7.5 MB` (progress counts the file as written, uncompressed); tap cancels |
| MT-04 | Done: the version moves up to On your iPhone with `⋯` (Remove, native menu). No toast, no badge |
| MT-05 | Offline: rows stay readable (no dimming; it would fail contrast), download actions disappear, one line: `Downloads need a connection.` |
| MT-06 | Reading John 1 in YLT: header `John 1 · YLT ⌄`; nothing else changes |

Pattern from John's YouVersion "My versions" screenshot (abbreviation tile, name, one trailing action),
with Skillshare and Glow on Mobbin for the download states. Translation covers replace plain tiles (see below). Not taken: publisher lines on
public-domain rows, a "3,865 versions" count, a cloud icon on every row, a settings gear.

## Translation covers (upgrade pass, 10 Oct)

Each version has a small portrait cover, like Apple Books, Goodreads and Blinkist library lists: 40×56 pt
(56×78 at AX sizes, top-aligned), a 4 pt darker spine on the left, a soft drop shadow (a 1 pt light
edge in dark mode), the abbreviation in Literata semibold 11 pt with a short rule beneath.

One of five brand tones, fixed per version so readers learn them. Tone is identity, never state
(current = tick + semibold):

| Tone | Ground | Text | Versions |
|---|---|---|---|
| forest | #183F35 | #F7F8F0 | BSB, NKJV |
| paper | #F7F8F0 | #183F35 | WEB, YLT, NLT |
| ink | #16231E (dark mode #0B120F) | #DBEC9A | KJV |
| lime | #DBEC9A | #183F35 | LSV, MSB |
| sage | #526D63 | #F7F8F0 | ASV, NIV |

The tone belongs in each translation's manifest entry (`cover`), so new versions get one when added.
Rows: cover, the name in Literata, one muted line only when it says something (year · size, progress,
"Downloaded · 1.3 MB", publisher). Built-in rows have no second line. Covers appear only in the
Translations sheet; too small elsewhere to read as books.

## First downloadable set

All public domain, read from each eBible package's `_about.htm` on 10 Oct 2026 (re-read at ingest):

| Code | Version | Year | Verses | Compressed text |
|---|---|---|---|---|
| ASV | American Standard Version | 1901 | 31,086 | 3.4 MB (7.5 MB on the phone) |
| YLT | Young's Literal Translation | 1898 | 31,102 | 3.4 MB (7.5 MB on the phone) |
| MSB | Majority Standard Bible | 2024 | 31,098 | 3.3 MB (7.2 MB on the phone) |

Darby and Geneva are left out (John, 10 Oct 2026): Geneva's eBible text is numbered against another versification, and Darby lacks verses the others print.
More can follow the same path one at a time; each needs its licence read from the source file.

## Where the files come from: our own storage

Built by the pipeline from eBible sources and served from R2 (the publish step and manifest already
exist), not fetched live from a third-party API. Reasons: versification normalised to Yada's verse ids,
licences recorded in sources.manifest.json, sha256 checked, and no dependency on someone else's server.
The Free Use Bible API (bible.helloao.org) is a useful cross-check and catalogue, not the delivery path.

## Build

**Pipeline**
1. `sources.ts`: one entry per version (eBible VPL zip, pinned by digest), licence from the package.
2. `english.ts`: generalise `parseVpl` to any code; the eBible "-" placeholder skip already exists.
3. New `package translation <CODE>`: a small SQLite per version (`translation-ylt.v1.db`: `texts` keyed
   by verse ord, FTS index, `meta` with name, year, licence, attribution, sha256). Core is unchanged.
4. Manifest: a `translations` list (code, name, year, bytes, sha256, url, licence).
5. `publish` uploads them to R2 like the book bundles. Ask John before any publish.

**App**
1. Translations sheet (MT-02–05) from the manifest; download to the app's documents directory, verify
   sha256, then ATTACH the database alongside core (the same pattern as Understand bundles).
2. Reader, Compare and Search treat an installed translation exactly like a built-in one. Compare lists
   what's installed, BSB first.
3. Remove deletes the file; if it was current, fall back to BSB.
4. Accessibility: each row is one element ("Young's Literal Translation, 1898, 1.3 megabytes, download");
   progress is announced at 25% steps; Reduce Motion shows a static percentage instead of the ring.
5. Sources lists each installed translation with its licence.

**Copy on Sources** changes from "All of it is on your iPhone" to keep it true:
"Built-in texts need no connection. Downloaded translations work offline once saved."

## Compare cap (decided by John 10 Oct)
Compare shows the reader's translation plus up to **three** others. Default: the first three other
installed versions in On your iPhone order (WEB, KJV, LSV). A `Choose` control in the Translations
sheet header picks which three; the choice is saved. VoiceOver: "Comparing with WEB, KJV and LSV".

## Open
- NET Bible: free text with its own terms; read them before listing.
