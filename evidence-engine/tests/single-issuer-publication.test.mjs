import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { evaluateInputs, microsoftFiscal2025 } from "../lib/evidence-engine.mjs";
import { createSourceManifest } from "../lib/longitudinal-state.mjs";
import {
  AUTHORITATIVE_WRITE_FLAG,
  StateServiceError,
  parseSingleIssuerPublicationArguments,
  publishSingleIssuer,
  renderPrePublicationSummary,
  renderQualificationResult,
  validatePublicationEnvironment,
} from "../lib/single-issuer-publication.mjs";

const endpoint = "https://state.example.test";
const token = "qualification-secret-that-is-never-rendered";
const revision = "a".repeat(40);
const fixedNow = () => new Date("2026-08-01T00:01:00.000Z");
process.env.GITHUB_SHA = revision;

async function qualificationFixture() {
  const evaluation = await evaluateInputs({
    ...microsoftFiscal2025,
    ticker: "AAPL",
    companyName: "Apple Inc.",
    accessionNumber: "0000320193-25-000079",
    filingDate: "2025-10-31",
    marketObservationDate: "2026-07-31",
    marketUrl: "https://market.example/aapl-snapshot",
  });
  const sourceManifest = await createSourceManifest({
    evaluation,
    securityId: "sec-cik:0000320193",
    acquiredAt: "2026-08-01T00:00:00.000Z",
    marketSource: {
      provider: "Fixture",
      acquiredAt: "2026-07-31T20:00:00.000Z",
      immutableReference: "https://market.example/aapl-snapshot",
    },
  });
  return {
    preview: { previewKnownAt: "2026-08-01T00:00:00.000Z", publicationAttempted: false, authoritativeStateWritten: false },
    identity: { ticker: "AAPL", company: "Apple Inc.", cik: "0000320193", securityId: "sec-cik:0000320193" },
    filings: {
      annual: { form: "10-K", accessionNumber: "0000320193-25-000079", reportDate: "2025-09-27", filingDate: "2025-10-31" },
      quarterly: null,
      comparablePriorQuarter: null,
    },
    marketObservation: { identity: "Fixture:AAPL:2026-07-31", provider: "Fixture", price: 200, observedAt: "2026-07-31T20:00:00.000Z" },
    outcome: { outcome: "Eligible" },
    evaluation,
    sourceManifest,
  };
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function createFirstPublicationService({ postResponse } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (options.method === "POST") {
      const request = JSON.parse(options.body);
      return postResponse?.(request) ?? response({ created: true, record: {
        resultId: request.publication.resultId,
        securityId: request.publication.securityId,
        knownAt: request.publication.knownAt,
        publishedAt: request.publication.publishedAt,
        eventType: request.publication.eventType,
        stateFingerprint: request.stateFingerprint,
        recordHash: request.recordHash,
        sourceManifestId: request.publication.sourceManifestId,
      } }, 201);
    }
    return response({ records: [] });
  };
  return { calls, fetchImpl };
}

function withEvaluationAcquisitionClock(fixture, acquiredAt, fingerprint = `legacy-${acquiredAt}`) {
  const changed = structuredClone(fixture);
  const setEvidenceClock = (evidence) => {
    if (!evidence || typeof evidence !== "object") return;
    evidence.knownAt = acquiredAt;
    for (const component of evidence.componentEvidence ?? []) setEvidenceClock(component);
  };
  changed.preview.previewKnownAt = acquiredAt;
  changed.evaluation.inputs.acquisition = { ...changed.evaluation.inputs.acquisition, acquiredAt };
  for (const evidence of Object.values(changed.evaluation.inputs.inputEvidence ?? {})) setEvidenceClock(evidence);
  for (const metric of changed.evaluation.metrics ?? []) {
    for (const lineage of metric.lineage ?? []) setEvidenceClock(lineage.evidence);
  }
  changed.evaluation.fingerprint = fingerprint;
  return changed;
}

test("exactly one explicit ticker and an unmistakable write guard are required", () => {
  assert.deepEqual(parseSingleIssuerPublicationArguments(["aapl", AUTHORITATIVE_WRITE_FLAG, "--json"]), {
    ticker: "AAPL", json: true, confirmed: true, help: false,
  });
  assert.throws(() => parseSingleIssuerPublicationArguments([]), /one ticker/i);
  assert.throws(() => parseSingleIssuerPublicationArguments([AUTHORITATIVE_WRITE_FLAG]), /one ticker/i);
  assert.throws(() => parseSingleIssuerPublicationArguments(["AAPL", "MSFT", AUTHORITATIVE_WRITE_FLAG]), /exactly one ticker/i);
  for (const ticker of ["ALL", "UNIVERSE", "*", "AAPL,MSFT", "AAPL MSFT"]) {
    assert.throws(() => parseSingleIssuerPublicationArguments([ticker, AUTHORITATIVE_WRITE_FLAG]), /single explicit ticker/i);
  }
  assert.throws(() => parseSingleIssuerPublicationArguments(["AAPL"]), /confirm-authoritative-publication/);
  assert.throws(() => parseSingleIssuerPublicationArguments(["AAPL", "--all", AUTHORITATIVE_WRITE_FLAG]), /Unknown option/);
});

test("endpoint and credential configuration fail closed before acquisition", async () => {
  let acquisitions = 0;
  const acquire = async () => { acquisitions += 1; return qualificationFixture(); };
  const base = { ticker: "AAPL", confirmed: true, acquire, fetchImpl: async () => { throw new Error("must not fetch"); } };
  await assert.rejects(() => publishSingleIssuer({ ...base, endpoint: "", token }), /STATE_ENDPOINT is required/);
  await assert.rejects(() => publishSingleIssuer({ ...base, endpoint: "not-a-url", token }), /valid HTTPS URL/);
  await assert.rejects(() => publishSingleIssuer({ ...base, endpoint: "http://state.example.test", token }), /HTTPS URL/);
  await assert.rejects(() => publishSingleIssuer({ ...base, endpoint: `${endpoint}?credential=bad`, token }), /credential-free HTTPS URL/);
  await assert.rejects(() => publishSingleIssuer({ ...base, endpoint, token: "" }), /PUBLICATION_TOKEN is required/);
  await assert.rejects(() => publishSingleIssuer({ ...base, endpoint, token: "short" }), /at least 32/);
  await assert.rejects(() => publishSingleIssuer({ ...base, endpoint, token, confirmed: false }), /confirm-authoritative-publication/);
  await assert.rejects(() => publishSingleIssuer({ ...base, endpoint, token, revision: "working-tree" }), /40-character GITHUB_SHA/);
  assert.equal(acquisitions, 0);
  assert.equal(validatePublicationEnvironment({ endpoint: `${endpoint}/`, token }).endpoint, endpoint);
});

test("deterministic fixture uses production publication construction and handles Created", async () => {
  const fixture = await qualificationFixture();
  const service = createFirstPublicationService();
  let prepared;
  const first = await publishSingleIssuer({
    ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl: service.fetchImpl,
    acquire: async () => fixture, now: fixedNow, onPrepared: (summary) => { prepared = summary; },
  });
  assert.equal(first.result.publicationStatus, "Created");
  assert.equal(first.result.securityId, "sec-cik:0000320193");
  assert.equal(first.result.eventType, "AnnualFilingAccepted");
  assert.equal(first.result.sourceManifestHash, fixture.sourceManifest.manifestHash);
  assert.equal(first.result.codeRevision, revision);
  assert.equal(prepared.disposition, "CreateNewAuthoritativeState");
  assert.equal(service.calls.length, 2);
  assert.equal(service.calls[1].options.method, "POST");
  assert.equal(service.calls[1].options.headers.Authorization, `Bearer ${token}`);
  const firstRequest = JSON.parse(service.calls[1].options.body);

  const secondService = createFirstPublicationService();
  await publishSingleIssuer({ ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl: secondService.fetchImpl, acquire: async () => fixture, now: fixedNow });
  const secondRequest = JSON.parse(secondService.calls[1].options.body);
  assert.equal(secondRequest.stateFingerprint, firstRequest.stateFingerprint);
  assert.equal(secondRequest.recordHash, firstRequest.recordHash);
});

test("a legacy stored evaluation with a different acquisition clock is reposted and surfaced as Reused", async () => {
  const fixture = withEvaluationAcquisitionClock(
    await qualificationFixture(),
    "2026-09-07T18:37:49.130Z",
    "bb3e594a8766aa2fcbe27a177fb19519573383dd22e3c2da4db7855ab445c53b",
  );
  const firstService = createFirstPublicationService();
  await publishSingleIssuer({ ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl: firstService.fetchImpl, acquire: async () => fixture, now: fixedNow });
  const original = JSON.parse(firstService.calls[1].options.body);
  const summaryRecord = {
    resultId: original.publication.resultId,
    securityId: original.publication.securityId,
    freshness: original.publication.freshness,
  };
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes("?ticker=")) return response({ records: [summaryRecord] });
    if (url.includes("?id=")) return response({ record: { exactRecord: original.publication, integrity: { recordHash: original.recordHash } } });
    assert.equal(options.method, "POST");
    const repeated = JSON.parse(options.body);
    assert.deepEqual(repeated.publication, original.publication);
    return response({ created: false, record: { ...summaryRecord, ...original.publication } });
  };
  const reacquired = withEvaluationAcquisitionClock(
    fixture,
    "2026-09-07T18:41:22.093Z",
    "cbd62f22f6ef4203fedfba7a724cd81b2c778b997c29d2ea9016ea508f367c3c",
  );
  assert.notEqual(original.publication.evaluation.fingerprint, reacquired.evaluation.fingerprint);
  const completed = await publishSingleIssuer({ ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl, acquire: async ({ priorAnnualPublication }) => {
    assert.equal(priorAnnualPublication.resultId, original.publication.resultId);
    return reacquired;
  }, now: () => new Date("2026-08-02T00:00:00.000Z") });
  assert.equal(completed.summary.disposition, "ReusedExactAuthoritativeInput");
  assert.equal(completed.result.publicationStatus, "Reused");
  assert.equal(calls.filter((call) => call.options.method === "POST").length, 1);
});

test("a genuine evaluation difference under unchanged source cursors fails closed before POST", async () => {
  const fixture = withEvaluationAcquisitionClock(await qualificationFixture(), "2026-08-01T00:00:00.000Z");
  const firstService = createFirstPublicationService();
  await publishSingleIssuer({ ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl: firstService.fetchImpl, acquire: async () => fixture, now: fixedNow });
  const original = JSON.parse(firstService.calls[1].options.body);
  const summaryRecord = {
    resultId: original.publication.resultId,
    securityId: original.publication.securityId,
    freshness: original.publication.freshness,
  };
  let postCount = 0;
  const fetchImpl = async (url, options = {}) => {
    if (url.includes("?ticker=")) return response({ records: [summaryRecord] });
    if (url.includes("?id=")) return response({ record: { exactRecord: original.publication, integrity: { recordHash: original.recordHash } } });
    if (options.method === "POST") postCount += 1;
    return response({ created: false, record: summaryRecord });
  };
  const conflicted = withEvaluationAcquisitionClock(fixture, "2026-08-02T00:00:00.000Z");
  conflicted.evaluation.inputs.revenue += 1;
  await assert.rejects(
    () => publishSingleIssuer({ ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl, acquire: async () => conflicted, now: fixedNow }),
    (error) => error instanceof StateServiceError && error.code === "IntegrityConflict",
  );
  assert.equal(postCount, 0);
});

test("IntegrityConflict, authorization, and network publication failures are surfaced", async () => {
  const fixture = await qualificationFixture();
  const conflict = createFirstPublicationService({ postResponse: () => response({ error: "fingerprint conflict", code: "IntegrityConflict" }, 409) });
  await assert.rejects(
    () => publishSingleIssuer({ ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl: conflict.fetchImpl, acquire: async () => fixture, now: fixedNow }),
    (error) => error instanceof StateServiceError && error.status === 409 && error.code === "IntegrityConflict",
  );
  await assert.rejects(
    () => publishSingleIssuer({ ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl: async () => response({ error: `job authorization rejected ${token}` }, 403), acquire: async () => fixture }),
    (error) => error instanceof StateServiceError && error.status === 403 && !error.message.includes(token) && error.message.includes("[REDACTED]"),
  );
  await assert.rejects(
    () => publishSingleIssuer({ ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl: async () => { throw new Error("connection refused"); }, acquire: async () => fixture }),
    /request failed: connection refused/,
  );
  let requestCount = 0;
  await assert.rejects(
    () => publishSingleIssuer({ ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) return response({ records: [] });
      throw new Error("publication connection refused");
    }, acquire: async () => fixture, now: fixedNow }),
    /request failed: publication connection refused/,
  );
});

test("human and JSON-safe result representations never contain the bearer token", async () => {
  const fixture = await qualificationFixture();
  const service = createFirstPublicationService();
  const completed = await publishSingleIssuer({ ticker: "AAPL", endpoint, token, confirmed: true, fetchImpl: service.fetchImpl, acquire: async () => fixture, now: fixedNow });
  const human = `${renderPrePublicationSummary(completed.summary)}\n${renderQualificationResult(completed.result)}`;
  const json = JSON.stringify(completed);
  assert.doesNotMatch(human, new RegExp(token));
  assert.doesNotMatch(json, new RegExp(token));
  assert.match(human, /AUTHORITATIVE SINGLE-ISSUER PUBLICATION/);
  assert.match(human, /Publication: Created/);
  assert.equal(JSON.parse(json).result.publicationStatus, "Created");
});

test("publisher is bounded to POST and leaves preview, scheduler, and migration controls isolated", async () => {
  const library = await readFile(new URL("../lib/single-issuer-publication.mjs", import.meta.url), "utf8");
  const cli = await readFile(new URL("../scripts/publish-single-issuer.mjs", import.meta.url), "utf8");
  const preview = await readFile(new URL("../lib/quarterly-preview.mjs", import.meta.url), "utf8");
  const previewCli = await readFile(new URL("../scripts/preview-quarterly.mjs", import.meta.url), "utf8");
  const scheduler = await readFile(new URL("../../.github/workflows/evidence-engine-longitudinal.yml", import.meta.url), "utf8");
  const deployment = await readFile(new URL("../../.github/workflows/deploy-evidence-engine.yml", import.meta.url), "utf8");
  assert.match(library, /createLiveQuarterlyPreview/);
  assert.match(library, /createLongitudinalPublication/);
  assert.match(library, /method: "POST"/);
  assert.doesNotMatch(`${library}\n${cli}`, /method:\s*["'](?:PUT|PATCH|DELETE)["']/);
  assert.doesNotMatch(`${library}\n${cli}`, /covered-call-lab\/market-data|--all|EVIDENCE_ENGINE_LONGITUDINAL_ENABLED/);
  assert.doesNotMatch(`${preview}\n${previewCli}`, /createLongitudinalPublication|\/api\/evaluations|method:\s*["']POST/);
  assert.match(scheduler, /EVIDENCE_ENGINE_LONGITUDINAL_ENABLED == 'true'/);
  assert.match(deployment, /apply_authoritative_migration:[\s\S]*default: false/);
});
