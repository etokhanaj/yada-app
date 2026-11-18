# Yada v2 roadmap

> **12 Oct 2026:** Understand is built without AI (`docs/no-ai-understand.md`). No generation batch runs, and the
> plain line and "Readers differ" come from the UST and unfoldingWord Translation Notes.

Approved by John on 11 Oct 2026, from `reports/Yada v2 open resources roadmap.md`. Each item is designed on the
canvas before it is built. Licences are read from each source's own files before ingest (rule 3).

## v2

| Item | Source and licence | Notes |
|---|---|---|
| Human-read BSB audio with word highlighting | Berean Bible audio (Bob Souer, Barry Hays, Jordan Gilbert), CC0 1.0 | Word timings made offline by forced alignment; chapters download on demand; see below |
| Reading plans with no dates | M'Cheyne (1842), public domain, plus Yada's own passage routes | "Next passage", never "Day 47"; no streaks and no "behind" |
| People and places line | STEPBible TIPNR (CC BY 4.0), structured fields only; OpenBible geocoding (CC BY 4.0) with confidence | TIPNR's AI-adapted descriptions are not used; ask STEPBible about its no-redistribution request first |
| Dictionary lookup | Aquifer Open Bible Dictionary (CC BY-SA 4.0, Tyndale House and Mission Mutual) | Tapping a term opens a card; Search finds terms |
| "Missing from older manuscripts" note | TAGNT edition flags (already in core), SBLGNT apparatus (CC BY 4.0) | Plain words; no manuscript sigla on the first screen |
| Swipe between chapters | none | Not from screen edges; peek and snap back; off while a verse is selected or a sheet is up; VoiceOver actions; cross-fade under Reduce Motion; stops at a book's end with a link |
| Home Screen widget | expo-widgets (SDK 57) | "Continue reading" and a calm passage of the day; no streaks |
| Live Activity while listening | expo-widgets / ActivityKit | Lock Screen, Dynamic Island, StandBy; started and ended locally |
| Assistive Access | `UISupportsFullScreenInAssistiveAccess` | One Info.plist key, then a check in Assistive Access |
| NIV, NKJV and NLT for testers and users | A Cloudflare Worker that holds the API.Bible key server-side | The app never carries the key. The Worker enforces the 30-day cache refresh, deletion on request, attribution and non-commercial use on Starter. The privacy page gains a line about chapter requests going through Yada's server (no personal data). Display only: never read aloud, never in AI (rule 9; API.Bible §9.1) |
| Human audio beyond BSB | WEB read by Winfred W. Henson (all 66 books, 2014–16; eBible.org: free to download, copy and listen) | Credit the narrator and the year, since it predates the 2020 WEB text; ask eBible.org for written confirmation first (`docs/licences/audio-and-kjv-terms.md`) |

## Legal checks open

- KJV in the UK is under Crown rights, administered by Cambridge University Press. Yada already shows the KJV, so
  CUP's terms for apps must be read before launch (`docs/licences/audio-and-kjv-terms.md`).

## Decisions needed before v2 work

1. Share-alike: whether Yada text grounded in CC BY-SA sources is itself CC BY-SA, and where Yada publishes the
   adapted data files that BY-SA requires.
2. Rule 9 for system AI: Spotlight, Siri and on-screen entity data carry only references and BSB, WEB, KJV or LSV
   text, and Writing Tools is turned off on screens showing licensed text, if React Native allows it.

## How human-read BSB audio works

1. Source: the CC0 MP3s from openbible.com/audio, pinned with a sha256 for each file. Only the versions without
   music are used. The "Frederick Surrey" chapter set stays out until the Berean team confirms that its narrator
   is covered by the CC0 dedication.
2. Pipeline, run on a Mac and costing no AI credits: split each book into chapters, then force-align each chapter
   against the exact BSB text Yada shows (WhisperX with an Apache-2.0 English model, or Montreal Forced Aligner).
   The result is a start and end time for every word, keyed to the same word indices the ink pill uses. Verse times
   follow from the word times.
3. Checks: confirm that the recording follows the same BSB revision as Yada's text, since alignment shows missing
   or extra words. Spot-check names, genealogies and Psalm 119. Words with low confidence go to John.
4. Delivery: chapters are re-encoded to a small AAC file and published to R2 with their timings. A chapter
   downloads when it is first played and is then kept for offline use. A whole book can be downloaded from the
   player.
5. Playback: AVPlayer replaces the synthesizer when a recording exists. Its time drives the same ink pill, mini
   player, full player, lock screen and Live Activity. Changing speed keeps the pitch, and verse jumps seek to a
   verse's start time.
6. Choice: the player offers the recorded voice for BSB and the iPhone voice for the other built-in translations.
   Licensed translations are never read aloud.
