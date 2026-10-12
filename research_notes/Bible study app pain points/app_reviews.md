# Bible app user reviews: pain points and praise (App Store, 2023–Oct 2026)

**Method (read first).** On 2026-10-10 I pulled the public Apple RSS review feed (`https://itunes.apple.com/us/rss/customerreviews/page=N/id=APPID/sortby=mostrecent/json`, up to 500 most recent reviews per app, US storefront) for 13 apps, plus a "most helpful" pull (US/UK/CA/AU) for YouVersion and Logos. That's about 4,650 recent reviews and 3,400 helpful-sorted ones. I tagged reviews with crude keyword regexes. The counts show which themes are big; they are not exact. The "translations" tag over-matches ("version"). Google Play was **not** scraped (no API access); its themes come only from secondary sources. Window caveat: high-volume apps return only a few days or weeks of reviews (YouVersion 250 reviews = 2 days, 8–9 Oct 2026). Low-volume apps reach back to 2020–2022. Rating average and the window are given per app.

App Store links (ID → page): YouVersion [282935706](https://apps.apple.com/us/app/id282935706), Logos [336400266](https://apps.apple.com/us/app/id336400266), Blue Letter Bible [365547505](https://apps.apple.com/us/app/id365547505), Bible Gateway [506512797](https://apps.apple.com/us/app/id506512797), Dwell [1343917374](https://apps.apple.com/us/app/id1343917374), Olive Tree [332615624](https://apps.apple.com/us/app/id332615624), Accordance [411970514](https://apps.apple.com/us/app/id411970514), ESV Bible (Crossway) [361797273](https://apps.apple.com/us/app/id361797273), BibleProject [1523687027](https://apps.apple.com/us/app/id1523687027), Glorify [1490587079](https://apps.apple.com/us/app/id1490587079), Hallow [1405323394](https://apps.apple.com/us/app/id1405323394), Bible Chat [6448849666](https://apps.apple.com/us/app/id6448849666), Haven – Bible Chat [6503387382](https://apps.apple.com/us/app/id6503387382).

Lifetime App Store ratings (iTunes lookup API, 2026-10-10): YouVersion 4.91 (13.8M), BLB 4.87 (360k), Logos 4.86 (175k), Olive Tree 4.84 (323k), Dwell 4.89 (87k), Accordance 4.81 (13k), **ESV 4.69 (10k)**, BibleProject 4.89 (2.8k), Glorify 4.92 (100k), Hallow 4.89 (379k), Bible Chat 4.92 (365k), Haven 4.88 (149k), **Bible Gateway 3.65 (10k)**. The lifetime scores are inflated by in-app review prompts. The recent-review averages below give a truer picture.

| App | Recent reviews pulled | Window | Avg of recent | Share ≤2★ |
|---|---|---|---|---|
| Bible Gateway | 500 | Jan 2025–Oct 2026 | **1.77** | 79% |
| Haven (AI chat) | 500 | Apr–Oct 2026 | **3.29** | 37% |
| ESV (Crossway) | 500 | Apr 2022–Sep 2026 | 3.64 | 28% |
| Hallow | 500 | Mar–Oct 2026 | 3.95 | 22% |
| Logos | 150 | Aug–Oct 2026 | 3.99 | 21% |
| Accordance | 200 | Nov 2020–Sep 2026 | 4.11 | 20% |
| Dwell | 500 | Jul 2025–Oct 2026 | 4.38 | 12% |
| Glorify | 50 | Aug–Oct 2026 | 4.46 | 10% |
| BibleProject | 250 | Apr 2022–Oct 2026 | 4.56 | 7% |
| Bible Chat (AI) | 250 | Sep–Oct 2026 | 4.74 | 5% |
| Olive Tree | 500 | Jun–Oct 2026 | 4.77 | 4% |
| Blue Letter Bible | 500 | Jul–Oct 2026 | 4.82 | 3% |
| YouVersion | 250 | 8–9 Oct 2026 | 4.95 | 1% |

## Most common complaints, ranked by frequency × severity

### Takeaway
Across the apps, the biggest complaint is **money standing between the reader and the text**: ads before scripture, paywalls on audio or study notes, weekly AI-app subscriptions, and free-trial billing traps. Close behind is **redesigns that move or remove what habitual readers relied on** (history and recents, the Bible tab, reading plans, highlights and notes). Lost data and sync, accounts forced on users, search that can't find verses, small type, and review-prompt nagging follow. AI distrust is real but niche next to price. It shows up mostly in Hallow (Catholic users objecting to AI voices and content) and Haven ("is this AI?", counselling instead of answers).

### Cited Findings

**1. Ads and upsells before the text (very high severity, very high where present)**
- Bible Gateway: 272 of 464 reviews at ≤3★ (59%) mention ads. They describe full-screen and audible ads on launch, fake "virus" or "storage full" ads, close buttons that are hidden or delayed, and ads that stop the Bible text loading. The monthly average stayed between 1.5 and 1.9★ through all of 2025 and almost all of 2026. Quote: "Ads on a bible app is actually insane" (Bible Gateway, App Store, 2026-09-03) — [Bible Gateway App Store](https://apps.apple.com/us/app/id506512797)
- Bible Gateway: paying Plus subscribers also report a blank Bible tab and text that won't open. One 2026-04-01 review says an update wiped two years of highlights and notes. Another says Exodus 3 was missing from the NIV. All paraphrased — [Bible Gateway App Store](https://apps.apple.com/us/app/id506512797)
- Bible Gateway Plus costs $3.99/mo and removes ads. A third-party review analysis names "banner and interstitial ads in chapter view" and commentary paywalled mid-reading as Bible Gateway's main complaint clusters (Unstar, early 2026; methodology undisclosed, treat as low-confidence) — [Bible Gateway support: ads](https://www.biblegateway.com/support/KA-01378); [Unstar ranking](https://unstar.app/blog/youversion-bible-gateway-olive-tree-logos-blue-letter-bible-apps-ranked-2026)
- Olive Tree: complaints that every resource is a separate purchase. Quote: "everything is "purchase, purchase, purchase"" (2026-09-08) — [Olive Tree App Store](https://apps.apple.com/us/app/id332615624)
- Logos v53 (Aug–Sep 2026): reviewers say the bottom bar now opens the store instead of the library, and that "the desktop reader is a marketplace before it's a library" (paraphrased) — [Logos App Store](https://apps.apple.com/us/app/id336400266)
- YouVersion (helpful-sorted, CA/US): long-running complaints that videos, plans and social content crowd out the text, and that search returns plans and videos instead of the verse. Quote: "Each new upgrade has taken the user further from the text" (YouVersion, CA App Store, 2022-07-05) — [YouVersion App Store (CA)](https://apps.apple.com/ca/app/id282935706)

**2. Paywalls on scripture, audio and study helps; subscription billing traps (very high frequency, high severity)**
- Haven: 209 of 238 reviews at ≤3★ (88%) are about price. It costs $6.99 a week after a 7-day trial ("over $300 per year"). Reviewers say the paywall appears right after onboarding, and some report charges after cancelling. Many frame it morally ("why do i have to pay to get closer to god", paraphrased) — [Haven App Store](https://apps.apple.com/us/app/id6503387382)
- Hallow: 96 of 144 reviews at ≤3★ (67%) are about price or billing. They describe annual charges of $70–$190 after a "free" trial, no warning before renewal, cancellation instructions that don't match the app, and support handled by an AI agent. Quote: "Majority of the app is unusable unless you are giving them money." (2026-07-20) — [Hallow App Store](https://apps.apple.com/us/app/id1405323394)
- Bible Chat: complaints that the trial isn't free, there's no in-app cancel, and a paid streak restore. Quote: "charges me $3.99 to keep my streak" (2026-10-07) — [Bible Chat App Store](https://apps.apple.com/us/app/id6448849666)
- Dwell: 53 of 87 reviews at ≤3★ (61%) are about price. Annual plans are quoted at $45–$200, and people object to paying to hear scripture, including a dyslexic reader who bought it in order to listen. Quote: "I have to pay 60$ to listen to the bible." (2026-08-12) — [Dwell App Store](https://apps.apple.com/us/app/id1343917374)
- ESV (Crossway) v5.0, Dec 2023: Kristyn Getty's audio and the study resources moved behind a subscription (about $40/yr cited), and highlighting or bookmarking needed a Crossway account. The quarterly average fell from about 3.4–3.8 to **2.81 (Q4 2023)** and **3.03 (Q1 2024)**, then recovered to about 4.0 by Q4 2024. Quote: "This update is more like a downdate." (2024-01-31) — [ESV App Store](https://apps.apple.com/us/app/id361797273)
- ESV, 2026: "Own nothing, rent everything." Premium books can only be rented through a subscription (2026-06-21, paraphrased title) — [ESV App Store](https://apps.apple.com/us/app/id361797273)
- Glorify: devotional and audio content that used to be free has moved behind a paywall. Quote: "now you have to pay to listen or get some of the good stuff" (2026-10-07) — [Glorify App Store](https://apps.apple.com/us/app/id1490587079)
- Logos subscription backlash: Logos forum users object to subscription costs (some near $250/yr) tied to AI features and a rented library, and say the company moved from "ministry-minded" to business-focused (paraphrased from forum summaries) — [Logos community thread](https://community.logos.com/discussion/comment/1210534); [Logos community thread 2](https://community.logos.com/discussion/comment/1131705)
- Logos App Store (2026-05-27, helpful-sorted): a long-time user calls the move to subscription plus AI a "cash grab" (paraphrased) — [Logos App Store](https://apps.apple.com/us/app/id336400266)

**3. Redesigns that remove familiar paths (high frequency in specific windows, high severity for habitual users)**
- Logos mobile v52 → v53 → v54 (Aug–Oct 2026): average of recent reviews by version is 4.56 → 3.97 → 3.29. Complaints: the Bible tab and Recents were removed, menu actions were merged into one button, AI is on by default, you can't tap a verse to change it in the exegetical guide, and the reading-plan overhaul. Quote: "Recent update now is making harder and not easier to study the bible." (2026-09-12) — [Logos App Store](https://apps.apple.com/us/app/id336400266)
- YouVersion (9 Oct 2026): "Please bring full history functionality back." The new Recents drops history after a few days — [YouVersion App Store](https://apps.apple.com/us/app/id282935706)
- BibleProject: the 2026 update removed notes and the Jan 2026 update required an account to view content, which fails on poor networks. A 2024 homepage redesign broke "continue where you left off" (paraphrased) — [BibleProject App Store](https://apps.apple.com/us/app/id1523687027)
- Blue Letter Bible (Aug–Oct 2026): an audio update forced continuous play and removed the option to repeat a chapter. Listened chapters aren't marked as read — [BLB App Store](https://apps.apple.com/us/app/id365547505)
- Glorify (Sep 2026): stories, prayers, walks and music were removed. One user with a 1,362-day streak lost the content they relied on (paraphrased) — [Glorify App Store](https://apps.apple.com/us/app/id1490587079)
- Accordance: the quarterly average drifts down from about 4.5 (2021) to about 3.25 (Q4 2025, Q3 2026). Long-time users cite growing bugs and a broken curly-quote rendering update (paraphrased) — [Accordance App Store](https://apps.apple.com/us/app/id411970514)

**4. Lost highlights, notes, sync and reading-plan progress (medium frequency, very high severity)**
- Bible Gateway 2026: an update wiped highlights, notes and starred verses. Reading plans reset to day one. Separately, a 2026-05-12 review says several hundred highlights were lost — [Bible Gateway App Store](https://apps.apple.com/us/app/id506512797)
- ESV 2024–25: notes were lost when an account became required, saved scriptures got harder to find, and offline search was removed — [ESV App Store](https://apps.apple.com/us/app/id361797273)
- Olive Tree 2026: sync failing for weeks, devices "never on the same page" (paraphrased). Note that 5★ Olive Tree reviewers praise how reliably it keeps highlights and notes (51 of 448 5★ mention sync, notes or highlights) — [Olive Tree App Store](https://apps.apple.com/us/app/id332615624)
- Accordance 2025: highlights lost on desktop sync — [Accordance App Store](https://apps.apple.com/us/app/id411970514)
- Streak resets: Hallow (May 2026, streaks reset to day 1 after an update, several reviews), Haven, Bible Chat. One YouVersion user's streak reset while they were in hospital (CA, 2024-07-30). A Hallow user suggests "a percentage of days prayed" instead of a streak that drops to zero (paraphrased) — [Hallow App Store](https://apps.apple.com/us/app/id1405323394); [YouVersion App Store (CA)](https://apps.apple.com/ca/app/id282935706)

**5. Sign-in or account required (medium frequency, high severity at first run)**
- ESV v5: an account is required to highlight or bookmark. A blind user couldn't complete Crossway sign-up with VoiceOver (2025-03-10) — [ESV App Store](https://apps.apple.com/us/app/id361797273)
- Accordance: repeated "can't create account" and "can't log in to access paid products" reports (2022–2025) — [Accordance App Store](https://apps.apple.com/us/app/id411970514)
- YouVersion (CA, 2023-10-25): an account is required to download a Bible for offline use, and the download still failed — [YouVersion App Store (CA)](https://apps.apple.com/ca/app/id282935706)
- Hallow: onboarding asks for age, sex, marital status and birth date. One reviewer deleted the app over it (2026-03-12) — [Hallow App Store](https://apps.apple.com/us/app/id1405323394)

**6. Search can't find verses; navigation confusing (medium frequency, medium-high severity)**
- YouVersion (US 2026-07-11, CA 2022–2024): search returns plans and videos instead of the verse, and fails on verbatim phrases. A 2026-02-14 review says there is no onboarding or help on where things are — [YouVersion App Store](https://apps.apple.com/us/app/id282935706)
- ESV: search can't find "Holy, Holy, Holy" (2023-12-27). Jumping to a passage kicks the user to Genesis 1 (2024-06-14) — [ESV App Store](https://apps.apple.com/us/app/id361797273)
- BLB: "search engine has a major problem" finding passages (2026-08-01, paraphrased) — [BLB App Store](https://apps.apple.com/us/app/id365547505)
- Logos: no fuzzy search (a 2017 review updated later). One user took 15 minutes and still couldn't open a Bible (2022-12-27) — [Logos App Store](https://apps.apple.com/us/app/id336400266)
- Olive Tree: getting out of a reading plan and back to the Bible to switch versions is "very confusing compared to other apps" (paraphrased) — [Olive Tree App Store](https://apps.apple.com/us/app/id332615624)

**7. Font size, contrast and readability (low-medium frequency, high severity for older or low-vision readers)**
- ESV is the standout: I found 15+ reviews from 2022–2026 about a maximum font that is too small, light grey text, no Dynamic Type or system setting, few fonts, and fixed margins on iPad. Examples: "small and smaller" (2024-01-01), "pale gray font" (2026-08-25), a visually impaired iPad mini user who needs a magnifier (2025-02-18) — [ESV App Store](https://apps.apple.com/us/app/id361797273)
- Dyslexia: requests for OpenDyslexic (BibleProject 2023), an accessibility barrier for dyslexia (Glorify 2026-09-13), and praise for Olive Tree's cursive font from a dyslexic reader (2026-09-10) — [BibleProject](https://apps.apple.com/us/app/id1523687027); [Glorify](https://apps.apple.com/us/app/id1490587079); [Olive Tree](https://apps.apple.com/us/app/id332615624)
- VoiceOver: ESV "not acceptable for the blind community" (2024-05-15, paraphrased) and sign-up blocked. An AppleVis thread headed "Bible, YouVersion update health warning" flags a VoiceOver regression after a YouVersion update (the page returned 403, so I couldn't read the details) — [ESV App Store](https://apps.apple.com/us/app/id361797273); [AppleVis](https://applevis.com/comment/24656)

**8. Review-prompt and notification nagging (rising in 2026)**
- BLB Sep–Oct 2026: at least 6 one-star reviews are purely about being asked for a review on every launch. Quote: "Every time I open this app it ask me for a review." (2026-09-27) — [BLB App Store](https://apps.apple.com/us/app/id365547505)
- Logos 2026-09-06: a user gives 1★ after repeated review requests. Olive Tree 2026-08-13: wants to turn off notifications, "emails are enough" — [Logos](https://apps.apple.com/us/app/id336400266); [Olive Tree](https://apps.apple.com/us/app/id332615624)
- YouVersion: streak-loss anxiety and notification frequency are named as clusters by Unstar (low-confidence aggregator) — [Unstar](https://unstar.app/blog/youversion-bible-gateway-olive-tree-logos-blue-letter-bible-apps-ranked-2026)

**9. Distrust of AI, and of content and translation curation (low-medium frequency, high intensity)**
- Haven: AI distrust shows up as (a) a simple reference question turning into counselling, quoted as "turned into a counseling session by the bot" (2026-10-03); (b) the bot deflecting when asked whether it's AI (2026-09-17); (c) "AI could be wrong has has been wrong" (2026-07-14, paraphrased); (d) doctrinally off prayer suggestions (2026-10-02) — [Haven App Store](https://apps.apple.com/us/app/id6503387382)
- Hallow: 21 of 144 reviews at ≤3★ mention AI: AI narrator voices ("too robotic"), an AI video of "Matthew", and "abhorrent" in a Catholic app (2026, paraphrased) — [Hallow App Store](https://apps.apple.com/us/app/id1405323394)
- Logos: AI is split. 5★ reviewers praise "closed-domain" AI grounded in Logos resources. Others say AI "interferes with word searches", is on by default, or that Logos won't disclose which model it uses (2026, paraphrased) — [Logos App Store](https://apps.apple.com/us/app/id336400266)
- Industry context: YouVersion's CEO says leading AI models misquote popular Bible versions 15–60% of the time, and YouVersion has not launched a public theological chatbot over accuracy — [Christian Post, 2026](https://www.christianpost.com/news/ais-bible-misquotes-range-from-15-to-60-youversion-ceo.html)
- A 2026 pilot study tested four Bible chat apps for theological-tradition bias — [Scripture Engagement](https://scripture-engagement.org/content/ai-bible-apps-and-theological-bias/)
- Translation and "missing verses" distrust: YouVersion and BibleProject users believe modern translations "removed verses" (for example Matthew 17:21), and users object to apps selling The Passion Translation (YouVersion, Olive Tree, Logos). This is a frequent but niche set of 1★ reviews — [YouVersion (CA)](https://apps.apple.com/ca/app/id282935706); [Olive Tree](https://apps.apple.com/us/app/id332615624)

**10. Offline, crashes and audio bugs (medium frequency, medium severity)**
- Dwell broke on iPhone Air / iOS 26 (Oct 2025), crashed on launch, and has a plan audio that replays instead of advancing. Olive Tree audio jumps chapters mid-Revelation (2026-07-04). The Bible Gateway sleep timer is broken. Logos has offline book failures (2025-06-24) — app pages above.

### Inferences
- The worst reputational damage comes from **putting something between the reader and the verse**: an ad, a paywall, a login or a moved button. Bible Gateway (ads) and ESV in 2023–24 (paywall plus account) are the clearest cases. Both fell 1–2 stars in recent averages while their lifetime scores barely moved.
- Reviewers judge Bible apps on moral grounds. "God's word should be free" is a frequent argument against charging, even from people who accept that developers need revenue. Charging for **scripture or audio of scripture** gets far more anger than charging for commentaries or extras.
- Habitual readers feel lost history, recents, highlights and plan progress as a betrayal. These reviews are long and emotional. Severity is far higher than frequency suggests.
- AI anxiety splits into two groups. Catholic and traditional users reject AI in prayer on principle. Others accept AI that is visibly grounded in sources (Logos "closed-domain") and distrust AI that counsels, deflects, or won't say what it is.

### Gaps
- Google Play reviews were not collected directly. Android-specific themes (ads on low-end devices, offline storage) are unverified.
- The YouVersion recent sample covers only 2 days because of volume. Its complaint picture relies on helpful-sorted reviews (2017–2026, mostly CA) and secondary sources.
- I couldn't read the AppleVis YouVersion VoiceOver thread (HTTP 403).
- No Sensor Tower, AppFollow or Apptopia rating time-series were accessible. The trend numbers are my own averages over the RSS samples.

## What 5-star reviewers value most

### Takeaway
Across 3,001 five-star reviews, the most-mentioned values are **daily habit and consistency** (426 mentions), **audio** (340), **understanding** (242), **ease and simplicity** (223), and **original-language and cross-reference tools** (214, mostly BLB, Olive Tree, Accordance). "Free" comes up 128 times. The profile differs by app. YouVersion and Hallow praise is about habit. Dwell praise is about audio. BibleProject praise is about understanding. BLB praise is about study tools.

### Cited Findings
- Theme counts in 5★ reviews by app. YouVersion (242): habit 39, plans 26, easy 17. Dwell (384): audio 144, habit 104. BibleProject (192): understanding 58. BLB (456): original-language and cross-reference tools 101, understanding 53, easy 50. Hallow (328): habit 83, audio 45. Bible Chat (225): habit 53 — [app pages listed in Method]
- BibleProject draws new believers. Quote: "As a new Christian, the BibleProject has brought me so much more clarity" (2025-11-12). Other reviewers say it makes "complex topics… much easier to understand" and that you can turn off chapter and verse numbers (paraphrased) — [BibleProject App Store](https://apps.apple.com/us/app/id1523687027)
- YouVersion 5★ (Oct 2026) praise is "beginner friendly", free, side-by-side versions, plans with friends, and audio. The top helpful reviews point to translation switching and plans, but complain about highlights not carrying across translations and notes being hard to find (paraphrased from App Store listing) — [YouVersion App Store](https://apps.apple.com/us/app/id282935706)
- Bible Chat and Glorify 5★ reviews value "small incremental steps" that keep it from feeling overwhelming (Bible Chat, 2026-10-03, paraphrased). Dwell users value soothing voices and music — [Bible Chat](https://apps.apple.com/us/app/id6448849666); [Dwell](https://apps.apple.com/us/app/id1343917374)
- Olive Tree 5★ reviewers value font choice, offline reading, reliable highlights and notes, and comparing versions to understand a passage — [Olive Tree App Store](https://apps.apple.com/us/app/id332615624)
- Hardly anyone praises "no ads" (6 mentions) or "offline" (5) in 5★ reviews. People notice these only when they are missing.

### Inferences
- Habit apps win on rhythm: a daily prompt, audio, and short steps. Study apps win on "tap a word and see what it means". Few apps are praised for both. BibleProject is the closest example of "understanding for beginners".
- Audio is a major value driver, which explains why paywalling audio (ESV, Dwell, Glorify, Bible Gateway) provokes so much anger.

### Gaps
- Keyword tagging can't tell "understand the passage" apart from "understand the app". The understanding counts are approximate.

## Study tools for beginners: commentaries, cross-references, notes, word studies

### Takeaway
Study-tool praise clusters in BLB, Olive Tree, Accordance and Logos, and comes mostly from people who already study. Beginners get stuck on **complexity and learning curves** (Logos, Accordance), **paywalled or rented resources** (ESV, Olive Tree, Bible Gateway), and **mobile versions that are weaker than desktop**. BLB is the app most often called good "for beginners and learned alike".

### Cited Findings
- BLB: 108 of 456 5★ reviews mention study tools (cross-references, Strong's, interlinear, commentaries). Several call it good for "beginners and learned alike" (2026-10-05, 2026-09-16, paraphrased) — [BLB App Store](https://apps.apple.com/us/app/id365547505)
- Logos: helpful-sorted reviews call it like the greatest library in the world that won't let you in (2026-09-11, paraphrased), "the most complicated software I've used" (2022-09-02, paraphrased), and say it has a "steep learning curve" (2025-01-07, 4★). Positive reviewers say training overcame the complexity — [Logos App Store](https://apps.apple.com/us/app/id336400266)
- Accordance: "Has little to no parity with the desktop app." (2026-09-20). Original-language search fails on mobile. "I don't understand it at all" (2023-10-20, paraphrased) — [Accordance App Store](https://apps.apple.com/us/app/id411970514)
- Olive Tree: you can't see a study Bible's notes at the bottom of each page, and the app advertises volumes the user doesn't own in a commentary set (2026-09-03, paraphrased). A 4★ reviewer calls it "a continuous learning curve" after buying 12+ Bibles (paraphrased) — [Olive Tree App Store](https://apps.apple.com/us/app/id332615624)
- ESV: a 5★ reviewer (2023-12-28) says they value simplicity over specialty features with steep learning curves, and that the commentaries and study Bibles "could be a bit better" (paraphrased). Older reviews praise "beautiful cross-references" before the paywall — [ESV App Store](https://apps.apple.com/us/app/id361797273)
- Logos 2026-05-16: dictionaries in the word study show "not available" after an update — [Logos App Store](https://apps.apple.com/us/app/id336400266)
- Bible Gateway: commentary access is gated behind Plus mid-reading (Unstar, low confidence) — [Unstar](https://unstar.app/blog/youversion-bible-gateway-olive-tree-logos-blue-letter-bible-apps-ranked-2026)

### Inferences
- There is a gap between "free but shallow" (YouVersion) and "deep but intimidating or expensive" (Logos, Accordance, Olive Tree store). BLB fills part of it for free, but reviews call its design dated (Unstar).
- Beginners rarely praise commentaries themselves. They praise **explanations in context** (BibleProject videos, BLB cross-references, version comparison).

### Gaps
- I found almost no reviews that judge whether commentary *content* is understandable to a lay reader. Complaints are about access, price and UI, not prose level.

## Score drops and backlash after redesigns and pricing changes

### Takeaway
The reviews show four clear backlash events. ESV's Dec 2023 v5 paywall and account change took the quarterly average to 2.81. Bible Gateway's ad-heavy app has sat at about 1.5–1.9 since at least Jan 2025. Logos mobile v53/v54 (Aug–Oct 2026) went 4.56 → 3.29. Hallow and Haven show sustained billing-trap backlash. YouVersion shows ongoing low-level "social media creep" complaints, and new history and recents complaints in Oct 2026, but no measurable score drop in this sample.

### Cited Findings
- ESV quarterly averages: 2023Q3 3.44 → **2023Q4 2.81 (48 reviews)** → **2024Q1 3.03 (91)** → 2024Q4 4.03. Review volume doubled during the backlash — [ESV App Store](https://apps.apple.com/us/app/id361797273)
- Bible Gateway monthly averages, Jan 2025–Sep 2026: 1.47–2.56, with no month above 2.6. The 3.65 lifetime rating hides this — [Bible Gateway App Store](https://apps.apple.com/us/app/id506512797)
- Logos average by app version: v52 4.56 (18 reviews), v53 3.97 (117), v54 3.29 (14) — [Logos App Store](https://apps.apple.com/us/app/id336400266)
- Logos subscription backlash on its forums: about $250/yr, rented libraries, perceived shift away from ministry — [Logos community](https://community.logos.com/discussion/comment/1210534)
- Hallow monthly averages: Mar–Jun 2026 3.73–3.87, Jul–Aug 4.30–4.33 (an improvement), Oct 3.91. Mar 2026 had 104 reviews, the Lent peak with trial-billing complaints — [Hallow App Store](https://apps.apple.com/us/app/id1405323394)
- Accordance shows a slow decline: about 4.5 in 2021, then 2.6 (Q2 2025) and 3.25 (Q4 2025 and Q3 2026) — [Accordance App Store](https://apps.apple.com/us/app/id411970514)
- YouVersion helpful-sorted 1★ reviews (CA, 2021–2024) object to distracting videos beside the verse of the day, social elements "pushed in our face", "WAY too much other content", and data harvesting and Facebook analytics — [YouVersion App Store (CA)](https://apps.apple.com/ca/app/id282935706)

### Inferences
- When a lifetime 4.8+ rating sits beside a recent average under 4.0, it signals a backlash that store badges hide. Apps rated this way still look healthy to new downloaders.
- Backlash is sharpest when a change takes away something a user **already had** (free audio, highlights, the Bible tab, history). Adding a new paid tier is less controversial.

### Gaps
- No independent rating time-series (Sensor Tower or AppFollow) to confirm these drops. Small per-version samples for Logos v52/v54 (14–18 reviews).
- YouVersion score effects can't be measured from a 2-day sample.
