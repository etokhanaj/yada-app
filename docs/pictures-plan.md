# The day's pictures: sources and how they scale (15 Oct 2026)

John, 15 Oct 2026: "pick the best"; "your images dont feel like they are that colorful style the bible app has";
"would these sources for images be scalable long term? also maybe you want to have unsplash as a backup".

## How many we need

The psalter repeats every month, so the set is **30 morning and 30 evening pictures, 60 in all**, reused each month.
A new set each year is 60 more, not 365. Earlier days (DR-19) uses the same set.

## Sources, in order

| Order | Source | Licence | Supply | Use for |
|---|---|---|---|---|
| 1 | **US government photography:** National Park Service, US Fish & Wildlife Service, NOAA, NASA (mostly via their Flickr accounts and Wikimedia Commons records) | Public domain as US government works. **Check each file:** some are by outside photographers and are not public domain | hundreds of thousands of nature photos: water, trees, mountains, skies, storms, deserts, the moon and stars | most days; the psalms' pictures are mostly nature |
| 2 | **Unsplash** (backup) | [Unsplash License](https://unsplash.com/license): free to use, attribution not required. Two limits: no selling unaltered copies, and no compiling photos into a similar or competing service. We pick photos by hand on the site, download them and keep them on R2. The API's hotlinking rule applies only when the API is used, and we won't use it | very large; strong on atmosphere and colour | gaps: subjects the US archives lack (vines, olive trees, sheep and shepherds, the sea at dawn) |
| 3 | **Pexels** (second backup) | [Pexels License](https://www.pexels.com/license/): similar terms | large | the same gaps |
| — | Not used | Unsplash+ (paid), anything with recognisable people, AI-generated images, anything whose licence isn't read from the source (rule 3) | | |

## The same look for every picture

The YouVersion feel comes from one colour treatment more than from any one source.
`.claude/skills/design/scripts/grade_picture.py` applies the treatment to every picture:
- a 3:4 portrait crop around the subject;
- a warm grade for the morning and a cool one for the evening;
- a little more colour.

The layout adds the soft fade where the verse sits. Day 1 is drawn this way:
- **Morning, Psalm 1:3:** *Morning fog over the Yellowstone River*, NPS / Jacob W. Frank.
- **Evening, Psalm 8:3:** *Moon over Little Bear Peak*, NPS / Patrick Myers.

## The pipeline (scales without hand work)

1. A pictures manifest (`content/pictures/manifest.json`), with one entry per day and part. Each entry holds the
   verse it shows, the source URL, the title, the photographer, the licence as read from the source, and the sha256
   of the original and of the graded file.
2. `grade_picture.py` makes the 1200 × 1600 graded file, plus a smaller one for the widget.
3. John approves each picture and its verse in the review queue (`packages/review`), as he does the debates. A
   rejected picture is replaced; nothing ships unapproved.
4. Publishing to R2 is John's step. The app downloads a week ahead, so the pictures work offline and no third party
   sees the reader.
5. Credits are not shown on the picture. They live in ⋯ › About this picture and in Sources and licences.

## Long term

- Sixty pictures a year is an afternoon's choosing plus John's review, so this scales.
- If Yada wants a signature look later, one commissioned photographer could shoot a set of 60 that Yada owns
  outright. The manifest and treatment stay the same.
