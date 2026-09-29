import { ALLOWED_TICKERS } from './generated-allowlist.js';

const FINNHUB_QUOTE_URL = 'https://finnhub.io/api/v1/quote';
const FINNHUB_SYMBOL_ALIASES = Object.freeze({ BFB: 'BF-B' });
const MAX_SYMBOLS = 12;
const allowed = new Set(ALLOWED_TICKERS);
// General stock/ETF quote coverage for the single-file household viewer.
// This is a public security universe, not an account or holdings export.
const portfolioAllowed = new Set([...allowed, ...'AVUS AVUV AVXC DFAC DON EADSY ENB IEFA IWV MOAT RBLX RECS SCHB SPYM TSM VO VOO VTWO VTI VXUS VT VEA VWO VUG VTV VBR VB VOE VOT VYM SCHX SCHF SCHE SCHZ SCHG SCHV ITOT IXUS IEMG AGG IJR IJH IWM IWF IWD QUAL USMV DGRO HDV DVY VIG BIL SGOV SHY IEF TLT TIP LQD HYG BNDX IAU GLD'.split(' ')]);

function headers(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin'
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

function normalizeSymbols(value) {
  return [...new Set(String(value || '').split(',').map(x => x.trim().toUpperCase().replace('.', '-')).filter(Boolean))];
}

async function getQuote(ticker, env, cache) {
  const cacheKey = new Request(`https://quote-cache.internal/${ticker}`);
  const cached = await cache.match(cacheKey);
  if (cached) return { ticker, ...(await cached.json()), cached: true };

  const upstreamTicker = FINNHUB_SYMBOL_ALIASES[ticker] || ticker;
  const target = `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(upstreamTicker)}&token=${encodeURIComponent(env.FINNHUB_API_KEY)}`;
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(target, { headers: { accept: 'application/json' } });
    if (response.status !== 429 || attempt === 2) break;
    await wait(1500 * (attempt + 1));
  }
  if (!response.ok) throw new Error(`Finnhub HTTP ${response.status}`);
  const quote = await response.json();
  if (!Number.isFinite(quote.c) || quote.c <= 0) throw new Error(quote.error || 'No current price');
  const retrievedAt = new Date().toISOString();
  const body = { price: quote.c, marketTimestamp: quote.t || null, retrievedAt, change: Number.isFinite(quote.d) ? quote.d : null, changePercent: Number.isFinite(quote.dp) ? quote.dp : null };
  const ttl = Math.max(15, Math.min(300, Number(env.QUOTE_CACHE_SECONDS) || 45));
  await cache.put(cacheKey, new Response(JSON.stringify(body), { headers: { 'cache-control': `public, max-age=${ttl}` } }));
  return { ticker, ...body, cached: false };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('origin') || '';
    const permittedOrigin = env.ALLOWED_ORIGIN || 'https://themathdoesntlie.com';
    const url = new URL(request.url);
    const portfolio = url.pathname === '/fos/quotes';
    // file:// fetches have Origin: null. Only the public market-data route accepts it.
    // No cookies, account records, quantities, balances or credentials are accepted.
    const responseOrigin = portfolio && origin === 'null' ? 'null' : permittedOrigin;
    if (request.method === 'OPTIONS') {
      if (origin !== permittedOrigin && !(portfolio && origin === 'null')) return json({ error: 'Origin not allowed' }, 403, permittedOrigin);
      return new Response(null, { status: 204, headers: headers(responseOrigin) });
    }
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, responseOrigin);
    if (origin && origin !== permittedOrigin && !(portfolio && origin === 'null')) return json({ error: 'Origin not allowed' }, 403, permittedOrigin);

    if (url.pathname === '/health') return json({ ok: true, service: 'covered-call-quotes', version: '3.0.0' }, 200, permittedOrigin);
    if (url.pathname !== '/quotes' && !portfolio) return json({ error: 'Not found' }, 404, responseOrigin);
    if (!env.FINNHUB_API_KEY) return json({ error: 'Quote provider unavailable' }, 503, responseOrigin);

    const symbols = normalizeSymbols(url.searchParams.get('symbols'));
    const limit = portfolio ? 1 : MAX_SYMBOLS;
    if (!symbols.length || symbols.length > limit) return json({ error: `Request 1-${limit} symbols` }, 400, responseOrigin);
    const rejected = symbols.filter(t => !(portfolio ? portfolioAllowed : allowed).has(t));
    if (rejected.length) return json({ error: 'Ticker not in approved universe', rejected }, 400, responseOrigin);

    const quotes = {}, failed = [];
    const cache = caches.default;
    for (let i = 0; i < symbols.length; i++) {
      if (i) await wait(1100);
      try { quotes[symbols[i]] = await getQuote(symbols[i], env, cache); }
      catch (error) { failed.push({ ticker: symbols[i], error: error?.message || 'Quote failed' }); }
    }
    return json({ quotes, failed, retrievedAt: new Date().toISOString() }, Object.keys(quotes).length ? 200 : 502, responseOrigin);
  }
};
