/**
 * One VerseEntry, rendered in the app's order: verse text, what's happening,
 * the two reader groups, then the original, rendering, notes and related
 * passages — with the reviewer's extras (why it was selected, adversary flags,
 * the quality contract, the raw payload) around it.
 *
 * Web-native mirror of apps/mobile Understand.tsx and Claims.tsx; see README
 * for why this is not yet shared through react-native-web.
 */

import { Fragment } from "react";

import type { Claim, EvidenceRef, Finding, VerseEntry } from "@yada/schema";

import { FIRST_SCREEN_CAP, type AdversaryFlag, type EntryResponse } from "../shared/api";
import { Prose, scriptAttrs } from "./Prose";

type Script = EntryResponse["script"];

/** Four categories, two neutral reader groups, each ordered by display_rank. */
export function groupClaims(claims: readonly Claim[]): { seen: Claim[]; differs: Claim[] } {
  const byRank = (a: Claim, b: Claim): number => a.display_rank - b.display_rank;
  return {
    seen: claims.filter((c) => c.category === "text" || c.category === "context").sort(byRank),
    differs: claims
      .filter((c) => c.category === "interpretation" || c.category === "debated")
      .sort(byRank),
  };
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return map;
}

export function EntryView({ data }: { data: EntryResponse }) {
  const { entry } = data;
  const claimIds = new Set(entry?.claims.map((c) => c.id) ?? []);
  const flagsByClaim = groupBy(data.adversary_flags, (f) => f.claim_id);
  const unmatchedFlags = data.adversary_flags.filter((f) => !claimIds.has(f.claim_id));
  const findingsByClaim = groupBy(
    data.findings.filter((f) => f.claimId !== undefined),
    (f) => f.claimId as string,
  );

  return (
    <article className="entry">
      <header className="entry-head">
        <h1 className="label">{data.display_ref}</h1>
        <div className="meta">
          {data.verse_id} · pericope {data.pericope_id} · {data.prompt_version} · schema{" "}
          {data.schema_version}
        </div>
      </header>

      {data.reasons.length > 0 ? (
        <section className="review-band">
          <h2 className="label">Why an expert should see this</h2>
          <ul className="plain tight">
            {data.reasons.map((reason, index) => (
              <li key={index}>
                <Prose as="span" text={reason.detail} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="verse">
        {data.texts.length === 0 ? (
          <p className="muted">No verse text for {data.verse_id} in the texts table.</p>
        ) : (
          data.texts.map((t) => (
            <div className="translation" key={t.translation}>
              <div className="label">{t.translation}</div>
              <p className="scripture">{t.text}</p>
            </div>
          ))
        )}
      </section>

      {entry === null ? (
        <section className="section">
          <h2 className="label">Payload does not parse as a VerseEntry</h2>
          <ul className="plain tight">
            {data.parse_issues.map((issue, index) => (
              <li key={index} className="finding error">
                {issue}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EntryBody
          entry={entry}
          script={data.script}
          flagsByClaim={flagsByClaim}
          findingsByClaim={findingsByClaim}
          unmatchedFlags={unmatchedFlags}
        />
      )}

      <section className="section">
        <h2 className="label">Quality contract · validateVerseEntry</h2>
        {entry === null ? (
          <p className="muted">Not run: the payload did not parse.</p>
        ) : data.findings.length === 0 ? (
          <p className="muted">No findings.</p>
        ) : (
          <ul className="plain tight">
            {data.findings.map((finding, index) => (
              <li key={index}>
                <FindingLine finding={finding} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="section raw">
        <summary className="label">Stored payload</summary>
        <pre dir="ltr">{JSON.stringify(data.payload, null, 2)}</pre>
      </details>
    </article>
  );
}

function EntryBody({
  entry,
  script,
  flagsByClaim,
  findingsByClaim,
  unmatchedFlags,
}: {
  entry: VerseEntry;
  script: Script;
  flagsByClaim: Map<string, AdversaryFlag[]>;
  findingsByClaim: Map<string, Finding[]>;
  unmatchedFlags: AdversaryFlag[];
}) {
  const { seen, differs } = groupClaims(entry.claims);
  const surface = scriptAttrs(script);

  return (
    <>
      <hr className="hairline" />
      <Prose className="explanation" text={entry.whats_happening} />

      <ClaimGroup
        title="What we can see"
        claims={seen}
        cap={FIRST_SCREEN_CAP.what_we_can_see}
        flagsByClaim={flagsByClaim}
        findingsByClaim={findingsByClaim}
      />
      <ClaimGroup
        title="Where interpretation differs"
        claims={differs}
        cap={FIRST_SCREEN_CAP.where_interpretation_differs}
        flagsByClaim={flagsByClaim}
        findingsByClaim={findingsByClaim}
      />

      {unmatchedFlags.length > 0 ? (
        <section className="section">
          <h2 className="label">Adversary flags that match no claim</h2>
          {unmatchedFlags.map((flag) => (
            <AdversaryNote key={`${flag.claim_id}:${flag.model}`} flag={flag} showClaim />
          ))}
        </section>
      ) : null}

      <section className="section">
        <h2 className="label">Original {script === "hebrew" ? "Hebrew" : "Greek"} · word for word</h2>
        <div className="table-wrap">
          <table className="gloss">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Surface</th>
                <th>Translit</th>
                <th>Gloss</th>
                <th>Strong’s</th>
                <th>Morph</th>
              </tr>
            </thead>
            <tbody>
              {entry.gloss.map((word, index) => (
                <Fragment key={index}>
                  <tr>
                    <td className="num">{index + 1}</td>
                    <td className={`surface ${surface.className}`} lang={surface.lang} dir={surface.dir}>
                      {word.surface}
                    </td>
                    <td>{word.translit}</td>
                    <td>{word.gloss}</td>
                    <td>{word.strongs ?? "—"}</td>
                    <td>{word.morph ?? "—"}</td>
                  </tr>
                  {(word.morphemes ?? []).map((morpheme, j) => (
                    <tr className="morpheme" key={`${index}.${j}`}>
                      <td />
                      <td className={`surface ${surface.className}`} lang={surface.lang} dir={surface.dir}>
                        {morpheme.surface}
                      </td>
                      <td>{morpheme.role}</td>
                      <td>{morpheme.gloss}</td>
                      <td>{morpheme.strongs ?? morpheme.lemma_ref ?? "—"}</td>
                      <td>{morpheme.morph ?? "—"}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="meta">Word-for-word gloss, derived from alignment data.</p>
      </section>

      <section className="section">
        <h2 className="label">Close rendering</h2>
        <Prose className="body-text" text={entry.close_rendering} />
        <p className="meta">Composed and reviewed. Not a literal translation.</p>
      </section>

      {entry.key_words.length > 0 ? (
        <section className="section">
          <h2 className="label">Key words</h2>
          <ul className="plain">
            {entry.key_words.map((word, index) => (
              <li key={index} dir="ltr">
                <span className={surface.className} lang={surface.lang} dir={surface.dir}>
                  {word.surface}
                </span>{" "}
                <span className="meta">
                  <span className={surface.className} lang={surface.lang} dir={surface.dir}>
                    {word.lemma}
                  </span>{" "}
                  · {word.strongs}
                </span>{" "}
                <span>— {word.gloss}</span>
                {word.note !== undefined ? <Prose className="meta-prose" text={word.note} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {entry.translation_note !== undefined ? (
        <section className="section">
          <h2 className="label">Why this translation</h2>
          <Prose className="body-text" text={entry.translation_note} />
        </section>
      ) : null}

      <section className="section">
        <h2 className="label">Go deeper · related passages</h2>
        {entry.related_passages.length === 0 ? (
          <p className="muted">None.</p>
        ) : (
          <ul className="plain">
            {entry.related_passages.map((related, index) => (
              <li key={index} dir="ltr">
                <span className="ref">{related.ref}</span>{" "}
                {related.relationship !== undefined ? (
                  <span className="label">· {related.relationship}</span>
                ) : (
                  <span className="meta">· no relationship label</span>
                )}
                {related.note !== undefined ? <Prose className="meta-prose" text={related.note} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2 className="label">review.flags · payload says {entry.review.status}</h2>
        {entry.review.flags.length === 0 ? (
          <p className="muted">None.</p>
        ) : (
          <ul className="plain tight">
            {entry.review.flags.map((flag, index) => (
              <li key={index}>
                <Prose as="span" text={flag} />
              </li>
            ))}
          </ul>
        )}
        {entry.no_significant_dispute === true ? (
          <p className="meta">Marked no_significant_dispute.</p>
        ) : null}
      </section>
    </>
  );
}

function ClaimGroup({
  title,
  claims,
  cap,
  flagsByClaim,
  findingsByClaim,
}: {
  title: string;
  claims: Claim[];
  cap: number;
  flagsByClaim: Map<string, AdversaryFlag[]>;
  findingsByClaim: Map<string, Finding[]>;
}) {
  return (
    <section className="section">
      <h2 className="label">
        {title} · {claims.length}
      </h2>
      {claims.length === 0 ? (
        <p className="muted">No claims in this group.</p>
      ) : (
        <ol className="claims">
          {claims.map((claim, index) => (
            <Fragment key={claim.id}>
              {index === cap ? (
                <li className="cap-marker" role="separator">
                  <span className="meta">
                    First screen ends here. The app shows {cap}, then “Show all {claims.length}”.
                  </span>
                </li>
              ) : null}
              <ClaimRow
                claim={claim}
                flags={flagsByClaim.get(claim.id) ?? []}
                findings={findingsByClaim.get(claim.id) ?? []}
              />
            </Fragment>
          ))}
        </ol>
      )}
      {claims.length > 0 && claims.length <= cap ? (
        <p className="meta">
          All {claims.length} fit on the first screen (cap {cap}).
        </p>
      ) : null}
    </section>
  );
}

function ClaimRow({
  claim,
  flags,
  findings,
}: {
  claim: Claim;
  flags: AdversaryFlag[];
  findings: Finding[];
}) {
  return (
    <li className="claim">
      <div className="label">
        {claim.category} · {claim.evidence_strength}
      </div>
      <Prose className="claim-text" text={claim.claim} />
      <div className="meta">
        {claim.grounding === "source_data"
          ? "Grounded in source data"
          : "Model knowledge, not grounded in a supplied dataset"}{" "}
        · rank {claim.display_rank} · {claim.id}
      </div>

      {claim.evidence.length === 0 ? (
        <div className="meta">No evidence cited.</div>
      ) : (
        <EvidenceList refs={claim.evidence} />
      )}

      {claim.positions !== undefined ? (
        <div className="positions">
          <div className="label">Positions · {claim.positions.length}</div>
          {claim.positions.map((position, index) => (
            <div className="position" key={index}>
              <Prose as="div" className="position-label" text={position.label} />
              <Prose className="body-text" text={position.case} />
              {position.evidence.length > 0 ? <EvidenceList refs={position.evidence} /> : null}
            </div>
          ))}
        </div>
      ) : null}

      {findings.map((finding, index) => (
        <div key={index} className="claim-finding">
          <FindingLine finding={finding} />
        </div>
      ))}

      {flags.map((flag) => (
        <AdversaryNote key={flag.model} flag={flag} showClaim={false} />
      ))}
    </li>
  );
}

function describeEvidence(ref: EvidenceRef): string {
  const note = ref.note === undefined ? "" : ` — ${ref.note}`;
  switch (ref.type) {
    case "verse":
      return `${ref.ref}${note}`;
    case "lexical": {
      const parts = [
        ref.lemma,
        ref.strongs,
        ref.dataset,
        ref.analysis_tradition === undefined ? undefined : `tradition: ${ref.analysis_tradition}`,
      ].filter((part): part is string => part !== undefined);
      return `${parts.join(" · ")}${note}`;
    }
    case "apparatus": {
      const parts = [
        ref.ref,
        ref.dataset,
        ref.witnesses === undefined || ref.witnesses.length === 0
          ? undefined
          : `witnesses: ${ref.witnesses.join(", ")}`,
      ].filter((part): part is string => part !== undefined);
      return `${parts.join(" · ")}${note}`;
    }
  }
}

function EvidenceList({ refs }: { refs: readonly EvidenceRef[] }) {
  return (
    <ul className="evidence">
      {refs.map((ref, index) => (
        <li key={index} dir="ltr">
          <span className="label">{ref.type}</span>
          <Prose as="span" text={describeEvidence(ref)} />
        </li>
      ))}
    </ul>
  );
}

function AdversaryNote({ flag, showClaim }: { flag: AdversaryFlag; showClaim: boolean }) {
  const disagrees = flag.verdict !== "upheld";
  return (
    <div className={`adversary${flag.severity === "critical" ? " critical" : ""}${disagrees ? "" : " upheld"}`}>
      <div className="label">
        Adversary · {flag.verdict} · {flag.severity} · {flag.model}
        {showClaim ? ` · ${flag.claim_id}` : ""}
      </div>
      {flag.note !== null ? <Prose className="meta-prose" text={flag.note} /> : null}
    </div>
  );
}

function FindingLine({ finding }: { finding: Finding }) {
  return (
    <span className={`finding ${finding.level}`} dir="ltr">
      <span className="label">
        {finding.level} · {finding.rule}
        {finding.claimId === undefined ? "" : ` · ${finding.claimId}`}
      </span>{" "}
      <Prose as="span" text={finding.message} />
    </span>
  );
}
