# Build plan: the new flows (11 Oct 2026)

Source of truth: the design canvas, guide page
(https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc, frames and decision notes). Every build matches its frames
in light, dark and AX5. Nothing is pushed, published to R2 or uploaded until John says so.

## What exists in the app today

Read, Understand (one verse, or a passage from its row), Original, Compare, Search, Contents, Bookmarks, Recent,
Sources, Start here (`thread.tsx`), translation downloads. There is no passage guide, no audio and no iCloud.

## Work packages

| # | Package | Frames | Branch | Status |
|---|---|---|---|---|
| A | Study notes, See also and People in Understand; the Understand UI pass (one Go further row style, Original opens in place with a bare chevron, × the one exit); per-book study bundles that download by themselves | SN-01–09, TD-01–03 | `study-notes-app` | building |
| B | iCloud key-value sync for bookmarks, reading place, Start here progress and settings; the one line on Bookmarks | IC-01–02 | `icloud-sync` | built; ships without a two-device test (John, 11 Oct 2026) |
| C | MACULA Greek and Hebrew syntax in the pipeline (no app change yet) | none | `macula` | building |
| D | Passage guide and a clear way to start: guide sheet from the passage title and the bar at rest, Start here lead on Home, one-time hint, Next row at the end of a guide, Home's one lead (Continue mid-passage, Next once finished), Start here list | PG-01–10, ON-01–07, IA-03–05 | `guide-start` | to start |
| E | Audio read-along on Apple's on-device speech: Listen at rest, the spoken word in an ink pill, mini player (previous, pause, next), Play from a selected verse, full player, Reduce Motion, VoiceOver order, the basic-voice hint | AU-01–07 | `audio` | to start |
| F | Integration: merge A, B, D, E onto one branch, resolve the shared files (`ActionBar`, `UnderstandViews`, `index.tsx`), gates, Maestro | all | `new-flows` | integrated (11 Oct 2026); Maestro 01–08 on one simulator |
| G | QA against the mockups (below) | all | on F | last |

Order and overlap: A, B, C run now. D and E start now in parallel. D owns Home, the guide route and the
reader's passage title. E owns the player and the audio engine. Both touch the selection bar, so each keeps its
bar change small and isolated, and F reconciles them against IA-04/05 and AU-01/03.

## Edge cases decided and approved by John (11 Oct 2026)

- Home leads with Continue at the reading place in any book. Outside John, the John thread is one quiet row
  under it. Once all 46 passages are read there is no Next and no celebration.
- Progress counts finished passages, not the highest one reached. John 7:53–8:11 counts and has no Original row.
- A guide, See also or audio shows the reader's own translation when it is built in or public-domain, and falls
  back to the BSB. Evidence words are marked only in the BSB. Licensed translations stay display-only and are
  never read aloud.
- People match only when the profile cites that verse or passage, so a common name never shows the wrong person.
- Understand never opens empty: with no entry, note, cross-reference or person, the bar has no Understand.
- Audio pauses for calls, Siri and headphone unplugging. It runs on into the next chapter and stops at the end
  of the book. It never speaks over VoiceOver word by word.
- The live privacy page must mention iCloud before a build with sync ships.

## Content the guide can show before the John batch

John chose (11 Oct 2026) to run no generation batch for now. Until he decides otherwise:
- John 1:1–18 uses the reviewed jhn.1.1 entry, as the frames do.
- Other passages open with Tyndale's note on the passage (from A's study bundle), then the text.
- Missing fields show nothing. The canvas's grey "Placeholder" markers are annotations, never app UI.

## QA against the mockups (G)

1. On the iPhone 17 Pro simulator, capture each frame's state in light, dark and AX5, using the same verse,
   scroll position and selection as the frame.
2. Compare side by side with the frame. Check text and its order, which elements are present, hierarchy and
   weights, spacing, chevrons and icons, the AX5 layout, VoiceOver labels and order (with the accessibility
   inspector or the `accessibilityLabel` props), 44 pt targets, and the reduce-motion behaviour.
3. Record each difference as `frame · theme · what differs · severity (blocker / visible / nit)`, then fix
   every blocker and visible difference and capture again.
4. Write the report as one page with frame and screenshot pairs. Nits are listed but not fixed unless they
   are trivial.

## Gates (CLAUDE.md)

- `pnpm -r typecheck` and `pnpm -r test` green before every commit that touches code. Check exit codes
  directly, never through a pipe.
- Maestro flows 01–06 pass, plus new flows for the guide, study notes and audio.
- `/deslop`, `/review-code` and `/security-check` before any push or PR. Ask John before pushing.
