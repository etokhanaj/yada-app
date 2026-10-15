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

import { apiBibleExtra, licensedProxyExtra } from "../../app.config";

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

describe("licensedProxyExtra (app.config.ts)", () => {
  const proxy = (url: string, CONFIGURATION = "Release") => licensedProxyExtra({ EXPO_PUBLIC_LICENSED_PROXY_URL: url, CONFIGURATION });

  it("carries an https proxy URL into any build, Release included, trailing slash dropped", () => {
    expect(proxy("https://yada-licensed-proxy.example.workers.dev/")).toEqual({ url: "https://yada-licensed-proxy.example.workers.dev" });
    expect(licensedProxyExtra({})).toEqual({ url: "" });
  });

  it("allows plain http only for localhost outside Release (wrangler dev)", () => {
    expect(proxy("http://localhost:8787", "Debug")).toEqual({ url: "http://localhost:8787" });
    expect(() => proxy("http://localhost:8787")).toThrow(/https/);
    expect(() => proxy("http://proxy.example.test", "Debug")).toThrow(/https/);
  });

  it("refuses a URL that could carry a credential, or that is API.Bible itself", () => {
    expect(() => proxy(`https://proxy.example.test/?key=${FAKE}`)).toThrow(/no credentials/);
    expect(() => proxy(`https://user:${FAKE}@proxy.example.test`)).toThrow(/no credentials/);
    expect(() => proxy("https://rest.api.bible")).toThrow(/not API.Bible/);
    expect(() => proxy("not a url")).toThrow(/not a URL/);
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

  it("allows the proxy URL, in the environment and in env files", () => {
    writeFileSync(join(app, ".env.production"), "EXPO_PUBLIC_LICENSED_PROXY_URL=https://proxy.example.test\n");
    expect(guard("refuse_licensed_build", [app], { EXPO_PUBLIC_LICENSED_PROXY_URL: "https://proxy.example.test" }).status).toBe(0);
  });

  it("refuses the key under any other name carrying API_BIBLE, e.g. an EXPO_PUBLIC_ one", () => {
    const env = guard("refuse_licensed_build", [app], { EXPO_PUBLIC_API_BIBLE_KEY: FAKE });
    expect(env.status).not.toBe(0);
    expect(env.output).toContain("EXPO_PUBLIC_API_BIBLE_KEY");
    expect(env.output).not.toContain(FAKE);
    writeFileSync(join(app, ".env"), `  export EXPO_PUBLIC_API_BIBLE_KEY = ${FAKE}\n`);
    const file = guard("refuse_licensed_build", [app]);
    expect(file.status).not.toBe(0);
    expect(file.output).not.toContain(FAKE);
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

  it("passes an https proxy URL beside a keyless apiBible", () => {
    writeConfig({ extra: { apiBible: { url: "", key: "", enabled: false }, licensedProxy: { url: "https://proxy.example.test" } } });
    expect(guard("assert_no_licensed_key", [bundle]).status).toBe(0);
  });

  for (const url of ["http://proxy.example.test", `https://proxy.example.test/?key=${FAKE}`, "https://rest.api.bible", "nope"]) {
    it(`fails on the proxy URL ${url.replace(FAKE, "<fake>")}`, () => {
      writeConfig({ extra: { apiBible: { url: "", key: "", enabled: false }, licensedProxy: { url } } });
      const { status, output } = guard("assert_no_licensed_key", [bundle]);
      expect(status).not.toBe(0);
      expect(output).not.toContain(FAKE);
    });
  }
});

describe("assert_key_value_absent (release-ios.sh, after the archive)", () => {
  let root: string;
  let bundle: string;
  let envfile: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "yada-keyscan-"));
    bundle = join(root, "Yada.app");
    envfile = join(root, ".env.local");
    mkdirSync(bundle);
    writeFileSync(join(bundle, "main.jsbundle"), "var a=1;");
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("passes when the key is nowhere in the app, or there is no env file or key", () => {
    expect(guard("assert_key_value_absent", [bundle, envfile]).status).toBe(0);
    writeFileSync(envfile, "OTHER=1\n");
    expect(guard("assert_key_value_absent", [bundle, envfile]).status).toBe(0);
    writeFileSync(envfile, `API_BIBLE_URL=https://x.test\nAPI_BIBLE_KEY="${FAKE}"\n`);
    expect(guard("assert_key_value_absent", [bundle, envfile]).status).toBe(0);
  });

  it("fails when the key's value is in the app under any name, without printing it", () => {
    writeFileSync(envfile, `export API_BIBLE_KEY='${FAKE}'\n`);
    mkdirSync(join(bundle, "assets"));
    writeFileSync(join(bundle, "assets", "x.js"), `const k={EXPO_PUBLIC_WHATEVER:"${FAKE}"};`);
    const { status, output } = guard("assert_key_value_absent", [bundle, envfile]);
    expect(status).not.toBe(0);
    expect(output).toContain("API.Bible key found");
    expect(output).not.toContain(FAKE);
  });
});
