import { describe, expect, it } from "vitest";

import { appleMapsUrl, parseLinks, parsePlaceSpans, partnerIn, partnerLabel, pieces, placeLine, placesToDraw, project, viewFor } from "./wordsAndPlaces";

// John 1:1 as core v5 stores it, and its row from a build-6 Understand bundle.
const J11 = "In the beginning was the Word, and the Word was with God, and the Word was God.";
const ROW = "[[1,0,2],[2,7,16],[3,17,20],[4,21,24],[5,25,29],[6,31,34],[7,35,38],[8,39,43],[9,44,47],[10,48,52],[12,53,56],[13,58,61],[14,75,78],[15,71,74],[16,62,65],[17,66,70]]";

describe("MM-03 in the app", () => {
  const words = { bsb: J11, links: parseLinks(ROW) };

  it("finds λόγος's partner, “Word”, only under the same BSB text", () => {
    const spans = partnerIn(J11, words, 5);
    expect(spans).toEqual([[25, 29]]);
    expect(J11.slice(25, 29)).toBe("Word");
    expect(partnerLabel(J11, spans!)).toBe("In the BSB: Word");
  });

  it("shows nothing on another text, for a word with no link (τὸν), or with no file", () => {
    expect(partnerIn("In the beginning was the Word, and the Word was with God, and the Word was God", words, 5)).toBeNull();
    expect(partnerIn(J11, words, 11)).toBeNull();
    expect(partnerIn(J11, null, 5)).toBeNull();
  });

  it("drops malformed rows rather than guess", () => {
    expect(parseLinks("[[1,5,2],[2,0],\"x\",[3,1,4]]")).toEqual(new Map([[3, [[1, 4]]]]));
    expect(parseLinks("not json").size).toBe(0);
  });

  it("cuts the verse into plain text, the partner and place names; the partner wins an overlap", () => {
    const t = "He was from Bethany, the village of Mary.";
    const at = t.indexOf("Bethany");
    expect(pieces(t, null, [{ place: "a1", spans: [[at, at + 7]] }])).toEqual([
      { text: "He was from ", mark: null },
      { text: "Bethany", mark: "place", place: "a1" },
      { text: ", the village of Mary.", mark: null },
    ]);
    expect(pieces(t, [[at, at + 7]], [{ place: "a1", spans: [[at, at + 7]] }]).map((p) => p.mark)).toEqual([null, "partner", null]);
  });
});

describe("MS-01 in the app", () => {
  it("reads a verse's place spans", () => {
    expect(parsePlaceSpans("[[55,62]]")).toEqual([[55, 62]]);
    expect(parsePlaceSpans("[]")).toEqual([]);
    expect(parsePlaceSpans("[[3,1]]")).toEqual([]);
  });

  it("says what the data says about a place", () => {
    expect(placeLine({ id: "a", name: "Bethany", kind: "settlement", modern: "Al Eizariya", lon: 0, lat: 0, score: 889 })).toBe("Identified with Al Eizariya");
    expect(placeLine({ id: "b", name: "Jerusalem", kind: "settlement", modern: "Jerusalem", lon: 0, lat: 0, score: 1000 })).toBe("Settlement");
  });

  it("centres the place, north up, east right", () => {
    const view = viewFor({ lon: 35.2559, lat: 31.7717 }, [], 360, 240);
    expect(project(view, 35.2559, 31.7717)).toEqual([180, 120]);
    const [x, y] = project(view, 35.2342, 31.7767);
    expect(x).toBeLessThan(180);
    expect(y).toBeLessThan(120);
  });

  it("widens to show the passage's other places, but not across the sea to Rome", () => {
    const near = viewFor({ lon: 35.2559, lat: 31.7717 }, [{ lon: 35.575, lat: 32.8811 }], 360, 240);
    const [, y] = project(near, 35.575, 32.8811);
    expect(y).toBeGreaterThan(0);
    expect(viewFor({ lon: 35.2342, lat: 31.7767 }, [{ lon: 12.4852, lat: 41.8922 }], 360, 240).span).toBe(0.45);
  });

  it("closes in on near neighbours, and never draws a label on another", () => {
    const bethany = { lon: 35.255903, lat: 31.771661 };
    const jerusalem = { id: "j", name: "Jerusalem", lon: 35.234167, lat: 31.776667 };
    const olives = { id: "o", name: "Mount of Olives", lon: 35.245686, lat: 31.777946 };
    const view = viewFor(bethany, [jerusalem, olives], 360, 240);
    expect(view.span).toBe(0.08);
    // The Mount of Olives, nearer, takes its place; Jerusalem's label would run into it, so it is left off.
    expect(placesToDraw(view, "Bethany", [jerusalem, olives], 13).map((d) => d.place.id)).toEqual(["o"]);
    expect(placesToDraw(view, "Bethany", [jerusalem], 13).map((d) => d.place.id)).toEqual(["j"]);
    expect(placesToDraw(viewFor(bethany, [], 360, 240), "Bethany", [jerusalem, olives], 13)).toEqual([]);
  });

  it("hands the point to Apple Maps with the place's name", () => {
    expect(appleMapsUrl({ name: "Bethany", lat: 31.771661, lon: 35.255903 })).toBe("https://maps.apple.com/?ll=31.771661,35.255903&q=Bethany&z=12");
  });
});
