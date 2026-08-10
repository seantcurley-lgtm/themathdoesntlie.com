/* Covered Call Lab v2.7.7 — priority holdings refresh plus resumable market maintenance. */
(function(){
  const TAG_KEY='mdl.tags.v273',LIST_KEY='mdl.lists.v273',DB_KEY='mdl.market.v275';
  const CURSOR_KEY='mdl.market.cursor.v276',PORTFOLIO_KEY='mdl.portfolio.refresh.v275';
  const LEASE_KEY='mdl.market.lease.v276',HOLDINGS_BUSY_KEY='mdl.holdings.busy.v276',FAILED_KEY='mdl.market.failed.v276',COOLDOWN_KEY='mdl.market.cooldown.v276';
  const SNAPSHOT_URL='market-data.json',PROXY_CONFIG_URL='quote-proxy.json';
  const REQUEST_GAP_MS=3000; // 20/minute leaves capacity for priority holdings and provider jitter.
  const THROTTLE_COOLDOWN_MS=60000,LEASE_MS=15000;
  const HOLDINGS_RETRY_DELAYS_MS=[15000,30000];
  const INSTANCE_ID=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`);
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
  const backgroundFailures=new Set(read(FAILED_KEY,[]));state.backgroundFailed=backgroundFailures.size;
  function persistFailures(){write(FAILED_KEY,[...backgroundFailures]);state.backgroundFailed=backgroundFailures.size}
  function holdingsBusy(){return Number(read(HOLDINGS_BUSY_KEY,0))>Date.now()}
  function markHoldingsBusy(){write(HOLDINGS_BUSY_KEY,Date.now()+120000)}
  function clearHoldingsBusy(){write(HOLDINGS_BUSY_KEY,0)}
  function backgroundCooldownRemaining(){return Math.max(0,Number(read(COOLDOWN_KEY,0))-Date.now())}
  function claimBackgroundLease(){let now=Date.now(),lease=read(LEASE_KEY,null);if(lease&&lease.owner!==INSTANCE_ID&&Number(lease.until)>now)return false;write(LEASE_KEY,{owner:INSTANCE_ID,until:now+LEASE_MS});return read(LEASE_KEY,null)?.owner===INSTANCE_ID}
  function renewBackgroundLease(){write(LEASE_KEY,{owner:INSTANCE_ID,until:Date.now()+LEASE_MS})}
  function releaseBackgroundLease(){let lease=read(LEASE_KEY,null);if(lease?.owner===INSTANCE_ID)write(LEASE_KEY,{owner:INSTANCE_ID,until:0})}
  function isThrottle(error){return /(?:429|rate limit|throttl)/i.test(String(error?.message||error||''))}
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
  function benchmarkTickers(){return extras.map(x=>x.ticker)}
  async function refreshPortfolio(){
    if(state.portfolioRefreshing)return false;
    clearTimeout(backgroundTimer);markHoldingsBusy();releaseBackgroundLease();
    const tickers=holdingsTickers(),current=new Set();state.portfolioRefreshing=true;state.portfolioDone=0;state.portfolioTotal=tickers.length;state.portfolioFailed=0;state.portfolioFailedTickers=[];state.portfolioStatus='Refreshing current holdings from Finnhub';notify();
    let pending=[...tickers];
    for(let round=0;pending.length&&round<=HOLDINGS_RETRY_DELAYS_MS.length;round++){
      if(round){let delay=HOLDINGS_RETRY_DELAYS_MS[round-1];markHoldingsBusy();state.portfolioStatus=`Holdings refresh partial: ${current.size}/${tickers.length} current; retrying ${pending.join(', ')} in ${Math.round(delay/1000)}s`;state.portfolioActiveTicker='Retry scheduled';notify();await wait(delay);state.portfolioStatus=`Retrying failed holdings: ${pending.join(', ')}`;state.portfolioActiveTicker=pending[0]||'';notify()}
      let payload={quotes:{},failed:[]};try{payload=await proxyQuotes(pending)}catch(e){state.lastError=e.message;payload.failed=pending.map(t=>({ticker:t,error:e.message}))}
      const failed=[];for(const t of pending){state.portfolioActiveTicker=t;let q=payload.quotes?.[t];if(Number.isFinite(q?.price)&&q.price>0){saveQuote(t,q.price,q.retrievedAt);current.add(t)}else failed.push(t);state.portfolioDone=current.size;notify()}pending=failed;if(payload.failed?.length)state.lastError=payload.failed.map(x=>`${x.ticker}: ${x.error}`).join('; ')
    }
    state.portfolioFailed=pending.length;state.portfolioFailedTickers=[...pending];state.portfolioDone=current.size;state.portfolioRefreshing=false;state.portfolioActiveTicker='';clearHoldingsBusy();if(!pending.length){state.lastPortfolioRefresh=new Date().toISOString();write(PORTFOLIO_KEY,state.lastPortfolioRefresh);state.portfolioStatus=`Holdings refresh successful: ${current.size}/${tickers.length} current`}else if(current.size){state.portfolioStatus=`Holdings refresh stopped partial after automatic retries: ${current.size}/${tickers.length} current; stale ${pending.join(', ')}`}else state.portfolioStatus=`Holdings refresh failed after automatic retries: ${state.lastError}`;notify();scheduleBackground(5000);return pending.length===0;
  }
  function maintenanceTickers(){let tg=tags();return Object.keys(db).filter(t=>db[t].inSP500||tg[t]?.inSCHD||db[t].sector==='ETF').sort()}
  async function backgroundStep(){
    if(state.portfolioRefreshing||holdingsBusy()){state.backgroundStatus='Background paused for holdings refresh';notify();scheduleBackground(5000);return}
    let cooldown=backgroundCooldownRemaining();if(cooldown){state.backgroundStatus=`Finnhub rate-limit cooldown · retrying in ${Math.ceil(cooldown/1000)}s`;notify();scheduleBackground(cooldown);return}
    if(!claimBackgroundLease()){state.backgroundStatus='Background maintenance active in another tab';notify();scheduleBackground(5000);return}
    const all=maintenanceTickers();state.backgroundTotal=all.length;let cursor=read(CURSOR_KEY,0);if(cursor>=all.length){cursor=0;write(CURSOR_KEY,0)}let t=all[cursor];state.backgroundRefreshing=true;state.backgroundActiveTicker=t;state.backgroundDone=cursor;state.backgroundStatus=`Background maintenance ${cursor}/${all.length}`;notify();
    // queuedQuote already enforces the 3-second provider gap. Keep the follow-up
    // timer short so the sweep actually approaches the 20/minute guardrail.
    let nextDelay=100;
    try{renewBackgroundLease();let p=await queuedQuote(t,false);saveQuote(t,p);backgroundFailures.delete(t);persistFailures();cursor++;write(CURSOR_KEY,cursor);state.backgroundDone=cursor;state.backgroundStatus=cursor>=all.length?'Background price sweep complete':`Background maintenance ${cursor}/${all.length}`}
    catch(e){state.lastError=e.message;if(isThrottle(e)){state.rateLimitHits++;nextDelay=THROTTLE_COOLDOWN_MS;write(COOLDOWN_KEY,Date.now()+nextDelay);state.backgroundStatus=`Finnhub rate-limit pause at ${cursor}/${all.length}; ${t} will retry`}else{backgroundFailures.add(t);persistFailures();cursor++;write(CURSOR_KEY,cursor);state.backgroundDone=cursor;state.backgroundStatus=`Background retained prior ${t} price after failure`}}
    finally{state.backgroundRefreshing=false;state.backgroundActiveTicker='';notify();if(cursor<all.length)scheduleBackground(nextDelay);else releaseBackgroundLease()}
  }
  function scheduleBackground(delay=1500){clearTimeout(backgroundTimer);backgroundTimer=setTimeout(backgroundStep,delay)}
  function get(t){return db[normalize(t)]||null}function getDb(){return db}
  function investmentRows(){let tg=syncTags();return Object.values(tg).filter(x=>x.active).map(x=>({...db[x.ticker],...x})).sort((a,b)=>a.ticker.localeCompare(b.ticker))}
  function schdRows(){let tg=tags();return Object.values(tg).filter(x=>x.inSCHD).map(x=>({...db[x.ticker],...x})).sort((a,b)=>a.ticker.localeCompare(b.ticker))}
  function sp500Rows(){return Object.values(db).filter(x=>x.inSP500).sort((a,b)=>a.ticker.localeCompare(b.ticker))}
  function status(){return{...state,rpm:20,sp500Count:sp500Rows().length,marketCount:Object.keys(db).length,lastStoredRefresh:state.lastPortfolioRefresh?Date.parse(state.lastPortfolioRefresh):0,lastPriceSweepCompletedAt:read(CURSOR_KEY,0)>=maintenanceTickers().length?new Date().toISOString():null,snapshotGeneratedAt:snapshotMeta.generatedAt||null}}
  function forEvidence(t){let r=get(t);return r?{ticker:r.ticker,name:r.name,price:r.price,marketCap:r.marketCap,sharesOutstanding:r.sharesOutstanding,dividendYield:r.dividendYield,lastMarketRefresh:r.lastQuoteRefresh||r.lastRefresh}:null}
  function batchForEvidence(tickers){return[...new Set((tickers||[]).map(normalize))].map(forEvidence).filter(Boolean)}
  seed();window.MDLMarket={get,getDb,sp500Rows,investmentRows,schdRows,tags,updateTag,addUniverse,removeUniverse,listCatalog,createList,setMembership,refreshPortfolio,refreshMarket:refreshPortfolio,maintenanceTickers,holdingsTickers,benchmarkTickers,hasToken:()=>Boolean(proxyEndpoint),status,syncTags,forEvidence,batchForEvidence,loadSnapshot,loadProxyConfig,_test:{saveQuote,backgroundStep,rawQuote,proxyQuotes,claimBackgroundLease,isThrottle}};
  window.addEventListener('load',()=>Promise.allSettled([loadSnapshot(false),loadProxyConfig()]).then(results=>{if(results[0].status==='rejected'){state.lastError=results[0].reason.message;state.backgroundStatus='Using persisted/browser ledger prices; shared snapshot unavailable'}if(results[1].status==='rejected'){state.lastError=results[1].reason.message;state.backgroundStatus='Quote gateway unavailable'}notify();scheduleBackground(60000)}),{once:true});
  window.addEventListener('beforeunload',releaseBackgroundLease);
})();
