# Images audit (18 Oct 2026)

Read-only audit. John asked us to check that every place showing a picture was planned properly. Today's hero drew past its 520 pt box and showed again at the foot of the page. `overflow: "hidden"` fixed that (`app/(tabs)/today.tsx:390`). John later narrowed the scope to **the pictures meant to change**: the day's picture, evening pictures, and the Earlier-days set. Part A covers those. Part B lists every other image in the app.

Sources: `docs/pictures-plan.md`, `docs/build-7-plan.md` §0 and phase 4, the build 11 plan commit (3292c7d), `content/pictures/manifest.json`, `apps/mobile/scripts/sync-bundles.mjs`, `src/data/pictures.generated.ts`, `src/lib/today.ts`, and the frames' HTML and CSS. Paths are relative to `apps/mobile/src` unless they say otherwise.

## Most serious first

| # | Problem | Where | Severity |
|---|---|---|---|
| 1 | **Share as an image goes to a route that does not exist.** The reader's More menu offers it for every non-licensed translation, then pushes `/share-image`. No such screen exists in `app/` or in any branch's history, so Expo Router shows its unmatched-route screen. | `app/read/[book]/[chapter].tsx:700-702`, `lib/reader.ts:143` | high |
| 2 | **At AX sizes, Today still puts a photo at the foot of the page, under "Later · This evening".** This is what John reported, and here the code does it on purpose (`inlinePicture`). The frame (DR-11, DR-12, EB-04, XT-01 AX5) draws the picture as a 300 pt rounded figure straight after the reading card, with the day's verse over it on the fade. The app draws the verse as a plain card after all the other cards, then a 260 pt picture with no words, last of all. | `app/(tabs)/today.tsx:339-343, 412` | high |
| 3 | **The greeting and date fail contrast on about a third of the 30 pictures.** The top of the fade goes from 42% black to 0 by 26%. The date (15 pt, needs 4.5:1) sits at 14–26% of the hero. Median contrast there is under 3:1 on days 1, 3, 4, 6, 12, 13, 15, 19, 21, 22, 28 and 30 (table A4). Only the text shadow keeps it readable. The frame uses the same gradient, but it was drawn on one darker picture, so the frame passes and the set does not. | `app/(tabs)/today.tsx:348` | high (accessibility) |
| 4 | **The evening set is missing.** The plan is 30 morning and 30 evening pictures (pictures-plan.md §How many). Only 30 exist, with no morning/evening field. Today drops the picture after 17:00. Return and Daily prayer keep showing the morning picture in the evening, so the three screens disagree after 5 pm. | `app/(tabs)/today.tsx:72`, `app/return.tsx:46`, `app/office.tsx:30` | medium |
| 5 | **The "morning" set includes evening and night subjects.** Day 2 is *Moon over Little Bear Peak*, which the plan names as **day 1's evening** picture. Day 14 is an aurora and day 29 the Milky Way. Days 11, 17, 18 and 23 are sunsets. | `content/pictures/manifest.json` | medium |
| 6 | **Return and Daily prayer have no Reduce Transparency version.** The design system asks for at least 86% under words, as a full-bleed fade. Return peaks at 82%; Daily prayer is a flat 62%. | `app/return.tsx:71`, `app/office.tsx:104` | medium |
| 7 | **The manifest is missing what the plan says each entry holds**: the part (morning or evening), the verse it shows, the sha256 of the original *and* of the graded file, and approval in the review queue ("nothing ships unapproved"). `packages/review` has no picture path. | manifest, pictures-plan.md §Pipeline 1–3 | medium |
| 8 | **Day 12's licence needs a check at the source (rule 3).** The entry says "Yang Song (@starsy), via Unsplash", from "Wikimedia Commons", licence "CC0". That CC0 comes from a Commons re-upload. Unsplash photos are under the Unsplash License, not CC0. Read the licence on the original Unsplash page, or replace the picture. Day 15 (Vulturesong, CC0, a private person) comes from none of the plan's three sources. | manifest days 12, 15 | medium |
| 9 | **No per-picture credit anywhere.** The plan puts credits in ⋯ › About this picture (DR-14), which isn't built. Sources says only "Wikimedia Commons · Public domain and CC0". The `by`/`from` fields also don't fit DR-14's layout: `by` holds Flickr account names ("YellowstoneNPS") and `from` holds the host, where the frame expects "By Jacob W. Frank / From Yellowstone National Park, National Park Service". | `lib/sources.ts:49,120`, `data/today.ts:165` | medium |
| 10 | **The verse on the picture isn't the picture's verse.** The verse is Daily Light's line for the date (`data/today.ts:79`, 365 entries). The picture follows the 30-day psalter. The plan pairs each picture with a verse that John approves, and DR-11 says "a line from this morning's psalms". | `data/today.ts:79` | medium (content; decision 6 may have changed this on purpose; confirm with John) |
| 11 | No dark placeholder under the hero while the JPEG decodes. The ScrollView is paper-white and the greeting is white, so for the first frame or two the greeting is white on white. Return (`NIGHT`) and Daily prayer (`FOREST`) have a dark ground already. | `app/(tabs)/today.tsx:390` | low |

Image places audited: **11** (Part B), **4** of them show the rotating picture. Frames showing a picture the app doesn't draw: **12** (Part C).

---

## Part A: the pictures that change

### A1. What was planned

| What | Plan | Source |
|---|---|---|
| Sets | 30 morning + 30 evening = 60, reused each month; a new set each year is 60 more | pictures-plan.md §How many |
| Choice | One per psalter day (the psalter repeats monthly); morning or evening by the 17:00 switch (DR-12) | pictures-plan.md; build-7-plan |
| Treatment | 3:4 portrait crop around the subject, 1200 × 1600; warm grade for morning, cool for evening; a smaller copy for the widget | pictures-plan.md §Same look, §Pipeline 2 |
| Delivery | Published to R2 by John; the app downloads a week ahead | pictures-plan.md §Pipeline 4 |
| Review | John approves each picture *and its verse* in the review queue | §Pipeline 3 |
| Credit | Not on the picture; in ⋯ › About this picture and in Sources and licences | §Pipeline 5; DR-14 |
| Where it appears (frames) | Today hero DR-11 (morning), DR-12 (evening, picture `27a307…` "A rose-coloured full moon…", Psalm 8:3); AX5 inset figure; DR-16 full-screen verse; DR-17 ⋯; DR-14 About; DR-18 / PS-05 share card with a choice of day picture, evening picture, white or dark; PS-04 Saved › Images; DR-19 Earlier days (64 pt thumbnails, "Today" and "Last night"); RT-01 Return; DO-04 Daily prayer; TB-01 / DU-01 iPad and Duo | frames |
| Deferred | build-7-plan §0 "Moved to build 8": evening pictures, pictures beyond 30, the full-screen verse with Earlier days and About this picture; carried into the build 11 plan (3292c7d) | build-7-plan.md:55,60 |

### A2. What exists

- `content/pictures/manifest.json`: 30 entries `{day, file, sha256, title, by, from, licence, source, alt}`. All 30 sha256 hashes match the bundled files. There is no `part`, `verse`, graded hash or approval.
- `scripts/sync-bundles.mjs:66-90` copies the 30 JPEGs into `assets/bundles/pictures` (11 MB, every one 1200 × 1600) and writes `data/pictures.generated.ts`. The pictures ship in the app binary. There is no R2 download and no widget-size copy.
- `lib/today.ts:45` `pictureDay = min(date, 30)`. This matches `lib/dailyPsalms.ts` (the 31st repeats day 30; February never reaches days 29–30, as the psalter itself does).

### A3. Does it change when it should, and agree across screens?

| Moment | Today | Return (RT-01) | Daily prayer (DO-04) | Widget / Live Activity | Verdict |
|---|---|---|---|---|---|
| Each day | yes: re-read on focus (`today.tsx:50`) | yes: `dayOf(new Date())` at render | yes: fixed for the session | no picture (SF Symbols only, `targets/widget/Widgets.swift`) | consistent in the morning |
| 03:00 day turn | yes (`dayOf`) | yes | yes | — | consistent |
| 17:00 evening | **picture removed**; plain layout (`today.tsx:72`) | **still the morning picture** | **still the morning picture** (Evening Prayer over a morning picture) | — | **DIFFERS**: the frame shows an evening picture on Today; the three screens disagree |
| Each month | the same 30 again, as planned | same | same | — | MATCHES the plan |

The widget frames (DR-07, EG-05, WL-04, AW-01, AW-02, SX-17) draw no picture, so the widget is right to have none. The pictures plan's widget-size copy has no frame behind it.

### A4. Every picture in every place

Estimated white-text contrast on each of the 30 graded files, cropped as the app crops them on a 402 pt iPhone:
- **Hero, greeting/date**: the 14–26% band, with the app's `FADE` applied. Median and 90th percentile.
- **Hero, verse**: the 58–90% band, 97th percentile.
- **Hero under Reduce Transparency**: `SOLID_FADE`, worst of top and verse.
- **Return headline**: the 62–78% band under the frame's scrim.
- **Daily prayer text**: the middle band under the 62% scrim.

| Day | Subject | Hero top, median / 90th | Hero verse | Hero RT | Return | Daily prayer |
|---|---|---|---|---|---|---|
| 01 | fog, Yellowstone | **1.4 / 1.2** | 4.1 | 13.8 | 10.2 | 5.6 |
| 02 | moon (night) | 6.9 / 6.1 | 10.1 | 17.7 | 13.3 | 11.8 |
| 03 | Grand Teton | **2.6 / 2.0** | 9.7 | 15.0 | 14.6 | 7.4 |
| 04 | Madison sunrise | **1.6 / 1.3** | 4.5 | 13.9 | 8.8 | 7.2 |
| 05 | Tipsoo Lake | 15.6 / 2.1 | 7.0 | 14.7 | 9.4 | 7.8 |
| 06 | beach sunrise | **1.5 / 1.3** | 9.1 | 14.2 | 11.8 | 7.7 |
| 07 | Denali | 3.9 / 2.3 | 7.2 | 15.4 | 11.3 | 9.5 |
| 08 | fog, Tower Jct | 5.3 / 2.6 | 4.2 | 14.3 | 9.1 | 5.6 |
| 09 | wildflowers | 4.6 / 2.2 | 5.3 | 14.6 | 8.5 | 6.1 |
| 10 | above the fog | 4.0 / 3.1 | 7.4 | 16.1 | 10.9 | 7.5 |
| 11 | sunset (evening subject) | 5.9 / 4.9 | 4.5 | 15.6 | 9.3 | 6.1 |
| 12 | Yosemite | **1.7 / 1.3** | 7.9 | 14.2 | 10.0 | 8.0 |
| 13 | Seedskadee fog | **1.4 / 1.1** | 6.7 | 13.6 | 10.8 | 6.2 |
| 14 | aurora (night) | 15.0 / 13.1 | 6.2 | 16.2 | 8.9 | 9.1 |
| 15 | Crater Lake | **2.8 / 2.0** | 8.2 | 14.7 | 12.3 | 8.6 |
| 16 | aspens, sunburst | 3.5 / 1.8 | 4.2 | 14.3 | 7.2 | 6.2 |
| 17 | Teton sunset (evening subject) | 6.5 / 3.6 | 8.7 | 15.6 | 13.3 | 5.6 |
| 18 | Lake 2 Creek sunset (evening subject) | 12.7 / 3.3 | 9.7 | 15.0 | 12.2 | 6.7 |
| 19 | wildflower meadow | **1.3 / 1.1** | 6.6 | 13.7 | 8.6 | 6.0 |
| 20 | red sunrise | 16.6 / 10.4 | 9.5 | 17.8 | 12.6 | 10.7 |
| 21 | first light | **2.4 / 2.0** | 6.7 | 15.0 | 10.1 | 6.5 |
| 22 | Black Canyon | **1.8 / 1.5** | 6.5 | 14.3 | 9.2 | 9.6 |
| 23 | Teton dusk (evening subject) | 3.5 / 3.1 | 13.7 | 16.0 | 15.3 | 8.1 |
| 24 | Blue Mesa clouds | 3.8 / 2.7 | 4.5 | 15.1 | 6.6 | 6.2 |
| 25 | cypress sunrise | 4.9 / 3.4 | 4.0 | 15.2 | 7.3 | 6.9 |
| 26 | frosty sunrise | 8.9 / 7.6 | 7.1 | 16.2 | 10.4 | 11.3 |
| 27 | beach | 5.5 / 4.2 | 5.5 | 15.3 | 10.0 | 9.1 |
| 28 | Yellowstone fall | **1.5 / 1.2** | 6.0 | 13.6 | 10.2 | 6.7 |
| 29 | Milky Way (night) | 18.1 / 14.3 | 15.9 | 18.2 | 16.7 | 13.5 |
| 30 | lake reflection | 3.7 / **1.4** | 9.8 | 14.0 | 14.8 | 11.1 |

How to read it:
- **Hero top:** bold means the median falls below 3:1. The 34 pt bold greeting needs 3:1 and the 15 pt date needs 4.5:1. The fix is a stronger top fade, about 0.55 at the top, holding about 0.35 to 26%, then easing out by 34%. Or keep the current fade and darken the top of each graded file in `grade_picture.py`. Either way, test the whole set, not one picture.
- **Hero verse:** fine for the 25 pt verse (3:1). The 13 pt "Sit with this" and "Done" sit lower, at 80–92%, where every picture is at least 10:1.
- **Hero under Reduce Transparency:** passes on every picture (at least 13.6:1). It MATCHES the design-system rule and John's 18 Oct ruling. Frame EB-04 still draws the old boxed band (`.dphoto.rt .dpov{background:rgba(20,18,14,.92)}`), so the frame is stale, not the app.
- **Return and Daily prayer:** pass on every picture with transparency on. Neither has a Reduce Transparency version (problem 6).
- **Crop focus:** every crop is centred, with no focus point in the manifest.
  - Hero (402 × 520) keeps about 97% of the 3:4 file: safe.
  - Return and Daily prayer (full screen) keep about 61% of the width, centred: safe for these landscapes.
  - The AX inline picture (370 × 260) keeps only the **middle 53% of the height**. Skies, moons and peaks in the top quarter are cut. The AX5 frame is 300 pt tall, so it keeps about 59%.
  - The manifest needs a focus point (or the grade's 3:4 crop must centre the subject) before the AX figure and the 1:1 share card (DR-18, 300 × 300) can be trusted.
- **Dark mode:** the hero, Return and Daily prayer don't depend on the theme (white on a dark fade), as the Dark frames draw them.
- **Missing picture:**
  - Today switches to the plain layout with no grey box: MATCHES DR-15.
  - Return falls back to forest, `#0F2A23` in dark: MATCHES RT-08.
  - Daily prayer falls back to `FOREST` where the frame's `.ostep` ground is `#0E1814`. That's acceptable, since RT-08's "never blank" is met.

### A5. Missing sets

| Set | Planned | Present |
|---|---|---|
| Morning, 30 | yes | 30, but 7 are evening or night subjects (problem 5) |
| **Evening, 30** | yes (DR-12, DR-19 "Last night", PS-05 "Evening picture" ground, DO evening) | **0** |
| Next year's set (60) | "a new set each year" | not started; the manifest has no year or set key, so a second set has nowhere to go |
| Widget-size copies | pictures-plan §Pipeline 2 | none (no frame needs them yet) |
| Per-picture verse | pictures-plan §Pipeline 1, DR-14 "Chosen for Psalm 1:3" | none (problem 10) |

---

## Part B: every image place

Status is against the frames named. MATCHES = box, clip, crop, fade, theme, VoiceOver, AX and fallback all agree.

| # | Where | Frame | Status | What to fix | Severity |
|---|---|---|---|---|---|
| 1 | Today hero, `app/(tabs)/today.tsx:293-316` (`Image` absoluteFill, cover, labelled with `picture.alt`; `FADE` / `SOLID_FADE`) | DR-11, EB-04, XT-01, IA-15 (`.dphoto.img.thero` 520 px, `overflow:hidden`, same gradient, img alt) | DIFFERS | Box 520, clip (fixed at :390), cover, gradient, alt, dark and RT fade all match. Strengthen the top fade for the whole set (A4). Add `backgroundColor: "#0E1814"` to `styles.hero` so there's no white flash. The picture isn't tappable: DR-11's verse button opens DR-16, the app opens the reader (:81). | high (contrast) |
| 2 | Today at AX sizes, `today.tsx:339-343` (`inlinePicture` 260 pt, radius 24, `palette.card` behind, labelled) | DR-11/12 AX5 (`.ax5 .dphoto.img` 300 px, inset, radius 24, `overflow:hidden`, verse over a 0→80% fade, placed after the reading card) | DIFFERS | Move the figure to straight after the reading card. Height 300. Put the verse block on it with the fade, and remove the separate plain verse card. Add `overflow:"hidden"` to the wrapper so the radius clips on every renderer. As built, this is the "photo after Later this evening" at AX sizes. | high |
| 3 | Today in the evening (`today.tsx:72` sets `picture = undefined`) | DR-12, DR-01 dark, DR-09 dark (evening picture `27a307…`) | MISSING | Needs the evening set (A5). Until then, the plain layout is the documented deferral (build-7-plan §0). | medium |
| 4 | Spurgeon avatar, `today.tsx:193, 411` (28 × 28, radius 14, from a 180 px JPEG) | DR-11 `.dev .ava` 28 px, `.ax5 .dev .ava` 44 px, `filter:sepia(.25)`, alt "" | DIFFERS | It doesn't grow to 44 pt at AX5. The frame's light sepia isn't applied. VoiceOver is fine: it sits inside the card's single labelled element. Bundled, so it can't go missing. | low |
| 5 | Return, `app/return.tsx:65-73` (absoluteFill, cover, `accessible={false}`, scrim 18→32→82%) | RT-01 (`.rtph` identical gradient, img `alt="" aria-hidden`), RT-08 (forest) | DIFFERS | Matches RT-01 and RT-08 exactly: box, clip (full-screen root), crop, decorative, dark, AX5 (headline only grows). Missing: a Reduce Transparency fade of at least 86% under the headline and the buttons. In the evening it shows the morning picture (A3). | medium |
| 6 | Daily prayer, `app/office.tsx:51-53, 104` (absoluteFill, cover, labelled with alt; flat 62% scrim) | DO-04/05/06 (`.ostep` img with alt; scrim 35→62→78%) | DIFFERS | Use the frame's gradient (35/62/78) rather than a flat 62%. Add a Reduce Transparency fade of at least 86%. Consider `accessible={false}`: as built, VoiceOver reads the picture's alt before Close and the step, and the frame's Return treats the same picture as decorative. In the evening it shows the morning picture. | medium |
| 7 | Home wordmark, `app/(tabs)/index.tsx:425-438` (PNG @1x/2x/3x, chalk in dark, header labelled "Yada", 44→72 pt with Dynamic Type) | ON-01 (`.wordmark`) | MATCHES | — | — |
| 8 | Reminder preview icon, `components/ReminderPreview.tsx:20, 43` (`icon.png` 20 pt, radius 5) | DR-06, NT frames (`.appic`) | MATCHES | Inside one labelled element. Uses the light icon in dark mode; iOS shows the dark icon there (`icon-dark.png` exists). | low |
| 9 | Launch overlay, `components/LaunchOverlay.tsx:116-123` (stem and leaf PNGs, 512 px, on `#0E1814`, hidden from VoiceOver) | SP-04-v2, SP-05-v2 | MATCHES | — | — |
| 10 | Place maps, `components/PlaceMap.tsx:30-60` (SVG drawn on the phone, `overflow:hidden`, radius 20, `accessibilityRole="image"` with the place and its neighbours, palette tokens) | MS-01, WM-06, PD-02 | MATCHES | — | — |
| 11 | Widgets, Live Activity, notification content, `targets/widget/*.swift`, `targets/notification` | DR-07, EG-05, WL-04, SX-17, AW-01/02 | MATCHES | SF Symbols only; no frame draws a photo there. | — |
| — | Not pictures, checked for completeness: SVG icons (`Icon`, `TabBar`, `Lamp`, `AnchorIcon`, `MediaIcon`, `ReaderBars`, the translations ring), all `accessible={false}`; gradient-only grounds (`sit.tsx:404`, `player.tsx:343-344`, `Page.tsx:153`, `ReaderHeader.tsx:77`, `TabBar.tsx:59`, `type-settings.tsx:188` thumbnails); `TranslationCover` (Views). The native modules (`yada-cloud`, `yada-pray`, `yada-speech`, `yada-system`) draw no images. | — | n/a | — | — |

Memory: each 1200 × 1600 JPEG decodes to about 7.7 MB. React Native on iOS decodes local assets at the view's size, and at most one or two are on screen at once, so there's no memory problem. The 11 MB in the binary goes against the plan's R2 week-ahead download, which matters once the evening set doubles it.

---

## Part C: frames that draw a picture the app doesn't

| Frame | What it draws | State in the app | Severity |
|---|---|---|---|
| PS-05, HM-02 | Share as an image: a 300 × 300 card (`.shcard`, radius 20, clipped, cover) with the verse over a fade; grounds: day's picture, evening picture, white, dark (`.bgt` 56 px); Save to Photos, Share | **Offered in the menu, but the route is missing** (problem 1). `data/user.ts:138-376` (`verse_images`) and `lib/highlights.ts:37` (`IMAGE_GROUNDS`) exist with no screen. No view-shot library in package.json. | high |
| DR-18 | Share as an image from the day's verse, text and picture credited | Not built (needs DR-16) | medium |
| DR-12 (and DR-01, DR-09 Dark) | The evening picture on Today | Not built; evening set missing | medium |
| DO-04 in the evening | Evening Prayer over the evening picture | Shows the morning picture | medium |
| DR-16 | The day's verse full screen (`.imm`: picture edge to edge on `#111`, fade 35→0→25→78%, 85% at AX5, the credit kept on screen) | Not built; tapping the verse opens the reader | medium |
| DR-17 | ⋯ on the day's verse: Read the psalm, Compare, Share as an image, Earlier days, About this picture | Not built | medium |
| DR-14 | About this picture (sheet: Title, By, From, Chosen for, Licence) | Not built; the manifest has no "chosen for" verse, and `by`/`from` don't fit (problem 9) | medium |
| DR-19 | Earlier days: 64 pt rounded thumbnails (`.dth`, radius 14, `var(--fill)` behind), newest first, "Today" and "Last night" | Not built; needs the evening set for "Last night" | medium |
| PS-04 | Saved › Images tab | No Images tab (no images are ever made) | low |
| TB-01, DU-01 | iPad and open-Duo Today: the picture as a 440 px inset figure in two columns | `supportsTablet: false` (`app.config.ts:84`); deferred in build-7-plan §0 | low |
| EB-01 | Daily psalms off: the picture as an inset 300 px figure | Today's plain or hero layout; no inset figure outside AX | low |
| EB-04 | Reduce Transparency as a boxed 92% band | The app follows John's later ruling (full-bleed fade). **Redraw the frame.** | low (frame stale) |

## Suggested order

1. Problem 1: until PS-05 is built, hide "Share as an image" from `moreActions`, or build the screen.
2. Today at AX sizes: move the figure up, put the verse on it, height 300.
3. Strengthen the top fade and test it against all 30 pictures, using the table in A4 as the check.
4. A dark ground under the hero; a Reduce Transparency fade on Return and Daily prayer; the frame's gradient on Daily prayer.
5. Content (John):
   - add `part`, `verse`, `focus` and approval to the manifest;
   - move the moon, aurora, Milky Way and sunsets into an evening set and fill both sets to 30;
   - recheck day 12's licence at Unsplash;
   - real photographer and agency names for DR-14.
6. Then build DR-16, DR-17, DR-14, DR-19 and DR-18 on that data, and give Return and Daily prayer the same morning/evening choice as Today.
