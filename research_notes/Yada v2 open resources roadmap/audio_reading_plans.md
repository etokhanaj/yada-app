# Audio Bibles, word timings, reading plans and Apple speech for Yada (as of 2026-10-11)

Scope: an offline-first iOS reader with BSB, WEB, KJV and LSV text. Today's audio is Apple on-device TTS with word highlighting. Research ran 2026-10-11 using web search and direct fetches of primary pages where possible. Items marked UNVERIFIED were not confirmed against a primary licence text.

## Which human audio Bible is the best commercially usable fit for BSB or WEB text, and are verse timings available?

### Takeaway
The BSB audio is the clear fit. Several full-Bible human narrations (Bob Souer, Barry Hays, Jordan Gilbert, plus a newer "Frederick Surrey" chapter set) are dedicated to the public domain under CC0 1.0 and served as MP3 from openbible.com. CC0 permits commercial bundling. No verse or word timing files are published alongside them, so Yada would have to generate its own. WEB audio is also public domain but patchier (the ebible.org MP3 page covers the NT and Psalms only; a full-Bible zip exists but its narrator isn't clearly credited). Bible Brain (Faith Comes By Hearing) has verse timings, but its terms forbid charging users and restrict offline use, so it does not fit a commercial offline app.

### Cited Findings
**BSB audio (Berean / openbible.com)**
- The official BSB audio page credits "Bob Souer, Barry Hays, and Jordan Gilbert" and states: "These audio versions of God's Word have been dedicated to the public domain (CC0 1.0)." It also says "Coming soon in more free formats." No file sizes or timings are given. — [bereanbible.com/audio](https://bereanbible.com/audio/)
- Bible Hub chapter pages repeat the credit ("BSB Audio narrated by Bob Souer, Barry Hays, and Jordan Gilbert") and the CC0 statement, and offer both a voice-only and a "with music" version. — [Bible Hub John 10 audio](https://biblehub.com/audio/john/10.htm)
- The openbible.com/audio/ directory index lists these folders: `souer/`, `souer_books/`, `hays/`, `hays_books/`, `gilbert/`, `gilbert_books/`, `gilbert_music/`, `gilbert_music_books/`, `bsb_musical/` and `bsb_frederick_surrey/`. The last was modified 2026-08-08. The index has no licence or readme file. — [openbible.com/audio](https://openbible.com/audio/)
- Souer per-book MP3s: Genesis `BSB_01_Gen.mp3` is 272 MB, Psalms `BSB_19_Psa.mp3` 354 MB, John `BSB_43_Jhn.mp3` 149 MB. The 66 book files sum to about 5.7 GB (about 4.3 GB OT and 1.4 GB NT). Zips: `BSB_00_Souer_OT.zip` 3.6 GB and `BSB_00_Souer_NT.zip` 1.2 GB. There are no timing or licence files in the folder. — [openbible.com/audio/souer_books](https://openbible.com/audio/souer_books/)
- The Frederick Surrey ("FS") set has one MP3 per chapter for all 66 books, named `BSB_01_Gen_001_FS.mp3` through `BSB_66_Rev_022_FS.mp3`. Sizes run from about 238 KB (Psalm 117) to 13 MB (Psalm 119), and the full zip `BSB_000_Chapters_FS.zip` is 3.9 GB. There are no timing, readme or licence files. — [openbible.com/audio/bsb_frederick_surrey](https://openbible.com/audio/bsb_frederick_surrey/)
- The Frederick Surrey narrator is UNVERIFIED: a web search found no page crediting him, and the bereanbible.com audio page names only Souer, Hays and Gilbert. — [search attempt; bereanbible.com/audio](https://bereanbible.com/audio/)
- Faith Comes By Hearing also produces a BSB audio drama, described as having "approximately 180 different characters" with sound effects. Its licence was not checked, and FCBH content generally carries FCBH terms (see below). — [search summary, Wikipedia: Audio Bible](https://en.wikipedia.org/wiki/Audio_Bible)

**WEB audio (ebible.org)**
- The ebible.org MP3 page covers Psalms and the whole NT (Matthew to Revelation). It credits "Michael Paul Johnson and other volunteers" and says, quoted exactly: "The audio recordings of the World English Bible on this page are in the Public Domain. They are not copyrighted." It gives no file sizes and points to a fuller set by David Williams at AudioTreasure.com and TalkingBible.com, whose licence was not checked. — [ebible.org/webaudio/mp3.htm](https://ebible.org/webaudio/mp3.htm)
- ebible.org/eng-web/audio/ offers a full-Bible `eng-web_audio.zip` with per-book folders. It says: "The World English Bible is in the Public Domain and has no copyright restrictions," and you "may download, copy, and listen to this recording of the Holy Bible freely." The narrator is not clearly named, the zip size is not stated, and there are no timing files. — [ebible.org/eng-web/audio](https://ebible.org/eng-web/audio/)
- "World English Bible" is a trademark of eBible.org. If the text is altered, the result should not be called WEB. — [search summary of ebible.org](https://ebible.org/webaudio/)
- A British Edition (WEBBE) audio zip, `eng-webbe_mp3.zip`, also exists. — [ebible.org/eng-webbe/mp3](https://ebible.org/eng-webbe/mp3)

**KJV audio (LibriVox)**
- A LibriVox forum post says Mike Armenta read the entire KJV solo, at roughly 100 h 45 min; the project page is librivox.org/bible-complete-king-james-version. That page was not opened. — [LibriVox forum](https://forum.librivox.org/viewtopic.php?p=1941097)
- LibriVox licence: "LibriVox recordings are Public Domain in the USA. If you are not in the USA, please verify the copyright status of these works in your own country before downloading." Yada's company (Creotok LTD) is in England and Wales. The KJV is under Crown letters patent in the UK; that matters for the text, while the recordings are PD dedications. — [LibriVox OT dramatized project](https://librivox.org/dramatized-bible-stories-of-the-old-testament-by-king-james-version-kjv/)
- LibriVox also has dramatized multi-reader KJV selections, which are OT stories only and not complete. — [same](https://librivox.org/dramatized-bible-stories-of-the-old-testament-by-king-james-version-kjv/)

**Bible Brain / DBP (Faith Comes By Hearing)**
- The licence requires: "You enable your End Users to access DBP Content completely free of charge." — [FCBH Bible Brain license](https://www.faithcomesbyhearing.com/bible-brain/license)
- On offline use: "No DBP Content may be downloaded or made available for offline use by any person or outside of DBP." The exception is content "accessible via the /download endpoint." — [same](https://www.faithcomesbyhearing.com/bible-brain/license)
- On rights: "We are not providing you with a license or right to DBP Content." Content belongs "solely to us and our licensors," and apps must "conspicuously post all proprietary rights notices." — [same](https://www.faithcomesbyhearing.com/bible-brain/license)
- FCBH documents Audio Timings endpoints for "accurate starting times for each verse" (karaoke-style highlighting). — [FCBH Bible Brain user flows](https://www.faithcomesbyhearing.com/bible-brain/user-flows)
- A third-party review counts about 231 Bibles with verse timings as of January 2022 (dated), and reports that the API key is approval-gated. — [learnofchrist.com review](https://learnofchrist.com/resources/bible-brain-api)

### Inferences
- Best fit: BSB voice-only by Bob Souer, or the per-chapter Frederick Surrey set, which is already split by chapter and suits on-demand chapter download. CC0 lets Yada host the files on its own R2/CDN, transcode them (e.g. to AAC at a lower bitrate), and ship them inside the app. Attribution is courteous, not required.
- Size planning: the full Bible is about 4–6 GB as distributed MP3. Per-chapter downloads (median roughly 1–4 MB) are the realistic offline model. Re-encoding speech to around 32–48 kbps AAC/Opus would likely cut this to about 1–1.5 GB for the whole Bible (estimate, not measured).
- No timings ship with any open recording found, so Yada needs its own alignment step (see the next section). The text match is exact, which makes alignment straightforward, provided the narration follows the current BSB text revision. That needs checking: the recordings date from 2022–2026 and the BSB text has had revisions.
- Bible Brain is out for a paid or subscription app with offline audio. Its verse timings can't be used unless Yada stays free and online-only for that content.
- WEB and KJV/LibriVox are fallbacks. The WEB coverage is partial or uncredited, and LibriVox quality varies by volunteer.

### Gaps
- MP3 bitrate and sample rate of the BSB files were not shown; they need a header probe.
- Whether the Hays and Gilbert folders each hold a full Bible or split it by testament or section was not checked.
- Which BSB text revision each narration follows was not found.
- The identity of the Frederick Surrey narrator, and whether that set is covered by the same CC0 dedication (the folder holds no licence file), is UNVERIFIED. Confirm with the Berean Bible team before shipping.
- The Bible Brain licence's treatment of PD or open-licensed audio (e.g. whether CC0 BSB audio served through DBP is still bound by DBP terms) was not addressed in the licence page.
- No independent quality reviews of the BSB narrators were found.

## Can word timings be generated locally for free with acceptable accuracy?

### Takeaway
Yes. Because the text is known exactly, forced alignment works better than free transcription. The permissive stack is: WhisperX (BSD-2-Clause) or Montreal Forced Aligner (MIT code), with an English CTC model under a commercial-friendly licence (wav2vec2-base-960h is reported as Apache-2.0). Avoid Meta's MMS_FA weights (CC-BY-NC-4.0) in a commercial pipeline. aeneas is AGPL and aligns at sentence or verse level, so it suits verse timings rather than word timings. On iOS 26, Apple's SpeechAnalyzer/SpeechTranscriber gives on-device word time ranges, with about 113 ms boundary error reported by a third party. Alignment should run offline in the build pipeline on a Mac, with the timings shipped as data.

### Cited Findings
- **aeneas** is licensed AGPL v3 (PyPI metadata). Its author says it was designed to be usable in commercial products, but AGPL obligations still apply to distributed or hosted modified code. — [PyPI aeneas 1.6.0.0](https://pypi.python.org/pypi/aeneas/1.6.0.0); [author blog](https://www.albertopettarin.it/blog/2016/08/03/inside-aeneas-part-1-motivation-and-design-principles.html)
- **Montreal Forced Aligner**: PyPI metadata for v3.4.0 lists MIT. It is built on Kaldi, whose permissive licence eases distribution. — [PyPI Stats MFA](https://pypistats.org/packages/montreal-forced-aligner); [MFA Interspeech 2017 paper](https://www.isca-archive.org/interspeech_2017/mcauliffe17_interspeech.html)
- **WhisperX** is listed as BSD-2-Clause in PyPI v3.8.5 metadata and in nixpkgs packaging. Its dependencies carry their own licences. — [depscope whisperx](https://depscope.dev/pkg/pypi/whisperx); [nixpkgs commit](https://code.ornl.gov/nix/nixpkgs/-/commit/b33937b00f85e88d081efbd914c49ab121b5240a)
- **MMS_FA** (torchaudio `Wav2Vec2FABundle`) weights download at about 1.18 GB. Third-party Hugging Face conversions state the licence is "CC-BY-NC-4.0 … from Meta's MMS release," i.e. non-commercial. The torchaudio docs themselves don't state a licence. — [torchaudio Wav2Vec2FABundle docs](https://docs.pytorch.org/audio/main/generated/torchaudio.pipelines.Wav2Vec2FABundle.html); [chordai/mms-fa-aligner-coreml](https://huggingface.co/chordai/mms-fa-aligner-coreml); [tatsu020/mms-300m-fa-onnx](https://huggingface.co/tatsu020/mms-300m-fa-onnx)
- The same Hugging Face page suggests an English-only Apache-2.0 alternative, a wav2vec2-base-960h aligner. — [chordai/mms-fa-aligner-coreml](https://huggingface.co/chordai/mms-fa-aligner-coreml)
- **whisper.cpp**: Debian packaging records its copyright and licence. The licence was not re-read for this note; it is widely known to be MIT, but that is UNVERIFIED here. — [Debian whisper.cpp copyright](https://tracker.debian.org/media/packages/w/whisper.cpp/copyright-1.8.6dfsg-2)
- **Apple SpeechAnalyzer / SpeechTranscriber (iOS 26)** runs on device, consumes `AVAudioPCMBuffer`s and streams results as an AsyncSequence. It replaces SFSpeechRecognizer and is described as better for long-form audio. The model downloads on first use, and there is no custom vocabulary. — [DEV Community WWDC25 summary](https://dev.to/arshtechpro/wwdc-2025-the-next-evolution-of-speech-to-text-using-speechanalyzer-6lo); [Anton Gubarenko guide](https://antongubarenko.substack.com/p/ios-26-speechanalyzer-guide)
- The third-party "Align" package refines SpeechAnalyzer word timestamps. Its vendor-measured mean boundary error is about 113.5 ms raw from Apple, falling to about 44.9 ms after refinement, on clean audio. It is not independently benchmarked. — [desert-ant-labs/align](https://huggingface.co/desert-ant-labs/align)

### Inferences
- The recommended pipeline runs offline and builds data, not app code. For each chapter MP3 and its BSB chapter text: normalise the text (numbers, punctuation and divine names such as "LORD"), CTC-align it with a permissive English wav2vec2 model via WhisperX's alignment step or torchaudio `forced_align`, and emit a per-word `[start_ms, end_ms]` JSON keyed to Yada's word or token ids. Verse timings fall out of the word timings for free.
- Accuracy: CTC forced alignment on clean studio narration with exact text is typically within tens of ms per word, which is fine for word highlighting since humans tolerate about 100–200 ms. This is general knowledge and not measured here, so it needs a spot-check on a sample of chapters (Psalm 119, genealogies, Hebrew names).
- Effort: about 1–3 days for the pipeline and QA tooling. Compute is around 1,200 chapters, minutes per chapter on Apple Silicon CPU or MPS.
- Rule 5 ("assume the oracle is right"): treat alignment output as generated data. Flag low-confidence words (CTC score) for John's review rather than shipping them silently.
- Doing alignment on device with SpeechTranscriber is possible but unnecessary. It is transcription and not alignment, so it needs fuzzy matching back to the text, and it is less accurate. Precomputing is simpler and works offline from the first play.
- Licence hygiene: record the model name and licence in the bundle provenance. Never use MMS_FA weights.

### Gaps
- The MFA pretrained English acoustic model and dictionary licence was not checked (UNVERIFIED; possibly CC-BY 4.0).
- The licence of the WhisperX default English alignment model (torchaudio `WAV2VEC2_ASR_BASE_960H`, from fairseq) was not read from its source file.
- OpenAI Whisper weights are MIT per training knowledge, but this was not fetched (UNVERIFIED).
- No published word-level accuracy benchmark for scripture narration was found.

## Which reading-plan formats fit a passage-first app without streaks?

### Takeaway
Fixed-length daily-checklist plans tied to calendar dates (M'Cheyne, chronological, YouVersion's) make users feel "behind," and YouVersion bolted on "Catch Me Up" to undo that. For a passage-first app, the best fit is a plan as an ordered sequence of passages with no dates: "next passage" rather than "day 47." Completion is recorded per passage, the plan is resumable at any point, and nothing counts consecutive days. M'Cheyne (1842, public domain) is the classic open dataset. The evidence says single missed days don't hurt habit formation, but the belief that you've failed does.

### Cited Findings
**How plans are structured**
- YouVersion's "Catch Me Up" resets "Today's reading" to the day after the last completed day, to avoid "constantly being told you are behind." — [The Sweet Setup](https://thesweetsetup.com/use-catch-feature-youversions-reading-plans/)
- YouVersion Streaks count "how many days in a row you use the Bible App" and send a reminder "if it looks like you might miss a day." Reading, listening or completing a plan day all count. Behaviour after a missed day is undocumented. — [search summary of YouVersion announcement](https://imageserver.redfishgroup.co.uk/streaks-build-your-bible-habit.html)
- The M'Cheyne plan has readings from the OT, NT and Psalms or Gospels daily. wd.bible labels it "Public Domain." It can be read over 1, 2 or 3 years (the STEP Bible layout). — [wd.bible plan](https://wd.bible/en/plan/detail/40); [STEP Bible M'Cheyne](https://ai.stepbible.org/html/mcheynes_readings.html)
- The ESV's M'Cheyne presentation is "© 2017 Crossway," so build from the 1842 original and not from ESV's version. — [esv.org one-year tract](https://esv.org/plans/one-year-tract)
- A reading plan generator offers M'Cheyne and other canonical orders with CSV and iCal export; check its terms before redistributing. — [learnofchrist.com generator](https://learnofchrist.com/resources/bible-reading-plan-generator)
- No GitHub CSV of M'Cheyne with a licence file was found in this search.

**Evidence on keeping going without streak guilt**
- The "what-the-hell effect" (Polivy & Herman 1985): the belief that one has broken a rule, rather than the actual violation, is enough to disrupt self-control. — [EFPSA Research in a Nutshell](https://more.efpsa.org/rpblog/?p=1172)
- Zemack-Rugar (Virginia Tech): how a person responds to an initial slip, giving up or correcting course, predicts later goal success. — [Virginia Tech news, 2014](https://news.vt.edu/articles/2014/05/050214-pamplin-failureresponse.html)
- Lally et al. 2010 (96 participants, 12 weeks): missing one opportunity "did not materially affect the habit formation process." This came via a secondary summary; the primary paper was not fetched. — [search summary; UCL Discovery](https://discovery-pp.ucl.ac.uk/id/eprint/1477627)
- UCL qualitative study of the Lift app: reminders and streaks support repetition but "create a dependency," making users fragile when they stop. — [UCL Discovery](https://discovery-pp.ucl.ac.uk/id/eprint/1477627)
- Silverman (consumer behaviour) reportedly found broken streaks demotivate through goal failure and loss aversion, and suggests downplaying broken streaks and offering "streak repair." This came via a podcast; the primary paper was not verified. — [Hooked on Streaks podcast](https://pocketcasts.com/podcasts/35f14df0-e276-0135-c259-7d73a919276a/cef26964-b0ba-4439-a057-6cf555fe30fc)
- Duolingo (company data, not peer reviewed): allowing two streak freezes raised daily active learners by +0.38%. It also cites a Penn/UCLA study that "a little slack" motivates more than rigid rules. — [Duolingo blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
- Penn CHIBE on the "fresh start" effect and goal strategies. — [CHIBE](https://chibe.upenn.edu/news/time-the-3-science-backed-strategies-that-can-help-you-achieve-your-post-pandemic-goals/)

### Inferences
- Plan data format: `{plan_id, title, source, licence, entries: [{seq, passages: [osisRange…]}]}` with no dates. A user's progress is `{plan_id, completed_seq_set, started_at}`. Show "Next: Genesis 3 · Matthew 3" rather than "Day 3 of 365," and never show a count of days missed.
- Multi-track plans like M'Cheyne (four readings per entry) fit a passage-first UI as one entry holding several passages. Each passage opens in the normal reader and its completion is ticked independently.
- Candidate open plans: M'Cheyne (1842, PD), canonical order (trivial to generate), NT-in-order, Gospels, and a self-derived chronological order. Original chronological plans by publishers (e.g. ESV, YouVersion partners, BibleProject) are copyrighted, so build Yada's own from public-domain scholarship or Yada's own ordering.
- Evidence-led design: no streak counter, no "you're behind" messaging, and progress shown as passages read, which only ever increases. A "pick up where you left off" entry point acts as a fresh start.

### Gaps
- BibleProject reading-plan licence and structure were not researched; licensing is likely restrictive (UNVERIFIED).
- No data was found on YouVersion plan completion rates, or on retention for date-free versus dated plans.
- Primary sources for the Lally 2010 and Silverman streak papers were not fetched.
- Whether a PD chronological plan with a clear licence exists as data was not found.

## Apple speech improvements available on iOS 26 (Personal Voice limits, premium voices, new APIs)

### Takeaway
The big iOS 26 addition is on the recognition side (SpeechAnalyzer/SpeechTranscriber, on-device with word time ranges), not synthesis. AVSpeechSynthesizer still offers Personal Voice behind an explicit user authorization, with known restrictions: buffer output and background playback don't work with Personal Voice, and behaviour varies across platforms. Premium and enhanced voices remain user-downloaded and cannot be bundled.

### Cited Findings
- AVSpeechSynthesizer exposes a personal-voice authorization status and a request method, so apps must get user permission. There is also a notification for changes to the available voices. — [Apple AVSpeechSynthesizer docs](https://developer.apple.com/documentation/avfaudio/avspeechsynthesizer.md); [WWDC23 10033 notes](https://wwdcnotes.com/documentation/wwdc23-10033-extend-speech-synthesis-with-personal-and-custom-voices/)
- Personal Voice in the background: the system logs that it cannot use the buffer callback with Personal Voices and falls back to the output channel. The same happens with `write(_:toBufferCallback:)`. No official answer was given in the thread. — [Apple Developer Forums 736148](https://developer.apple.com/forums/thread/736148)
- An iOS app running on an M2 Mac failed with "Caller does not have kTCCServiceVoiceBanking access to personal voices. No speech will be generated." — [Apple Developer Forums 757828](https://developer.apple.com/forums/thread/757828)
- A worked example of using Personal Voice in an iOS app. — [Ben Dodson](https://bendodson.com/weblog/2024/04/03/using-your-personal-voice-in-an-ios-app/)
- iOS 26 SpeechAnalyzer/SpeechTranscriber is covered in the previous section. It runs on device, its model downloads on first use, and it has no custom vocabulary. — [Anton Gubarenko](https://antongubarenko.substack.com/p/ios-26-speechanalyzer-guide)

### Inferences
- Personal Voice would let a user hear scripture in their own voice. Word highlighting via `willSpeakRangeOfSpeechString` should still work through normal playback, but Yada can't pre-render Personal Voice audio to files or buffers, and background playback is unreliable. Treat it as an opt-in nicety, not the audio strategy.
- Human BSB audio with precomputed word timings is a separate and stronger path for "real" listening. Apple TTS stays as the fallback for WEB/KJV/LSV and for chapters without timings.

### Gaps
- No iOS 26-specific changes to AVSpeechSynthesizer (new voices, SSML changes or Personal Voice limits) were confirmed in this search. Check the iOS 26 AVFAudio release notes directly.
- Premium and enhanced voice availability and licensing (whether audio may be recorded or redistributed) was not researched; it is assumed non-redistributable (UNVERIFIED).
- The official Apple doc page for SpeechTranscriber's word `audioTimeRange` attribute was not fetched.
