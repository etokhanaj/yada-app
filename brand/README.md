# Yada brand: what we took from the kit, and why

Source: `Yada-Brand-Kit.zip` v1.0 (9 Oct 2026). **Owner: John Etokhana owns the brand kit** (confirmed
10 Oct 2026); the wordmark's Fraunces outlines are covered by its OFL (`brand/fonts/Fraunces-OFL.txt`). Only what the app and its web presence need is kept here;
the kit's UI concepts were reviewed and not adopted (see the end).

## Taken

| Asset | Where | Use |
|---|---|---|
| Symbol, "page turn" y (forest, chartreuse, chalk, black) | `brand/logos/yada-symbol-*.svg` | Masters for any future size |
| Wordmark and lockup (forest, chalk) | `brand/logos/` | Home title (wordmark, outlined, no font needed); marketing |
| App icon, forest ground + chartreuse symbol, 1024 | `apps/mobile/assets/brand/icon.png` | iOS icon (system applies the mask) |
| Dark-mode icon (chartreuse symbol, transparent) | `apps/mobile/assets/brand/icon-dark.png` | iOS 18 dark icon |
| Tinted icon (grayscale symbol) | `apps/mobile/assets/brand/icon-tinted.png` | iOS 18 tinted icon |
| Splash symbol, forest / chartreuse | `apps/mobile/assets/brand/splash-symbol{,-dark}.png` | Launch screen on chalk / dark paper |
| Wordmark rasters @1x/2x/3x, forest / chalk | `apps/mobile/assets/brand/wordmark-*.png` | Home title, rendered from the high-resolution export (`Yada-Wordmark-High-Resolution.zip`, 3840 px) at 72 pt × 1–3, the largest the app draws it (AX5) |
| Splash layers, stem and leaf (same frame as the dark symbol) | `apps/mobile/assets/brand/splash-{stem,leaf}.png` | "The page lifts" launch motion (brief §8.17) |
| Favicons, touch icon, maskable, manifest | `brand/web/` | Future site or web build |
| Fraunces variable + OFL | `brand/fonts/` | Marketing only; the app uses the outlined wordmark |
| Palette | `tokens.ts` (via the build plan) | See below |

## Palette, adapted for a reading app

The kit's colours are a marketing palette; the app needs reading surfaces, a dark theme and Increase
Contrast. All pairs measured (WCAG 2.2):

| Token | Light | Dark | From the kit |
|---|---|---|---|
| paper | #F7F8F0 | #0E1814 | Chalk; dark is a deep forest-black |
| ink | #16231E | #ECF0E4 | Forest-black for long reading (15.2:1 / 15.7:1) |
| mutedInk | #526D63 | #9AAFA4 | Kit's secondary text (5.27:1 / 7.80:1) |
| divider | #DFE5D7 | #22332C | Between kit's border and surface |
| accent | #183F35 | #DBEC9A | Forest; chartreuse in dark (10.9:1 / 14.2:1) |
| selection | #E7EED8 | #1A2D25 | Kit's subtle surface; the bar carries the state |
| difference mark | #DBEC9A | #3B4A22 | Chartreuse as a highlighter (ink on it 12.7:1 / 8.3:1) |
| IC mutedInk | #3F584F | #B5C6BC | 7.2:1 / 10.2:1 |
| IC divider | #7E9187 | #5E7369 | 3.1:1 / 3.6:1 |

Chartreuse is never text and never on chalk as a fill for meaning on its own (1.19:1), as the kit warns.

## Not taken, and why

- **Inter for app text.** SF Pro tracks Dynamic Type to AX5 with optical sizes; Inter would need the same
  work by hand for no gain. Scripture stays Literata, original languages Gentium Plus / Noto Serif Hebrew.
- **Fraunces for headings in the app.** A second display serif beside Literata fights it. The wordmark
  carries Fraunces where it matters.
- **The mobile concepts** (welcome screen, "Let's understand John 15", tab bar, cards, Context /
  Meaning / Reflect tabs, filled 16-radius buttons). They contradict decisions already made: no
  onboarding screens, no tab bar, no cards, capsule controls, typography as hierarchy.
- **Tagline in the app.** "Understand Scripture. Grow closer." is for the App Store and marketing.
- **Social templates.** Out of scope for the app.

## Open (for John, before launch)

The kit's own research lists two App Store apps with neighbouring names ("Yada Bible Insight", "Yada
Project"). `app.json` already flags the name as not trademark-cleared (PRD 0E); this adds weight to that.
