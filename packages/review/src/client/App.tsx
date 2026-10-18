/**
 * The review surface: queues and items on the left, the entry in the middle,
 * the decision bar under it. Keyboard first — j/k move, 1-5 rate, a approve,
 * r reject — and the server is the authority on every rule: a refused decision
 * shows the server's reason verbatim.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  APPROVAL_MIN_RATING,
  QUEUE_LABELS,
  REVIEW_QUEUES,
  type EntryResponse,
  type MetaResponse,
  type QueueItem,
  type QueueResponse,
  type DebatePassage,
  type DebatesResponse,
  type ReviewQueue,
  type ExtractItem,
  type ExtractsResponse,
  type SummariesResponse,
  type SummaryAction,
  type SummaryItem,
  type TargetReasonKind,
} from "../shared/api";
import { fetchDebates, fetchEntry, fetchMeta, fetchQueue, fetchExtracts, fetchSummaries, postDecision } from "./api";
import { DebatesView, passageAnchor } from "./DebatesView";
import { EntryView } from "./EntryView";
import { ExtractsView, extractAnchor } from "./ExtractsView";
import { ReportsView } from "./ReportsView";
import { FixesList, STATUS_LABEL, SummariesView } from "./SummariesView";
import { entryShortcut, hashFor, routeFromHash, type Route } from "./route";

interface Notice {
  kind: "refused" | "recorded" | "error";
  text: string;
}

function readHash(): Route {
  return routeFromHash(window.location.hash);
}

const REASON_SHORT: Readonly<Record<TargetReasonKind, string>> = {
  debated_claim: "debated",
  model_knowledge_claim: "model knowledge",
  translation_note: "translation note",
  related_passage: "related",
  critical_adversary_flag: "critical flag",
};

const DECIDED: Readonly<Record<SummaryAction, string>> = { approve: "Approved", reject: "Rejected", fix: "Held for a fix" };

function summarizeReasons(item: QueueItem): string {
  const counts = new Map<TargetReasonKind, number>();
  for (const reason of item.reasons) counts.set(reason.kind, (counts.get(reason.kind) ?? 0) + 1);
  return [...counts]
    .map(([kind, count]) =>
      kind === "translation_note" ? REASON_SHORT[kind] : `${count} ${REASON_SHORT[kind]}`,
    )
    .join(" · ");
}

export function App() {
  const [initial] = useState(readHash);
  const [queue, setQueue] = useState<ReviewQueue>(initial.view === "queue" ? initial.queue : "flagged");
  const [verseId, setVerseId] = useState<string | null>(initial.view === "queue" ? initial.verseId : null);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [queueData, setQueueData] = useState<QueueResponse | null>(null);
  const [entry, setEntry] = useState<EntryResponse | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Route["view"]>(initial.view);
  const debatesOpen = view === "debates";
  const summariesOpen = view === "summaries";
  // Build 6: book introductions and grammar terms, each a source's own words cut by rule (rule 2).
  const extractsOpen = view === "extracts";
  // Build 11a: reported prayer requests from CloudKit's public database.
  const reportsOpen = view === "reports";
  const [extracts, setExtracts] = useState<ExtractsResponse | null>(null);
  /** Debates or summaries: no staging entry is on screen. */
  const sideOpen = view !== "queue";
  const [debates, setDebates] = useState<DebatesResponse | null>(null);
  const [summaries, setSummaries] = useState<SummariesResponse | null>(null);
  const [summaryId, setSummaryId] = useState<string | null>(initial.view === "summaries" ? initial.passageId : null);
  const [showFixes, setShowFixes] = useState(false);

  // A typed or pasted hash (#/debates) changes the view without a reload.
  useEffect(() => {
    function onHashChange(): void {
      const route = readHash();
      setNotice(null);
      if (route.view === "debates") {
        setView("debates");
        return;
      }
      if (route.view === "extracts") {
        setView("extracts");
        return;
      }
      if (route.view === "reports") {
        setView("reports");
        return;
      }
      if (route.view === "summaries") {
        setView("summaries");
        if (route.passageId !== null) setSummaryId(route.passageId);
        return;
      }
      setView("queue");
      setQueue(route.queue);
      if (route.verseId !== null) setVerseId(route.verseId);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    fetchDebates()
      .then(setDebates)
      .catch((error: unknown) => setNotice({ kind: "error", text: (error as Error).message }));
  }, []);

  useEffect(() => {
    fetchExtracts()
      .then(setExtracts)
      .catch((error: unknown) => setNotice({ kind: "error", text: (error as Error).message }));
  }, []);

  const replaceExtract = useCallback((item: ExtractItem) => {
    setExtracts((current) =>
      current === null
        ? current
        : {
            groups: current.groups.map((g) => {
              if (g.kind !== item.kind) return g;
              const items = g.items.map((i) => (i.id === item.id ? item : i));
              return { ...g, items, approved: items.filter((i) => i.status === "approved").length };
            }),
          },
    );
  }, []);

  // The pipeline builds the summaries list once per server, which takes minutes: ask again until it is ready.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function load(): void {
      fetchSummaries()
        .then((data) => {
          if (cancelled) return;
          setSummaries(data);
          if (data.state === "loading") timer = setTimeout(load, 5000);
        })
        .catch((error: unknown) => {
          if (!cancelled) setSummaries({ state: "error", error: (error as Error).message });
        });
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const summaryItems = summaries?.state === "ready" ? summaries.items : [];
  const summaryItem =
    summaryItems.find((item) => item.id === summaryId) ??
    summaryItems.find((item) => item.reviewable && (item.status === "pending" || item.status === "fix_changed")) ??
    summaryItems[0] ??
    null;

  const nextSummary = useCallback(
    (from: string) => {
      const at = summaryItems.findIndex((item) => item.id === from);
      setSummaryId(summaryItems[at + 1]?.id ?? from);
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [summaryItems],
  );

  const summaryDecided = useCallback(
    (item: SummaryItem, action: SummaryAction, loggedTo: string) => {
      setSummaries((current) =>
        current?.state === "ready"
          ? { ...current, items: current.items.map((i) => (i.id === item.id ? item : i)) }
          : current,
      );
      setNotice({
        kind: "recorded",
        text: `${DECIDED[action]} ${item.id}. Logged to ${loggedTo}.`,
      });
      nextSummary(item.id);
    },
    [nextSummary],
  );

  const replacePassage = useCallback((passage: DebatePassage) => {
    setDebates((current) =>
      current === null
        ? current
        : { ...current, passages: current.passages.map((p) => (p.id === passage.id ? passage : p)) },
    );
  }, []);

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
    const hash = hashFor(
      view === "debates" || view === "extracts" || view === "reports"
        ? { view }
        : view === "summaries"
          ? { view: "summaries", passageId: summaryItem?.id ?? summaryId }
          : { view: "queue", queue, verseId },
    );
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  }, [view, summaryItem, summaryId, queue, verseId]);

  useEffect(() => {
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
      if (sideOpen || verseId === null || entry?.verse_id !== verseId || busy) return;
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
    [sideOpen, verseId, entry, busy, reason, rating, queue, index, loadQueue],
  );

  useEffect(() => {
    // The entry shortcuts act on the staging entry, which is not on screen in debates or summaries.
    function onKey(event: KeyboardEvent): void {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("textarea, input, select")) {
        if (event.key === "Escape") target.blur();
        if (view === "queue" && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void decide("reject");
        }
        return;
      }
      const shortcut = entryShortcut(view, event.key, event.metaKey || event.ctrlKey || event.altKey);
      if (shortcut === null) return;
      if (shortcut.kind === "rate") {
        setRating(shortcut.rating);
        return;
      }
      event.preventDefault();
      if (shortcut.kind === "move") move(shortcut.delta);
      else void decide(shortcut.action);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, decide, view]);

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
              aria-current={view === "queue" && name === queue ? "true" : undefined}
              onClick={() => {
                setNotice(null);
                setView("queue");
                setQueue(name);
              }}
            >
              <span>{QUEUE_LABELS[name]}</span>
              <span className="count">{meta?.counts[name] ?? ""}</span>
            </button>
          ))}
          <button
            type="button"
            className="queue"
            aria-current={debatesOpen ? "true" : undefined}
            onClick={() => {
              setNotice(null);
              setView("debates");
            }}
          >
            <span>Debate positions</span>
            <span className="count">{debates?.passages.length ?? ""}</span>
          </button>
          <button
            type="button"
            className="queue"
            aria-current={summariesOpen ? "true" : undefined}
            onClick={() => {
              setNotice(null);
              setView("summaries");
            }}
          >
            <span>Passage summaries</span>
            <span className="count">{summaries?.state === "ready" ? summaries.items.length : ""}</span>
          </button>
          <button
            type="button"
            className="queue"
            aria-current={extractsOpen ? "true" : undefined}
            onClick={() => {
              setNotice(null);
              setView("extracts");
            }}
          >
            <span>Extracts</span>
            <span className="count">{extracts?.groups.reduce((n, g) => n + g.items.length, 0) ?? ""}</span>
          </button>
          <button
            type="button"
            className="queue"
            aria-current={reportsOpen ? "true" : undefined}
            onClick={() => {
              setNotice(null);
              setView("reports");
            }}
          >
            <span>Reports</span>
          </button>
        </nav>

        {extractsOpen ? (
          <ol className="items">
            {(extracts?.groups ?? []).map((group) => (
              <li key={group.kind}>
                <button
                  type="button"
                  className="item"
                  onClick={() => {
                    const first = group.items[0];
                    if (first !== undefined) document.getElementById(extractAnchor(first))?.scrollIntoView({ block: "start" });
                  }}
                >
                  <span className="item-ref">{group.title}</span>
                  <span className="meta">
                    {group.approved} of {group.items.length} approved
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        {debatesOpen ? (
          <ol className="items">
            {(debates?.passages ?? []).map((passage) => (
              <li key={passage.id}>
                <button
                  type="button"
                  className="item"
                  onClick={() =>
                    document.getElementById(passageAnchor(passage.id))?.scrollIntoView({ block: "start" })
                  }
                >
                  <span className="item-ref">{passage.display_ref}</span>
                  <span className="meta">{passage.counter}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        {summariesOpen ? (
          <button
            type="button"
            className="queue"
            aria-current={showFixes ? "true" : undefined}
            onClick={() => {
              setNotice(null);
              setShowFixes(!showFixes);
            }}
          >
            <span>Fixes</span>
            <span className="count">
              {summaryItems.filter((item) => item.status === "fix" || item.status === "fix_changed").length}
            </span>
          </button>
        ) : null}

        {summariesOpen ? (
          <ol className="items">
            {summaryItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="item"
                  aria-current={!showFixes && item.id === summaryItem?.id ? "true" : undefined}
                  onClick={() => {
                    setNotice(null);
                    setShowFixes(false);
                    setSummaryId(item.id);
                  }}
                >
                  <span className="item-ref">{item.label}</span>
                  <span className="meta">
                    {item.id} · {item.reviewable ? STATUS_LABEL[item.status] : "not reviewable"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        {!sideOpen && queueData?.queue === queue && queueData.sample !== null ? (
          <p className="meta rail-note">
            Seed “{queueData.sample.seed}” · {Math.round(queueData.sample.rate * 100)}% of each book, at least
            one
          </p>
        ) : null}
        {!sideOpen && queue === "adversary_disagreement" ? (
          <p className="meta rail-note">Critical first.</p>
        ) : null}

        {sideOpen ? null : (
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
                  {queue === "targeted_expert" ? (
                    <span className="meta">{summarizeReasons(item)}</span>
                  ) : null}
                </button>
              </li>
            ))}
            {queueData?.queue === queue && items.length === 0 ? (
              <li className="meta empty">Nothing in this queue.</li>
            ) : null}
          </ol>
        )}

        <footer className="rail-foot meta">
          {sideOpen ? null : <div>j / k move · 1–5 rate · a approve · r reject</div>}
          {meta !== null ? (
            <div className="path" title={meta.db_path}>
              {meta.db_path}
            </div>
          ) : null}
        </footer>
      </aside>

      <main className="main">
        <div className="scroll" ref={scrollRef}>
          {reportsOpen ? (
            <ReportsView />
          ) : extractsOpen ? (
            extracts !== null ? (
              <ExtractsView groups={extracts.groups} onDecided={replaceExtract} />
            ) : (
              <p className="muted placeholder">{notice?.text ?? "Loading…"}</p>
            )
          ) : summariesOpen && showFixes ? (
            <FixesList
              items={summaryItems}
              onOpen={(id) => {
                setShowFixes(false);
                setSummaryId(id);
              }}
            />
          ) : summariesOpen ? (
            summaryItem !== null ? (
              <>
                <SummariesView
                  key={summaryItem.id}
                  item={summaryItem}
                  onDecided={summaryDecided}
                  onSkip={() => {
                    setNotice(null);
                    nextSummary(summaryItem.id);
                  }}
                />
                {notice !== null ? (
                  <p className={`notice ${notice.kind}`} role={notice.kind === "recorded" ? "status" : "alert"}>
                    {notice.text}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="muted placeholder">
                {summaries === null || summaries.state === "loading"
                  ? "Building the summaries from the pipeline. This takes a few minutes…"
                  : summaries.state === "error"
                    ? summaries.error
                    : "No flagged summaries."}
              </p>
            )
          ) : debatesOpen ? (
            debates !== null ? (
              <DebatesView
                passages={debates.passages}
                textError={debates.text_error}
                onDecided={replacePassage}
              />
            ) : (
              <p className="muted placeholder">{notice?.text ?? "Loading…"}</p>
            )
          ) : entry !== null ? (
            <EntryView data={entry} />
          ) : (
            <p className="muted placeholder">{verseId === null ? "Nothing selected." : "Loading…"}</p>
          )}
        </div>

        {sideOpen ? null : (
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
        )}
      </main>
    </div>
  );
}
