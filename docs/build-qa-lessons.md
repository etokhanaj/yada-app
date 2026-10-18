# Checking a build against the frames

Written 18 Oct 2026, after John found screens in build 10 that had never been built or had been built differently, and
a tab bar that took no taps. Every build from build 11 on follows this.

## What went wrong

- **Screens counted as built because a comment named their frame.** Tapping Today's picture opened the reader; DR-16
  says it opens the day's verse full screen. Highlights, notes, Saved and Share as an image (PS-01–PS-05) were never
  built, though the reader's comments cite the frames around them.
- **QA was screenshots only.** The native tab bar (`expo-router/unstable-native-tabs`) drew no glass, took no taps (they
  landed on the page under it, so a tap on Today's picture could open a book) and drew a stray piece of the picture at
  the foot of Today. A screenshot looked nearly right; one tap would have shown it.
- **Earlier QA reports were trusted** instead of re-checked against the frame.

## What every build does

1. **Start: the inventory.** List every item in the build's plan and every canvas frame assigned to it. The newest frame
   of a screen wins (`docs/design-system.md`, "Where the truth lives").
2. **A frame counts as built only by behaviour.** Its copy, its controls, and where each tap goes all match. Cite the
   file and line. A comment that names the frame proves nothing.
3. **Tap-test every changed screen in the simulator.** Tap every control (tabs, back, every target) and say where it
   landed. Then check Light, Dark and AX5, Reduce Transparency on and off, and VoiceOver order.
4. **Beta native components get proved first.** Before building on anything `unstable_` or new to iOS, check taps,
   rendering and both themes on the simulator. If the basics fail, draw the control ourselves.
5. **End: the gate.** Mark each inventory row built (file:line) or moved, with John's yes and where to. Anything else
   blocks the upload. The list goes in the upload or PR notes, with the design-system pass: tokens and components added
   or removed, and why.
6. **Earlier QA reports are leads, not truth.** Re-check each against the frame.

The full frame inventory for build 10 is `docs/qa/design-qa-2026-10-18/frame-inventory.md`.
