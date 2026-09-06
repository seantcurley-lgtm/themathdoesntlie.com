/* CCL 3.0.0 full-history reconciliation layer. Rebuilds active state and every call lifecycle from ledger-data.js. */
(function applyRelease300(){
  const derived=CCLReconciliation.derive({ledger:CCL_LEDGER_DATA,market:CCL_MARKET_SNAPSHOT,benchmarks:CCL_BENCHMARK_DATA,cutoff:CCL_BENCHMARK_DATA.commonEndDate,baselineDate:CCL_BENCHMARK_DATA.baselineDate});
  const categoryNames={stock_buy:'Buy Stock',stock_sale:'Sell Stock',assigned_stock_sale:'Assigned Stock Sale',call_open:'Sell Call',call_close:'Buy to Close',call_expiration:'Expired Call',call_assignment:'Assigned Option',dividend:'Dividend',interest:'Interest',deposit:'Deposit/Rollover'};
  DATA.release='3.0.0';DATA.asOf=derived.cutoff;DATA.ledgerThrough=derived.cutoff;DATA.ledgerSourceCoverageEnd='2026-09-08';DATA.commonBenchmarkDate=derived.cutoff;
  DATA.accounts=derived.accounts;DATA.combined=derived.combined;DATA.holdings=derived.holdings;DATA.options=derived.options;
  DATA.transactions=derived.tx.map(t=>({date:t.date,account:t.account,category:categoryNames[t.category]||t.category,ticker:t.ticker,action:t.action,amount:t.amount,cash:t.cash,pending:t.pending}));
  DATA.historyEpisodes=derived.historyEpisodes;DATA.history=derived.historyEpisodes;DATA.positionAnalysis=derived.positionAnalysis;
  DATA.callHistory=derived.callHierarchy.calls;DATA.callCampaigns=derived.callCampaigns;DATA.callAggregates={byTicker:derived.callHierarchy.byTicker,byAccount:derived.callHierarchy.byAccount,total:derived.callHierarchy.total};
  DATA.benchmarkSnapshots=derived.benchmarkSnapshots;DATA.benchmarkRegimes=CCL_BENCHMARK_DATA.regimes;DATA.benchmarkMethodology=CCL_BENCHMARK_DATA;
  DATA.optionMarkSource={provider:'Cboe delayed options',method:'Short calls marked at ask / observable buy-to-close cost',asOf:'2026-09-04 close'};DATA.optionMtmAvailable=derived.combined.optionMtmAvailable;
  const monthLabels={'2026-03':'March','2026-04':'April','2026-05':'May','2026-06':'June','2026-07':'July','2026-08':'August','2026-09':'September'};
  DATA.monthlyLedger=Object.entries(monthLabels).map(([key,label])=>{
    const tx=DATA.transactions.filter(t=>t.date.startsWith(key)),sum=cat=>tx.filter(t=>t.category===cat).reduce((s,t)=>s+(Number(t.amount)||0),0);
    const exits=DATA.positionAnalysis.filter(p=>p.status==='Closed'&&p.exitDate?.startsWith(key)),buys=tx.filter(t=>t.category==='Buy Stock'),assignmentTickers=exits.filter(p=>p.assignments).map(p=>p.ticker),intentionalTickers=exits.filter(p=>!p.assignments).map(p=>p.ticker),callOpenings=derived.callHierarchy.calls.filter(c=>c.openDate?.startsWith(key)).length;
    const premium=sum('Sell Call')+sum('Buy to Close'),dividends=sum('Dividend'),interest=sum('Interest'),realizedStockGL=exits.reduce((s,p)=>s+p.realizedEquity,0),contribution=premium+dividends+interest+realizedStockGL;
    const purchased=[...new Set(buys.map(t=>t.ticker).filter(Boolean))],facts=[`${callOpenings} call opening${callOpenings===1?'':'s'} produced ${premium.toLocaleString(undefined,{style:'currency',currency:'USD'})} of net option cash flow.`];
    if(assignmentTickers.length)facts.push(`Assignments effective this month: ${assignmentTickers.join(', ')}.`);
    if(intentionalTickers.length)facts.push(`Non-assignment exits: ${intentionalTickers.join(', ')}.`);
    if(purchased.length)facts.push(`Stock purchases: ${purchased.join(', ')} (${(-buys.reduce((s,t)=>s+Math.min(0,t.amount||0),0)).toLocaleString(undefined,{style:'currency',currency:'USD'})} deployed).`);
    if(key==='2026-07')facts.push('The SCHD assignment was in Portfolio B; the later Portfolio A SCHD purchase had no covered call by the September 4 cutoff.');
    return{key,label,premium,dividends,interest,realizedStockGL,realizedContribution:contribution,realizedContributionPct:contribution/DATA.combined.return_baseline*100,spyReturnPct:null,spyStart:null,spyEnd:null,assignments:assignmentTickers.length,intentionalExits:intentionalTickers.length,newPositions:purchased,capitalDeployed:-buys.reduce((s,t)=>s+Math.min(0,t.amount||0),0),transactions:tx,narrative:facts.join(' ')};
  });
  const currentByTicker=new Map(DATA.holdings.map(h=>[h.ticker,h]));
  DATA.universe=DATA.universe.map(u=>{const h=currentByTicker.get(u.ticker),ever=DATA.positionAnalysis.some(p=>p.ticker===u.ticker);return h?{...u,ownership:h.account,marketValue:h.value,bucket:h.bucket,sector:h.sector}:ever?{...u,ownership:'Archived',marketValue:0}:u});
  for(const h of DATA.holdings)if(!DATA.universe.some(u=>u.ticker===h.ticker))DATA.universe.push({ticker:h.ticker,name:h.name,sector:h.sector,bucket:h.bucket,reason:'Current ledger-authoritative CCL holding',ownership:h.account,marketValue:h.value});
  DATA.releaseCommentary='The 3.0.0 reconciliation rebuilds both accounts from 138 full-history Fidelity rows and preserves all 40 call openings as individual lifecycles. Calls aggregate by underlying, account, and total experiment; unsupported assignment counterfactuals remain explicitly unavailable. Eight open calls are marked at the September 4 Cboe ask, and every benchmark uses the same March 31 through September 4 period.';
  window.CCL_DERIVED_STATE=derived;
})();
