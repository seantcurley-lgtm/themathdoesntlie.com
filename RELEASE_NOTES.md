# Covered Call Lab v2.5.0 — Production Release

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
