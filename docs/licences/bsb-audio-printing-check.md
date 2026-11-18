# Which BSB printing each narrator reads (12 Oct 2026)

The check plan-additions §D asks for, run with John's go-ahead on 12 Oct 2026. No AI wrote any text here: the speech
recogniser's words are compared with ours and then thrown away; only the comparison is kept.

**Inputs** (pinned in `content/raw/audio-check.sha256`):
- GEN 1 and JHN 1 from each narrator's voice-only set at openbible.com/audio: `souer/`, `gilbert/`, `hays/`.
- The BSB text of both chapters from `core.v5.db` (3rd printing).
- whisper.cpp (Homebrew `whisper-cpp`) with `ggml-base.en.bin` (MIT), run offline.

**Method:** `scripts/audio/printing_check.py`. Each recording is transcribed with word timings, and its words are
aligned with ours (difflib on lowercased words). The spoken chapter heading is ignored.

| Narrator | Genesis 1 | John 1 | Wording our text lacks |
|---|---|---|---|
| Barry Hays | 3 of 749 differ (0.4%) | 12 of 943 (1.3%) | none: every difference is the recogniser's spelling ("teen" for "teem", "Nathaniel", quote marks) |
| Bob Souer | 10 (1.3%) | 16 (1.7%) | John 1:9 "every man" for "everyone"; Genesis 1:21 "every bird of flight" for "every winged bird" |
| Jordan Scott Gilbert | 8 (1.1%) | 20 (2.1%) | the same two as Souer |

**Result:** Hays reads the printing our text follows; Souer and Gilbert read an earlier one. Hays is the default
voice. Souer and Gilbert are not offered for read-along, where the highlighted word would not be the word heard.
(Two chapters per narrator; a full-book run when the books are encoded will confirm it.)
