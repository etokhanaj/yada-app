# ERV and The Message: licence terms for Yada

Read 11 Oct 2026. Quotes are short and exact, from the rights holder's own pages unless marked
otherwise. Anything not read from an official page is marked UNVERIFIED.

## Easy-to-Read Version (ERV), © Bible League International

Source: Bible League International, License Agreement, https://www.bibleleague.org/license-agreement
("Last Updated: July, 2015"). Plain `curl` gets a Cloudflare 403 from bibleleague.org; the page was
read through a normal fetch, and the block was not worked around.

- "Are not public domain." "May not be altered or modified in any form."
- "May not be sold or offered for sale in any form." "May not be used for commercial purposes".
- "May be distributed without modification in electronic form for non-commercial use." But "they may
  not be hosted on any kind of server (including a web or ftp server) without written permission."
  "A copy of this license (without modification) must also be included."
- Quotation: "May be quoted for any purpose, up to 1,000 verses, without written permission." Not a
  complete book, and not "more than 50% of the work in which it is quoted."
- Credit line: "Taken from the HOLY BIBLE: EASY-TO-READ VERSION ©2014 by Bible League International.
  Used by permission."
- "Any use of these Scriptures other than those listed above is prohibited." Further rights: "contact
  Bible League International using the contact form link" on bibleleague.org. The email on the page is
  hidden behind Cloudflare obfuscation. Postal: 3801 Eagle Nest Drive, Crete, IL 60417, USA.
- The apps page (https://www.bibleleague.org/apps/) sends anyone using the texts "outside of an app for
  printing or digital ministry" to the same License Agreement. It does not mention audio, TTS or AI.

Open versions: none found. The licence says the texts are not public domain, and no CC release is
offered. The eBible.org copy (https://ebible.org/engerv/copyright.htm, a mirror, not the rights
holder) carries "© 1987, 1999, 2006" and the same 1,000-verse terms, with no CC licence. Older
editions are still in copyright.

Distribution channels:
- API.Bible catalogue (https://api.bible/bibles, rendered 11 Oct 2026): searches for "ERV" and
  "Bible League" return "No results." Not on any plan. Yada's account (40 English Bibles) has no ERV or
  MSG, confirmed by the `/bibles?language=eng` endpoint.
- YouVersion Platform (https://platform.youversion.com/bibles, 11 Oct 2026): Bible League
  International publishes one Bible there, the Arabic "Easy-to-Read Translation (SAT)". English ERV is
  not on the Platform.
- Bible Brain (Faith Comes By Hearing) and the Digital Bible Library: UNVERIFIED. No official listing
  of English ERV was found.

## The Message (MSG), © Eugene H. Peterson, NavPress, represented by Tyndale

Source: NavPress, Permissions and Fair-Use Guidelines, https://navpress.com/permissions

- "The text of The Message may be quoted in print or eBook form, up to and inclusive of 500 verses"
  without written permission, if the verses "do not account for more than 25 percent of the work" and
  "a complete book of the Bible is not quoted."
- Apps, software and websites are not named. Online or audio: "If you wish to use The Message for any
  online/audio production, please fill out our" Permissions Questionnaire (/permissions/form).
- Fees: projects for sale outside fair-use limits "may be accompanied by a fee", set by amount, distribution
  and commercial or non-commercial use.
- Text must be quoted "accurately, including punctuation, capitalization, italics". Permission covers
  only the use requested and is not transferable.
- Credit line: "All Scripture quotations are taken from The Message, copyright © 1993, 2002, 2018 by
  Eugene H. Peterson. Used by permission of NavPress. All rights reserved. Represented by Tyndale House
  Publishers."
- Contact: permission@tyndale.com, or the questionnaire. The page asks you not to phone.
- No free programme for ministries or apps, and nothing on TTS or AI.

Open versions: none. All editions (1993, 2002, 2018) are in copyright.

Distribution channels:
- API.Bible catalogue: "The Message (MSG)", Tyndale House Publishers, English, "Standard License".
  API.Bible's homepage says the free Starter plan gives "Up to 3 licensed Bibles", "Noncommercial use."
  The Bibles page says Standard License Bibles "are available with a paid plan". The two pages conflict.
  Yada's three Starter slots are taken by NIV, NKJV and NLT, so MSG would replace one of them or need Pro.
  The API.Bible terms already in `docs/licensed-translations.md` apply: offline cache refreshed every 30
  days, no AI training (§9.2), non-commercial on Starter.
- YouVersion Platform: no Tyndale or NavPress Bibles listed.

## Verdicts

- **ERV: not available to apps without a direct licence.** It is free to quote up to 1,000 verses, but
  the licence bars commercial use and server hosting without written permission. It is on neither
  API.Bible nor the YouVersion Platform. Offline in-app use, TTS and AI are not granted, so assume all
  three need written permission. Under Yada rule 9 it could never enter AI calls in any case.
- **MSG: paid or permissioned licence only.** For the app the realistic route is API.Bible (Standard
  License, display-only, non-commercial on Starter, Pro or a Tyndale licence once Yada charges). A
  direct licence goes through Tyndale's questionnaire and may carry a fee. TTS ("audio production")
  needs permission. AI is barred by API.Bible §9.2 and by Yada rule 9.
- Neither text is open source or openly licensed.

## What a permission request should include

Name the entity (Creotok LTD, England & Wales) and the app. Give the platform (iOS, offline-first),
whether the full text is bundled on device or fetched, and whether it is shown in full or as quotations.
Say whether Yada is free now and may charge later (subscriptions or in-app purchases), and give expected
users or downloads. Ask about TTS read-aloud, and say the text will not be altered and will not be used
with AI. Include the attribution and credit-line placement and any server hosting (for ERV, the licence
explicitly requires written permission for that). For Tyndale, the questionnaire also asks for product
types, prices, five-year unit sales and the share of content that is MSG.
