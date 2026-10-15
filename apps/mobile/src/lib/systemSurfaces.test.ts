import { verseOrd } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { activityState, placeInPassage, psalmTitleLine, rangeRef, richVerses, spokenName, surfaceText, watchStop } from "./systemSurfaces";

// BSB verse 1 of each psalm as core.v5 holds it (public domain).
const PSALMS: Record<number, string> = {
  1: "Blessed is the man who does not walk in the counsel of the wicked, or set foot on the path of sinners, or sit in the seat of mockers.",
  18: "For the choirmaster. Of David the servant of the LORD, who sang this song to the LORD on the day the LORD had delivered him from the hand of all his enemies and from the hand of Saul. He said: I love You, O LORD, my strength.",
  23: "A Psalm of David. The LORD is my shepherd; I shall not want.",
  52: "For the choirmaster. A Maskil of David. After Doeg the Edomite went to Saul and told him, “David has gone to the house of Ahimelech.” Why do you boast of evil, O mighty man? The loving devotion of God endures all day long.",
  54: "For the choirmaster. With stringed instruments. A Maskil of David. When the Ziphites went to Saul and said, “Is David not hiding among us?” Save me, O God, by Your name, and vindicate me by Your might!",
  75: "For the choirmaster: To the tune of “Do Not Destroy.” A Psalm of Asaph. A song. We give thanks to You, O God; we give thanks, for Your Name is near; men declare Your wondrous works.",
  126: "A song of ascents. When the LORD restored the captives of Zion, we were like dreamers.",
  138: "Of David. I give You thanks with all my heart; before the gods I sing Your praises.",
};

describe("psalmTitleLine (build-6 decision 1)", () => {
  it("sets the BSB's title apart and never changes a word", () => {
    for (const text of Object.values(PSALMS)) {
      const { title, body } = psalmTitleLine("PSA", 1, text);
      expect(title === null ? body : `${title} ${body}`).toBe(text);
    }
  });

  it("finds each kind of title the BSB prints", () => {
    expect(psalmTitleLine("PSA", 1, PSALMS[138]!)).toEqual({ title: "Of David.", body: "I give You thanks with all my heart; before the gods I sing Your praises." });
    expect(psalmTitleLine("PSA", 1, PSALMS[23]!).body).toBe("The LORD is my shepherd; I shall not want.");
    expect(psalmTitleLine("PSA", 1, PSALMS[18]!).body).toBe("I love You, O LORD, my strength.");
    expect(psalmTitleLine("PSA", 1, PSALMS[52]!).body.startsWith("Why do you boast")).toBe(true);
    expect(psalmTitleLine("PSA", 1, PSALMS[54]!).body.startsWith("Save me, O God")).toBe(true);
    expect(psalmTitleLine("PSA", 1, PSALMS[75]!).body.startsWith("We give thanks")).toBe(true);
  });

  it("keeps the psalm's own words out of the title", () => {
    // "When the LORD restored" opens Psalm 126; only after "… of David." is a "When" sentence the title's.
    expect(psalmTitleLine("PSA", 1, PSALMS[126]!)).toEqual({ title: "A song of ascents.", body: "When the LORD restored the captives of Zion, we were like dreamers." });
    expect(psalmTitleLine("PSA", 1, PSALMS[1]!).title).toBeNull();
    expect(psalmTitleLine("PSA", 2, "Of David. Not a title here.").title).toBeNull();
    expect(psalmTitleLine("JHN", 1, "Of David. Not a title here.").title).toBeNull();
  });
});

describe("references and the place", () => {
  it("writes a passage's span as the frames do", () => {
    expect(rangeRef(verseOrd("JHN", 5, 1), verseOrd("JHN", 5, 15))).toBe("John 5:1–15");
    expect(rangeRef(verseOrd("JHN", 4, 43), verseOrd("JHN", 5, 15))).toBe("John 4:43–5:15");
    expect(rangeRef(verseOrd("PSA", 138, 1), verseOrd("PSA", 138, 1))).toBe("Psalm 138:1");
  });

  it("places the hairline by position in the passage, never by count", () => {
    expect(placeInPassage(verseOrd("JHN", 5, 6), verseOrd("JHN", 5, 1), verseOrd("JHN", 5, 15))).toBeCloseTo(6 / 15);
    expect(placeInPassage(verseOrd("JHN", 5, 15), verseOrd("JHN", 5, 1), verseOrd("JHN", 5, 15))).toBe(1);
    const across = placeInPassage(verseOrd("JHN", 5, 1), verseOrd("JHN", 4, 43), verseOrd("JHN", 5, 15));
    expect(across).toBeGreaterThan(0);
    expect(across).toBeLessThan(1);
  });
});

describe("the Live Activity (SX-17–23)", () => {
  const base = {
    book: "JHN" as const,
    chapter: 1,
    verse: 5,
    text: "The Light shines in the darkness, and the darkness has not overcome it.",
    translation: "BSB",
    titling: false,
    playing: true,
    segments: [
      { from: 1, to: 18 },
      { from: 19, to: 34 },
      { from: 35, to: 51 },
    ],
    passage: "The Word became flesh",
    line: "Stops after 1:18",
    stop: { kind: "passage" } as const,
    repeat: null,
  };

  it("shows the passage, the verse and the segments (SX-17)", () => {
    const s = activityState(base);
    expect(s.title).toBe("The Word became flesh");
    expect(s.ref).toBe("1:5");
    expect(s.verse).toBe(base.text);
    expect(s.segments).toEqual([5 / 18, 0, 0]);
    expect(s.ring).toBeCloseTo(5 / 18);
    expect(s.lineGlyph).toBe("stop");
  });

  it("says the chapter's name between chapters (SX-19) and the chapter where there are no passages", () => {
    const s = activityState({ ...base, chapter: 2, verse: 1, titling: true, passage: null, segments: [{ from: 1, to: 25 }] });
    expect(s.title).toBe("John 2");
    expect(s.spoken).toBe("John, chapter 2");
    expect(s.verse).toBe("");
    expect(spokenName("PSA", 23)).toBe("Psalm 23");
  });

  it("never carries a licensed text (rule 9)", () => {
    expect(activityState({ ...base, translation: "NKJV" }).verse).toBe("");
    expect(surfaceText("NIV", "words")).toBe("");
    expect(surfaceText("KJV", "words")).toBe("words");
  });

  it("ends at once when a stop fires, not when one is cleared by hand (decision 7)", () => {
    const stop = { kind: "chapter" } as const;
    // advance(): the stop goes to Off, then the reading pauses.
    let w = watchStop({ stop, playing: true, armed: false }, { stop: null, playing: true });
    expect(w.fired).toBe(false);
    w = watchStop(w.watch, { stop: null, playing: false });
    expect(w.fired).toBe(true);
    // In one update too.
    expect(watchStop({ stop, playing: true, armed: false }, { stop: null, playing: false }).fired).toBe(true);
    // Cleared by hand, then the reading goes on; a later pause is only a pause.
    w = watchStop({ stop, playing: true, armed: false }, { stop: null, playing: true });
    w = watchStop(w.watch, { stop: null, playing: true });
    expect(watchStop(w.watch, { stop: null, playing: false }).fired).toBe(false);
  });
});

describe("the reminder's long-press (SX-14)", () => {
  it("carries two verses, the psalm's title on its own line", () => {
    const r = richVerses("PSA", [
      { verse: 1, text: PSALMS[138]! },
      { verse: 2, text: "I bow down toward Your holy temple." },
      { verse: 3, text: "On the day I called, You answered me." },
    ]);
    expect(r.titleLine).toBe("Of David.");
    expect(r.verses.map((v) => v.n)).toEqual([1, 2]);
    expect(r.verses[0]?.text.startsWith("I give You thanks")).toBe(true);
  });
});
