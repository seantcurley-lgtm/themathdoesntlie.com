CCL 3.0.1-rc.6 is an unpublished local review candidate. Rc.5 is on hold.

The Benchmarks page previously selected September 4 DATA unconditionally. The new default extends the existing production comparison through November 3, while an explicit Sep 4 archive preserves every original row. The production renderer, stylesheet, reconciliation engine, market module and existing activity projection are unchanged. The adapter adds the current data, controls and audit details using the existing page structure.

Every current row receives the same dated capital: $33,600.69 on March 31, $40,435.98 on April 10, and $19,428.30 on October 28. The last amount represents contributed GOOGL shares and does not increase cash. ETFs buy fractional shares at each contribution-date close; distributions are not reinvested. Ex-date establishes entitlement; payment date separates cash from receivables. Return percentages uniformly equal profit divided by $93,464.97 total contributed capital; they are not time-weighted returns. The archived September comparison retains its original convention, including backdating its original capital to March 31.

The November 3 strategy row reconciles as follows:

| Measure | Amount | Definition |
| --- | ---: | --- |
| Shares | $96,808.00 | Eight called-stock positions plus the historical SCHD reserve |
| Recorded cash | $8,483.04 | Portfolio A $3,439.20 plus B $5,043.84, before unreported WMT fees |
| Open calls | −$1,772.00 | Eight source-day ask references, nine contracts |
| Dividend receivable | $173.00 | ABBV 100 shares × $1.73, eligible October 15, sold later, payable November 16 |
| Ending value estimate | $103,692.04 | Shares + cash − call liability + earned unpaid dividend |
| Contributed capital | $93,464.97 | Original $74,036.67 plus the noncash GOOGL contribution |
| Economic gain estimate | $10,227.07 / 10.9421% | Ending value less contributed capital, before unreported WMT fees |
| Received period income | $8,944.99 | $7,642.66 net option cash + $1,238.80 paid dividends + $63.53 period interest |
| Earned period income | $9,117.99 | Received income plus the $173 unpaid entitlement |

Cash rolls from $3,315.68 at September 4 to $8,483.04 at November 3 using the 46 later rows exactly once. November 3 contributes −$8,398.31: MDT premium $55.34, WFC purchase −$8,547.99 and WFC premium $94.34. Historical rolling income $8,945.03 retains four cents of pre-March interest already included in opening capital. That carry is preserved in history and excluded from the new period income. It is not a balancing transaction.

All 27 allocations were reviewed for dividend entitlements. Twenty-one paid entitlements independently reconcile exactly to $1,238.80. ABBV is the only earned unpaid dividend at the cutoff. A later payment transfers the entitlement from receivable to cash without earning it again. It does not revise prior campaign cash receipts.

Twelve ETF comparisons use four matched price dates and 72 issuer-qualified distribution events. JEPQ's November 2 ex-date distribution of $0.53922/share and BND's $0.256802 are receivables at November 3, payable November 4. Exact issuer amounts are used where available; only October XYLD/QYLD amounts retain the original provider's $0.001/share rounding, explicitly marked approximate. Source raw hashes and date definitions are carried in the local audit. No portfolio facts were transmitted to new providers; external research used public ETF/company tickers and dates.

The dashboard's **Nov 3 comparison** uses the same cash, value and gain as the current benchmark row. **Live** retains the working refreshed-share estimate, its explicitly dated November 2 option references and received-cash convention. The separate November 2 valuation and September 4 baseline remain unchanged. The call board remains eight current stocks; the historical SCHD reserve belongs in experiment value, not the active call board.

Validation executes the actual production renderer and candidate adapters in an HTML capture fixture; independently recomputes all 12 ETF wealth rows; checks late transactions, contribution timing, dividend entitlement, payment transfers, cash roll-forward and historical snapshots; and retains existing reconciliation, market provenance and quote-failure tests. Browser layout, DOM placement and live button interaction still require visual review under supported browser access. The fixture is not a substitute for that review.

Preview: loopback port **8176**, separate from rc.5 on 8175. Run **Start-CCL-rc6.ps1** for this build. The preview pins committed Git blobs and refuses a mismatched requested build. No push, tag, deployment, production edit or FOS mutation is authorized or performed.

Release holds: Sean's exact screenshot cash figures have not yet been readable; their labels/amounts are still requested. Desktop/mobile browser QA remains unverified under the prior browser access block. WMT fees are genuinely unreported; estimates are explicitly before those fees. Option timestamps lack an explicit timezone and are source-day references, not simultaneous executable marks. Sean's review is still required before any publication.
