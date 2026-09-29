import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.js';
const env={FINNHUB_API_KEY:'synthetic-test-secret'},request=(path,origin='null',method='GET')=>new Request('https://test.invalid'+path,{method,headers:{origin}});
test('standalone route permits only public quotes and leaves CCL CORS unchanged',async()=>{
 const saved=globalThis.fetch;globalThis.caches={default:{match:async()=>null,put:async()=>{}}};let upstream;
 globalThis.fetch=async url=>{upstream=url;return Response.json({c:100,t:1790701200,d:2,dp:2.04});};
 try{
 const fos=await worker.fetch(request('/fos/quotes?symbols=VOO'),env);assert.equal(fos.status,200);assert.equal(fos.headers.get('access-control-allow-origin'),'null');const body=await fos.json();assert.equal(body.quotes.VOO.price,100);assert.equal(body.quotes.VOO.change,2);assert.ok(upstream.startsWith('https://finnhub.io/api/v1/quote?symbol=VOO'));assert.ok(!JSON.stringify(body).includes(env.FINNHUB_API_KEY));
 assert.equal((await worker.fetch(request('/quotes?symbols=KO'),env)).status,403);
 assert.equal((await worker.fetch(request('/fos/quotes?symbols=KO','https://unknown.example'),env)).status,403);
 assert.equal((await worker.fetch(request('/fos/quotes?symbols=KO','null','POST'),env)).status,405);
 assert.equal((await worker.fetch(request('/fos/quotes?symbols=KO,WMT'),env)).status,400);
 assert.equal((await worker.fetch(request('/fos/quotes?symbols=UNAPPROVED'),env)).status,400);
 const ccl=await worker.fetch(request('/quotes?symbols=KO','https://themathdoesntlie.com'),env);assert.equal(ccl.status,200);assert.equal(ccl.headers.get('access-control-allow-origin'),'https://themathdoesntlie.com');
 assert.equal((await worker.fetch(request('/fos/quotes','null','OPTIONS'),env)).status,204);
 assert.equal((await worker.fetch(request('/quotes','null','OPTIONS'),env)).status,403);
 }finally{globalThis.fetch=saved;delete globalThis.caches;}
});
