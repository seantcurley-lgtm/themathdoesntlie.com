import assert from 'node:assert/strict';
import fs from 'node:fs';

const allowlistSource=fs.readFileSync('cloudflare/covered-call-quotes/src/generated-allowlist.js','utf8');
const marketSource=fs.readFileSync('covered-call-lab/market.js','utf8');
const trackerSource=fs.readFileSync('covered-call-lab/tracker.js','utf8');

assert.match(allowlistSource,/"BFB"/,'repository worker allowlist must contain BFB');
assert.match(marketSource,/Quote gateway HTTP \$\{r\.status\}/,'client must preserve gateway HTTP status');
assert.match(marketSource,/payloadDetail\|\|body/,'client must preserve a bounded gateway response detail');
assert.match(marketSource,/payload\.rejected\.join\(', '\)/,'client must identify worker-rejected symbols');
assert.match(trackerSource,/refresh failed/,'refresh failure must be visible in the status UI');

let requestedUpstream='';
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
globalThis.fetch=async request=>{
  requestedUpstream=String(request);
  return new Response(JSON.stringify({c:72.5,t:1788552000}),{status:200,headers:{'content-type':'application/json'}});
};

const worker=(await import('../cloudflare/covered-call-quotes/src/index.js')).default;
const response=await worker.fetch(
  new Request('https://covered-call-quotes.test/quotes?symbols=BFB',{method:'GET',headers:{origin:'https://themathdoesntlie.com'}}),
  {ALLOWED_ORIGIN:'https://themathdoesntlie.com',FINNHUB_API_KEY:'test-only',QUOTE_CACHE_SECONDS:'45'},
  {},
);
const payload=await response.json();

assert.equal(response.status,200,'repository worker must accept BFB');
assert.equal(payload.quotes.BFB.price,72.5,'repository worker must return the BFB upstream quote');
assert.match(requestedUpstream,/symbol=BFB/,'worker must request BFB from the upstream provider');
assert.equal(response.headers.get('access-control-allow-origin'),'https://themathdoesntlie.com');

console.log('Validated Gate 1 repository path: BFB accepted and refresh diagnostics preserved.');
