// Build a sanitized, immutable November comparison from the separately audited evidence.
// No network, source-system writes, or balancing transactions.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=path.resolve(process.argv[2]||path.join(repo,'..','benchmark-audit'));
const read=f=>fs.readFileSync(path.join(evidence,f),'utf8');
const json=f=>JSON.parse(read(f));
const hash=f=>createHash('sha256').update(read(f)).digest('hex');
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const context={};context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(repo,'covered-call-lab/fos-activity-data.js'),'utf8'),context);
const patch=JSON.parse(JSON.stringify(context.CCL_FOS_ACTIVITY_UPDATE));
const audit=json('common-date-ccl-audit.private.json');
const market=json('existing-public-market-evidence.json');
const cash=json('ledger-cash-by-day.private.json');
const receivables=json('ccl-receivables-audit.private.json');
const sources=json('source-research/normalized-benchmark-sources.json');
const sourceValidation=json('source-research/source-validation.json');
assert.equal(sources.baselineDate,'2026-03-31');assert.equal(sources.commonEndDate,'2026-11-03');assert.equal(sources.currency,'USD');
assert.equal(sourceValidation.allSourceIntegrityChecksPass,true);
assert.equal(sourceValidation.normalizedFileSha256,hash('source-research/normalized-benchmark-sources.json'));
assert.equal(audit.commonDate,'2026-11-03');
assert.equal(hash('existing-public-market-evidence.json'),audit.sourcePublicEvidenceSha256);
assert.equal(createHash('sha256').update(JSON.stringify(patch.transactions)).digest('hex'),audit.candidateTransactionsSha256);
assert.equal(market.sourceStable.walBytes,0);
const day=audit.commonDate,capital=audit.totals.totalContributedCapital;
const contributions=audit.matchedExternalContributions.map(({date,amount,kind,timing})=>({date,amount,kind,timing}));
assert.equal(round(contributions.reduce((n,c)=>n+c.amount,0)),capital);

const options=patch.options.map(o=>{
 const q=market.options.find(q=>q.contract===o.contract&&q.source_day===day);
 assert.ok(q&&q.ask>0&&q.symbol===o.ticker&&q.expiration===o.expiration&&q.strike===Number(o.strike));
 const liability=round(q.ask*o.qty*100);
 return {...o,last:q.ask,ask:q.ask,bid:q.bid,liability,gl:round(o.cost+liability),gl_pct:round((o.cost+liability)/o.cost*100),referenceAsOf:day,referenceTimestamp:q.created,referencePredatesOpening:false,sourceStatus:q.status,valuationKind:'dated source-day ask reference, not a live or simultaneous quote'};
});
const holdings=[...patch.holdings,...patch.fosUpdate.legacyReserveHoldings].map(h=>{
 const q=market.stocks.find(q=>q.symbol===h.ticker&&q.source_day===day);
 assert.ok(q&&q.price>0);
 const value=round(h.shares*q.price),stock_gl=round(value-h.cost),option=options.find(o=>o.account===h.account&&o.ticker===h.ticker);
 return {...h,price:q.price,priceAsOf:day,displayPriceAsOf:day,displayPriceKind:'FOS source-day close',priceReferenceKind:'FOS source-day close',value,stock_gl,stock_gl_pct:stock_gl/h.cost*100,option_liability:option?.liability||0,option_gl:option?.gl||0,true_mtm:round(stock_gl+(h.premiums||0)+(h.dividends||0)+(option?.liability||0))};
});
const knownReceivables=receivables.knownEligibleUnpaidReceivables;
assert.ok(Number.isFinite(knownReceivables)&&knownReceivables>=0);
assert.equal(round((receivables.events||[]).reduce((n,e)=>n+e.amount,0)),knownReceivables);
const accountValue=(base,a)=>{
 const unpaid=base.alias===patch.combined.alias?knownReceivables:receivables.knownByAccount[base.alias];
 assert.ok(Number.isFinite(unpaid));
 return {...base,cash:a.recordedCash,stock_val:a.stockValue,called_stock_val:a.calledStockValue,reserve_val:a.legacyReserve?.value||0,opt_val:a.optionLiability,stock_gl:a.adjustedStockGL,interest:a.periodInterest,recorded_total:a.endingNAVEstimate,dividend_receivables:unpaid,total:round(a.endingNAVEstimate+unpaid),return_baseline:a.totalContributedCapital,strategy_total_return:round(a.economicGain+unpaid),strategy_return_pct:(a.economicGain+unpaid)/a.totalContributedCapital*100,valuationKind:'November 3 source-day estimate with known dividend receivables'};
};
const totals=audit.totals;
const combined=accountValue(patch.combined,totals);
combined.gross_asset_value=round(totals.stockValue+totals.recordedCash);
combined.called_stock_val=totals.calledStockValue;
combined.reserve_val=round(totals.stockValue-totals.calledStockValue);
assert.equal(round(holdings.reduce((n,h)=>n+h.value,0)),combined.stock_val);
assert.equal(round(options.reduce((n,o)=>n+o.liability,0)),combined.opt_val);
assert.equal(round(combined.stock_val+combined.cash+combined.opt_val+knownReceivables),combined.total);
assert.equal(round(combined.total-capital),combined.strategy_total_return);
assert.equal(round(combined.stock_gl+combined.realized_sale_gains+combined.premiums+combined.dividends+combined.interest+combined.opt_val+knownReceivables),combined.strategy_total_return);
const postSeptember=patch.transactions.filter(t=>t.date>'2026-09-04');
const categories={};for(const t of postSeptember)categories[t.category]=round((categories[t.category]||0)+t.amount);
const september=cash.daily.filter(d=>d.date<='2026-09-04').at(-1).combinedEndingCash;
assert.equal(round(september+Object.values(categories).reduce((n,x)=>n+x,0)),combined.cash);
const benchmarkInputs=sources.securities.map(s=>({
 ticker:s.ticker,prices:Object.fromEntries(Object.entries(s.requiredCloses).map(([d,p])=>[d,typeof p==='number'?p:p.close])),
 distributions:s.distributionEvents.map(e=>({exDate:e.exDate,paymentDate:e.paymentDate,amount:e.amount,source:e.sourceUrl||s.distributionSource?.sourceUrl||s.distributionSource?.url,amountPrecision:e.amountPrecision,sourceSha256:e.sourceSha256})),
 coverage:{qualified:true,notes:s.distributionAmountsExact===false?['Some distribution amounts are source-rounded; this ETF comparison is approximate.']:[]},
 splits:[],sourceNotes:['Daily close purchases at contribution dates; fractional shares; no reinvestment.','Price corporate-action stream checked: no split or capital-gain events returned in the period.'],
 amountsExact:s.distributionAmountsExact,priceSource:s.priceSource,distributionSource:s.distributionSource
}));
assert.equal(benchmarkInputs.length,12);
for(const b of benchmarkInputs){assert.ok(contributions.every(c=>b.prices[c.date]>0)&&b.prices[day]>0);assert.ok(b.distributions.every(d=>d.exDate&&d.paymentDate&&Number.isFinite(d.amount)));}
// Remove local paths, source-system identifiers and raw retrieval payloads from browser data.
const sanitize=x=>Array.isArray(x)?x.map(sanitize):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!['localPath','rawFile','source_id','sourceId','id'].includes(k)).map(([k,v])=>[k,sanitize(v)])):x;
const limitations=[
 'The strategy row is a recorded November 3 source-day estimate, before unreported WMT assignment fees.',
 'Option asks have source-day records with timestamps lacking an explicit timezone; they are not asserted to be simultaneous executable marks.',
 (receivables.receivablesCompletenessVerified?'The experiment dividend entitlement window has been audited.':'The full experiment dividend entitlement window is still being qualified; any additional unverified receivable is excluded.')+' Known earned, unpaid dividends are included once in value and return, not cash.',
 'Benchmark distributions are earned by ex-date; amounts paid after November 3 are receivables, not cash.',
 'All percentages are profit divided by total contributed capital, not time-weighted returns. Contribution-date closes are explicit daily timing proxies.'
];
const result={schema:'CCLCommonPeriod/v1',version:'3.0.1-rc.6',build:'CCL-FOS-20261106.6',startDate:'2026-03-31',endDate:day,
 contributions,totalContributedCapital:capital,benchmarkInputs:sanitize(benchmarkInputs),limitations,recordedNAVBeforeReceivables:totals.endingNAVEstimate,earnedPeriodIncome:round(totals.periodCashIncome+knownReceivables),
 valuationSnapshot:{asOf:day,ledgerThrough:day,holdings,options,combined,accounts:patch.accounts.map(base=>accountValue(base,audit.accounts.find(a=>a.account===base.alias))),fosSnapshot:true,fosCommonPeriod:true,releaseCommentary:'March experiment through November 3. Source-day estimate includes known earned, unpaid dividends and remains before unreported WMT fees.'},
 cashBridge:{historicalDate:'2026-09-04',historicalCashBalance:september,currentDate:day,currentCashBalance:combined.cash,currentCashByAccount:patch.fosUpdate.recordedCashByAccount,postSeptemberCategories:categories,postSeptemberRowCount:postSeptember.length,periodInterest:totals.periodInterest,periodCashIncome:totals.periodCashIncome,legacyRollingIncome:totals.legacyCashIncome,preMarchInterestCarry:.04,november3Movements:cash.daily.find(d=>d.date===day).recordedMovements.map(({account,category,ticker,amount})=>({account,category,ticker,amount}))},
 receivables:{knownEligibleUnpaidReceivables:knownReceivables,totalEligibleUnpaidReceivables:receivables.totalEligibleUnpaidReceivables,completenessVerified:receivables.receivablesCompletenessVerified,status:receivables.status,events:receivables.events.map(({ticker,account,shares,amountPerShare,amount,exDate,recordDate,paymentDate,sourceUrl,exDateBasis})=>({ticker,account,shares,amountPerShare,amount,exDate,recordDate,paymentDate,sourceUrl,exDateBasis})),knownByAccount:receivables.knownByAccount},
 provenance:{ledgerSha256:audit.candidateTransactionsSha256,marketEvidenceSha256:hash('existing-public-market-evidence.json'),benchmarkSourcesSha256:hash('source-research/normalized-benchmark-sources.json'),cashAuditSha256:hash('ledger-cash-by-day.private.json'),receivablesAuditSha256:hash('ccl-receivables-audit.private.json'),sourceDay:day,historicalBaselineDate:'2026-09-04',historicalBaselineCommit:patch.fosUpdate.matchingGitCommit}
};
const serialized=JSON.stringify(result,null,2);
assert.ok(!/accountId|householdId|messageId|orderId|[A-Z]:[\\/]/.test(serialized),'browser projection must not contain private source identifiers or local paths');
fs.writeFileSync(path.join(repo,'covered-call-lab/common-period-data.js'),'/* Verified local review projection. Sources and definitions are carried with the data. */\nwindow.CCL_COMMON_PERIOD_DATA = '+serialized+';\n');
console.log(JSON.stringify({sourceDay:day,benchmarkInputs:benchmarkInputs.length,recordedCash:combined.cash,recordedNAV:combined.total,recordedGain:combined.strategy_total_return,ledgerRows:patch.transactions.length,laterRows:postSeptember.length,qualifiedForRelease:false}));
