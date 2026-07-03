// Covered Call Tracker V2.3.5.1 Holdings Recovery
// Scope: restore richer Holdings intelligence without touching Finnhub, ledger, dashboard, sandbox, or core calculations.

(function () {
  function n(v) { return Number(v || 0); }
  function money(v) { return fmt(n(v)); }
  function percent(v) { return pct(n(v)); }
  function cleanAccount(a) { return (a || '').replace(' Rollover', ''); }
  function reviewPenalty(bucket) { return bucket === 'Review' ? 1 : 0; }
  function trendClass(label) {
    if (label === 'Increasing') return 'good';
    if (label === 'Decreasing') return 'bad';
    return 'warn';
  }

  function historyByTicker() {
    return Object.fromEntries((DATA.history || []).map(h => [h.ticker, h]));
  }

  function openOptionsByTicker() {
    const out = {};
    (DATA.options || []).forEach(o => {
      if (!o.ticker) return;
      if (!out[o.ticker]) out[o.ticker] = [];
      out[o.ticker].push(o);
    });
    return out;
  }

  function premiumEventsByTicker() {
    const out = {};
    (DATA.transactions || [])
      .filter(t => t && t.category === 'Sell Call' && t.ticker)
      .forEach(t => {
        if (!out[t.ticker]) out[t.ticker] = [];
        out[t.ticker].push(t);
      });
    Object.values(out).forEach(rows => rows.sort((a, b) => String(a.date).localeCompare(String(b.date))));
    return out;
  }

  function optionDistance(row, opt) {
    const strike = parseFloat(opt && opt.strike);
    if (!strike || !row.price) return null;
    return (strike - row.price) / row.price * 100;
  }

  function recoveredHoldingRows() {
    const hist = historyByTicker();
    const opts = openOptionsByTicker();
    return holdingRows().map(h => {
      const hh = hist[h.ticker] || {};
      const open = opts[h.ticker] || [];
      const firstOpen = open[0] || null;
      const stockGL = n(h.stock_gl ?? h.stockGL);
      const premiums = n(h.premiums ?? hh.premiums);
      const dividends = n(h.dividends ?? hh.dividends);
      const fees = n(h.fees ?? hh.fees);
      const optionGL = n(h.option_gl ?? h.optionGL);
      const trueMtm = h.true_mtm !== undefined ? n(h.true_mtm) : stockGL + optionGL;
      const totalContribution = hh.totalContribution !== undefined
        ? n(hh.totalContribution)
        : stockGL + premiums + dividends + optionGL - fees;
      return {
        ...h,
        stockGL,
        premiums,
        dividends,
        fees,
        optionGL,
        trueMtm,
        totalContribution,
        openCalls: open.length,
        nextExpiration: firstOpen ? firstOpen.expiration : '',
        distanceToStrike: firstOpen ? optionDistance(h, firstOpen) : null
      };
    }).sort((a, b) =>
      reviewPenalty(a.bucket) - reviewPenalty(b.bucket) ||
      n(b.totalContribution) - n(a.totalContribution) ||
      String(a.ticker).localeCompare(String(b.ticker))
    );
  }

  function coveredCallTrendRows() {
    const events = premiumEventsByTicker();
    const opts = openOptionsByTicker();
    const current = Object.fromEntries(holdingRows().map(h => [h.ticker, h]));

    return Object.keys(current).map(ticker => {
      const rows = events[ticker] || [];
      const premiums = rows.map(r => Math.abs(n(r.amount))).filter(v => v > 0);
      const recent = premiums.slice(Math.max(0, premiums.length - 3));
      const prior = premiums.slice(0, Math.max(0, premiums.length - recent.length));
      const recentAvg = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
      const priorAvg = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : recentAvg;
      const change = priorAvg ? (recentAvg - priorAvg) / priorAvg * 100 : 0;
      const label = premiums.length < 2 ? 'Not enough data' : change > 10 ? 'Increasing' : change < -10 ? 'Decreasing' : 'Flat';
      const open = (opts[ticker] || [])[0] || null;
      const h = current[ticker];
      return {
        ticker,
        bucket: h.bucket,
        sector: h.sector,
        count: premiums.length,
        latest: premiums[premiums.length - 1] || 0,
        average: premiums.length ? premiums.reduce((s, v) => s + v, 0) / premiums.length : 0,
        recentAvg,
        priorAvg,
        change,
        label,
        openPremiumBasis: open ? n(open.cost) : 0,
        days: open ? days(open.expiration) : null,
        distance: open ? optionDistance(h, open) : null
      };
    }).sort((a, b) => {
      const rank = { Increasing: 0, Flat: 1, 'Not enough data': 2, Decreasing: 3 };
      return (rank[a.label] ?? 9) - (rank[b.label] ?? 9) || n(b.recentAvg) - n(a.recentAvg);
    });
  }

  holdingsPage = function holdingsRecoveryPage() {
    const hs = recoveredHoldingRows();
    const c = combined();
    const topTicker = hs.length ? hs.reduce((best, h) => n(h.totalContribution) > n(best.totalContribution) ? h : best, hs[0]).ticker : null;
    const trends = coveredCallTrendRows();

    return `${banner()}<div class="stack"><div class="grid four">${metric('Tracked Holdings Value', money(c.stock_val))}${metric('Cash', money(c.cash))}${metric('Unrealized Stock G/L', money(c.stock_gl), cls(c.stock_gl))}${metric('Positions', hs.length)}</div><section class="card"><div class="label">${mode === 'live' ? 'Live covered call holdings' : 'Baseline covered call holdings'}</div><p class="small">Ranked by lifetime contribution, with Review holdings intentionally pushed lower so weak or watch-list positions do not crowd out the portfolio leaders.</p><table><thead><tr><th>Rank</th><th>Account</th><th>Ticker</th><th>Sector</th><th>Bucket</th><th class="num">Shares</th><th class="num">Price</th><th class="num">Value</th><th class="num">Stock G/L</th><th class="num">Premiums</th><th class="num">Dividends</th><th class="num">Option G/L</th><th class="num">True MTM</th><th class="num">Total Contribution</th></tr></thead><tbody>${hs.map((h, i) => `<tr><td class="num">${i + 1}</td><td>${cleanAccount(h.account)}</td><td class="ticker">${h.ticker === topTicker ? '🏆 ' : ''}${h.ticker}</td><td>${h.sector}</td><td>${bucket(h.bucket)}</td><td class="num">${h.shares}</td><td class="num">${money(h.price)}</td><td class="num">${money(h.value)}</td><td class="num ${cls(h.stockGL)}">${money(h.stockGL)}</td><td class="num good">${money(h.premiums)}</td><td class="num good">${money(h.dividends)}</td><td class="num ${cls(h.optionGL)}">${money(h.optionGL)}</td><td class="num ${cls(h.trueMtm)}">${money(h.trueMtm)}</td><td class="num ${cls(h.totalContribution)}"><b>${money(h.totalContribution)}</b></td></tr>`).join('')}</tbody></table></section><section class="card"><div class="label">Covered Call Trend Table</div><p class="small">Uses the ledger's Sell Call entries to compare recent premium behavior against earlier premium behavior. This is directional intelligence, not an options-pricing model.</p><table><thead><tr><th>Ticker</th><th>Bucket</th><th>Trend</th><th class="num">Call Count</th><th class="num">Latest Premium</th><th class="num">Avg Premium</th><th class="num">Recent Avg</th><th class="num">Trend Change</th><th class="num">Open Premium Basis</th><th class="num">Days Left</th><th class="num">Distance to Strike</th></tr></thead><tbody>${trends.map(t => `<tr><td class="ticker">${t.ticker}</td><td>${bucket(t.bucket)}</td><td class="${trendClass(t.label)}"><b>${t.label}</b></td><td class="num">${t.count}</td><td class="num good">${t.latest ? money(t.latest) : '—'}</td><td class="num">${t.average ? money(t.average) : '—'}</td><td class="num">${t.recentAvg ? money(t.recentAvg) : '—'}</td><td class="num ${cls(t.change)}">${t.count >= 2 ? percent(t.change) : '—'}</td><td class="num good">${t.openPremiumBasis ? money(t.openPremiumBasis) : '—'}</td><td class="num">${t.days ?? '—'}</td><td class="num ${cls(t.distance)}">${t.distance == null ? '—' : percent(t.distance)}</td></tr>`).join('')}</tbody></table></section></div>`;
  };
})();
