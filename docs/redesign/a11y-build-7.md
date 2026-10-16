# Accessibility pass, build 7 (15 Oct 2026)

John asked for an accessibility pass on build 7. Method:
- `ui_audit.py` run over every Build 7 frame (DR, IA-15–17, CT, EB, PS, PR, CP);
- pixel checks of the verse over the pictures;
- a walk through each feature for VoiceOver, Dynamic Type, motion, colour, timing and input.

CLAUDE.md's bar: VoiceOver labels and order, Dynamic Type to AX5, contrast in both themes, Reduce Motion, 44 pt
targets.

## Fixed on the canvas

| Finding | Where | Fix |
|---|---|---|
| Note mark 20 × 13 pt | PS-02 | 24 pt glyph with a 44 pt hit area (the audit measures the glyph, so it still reports 24 × 24) |
| Verse numbers on a highlight at 3.6–4.4:1 | PS-02 | numbers on a highlighted verse use ink, not the muted grey |
| "Sit with this" pill 36 pt tall | PR-01 | 44 pt |
| "First name" chip 36 pt tall | PR-10 | 44 pt |
| A long verse over a bright picture | DR-11, EB-03 | stronger fade (from 18%, 0.8 at the foot) and a soft text shadow; measured at 4.6:1 or better for Esther 8:9, and 12–16:1 for normal verses |

**Not faults:**
- "Contrast 1.00" over pictures: the audit can't see an image.
- Wallpaper text on the Lock and Home Screen frames.
- Content under the tab bar: a scroll inset handles it.
- Open menus covering what is under them.

## Rules for the build, by feature

**Pictures (Today, full screen, widget, share)**
- Every picture gets a contrast check in the pipeline: luminance of the text band after the fade, white text at
  4.5:1 or better. A picture that fails is re-cropped or rejected.
- Alt text for every picture, written in review and approved by John.
- Reduce Transparency or Increase Contrast swaps the fade for a solid band (EB-04).
- VoiceOver reads the picture card as one element: "He is like a tree planted by streams of water. Psalm 1:3.
  Button." Then "Sit with this, button".

**Today**
- VoiceOver order:
  1. the greeting;
  2. the streak ("Streak, 6 days, opens your rhythm");
  3. the picture;
  4. the reading card (label, title, first words, then Read and Listen as separate buttons);
  5. Devotional, Your plan, Pray;
  6. Later;
  7. Reminders.
- AX5: the reading card comes before the picture (already drawn), and cards stack.

**Streak and Your reading**
- The lamp is never the only signal: the number is text.
- Week days read "Monday, read", "Wednesday, a day of rest".
- Progress bars carry their value as text ("5 of 150").

**Highlights and notes**
- Colours are named ("highlighted yellow") and never the only signal: highlights also list under Saved.
- With Differentiate Without Color on, a highlighted verse adds a thin leading bar.
- Note marks read "Your note on verse 16".

**Sit with this**
- Settle:
  - Reduce Motion: no shape, only "In" and "Out" and the haptic.
  - The words "In" and "Out" are announced politely.
  - Haptics follow the system setting.
- Breathe the verse: each half is read when it is its turn.
- Silence:
  - the end is a haptic, plus "Silence ended" for VoiceOver;
  - an optional soft sound for anyone who can't feel the haptic (a setting, off by default);
  - the remaining time is available to VoiceOver on request; nothing is announced every minute.
- Read aloud: the words on screen are the words spoken, with the BSB under a licensed translation (PR-05).

**Praying for others**
- Press and hold for 20 s is a timed gesture, so it always has an alternative:
  - "Use a timer instead" (tap to start, tap to stop);
  - a VoiceOver custom action, "Pray, 20-second timer";
  - Switch Control and Voice Control use the same timer.
- Requests are user text in any language. VoiceOver uses the request's detected language, so a Yoruba request is
  read as Yoruba.
- The composer:
  - the character count is announced at 260 and at 280;
  - Post says why it is disabled ("Post, disabled until you write something").
- The helpline sheet: "Call Samaritans on 116 123" (or the region's line) is the first focus.

**Contents, Compare, Saved**
- Choose a verse grid buttons read "Verse 16".
- Drag to reorder in Compare also offers VoiceOver actions "Move up" and "Move down".
- Each Saved segment is a tab with its count.

**Tabs, iPad, iPhone Duo**
- Tabs read "Today, tab, 1 of 2".
- On iPad, the sidebar follows the system's focus order; keyboard shortcuts carry discoverability titles.
- Folding and unfolding the Duo keeps VoiceOver focus on the same element.

**Apple Watch**
- Text follows the watch's own size (the AW "Larger text" frames).
- The widget is one VoiceOver element.

## Still to check on devices

- VoiceOver on a real iPhone for Today's order and the hold-to-pray actions.
- Dynamic Type AX5 on the iPad sidebar.
- The haptic pacer under Low Power Mode, where haptics can be throttled.
- Voice Control names matching visible labels: "Hold to pray", "Post", "Call Samaritans".
