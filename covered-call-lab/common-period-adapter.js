/* Extend the production comparison in place. Original renderer, stylesheet and archive stay intact. */
(function(){
 'use strict';
 const input=window.CCL_COMMON_PERIOD_DATA,model=window.CCL_COMMON_PERIOD;
 if(!input||!model)throw Error('Common-period comparison inputs are missing');
 const old={benchmarkRows:benchmarkRowsV300,benchmarksPage:benchmarksPageV300,modeUI,banner,metric,enhance:enhanceRenderedPage};
 const esc=s=>safeText(String(s??'')),money=n=>n==null?'Unverified':fmt2(n);
 const baselineRows=DATA.benchmarkSnapshots.map(r=>({...r}));
 const c=input.valuationSnapshot.combined,bridge=input.cashBridge;
 const isCurrent=()=>window.CCLComparisonPeriod!=='historical';
 const metadata=new Map(baselineRows.map(r=>[r.ticker,r]));
 const strategy={ticker:'STRATEGY',name:'Covered Call Lab',proxy:'Full experiment · recorded source-day estimate',category:'Cash Flow',purpose:'Active covered-call portfolio; before unreported WMT fees',baselineInvestment:input.totalContributedCapital,
  priceReturnDollars:Math.round((c.stock_gl+c.realized_sale_gains)*100)/100,
  incomeGenerated:input.earnedPeriodIncome,paidIncome:bridge.periodCashIncome,cashBalance:c.cash,receivables:input.receivables.knownEligibleUnpaidReceivables,
  optionMtm:c.opt_val,totalReturnDollars:c.strategy_total_return,totalReturnPct:c.strategy_return_pct,endingValue:c.total,
  qualified:input.receivables.completenessVerified,estimate:true,limitations:input.limitations,period:{startDate:input.startDate,endDate:input.endDate}};
 const currentRows=[strategy,...input.benchmarkInputs.map(b=>{
  const meta=metadata.get(b.ticker)||{};
  return {...model.buildBenchmarkRow({...b,name:meta.name||b.ticker,category:meta.category,startDate:input.startDate,endDate:input.endDate,contributions:input.contributions}),proxy:meta.proxy||b.ticker,purpose:meta.purpose,amountsExact:b.amountsExact};
 })];
 const blend=model.buildBlendedRow(currentRows.filter(r=>['SPY','BND'].includes(r.ticker)),{SPY:.6,BND:.4});
 currentRows.push({...blend,ticker:'60/40',name:'60/40 Portfolio',proxy:'60% SPY / 40% BND',category:'Traditional Retirement',purpose:'Contribution-matched allocation; no rebalancing'});
 benchmarkRowsV300=function(){return DATA.fosCommonPeriod?currentRows.map(r=>({...r})):old.benchmarkRows();};
 metric=function(label,value,kind=''){return old.metric(label,DATA.fosCommonPeriod&&label==='Cash'?money(c.cash):DATA.fosCommonPeriod&&label==='Portfolio Value'?money(c.total):value,kind);};
 banner=function(){
  if(page==='benchmarks')return isCurrent()?'<div class="liveHint"><b>November 3 common-date review:</b> the full March experiment, later activity, and all three capital contributions are included. Prices share a source day; option asks are dated reference estimates.</div>':'<div class="liveHint"><b>Historical September 4 comparison:</b> original v3.0.0 values and original capital convention preserved. This archive does not include later activity.</div>';
  if(DATA.fosCommonPeriod)return'<div class="liveHint"><b>November 3 source-day estimate:</b> this dashboard uses the same strategy row and cash balance as the current Benchmark Comparison. Live refresh is available separately.</div>';
  return old.banner();
 };
 function cashTable(){
  return '<section class="card"><div class="label">Cash balance and income · different measures</div><p class="small">Cash balance is what remains after funding, income, purchases and sales. Received income is a period flow. Earned distributions awaiting payment are receivables and do not increase cash.</p><table><thead><tr><th>Portfolio</th><th class="num">Cash remaining · Nov 3</th><th class="num">Income received · period</th><th class="num">Earned, unpaid · Nov 3</th></tr></thead><tbody>'+currentRows.map(r=>'<tr><td class="ticker">'+esc(r.name)+(r.amountsExact===false?' ≈':'')+'</td><td class="num">'+money(r.cashBalance)+'</td><td class="num">'+money(r.paidIncome)+'</td><td class="num">'+money(r.receivables)+(r.ticker==='STRATEGY'&&!input.receivables.completenessVerified?' known; coverage open':'')+'</td></tr>').join('')+'</tbody></table><p class="small">CCL cash '+money(c.cash)+' matches the November 3 dashboard. CCL received income '+money(bridge.periodCashIncome)+' includes only period interest '+money(bridge.periodInterest)+'. Historical rolling income '+money(bridge.legacyRollingIncome)+' retains $0.04 earned before the experiment; that carry is already in opening capital. ETF amounts are rounded after aggregation; displayed components can differ by one cent.</p></section>';
 }
 function fundingTable(){return'<section class="card"><div class="label">Matched capital contributions</div><table><thead><tr><th>Date</th><th class="num">Capital added</th><th>Treatment</th></tr></thead><tbody>'+input.contributions.map(f=>'<tr><td>'+esc(f.date)+'</td><td class="num">'+money(f.amount)+'</td><td>'+esc(f.kind)+' · '+esc(f.timing)+'</td></tr>').join('')+'</tbody></table><p class="small">Each ETF buys fractional shares at that day’s close. No distributions are reinvested. GOOGL’s '+money(19428.30)+' entry value is additional opportunity capital for every comparison; it is not income or a cash deposit. Percentages use profit / '+money(input.totalContributedCapital)+' total contributed capital, not a time-weighted return.</p></section>';}
 function cashBridge(){return'<section class="card"><div class="label">Recorded cash roll-forward · September 4 to November 3</div><table><thead><tr><th>Recorded movement</th><th class="num">Amount</th></tr></thead><tbody><tr><td>September 4 remaining balance</td><td class="num">'+money(bridge.historicalCashBalance)+'</td></tr>'+Object.entries(bridge.postSeptemberCategories).filter(([,v])=>v!==0).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td class="num">'+money(v)+'</td></tr>').join('')+'<tr><td><b>November 3 remaining balance · before WMT fees</b></td><td class="num"><b>'+money(bridge.currentCashBalance)+'</b></td></tr></tbody></table><p class="small">'+bridge.postSeptemberRowCount+' later ledger rows are included once. November 3: MDT call +$55.34, WFC stock −$8,547.99, WFC call +$94.34; net −$8,398.31. The noncash GOOGL allocation adds no cash.</p></section>';}
 function receivableTable(){return'<section class="card"><div class="label">Strategy dividend receivables · November 3</div><table><thead><tr><th>Holding</th><th>Entitlement</th><th>Payment</th><th class="num">Earned, unpaid</th></tr></thead><tbody>'+input.receivables.events.map(e=>'<tr><td>'+esc(e.ticker)+'</td><td>'+esc(e.shares)+' shares · '+esc(e.exDate?'ex '+e.exDate:'record '+e.recordDate)+'</td><td>'+esc(e.paymentDate)+'</td><td class="num">'+money(e.amount)+'</td></tr>').join('')+'</tbody></table><p class="small">Entitlements survive a later stock sale. These amounts are included in earned income and ending value once, while received dividends and cash remain unchanged. '+(input.receivables.completenessVerified?'The audited experiment dividend window is covered.':'Known receivables are shown; coverage of the full experiment is still being qualified.')+'</p></section>';}
 function sourcesTable(){return'<section class="card"><div class="label">Current comparison sources and qualification</div><ul>'+input.limitations.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul><p class="small">Raw closes use the original price provider. Issuer distribution records provide ex-dates, payment dates and published amounts. ≈ marks source-rounded October distribution amounts for XYLD and QYLD. Historical market-regime tables below retain their original periods.</p><table><thead><tr><th>ETF</th><th>Distribution records</th><th>Amount precision</th></tr></thead><tbody>'+input.benchmarkInputs.map(b=>'<tr><td class="ticker">'+esc(b.ticker)+'</td><td><a href="'+esc(b.distributionSource?.sourceUrl||b.distributionSource?.url||'#')+'" target="_blank" rel="noopener noreferrer">Issuer evidence</a></td><td>'+esc(b.amountsExact?'Published issuer precision':'October source-rounded; estimate')+'</td></tr>').join('')+'</tbody></table></section>';}
 benchmarksPageV300=function(){
  if(!isCurrent())return old.benchmarksPage();
  // Reuse the production page and its tables; replace only the changed method text and add audit detail.
  let html=old.benchmarksPage();
  html=html.replace(/Every comparison starts with [\s\S]*?without reinvestment\.<\/p>/,'Every comparison receives the same dated contributions: '+money(input.contributions[0].amount)+' at the March 31 close, '+money(input.contributions[1].amount)+' at the April 10 close, and '+money(input.contributions[2].amount)+' at the October 28 close. Distributions are not reinvested. Return % = profit / total contributed capital.</p>');
  html=html.replaceAll('<th class="num">Cash income</th>','<th class="num">Income earned</th>');
  for(const r of currentRows.filter(r=>r.amountsExact===false))html=html.replace(esc(r.name)+'<span',esc(r.name)+' ≈<span');
  const where=html.indexOf('<section class="card"><div class="label">Retained contextual benchmarks');
  const detail=cashTable()+receivableTable()+cashBridge()+fundingTable()+sourcesTable();
  return where>=0?html.slice(0,where)+detail+html.slice(where):html+detail;
 };
 modeUI=function(){
  if(page==='benchmarks'){
   document.getElementById('modeToggle').innerHTML='<span class="quoteStatus stableStatus">'+(isCurrent()?'March 31 – November 3 · review estimate':'March 31 – September 4 · original archive')+'</span><button class="'+(isCurrent()?'active':'')+'" onclick="window.CCLComparisonPeriod=\'current\';render()">Nov 3 comparison</button><button class="'+(!isCurrent()?'active':'')+'" onclick="window.CCLComparisonPeriod=\'historical\';render()">Sep 4 archive</button>';
   return;
  }
  old.modeUI();
  const restartStatus=document.getElementById('modeToggle').querySelector('.quoteStatus');
  if(restartStatus){restartStatus.textContent=restartStatus.textContent.replaceAll('Run Start-CCL-Candidate.ps1','Run Start-CCL-rc6.ps1');restartStatus.title=(restartStatus.title||'').replaceAll('Run Start-CCL-Candidate.ps1','Run Start-CCL-rc6.ps1');}
  if(page==='dashboard'){
   const el=document.getElementById('modeToggle');el.insertAdjacentHTML('beforeend','<button class="'+(mode==='common'?'active':'')+'" onclick="mode=\'common\';render()">Nov 3 comparison</button>');
   if(mode==='common'){const status=el.querySelector('.quoteStatus');if(status)status.textContent='November 3 · same-date recorded estimate';}
  }
 };
 enhanceRenderedPage=function(){
  old.enhance();
  if(page==='dashboard'&&DATA.fosUpdate&&!DATA.fosSnapshot){const view=document.getElementById('view'),stack=view.querySelector('.stack')||view;stack.insertAdjacentHTML('beforeend','<section class="note"><b>Comparison dates:</b> Live retains the existing refreshed-share estimate with November 2 option references and received-cash accounting. The Nov 3 comparison uses November 3 source-day references and includes the earned $173 ABBV dividend receivable. Both use recorded cash '+money(c.cash)+'. Use Nov 3 comparison to reconcile the dashboard with the current benchmark row.</section>');}
  if(!DATA.fosCommonPeriod||page!=='dashboard')return;
  const view=document.getElementById('view'),stack=view.querySelector('.stack')||view;
  const valueCard=[...view.querySelectorAll('.hero')].find(el=>el.querySelector('.value'));
  if(valueCard){valueCard.querySelector('.label').textContent='Strategy result · November 3 source-day estimate';const small=valueCard.querySelector('.small');if(small)small.textContent='Same strategy value as Benchmark Comparison. Profit / contributed capital; before unreported WMT fees.';}
  for(const label of view.querySelectorAll('.label')){
   if(label.textContent==='Portfolio Value')label.textContent='Nov 3 value · includes known receivables';
   if(label.textContent==='Cash')label.textContent='Recorded cash · Nov 3 · before WMT fees';
   if(label.textContent.startsWith('Market Pulse'))label.innerHTML='Market Pulse · March 31 – November 3';
   if(label.textContent==='Current Portfolio Sector Allocation')label.textContent='Nov 3 experiment allocation · includes SCHD reserve';
  }
  const work=[...view.querySelectorAll('table')].find(t=>t.textContent.includes('Unrealized equity G/L'));
  if(work){const final=[...work.querySelectorAll('tr')].find(r=>r.textContent.includes('Strategy Total Return'));if(final)final.insertAdjacentHTML('beforebegin','<tr><td>Earned dividend receivables · unpaid Nov 3</td><td class="num">'+money(input.receivables.knownEligibleUnpaidReceivables)+'</td></tr>');}
  stack.insertAdjacentHTML('beforeend','<section class="note"><b>November 3 value:</b> '+money(c.stock_val)+' shares + '+money(c.cash)+' recorded cash '+(c.opt_val<0?'− ':'+ ')+money(Math.abs(c.opt_val))+' source-day ask references + '+money(input.receivables.knownEligibleUnpaidReceivables)+' known unpaid dividends = '+money(c.total)+'. Recorded value before receivables: '+money(input.recordedNAVBeforeReceivables)+'. Cash matches the current benchmark detail. '+esc(input.limitations[0])+'</section>'+receivableTable()+cashBridge());
 };
 window.CCLCommonPeriodView={rows:()=>currentRows.map(r=>({...r})),input};
 const search=new URLSearchParams(location.search);if(search.get('view')==='comparison'){page='benchmarks';mode='common';window.CCLComparisonPeriod='current';}else if(search.get('view')==='nov3'||!search.get('view')){page='dashboard';mode='common';}
 render();
})();
