# JPS 1917 Tanakh: licence and UK status

Checked 12 Oct 2026, for adding the 1917 Jewish Publication Society translation as a downloadable
Old Testament comparison text (`JPS`). Conclusion: **public domain in the US and in the UK.** Every
named editor and translator died in 1955 or earlier, so the UK term (life + 70 years, to 31 December)
ended on 31 December 2025 at the latest.

## The work

*The Holy Scriptures According to the Masoretic Text: A New Translation*, Jewish Publication Society
of America, Philadelphia, 1917. Preface dated 27 September 1916.

## The source Yada uses, and its own licence statements

eBible.org's `engjps` (https://ebible.org/engjps/), the VPL archive
`https://ebible.org/Scriptures/engjps_vpl.zip`, downloaded 12 Oct 2026. eBible built it on 8 Oct 2026
from source files dated 12 Dec 2025.

| File | sha256 |
|---|---|
| `engjps_vpl.zip` (as downloaded; the pin in `sources.ts`) | `12b1812db23e9c10be68f2dd417aa1a190db4c03c6e6f5c29f53f97332b659d7` |
| `engjps_vpl.txt` (extracted member) | `69b30d85abc624db443665212f536d53204160147377bf15ebdc3ce6fc863d16` |

Read in the package's own files (rule 3), not from a badge:

- `engjps_about.htm`, inside the zip: "Public Domain … Translation by: Jewish Publication Society".
  It adds that the newer JPS Tanakh (1972-1985) is a different work, at jps.org. `ingest` re-reads this
  file on every run and refuses the source if "Public Domain" is gone.
- eBible's copyright page, https://ebible.org/engjps/copyright.htm, says the same.
- eBible's Sword module of the same text (`engjps1917eb.conf`, https://ebible.org/sword/zip/engjps1917eb.zip):
  "This work is not copyrighted. It is in the Public Domain."

The file names no printing (1917 first edition or the 1955 reset). Either way the words are the same
(see "Later editions" below).

A second digital source agrees. Sefaria's version record for "The Holy Scriptures: A New Translation
(JPS 1917)" (https://www.sefaria.org/api/texts/versions/Isaiah) gives licence "Public Domain". It
says JPS shared digital images of the text with the Open Siddur Project, and Sefaria imported it from
there.

## Who wrote it: the preface

The preface names everyone who worked on the translation. Wikisource has a scan of the 1917 edition:

- Printed p. v, https://en.wikisource.org/wiki/Page:JPS-1917-Universal.djvu/11: the first plan
  (1892-1901). Its Editorial Committee was Marcus Jastrow (editor-in-chief), Kaufmann Kohler and
  Frederick de Sola Mendes. A footnote lists the translators of single books, marking eight
  "(deceased)" by 1916.
- Printed p. vi, https://en.wikisource.org/wiki/Page:JPS-1917-Universal.djvu/12: the Board of Editors
  from 1908.
  - For the JPS: Solomon Schechter, Cyrus Adler (chairman) and Joseph Jacobs.
  - For the Central Conference of American Rabbis: Kaufmann Kohler, David Philipson and Samuel Schulman.
  - Max L. Margolis, the seventh member, was editor-in-chief and secretary.
  - Israel Friedlaender sat for one year in Schechter's place.

## Death years

| Name | Role | Died | Source |
|---|---|---|---|
| Samuel Schulman | Board | 2 Nov 1955 | American Jewish Archives MS-90 finding aid, http://collections.americanjewisharchives.org/ms/ms0090/ms0090.html |
| David Philipson | Board; Numbers | 29 Jun 1949 | Detroit Jewish Chronicle, 7 Jul 1949, https://digital.bentley.umich.edu/djnews/djc.1949.07.07.001/11 |
| Stephen S. Wise | Judges | 19 Apr 1949 | AJA MS-49, https://collections.americanjewisharchives.org/ms/ms0049/ms0049.html |
| Joseph H. Hertz | Joshua | 14 Jan 1946 | AIM25 / London Metropolitan Archives, https://atom.aim25.com/index.php/hertz-joseph-herman-1872-1946-chief-rabbi-2 |
| Bernard Drachman | II Samuel | 12 Mar 1945 | https://www.encyclopedia.com/arts/educational-magazines/drachman-bernard-1861-1945 |
| William Rosenau | Esther | Dec 1943 | AJA MS-41, https://sites.americanjewisharchives.org/collections/ms0041/ |
| Cyrus Adler | Board chairman | 7 Apr 1940 | McGill authority record, https://archivalcollections.library.mcgill.ca/index.php/adler-cyrus-1863-1940 |
| H. Pereira Mendes | Amos | Oct 1937 | AJA MS-39, https://sites.americanjewisharchives.org/collections/ms0039/ |
| D. Davidson | Malachi | 1933 (born 1848) | Kaplan Collection, https://www.kaplancollection.org/item/does-judaism-still-exist-a-pamphlet-by-cfb97d30 (weak; see below) |
| Max L. Margolis | Editor-in-chief | 2 Apr 1932 | University of Pennsylvania finding aid, https://findingaids.library.upenn.edu/records/UPENN_CAJS_CJS.ARCMS6 |
| Maurice H. Harris | Micah | 23 Jun 1930 | AJA MS-21, https://sites.americanjewisharchives.org/collections/ms0021/ |
| Frederick de Sola Mendes | 1890s committee; Deuteronomy | Oct 1927 | JTA obituary, https://jta.org/archive/rabbi-frederic-de-sola-mendes-dies-at-age-of-74 |
| Max Landsberg | Genesis | 9 Dec 1927 | Rochester Public Library, https://archives.libraryweb.org/repositories/2/resources/44 |
| Rudolph Grossman | Habakkuk | 22 Sep 1927 | AJA MS-494, https://sites.americanjewisharchives.org/collections/ms0494/ |
| Kaufmann Kohler | Board; 1890s committee; Psalms | 28 Jan 1926 | AJA, https://www.americanjewisharchives.org/snapshots/kaufmann-kohler-1843-1926/ |
| Joseph Krauskopf | Ruth | 12 Jun 1923 | Temple University, https://library.temple.edu/scrc/joseph-krauskopf-papers |
| Samuel Mendelsohn | Haggai | 30 Sep 1922 | NCpedia, https://www.ncpedia.org/biography/mendelsohn-samuel |
| Israel Friedlaender | Board, one year | 5 Jul 1920 | JDC Archives, https://archives.jdc.org/?p=57156 |
| Max Schlesinger | Zephaniah | 1919 (born 1837) | Find a Grave, https://www.findagrave.com/memorial/80318226/max-schlesinger (weak; see below) |
| Henry W. Schneeberger | Ezekiel | 1916 | Jewish Museum of Maryland, https://jewishmuseummd.org/ms-26-chizuk-amuno-congregation-collections/ |
| Joseph Jacobs | Board | 30 Jan 1916 | Britannica, https://www.britannica.com/biography/Joseph-Jacobs |
| Solomon Schechter | Board | 19 Nov 1915 | Cambridge University archives, https://archivesearch.lib.cam.ac.uk/agents/people/6491 |
| L. N. Dembitz, Sabato Morais, Oscar Cohen, J. Voorsanger, L. Mayer, Marcus Jastrow, Gustav Gottheil, M. Mielziner | Book translators (and Jastrow, the first editor-in-chief) | before Sept 1916 | The preface itself marks each "(deceased)" |

Two dates rest on weak sources: D. Davidson (1933, born 1848) and Max Schlesinger (1919, born 1837).
Neither matters. Each was born too early to have died after 1955, the year that sets the term.

The Wikisource transcription spells the Malachi translator "D. Davison". Oscar Cohen's exact year was
not found, but the preface already marks him deceased.

## UK conclusion

The work has joint authors, so the UK term runs 70 years from the end of the year the last known
author died (Copyright, Designs and Patents Act 1988, s.12(4)). That is Samuel Schulman, d. 1955, so
copyright ended on **31 December 2025**. On 12 Oct 2026 it is public domain in the UK.

Two other UK points:

- Country of origin. It was first published in the US, where it is public domain (published before
  1929). The UK could also apply the shorter country-of-origin term (s.12(6)). Yada does not rely on
  this, since life + 70 already passes, and some authors (Hertz, Jacobs) were British.
- Typographical arrangement (s.15). This right lasts 25 years and covers only facsimile copies of a
  page layout, never the words. The 1917 and 1955 printings are long past it. Yada uses eBible's
  plain text, not any printed or PDF layout.

## Later editions

- **1955 reset.** Its copyright line reads "1917, 1945, 1955". It was set in larger type, with
  typographical errors corrected and haftarot marked, and its note says no changes were made in the
  text of the translation. Mechon Mamre reproduces the note: https://mechon-mamre.org/p/pt/jps1917.htm.
  Correcting misprints does not make a new literary work, and the 25-year arrangement right ended
  in 1980.
- **JPS's 2010 free PDF.** A born-digital reset. At most it carries a layout right, which plain text
  does not copy.
- **New JPS (NJPS, 1985) and later revisions.** These are a different translation and still in
  copyright. Yada does not use them.

## What Yada changes

The text is placed on English verse numbers through TVTMS, the inline Hebrew-number markers are
removed, and the five Psalter book headings are removed. Words are otherwise unaltered apart from
whitespace. Recorded in `sources.ts` and `sources.manifest.json` (`modifications`).

## AI boundary

The text is public domain, so CLAUDE.md rule 9 does not apply to it. It may be read aloud and used in
templates. It is still packaged as a downloadable file straight from `content/raw` and never enters
`staging.db`, so no prompt, adversary or regression run reads it.
