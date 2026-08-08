/* Covered Call Lab 2.7.3 — GitHub Pages shared market-data client.
   Finnhub credentials never enter the browser. GitHub Actions is the only
   process that calls Finnhub and publishes market-data.json. */
(function(){
  const TAG_KEY='mdl.tags.v273', LIST_KEY='mdl.lists.v273';
  const SNAPSHOT_URL='market-data.json';
  const extras=[
    {ticker:'SCHD',name:'Schwab U.S. Dividend Equity ETF',sector:'ETF'},
    {ticker:'SPY',name:'SPDR S&P 500 ETF Trust',sector:'ETF'},
    {ticker:'QQQ',name:'Invesco QQQ Trust',sector:'ETF'},
    {ticker:'DIA',name:'SPDR Dow Jones Industrial Average ETF Trust',sector:'ETF'},
    {ticker:'SPYI',name:'NEOS S&P 500 High Income ETF',sector:'ETF'},
    {ticker:'BND',name:'Vanguard Total Bond Market ETF',sector:'ETF'}
  ];
  let db={},snapshotMeta={};
  let state={
    portfolioRefreshing:false,portfolioDone:0,portfolioTotal:0,
    portfolioStatus:'Shared market snapshot ready',portfolioActiveTicker:'',portfolioFailed:0,
    backgroundRefreshing:false,backgroundPhase:'github',backgroundDone:0,backgroundTotal:0,
    backgroundStatus:'Market maintenance runs in GitHub Actions',backgroundActiveTicker:'',backgroundFailed:0,
    fundamentalDone:0,fundamentalTotal:0,fundamentalStatus:'Monthly fundamentals maintained by GitHub Actions',
    lastError:'',rateLimitHits:0,schdStatus:'SCHD equity membership seeded from Schwab · 2026-08-06'
  };

  function normalize(t){return String(t||'').trim().toUpperCase().replace('.','-')}
  function read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
  function tags(){return read(TAG_KEY,{})}
  function listCatalog(){return read(LIST_KEY,{sp500:{id:'sp500',name:'S&P 500',system:true},moat:{id:'moat',name:'Moat Universe',system:false},tactical:{id:'tactical',name:'Tactical',system:false},schd:{id:'schd',name:'SCHD Holdings',system:true},covered:{id:'covered',name:'Covered Call Holdings',system:true}})}
  function saveCatalog(v){write(LIST_KEY,v)}
  function notify(){window.dispatchEvent(new CustomEvent('mdl-market-state',{detail:status()}))}

  function seed(){
    db={};
    [...(window.SP500_SEED||[]),...extras].forEach(s=>{let t=normalize(s.ticker);db[t]={ticker:t,name:s.name||t,sector:s.sector||'',inSP500:s.sector!=='ETF',price:null,marketCap:null,sharesOutstanding:null,annualDividend:null,dividendYield:null,lastRefresh:null,lastQuoteRefresh:null,lastFundamentalRefresh:null}});
    for(const s of (window.SCHD_SEED?.holdings||[])){let t=normalize(s.ticker),old=db[t]||{};db[t]={ticker:t,name:old.name||s.name||t,sector:old.sector||'',inSP500:!!old.inSP500,price:null,marketCap:null,sharesOutstanding:null,annualDividend:null,dividendYield:null,lastRefresh:null,lastQuoteRefresh:null,lastFundamentalRefresh:null,...old}}
    DATA.holdings.forEach(h=>{let t=normalize(h.ticker),old=db[t]||{};db[t]={ticker:t,name:h.name,sector:h.sector,inSP500:!!old.inSP500,price:h.price,marketCap:null,sharesOutstanding:null,annualDividend:null,dividendYield:null,lastRefresh:null,lastQuoteRefresh:null,lastFundamentalRefresh:null,...old,currentlyOwned:true}});
    seedSchdMembership();syncTags();state.backgroundTotal=maintenanceTickers().length;
  }
  function seedSchdMembership(){let tg=tags();for(const s of (window.SCHD_SEED?.holdings||[])){let t=normalize(s.ticker),x=tg[t]||{ticker:t,notes:'',lists:[],active:true},lists=new Set(x.lists||[]);lists.add('schd');tg[t]={...x,ticker:t,lists:[...lists],inSCHD:true,active:x.active??true}}write(TAG_KEY,tg)}
  function syncTags(){let tg=tags(),owned=new Set(DATA.holdings.map(h=>normalize(h.ticker)));DATA.universe.forEach(u=>{let t=normalize(u.ticker),x=tg[t]||{},lists=new Set(x.lists||[]);if(u.bucket==='Core')lists.add('moat');if(u.bucket==='Tactical')lists.add('tactical');if(x.inSCHD)lists.add('schd');if(owned.has(t))lists.add('covered');if(db[t]?.inSP500)lists.add('sp500');tg[t]={ticker:t,notes:x.notes??u.reason??'',lists:[...lists],coreMoat:lists.has('moat'),tactical:lists.has('tactical'),inSCHD:lists.has('schd'),currentlyOwned:owned.has(t),coveredCall:DATA.options.some(o=>normalize(o.ticker)===t),active:x.active??!['Archived','Benchmark'].includes(u.bucket)}});Object.keys(tg).forEach(t=>{let lists=new Set(tg[t].lists||[]);db[t]?.inSP500?lists.add('sp500'):lists.delete('sp500');tg[t].currentlyOwned=owned.has(t);tg[t].coveredCall=DATA.options.some(o=>normalize(o.ticker)===t);owned.has(t)?lists.add('covered'):lists.delete('covered');tg[t].lists=[...lists];tg[t].coreMoat=lists.has('moat');tg[t].tactical=lists.has('tactical');tg[t].inSCHD=lists.has('schd')});write(TAG_KEY,tg);return tg}
  function updateTag(t,patch){t=normalize(t);let tg=tags(),base={ticker:t,notes:'',lists:[],coreMoat:false,tactical:false,inSCHD:false,currentlyOwned:false,coveredCall:false,active:true,...tg[t]},lists=new Set(patch.lists??base.lists??[]);if('coreMoat'in patch)(patch.coreMoat?lists.add('moat'):lists.delete('moat'));if('tactical'in patch)(patch.tactical?lists.add('tactical'):lists.delete('tactical'));if('inSCHD'in patch)(patch.inSCHD?lists.add('schd'):lists.delete('schd'));tg[t]={...base,...patch,lists:[...lists]};write(TAG_KEY,tg);return tg[t]}
  function createList(name){name=String(name||'').trim();if(!name)return null;let c=listCatalog(),id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(!id||c[id])return null;c[id]={id,name,system:false};saveCatalog(c);return c[id]}
  function setMembership(t,id,on=true){let c=listCatalog();if(!c[id])return false;t=normalize(t);let x=tags()[t]||{ticker:t,lists:[]},lists=new Set(x.lists||[]);on?lists.add(id):lists.delete(id);updateTag(t,{lists:[...lists],coreMoat:lists.has('moat'),tactical:lists.has('tactical'),inSCHD:lists.has('schd')});return true}
  function addUniverse(t,notes='',kind='core'){t=normalize(t);if(!t)return false;if(!db[t])db[t]={ticker:t,name:t,sector:'',inSP500:false,price:null};updateTag(t,{notes,coreMoat:kind==='core',tactical:kind==='tactical',active:true});return true}
  function removeUniverse(t){updateTag(t,{active:false,coreMoat:false,tactical:false})}

  function applySnapshot(payload){
    if(!payload||!Array.isArray(payload.securities))throw new Error('Invalid shared market snapshot');
    for(const r of payload.securities){let t=normalize(r.ticker);if(!t)continue;db[t]={...(db[t]||{ticker:t,name:r.name||t,sector:r.sector||'',inSP500:!!r.inSP500}),...r,ticker:t}}
    snapshotMeta=payload.meta||{};state.backgroundTotal=Number(snapshotMeta.universeCount)||maintenanceTickers().length;state.backgroundDone=Number(snapshotMeta.quoteCount)||Object.values(db).filter(r=>r.lastQuoteRefresh).length;state.fundamentalTotal=state.backgroundTotal;state.fundamentalDone=Number(snapshotMeta.fundamentalCount)||Object.values(db).filter(r=>r.lastFundamentalRefresh).length;state.backgroundStatus=snapshotMeta.lastPriceRefresh?'Shared prices refreshed '+new Date(snapshotMeta.lastPriceRefresh).toLocaleString():'Shared market snapshot awaiting first GitHub refresh';state.fundamentalStatus=snapshotMeta.lastFundamentalRefresh?'Fundamentals refreshed '+new Date(snapshotMeta.lastFundamentalRefresh).toLocaleDateString():'Fundamentals awaiting first GitHub refresh';syncTags();notify();
  }
  async function loadSnapshot(cacheBust=false){let u=SNAPSHOT_URL+(cacheBust?'?v='+Date.now():'');let r=await fetch(u,{cache:cacheBust?'no-store':'default'});if(!r.ok)throw new Error('Shared market snapshot HTTP '+r.status);applySnapshot(await r.json());return true}
  async function refreshPortfolio(){if(state.portfolioRefreshing)return false;state.portfolioRefreshing=true;state.portfolioStatus='Checking shared market snapshot';state.portfolioDone=0;state.portfolioTotal=1;notify();try{await loadSnapshot(true);state.portfolioDone=1;state.portfolioStatus='Portfolio + benchmarks reloaded from shared market data';return true}catch(e){state.portfolioFailed=1;state.lastError=e.message;state.portfolioStatus='Shared market refresh unavailable';return false}finally{state.portfolioRefreshing=false;notify()}}
  function get(t){return db[normalize(t)]||null}
  function getDb(){return db}
  function maintenanceTickers(){let tg=tags();return Object.keys(db).filter(t=>db[t].inSP500||tg[t]?.inSCHD).sort()}
  function investmentRows(){let tg=syncTags();return Object.values(tg).filter(x=>x.active).map(x=>({...db[x.ticker],...x})).sort((a,b)=>a.ticker.localeCompare(b.ticker))}
  function schdRows(){let tg=tags();return Object.values(tg).filter(x=>x.inSCHD).map(x=>({...db[x.ticker],...x})).sort((a,b)=>a.ticker.localeCompare(b.ticker))}
  function sp500Rows(){return Object.values(db).filter(x=>x.inSP500).sort((a,b)=>a.ticker.localeCompare(b.ticker))}
  function status(){return{...state,rpm:50,sp500Count:sp500Rows().length,marketCount:Object.keys(db).length,lastStoredRefresh:snapshotMeta.lastPriceRefresh?Date.parse(snapshotMeta.lastPriceRefresh):0,lastPortfolioRefresh:snapshotMeta.lastPriceRefresh||null,lastPriceSweepCompletedAt:snapshotMeta.lastPriceRefresh||null,snapshotGeneratedAt:snapshotMeta.generatedAt||null}}
  function forEvidence(t){let r=get(t);return r?{ticker:r.ticker,name:r.name,price:r.price,marketCap:r.marketCap,sharesOutstanding:r.sharesOutstanding,dividendYield:r.dividendYield,lastMarketRefresh:r.lastQuoteRefresh||r.lastRefresh}:null}
  function batchForEvidence(tickers){return[...new Set((tickers||[]).map(normalize))].map(forEvidence).filter(Boolean)}

  seed();
  window.MDLMarket={get,getDb,sp500Rows,investmentRows,schdRows,tags,updateTag,addUniverse,removeUniverse,listCatalog,createList,setMembership,refreshPortfolio,refreshMarket:refreshPortfolio,maintenanceTickers,hasToken:()=>false,status,syncTags,forEvidence,batchForEvidence,loadSnapshot};
  window.addEventListener('load',()=>loadSnapshot(false).catch(e=>{state.lastError=e.message;state.backgroundStatus='Using embedded ledger prices until shared snapshot is available';notify()}),{once:true});
})();
