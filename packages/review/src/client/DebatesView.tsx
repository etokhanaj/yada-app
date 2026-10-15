/**
 * Debate positions: one section per passage, its BSB text, then each position
 * as the reader would see it, with Approve and Reject. John writes nothing the
 * app shows; he judges each source's sentence and names the side it holds, an
 * internal label, and where a passage asks two questions (Hosea 1:2), the axis
 * it answers. The server is the authority on every rule.
 */

import { useState } from "react";

import {
  CHECK_NOTE,
  SIDE_MAX_LENGTH,
  type DebatePassage,
  type DebatePosition,
  type PassageVerse,
  type PositionAction,
} from "../shared/api";
import { postPosition } from "./api";

/** Longer ranges open on their first verse, with "Show all". */
const SHORT_RANGE = 3;

const STATUS_LABEL: Readonly<Record<DebatePosition["status"], string>> = {
  draft: "",
  approved: "Approved",
  rejected: "Rejected",
};

export function passageAnchor(id: string): string {
  return `passage-${id}`;
}

/** BSB text for a passage; also used by the summaries view. */
export function Verses({ verses }: { verses: PassageVerse[] }) {
  const [open, setOpen] = useState(false);
  const long = verses.length > SHORT_RANGE;
  const shown = long && !open ? verses.slice(0, 1) : verses;
  const crossesChapter = new Set(verses.map((v) => v.chapter)).size > 1;
  return (
    <div className="debate-verses">
      <p className="scripture">
        {shown.map((v) => (
          <span key={`${v.chapter}.${v.verse}`}>
            <sup className="vnum">{crossesChapter ? `${v.chapter}:${v.verse}` : v.verse}</sup>
            {v.text}{" "}
          </span>
        ))}
      </p>
      {long ? (
        <button type="button" className="act show-all" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Show first verse" : `Show all ${verses.length} verses`}
        </button>
      ) : null}
    </div>
  );
}

/** A short label typed, or one of the passage's sides already in use, taken in one tap. */
function SideField({
  passage,
  n,
  suggested,
  value,
  onChange,
}: {
  passage: DebatePassage;
  n: number;
  /** A draft's machine suggestion, offered like the passage's sides: it fills the field, John still approves. */
  suggested: string | null;
  value: string;
  onChange: (side: string) => void;
}) {
  const choices = suggested === null || passage.sides.includes(suggested) ? passage.sides : [...passage.sides, suggested];
  return (
    <div className="side-field">
      <input
        type="text"
        className="side-input"
        aria-label={`Side position ${n} holds`}
        placeholder="Side"
        maxLength={SIDE_MAX_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {choices.map((side) => (
        <button
          key={side}
          type="button"
          className="act"
          aria-pressed={value.trim() === side}
          aria-label={`Side ${side} for position ${n}`}
          onClick={() => onChange(side)}
        >
          {side}
        </button>
      ))}
    </div>
  );
}

/** The question an approved position answers: typed, or one of the passage's axes or the suggestion in one tap. */
function AxisField({
  passage,
  n,
  suggested,
  value,
  onChange,
}: {
  passage: DebatePassage;
  n: number;
  suggested: string | null;
  value: string;
  onChange: (axis: string) => void;
}) {
  const choices = suggested === null || passage.axes.includes(suggested) ? passage.axes : [...passage.axes, suggested];
  return (
    <div className="side-field">
      <input
        type="text"
        className="side-input"
        aria-label={`Question position ${n} answers; leave empty for the passage's one question`}
        placeholder="Axis"
        maxLength={SIDE_MAX_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {choices.map((axis) => (
        <button
          key={axis}
          type="button"
          className="act"
          aria-pressed={value.trim() === axis}
          aria-label={`Axis ${axis} for position ${n}`}
          onClick={() => onChange(axis)}
        >
          {axis}
        </button>
      ))}
    </div>
  );
}

function Position({
  passage,
  position,
  onDecided,
}: {
  passage: DebatePassage;
  position: DebatePosition;
  onDecided: (passage: DebatePassage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState("");
  const [retagging, setRetagging] = useState(false);
  const [axis, setAxis] = useState("");
  const [settingAxis, setSettingAxis] = useState(false);
  const n = position.index + 1;
  const tagging = position.status === "approved" && (position.side === null || retagging);

  async function decide(action: PositionAction): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const label =
        action === "approve" || action === "side" ? { side: side.trim() } : action === "axis" ? { axis: axis.trim() } : undefined;
      const result = await postPosition(passage.id, position.index, action, position.text_sha256, label);
      setSide("");
      setRetagging(false);
      setAxis("");
      setSettingAxis(false);
      onDecided(result.passage);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`debate-position ${position.status}`}>
      <p className="explanation">{position.text}</p>
      <p className="meta-prose">
        {position.source}
        {position.held_by === null ? "" : ` · held by ${position.held_by}`}
      </p>
      {position.check ? <p className="meta-prose">{CHECK_NOTE}</p> : null}
      {position.status === "draft" || tagging ? (
        <SideField
          passage={passage}
          n={n}
          suggested={position.status === "draft" ? position.side_suggested : null}
          value={side}
          onChange={setSide}
        />
      ) : null}
      {settingAxis ? <AxisField passage={passage} n={n} suggested={position.axis_suggested} value={axis} onChange={setAxis} /> : null}
      <div className="debate-actions">
        {position.status === "draft" ? (
          <>
            <button
              type="button"
              className="act"
              disabled={busy || side.trim() === ""}
              aria-label={`Approve position ${n}`}
              onClick={() => void decide("approve")}
            >
              Approve
            </button>
            <button
              type="button"
              className="act"
              disabled={busy}
              aria-label={`Reject position ${n}`}
              onClick={() => void decide("reject")}
            >
              Reject
            </button>
          </>
        ) : (
          <>
            <span className="debate-status">
              {STATUS_LABEL[position.status]}
              {position.status === "approved" ? (position.side === null ? " · needs a side" : ` · ${position.side}`) : ""}
              {position.status === "approved" && position.axis !== null ? ` · axis: ${position.axis}` : ""}
            </span>
            {tagging ? (
              <button
                type="button"
                className="act"
                disabled={busy || side.trim() === ""}
                aria-label={`Set the side of position ${n}`}
                onClick={() => void decide("side")}
              >
                Set side
              </button>
            ) : null}
            {tagging && position.side_suggested !== null ? (
              <button
                type="button"
                className="act"
                disabled={busy}
                aria-label={`Accept the suggested side ${position.side_suggested} for position ${n}`}
                onClick={() => void decide("accept-suggestion")}
              >
                Accept “{position.side_suggested}”
              </button>
            ) : null}
            {position.status === "approved" && position.side !== null && !retagging ? (
              <button
                type="button"
                className="act"
                disabled={busy}
                aria-label={`Change the side of position ${n}`}
                onClick={() => setRetagging(true)}
              >
                Change side
              </button>
            ) : null}
            {position.status === "approved" && position.axis === null && position.axis_suggested !== null && !settingAxis ? (
              <button
                type="button"
                className="act"
                disabled={busy}
                aria-label={`Accept the suggested axis ${position.axis_suggested} for position ${n}`}
                onClick={() => void decide("accept-axis")}
              >
                Accept axis “{position.axis_suggested}”
              </button>
            ) : null}
            {position.status === "approved" && !settingAxis ? (
              <button
                type="button"
                className="act"
                disabled={busy}
                aria-label={`${position.axis === null ? "Set" : "Change"} the axis of position ${n}`}
                onClick={() => {
                  setAxis(position.axis ?? "");
                  setSettingAxis(true);
                }}
              >
                {position.axis === null ? "Set axis" : "Change axis"}
              </button>
            ) : null}
            {settingAxis ? (
              <button
                type="button"
                className="act"
                disabled={busy || axis.trim() === (position.axis ?? "")}
                aria-label={`Save the axis of position ${n}`}
                onClick={() => void decide("axis")}
              >
                Save axis
              </button>
            ) : null}
            <button
              type="button"
              className="act"
              disabled={busy}
              aria-label={`Undo, return position ${n} to draft`}
              onClick={() => void decide("undo")}
            >
              Undo
            </button>
          </>
        )}
      </div>
      {error !== null ? (
        <p className="notice refused" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function DebatesView({
  passages,
  textError,
  onDecided,
}: {
  passages: DebatePassage[];
  textError: string | null;
  onDecided: (passage: DebatePassage) => void;
}) {
  const untagged = passages.flatMap((passage) =>
    passage.positions
      .filter((position) => position.status === "approved" && position.side === null)
      .map((position) => ({ passage, position })),
  );
  return (
    <div className="entry">
      {textError !== null ? <p className="meta">{textError}</p> : null}
      {untagged.length > 0 ? (
        <section className="debate" aria-label="Needs a side">
          <header className="debate-head">
            <h2 className="label">Needs a side</h2>
            <span className="meta">{untagged.length}</span>
          </header>
          <ol className="plain debate-positions">
            {untagged.map(({ passage, position }) => (
              <li key={`${passage.id}.${position.index}`} className="needs-side">
                <p className="meta">{passage.display_ref}</p>
                <ol className="plain">
                  <Position passage={passage} position={position} onDecided={onDecided} />
                </ol>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {passages.map((passage) => (
        <section key={passage.id} id={passageAnchor(passage.id)} className="debate" aria-label={passage.display_ref}>
          <header className="debate-head">
            <h2 className="label">{passage.display_ref}</h2>
            <span className="meta" role="status">
              {passage.counter}
            </span>
          </header>
          {passage.sides.length > 0 ? <p className="meta">Sides: {passage.sides.join(" · ")}</p> : null}
          {passage.axes.length > 0 ? <p className="meta">Axes: {passage.axes.join(" · ")}</p> : null}
          <Verses verses={passage.verses} />
          <ol className="plain debate-positions">
            {passage.positions.map((position) => (
              <Position key={position.index} passage={passage} position={position} onDecided={onDecided} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
