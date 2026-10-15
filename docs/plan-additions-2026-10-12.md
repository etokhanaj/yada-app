# Additions to the next release (John, 12 Oct 2026)

John added these items to the next release. Each goes through `/design` on the canvas first: Light, Dark and AX5,
Mobbin research, and John's review before anything is built. They sit alongside the scope in
`docs/handoff-2026-10-12.md`. Every licence is read from the source's own files before ingest (rule 3).

## A. Data already in the pipeline, not yet in the app

1. **Glyssen speakers in the guide's "Where we are"** (MIT; `packages/pipeline/src/glyssen.ts`, `speakers.v1.db`,
   `passageSpeakers()`).
   - Show one quiet line, "Speaking: John the Baptist, priests/Levites", built only from rows marked `speaks`.
   - Use Glyssen's own IDs. A slash means alternatives or a group, so it stays as written.
   - Rows marked uncertain, reported, or as markers never appear as "Speaking". John 3:14–21 is only possibly
     Jesus' words, so never present 3:16 as "Jesus says".
   - Delivery notes such as "to crowd" may give the addressee, labelled as Glyssen's note.
   - Credit: MIT, with the two copyright lines, on Sources.
   - Design questions: the line's place and weight in "Where we are", how it reads at AX5, and VoiceOver wording.
2. **MACULA for marking evidence words** (CC BY 4.0; `packages/pipeline/src/macula.ts`, `syntax.v1.db`, 29 MB
   gzipped in full).
   - Ship a small per-book slice, John first.
   - Link each claim to its words as `(ord, position)` so the guide marks the right words in the BSB: subject,
     verb and object groups, and the arguments a verb takes (who loves whom in 3:16).
   - This replaces today's narrow word-count match. Show only MACULA's own labels, with nothing generated.
   - Credit as MACULA's licence file asks.
   - Design questions: how the marks look beside the existing evidence underline, what a tap does, and how
     Reduce Motion and VoiceOver handle them.
3. **Hebrew letters written large, small or raised**, such as the raised nun in Judges 18:30. The data is in
   staging's `raw_surface`. It needs a bundle column (a format change) and a typography decision. It affects
   about 11 words, so it is low priority.

## B. The report's "later" list

4. **A timeline of biblical events** (Theographic `events.json`, CC BY-SA 4.0).
   - One line in "Where we are" places the passage in time. A tap opens a simple ordered sequence.
   - Show order and only a few anchor dates that John has reviewed. Theographic follows one young-earth
     chronology with only 6 dates flagged approximate, so exact dates would overstate certainty (rule 4).
   - Theographic's licence chain needs checking first: part of its people data came from an older non-commercial
     TIPNR release.
5. **unfoldingWord Translation Words and Translation Questions** (CC BY-SA 4.0; remove the unfoldingWord®
   trademark from adapted copies).
   - Translation Words: 953 short key-term articles that open when a reader taps a term in a note or the guide.
     They are a simpler alternative to a dictionary.
   - Translation Questions: an optional "Check what you read" at the end of a guide, with no scores or streaks.
6. **Dictionary of Bible Themes** (Aquifer, CC BY-SA 4.0). It has 2,530 themes, each linked to its passages. A
   guide shows "Themes in this passage", and each theme opens the other passages that develop it.
7. **Human audio for WEB and KJV.** Same player and word timing as the BSB audio.
   - WEB is Winfred Henson's 2014–16 reading. Credit him and the year, and get eBible.org's written confirmation
     first.
   - KJV is Mike Armenta's reading on LibriVox. It waits on Cambridge University Press for the UK.

## C. Set aside earlier, listed so they aren't lost

- **Tyndale:** the dictionary, full book introductions, theme articles, maps, charts and essays, and the clarity
  fixes (who Tyndale is, what NLT means, "On 6:1–71", NLT quotes styled apart from Greek). All are out of scope
  unless John brings them back.
- **NIV,** once Biblica or Hodder answers: switch it on in the proxy's `SERVED` setting, with no app update.
  **The Message and ERV** depend on Tyndale's and Bible League's replies.
- **The UBS Greek and Hebrew meaning dictionaries** (Aquifer).
- **App:**
  - privacy and support links once the website is live;
  - a "remove my data, including iCloud" option;
  - a Settings page once there are about four real preferences.
- **Business:**
  - Cambridge's KJV answer, needed before the App Store launch;
  - API.Bible Pro or direct publisher licences before any monetisation.

## Suggested order inside /design

Do A1 and A2 first: both are licensed, free, already built, and they improve the guide without AI. Then B5 and
B6, the light, structured study aids. Then B4, which needs the most care. B7 and A3 come last.

## D. Human-read BSB audio: data and hosting cost

Item 2 of the handoff scope, estimated on 12 Oct 2026. Confirm the prices on Cloudflare's R2 and Workers pricing
pages before relying on them.

**What is stored where**
- The original recordings (CC0 MP3s, music-free versions only) are pinned with a sha256 for each file, in
  `content/raw/` on John's Mac.
- Word timings are produced on the Mac by forced alignment (WhisperX with an Apache-2.0 English model, or MFA). Each
  word gets a start and end time, keyed to the same word indices the ink pill uses; verse times follow from them.
- Per-chapter compressed audio (mono AAC, 32–48 kbps) and its timings JSON are published to R2. Each manifest entry
  carries its size and sha256.
- On the phone, a chapter downloads the first time it is played and is kept for offline use. "Download John" fetches
  the whole book. A small table in the user database records what is downloaded, per device, and it isn't synced.
- Nothing about the listener is stored or sent. The app only asks R2 for a chapter, as it does for a translation.

**Size**
- The BSB reading is about 75–80 hours. One narrator comes to about 1.2 GB at 32 kbps or 1.7 GB at 48 kbps, with
  John at about 30–45 MB. Timings add tens of MB. Each extra narrator multiplies this.

**Cost on R2** (free tier: 10 GB storage a month, 10 million read requests a month, egress always free)
- Storage: about 1.2–1.7 GB, plus the existing translations and study notes, stays under 10 GB, so $0.
- Reads: two requests a chapter (audio and timings). 500 testers playing 100 chapters each is about 100,000 reads,
  so $0. 10,000 readers each downloading the whole Bible is about 24 million reads, about $5 in that month.
- The NKJV/NLT proxy is free too: the Workers free plan covers 100,000 requests a day.

**The real constraint is the Mac's disk.** Re-encoding and aligning needs about 10 GB of working space. Clear
DerivedData and finished worktrees first; the disk filled twice on 11–12 Oct.

**The printing check: the first audio task in the build after (John approved, 12 Oct).** No page states which BSB printing
a recording follows: berean.bible/downloads.htm labels the text "Current, updated to 3rd Printing", with no dates or
changelog. So we measure it instead of asking.
- **Narrators** (https://openbible.com/audio/, directory listings, per-chapter MP3s plus zips, as seen 12 Oct):
  - Bob Souer, `/audio/souer/`. NT zip 2022-09-19 (921 MB), OT zip 2023-08-26 (4.2 GB), chapters 2023-08-25. Files are named like `BSB_01_Gen_001.mp3`.
  - Jordan Scott Gilbert, `/audio/gilbert/` (2022-09-24, `_G.mp3`). Use the voice-only set, never `/audio/gilbert_music/`.
  - Barry Hays, `/audio/hays/` (2025-10-17, `_H.mp3`, chapters zip 3.7 GB). The newest set.
  - "David", `/audio/david/` (2025-03-17). It also reads the KJV and MSB, and the CC0 page doesn't name it, so it may be synthetic. Leave it out of "human-read" until that's confirmed.
- **Licence:** bereanbible.com/audio/ dedicates the recordings to the public domain (CC0 1.0) and names Souer, Hays
  and Gilbert. Re-read it from that page at ingest (rule 3).
- **Check:**
  1. Download one or two text-heavy chapters per narrator, for example GEN 1 and JHN 1, a few MB each, pinned with sha256.
  2. Run the planned forced alignment (WhisperX with an Apache-2.0 model, or MFA), offline on the Mac, against our `bsb.txt` (3rd printing).
  3. Report each narrator's mismatch rate and the mismatched words. A narrator who says words our text lacks, or skips words it has, is reading a different printing.
  4. Pick the narrator who matches. Hays is likeliest, being the newest.
- **No-AI rule:** alignment outputs timings only, with no generated text, and the ASR model never sees licensed text.
- **The Berean email is optional.** It would confirm the result and could say what changed between printings, but it
  no longer blocks anything.
