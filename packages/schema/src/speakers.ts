/**
 * The speakers bundle (`speakers.vN.db`): who Glyssen's control files say speaks in each verse,
 * from SIL and Faith Comes By Hearing's character data for dramatised audio Bibles.
 *
 * Evidence, not explanation. Every row is a line of CharacterVerse.txt or CharacterDetail.txt
 * copied as published, with no speaker, addressee, gender or age inferred (CLAUDE.md rule 4): an
 * empty field in the file is NULL here, not Glyssen's in-code default. A sibling file to core,
 * study and syntax, so the MIT notice travels with the data and the file can be rebuilt or dropped
 * without changing core's bytes.
 *
 * How sure a row is. Glyssen's quote type says how its authors expect the words to be spoken, and
 * several types are explicitly not a claim that this character speaks here. `standing` sorts the
 * eleven types into three, so the app can never show a doubtful row as fact:
 *
 *   speaks     Normal, Dialogue, Implicit, ImplicitWithPotentialSelfQuote: the types Glyssen's
 *              CharacterVerse.IsExpected treats as speech it expects to find in the verse.
 *   uncertain  Potential, Rare, Hypothetical, Alternate. Glyssen's own definitions: Potential is
 *              speech in verses some manuscripts lack, or where reading it as speech is a choice;
 *              Rare "cannot be safely assigned automatically"; Hypothetical is "speech not
 *              attributed to a real, historical figure"; Alternate is a speaker who "could
 *              legitimately speak the same lines but is not expected to".
 *   reported   Indirect, Quotation, Interruption: words reported, quoted from elsewhere, or a
 *              parenthesis, not the character speaking in the scene.
 *
 * Character IDs are Glyssen's, as written ("woman, Samaritan", "Peter (Simon)"). An ID with "/"
 * ("priests/Levites") is Glyssen's multi-character ID: alternatives, or a group whose members may
 * speak, and the file does not say which. It is kept whole, kind 'multiple', and its parts are
 * listed in `character_parts` so a query can find "Levites" in it; it is never split into speakers.
 */

export const SPEAKERS_FORMAT = 1;

/** Glyssen's QuoteType enum (GlyssenCharacters/CharacterVerse.cs), in its order. */
export const GLYSSEN_QUOTE_TYPES = [
  "Normal",
  "Implicit",
  "ImplicitWithPotentialSelfQuote",
  "Dialogue",
  "Indirect",
  "Potential",
  "Hypothetical",
  "Quotation",
  "Interruption",
  "Alternate",
  "Rare",
] as const;
export type GlyssenQuoteType = (typeof GLYSSEN_QUOTE_TYPES)[number];

/** CharacterVerse.cs QuotePosition, in its order. */
export const GLYSSEN_QUOTE_POSITIONS = ["Unspecified", "StartOfVerse", "EndOfVerse", "ContainedWithinVerse", "EntireVerse"] as const;
export type GlyssenQuotePosition = (typeof GLYSSEN_QUOTE_POSITIONS)[number];

export const SPEAKER_STANDINGS = ["speaks", "uncertain", "reported"] as const;
export type SpeakerStanding = (typeof SPEAKER_STANDINGS)[number];

export const QUOTE_TYPE_STANDING: Readonly<Record<GlyssenQuoteType, SpeakerStanding>> = {
  Normal: "speaks",
  Dialogue: "speaks",
  Implicit: "speaks",
  ImplicitWithPotentialSelfQuote: "speaks",
  Potential: "uncertain",
  Rare: "uncertain",
  Hypothetical: "uncertain",
  Alternate: "uncertain",
  Indirect: "reported",
  Quotation: "reported",
  Interruption: "reported",
};

/**
 * character    one character or group CharacterDetail.txt describes
 * multiple     a "/" ID: alternatives or a group (see the file comment)
 * narrator     "narrator-JHN": the book's narrator, which Glyssen lists for quotations it reads
 * interruption "interruption-JHN": a narrator's parenthesis inside speech (John 4:25)
 * needs_review "Needs Review": Glyssen's marker for a passage its authors could not assign
 * scripture    "scripture": a quotation of Scripture, with no speaker named
 */
export const CHARACTER_KINDS = ["character", "multiple", "narrator", "interruption", "needs_review", "scripture"] as const;
export type CharacterKind = (typeof CHARACTER_KINDS)[number];

export const SPEAKERS_DDL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- One row: Glyssen. license_notice is the repository's LICENSE as downloaded at the pinned commit;
-- copyright is the LICENSE's copyright line and the GlyssenCharacters.csproj <Copyright>, one per line.
CREATE TABLE sources (
  id             INTEGER PRIMARY KEY,
  key            TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  license        TEXT NOT NULL,
  license_notice TEXT NOT NULL,
  copyright      TEXT NOT NULL,
  attribution    TEXT NOT NULL,
  homepage       TEXT NOT NULL,
  commit_hash    TEXT NOT NULL,
  modifications  TEXT NOT NULL
);

-- Every character ID either file names. The detail columns are CharacterDetail.txt's, NULL where
-- the file leaves them empty or does not list the ID (in_detail = 0: narrators, "/" IDs, the
-- markers). max_speakers is the file's number; -1 is how it writes "any number".
CREATE TABLE characters (
  id                INTEGER PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  kind              TEXT NOT NULL CHECK (kind IN ('character', 'multiple', 'narrator', 'interruption', 'needs_review', 'scripture')),
  in_detail         INTEGER NOT NULL CHECK (in_detail IN (0, 1)),
  max_speakers      INTEGER,
  gender            TEXT,
  age               TEXT,
  comment           TEXT,
  reference_comment TEXT,
  fcbh_character    TEXT
);

-- The parts of a 'multiple' ID, in the order written. A part is itself a character row.
CREATE TABLE character_parts (
  character INTEGER NOT NULL REFERENCES characters (id),
  position  INTEGER NOT NULL,
  part      INTEGER NOT NULL REFERENCES characters (id),
  PRIMARY KEY (character, position)
) WITHOUT ROWID;
CREATE INDEX character_parts_by_part ON character_parts (part);

-- One row per CharacterVerse.txt line per verse: a line for "EZR 9:6-15" is ten rows. ord is core's
-- verseOrd of Glyssen's English-versification reference. line is the 1-based line in the file, so
-- every row can be traced back. delivery is Glyssen's delivery note as written ("to crowd",
-- "praying"); delivery_to is the X of a note that reads "to X", "speaking to X", "saying to X",
-- "said to X" or "talking to X", and nothing else: it is part of the delivery note, not an
-- addressee Glyssen records. standing is QUOTE_TYPE_STANDING[quote_type].
CREATE TABLE verse_speakers (
  ord               INTEGER NOT NULL,
  line              INTEGER NOT NULL,
  character         INTEGER NOT NULL REFERENCES characters (id),
  quote_type        TEXT NOT NULL,
  standing          TEXT NOT NULL CHECK (standing IN ('speaks', 'uncertain', 'reported')),
  delivery          TEXT,
  delivery_to       TEXT,
  alias             TEXT,
  default_character TEXT,
  parallel_passage  TEXT,
  quote_position    TEXT,
  PRIMARY KEY (ord, line)
) WITHOUT ROWID;
CREATE INDEX verse_speakers_by_character ON verse_speakers (character, ord);
`;

export function speakersFileName(version: number): string {
  return `speakers.v${version}.db`;
}
