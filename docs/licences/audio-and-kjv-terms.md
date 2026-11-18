# Audio and KJV terms: research notes

Read 11 Oct 2026. Terms are quoted from each source's own page or file (rule 3), with the URL. Sizes and
formats come from HTTP headers, zip central directories (range requests, nothing fully downloaded) and
`ffprobe` on the first 300 KB of one file per set.

## 1. World English Bible audio

Hub: https://ebible.org/webaudio/ ; also linked from https://ebible.org/web/ and https://worldenglish.bible/.

### Recordings found

| Set | Narrator | Coverage | Format | Size | Licence statement (exact) |
|---|---|---|---|---|---|
| `eng-web/audio/` and **`eng-web_audio.zip`** | Winfred W. Henson (single voice, "a professional voice recording artist") | All 66 books, 1,189 chapters. No Apocrypha. | MP3, 128 kbps CBR, 44.1 kHz, mono. ~3.4–7.5 MB per chapter | zip 5,430,057,471 bytes (5.4 GB), 1,193 entries; Last-Modified 8 Oct 2026 | "You may download, copy, and listen to this recording of the Holy Bible freely. The World English Bible is in the Public Domain and has no copyright restrictions." (https://ebible.org/eng-web/audio/) |
| `eng-web/mp3/` (`ENGWEBN2DA.zip`) | Faith Comes by Hearing (Hosanna), multi-voice NT drama with music | NT only, 260 chapters | MP3, 64 kbps, 22.05 kHz, stereo, embedded cover art | zip 535,780,126 bytes; 2013 | "Recording ℗ Faith Comes by Hearing. Copying and redistribution is allowed." (https://ebible.org/eng-web/mp3/). ID3 comment: "Public Domain / (P) 2013 Hosanna" |
| `engwebp/ogg/` (`engwebp_audio.zip`) | James Toebes | All 66 books (WEB Protestant, American) | Ogg Vorbis, ~160 kbps nominal, 44.1 kHz, stereo | zip 3,179,336,695 bytes; 2021 | **None on the page.** Only "A complete recording of the World English Bible (Protestant, American)." (https://ebible.org/engwebp/ogg/). The eBible.org WEB page calls it "Free OGG audio ... courtesy of James Toebes". |
| `eng-webbe/mp3/` (`eng-webbe_mp3.zip`) | Not named. Listed on worldenglish.bible as "World English British Edition AI Audio" (synthetic) | WEBBE incl. Deuterocanon | MP3, ~25–30 kbps VBR, 24 kHz, mono | zip 1,118,465,079 bytes; Last-Modified 8 Oct 2026 | ID3 copyright tag: "Audio by PublicDomainAudioBibles.com ... The text and audio are released to the public domain and can be used without restriction". Page: "World English Bible British Edition audio is free to download and use." (https://ebible.org/webaudio/) |
| `webaudio/mp3.htm`, `ogg.htm` | Michael Paul Johnson "and other volunteers" | Partial: Psalms, Gospels, Acts, Romans, 1–2 Cor, Hebrews, Revelation | MP3 / Ogg | small | "The audio recordings of the World English Bible on this page are in the Public Domain. They are not copyrighted." (https://ebible.org/webaudio/mp3.htm) |
| archive.org LibriVox WEB OT (2009) and NT (2008) | Multiple LibriVox volunteers | OT / NT | LibriVox MP3 | n/a | archive.org metadata `licenseurl`: `http://creativecommons.org/licenses/publicdomain/` |
| David Williams (AudioTreasure.com), Joe Lundy "Bible Radio Book" 2014 | as named | not checked | | | Not on eBible.org; terms not read. |

### eng-web_audio.zip specifically

- Narrator: Winfred W. Henson. His page (https://ebible.org/eng-web/audio/winfred.htm) says he is "a
  professional voice recording artist" and asks for voluntary donations (lifebylistening.org).
- Contents (from the zip's central directory): 66 book folders, 1,191 MP3s plus `index.htm` and
  `winfred.htm`. Two are duplicates: `42_Luke/01 0989 Luke-Chapter Seventeen (1).mp3` and
  `19_Psalms/... Psalms-Seventy One (1).mp3`. File naming is inconsistent between books (e.g.
  `01_01_Genesis_Chapter_One.mp3` vs `0957 Mark-Chapter One.mp3`); folder `66_Revelations`.
- Terms: the page grants download, copy and listen "freely". It does **not** itself say the recording
  is public domain or dedicate it; the public-domain sentence is about the WEB text. The webaudio hub
  says the Johnson recordings "are in the Public Domain"; that sentence does not cover Henson. Contrast
  FCBH (℗ retained, redistribution allowed) and PublicDomainAudioBibles (explicit PD).
- Text revision: not stated. ID3 dates and file dates are 2014 (Genesis) to 2016 (Malachi, Mark), so
  the recording predates the "2020 stable text edition" (https://ebible.org/find/details.php?id=eng-web)
  and will not match the current WEB text word for word. Classic WEB uses "Yahweh"; whether Henson reads
  "Yahweh" was not checked by listening.
- Directory listings on ebible.org intermittently return 403 (rate limiting); the zip is the reliable
  inventory.

### "World English Bible" trademark

- "However, "World English Bible" is a Trademark of eBible.org." and "All we ask is that if you CHANGE
  the actual text of the World English Bible in any way, you not call the result the World English Bible
  any more." (https://ebible.org/find/details.php?id=eng-web)
- FAQ: "the name "World English Bible" is a trademark that may only be used to identify the World English
  Bible as published from eBible.org and WorldEnglishBible.org, and faithful copies of that work."
  (https://ebible.org/eng-web/webfaq.htm)
- Effect on audio: naming a recording "World English Bible" is fine if it is a faithful reading. A reading
  of an older revision is still a reading of the WEB; label it with the narrator and year, e.g.
  "World English Bible, read by Winfred W. Henson (2014–16)", so it is not presented as the current text.

### Verdict

- **Henson (eng-web_audio.zip): usable with conditions.** Permission is "download, copy, and listen ...
  freely", which covers redistribution in-app but is not a formal public-domain dedication. Conditions:
  credit Henson; label as a 2014–16 reading (text differs from 2020 WEB, so no verse-synced highlighting
  against the current text without alignment); drop the two duplicate files; consider emailing eBible.org
  (or Henson via lifebylistening.org) for a one-line written confirmation that app redistribution is fine.
- **FCBH NT drama: usable with conditions.** Redistribution allowed; credit "℗ Faith Comes by Hearing";
  NT only; music bed.
- **Toebes OGG: unclear.** No licence statement found; ask eBible.org / James Toebes before use.
- **PublicDomainAudioBibles WEBBE: usable** (explicit PD), but it is AI-synthesised, not human.
- **Johnson / LibriVox WEB: usable** (PD), partial or multi-voice.

## 2. KJV in the United Kingdom (Cambridge University Press)

**The primary source could not be read on 11 Oct 2026.** Every cambridge.org page (rights page, King's
Printers patent page, permissions pages, assets.cambridge.org PDFs) returns a Cloudflare bot challenge
(HTTP 403) to curl, WebFetch and the headless browser; the Wayback Machine copies
(e.g. `web.archive.org/web/20250910000514/https://www.cambridge.org/us/universitypress/bibles/about/rights-and-permissions`)
returned HTTP 429 for this session. Under rule 3 the lines below are **not verified** and must not be
quoted in-app or relied on until John opens the page in his own browser and confirms the wording.

Official pages to read (in a normal browser):
- https://www.cambridge.org/us/universitypress/bibles/about/rights-and-permissions (also `/us/bibles/about/rights-and-permissions`, `/gb/bibles/...`)
- https://www.cambridge.org/about-us/who-we-are/kings-printers-patent (formerly `queens-printers-patent`)

What search-engine excerpts of the CUP rights page say (unverified, for orientation only):
- Rights in the Authorized Version in the UK are vested in the Crown and administered by the Crown's
  patentee, Cambridge University Press.
- Up to 500 verses may be reproduced without written permission **for liturgical and non-commercial
  educational use**, provided the verses are not a complete book and are under 25% of the work, and an
  acknowledgement is included. The acknowledgement reportedly reads, in substance: "Scripture quotations
  from The Authorized (King James) Version. Rights in the Authorized Version in the United Kingdom are
  vested in the Crown. Reproduced by permission of the Crown's patentee, Cambridge University Press."
- Non-saleable media (bulletins, orders of service): the initials "KJV" after the quotation suffice.
- Anything beyond that, "including but not limited to reproduction in commercial publications", goes to
  the Permissions Department (reported: University Printing House, Shaftesbury Road, Cambridge CB2 8BS;
  a Bibles permissions request form, possibly to permissions@cambridge.org; the email is unconfirmed).
- No excerpt mentions apps, electronic/digital distribution, or audio recordings.

Primary sources that were readable:
- eBible.org KJV notice (https://ebible.org/kjv/copr.htm): "Letters patent issued by King James with no
  expiration date means that to print this translation in the United Kingdom or import printed copies
  into the UK, you need permission." and "This royal decree has no effect outside of the UK".
- Copyright, Designs and Patents Act 1988 s.171(1)(b) (https://www.legislation.gov.uk/ukpga/1988/48/section/171):
  "Nothing in this Part affects— ... any right or privilege of the Crown subsisting otherwise than under
  an enactment". This is what keeps the prerogative right alive outside the copyright term rules.

Analysis (not legal advice):
- The right is a Crown prerogative over printing/publishing the text in the UK, not a copyright, so it has
  no worldwide effect. Distribution to non-UK storefronts is outside it.
- Creotok Ltd is a UK publisher and the UK App Store is in scope. Whether app display counts as "printing"
  under the patent is untested; CUP's guidance (as excerpted) treats reproduction generally, and its
  free allowance is limited to liturgical and non-commercial educational use and to 500 verses. A full KJV
  in an app exceeds 500 verses, so the free allowance does not cover it regardless of commerciality.
- Audio: no excerpt addresses recordings. A recording of the KJV distributed in the UK reproduces the
  text in another form; treat it the same as the text until CUP says otherwise.

**Verdict: needs permission from Cambridge University Press (Permissions Department) for the full KJV text
and any KJV audio distributed in the UK by a UK company.** Short quotations (≤500 verses, with the
acknowledgement) would fall within the free allowance only if the use is non-commercial educational.
Practical options: (a) write to CUP describing Yada (free, non-commercial, iOS, worldwide, full KJV text
plus audio) and ask for written permission and the required notice; (b) until then, exclude the KJV from
the UK storefront; (c) quote the verified CUP wording here once John has read the page.

## 3. LibriVox KJV recordings

- Catalogue page banner, e.g. the complete KJV (https://librivox.org/bible-complete-king-james-version/):
  "LibriVox recordings are Public Domain in the USA. If you are not in the USA, please verify the copyright
  status of these works in your own country before downloading, otherwise you may be violating copyright
  laws."
- About page (https://librivox.org/pages/about-librivox/): "All our audio is in the public domain, so you
  may use it for whatever purpose you wish."
- Wiki (https://wiki.librivox.org/index.php/Copyright_and_Public_Domain): LibriVox "releases the resulting
  audio back into the public domain", and "We do not, and can't, ensure that these texts are public domain
  outside the United States."
- archive.org metadata for `bible_kjv_complete_2001_librivox`: `licenseurl`
  `http://creativecommons.org/publicdomain/mark/1.0/`.
- Complete KJV: read by Michael Armenta, 100:45:26, catalogued 2020-01-21, zip 2,834 MB (64 kbps MP3),
  plus M4B parts. Per-book projects (multi-reader) also exist, including Apocrypha books.

**Verdict: usable with conditions.** The performers' rights are dedicated to the public domain worldwide
in effect ("whatever purpose you wish"), but LibriVox disclaims anything about the underlying text outside
the USA. For the KJV that underlying-text question is exactly the UK Crown right in section 2, so the
LibriVox recording carries the same UK condition as the KJV text itself. LibriVox recordings also contain
the spoken LibriVox preamble; keep it or trim it, both are allowed under PD.

## 4. API.Bible FUMS for a native iOS app

- Docs (https://docs.api.bible/resources/fair-use and /quick-start/licensing-and-access): "Note: if you
  only use API.Bible for your mobile app (i.e. an app you download from the Apple App Store of Google Play
  Store and has no user-accessible web functionality) you can skip this section."
- Terms (https://api.bible/terms-and-conditions, §14): FUMS is "a system of internal review that we
  require all API developers to use in webapps"; and earlier: "Specifically, any webapp must implement FUMs
  in order to use API.Bible, unless otherwise prohibited by law in local jurisdictions."
- A manual (non-browser) reporting endpoint exists (`https://fums.api.bible/f3?t=...&dId=...&sId=...`)
  if Yada ever wants to report voluntarily.

**Verdict: usable without FUMS** for the native iOS app, as long as it has no user-accessible web
functionality serving API.Bible text. If a Yada website ever shows NIV/NKJV/NLT, that site must run FUMS.
This closes the open item in `docs/licensed-translations.md`.
