import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'covered-call-lab/market.js'),'utf8');
const namespace='ccl.test.preview.failure',dbKey=namespace+':mdl.market.v275',tagKey=namespace+':mdl.tags.v273';
const marketAt='2026-11-03T21:00:00.000Z',retrievedAt='2026-11-04T16:20:00.000Z';
const recoveredMarketAt='2026-11-04T16:25:00.000Z',recoveredRetrievedAt='2026-11-04T16:26:00.000Z';
const now=Date.parse('2026-11-04T17:00:00.000Z');
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const notes='Keep this manually entered review note';
const store=new Map([['mdl.tags.v273',JSON.stringify({WFC:{ticker:'WFC',notes,lists:['moat'],active:true}})]]);
const current={holdings:[{ticker:'WFC',name:'Wells Fargo',sector:'Financials',shares:100,price:85.48}],options:[{ticker:'WFC'}],universe:[{ticker:'WFC',bucket:'Core'}]};
const requests=[],timers=[],events=[];
let fail=false,price=85.53,time=marketAt,retrieval=retrievedAt,timerId=0;
const ctx={DATA:structuredClone(current),SP500_SEED:[{ticker:'WFC',name:'Wells Fargo',sector:'Financials'}],SCHD_SEED:{holdings:[]},CCL_CANDIDATE_STORAGE_NAMESPACE:namespace,Date:FixedDate,location:{hostname:'127.0.0.1',origin:'http://127.0.0.1:8175',href:'http://127.0.0.1:8175/covered-call-lab/'},URL,
 localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)},crypto:{randomUUID:()=> 'preview-failure-test'},
 CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent:event=>events.push(event),addEventListener(){},
 setTimeout(callback,delay){timers.push(delay);if([3000,15000,30000].includes(delay))queueMicrotask(callback);return++timerId;},clearTimeout(){},
 fetch:async url=>{
  const parsed=new URL(url,'http://127.0.0.1:8175/covered-call-lab/');requests.push(parsed.href);
  if(parsed.pathname==='/covered-call-lab/quote-proxy.json')return{ok:true,json:async()=>({endpoint:'/review-quote-gateway'})};
  assert.equal(parsed.pathname,'/review-quote-gateway/quotes','only the same-origin preview bridge is called');
  if(fail)throw new TypeError('Failed to fetch');
  return{ok:true,status:200,text:async()=>JSON.stringify({quotes:{WFC:{ticker:'WFC',price,marketTimestamp:Date.parse(time)/1000,retrievedAt:retrieval}},failed:[]})};
 }
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'market.js'});
const api=ctx.MDLMarket;api.setPortfolioSource(()=>current);
assert.equal(await api.refreshPortfolio(),true);assert.equal(api.status().portfolioDone,1);assert.equal(api.get('WFC').price,85.53);assert.equal(api.get('WFC').marketAsOf,marketAt);
const previousQuote=JSON.stringify(api.get('WFC')),previousCache=store.get(dbKey),previousNotes=JSON.parse(store.get(tagKey)).WFC.notes;
const previousRefresh=api.status().lastPortfolioRefresh,startRequests=requests.length,startTimers=timers.length;
fail=true;
assert.equal(await api.refreshPortfolio(),false,'a stopped bridge cannot report a successful refresh');
const failure=api.status();
assert.equal(failure.portfolioRefreshing,false);assert.equal(failure.portfolioDone,0);assert.equal(failure.portfolioTotal,1);assert.equal(failure.portfolioFailed,1);assert.deepEqual(Array.from(failure.portfolioFailedTickers),['WFC']);
assert.match(failure.lastError,/Local preview quote bridge could not be reached/);
assert.match(failure.lastError,/Run Start-CCL-Candidate\.ps1, then Refresh Portfolio/);
assert.match(failure.lastError,/Previous quotes retained/);
assert.match(failure.portfolioStatus,/refresh failed/);
assert.equal(requests.length-startRequests,1,'a stopped local bridge fails once without repeated 15/30-second requests');
assert.ok(!timers.slice(startTimers).some(delay=>[15000,30000].includes(delay)),'do not schedule provider retry delays when the local preview is unreachable');
assert.equal(JSON.stringify(api.get('WFC')),previousQuote,'failure keeps the exact last successful quote and provider timestamp');
assert.equal(store.get(dbKey),previousCache,'failure does not overwrite the persisted quote cache');
assert.equal(JSON.parse(store.get(tagKey)).WFC.notes,previousNotes);assert.equal(previousNotes,notes,'failure preserves user notes');
assert.equal(failure.lastPortfolioRefresh,previousRefresh,'failure must not replace the last successful refresh receipt');
assert.ok(events.some(event=>String(event.detail?.lastError).includes('Run Start-CCL-Candidate.ps1')),'the actionable error reaches the existing UI event flow');

fail=false;price=86.2;time=recoveredMarketAt;retrieval=recoveredRetrievedAt;
const recoveryStart=requests.length;
assert.equal(await api.refreshPortfolio(),true,'a restarted bridge supports the normal next refresh');
assert.equal(requests.length-recoveryStart,1);assert.equal(api.status().portfolioDone,1);assert.equal(api.status().portfolioFailed,0);assert.equal(api.status().portfolioStatus,'Holdings refresh successful: 1/1 current');
assert.equal(api.get('WFC').price,86.2);assert.equal(api.get('WFC').marketAsOf,recoveredMarketAt);assert.equal(api.get('WFC').lastQuoteRefresh,recoveredRetrievedAt);
assert.equal(JSON.parse(store.get(dbKey)).WFC.price,86.2);assert.equal(JSON.parse(store.get(tagKey)).WFC.notes,notes);
console.log('Validated stopped-preview behavior in the actual market module: one failed request, actionable launcher message, zero false successes, exact prior quote/cache/notes retained, and successful later recovery.');
