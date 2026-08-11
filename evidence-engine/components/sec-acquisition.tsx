"use client";

import { FormEvent, useEffect, useState } from "react";
import { acquireSecCompany } from "@/lib/sec-client.mjs";
import {
  applyEvidenceResolutionDecisions,
  EVIDENCE_RESOLUTION_VERSION,
} from "@/lib/evidence-resolution.mjs";
import { parseTmdlMarketContext } from "@/lib/tmdl-context.mjs";

type ResolutionCandidate = {
  id: string;
  taxonomy: string;
  concept: string;
  qualifiedConcept: string;
  reportedValue: number;
  normalizedValue: number;
  displayUnit: string;
  start: string | null;
  end: string;
  hasDimensions: boolean;
  sourceLocation: string;
  reason: string;
};

type ResolutionCase = {
  field: string;
  label: string;
  outcome: "MappedFallback" | "ReviewRequired" | "MissingEvidence" | "CollectionFailure" | "NotReportedOptionalZero";
  candidates: ResolutionCandidate[];
  reason: string;
  allowedDecisionActions?: string[];
};

type ReviewDraft = {
  action: "" | "AcceptCandidate" | "AggregateCandidates" | "RejectAllNotReportedZero";
  selectedCandidateIds: string[];
  rationale: string;
  reviewedAt: string;
};

export type AcquisitionEvidence = {
  field: string;
  label: string;
  status:
    | "Mapped"
    | "Derived"
    | "Review"
    | "ReviewRequired"
    | "Missing"
    | "CollectionFailure"
    | "NotReported"
    | "Manual";
  confidence: string;
  value: number | string | null;
  displayUnit: string | null;
  taxonomy: string | null;
  concept: string | null;
  conceptLabel: string | null;
  reportedUnit: string | null;
  reportedValue: number | null;
  start: string | null;
  end: string | null;
  method: string;
  reason: string | null;
  dependencies?: string[];
};

export type AcquisitionResponse = {
  acquisitionVersion: string;
  acquiredAt: string;
  company: {
    name: string;
    ticker: string;
    cik: string;
    exchanges: string[];
  };
  filing: {
    form: string;
    accessionNumber: string;
    filingDate: string;
    reportDate: string;
    primaryDocument: string;
    filingUrl: string;
  };
  inputs: Record<string, unknown>;
  mapping: AcquisitionEvidence[];
  summary: {
    mapped: number;
    derived: number;
    review: number;
    reviewRequired: number;
    missing: number;
    collectionFailure: number;
    notReported: number;
    resolvedFromFiling: number;
    blocking: number;
    manual: number;
    total: number;
  };
  warnings: string[];
  resolution: {
    version: string;
    status: string;
    factsExamined: number;
    cases: ResolutionCase[];
  };
};

function formatMappedValue(item: AcquisitionEvidence) {
  if (typeof item.value !== "number") return item.value || "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: item.displayUnit === "USD/share" ? 4 : 2,
  }).format(item.value);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

type TmdlMarketContext = {
  ticker: string;
  company: string;
  price: string;
  marketDate: string;
  marketUrl: string;
  source: string;
};

function readTmdlMarketContext(): TmdlMarketContext {
  return parseTmdlMarketContext(typeof window === "undefined" ? "" : window.location.search) as TmdlMarketContext;
}

export default function SecAcquisition({
  onUseDataset,
}: {
  onUseDataset: (inputs: Record<string, unknown>, runWhenValid: boolean) => void;
}) {
  const [tmdlContext] = useState(readTmdlMarketContext);
  const [ticker, setTicker] = useState(tmdlContext.ticker || "AAPL");
  const [acquisition, setAcquisition] = useState<AcquisitionResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(tmdlContext.ticker));
  const [error, setError] = useState("");
  const [sharePrice, setSharePrice] = useState(tmdlContext.price);
  const [marketDate, setMarketDate] = useState(tmdlContext.marketDate || todayUtc);
  const [marketUrl, setMarketUrl] = useState(tmdlContext.marketUrl);
  const [reviewer, setReviewer] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    if (!tmdlContext.ticker) return;
    let active = true;
    void acquireSecCompany(tmdlContext.ticker)
      .then((body) => {
        if (!active) return;
        setTicker(tmdlContext.ticker);
        setAcquisition(body as AcquisitionResponse);
        setSharePrice(tmdlContext.price);
        setMarketUrl(tmdlContext.marketUrl);
        setMarketDate(tmdlContext.marketDate || todayUtc());
        setReviewer("");
        setReviewDrafts({});
        setReviewError("");
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "SEC evidence acquisition failed.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tmdlContext]);

  const loadTicker = async (event: FormEvent) => {
    event.preventDefault();
    const requested = ticker.trim().toUpperCase();
    if (!requested) {
      setError("Enter a ticker symbol.");
      return;
    }
    setLoading(true);
    setError("");
    setAcquisition(null);
    try {
      const body = await acquireSecCompany(requested);
      setTicker(requested);
      setAcquisition(body as AcquisitionResponse);
      const useTmdlContext = requested === tmdlContext.ticker;
      setSharePrice(useTmdlContext ? tmdlContext.price : "");
      setMarketUrl(useTmdlContext ? tmdlContext.marketUrl : "");
      setMarketDate(useTmdlContext && tmdlContext.marketDate ? tmdlContext.marketDate : todayUtc());
      setReviewer("");
      setReviewDrafts({});
      setReviewError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SEC evidence acquisition failed.");
    } finally {
      setLoading(false);
    }
  };

  const prepareInputs = () => {
    if (!acquisition) return null;
    const decisions = Object.entries(reviewDrafts)
      .filter(([, draft]) => Boolean(draft.action))
      .map(([field, draft]) => ({
        field,
        action: draft.action,
        selectedCandidateId:
          draft.action === "AcceptCandidate" ? draft.selectedCandidateIds[0] : undefined,
        selectedCandidateIds:
          draft.action === "AggregateCandidates" ? draft.selectedCandidateIds : undefined,
        rationale: draft.rationale,
        reviewedAt: draft.reviewedAt,
        reviewer,
      }));
    const resolution = applyEvidenceResolutionDecisions(acquisition.inputs, decisions);
    if (resolution.errors.length) {
      setReviewError(resolution.errors.map((item: { reason: string }) => item.reason).join(" "));
      return null;
    }
    setReviewError("");
    const price = Number(sharePrice);
    const inputEvidence = {
      ...(resolution.inputs.inputEvidence as Record<string, AcquisitionEvidence>),
      sharePrice: {
        ...(acquisition.inputs.inputEvidence as Record<string, AcquisitionEvidence>).sharePrice,
        status: "Manual",
        value: Number.isFinite(price) ? price : 0,
        end: marketDate || null,
        reason: tmdlContext.source && ticker === tmdlContext.ticker
          ? "Dated market evidence supplied by the TMDL shared security record; not sourced from SEC EDGAR."
          : "User-supplied dated market evidence; not sourced from SEC EDGAR.",
      },
      marketObservationDate: {
        ...(acquisition.inputs.inputEvidence as Record<string, AcquisitionEvidence>)
          .marketObservationDate,
        status: "Manual",
        value: marketDate,
        end: marketDate || null,
      },
      marketUrl: {
        ...(acquisition.inputs.inputEvidence as Record<string, AcquisitionEvidence>).marketUrl,
        status: "Manual",
        value: marketUrl,
        end: marketDate || null,
      },
    };
    return {
      ...resolution.inputs,
      sharePrice: Number.isFinite(price) ? price : 0,
      marketObservationDate: marketDate,
      marketUrl: marketUrl.trim(),
      inputEvidence,
    };
  };

  const marketReady =
    Number(sharePrice) > 0 &&
    Boolean(marketDate) &&
    /^https:\/\//i.test(marketUrl.trim());
  const selectedReviews = Object.values(reviewDrafts).filter((draft) => draft.action);
  const reviewsReady = selectedReviews.every(
    (draft) =>
      reviewer.trim() &&
      draft.rationale.trim() &&
      draft.reviewedAt &&
      (draft.action === "RejectAllNotReportedZero" ||
        (draft.action === "AcceptCandidate" && draft.selectedCandidateIds.length === 1) ||
        (draft.action === "AggregateCandidates" && draft.selectedCandidateIds.length >= 2)),
  );
  const engineReady = Boolean(acquisition && marketReady && reviewsReady);
  const reviewCases = acquisition?.resolution.cases.filter(
    (item) => item.outcome === "ReviewRequired",
  ) ?? [];

  return (
    <div className="view-stack acquisition-view">
      <section className="acquisition-hero" aria-labelledby="sec-loader-heading">
        <div className="acquisition-copy">
          <p className="section-kicker">Official filing acquisition</p>
          <h1 id="sec-loader-heading">Build a governed dataset from SEC evidence</h1>
          <p>
            Enter a ticker to retrieve its latest Form 10-K, map standardized XBRL facts,
            and review every field before the calculation engine runs.
          </p>
        </div>
        <form className="ticker-loader" onSubmit={loadTicker}>
          <label htmlFor="ticker-lookup">U.S. stock ticker</label>
          <div>
            <input
              id="ticker-lookup"
              value={ticker}
              maxLength={10}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              placeholder="AAPL"
            />
            <button className="primary-button" disabled={loading}>
              {loading ? "Retrieving SEC evidence…" : "Load latest 10-K"}
            </button>
          </div>
          <small>Try AAPL, KO, O, or another SEC-listed company with a current 10-K.</small>
        </form>
      </section>

      {error && (
        <section className="acquisition-error" role="alert">
          <strong>Unable to build the dataset</strong>
          <p>{error}</p>
          <span>Use the exact ticker symbol. Apple is AAPL; unsupported facts are reported as unavailable.</span>
        </section>
      )}

      {loading && (
        <section className="acquisition-loading" aria-live="polite">
          <span className="loader-ring" />
          <div>
            <strong>Retrieving official SEC filing evidence</strong>
            <p>Bundled SEC ticker directory → filing history + standardized Company Facts</p>
          </div>
        </section>
      )}

      {acquisition && (
        <>
          <section className="filing-banner" aria-labelledby="filing-heading">
            <div>
              <p className="section-kicker">Selected filing</p>
              <h2 id="filing-heading">{acquisition.company.name}</h2>
              <p>
                <span className="ticker-chip">{acquisition.company.ticker}</span>
                <span>{acquisition.filing.form} · period ended {acquisition.filing.reportDate}</span>
              </p>
            </div>
            <div className="filing-identity">
              <span>Filed {acquisition.filing.filingDate}</span>
              <code>{acquisition.filing.accessionNumber}</code>
              <a href={acquisition.filing.filingUrl} target="_blank" rel="noreferrer">
                Open official filing ↗
              </a>
            </div>
          </section>

          <section aria-labelledby="mapping-summary-heading">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">Mapping gate</p>
                <h2 id="mapping-summary-heading">Evidence mapping summary</h2>
              </div>
              <p className="section-note">No issuer-specific extension facts are guessed</p>
            </div>
            <div className="mapping-summary-grid">
              <div className="mapping-stat mapped"><strong>{acquisition.summary.mapped}</strong><span>Auto-mapped</span></div>
              <div className="mapping-stat derived"><strong>{acquisition.summary.derived}</strong><span>Derived</span></div>
              <div className="mapping-stat mapped"><strong>{acquisition.summary.notReported}</strong><span>Governed zero</span></div>
              <div className="mapping-stat review"><strong>{acquisition.summary.review}</strong><span>Review advised</span></div>
              <div className="mapping-stat review-required"><strong>{acquisition.summary.reviewRequired}</strong><span>Decision needed</span></div>
              <div className="mapping-stat missing"><strong>{acquisition.summary.missing}</strong><span>Missing evidence</span></div>
              <div className="mapping-stat collection-failure"><strong>{acquisition.summary.collectionFailure}</strong><span>Collection failed</span></div>
            </div>
            <div className={`readiness-strip ${engineReady ? "ready" : "attention"}`}>
              <span className="status-dot" />
              <div>
                <strong>{engineReady ? "Dataset ready for evaluation" : "Review required before evaluation"}</strong>
                <p>
                  {marketReady
                    ? acquisition.summary.missing + acquisition.summary.reviewRequired + acquisition.summary.collectionFailure === 0
                      ? "All official filing inputs are resolved and dated market evidence is present."
                      : `${acquisition.summary.missing} missing-evidence, ${acquisition.summary.reviewRequired} review-required, and ${acquisition.summary.collectionFailure} collection-failure field${acquisition.summary.missing + acquisition.summary.reviewRequired + acquisition.summary.collectionFailure === 1 ? " remains" : "s remain"}. The engine will calculate every independently supported measurement.`
                    : "SEC evidence has been classified. Add dated market evidence below; unresolved branches remain explicitly unavailable rather than being estimated."}
                </p>
              </div>
            </div>
          </section>

          {reviewCases.length > 0 && (
            <section className="resolution-panel" aria-labelledby="resolution-heading">
              <div className="resolution-heading">
                <div>
                  <p className="section-kicker">Governed evidence resolution</p>
                  <h2 id="resolution-heading">Review official filing candidates</h2>
                </div>
                <span>{reviewCases.length} decision{reviewCases.length === 1 ? "" : "s"} available</span>
              </div>
              <p className="resolution-explainer">
                These facts were found in the official filing but cannot be accepted automatically. You may record a decision now, or leave a field unresolved and run every independent calculation the evidence supports.
              </p>
              <label className="form-field reviewer-field">
                <span>Reviewer name or initials</span>
                <input
                  value={reviewer}
                  onChange={(event) => setReviewer(event.target.value)}
                  placeholder="Required when recording any review decision"
                />
              </label>
              <div className="resolution-case-list">
                {reviewCases.map((resolutionCase) => {
                  const draft = reviewDrafts[resolutionCase.field] ?? {
                    action: "" as const,
                    selectedCandidateIds: [],
                    rationale: "",
                    reviewedAt: "",
                  };
                  const actions = resolutionCase.allowedDecisionActions ?? ["AcceptCandidate"];
                  return (
                    <article className="resolution-case" key={resolutionCase.field}>
                      <div className="resolution-case-title">
                        <div><strong>{resolutionCase.label}</strong><code>{resolutionCase.field}</code></div>
                        <span className="mapping-pill reviewrequired">Review required</span>
                      </div>
                      <p>{resolutionCase.reason}</p>
                      <div className="review-action-list" role="group" aria-label={`Decision for ${resolutionCase.label}`}>
                        <label>
                          <input
                            type="radio"
                            name={`action-${resolutionCase.field}`}
                            checked={draft.action === "AcceptCandidate"}
                            onChange={() => setReviewDrafts((current) => ({
                              ...current,
                              [resolutionCase.field]: {
                                ...draft,
                                action: "AcceptCandidate",
                                selectedCandidateIds: draft.selectedCandidateIds.slice(0, 1),
                                reviewedAt: new Date().toISOString(),
                              },
                            }))}
                          />
                          Accept one candidate
                        </label>
                        {actions.includes("AggregateCandidates") && (
                          <label>
                            <input
                              type="radio"
                              name={`action-${resolutionCase.field}`}
                              checked={draft.action === "AggregateCandidates"}
                              onChange={() => setReviewDrafts((current) => ({
                                ...current,
                                [resolutionCase.field]: {
                                  ...draft,
                                  action: "AggregateCandidates",
                                  reviewedAt: new Date().toISOString(),
                                },
                              }))}
                            />
                            Sum selected candidates
                          </label>
                        )}
                        {actions.includes("RejectAllNotReportedZero") && (
                          <label>
                            <input
                              type="radio"
                              name={`action-${resolutionCase.field}`}
                              checked={draft.action === "RejectAllNotReportedZero"}
                              onChange={() => setReviewDrafts((current) => ({
                                ...current,
                                [resolutionCase.field]: {
                                  ...draft,
                                  action: "RejectAllNotReportedZero",
                                  selectedCandidateIds: [],
                                  reviewedAt: new Date().toISOString(),
                                },
                              }))}
                            />
                            Reject all — not separately reported; govern zero
                          </label>
                        )}
                      </div>
                      <div className="candidate-list">
                        {resolutionCase.candidates.map((candidate) => {
                          const selected = draft.selectedCandidateIds.includes(candidate.id);
                          return (
                            <label className={`candidate-card ${selected ? "selected" : ""}`} key={candidate.id}>
                              <input
                                type={draft.action === "AggregateCandidates" ? "checkbox" : "radio"}
                                name={`candidate-${resolutionCase.field}`}
                                checked={selected}
                                disabled={!draft.action || draft.action === "RejectAllNotReportedZero"}
                                onChange={() => setReviewDrafts((current) => ({
                                  ...current,
                                  [resolutionCase.field]: {
                                    ...draft,
                                    selectedCandidateIds:
                                      draft.action === "AggregateCandidates"
                                        ? selected
                                          ? draft.selectedCandidateIds.filter((id) => id !== candidate.id)
                                          : [...draft.selectedCandidateIds, candidate.id]
                                        : [candidate.id],
                                    reviewedAt: new Date().toISOString(),
                                  },
                                }))}
                              />
                              <span className="candidate-main">
                                <strong>{formatMappedValue({ value: candidate.normalizedValue, displayUnit: candidate.displayUnit } as AcquisitionEvidence)} {candidate.displayUnit}</strong>
                                <code>{candidate.qualifiedConcept}</code>
                                <small>{candidate.start ? `${candidate.start} → ${candidate.end}` : candidate.end}{candidate.hasDimensions ? " · dimensioned context" : ""}</small>
                              </span>
                              <a href={candidate.sourceLocation} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                                View source ↗
                              </a>
                            </label>
                          );
                        })}
                      </div>
                      {draft.action === "RejectAllNotReportedZero" && (
                        <p className="resolution-warning">
                          This records that every candidate shown was examined and rejected. The optional canonical component becomes a governed zero; required fields cannot use this action.
                        </p>
                      )}
                      {draft.action && (
                        <label className="form-field rationale-field">
                          <span>Decision rationale</span>
                          <textarea
                            value={draft.rationale}
                            onChange={(event) => setReviewDrafts((current) => ({
                              ...current,
                              [resolutionCase.field]: { ...draft, rationale: event.target.value },
                            }))}
                            placeholder={draft.action === "RejectAllNotReportedZero"
                              ? "Explain why none of the candidates represents a separately reported canonical component."
                              : draft.action === "AggregateCandidates"
                                ? "Explain why the selected candidates are non-overlapping components of the canonical total."
                                : "Explain why this candidate matches the engine input and intended scope."}
                          />
                        </label>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="resolution-policy-note">
                Review policy {EVIDENCE_RESOLUTION_VERSION} records the reviewer, timestamp, every candidate examined, accepted, aggregated or rejected candidates, rationale, and exact source locations in the evaluation fingerprint.
              </div>
              {reviewError && <p className="resolution-error" role="alert">{reviewError}</p>}
            </section>
          )}

          <section className="market-evidence-panel" aria-labelledby="market-evidence-heading">
            <div className="market-evidence-heading">
              <div>
                <p className="section-kicker">Required manual evidence</p>
                <h2 id="market-evidence-heading">Add a dated reference price</h2>
              </div>
              <span>Not supplied by EDGAR</span>
            </div>
            <p className="market-explainer">
              The SEC provides filings, not stock prices. Record the exact price, date, and page you used so the valuation results remain traceable.
            </p>
            {tmdlContext.source && ticker === tmdlContext.ticker && (
              <div className="tmdl-context-banner">
                <span>TMDL market context</span>
                <strong>{tmdlContext.company || ticker}</strong>
                <p>The dated price and source below came from TMDL&apos;s shared security universe. Review them before publishing the evaluation.</p>
              </div>
            )}
            <div className="market-input-grid">
              <label className="form-field">
                <span>Reference share price (USD)</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={sharePrice}
                  onChange={(event) => setSharePrice(event.target.value)}
                  placeholder="Enter price"
                />
              </label>
              <label className="form-field">
                <span>Observation date</span>
                <input type="date" value={marketDate} onChange={(event) => setMarketDate(event.target.value)} />
              </label>
              <label className="form-field market-url-field">
                <span>Exact market evidence URL</span>
                <input
                  type="url"
                  value={marketUrl}
                  onChange={(event) => setMarketUrl(event.target.value)}
                  placeholder="https://…"
                />
              </label>
            </div>
            <div className="acquisition-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  const prepared = prepareInputs();
                  if (prepared) onUseDataset(prepared, false);
                }}
              >
                Review or correct inputs
              </button>
              <button
                className="primary-button"
                disabled={!engineReady}
                onClick={() => {
                  const prepared = prepareInputs();
                  if (prepared) onUseDataset(prepared, true);
                }}
              >
                Use dataset and run evaluation
              </button>
            </div>
          </section>

          <section className="mapping-panel" aria-labelledby="mapping-register-heading">
            <div className="mapping-panel-heading">
              <div>
                <p className="section-kicker">Field-level provenance</p>
                <h2 id="mapping-register-heading">Mapping register</h2>
              </div>
                  <span>{acquisition.summary.total} governed fields · acquisition {acquisition.acquisitionVersion}</span>
            </div>
            <div className="table-scroll">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>Engine input</th>
                    <th>Status</th>
                    <th className="numeric">Mapped value</th>
                    <th>SEC concept or method</th>
                    <th>Period</th>
                  </tr>
                </thead>
                <tbody>
                  {acquisition.mapping.map((item) => (
                    <tr key={item.field}>
                      <td><strong>{item.label}</strong><code>{item.field}</code></td>
                      <td><span className={`mapping-pill ${item.status.toLowerCase()}`}>{item.status}</span></td>
                      <td className="numeric"><strong>{formatMappedValue(item)}</strong><small>{item.displayUnit}</small></td>
                      <td>
                        <code className="concept-code">
                          {item.concept ? `${item.taxonomy}:${item.concept}` : item.method}
                        </code>
                        {item.reason && <span className="mapping-reason">{item.reason}</span>}
                      </td>
                      <td>{item.start ? `${item.start} → ${item.end}` : item.end ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <details className="acquisition-notes">
            <summary>Acquisition safeguards and known limits</summary>
            <ul>
              {acquisition.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
