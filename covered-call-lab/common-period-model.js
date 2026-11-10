/* Pure common-period benchmark arithmetic. No market requests or portfolio writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CCL_COMMON_PERIOD=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const money=n=>{if(!finite(n))return null;const v=Math.sign(n)*Math.round((Math.abs(n)+Number.EPSILON*Math.max(1,Math.abs(n)))*100)/100;return Object.is(v,-0)?0:v;};
 const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 const notes=v=>Array.isArray(v)?v.filter(n=>typeof n==='string'&&n.trim()):[];
 const unique=v=>[...new Set(v)];
 function funding(contributions){
  const errors=[],lots=[];
  if(!Array.isArray(contributions))return{errors:['Dated contributions are missing.'],lots,total:null};
  for(const c of contributions){if(!c||!date(c.date)||!finite(c.amount)||c.amount<=0)errors.push('Every contribution needs a valid date and a positive finite amount.');else lots.push({date:c.date,amount:c.amount});}
  return{errors,lots,total:errors.length?null:lots.reduce((n,c)=>n+c.amount,0)};
 }
 function fundingTotal(contributions){return money(funding(contributions).total);}
 function buildBenchmarkRow(input={}){
  input=input&&typeof input==='object'?input:{};
  const issues=[],f=funding(input.contributions),period={startDate:input.startDate||null,endDate:input.endDate||null};issues.push(...f.errors);
  const periodValid=date(input.startDate)&&date(input.endDate)&&input.startDate<=input.endDate;
  if(!periodValid)issues.push('A valid start date and end date are required.');
  if(f.total===0)issues.push('At least one positive contribution is required.');
  const inPeriod=periodValid&&f.lots.every(c=>c.date>=input.startDate&&c.date<=input.endDate);
  if(periodValid&&!inPeriod)issues.push('A contribution falls outside the selected period.');
  const splits=input.splits,splitSafe=Array.isArray(splits)&&splits.length===0;
  if(!splitSafe)issues.push('Split or corporate-action adjustments are not modeled; supply a consistent action-free price/share basis.');
  const prices=input.prices||{},lots=f.lots.map(c=>({...c,price:finite(prices[c.date])&&prices[c.date]>0?prices[c.date]:null}));
  for(const c of lots)if(c.price===null)issues.push('Funding-date close is missing or invalid: '+c.date+'.');
  const lotsValid=f.errors.length===0&&f.total>0&&inPeriod&&splitSafe&&lots.every(c=>c.price!==null);
  const contributionLots=lots.map(c=>({...c,shares:lotsValid?c.amount/c.price:null}));
  const shares=lotsValid?contributionLots.reduce((n,c)=>n+c.shares,0):null;
  const endPrice=periodValid&&finite(prices[input.endDate])&&prices[input.endDate]>0?prices[input.endDate]:null;
  if(periodValid&&endPrice===null)issues.push('Endpoint close is missing or invalid: '+input.endDate+'.');
  const priceValue=shares!==null&&endPrice!==null?shares*endPrice:null,priceGain=priceValue!==null?priceValue-f.total:null;
  const coverageValid=input.coverage?.qualified===true;
  if(!coverageValid)issues.push('Distribution coverage is not qualified for the selected period.');
  const eventsValid=Array.isArray(input.distributions),seen=new Set(),distributionBreakdown=[];let eventErrors=false,paid=0,receivable=0;
  if(!eventsValid){issues.push('A dated distribution event array is required, including an explicit empty array when coverage confirms none.');eventErrors=true;}
  for(const e of eventsValid?input.distributions:[]){
   if(!e||!date(e.exDate)){issues.push('A distribution has a missing or invalid ex-date.');eventErrors=true;continue;}
   if(periodValid&&(e.exDate<input.startDate||e.exDate>input.endDate))continue;
   if(!finite(e.amount)||e.amount<0||!date(e.paymentDate)||e.paymentDate<e.exDate){issues.push('Distribution '+e.exDate+' needs a finite nonnegative amount and a valid payment date on/after its ex-date.');eventErrors=true;continue;}
   const identity=e.exDate+'|'+e.paymentDate+'|'+e.amount;
   if(seen.has(identity)){issues.push('Duplicate distribution event: '+e.exDate+'.');eventErrors=true;continue;}seen.add(identity);
   const entitledShares=lotsValid?contributionLots.filter(c=>c.date<e.exDate).reduce((n,c)=>n+c.shares,0):null,earned=entitledShares===null?null:entitledShares*e.amount,isPaid=periodValid&&e.paymentDate<=input.endDate;
   if(earned!==null){if(isPaid)paid+=earned;else receivable+=earned;}
   distributionBreakdown.push({exDate:e.exDate,paymentDate:e.paymentDate,amount:e.amount,entitledShares,earned,classification:isPaid?'paid cash':'receivable',...(typeof e.source==='string'?{source:e.source}:{})});
  }
  const incomeValid=periodValid&&lotsValid&&coverageValid&&!eventErrors,income=incomeValid?paid+receivable:null;
  const qualified=periodValid&&lotsValid&&endPrice!==null&&incomeValid;
  const total=qualified?priceGain+income:null,ending=qualified?priceValue+income:null;
  const row={ticker:input.ticker||'',name:input.name||input.ticker||'',proxy:input.proxy||input.ticker||'',category:input.category||'Cash Flow',purpose:input.purpose||'Dated-funding benchmark',period,
   baselineInvestment:money(f.total),priceReturnDollars:money(priceGain),incomeGenerated:money(income),optionMtm:0,totalReturnDollars:money(total),totalReturnPct:qualified?total/f.total*100:null,endingValue:money(ending),
   cashBalance:incomeValid?money(paid):null,paidIncome:incomeValid?money(paid):null,receivables:incomeValid?money(receivable):null,shares,currentPrice:endPrice,qualified,
   limitations:unique([...issues,...notes(input.coverage?.notes),...notes(input.sourceNotes)]),contributionLots,distributionBreakdown,
   returnMethod:'Profit divided by total contributed capital; not a time-weighted return',distributionMethod:'Funding-date close purchases; cash distributions not reinvested; earned unpaid distributions included as receivables'};
  row.calculation={baselineInvestment:f.total,priceReturnDollars:priceGain,incomeGenerated:income,optionMtm:0,totalReturnDollars:total,endingValue:ending,cashBalance:incomeValid?paid:null,paidIncome:incomeValid?paid:null,receivables:incomeValid?receivable:null};return row;
 }
 function schedule(row){
  if(!Array.isArray(row?.contributionLots)||!row.contributionLots.length)return null;
  const byDate=new Map();for(const c of row.contributionLots){if(!date(c.date)||!finite(c.amount)||c.amount<=0)return null;byDate.set(c.date,(byDate.get(c.date)||0)+c.amount);}
  return [...byDate].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,amount])=>({date,amount}));
 }
 function buildBlendedRow(rows,weights){
  rows=Array.isArray(rows)?rows:[];const issues=[],ws=rows.map((r,i)=>Array.isArray(weights)?weights[i]:weights&&r?weights[r.ticker]:undefined);
  const weightsMatch=Array.isArray(weights)?weights.length===rows.length:weights&&typeof weights==='object'&&Object.keys(weights).length===rows.length&&rows.every(r=>r&&Object.prototype.hasOwnProperty.call(weights,r.ticker));
  if(!rows.length||!weightsMatch||ws.some(w=>!finite(w)||w<0)||Math.abs(ws.reduce((n,w)=>n+(finite(w)?w:0),0)-1)>1e-9)issues.push('Blend weights must match the rows, be nonnegative and sum to one.');
  const first=rows[0],period=first?.period?{startDate:first.period.startDate,endDate:first.period.endDate}:{startDate:null,endDate:null};
  if(!date(period.startDate)||!date(period.endDate)||period.startDate>period.endDate||rows.some(r=>!r?.period||r.period.startDate!==period.startDate||r.period.endDate!==period.endDate))issues.push('Blended rows must share the same valid period.');
  if(!finite(first?.baselineInvestment)||first.baselineInvestment<=0||rows.some(r=>!finite(r?.baselineInvestment)||Math.abs(r.baselineInvestment-first.baselineInvestment)>1e-8))issues.push('Blended rows must use identical contributed capital.');
  const flows=schedule(first);if(!flows||rows.some(r=>{const s=schedule(r);return !s||s.length!==flows.length||s.some((c,i)=>c.date!==flows[i].date||Math.abs(c.amount-flows[i].amount)>1e-8);}))issues.push('Blended rows must use the same dated contribution schedule.');
  const fields=['priceReturnDollars','incomeGenerated','optionMtm','totalReturnDollars','endingValue','cashBalance','paidIncome','receivables'];
  if(rows.some(r=>r?.qualified!==true||fields.some(k=>!finite(r[k]))))issues.push('Every blended row needs qualified complete return, cash and receivable values.');
  if(rows.some(r=>r?.calculation&&['baselineInvestment',...fields].some(k=>!finite(r.calculation[k])||money(r.calculation[k])!==r[k])))issues.push('Blended row calculation precision does not match its displayed totals.');
  const qualified=issues.length===0,blend=k=>qualified?rows.reduce((n,r,i)=>n+(r.calculation?.[k]??r[k])*ws[i],0):null,raw=Object.fromEntries(fields.map(k=>[k,blend(k)])),rawCapital=first?.calculation?.baselineInvestment??first?.baselineInvestment;
  const label=ws.map(w=>finite(w)?Math.round(w*100):'?').join('/'),row={ticker:label,name:label+' Portfolio',proxy:rows.map((r,i)=>(finite(ws[i])?Math.round(ws[i]*100):'?')+'% '+(r?.ticker||'?')).join(' / '),category:'Traditional Retirement',purpose:'Traditional balanced allocation',period,
   baselineInvestment:finite(first?.baselineInvestment)?first.baselineInvestment:null,...Object.fromEntries(fields.map(k=>[k,money(raw[k])])),totalReturnPct:qualified?raw.totalReturnDollars/rawCapital*100:null,shares:null,qualified,contributionLots:flows||[],
   limitations:unique([...issues,...rows.flatMap(r=>notes(r?.limitations))]),components:rows.map((r,i)=>({ticker:r?.ticker||'',weight:finite(ws[i])?ws[i]:null})),returnMethod:'Profit divided by total contributed capital; not a time-weighted return',distributionMethod:'Weighted unreinvested cash-distribution portfolios, including unpaid receivables'};
  row.calculation={...raw,baselineInvestment:finite(rawCapital)?rawCapital:null};return row;
 }
 return Object.freeze({buildBenchmarkRow,fundingTotal,buildBlendedRow});
});
