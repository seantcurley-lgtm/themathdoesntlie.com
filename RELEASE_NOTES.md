# The Math Doesn't Lie — Production Baseline 1

Status: Release candidate for final archive and GitHub deployment.

## Components

- Website v2.5.1
- Covered Call Lab v2.3.7
- Substack v1.0 integration

## Website v2.5.1

- Verified Substack links:
  - Executive Brief: https://themathdoesntlie.substack.com/s/executive-brief
  - Financial Analysis: https://themathdoesntlie.substack.com/s/financial-analysis
  - Water & Infrastructure: https://themathdoesntlie.substack.com/s/water-and-infrastructure
  - Economics & Data: https://themathdoesntlie.substack.com/s/economics-and-data
  - Subscribe: https://themathdoesntlie.substack.com/subscribe
  - Archive: https://themathdoesntlie.substack.com/archive
- Added footer version marker.
- Added Release Notes page.
- Preserved Website v2.4 visual baseline.

## Covered Call Lab v2.3.7

- Merged as a standalone app under `/covered-call-lab/`.
- Website launch links now point to `/covered-call-lab/`.
- Legacy redirect retained at `/tools/covered-call-tracker/` for compatibility.

## Release Scope

This is an integration and production assembly release. It does not introduce new website design changes or new Lab features.

## QA Focus

- Homepage loads.
- Footer shows Website v2.5.1 / Production Baseline 1.
- Release Notes page opens.
- Substack links open correctly.
- Covered Call Lab launches from homepage and Covered Call Lab page.
- `/covered-call-lab/` loads the tracker application.
- `/tools/covered-call-tracker/` redirects to `/covered-call-lab/`.
