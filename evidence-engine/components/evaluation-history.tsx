"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthoritativeReadError, fetchAuthoritativeExactResult, parseAuthoritativeHistory, type AuthoritativeRecordDetail, type AuthoritativeRecordSummary } from "@/lib/authoritative-client";

export type EvaluationRecordDetail = AuthoritativeRecordDetail;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function shortHash(value: string) { return value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value; }

export default function EvaluationHistory({ ticker, securityId, currentResultId, refreshToken, onLoadExact }: {
  ticker: string; securityId?: string | null; currentResultId?: string | null; refreshToken: number;
  onLoadExact: (record: EvaluationRecordDetail) => void; onNotice: (message: string) => void;
}) {
  const [records, setRecords] = useState<AuthoritativeRecordSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<{ kind: "unauthorized" | "unavailable"; message: string } | null>(null);

  const page = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: "25" });
    if (securityId) params.set("securityId", securityId); else params.set("ticker", ticker.toUpperCase());
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/authoritative-results?${params}`, { method: "GET", headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store" });
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new AuthoritativeReadError(response.status, String(payload.code ?? "AuthoritativeReadFailed"), String(payload.error ?? "History is unavailable."));
    return parseAuthoritativeHistory(payload);
  }, [securityId, ticker]);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { const result = await page(); setRecords(result.records); setNextCursor(result.nextCursor); }
    catch (caught) {
      const unauthorized = caught instanceof AuthoritativeReadError && (caught.status === 401 || caught.status === 403);
      setError({ kind: unauthorized ? "unauthorized" : "unavailable", message: caught instanceof Error ? caught.message : "History is unavailable." });
    } finally { setLoading(false); }
  }, [page]);
  useEffect(() => {
    let active = true;
    void page().then((result) => {
      if (!active) return;
      setRecords(result.records); setNextCursor(result.nextCursor); setError(null);
    }).catch((caught) => {
      if (!active) return;
      const unauthorized = caught instanceof AuthoritativeReadError && (caught.status === 401 || caught.status === 403);
      setError({ kind: unauthorized ? "unauthorized" : "unavailable", message: caught instanceof Error ? caught.message : "History is unavailable." });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, refreshToken]);

  const openExact = async (resultId: string) => {
    setWorkingId(resultId); setError(null);
    try { onLoadExact(await fetchAuthoritativeExactResult(resultId)); }
    catch (caught) {
      const unauthorized = caught instanceof AuthoritativeReadError && (caught.status === 401 || caught.status === 403);
      setError({ kind: unauthorized ? "unauthorized" : "unavailable", message: caught instanceof Error ? caught.message : "The Result could not be opened." });
    } finally { setWorkingId(null); }
  };
  const loadMore = async () => {
    if (!nextCursor) return; setLoading(true);
    try { const result = await page(nextCursor); setRecords((current) => [...current, ...result.records]); setNextCursor(result.nextCursor); }
    catch (caught) { setError({ kind: "unavailable", message: caught instanceof Error ? caught.message : "More History could not be loaded." }); }
    finally { setLoading(false); }
  };

  return <div className="view-stack history-view">
    <section className="history-hero" aria-labelledby="history-heading"><div><p className="section-kicker">Authoritative Evidence Engine state</p><h1 id="history-heading">History · {ticker.toUpperCase()}</h1><p>Persisted Results for the selected security. Opening a Result reads its exact stored evaluation without recalculation.</p></div><div className="history-hero-stat"><strong>{records.length}</strong><span>authoritative Results</span><small>Append-only · integrity verified on open</small></div></section>
    <section className="history-controls" aria-label="History controls"><button className="secondary-button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh History"}</button></section>
    {error && <div className="history-error" role="alert"><strong>{error.kind === "unauthorized" ? "Access required" : "History unavailable"}</strong><p>{error.message}</p></div>}
    {loading && records.length === 0 ? <div className="history-loading"><span />Loading authoritative History…</div>
      : !error && records.length === 0 ? <section className="empty-history"><strong>No authoritative Results</strong><p>This security has no persisted authoritative state. History is empty; no local evaluation was substituted.</p></section>
      : <section className="record-list" aria-label="Authoritative Results">{records.map((record) => {
        const current = record.resultId === currentResultId;
        return <article className="record-card" key={record.resultId}>
          <div className="record-identity"><span className="ticker-chip">{record.tickerAtState}</span><div><strong>{record.companyName}{current ? " · Current authoritative Result" : ""}</strong><span>{record.periodStart} through {record.periodEnd}</span></div></div>
          <div className="record-score"><span>Stored scoreability</span><strong>{record.score ?? "—"}</strong><small>{record.scoringStatus} · {record.coverage.weightedScoreabilityPercent}%</small></div>
          <div className="record-evidence"><span>Known {formatTimestamp(record.knownAt)}</span><code title={record.recordHash}>{shortHash(record.recordHash)}</code></div>
          <div className="record-versions"><span>Published {formatTimestamp(record.publishedAt)}</span><small>Result {shortHash(record.resultId)}</small></div>
          <div className="record-actions"><button onClick={() => void openExact(record.resultId)} disabled={workingId === record.resultId}>{workingId === record.resultId ? "Opening…" : "Open exact Result"}</button></div>
        </article>;
      })}</section>}
    {nextCursor && <button className="secondary-button" onClick={() => void loadMore()} disabled={loading}>Load more</button>}
    <section className="immutable-policy"><strong>Authoritative History</strong><p>This reader is GET-only. History cannot publish, update, or delete Evidence Engine state.</p></section>
  </div>;
}
