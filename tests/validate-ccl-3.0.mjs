import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context={};
context.window=context;
vm.createContext(context);
for(const file of ['covered-call-lab/data.js','covered-call-lab/release-2.7.js','covered-call-lab/release-2.7.1.js','covered-call-lab/release-2.7.3.js','covered-call-lab/ledger-data.js','covered-call-lab/benchmark-data.js','covered-call-lab/reconciliation.js','covered-call-lab/release-3.0.js']){
  const source=fs.readFileSync(file,'utf8').replace(/^const DATA/,'DATA');
  vm.runInContext(source,context,{filename:file});
}

const {CCL_LEDGER_DATA:ledger,CCL_DERIVED_STATE:d,DATA}=context;
const close=(actual,expected,tolerance=.005)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
assert.equal(ledger.transactions.length,138);
assert.equal(d.tx.length,137,'pending activity must not enter the common-date ledger');
assert.equal(ledger.transactions.filter(t=>t.pending).length,1);
assert.equal(ledger.transactions.find(t=>t.pending)?.amount,24.75);
assert.equal(d.cutoff,'2026-09-04');
assert.equal(d.accounts.length,2);
assert.equal(d.holdings.length,9);
assert.equal(d.options.length,8);
assert.equal(d.positionAnalysis.length,21);
assert.ok(d.options.every(o=>/^2026-\d{2}-\d{2}$/.test(o.expiration)));
assert.ok(!/Account_\d{6,}/.test(JSON.stringify(ledger)),'raw account numbers must not ship');

const calls=d.callHierarchy.calls,callTotal=d.callHierarchy.total;
assert.equal(calls.length,40);
assert.equal(callTotal.contracts,46);
assert.equal(callTotal.openCalls,8);
assert.equal(callTotal.expiredCalls,21);
assert.equal(callTotal.assignedCalls,11);
assert.equal(callTotal.boughtToCloseCalls,0);
assert.equal(callTotal.unresolvedCalls,0);
close(callTotal.grossPremium,5325);close(callTotal.netPremium,5294.27);close(callTotal.optionExpenses,30.73);
close(callTotal.actualOptionContribution,3973.27);
close(callTotal.expirationRate,65.625,.00005);close(callTotal.assignmentRate,34.375,.00005);
close(callTotal.premiumYieldPct,1.7062,.00005);
close(callTotal.realizedCallValueAdd,2417.92);close(callTotal.netCoveredCallValueAdd,1876.64);close(callTotal.surrenderedUpside,292);
assert.equal(callTotal.realizedValueAddCoverageCalls,22);
assert.equal(callTotal.valueAddCoverageCalls,30);
assert.equal(callTotal.valueAddTotalCalls,40);
assert.ok(calls.every(c=>c.ticker&&c.account&&c.contracts&&c.coveredShares&&c.openDate&&c.expirationDate&&c.outcome));
assert.ok(calls.filter(c=>c.outcome==='expired').every(c=>c.valueAdd===c.netOptionPremium));
assert.ok(calls.filter(c=>c.outcome==='open').every(c=>c.openOptionLiability!=null&&c.valueAdd!=null));
assert.equal(d.callHierarchy.byTicker.reduce((n,a)=>n+a.callsWritten,0),40);
assert.equal(d.callHierarchy.byAccount.reduce((n,a)=>n+a.callsWritten,0),40);
assert.equal(new Set(calls.map(c=>c.id)).size,40,'every historical call must be represented exactly once');

const campaigns=d.callCampaigns;
assert.equal(campaigns.length,20);
assert.equal(campaigns.reduce((n,c)=>n+c.callsWritten,0),40);
assert.deepEqual(campaigns.flatMap(c=>c.calls.map(call=>call.id)).sort(),calls.map(call=>call.id).sort());
for(const campaign of campaigns){
  close(campaign.netPremium,campaign.calls.reduce((n,c)=>n+c.netOptionPremium,0));
  close(campaign.grossPremium,campaign.calls.reduce((n,c)=>n+c.grossPremium,0));
  assert.equal(campaign.callsWritten,campaign.calls.length);
  assert.equal(campaign.startDate,[...campaign.calls].sort((a,b)=>a.openDate.localeCompare(b.openDate))[0].openDate);
  if(campaign.ccValueAdd!=null)close(campaign.ccValueAdd,campaign.calls.reduce((n,c)=>n+c.valueAdd,0));
}

close(d.combined.return_baseline,74036.67);
close(d.combined.cash,3315.68);
close(d.combined.stock_val,80603);
close(d.combined.opt_val,-1321);
close(d.combined.total,82597.68);
close(d.combined.premiums,5294.27);
close(d.combined.gross_premiums,5325);
close(d.combined.option_expenses,30.73);
close(d.combined.dividends,820.80);
close(d.combined.interest,63.57);
close(d.combined.realized_sale_gains,2872.89);
close(d.combined.stock_gl,830.52);
close(d.combined.strategy_total_return,8561.05);
close(d.combined.strategy_return_pct,11.5633,.00005);
close(d.combined.return_baseline+d.combined.strategy_total_return-d.combined.total,.04,.005);

const ko=d.positionAnalysis.find(p=>p.ticker==='KO');
const pfe=d.positionAnalysis.find(p=>p.ticker==='PFE');
assert.equal(ko.status,'Open');
close(ko.actualResult,1425.17);close(ko.buyHoldLifecycleResult,1046.50);close(ko.coveredCallValueAdd,378.67);
assert.equal(pfe.status,'Closed');assert.equal(pfe.exitDate,'2026-08-28');
close(pfe.actualResult,87.51);close(pfe.buyHoldLifecycleResult,185);close(pfe.coveredCallValueAdd,-97.49);close(pfe.postExitOpportunityCost,98);

const koCalls=calls.filter(c=>c.ticker==='KO'),pfeCalls=calls.filter(c=>c.ticker==='PFE');
assert.equal(koCalls.length,5,'KO acceptance case must preserve all repeated calls');
assert.deepEqual([...new Set(koCalls.map(c=>c.outcome))].sort(),['expired','open']);
assert.equal(pfeCalls.length,4,'PFE acceptance case must survive the underlying exit');
const pfeAssignment=pfeCalls.find(c=>c.outcome==='assigned');
close(pfeAssignment.assignmentProceeds,5299.89);close(pfeAssignment.surrenderedUpside,292);close(pfeAssignment.valueAdd,-261.33);
for(const ticker of ['O','KO','PFE'])assert.ok(campaigns.find(c=>c.ticker===ticker),'acceptance ticker must flow through the generic campaign implementation');

const synthetic=context.CCLReconciliation.derive({
  ledger:{accounts:[{alias:'Synthetic'}],transactions:[
    {date:'2026-01-10',account:'Synthetic',category:'call_close',ticker:'XYZ',symbol:'-XYZ260130C50',quantity:1,price:.40,commission:.65,fees:.02,amount:-40.67,cash:100,pending:false},
    {date:'2026-01-02',account:'Synthetic',category:'call_open',ticker:'XYZ',symbol:'-XYZ260130C50',quantity:-1,price:1,commission:.65,fees:.02,amount:99.33,cash:140.67,pending:false}
  ]},market:{prices:{},historicalPrices:{},optionMarks:{}},benchmarks:{securities:[]},cutoff:'2026-01-31',baselineDate:'2026-01-01'
});
const closed=synthetic.callHierarchy.calls[0];
assert.equal(closed.outcome,'bought to close');close(closed.closingDebit,40.67);close(closed.netOptionPremium,58.66);close(closed.valueAdd,58.66);

function strategyScenario({price,terminal=null,salePrice=null}){
  const symbol='-XYZ260130C55',transactions=[];
  if(terminal==='assigned'){
    transactions.push({date:'2026-01-30',account:'Synthetic',category:'assigned_stock_sale',ticker:'XYZ',symbol:'XYZ',action:'ASSIGNED STOCK SALE',quantity:-100,price:salePrice,commission:0,fees:0,amount:salePrice*100,cash:5750,pending:false});
    transactions.push({date:'2026-01-30',account:'Synthetic',category:'call_assignment',ticker:'XYZ',symbol,quantity:1,price:0,commission:0,fees:0,amount:0,cash:250,pending:false});
  }else if(terminal==='expired')transactions.push({date:'2026-01-31',account:'Synthetic',category:'call_expiration',ticker:'XYZ',symbol,quantity:1,price:0,commission:0,fees:0,amount:0,cash:250,pending:false});
  transactions.push({date:'2026-01-15',account:'Synthetic',category:'dividend',ticker:'XYZ',symbol:'XYZ',quantity:0,price:0,commission:0,fees:0,amount:50,cash:250,pending:false});
  transactions.push({date:'2026-01-02',account:'Synthetic',category:'call_open',ticker:'XYZ',symbol,quantity:-1,price:2,commission:0,fees:0,amount:200,cash:200,pending:false});
  transactions.push({date:'2026-01-02',account:'Synthetic',category:'stock_buy',ticker:'XYZ',symbol:'XYZ',quantity:100,price:50,commission:0,fees:0,amount:-5000,cash:0,pending:false});
  return context.CCLReconciliation.derive({ledger:{accounts:[{alias:'Synthetic'}],transactions},market:{prices:{XYZ:price},historicalPrices:{},optionMarks:{[symbol]:{ask:.5}}},benchmarks:{securities:[]},cutoff:'2026-02-01',baselineDate:'2026-01-01'}).callCampaigns[0];
}
const belowStrike=strategyScenario({price:52});
close(belowStrike.stockGL,200);close(belowStrike.overallCCLGL,450);close(belowStrike.currentCostToClose,50);
const aboveStrike=strategyScenario({price:60});
close(aboveStrike.stockGL,500);close(aboveStrike.overallCCLGL,750);
const furtherAboveStrike=strategyScenario({price:70});
close(furtherAboveStrike.stockGL,500);close(furtherAboveStrike.overallCCLGL,750);
const expiredScenario=strategyScenario({price:60,terminal:'expired'});
assert.equal(expiredScenario.calls[0].outcome,'expired');close(expiredScenario.overallCCLGL,1250);
assert.equal(expiredScenario.openCalls,0,'expired position must be currently uncovered');close(expiredScenario.stockGL,1000);
const assignedScenario=strategyScenario({price:60,terminal:'assigned',salePrice:55});
assert.equal(assignedScenario.finalStatus,'Called Away');close(assignedScenario.stockGL,500);close(assignedScenario.overallCCLGL,750);

const abbvCampaign=campaigns.find(c=>c.ticker==='ABBV');
close(abbvCampaign.stockGL,-468.5);close(abbvCampaign.netPremium,958.66);close(abbvCampaign.overallCCLGL,490.16);

const productionCallUi=fs.readFileSync('covered-call-lab/call-history-ui.js','utf8');
assert.ok(!/\bKO\b|\bPFE\b/.test(productionCallUi),'production call-history UI must not contain ticker-specific branches');
for(const heading of ['Ticker','Call Period','Stock G/L','Dividends','Calls','Net Premium','Final Status','Overall CCL G/L'])assert.ok(productionCallUi.includes(heading));
assert.ok(!productionCallUi.includes('<th class="num">CC Value Add / Drag</th>'),'forensic value add must not remain a primary campaign column');
for(const removedDefault of ['Account hierarchy','Underlying hierarchy','Evidence coverage:','Historical call ledger'])assert.ok(!productionCallUi.includes(removedDefault));

const july=DATA.monthlyLedger.find(m=>m.key==='2026-07'),august=DATA.monthlyLedger.find(m=>m.key==='2026-08');
assert.equal(july.assignments,7);assert.match(july.narrative,/SCHD assignment was in Portfolio B/);assert.match(july.narrative,/\$45,397\.99 deployed/);
assert.equal(august.assignments,2);assert.match(august.narrative,/PFE, VZ/);assert.match(august.narrative,/\$31,302\.98 deployed/);
assert.ok(!DATA.monthlyLedger.some(m=>/aggressive|optimization|higher-strike|inflection/i.test(m.narrative)),'commentary must not infer unsupported strategy intent');

assert.equal(DATA.benchmarkSnapshots.length,12);
for(const [ticker,expected] of Object.entries({SPY:18.7216,QQQ:24.7051,DIA:15.8386,SCHD:14.2536,BND:-.2743,SPYI:14.4886,JEPI:5.157,JEPQ:14.5695,QQQI:16.6895,PBP:11.0732,XYLD:11.0989,QYLD:12.3265})){
  close(DATA.benchmarkSnapshots.find(b=>b.ticker===ticker).totalReturnPct,expected,.00005);
}
const removedBenchmark=['B','X','M'].join('');
assert.ok(!DATA.benchmarkSnapshots.some(b=>b.ticker===removedBenchmark));
assert.ok(!JSON.stringify(DATA.benchmarkRegimes).includes(removedBenchmark));
for(const file of fs.readdirSync('covered-call-lab').filter(file=>/\.(?:js|html|json)$/.test(file))){
  assert.ok(!fs.readFileSync(`covered-call-lab/${file}`,'utf8').includes(removedBenchmark),`${removedBenchmark} remains in ${file}`);
}
assert.equal(DATA.release,'3.0.0');
assert.equal(JSON.parse(fs.readFileSync('covered-call-lab/quote-proxy.json','utf8')).version,'3.0.0');
const marketSource=fs.readFileSync('covered-call-lab/market.js','utf8');
assert.match(marketSource,/PROXY_CONFIG_URL='quote-proxy\.json'/);
assert.match(marketSource,/`\$\{proxyEndpoint\}\/quotes\?symbols=\$\{encodeURIComponent\(tickers\.join\(','\)\)\}`/,'production quote request architecture changed');

console.log('Validated CCL 3.0.0: generalized call hierarchy, full-history reconciliation, acceptance cases, and common-period benchmarks.');
