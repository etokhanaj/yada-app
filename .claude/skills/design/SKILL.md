---
name: design
description: Draft Yada screens on a Design canvas before building them — from a brief in docs/, with real content from golden/ and the core bundle, every frame in Light, Dark and AX5. Use when CLAUDE.md or a handoff says "run /design", when a screen needs drafting before code, or when the redesign canvas needs new or revised frames.
---

# /design — draft on the canvas, then build

Yada's rule: design decisions come from the Mobbin MCP and are drafted on a canvas before any screen
is built. This skill is that drafting step. John reviews the canvas; nothing is built from it until he has.

## Inputs (read all before drawing)

1. The brief named in the request (default `docs/redesign/brief.md`). Its frame tables are the work
   list; its tokens, copy and accessibility spec are the spec. Do not re-litigate decisions it records.
2. `docs/redesign/audit.md` (current copy → proposed copy) and `docs/redesign/mobbin-study.md`
   (the cited patterns). A pattern not in the study gets a Mobbin search first; cite it in your reply.
3. Current build screenshots in `docs/app-v1/`, only to see what is being replaced.
4. `CLAUDE.md` §Design: typography carries hierarchy; no cards, coloured labels, skeletons or
   "coming later"; every word earns its place; accessibility designed in.

## Content: real only

- Entries: `golden/<book>.<ch>.<v>.json`. Every entry shows `Unreviewed` (rule 2: only John approves).
- Bible text (BSB, WEB, KJV), lexeme totals, per-book counts, morphology: `content/bundles/core.v2.db`
  (`verses`, `texts`, `tokens`, `lexemes`, `occurrences`). Passage labels and which verses have entries:
  `content/bundles/<book>.v1.db` (`pericopes`, `entries`).
- Never invent a parse, Strong's number, count or gloss (rule 4). If the data lacks something a
  frame needs, draw what the data supports and list the gap in your reply.

## The canvas

- An existing canvas: the latest handoff names its URL. Read `project/canvas.json` and the artboards
  you will change, edit, and publish only those files to the same URL.
- No canvas yet: `Artifact` quickstart with intent `design`, create from the Design type, then follow
  the type's instructions (index first, then artboards).
- One artboard per frame ID, holding that frame three times side by side: `<ID> · Light`,
  `<ID> · Dark`, `<ID> · AX5` (light), each 402 × 874 pt (iPhone 17 Pro). Group journeys under a
  title note.

## Generator

`scripts/build_canvas.py` builds every artboard from the data above, and `scripts/style.css` holds the
tokens from brief §3: colour per theme as CSS variables, and the AX5 sizes from the type table. AX5 is
a theme class, not a separate drawing. Markup carries both layouts where the brief's AX table changes
the layout, `.d` (default) and `.a` (AX1+): two-row reader header, vertical action list, one word per
interlinear row, sentence-case labels, sheets opening large.

```bash
python3 .claude/skills/design/scripts/build_canvas.py <scratchpad>/canvas
```

A second argument picks the stylesheet: `v1` (default, `style.css`, the brief's tokens as written) or
`v2` (`style-v2.css`, the modern restyle: round fill controls, inset sheets, sentence-case labels).
A non-v1 run names files `<ID>-v2.dc.html`, tags boards and notes with `page: "v2"`, and writes
`canvas.v2.json` as a fragment: merge it into the live index (read it first) and add the page.

It writes `<dir>/project/canvas.json` and one `.dc.html` per frame. Publish them with the Artifact
tool (`root` = `<dir>`, index plus `Main.dc.html` first, then the rest). To add a frame, add an
`F(...)` call. To change a token, edit `style.css`. Regenerate, then republish only the files that
changed (and the index only when frames are added, moved or removed).

## Rules the frames must keep

- Never more than two sheets; the evidence sheet pushes inside itself (`‹`), and `×` returns to Understand.
- Every sheet header names what it is and its verse; every exit names its destination.
- No state by colour alone: selection = wash + 3 pt accent bar; translation difference = wash +
  underline; `Here`/`Next` = the word in ink + the bar.
- Greek runs carry `lang="el"`, Hebrew `lang="he"` and `dir="rtl"` (isolated inside English).
- Targets ≥ 44 × 44 on the frame itself; real `<button>`s with `aria-label` on icon-only ones.

## Hand-off

Reply with the canvas link, what each journey shows, every place a frame departs from the brief
and why, and the open questions for John. Then stop: building in `apps/mobile` waits for his review.
