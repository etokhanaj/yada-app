/**
 * Passage summaries: one flagged summary at a time, its BSB text, the summary as built, the gate's flags,
 * then Approve, Reject, Needs a fix or Skip. John edits nothing (rule 2): his only words are the fix note, which
 * stays in passage_reviews.json for the pipeline session and never reaches the app. The server is the authority
 * on every rule.
 */

import { useState } from "react";

import { FIX_NOTE_MAX, REJECTED_REASON, type SummaryAction, type SummaryItem, type SummaryStatus } from "../shared/api";
import { postSummary } from "./api";
import { Verses } from "./DebatesView";

export const STATUS_LABEL: Readonly<Record<SummaryStatus, string>> = {
  pending: "Not reviewed",
  approved: "Approved · shows in the app",
  changed: "Approved, but the text has changed since · hidden",
  held: "Held · hidden",
  fix: "Needs a fix · hidden",
  fix_changed: "Not reviewed · changed since your note",
};

/** Read-only: every summary held for a fix, with its note. The pipeline session's work list. */
export function FixesList({ items, onOpen }: { items: SummaryItem[]; onOpen: (id: string) => void }) {
  const fixes = items.filter((item) => item.status === "fix" || item.status === "fix_changed");
  return (
    <div className="entry">
      <section className="debate" aria-label="Fixes">
        <header className="debate-head">
          <h2 className="label">Fixes</h2>
          <span className="meta">{fixes.length}</span>
        </header>
        {fixes.length === 0 ? (
          <p className="meta-prose">None.</p>
        ) : (
          <ul className="plain">
            {fixes.map((item) => (
              <li key={item.id} className="fix-row">
                <button type="button" className="act" onClick={() => onOpen(item.id)}>
                  {item.label}
                </button>
                <span className="meta">
                  {item.id}
                  {item.status === "fix_changed" ? " · changed since your note" : ""}
                </span>
                <p className="meta-prose">{item.fix}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function SummariesView({
  item,
  onDecided,
  onSkip,
}: {
  item: SummaryItem;
  onDecided: (item: SummaryItem, action: SummaryAction, loggedTo: string) => void;
  onSkip: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const [note, setNote] = useState(item.status === "fix" ? (item.fix ?? "") : "");

  async function decide(action: SummaryAction): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postSummary(item.id, action, item.text_sha256, action === "fix" ? note : undefined);
      onDecided(result.item, action, result.logged_to);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const rejected = item.status === "held" && item.reason === REJECTED_REASON;
  return (
    <div className="entry">
      <section className="debate" aria-label={item.label}>
        <header className="debate-head">
          <h2 className="label">{item.label}</h2>
          <span className="meta">{item.id}</span>
        </header>
        <Verses verses={item.verses} />
        <p className="explanation">{item.text === "" ? "No summary text." : item.text}</p>
        <ul className="plain">
          {item.flags.map((flag) => (
            <li key={flag} className="meta-prose">
              {flag}
            </li>
          ))}
        </ul>
        <p className="meta" role="status">
          {STATUS_LABEL[item.status]}
          {item.reason === null || item.fix !== null ? "" : ` · “${item.reason}”`}
        </p>
        {item.fix !== null ? <p className="meta-prose">Your note: {item.fix}</p> : null}
        {item.reviewable ? null : (
          <p className="meta-prose">Built on a path that never reads passage_reviews.json: a decision would change nothing.</p>
        )}
        <div className="debate-actions">
          {item.reviewable ? (
            <>
              <button
                type="button"
                className="act"
                disabled={busy || item.status === "approved"}
                aria-label={`Approve the summary of ${item.label}`}
                onClick={() => void decide("approve")}
              >
                Approve
              </button>
              <button
                type="button"
                className="act"
                disabled={busy || rejected}
                aria-label={`Reject the summary of ${item.label}`}
                onClick={() => void decide("reject")}
              >
                Reject
              </button>
              <button
                type="button"
                className="act"
                disabled={busy}
                aria-expanded={fixing}
                aria-label={`Mark the summary of ${item.label} as needing a fix`}
                onClick={() => setFixing(!fixing)}
              >
                Needs a fix
              </button>
            </>
          ) : null}
          <button type="button" className="act" disabled={busy} onClick={onSkip}>
            Skip
          </button>
        </div>
        {item.reviewable && fixing ? (
          <form
            className="fix-note"
            onSubmit={(event) => {
              event.preventDefault();
              void decide("fix");
            }}
          >
            <textarea
              className="reason"
              rows={2}
              maxLength={FIX_NOTE_MAX}
              aria-label="What the pipeline should change"
              placeholder="What the pipeline should change"
              value={note}
              autoFocus
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="buttons">
              <button type="submit" className="act" disabled={busy || note.trim() === ""}>
                Hold for a fix
              </button>
              <button type="button" className="act" disabled={busy} onClick={() => setFixing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
        {error !== null ? (
          <p className="notice refused" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
