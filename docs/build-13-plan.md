# Build 13: ready for the App Store (draft for John)

John, 24 Oct 2026: "add to the build after this plan a feedback session for people to leave [feedback] and also other
things that would be helpful as we plan to launch on the App Store". Nothing here is built until John says yes.

## 1. Feedback, from inside the app
- **Send feedback** on You (YO-30) and in Settings: one sheet, a field ("What's working, what isn't?"), Send.
  Send opens Mail with the words, to creotok@gmail.com, with the version and iOS version added under them; nothing
  else about the phone or the reader. No server and no account: a reply comes back by email.
  Without Mail set up, the sheet offers Copy and shows the address.
- **After a Sit, a prayer or a finished chapter**, at most once a month and never in the first week: "How is Yada for
  you?" with Send feedback, Not now. A quiet line under Amen, never a pop-up.
- **Report a problem** on a verse's More menu (a wrong word, a bad explanation): Mail with the verse id and text
  filled in, so John can find it in the review queue.

## 2. Ratings and reviews
- Apple's own review prompt (`SKStoreReviewController`, through expo-store-review) after the third Amen in a week. iOS
  limits it to three a year; Yada asks no more than that and never after a moment that went wrong (a failed load).

## 3. First run and what's new
- Check the first run as a stranger would: what Yada is, Today, then the tabs; nothing to sign up for (Yada is free).
- **What's new** once after an update: three lines, a picture, Done. From the version's own notes, never a feed.

## 4. App Store listing (prepared, not built in the app)
- Screenshots at 6.9" and 6.5" iPhone and 13" iPad from the simulator: Today, the reader with Understand, Sit, Pray,
  Search; in Light, one in Dark.
- Description and keywords; "Free, no subscription" (yada-is-free); What's New text for 1.0.
- App Privacy: what iCloud keeps (your notes, highlights, list, circles) and that Pray's public requests carry only an
  optional first name; no tracking, no third-party analytics.
- Age rating with user-generated content: Pray's report and block are in (guideline 1.2); say so in the review notes.
- App Review notes: how to try circles and Pray together with a second Apple ID; the licensed versions are read online
  under API.Bible's terms.
- Support URL and Privacy policy on yadabible.com (live); in-app links to both on You.
- Accessibility labels on the App Store page (VoiceOver, Dynamic Type, Dark, Reduce Motion, larger text).

## 5. Before release
- Crash reports from Xcode's Organizer (no crash SDK); a TestFlight round with a few readers using Send feedback.
- A full pass of every Build 12 frame on a phone (the parts the simulator can't reach: circles, request cards, LS-31).

## Open for John
1. Feedback by email to creotok@gmail.com, or a form on yadabible.com instead?
2. Asking one person: John said add it (25 Oct 2026); drafted as AO-01 to AO-04 and planned as Build 12's 12h.
