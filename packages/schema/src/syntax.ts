/**
 * The syntax bundle (`syntax.vN.db`): MACULA Greek and Hebrew clause and phrase trees, joined to
 * core's interlinear tokens.
 *
 * Evidence, not explanation. Every value is MACULA's own label, read from the lowfat XML and
 * never inferred, so a word with no role in the source has no role here (CLAUDE.md rule 4). It is
 * a sibling file to core and study rather than tables inside either: it is tens of megabytes, its
 * licence notice must travel with it, and it can be rebuilt or dropped without changing core's
 * bytes.
 *
 * Shape. Each lowfat file is walked depth first and every word (Greek `w`, Hebrew morph `w`) is
 * numbered `t` in that walk. A word group therefore covers one unbroken run of `t`
 * (`start_t`..`end_t`), even when its words are discontinuous in the text, so "the words of this
 * subject" is a range query and needs no membership table. Text order is `(ord, position)` for a
 * joined word and `(ord, word)` for any word.
 *
 * "Who does what to whom" for a verse: the clause nodes (`class = 'cl'`) overlapping the verse's
 * `t` range; their constituents are the child nodes and child words that carry a `role`
 * (`s` subject, `v` verb, `o` object, `io` indirect object, `o2` second object, `p` predicate,
 * `vc` copula, `adv` adverbial, `aux`, and in Hebrew `pp`). `links` adds MACULA's semantic frames
 * (the verb's numbered arguments A0, A1, A2, … pointing at the words that fill them) and its
 * referent chains (`referent`, `subjref`, `participantref`), resolved to `t`.
 *
 * MACULA marks no speaker or addressee, in either language, so there is no table for them.
 */

export const SYNTAX_FORMAT = 1;

export const SYNTAX_LINK_KINDS = ["frame", "referent", "subjref", "participantref"] as const;
export type SyntaxLinkKind = (typeof SYNTAX_LINK_KINDS)[number];

export const SYNTAX_DDL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- One row per MACULA repository. license_notice is LICENSE.md as downloaded at the pinned commit.
CREATE TABLE sources (
  id             INTEGER PRIMARY KEY,
  key            TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  license        TEXT NOT NULL,
  license_notice TEXT NOT NULL,
  attribution    TEXT NOT NULL,
  homepage       TEXT NOT NULL,
  commit_hash    TEXT NOT NULL,
  modifications  TEXT NOT NULL
);

-- Word groups. tag is the element name: 'wg', or what MACULA wrote where its parser could not
-- build a group ('error', 'error_unknown_complex_node', Hebrew 'c'). nominalized is 1 where MACULA
-- marks the clause nominalized (Greek clauseType="nominalized", Hebrew clausetype="nominalized-clause").
CREATE TABLE nodes (
  id          INTEGER PRIMARY KEY,
  parent      INTEGER REFERENCES nodes (id),
  start_t     INTEGER NOT NULL,
  end_t       INTEGER NOT NULL CHECK (end_t >= start_t),
  tag         TEXT NOT NULL,
  class       TEXT,
  role        TEXT,
  rule        TEXT,
  cltype      TEXT,
  nominalized INTEGER NOT NULL CHECK (nominalized IN (0, 1)),
  source      INTEGER NOT NULL REFERENCES sources (id)
);
CREATE INDEX nodes_by_span ON nodes (start_t, end_t);
CREATE INDEX nodes_by_parent ON nodes (parent);

-- Words in tree order. ord and position are core's token key; position is NULL for a word that did
-- not join to a core token (packageSyntax reports how many and why). word is MACULA's own word
-- number within its verse (the n of "JHN 1:1!n"), so unjoined words still sort. A Hebrew word can
-- be several rows, one per morph, in id order. surface is MACULA's text of the word or morph
-- ('' for the article MACULA restores after a preposition, which is not written).
CREATE TABLE words (
  t         INTEGER PRIMARY KEY,
  ord       INTEGER NOT NULL,
  position  INTEGER,
  word      INTEGER NOT NULL,
  macula_id TEXT NOT NULL,
  node      INTEGER REFERENCES nodes (id),
  class     TEXT NOT NULL,
  role      TEXT,
  surface   TEXT NOT NULL,
  english   TEXT
);
CREATE INDEX words_by_token ON words (ord, position);

-- arg is the frame argument ('A0', 'A1', …) for kind 'frame', and '' otherwise.
CREATE TABLE links (
  t        INTEGER NOT NULL REFERENCES words (t),
  kind     TEXT NOT NULL CHECK (kind IN ('frame', 'referent', 'subjref', 'participantref')),
  arg      TEXT NOT NULL,
  target_t INTEGER NOT NULL REFERENCES words (t),
  PRIMARY KEY (t, kind, arg, target_t)
) WITHOUT ROWID;
CREATE INDEX links_by_target ON links (target_t);
`;

export function syntaxFileName(version: number): string {
  return `syntax.v${version}.db`;
}
