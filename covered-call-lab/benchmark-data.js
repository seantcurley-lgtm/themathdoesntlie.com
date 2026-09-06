/* Frozen common-period market evidence. ETF closes/distributions use Yahoo Finance chart data.
   All comparisons end 2026-09-04. */
window.CCL_MARKET_SNAPSHOT={
  asOf:'2026-09-04',
  priceSource:'Yahoo Finance daily unadjusted close',
  optionSource:'Cboe delayed options API; short calls marked at ask (buy-to-close cost)',
  prices:{KO:88.07,PFE:28.45,WMT:107.14,HPQ:32.64,BBY:90.27,BFB:26.73,SCHD:34.80,KHC:24.85,ABBV:256.46,DUK:120.22},
  historicalPrices:{PFE:{'2026-08-28':27.96}},
  optionMarks:{
    '-KO260925C91':{opra:'KO260925C00091000',bid:.30,ask:.36,last:.34,theo:.3442,timestamp:'2026-09-04T15:55:26'},
    '-WMT260925C110':{opra:'WMT260925C00110000',bid:1.11,ask:1.17,last:1.13,theo:1.1257,timestamp:'2026-09-04T15:59:26'},
    '-HPQ260925C32.5':{opra:'HPQ260925C00032500',bid:1.08,ask:1.59,last:1.20,theo:1.3134,timestamp:'2026-09-04T14:55:37'},
    '-BBY260925C85':{opra:'BBY260925C00085000',bid:4.70,ask:6.30,last:4.75,theo:5.8421,timestamp:'2026-09-02T15:08:28'},
    '-BFB260918C27.5':{opra:'BFB260918C00027500',bid:.20,ask:.40,last:.33,theo:.3351,timestamp:'2026-09-04T15:51:59'},
    '-KHC260925C27':{opra:'KHC260925C00027000',bid:.04,ask:.14,last:.14,theo:.1117,timestamp:'2026-09-04T12:56:19'},
    '-ABBV260925C265':{opra:'ABBV260925C00265000',bid:2.08,ask:2.75,last:2.50,theo:2.5959,timestamp:'2026-09-04T15:50:42'},
    '-DUK260918C125':{opra:'DUK260918C00125000',bid:.35,ask:.50,last:.45,theo:.4619,timestamp:'2026-09-03T15:33:03'}
  }
};

window.CCL_BENCHMARK_DATA={
  baselineDate:'2026-03-31',commonEndDate:'2026-09-04',
  convention:'Buy at the March 31 official close; hold fixed shares; add cash distributions with ex-dates through September 4; no distribution reinvestment.',
  marketDataSource:'Yahoo Finance chart API (unadjusted closes and distribution events)',
  identities:{
    JEPI:{issuer:'J.P. Morgan Asset Management',kind:'Live ETF',inception:'2020-05-20',source:'https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-etf-shares-46641q332'},
    JEPQ:{issuer:'J.P. Morgan Asset Management',kind:'Live ETF',inception:'2022-05-03',source:'https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-nasdaq-equity-premium-income-etf-etf-shares-46654q203'},
    QQQI:{issuer:'NEOS Investments',kind:'Live ETF',inception:'2024-01-29',source:'https://neosfunds.com/qqqi/'},
    SPYI:{issuer:'NEOS Investments',kind:'Live ETF',inception:'2022-08-29',source:'https://neosfunds.com/spyi/'},
    PBP:{issuer:'Invesco',kind:'Live ETF',inception:'2007-12-20',source:'https://www.invesco.com/us/financial-products/etfs/product-detail?audienceType=Investor&productId=ETF-PBP'},
    XYLD:{issuer:'Global X',kind:'Live ETF',inception:'2013-06-24',source:'https://www.globalxetfs.com/funds/xyld'},
    QYLD:{issuer:'Global X',kind:'Live ETF',inception:'2013-12-11',source:'https://www.globalxetfs.com/funds/qyld'}
  },
  securities:[
    {ticker:'SPY',name:'S&P 500',proxy:'SPY',category:'Growth',purpose:'Broad market control',start:650.3400268554688,end:770.1900024414062,distributions:[1.904]},
    {ticker:'QQQ',name:'Nasdaq-100',proxy:'QQQ',category:'Growth',purpose:'Tech/growth-heavy control',start:577.1799926757812,end:718.9600219726562,distributions:[.813]},
    {ticker:'DIA',name:'Dow Jones Industrial Average',proxy:'DIA',category:'Growth',purpose:'Blue-chip index control',start:463.19000244140625,end:534.0800170898438,distributions:[.206,.276,1.405,.149,.437]},
    {ticker:'SCHD',name:'Schwab U.S. Dividend Equity ETF',proxy:'SCHD',category:'Cash Flow',purpose:'Quality dividend ETF benchmark',start:30.68000030517578,end:34.79999923706055,distributions:[.253]},
    {ticker:'SPYI',name:'NEOS S&P 500 High Income ETF',proxy:'SPYI',category:'Cash Flow',purpose:'S&P 500 option-income ETF',start:49.369998931884766,end:53.86000061035156,distributions:[.525,.535,.531,.530,.542]},
    {ticker:'JEPI',name:'JPMorgan Equity Premium Income ETF',proxy:'JEPI',category:'Cash Flow',purpose:'Defensive equity and option-income ETF',start:56.68000030517578,end:57.220001220703125,distributions:[.421,.448,.389,.387,.367,.371]},
    {ticker:'JEPQ',name:'JPMorgan Nasdaq Equity Premium Income ETF',proxy:'JEPQ',category:'Cash Flow',purpose:'Nasdaq-oriented option-income ETF',start:55.52000045776367,end:59.869998931884766,distributions:[.559,.591,.564,.637,.705,.683]},
    {ticker:'QQQI',name:'NEOS Nasdaq-100 High Income ETF',proxy:'QQQI',category:'Cash Flow',purpose:'Nasdaq-100 option-income ETF',start:49.689998626708984,end:54.75,distributions:[.630,.659,.657,.635,.652]},
    {ticker:'PBP',name:'Invesco S&P 500 BuyWrite ETF',proxy:'PBP',category:'Cash Flow',purpose:'Live S&P 500 buy-write ETF',start:21.989999771118164,end:23.3700008392334,distributions:[.214,.205,.228,.187,.221]},
    {ticker:'XYLD',name:'Global X S&P 500 Covered Call ETF',proxy:'XYLD',category:'Cash Flow',purpose:'Live S&P 500 covered-call ETF',start:39.130001068115234,end:41.65999984741211,distributions:[.352,.401,.340,.409,.311]},
    {ticker:'QYLD',name:'Global X Nasdaq 100 Covered Call ETF',proxy:'QYLD',category:'Cash Flow',purpose:'Live Nasdaq-100 covered-call ETF',start:17.149999618530273,end:18.360000610351562,distributions:[.179,.179,.185,.178,.183]},
    {ticker:'BND',name:'Total Bond Market',proxy:'BND',category:'Capital Preservation',purpose:'Broad bond market',start:73.63999938964844,end:71.94999694824219,distributions:[.250,.242,.247,.244,.252,.253]}
  ],
  regimes:[
    {name:'Dot-com bear',start:'2000-03-24',end:'2002-10-09',historyType:'S&P 500 total-return index',SP500TR:-47.3772},
    {name:'Financial crisis',start:'2007-10-09',end:'2009-03-09',historyType:'S&P 500 total-return index; PBP partial live history from 2007-12-27',SP500TR:-55.2502,PBP:-40.2768},
    {name:'Post-2009 bull',start:'2009-03-09',end:'2020-02-19',historyType:'S&P 500 total-return index plus available live ETF history; XYLD/QYLD are partial since launch',SP500TR:528.8784,PBP:176.2586,XYLD:83.5711,QYLD:67.4241},
    {name:'COVID crash',start:'2020-02-19',end:'2020-03-23',historyType:'S&P 500 total-return index and live ETF history',SP500TR:-33.7905,PBP:-33.3146,XYLD:-33.4555,QYLD:-23.9559},
    {name:'COVID recovery',start:'2020-03-23',end:'2021-12-31',historyType:'S&P 500 total-return index and live ETF history',SP500TR:119.0306,PBP:69.4885,XYLD:71.6259,QYLD:53.0573},
    {name:'2022 bear',start:'2022-01-03',end:'2022-10-12',historyType:'S&P 500 total-return index and live ETF history',SP500TR:-24.4916,PBP:-17.5461,XYLD:-17.6219,QYLD:-23.9642},
    {name:'Subsequent bull',start:'2022-10-12',end:'2026-09-04',historyType:'S&P 500 total-return index and live ETF history',SP500TR:127.9427,PBP:71.4872,XYLD:67.8567,QYLD:91.0713}
  ]
};
