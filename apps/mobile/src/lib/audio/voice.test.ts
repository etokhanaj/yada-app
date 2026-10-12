import { describe, expect, it } from "vitest";

import type { Voice } from "../../../modules/yada-speech";
import {
  CLEARER_VOICE,
  effectiveChoice,
  isVoiceChoice,
  menuAccessibilityLabel,
  offersClearerVoice,
  offersPersonalVoice,
  PERSONAL_VOICE,
  playerMenu,
  voiceLabel,
} from "./voice";

const samantha: Voice = { id: "com.apple.voice.compact.en-US.Samantha", name: "Samantha", language: "en-US", quality: "default" };
const ava: Voice = { id: "com.apple.voice.premium.en-US.Ava", name: "Ava", language: "en-US", quality: "premium" };
const daniel: Voice = { id: "com.apple.voice.enhanced.en-GB.Daniel", name: "Daniel", language: "en-GB", quality: "enhanced" };
const mine: Voice = { id: "personal-voice-1", name: "John", language: "en-GB", quality: "default" };

describe("voiceLabel", () => {
  it("names the voice as Settings does, with its quality", () => {
    expect(voiceLabel(ava)).toBe("Ava (Premium)");
    expect(voiceLabel(daniel)).toBe("Daniel (Enhanced)");
    expect(voiceLabel(samantha)).toBe("Samantha");
  });
});

describe("Personal Voice", () => {
  it("is offered wherever the device can have one", () => {
    expect(offersPersonalVoice("unsupported", null)).toBe(false);
    expect(offersPersonalVoice("notDetermined", null)).toBe(true);
    expect(offersPersonalVoice("denied", null)).toBe(true);
    expect(offersPersonalVoice("authorized", mine)).toBe(true);
    // Authorized, but no voice made yet: nothing to pick.
    expect(offersPersonalVoice("authorized", null)).toBe(false);
  });

  it("speaks only while authorized and present; otherwise the system voice, silently", () => {
    expect(effectiveChoice("personal", "authorized", mine)).toBe("personal");
    expect(effectiveChoice("personal", "denied", null)).toBe("system");
    expect(effectiveChoice("personal", "notDetermined", null)).toBe("system");
    expect(effectiveChoice("personal", "authorized", null)).toBe("system");
    expect(effectiveChoice("personal", "unsupported", mine)).toBe("system");
    expect(effectiveChoice("system", "authorized", mine)).toBe("system");
  });

  it("reads a stored choice only if it is one", () => {
    expect(isVoiceChoice("personal")).toBe(true);
    expect(isVoiceChoice("system")).toBe(true);
    expect(isVoiceChoice("Ava")).toBe(false);
    expect(isVoiceChoice(undefined)).toBe(false);
  });
});

describe("playerMenu", () => {
  it("lists the speeds with the current one ticked, then the voices", () => {
    const menu = playerMenu(1.25, samantha, "system", true, offersClearerVoice(samantha));
    expect(menu.map((s) => s.title)).toEqual(["Speed", "Voice"]);
    expect(menu[0]?.rows.map((r) => [r.title, r.on])).toEqual([
      ["0.8×", false],
      ["1×", false],
      ["1.25×", true],
      ["1.5×", false],
    ]);
    expect(menu[1]?.rows.map((r) => [r.id, r.title, r.on])).toEqual([
      ["voice:system", "Samantha", true],
      ["voice:personal", PERSONAL_VOICE, false],
      ["voice:clearer", CLEARER_VOICE, false],
    ]);
  });

  it("leaves out Personal Voice where unsupported and the hint once a Premium voice is installed", () => {
    const menu = playerMenu(1, ava, "system", offersPersonalVoice("unsupported", null), offersClearerVoice(ava));
    expect(menu[1]?.rows.map((r) => r.title)).toEqual(["Ava (Premium)"]);
  });

  it("ticks Personal Voice when it is the one speaking", () => {
    const menu = playerMenu(1, samantha, "personal", true, false);
    expect(menu[1]?.rows.filter((r) => r.on).map((r) => r.id)).toEqual(["voice:personal"]);
  });
});

describe("menuAccessibilityLabel", () => {
  it("reads speed and voice without the multiplication sign", () => {
    expect(menuAccessibilityLabel(1, "Samantha")).toBe("Speed, 1 times. Voice, Samantha");
    expect(menuAccessibilityLabel(1.5, PERSONAL_VOICE)).toBe("Speed, 1.5 times. Voice, Your Personal Voice");
    expect(menuAccessibilityLabel(0.8, null)).toBe("Speed, 0.8 times");
  });
});
