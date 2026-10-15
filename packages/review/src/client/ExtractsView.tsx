/**
 * Extracts (build 6): book introductions and grammar terms. Each item shows the text the app would show,
 * then the paragraph it was cut from, so John checks the cut word for word, then Approve or Reject. He
 * writes nothing; the server is the authority on every rule.
 */

import { useState } from "react";

import type { ExtractAction, ExtractGroup, ExtractItem } from "../shared/api";
import { postExtract } from "./api";

export function extractAnchor(item: Pick<ExtractItem, "kind" | "id">): string {
  return `extract-${item.kind}-${item.id.replace(/[^\w-]/g, "_")}`;
}

function Item({ item, onDecided }: { item: ExtractItem; onDecided: (item: ExtractItem) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: ExtractAction): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onDecided((await postExtract(item.kind, item.id, action, item.text_sha256)).item);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li id={extractAnchor(item)} className={`debate-position ${item.status}`}>
      <h3 className="label">{item.title}</h3>
      <p className="explanation">{item.text}</p>
      {item.context !== item.text ? <p className="meta-prose">From: {item.context}</p> : null}
      <p className="meta-prose">{item.ref}</p>
      {item.note !== null ? <p className="meta-prose">Note: {item.note}</p> : null}
      <div className="debate-actions">
        {item.status === "draft" ? (
          <>
            <button type="button" className="act" disabled={busy} aria-label={`Approve ${item.title}`} onClick={() => void decide("approve")}>
              Approve
            </button>
            <button type="button" className="act" disabled={busy} aria-label={`Reject ${item.title}`} onClick={() => void decide("reject")}>
              Reject
            </button>
          </>
        ) : (
          <>
            <span className="debate-status">{item.status === "approved" ? "Approved" : "Rejected"}</span>
            <button type="button" className="act" disabled={busy} aria-label={`Undo, return ${item.title} to draft`} onClick={() => void decide("undo")}>
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

export function ExtractsView({ groups, onDecided }: { groups: ExtractGroup[]; onDecided: (item: ExtractItem) => void }) {
  return (
    <div className="entry">
      {groups.map((group) => (
        <section key={group.kind} className="debate" aria-label={group.title}>
          <header className="debate-head">
            <h2 className="label">{group.title}</h2>
            <span className="meta" role="status">
              {group.approved} of {group.items.length} approved
            </span>
          </header>
          <ol className="plain debate-positions">
            {group.items.map((item) => (
              <Item key={item.id} item={item} onDecided={onDecided} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
