# Changelog

## 6.5.0 — 2026-08-10

### TMDL product integration

- Added a validated TMDL launch contract for ticker and dated market evidence.
- Preserved the Release 6.4 calculation, acquisition, evidence-resolution, alias, and scoring versions.
- Aligned the workbench visual system with the TMDL website.
- Kept the three outstanding methodology questions explicitly deferred.

## 6.4.0 — 2026-08-08

### Documentation-safe coverage repair

- Prevented `NonoperatingIncome` and other substring collisions from becoming Operating Income candidates; exact issuer extensions remain governed-review only.
- Added CE-105 same-date current/noncurrent debt component sets, including Other Long-Term Debt and supported Short-Term Borrowings presentations.
- Added exact CE-164 Cost of Sales and Cost of Services aliases while explicitly excluding generic Costs and Expenses and unrelated operating-expense concepts.
- Removed share-class aggregation because CE-103 defers multi-class normalization; controlled aggregation now applies only to Total Debt.
- Preserved missing Inventory, Quick Ratio, CCC, Gross Profit, scoring, and applicability requirements without inferred values or threshold changes.
- Added four regression tests; the complete gate passes 49/49 tests.
- Updated application to `6.4.0`, engine to `6.4.0-browser`, acquisition mapper to `6.4.0-sec`, evidence-resolution policy to `1.5.0`, and Alias Registry to `1.2.0`.


## 6.3.0 — 2026-08-08

### Complete governed filing review

- Added explicit review actions to accept one candidate, sum compatible additive candidates, or reject every candidate and govern an optional canonical component as zero.
- Restricted aggregation to Shares Outstanding and Total Debt; selected facts must share the filing accession, period end, and unit.
- Restricted rejected-candidate zero decisions to fields whose canonical alias policy explicitly permits absence-based zero. Required evidence cannot use the action.
- Preserved every examined, selected, aggregated, and rejected candidate; reviewer; timestamp; rationale; source location; and policy version in the audit record and fingerprint.
- Added reviewer controls and complete decision details to the Markdown export.
- Verified the workflow against BIIB, CTVA, INCY, JNJ, KLAC, and PPG using their current official SEC filings. All six decisions apply and replay exactly; five cross the 80% score-publication floor, while CTVA remains at 79% because another independent rule is unavailable.
- Added four decision-boundary regression tests; the complete gate passes 45/45 tests.
- Updated application to `6.3.0`, engine to `6.3.0-browser`, acquisition mapper to `6.3.0-sec`, and evidence-resolution policy to `1.4.0`. Formula and scoring policies are unchanged.

## 6.2.0 — 2026-08-08

### S&P 500 technical-failure repair

- Preserved reported negative Minority Interest values instead of rejecting them as structurally invalid, matching the documented signed-value policy.
- Recovered the reporting-period start from the dominant eligible annual Inline XBRL duration context when SEC Company Facts does not supply an annual duration fact.
- Added a versioned Entity Continuity Registry for governed ticker-directory omissions and direct legal-successor/predecessor annual-filing continuity.
- Restored AEP acquisition under established SEC CIK `0000004904` despite its omission from the current SEC ticker directory.
- Preserved XOM FY2025 annual-filing continuity across its July 2026 holding-company reorganization, with the successor and predecessor CIKs explicitly recorded.
- Kept HONA unavailable because the June 2026 spin-off has no standalone Form 10-K; Honeywell parent-company data is not substituted.
- Added regression coverage for signed minority interest, duration-context recovery, and entity continuity.
- Updated application to `6.2.0`, engine to `6.2.0-browser`, acquisition mapper to `6.2.0-sec`, evidence-resolution policy to `1.3.0`, and Entity Continuity Registry to `1.0.0`.

## 6.1.0 — 2026-08-06

### Fixed

- Added the current standardized `InterestExpenseNonoperating` concept spelling so Amazon-style annual interest evidence is no longer missed.
- Added `PrepaidExpenseAndOtherAssetsCurrent` as a visibly reviewed, conservative Quick Assets deduction.
- Governs preferred equity as zero when the selected annual filing explicitly reports zero preferred shares outstanding or issued.
- Treats known nonpositive equity as observed adverse evidence: Return on Equity and Debt-to-Equity receive zero points while retaining their coverage weight.
- Insufficient-coverage pages now state the exact coverage, 80% minimum, unavailable weight, and every rule preventing publication.
- Overview now separates official-filing collection failure from a conclusion that evidence was not reported.
- Scoring-rule rationales now carry the engine's specific unavailable-calculation detail and governed missing inputs.

### Changed

- Application package to `6.1.0`, engine to `6.1.0-browser`, acquisition mapper to `6.1.0-sec`, evidence-resolution policy to `1.2.0`, Alias Registry to `1.1.0`, and scoring policy to `1.1.0`.
- Amazon's reproduced collection-failure case improves from 77.50% to 91.00% weighted coverage; Starbucks improves from 63.50% to 86.00%. Both become score-publishable without lowering the 80% floor.
- Microsoft financial results remain unchanged; version identity updates its fingerprint to `77d44a89a6f02995341ccba02473f1d15fe5527a588e42936712b1561ea7f90f`.

### Preserved boundaries

- No silent issuer-extension acceptance.
- No use of Starbucks `ProductionAndDistributionCosts` as generic Cost of Revenue.
- No combined-D&A substitution for canonical EBITDA.
- No reweighting or lowering of the 80% score-publication floor.
- No conversion of filing collection failure into `Missing` or absence-based zero.

## 6.0.0 — 2026-08-05

### Added

- Server-backed immutable evaluation records through the hosted D1 `DB` binding.
- Period-indexed `evaluation_records` schema, unique fingerprint constraint, query indexes, and checked-in migration.
- `POST /api/evaluations` for bounded, idempotent publication acceptance.
- `GET /api/evaluations` for summary listing and integrity-verified exact record reads.
- Record schema `1.0` and replay contract `1.0.0`.
- SHA-256 record hash over the exact serialized publication, independently verified before exact-load.
- Version-context eligibility across engine, publication schema, Canonical Registry, Calculation Registry, Alias Registry, and scoring policy.
- Deterministic original-context replay with `Reproduced`, `Diverged`, and `UnsupportedVersionContext` outcomes.
- Non-mutating current-version comparison covering metric availability, exact value, unit, reason, score, tier, version context, and fingerprint.
- History workspace with search, record summaries, exact-load, replay, comparison, and integrity-metadata export.
- Immutable-record badge and explicit no-recalculation notice after exact-load.
- Replay conformance tests and complete Release 6 architecture, operations, integration, verification, and continuation documentation.

### Changed

- Application package to `6.0.0` and engine to `6.0.0-browser`.
- The primary save action now preserves the evaluated publication durably; browser snapshots remain available as non-authoritative device-local drafts.
- The engine-version identity change updates the Microsoft fingerprint to `97a9d2ec9c6ae8c4faa9dd51fc722acf96f30685d4fc9862d310c1d481ab66d5` without changing formulas, exact financial results, scoring policy, or publication schema.
- The built-worker validator and rendering smoke test now provide an inert Node-only shim for the production-native `cloudflare:workers` binding module.

### Preserved boundaries

- No record update or delete API.
- No automatic persistence of replay or comparison output.
- No silent substitution of the current engine for an unavailable recorded context.
- No historical filing acquisition or invented trend scoring; the supplied Evidence Specifications remain the methodology authority.

## 5.0.0 — 2026-08-05

### Added

- Executable Canonical Evidence, Calculation, and SEC Alias registries, each independently versioned at `1.0.0`.
- Dependency planning with recursive expansion, deduplication, topological ordering, missing-node detection, and cycle rejection.
- Governed reporting-period object using the EN-103 `actual_inclusive` convention (`end − start + 1`).
- Beginning and ending Total Assets and Total Equity acquisition, validation, and input fields.
- Prepaid Expenses, Preferred Equity, Minority Interest, separate Depreciation, and separate Amortization evidence fields.
- Optional `NotReported` evidence state. Zero is applied only after the complete SEC source hierarchy finds no separately reported optional component; collection failures and ambiguity remain unavailable.
- CE identifiers, calculation IDs and versions, period rules, registry versions, structured validation outcomes, and the execution plan in JSON/Markdown publications and the UI lineage drawer.
- Registry integrity and canonical formula-conformance tests.
- Machine-readable governance issue register for source-document conflicts and canonical coverage gaps.

### Corrected

- Quick Assets / Quick Ratio now subtract both Inventory and separately reported Prepaid Expenses (`CE-144`, `CE-147`).
- Return on Assets uses Average Total Assets (`CE-151`).
- Return on Equity uses Average Total Equity (`CE-152`).
- Equity Multiplier uses Average Total Assets divided by Average Total Equity (`CE-171`).
- Book Value subtracts Preferred Equity before Book Value Per Share and Price-to-Book (`CE-117`, `CE-118`).
- Enterprise Value includes Preferred Equity and Minority Interest when reported (`CE-106`).
- Days-based metrics use actual inclusive reporting-period days instead of a fixed 365.
- Canonical EBITDA requires separate Depreciation and Amortization (`CE-124`). A combined D&A disclosure is retained as evidence but is not silently substituted.

### Changed

- Application package to `5.0.0`, engine to `5.0.0-browser`, acquisition mapper to `5.0.0-sec`, evidence-resolution policy to `1.1.0`, and publication schema to `2.0`.
- Microsoft controlled baseline now publishes 29 of 30 registered measurements. EV/EBITDA is explicitly unavailable because the controlled filing evidence contains only a combined D&A disclosure.
- Microsoft controlled score to `83.70`, maximum `87.70`, Tier A, with `96.00%` weighted scoring coverage.
- Microsoft fingerprint to `ef801fe238ce20e97b1370fd83880f25814bf044418c3df4c4c8be3aea723b3b`.

### Governance records

- `CE-161` is treated as Average Accounts Receivable and `CE-162` as Receivables Turnover per EN-101/EN-102; the conflicting CE-161 source-document title is preserved and flagged.
- CE-106 dependency references are resolved to CE-115 Preferred Equity and CE-116 Minority Interest; the conflicting printed identifiers are flagged.
- Calculations without an approved CE document retain stable calculation IDs and `ProvisionalDocumentGap`; no CE numbers are invented.

## 4.1.0 — 2026-08-05

### Added

- Governed evidence-resolution policy `1.0.0` implementing the repository source hierarchy after SEC Company Facts is incomplete.
- Server-side acquisition of the selected official Inline XBRL filing, with a bounded response-size and timeout policy.
- Transport-free Inline XBRL context and numeric-fact parser with scale, sign, duration, instant, cover, and dimensional-context handling.
- `ReviewRequired`, `MissingEvidence`, and `CollectionFailure` outcomes so ambiguity and transport failure are not mislabeled as missing data.
- Candidate-review UI with reviewer identity, fixed decision timestamp, candidate set, rationale, and official source location.
- Fingerprinted human-decision record and preservation of the prior unresolved evidence object.
- Dedicated evidence-resolution regression suite and release/handoff documentation.

### Changed

- Application package to `4.1.0`, engine to `4.1.0-browser`, acquisition mapper to `4.0.0-sec`, evidence-resolution policy to `1.0.0`, and publication schema to `1.5`.
- SEC acquisition source description now includes official Inline XBRL filing evidence.
- Microsoft controlled fingerprint to `65cfa3aadee57c327a8659e1d5f79542e7e49856bd3ea6a65013a84e61338bb2` because engine version and resolution-policy compatibility are governed fingerprint content.

### Preserved boundaries

- No estimated, imputed, or silently substituted filing facts.
- Unresolved branches do not block independent calculations.
- Market price remains a manually governed external observation in this release; future Finnhub integration is deliberately out of scope.

## 4.0.0 — 2026-08-05

### Added

- Versioned General Operating Company scoring policy with 20 fixed rules totaling 100 points across Efficiency, Liquidity, Profitability, Leverage, Cash Flow, and Valuation.
- SEC SIC applicability gate. Utilities (`4900`–`4999`) and finance, insurance, and real estate (`6000`–`6999`) are withheld until specialized profiles exist.
- Conservative missing-evidence policy: unavailable rules receive zero points without reweighting, and the publication exposes the maximum possible score.
- 80% minimum weighted coverage before a headline score and tier are published.
- Dedicated Scoring workspace, Overview score summary, family contributions, coverage meters, and rule-by-rule point audit.
- Scoring policy, family results, point audit, and disclaimer in Markdown exports.
- `docs/SCORING_METHODOLOGY.md` and `docs/RELEASE_4_SCORING.md`.

### Changed

- Application package to `4.0.0`, engine to `4.0.0-browser`, acquisition mapper to `3.2.0-sec`, scoring policy to `1.0.0`, and publication schema to `1.4`.
- SEC acquisition now records SIC and SIC description from Submissions in `companyClassification` and the acquisition record.
- The canonical fingerprint now includes scoring policy identity, applicability, coverage, result, and every rule outcome.
- Microsoft controlled fingerprint to `a422eb25935e67ee5101335a9684788b526133bbc935dd6ce90a6e2fc6be484e`.

### Verified

- 18 automated tests pass.
- Microsoft: score `84.50`, Tier A, 100% coverage, and 20 of 20 rules scored.
- Apple: controlled score `78.00`, maximum `84.00`, Tier B, and 94% coverage with interest expense unresolved.
- Coca-Cola: controlled score `71.90`, Tier B, and 100% coverage.
- Realty Income: measurements still publish, while scoring is `NotApplicable` under the operating-company profile because SIC `6798` is a REIT classification.

## 3.1.1 — 2026-08-05

### Fixed

- Corrected the incomplete 3.1.0 transport repair. Browser-direct `data.sec.gov` requests still failed inside the hosted application, even though the SEC response advertises CORS support.
- Restored a same-origin `/api/sec` acquisition endpoint for issuer data only. The endpoint no longer requests the `www.sec.gov` ticker directory that caused the original production 403.
- Kept ticker validation and CIK resolution against the bundled, checksummed SEC snapshot before the browser calls the same-origin acquisition endpoint.
- Added endpoint-specific SEC errors so Submissions and Company Facts failures are distinguishable.

### Verified

- The compiled production worker returned HTTP 200 for live AAPL acquisition, selected accession `0000320193-25-000079`, and published the expected 21 mapped / 1 derived / 1 review / 1 missing summary.
- 16 automated tests pass, including a new assertion that valid ticker acquisition uses `/api/sec?ticker=AAPL` after local resolution.
- Engine `3.1.0-browser`, mapper `3.1.0-sec`, schema `1.3`, calculations, and controlled fingerprints are unchanged because this is a transport-only patch.

## 3.1.0 — 2026-08-05

### Fixed

- Replaced the deployed worker's blocked ticker-directory request. Production worker egress received HTTP 403 from `www.sec.gov`, causing the same 502 response for every ticker before ticker resolution or XBRL mapping.
- Moved the CORS-enabled `data.sec.gov` Submissions and Company Facts requests into the user's browser and bundled a dated, checksummed SEC ticker/CIK snapshot for local resolution.
- Corrected the misleading generic error path: an invalid symbol such as `APPL` now reports that no SEC company record exists and does not contact the issuer APIs. Apple's ticker is `AAPL`.
- Added Coca-Cola's standardized `LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities` concept to the review-confidence debt mapping.
- Added `InterestExpenseOperating` as a review-confidence interest-expense alias.

### Added

- Availability-aware evaluation. Missing standardized facts now withhold only dependent formulas rather than blocking the whole company.
- `Unavailable` family state, per-family available/expected counts, and an `unavailableMetrics[]` publication record with reason and missing dependency keys.
- On-screen and Markdown explanations for every withheld measurement.
- Bundled SEC ticker snapshot metadata: source URL, retrieval date, record count, and source SHA-256.
- Deterministic directory-refresh script and transport regression tests.
- KO and REIT-shaped regression cases alongside Microsoft and Apple.

### Changed

- Application package to `3.1.0`, engine to `3.1.0-browser`, acquisition mapper to `3.1.0-sec`, and publication schema to `1.3`.
- Missing acquired numeric facts are represented as `null`, not zero; a real reported zero remains distinguishable from unavailable evidence.
- Negative earnings, operating cash flow, free cash flow, EBIT, EBITDA, and equity no longer block unrelated calculations. A zero denominator withholds only the affected formula.
- Acquired datasets no longer have filing-field blockers. Dated market evidence remains required by the direct-run acquisition action.
- Microsoft controlled fingerprint to `7a65e71bf535216baf0356645eb1c0fcb277c533a651cfa95506f007251a997e` because the engine and availability contract changed; all 30 numeric results remain unchanged.

### Verified

- 15 automated tests pass.
- AAPL: 29 available measurements; Leverage Partial only because standardized interest expense is unresolved.
- KO: 30 available measurements and six Complete families.
- O: 12 available measurements; Liquidity Unavailable and the other incomplete families explicitly Partial.

## 3.0.0 — 2026-08-05

### Added

- Same-origin SEC EDGAR acquisition route for ticker directory, submissions, and Company Facts.
- Ticker-to-CIK resolution and deterministic latest-Form-10-K selection.
- Context-aware standardized XBRL mapping with concept precedence, annual-duration bounds, prior-period instant selection, unit scaling, and sign policy.
- `Mapped`, `Derived`, `Review`, `Missing`, `Manual`, and post-import `Override` evidence states.
- Governed derivations for gross profit, total liabilities, and debt composition when supported.
- Dedicated **Load company** workflow with filing identity, mapping summary, mapping register, dated market evidence, and direct/correction branches.
- Field-level taxonomy concept and period details in acquired metric lineage.
- Governed Microsoft FY2025 interest expense and Interest Coverage calculation.
- Acquisition fixture tests and live Apple FY2025 verification.
- Detailed SEC mapping design and operations runbook.

### Changed

- Engine version from `2.0.0-browser` to `3.0.0-browser`.
- Publication schema from `1.1` to `1.2`.
- Microsoft reference output from 29 to 30 measurements.
- Microsoft Leverage state from Partial to Complete; all six families are now Complete.
- Microsoft controlled fingerprint to `ae4bfe637a4ce1268de721b3420683b13fd1a4a2a6fdb55c4155d776a1b66dbb`.
- Share price must now be positive and has an explicit observation-date input.
- Missing interest expense is nonblocking but preserves Partial Leverage for acquired companies.

### Verified

- Microsoft FY2025: 30 metrics, six Complete families, Interest Coverage `53.8901` displayed.
- Apple FY2025 latest 10-K: 21 mapped, one derived, one review, one optional missing, zero blocking filing fields, three manual market fields.
- Production build, worker artifact, automated mapper/engine tests, and browser layout.

### Still deferred

- Historical filing selection; 10-Q, 20-F, and extension-taxonomy support.
- Licensed market-price acquisition.
- Durable acquisition/evaluation history, identity, scheduling, multi-user review, and general execution-platform services.

## 2.0.0-browser — 2026-08-05

### Added

- Browser-native port of the assembled company-evaluation baseline.
- Production interface for Overview, Evidence, Inputs, and Methodology.
- Exact 28-digit decimal calculation and exact-string publication.
- SHA-256 reproducibility fingerprint with a portable browser fallback.
- Metric-level formula and dependency lineage.
- Direct governed source links.
- JSON, Markdown, inputs-only, print, and local snapshot workflows.
- Responsive and keyboard-accessible interaction design.
- Automated golden, dependency, determinism, validation, publication, and rendering tests.
- Detailed engineering handoff, integration, verification, and product-design notes.

### Preserved

- Microsoft FY2025 controlled dataset.
- 29 implemented measurements.
- Five Complete families and Partial Leverage.
- Interest Coverage remains unavailable because governed interest expense is absent.
- Objective evidence / interpretation separation.

### Changed

- Calculation publication uses exact decimal strings instead of JSON binary floats.
- Fingerprint canonicalization includes engine version and exact result text.
- Basic two-panel prototype replaced with an embeddable production workbench.

### Deferred

- Filing acquisition, XBRL ingestion, registries, graph scheduling, durable persistence, historical replay, identity, and multi-user operations remain platform-roadmap work.
