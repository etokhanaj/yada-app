/**
 * The player's menu, pure so it can be tested (canvas LB-01, LB-02, LB-05, LB-07). One menu from the speed
 * button, three rows that each open a submenu and show their setting as a second line: Speed, Stop playing,
 * Repeat. Inline, the three lists were about fifteen rows; Apple Podcasts keeps its stop times in a native menu
 * from the player's controls, https://mobbin.com/screens/e8c63ed4-2e3a-48cb-a080-7aa53b5524a8, and Matter its
 * speeds, https://mobbin.com/screens/e76e8878-9a63-45fc-8049-2e7d40cd7930.
 *
 * The voice is chosen in the Voice sheet, Heart or George (John, 13 Oct 2026). Where neither has a reading, the
 * system voice reads unasked.
 */

import { SPEEDS, speedLabel } from "./session";
import { minutesLeft, type Repeat, repeatChoices, type SetEnd, setEndLabel, type Stop, type StopChoice, stopChoices } from "./stop";

export interface MenuRow {
  readonly id: string;
  readonly title: string;
  readonly on: boolean;
  /** A second line under the row's title. */
  readonly subtitle?: string;
}

export interface MenuSection {
  readonly id: string;
  readonly title: string;
  /** The section's setting, shown under its title in the top menu. */
  readonly subtitle?: string;
  readonly rows: readonly MenuRow[];
}

/** The speeds, with the current one ticked. */
export function speedMenu(speed: number): MenuSection[] {
  return [{ id: "speed", title: "Speed", subtitle: speedLabel(speed), rows: SPEEDS.map((s) => ({ id: `speed:${s}`, title: speedLabel(s), on: s === speed })) }];
}

export interface MenuPlace {
  /** The playing verse, "1:5". */
  readonly verse: string;
  /** The playing passage, "1:1–18", or null in a book with no passages. */
  readonly passage: string | null;
  /** "John 1". */
  readonly chapter: string;
  /** Where a stop at the end of the passage and of the chapter falls: "1:18", "1:51". */
  readonly passageEnd: string | null;
  readonly chapterEnd: string;
  /** DR-08: "End of this psalm" where the chapter is a psalm. */
  readonly psalm?: boolean;
  /** DR-08: today's set of psalms, while one of them plays; null otherwise. */
  readonly set?: SetEnd | null;
}

const STOP_TITLES: Record<Exclude<StopChoice, "set">, string> = {
  passage: "End of this passage",
  chapter: "End of this chapter",
  "time:15": "In 15 minutes",
  "time:30": "In 30 minutes",
  "time:60": "In 1 hour",
};

/** DR-08: "End of this evening's psalms". */
const setTitle = (part: SetEnd["part"]) => `End of this ${part}’s psalms`;

function stopTitle(choice: StopChoice, place: MenuPlace): string {
  if (choice === "set") return setTitle(place.set?.part ?? "evening");
  if (choice === "chapter" && place.psalm === true) return "End of this psalm";
  return STOP_TITLES[choice];
}

function stopValue(stop: Stop | null, place: MenuPlace, now: number): string {
  if (stop === null) return "Off";
  if (stop.kind === "set") return setTitle(stop.part);
  if (stop.kind === "passage" || stop.kind === "chapter") return stopTitle(stop.kind, place);
  return `In ${minutesLeft(stop, now)} min`;
}

const REPEAT_TITLES: Record<Repeat, string> = { verse: "This verse", passage: "This passage", chapter: "This chapter" };

/** LB-01: Speed, Stop playing and Repeat, each with its setting and its rows ticked. */
export function playerMenu(speed: number, stop: Stop | null, repeat: Repeat | null, place: MenuPlace, now: number): MenuSection[] {
  const hasPassages = place.passage !== null;
  const set = place.set ?? null;
  const stops = stopChoices(repeat, hasPassages, set !== null).map((choice): MenuRow => {
    // A running timer ticks no row: "In 30 minutes" is no longer true after a minute; the row above says what is left.
    const on = stop !== null && stop.kind !== "time" && choice === stop.kind;
    const subtitle =
      choice === "set" && set !== null
        ? `After ${setEndLabel(set)}`
        : choice === "passage"
          ? `After ${place.passageEnd ?? place.chapterEnd}`
          : choice === "chapter"
            ? `After ${place.chapterEnd}`
            : undefined;
    return { id: `stop:${choice}`, title: stopTitle(choice, place), on, ...(subtitle === undefined ? {} : { subtitle }) };
  });
  const repeats = repeatChoices(hasPassages).map((r): MenuRow => {
    const subtitle = r === "verse" ? place.verse : r === "passage" ? (place.passage ?? place.chapter) : place.chapter;
    return { id: `repeat:${r}`, title: REPEAT_TITLES[r], on: repeat === r, subtitle };
  });
  return [
    ...speedMenu(speed),
    { id: "stop", title: "Stop playing", subtitle: stopValue(stop, place, now), rows: [...stops, { id: "stop:off", title: "Off", on: stop === null }] },
    { id: "repeat", title: "Repeat", subtitle: repeat === null ? "Off" : REPEAT_TITLES[repeat], rows: [...repeats, { id: "repeat:off", title: "Off", on: repeat === null }] },
  ];
}
