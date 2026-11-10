import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'covered-call-lab/market.js'),'utf8');
const marketAt='2026-11-03T21:00:00.000Z',marketSeconds=Date.parse(marketAt)/1000;
const retrievedAt='2026-11-04T01:45:00.000Z',laterRetrieval='2026-11-04T02:00:00.000Z';
const current={holdings:[{ticker:'WFC',name:'Wells Fargo',sector:'Financials',shares:100,price:null}],options:[{ticker:'WFC'}],universe:[{ticker:'WFC',bucket:'Core'},{ticker:'SCHD',bucket:'Benchmark'}]};
const historical={holdings:[{ticker:'SCHD',name:'SCHD',sector:'ETF',shares:100,price:35.9}],options:[],universe:current.universe};

function runtime(initialStore=new Map(),{namespace='',shared=false}={}){
 const store=shared?initialStore:new Map(initialStore),requests=[],events=[],ctx={CCL_CANDIDATE_STORAGE_NAMESPACE:namespace,DATA:structuredClone(current),SP500_SEED:[{ticker:'WFC',name:'Wells Fargo',sector:'Financials'}],SCHD_SEED:{holdings:[{ticker:'WFC',name:'Wells Fargo'}]}};
 let snapshot={securities:[],meta:{}},nextQuote=t=>({price:85.53,marketTimestamp:marketSeconds,retrievedAt}),deferredSnapshot=null,timerId=0;
 Object.assign(ctx,{window:ctx,crypto:{randomUUID:()=> 'test-instance'},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent:e=>events.push(e),addEventListener(){},setTimeout(fn,ms){if([3000,15000,30000].includes(ms))queueMicrotask(fn);return++timerId;},clearTimeout(){},fetch:async url=>{
  requests.push(String(url));const u=new URL(url,'http://test.invalid/');
  if(u.pathname==='/quote-proxy.json')return{ok:true,json:async()=>({endpoint:'http://test.invalid/gateway'})};
  if(u.pathname==='/market-data.json')return{ok:true,json:async()=>deferredSnapshot?await deferredSnapshot:snapshot};
  if(u.pathname==='/gateway/quotes'){const quotes=Object.fromEntries(u.searchParams.get('symbols').split(',').map(t=>[t,nextQuote(t)]));return{ok:true,status:200,text:async()=>JSON.stringify({quotes,failed:[]})};}
  throw Error('Unexpected mocked URL '+url);
 }});
 vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'market.js'});
 return{ctx,api:ctx.MDLMarket,store,requests,events,setSnapshot:v=>snapshot=v,setQuote:fn=>nextQuote=fn,deferSnapshot:()=>{let resolve;deferredSnapshot=new Promise(r=>resolve=r);return value=>{resolve(value);};}};
}

const r=runtime(),api=r.api;
api.setPortfolioSource(()=>current);
await api.refreshPortfolio();
assert.equal(api.status().portfolioStatus,'Holdings refresh successful: 1/1 current');
assert.equal(api.get('WFC').price,85.53);
assert.equal(api.get('WFC').marketTimestamp,marketSeconds);
assert.equal(api.get('WFC').marketAsOf,marketAt);
assert.equal(api.get('WFC').lastQuoteRefresh,retrievedAt);
assert.equal(api.get('WFC').quoteObservation.price,85.53);
assert.equal(api.get('WFC').quoteObservation.retrievedAt,retrievedAt);

// Exact provider metadata survives reload; an unbound legacy timestamp does not.
const restored=runtime(r.store);
assert.equal(restored.api.get('WFC').marketAsOf,marketAt);
const damaged=new Map(r.store),damagedDb=JSON.parse(damaged.get('mdl.market.v275'));
damagedDb.WFC.quoteObservation.retrievedAt='2026-11-03T00:00:00Z';
damaged.set('mdl.market.v275',JSON.stringify(damagedDb));
assert.equal(runtime(damaged).api.get('WFC').marketAsOf,null);
const legacy=new Map(r.store),legacyDb=JSON.parse(legacy.get('mdl.market.v275'));
delete legacyDb.WFC.quoteObservation;legacy.set('mdl.market.v275',JSON.stringify(legacyDb));
assert.equal(runtime(legacy).api.get('WFC').marketTimestamp,null);

// A stale provider timestamp remains stale; retrieval never replaces market time.
const oldMarket='2026-11-02T21:00:00.000Z';
r.setQuote(()=>({price:85.53,marketTimestamp:Date.parse(oldMarket)/1000,retrievedAt:laterRetrieval}));
await api.refreshPortfolio();assert.equal(api.get('WFC').marketAsOf,oldMarket);assert.equal(api.get('WFC').lastQuoteRefresh,laterRetrieval);
// New observations, including same-price observations, clear missing metadata.
api._test.saveQuote('WFC',85.53,'2026-11-04T02:01:00Z');
assert.equal(api.get('WFC').marketAsOf,null);assert.equal(api.get('WFC').marketTimestamp,null);
api._test.saveQuote('WFC',85.53,retrievedAt,marketSeconds);
api._test.saveQuote('WFC',86.2,laterRetrieval);
assert.equal(api.get('WFC').marketAsOf,null);assert.equal(api.get('WFC').quoteObservation.price,86.2);
api._test.saveQuote('WFC',86.2,laterRetrieval,Date.now()/1000+86400);assert.equal(api.get('WFC').marketAsOf,null,'future provider time is unverified');
api._test.saveQuote('WFC',86.2,laterRetrieval,'2026-11-03');assert.equal(api.get('WFC').marketAsOf,null,'date-only string is not a market instant');

// Keep a newer or identical stored quote atomically; a replacement cannot inherit timestamps.
api._test.saveQuote('WFC',85.53,laterRetrieval,marketSeconds);
r.setSnapshot({securities:[{ticker:'WFC',price:85.1,lastQuoteRefresh:retrievedAt}],meta:{}});await api.loadSnapshot();
assert.equal(api.get('WFC').price,85.53);assert.equal(api.get('WFC').marketAsOf,marketAt);assert.equal(api.get('WFC').lastQuoteRefresh,laterRetrieval);
r.setSnapshot({securities:[{ticker:'WFC',price:85.53,lastQuoteRefresh:laterRetrieval}],meta:{}});await api.loadSnapshot();
assert.equal(api.get('WFC').marketAsOf,marketAt,'same price and retrieval identify the same stored observation');
r.setSnapshot({securities:[{ticker:'WFC',price:85.53,lastQuoteRefresh:'2026-11-04T03:00:00Z'}],meta:{}});await api.loadSnapshot();
assert.equal(api.get('WFC').marketAsOf,null,'same price with a newer snapshot retrieval is a new unverified observation');
r.setSnapshot({securities:[{ticker:'WFC',price:87,lastQuoteRefresh:'2026-11-04T04:00:00Z'}],meta:{}});await api.loadSnapshot();
assert.equal(api.get('WFC').price,87);assert.equal(api.get('WFC').marketTimestamp,null);
r.setSnapshot({securities:[{ticker:'WFC',price:88,lastQuoteRefresh:'2026-11-04T05:00:00Z',marketTimestamp:Date.now()/1000+86400,marketAsOf:marketAt}],meta:{}});await api.loadSnapshot();
assert.equal(api.get('WFC').marketAsOf,null,'a conflicting future timestamp must not be rescued by a stale alternate field');

// The numeric rawQuote API and actual background path both retain exact provider retrieval time.
r.setQuote(()=>({price:85.53,marketTimestamp:marketSeconds,retrievedAt}));
assert.equal(await api._test.rawQuote('WFC'),85.53);assert.equal(api.get('WFC').lastQuoteRefresh,retrievedAt);
const backgroundTicker=api.maintenanceTickers()[0];await api._test.backgroundStep();
assert.equal(api.get(backgroundTicker).marketAsOf,marketAt);assert.equal(api.get(backgroundTicker).lastQuoteRefresh,retrievedAt,'background path must not overwrite provider retrieval time with a second save');

// An async snapshot while historical DATA is active must not change current ownership.
const tagCase=runtime();tagCase.api.setPortfolioSource(()=>current);
const finishSnapshot=tagCase.deferSnapshot(),pendingSnapshot=tagCase.api.loadSnapshot();tagCase.ctx.DATA=structuredClone(historical);
finishSnapshot({securities:[{ticker:'WFC',price:85.1,lastQuoteRefresh:retrievedAt},{ticker:'SCHD',price:35.9,lastQuoteRefresh:retrievedAt}],meta:{}});await pendingSnapshot;
assert.equal(tagCase.api.tags().WFC.currentlyOwned,true);assert.equal(tagCase.api.tags().WFC.coveredCall,true);assert.equal(tagCase.api.tags().SCHD.currentlyOwned,false);
assert.equal(tagCase.api.schdRows().find(t=>t.ticker==='WFC').currentlyOwned,true,'SCHD view must see current ownership without healing through Investment Universe');
assert.equal(tagCase.api.tags().WFC.currentlyOwned,true,'Market Database tag lookup remains current');
assert.deepEqual(Array.from(tagCase.api.holdingsTickers()),['WFC'],'refresh must target current portfolio, not historical SCHD');
await tagCase.api.refreshPortfolio();assert.ok(tagCase.requests.some(u=>u.includes('symbols=WFC')));assert.ok(!tagCase.requests.some(u=>u.includes('symbols=SCHD')));

// Two same-origin old/new tabs can persist whole stale databases under the legacy key.
const collisionStore=new Map(),oldTab=runtime(collisionStore,{shared:true}),newTab=runtime(collisionStore,{shared:true});
await newTab.api.refreshPortfolio();assert.equal(newTab.api.get('WFC').marketAsOf,marketAt);
oldTab.api._test.saveQuote('WFC',85.1,laterRetrieval); // old in-memory book overwrites the shared database.
assert.equal(runtime(collisionStore).api.get('WFC').marketAsOf,null,'reproduces the observed reload loss without namespace isolation');

const namespace='ccl.fos-review.rc3',sharedStore=new Map();
sharedStore.set('mdl.tags.v273',JSON.stringify({WFC:{ticker:'WFC',notes:'User note',lists:['tactical'],active:true}}));
sharedStore.set('mdl.lists.v273',JSON.stringify({custom:{id:'custom',name:'User list',system:false}}));
const legacyTab=runtime(sharedStore,{shared:true}),isolatedTab=runtime(sharedStore,{namespace,shared:true});
isolatedTab.api.setPortfolioSource(()=>current);await isolatedTab.api.refreshPortfolio();
assert.equal(isolatedTab.api.tags().WFC.notes,'User note');assert.ok(isolatedTab.api.listCatalog().custom);
legacyTab.api._test.saveQuote('WFC',1,laterRetrieval);
legacyTab.api.updateTag('WFC',{notes:'Old tab changed note',currentlyOwned:false});
sharedStore.set('mdl.portfolio.refresh.v275','"old-refresh"');sharedStore.set('mdl.holdings.busy.v276',String(Date.now()+60000));
const isolatedReload=runtime(sharedStore,{namespace,shared:true});isolatedReload.api.setPortfolioSource(()=>current);
assert.equal(isolatedReload.api.get('WFC').price,85.53);assert.equal(isolatedReload.api.get('WFC').marketAsOf,marketAt);
assert.equal(isolatedReload.api.tags().WFC.notes,'User note');assert.equal(isolatedReload.api.tags().WFC.currentlyOwned,true);
assert.notEqual(isolatedReload.api.status().lastPortfolioRefresh,'old-refresh');
await isolatedReload.api._test.backgroundStep();
assert.notEqual(isolatedReload.api.status().backgroundStatus,'Background paused for holdings refresh','legacy busy key cannot pause the new candidate');
for(const key of ['mdl.market.v275','mdl.tags.v273','mdl.lists.v273','mdl.portfolio.refresh.v275','mdl.market.lease.v276','mdl.holdings.busy.v276','mdl.market.cursor.v276','mdl.market.failed.v276'])assert.ok(sharedStore.has(namespace+':'+key),'candidate key must be scoped: '+key);

console.log('Validated market provenance: manual/background persistence, exact quote binding, stale/missing/same-price cases, snapshot merge, reload, current ownership and old-tab storage isolation.');
