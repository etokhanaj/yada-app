# The daily devotional: plan (15 Oct 2026)

John, 15 Oct 2026: "for devotional, we can plan it as well using a devotional online that's highly trusted, this is
different from verse of the day".

Today now holds three different things:
- **the day's verse:** a line from the day's psalms, on the day's picture (DR-11, DR-16);
- **the day's reading:** the psalms, morning and evening (the lead card);
- **the devotional:** someone's short reflection for the date, read after Scripture. This plan covers it.

## Candidates

| Devotional | Trust and reach | Licence for a free app | Fit |
|---|---|---|---|
| **Our Daily Bread** (Our Daily Bread Ministries) | the most widely read daily devotional; non-denominational; short, plain, one passage a day | © ODB. Reprints and "non-profit print and electronic" rights by written request to the Permissions Department ([rights and permissions](https://ourdailybread.org/rights-and-permissions/)) | **Best fit for "highly trusted, online".** Needs a written licence before it ships |
| **Tabletalk** daily study (Ligonier) | trusted; Reformed | © Ligonier. Full articles "may not be re-posted in full on another website without permission"; no changes, no commercial use ([copyright policy](https://www.ligonier.org/copyright-policy)) | narrower audience; needs permission |
| **Solid Joys** (Desiring God, John Piper) | trusted; Reformed | Piper's text may be used freely for non-commercial purposes in **quotes and excerpts only**; whole works need permission ([permissions](https://desiringgod.org/permissions); the page refused a direct fetch, so this is from the search summary and has to be read in full before use) | narrower; needs permission for whole entries |
| **Morning and Evening** (C. H. Spurgeon, 1865–69) | a classic, read for 150 years | public domain (Spurgeon died in 1892) | a morning and an evening entry for every date; already drawn (DR-13) |
| **Daily Light on the Daily Path** (Bagster, about 1875) | a classic; no commentary, only Scripture grouped by theme ([CCEL](https://ccel.org/ccel/anonymous/daily_light)) | the 1875 KJV edition is public domain; later editions in other versions are not ([Wikipedia](https://en.wikipedia.org/wiki/Daily_Light_on_the_Daily_Path)) | Scripture only, so it can be shown in the reader's own translation from its references, and it takes no side |

## Recommendation

1. **Ask Our Daily Bread for a licence now.** It is the most trusted and widely read, it is not tied to one tradition,
   and Yada is free and non-commercial, which is the case their non-profit electronic rights cover. The request is
   drafted below for John to send from his own email. Nothing is sent for him.
2. **Ship with Spurgeon's *Morning and Evening*** (public domain, already drawn) until a licence is granted. Add
   *Daily Light* as the second choice for readers who want Scripture only.
3. **Settings › Devotional:** Spurgeon · Daily Light · Our Daily Bread (only once licensed) · Off. The card on Today
   names the devotional ("Our Daily Bread", "Spurgeon", "Daily Light").

## Rules for any licensed devotional

These are the same rules as for licensed translations (rule 9 and `docs/licensed-translations.md`).
- Display only: never in the content pipeline, prompts, grounding, evaluation or any AI call.
- Shown unchanged, with the publisher's exact credit line and a link to the source page.
- Stored only as the licence allows. If the licence asks for fetch-on-read, it goes through the Worker like API.Bible,
  and its key stays on the Worker.
- Never in notifications, widgets, Siri or share images, unless the licence says so.
- Removed from the phone if the licence ends.

## Rules for the public-domain ones

- Read from a pinned copy with a sha256 (CCEL or a scanned 1875 printing), recorded in `sources.manifest.json`, with
  the licence read from the source (rule 3).
- Spurgeon goes through a sampled review in `packages/review` first, as the debates did. An entry John rejects is
  skipped for its date.
- Daily Light's references are taken exactly as printed. The text shown is the reader's translation of those
  references (BSB by default), never a re-worded line.

## Draft permission request (John sends it; not sent)

> To: permissionsdept@odb.org
> Subject: Permission request: Our Daily Bread in Yada, a free Bible app (non-commercial)
>
> Hello,
>
> I'm John Etokhana of Creotok LTD (England and Wales). We make Yada, a free iOS Bible reading app with no ads, no
> subscription and no accounts. We'd like to offer Our Daily Bread as an optional daily devotional inside the app.
>
> What we're asking for: non-profit electronic rights to show each day's Our Daily Bread devotional in full, unchanged,
> with your credit line and a link to ourdailybread.org, to readers who choose it in Settings.
>
> How it would work: shown only on the day, never altered, never sold or behind a paywall, never used to train or
> prompt any AI system, and removed if the permission ends. If you provide a feed or API, we'd use that on your terms.
>
> Could you tell us whether this is possible, and on what terms?
>
> Thank you,
> John Etokhana
> creotok@gmail.com
