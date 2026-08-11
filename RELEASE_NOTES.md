# Website v2.8.0 / Evidence Engine 6.5 Integration — Release Candidate

- Adds the Evidence Engine as a native TMDL research tool.
- Uses the existing shared S&P 500, SCHD, benchmark, and investment-universe market snapshot as the launch source of truth.
- Passes ticker, company, reference price, observation date, and the exact TMDL snapshot URL into Evidence Engine 6.5.
- Keeps SEC identity, filing acquisition, evidence resolution, calculations, coverage, scoring, and immutable records inside the Evidence Engine.
- Preserves the complete Release 6.4 methodology. Inventory applicability, multi-class shares, and Gross Profit governance remain deferred.
- Aligns Evidence Engine presentation with TMDL's navy and mint visual system.
- Repairs the unresolved home-page merge state included in the 2.7.7 source package.

## Prior release: Website v2.6.0 / Covered Call Lab v2.7.3

- Integrates the August Fidelity ledger and Covered Call Lab v2.7.3.
- Moves Finnhub calls into a central GitHub Action; no Finnhub token is shipped to browsers.
- Publishes one shared S&P 500 + SCHD + benchmark market snapshot for all site modules.
- Preserves editable investment-universe tags locally while using shared security identity and pricing.
- Adds canonical URLs, `robots.txt`, and `sitemap.xml` for the Search Console duplicate-canonical issue.
- Preserves Website v2.5 Substack integration and anonymized public portfolio labels.

## Prior release: Covered Call Lab v2.5.0

Release Date: July 2026

## Status

Production.

## Ledger Snapshot

June 30, 2026.

## Major Changes

- Hybrid valuation architecture promoted to production.
- Historical ledger accounting remains immutable until the next ledger reconciliation.
- Live quote refresh updates market-sensitive values only.
- Open covered-call positions use strategy-adjusted stock values capped at the active strike.
- Portfolio Value reconciles against the live brokerage account within normal quote-timing variance.
- Strike Ceiling Value added to the holdings view.
- Benchmark snapshot dates added.
- Benchmark ending values corrected to derive from the same baseline as return percentages.
- Production DTE behavior restored.
- Sandbox behavior preserved.
- Privacy cleanup applied to portfolio naming.

## Release Rule

This build is the new production baseline. The valuation engine should remain frozen until the next monthly ledger reconciliation unless a must-fix accounting, privacy, quote, or UI defect is found.
