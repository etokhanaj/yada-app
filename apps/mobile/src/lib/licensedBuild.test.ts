/**
 * The guards that keep the API.Bible key out of release builds (code review, 10 Oct 2026):
 * app.config.ts refuses a Release build with the flag, and release-ios.sh's guard functions
 * refuse a licensed environment or env file and check the archived config. The shell
 * functions run here with fake values; xcodebuild is never run.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { apiBibleExtra } from "../../app.config";

const GUARD = resolve(__dirname, "../../scripts/licensed-guard.sh");
const FAKE = "fake-value-never-printed";
const NAMES = ["YADA_DEV_LICENSED", "API_BIBLE_KEY", "API_BIBLE_URL"] as const;

describe("apiBibleExtra (app.config.ts)", () => {
  it("throws for a Release build with the dev flag", () => {
    expect(() => apiBibleExtra({ YADA_DEV_LICENSED: "1", API_BIBLE_KEY: FAKE, CONFIGURATION: "Release" })).toThrow(/Release build/);
  });

  it("carries the key only in a flagged non-Release build", () => {
    expect(apiBibleExtra({ YADA_DEV_LICENSED: "1", API_BIBLE_KEY: FAKE, API_BIBLE_URL: "https://x.test", CONFIGURATION: "Debug" })).toEqual({
      url: "https://x.test",
      key: FAKE,
      enabled: true,
    });
  });

  it("reads no key without the flag, Release or not", () => {
    const off = { url: "", key: "", enabled: false };
    expect(apiBibleExtra({ API_BIBLE_KEY: FAKE, CONFIGURATION: "Release" })).toEqual(off);
    expect(apiBibleExtra({ API_BIBLE_KEY: FAKE })).toEqual(off);
  });
});

/** Runs one guard function in bash with only PATH, HOME and `extra` in its environment. */
function guard(call: string, args: string[], extra: Record<string, string> = {}) {
  const result = spawnSync("bash", ["-c", `set -euo pipefail; source "$0"; ${call} "$@"`, GUARD, ...args], {
    encoding: "utf8",
    env: { NODE_ENV: "test", PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ""}`, HOME: process.env.HOME ?? "", ...extra },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe("refuse_licensed_build (release-ios.sh)", () => {
  let app: string;
  beforeEach(() => {
    app = mkdtempSync(join(tmpdir(), "yada-guard-"));
  });
  afterEach(() => {
    rmSync(app, { recursive: true, force: true });
  });

  it("passes a clean environment and an app with no env files", () => {
    expect(guard("refuse_licensed_build", [app]).status).toBe(0);
  });

  it("passes when the names are present but empty", () => {
    expect(guard("refuse_licensed_build", [app], { YADA_DEV_LICENSED: "", API_BIBLE_KEY: "" }).status).toBe(0);
  });

  for (const name of NAMES) {
    it(`refuses ${name} in the environment, naming it without its value`, () => {
      const { status, output } = guard("refuse_licensed_build", [app], { [name]: FAKE });
      expect(status).not.toBe(0);
      expect(output).toContain(name);
      expect(output).not.toContain(FAKE);
    });
  }

  for (const file of [".env", ".env.local", ".env.production", "ios/.xcode.env.local"]) {
    it(`refuses ${file} defining a licensed name, without printing the value`, () => {
      mkdirSync(join(app, "ios"), { recursive: true });
      writeFileSync(join(app, file), `OTHER=1\nexport API_BIBLE_KEY=${FAKE}\n`);
      const { status, output } = guard("refuse_licensed_build", [app]);
      expect(status).not.toBe(0);
      expect(output).toContain("API_BIBLE_KEY");
      expect(output).not.toContain(FAKE);
    });
  }

  it("ignores env files that define other names", () => {
    writeFileSync(join(app, ".env.local"), "EXPO_PUBLIC_X=1\n# API_BIBLE_KEY=commented\n");
    expect(guard("refuse_licensed_build", [app]).status).toBe(0);
  });
});

describe("assert_no_licensed_key (release-ios.sh, after the archive)", () => {
  let bundle: string;
  const writeConfig = (config: unknown) => {
    const dir = join(bundle, "EXConstants.bundle");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "app.config"), typeof config === "string" ? config : JSON.stringify(config));
  };
  beforeEach(() => {
    bundle = join(mkdtempSync(join(tmpdir(), "yada-archive-")), "Yada.app");
    mkdirSync(bundle);
  });
  afterEach(() => {
    rmSync(dirname(bundle), { recursive: true, force: true });
  });

  it("passes a config whose apiBible is off and keyless", () => {
    writeConfig({ name: "Yada", extra: { apiBible: { url: "", key: "", enabled: false } } });
    expect(guard("assert_no_licensed_key", [bundle]).status).toBe(0);
  });

  it("fails on a key, printing only that one was found", () => {
    writeConfig({ extra: { apiBible: { url: "", key: FAKE, enabled: false } } });
    const { status, output } = guard("assert_no_licensed_key", [bundle]);
    expect(status).not.toBe(0);
    expect(output.trim()).toBe("API.Bible key found in the archive");
  });

  it("fails when apiBible is enabled", () => {
    writeConfig({ extra: { apiBible: { url: "", key: "", enabled: true } } });
    expect(guard("assert_no_licensed_key", [bundle]).status).not.toBe(0);
  });

  it("fails closed when there is no config, or it is not JSON", () => {
    expect(guard("assert_no_licensed_key", [bundle]).status).not.toBe(0);
    writeConfig(`{"extra":{"apiBible":{"key":"${FAKE}"`);
    const { status, output } = guard("assert_no_licensed_key", [bundle]);
    expect(status).not.toBe(0);
    expect(output).not.toContain(FAKE);
  });
});
