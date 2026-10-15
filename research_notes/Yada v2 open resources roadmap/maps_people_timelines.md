# Open geography, image, timeline and people/places datasets for Yada (checked 11 Oct 2026)

Method: where possible, licence wording was read from the dataset's own LICENSE, README or file header through the GitHub/Gitea API (`gh api`, `curl` raw), and the data files were downloaded and counted locally. Web pages were used only for sites that have no repo (FreeBibleimages, Natural Earth, OSM, Wikimedia Commons). Anything not read from a primary licence text is marked UNVERIFIED.

Yada-specific flags used below:
- **SA** means share-alike. CC BY-SA applies to the dataset and to adaptations of it, not to Yada's app code. Bundling unmodified SA files inside an app is a "collection", but any edited, translated or merged version of the data must be released under CC BY-SA.
- **AI-gen** means the source contains model-generated prose. Under Yada's rule "Generated content is `flagged`", that prose could only ship as flagged, or be dropped.
- **Licensed-name** means the field carries ESV or NIV names. Rule 9 keeps licensed translations out of every AI call. Proper-name lists are probably not protectable text, but the field should be kept out of prompts to be safe.

---

## Maps and geography

### Takeaway
OpenBible.info Bible Geocoding Data (CC BY 4.0) is the strongest geography base. It has confidence scores for every place, and a time-weighted trajectory of scholarly opinion. For finished maps, the Aquifer-hosted Biblica Open Bible Maps (540 maps, CC BY-SA 4.0) and FIA Maps (76, CC BY-SA 4.0) are the only large, commercial-safe Bible map sets. For a basemap, Natural Earth (public domain) is the low-risk offline choice. OSM data brings ODbL share-alike and attribution obligations.

### Cited Findings

**OpenBible.info Bible Geocoding Data** (github.com/openbibleinfo/Bible-Geocoding-Data)
- Licence wording in the repo `readme.md` §License: "This data is licensed under a [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) license." `license.txt` is the full CC BY 4.0 legal code ("Attribution 4.0 International"). GitHub's SPDX detection gives `CC-BY-4.0`. Commercial use is allowed; attribution is required. — [readme](https://github.com/openbibleinfo/Bible-Geocoding-Data/blob/main/readme.md), [license.txt](https://github.com/openbibleinfo/Bible-Geocoding-Data/blob/main/license.txt)
- The same readme carries two carve-outs: "OpenStreetMap data is licensed under ODbL 1.0, which is similar to CC-BY-SA," and "The licenses for images vary depending on the image but are open and are generally Creative Commons or similar." — [readme](https://github.com/openbibleinfo/Bible-Geocoding-Data/blob/main/readme.md)
- Scope: "attempts to catalog the location of every identifiable place mentioned in the Protestant Bible. It draws from over seventy modern sources (mostly Bible commentaries, dictionaries, encyclopedias, and atlases), with over 400 unique sources cited." — [readme](https://github.com/openbibleinfo/Bible-Geocoding-Data/blob/main/readme.md)
- Files and sizes, measured: `ancient.jsonl` has 1,341 ancient places (11.6 MB); `modern.jsonl` 3.2 MB; `geometry.jsonl` 156 KB plus thousands of GeoJSON/KML files; `image.jsonl` has 2,423 image records (1.5 MB); `source.jsonl` 226 KB; `all.kml` 4.2 MB. A separate `thumbnails.zip` (180 MB) holds "512x512 thumbnail images for every location." — repo contents via GitHub API; [readme](https://github.com/openbibleinfo/Bible-Geocoding-Data/blob/main/readme.md)
- Confidence model: each identification has vote tags (confidence_yes, likely, possible, unlikely, no; authority_traditional, scholar, usually, and others) and a weighted score. "An overall total of 500 or higher represents high confidence." Time-weighted `time_values` run over six periods, from 1969-and-before to 2010-and-after, and are "best viewed as a fraction of 1000." — [readme](https://github.com/openbibleinfo/Bible-Geocoding-Data/blob/main/readme.md)
- Measured spread over the 1,341 places, by best identification `time_total`: 876 score ≥500 (high), 459 score 100–499, and 7 score below 100. — local analysis of `ancient.jsonl`
- Image licences in `image.jsonl`, measured: 636 "sentinel" (Copernicus Sentinel-2 satellite, credited "Contains modified Copernicus Sentinel data 2019"); 420 CC-BY-SA-4.0; 351 CC-BY-SA-3.0; **300 "copyright"**; 164 PD; 135 CC-BY-3.0; 101 GFDL; 68 CC-BY-2.5; 59 CC-BY-2.0; 43 CC-BY-SA-2.0; 42 "attribution"; 41 CC-BY-4.0; 35 CC-Zero; plus small numbers of FAL, GPL, OGL. The 300 "copyright" records are Google Street View links, not files. — local analysis of `image.jsonl`. The readme confirms: "`google` generally has a Google Streetview image … Only `thumbnail` has a file as part of this project." — [readme](https://github.com/openbibleinfo/Bible-Geocoding-Data/blob/main/readme.md)
- Of the thumbnails, "About 5/8 of locations have a photo taken by a person (from Wikimedia Commons), with the remaining having a 10-meter-per-pixel satellite photo." Each carries `credit` and `credit_url`, and some carry `quality: "low"`. — [readme](https://github.com/openbibleinfo/Bible-Geocoding-Data/blob/main/readme.md)
- Maintenance: the last push to the repo was 2021-11-01. It is a stable snapshot, not actively updated. — GitHub API `pushed_at`

**Bible Aquifer map sets** (github.com/BibleAquifer)
- **Biblica Open Bible Maps** (`BiblicaOpenBibleMaps`). The README and `eng/metadata.json` `license_info` say: "Biblica Open Bible Maps, © 2023–2025 Biblica, Inc. This work is licensed under Creative Commons Attribution-ShareAlike 4.0 International." Commercial use is allowed, with attribution and SA. — [README](https://github.com/BibleAquifer/BiblicaOpenBibleMaps)
- Measured: 540 English PNG maps (291 OT, 249 NT), about 1.08 GB in total (roughly 2 MB each). Localisations: ind, rus, zhs, zht. Each map's JSON carries passage associations in USFM ranges (for example "The Life of Jesus: The Birth of Jesus" maps to MAT 2:1–23 and LUK 2:1–52), plus machine-matched ACAI entity tags with confidence scores (around 0.3–0.6). `review_level` is "None". The last push was 2026-09-18. — repo tree and sample `eng/json/010.content.json` via GitHub API
- **FIA Maps** (`FIAMaps`). README: "© 2025 Biblica … licensed under the CC BY-SA 4.0 license … © 2025 Word Collective Released under CC BY-SA 4.0 license." The Aquifer inventory lists 76 English maps and cites "Biblica Inc., 2023". The holder and year differ between the README and the inventory. Map images are hot-linked from `s3.amazonaws.com/cbbt-er.public/...` rather than stored in the repo, so they would have to be downloaded to bundle. — [FIAMaps README](https://github.com/BibleAquifer/FIAMaps), [Aquifer full inventory](https://github.com/BibleAquifer/docs/blob/main/aquifer_full_inventory.md)
- The Aquifer org has no LICENSE file in these content repos; GitHub SPDX shows "none". The licence is stated only in each README and in `metadata.json`. — GitHub API org repo listing

**Other open Bible map sets** (Door43 / unfoldingWord ecosystem)
- `WycliffeAssociates/en_map` ("Maps of the Bible": Abraham_Journey, Exodus_with_ancient_roads, Israel_Divided_kingdom, and others). Its LICENSE text is the CC BY-SA 4.0 human-readable summary. The last update was 2025-08-29. The original artist or creator is not identified in what I read. — [git.door43.org/WycliffeAssociates/en_map](https://git.door43.org/WycliffeAssociates/en_map)
- `BSA/en_biblemap`: LICENSE is CC BY-SA 4.0, and `manifest.yaml` says "creator: OBT Group", "publisher: bsa", "rights: CC BY-SA 4.0". Last update 2025-08-29. — [git.door43.org/BSA/en_biblemap](https://git.door43.org/BSA/en_biblemap)
- `BurritoTruck/en_fiamaps` (FIA Maps repackaged) also exists on Door43. — Door43 repo search API

**Basemaps for offline iOS**
- Natural Earth terms: "All versions of Natural Earth raster + vector map data found on this website are in the public domain." It "invites you to use them for personal, educational, and commercial purposes." "No permission is needed to use Natural Earth. Crediting the authors is unnecessary." — [Natural Earth terms of use](https://www.naturalearthdata.com/about/terms-of-use/)
- OpenStreetMap: "You are free to copy, distribute, transmit and adapt our data, as long as you credit OpenStreetMap and its contributors." Users must "make clear that the data is available under the Open Database License," and "If you alter or build upon our data, you may distribute the result only under the same license." Attribution rules differ for browsable maps and static images. — [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright)
- Theographic's map bibliography also lists Ancient World Mapping Center, Digital Atlas of the Roman Empire (DARE) and klokantech/roman-empire vector tiles as sources. Those sources' licences were not checked. — [Theographic data-source-bibliography](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/data-source-bibliography.md)

### Inferences
- For Yada, a typographic place line under the passage guide ("Bethel — about 18 km north of Jerusalem; location confident") can come straight from OpenBible's coordinates and score, with no basemap. The vote tags support honest hedging ("location uncertain; scholars differ"). That fits rule 4: state only what the data contains.
- Natural Earth is the safest offline basemap: public domain, small, no attribution UI needed. It gives coastlines, rivers and lakes, which is enough for Bible-scale maps. OSM detail would force ODbL attribution and share-alike on any derived database Yada ships. It is not worth that cost at Bible-map scale.
- Biblica Open Bible Maps are commercially usable, but at about 1 GB of PNGs they do not fit offline-first as a bundle. A curated subset, or on-demand download with caching, would be needed. They are also artistic, finished maps, which may clash with a typography-led look. They need a per-map visual review.
- Never ship OpenBible's `google` Street View items. Ship only `thumbnail` files whose per-image licence is CC0, PD, CC BY or CC BY-SA, each with its credit line.

### Gaps
- I did not read the Google Doc linked from Biblica Open Bible Maps "More Information", which may carry attribution specifics.
- The copyright holder and year for FIA Maps are inconsistent between README and inventory (Biblica 2025, Word Collective 2025, Biblica 2023); the CC BY-SA licence is consistent.
- I did not verify a public-domain historical Bible atlas (for example 19th-century Smith or Kiepert plates on Wikimedia Commons). Each file's status would need checking.
- I did not fetch the OSM tile usage policy. That bulk-downloading tiles from openstreetmap.org servers for offline use is prohibited is UNVERIFIED in this session; self-hosted extracts (for example Protomaps) would avoid it.
- SIL map resources: I found no SIL-published open map set beyond the Door43 repos above. UNVERIFIED.

---

## Images and illustrations

### Takeaway
The commercial-safe options are UBS Images (CC0 or CC BY-SA 4.0, mixed per item), FIA Images (CC BY-SA 4.0), Sweet Publishing illustrations (CC BY-SA 3.0, also used in unfoldingWord Open Bible Stories), and individually checked Wikimedia Commons public-domain art. Most other FreeBibleimages sets are non-commercial or no-derivatives and must be excluded.

### Cited Findings
- **UBS Images** (`BibleAquifer/UBSImages`). The README headline says "licensed under the Public Domain CC0 license," but continues: "Released under various: Public Domain CC0, CC BY-SA 4.0 license." `metadata.json` `license_info.licenses` lists both CC0 and CC BY-SA 4.0. Holder: United Bible Societies, with no copyright date. The Aquifer inventory counts 1,054 English items (885 French, 884 Portuguese) across 18 language folders. Images are served from `cdn.aquifer.bible`, not stored in the repo; the repo holds JSON, Markdown and per-item PDFs. Sample items: "Fisherman casting net", with no passage associations. Last push 2026-09-19. — [UBSImages README](https://github.com/BibleAquifer/UBSImages), [inventory](https://github.com/BibleAquifer/docs/blob/main/aquifer_full_inventory.md)
- **FIA Images** (`BibleAquifer/FIAImages`). README: "© 2025 Word Collective … licensed under the CC BY-SA 4.0 license." The inventory cites "SRV Partners, 2023" and 793 English items. — [FIAImages README](https://github.com/BibleAquifer/FIAImages), [inventory](https://github.com/BibleAquifer/docs/blob/main/aquifer_full_inventory.md)
- **Sweet Publishing on FreeBibleimages**, set page wording: "The original illustrations are the copyright of Sweet Publishing … made available for free download under a Creative Commons Attribution-ShareAlike 3.0 Unported license." Attribution goes to "Sweet Publishing / FreeBibleimages.org". The sidebar says "The licence allows for commercial use." — [FreeBibleimages, Jacob's wedding set](https://www.freebibleimages.org/illustrations/jacob-wedding/)
- **unfoldingWord Open Bible Stories** LICENSE.md: "All images used in these stories are © Sweet Publishing … made available under a Creative Commons Attribution-Share Alike License (https://creativecommons.org/licenses/by-sa/3.0)." The OBS text is CC BY-SA 4.0, and "if you modify … you must remove the unfoldingWord® trademark." — [git.door43.org/unfoldingWord/en_obs LICENSE.md](https://git.door43.org/unfoldingWord/en_obs)
- **FreeBibleimages, other sets**: "Most however, use a Creative Commons license that allows reuse … providing they are not commercially sold or money gained from their use." "Some use a Creative Commons license that states 'no derivatives'." "You will need the permission of the copyright holder in writing to use any of their images in any media intended for sale." LUMO photographs "cannot be reused in video or film." "All our 'Terms of Download' forbid anyone posting any of our full sets of images on any other web site or media." — [FreeBibleimages reuse help](https://www.freebibleimages.org/help/reuse/). The About page says only that resources are "free for educational and personal use." — [About](https://www.freebibleimages.org/about/)
- **Wikimedia Commons**: reusers should "Confirm that the file is available under license terms that suit you," and the Foundation "does not provide any warranty regarding the copyright status." — [Commons: Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
- **PD-Art (photographs of public-domain paintings)**: the Commons page says the UK Court of Appeal in THJ v Sheridan (Nov 2023) clarified that "no new copyright is created in making a photographic reproduction of a public domain artwork". That matters for Creotok LTD (England & Wales). Nordic countries, Spain (pre-2001 "mere photographs") and others still differ. — [Commons: Reuse of PD-Art photographs](https://commons.wikimedia.org/wiki/Commons:Reuse_of_PD-Art_photographs)

### Inferences
- UBS Images' mixed CC0/BY-SA labelling has no per-item licence field in the content JSON I sampled. The safe reading is to treat the whole set as CC BY-SA 4.0, with attribution to United Bible Societies, unless per-item CC0 can be confirmed.
- Sweet Publishing art is cartoon-style narrative illustration. It is commercial-safe, but at odds with Yada's "typography-led, no decorative visuals" stance. It fits a story mode better than the passage guide.
- For Yada's reader, the most useful images are realia and place photos: UBS Images for objects, OpenBible thumbnails for sites. These explain unfamiliar things ("threshing floor", "cistern") rather than decorate. Public-domain fine art from Commons (Rembrandt, Doré) could be added one file at a time, with each licence checked.
- Exclude all FreeBibleimages sets other than Sweet Publishing unless a set's own Terms of Download explicitly allow commercial use and derivatives. Exclude LUMO entirely.

### Gaps
- I did not find the exact CC version used across all Sweet Publishing sets on FreeBibleimages; I checked one set (3.0 Unported). IMS/SIL's distribution terms mention BY-SA without a version (search snippet only, UNVERIFIED).
- The per-item licence split in UBS Images is UNVERIFIED.
- I did not count files or measure total size for UBS and FIA images on the CDN.

---

## Timelines and chronology

### Takeaway
Theographic `events.json` (450 events, CC BY-SA 4.0) is the only substantial open, machine-readable biblical event dataset found. It follows a single conservative Ussher-style chronology (creation = 4004 BC, after Floyd Nolen Jones), and it has almost no flags for contested dates. Any Yada timeline built on it would need its own "dates disputed" layer, written by hand and reviewed by John.

### Cited Findings
- Theographic event fields include `startDate` (Incomplete), `duration`, `lag`/`lagType` (SS or FS relative to a predecessor event), `rangeFlag` ("If rangeFlag is true, it means that the year is an approximation and not an exact date"), `notes`, and `sortKey`. — [json-fields-documentation.md](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/json-fields-documentation.md)
- Measured: 450 events, all with `startDate`. Only 6 have `rangeFlag: true`. 88 have predecessor lag relations (59 FS, 29 SS). The first event is "Creation of all things", startDate "-4003". Notes are sparse but sometimes reasoned (for example on Shem's birth order from Gen 11:12). The latest event `modified` is 2025-08-21. — local analysis of `json/events.json`
- Year convention: the February 2026 commit "Fix ISO 8601 year examples: -4003 = 4004 BC (not 4003 BC)" uses ISO astronomical numbering, where 0 = 1 BC. — repo commit history (GitHub API)
- Chronology source: "Periods: Jones, Floyd Nolen. *The Chronology of the Old Testament: A Return to the Basics* … (2019)". "Dates in the Book of Acts are Based on timelines obtained from Todd Atwood, ThM." — [data-source-bibliography.md](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/data-source-bibliography.md)
- Book `yearWritten` is "Currently in unusable format as of 2026/01/05, but undergoing a fix." — [json-fields-documentation.md](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/json-fields-documentation.md)
- A GitHub search for "bible timeline" and "biblical chronology" turned up only small or unlicensed projects. Examples: lifegems/bible-timeline (NOASSERTION, 2016); FrankHubeny/BiblicalChronology (MIT, Hebrew kings only, 2024); CybLight/Biblical_Chronology (Apache-2.0, an interactive app, not a dataset); GeiserX/biblical-atlas-mcp (MIT, Oct 2026, provenance unchecked). — GitHub search API

### Inferences
- Theographic dates encode one young-earth, Ussher-type scheme, with exact years for patriarchs. Presenting them bare would breach the spirit of rule 4: it would state precision the scholarship does not support. A usable Yada approach: relative order only ("after the exile", "during Solomon's reign"), from Theographic's lag graph and verse order, plus a few hand-reviewed anchor dates with ranges (for example, fall of Jerusalem 587/586 BC).
- If any Theographic dates ship, they must carry a visible "one traditional chronology" note.

### Gaps
- I found no open dataset that records alternative chronologies, such as early versus late Exodus or Thiele versus other kings' dates, with per-event dispute flags.
- Wikidata (CC0 per its licensing page) has start and end dates for some biblical events and people. UNVERIFIED: I did not fetch the page or measure coverage in this session.

---

## People, places and genealogy

### Takeaway
Three open, commercial-use sources exist. Theographic (CC BY-SA 4.0: 3,067 people, 1,274 places, with family links) is confirmed. STEPBible TIPNR (CC BY 4.0: about 4,255 named individuals, places and other entities, with disambiguated Strong's and exhaustive references) is updated almost daily, but its short descriptions are AI-generated and its header adds a "please do not redistribute" request. Aquifer ACAI (CC BY-SA 4.0) is word-level entity annotation built from all of these. All three have disambiguation that is unfinished or partly machine-made.

### Cited Findings

**Theographic Bible Metadata** (robertrouse/theographic-bible-metadata)
- LICENSE file: the full "Attribution-ShareAlike 4.0 International" legal code. The readme says: "This work is free to use and copy under a Creative Commons Attribution Share-Alike 4.0 License." GitHub SPDX gives `CC-BY-SA-4.0`. The reported licence is **confirmed**. — [LICENSE](https://github.com/robertrouse/theographic-bible-metadata/blob/master/LICENSE), [readme](https://github.com/robertrouse/theographic-bible-metadata)
- Files, measured: `people.json` 3,067 records (5.1 MB); `places.json` 1,274 (2.4 MB); `events.json` 450 (1.7 MB); `peopleGroups.json` 44 KB; `easton.json` 6.2 MB (Easton's Bible Dictionary); `verses.json` 37 MB (KJV 1769). There are also CSV, Neo4j and GraphQL API formats. The last push was 2026-04-21; the person records were last modified 2026-01-05. — GitHub API, local analysis
- Quality, measured: `status` is "publish" for only 286 of 3,067 people (the rest "wip") and 171 of 1,274 places. 1,613 people are `ambiguous: true`, which the docs define as "display titles which have not been edited for disambiguation". 459 names are shared by more than one person (Zechariah 26, Shemaiah 26, Azariah 21, Maaseiah 21, Meshullam 20). Only 75 people have a `birthYear`. Of places, 1,252 have coordinates, with `precision` mostly unset (732) or "Rough" (348); Recogito links are 997 UNVERIFIED and 181 VERIFIED. — local analysis; [field docs](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/json-fields-documentation.md)
- The `Disambiguation (temp)` field is described as "Mechanical Turk entries used to aid in disambiguation". Each person has a stable `personID`/`personLookup` (for example `aaron_1`) and `displayTitle`. — [field docs](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/json-fields-documentation.md)
- **Provenance flag**: Theographic's bibliography lists its people source as "TIPNR … TyndaleHouse.com STEPBible.org **CC BY-NC**". That is an earlier TIPNR licence, NC. Other cited sources are Marshall Genealogy and complete-bible-genealogy.com, websites of unknown licence. Place names come from "Rand McNally Bible Atlas (1962)" and "Holman Bible Atlas (1998)". — [data-source-bibliography.md](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/data-source-bibliography.md)
- The `esvName` place field is "from OpenBible.info/geo". People `dictionaryText` is Easton's (1897, public domain). — [field docs](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/json-fields-documentation.md)

**STEPBible TIPNR** (STEPBible/STEPBible-Data, `Proper Nouns/TIPNR … CC BY.txt`, 8.2 MB)
- The repo README headline is "**CC BY 4.0**". It allows you to "Include any part of STEPBible-Data in any software or publications without requesting permission" and to "Credit it to 'STEP Bible' linked to www.STEPBible.org". GitHub detects no SPDX licence. — [STEPBible-Data README](https://github.com/STEPBible/STEPBible-Data)
- The file header: "Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0)". It then says "Download the data and reformat it for your application, without changing the data," "(You MAY make changes yourself, but you should include a note of changes…)", and "Refer others to github.com/STEPBible as the source of the data. **Please do not redistribute it yourself.**" — TIPNR file header, lines 12–20
- Content: "Proper Nouns in the ESV (+ differences in KJV & NIV) with unique tag for each individual and location." It has every Hebrew and Greek form, disambiguated Strong's, parents, siblings, partners, offspring, tribe, and exhaustive references. Places carry "geolocation (based on OpenBible)". Measured: 4,255 unified-name records (people, places and other). — TIPNR header; [README](https://github.com/STEPBible/STEPBible-Data); local count
- Disambiguation markers: "(?) indicates a decision based on an ambiguity" (259 occurrences measured). The policy reads: "Decisions are based on maximum links, minimum anonymous individuals, and maximum coherence with the Hebrew text, in that order." — TIPNR header
- **AI-gen**: "@Brief=… @Short=… @Article= description … Adapted from the output by Claude 3 Opus AI in April 2024." — TIPNR header, lines 96–98
- Maintenance: the Proper Nouns folder had commits on 2026-10-10. It is actively maintained. — GitHub API

**Aquifer ACAI** (BibleAquifer/ACAI, release 2025-07-23)
- README: "This release of the ACAI data … is under a Creative Commons CC-BY-SA 4.0 license … Copyright 2025 Mission Mutual." LICENSE.md is the CC BY-SA 4.0 summary. — [ACAI README](https://github.com/BibleAquifer/ACAI)
- Content: people, places, deities, groups, fauna, flora, realia and keyterms. It annotates original-language words, with `primary_id` for alias forms (Abram maps to Abraham) and curated `description`s. Sources include Macula Hebrew and Greek, UBS dictionaries, OpenBible geocoding, Theographic and TIPNR. References use the Copenhagen Alliance "ORG" versification. — [ACAI README](https://github.com/BibleAquifer/ACAI)
- **Flag**: "United Bible Societies' Key Term data from Paratext. This is used by permission." That component's permission may not pass to downstream users. — [ACAI README](https://github.com/BibleAquifer/ACAI)

### Inferences
- For a lay reader, the best payoff is a single "who is this?" line beside the passage: "Zechariah — son of Jehoiada, a priest (2 Chr 24)", not "one of 29 Zechariahs". TIPNR's verse-anchored unique IDs (`Name@FirstRef`) give the most precise disambiguation for that. Theographic's family graph supports "father of / son of" links.
- Licence ranking for Yada: TIPNR (CC BY, no SA) is the most permissive. But the header's "without changing the data / do not redistribute" requests sit uneasily with CC BY 4.0's "no additional restrictions". Yada should bundle a reformatted copy with a change note and STEPBible credit, and ideally email STEPBible, as the header invites. Theographic and ACAI impose SA on any edited derivative data Yada ships.
- TIPNR's Brief, Short and Article prose is Claude-generated, so under Yada's rules it cannot appear as reviewed content. Use only its structured fields (names, references, relations, Strong's), or ship the prose as `flagged`.
- Theographic's people layer descends partly from an NC-licensed TIPNR and from websites of unknown licence. The CC BY-SA relicensing is the author's claim; the licence chain is not clean. Taking people and relationship data from TIPNR (now CC BY 4.0) directly is the safer route.
- Fields with ESV or NIV names (TIPNR translated names, Theographic `esvName`) should stay out of every AI call under rule 9. Use KJV and BSB names instead.

### Gaps
- I could not establish when TIPNR moved from CC BY-NC to CC BY 4.0, or whether Theographic re-derived its data after that.
- I did not count ACAI records per type, and did not check whether ACAI's descriptions are human- or AI-written.
- The OpenBible people dataset: none found. OpenBible covers places only.
