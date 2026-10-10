# TestFlight: Yada v1 (build 2)

Text to paste into App Store Connect → the app → **TestFlight**. Everything below describes what
build 2 contains. Nothing here is a promise about later builds.

## Already handled by the build

- **App icon**: taken from the build (`assets/brand/icon.png`, 1024 × 1024, no alpha), with the
  iOS dark and tinted variants. Nothing to upload.
- **Export compliance**: `usesNonExemptEncryption: false` is in `app.config.ts`, so builds do not
  ask the encryption question. The app uses only HTTPS for downloads.
- **Sign-in**: none. Testers need no account.

## Test Information → Beta App Description

> Yada is a Bible reader that lets you see what the original Greek and Hebrew say, verse by verse.
>
> Read any of the 66 books in four built-in English translations (Berean Standard Bible, World
> English Bible, King James Version and Literal Standard Version). Select a verse to open
> Understand: what is happening in the passage, what the text plainly shows, and where readers
> differ, each with the evidence behind it. Original shows every word of the verse in Greek or
> Hebrew with its English gloss; tap a word for its dictionary form, parts and where else it
> appears. Compare sets translations side by side.
>
> Everything built in works offline. Three more public-domain translations (ASV, YLT, MSB) can be
> downloaded and then read offline too.

## Test Information → Feedback Email

Your own address, the one testers should write to.

## Build 2 → What to Test

> Thanks for testing Yada. This first build has Understand explanations for seven verses, one per
> book: Genesis 1:1, Leviticus 19:18, Psalm 23:1, Isaiah 53:5, John 1:1, 1 Corinthians 14:34 and
> Revelation 13:18. Every other verse has its text, the original Greek or Hebrew word by word, and
> Compare.
>
> Please try:
> 1. Reading. Open a book from Home, change chapter, and close and reopen the app: it should return
>    to the exact verse you were reading.
> 2. Understand. Open 1 Corinthians 14:34, tap the verse, then Understand. Open a claim to see why
>    it is said, and try Original and Compare.
> 3. Original words. In Genesis 1:1 or John 1:1, tap Original, then tap a word for its card.
> 4. Search. Search a reference ("jn 3 16"), an English word, or a Greek word ("λόγος").
> 5. Downloads. Tap the chapter title, then Translation. Download the ASV, read and search
>    it, then turn on Airplane Mode and check it still works. Remove it with ⋯.
> 6. Text size and appearance (Aa), light and dark, and iOS Larger Text in Settings → Accessibility.
> 7. Bookmarks, Recent, Start here (John, passage by passage) and Sources.
>
> Tell us anything that reads wrong, looks broken, or is hard to find. Screenshots help: take one
> and TestFlight offers to send it with your note.

## For external testers only (Beta App Review)

Internal testers (people in your App Store Connect team) can install as soon as the build has
processed. To add external testers, Apple also asks for:

- **Privacy Policy URL**: Yada has none yet. The app collects no personal data: reading position,
  bookmarks and settings stay on the phone, and the only network requests download translations
  and the manifest from R2. A one-page policy saying so is enough; it still needs to be written and
  hosted, and is John's to approve.
- **Contact information** for the reviewer: name, email, phone.
- **App Privacy** (App Store Connect → App Privacy): "Data Not Collected" matches build 2.
