"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SecAcquisition from "@/components/sec-acquisition";
import EvaluationHistory, {
  type EvaluationRecordDetail,
} from "@/components/evaluation-history";
import {
  ENGINE_VERSION,
  evaluateInputs,
  fieldGroups,
  formatMetric,
  metricDefinitions,
  microsoftFiscal2025,
  renderMarkdown,
  validateInputs,
} from "@/lib/evidence-engine.mjs";
import { GENERAL_OPERATING_COMPANY_PROFILE } from "@/lib/evidence-scoring.mjs";
import { CANONICAL_REGISTRY_VERSION } from "@/lib/canonical-registry.mjs";
import { CALCULATION_REGISTRY_VERSION } from "@/lib/calculation-registry.mjs";
import { ALIAS_REGISTRY_VERSION } from "@/lib/alias-registry.mjs";

type InputMap = Record<string, string | number | null>;
type LineageItem = {
  key: string;
  label: string;
  value: string | number;
  source: "market" | "filing" | "calculated" | "parameter";
  calculationId?: string | null;
  calculationVersion?: string | null;
  evidence?: {
    status?: string;
    taxonomy?: string | null;
    concept?: string | null;
    end?: string | null;
    reason?: string | null;
  };
};
type Metric = {
  id: string;
  family: string;
  name: string;
  unit: string;
  expression: string;
  value: string;
  canonicalEvidenceId: string | null;
  governanceReference: string | null;
  governanceStatus: string;
  calculationId: string;
  calculationVersion: string;
  calculationRegistryVersion: string;
  periodRule: string;
  validation: {
    status: string;
    outcomes: Array<{ code: string; status: string; rule?: string }>;
  };
  lineage: LineageItem[];
};
type Family = {
  family: string;
  status: "Complete" | "Partial" | "Unavailable";
  reason: string | null;
  detail: string | null;
  metricCount: number;
};
type Evaluation = {
  schemaVersion: string;
  engineVersion: string;
  canonicalRegistryVersion: string;
  calculationRegistryVersion: string;
  aliasRegistryVersion: string;
  scoringVersion: string;
  generatedAt: string;
  companyName: string;
  ticker: string;
  periodEnd: string;
  periodStart: string;
  reportingPeriod: {
    actualDayCount: number;
    countingConvention: string;
    calendarVersion: string;
  };
  validation: { status: string; outcomes: Array<Record<string, unknown>> };
  executionPlan: { status: string; requestedNodeCount: number; executionNodeCount: number };
  reportingCurrency: string;
  unitScale: string;
  fingerprint: string;
  inputs: InputMap;
  families: Family[];
  metrics: Metric[];
  unavailableMetrics: Array<{
    id: string;
    family: string;
    name: string;
    reason: string;
    missingInputs: string[];
    detail: string;
  }>;
  derived: Record<string, string>;
  scoring: {
    scoringVersion: string;
    profileId: string;
    profileName: string;
    profileNote: string;
    status: "Scored" | "InsufficientCoverage" | "NotApplicable" | "Unclassified";
    overallScore: string | null;
    maximumScore: string | null;
    tier: string | null;
    coveragePercent: string;
    earnedPoints: string;
    totalWeight: string;
    availableWeight: string;
    minimumCoveragePercent: string;
    rulesScored: number;
    rulesTotal: number;
    classification: {
      status: string;
      sic: string | null;
      sicDescription: string;
      reason: string;
    };
    families: Array<{
      family: string;
      status: "Complete" | "Partial" | "Unavailable";
      score: string;
      maximumScore: string;
      tier: string;
      earnedPoints: string;
      totalWeight: string;
      availableWeight: string;
      coveragePercent: string;
      rulesScored: number;
      rulesTotal: number;
    }>;
    rules: Array<{
      metricId: string;
      family: string;
      name: string;
      weight: string;
      maximumPoints: string;
      policy: string;
      status: "Scored" | "Unavailable";
      observedValue: string | null;
      unit: string | null;
      tierScore: string | null;
      awardedPoints: string;
      matchedBand: string | null;
      rationale: string;
    }>;
  };
  sources: Array<{
    sourceType: string;
    identifier: string;
    observationDate: string;
    uri: string;
  }>;
};

const navItems = [
  ["overview", "Overview", "Evaluation summary"],
  ["scoring", "Scoring", "Rules & awarded points"],
  ["acquire", "Load company", "SEC filing lookup"],
  ["evidence", "Evidence", "Up to 30 measurements"],
  ["inputs", "Inputs", "Governed dataset"],
  ["methodology", "Methodology", "Formulas & lineage"],
] as const;

const keyMetricIds = [
  "ccc",
  "currentRatio",
  "grossMargin",
  "debtRatio",
  "freeCashFlowMargin",
  "priceToEarnings",
];

const familyOrder = [
  "All families",
  "Efficiency",
  "Liquidity",
  "Profitability",
  "Leverage",
  "Cash Flow",
  "Valuation",
];

function cloneSample(): InputMap {
  return JSON.parse(JSON.stringify(microsoftFiscal2025));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function shortFingerprint(fingerprint: string) {
  return `${fingerprint.slice(0, 10)}…${fingerprint.slice(-8)}`;
}

function Overview({
  result,
  onOpenMetric,
  onOpenFamily,
  onOpenScoring,
}: {
  result: Evaluation;
  onOpenMetric: (metric: Metric) => void;
  onOpenFamily: (family: string) => void;
  onOpenScoring: () => void;
}) {
  const keyMetrics = keyMetricIds
    .map((id) => result.metrics.find((metric) => metric.id === id))
    .filter(Boolean) as Metric[];
  const complete = result.families.filter((family) => family.status === "Complete").length;
  const overallStatus = complete === result.families.length ? "Complete" : "Partial";
  const incompleteFamily = result.families.find((family) => family.status !== "Complete");
  const unavailableRules = result.scoring.rules.filter((rule) => rule.status === "Unavailable");
  const unavailableWeight = Math.max(
    0,
    Number(result.scoring.totalWeight) - Number(result.scoring.availableWeight),
  ).toFixed(2);
  const inputEvidence = (result.inputs.inputEvidence ?? {}) as unknown as Record<
    string,
    { status?: string; label?: string; reason?: string }
  >;
  const collectionFailures = Object.entries(inputEvidence)
    .filter(([, evidence]) => evidence?.status === "CollectionFailure")
    .map(([field, evidence]) => evidence.label ?? field);

  return (
    <div className="view-stack">
      <section className="hero-panel" aria-labelledby="evaluation-heading">
        <div>
          <p className="section-kicker">Latest governed evaluation</p>
          <h1 id="evaluation-heading">{result.companyName}</h1>
          <p className="hero-meta">
            <span className="ticker-chip">{result.ticker}</span>
            <span>
              {formatDate(result.periodStart)}–{formatDate(result.periodEnd)} · {result.reportingPeriod.actualDayCount} actual days
            </span>
          </p>
        </div>
        <div className="evaluation-scorecard" aria-label="Evaluation status">
          <div>
            <strong>{result.metrics.length}</strong>
            <span>measurements</span>
          </div>
          <div>
            <strong>{complete}/6</strong>
            <span>families complete</span>
          </div>
          <div className={`status-summary ${overallStatus.toLowerCase()}`}>
            <span className="status-dot" />
            <strong>{overallStatus}</strong>
            <span>overall coverage</span>
          </div>
        </div>
      </section>

      {collectionFailures.length > 0 && (
        <section className="acquisition-warning" role="status" aria-labelledby="acquisition-warning-heading">
          <div>
            <p className="section-kicker">Acquisition warning</p>
            <h2 id="acquisition-warning-heading">Official filing fallback did not complete</h2>
          </div>
          <p>
            Company Facts supplied the available standardized evidence, but the full filing could not be checked for {collectionFailures.join(", ")}.
            Reload the company before treating those fields as genuinely unreported; independent calculations remain valid.
          </p>
        </section>
      )}

      <section
        className={`score-overview ${result.scoring.status.toLowerCase()}`}
        aria-labelledby="governed-score-heading"
      >
        <div className="score-overview-value">
          <p className="section-kicker">Governed score</p>
          {result.scoring.status === "Scored" ? (
            <>
              <div>
                <strong>{result.scoring.overallScore}</strong>
                <span>/100</span>
              </div>
              <em>{result.scoring.tier}</em>
            </>
          ) : (
            <>
              <div><strong>—</strong></div>
              <em>{result.scoring.status === "NotApplicable" ? "Profile excluded" : "Score withheld"}</em>
            </>
          )}
        </div>
        <div className="score-overview-copy">
          <div className="section-heading-row compact">
            <div>
              <p className="section-kicker">Scoring profile</p>
              <h2 id="governed-score-heading">{result.scoring.profileName}</h2>
            </div>
            <button className="text-button" onClick={onOpenScoring}>View point audit</button>
          </div>
          {result.scoring.status === "Scored" ? (
            <p>
              Conservative range <strong>{result.scoring.overallScore}–{result.scoring.maximumScore}</strong>
              {" · "}{result.scoring.coveragePercent}% scoring coverage
              {" · "}{result.scoring.rulesScored}/{result.scoring.rulesTotal} rules evaluated.
            </p>
          ) : result.scoring.status === "InsufficientCoverage" ? (
            <div className="score-publication-gate" role="status">
              <p>
                Weighted scoring coverage is <strong>{result.scoring.coveragePercent}%</strong>, below the required <strong>{result.scoring.minimumCoveragePercent}%</strong> publication threshold.
                {" "}{unavailableRules.length} rule{unavailableRules.length === 1 ? " is" : "s are"} unavailable, representing {unavailableWeight} weighted points.
              </p>
              <strong>Rules preventing score publication</strong>
              <ul>
                {unavailableRules.map((rule) => (
                  <li key={rule.metricId}>
                    <span>{rule.name} ({rule.weight} points)</span>
                    <small>{rule.rationale}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>{result.scoring.classification.reason}</p>
          )}
          <small>
            SEC SIC {result.scoring.classification.sic ?? "not available"}
            {result.scoring.classification.sicDescription
              ? ` · ${result.scoring.classification.sicDescription}`
              : ""}. This score is a versioned research policy, not an investment recommendation.
          </small>
        </div>
      </section>

      {result.scoring.families.length > 0 && (
        <section aria-labelledby="score-family-heading">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Score composition</p>
              <h2 id="score-family-heading">Family scores</h2>
            </div>
            <p className="section-note">Missing rules remain unawarded—never reweighted</p>
          </div>
          <div className="score-family-grid">
            {result.scoring.families.map((family) => (
              <button className="score-family-card" key={family.family} onClick={onOpenScoring}>
                <span>{family.family}</span>
                <strong>{family.score}<small>/100</small></strong>
                <em>{family.coveragePercent}% coverage</em>
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="family-status-heading">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Coverage</p>
            <h2 id="family-status-heading">Evidence family status</h2>
          </div>
          <button className="text-button" onClick={() => onOpenFamily("All families")}>
            View all evidence
          </button>
        </div>
        <div className="family-grid">
          {result.families.map((family) => (
            <button
              key={family.family}
              className="family-card"
              onClick={() => onOpenFamily(family.family)}
              aria-label={`Open ${family.family} evidence`}
            >
              <span className={`family-mark ${family.status.toLowerCase()}`} />
              <span className="family-card-copy">
                <span className="family-name">{family.family}</span>
                <span className="family-count">{family.metricCount} measurements</span>
              </span>
              <span className={`status-pill ${family.status.toLowerCase()}`}>
                {family.status}
              </span>
              <span className="card-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
        <div className={`coverage-note ${incompleteFamily ? "" : "complete"}`}>
          <span className="status-dot" />
          <strong>{incompleteFamily ? "Why coverage is incomplete" : "All families complete"}</strong>
          <p>{incompleteFamily?.detail ?? "Every implemented measurement has the governed input required for this evaluation."}</p>
        </div>
      </section>

      <section aria-labelledby="key-measurements-heading">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">At a glance</p>
            <h2 id="key-measurements-heading">Key measurements</h2>
          </div>
          <p className="section-note">Objective values—no scores or recommendations</p>
        </div>
        <div className="metric-grid">
          {keyMetrics.map((metric) => (
            <button
              key={metric.id}
              className="metric-card"
              onClick={() => onOpenMetric(metric)}
            >
              <span className="metric-family">{metric.family}</span>
              <span className="metric-value">
                {formatMetric(metric, true)}
                {metric.unit === "Percent" && <small>%</small>}
              </span>
              <span className="metric-name">{metric.name}</span>
              <span className="metric-unit">
                {metric.unit === "Percent" ? "Percent" : metric.unit}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="source-evidence-heading">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Provenance</p>
            <h2 id="source-evidence-heading">Source evidence</h2>
          </div>
          <p className="section-note">Open the governed source in a new tab</p>
        </div>
        <div className="source-grid">
          {result.sources.map((source) => (
            <a key={source.sourceType} className="source-card" href={source.uri} target="_blank" rel="noreferrer">
              <span className={source.sourceType === "Market Price" ? "source-type market" : "source-type"}>{source.sourceType}</span>
              <strong>{source.identifier}</strong>
              <small>Observed {formatDate(source.observationDate)}</small>
              <span className="source-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="audit-strip" aria-label="Evaluation reproducibility">
        <div>
          <span className="audit-icon" aria-hidden="true">#</span>
          <div>
            <strong>Reproducibility fingerprint</strong>
            <code title={result.fingerprint}>{shortFingerprint(result.fingerprint)}</code>
          </div>
        </div>
        <div>
          <span className="audit-icon" aria-hidden="true">↗</span>
          <div>
            <strong>Source evidence</strong>
            <span>SEC filing + dated market observation</span>
          </div>
        </div>
        <div>
          <span className="audit-icon" aria-hidden="true">✓</span>
          <div>
            <strong>Deterministic engine</strong>
            <span>{result.engineVersion} · Registry {result.calculationRegistryVersion}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function EvidenceTable({
  result,
  family,
  setFamily,
  onOpenMetric,
}: {
  result: Evaluation;
  family: string;
  setFamily: (family: string) => void;
  onOpenMetric: (metric: Metric) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = result.metrics.filter(
    (metric) =>
      (family === "All families" || metric.family === family) &&
      `${metric.name} ${metric.family}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="view-stack">
      <section className="view-intro">
        <div>
          <p className="section-kicker">Evidence catalog</p>
          <h1>Governed measurements</h1>
          <p>Every result includes its formula, governed inputs, unit, and source lineage.</p>
        </div>
        <div className="catalog-count">
          <strong>{filtered.length}</strong>
          <span>shown</span>
        </div>
      </section>

      <section className="table-panel">
        <div className="table-toolbar">
          <label className="search-box">
            <span className="sr-only">Search measurements</span>
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search measurements"
            />
          </label>
          <div className="filter-pills" aria-label="Filter by family">
            {familyOrder.map((item) => (
              <button
                key={item}
                className={family === item ? "active" : ""}
                onClick={() => setFamily(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table className="evidence-table">
            <thead>
              <tr>
                <th>Measurement</th>
                <th>Family</th>
                <th className="numeric">Value</th>
                <th>Unit</th>
                <th><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((metric) => (
                <tr key={metric.id}>
                  <td>
                    <button className="measurement-link" onClick={() => onOpenMetric(metric)}>
                      {metric.name}
                    </button>
                    <span className="formula-preview">{metric.expression}</span>
                    <small className="registry-reference">
                      {metric.canonicalEvidenceId ?? metric.governanceReference ?? "CE document gap"}
                      {" · "}{metric.calculationId}@{metric.calculationVersion}
                    </small>
                  </td>
                  <td><span className="family-tag">{metric.family}</span></td>
                  <td className="numeric metric-table-value">{formatMetric(metric)}</td>
                  <td>{metric.unit}</td>
                  <td>
                    <button className="row-action" onClick={() => onOpenMetric(metric)} aria-label={`Inspect ${metric.name}`}>
                      →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {result.unavailableMetrics.length > 0 && (
        <section className="unavailable-panel" aria-labelledby="unavailable-heading">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Coverage explanation</p>
              <h2 id="unavailable-heading">Unavailable measurements</h2>
            </div>
            <p className="section-note">
              {result.unavailableMetrics.length} formula{result.unavailableMetrics.length === 1 ? "" : "s"} withheld—never estimated
            </p>
          </div>
          <div className="unavailable-list">
            {result.unavailableMetrics.map((item) => (
              <div className="unavailable-row" key={item.id}>
                <span className="family-tag">{item.family}</span>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ScoringView({ result }: { result: Evaluation }) {
  const score = result.scoring;
  const metricMap = new Map(result.metrics.map((metric) => [metric.id, metric]));
  const familyWeights = Array.from(
    GENERAL_OPERATING_COMPANY_PROFILE.rules.reduce((weights, rule) => {
      weights.set(rule.family, (weights.get(rule.family) ?? 0) + rule.weight);
      return weights;
    }, new Map<string, number>()),
  );

  return (
    <div className="view-stack scoring-view">
      <section className="view-intro">
        <div>
          <p className="section-kicker">Governed interpretation</p>
          <h1>Transparent scoring audit</h1>
          <p>Every point comes from a published measurement, fixed threshold, and explicit weight.</p>
        </div>
        <div className="score-version">
          <span>Policy version</span>
          <strong>{score.scoringVersion}</strong>
        </div>
      </section>

      <section className={`score-detail-hero ${score.status.toLowerCase()}`}>
        <div className="score-detail-number">
          <span>Conservative score</span>
          <div>
            <strong>{score.overallScore ?? "—"}</strong>
            {score.overallScore && <small>/100</small>}
          </div>
          <em>{score.tier ?? score.status}</em>
        </div>
        <div className="score-detail-copy">
          <p className="section-kicker">{score.profileName}</p>
          <h2>{score.status === "Scored" ? "Profile applied" : "Score not published"}</h2>
          <p>
            {score.status === "Scored"
              ? `The conservative score awards no points for unavailable rules. The current evidence supports a range of ${score.overallScore}–${score.maximumScore}.`
              : score.status === "InsufficientCoverage"
                ? `Weighted coverage is ${score.coveragePercent}%, below the ${score.minimumCoveragePercent}% score-publication threshold. Unavailable rules remain unawarded and are never reweighted.`
                : score.classification.reason}
          </p>
          <div className="score-detail-stats">
            <div><strong>{score.coveragePercent}%</strong><span>coverage</span></div>
            <div><strong>{score.rulesScored}/{score.rulesTotal}</strong><span>rules scored</span></div>
            <div><strong>{score.classification.sic ?? "—"}</strong><span>SEC SIC</span></div>
          </div>
        </div>
      </section>

      <section className="principle-panel score-principle">
        <p>{score.profileNote}</p>
      </section>

      {score.families.length > 0 && (
        <section aria-labelledby="scoring-family-heading">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Weighted composition</p>
              <h2 id="scoring-family-heading">Family contribution</h2>
            </div>
            <p className="section-note">Conservative score · maximum score · coverage</p>
          </div>
          <div className="score-family-detail-grid">
            {score.families.map((family) => (
              <article className="score-family-detail" key={family.family}>
                <div>
                  <span>{family.family}</span>
                  <em>{family.status}</em>
                </div>
                <strong>{family.score}<small>/100</small></strong>
                <p>Range {family.score}–{family.maximumScore}</p>
                <div className="coverage-meter" aria-label={`${family.family} scoring coverage ${family.coveragePercent}%`}>
                  <span style={{ width: `${Math.min(100, Number(family.coveragePercent))}%` }} />
                </div>
                <small>{family.coveragePercent}% coverage · {family.earnedPoints}/{family.totalWeight} points</small>
              </article>
            ))}
          </div>
        </section>
      )}

      {score.rules.length > 0 && (
        <section className="table-panel" aria-labelledby="point-audit-heading">
          <div className="scoring-table-heading">
            <div>
              <p className="section-kicker">Point-level lineage</p>
              <h2 id="point-audit-heading">Complete scoring audit</h2>
            </div>
            <span>{score.rulesScored} scored · {score.rulesTotal - score.rulesScored} unavailable</span>
          </div>
          <div className="table-scroll">
            <table className="evidence-table scoring-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Observed</th>
                  <th>Matched band</th>
                  <th className="numeric">Weight</th>
                  <th className="numeric">Rule score</th>
                  <th className="numeric">Points</th>
                </tr>
              </thead>
              <tbody>
                {score.rules.map((row) => {
                  const metric = metricMap.get(row.metricId);
                  return (
                    <tr key={row.metricId} className={row.status === "Unavailable" ? "score-unavailable" : ""}>
                      <td>
                        <strong>{row.name}</strong>
                        <span className="formula-preview">{row.family} · {row.policy}</span>
                      </td>
                      <td>{metric ? `${formatMetric(metric)} ${metric.unit}` : "Unavailable"}</td>
                      <td>{row.matchedBand ?? row.rationale}</td>
                      <td className="numeric">{row.weight}</td>
                      <td className="numeric">{row.tierScore ?? "—"}</td>
                      <td className="numeric score-points">{row.awardedPoints}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="scoring-policy-panel" aria-labelledby="policy-boundary-heading">
        <div>
          <p className="section-kicker">Policy boundary</p>
          <h2 id="policy-boundary-heading">Where this profile applies</h2>
          <p>
            The profile requires an SEC SIC classification and excludes regulated utilities plus
            finance, insurance, and real-estate issuers. Those companies need purpose-built rules.
          </p>
          <p>
            SEC SIC {score.classification.sic ?? "not available"}
            {score.classification.sicDescription ? ` · ${score.classification.sicDescription}` : ""}
          </p>
        </div>
        <div>
          <h3>Family weights</h3>
          <ul>
            {familyWeights.map(([family, weight]) => <li key={family}><span>{family}</span><strong>{weight}</strong></li>)}
          </ul>
        </div>
        <div>
          <h3>Score tiers</h3>
          <ul>
            {GENERAL_OPERATING_COMPANY_PROFILE.bands.map((band, index) => {
              const prior = GENERAL_OPERATING_COMPANY_PROFILE.bands[index - 1];
              return (
                <li key={band.tier}>
                  <span>{band.tier}</span>
                  <strong>{band.minimum}–{prior ? prior.minimum - 0.01 : 100}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}

function InputsView({
  inputs,
  errors,
  dirty,
  onChange,
  onRun,
  onReset,
}: {
  inputs: InputMap;
  errors: Record<string, string>;
  dirty: boolean;
  onChange: (key: string, value: string | number | null) => void;
  onRun: () => void;
  onReset: () => void;
}) {
  return (
    <div className="view-stack input-view">
      <section className="view-intro">
        <div>
          <p className="section-kicker">Governed dataset</p>
          <h1>Evaluation inputs</h1>
          <p>Financial statement values use the reporting basis shown below.</p>
        </div>
        <div className="input-actions">
          <button className="secondary-button" onClick={onReset}>Restore Microsoft example</button>
          <button className="primary-button" onClick={onRun}>
            {dirty ? "Run updated evaluation" : "Run evaluation"}
          </button>
        </div>
      </section>

      {Object.keys(errors).length > 0 && (
        <div className="validation-banner" role="alert">
          <strong>Evaluation blocked</strong>
          <span>Correct {Object.keys(errors).length} governed input {Object.keys(errors).length === 1 ? "error" : "errors"} below.</span>
        </div>
      )}

      {fieldGroups.map((group) => (
        <section className="input-panel" key={group.id}>
          <div className="input-panel-heading">
            <div>
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            {group.id !== "identity" && (
              <span className="unit-badge">{inputs.reportingCurrency} · {inputs.unitScale}</span>
            )}
          </div>
          <div className={`input-grid ${group.id === "identity" ? "identity-grid" : ""}`}>
            {group.fields.map(([key, label, type]: [string, string, string]) => (
              <label className={`form-field ${errors[key] ? "has-error" : ""}`} key={key}>
                <span>{label}</span>
                <input
                  type={type}
                  step={type === "number" ? "any" : undefined}
                  value={inputs[key] ?? ""}
                  aria-invalid={Boolean(errors[key])}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                  onChange={(event) =>
                    onChange(
                      key,
                      type === "number"
                        ? event.target.value === ""
                          ? null
                          : Number(event.target.value)
                        : event.target.value,
                    )
                  }
                />
                {errors[key] && <small id={`${key}-error`}>{errors[key]}</small>}
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MethodologyView({ onOpenDefinition }: { onOpenDefinition: (id: string) => void }) {
  const definitions = Object.entries(metricDefinitions) as Array<
    [string, { family: string; name: string; unit: string; expression: string; dependencies: string[]; version: string; canonicalEvidenceId: string | null; governanceReference: string | null }]
  >;
  return (
    <div className="view-stack">
      <section className="view-intro">
        <div>
          <p className="section-kicker">Canonical calculations</p>
          <h1>Methodology register</h1>
          <p>Formulas are fixed, inspectable, and separated from interpretation.</p>
        </div>
        <div className="methodology-principle">
          <strong>Executable registries</strong>
          <span>CE {CANONICAL_REGISTRY_VERSION} · Calc {CALCULATION_REGISTRY_VERSION} · Alias {ALIAS_REGISTRY_VERSION}</span>
        </div>
      </section>
      <section className="principle-panel">
        <p>
          Measurements remain objective. The separate scoring policy applies fixed thresholds
          and weights, withholds unsupported profiles, and does not make an investment recommendation.
        </p>
      </section>
      <section className="method-score-policy">
        <div>
          <p className="section-kicker">Interpretation policy</p>
          <h2>{GENERAL_OPERATING_COMPANY_PROFILE.name}</h2>
          <p>{GENERAL_OPERATING_COMPANY_PROFILE.policyNote}</p>
        </div>
        <div>
          <strong>{GENERAL_OPERATING_COMPANY_PROFILE.rules.length}</strong>
          <span>weighted rules</span>
        </div>
        <div>
          <strong>{GENERAL_OPERATING_COMPANY_PROFILE.minimumCoveragePercent}%</strong>
          <span>minimum coverage</span>
        </div>
        <div>
          <strong>{GENERAL_OPERATING_COMPANY_PROFILE.totalWeight}</strong>
          <span>available points</span>
        </div>
      </section>
      <div className="methodology-list">
        {familyOrder.slice(1).map((family) => {
          const familyDefinitions = definitions.filter(([, definition]) => definition.family === family);
          return (
            <section className="method-family" key={family}>
              <div className="method-family-heading">
                <h2>{family}</h2>
                <span>{familyDefinitions.length} calculations</span>
              </div>
              <div>
                {familyDefinitions.map(([id, definition]) => (
                  <button className="method-row" key={id} onClick={() => onOpenDefinition(id)}>
                    <span>
                      <strong>{definition.name}</strong>
                      <small>
                        {definition.canonicalEvidenceId ?? definition.governanceReference ?? "CE document gap"}
                        {" · "}{id}@{definition.version}
                      </small>
                    </span>
                    <code>{definition.expression}</code>
                    <span className="card-arrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MetricDrawer({ metric, onClose }: { metric: Metric | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!metric) return;
    closeRef.current?.focus();
    const listener = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [metric, onClose]);
  if (!metric) return null;

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="metric-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-header">
          <span className="family-tag">{metric.family}</span>
          <button ref={closeRef} className="close-button" onClick={onClose} aria-label="Close details">×</button>
        </div>
        <div className="drawer-title-block">
          <p className="section-kicker">Evidence result</p>
          <h2 id="drawer-title">{metric.name}</h2>
          <div className="drawer-value">
            <strong>{formatMetric(metric)}</strong>
            <span>{metric.unit}</span>
          </div>
        </div>
        <section className="formula-block">
          <span>Governed calculation</span>
          <code>{metric.expression}</code>
        </section>
        <section className="registry-block">
          <div><span>Canonical evidence</span><strong>{metric.canonicalEvidenceId ?? metric.governanceReference ?? "Document gap recorded"}</strong></div>
          <div><span>Calculation</span><strong>{metric.calculationId}@{metric.calculationVersion}</strong></div>
          <div><span>Period rule</span><strong>{metric.periodRule}</strong></div>
          <div><span>Validation</span><strong>{metric.validation.status}</strong></div>
        </section>
        <section className="lineage-section">
          <div className="section-heading-row compact">
            <h3>Input lineage</h3>
            <span>{metric.lineage.length} dependencies</span>
          </div>
          <div className="lineage-list">
            {metric.lineage.map((item) => (
              <div className="lineage-row" key={item.key}>
                <span className={`source-mark ${item.source}`} aria-hidden="true" />
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.source === "filing" ? "SEC filing" : item.source === "market" ? "Market source" : item.source === "parameter" ? "Governed period parameter" : "Calculated dependency"}</span>
                  {item.evidence?.concept && (
                    <small className="lineage-concept">
                      {item.evidence.taxonomy}:{item.evidence.concept}
                      {item.evidence.end ? ` · ${item.evidence.end}` : ""}
                    </small>
                  )}
                </div>
                <code>{
                  typeof item.value === "number" || Number.isFinite(Number(item.value))
                    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(Number(item.value))
                    : item.value
                }</code>
              </div>
            ))}
          </div>
        </section>
        <section className="drawer-note">
          <strong>Interpretation boundary</strong>
          <p>This value is a governed measurement. Its meaning for an investment decision belongs to a separate research model.</p>
        </section>
      </aside>
    </div>
  );
}

export default function EvidenceWorkbench() {
  const [inputs, setInputs] = useState<InputMap>(cloneSample);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [activeView, setActiveView] = useState<(typeof navItems)[number][0]>("overview");
  const [familyFilter, setFamilyFilter] = useState("All families");
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(true);
  const [notice, setNotice] = useState("");
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [savingRecord, setSavingRecord] = useState(false);
  const [loadedRecord, setLoadedRecord] = useState<{
    id: string;
    savedAt: string;
    fingerprint: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runEvaluation = async (nextInputs = inputs) => {
    const nextErrors = validateInputs(nextInputs);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setActiveView("inputs");
      setNotice("Evaluation blocked by governed input errors.");
      return;
    }
    setRunning(true);
    try {
      const nextResult = (await evaluateInputs(nextInputs)) as Evaluation;
      setResult(nextResult);
      setLoadedRecord(null);
      setDirty(false);
      setNotice("Evaluation complete. Results and fingerprint updated.");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    let active = true;
    const sample = cloneSample();
    void evaluateInputs(sample).then((nextResult) => {
      if (!active) return;
      setResult(nextResult as Evaluation);
      setRunning(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const navCounts = useMemo(
    () => ({ evidence: result?.metrics.length ?? 30, inputs: Object.keys(errors).length }),
    [result, errors],
  );

  const changeInput = (key: string, value: string | number | null) => {
    setInputs((current) => {
      const currentEvidence = (
        current as unknown as { inputEvidence?: Record<string, Record<string, unknown>> }
      ).inputEvidence;
      if (!currentEvidence?.[key]) return { ...current, [key]: value };
      return {
        ...current,
        [key]: value,
        inputEvidence: {
          ...currentEvidence,
          [key]: {
            ...currentEvidence[key],
            status: "Override",
            confidence: "Manual",
            value,
            method: "manual-override",
            reason: "Changed in the governed Inputs view after acquisition.",
          },
        },
      } as unknown as InputMap;
    });
    setDirty(true);
    setLoadedRecord(null);
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const resetMicrosoft = () => {
    const sample = cloneSample();
    setInputs(sample);
    setErrors({});
    setDirty(true);
    setLoadedRecord(null);
    setNotice("Microsoft FY2025 baseline restored. Run to refresh results.");
  };

  const importInputs = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const imported = data.inputs ?? data;
      setInputs({ ...cloneSample(), ...imported });
      setDirty(true);
      setLoadedRecord(null);
      setErrors({});
      setActiveView("inputs");
      setNotice("Inputs imported. Review the dataset, then run the evaluation.");
    } catch {
      setNotice("That file is not valid Evidence Engine JSON.");
    }
  };

  const saveBrowserSnapshot = () => {
    if (!result) return;
    const snapshot = {
      savedAt: new Date().toISOString(),
      label: `${result.ticker} ${result.periodEnd}`,
      inputs,
      fingerprint: result.fingerprint,
    };
    localStorage.setItem("tmdl-evidence-engine-snapshot", JSON.stringify(snapshot));
    setNotice("Snapshot saved in this browser.");
  };

  const loadBrowserSnapshot = () => {
    const stored = localStorage.getItem("tmdl-evidence-engine-snapshot");
    if (!stored) {
      setNotice("No browser snapshot has been saved on this device.");
      return;
    }
    try {
      const snapshot = JSON.parse(stored);
      setInputs({ ...cloneSample(), ...snapshot.inputs });
      setErrors({});
      setDirty(true);
      setLoadedRecord(null);
      setActiveView("inputs");
      setNotice(`Loaded ${snapshot.label ?? "saved"} inputs. Run to refresh results.`);
    } catch {
      setNotice("The saved browser snapshot could not be read.");
    }
  };

  const openFamily = (family: string) => {
    setFamilyFilter(family);
    setActiveView("evidence");
  };

  const openDefinition = (id: string) => {
    const metric = result?.metrics.find((item) => item.id === id);
    if (metric) setSelectedMetric(metric);
  };

  const applyAcquiredDataset = async (
    nextInputs: Record<string, unknown>,
    runWhenValid: boolean,
  ) => {
    const typedInputs = nextInputs as unknown as InputMap;
    setInputs(typedInputs);
    setLoadedRecord(null);
    setErrors({});
    setDirty(true);
    if (!runWhenValid) {
      setActiveView("inputs");
      setNotice("SEC evidence imported. Review flagged or unresolved inputs before evaluation.");
      return;
    }
    const nextErrors = validateInputs(typedInputs);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setActiveView("inputs");
      setNotice("SEC evidence imported, but governed input review is still required.");
      return;
    }
    setRunning(true);
    try {
      const nextResult = (await evaluateInputs(typedInputs)) as Evaluation;
      setResult(nextResult);
      setDirty(false);
      setActiveView("overview");
      setNotice(`${nextResult.ticker} evaluation complete from SEC filing evidence.`);
    } finally {
      setRunning(false);
    }
  };

  const saveImmutableRecord = async () => {
    if (!result || dirty) return;
    setSavingRecord(true);
    try {
      const response = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          label: `${result.ticker} ${result.periodEnd}`,
          evaluation: result,
        }),
      });
      const payload = (await response.json()) as {
        created?: boolean;
        error?: string;
        record?: { id: string; savedAt: string; fingerprint: string };
      };
      if (!response.ok || !payload.record) {
        throw new Error(payload.error ?? "The immutable record could not be saved.");
      }
      setLoadedRecord(payload.record);
      setHistoryRefreshToken((current) => current + 1);
      setNotice(
        payload.created
          ? "Immutable evaluation record saved with its complete evidence and version context."
          : "This exact fingerprint is already preserved in immutable history.",
      );
    } catch (caught) {
      setNotice(
        caught instanceof Error ? caught.message : "The immutable record could not be saved.",
      );
    } finally {
      setSavingRecord(false);
    }
  };

  const loadExactRecord = (record: EvaluationRecordDetail) => {
    const exactResult = record.evaluation as unknown as Evaluation;
    setResult(exactResult);
    setInputs(exactResult.inputs);
    setErrors({});
    setDirty(false);
    setLoadedRecord({ id: record.id, savedAt: record.savedAt, fingerprint: record.fingerprint });
    setActiveView("overview");
    setNotice("Exact immutable publication loaded. No calculation was rerun.");
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">TMDL</span>
          <div>
            <strong>Evidence Engine</strong>
            <span>Evaluation workbench</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Workbench sections">
          {navItems.map(([id, label, description]) => (
            <button
              key={id}
              className={activeView === id ? "active" : ""}
              onClick={() => setActiveView(id)}
              aria-current={activeView === id ? "page" : undefined}
            >
              <span className="nav-indicator" />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              {id === "inputs" && navCounts.inputs > 0 && <em>{navCounts.inputs}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-context">
          <span>Active dataset</span>
          <strong>{inputs.ticker || "Untitled"}</strong>
          <small>{inputs.periodEnd ? `Period ended ${inputs.periodEnd}` : "No period selected"}</small>
          <div className={`dataset-state ${dirty ? "dirty" : "current"}`}>
            <span />{dirty ? "Changes not evaluated" : "Evaluation current"}
          </div>
        </div>

        <div className="sidebar-footer">
          <span>Engine {ENGINE_VERSION}</span>
          <small>Objective evidence · Not investment advice</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand">TMDL <span>Evidence Engine</span></div>
          <div className="topbar-context">
            <span className="ticker-chip">{inputs.ticker || "—"}</span>
            <div>
              <strong>{inputs.companyName || "Untitled evaluation"}</strong>
              <span>{inputs.periodEnd ? `Period end ${inputs.periodEnd}` : "No reporting period"}</span>
            </div>
            {loadedRecord && <span className="loaded-record-badge">Immutable record loaded</span>}
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" onClick={() => fileInputRef.current?.click()}>
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => event.target.files?.[0] && void importInputs(event.target.files[0])}
            />
            <div className="export-menu">
              <button className="secondary-button">Export ▾</button>
              <div className="export-popover">
                <button onClick={() => result && download(`${result.ticker}-${result.periodEnd}-evidence.json`, JSON.stringify(result, null, 2), "application/json")}>Evaluation JSON</button>
                <button onClick={() => result && download(`${result.ticker}-${result.periodEnd}-evidence.md`, renderMarkdown(result), "text/markdown")}>Evaluation Markdown</button>
                <button onClick={() => download(`${String(inputs.ticker || "company")}-inputs.json`, JSON.stringify(inputs, null, 2), "application/json")}>Inputs JSON</button>
                <button onClick={saveBrowserSnapshot}>Save browser draft</button>
                <button onClick={loadBrowserSnapshot}>Load browser snapshot</button>
                <button onClick={() => window.print()}>Print report</button>
              </div>
            </div>
            <button
              className="secondary-button save-button"
              onClick={() => void saveImmutableRecord()}
              disabled
              title={savingRecord
                ? "Cloud record operation in progress."
                : "Public release: use browser drafts or export files. Immutable cloud records are restricted."}
            >
              Public mode · local exports
            </button>
            <button className="primary-button run-button" onClick={() => void runEvaluation()} disabled={running}>
              {running ? "Evaluating…" : dirty ? "Run updated evaluation" : "Run evaluation"}
            </button>
          </div>
        </header>

        <div className="mobile-nav" role="navigation" aria-label="Workbench sections">
          {navItems.map(([id, label]) => (
            <button key={id} className={activeView === id ? "active" : ""} onClick={() => setActiveView(id)}>{label}</button>
          ))}
        </div>

        <div className="workspace-body" aria-live="polite">
          {!result ? (
            <div className="loading-state"><span />Preparing governed evaluation…</div>
          ) : activeView === "overview" ? (
            <Overview
              result={result}
              onOpenMetric={setSelectedMetric}
              onOpenFamily={openFamily}
              onOpenScoring={() => setActiveView("scoring")}
            />
          ) : activeView === "history" ? (
            <EvaluationHistory
              refreshToken={historyRefreshToken}
              onLoadExact={loadExactRecord}
              onNotice={setNotice}
            />
          ) : activeView === "scoring" ? (
            <ScoringView result={result} />
          ) : activeView === "acquire" ? (
            <SecAcquisition onUseDataset={(nextInputs, runWhenValid) => void applyAcquiredDataset(nextInputs, runWhenValid)} />
          ) : activeView === "evidence" ? (
            <EvidenceTable result={result} family={familyFilter} setFamily={setFamilyFilter} onOpenMetric={setSelectedMetric} />
          ) : activeView === "inputs" ? (
            <InputsView inputs={inputs} errors={errors} dirty={dirty} onChange={changeInput} onRun={() => void runEvaluation()} onReset={resetMicrosoft} />
          ) : (
            <MethodologyView onOpenDefinition={openDefinition} />
          )}
        </div>
      </section>

      {notice && <div className="notice-toast" role="status">{notice}</div>}
      <MetricDrawer metric={selectedMetric} onClose={() => setSelectedMetric(null)} />
    </main>
  );
}
