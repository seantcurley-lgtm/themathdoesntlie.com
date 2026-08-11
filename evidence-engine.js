(function () {
  const DATA_URL = 'covered-call-lab/market-data.json';
  const SOURCE_URL = 'https://themathdoesntlie.com/covered-call-lab/market-data.json';
  const ENGINE_URL = 'https://evidence.themathdoesntlie.com/';
  const input = document.getElementById('security-search');
  const results = document.getElementById('security-results');
  const card = document.getElementById('security-card');
  let securities = [];

  const clean = value => String(value || '').trim().toUpperCase();
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const money = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(Number(value)) : 'Not yet available';
  const compactMoney = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', notation:'compact', maximumFractionDigits:1}).format(Number(value)) : 'Not available';
  const dateLabel = value => value ? new Intl.DateTimeFormat('en-US', {dateStyle:'medium'}).format(new Date(value)) : 'Not refreshed';
  const dateValue = value => value ? new Date(value).toISOString().slice(0, 10) : '';

  function memberships(row) {
    return [row.inSP500 && 'S&P 500', row.inSCHD && 'SCHD', row.sector === 'ETF' && 'Benchmark / ETF'].filter(Boolean);
  }

  function matches(query) {
    const q = clean(query);
    if (!q) return securities.slice(0, 8);
    return securities.filter(row => clean(row.ticker).includes(q) || clean(row.name).includes(q)).slice(0, 10);
  }

  function showResults(query) {
    const rows = matches(query);
    results.innerHTML = rows.length ? rows.map(row => `<button type="button" role="option" data-ticker="${safe(row.ticker)}"><strong>${safe(row.ticker)}</strong><span>${safe(row.name)}</span><small>${safe(row.sector || 'Unclassified')}</small></button>`).join('') : '<p>No matching security in the shared TMDL universe.</p>';
    results.classList.toggle('open', Boolean(query) || document.activeElement === input);
  }

  function select(ticker) {
    const row = securities.find(item => clean(item.ticker) === clean(ticker));
    if (!row) return;
    input.value = row.ticker;
    results.classList.remove('open');
    const observed = dateValue(row.lastQuoteRefresh || row.lastRefresh);
    const params = new URLSearchParams({ticker: row.ticker, company: row.name || row.ticker, source: 'TMDL', marketUrl: SOURCE_URL});
    if (Number(row.price) > 0) params.set('price', String(row.price));
    if (observed) params.set('marketDate', observed);
    const roles = memberships(row);
    card.innerHTML = `<div class="security-identity"><div><p class="section-label">Selected company</p><h2>${safe(row.ticker)} <span>${safe(row.name)}</span></h2><p>${safe(row.sector || 'Sector not classified')}</p></div><div class="security-badges">${(roles.length ? roles : ['TMDL universe']).map(role => `<span>${safe(role)}</span>`).join('')}</div></div><div class="security-facts"><div><span>Reference price</span><strong>${money(row.price)}</strong></div><div><span>Price observed</span><strong>${dateLabel(row.lastQuoteRefresh || row.lastRefresh)}</strong></div><div><span>Market capitalization</span><strong>${compactMoney(row.marketCap)}</strong></div><div><span>Source</span><strong>${safe(row.provider || 'TMDL shared snapshot')}</strong></div></div>${Number(row.price) > 0 && observed ? `<div class="security-action"><div><strong>Market context ready</strong><span>The engine will prefill this exact price, date, and source. You can review or override it before publication.</span></div><a class="button primary" href="${ENGINE_URL}?${params.toString()}" target="_blank" rel="noopener noreferrer">Continue to Evidence Engine →</a></div>` : `<div class="security-action attention"><div><strong>Market context incomplete</strong><span>This company can still be opened, but the engine will require dated market evidence before evaluation.</span></div><a class="button primary" href="${ENGINE_URL}?${params.toString()}" target="_blank" rel="noopener noreferrer">Open Evidence Engine →</a></div>`}`;
  }

  input.addEventListener('input', event => showResults(event.target.value));
  input.addEventListener('focus', () => showResults(input.value));
  results.addEventListener('click', event => { const button = event.target.closest('[data-ticker]'); if (button) select(button.dataset.ticker); });
  document.addEventListener('click', event => { if (!event.target.closest('.security-search')) results.classList.remove('open'); });

  fetch(DATA_URL, {cache:'no-store'})
    .then(response => { if (!response.ok) throw new Error(`Market snapshot ${response.status}`); return response.json(); })
    .then(payload => { securities = (payload.securities || []).sort((a,b) => a.ticker.localeCompare(b.ticker)); input.disabled = false; input.placeholder = `Search ${securities.length} shared securities`; const requested = new URLSearchParams(location.search).get('ticker'); if (requested) select(requested); })
    .catch(() => { input.disabled = true; card.innerHTML = '<div class="security-empty error"><strong>The shared market snapshot is temporarily unavailable.</strong><span>No evaluation context was created. Try again after the next site refresh.</span></div>'; });
})();
