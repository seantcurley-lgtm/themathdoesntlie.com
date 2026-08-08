#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT=path.resolve(import.meta.dirname,'..');
const LAB=path.join(ROOT,'covered-call-lab');
const OUT=path.join(LAB,'market-data.json');
const API='https://finnhub.io/api/v1';
const CALL_GAP_MS=1200; // 50 calls/minute, below Finnhub's 60/minute free-tier ceiling.
const FUNDAMENTAL_TTL_MS=30*24*60*60*1000;
const token=process.env.FINNHUB_API_KEY||'';
const seedOnly=process.argv.includes('--seed-only');

function loadBrowserSeed(file,exportName){
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(LAB,file),'utf8'),context,{filename:file});
  return context.window[exportName];
}

const sp500=loadBrowserSeed('sp500.js','SP500_SEED');
const schd=loadBrowserSeed('schd.js','SCHD_SEED');
const schdMap=new Map((schd?.holdings||[]).map(x=>[x.ticker,x]));
const extras=[
  ['SCHD','Schwab U.S. Dividend Equity ETF'],['SPY','SPDR S&P 500 ETF Trust'],
  ['QQQ','Invesco QQQ Trust'],['DIA','SPDR Dow Jones Industrial Average ETF Trust'],
  ['SPYI','NEOS S&P 500 High Income ETF'],['BND','Vanguard Total Bond Market ETF']
];

let previous={meta:{},securities:[]};
try{previous=JSON.parse(fs.readFileSync(OUT,'utf8'))}catch{}
const prior=new Map((previous.securities||[]).map(x=>[x.ticker,x]));
const universe=new Map();
for(const s of sp500||[])universe.set(s.ticker,{ticker:s.ticker,name:s.name,sector:s.sector||'',inSP500:true,inSCHD:schdMap.has(s.ticker)});
for(const s of schd?.holdings||[]){const old=universe.get(s.ticker)||{};universe.set(s.ticker,{ticker:s.ticker,name:old.name||s.name,sector:old.sector||'',inSP500:!!old.inSP500,inSCHD:true})}
for(const [ticker,name] of extras){const old=universe.get(ticker)||{};universe.set(ticker,{ticker,name:old.name||name,sector:old.sector||'ETF',inSP500:!!old.inSP500,inSCHD:!!old.inSCHD})}

const rows=[...universe.values()].sort((a,b)=>a.ticker.localeCompare(b.ticker)).map(s=>({
  ...s,price:null,marketCap:null,sharesOutstanding:null,annualDividend:null,dividendYield:null,
  lastRefresh:null,lastQuoteRefresh:null,lastFundamentalRefresh:null,provider:'Finnhub',
  ...(prior.get(s.ticker)||{}),...s
}));

function save(meta={}){
  const payload={meta:{provider:'Finnhub',rpmLimit:50,universeCount:rows.length,...previous.meta,...meta,generatedAt:new Date().toISOString()},securities:rows};
  fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');
  previous=payload;
}

if(seedOnly){save({quoteCount:rows.filter(x=>x.lastQuoteRefresh).length,fundamentalCount:rows.filter(x=>x.lastFundamentalRefresh).length});console.log(`Seeded ${rows.length} shared securities.`);process.exit(0)}
if(!token){console.error('FINNHUB_API_KEY is required. Add it as a GitHub Actions repository secret.');process.exit(2)}

const wait=ms=>new Promise(r=>setTimeout(r,ms));
let lastCall=0,rateLimitHits=0;
async function api(endpoint,retry=0){
  const delay=Math.max(0,lastCall+CALL_GAP_MS-Date.now());if(delay)await wait(delay);lastCall=Date.now();
  const join=endpoint.includes('?')?'&':'?';
  const response=await fetch(API+endpoint+join+'token='+encodeURIComponent(token),{headers:{accept:'application/json'}});
  if(response.status===429&&retry<5){rateLimitHits++;await wait(Math.min(30000,5000*2**retry));return api(endpoint,retry+1)}
  if(!response.ok)throw new Error(`Finnhub ${response.status}`);
  return response.json();
}

let quoteFailures=0;
console.log(`Refreshing ${rows.length} securities at 50 calls/minute.`);
for(let i=0;i<rows.length;i++){
  const row=rows[i];
  try{
    const q=await api('/quote?symbol='+encodeURIComponent(row.ticker));
    const price=Number(q.c)||0;
    if(!price)throw new Error('no current price');
    row.price=price;row.lastQuoteRefresh=new Date().toISOString();row.lastRefresh=row.lastQuoteRefresh;row.provider='Finnhub';
    if(row.sharesOutstanding)row.marketCap=row.sharesOutstanding*price;
    if(row.annualDividend)row.dividendYield=row.annualDividend/price*100;
  }catch(e){quoteFailures++;console.warn(`Quote ${row.ticker}: ${e.message}`)}
  if((i+1)%50===0||i===rows.length-1)console.log(`Quotes ${i+1}/${rows.length}`);
}
const priceFinished=new Date().toISOString();

const lastFundamental=previous.meta?.lastFundamentalRefresh?Date.parse(previous.meta.lastFundamentalRefresh):0;
const fundamentalsStale=!Number.isFinite(lastFundamental)||Date.now()-lastFundamental>=FUNDAMENTAL_TTL_MS;
let fundamentalFailures=0,fundamentalFinished=previous.meta?.lastFundamentalRefresh||null;
if(fundamentalsStale){
  console.log('Monthly fundamentals are stale; refreshing them now.');
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    try{
      const m=await api('/stock/metric?symbol='+encodeURIComponent(row.ticker)+'&metric=all');
      const metric=m.metric||{},capMillions=Number(metric.marketCapitalization)||null;
      row.marketCap=capMillions?capMillions*1e6:row.marketCap;
      row.sharesOutstanding=row.marketCap&&row.price?row.marketCap/row.price:row.sharesOutstanding;
      row.annualDividend=Number(metric.dividendIndicatedAnnual)||Number(metric.dividendPerShareTTM)||row.annualDividend;
      row.dividendYield=row.annualDividend&&row.price?row.annualDividend/row.price*100:(metric.dividendYieldIndicatedAnnual??metric.currentDividendYieldTTM??row.dividendYield);
      row.lastFundamentalRefresh=new Date().toISOString();
    }catch(e){fundamentalFailures++;console.warn(`Fundamental ${row.ticker}: ${e.message}`)}
    if((i+1)%50===0||i===rows.length-1)console.log(`Fundamentals ${i+1}/${rows.length}`);
  }
  fundamentalFinished=new Date().toISOString();
}

save({
  lastPriceRefresh:priceFinished,lastFundamentalRefresh:fundamentalFinished,
  quoteCount:rows.filter(x=>x.lastQuoteRefresh).length,fundamentalCount:rows.filter(x=>x.lastFundamentalRefresh).length,
  quoteFailures,fundamentalFailures,rateLimitHits
});
console.log(`Refresh complete. quoteFailures=${quoteFailures} fundamentalFailures=${fundamentalFailures} rateLimitHits=${rateLimitHits}`);
if(quoteFailures>Math.max(10,Math.floor(rows.length*.05)))process.exitCode=1;
