# Mobbin study for the Yada redesign

Mobbin MCP, iOS, `search_screens` and `search_flows`, October 2026. Every screen cited here was
opened and looked at; nothing is described from metadata alone. Each pattern ends with what Yada
takes and what it rejects.

**Not on Mobbin.** Searches by name returned nothing for Kindle, Sefaria, Logos or Readwise Reader,
and Wikipedia is indexed only for its Places map. Where those apps were the brief's reference, the
closest indexed screens stand in, and the brief's own description of the original
(`~/Downloads/Yada/yada-design-brief.md`, Reference set) still governs.

**Earlier decisions kept** (handoff §6, not re-studied): Apple Books Home, Apple Books and Fable
contents sheets, Telegram and Alta grouped search, the Apple Books and Fable type sheets, Coursera and
Disney+ download lists, Medium bookmark rows.

---

## 1. Reading-first apps

**Apple Books, reader chrome and menu.** One control opens `Contents · 0%`, `Search Book`,
`Themes & Settings` and a row of icons; in the reading state the only chrome is `4 pages left in
chapter` above and `1 of 622` below.
- [Reader menu](https://mobbin.com/screens/82864fc0-b710-4b51-bdb4-9fc2918c3ebc)
- [Reading a book (flow)](https://mobbin.com/flows/328cdde7-bf7c-47f7-85a5-0e06f5d34e78)

Take: one quiet entry point for navigation and settings; position stated in plain words. Reject:
the floating glass button cluster (Yada bans floating buttons) and the page metaphor.

**Fable, selection menu.** A flat menu sits above the selection with an overflow arrow; the page
footer reads `26 pages left in chapter`.
- [Selection menu](https://mobbin.com/screens/d242019f-afc6-4f51-9248-7f0d360316a7)
- [Menu, second page](https://mobbin.com/screens/37c599ad-b4f0-469e-825e-6e2e972b6953)
- [Highlight categories](https://mobbin.com/screens/c491cd50-9a5b-41ff-9e6b-a60dab87d0c7)

Take: few actions, text labels, an overflow for the rest. Reject: the colour-coded highlight
categories (`Important`, `Quote`, `Favorite`, `Poetic`): Yada never codes meaning by colour.

**Matter, selection and highlight.** The system edit menu over selected text; a saved highlight is a
solid yellow wash with clear edges.
- [Selection](https://mobbin.com/screens/058e54c1-2c6e-4568-939e-72ca0bd6ef85)
- [Saved highlight](https://mobbin.com/screens/ee97ab8f-d8de-4f53-8e01-d7f7180ede9f)
- [Highlight in context](https://mobbin.com/screens/bb6a178a-73c0-4183-acfc-5693519abe1d)
- [Deeper page with one close control](https://mobbin.com/screens/1cf6a8b8-8af1-4e9a-b7d5-7a3935032218)

Take: a selection you can see from arm's length; a deeper page with a single, obvious exit. Reject:
yellow (one accent only in Yada).

**Pocket and Medium, back label and action row.** Pocket's header says `‹ Home`; Medium's actions
sit in a row above the selection.
- [Pocket selection](https://mobbin.com/screens/340108ed-e7d6-4ea5-99ff-9f331c94b3be)
- [Medium selection](https://mobbin.com/screens/b14f7259-5a06-4b23-aee7-d6a3d789b27a)

Take: name the back destination. Reject: Medium's floating card with shadow over the text above.

**ElevenReader, the reading page above a sheet.** A medium-height sheet rises and the highlighted
passage stays visible above it.
- [Share sheet over highlighted text](https://mobbin.com/screens/dd79e8fc-a30f-4940-8c9a-d0239648e3e9)
- [Collection sheet, word still marked](https://mobbin.com/screens/812faffb-b3bf-40d1-8992-b01bc23ca873)
- [Word emphasis inside a sentence highlight](https://mobbin.com/screens/633320e0-b7fc-4791-b65e-c250e82c7b06)

Take: this is "looking underneath the verse" made literal. Understand opens at a medium detent with
the selected verse visible above. The word-within-sentence emphasis (a stronger mark inside a lighter
one) is how the word card should mark σιγάτωσαν inside verse 34. Reject: rating and report sheets,
icon rows.

---

## 2. Layered reference

**Liven, citation sheet.** A dotted underline in the text (`shows`) opens a half sheet holding the
reference; the article stays visible above.
- [Citation sheet](https://mobbin.com/screens/cf55d189-6312-46a9-9c28-c90ad47f8582)

Take: the Wikipedia citation pattern from the brief, available on Mobbin. "Why we say this" opens the
same way: half height, over Understand, provenance first. Reject: the green accent and the progress bar.

**Wise, inline explainer.** An underlined question in the copy (`What's index investing?`) opens a
short sheet with a close button.
- [Explainer sheet](https://mobbin.com/screens/b884dc4c-2841-4399-827c-2b27a21662a7)

Take: the claim row's affordance can be a visible link-style cue, not a hidden tap. Reject: the large
sheet title; Yada's claim is the title.

**Wikipedia, peek before you go.** A place card shows a two-line summary with `Save`, `Share`,
`Read ›` before opening the article.
- [Places peek card](https://mobbin.com/screens/207bdb75-867d-410e-92b5-d176f00e5e48)

Take: Go deeper and occurrences preview the passage first (`Read 1 Timothy 2 ›`), and only then jump.
Today they jump straight away and lose the reader's place. Reject: the map and tab bar.

**Obsidian, grouped connections.** Backlinks are grouped as `Linked mentions` and `Unlinked mentions`,
each with a count.
- [Backlinks panel](https://mobbin.com/screens/59932f82-a889-4b24-b5a6-75be8965334e)

Take: typed groups with counts, the closest indexed match to Sefaria's connections panel. Go deeper
groups by relationship (`Contrast`, `Develops`, `Same theme`). Reject: the toolbar of sort icons and the
yellow inline highlight.

**Tabby and Flighty, saying which layer you are in.** Tabby's second-level sheet `Opening hours`
carries a subtitle naming its parent; Flighty heads its sheet with the context code and a close button.
- [Tabby second-level sheet](https://mobbin.com/screens/3d56f897-04a4-420c-a091-31c294c070ac)
- [Flighty context header](https://mobbin.com/screens/bfe5aa85-905a-457e-abfb-ebce7e685f70)

Take: every evidence sheet's header says what it is and whose child it is (`Why we say this` ·
`1 Corinthians 14:34`). Reject: Flighty's density and podium graphics.

**Speak and FotMob, definitions.** Speak's dictionary sheet heads with a small `DICTIONARY` label and
the headword; FotMob lists definitions as an accordion with `Done`.
- [Speak dictionary](https://mobbin.com/screens/6cda687c-0218-4908-9d4c-86fa22cfc242)
- [FotMob definitions](https://mobbin.com/screens/5190548d-7d48-4135-87bd-7b98ccc8d74a)

Take: headword first, one label, nothing else above it. Reject: Speak's boxed cards for each similar
word (cards are banned) and FotMob's accordion for primary content.

**Sefaria and Logos.** Not indexed. From the brief: take Sefaria's restraint and adjacency, reject
Logos's "choose a research dimension" model.

---

## 3. Telling the product story without a carousel

**Craft, learn inside the content.** The tutorial is a document: rows say `Long press, and move me to
the top` and `Swipe ← or → on me, and change my style`, and you do it there.
- [Get started with Craft (flow)](https://mobbin.com/flows/2d73c8ed-64a5-409f-b368-0ce4e52d3ae9)
- [Browsing tutorial (flow)](https://mobbin.com/flows/261e0d10-aa8e-4396-af24-3bae256990de)

Take: the instruction lives in the real surface and disappears once done. Yada's first launch opens
John 1 with one muted line under the header: `Tap a verse to see what it meant.` Reject: `Next` and
`Skip` buttons, the welcome screen, the tutorial chrome.

**The Atlantic, straight to content.** Splash, then Home with stories. No steps.
- [Onboarding (flow)](https://mobbin.com/flows/50d73ca1-76ea-4342-877a-5bdb10c06fed)

Take: zero onboarding screens is a legitimate choice for a reading app. Reject: the greeting
illustration.

**Shopee, a hint anchored to the object.** A one-line tooltip sits on the thing it explains.
- [Anchored tooltip](https://mobbin.com/screens/44061d31-4e43-475b-9c99-d732e2ba42f2)

Take: when a hint is needed, attach it to its target and show it once. Reject: dark pill styling.

**Rejected outright.**
- [Arc Search onboarding](https://mobbin.com/flows/4260d248-66f7-4b8a-952e-81446a19bbd6): a gradient carousel with phone mock-ups.
- [My BMW tutorial](https://mobbin.com/flows/c329076f-a46e-4ec7-9078-eda8f57a4e82): six-step coach marks (`2 of 6`, `BACK`, `NEXT`).
- [Apple News onboarding](https://mobbin.com/flows/671e3f4d-bd4d-4d0e-b229-fec56d4e215f): a welcome screen, then a subscription offer.

---

## 4. Accessibility-led reading apps

Mobbin captures screens at the default text size, so no AX-size layouts are indexed. The patterns
below are the settings that make reading adjustable.

**Apple Books, Accessibility & Layout Options.** A live preview sits above sliders for line,
character and word spacing and margins, each with its value (`1.00`, `0%`).
- [Customise Theme](https://mobbin.com/screens/82e2f758-a4ad-48de-9240-afea672d073c)

Take: show the value, and preview in the reader itself. Reject for v1: four extra sliders. Yada's
leading token already does this work; add spacing controls only if testing asks for them.

**ElevenReader, Atkinson Hyperlegible with a sized scale.** The font picker offers Atkinson
Hyperlegible; the slider reads `Smallest · 28pt · Largest`.
- [Player preferences](https://mobbin.com/screens/8e37d1cb-1111-425f-af10-0849b38a8d93)

Take: name the current size. Reject: theme thumbnails (two palettes only).

**Speechify and Substack, the current value between the buttons.** Speechify shows `A 19 A` and a
`Bold Font` switch; Substack labels its state `1 PT LARGER`.
- [Speechify appearance](https://mobbin.com/screens/ca505ee0-0012-40b1-993b-075db533807d)
- [Substack display settings](https://mobbin.com/screens/8f219955-1980-4cf8-aac2-840eea740d4d)

Take: `A−  3 of 6  A+`. Respect the system Bold Text setting rather than adding a switch. Reject: the
font gallery.

**Fable, Matter, Pocket: the cut-down type sheet.**
- [Fable display settings](https://mobbin.com/screens/8ed9301b-98de-4652-8715-c364cd8d8cab)
- [Matter display settings](https://mobbin.com/screens/647cefed-7ed5-407b-9c6d-49505138c1a9)
- [Pocket display settings](https://mobbin.com/screens/4525769a-c9c0-47da-a052-c609847da779)

Take: Fable's `Light` / `Dark` segmented control with icons and text, and a visible selected state.
Reject: font choice, brightness, width.

**Perplexity, the action menu as a list.** Selection actions become a vertical list with icon and
label per row.
- [Selection menu as list](https://mobbin.com/screens/9f61959b-8ac5-497f-a58a-a6db44e100be)

Take: the AX-size form of Yada's action bar, docked to the bottom so it never covers the verse.
Reject: icons as the only label.

---

## 5. Sheets and back navigation that keep reading position

**Apple Books, the return control after a jump.** After a search hit, the page opens at the match
with the word marked, and a small `↺ 1` control at top left returns to where you were.
- [Jump with return control](https://mobbin.com/screens/d6766fdb-6038-4359-99d3-adf6a50ca363)
- [Searching a book (flow)](https://mobbin.com/flows/c6a5c7a9-36c0-461d-952e-2cc15ef33e94)

Take: this is Yada's return chip. After Go deeper or an occurrence jump, the header's leading control
reads `‹ 1 Cor 14:34` and returns to the exact verse. Reject: a bare glyph and a number with no words.

**ElevenReader and Cash App, medium-height sheets over live content.**
- [ElevenReader sheet over text](https://mobbin.com/screens/dd79e8fc-a30f-4940-8c9a-d0239648e3e9)
- [Cash App place sheet over map](https://mobbin.com/screens/f70ac04e-6599-4cd0-b4b6-9178f7fc177b)

Take: the medium detent as the default depth-1 state, the content above still the anchor. Reject:
Cash App's two full-width buttons.

**Tabby, second-level sheet.** See section 2. Take: depth 2 sits on depth 1, says its parent, and has
its own close. Yada caps the stack at two sheets: Understand, then one evidence sheet whose content
can push (word → occurrences) with an in-sheet back.

**Matter, deeper page.** See section 1. Take: one close control, top left, the same place on every
deeper page.

---

## 6. Search with grouped results

**Apple Books, two searches.** Inside a book, results are a sheet over the page: `Chapter 5`, page
number at right, the term in bold, the field at the bottom. In the store, results group as `In Your
Library` and `Store Results`.
- [Searching a book (flow)](https://mobbin.com/flows/c6a5c7a9-36c0-461d-952e-2cc15ef33e94)
- [Searching Apple Books (flow)](https://mobbin.com/flows/df795985-1a5f-4a2c-883c-0f6d8556a61e)

Take: search as a sheet, matched term in bold (Yada already does this), a "yours first" group. Yada's
version: a `GO TO` row when the query parses as a reference, then `WORDS`, then `PASSAGES`. Reject:
cover art.

**Deezer and Peanut, a capped group with View all.**
- [Deezer grouped results](https://mobbin.com/screens/4f8453c2-a9d6-4bab-b241-841ccd817b6e)
- [Peanut grouped results](https://mobbin.com/screens/fb2eda92-bc2d-457b-818b-4f62d25ffd91)

Take: five rows per group, then `Show all 25 words`. Reject: Deezer's boxed `View all` buttons and the
heart and ellipsis on every row.

**Tonal, counts in the group label.** `24 RESULTS`, `WORKOUTS (15)`, `MOVEMENTS (9)`.
- [Grouped with counts](https://mobbin.com/screens/ff6b65e3-6aee-411a-b33c-b55548f0c875)

Take: `PASSAGES · 331`. Reject: horizontal carousels inside results.

**Fresha, filter chips above groups.**
- [Chips and groups](https://mobbin.com/screens/df55875b-448c-4de8-a9b0-d60458b70cba)

Reject for v1: with two groups, chips duplicate the section labels.

---

## What the study changes in the brief

| Pattern | Source | Yada change |
|---|---|---|
| Sheet at medium height, text visible above | ElevenReader, Cash App | Understand opens at a medium detent |
| Depth-2 sheet names its parent | Tabby, Flighty | Evidence sheet header: title + verse; stack capped at two |
| Visible cue on what opens provenance | Liven, Wise | Claim rows end in `›` |
| Peek, then jump | Wikipedia | Go deeper and occurrences preview before leaving the chapter |
| Return chip after a jump | Apple Books | `‹ 1 Cor 14:34` in the reader header |
| Learn in the content | Craft, The Atlantic | No onboarding; one line in John 1, gone after the first tap |
| Value shown between size buttons | Speechify, Substack | `A−  3 of 6  A+` |
| Actions as a docked list at large sizes | Perplexity | Bottom action bar becomes a list at AX sizes |
| Reference first, then groups with counts | Apple Books, Tonal | `GO TO`, `WORDS`, `PASSAGES · 331` |
