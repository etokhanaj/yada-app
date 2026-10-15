# QA · next release (Phases 0–7) against the canvas

13 October 2026. Branch `build-next-release`, PR etokhanaj/yada#4. Simulator: iPhone 17 Pro, iOS 26, dev build.

## How it was checked

- **Frames:** every frame the build plan names (137 IDs) was rendered with `render_frames.py`.
- **Captures:** the key state of each group was captured on the simulator in Light, Dark and AX5 (Accessibility Extra Extra Extra Large), using Maestro flows and deep links. Each capture was set beside its frame.
- **Copy:** checked word for word by reading every frame's interface strings against the app source.
- **Accessibility:** checked by reading the code (targets, labels, Reduce Motion) and by VoiceOver labels in the Maestro hierarchy.
- **Flows:** 01, 04, 08, 09 and 10 pass on the simulator. Flow 10 is new (plans, Settings, Reminder, Downloads).
- **Tests:** typecheck and the test suites pass: schema 160, licensed proxy 16, review 61, app 524, pipeline 479.

Each difference is listed as *frame · theme · difference · what was done*.

## Fixed in this pass (the build's fault)

| Frame | Theme | Difference | Fix |
|---|---|---|---|
| ST-04 | all | Titled "Sources" with "‹ Home"; long subtitles; Explanations before the Bible text | "Sources and licences", "‹ Settings", licence trailing each row (stacked at AX5), Bible text first, "Words and people" |
| ST-01 | all | Compare with showed "First three" | Names the versions ("WEB, KJV, LSV") |
| NT-02 | AX5 | The seventh day wrapped to its own line at standard size | One row of seven, wrapping only at AX sizes |
| VS-02 | all | Opening Understand at a section with "Open Understand in full" on threw (initial detent index out of bounds) | The index moves with the detents; a sheet that opens full is not grown |
| MM-02 | all | Genesis's Hebrew sat at the right margin | Starts at the left, reading right to left |
| RP-04 | all | Short chapters and verse-range portions were never marked read | A portion is finished by its own last verse in view (review fix) |
| ST-04 | all | No "Read online" group for NKJV · NLT · The Message; "Greek sentence structure", "Who speaks"; SBLGNT under Bible text | "Read online · API.Bible · display only" (when licensed versions are on); "Syntax", "Speakers"; the SBLGNT under Words and people |
| CP-08 | all | "Not in BSB" | "Not in the BSB." |
| DI-02 | all | Subtitle "Key word"; "In 1 Corinthians · 22" | "Dictionary"; "In 1 Corinthians · 22 places" |
| MM-04 | all | The word's uses gave no count | "3 times, all in chapter 14" under the title when the uses are in one book |
| EG-06 | all | "Search the BSB instead · with Words and Dictionary" promised a dictionary search that doesn't exist | "· with Words" |
| VS-01 | all | The added-word tip opened only by tapping one italic word (out of VoiceOver's reach) and sat in a filled panel | VoiceOver's activate action on the paragraph opens it; the tip is a muted line with a 44 pt target |
| BA-07 | all | The Voice sheet's "John is downloaded ⋯" never told VoiceOver that Remove exists | One button, "… More, Remove", as the other menus |
| US-05 | AX5, Reduce Motion | "100%" overflowed its 44 pt box | The box grows to fit, on one line |
| ST-01 | AX5 | Row values cut to one line | Values wrap at AX sizes |
| All pushes | Reduce Motion | Pages slid; only sheets faded | Pages fade too, in every stack |

## Where the frame is wrong or superseded (not changed silently)

| Frame | What the frame says | What was built, and why |
|---|---|---|
| BA-03, BA-04 | "Recorded reading · Berean Bible audio · narrator", then iPhone voice | Heart and George only, each "Computer voice" (John, 13 Oct). The frame needs redrawing. |
| AU-07, US-01 | Voice help lines and "Get a clearer voice" in the speed menu | Removed with the iPhone voice as a choice (John, 13 Oct). The speed menu is speeds only. |
| BA-01 | "John 1 · BSB · Recorded ⌄" | "Heart, computer voice ⌄": a computer voice is named as one wherever it is named |
| MM-01 | "Next" beside the passage title | "Next passage" as its own line above the title (John asked, 12 Oct) |
| CP-03 | "All four say the same." | MM-10's "BSB, WEB, KJV and LSV agree here." (the later frame) |
| LT-01 | "Not read aloud." | Listen plays the BSB under a licensed page (decision 4); only "Needs a connection." remains |
| NA-02 | "John's note … Written by John · reviewed" | Not built: John is never cited (decided) |
| VS-01 to VS-07 | Header "John 3:16 · Understand", "In plain words · UST" | Plain "John 3:16" over the passage line, and plain labels (John's decision on headers) |
| PG-03 | The guide opens with "Where readers differ" | The guide's slots follow the later NA frames: In short leads |
| ST-01 | Voice "Recorded reading" with a chevron | Voice "Heart" with a menu of Heart and George |
| MM-11 | "Fixed line, John approves: LORD in small capitals stands for God's name, Yahweh." | Quoted from the WEB's own preface (the BSB's pages don't explain it): a draft for John to approve, not his words |
| MM-12 | "One sentence from M'Cheyne's 1842 preface" | M'Cheyne's sentence quoted exactly from the pinned Calendar: a draft for John |

## For John to decide (the frame and the build differ; neither changed)

| Frame | Difference |
|---|---|
| VS-01 to VS-06, MM-06 | The frames name the source in each heading ("In plain words · UST", "Manuscripts · BSB footnote", "Study notes · Tyndale", "Key words · Translation Words"). The build names the source only where two share a slot, and credits each in Sources. Either is defensible. |
| VS-04 | A Go deeper row "Manuscripts / What the manuscripts differ on". The build shows manuscript notes in the body, not as a row. |
| VS-02 | "25 words, each with its English · evidence marks (MACULA)". The build drops the MACULA half, since it shows no evidence marks there. |
| DI-02, DN-01, DI-03, DI-04 | A full dictionary article with "Related", "Show all 22", "Elsewhere in the Bible · 115", and dictionary browsing in Search. The build shows the Translation Words definition and its uses in the book. A dictionary feature is its own piece of work. |
| CP-08 | "Why: not in the oldest manuscripts" under a version without the verse. The reason is in Understand; Compare doesn't repeat it. |
| NA-01 to NA-08, JR-05, JR-07, EG-01 | Notice facts with a "Compare" link and a source caption, and a "More / Compare translations" list: the earlier guide layout. The build follows the later VS and GD frames (Go deeper, In short). |
| JR-07 vs NA-04 | "7 verses" against "7 verses, each with its Understand": the frames disagree; NA-04 was built. |
| MM-02 | "John 1:1 · Original Greek" as its own sheet: Original opens in place in the build, and the pair sits inside it. |
| NT-02 | The notification preview is two rounded panels, drawn as iOS draws a notification. It's the one rounded block in the app; keep or flatten. |
| U-01 to U-04, PG-03, PG-04, UX-01, UX-06, UX-07, UX-09 | v2 layouts with "Unreviewed", "What's happening" and "Where readers differ" first, and AI entries. IA-11 removes these in v3, and the build follows IA-11. These frames can be archived. |
| DI-03, EG-06, EG-07 (backdrop) | Home behind Search shows "Start with John · 46 passages"; Home now follows ON-01 and IA-14. |
| MS-03 | Siri's snippet "John 3:16 · BSB": Siri speaks "John 3:16, Berean Standard Bible." and the verse. |

## Not built, with the reason

| Frame | Why | What it needs |
|---|---|---|
| MM-03 | Underlining the BSB partner of a tapped Greek or Hebrew word needs a word link the bundles don't carry. Guessing one from glosses breaks rule 4. | A pipeline step: join `bsb_tables.tsv` (Greek Sort or Heb Sort to the BSB English, in BSB order) to core's tokens by order and surface. Write it per verse into the Understand bundles and rebuild the 54 books. |
| MS-01 | A map in Yada's style needs a place data source. Its licence question (OpenBible geocoding, CC BY 4.0, with confidence) and STEPBible's no-redistribution request are open. | John's call on the data source. |
| MS-04, MS-05 | The UST as a plain-English translation is a new text to ingest. Its licence must be read from the source at ingest (rule 3). | An ingest task. |
| NT-08 | "Download finished while Yada was closed" can't happen: downloads stop when the app is suspended. | Background URLSession downloads. |
| WA-01, WA-02 | WEB and KJV human audio | John moved audio to Heart and George. WEB and KJV readings are built only if John asks. |

## Device and release checks still needed

- **Signing for a device or TestFlight build:**
  - The widget extension and the App Group `group.studio.yada.reader` need the App Groups capability on the App ID.
  - Release builds pass `APPLE_TEAM_ID` to both targets.
- **Things the simulator can't show:**
  - The widgets on the Home Screen (WL-01, WL-04): the data handoff was checked, the placement wasn't.
  - Spotlight results (MS-02): the index is written once per core version.
  - Siri's spoken answer (MS-03).
- **Live Activity:** the Dynamic Island showed the playing verse ("1:5") on the simulator. The Lock Screen controls (WL-02) are iOS 17 intents and need a device.
- **Maestro:**
  - A dev build that Maestro launched itself froze on the first swipe. Launched by `simctl`, the same flows pass.
  - Maestro's hierarchy doesn't reach a sheet over the full-screen player, so flow 08 taps the Voice sheet's rows by position.
- **EG-03** ("Audio is the BSB" under a licensed page) needs the licensed proxy. It wasn't exercised here.
- **Widget typeface:** the widgets use the system serif (New York), because Literata isn't bundled in the extension.

## Decisions logged for John

- **"Where you stopped" (MM-05):** shows after 3 days away.
- **"A passage for today":** verse 1 of a psalm, going through the Psalter by day of the year. It's the same for everyone that day, and BSB only.
- **Reminders:** scheduled 14 days ahead from the phone's own progress. After two weeks away they pause and say so once on Home (NT-09).
- **Your plan:** whichever plan was last read in. Opening a reading from a plan makes it yours.
- **Remove my data:** removes exactly what the alert names. Appearance, text size, translation and Compare with stay: clearing them would reset the reader's other devices through iCloud. Another signed-in device keeps its own iCloud copy and sends it back on its next sync.
