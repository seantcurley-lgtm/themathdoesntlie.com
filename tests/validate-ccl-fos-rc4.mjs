import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=n=>fs.readFileSync(path.join(root,'covered-call-lab',n),'utf8');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cents=(actual,expected,message)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<.005,`${message}: expected ${expected}, received ${actual}`);
const ctx={};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['data.js','release-2.7.js','release-2.7.1.js','release-2.7.3.js','ledger-data.js','benchmark-data.js','reconciliation.js','release-3.0.js'])vm.runInContext(read(f).replace(/^const DATA/,'DATA'),ctx);
vm.runInContext(read('fos-activity-data.js'),ctx);
const p=JSON.parse(JSON.stringify(ctx.CCL_FOS_ACTIVITY_UPDATE)),s=p.valuationSnapshot;

assert.equal(p.transactions.length,179);
assert.equal(p.callHistory.length,55);
assert.equal(hash(p.transactions),'d6a63367caebca82765d52baa3fbafefceaf0698198dfd219ce411fb2c592482','rc.4 must not change any ledger row');
assert.equal(hash(p.callHistory),'ec2a8c86f96d75284196b6fa3bcce389e80b8aef027d18f562a1f0592e8b51dc','rc.4 must preserve all historical call lifecycles');
assert.equal(hash(s),'1f4d64fd1145e0726ec2662acde8c2f2b16faa4cabe9e3cbef59c1a05ce0dbbe','November 2 snapshot must remain unchanged');
assert.equal(p.holdings.length,8,'the active covered-call board remains eight stocks');
assert.ok(!p.holdings.some(h=>h.ticker==='SCHD'),'historical reserve must not become an active call holding');
assert.equal(p.options.length,8);assert.equal(p.options.reduce((n,o)=>n-o.qty,0),9);
const liabilities={GOOGL:-36,HPQ:-48,MDT:-101,WFC:-134,ACN:-1440,DECK:-380,KHC:-136,SLB:-50};
for(const o of p.options){
 assert.equal(o.liability,liabilities[o.ticker],`${o.ticker} uses the existing November 2 ask reference`);
 assert.equal(o.last*o.qty*100,o.liability,`${o.ticker} liability respects its signed contract quantity`);
 assert.equal(o.referenceAsOf,'2026-11-02',`${o.ticker} reference retains its date`);
 assert.ok(Number.isFinite(Date.parse(o.referenceTimestamp)),`${o.ticker} retains its source timestamp`);
 assert.equal(o.valuationKind,'dated ask reference, not a live quote');
}
assert.equal(p.options.reduce((n,o)=>n+o.liability,0),-2325,'all nine contracts are included once');
for(const o of p.options)assert.equal(o.referencePredatesOpening,['MDT','WFC'].includes(o.ticker),`${o.ticker} explicitly identifies whether its reference predates opening`);
assert.deepEqual(p.fosUpdate.recordedCashByAccount,{'Portfolio A':3439.20,'Portfolio B':5043.84});
assert.equal(p.fosUpdate.recordedCashBridge,8483.04);
assert.equal(Object.values(p.fosUpdate.recordedCashByAccount).reduce((n,x)=>n+x,0),p.fosUpdate.recordedCashBridge);
assert.equal(p.combined.return_baseline,93464.97);
const originalCosts={GOOGL:31025.21,HPQ:3041,MDT:9174.99,WFC:8547.99,ACN:24526.50,DECK:8009,KHC:5261.49,SLB:5432.50};
for(const h of p.holdings)assert.equal(h.cost,originalCosts[h.ticker],`${h.ticker} recorded basis is preserved`);
cents(p.combined.gross_premiums-p.combined.premiums,41.34,'known net option cash already includes fees');
assert.equal(p.fosUpdate.legacyReserveHoldings.length,1);
const reserve=p.fosUpdate.legacyReserveHoldings[0];
assert.equal(reserve.account,'Portfolio A');assert.equal(reserve.ticker,'SCHD');assert.equal(reserve.shares,100);assert.equal(reserve.cost,3356);assert.equal(reserve.price,35.9);assert.equal(reserve.priceAsOf,'2026-11-02');
assert.equal(s.combined.cash,16881.35);assert.equal(s.combined.stock_val,89072);assert.equal(s.combined.opt_val,-2090);assert.equal(s.combined.total,103863.35);assert.equal(s.combined.stock_gl,-2114.58);assert.equal(s.combined.strategy_total_return,10398.42);assert.equal(s.combined.return_baseline,93464.97);
assert.equal(s.holdings.length,8);assert.equal(s.options.length,6);assert.equal(s.options.reduce((n,o)=>n-o.qty,0),7);assert.ok(!s.holdings.some(h=>h.ticker==='WFC'));assert.ok(!s.options.some(o=>o.ticker==='MDT'));assert.ok(s.holdings.some(h=>h.ticker==='SCHD'));
assert.equal(Math.round((s.combined.strategy_total_return-(s.combined.total-s.combined.return_baseline))*100),4,'preserve the original source carry without a balancing transaction');
assert.ok(!/accountId|householdId|messageId|orderId|[A-Z]:[\\/]/.test(JSON.stringify(p)));

// Adapter execution uses only in-memory quotes: no browser, network, or FOS writes.
const quotes={};let portfolioSource;
const quote=(price,marketAsOf,retrievedAt='2026-11-04T01:00:00Z')=>({price,lastQuoteRefresh:retrievedAt,marketAsOf,marketTimestamp:Date.parse(marketAsOf)/1000,quoteObservation:{price,retrievedAt,marketAsOf,marketTimestamp:Date.parse(marketAsOf)/1000}});
Object.assign(ctx,{structuredClone,location:{search:''},URLSearchParams,page:'dashboard',mode:'live',callsMonth:'all',safeText:String,render(){},holdingRows(){return ctx.DATA.holdings;},combined(){return ctx.DATA.combined;},enrichedHoldings(){return ctx.DATA.holdings;},enhanceRenderedPage(){},fmt2:n=>String(n),modeUI(){},refreshLive:async()=>{},MDLMarket:{get:t=>quotes[t],syncTags(){},setPortfolioSource:source=>{portfolioSource=source;}},fetch:async()=>{throw Error('No network endpoint is needed by the value adapter');}});
vm.runInContext(read('fos-review-adapter.js'),ctx);
const helpers=ctx.CCLCandidateValues,wfc=p.holdings.find(h=>h.ticker==='WFC');
assert.equal(wfc.price,85.48);assert.equal(wfc.priceAsOf,'2026-11-03');assert.ok(Number.isFinite(Date.parse(wfc.minimumMarketAt)));
assert.equal(helpers.resolveHolding(wfc,undefined).price,85.48,'an evidenced execution fallback keeps portfolio values useful before refresh');
assert.equal(helpers.resolveHolding(wfc,undefined).providerVerified,false,'execution reference is not a provider quote');
assert.equal(helpers.resolveHolding(wfc,{price:86,lastQuoteRefresh:'2026-11-04T01:00:00Z'}).price,85.48,'retrieval time alone cannot replace the execution fallback');
const preEntry=new Date(Date.parse(wfc.minimumMarketAt)-1000).toISOString();
assert.equal(helpers.resolveHolding(wfc,quote(86,preEntry)).providerVerified,false,'provider timestamp before precise stock entry must be rejected');
assert.equal(helpers.resolveHolding(wfc,quote(86,preEntry)).price,85.48);
assert.equal(helpers.resolveHolding(wfc,quote(85.53,'2026-11-03T21:00:00Z')).price,85.53,'a later same-day provider quote replaces the execution fallback');
const mismatch=quote(85.53,'2026-11-03T21:00:00Z');mismatch.lastQuoteRefresh='2026-11-04T02:00:00Z';
assert.equal(helpers.resolveHolding(wfc,mismatch).providerVerified,false,'same-price evidence remains bound to the exact retrieval');
assert.equal(helpers.resolveHolding(wfc,quote(100,'2099-11-03T21:00:00Z')).providerVerified,false);
assert.equal(ctx.combined().cash,8483.04);assert.ok(Number.isFinite(ctx.combined().total),'dated latest-available references must produce a numeric estimate before refreshing');
assert.equal(ctx.combined().currentOptionMtmAvailable,false,'dated reference estimate must not assert exact current option MTM');

const prices={ACN:254.56,DECK:84.09,GOOGL:280.03,HPQ:28.27,KHC:24.52,MDT:98.88,SLB:52.13,WFC:85.53};
for(const [ticker,price]of Object.entries(prices))quotes[ticker]=quote(price,'2026-11-03T21:00:00Z');
await ctx.refreshLive();
const c=ctx.combined();
for(const [key,value]of Object.entries({called_stock_val:93253,reserve_val:3590,stock_val:96843,stock_gl:-2891.57,cash:8483.04,opt_val:-2325,gross_asset_value:105326.04,total:103001.04,strategy_total_return:9536.11,return_baseline:93464.97}))cents(c[key],value,key);
assert.ok(Math.abs(c.strategy_return_pct-9536.11/93464.97*100)<.0001,'return uses total contributed capital including GOOGL allocation');
assert.equal(c.currentOptionMtmAvailable,false);
cents(c.total,c.stock_val+c.cash+c.opt_val,'asset value does not double count recorded premiums or distributions');
cents(c.strategy_total_return,c.stock_gl+c.realized_sale_gains+c.premiums+c.dividends+c.interest+c.opt_val,'return component reconciliation');
cents(c.stock_gl,c.stock_val-p.holdings.reduce((n,h)=>n+h.cost,0)-reserve.cost-p.fosUpdate.preEntryGain,'recorded basis and GOOGL pre-allocation adjustment are each applied once');
assert.equal(Math.round((c.strategy_total_return-(c.total-c.return_baseline))*100),4,'source carry remains four cents');
const accounts=Object.fromEntries(ctx.DATA.accounts.map(a=>[a.alias,a]));
cents(accounts['Portfolio A'].total,55981.20,'Portfolio A account estimate');
cents(accounts['Portfolio B'].total,47019.84,'Portfolio B account estimate');
cents(ctx.DATA.accounts.reduce((n,a)=>n+a.total,0),c.total,'account estimates reconcile to full experiment');
for(const a of ctx.DATA.accounts){
 cents(a.total,a.stock_val+a.cash+a.opt_val,`${a.alias} assets do not add premiums or distributions a second time`);
 cents(a.cash,p.fosUpdate.recordedCashByAccount[a.alias],`${a.alias} keeps the authoritative cash bridge`);
}
assert.equal(ctx.holdingRows().length,8);assert.equal(portfolioSource().holdings.length,8,'refresh ownership remains the current called-stock subset');
const expected={ACN:1573.82,DECK:573.34,GOOGL:-3885.78,HPQ:39.02,KHC:-140.81,MDT:968.69,SLB:-131.16,WFC:99.35};
const open=ctx.DATA.callCampaigns.filter(x=>x.finalStatus==='Open');assert.equal(open.length,8);
for(const campaign of open){assert.equal(campaign.overallCCLGL,expected[campaign.ticker],campaign.ticker);assert.equal(campaign.totalEconomics,null);assert.equal(campaign.currentCostToClose,null);}

ctx.mode='snapshot';ctx.render();assert.equal(ctx.combined().total,103863.35);assert.equal(ctx.holdingRows().length,8);assert.ok(!ctx.holdingRows().some(h=>h.ticker==='WFC'));
assert.equal(portfolioSource().holdings.length,8);assert.ok(portfolioSource().holdings.some(h=>h.ticker==='WFC'),'historical view must not replace the market module current ownership source');
ctx.page='holdings';ctx.render();assert.equal(ctx.mode,'live');assert.equal(ctx.DATA.fosSnapshot,undefined);assert.ok(ctx.DATA.holdings.some(h=>h.ticker==='WFC'));
ctx.page='dashboard';ctx.mode='baseline';ctx.render();assert.equal(ctx.combined().total,82597.68);assert.equal(ctx.combined().return_baseline,74036.67);assert.equal(ctx.DATA.fosUpdate,undefined);
ctx.mode='live';ctx.render();cents(ctx.combined().total,103001.04,'returning from historical views restores latest-available full-book estimate');
const bby=p.callHistory.find(x=>x.symbol==='-BBY260925C85');assert.equal(bby.endDate,'2026-09-16');assert.equal(bby.expirationDate,'2026-09-25');assert.equal(bby.durationDays,16);assert.equal(bby.assignmentProceeds,8499.82);assert.equal(bby.outcomeEvents[0].date,'2026-09-17');
assert.equal(p.callAggregates.total.averageDurationDays,24.29);assert.equal(p.callAggregates.total.coveredCapital,Math.round(p.callHistory.reduce((n,x)=>n+(x.coveredCapital||0),0)*100)/100);
console.log('Validated rc.4: unchanged ledger/call history and snapshots; dated nine-contract references; cash/reserve/capital scope; numeric portfolio and return reconciliation; precise quote guards; all eight campaign calculations; historical view transitions.');
