# TMDL Evidence Engine Workbench

A browser-based financial evidence engine that turns an SEC-listed ticker into a reviewable Form 10-K dataset, publishes deterministic source-linked measurements, and preserves completed evaluations as immutable replayable records.

Production application: <https://evidence-engine-workbench.solar-maple-1068.chatgpt.site>

## Release 6.5 TMDL Product Integration

Release 6.5 connects the workbench to The Math Doesn't Lie shared security universe. A validated TMDL launch may prefill ticker and dated market evidence while the Evidence Engine independently verifies SEC identity and filing evidence. The application is `6.5.0`; the calculation engine, acquisition mapper, scoring policy, and governed registries remain at their Release 6.4 identities because no methodology changed. See `docs/RELEASE_6_5_TMDL_INTEGRATION.md`.

## Release 6.4 Documentation-Safe Coverage Repair

Release 6.4 tightens Operating Income matching so non-operating facts cannot become false review candidates, expands CE-105 same-date current/noncurrent debt composition, and recognizes exact CE-164 Cost of Sales and Cost of Services aliases while blocking generic Costs and Expenses substitutions. Governed aggregation is now limited to Total Debt because CE-103 has not yet authorized multi-class share summation.

No formula, scoring weight, threshold, coverage floor, or company-type profile changed. Inventory remains missing when it is not reported; the engine does not infer zero or alter Quick Ratio or CCC. See [docs/RELEASE_6_4_DOCUMENTATION_SAFE_COVERAGE.md](docs/RELEASE_6_4_DOCUMENTATION_SAFE_COVERAGE.md).

## Release 6.3 Complete Governed Filing Review

The filing-review queue now supports the complete governed decision set: accept one candidate, sum compatible additive candidates, or reject all candidates and record an optional canonical component as not separately reported with a governed zero. Aggregation is limited to Shares Outstanding and Total Debt and requires a common accession, period end, and unit. Rejection-to-zero is available only when the field's canonical policy explicitly allows it; required evidence cannot be converted to zero.

Every decision preserves the reviewer, timestamp, rationale, all examined candidates, accepted/aggregated/rejected candidate identities, exact source locations, and policy version in the evaluation fingerprint. No engine formulas, score thresholds, or profile rules changed.

## Release 6.1 Ordinary-Company Coverage Repair

Owner testing with Amazon and Starbucks exposed recoverable coverage loss in otherwise eligible operating companies. Release 6.1 recognizes current standardized interest and prepaid/other-current-assets concepts, uses an explicitly reported zero preferred-share count as governed zero preferred equity, and treats known nonpositive equity as adverse zero-point evidence rather than missing coverage.

The 80% publication floor is unchanged. When a company remains below it, Overview now shows the exact threshold, weighted gap, and every rule preventing score publication. A separate acquisition warning identifies fields affected by official-filing collection failure.

With the observed official-filing fallback failure reproduced, Amazon improves from 77.50% to 91.00% scoring coverage and Starbucks from 63.50% to 86.00%; both can publish a score from supported evidence. See [docs/RELEASE_6_1_COVERAGE_REPAIR.md](docs/RELEASE_6_1_COVERAGE_REPAIR.md) for the governed decisions and acceptance record.

## Release 6.0 Durable Evaluation Records milestone

The workbench now stores completed publications in a server-backed, period-indexed immutable record store. A saved record contains the complete governed input evidence, human resolution decisions, source identity, registry and policy versions, execution plan, validation, measurements, score audit, and fingerprint.

The new **History** workspace keeps four operations distinct:

1. save the current evaluated publication;
2. open the exact stored publication without recalculating it;
3. verify a replay under the recorded version context; and
4. compare the stored publication with the currently installed engine without overwriting either result.

The service verifies a second SHA-256 record hash before returning full stored evidence. Repeated saves of the same governed fingerprint are idempotent. No update or delete route is exposed.

Release 6 provides the audited period-indexed foundation required before implementing the historical formulas already defined by the project's Evidence Specifications.

## Release 5.0 Canonical Engine Core foundation

The workbench now executes the documentation set through three versioned machine-readable registries rather than a hard-coded formula list. The Canonical Registry identifies governed concepts and recorded document gaps; the Calculation Registry owns formulas, dependencies, versions, period rules, and output status; the Alias Registry owns SEC taxonomy and Inline XBRL resolution aliases.

The release also follows the repository's governed recovery rules when SEC Company Facts leaves a field unresolved:

1. Resolve a ticker through a dated, checksummed snapshot of the official SEC company-ticker directory bundled with the application.
2. Call the application's same-origin acquisition endpoint, which retrieves only the issuer's SEC Submissions and Company Facts from `data.sec.gov`.
3. Select the issuer's latest supported Form 10-K.
4. Map standardized US-GAAP and DEI concepts into the engine input contract.
5. For unresolved fields, acquire and inspect the official Inline XBRL filing, including filed statement and note facts.
6. Automatically accept only one exact approved standard-taxonomy candidate in an eligible non-dimensional context.
7. Hold issuer extensions, dimensional facts, and competing candidates in a governed review queue.
8. Distinguish missing evidence, ambiguity requiring review, and collection failure.
9. Display every mapped, derived, review, missing, collection-failure, and manual field before evaluation.
10. Require a separately dated market price and exact evidence URL because EDGAR does not provide stock prices.
11. Resolve the annual period start and calculate actual inclusive reporting-period days.
12. Expand the requested 30 outputs into the minimum dependency graph and execute it in topological order.
13. Calculate every supported metric and explicitly withhold only formulas whose governed dependencies are unavailable.
14. Apply the versioned General Operating Company scoring profile when the issuer's SEC SIC is eligible.
15. Publish CE/governance references, formula versions, structured validation, execution-plan metadata, score audit, sources, and reproducibility fingerprint.

Microsoft FY2025 remains the controlled reference dataset. Apple and Coca-Cola verify complete and partial scoring coverage. Realty Income verifies that a REIT is not forced through an operating-company profile.

## What ships

- Ticker-to-CIK resolution using a bundled official SEC snapshot with retrieval date and source checksum.
- Latest-10-K selection from official SEC submission history.
- Standardized XBRL mapping from the official SEC Company Facts API plus an official Inline XBRL fallback.
- Executable Canonical Evidence `1.0.0`, Calculation `1.0.0`, Alias `1.2.0`, and Entity Continuity `1.0.0` registries.
- Explicit evidence states: `Mapped`, `Derived`, `Review`, `ReviewRequired`, `Missing`, `CollectionFailure`, `NotReported`, `Manual`, and post-import `Override`.
- A governed candidate-review queue supporting single acceptance, controlled additive aggregation, and policy-limited reject-all/not-reported-zero decisions with a complete audit trail.
- Prior-period instant selection for beginning receivables, inventory, payables, Total Assets, and Total Equity.
- Actual inclusive reporting-period days from the filing duration context; no fixed annual day constant.
- Canonical Quick Assets, average-balance profitability/leverage, Book Value, Enterprise Value, and strict EBITDA dependency behavior.
- Structured execution plan and validation outcomes for every publication.
- No silent use of issuer extension taxonomy concepts.
- Manual dated market-price evidence for valuation calculations.
- Microsoft FY2025 controlled dataset loaded on first use.
- Six evidence families and up to 30 objective financial measurements.
- A separate versioned General Operating Company scoring profile with 20 auditable rules totaling 100 points.
- SEC SIC applicability gating; utilities, finance, insurance, and real estate are withheld pending specialized profiles.
- Conservative missing-evidence treatment: unavailable rules earn no points, are not reweighted, and produce a visible score range.
- An 80% weighted-coverage floor before a headline score or tier is published.
- Exact insufficient-coverage explanation with the threshold, weighted gap, and blocking rules.
- Known nonpositive equity scored as adverse zero-point evidence rather than missing coverage.
- Current standardized interest and combined prepaid/other-current-assets aliases plus explicit zero preferred-share evidence.
- Dedicated Scoring workspace with family contributions and a complete rule-by-rule point audit.
- Complete, Partial, and Unavailable family states with per-formula gap explanations.
- Complete Microsoft leverage coverage, including Interest Coverage.
- Exact decimal arithmetic with 28 significant digits and half-even rounding.
- CE/governance identity, calculation version, period rule, formula, and field-level provenance in the metric drawer and exported dataset.
- JSON, Markdown, inputs-only, print, and browser-snapshot workflows.
- Responsive and keyboard-accessible interface.
- Deterministic SHA-256 reproducibility fingerprint.
- Server-backed immutable evaluation history with a separately verified record hash.
- Exact record loading without recalculation.
- Version-gated deterministic replay and non-mutating current-version comparison.
- Period-indexed record query contract and checked-in D1 migration.
- Automated engine, acquisition, mapping, regression, publication, and built-worker tests.

## Important operating boundary

SEC filing facts are not the same as automatically approved evidence. Standardized concept use varies by issuer, which is why the application exposes mapping confidence and missing facts. Required missing evidence is never coerced to zero. Optional Prepaid Expenses, Preferred Equity, and Minority Interest become zero only when the complete Company Facts + official filing hierarchy establishes `NotReported`; ambiguity and collection failure remain unavailable. Derived debt and separate depreciation/amortization mappings still require review.

The score is a fixed, versioned research policy—not a universal benchmark, peer ranking, price target, or investment recommendation. The release does not provide market prices or licensed market data. Users must govern the exact dated market-price evidence used by valuation rules.

## Start locally

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run dev
```

Run the complete release gate:

```bash
npm test
```

Create and validate the production artifact:

```bash
npm run build
npm run validate:artifact
```

## Repository map

| Path | Purpose |
|---|---|
| `app/page.tsx` | Primary route entry point |
| `lib/sec-client.mjs` | Browser orchestration, local ticker validation, and same-origin acquisition call |
| `app/api/sec/route.ts` | Issuer-only SEC Submissions and Company Facts transport |
| `app/api/evaluations/route.ts` | Immutable evaluation save, list, integrity verification, and exact-read service |
| `db/schema.ts` | Period-indexed immutable record schema |
| `drizzle/0000_big_ares.sql` | Release 6 durable-store migration |
| `public/sec/company-tickers.json` | Dated, checksummed official ticker/CIK snapshot |
| `components/evidence-workbench.tsx` | Evaluation UI, inputs, results, exports, and browser workflows |
| `components/sec-acquisition.tsx` | Ticker lookup, mapping review, market evidence, and dataset handoff |
| `components/evaluation-history.tsx` | Durable history, exact-load, replay, comparison, and export experience |
| `lib/evidence-engine.mjs` | Registry-driven execution, validation, exact decimals, lineage, fingerprint, and publication |
| `lib/canonical-registry.mjs` | Canonical Evidence identities, statuses, document references, and governance issues |
| `lib/calculation-registry.mjs` | Executable formulas, dependencies, versions, graph planning, and requested outputs |
| `lib/alias-registry.mjs` | Single source of truth for Company Facts and Inline XBRL aliases |
| `lib/evidence-scoring.mjs` | Applicability, versioned thresholds, weighted scoring, coverage, and point audit |
| `lib/evaluation-replay.mjs` | Installed-version eligibility, deterministic replay, and snapshot comparison |
| `lib/evidence-resolution.mjs` | Inline XBRL parsing, fallback policy, candidate classification, and recorded review decisions |
| `lib/sec-xbrl.mjs` | Transport-free ticker, filing, fact-selection, mapping, and derivation rules |
| `tests/evidence-engine.test.mjs` | Microsoft golden baseline and engine regression suite |
| `tests/sec-xbrl.test.mjs` | Deterministic acquisition and XBRL mapping fixture suite |
| `tests/sec-client.test.mjs` | Ticker snapshot and transport-boundary regression suite |
| `tests/evidence-resolution.test.mjs` | Source hierarchy, ambiguity, review-record, and fingerprint regression suite |
| `tests/registry-conformance.test.mjs` | Registry integrity, graph, period, and CE formula conformance suite |
| `tests/evaluation-replay.test.mjs` | Record/replay contract, version gate, reproduction, and non-mutation tests |
| `tests/rendered-html.test.mjs` | Built-worker rendering smoke test |
| `docs/SEC_ACQUISITION.md` | Detailed acquisition contract and mapping registry |
| `docs/SCORING_METHODOLOGY.md` | Complete scoring applicability, rule, weight, band, tier, and governance policy |
| `docs/HANDOFF.md` | Complete engineering and ChatGPT continuation handoff |
| `docs/INTEGRATION.md` | Website, iframe, route, and engine integration patterns |
| `docs/OPERATIONS.md` | SEC fair-access, runtime, release, and troubleshooting runbook |
| `docs/VERIFICATION.md` | Acceptance evidence and test matrix |
| `docs/DESIGN_NOTES.md` | Product and interaction-design decisions |
| `docs/RELEASE_3_1_REPAIR.md` | Root-cause record, repair design, compatibility notes, and continuation checklist |
| `docs/RELEASE_4_SCORING.md` | Scoring milestone decisions, acceptance results, compatibility, and boundary |
| `docs/RELEASE_4_1_EVIDENCE_RESOLUTION.md` | Evidence-resolution architecture, data contract, operations, limitations, and handoff |
| `docs/RELEASE_5_CANONICAL_ENGINE_CORE.md` | Canonical core architecture, compatibility, document conflicts, acceptance, and continuation handoff |
| `docs/RELEASE_6_DURABLE_EVALUATION_RECORDS.md` | Immutable record, D1, replay, comparison, acceptance, and continuation authority |
| `docs/RELEASE_6_1_COVERAGE_REPAIR.md` | Amazon/Starbucks coverage repair, policy rationale, acceptance, and continuation authority |
| `integration/iframe-embed.html` | Copyable responsive iframe example |

## Controlled acceptance baselines

Microsoft FY2025 must produce:

- 29 available measurements from 30 registered outputs.
- Five Complete families and Partial Valuation.
- EV/EBITDA unavailable with reason `CombinedDisclosureNotPermitted` propagated through canonical EBITDA, because the controlled source contains only a combined D&A disclosure.
- Actual inclusive period length of `365` days.
- Interest Coverage of approximately `53.8901`.
- Return on Assets approximately `18.0048`, Return on Equity approximately `33.2808`, and Equity Multiplier approximately `1.8484` using average balances.
- Governed score `83.70`, maximum `87.70`, Tier A, with `96.00%` scoring coverage.
- Fingerprint `337e3991a9970b82105e3686ea45eebbf18fd2abd4b62f4bedfa02786fe2d5d3` under engine `6.4.0-browser`.

Ticker acquisition remains availability-aware. Apple, Coca-Cola, and Realty Income may expose different mapped/unavailable counts as the new beginning-balance and strict EBITDA dependencies are applied to their latest filing. The release gate verifies the mapping and partial-execution behavior with controlled fixtures; live filing access is deliberately re-verified in the hosted application because the latest 10-K and issuer presentation can change.

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the complete evidence matrix.

## Architectural boundary

This milestone implements the executable Canonical Engine Core, governed current-10-K acquisition, one fixed operating-company scoring profile, and durable immutable evaluation records. It does not yet implement historical filing acquisition, the documented multi-year Evidence Specifications, 10-Q/20-F support, peer-relative or specialized-industry scoring, backtesting, registry administration UI, asynchronous scheduling, application-owned identity, multi-user review, or licensed market-data acquisition. Those remain sequenced platform milestones in [docs/HANDOFF.md](docs/HANDOFF.md).
