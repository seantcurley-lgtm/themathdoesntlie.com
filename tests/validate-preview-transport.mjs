import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const serverFile=path.join(root,'tools/ccl-preview-server.mjs');
const source=fs.readFileSync(serverFile,'utf8');
const assets=new Map(fs.readdirSync(path.join(root,'covered-call-lab')).filter(n=>fs.statSync(path.join(root,'covered-call-lab',n)).isFile()).map(n=>[n,fs.readFileSync(path.join(root,'covered-call-lab',n))]));
const version=JSON.parse(assets.get('candidate-version.json'));
const symbols=['GOOGL','HPQ','MDT','WFC','ACN','DECK','KHC','SLB'];
const marketAt='2026-11-03T21:00:00.000Z',retrievedAt='2026-11-04T16:20:00.000Z';
const now=Date.parse('2026-11-04T16:30:00.000Z');
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}

// Execute the real handler, replacing module bindings only. No socket, child
// process, filesystem mutation, or network request can occur in this harness.
async function runtime(){
 let handler,upstream=async()=>({ok:true,status:200,json:async()=>({quotes:Object.fromEntries(symbols.map((t,i)=>[t,{ticker:t,price:100+i,marketTimestamp:Date.parse(marketAt)/1000,retrievedAt}])),failed:[],retrievedAt})});
 const requests=[],listens=[],gitCalls=[];
 const fakeServer={on(){return this;},listen(port,host,callback){listens.push({port,host});callback();return this;}};
 const context={URL,Buffer,Date:FixedDate,createHash,path,fileURLToPath,__moduleUrl:pathToFileURL(serverFile).href,__vmModule:{runInNewContext:vm.runInNewContext},console:{log(){},error(){}},process:{env:{},pid:12345},AbortSignal:{timeout:ms=>({timeout:ms})},
  http:{createServer(fn){assert.equal(handler,undefined);handler=fn;return fakeServer;}},
  fs:{readFileSync(file,encoding){assert.equal(path.resolve(file),serverFile,'server must only read its own source from the working tree');return encoding?source:Buffer.from(source);}},
  execFileSync(binary,args){assert.equal(binary,'git');assert.equal(args[0],'-C');assert.equal(args[1],root);const command=args.slice(2);gitCalls.push(command);if(command.join(' ')==='rev-parse HEAD')return Buffer.from('test-pinned-commit\n');assert.equal(command[0],'show');const spec=command[1];if(spec==='test-pinned-commit:tools/ccl-preview-server.mjs')return Buffer.from(source);const name=spec.replace(/^test-pinned-commit:covered-call-lab\//,'');assert.ok(assets.has(name),'only pinned candidate assets can be served: '+spec);return assets.get(name);},
  fetch:async(url,options)=>{requests.push({url:String(url),options});return upstream(url,options);}
 };
 const executable=source.replace(/^import[^\r\n]*\r?\n/,'').replaceAll('import.meta.url','__moduleUrl').replace(/await import\(['"]node:vm['"]\)/g,'__vmModule');
 await vm.runInNewContext('(async()=>{'+executable+'\n})()',context,{filename:serverFile});
 assert.equal(typeof handler,'function');assert.deepEqual(listens,[{port:8176,host:'127.0.0.1'}]);assert.ok(gitCalls.some(c=>c[0]==='show'));
 async function request(url,{host='127.0.0.1:8176',method='GET',headers={}}={}){
  const result={status:200,headers:{},body:'',ended:false};
  const response={setHeader(k,v){result.headers[k.toLowerCase()]=v;},writeHead(status,extra={}){result.status=status;for(const[k,v]of Object.entries(extra))this.setHeader(k,v);},end(body){assert.equal(result.ended,false,'response ends once');result.ended=true;result.body=body==null?'':String(body);}};
  await handler({url,method,headers:{host,'sec-fetch-site':'same-origin',...headers}},response);
  assert.equal(result.ended,true,'every request must terminate');if(result.headers['content-type']?.includes('application/json'))result.json=JSON.parse(result.body);return result;
 }
 return{request,requests,setUpstream:fn=>{upstream=fn;}};
}

const r=await runtime();
for(const host of ['127.0.0.1:8176','localhost:8176']){
 const health=await r.request('/health',{host});assert.equal(health.status,200);assert.equal(health.json.build,version.build);assert.equal(health.json.readOnly,true);assert.equal(health.json.published,false);
 const config=await r.request('/covered-call-lab/quote-proxy.json',{host});assert.equal(config.status,200);assert.equal(config.json.endpoint,'/review-quote-gateway','preview quote endpoint must remain relative to either supported hostname');
 const pageOrigin='http://'+host,endpoint=new URL(config.json.endpoint,pageOrigin+'/covered-call-lab/');assert.equal(endpoint.origin,pageOrigin,'connect-src self must permit the quote endpoint');assert.match(config.headers['content-security-policy'],/(?:^|;)\s*connect-src 'self'(?:;|$)/);assert.equal(config.headers['cross-origin-resource-policy'],'same-origin');
 const quotes=await r.request(endpoint.pathname+'/quotes?symbols='+symbols.join(',')+'&account=private-test-account&quantity=123456&amount=987654.32',{host,headers:{origin:pageOrigin,cookie:'private-test-cookie=secret',authorization:'Bearer private-test-token'}});
 assert.equal(quotes.status,200);assert.deepEqual(Object.keys(quotes.json.quotes),symbols);assert.equal(quotes.json.failed.length,0);
 for(const t of symbols){assert.equal(quotes.json.quotes[t].marketTimestamp,Date.parse(marketAt)/1000);assert.equal(quotes.json.quotes[t].retrievedAt,retrievedAt);}
}
assert.equal(r.requests.length,2);
for(const request of r.requests){
 const url=new URL(request.url);assert.equal(url.origin,'https://covered-call-quotes.sean-t-curley.workers.dev');assert.equal(url.pathname,'/quotes');assert.deepEqual([...url.searchParams.keys()],['symbols']);assert.deepEqual(url.searchParams.get('symbols').split(','),symbols);
 assert.deepEqual(Object.entries(request.options.headers),[['accept','application/json']],'browser Origin, cookies and credentials must never reach the worker');assert.equal(request.options.body,undefined);assert.equal(request.options.credentials,undefined);assert.equal(request.options.redirect,'error');assert.equal(request.options.signal.timeout,25000);
 assert.doesNotMatch(request.url+JSON.stringify(request.options),/private-test|123456|987654/,'upstream request contains only public symbols and transport options');
}

const beforeDenied=r.requests.length;
assert.equal((await r.request('/health',{host:'example.com:8176'})).status,403);
assert.equal((await r.request('/review-quote-gateway/quotes?symbols=GOOGL',{headers:{'sec-fetch-site':'cross-site','sec-fetch-mode':'cors'}})).status,403);
assert.equal((await r.request('/review-quote-gateway/quotes?symbols=NOT_A_COMMITTED_PUBLIC_SYMBOL')).status,400);
assert.equal((await r.request('/review-quote-gateway/quotes?symbols=')).status,400);
assert.equal((await r.request('/health',{method:'POST'})).status,405);
assert.equal(r.requests.length,beforeDenied,'invalid requests must never reach the provider');

// A provider HTTP error is different from loss of the local preview listener.
// Both upstream failure types must produce parseable, per-symbol error details.
r.setUpstream(async()=>({ok:false,status:503,json:async()=>({error:'Test provider temporarily unavailable'})}));
const httpFailure=await r.request('/review-quote-gateway/quotes?symbols='+symbols.join(','));
assert.equal(httpFailure.status,503);assert.deepEqual(httpFailure.json.quotes,{});assert.equal(httpFailure.json.failed.length,8);assert.match(httpFailure.json.error,/temporarily unavailable/);
assert.deepEqual(httpFailure.json.diagnostic,{stage:'upstream',code:'UPSTREAM_HTTP_ERROR',status:503});
for(const t of symbols)assert.ok(httpFailure.json.failed.some(f=>f.ticker===t&&/503|temporarily unavailable/.test(f.error)),'HTTP failure preserves a useful error for '+t);
r.setUpstream(async()=>{throw new TypeError('fetch failed',{cause:{code:'ENOTFOUND'}});});
const networkFailure=await r.request('/review-quote-gateway/quotes?symbols='+symbols.join(','));
assert.equal(networkFailure.status,502);assert.deepEqual(networkFailure.json.quotes,{});assert.equal(networkFailure.json.failed.length,8);assert.match(networkFailure.json.error,/quote service could not be reached.*ENOTFOUND.*fetch failed/i);
assert.deepEqual(networkFailure.json.diagnostic,{stage:'upstream',code:'UPSTREAM_UNREACHABLE'});
for(const t of symbols)assert.ok(networkFailure.json.failed.some(f=>f.ticker===t&&/fetch failed|ENOTFOUND/i.test(f.error)),'network failure preserves a useful error for '+t);
const evidence=await r.request('/quote-evidence.json');assert.equal(Object.keys(evidence.json.quotes).length,8,'failed refreshes retain the last successful public quote evidence');assert.equal(evidence.json.retrievalTimeIsNotMarketTime,true);

r.setUpstream(async()=>({ok:true,status:200,json:async()=>({quotes:{WFC:{price:85.10,marketTimestamp:Date.parse('2026-11-03T17:00:00Z')/1000,retrievedAt}},failed:[]})}));
const preEntry=await r.request('/review-quote-gateway/quotes?symbols=WFC');assert.equal(preEntry.status,502);assert.deepEqual(preEntry.json.quotes,{});assert.ok(preEntry.json.failed.some(f=>f.ticker==='WFC'&&/predates strategy entry/.test(f.error)),'transport must not pass a pre-entry provider mark as a current WFC quote');
console.log('Validated preview transport with mocked I/O: both hostnames remain same-origin; eight public-symbol quotes preserve provider times; private browser inputs stay local; access guards and upstream HTTP/network failures remain explicit; prior evidence survives failure.');
