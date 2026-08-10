/* Covered Call Lab v2.7.5 — two-tier Finnhub market-data client. */
(function(){
  const TAG_KEY='mdl.tags.v273',LIST_KEY='mdl.lists.v273',DB_KEY='mdl.market.v275';
  const CURSOR_KEY='mdl.market.cursor.v275',PORTFOLIO_KEY='mdl.portfolio.refresh.v275';
  const SNAPSHOT_URL='market-data.json',PROXY_CONFIG_URL='quote-proxy.json';
  const REQUEST_GAP_MS=1250; // 48/minute: below the 60/minute Finnhub ceiling.
  const extras=[
    {ticker:'SCHD',name:'Schwab U.S. Dividend Equity ETF',sector:'ETF'},
    {ticker:'SPY',name:'SPDR S&P 500 ETF Trust',sector:'ETF'},
    {ticker:'QQQ',name:'Invesco QQQ Trust',sector:'ETF'},
    {ticker:'DIA',name:'SPDR Dow Jones Industrial Average ETF Trust',sector:'ETF'},
    {ticker:'SPYI',name:'NEOS S&P 500 High Income ETF',sector:'ETF'},
    {ticker:'BND',name:'Vanguard Total Bond Market ETF',sector:'ETF'}
  ];
  let db={},snapshotMeta={},backgroundTimer=null,requestChain=Promise.resolve(),proxyEndpoint='';
  let state={portfolioRefreshing:false,portfolioDone:0,portfolioTotal:0,portfolioStatus:'Ready to refresh current holdings',portfolioActiveTicker:'',portfolioFailed:0,portfolioFailedTickers:[],backgroundRefreshing:false,backgroundPhase:'prices',backgroundDone:0,backgroundTotal:0,backgroundStatus:'Background maintenance waiting',backgroundActiveTicker:'',backgroundFailed:0,fundamentalDone:0,fundamentalTotal:0,fundamentalStatus:'Fundamentals seeded by GitHub snapshot',lastError:'',rateLimitHits:0,schdStatus:'SCHD equity membership seeded from Schwab · 2026-08-06',lastPortfolioRefresh:null};

  function normalize(t){return String(t||'').trim().toUpperCase().replace('.','-')}
  function read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
  function tags(){return read(TAG_KEY,{})}
  function listCatalog(){return read(LIST_KEY,{sp500:{id:'sp500',name:'S&P 500',system:true},moat:{id:'moat',name:'Moat Universe',system:false},tactical:{id:'tactical',name:'Tactical',system:false},schd:{id:'schd',name:'SCHD Holdings',system:true},covered:{id:'covered',name:'Covered Call Holdings',system:true}})}
  function saveCatalog(v){write(LIST_KEY,v)}
  function notify(){window.dispatchEvent(new CustomEvent('mdl-market-state',{detail:status()}))}
  function persist(){write(DB_KEY,db)}

  function seed(){
    const stored=read(DB_KEY,{});db={};
    [...(window.SP500_SEED||[]),...extras].forEach(s=>{let t=normalize(s.ticker);db[t]={ticker:t,name:s.name||t,sector:s.sector||'',inSP500:s.sector!=='ETF',price:null,marketCap:null,sharesOutstanding:null,annualDividend:null,dividendYield:null,lastRefresh:null,lastQuoteRefresh:null,lastFundamentalRefresh:null,...stored[t]}});
    for(const s of (window.SCHD_SEED?.holdings||[])){let t=normalize(s.ticker),old=db[t]||{};db[t]={ticker:t,name:old.name||s.name||t,sector:old.sector||'',inSP500:!!old.inSP500,price:null,...old,...stored[t]}}
    DATA.holdings.forEach(h=>{let t=normalize(h.ticker),old=db[t]||{};db[t]={ticker:t,name:h.name,sector:h.sector,inSP500:!!old.inSP500,price:h.price,...old,...stored[t],currentlyOwned:true}});
    seedSchdMembership();syncTags();state.backgroundTotal=maintenanceTickers().length;state.lastPortfolioRefresh=read(PORTFOLIO_KEY,null);state.backgroundDone=Math.min(read(CURSOR_KEY,0),state.backgroundTotal);
  }
  function seedSchdMembership(){let tg=tags();for(const s of (window.SCHD_SEED?.holdings||[])){let t=normalize(s.ticker),x=tg[t]||{ticker:t,notes:'',lists:[],active:true},lists=new Set(x.lists||[]);lists.add('schd');tg[t]={...x,ticker:t,lists:[...lists],inSCHD:true,active:x.active??true}}write(TAG_KEY,tg)}
  function syncTags(){let tg=tags(),owned=new Set(DATA.holdings.map(h=>normalize(h.ticker)));DATA.universe.forEach(u=>{let t=normalize(u.ticker),x=tg[t]||{},lists=new Set(x.lists||[]);if(u.bucket==='Core')lists.add('moat');if(u.bucket==='Tactical')lists.add('tactical');if(x.inSCHD)lists.add('schd');if(owned.has(t))lists.add('covered');if(db[t]?.inSP500)lists.add('sp500');tg[t]={ticker:t,notes:x.notes??u.reason??'',lists:[...lists],coreMoat:lists.has('moat'),tactical:lists.has('tactical'),inSCHD:lists.has('schd'),currentlyOwned:owned.has(t),coveredCall:DATA.options.some(o=>normalize(o.ticker)===t),active:x.active??!['Archived','Benchmark'].includes(u.bucket)}});Object.keys(tg).forEach(t=>{let lists=new Set(tg[t].lists||[]);db[t]?.inSP500?lists.add('sp500'):lists.delete('sp500');tg[t].currentlyOwned=owned.has(t);tg[t].coveredCall=DATA.options.some(o=>normalize(o.ticker)===t);owned.has(t)?lists.add('covered'):lists.delete('covered');tg[t].lists=[...lists];tg[t].coreMoat=lists.has('moat');tg[t].tactical=lists.has('tactical');tg[t].inSCHD=lists.has('schd')});write(TAG_KEY,tg);return tg}
  function updateTag(t,patch){t=normalize(t);let tg=tags(),base={ticker:t,notes:'',lists:[],coreMoat:false,tactical:false,inSCHD:false,currentlyOwned:false,coveredCall:false,active:true,...tg[t]},lists=new Set(patch.lists??base.lists??[]);if('coreMoat'in patch)(patch.coreMoat?lists.add('moat'):lists.delete('moat'));if('tactical'in patch)(patch.tactical?lists.add('tactical'):lists.delete('tactical'));if('inSCHD'in patch)(patch.inSCHD?lists.add('schd'):lists.delete('schd'));tg[t]={...base,...patch,lists:[...lists]};write(TAG_KEY,tg);return tg[t]}
  function createList(name){name=String(name||'').trim();if(!name)return null;let c=listCatalog(),id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(!id||c[id])return null;c[id]={id,name,system:false};saveCatalog(c);return c[id]}
  function setMembership(t,id,on=true){let c=listCatalog();if(!c[id])return false;t=normalize(t);let x=tags()[t]||{ticker:t,lists:[]},lists=new Set(x.lists||[]);on?lists.add(id):lists.delete(id);updateTag(t,{lists:[...lists],coreMoat:lists.has('moat'),tactical:lists.has('tactical'),inSCHD:lists.has('schd')});return true}
  function addUniverse(t,notes='',kind='core'){t=normalize(t);if(!t)return false;if(!db[t])db[t]={ticker:t,name:t,sector:'',inSP500:false,price:null};updateTag(t,{notes,coreMoat:kind==='core',tactical:kind==='tactical',active:true});return true}
  function removeUniverse(t){updateTag(t,{active:false,coreMoat:false,tactical:false})}

  function applySnapshot(payload){if(!payload||!Array.isArray(payload.securities))throw new Error('Invalid shared market snapshot');for(const r of payload.securities){let t=normalize(r.ticker);if(!t)continue;let old=db[t]||{},storedIsNewer=Date.parse(old.lastQuoteRefresh||0)>Date.parse(r.lastQuoteRefresh||r.lastRefresh||0);db[t]={...old,...r,ticker:t,...(storedIsNewer?{price:old.price,lastQuoteRefresh:old.lastQuoteRefresh,lastRefresh:old.lastRefresh}:{})}}snapshotMeta=payload.meta||{};state.fundamentalTotal=Number(snapshotMeta.universeCount)||maintenanceTickers().length;state.fundamentalDone=Number(snapshotMeta.fundamentalCount)||Object.values(db).filter(r=>r.lastFundamentalRefresh).length;persist();syncTags();notify()}
  async function loadSnapshot(cacheBust=false){let u=SNAPSHOT_URL+(cacheBust?'?v='+Date.now():'');let r=await fetch(u,{cache:cacheBust?'no-store':'default'});if(!r.ok)throw new Error('Shared market snapshot HTTP '+r.status);applySnapshot(await r.json());return true}
  async function loadProxyConfig(){let r=await fetch(PROXY_CONFIG_URL+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('Quote gateway configuration HTTP '+r.status);let config=await r.json();proxyEndpoint=String(config.endpoint||'').replace(/\/$/,'');if(!proxyEndpoint)throw new Error('Quote gateway is not deployed');return proxyEndpoint}
  function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
  async function proxyQuotes(tickers){if(!proxyEndpoint)await loadProxyConfig();let r=await fetch(`${proxyEndpoint}/quotes?symbols=${encodeURIComponent(tickers.join(','))}`,{cache:'no-store'});if(r.status===429){state.rateLimitHits++;throw new Error('Quote gateway rate limit reached')}let payload=await r.json().catch(()=>({}));if(!r.ok&&!payload.quotes)throw new Error(payload.error||`Quote gateway HTTP ${r.status}`);return payload}
  async function rawQuote(t){let payload=await proxyQuotes([t]),q=payload.quotes?.[t];if(!Number.isFinite(q?.price)||q.price<=0)throw new Error(payload.failed?.[0]?.error||'Quote gateway returned no current price');return q.price}
  function queuedQuote(t,priority=false){const run=async()=>{if(!priority)await wait(REQUEST_GAP_MS);return rawQuote(t)};if(priority)return run();requestChain=requestChain.then(run,run);return requestChain}
  function saveQuote(t,price,at=new Date().toISOString()){let old=db[t]||{ticker:t,name:t,sector:'',inSP500:false};db[t]={...old,price,lastQuoteRefresh:at,lastRefresh:at,provider:'Finnhub'};persist()}
  function holdingsTickers(){return[...new Set(DATA.holdings.filter(h=>Number(h.shares)>0).map(h=>normalize(h.ticker)))]}
  async function refreshPortfolio(){
    if(state.portfolioRefreshing)return false;
    const tickers=holdingsTickers();state.portfolioRefreshing=true;state.portfolioDone=0;state.portfolioTotal=tickers.length;state.portfolioFailed=0;state.portfolioFailedTickers=[];state.portfolioStatus='Refreshing current holdings from Finnhub';notify();
    let ok=0;try{let payload=await proxyQuotes(tickers);for(const t of tickers){state.portfolioActiveTicker=t;let q=payload.quotes?.[t];if(Number.isFinite(q?.price)&&q.price>0){saveQuote(t,q.price,q.retrievedAt);ok++}else{state.portfolioFailed++;state.portfolioFailedTickers.push(t)}state.portfolioDone++;notify()}if(payload.failed?.length)state.lastError=payload.failed.map(x=>`${x.ticker}: ${x.error}`).join('; ')}catch(e){state.portfolioFailed=tickers.length;state.portfolioFailedTickers=[...tickers];state.portfolioDone=tickers.length;state.lastError=e.message}
    state.portfolioRefreshing=false;state.portfolioActiveTicker='';if(ok){state.lastPortfolioRefresh=new Date().toISOString();write(PORTFOLIO_KEY,state.lastPortfolioRefresh)}state.portfolioStatus=state.portfolioFailed?`Holdings refresh partial: ${ok}/${tickers.length} current; failed ${state.portfolioFailedTickers.join(', ')}`:`Holdings refresh successful: ${ok}/${tickers.length} current`;if(!ok)state.portfolioStatus=`Holdings refresh failed: ${state.lastError}`;notify();scheduleBackground(250);return state.portfolioFailed===0;
  }
  function maintenanceTickers(){let tg=tags();return Object.keys(db).filter(t=>db[t].inSP500||tg[t]?.inSCHD||db[t].sector==='ETF').sort()}
  async function backgroundStep(){
    if(state.portfolioRefreshing){scheduleBackground(500);return}
    const all=maintenanceTickers();state.backgroundTotal=all.length;let cursor=read(CURSOR_KEY,0);if(cursor>=all.length){cursor=0;write(CURSOR_KEY,0)}let t=all[cursor];state.backgroundRefreshing=true;state.backgroundActiveTicker=t;state.backgroundDone=cursor;state.backgroundStatus=`Background maintenance ${cursor}/${all.length}`;notify();
    try{let p=await queuedQuote(t,false);saveQuote(t,p);cursor++;write(CURSOR_KEY,cursor);state.backgroundDone=cursor;state.backgroundStatus=cursor>=all.length?'Background price sweep complete':`Background maintenance ${cursor}/${all.length}`}
    catch(e){state.backgroundFailed++;state.lastError=e.message;cursor++;write(CURSOR_KEY,cursor);state.backgroundDone=cursor;state.backgroundStatus=`Background retained prior ${t} price after failure`}
    finally{state.backgroundRefreshing=false;state.backgroundActiveTicker='';notify();if(cursor<all.length)scheduleBackground(250)}
  }
  function scheduleBackground(delay=1500){clearTimeout(backgroundTimer);backgroundTimer=setTimeout(backgroundStep,delay)}
  function get(t){return db[normalize(t)]||null}function getDb(){return db}
  function investmentRows(){let tg=syncTags();return Object.values(tg).filter(x=>x.active).map(x=>({...db[x.ticker],...x})).sort((a,b)=>a.ticker.localeCompare(b.ticker))}
  function schdRows(){let tg=tags();return Object.values(tg).filter(x=>x.inSCHD).map(x=>({...db[x.ticker],...x})).sort((a,b)=>a.ticker.localeCompare(b.ticker))}
  function sp500Rows(){return Object.values(db).filter(x=>x.inSP500).sort((a,b)=>a.ticker.localeCompare(b.ticker))}
  function status(){return{...state,rpm:48,sp500Count:sp500Rows().length,marketCount:Object.keys(db).length,lastStoredRefresh:state.lastPortfolioRefresh?Date.parse(state.lastPortfolioRefresh):0,lastPriceSweepCompletedAt:read(CURSOR_KEY,0)>=maintenanceTickers().length?new Date().toISOString():null,snapshotGeneratedAt:snapshotMeta.generatedAt||null}}
  function forEvidence(t){let r=get(t);return r?{ticker:r.ticker,name:r.name,price:r.price,marketCap:r.marketCap,sharesOutstanding:r.sharesOutstanding,dividendYield:r.dividendYield,lastMarketRefresh:r.lastQuoteRefresh||r.lastRefresh}:null}
  function batchForEvidence(tickers){return[...new Set((tickers||[]).map(normalize))].map(forEvidence).filter(Boolean)}
  seed();window.MDLMarket={get,getDb,sp500Rows,investmentRows,schdRows,tags,updateTag,addUniverse,removeUniverse,listCatalog,createList,setMembership,refreshPortfolio,refreshMarket:refreshPortfolio,maintenanceTickers,holdingsTickers,hasToken:()=>Boolean(proxyEndpoint),status,syncTags,forEvidence,batchForEvidence,loadSnapshot,loadProxyConfig,_test:{saveQuote,backgroundStep,rawQuote,proxyQuotes}};
  window.addEventListener('load',()=>Promise.allSettled([loadSnapshot(false),loadProxyConfig()]).then(results=>{if(results[0].status==='rejected'){state.lastError=results[0].reason.message;state.backgroundStatus='Using persisted/browser ledger prices; shared snapshot unavailable'}if(results[1].status==='rejected'){state.lastError=results[1].reason.message;state.backgroundStatus='Quote gateway unavailable'}notify();scheduleBackground(60000)}),{once:true});
})();
