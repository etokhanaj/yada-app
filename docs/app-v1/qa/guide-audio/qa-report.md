# QA: passage guide, a clear way to start, audio (package G, part 1)

Branch `qa-guide` from `new-flows` (1c4b74a), 11 Oct 2026. Release simulator build on the
"iPhone 17 Pro qa-guide" simulator (iOS 26.5), erased before the first capture. Frames rendered
from the canvas `.dc.html` files with headless Chrome (`frames/`). Each frame's state was driven
with Maestro, then captured in Light, Dark and AX5 (`xcrun simctl ui … appearance` and
`content_size accessibility-extra-extra-extra-large`). Sheets at AX5 were opened at AX5, since a
sheet opened at the default size keeps its medium detent. VoiceOver order and labels come from
Maestro's hierarchy (`voiceover.txt`); VoiceOver itself does not run in the simulator.

Known accepted departures were not flagged (bundle wording, Where readers differ visible while a
word is marked, cold launch into the reader, 21 pt guide text, Original in the bar only without
Understand, the iCloud line, no speed in the mini player, no Stop). Place lines and glosses that
follow the bundle ("Verses 1, 14", "Verse 34", "were silent", "Word") count as bundle wording.

## Counts

| Severity | Found | Fixed | Left |
|---|---|---|---|
| Blocker | 0 | 0 | 0 |
| Visible | 5 | 4 | 1 (PG-04, belongs to part 2) |
| Nit | 13 | 3 | 10 |

## Differences

| # | Frame · theme | What differs | Severity | Status |
|---|---|---|---|---|
| V1 | IA-05 · Light, Dark, AX5 | A selected verse had no `▶ 1:1` (AX5: `Play from 1:1`) until audio was already on. The frame draws it on a selected verse at rest. | visible | fixed (e4aca7f): Play from shows wherever Listen can read the translation |
| V2 | ON-04 (after PG-04) · Light, Dark | After ‹ from a verse's Understand, the guide's top level kept a ‹ that went nowhere when the guide had re-rendered while covered (a theme or text-size change). The frame has × only. | visible | fixed (ff33f76): ‹ comes from the screen's own index in its sheet stack |
| V3 | AU-01, IA-04 · all | VoiceOver heard Listen as "Listen"; the frame labels it "Listen to The Word became flesh, John 1:1–18". | visible | fixed (e4aca7f) |
| V4 | ON-05, ON-07 · all | VoiceOver heard the progress line as "2 of 46 passages read"; the frame says "2 of 46 passages in John read". | visible | fixed (598ddb2); flow 07 asserts the new label |
| V5 | PG-04 · all | Understand inside the guide shows the large-detent verse line ("Show verse" at AX5), "Tap a line to see the evidence." and the Supported/Background tags, none of which PG-04 draws. | visible | left: this is the shared Understand view, which SN-01–09 and the J01/JN frames govern (part 2). The guide's own parts of PG-04 match: ‹, "John 1:1", the passage name, × |
| N1 | ON-01, ON-05, ON-07 · all | 12 pt too much space between the lead (or All passages) and "Old Testament". | nit | fixed (598ddb2) |
| N2 | ON-05, ON-07 · all | "All passages in John" was regular; the frame sets it medium (`.valrow`). | nit | fixed (598ddb2) |
| N3 | PG-06 · all | No hairline between the title block and the first passage. | nit | fixed (36a2471) |
| N4 | PG-01, PG-03, PG-10 · all | The space between a verse number and its text is about 2 pt narrower than the frame (`.vn` margin-right 2px). | nit | left: the shared Verse component, used on every reading screen |
| N5 | PG-10 · Light, Dark | iOS draws the evidence underline's `dotted` style as short dashes; the frame has dots. | nit | left: this is how React Native's dotted style renders on iOS |
| N6 | PG-06 · AX5 | λόγος sits on its own line and the rest of the line wraps under it, where the frame runs them together; the Next row's chevron is centred where the frame aligns it with the title. | nit | left |
| N7 | PG-02–PG-09 · AX5 | Sheet title, subtitle and section labels are a few points smaller than the frame's AX5 sizes, so "Order in the assembly" stays on one line. | nit | left: these are the type scale's caps |
| N8 | AU-07 · Light, Dark | The basic-voice line breaks as "…Spoken / Content › Voices." where the frame breaks after "Settings ›". | nit | left |
| N9 | AU-02 · AX5 | The mini player's title stays on one line at about 30 pt; the frame wraps it to two lines at 34 pt. | nit | left |
| N10 | AU-02, AU-04 (chapters with no passage) · all | Where the chapter has no passage, the title is the chapter, so the label reads "1 Corinthians 14, 1 Corinthians 14:11, …". | nit | left: none of the frames shows this case |
| N11 | PG-01, IA-04, AU-01 · all | The reader's `‹ Home` pill is about 10 pt wider than the frame's. | nit | left |
| N12 | ON-02 · Light, Dark | Under the scrim, the reader shows the passage title and the hint above 1:1; the frame shows the text only. The hint is still not counted as seen until the guide closes (ON-03 shows it). | nit | left |
| N13 | PG-01, ON-03 · all | The frames draw no bottom bar; the app shows the rest bar, as IA-04 draws it. | nit | left: IA-04 governs the bar |

Checked and matching: ON-01 and ON-06 (VoiceOver order: Search, Bookmarks, More, Yada, Start
here, Old Testament, Genesis), ON-02, ON-03 (the hint shows once), ON-04 (Next row and its
label), ON-05, ON-07, PG-01 (title label "The Word became flesh, John 1:1 to 18. Opens the
passage guide"), PG-02, PG-03, PG-05 (Closer to the Greek), PG-06, PG-07–PG-09, PG-10 (marks
and the "Shown in the passage" label), IA-04, AU-01, AU-02 (ink pill, upcoming text muted, verse
"Verse 18, playing"), AU-03 (Play from, AX list order Understand → Play from → More), AU-04,
AU-05 (Reduce Motion: the playing verse in semibold, spoken words fill in ink, no pill; the
follow scroll runs with `animated: false`), AU-06 (player order close → lines → progress
"John 1", "verse N of 51" → speed → previous → pause → next → Guide; mini player order open →
previous → pause → next), AU-07 (the line shows on the first player open only, and at AX5 it
takes the lyrics' place as the frame does). Every control in the hierarchy is at least 44 × 44 pt.

## Images

Frame, then before, then after, each as Light · Dark · AX5 where captured.

| Frame | Mockup | Before | After |
|---|---|---|---|
| ON-01 | [frames/ON-01.png](frames/ON-01.png) | [before/ON-01.png](before/ON-01.png) | [after/ON-01.png](after/ON-01.png) |
| ON-02 / PG-02 | [frames/ON-02.png](frames/ON-02.png) | [before/ON-02.png](before/ON-02.png), [before/PG-02.png](before/PG-02.png) (AX5) | unchanged |
| ON-03 | [frames/ON-03.png](frames/ON-03.png) | [before/ON-03.png](before/ON-03.png) | unchanged |
| ON-04 | [frames/ON-04.png](frames/ON-04.png) | [before/ON-04.png](before/ON-04.png) (stale ‹) | [after/ON-04.png](after/ON-04.png) (× only after the same theme change) |
| ON-05 | [frames/ON-05.png](frames/ON-05.png) | [before/ON-05.png](before/ON-05.png) | spacing and weight as ON-07 after |
| ON-06 | [frames/ON-06.png](frames/ON-06.png) | order in [voiceover.txt](voiceover.txt) | unchanged |
| ON-07 | [frames/ON-07.png](frames/ON-07.png) | [before/ON-07.png](before/ON-07.png) | [after/ON-07.png](after/ON-07.png) |
| PG-01 | [frames/PG-01.png](frames/PG-01.png) | as IA-04 | unchanged |
| PG-03 | [frames/PG-03.png](frames/PG-03.png) | [before/PG-03.png](before/PG-03.png) | unchanged |
| PG-04 | [frames/PG-04.png](frames/PG-04.png) | [before/PG-04.png](before/PG-04.png) | not changed (V5) |
| PG-05 | [frames/PG-05.png](frames/PG-05.png) | [before/PG-05.png](before/PG-05.png) | unchanged |
| PG-06 | [frames/PG-06.png](frames/PG-06.png) | [before/PG-06.png](before/PG-06.png) | [after/PG-06.png](after/PG-06.png) |
| PG-07 | [frames/PG-07.png](frames/PG-07.png) | [before/PG-07.png](before/PG-07.png) | unchanged |
| PG-08 | [frames/PG-08.png](frames/PG-08.png) | [before/PG-08.png](before/PG-08.png) | unchanged |
| PG-09 | [frames/PG-09.png](frames/PG-09.png) | [before/PG-09.png](before/PG-09.png) | unchanged |
| PG-10 | [frames/PG-10.png](frames/PG-10.png) | [before/PG-10.png](before/PG-10.png) | unchanged |
| IA-04 / AU-01 | [frames/IA-04.png](frames/IA-04.png) | [before/IA-04.png](before/IA-04.png) | label only (V3), see [voiceover.txt](voiceover.txt) |
| IA-05 | [frames/IA-05.png](frames/IA-05.png) | [before/IA-05.png](before/IA-05.png) | [after/IA-05.png](after/IA-05.png) |
| AU-02 | [frames/AU-02.png](frames/AU-02.png) | [before/AU-02.png](before/AU-02.png) | unchanged |
| AU-03 | [frames/AU-03.png](frames/AU-03.png) | [before/AU-03.png](before/AU-03.png) | unchanged |
| AU-04 | [frames/AU-04.png](frames/AU-04.png) | [before/AU-04.png](before/AU-04.png) | unchanged |
| AU-05 | [frames/AU-05.png](frames/AU-05.png) | [before/AU-05.png](before/AU-05.png) (Reduce Motion, three moments) | unchanged |
| AU-06 | [frames/AU-06.png](frames/AU-06.png) | order in [voiceover.txt](voiceover.txt) | unchanged |
| AU-07 | [frames/AU-07.png](frames/AU-07.png) | [before/AU-07.png](before/AU-07.png) | unchanged |

Speech in the simulator moves on quickly, so the audio captures show whichever verse was playing
at the time, not always 1:5; the marks and layout are what was compared. The live text-size
switch used for some AX5 captures leaves the player's lyrics where they were until the next verse
(seen in an early AX5 capture). Opening the player at AX5 places the line correctly.

## Gates

- `pnpm -r typecheck` and `pnpm -r test`: exit 0, run directly with no pipe.
- Maestro 07-guide-start first on the erased simulator, then 01–08, each run with
  `--config apps/mobile/.maestro/config.yaml`, on the build with the fixes: 07-guide-start,
  01-core-loop, 02-original-languages, 03-search, 04-settings-bookmarks, 05-evidence, 06-download,
  07-study-notes, 08-audio all exited 0.

## Notes for whoever runs this next

- On a new simulator, approve the "Open in Yada?" prompt once, then reboot the simulator. Until
  the reboot, every `openLink` brings the prompt back, even with the approval saved in
  `com.apple.launchservices.schemeapproval.plist`.
- A single flow run without `--config` ignores `snapshotKeyHonorModalViews: false`, so the evidence
  sheet over Understand is invisible to it (01 fails at "Why we say this").
- Flow 06 needs the Release build bundled with `EXPO_PUBLIC_TRANSLATIONS_MANIFEST_URL` and a
  read-only server on content/bundles (port 8797 here).
