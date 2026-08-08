/* Math Doesn't Lie — Covered Call Lab 2.7.1 reconciliation layer.
   Ledger positions/cash are sourced from Fidelity activity; equity closes are 2026-08-07.
   Open short calls are marked at the 2026-08-07 Cboe ask (observable buy-to-close cost). */
(function applyRelease271(){
  DATA.release='2.7.1';
  DATA.optionMtmAvailable=true;

  const optionMarks={
    WMT:{opra:'WMT260828C00114000',bid:2.62,ask:2.73,theo:2.6608,stamp:'2026-08-07 21:29:48'},
    VZ:{opra:'VZ260828C00050000',bid:.17,ask:.32,theo:.1925,stamp:'2026-08-07 19:11:21'},
    KO:{opra:'KO260828C00091000',bid:.31,ask:.38,theo:.346,stamp:'2026-08-07 21:12:27'},
    PFE:{opra:'PFE260828C00026500',bid:.63,ask:.69,theo:.6541,stamp:'2026-08-08 11:25:39'},
    ABBV:{opra:'ABBV260828C00270000',bid:.34,ask:.45,theo:.4323,stamp:'2026-08-08 01:30:26'},
    DUK:{opra:'DUK260821C00125000',bid:1.15,ask:1.40,theo:1.3253,stamp:'2026-08-07 19:04:30'},
    KHC:{opra:'KHC260828C00028000',bid:.04,ask:.26,theo:.0935,stamp:'2026-08-07 23:31:08'}
  };
  DATA.optionMarkSource={provider:'Cboe delayed options',method:'Short calls marked at ask / buy-to-close cost',asOf:'2026-08-07 close'};
  DATA.options=DATA.options.map(o=>{
    const m=optionMarks[o.ticker]; if(!m)return o;
    const liability=-(Math.abs(o.qty)*100*m.ask),gl=(o.cost||0)+liability;
    return{...o,last:m.ask,liability,gl,gl_pct:o.cost?gl/o.cost*100:null,marketBid:m.bid,marketAsk:m.ask,theoretical:m.theo,marketTimestamp:m.stamp,opra:m.opra};
  });
  const optionValue=DATA.options.reduce((s,o)=>s+(o.liability||0),0);
  DATA.holdings=DATA.holdings.map(h=>{
    const o=DATA.options.find(x=>x.ticker===h.ticker),trueMtm=(h.stock_gl||0)+(h.premiums||0)+(h.dividends||0)+(o?.liability||0);
    return{...h,option_gl:o?.gl??null,option_liability:o?.liability??0,true_mtm:trueMtm};
  });
  DATA.accounts=DATA.accounts.map(a=>{
    const opt=DATA.options.filter(o=>o.account===a.alias).reduce((s,o)=>s+(o.liability||0),0);
    const optGl=DATA.options.filter(o=>o.account===a.alias).reduce((s,o)=>s+(o.gl||0),0);
    return{...a,opt_val:opt,opt_gl:optGl,total:a.stock_val+a.cash+opt};
  });
  DATA.combined.opt_val=optionValue;
  DATA.combined.opt_gl=DATA.options.reduce((s,o)=>s+(o.gl||0),0);
  DATA.combined.total=DATA.combined.stock_val+DATA.combined.cash+optionValue;
  DATA.combined.optionMtmAvailable=true;

  const exits={
    JNJ:{date:'2026-06-26',label:'Called Away @ $235'},
    PG:{date:'2026-06-26',label:'Called Away @ $145'},
    TROW:{date:'2026-07-17',label:'Called Away @ $115'},
    O:{date:'2026-07-17',label:'Called Away @ $62.50'},
    KMB:{date:'2026-07-24',label:'Called Away @ $107'},
    ABT:{date:'2026-07-24',label:'Called Away @ $95'},
    SCHD:{date:'2026-07-24',label:'Called Away @ $32.50'},
    F:{date:'2026-07-31',label:'Called Away @ $14.50'},
    CVX:{date:'2026-07-31',label:'Called Away @ $175'},
    T:{date:'2026-07-27',label:'Sold — Strategy Exit / Underperformance'}
  };
  const currentIds=new Set(['KO','PFE','WMT','VZ','SCHD-SEAN','ABBV','DUK','KHC']);
  DATA.historyEpisodes=DATA.history.map((h,i)=>{
    const current=currentIds.has(h.ticker),x=exits[h.ticker],displayTicker=h.ticker==='SCHD-SEAN'?'SCHD':h.ticker;
    return{...h,episodeId:`${h.ticker}-${i}`,displayTicker,current,heldFrom:h.firstDate,heldTo:current?null:(x?.date||h.lastDate),exitDisposition:current?'Current':(x?.label||'Exited')};
  });

  const narratives={
    '2026-04':'The experiment moved from the initial March positions into a broader covered-call operating rhythm. KO and T joined the portfolio while the focus remained on establishing repeatable call-writing and measurement.',
    '2026-05':'Call-writing broadened across the portfolio and SCHD entered as a dividend-oriented position. The month continued to emphasize premium collection while the experiment accumulated enough history to compare position quality.',
    '2026-06':'The portfolio expanded and rotated: JNJ and PG were called away on June 26, then proceeds were redeployed into ABT, CVX, TROW and F. The ledger also records SCHD and PFE dividends and continued premium generation.',
    '2026-07':'Assignments accelerated: O, TROW, KMB, ABT and the Portfolio B SCHD position were called away, with F and CVX assigned at July 31 expiration and posting in early August. That concentration of assignments changed the strategy: accept less premium, use higher strikes, and raise the probability of retaining high-quality assets. T was intentionally sold for underperformance and capital was redirected toward VZ. SCHD did not offer meaningful call premium at a comfortable strike, so no call was forced.',
    '2026-08':'July assignment proceeds were redeployed into ABBV, WMT, VZ, SCHD, DUK and KHC. New calls generally emphasize asset retention rather than maximum premium. PFE remains under review; SCHD remains held without forcing an unattractive call.'
  };
  const monthLabels={'2026-04':'April','2026-05':'May','2026-06':'June','2026-07':'July','2026-08':'August'};
  const spyClose={'2026-03':650.34,'2026-04':718.66,'2026-05':756.48,'2026-06':746.77,'2026-07':747.03,'2026-08':773.26};
  DATA.monthlyLedger=Object.keys(monthLabels).map(key=>{
    const tx=DATA.transactions.filter(t=>t.date?.startsWith(key));
    const sum=cat=>tx.filter(t=>t.category===cat).reduce((s,t)=>s+(t.amount||0),0);
    const realized=DATA.historyEpisodes.filter(h=>!h.current&&h.heldTo?.startsWith(key)).reduce((s,h)=>s+(h.realizedSaleGains||0),0);
    const assignments=DATA.historyEpisodes.filter(h=>!h.current&&h.heldTo?.startsWith(key)&&h.exitDisposition.startsWith('Called Away')).length;
    const exitsCount=DATA.historyEpisodes.filter(h=>!h.current&&h.heldTo?.startsWith(key)&&h.exitDisposition.startsWith('Sold')).length;
    const buys=tx.filter(t=>t.category==='Buy Stock'),deployed=-buys.reduce((s,t)=>s+Math.min(0,t.amount||0),0);
    const contribution=sum('Sell Call')+sum('Dividend')+sum('Interest')+realized;
    const month=Number(key.slice(5)),prev=`2026-${String(month-1).padStart(2,'0')}`,spyReturnPct=(spyClose[key]/spyClose[prev]-1)*100;
    return{key,label:monthLabels[key],premium:sum('Sell Call'),dividends:sum('Dividend'),interest:sum('Interest'),realizedStockGL:realized,realizedContribution:contribution,realizedContributionPct:contribution/DATA.combined.return_baseline*100,spyReturnPct,spyStart:spyClose[prev],spyEnd:spyClose[key],assignments,intentionalExits:exitsCount,newPositions:[...new Set(buys.map(t=>t.ticker).filter(Boolean))],capitalDeployed:deployed,transactions:tx,narrative:narratives[key]};
  });
  DATA.releaseCommentary='July was the strategic inflection point: repeated assignments demonstrated the cost of optimizing too aggressively for premium. The August redeployment therefore uses higher strikes and accepts less option income when that improves the odds of retaining quality assets. T was deliberately exited for underperformance and VZ added; SCHD is being held without forcing an unattractive call. The 2.7.1 portfolio value now includes the buy-to-close liability of every open short call.';
})();
