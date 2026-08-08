/* Math Doesn't Lie — Covered Call Lab 2.7 monthly snapshot
   Fidelity activity through 2026-08-06; market prices verified 2026-08-07.
   This layer intentionally patches the frozen 2.6 dataset so the original release remains auditable. */
(function applyRelease27(){
  const price={KO:87.05,PFE:26.76,WMT:111.85,VZ:47.06,SCHD:33.90,ABBV:246.04,DUK:124.85,KHC:25.32};
  const current=[
    {account:'Portfolio A',ticker:'KO',name:'Coca-Cola',sector:'Consumer Staples',bucket:'Core',shares:100,cost:7813.50,premiums:365.33,dividends:53},
    {account:'Portfolio A',ticker:'PFE',name:'Pfizer',sector:'Healthcare',bucket:'Review',shares:200,cost:5579.00,premiums:194.62,dividends:86},
    {account:'Portfolio A',ticker:'WMT',name:'Walmart',sector:'Consumer Staples',bucket:'Core',shares:100,cost:11185.50,premiums:316.34,dividends:0},
    {account:'Portfolio A',ticker:'VZ',name:'Verizon',sector:'Communication Services',bucket:'Tactical',shares:100,cost:4741.99,premiums:49.34,dividends:0},
    {account:'Portfolio A',ticker:'SCHD',name:'Schwab U.S. Dividend Equity ETF',sector:'Benchmark',bucket:'Benchmark',shares:100,cost:3356.00,premiums:0,dividends:0},
    {account:'Portfolio B',ticker:'ABBV',name:'AbbVie',sector:'Healthcare',bucket:'Core',shares:100,cost:26114.50,premiums:624.32,dividends:0},
    {account:'Portfolio B',ticker:'DUK',name:'Duke Energy',sector:'Utilities',bucket:'Core',shares:100,cost:12314.50,premiums:129.34,dividends:0},
    {account:'Portfolio B',ticker:'KHC',name:'Kraft Heinz',sector:'Consumer Staples',bucket:'Tactical',shares:200,cost:5261.49,premiums:78.67,dividends:0}
  ].map(h=>{let p=price[h.ticker],v=p*h.shares,g=v-h.cost;return{...h,price:p,value:v,stock_gl:g,stock_gl_pct:g/h.cost*100,option_gl:null,option_liability:null,fidelity_gap:(h.premiums||0)+(h.dividends||0),true_mtm:null,percent:0}});
  const totalsByAccount={
    'Portfolio A':{cash:4194.07,premiums:1921.25,dividends:348.90,interest:7.61,realized_sale_gains:933.77,transactions:57},
    'Portfolio B':{cash:1604.15,premiums:2593.30,dividends:268.10,interest:33.28,realized_sale_gains:1960.33,transactions:48}
  };
  DATA.asOf='2026-08-07';
  DATA.ledgerThrough='2026-08-06';
  DATA.release='2.7';
  DATA.optionMtmAvailable=false;
  DATA.holdings=current;
  DATA.options=[
    {account:'Portfolio A',ticker:'WMT',contract:'-WMT260828C114',description:'WMT AUG 28 2026 $114 CALL',qty:-1,last:null,liability:null,gl:null,gl_pct:null,cost:316.34,expiration:'AUG 28, 2026',strike:'114'},
    {account:'Portfolio A',ticker:'VZ',contract:'-VZ260828C50',description:'VZ AUG 28 2026 $50 CALL',qty:-1,last:null,liability:null,gl:null,gl_pct:null,cost:49.34,expiration:'AUG 28, 2026',strike:'50'},
    {account:'Portfolio A',ticker:'KO',contract:'-KO260828C91',description:'KO AUG 28 2026 $91 CALL',qty:-1,last:null,liability:null,gl:null,gl_pct:null,cost:64.34,expiration:'AUG 28, 2026',strike:'91'},
    {account:'Portfolio A',ticker:'PFE',contract:'-PFE260828C26.5',description:'PFE AUG 28 2026 $26.50 CALL',qty:-2,last:null,liability:null,gl:null,gl_pct:null,cost:30.67,expiration:'AUG 28, 2026',strike:'26.50'},
    {account:'Portfolio B',ticker:'ABBV',contract:'-ABBV260828C270',description:'ABBV AUG 28 2026 $270 CALL',qty:-1,last:null,liability:null,gl:null,gl_pct:null,cost:624.32,expiration:'AUG 28, 2026',strike:'270'},
    {account:'Portfolio B',ticker:'DUK',contract:'-DUK260821C125',description:'DUK AUG 21 2026 $125 CALL',qty:-1,last:null,liability:null,gl:null,gl_pct:null,cost:129.34,expiration:'AUG 21, 2026',strike:'125'},
    {account:'Portfolio B',ticker:'KHC',contract:'-KHC260828C28',description:'KHC AUG 28 2026 $28 CALL (2 contracts)',qty:-2,last:null,liability:null,gl:null,gl_pct:null,cost:78.67,expiration:'AUG 28, 2026',strike:'28'}
  ];
  DATA.accounts=DATA.accounts.map(a=>{
    let x=totalsByAccount[a.alias],hs=current.filter(h=>h.account===a.alias),stock=hs.reduce((s,h)=>s+h.value,0),gl=hs.reduce((s,h)=>s+h.stock_gl,0);
    return{...a,...x,stock_val:stock,stock_gl:gl,opt_val:0,opt_gl:0,total:stock+x.cash,purchases:a.alias==='Portfolio A'?54028.24:121478.49,sales:a.alias==='Portfolio A'?22286.02:79748.33};
  });
  const stock_val=current.reduce((s,h)=>s+h.value,0),stock_gl=current.reduce((s,h)=>s+h.stock_gl,0),cash=DATA.accounts.reduce((s,a)=>s+a.cash,0);
  DATA.combined={...DATA.combined,total:stock_val+cash,cash,stock_val,opt_val:0,stock_gl,opt_gl:0,premiums:4514.55,dividends:617.00,interest:40.89,purchases:175506.73,sales:102034.35,transactions:105,realized_sale_gains:2894.10,fees:0,optionMtmAvailable:false};
  DATA.combined.strategy_total_return=DATA.combined.stock_gl+DATA.combined.premiums+DATA.combined.dividends+DATA.combined.interest+DATA.combined.realized_sale_gains;
  DATA.combined.strategy_return_pct=DATA.combined.strategy_total_return/DATA.combined.return_baseline*100;

  const newer=[
    ['2026-08-04','Portfolio B','Sell Call','KHC','YOU SOLD OPENING TRANSACTION CALL (KHC) KRAFT HEINZ AUG 28 26 $28 (2 contracts)',78.67],
    ['2026-08-04','Portfolio B','Sell Call','DUK','YOU SOLD OPENING TRANSACTION CALL (DUK) DUKE ENERGY AUG 21 26 $125',129.34],
    ['2026-08-04','Portfolio B','Buy Stock','KHC','YOU BOUGHT KRAFT HEINZ CO COM — 100 shares',-2630.50],
    ['2026-08-04','Portfolio B','Buy Stock','KHC','YOU BOUGHT KRAFT HEINZ CO COM — 100 shares',-2630.99],
    ['2026-08-04','Portfolio B','Buy Stock','DUK','YOU BOUGHT DUKE ENERGY CORP — 100 shares',-12314.50],
    ['2026-08-04','Portfolio A','Sell Call','PFE','YOU SOLD OPENING TRANSACTION CALL (PFE) AUG 28 26 $26.5 (2 contracts)',30.67],
    ['2026-08-03','Portfolio B','Assigned Option','CVX','ASSIGNED CALL (CVX) JUL 31 26 $175',0],
    ['2026-08-03','Portfolio B','Assigned Stock Sale','CVX','YOU SOLD ASSIGNED CHEVRON — 100 shares @ $175',17499.63],
    ['2026-08-03','Portfolio A','Dividend','T','DIVIDEND RECEIVED AT&T',27.75],
    ['2026-08-03','Portfolio A','Assigned Option','F','ASSIGNED CALL (F) JUL 31 26 $14.5 (2 contracts)',0],
    ['2026-08-03','Portfolio A','Sell Call','KO','YOU SOLD OPENING TRANSACTION CALL (KO) AUG 28 26 $91',64.34],
    ['2026-08-03','Portfolio A','Assigned Stock Sale','F','YOU SOLD ASSIGNED FORD — 200 shares @ $14.50',2899.94],
    ['2026-07-31','Portfolio B','Interest','QBYIQ','INTEREST EARNED FDIC INSURED DEPOSIT',7.95],
    ['2026-07-31','Portfolio A','Interest','QBYIQ','INTEREST EARNED FDIC INSURED DEPOSIT',3.34],
    ['2026-07-27','Portfolio A','Assigned Option','KMB','ASSIGNED CALL (KMB) JUL 24 26 $107',0],
    ['2026-07-27','Portfolio A','Buy Stock','WMT','YOU BOUGHT WALMART — 100 shares',-11185.50],
    ['2026-07-27','Portfolio A','Buy Stock','VZ','YOU BOUGHT VERIZON — 100 shares',-4741.99],
    ['2026-07-27','Portfolio A','Sell Call','WMT','YOU SOLD OPENING TRANSACTION CALL (WMT) AUG 28 26 $114',316.34],
    ['2026-07-27','Portfolio A','Sell Call','VZ','YOU SOLD OPENING TRANSACTION CALL (VZ) AUG 28 26 $50',49.34],
    ['2026-07-27','Portfolio A','Buy Stock','SCHD','YOU BOUGHT SCHWAB U.S. DIVIDEND EQUITY ETF — 100 shares',-3356.00],
    ['2026-07-27','Portfolio A','Assigned Stock Sale','KMB','YOU SOLD ASSIGNED KIMBERLY-CLARK — 100 shares @ $107',10699.77],
    ['2026-07-27','Portfolio A','Sell Stock','T','YOU SOLD AT&T — 100 shares',2436.44],
    ['2026-07-27','Portfolio B','Assigned Option','SCHD','ASSIGNED CALL (SCHD) JUL 24 26 $32.5',0],
    ['2026-07-27','Portfolio B','Assigned Option','ABT','ASSIGNED CALL (ABT) JUL 24 26 $95',0],
    ['2026-07-27','Portfolio B','Sell Call','ABBV','YOU SOLD OPENING TRANSACTION CALL (ABBV) AUG 28 26 $270',624.32],
    ['2026-07-27','Portfolio B','Assigned Stock Sale','SCHD','YOU SOLD ASSIGNED SCHD — 100 shares @ $32.50',3249.93],
    ['2026-07-27','Portfolio B','Buy Stock','ABBV','YOU BOUGHT ABBVIE — 100 shares',-26114.50],
    ['2026-07-27','Portfolio B','Assigned Stock Sale','ABT','YOU SOLD ASSIGNED ABBOTT — 100 shares @ $95',9499.80],
    ['2026-07-20','Portfolio B','Assigned Option','TROW','ASSIGNED CALL (TROW) JUL 17 26 $115',0],
    ['2026-07-20','Portfolio B','Assigned Stock Sale','TROW','YOU SOLD ASSIGNED T. ROWE PRICE — 100 shares @ $115',11499.76],
    ['2026-07-20','Portfolio A','Assigned Option','O','ASSIGNED CALL (O) JUL 17 26 $62.5',0],
    ['2026-07-20','Portfolio A','Expired Call','PFE','EXPIRED CALL (PFE) JUL 17 26 $27',0],
    ['2026-07-20','Portfolio A','Expired Call','KO','EXPIRED CALL (KO) JUL 17 26 $82.5',0],
    ['2026-07-20','Portfolio A','Expired Call','T','EXPIRED CALL (T) JUL 17 26 $25',0],
    ['2026-07-20','Portfolio A','Assigned Stock Sale','O','YOU SOLD ASSIGNED REALTY INCOME — 100 shares @ $62.50',6249.87],
    ['2026-07-15','Portfolio A','Dividend','O','DIVIDEND RECEIVED REALTY INCOME',27.10],
    ['2026-07-02','Portfolio A','Dividend','KMB','DIVIDEND RECEIVED KIMBERLY-CLARK',128.00],
    ['2026-07-01','Portfolio A','Dividend','KO','DIVIDEND RECEIVED COCA-COLA',53.00],
    ['2026-06-30','Portfolio A','Interest','QBYIQ','INTEREST EARNED FDIC INSURED DEPOSIT',4.27],
    ['2026-06-30','Portfolio B','Interest','QBYIQ','INTEREST EARNED FDIC INSURED DEPOSIT',2.24]
  ].map(x=>({date:x[0],account:x[1],category:x[2],ticker:x[3],action:x[4],amount:x[5],cash:null}));
  // New export also supplied two previously omitted Portfolio A dividends from June.
  const recovered=[
    {date:'2026-06-15',account:'Portfolio A',category:'Dividend',ticker:'O',action:'DIVIDEND RECEIVED REALTY INCOME',amount:27.05,cash:null},
    {date:'2026-06-12',account:'Portfolio A',category:'Dividend',ticker:'PFE',action:'DIVIDEND RECEIVED PFIZER',amount:86.00,cash:null}
  ];
  DATA.transactions=[...newer,...DATA.transactions,...recovered].sort((a,b)=>b.date.localeCompare(a.date));

  function h(t){return DATA.history.find(x=>x.ticker===t)}
  const soldUpdates={
    F:{ownedValue:0,stockGL:0,realizedSaleGains:80.18,totalContribution:188.83,assignments:1,saleAmount:2899.94,lastDate:'2026-08-03'},
    KMB:{ownedValue:0,stockGL:0,dividends:128,realizedSaleGains:1128.27,totalContribution:1794.26,assignments:1,saleAmount:10699.77,lastDate:'2026-07-27'},
    O:{ownedValue:0,stockGL:0,dividends:54.15,realizedSaleGains:120.87,totalContribution:426.01,assignments:1,saleAmount:6249.87,lastDate:'2026-07-20'},
    T:{ownedValue:0,stockGL:0,dividends:27.75,realizedSaleGains:-395.55,totalContribution:-269.81,saleAmount:2436.44,lastDate:'2026-08-03'},
    ABT:{ownedValue:0,stockGL:0,realizedSaleGains:116.80,totalContribution:396.13,assignments:1,saleAmount:9499.80,lastDate:'2026-07-27'},
    CVX:{ownedValue:0,stockGL:0,realizedSaleGains:584.63,totalContribution:903.96,assignments:1,saleAmount:17499.63,lastDate:'2026-08-03'},
    TROW:{ownedValue:0,stockGL:0,realizedSaleGains:264.76,totalContribution:371.09,assignments:1,saleAmount:11499.76,lastDate:'2026-07-20'}
  };
  Object.entries(soldUpdates).forEach(([t,u])=>{if(h(t))Object.assign(h(t),u)});
  if(h('SCHD')) Object.assign(h('SCHD'),{ownedValue:0,stockGL:0,realizedSaleGains:57.93,totalContribution:125.84,assignments:1,saleAmount:3249.93,lastDate:'2026-07-27'});
  if(h('KO')) Object.assign(h('KO'),{ownedValue:8705,stockGL:891.50,premiums:365.33,dividends:53,totalContribution:1309.83,callsSold:4,callsExpired:3,lastDate:'2026-08-03'});
  if(h('PFE')) Object.assign(h('PFE'),{ownedValue:5352,stockGL:-227,premiums:194.62,dividends:86,totalContribution:53.62,callsSold:4,callsExpired:3,lastDate:'2026-08-04'});
  [
    {ticker:'WMT',sector:'Consumer Staples',bucket:'Core',ownedValue:11185,stockGL:-.50,premiums:316.34,dividends:0,interest:0,realizedSaleGains:0,totalContribution:315.84,callsSold:1,callsExpired:0,assignments:0,buyAmount:11185.50,saleAmount:0,firstDate:'2026-07-27',lastDate:'2026-07-27',monthlyPremiums:[{month:'2026-07',premium:316.34}]},
    {ticker:'VZ',sector:'Communication Services',bucket:'Tactical',ownedValue:4706,stockGL:-35.99,premiums:49.34,dividends:0,interest:0,realizedSaleGains:0,totalContribution:13.35,callsSold:1,callsExpired:0,assignments:0,buyAmount:4741.99,saleAmount:0,firstDate:'2026-07-27',lastDate:'2026-07-27',monthlyPremiums:[{month:'2026-07',premium:49.34}]},
    {ticker:'SCHD-SEAN',sector:'Benchmark',bucket:'Benchmark',ownedValue:3390,stockGL:34,premiums:0,dividends:0,interest:0,realizedSaleGains:0,totalContribution:34,callsSold:0,callsExpired:0,assignments:0,buyAmount:3356,saleAmount:0,firstDate:'2026-07-27',lastDate:'2026-07-27',monthlyPremiums:[]},
    {ticker:'ABBV',sector:'Healthcare',bucket:'Core',ownedValue:24604,stockGL:-1510.50,premiums:624.32,dividends:0,interest:0,realizedSaleGains:0,totalContribution:-886.18,callsSold:1,callsExpired:0,assignments:0,buyAmount:26114.50,saleAmount:0,firstDate:'2026-07-27',lastDate:'2026-07-27',monthlyPremiums:[{month:'2026-07',premium:624.32}]},
    {ticker:'DUK',sector:'Utilities',bucket:'Core',ownedValue:12485,stockGL:170.50,premiums:129.34,dividends:0,interest:0,realizedSaleGains:0,totalContribution:299.84,callsSold:1,callsExpired:0,assignments:0,buyAmount:12314.50,saleAmount:0,firstDate:'2026-08-04',lastDate:'2026-08-04',monthlyPremiums:[{month:'2026-08',premium:129.34}]},
    {ticker:'KHC',sector:'Consumer Staples',bucket:'Tactical',ownedValue:5064,stockGL:-197.49,premiums:78.67,dividends:0,interest:0,realizedSaleGains:0,totalContribution:-118.82,callsSold:2,callsExpired:0,assignments:0,buyAmount:5261.49,saleAmount:0,firstDate:'2026-08-04',lastDate:'2026-08-04',monthlyPremiums:[{month:'2026-08',premium:78.67}]}
  ].forEach(x=>DATA.history.push(x));

  const bench={SPY:{p:773.26,d:1.903516},QQQ:{p:723.03,d:.813496},DIA:{p:539.62,d:2.0359},SCHD:{p:33.90,d:.2525},SPYI:{p:54.18,d:2.1210}};
  DATA.benchmarkSnapshots.forEach(b=>{let z=bench[b.ticker];if(!z)return;let shares=b.baselineInvestment/b.inceptionPrice;b.currentPrice=z.p;b.price=z.p;b.distributionPerShare=z.d;b.shares=shares;b.priceReturnDollars=(z.p-b.inceptionPrice)*shares;b.incomeGenerated=z.d*shares;b.totalReturnDollars=b.priceReturnDollars+b.incomeGenerated;b.priceReturnPct=b.priceReturnDollars/b.baselineInvestment*100;b.incomeYieldPct=b.incomeGenerated/b.baselineInvestment*100;b.totalReturnPct=b.totalReturnDollars/b.baselineInvestment*100;b.endingValue=b.baselineInvestment+b.totalReturnDollars;b.relativeVsStrategyPct=b.totalReturnPct-DATA.combined.strategy_return_pct;b.relativeVsStrategyDollars=b.totalReturnDollars-DATA.combined.strategy_total_return});
  DATA.marketPulse=DATA.marketPulse.map(m=>bench[m.ticker]?{...m,currentPrice:bench[m.ticker].p,changePct:(bench[m.ticker].p-m.inceptionPrice)/m.inceptionPrice*100}:m);

  const updates={KO:['Portfolio A',8705],PFE:['Portfolio A',5352],WMT:['Portfolio A',11185],DUK:['Portfolio B',12485],SCHD:['Portfolio A',3390]};
  DATA.universe=DATA.universe.map(u=>updates[u.ticker]?{...u,ownership:updates[u.ticker][0],marketValue:updates[u.ticker][1]}:{...u,ownership:['F','KMB','O','T','ABT','CVX','TROW'].includes(u.ticker)?'Archived':u.ownership,marketValue:['F','KMB','O','T','ABT','CVX','TROW'].includes(u.ticker)?0:u.marketValue});
  [
    {ticker:'VZ',name:'Verizon',sector:'Communication Services',bucket:'Tactical',reason:'Defensive telecom income and covered-call candidate',ownership:'Portfolio A',marketValue:4706},
    {ticker:'ABBV',name:'AbbVie',sector:'Healthcare',bucket:'Core',reason:'Large-cap healthcare income and quality franchise',ownership:'Portfolio B',marketValue:24604},
    {ticker:'KHC',name:'Kraft Heinz',sector:'Consumer Staples',bucket:'Tactical',reason:'Tactical low-volatility income position',ownership:'Portfolio B',marketValue:5064}
  ].forEach(x=>{if(!DATA.universe.some(u=>u.ticker===x.ticker))DATA.universe.push(x)});
  DATA.releaseCommentary='The July/August rotation materially changed the experiment: eight positions exited and six entered while KO and PFE remained. Premium income reached $4,514.55 since inception. ABBV is the largest current drag; KO is the strongest current unrealized contributor. The ledger also recovered Portfolio A dividends and interest missing from the prior snapshot. Market prices are as of Aug. 7; open-option mark-to-market values are not included because Fidelity activity history does not contain current option marks.';
})();
