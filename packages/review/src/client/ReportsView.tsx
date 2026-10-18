/**
 * Reports (Build 11a): public prayer requests that readers reported. Three reports hide one in the app until John
 * looks. Keep clears its reports so it shows again; Remove hides it for good. Loaded when opened, since each load
 * reads CloudKit.
 */

import { useEffect, useState } from "react";

import type { ReportAction, ReportItem, ReportsResponse } from "../shared/api";
import { fetchReports, postReport } from "./api";

function Item({ item, onDecided }: { item: ReportItem; onDecided: (item: ReportItem) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: ReportAction): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onDecided((await postReport(item.id, action)).item);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const who = item.first_name === "" ? "No name given" : item.first_name;
  return (
    <li className={`debate-position ${item.removed ? "rejected" : item.reports === 0 ? "approved" : "draft"}`}>
      <p className="explanation">{item.text}</p>
      <p className="meta-prose">
        {who} · {item.reports === 1 ? "1 report" : `${item.reports} reports`}
        {item.reasons.length > 0 ? ` · ${item.reasons.join(", ")}` : ""}
      </p>
      <div className="debate-actions">
        {item.removed ? (
          <span className="debate-status">Removed</span>
        ) : item.reports === 0 ? (
          <span className="debate-status">Kept</span>
        ) : (
          <>
            <button type="button" className="act" disabled={busy} aria-label={`Keep: clear the reports on "${item.text.slice(0, 40)}"`} onClick={() => void decide("keep")}>
              Keep
            </button>
            <button type="button" className="act" disabled={busy} aria-label={`Remove: hide "${item.text.slice(0, 40)}" for good`} onClick={() => void decide("remove")}>
              Remove
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

export function ReportsView() {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchReports()
      .then(setData)
      .catch((e: unknown) => setError((e as Error).message));
  }, []);

  if (error !== null) return <p className="muted placeholder">{error}</p>;
  if (data === null) return <p className="muted placeholder">Loading…</p>;
  if (data.state === "unavailable") return <p className="muted placeholder">{data.reason}</p>;

  const replace = (item: ReportItem) => setData((d) => (d === null || d.state !== "ready" ? d : { ...d, items: d.items.map((i) => (i.id === item.id ? item : i)) }));
  const open = data.items.filter((i) => i.reports > 0 && !i.removed).length;
  return (
    <div className="entry">
      <section className="debate" aria-label="Reported prayer requests">
        <header className="debate-head">
          <h2 className="label">Reported prayer requests</h2>
          <span className="meta" role="status">
            {open === 0 ? "Nothing waiting" : `${open} waiting`} · CloudKit {data.environment}
          </span>
        </header>
        {data.items.length === 0 ? (
          <p className="meta-prose">No reports.</p>
        ) : (
          <ol className="plain debate-positions">
            {data.items.map((item) => (
              <Item key={item.id} item={item} onDecided={replace} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
