/**
 * Recorded-chapter fetching (BA-04, BA-05) against an in-memory file system: the cases the Phase 4
 * review found (12 Oct 2026) — two fetches of one chapter, a stop, the connection lost after launch,
 * a wrong file, a truncated timings file.
 */

import { createHash } from "node:crypto";

import { AudioInfoSchema } from "@yada/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

const disk = new Map<string, Uint8Array>();
const join = (...parts: string[]) => parts.join("/");
/** What each download URL serves, and how: bytes, or a failure. */
const served = new Map<string, Uint8Array | "network">();
let downloads = 0;

vi.mock("expo-file-system", () => {
  class Directory {
    readonly uri: string;
    constructor(...parts: Array<string | Directory>) {
      this.uri = join(...parts.map((p) => (typeof p === "string" ? p : p.uri)));
    }
    create() {}
  }
  class File {
    readonly uri: string;
    readonly parentDirectory: Directory;
    readonly name: string;
    constructor(dir: Directory, name: string) {
      this.parentDirectory = dir;
      this.name = name;
      this.uri = `file://${join(dir.uri, name)}`;
    }
    private get key() {
      return this.uri;
    }
    get exists() {
      return disk.has(this.key);
    }
    delete() {
      disk.delete(this.key);
    }
    move(to: File) {
      disk.set(to.uri, disk.get(this.key) ?? new Uint8Array());
      disk.delete(this.key);
    }
    write(text: string) {
      disk.set(this.key, new TextEncoder().encode(text));
    }
    async text() {
      return new TextDecoder().decode(disk.get(this.key));
    }
    async bytes() {
      return disk.get(this.key) ?? new Uint8Array();
    }
    static createDownloadTask(url: string, to: File, options: { signal?: AbortSignal }) {
      return {
        downloadAsync: async () => {
          // Chapters only: the book's titles file comes down beside its first chapter (LB-08).
          if (!url.includes("-titles")) downloads++;
          // Half the file lands, then the next turn decides: a stop, a lost connection, or the rest.
          disk.set(to.uri, new Uint8Array(1));
          await new Promise((r) => setTimeout(r, 5));
          if (options.signal?.aborted === true) throw new Error("cancelled");
          const body = served.get(url);
          if (body === undefined || body === "network") throw new Error("The Internet connection appears to be offline.");
          disk.set(to.uri, body);
          return to;
        },
      };
    }
  }
  return { Directory, File, Paths: { document: "doc", availableDiskSpace: 1e12 } };
});
vi.mock("./translations", () => ({ MANIFEST_URL: "http://local/manifest.json" }));
// NT-08's notice runs only when Yada is not on screen; under test it is.
vi.mock("expo-notifications", () => ({ getPermissionsAsync: async () => ({ status: "denied" }), scheduleNotificationAsync: async () => undefined }));
vi.mock("react-native", () => ({ AppState: { currentState: "active" } }));
// LS-31's queued download listens for the network; the test holds the listener and calls it as the network would.
let networkListener: ((e: { isInternetReachable?: boolean }) => void) | null = null;
vi.mock("expo-network", () => ({
  addNetworkStateListener: (listener: (e: { isInternetReachable?: boolean }) => void) => {
    networkListener = listener;
    return { remove: () => (networkListener = null) };
  },
}));

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const audio = new Uint8Array([1, 2, 3, 4]);
const timings = JSON.stringify({ format: 1, book: "JHN", chapter: 1, narrator: "heart", duration: 9, verses: [], matched: 1 });
const titlesAudio = new Uint8Array([9, 8, 7]);
const manifest = (audioSha = sha(audio)) => ({
  audio: [
    {
      book: "JHN",
      narrator: "heart",
      narrator_name: "Heart",
      kind: "computer",
      chapters: [
        {
          chapter: 1,
          file: "audio/heart/jhn-001.m4a",
          sha256: audioSha,
          bytes: audio.length,
          timings: "audio/heart/jhn-001.json",
          timings_sha256: sha(new TextEncoder().encode(timings)),
          duration: 9,
        },
      ],
      titles: { file: "audio/heart/jhn-titles.m4a", sha256: sha(titlesAudio), bytes: titlesAudio.length, spans: [{ chapter: 1, start: 0, end: 1.2 }, { chapter: 2, start: 1.5, end: 2.7 }] },
    },
  ],
});

let manifestRequests = 0;
let manifestDown = false;
let currentManifest: unknown = manifest();
vi.stubGlobal("fetch", async (url: string) => {
  if (url.endsWith("manifest.json")) {
    manifestRequests++;
    if (manifestDown) throw new Error("The Internet connection appears to be offline.");
    return { ok: true, json: async () => currentManifest };
  }
  if (url.endsWith(".json")) return { ok: true, text: async () => timings };
  throw new Error(`unexpected ${url}`);
});

const recordings = await import("./recordings");
const { booksFor, ensureChapter, isRecorded, readText, recordingOnPhone, saveStreamed, streamChapter, titleOnPhone, useRecordings } = recordings;
const TITLES = "http://local/audio/heart/jhn-titles.m4a";

const M4A = "http://local/audio/heart/jhn-001.m4a";
// The chapters in Heart's folder; the catalogue copy beside the folders is not a chapter.
const onDisk = () =>
  [...disk.keys()]
    .filter((k) => k.startsWith("file://doc/audio/heart/"))
    .map((k) => k.replace(/^file:\/\/doc\/audio\/heart\//, ""))
    .filter((name) => !name.includes("-titles"))
    .sort();

beforeEach(async () => {
  disk.clear();
  served.clear();
  downloads = 0;
  currentManifest = manifest();
  served.set(M4A, audio);
  served.set(TITLES, titlesAudio);
  await recordings.refreshRecordings();
});

describe("streaming (ST-01, ST-02)", () => {
  // First in the file: a later test swaps the cached manifest for one with a wrong sha256.
  // The player writes the bytes to savePath as they arrive (StreamLoader.swift); this stands in for it.
  const nativeWrites = (savePath: string, bytes: Uint8Array) => disk.set(`file://${savePath}`, bytes);

  it("plays from the server with checked timings and downloads nothing first", async () => {
    const rec = await streamChapter("JHN", 1);
    expect(rec?.path).toBe(M4A);
    expect(rec?.timings.book).toBe("JHN");
    expect(rec?.stream?.savePath).toBe("doc/audio/heart/jhn-001.m4a.stream");
    expect(downloads).toBe(0);
    expect(onDisk()).toEqual([]);
  });

  it("keeps the streamed bytes once they check out, and the chapter then plays from the phone", async () => {
    const rec = await streamChapter("JHN", 1);
    nativeWrites(rec!.stream!.savePath, audio);
    expect(await saveStreamed(rec!)).toBe(true);
    expect(onDisk()).toEqual(["jhn-001.json", "jhn-001.m4a"]);
    const again = await streamChapter("JHN", 1);
    expect(again?.stream).toBeUndefined();
    expect(again?.path).toBe("doc/audio/heart/jhn-001.m4a");
  });

  it("a file that does not match the manifest is deleted and nothing is kept", async () => {
    const rec = await streamChapter("JHN", 1);
    nativeWrites(rec!.stream!.savePath, new Uint8Array([1, 2, 3, 5]));
    expect(await saveStreamed(rec!)).toBe(false);
    expect(onDisk()).toEqual([]);
  });

  it("offline, nothing streams (LS-31 then says so)", async () => {
    manifestDown = true;
    useRecordings.setState({ online: false });
    try {
      expect(await streamChapter("JHN", 1)).toBeNull();
    } finally {
      manifestDown = false;
      useRecordings.setState({ online: true });
    }
  });
});

describe("chapter names (LB-08)", () => {
  it("come down with the book's first chapter and give each chapter's span", async () => {
    await ensureChapter("JHN", 1);
    await vi.waitFor(() => expect(titleOnPhone("JHN", 2)).not.toBeNull());
    expect(titleOnPhone("JHN", 2)).toMatchObject({ start: 1.5, end: 2.7 });
    expect(titleOnPhone("JHN", 3)).toBeNull();
  });

  it("missing on the server is not offline: the reading goes straight to verse 1", async () => {
    served.delete(TITLES);
    await ensureChapter("JHN", 1);
    expect(titleOnPhone("JHN", 1)).toBeNull();
    expect(useRecordings.getState().online).toBe(true);
  });
});

describe("ensureChapter", () => {
  it("fetches, checks and keeps the chapter", async () => {
    const rec = await ensureChapter("JHN", 1);
    expect(rec?.timings.book).toBe("JHN");
    expect(onDisk()).toEqual(["jhn-001.json", "jhn-001.m4a"]);
  });

  it("shares one fetch between the first play and Download John (one .partial)", async () => {
    disk.clear();
    const [a, b] = await Promise.all([ensureChapter("JHN", 1), ensureChapter("JHN", 1)]);
    expect(downloads).toBe(1);
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
  });

  it("a stop leaves no partial file and does not count as offline (BA-04)", async () => {
    disk.clear();
    const abort = new AbortController();
    const pending = ensureChapter("JHN", 1, { signal: abort.signal });
    abort.abort();
    expect(await pending).toBeNull();
    expect(onDisk()).toEqual([]);
    expect(useRecordings.getState().online).toBe(true);
  });

  it("a connection lost after launch says offline and asks for the manifest again (BA-05)", async () => {
    disk.clear();
    served.set(M4A, "network");
    manifestDown = true;
    expect(await ensureChapter("JHN", 1)).toBeNull();
    expect(onDisk()).toEqual([]);
    expect(useRecordings.getState().online).toBe(false);
    manifestDown = false;
    const before = manifestRequests;
    served.set(M4A, audio);
    expect(await ensureChapter("JHN", 1)).not.toBeNull();
    expect(manifestRequests).toBe(before + 1);
  });

  it("a listed chapter the server lacks is not offline when the manifest still answers (UX pass, 15 Oct 2026)", async () => {
    disk.clear();
    served.delete(M4A);
    expect(await ensureChapter("JHN", 1)).toBeNull();
    expect(useRecordings.getState().online).toBe(true);
  });

  it("a file that is not the one listed is refused, and is not the connection", async () => {
    disk.clear();
    currentManifest = manifest("0".repeat(64));
    // The beforeEach refresh cached the good manifest: lose it so this one is read.
    served.set(M4A, "network");
    await ensureChapter("JHN", 1);
    served.set(M4A, audio);
    expect(await ensureChapter("JHN", 1)).toBeNull();
    expect(onDisk()).toEqual([]);
    expect(useRecordings.getState().online).toBe(true);
  });
});

describe("recordingOnPhone", () => {
  it("treats a truncated timings file as no recording rather than throwing", async () => {
    await ensureChapter("JHN", 1);
    disk.set("file://doc/audio/heart/jhn-001.json", new TextEncoder().encode('{"format":1,"bo'));
    expect(await recordingOnPhone("JHN", 1)).toBeNull();
  });
});

describe("offline after a launch that saw the manifest", () => {
  it("still knows each reading's name and kind, from the copy kept on the phone (review, 12 Oct 2026)", async () => {
    // One launch online reads the manifest and keeps a copy; the next has no way to reach it.
    vi.resetModules();
    await (await import("./recordings")).refreshRecordings();
    manifestDown = true;
    try {
      vi.resetModules();
      const fresh = await import("./recordings");
      await fresh.refreshRecordings();
      const [reading] = fresh.useRecordings.getState().all;
      expect(fresh.useRecordings.getState().online).toBe(false);
      expect(reading?.narrator_name).toBe("Heart");
      expect(fresh.useRecordings.getState().books["BSB/JHN"]?.narrator).toBe("heart");
    } finally {
      manifestDown = false;
    }
  });
});

describe("which readings are offered", () => {
  it("offers Heart and George, Heart first, and never a human reading the manifest still lists (John, 13 Oct 2026)", async () => {
    const entry = (narrator: string, narrator_name: string, kind: string) => ({ ...manifest().audio[0], narrator, narrator_name, kind });
    currentManifest = { audio: [entry("hays", "Barry Hays", "human"), entry("george", "George", "computer"), entry("heart", "Heart", "computer")] };
    vi.resetModules();
    const fresh = await import("./recordings");
    await fresh.refreshRecordings();
    expect(fresh.useRecordings.getState().all.map((a) => a.narrator)).toEqual(["heart", "george"]);
    expect(fresh.useRecordings.getState().books["BSB/JHN"]?.narrator).toBe("heart");
  });
});

describe("a voice no longer offered", () => {
  it("becomes Heart when a phone had chosen Barry Hays (review, 13 Oct 2026)", () => {
    recordings.setNarrator("hays");
    expect(useRecordings.getState().narrator).toBe("heart");
    recordings.setNarrator("george");
    expect(useRecordings.getState().narrator).toBe("george");
    recordings.setNarrator("heart");
  });
});

describe("the WEB, KJV and LSV readings (LB-09–11)", () => {
  const webAudio = new Uint8Array([5, 5, 5]);
  const web = {
    book: "JHN",
    translation: "WEB",
    narrator: "heart",
    narrator_name: "Heart",
    kind: "computer",
    chapters: [
      {
        chapter: 1,
        file: "audio/heart/web/jhn-001.m4a",
        sha256: sha(webAudio),
        bytes: webAudio.length,
        timings: "audio/heart/web/jhn-001.json",
        timings_sha256: sha(new TextEncoder().encode(timings)),
        duration: 9,
      },
    ],
  };

  it("a manifest with the BSB only behaves as before: no WEB reading, the BSB one plays", async () => {
    expect(isRecorded("JHN", 1)).toBe(true);
    expect(isRecorded("JHN", 1, "WEB")).toBe(false);
    expect(await ensureChapter("JHN", 1, {}, "WEB")).toBeNull();
  });

  it("each text plays its own reading, filed under its own folder", async () => {
    disk.clear();
    currentManifest = { audio: [...manifest().audio, web] };
    served.set("http://local/audio/heart/web/jhn-001.m4a", webAudio);
    served.set(M4A, "network");
    await ensureChapter("JHN", 1);
    served.set(M4A, audio);
    expect(isRecorded("JHN", 1, "WEB")).toBe(true);
    const rec = await ensureChapter("JHN", 1, {}, "WEB");
    expect(rec?.text).toBe("WEB");
    expect([...disk.keys()].some((k) => k.endsWith("audio/heart/web/jhn-001.m4a"))).toBe(true);
    expect((await recordingOnPhone("JHN", 1, "WEB"))?.text).toBe("WEB");
    expect(await recordingOnPhone("JHN", 1, "KJV")).toBeNull();
  });

  it("the voice choice applies only where both voices read the text", () => {
    const heart = AudioInfoSchema.parse(manifest().audio[0]);
    const george = { ...heart, narrator: "george", narrator_name: "George" };
    const books = booksFor([heart, george, AudioInfoSchema.parse(web)], "george");
    expect(books["BSB/JHN"]?.narrator).toBe("george");
    expect(books["WEB/JHN"]?.narrator).toBe("heart");
  });

  it("no voice ever reads a licensed version (rule 9)", () => {
    for (const code of ["NIV", "NKJV", "NLT", "MSG"]) expect(readText(code)).toBeNull();
    expect(readText("KJV")).toBe("KJV");
  });
});

describe("Download when online (LS-31)", () => {
  it("waits for the network to come back, then downloads the book", async () => {
    useRecordings.setState({ online: false });
    recordings.downloadWhenOnline("JHN");
    expect(networkListener).not.toBeNull();
    networkListener?.({ isInternetReachable: false });
    expect(onDisk()).toEqual([]);
    networkListener?.({ isInternetReachable: true });
    await vi.waitFor(() => expect(onDisk()).toEqual(["jhn-001.json", "jhn-001.m4a"]));
    expect(networkListener).toBeNull();
  });

  it("downloads at once when online", async () => {
    recordings.downloadWhenOnline("JHN");
    await vi.waitFor(() => expect(onDisk()).toEqual(["jhn-001.json", "jhn-001.m4a"]));
  });
});
