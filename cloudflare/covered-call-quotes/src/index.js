import { ALLOWED_TICKERS } from './generated-allowlist.js';

const FINNHUB_QUOTE_URL = 'https://finnhub.io/api/v1/quote';
const MAX_SYMBOLS = 12;
const allowed = new Set(ALLOWED_TICKERS);

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

  const target = `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(env.FINNHUB_API_KEY)}`;
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
  const body = { price: quote.c, marketTimestamp: quote.t || null, retrievedAt };
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
    if (request.method === 'OPTIONS') {
      if (origin !== permittedOrigin) return json({ error: 'Origin not allowed' }, 403, permittedOrigin);
      return new Response(null, { status: 204, headers: headers(permittedOrigin) });
    }
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, permittedOrigin);
    if (origin && origin !== permittedOrigin) return json({ error: 'Origin not allowed' }, 403, permittedOrigin);

    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'covered-call-quotes', version: '2.7.7' }, 200, permittedOrigin);
    if (url.pathname !== '/quotes') return json({ error: 'Not found' }, 404, permittedOrigin);
    if (!env.FINNHUB_API_KEY) return json({ error: 'Quote provider unavailable' }, 503, permittedOrigin);

    const symbols = normalizeSymbols(url.searchParams.get('symbols'));
    if (!symbols.length || symbols.length > MAX_SYMBOLS) return json({ error: `Request 1-${MAX_SYMBOLS} symbols` }, 400, permittedOrigin);
    const rejected = symbols.filter(t => !allowed.has(t));
    if (rejected.length) return json({ error: 'Ticker not in approved universe', rejected }, 400, permittedOrigin);

    const quotes = {}, failed = [];
    const cache = caches.default;
    for (let i = 0; i < symbols.length; i++) {
      if (i) await wait(1100);
      try { quotes[symbols[i]] = await getQuote(symbols[i], env, cache); }
      catch (error) { failed.push({ ticker: symbols[i], error: error?.message || 'Quote failed' }); }
    }
    return json({ quotes, failed, retrievedAt: new Date().toISOString() }, Object.keys(quotes).length ? 200 : 502, permittedOrigin);
  }
};
