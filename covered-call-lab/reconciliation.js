/* Ledger-authoritative CCL reconstruction. Pure functions are exposed for browser and Node validation. */
(function(root){
  const META={
    ABBV:['AbbVie','Healthcare','Core'],ABT:['Abbott Laboratories','Healthcare','Core'],BBY:['Best Buy','Consumer Discretionary','Tactical'],
    BFB:['Brown-Forman','Consumer Staples','Core'],CVX:['Chevron','Energy','Core'],DUK:['Duke Energy','Utilities','Core'],
    F:['Ford','Consumer Discretionary','Tactical'],HPQ:['HP Inc.','Information Technology','Tactical'],JNJ:['Johnson & Johnson','Healthcare','Core'],
    KHC:['Kraft Heinz','Consumer Staples','Tactical'],KMB:['Kimberly-Clark','Consumer Staples','Core'],KO:['Coca-Cola','Consumer Staples','Core'],
    O:['Realty Income','REITs','Core'],PFE:['Pfizer','Healthcare','Review'],PG:['Procter & Gamble','Consumer Staples','Core'],
    SCHD:['Schwab U.S. Dividend Equity ETF','Benchmark','Benchmark'],T:['AT&T','Communication Services','Review'],
    TROW:['T. Rowe Price','Financials','Bullpen'],VZ:['Verizon','Communication Services','Tactical'],WMT:['Walmart','Consumer Staples','Core']
  };
  const round=(n,p=2)=>{const f=10**p;return Math.round((Number(n)+Number.EPSILON)*f)/f};
  const sum=(rows,fn)=>rows.reduce((total,row)=>total+(Number(fn(row))||0),0);
  const keyOf=t=>`${t.account}|${t.ticker}`;
  const optionKey=s=>String(s||'').trim();
  function optionTerms(symbol){
    const match=String(symbol||'').match(/(\d{2})(\d{2})(\d{2})C([\d.]+)$/);
    if(!match)return{expiration:'',strike:''};
    return{expiration:`20${match[1]}-${match[2]}-${match[3]}`,strike:match[4]};
  }
  function effectiveSaleDate(t){
    const m=String(t.action||'').match(/AS OF (\d{2})-(\d{2})-(\d{2})/i);
    return m?`20${m[3]}-${m[1]}-${m[2]}`:t.date;
  }
  function dayDifference(start,end){
    if(!start||!end)return null;
    return Math.round((new Date(`${end}T12:00:00Z`)-new Date(`${start}T12:00:00Z`))/86400000);
  }
  function aggregateCalls(rows,key,label){
    const groups=new Map();
    for(const call of rows){
      const value=(typeof key==='function'?key(call):call[key])||label,group=groups.get(value)||{key:value,label:value,calls:[]};
      group.calls.push(call);groups.set(value,group);
    }
    const summarize=group=>{
      const calls=group.calls,resolved=calls.filter(c=>['expired','bought to close','assigned'].includes(c.outcome)),supported=calls.filter(c=>c.valueAdd!=null),realizedSupported=calls.filter(c=>c.outcome!=='open'&&c.valueAdd!=null),pricedCapital=calls.filter(c=>c.coveredCapital!=null),supportedAssignments=calls.filter(c=>c.outcome==='assigned'&&c.surrenderedUpside!=null),durationRows=calls.filter(c=>c.durationDays!=null);
      const grossPremium=sum(calls,c=>c.grossPremium),netPremium=sum(calls,c=>c.netOptionPremium),coveredCapital=sum(pricedCapital,c=>c.coveredCapital),pricedPremium=sum(pricedCapital,c=>c.netOptionPremium),supportedValueAdd=sum(supported,c=>c.valueAdd);
      return{key:group.key,label:group.label,callsWritten:calls.length,contracts:sum(calls,c=>c.contracts),grossPremium:round(grossPremium),netPremium:round(netPremium),optionExpenses:round(sum(calls,c=>c.optionExpenses)),actualOptionContribution:round(sum(calls,c=>c.actualOptionContribution)),openCalls:calls.filter(c=>c.outcome==='open').length,expiredCalls:calls.filter(c=>c.outcome==='expired').length,boughtToCloseCalls:calls.filter(c=>c.outcome==='bought to close').length,assignedCalls:calls.filter(c=>c.outcome==='assigned').length,unresolvedCalls:calls.filter(c=>c.outcome==='other/unresolved').length,expirationRate:resolved.length?round(calls.filter(c=>c.outcome==='expired').length/resolved.length*100,4):null,assignmentRate:resolved.length?round(calls.filter(c=>c.outcome==='assigned').length/resolved.length*100,4):null,averagePremiumPerCall:calls.length?round(netPremium/calls.length):null,averageDurationDays:durationRows.length?round(sum(durationRows,c=>c.durationDays)/durationRows.length,2):null,coveredCapital:pricedCapital.length?round(coveredCapital):null,premiumYieldPremium:pricedCapital.length?round(pricedPremium):null,premiumYieldPct:coveredCapital?round(pricedPremium/coveredCapital*100,4):null,pricedCapitalCalls:pricedCapital.length,realizedCallValueAdd:realizedSupported.length?round(sum(realizedSupported,c=>c.valueAdd)):null,realizedValueAddCoverageCalls:realizedSupported.length,surrenderedUpside:supportedAssignments.length?round(sum(supportedAssignments,c=>c.surrenderedUpside)):null,surrenderedUpsideCoverageAssignments:supportedAssignments.length,netCoveredCallValueAdd:supported.length?round(supportedValueAdd):null,valueAddCoverageCalls:supported.length,valueAddTotalCalls:calls.length};
    };
    return[...groups.values()].map(summarize);
  }
  function buildCallHierarchy(tx,market,cutoff){
    const events=[...tx].reverse().filter(t=>String(t.category).startsWith('call_')),queues=new Map(),calls=[];
    const queueKey=t=>`${t.account}|${optionKey(t.symbol)}`;
    for(const event of events){
      const key=queueKey(event),terms=optionTerms(event.symbol);
      if(event.category==='call_open'){
        const contracts=Math.abs(Number(event.quantity)),sameDayBuys=tx.filter(t=>t.account===event.account&&t.ticker===event.ticker&&t.date===event.date&&t.category==='stock_buy'),buyShares=sum(sameDayBuys,t=>t.quantity),buyCost=-sum(sameDayBuys,t=>t.amount),openingPrice=buyShares?buyCost/buyShares:null;
        const call={id:`${key}|${event.date}|${calls.length+1}`,symbol:event.symbol,account:event.account,ticker:event.ticker,contracts,remainingContracts:contracts,coveredShares:contracts*100,openDate:event.date,expirationDate:terms.expiration||null,strike:terms.strike?Number(terms.strike):null,grossPremium:Number(event.price)*contracts*100,netOpeningPremium:Number(event.amount),closingDebit:0,closingCashFlow:0,optionExpenses:Number(event.commission)+Number(event.fees),outcomeEvents:[],openingUnderlyingPrice:openingPrice==null?null:round(openingPrice,4),openingPriceEvidence:openingPrice==null?null:'Same-day stock purchase execution',outcome:'open'};
        calls.push(call);const queue=queues.get(key)||[];queue.push(call);queues.set(key,queue);
        continue;
      }
      let remaining=Math.abs(Number(event.quantity)),queue=queues.get(key)||[];
      for(const call of queue){
        if(remaining<=0)break;
        const allocated=Math.min(remaining,call.remainingContracts),share=allocated/Math.abs(Number(event.quantity)||allocated),cashFlow=Number(event.amount)*share,expenses=(Number(event.commission)+Number(event.fees))*share;
        call.remainingContracts-=allocated;remaining-=allocated;call.closingCashFlow+=cashFlow;call.closingDebit+=event.category==='call_close'?-cashFlow:0;call.optionExpenses+=expenses;call.outcomeEvents.push({category:event.category,date:event.date,contracts:allocated,amount:round(cashFlow)});
        if(call.remainingContracts<=1e-9)call.outcome=event.category==='call_expiration'?'expired':event.category==='call_assignment'?'assigned':event.category==='call_close'?'bought to close':'other/unresolved';
      }
      if(remaining>0)calls.push({id:`orphan|${key}|${event.date}`,symbol:event.symbol,account:event.account,ticker:event.ticker,contracts:remaining,remainingContracts:0,coveredShares:remaining*100,openDate:null,expirationDate:terms.expiration||null,strike:terms.strike?Number(terms.strike):null,grossPremium:0,netOpeningPremium:0,closingDebit:event.category==='call_close'?-Number(event.amount):0,closingCashFlow:Number(event.amount),optionExpenses:Number(event.commission)+Number(event.fees),outcomeEvents:[{category:event.category,date:event.date,contracts:remaining,amount:Number(event.amount)}],openingUnderlyingPrice:null,openingPriceEvidence:null,outcome:'other/unresolved'});
    }
    for(const call of calls){
      const terminal=call.outcomeEvents.at(-1),outcomeDate=call.outcome==='open'?cutoff:call.outcome==='bought to close'?(terminal?.date||null):(call.expirationDate||terminal?.date||null),marketPrice=outcomeDate?market.historicalPrices?.[call.ticker]?.[outcomeDate]:null,currentPrice=call.outcome==='open'?market.prices?.[call.ticker]:null,endPrice=Number(marketPrice??currentPrice),mark=market.optionMarks?.[call.symbol],openLiability=call.outcome==='open'&&Number.isFinite(mark?.ask)?-call.remainingContracts*100*Number(mark.ask):null;
      const assignmentSale=call.outcome==='assigned'?tx.find(t=>t.account===call.account&&t.ticker===call.ticker&&t.category==='assigned_stock_sale'&&effectiveSaleDate(t)===call.expirationDate):null,assignmentShares=assignmentSale?Math.abs(Number(assignmentSale.quantity)):0,assignmentProceeds=assignmentShares?Number(assignmentSale.amount)*(call.coveredShares/assignmentShares):null;
      call.endDate=outcomeDate;call.durationDays=dayDifference(call.openDate,outcomeDate);call.closingDebit=round(call.closingDebit);call.optionExpenses=round(call.optionExpenses);call.grossPremium=round(call.grossPremium);call.netOptionPremium=round(call.netOpeningPremium+call.closingCashFlow);call.openOptionLiability=openLiability==null?null:round(openLiability);call.actualOptionContribution=round(call.netOptionPremium+(openLiability||0));call.endingUnderlyingPrice=Number.isFinite(endPrice)&&endPrice>0?round(endPrice,4):null;call.endingPriceEvidence=marketPrice!=null?'Historical market close':currentPrice!=null?'Common-date market close':null;call.assignmentProceeds=assignmentProceeds==null?null:round(assignmentProceeds);call.assignmentExecutionPrice=assignmentSale?Number(assignmentSale.price):null;call.intrinsicValue=call.endingUnderlyingPrice!=null&&call.strike!=null?round(Math.max(0,call.endingUnderlyingPrice-call.strike)*call.coveredShares):null;call.surrenderedUpside=call.outcome==='assigned'?call.intrinsicValue:null;
      if(call.outcome==='expired'||call.outcome==='bought to close')call.valueAdd=call.netOptionPremium;
      else if(call.outcome==='assigned'&&call.surrenderedUpside!=null)call.valueAdd=round(call.netOptionPremium-call.surrenderedUpside);
      else if(call.outcome==='open'&&call.openOptionLiability!=null)call.valueAdd=round(call.netOptionPremium+call.openOptionLiability);
      else call.valueAdd=null;
      call.valueAddEvidence=call.outcome==='expired'?'Ledger expiration; uncovered shares have no option cash flow':call.outcome==='bought to close'?'Ledger opening and closing cash flows':call.outcome==='assigned'&&call.valueAdd!=null?'Ledger premium less market-close intrinsic value':call.outcome==='open'&&call.valueAdd!=null?'Ledger premium plus observable ask-side option liability':'Insufficient market evidence';
      if(call.outcome==='expired')call.assessment=call.netOptionPremium>=0?'Expired profitably':'Expired with a net option loss';
      else if(call.outcome==='bought to close')call.assessment=call.netOptionPremium>=0?'Closed profitably':'Closed unprofitably';
      else if(call.outcome==='assigned'&&call.surrenderedUpside!=null)call.assessment=call.surrenderedUpside>call.netOptionPremium?'Assignment surrendered upside exceeding premium':'Assignment premium offset supported surrendered upside';
      else if(call.outcome==='assigned')call.assessment='Assigned; uncovered comparison unavailable';
      else if(call.outcome==='open'&&call.valueAdd!=null)call.assessment=call.valueAdd>=0?'Open call currently adds marked value':'Open call currently shows marked drag';
      else call.assessment='Other or unresolved';
      if(call.openingUnderlyingPrice!=null&&call.endingUnderlyingPrice!=null&&call.endingUnderlyingPrice<call.openingUnderlyingPrice&&call.actualOptionContribution>0)call.assessment='Option income reduced an underlying loss';
      call.coveredCapital=call.openingUnderlyingPrice==null?null:round(call.openingUnderlyingPrice*call.coveredShares);
    }
    const byTicker=aggregateCalls(calls,'ticker','All tickers').sort((a,b)=>a.key.localeCompare(b.key)),byAccount=aggregateCalls(calls,'account','All accounts').sort((a,b)=>a.key.localeCompare(b.key)),total=aggregateCalls(calls,()=> 'Total CCL experiment','Total CCL experiment')[0];
    return{calls:[...calls].sort((a,b)=>(b.openDate||'').localeCompare(a.openDate||'')),byTicker,byAccount,total};
  }
  function buildCallCampaigns(tx,calls,analyses,cutoff){
    const groups=new Map();
    for(const call of calls){
      const key=`${call.account}|${call.ticker}`,group=groups.get(key)||{key,account:call.account,ticker:call.ticker,calls:[]};
      group.calls.push(call);groups.set(key,group);
    }
    return[...groups.values()].map(group=>{
      const calls=[...group.calls].sort((a,b)=>(a.openDate||'').localeCompare(b.openDate||'')),position=analyses.find(p=>p.account===group.account&&p.ticker===group.ticker),startDate=calls[0]?.openDate||null,hasOpen=calls.some(c=>c.outcome==='open'),resolvedEnds=calls.map(c=>c.endDate).filter(Boolean).sort(),endDate=hasOpen?null:(resolvedEnds.at(-1)||null),lastCalls=hasOpen?calls.filter(c=>c.outcome==='open'):calls.filter(c=>c.endDate===endDate),assignment=([...calls].reverse().find(c=>c.outcome==='assigned'))||null;
      const finalStatus=hasOpen?'Open':lastCalls.some(c=>c.outcome==='assigned')?'Called Away':position?.status==='Closed'?'Closed':'Calls Ended';
      const openCalls=calls.filter(c=>c.outcome==='open');
      let stockGL=null,stockGLEvidence='Stock basis or current value is unavailable';
      if(position){
        if(position.shares<=0){stockGL=round(position.realizedEquity);stockGLEvidence='Authoritative realized stock sale or assignment economics'}
        else if(position.currentPrice!=null){
          let sharesToValue=position.shares,cappedValue=0,capSupported=true;
          for(const call of openCalls){
            const covered=Math.min(sharesToValue,call.remainingContracts*100);
            if(covered<=0)continue;
            if(call.strike==null){capSupported=false;break}
            cappedValue+=Math.min(position.currentPrice,call.strike)*covered;sharesToValue-=covered;
          }
          if(capSupported){stockGL=round(position.realizedEquity+cappedValue+position.currentPrice*sharesToValue-position.remainingCost);stockGLEvidence=openCalls.length?'FIFO stock basis; covered shares valued at the lower of current price or active strike':'FIFO stock basis and current market value; no active call cap'}
        }
      }
      const through=endDate||cutoff,dividends=round(sum(tx.filter(t=>t.account===group.account&&t.ticker===group.ticker&&t.category==='dividend'&&t.date>=startDate&&t.date<=through),t=>t.amount));
      const openLiability=openCalls.length&&openCalls.every(c=>c.openOptionLiability!=null)?round(sum(openCalls,c=>c.openOptionLiability)):openCalls.length?null:0,currentCostToClose=openLiability==null?null:round(-openLiability),netPremium=round(sum(calls,c=>c.netOptionPremium));
      const actualOptionContribution=round(sum(calls,c=>c.actualOptionContribution)),allValueAddSupported=calls.every(c=>c.valueAdd!=null),ccValueAdd=allValueAddSupported?round(sum(calls,c=>c.valueAdd)):null,allAssignmentsSupported=calls.filter(c=>c.outcome==='assigned').every(c=>c.surrenderedUpside!=null),surrenderedUpside=allAssignmentsSupported?round(sum(calls.filter(c=>c.outcome==='assigned'),c=>c.surrenderedUpside)):null,forensicStockGL=position?round(position.realizedEquity+position.unrealizedEquity):null,totalEconomics=forensicStockGL==null?null:round(forensicStockGL+dividends+actualOptionContribution),overallCCLGL=stockGL==null?null:round(stockGL+netPremium+dividends),buyHoldResult=totalEconomics!=null&&ccValueAdd!=null?round(totalEconomics-ccValueAdd):null;
      return{key:group.key,account:group.account,ticker:group.ticker,startDate,endDate,finalStatus,stockGL,stockGLEvidence,dividends,callsWritten:calls.length,contracts:sum(calls,c=>c.contracts),expiredCalls:calls.filter(c=>c.outcome==='expired').length,assignedCalls:calls.filter(c=>c.outcome==='assigned').length,openCalls:openCalls.length,boughtToCloseCalls:calls.filter(c=>c.outcome==='bought to close').length,unresolvedCalls:calls.filter(c=>c.outcome==='other/unresolved').length,grossPremium:round(sum(calls,c=>c.grossPremium)),netPremium,openLiability,currentCostToClose,assignmentDate:assignment?.endDate||null,assignmentStrike:assignment?.strike??null,surrenderedUpside,totalEconomics,overallCCLGL,buyHoldResult,ccValueAdd,valueAddSupportedCalls:calls.filter(c=>c.valueAdd!=null).length,calls};
    }).sort((a,b)=>a.ticker.localeCompare(b.ticker)||a.startDate.localeCompare(b.startDate));
  }
  function derive({ledger,market,benchmarks,cutoff='2026-09-04',baselineDate='2026-03-31'}){
    const all=ledger.transactions||[],tx=all.filter(t=>t.date<=cutoff&&!t.pending),chronological=[...tx].reverse();
    const positions=new Map(),contracts=new Map();
    const getPosition=t=>{
      const key=keyOf(t);if(!positions.has(key))positions.set(key,{key,account:t.account,ticker:t.ticker,lots:[],shares:0,investedCapital:0,saleProceeds:0,realizedEquity:0,dividends:0,grossPremium:0,netOptionPremium:0,closingDebits:0,optionExpenses:0,callsWritten:0,contractsWritten:0,expirations:0,assignments:0,firstPurchaseDate:null,lastEventDate:null,exitDate:null,monthlyPremiums:{}});
      return positions.get(key);
    };
    for(const t of chronological){
      if(!t.ticker&&t.category!=='interest'&&t.category!=='deposit')continue;
      const p=t.ticker?getPosition(t):null;if(p)p.lastEventDate=t.date;
      if(t.category==='stock_buy'){
        const qty=Number(t.quantity),cost=-Number(t.amount);p.shares+=qty;p.investedCapital+=cost;p.firstPurchaseDate=p.firstPurchaseDate||t.date;p.lots.push({qty,unitCost:cost/qty});
      }else if(t.category==='stock_sale'||t.category==='assigned_stock_sale'){
        let qty=Math.abs(Number(t.quantity)),cost=0;
        while(qty>0&&p.lots.length){const lot=p.lots[0],used=Math.min(qty,lot.qty);cost+=used*lot.unitCost;lot.qty-=used;qty-=used;if(lot.qty<=1e-9)p.lots.shift()}
        p.shares+=Number(t.quantity);p.saleProceeds+=Number(t.amount);p.realizedEquity+=Number(t.amount)-cost;p.exitDate=effectiveSaleDate(t);
      }else if(t.category==='dividend')p.dividends+=Number(t.amount);
      else if(t.category==='call_open'||t.category==='call_close'){
        const symbol=optionKey(t.symbol),c=contracts.get(symbol)||{symbol,account:t.account,ticker:t.ticker,qty:0,premium:0,expirationEvents:0,assignmentEvents:0};
        c.qty+=Number(t.quantity);c.premium+=Number(t.amount);contracts.set(symbol,c);
        p.netOptionPremium+=Number(t.amount);p.optionExpenses+=Number(t.commission)+Number(t.fees);
        if(t.category==='call_open'){p.grossPremium+=Number(t.price)*Math.abs(Number(t.quantity))*100;p.callsWritten++;p.contractsWritten+=Math.abs(Number(t.quantity));p.monthlyPremiums[t.date.slice(0,7)]=(p.monthlyPremiums[t.date.slice(0,7)]||0)+Number(t.amount)}else p.closingDebits+=-Number(t.amount);
      }else if(t.category==='call_expiration'){
        const symbol=optionKey(t.symbol),c=contracts.get(symbol)||{symbol,account:t.account,ticker:t.ticker,qty:0,premium:0,expirationEvents:0,assignmentEvents:0};c.qty+=Number(t.quantity);c.expirationEvents++;contracts.set(symbol,c);p.expirations++;
      }else if(t.category==='call_assignment'){
        const symbol=optionKey(t.symbol),c=contracts.get(symbol)||{symbol,account:t.account,ticker:t.ticker,qty:0,premium:0,expirationEvents:0,assignmentEvents:0};c.qty+=Number(t.quantity);c.assignmentEvents++;contracts.set(symbol,c);p.assignments++;
      }
    }
    const callHierarchy=buildCallHierarchy(tx,market,cutoff);
    const openOptions=[...contracts.values()].filter(c=>c.qty<0).map(c=>{const mark=market.optionMarks[c.symbol]||{},terms=optionTerms(c.symbol),liability=Number.isFinite(mark.ask)?-Math.abs(c.qty)*100*mark.ask:null;return{account:c.account,ticker:c.ticker,contract:c.symbol,description:`${c.ticker} ${terms.expiration} $${terms.strike} call`,qty:c.qty,last:mark.ask??null,liability,gl:liability==null?null:c.premium+liability,gl_pct:c.premium&&liability!=null?(c.premium+liability)/c.premium*100:null,cost:c.premium,expiration:terms.expiration,strike:terms.strike,...mark}});
    const openByPosition=new Map();for(const o of openOptions)openByPosition.set(`${o.account}|${o.ticker}`,(openByPosition.get(`${o.account}|${o.ticker}`)||0)+(o.liability||0));
    const analyses=[...positions.values()].filter(p=>p.investedCapital>0).map(p=>{
      const meta=META[p.ticker]||[p.ticker,'Unclassified','Review'],remainingCost=sum(p.lots,l=>l.qty*l.unitCost),price=Number(market.prices[p.ticker]),currentEquityValue=p.shares>0&&price?price*p.shares:0,unrealizedEquity=currentEquityValue-remainingCost,optionLiability=openByPosition.get(p.key)||0;
      const actualResult=p.realizedEquity+unrealizedEquity+p.dividends+p.netOptionPremium+optionLiability;
      const exitPrice=p.exitDate&&market.historicalPrices?.[p.ticker]?.[p.exitDate];
      const totalPurchasedShares=chronological.filter(t=>t.account===p.account&&t.ticker===p.ticker&&t.category==='stock_buy').reduce((n,t)=>n+Number(t.quantity),0);
      const lifecycleBuyHoldResult=p.shares>0?unrealizedEquity+p.dividends:(exitPrice?exitPrice*totalPurchasedShares-p.investedCapital+p.dividends:null);
      const currentBuyHoldResult=price?price*totalPurchasedShares-p.investedCapital+p.dividends:null;
      const comparableBuyHoldResult=p.shares>0?currentBuyHoldResult:lifecycleBuyHoldResult;
      return{...p,name:meta[0],sector:meta[1],bucket:meta[2],status:p.shares>0?'Open':'Closed',shares:round(p.shares,4),investedCapital:round(p.investedCapital),remainingCost:round(remainingCost),saleProceeds:round(p.saleProceeds),realizedEquity:round(p.realizedEquity),currentPrice:price||null,currentEquityValue:round(currentEquityValue),unrealizedEquity:round(unrealizedEquity),dividends:round(p.dividends),grossPremium:round(p.grossPremium),closingDebits:round(p.closingDebits),netOptionPremium:round(p.netOptionPremium),optionExpenses:round(p.optionExpenses),optionLiability:round(optionLiability),totalEconomicIncome:round(p.dividends+p.netOptionPremium),actualResult:round(actualResult),actualReturnPct:round(actualResult/p.investedCapital*100,4),buyHoldLifecycleEnd:p.shares>0?cutoff:p.exitDate,buyHoldLifecycleResult:lifecycleBuyHoldResult==null?null:round(lifecycleBuyHoldResult),buyHoldCurrentResult:currentBuyHoldResult==null?null:round(currentBuyHoldResult),coveredCallValueAdd:comparableBuyHoldResult==null?null:round(actualResult-comparableBuyHoldResult),coveredCallValueAddPct:comparableBuyHoldResult==null?null:round((actualResult-comparableBuyHoldResult)/p.investedCapital*100,4),postExitOpportunityCost:p.shares===0&&currentBuyHoldResult!=null&&lifecycleBuyHoldResult!=null?round(currentBuyHoldResult-lifecycleBuyHoldResult):null,monthlyPremiums:Object.entries(p.monthlyPremiums).map(([month,premium])=>({month,premium:round(premium)}))};
    });
    const callCampaigns=buildCallCampaigns(tx,callHierarchy.calls,analyses,cutoff);
    const current=analyses.filter(p=>p.status==='Open');
    const accounts=ledger.accounts.map(info=>{
      const accountTx=tx.filter(t=>t.account===info.alias),ps=analyses.filter(p=>p.account===info.alias),os=openOptions.filter(o=>o.account===info.alias),latestCash=accountTx.find(t=>t.cash!=null)?.cash||0,stockVal=sum(ps,p=>p.currentEquityValue),optionValue=sum(os,o=>o.liability||0);
      return{alias:info.alias,total:round(stockVal+latestCash+optionValue),cash:round(latestCash),stock_val:round(stockVal),opt_val:round(optionValue),stock_gl:round(sum(ps,p=>p.unrealizedEquity)),opt_gl:round(sum(os,o=>o.gl||0)),premiums:round(sum(ps,p=>p.netOptionPremium)),gross_premiums:round(sum(ps,p=>p.grossPremium)),option_expenses:round(sum(ps,p=>p.optionExpenses)),dividends:round(sum(ps,p=>p.dividends)),interest:round(sum(accountTx.filter(t=>t.category==='interest'),t=>t.amount)),deposits:round(sum(accountTx.filter(t=>t.category==='deposit'),t=>t.amount)),purchases:round(sum(ps,p=>p.investedCapital)),sales:round(sum(ps,p=>p.saleProceeds)),transactions:accountTx.length,realized_sale_gains:round(sum(ps,p=>p.realizedEquity))};
    });
    const beforeBaseline=all.filter(t=>t.date<baselineDate),openingByAccount=ledger.accounts.map(a=>{const prior=beforeBaseline.filter(t=>t.account===a.alias&&t.cash!=null);return prior[0]?.cash||0}),laterDeposits=tx.filter(t=>t.category==='deposit'&&t.date>=baselineDate),capitalBase=round(sum(openingByAccount,x=>x)+sum(laterDeposits,t=>t.amount));
    const combined={alias:'Combined Household',total:round(sum(accounts,a=>a.total)),cash:round(sum(accounts,a=>a.cash)),stock_val:round(sum(accounts,a=>a.stock_val)),opt_val:round(sum(accounts,a=>a.opt_val)),stock_gl:round(sum(accounts,a=>a.stock_gl)),opt_gl:round(sum(accounts,a=>a.opt_gl)),premiums:round(sum(accounts,a=>a.premiums)),gross_premiums:round(sum(accounts,a=>a.gross_premiums)),option_expenses:round(sum(accounts,a=>a.option_expenses)),dividends:round(sum(accounts,a=>a.dividends)),interest:round(sum(accounts,a=>a.interest)),deposits:round(sum(accounts,a=>a.deposits)),purchases:round(sum(accounts,a=>a.purchases)),sales:round(sum(accounts,a=>a.sales)),transactions:tx.length,realized_sale_gains:round(sum(accounts,a=>a.realized_sale_gains)),return_baseline:capitalBase,fees:0,optionMtmAvailable:openOptions.every(o=>o.liability!=null)};
    combined.strategy_total_return=round(combined.stock_gl+combined.realized_sale_gains+combined.premiums+combined.dividends+combined.interest+combined.opt_val);combined.strategy_return_pct=round(combined.strategy_total_return/capitalBase*100,4);
    const holdings=current.map(p=>({account:p.account,ticker:p.ticker,name:p.name,sector:p.sector,bucket:p.bucket,shares:p.shares,price:p.currentPrice,value:p.currentEquityValue,cost:p.remainingCost,stock_gl:p.unrealizedEquity,stock_gl_pct:p.remainingCost?round(p.unrealizedEquity/p.remainingCost*100,4):0,premiums:p.netOptionPremium,dividends:p.dividends,option_gl:round(p.netOptionPremium+p.optionLiability),option_liability:p.optionLiability,fidelity_gap:round(p.netOptionPremium+p.dividends),true_mtm:p.actualResult,percent:stockValPercent(p.currentEquityValue,current)}));
    const historyEpisodes=analyses.map((p,i)=>({ticker:p.ticker,displayTicker:p.ticker,episodeId:`${p.account}-${p.ticker}-${i}`,account:p.account,sector:p.sector,bucket:p.bucket,ownedValue:p.currentEquityValue,stockGL:p.unrealizedEquity,premiums:p.netOptionPremium,dividends:p.dividends,interest:0,fees:p.optionExpenses,realizedSaleGains:p.realizedEquity,totalContribution:p.actualResult,callsSold:p.callsWritten,callsExpired:p.expirations,assignments:p.assignments,buyAmount:p.investedCapital,saleAmount:p.saleProceeds,firstDate:p.firstPurchaseDate,lastDate:p.lastEventDate,monthlyPremiums:p.monthlyPremiums,current:p.status==='Open',heldFrom:p.firstPurchaseDate,heldTo:p.status==='Open'?null:p.exitDate,exitDisposition:p.status==='Open'?'Current':(p.assignments?'Called Away':'Sold / Exited')}));
    const benchmarkSnapshots=(benchmarks.securities||[]).map(b=>{const shares=capitalBase/b.start,totalPct=(b.end/b.start-1)*100+(b.indexTotalReturn?0:sum(b.distributions||[],x=>x)/b.start*100),totalDollars=capitalBase*totalPct/100;if(b.indexTotalReturn)return{...b,inceptionPrice:b.start,currentPrice:b.end,baselineInvestment:capitalBase,shares:null,priceReturnDollars:null,incomeGenerated:null,totalReturnDollars:round(totalDollars),priceReturnPct:null,incomeYieldPct:null,totalReturnPct:round(totalPct,4),endingValue:round(capitalBase+totalDollars),returnComponentsAvailable:false};const distributionPerShare=sum(b.distributions||[],x=>x),priceDollars=(b.end-b.start)*shares,income=distributionPerShare*shares;return{...b,inceptionPrice:b.start,currentPrice:b.end,distributionPerShare,distributionNote:`Cash distributions with ex-dates ${baselineDate} through ${cutoff}; not reinvested.`,baselineInvestment:capitalBase,shares,priceReturnDollars:round(priceDollars),incomeGenerated:round(income),totalReturnDollars:round(priceDollars+income),priceReturnPct:round(priceDollars/capitalBase*100,4),incomeYieldPct:round(income/capitalBase*100,4),totalReturnPct:round((priceDollars+income)/capitalBase*100,4),endingValue:round(capitalBase+priceDollars+income),returnComponentsAvailable:true}});
    return{cutoff,baselineDate,tx,accounts,combined,holdings,options:openOptions,callHierarchy,callCampaigns,positionAnalysis:analyses,historyEpisodes,benchmarkSnapshots};
  }
  function stockValPercent(value,rows){const total=sum(rows,r=>r.currentEquityValue);return total?round(value/total*100,4):0}
  root.CCLReconciliation={derive,META,round};
})(typeof window!=='undefined'?window:globalThis);
