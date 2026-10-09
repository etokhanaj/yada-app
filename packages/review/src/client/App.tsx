/**
 * The review surface: queues and items on the left, the entry in the middle,
 * the decision bar under it. Keyboard first — j/k move, 1-5 rate, a approve,
 * r reject — and the server is the authority on every rule: a refused decision
 * shows the server's reason verbatim.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  APPROVAL_MIN_RATING,
  isReviewQueue,
  QUEUE_LABELS,
  REVIEW_QUEUES,
  type EntryResponse,
  type MetaResponse,
  type QueueItem,
  type QueueResponse,
  type ReviewQueue,
  type TargetReasonKind,
} from "../shared/api";
import { fetchEntry, fetchMeta, fetchQueue, postDecision } from "./api";
import { EntryView } from "./EntryView";

interface Notice {
  kind: "refused" | "recorded" | "error";
  text: string;
}

function readHash(): { queue: ReviewQueue; verseId: string | null } {
  const [, queue, verse] = window.location.hash.replace(/^#/, "").split("/");
  return {
    queue: isReviewQueue(queue) ? queue : "flagged",
    verseId: verse === undefined || verse === "" ? null : decodeURIComponent(verse),
  };
}

const REASON_SHORT: Readonly<Record<TargetReasonKind, string>> = {
  debated_claim: "debated",
  model_knowledge_claim: "model knowledge",
  translation_note: "translation note",
  related_passage: "related",
  critical_adversary_flag: "critical flag",
};

function summarizeReasons(item: QueueItem): string {
  const counts = new Map<TargetReasonKind, number>();
  for (const reason of item.reasons) counts.set(reason.kind, (counts.get(reason.kind) ?? 0) + 1);
  return [...counts]
    .map(([kind, count]) => (kind === "translation_note" ? REASON_SHORT[kind] : `${count} ${REASON_SHORT[kind]}`))
    .join(" · ");
}

export function App() {
  const [queue, setQueue] = useState<ReviewQueue>(() => readHash().queue);
  const [verseId, setVerseId] = useState<string | null>(() => readHash().verseId);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [queueData, setQueueData] = useState<QueueResponse | null>(null);
  const [entry, setEntry] = useState<EntryResponse | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = queueData?.queue === queue ? queueData.items : [];
  const index = verseId === null ? -1 : items.findIndex((item) => item.verse_id === verseId);

  const loadQueue = useCallback(async (name: ReviewQueue): Promise<QueueResponse | null> => {
    try {
      const [data, freshMeta] = await Promise.all([fetchQueue(name), fetchMeta()]);
      setQueueData(data);
      setMeta(freshMeta);
      return data;
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadQueue(queue).then((data) => {
      if (cancelled || data === null) return;
      setVerseId((current) =>
        current !== null && data.items.some((item) => item.verse_id === current)
          ? current
          : (data.items[0]?.verse_id ?? null),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [queue, loadQueue]);

  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      `#/${queue}${verseId === null ? "" : `/${encodeURIComponent(verseId)}`}`,
    );
    setRating(null);
    setReason("");
    if (verseId === null) {
      setEntry(null);
      return;
    }
    let cancelled = false;
    fetchEntry(verseId)
      .then((data) => {
        if (cancelled) return;
        setEntry(data);
        scrollRef.current?.scrollTo({ top: 0 });
      })
      .catch((error: unknown) => {
        if (!cancelled) setNotice({ kind: "error", text: (error as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [verseId, queue]);

  const select = useCallback((id: string | null) => {
    setNotice(null);
    setVerseId(id);
  }, []);

  const move = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      const next = index === -1 ? 0 : Math.min(items.length - 1, Math.max(0, index + delta));
      const id = items[next]?.verse_id;
      if (id !== undefined && id !== verseId) select(id);
    },
    [items, index, verseId, select],
  );

  const decide = useCallback(
    async (action: "approve" | "reject") => {
      // Never act on an id whose entry is not the one on screen.
      if (verseId === null || entry?.verse_id !== verseId || busy) return;
      if (action === "reject" && reason.trim() === "") {
        setNotice({
          kind: "refused",
          text: "Rejection needs a reason. Say what is wrong, then press ⌘↩ (or Reject).",
        });
        reasonRef.current?.focus();
        return;
      }

      setBusy(true);
      try {
        const result = await postDecision(verseId, action, {
          rating,
          reason: reason.trim() === "" ? null : reason,
          queue,
          payload_sha256: entry.payload_sha256,
        });
        const state = result.state;
        setNotice({
          kind: "recorded",
          text: `${action === "approve" ? "Approved" : "Rejected"} ${verseId}${
            state.rating === null ? "" : `, rated ${state.rating}`
          }. Status ${state.status}. Logged to ${result.logged_to}.`,
        });

        const oldIndex = index;
        const fresh = (await loadQueue(queue))?.items ?? [];
        const stillHere = fresh.findIndex((item) => item.verse_id === verseId);
        const nextId =
          stillHere !== -1
            ? (fresh[stillHere + 1]?.verse_id ?? verseId)
            : (fresh[Math.min(Math.max(oldIndex, 0), fresh.length - 1)]?.verse_id ?? null);

        if (nextId === verseId) {
          setEntry(await fetchEntry(verseId));
          setRating(null);
          setReason("");
        } else {
          setVerseId(nextId);
        }
      } catch (error) {
        setNotice({ kind: "refused", text: (error as Error).message });
      } finally {
        setBusy(false);
      }
    },
    [verseId, entry, busy, reason, rating, queue, index, loadQueue],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("textarea, input, select")) {
        if (event.key === "Escape") target.blur();
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void decide("reject");
        }
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      switch (event.key) {
        case "j":
          event.preventDefault();
          move(1);
          break;
        case "k":
          event.preventDefault();
          move(-1);
          break;
        case "a":
          event.preventDefault();
          void decide("approve");
          break;
        case "r":
          event.preventDefault();
          void decide("reject");
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          setRating(Number(event.key));
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, decide]);

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-head">
          <div className="label">Yada · Review</div>
          {meta !== null ? (
            <div className="meta">
              {meta.total_entries} entries · reviewer {meta.reviewer}
            </div>
          ) : null}
        </div>

        <nav className="queues" aria-label="Queues">
          {REVIEW_QUEUES.map((name) => (
            <button
              key={name}
              type="button"
              className="queue"
              aria-current={name === queue ? "true" : undefined}
              onClick={() => {
                setNotice(null);
                setQueue(name);
              }}
            >
              <span>{QUEUE_LABELS[name]}</span>
              <span className="count">{meta?.counts[name] ?? ""}</span>
            </button>
          ))}
        </nav>

        {queueData?.queue === queue && queueData.sample !== null ? (
          <p className="meta rail-note">
            Seed “{queueData.sample.seed}” · {Math.round(queueData.sample.rate * 100)}% of each book, at
            least one
          </p>
        ) : null}
        {queue === "adversary_disagreement" ? <p className="meta rail-note">Critical first.</p> : null}

        <ol className="items">
          {items.map((item) => (
            <li key={item.verse_id}>
              <button
                type="button"
                className="item"
                aria-current={item.verse_id === verseId ? "true" : undefined}
                onClick={() => select(item.verse_id)}
              >
                <span className="item-ref">{item.display_ref}</span>
                <span className="meta">
                  {item.status}
                  {item.decision === null ? "" : ` · ${item.decision}`}
                  {item.rating === null ? "" : ` · ${item.rating}/5`}
                </span>
                {item.adversary !== null ? (
                  <span className="meta">
                    {item.adversary.critical} critical · {item.adversary.minor} minor ·{" "}
                    {item.adversary.disagreements} total
                  </span>
                ) : null}
                {queue === "targeted_expert" ? <span className="meta">{summarizeReasons(item)}</span> : null}
              </button>
            </li>
          ))}
          {queueData?.queue === queue && items.length === 0 ? (
            <li className="meta empty">Nothing in this queue.</li>
          ) : null}
        </ol>

        <footer className="rail-foot meta">
          <div>j / k move · 1–5 rate · a approve · r reject</div>
          {meta !== null ? (
            <div className="path" title={meta.db_path}>
              {meta.db_path}
            </div>
          ) : null}
        </footer>
      </aside>

      <main className="main">
        <div className="scroll" ref={scrollRef}>
          {entry !== null ? (
            <EntryView data={entry} />
          ) : (
            <p className="muted placeholder">{verseId === null ? "Nothing selected." : "Loading…"}</p>
          )}
        </div>

        <div className="actions" aria-label="Decision">
          <div className="actions-inner">
            {entry !== null ? (
              <div className="meta">
                Now {entry.state.status}
                {entry.state.decision === null ? "" : ` · ${entry.state.decision}`}
                {entry.state.rating === null ? "" : ` · rated ${entry.state.rating}`}
                {entry.state.reason === null ? "" : ` · “${entry.state.reason}”`}
              </div>
            ) : null}
            <div className="actions-row">
              <div className="rating" role="radiogroup" aria-label="Rating">
                <span className="label">Rating</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    className="rate"
                    onClick={() => setRating(rating === n ? null : n)}
                  >
                    {n}
                  </button>
                ))}
                <span className="meta">approve at {APPROVAL_MIN_RATING}+</span>
              </div>
              <textarea
                ref={reasonRef}
                className="reason"
                rows={1}
                placeholder="Reason: required to reject, and it feeds prompt revision"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="buttons">
                <button
                  type="button"
                  className="act"
                  disabled={busy || entry === null}
                  onClick={() => void decide("approve")}
                >
                  Approve <kbd>a</kbd>
                </button>
                <button
                  type="button"
                  className="act"
                  disabled={busy || entry === null}
                  onClick={() => void decide("reject")}
                >
                  Reject <kbd>r</kbd>
                </button>
              </div>
            </div>
            {notice !== null ? (
              <p className={`notice ${notice.kind}`} role={notice.kind === "recorded" ? "status" : "alert"}>
                {notice.text}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
