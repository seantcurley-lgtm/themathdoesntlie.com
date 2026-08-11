"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  compareStoredWithCurrent,
  replayStoredEvaluation,
} from "@/lib/evaluation-replay.mjs";

export type EvaluationRecordSummary = {
  id: string;
  recordSchemaVersion: string;
  recordKind: string;
  sourceRecordId: string | null;
  label: string;
  companyName: string;
  ticker: string;
  periodStart: string;
  periodEnd: string;
  savedAt: string;
  fingerprint: string;
  recordHash: string;
  engineVersion: string;
  publicationSchemaVersion: string;
  canonicalRegistryVersion: string;
  calculationRegistryVersion: string;
  aliasRegistryVersion: string;
  scoringVersion: string;
  scoringStatus: string;
  overallScore: string | null;
  tier: string | null;
  metricCount: number;
  unavailableMetricCount: number;
};

export type EvaluationRecordDetail = EvaluationRecordSummary & {
  integrity: { status: string; algorithm: string; hash: string };
  evaluation: Record<string, unknown>;
};

type ReplayOutput = {
  mode: "replay" | "compare";
  record: EvaluationRecordDetail;
  result: Record<string, unknown>;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function shortHash(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ComparisonPanel({ output }: { output: ReplayOutput }) {
  const result = output.result as {
    status: string;
    eligibility?: {
      mismatches?: Array<{
        key: string;
        label: string;
        recorded: string | null;
        available: string | null;
      }>;
    };
    comparison?: {
      fingerprintMatch: boolean;
      originalFingerprint: string | null;
      candidateFingerprint: string | null;
      metricChangeCount: number;
      metricChanges: Array<{
        id: string;
        name: string;
        before: { status: string; value: string | null; unit: string | null; reason: string | null };
        after: { status: string; value: string | null; unit: string | null; reason: string | null };
      }>;
      scoringChanged: boolean;
      originalScore: string | null;
      candidateScore: string | null;
      originalTier: string | null;
      candidateTier: string | null;
      versionContextChanged: boolean;
    } | null;
  };
  const comparison = result.comparison;
  const reproduced = result.status === "Reproduced";
  const unsupported = result.status === "UnsupportedVersionContext";

  return (
    <section className="replay-panel" aria-labelledby="replay-result-heading">
      <div className="section-heading-row compact">
        <div>
          <p className="section-kicker">
            {output.mode === "replay" ? "Original-context replay" : "Current-version comparison"}
          </p>
          <h2 id="replay-result-heading">
            {unsupported
              ? "Recorded version is not installed"
              : reproduced
                ? "Fingerprint reproduced exactly"
                : output.mode === "compare"
                  ? "Comparison complete"
                  : "Replay diverged"}
          </h2>
        </div>
        <span className={`replay-status ${unsupported ? "unsupported" : reproduced ? "reproduced" : comparison?.fingerprintMatch ? "reproduced" : "changed"}`}>
          {result.status}
        </span>
      </div>

      {unsupported ? (
        <div className="version-mismatch-list">
          <p>
            Exact replay is intentionally blocked rather than silently substituting the current
            engine for the recorded context.
          </p>
          {(result.eligibility?.mismatches ?? []).map((item) => (
            <div key={item.key}>
              <strong>{item.label}</strong>
              <span>Recorded {item.recorded ?? "missing"}</span>
              <span>Installed {item.available ?? "missing"}</span>
            </div>
          ))}
        </div>
      ) : comparison ? (
        <>
          <div className="replay-summary-grid">
            <div>
              <span>Fingerprint</span>
              <strong>{comparison.fingerprintMatch ? "Exact match" : "Changed"}</strong>
              <code>{shortHash(comparison.candidateFingerprint ?? "")}</code>
            </div>
            <div>
              <span>Measurements changed</span>
              <strong>{comparison.metricChangeCount}</strong>
              <small>Availability, value, unit, or reason</small>
            </div>
            <div>
              <span>Governed score</span>
              <strong>
                {comparison.originalScore ?? "—"} → {comparison.candidateScore ?? "—"}
              </strong>
              <small>{comparison.originalTier ?? "No tier"} → {comparison.candidateTier ?? "No tier"}</small>
            </div>
          </div>

          {comparison.metricChanges.length > 0 ? (
            <div className="metric-change-list">
              {comparison.metricChanges.map((change) => (
                <div key={change.id}>
                  <strong>{change.name}</strong>
                  <span>
                    {change.before.status === "Available"
                      ? `${change.before.value} ${change.before.unit ?? ""}`
                      : change.before.reason}
                  </span>
                  <span aria-hidden="true">→</span>
                  <span>
                    {change.after.status === "Available"
                      ? `${change.after.value} ${change.after.unit ?? ""}`
                      : change.after.reason}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-change-note">
              No measurement availability, value, unit, or scoring result changed. The stored
              record remains untouched.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}

export default function EvaluationHistory({
  refreshToken,
  onLoadExact,
  onNotice,
}: {
  refreshToken: number;
  onLoadExact: (record: EvaluationRecordDetail) => void;
  onNotice: (message: string) => void;
}) {
  const [records, setRecords] = useState<EvaluationRecordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [output, setOutput] = useState<ReplayOutput | null>(null);

  const loadRecords = useCallback(async () => {
    const response = await fetch("/api/evaluations?limit=100", {
      headers: { Accept: "application/json" },
    });
    const payload = (await response.json()) as {
      records?: EvaluationRecordSummary[];
      error?: string;
    };
    if (!response.ok) throw new Error(payload.error ?? "Evaluation history could not be loaded.");
    return payload.records ?? [];
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecords(await loadRecords());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluation history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [loadRecords]);

  useEffect(() => {
    let active = true;
    void loadRecords()
      .then((nextRecords) => {
        if (active) setRecords(nextRecords);
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Evaluation history could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadRecords, refreshToken]);

  const visibleRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records;
    return records.filter((record) =>
      `${record.ticker} ${record.companyName} ${record.periodEnd} ${record.fingerprint}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [records, query]);

  const getRecord = async (id: string) => {
    const response = await fetch(`/api/evaluations?id=${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    const payload = (await response.json()) as {
      record?: EvaluationRecordDetail;
      error?: string;
    };
    if (!response.ok || !payload.record) {
      throw new Error(payload.error ?? "Evaluation record could not be opened.");
    }
    return payload.record;
  };

  const openExact = async (id: string) => {
    setWorkingId(id);
    setError("");
    try {
      const record = await getRecord(id);
      onLoadExact(record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluation record could not be opened.");
    } finally {
      setWorkingId(null);
    }
  };

  const runReplay = async (id: string, mode: "replay" | "compare") => {
    setWorkingId(id);
    setError("");
    try {
      const record = await getRecord(id);
      const result = mode === "replay"
        ? await replayStoredEvaluation(record.evaluation)
        : await compareStoredWithCurrent(record.evaluation);
      setOutput({ mode, record, result: result as unknown as Record<string, unknown> });
      onNotice(
        mode === "replay"
          ? "Original-context replay finished. The immutable record was not changed."
          : "Current-version comparison finished. The immutable record was not changed.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Replay could not be completed.");
    } finally {
      setWorkingId(null);
    }
  };

  const exportRecord = async (id: string) => {
    setWorkingId(id);
    setError("");
    try {
      const record = await getRecord(id);
      downloadJson(`${record.ticker}-${record.periodEnd}-immutable-record.json`, record);
      onNotice("Immutable evaluation record exported with its integrity metadata.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluation record could not be exported.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="view-stack history-view">
      <section className="history-hero" aria-labelledby="history-heading">
        <div>
          <p className="section-kicker">Release 6 · Durable evaluation records</p>
          <h1 id="history-heading">Immutable evaluation history</h1>
          <p>
            Open the exact publication without recalculating it, verify a deterministic replay
            under its recorded versions, or compare it with the currently installed engine.
          </p>
        </div>
        <div className="history-hero-stat">
          <strong>{records.length}</strong>
          <span>saved records</span>
          <small>Append-only · server-backed</small>
        </div>
      </section>

      <section className="history-controls" aria-label="Evaluation history controls">
        <label>
          <span>Find a record</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ticker, company, period, or fingerprint"
          />
        </label>
        <button className="secondary-button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh history"}
        </button>
      </section>

      {error && <div className="history-error" role="alert"><strong>History unavailable</strong><p>{error}</p></div>}

      {loading ? (
        <div className="history-loading"><span />Loading immutable records…</div>
      ) : visibleRecords.length === 0 ? (
        <section className="empty-history">
          <strong>{records.length ? "No matching records" : "No durable records yet"}</strong>
          <p>
            {records.length
              ? "Try a different ticker, company name, period, or fingerprint."
              : "Run an evaluation, then choose Save immutable record in the top bar."}
          </p>
        </section>
      ) : (
        <section className="record-list" aria-label="Saved evaluation records">
          {visibleRecords.map((record) => (
            <article className="record-card" key={record.id}>
              <div className="record-identity">
                <span className="ticker-chip">{record.ticker}</span>
                <div>
                  <strong>{record.companyName}</strong>
                  <span>{record.periodStart} through {record.periodEnd}</span>
                </div>
              </div>
              <div className="record-score">
                <span>Governed score</span>
                <strong>{record.overallScore ?? "—"}</strong>
                <small>{record.tier ?? record.scoringStatus}</small>
              </div>
              <div className="record-evidence">
                <span>{record.metricCount} available</span>
                <span>{record.unavailableMetricCount} unavailable</span>
                <code title={record.fingerprint}>{shortHash(record.fingerprint)}</code>
              </div>
              <div className="record-versions">
                <span>Saved {formatTimestamp(record.savedAt)}</span>
                <small>
                  Engine {record.engineVersion} · Calc {record.calculationRegistryVersion}
                </small>
              </div>
              <div className="record-actions">
                <button onClick={() => void openExact(record.id)} disabled={workingId === record.id}>
                  Open exact record
                </button>
                <button onClick={() => void runReplay(record.id, "replay")} disabled={workingId === record.id}>
                  Verify replay
                </button>
                <button onClick={() => void runReplay(record.id, "compare")} disabled={workingId === record.id}>
                  Compare current
                </button>
                <button onClick={() => void exportRecord(record.id)} disabled={workingId === record.id}>
                  Export
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {output && <ComparisonPanel output={output} />}

      <section className="immutable-policy">
        <strong>Immutability policy</strong>
        <p>
          This release exposes create, list, and read operations only. Replays and comparisons
          create transient results; they never update or delete the accepted publication.
        </p>
      </section>
    </div>
  );
}
