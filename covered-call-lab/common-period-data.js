/* Verified local review projection. Sources and definitions are carried with the data. */
window.CCL_COMMON_PERIOD_DATA = {
  "schema": "CCLCommonPeriod/v1",
  "version": "3.0.1-rc.6",
  "build": "CCL-FOS-20261106.6",
  "startDate": "2026-03-31",
  "endDate": "2026-11-03",
  "contributions": [
    {
      "date": "2026-03-31",
      "amount": 33600.69,
      "kind": "Initial capital: Portfolio A33594.78 + Portfolio B5.91 opening reserve",
      "timing": "March31close ETF purchase proxy"
    },
    {
      "date": "2026-04-10",
      "amount": 40435.98,
      "kind": "Portfolio B deposit",
      "timing": "April10close ETF purchase proxy"
    },
    {
      "date": "2026-10-28",
      "amount": 19428.3,
      "kind": "60 GOOGL noncash shares at observed entry market value, excluded from cash ledger",
      "timing": "October28close ETF purchase proxy"
    }
  ],
  "totalContributedCapital": 93464.97,
  "benchmarkInputs": [
    {
      "ticker": "SCHD",
      "prices": {
        "2026-03-31": 30.68000030517578,
        "2026-04-10": 30.559999465942383,
        "2026-10-28": 35.09000015258789,
        "2026-11-03": 35.54999923706055
      },
      "distributions": [
        {
          "exDate": "2026-06-24",
          "paymentDate": "2026-06-29",
          "amount": 0.2525,
          "source": "https://www.schwabassetmanagement.com/sites/g/files/eyrktu361/files/product_files/SCHD/SCHD_Fund_Distributions.CSV",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-09-23",
          "paymentDate": "2026-09-28",
          "amount": 0.2665,
          "source": "https://www.schwabassetmanagement.com/sites/g/files/eyrktu361/files/product_files/SCHD/SCHD_Fund_Distributions.CSV",
          "amountPrecision": "Exact source precision, as published by issuer."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": []
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": true,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/SCHD?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.217Z",
        "httpStatus": 200,
        "sha256": "cafec677bb90f80de2a3dff6046d5bf6107856c126c5c049e3ac631fbadef619",
        "bytes": 18099,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://www.schwabassetmanagement.com/sites/g/files/eyrktu361/files/product_files/SCHD/SCHD_Fund_Distributions.CSV",
        "evidence": {
          "sha256": "b429546f46d5e1b7a1c4c514995083354534d4e03b66fd26dcf11828b2ee02e5",
          "bytes": 2929,
          "fileLastWriteUtc": "2026-10-28T21:39:46.954893+00:00"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://www.schwabassetmanagement.com/sites/g/files/eyrktu361/files/product_files/SCHD/SCHD_Fund_Distributions.CSV",
          "sha256": "b429546f46d5e1b7a1c4c514995083354534d4e03b66fd26dcf11828b2ee02e5"
        },
        "qualification": "Archived issuer download last written October 28. Recovery of actual listed events only; no inferred absence after download date. Combine with later reviewed issuer coverage."
      }
    },
    {
      "ticker": "SPY",
      "prices": {
        "2026-03-31": 650.3400268554688,
        "2026-04-10": 679.4600219726562,
        "2026-10-28": 772.3099975585938,
        "2026-11-03": 754.3499755859375
      },
      "distributions": [
        {
          "exDate": "2026-06-18",
          "paymentDate": "2026-07-31",
          "amount": 1.903516,
          "source": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-09-18",
          "paymentDate": "2026-10-30",
          "amount": 1.888834,
          "source": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "amountPrecision": "Exact source precision, as published by issuer."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": []
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": true,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/SPY?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.260Z",
        "httpStatus": 200,
        "sha256": "ac0b59594d9b21cb5d53d5f86cad355736f49bb7cb7a81d646eaef830a42d448",
        "bytes": 17433,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
        "evidence": {
          "sha256": "6b65cbf956b5d25705d08470006a0e97e6a7d2a0d5cfd08b63f6f79783b06320",
          "bytes": 581216,
          "fileLastWriteUtc": "2026-10-28T21:40:21.238411+00:00"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "sha256": "4add18439e505ba6c114bea5d352ac68b1ea5420bc99abdf2e21500dd6f1faa2"
        },
        "qualification": "Archived issuer download last written October 28. Recovery of actual listed events only; no inferred absence after download date. Combine with later reviewed issuer coverage."
      }
    },
    {
      "ticker": "QQQ",
      "prices": {
        "2026-03-31": 577.1799926757812,
        "2026-04-10": 611.0700073242188,
        "2026-10-28": 725.6099853515625,
        "2026-11-03": 685.280029296875
      },
      "distributions": [
        {
          "exDate": "2026-06-22",
          "paymentDate": "2026-07-10",
          "amount": 0.81349,
          "source": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46090E103/distribution?idType=cusip&productType=ETF",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-09-21",
          "paymentDate": "2026-10-08",
          "amount": 0.75143,
          "source": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46090E103/distribution?idType=cusip&productType=ETF",
          "amountPrecision": "Exact source precision, as published by issuer."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": []
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": true,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/QQQ?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.261Z",
        "httpStatus": 200,
        "sha256": "1345745018d67766ef24ba72562a6b3345337f3fcff68fa1d1bb017a0e8fd096",
        "bytes": 17456,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46090E103/distribution?idType=cusip&productType=ETF",
        "evidence": {
          "sha256": "8cac48440d684d73a51016d1b98323b2ffd85a378bd82f987c43c807f0ae1aa2",
          "bytes": 27437,
          "fileLastWriteUtc": "2026-10-28T21:44:12.541218+00:00"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46090E103/distribution?idType=cusip&productType=ETF",
          "sha256": "8cac48440d684d73a51016d1b98323b2ffd85a378bd82f987c43c807f0ae1aa2"
        },
        "qualification": "Archived issuer download last written October 28. Recovery of actual listed events only; no inferred absence after download date. Combine with later reviewed issuer coverage."
      }
    },
    {
      "ticker": "DIA",
      "prices": {
        "2026-03-31": 463.19000244140625,
        "2026-04-10": 479.25,
        "2026-10-28": 524.6799926757812,
        "2026-11-03": 517.0599975585938
      },
      "distributions": [
        {
          "exDate": "2026-04-17",
          "paymentDate": "2026-05-11",
          "amount": 0.20624,
          "source": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-05-15",
          "paymentDate": "2026-06-15",
          "amount": 0.27559,
          "source": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-06-18",
          "paymentDate": "2026-07-13",
          "amount": 1.40542,
          "source": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-07-17",
          "paymentDate": "2026-08-17",
          "amount": 0.14866,
          "source": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-08-21",
          "paymentDate": "2026-09-14",
          "amount": 0.43702,
          "source": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-09-18",
          "paymentDate": "2026-10-13",
          "amount": 1.19242,
          "source": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-10-16",
          "paymentDate": "2026-11-16",
          "amount": 0.11404,
          "source": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "amountPrecision": "Exact source precision, as published by issuer."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": []
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": true,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/DIA?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.261Z",
        "httpStatus": 200,
        "sha256": "e53e9c145c9596af44331f3aec8b4cc39b295f281698ea50446f70095384e1ca",
        "bytes": 17727,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
        "evidence": {
          "sha256": "6b65cbf956b5d25705d08470006a0e97e6a7d2a0d5cfd08b63f6f79783b06320",
          "bytes": 581216,
          "fileLastWriteUtc": "2026-10-28T21:40:21.238411+00:00"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx",
          "sha256": "4add18439e505ba6c114bea5d352ac68b1ea5420bc99abdf2e21500dd6f1faa2"
        },
        "qualification": "Archived issuer download last written October 28. Recovery of actual listed events only; no inferred absence after download date. Combine with later reviewed issuer coverage."
      }
    },
    {
      "ticker": "SPYI",
      "prices": {
        "2026-03-31": 49.369998931884766,
        "2026-04-10": 51.11000061035156,
        "2026-10-28": 53.38999938964844,
        "2026-11-03": 52.349998474121094
      },
      "distributions": [
        {
          "exDate": "2026-04-22",
          "paymentDate": "2026-04-24",
          "amount": 0.5247,
          "source": "https://neosfunds.com/spyi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-05-20",
          "paymentDate": "2026-05-22",
          "amount": 0.5353,
          "source": "https://neosfunds.com/spyi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-06-16",
          "paymentDate": "2026-06-18",
          "amount": 0.531,
          "source": "https://neosfunds.com/spyi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-07-22",
          "paymentDate": "2026-07-24",
          "amount": 0.53,
          "source": "https://neosfunds.com/spyi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-08-19",
          "paymentDate": "2026-08-21",
          "amount": 0.5423,
          "source": "https://neosfunds.com/spyi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-09-16",
          "paymentDate": "2026-09-18",
          "amount": 0.5338,
          "source": "https://neosfunds.com/spyi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-10-21",
          "paymentDate": "2026-10-23",
          "amount": 0.5087,
          "source": "https://neosfunds.com/spyi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": []
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": true,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/SPYI?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.262Z",
        "httpStatus": 200,
        "sha256": "10bde76005bc7662300bc73451ee0d87b061d1653840646c02c900930d931ab9",
        "bytes": 18012,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://neosfunds.com/spyi/",
        "evidence": {
          "sha256": "65a7f9598b0b04ae5c5c698680ebe95cef9a1411d980d393ad4154b271c3097f",
          "bytes": 307923,
          "fileLastWriteUtc": "2026-10-28T21:39:49.827015+00:00"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://neosfunds.com/spyi/",
          "sha256": "acd63cb526b6c59ff6838f5c4ee1f53173964a072c0dc3e011232c199d00d51f"
        },
        "qualification": "Archived issuer download last written October 28. Recovery of actual listed events only; no inferred absence after download date. Combine with later reviewed issuer coverage."
      }
    },
    {
      "ticker": "JEPI",
      "prices": {
        "2026-03-31": 56.68000030517578,
        "2026-04-10": 57.540000915527344,
        "2026-10-28": 57.45000076293945,
        "2026-11-03": 57.33000183105469
      },
      "distributions": [
        {
          "exDate": "2026-04-01",
          "paymentDate": "2026-04-06",
          "amount": 0.4205,
          "source": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-05-01",
          "paymentDate": "2026-05-05",
          "amount": 0.44761,
          "source": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-06-01",
          "paymentDate": "2026-06-03",
          "amount": 0.38921,
          "source": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-07-01",
          "paymentDate": "2026-07-06",
          "amount": 0.38716,
          "source": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-08-03",
          "paymentDate": "2026-08-05",
          "amount": 0.36664,
          "source": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-09-01",
          "paymentDate": "2026-09-03",
          "amount": 0.37142,
          "source": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-10-01",
          "paymentDate": "2026-10-05",
          "amount": 0.34134,
          "source": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-11-02",
          "paymentDate": "2026-11-04",
          "amount": 0.34683,
          "source": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332",
          "amountPrecision": "Exact source precision, as published by issuer."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": []
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": true,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/JEPI?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.262Z",
        "httpStatus": 200,
        "sha256": "a5745e61d9e292267fbe06b6f0a6f17ada3a0014971b777fdef831c6537506d3",
        "bytes": 17905,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332",
        "evidence": {
          "sha256": "e36975c0653b9843e6a3b000ac92476d9c66a98de65e96dbd015cb9e0db46062",
          "bytes": 30995,
          "fileLastWriteUtc": "2026-11-06T15:38:43.737602+00:00"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332",
          "sha256": "03b8ffee5c7b26be25b6f145e1a550cf6d630480b32b29a35255ce838639330a"
        },
        "qualification": "Official extracted table includes November 2 amount; unpaid at Nov3."
      }
    },
    {
      "ticker": "JEPQ",
      "prices": {
        "2026-03-31": 55.52000045776367,
        "2026-04-10": 57.619998931884766,
        "2026-10-28": 60.060001373291016,
        "2026-11-03": 56.59000015258789
      },
      "distributions": [
        {
          "exDate": "2026-04-01",
          "paymentDate": "2026-04-06",
          "amount": 0.5586,
          "source": "https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=46654Q203&country=us&role=adv&userLoggedIn=false&language=en&version=9.19_1793249641",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-05-01",
          "paymentDate": "2026-05-05",
          "amount": 0.59095,
          "source": "https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=46654Q203&country=us&role=adv&userLoggedIn=false&language=en&version=9.19_1793249641",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-06-01",
          "paymentDate": "2026-06-03",
          "amount": 0.56444,
          "source": "https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=46654Q203&country=us&role=adv&userLoggedIn=false&language=en&version=9.19_1793249641",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-07-01",
          "paymentDate": "2026-07-06",
          "amount": 0.63658,
          "source": "https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=46654Q203&country=us&role=adv&userLoggedIn=false&language=en&version=9.19_1793249641",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-08-03",
          "paymentDate": "2026-08-05",
          "amount": 0.70497,
          "source": "https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=46654Q203&country=us&role=adv&userLoggedIn=false&language=en&version=9.19_1793249641",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-09-01",
          "paymentDate": "2026-09-03",
          "amount": 0.68255,
          "source": "https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=46654Q203&country=us&role=adv&userLoggedIn=false&language=en&version=9.19_1793249641",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-10-01",
          "paymentDate": "2026-10-05",
          "amount": 0.56687,
          "source": "https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=46654Q203&country=us&role=adv&userLoggedIn=false&language=en&version=9.19_1793249641",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-11-02",
          "paymentDate": "2026-11-04",
          "amount": 0.53922,
          "source": "https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=46654Q203&country=us&role=adv&userLoggedIn=false&language=en&version=9.19_1793249641",
          "amountPrecision": "Exact source precision, as published by issuer."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": []
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": true,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/JEPQ?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.263Z",
        "httpStatus": 200,
        "sha256": "b556edf3a5b251723ad16963e1a715cc0b765a3ab970364df47dc1a633bbab94",
        "bytes": 17908,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=46654Q203&country=us&role=adv&userLoggedIn=false&language=en&version=9.19_1793249641",
        "evidence": {
          "sha256": "fbb62d558240cd05f2ad746f3cb32e551ef7cf82809eff8f3631cbcfd7e487a5",
          "bytes": 462109,
          "sourceKind": "actual HTTP 200 public issuer API response"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-10-28",
          "sourceUrl": "https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-nasdaq-equity-premium-income-etf-46654q203/",
          "sha256": "9d76a676ac9d77c56259b09754eebdc25578a098a02ba646140be342852bdd61"
        },
        "qualification": "Full issuer distribution history retrieved November 6, filtered strictly to actual ex-dates after March 31 and on/before November 3. Amounts are exact source precision; no distributions inferred from absent entries."
      }
    },
    {
      "ticker": "QQQI",
      "prices": {
        "2026-03-31": 49.689998626708984,
        "2026-04-10": 51.939998626708984,
        "2026-10-28": 54.119998931884766,
        "2026-11-03": 51.310001373291016
      },
      "distributions": [
        {
          "exDate": "2026-04-22",
          "paymentDate": "2026-04-24",
          "amount": 0.6297,
          "source": "https://neosfunds.com/qqqi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-05-20",
          "paymentDate": "2026-05-22",
          "amount": 0.6589,
          "source": "https://neosfunds.com/qqqi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-06-16",
          "paymentDate": "2026-06-18",
          "amount": 0.6572,
          "source": "https://neosfunds.com/qqqi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-07-22",
          "paymentDate": "2026-07-24",
          "amount": 0.6346,
          "source": "https://neosfunds.com/qqqi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-08-19",
          "paymentDate": "2026-08-21",
          "amount": 0.6518,
          "source": "https://neosfunds.com/qqqi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-09-16",
          "paymentDate": "2026-09-18",
          "amount": 0.6339,
          "source": "https://neosfunds.com/qqqi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-10-21",
          "paymentDate": "2026-10-23",
          "amount": 0.6343,
          "source": "https://neosfunds.com/qqqi/",
          "amountPrecision": "Exact source precision, as published by issuer."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": []
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": true,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/QQQI?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.263Z",
        "httpStatus": 200,
        "sha256": "58408d5f04ffba47ab245c53f1495f28cea89c7b7384cd478b516eca3c6b0bdd",
        "bytes": 18014,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://neosfunds.com/qqqi/",
        "evidence": {
          "sha256": "2b9001bb0044436291c03251ed49788a885c30640ac6dceef7620817a2bf559a",
          "bytes": 285927,
          "fileLastWriteUtc": "2026-10-28T21:39:52.757765+00:00"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://neosfunds.com/qqqi/",
          "sha256": "647ef9ac6d20b693927c98a4f946f16aa2b969b2ca87f91192c3531e236ed958"
        },
        "qualification": "Archived issuer download last written October 28. Recovery of actual listed events only; no inferred absence after download date. Combine with later reviewed issuer coverage."
      }
    },
    {
      "ticker": "PBP",
      "prices": {
        "2026-03-31": 21.989999771118164,
        "2026-04-10": 22.389999389648438,
        "2026-10-28": 23.350000381469727,
        "2026-11-03": 23.049999237060547
      },
      "distributions": [
        {
          "exDate": "2026-04-20",
          "paymentDate": "2026-04-24",
          "amount": 0.21436,
          "source": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46137V399/distribution?idType=cusip&productType=ETF",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-05-18",
          "paymentDate": "2026-05-22",
          "amount": 0.20533,
          "source": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46137V399/distribution?idType=cusip&productType=ETF",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-06-22",
          "paymentDate": "2026-06-26",
          "amount": 0.2283,
          "source": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46137V399/distribution?idType=cusip&productType=ETF",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-07-20",
          "paymentDate": "2026-07-24",
          "amount": 0.18734,
          "source": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46137V399/distribution?idType=cusip&productType=ETF",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-08-24",
          "paymentDate": "2026-08-28",
          "amount": 0.22104,
          "source": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46137V399/distribution?idType=cusip&productType=ETF",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-09-21",
          "paymentDate": "2026-09-25",
          "amount": 0.18863,
          "source": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46137V399/distribution?idType=cusip&productType=ETF",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-10-19",
          "paymentDate": "2026-10-23",
          "amount": 0.1657,
          "source": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46137V399/distribution?idType=cusip&productType=ETF",
          "amountPrecision": "Exact source precision, as published by issuer."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": []
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": true,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/PBP?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.264Z",
        "httpStatus": 200,
        "sha256": "aa55813125a83f2e5bc388a839ceada3767a4822e0faf8371f855d4f97082c7e",
        "bytes": 17855,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46137V399/distribution?idType=cusip&productType=ETF",
        "evidence": {
          "sha256": "a11544f952528ae276923c1d32c960e78570feddf515332bca9f48b594c9ea8a",
          "bytes": 33760,
          "fileLastWriteUtc": "2026-10-28T21:43:43.542819+00:00"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/46137V399/distribution?idType=cusip&productType=ETF",
          "sha256": "a11544f952528ae276923c1d32c960e78570feddf515332bca9f48b594c9ea8a"
        },
        "qualification": "Archived issuer download last written October 28. Recovery of actual listed events only; no inferred absence after download date. Combine with later reviewed issuer coverage."
      }
    },
    {
      "ticker": "XYLD",
      "prices": {
        "2026-03-31": 39.130001068115234,
        "2026-04-10": 39.93000030517578,
        "2026-10-28": 41.61000061035156,
        "2026-11-03": 41.040000915527344
      },
      "distributions": [
        {
          "exDate": "2026-04-20",
          "paymentDate": "2026-04-23",
          "amount": 0.3522,
          "source": "https://www.globalxetfs.com/funds/xyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-05-18",
          "paymentDate": "2026-05-21",
          "amount": 0.4012,
          "source": "https://www.globalxetfs.com/funds/xyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-06-22",
          "paymentDate": "2026-06-25",
          "amount": 0.3403,
          "source": "https://www.globalxetfs.com/funds/xyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-07-20",
          "paymentDate": "2026-07-23",
          "amount": 0.4088,
          "source": "https://www.globalxetfs.com/funds/xyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-08-24",
          "paymentDate": "2026-08-27",
          "amount": 0.3109,
          "source": "https://www.globalxetfs.com/funds/xyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-09-21",
          "paymentDate": "2026-09-24",
          "amount": 0.2964,
          "source": "https://www.globalxetfs.com/funds/xyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-10-19",
          "paymentDate": "2026-10-22",
          "amount": 0.314,
          "source": "https://www.globalxetfs.com/funds/xyld/",
          "amountPrecision": "Original Yahoo Finance distribution event rounded to 0.001 USD per share; exact issuer amount not qualified for this month."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": [
          "Some distribution amounts are source-rounded; this ETF comparison is approximate."
        ]
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": false,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/XYLD?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.265Z",
        "httpStatus": 200,
        "sha256": "850fa0a44e2855ff72357c6a681c4d0c2dfff51c1bc88059eb8f24761121323a",
        "bytes": 17809,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://www.globalxetfs.com/funds/xyld/",
        "evidence": {
          "sha256": "14a6b2d577b2934766ede00d6742ec6c35cd8665e23cbf3daf510fd8dcbdbc0d",
          "bytes": 760313,
          "fileLastWriteUtc": "2026-10-28T21:39:57.888552+00:00"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://www.globalxetfs.com/funds/xyld/",
          "sha256": "f7132e2a2a47b64d3afbea7c489f9bcb281db4f5dc63f54c8b2ac88e713056e3"
        },
        "qualification": "Archived issuer download last written October 28. Recovery of actual listed events only; no inferred absence after download date. Combine with later reviewed issuer coverage."
      }
    },
    {
      "ticker": "QYLD",
      "prices": {
        "2026-03-31": 17.149999618530273,
        "2026-04-10": 17.600000381469727,
        "2026-10-28": 18.450000762939453,
        "2026-11-03": 17.770000457763672
      },
      "distributions": [
        {
          "exDate": "2026-04-20",
          "paymentDate": "2026-04-23",
          "amount": 0.1789,
          "source": "https://www.globalxetfs.com/funds/qyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-05-18",
          "paymentDate": "2026-05-21",
          "amount": 0.1785,
          "source": "https://www.globalxetfs.com/funds/qyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-06-22",
          "paymentDate": "2026-06-25",
          "amount": 0.1854,
          "source": "https://www.globalxetfs.com/funds/qyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-07-20",
          "paymentDate": "2026-07-23",
          "amount": 0.1775,
          "source": "https://www.globalxetfs.com/funds/qyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-08-24",
          "paymentDate": "2026-08-27",
          "amount": 0.1829,
          "source": "https://www.globalxetfs.com/funds/qyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-09-21",
          "paymentDate": "2026-09-24",
          "amount": 0.1767,
          "source": "https://www.globalxetfs.com/funds/qyld/",
          "amountPrecision": "Exact published per-share amount in issuer Section 19(a) notice. Tax composition estimates are separate from the stated per-share distribution amount."
        },
        {
          "exDate": "2026-10-19",
          "paymentDate": "2026-10-22",
          "amount": 0.183,
          "source": "https://www.globalxetfs.com/funds/qyld/",
          "amountPrecision": "Original Yahoo Finance distribution event rounded to 0.001 USD per share; exact issuer amount not qualified for this month."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": [
          "Some distribution amounts are source-rounded; this ETF comparison is approximate."
        ]
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": false,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/QYLD?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.265Z",
        "httpStatus": 200,
        "sha256": "5a66d65edb6171f620835271f6d3871778156dd48a861f3b29076f2a7462b5e4",
        "bytes": 18351,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://www.globalxetfs.com/funds/qyld/",
        "evidence": {
          "sha256": "4edc2aba61726f8f46bb3c62a421275376f9caffba84582ea1ffb2a60dfa4365",
          "bytes": 602686,
          "fileLastWriteUtc": "2026-10-28T21:40:00.334671+00:00"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://www.globalxetfs.com/funds/qyld/",
          "sha256": "72e4e176eaab708cfd4f40ea765b65d31af65ace02cc32708d192bcf3cf5bddf"
        },
        "qualification": "Archived issuer download last written October 28. Recovery of actual listed events only; no inferred absence after download date. Combine with later reviewed issuer coverage."
      }
    },
    {
      "ticker": "BND",
      "prices": {
        "2026-03-31": 73.63999938964844,
        "2026-04-10": 73.63999938964844,
        "2026-10-28": 71.19000244140625,
        "2026-11-03": 71.19999694824219
      },
      "distributions": [
        {
          "exDate": "2026-04-01",
          "paymentDate": "2026-04-06",
          "amount": 0.250016,
          "source": "https://advisors.vanguard.com/investments/products/api/funds/0928/pricing/distributions",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-05-01",
          "paymentDate": "2026-05-05",
          "amount": 0.241713,
          "source": "https://advisors.vanguard.com/investments/products/api/funds/0928/pricing/distributions",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-06-01",
          "paymentDate": "2026-06-03",
          "amount": 0.247259,
          "source": "https://advisors.vanguard.com/investments/products/api/funds/0928/pricing/distributions",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-07-01",
          "paymentDate": "2026-07-06",
          "amount": 0.24447,
          "source": "https://advisors.vanguard.com/investments/products/api/funds/0928/pricing/distributions",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-08-03",
          "paymentDate": "2026-08-05",
          "amount": 0.25155,
          "source": "https://advisors.vanguard.com/investments/products/api/funds/0928/pricing/distributions",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-09-01",
          "paymentDate": "2026-09-03",
          "amount": 0.252886,
          "source": "https://advisors.vanguard.com/investments/products/api/funds/0928/pricing/distributions",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-10-01",
          "paymentDate": "2026-10-05",
          "amount": 0.248502,
          "source": "https://advisors.vanguard.com/investments/products/api/funds/0928/pricing/distributions",
          "amountPrecision": "Exact source precision, as published by issuer."
        },
        {
          "exDate": "2026-11-02",
          "paymentDate": "2026-11-04",
          "amount": 0.256802,
          "source": "https://advisors.vanguard.com/investments/products/api/funds/0928/pricing/distributions",
          "amountPrecision": "Exact source precision, as published by issuer."
        }
      ],
      "coverage": {
        "qualified": true,
        "notes": []
      },
      "splits": [],
      "sourceNotes": [
        "Daily close purchases at contribution dates; fractional shares; no reinvestment.",
        "Price corporate-action stream checked: no split or capital-gain events returned in the period."
      ],
      "amountsExact": true,
      "priceSource": {
        "url": "https://query1.finance.yahoo.com/v8/finance/chart/BND?period1=1774828800&period2=1793750400&interval=1d&events=div%2Csplits%2CcapitalGains",
        "retrievedAt": "2026-11-06T15:40:16.266Z",
        "httpStatus": 200,
        "sha256": "83def8df912c56e88ed134d0caccbe998aa805717c946dc5a1fa698eba51db1d",
        "bytes": 17519,
        "field": "chart.result[0].indicators.quote[0].close"
      },
      "distributionSource": {
        "url": "https://advisors.vanguard.com/investments/products/api/funds/0928/pricing/distributions",
        "evidence": {
          "sha256": "9fc33d4c4f59aba1379ed8fead680870fb9567ce7cf07efa571ef092c7df5b6e",
          "bytes": 22054,
          "sourceKind": "actual HTTP 200 public issuer API response"
        },
        "laterCoverageEvidence": {
          "throughDay": "2026-11-05",
          "sourceUrl": "https://investor.vanguard.com/investment-products/etfs/profile/bnd",
          "sha256": "f0077fc8f1eb7e18015f32eea244deb3aa102d5c35abe6fe49bdde2186d96220"
        },
        "qualification": "Full issuer distribution history retrieved November 6, filtered strictly to actual ex-dates after March 31 and on/before November 3. Amounts are exact source precision; no distributions inferred from absent entries."
      }
    }
  ],
  "limitations": [
    "The strategy row is a recorded November 3 source-day estimate, before unreported WMT assignment fees.",
    "Option asks have source-day records with timestamps lacking an explicit timezone; they are not asserted to be simultaneous executable marks.",
    "The experiment dividend entitlement window has been audited. Known earned, unpaid dividends are included once in value and return, not cash.",
    "Benchmark distributions are earned by ex-date; amounts paid after November 3 are receivables, not cash.",
    "All percentages are profit divided by total contributed capital, not time-weighted returns. Contribution-date closes are explicit daily timing proxies."
  ],
  "recordedNAVBeforeReceivables": 103519.04,
  "earnedPeriodIncome": 9117.99,
  "valuationSnapshot": {
    "asOf": "2026-11-03",
    "ledgerThrough": "2026-11-03",
    "holdings": [
      {
        "account": "Portfolio A",
        "ticker": "GOOGL",
        "shares": 100,
        "reserved": 100,
        "available": 0,
        "name": "Alphabet Inc. (Class A)",
        "sector": "Communication Services",
        "bucket": "Review",
        "price": 280.03,
        "priceAsOf": "2026-11-03",
        "minimumMarketDate": "2026-10-28",
        "minimumMarketAt": null,
        "value": 28003,
        "cost": 31025.21,
        "stock_gl": -3022.21,
        "stock_gl_pct": -9.741142767446217,
        "premiums": 496.32,
        "dividends": 0,
        "option_gl": 464.32,
        "option_liability": -32,
        "fidelity_gap": 496.32,
        "true_mtm": -2557.89,
        "percent": null,
        "displayPriceAsOf": "2026-11-03",
        "displayPriceKind": "FOS source-day close",
        "priceReferenceKind": "FOS source-day close"
      },
      {
        "account": "Portfolio A",
        "ticker": "HPQ",
        "shares": 100,
        "reserved": 100,
        "available": 0,
        "name": "HP Inc.",
        "sector": "Information Technology",
        "bucket": "Tactical",
        "price": 28.27,
        "priceAsOf": "2026-11-03",
        "minimumMarketDate": "2026-08-31",
        "minimumMarketAt": null,
        "value": 2827,
        "cost": 3041,
        "stock_gl": -214,
        "stock_gl_pct": -7.037158829332456,
        "premiums": 223.02,
        "dividends": 30,
        "option_gl": 55.34,
        "option_liability": -55,
        "fidelity_gap": 253.02,
        "true_mtm": -15.98,
        "percent": null,
        "displayPriceAsOf": "2026-11-03",
        "displayPriceKind": "FOS source-day close",
        "priceReferenceKind": "FOS source-day close"
      },
      {
        "account": "Portfolio A",
        "ticker": "MDT",
        "shares": 100,
        "reserved": 100,
        "available": 0,
        "name": "Medtronic",
        "sector": "Health Care",
        "bucket": "Review",
        "price": 98.88,
        "priceAsOf": "2026-11-03",
        "minimumMarketDate": "2026-09-21",
        "minimumMarketAt": null,
        "value": 9888,
        "cost": 9174.99,
        "stock_gl": 713.01,
        "stock_gl_pct": 7.771234628048641,
        "premiums": 183.68,
        "dividends": 72,
        "option_gl": -12.66,
        "option_liability": -68,
        "fidelity_gap": 255.68,
        "true_mtm": 900.69,
        "percent": null,
        "displayPriceAsOf": "2026-11-03",
        "displayPriceKind": "FOS source-day close",
        "priceReferenceKind": "FOS source-day close"
      },
      {
        "account": "Portfolio A",
        "ticker": "WFC",
        "shares": 100,
        "reserved": 100,
        "available": 0,
        "name": "Wells Fargo",
        "sector": "Financials",
        "bucket": "Review",
        "price": 85.53,
        "priceAsOf": "2026-11-03",
        "minimumMarketDate": "2026-11-03",
        "minimumMarketAt": "2026-11-03T18:57:47.000Z",
        "value": 8553,
        "cost": 8547.99,
        "stock_gl": 5.01,
        "stock_gl_pct": 0.058610269782720846,
        "premiums": 94.34,
        "dividends": 0,
        "option_gl": -18.66,
        "option_liability": -113,
        "fidelity_gap": 94.34,
        "true_mtm": -13.65,
        "percent": null,
        "priceReferenceKind": "FOS source-day close",
        "priceReferenceAt": "2026-11-03T18:57:47.000Z",
        "displayPriceAsOf": "2026-11-03",
        "displayPriceKind": "FOS source-day close"
      },
      {
        "account": "Portfolio B",
        "ticker": "ACN",
        "shares": 100,
        "reserved": 100,
        "available": 0,
        "name": "Accenture",
        "sector": "Information Technology",
        "bucket": "Review",
        "price": 254.56,
        "priceAsOf": "2026-11-03",
        "minimumMarketDate": "2026-10-28",
        "minimumMarketAt": null,
        "value": 25456,
        "cost": 24526.5,
        "stock_gl": 929.5,
        "stock_gl_pct": 3.7897784029519093,
        "premiums": 644.32,
        "dividends": 0,
        "option_gl": -405.68,
        "option_liability": -1050,
        "fidelity_gap": 644.32,
        "true_mtm": 523.82,
        "percent": null,
        "displayPriceAsOf": "2026-11-03",
        "displayPriceKind": "FOS source-day close",
        "priceReferenceKind": "FOS source-day close"
      },
      {
        "account": "Portfolio B",
        "ticker": "DECK",
        "shares": 100,
        "reserved": 100,
        "available": 0,
        "name": "Deckers Brands",
        "sector": "Consumer Discretionary",
        "bucket": "Review",
        "price": 84.09,
        "priceAsOf": "2026-11-03",
        "minimumMarketDate": "2026-10-28",
        "minimumMarketAt": null,
        "value": 8409,
        "cost": 8009,
        "stock_gl": 400,
        "stock_gl_pct": 4.994381321013859,
        "premiums": 173.34,
        "dividends": 0,
        "option_gl": -146.66,
        "option_liability": -320,
        "fidelity_gap": 173.34,
        "true_mtm": 253.34,
        "percent": null,
        "displayPriceAsOf": "2026-11-03",
        "displayPriceKind": "FOS source-day close",
        "priceReferenceKind": "FOS source-day close"
      },
      {
        "account": "Portfolio B",
        "ticker": "KHC",
        "shares": 200,
        "reserved": 200,
        "available": 0,
        "name": "Kraft Heinz",
        "sector": "Consumer Staples",
        "bucket": "Tactical",
        "price": 24.52,
        "priceAsOf": "2026-11-03",
        "minimumMarketDate": "2026-08-04",
        "minimumMarketAt": null,
        "value": 4904,
        "cost": 5261.49,
        "stock_gl": -357.49,
        "stock_gl_pct": -6.794463165377109,
        "premiums": 136.68,
        "dividends": 80,
        "option_gl": -51.33,
        "option_liability": -88,
        "fidelity_gap": 216.68,
        "true_mtm": -228.81,
        "percent": null,
        "displayPriceAsOf": "2026-11-03",
        "displayPriceKind": "FOS source-day close",
        "priceReferenceKind": "FOS source-day close"
      },
      {
        "account": "Portfolio B",
        "ticker": "SLB",
        "shares": 100,
        "reserved": 100,
        "available": 0,
        "name": "Schlumberger",
        "sector": "Energy",
        "bucket": "Review",
        "price": 52.13,
        "priceAsOf": "2026-11-03",
        "minimumMarketDate": "2026-10-28",
        "minimumMarketAt": null,
        "value": 5213,
        "cost": 5432.5,
        "stock_gl": -219.5,
        "stock_gl_pct": -4.040497008743673,
        "premiums": 88.34,
        "dividends": 0,
        "option_gl": 42.34,
        "option_liability": -46,
        "fidelity_gap": 88.34,
        "true_mtm": -177.16,
        "percent": null,
        "displayPriceAsOf": "2026-11-03",
        "displayPriceKind": "FOS source-day close",
        "priceReferenceKind": "FOS source-day close"
      },
      {
        "account": "Portfolio A",
        "ticker": "SCHD",
        "name": "Schwab U.S. Dividend Equity ETF",
        "sector": "Benchmark",
        "bucket": "Benchmark",
        "shares": 100,
        "cost": 3356,
        "price": 35.55,
        "priceAsOf": "2026-11-03",
        "minimumMarketDate": "2026-07-27",
        "priceReferenceKind": "FOS source-day close",
        "scopeRole": "Legacy uncalled reserve",
        "displayPriceAsOf": "2026-11-03",
        "displayPriceKind": "FOS source-day close",
        "value": 3555,
        "stock_gl": 199,
        "stock_gl_pct": 5.9296781883194285,
        "option_liability": 0,
        "option_gl": 0,
        "true_mtm": 199
      }
    ],
    "options": [
      {
        "account": "Portfolio A",
        "ticker": "MDT",
        "contract": "-MDT261113C103",
        "description": "-MDT261113C103",
        "qty": -1,
        "last": 0.68,
        "liability": -68,
        "gl": -12.66,
        "gl_pct": -22.88,
        "cost": 55.34,
        "expiration": "2026-11-13",
        "strike": "103",
        "bid": 0.41,
        "ask": 0.68,
        "referenceAsOf": "2026-11-03",
        "referenceTimestamp": "2026-11-03T17:15:34.376",
        "valuationKind": "dated source-day ask reference, not a live or simultaneous quote",
        "referencePredatesOpening": false,
        "sourceStatus": "received_unqualified"
      },
      {
        "account": "Portfolio A",
        "ticker": "GOOGL",
        "contract": "-GOOGL261127C350",
        "description": "-GOOGL261127C350",
        "qty": -1,
        "last": 0.32,
        "liability": -32,
        "gl": 464.32,
        "gl_pct": 93.55,
        "cost": 496.32,
        "expiration": "2026-11-27",
        "strike": "350",
        "bid": 0.2,
        "ask": 0.32,
        "referenceAsOf": "2026-11-03",
        "referenceTimestamp": "2026-11-03T17:20:00.455",
        "valuationKind": "dated source-day ask reference, not a live or simultaneous quote",
        "referencePredatesOpening": false,
        "sourceStatus": "received_unqualified"
      },
      {
        "account": "Portfolio A",
        "ticker": "HPQ",
        "contract": "-HPQ261127C35",
        "description": "-HPQ261127C35",
        "qty": -1,
        "last": 0.55,
        "liability": -55,
        "gl": 55.34,
        "gl_pct": 50.15,
        "cost": 110.34,
        "expiration": "2026-11-27",
        "strike": "35",
        "bid": 0.07,
        "ask": 0.55,
        "referenceAsOf": "2026-11-03",
        "referenceTimestamp": "2026-11-03T17:20:00.455",
        "valuationKind": "dated source-day ask reference, not a live or simultaneous quote",
        "referencePredatesOpening": false,
        "sourceStatus": "received_unqualified"
      },
      {
        "account": "Portfolio A",
        "ticker": "WFC",
        "contract": "-WFC261127C89",
        "description": "-WFC261127C89",
        "qty": -1,
        "last": 1.13,
        "liability": -113,
        "gl": -18.66,
        "gl_pct": -19.78,
        "cost": 94.34,
        "expiration": "2026-11-27",
        "strike": "89",
        "bid": 0.86,
        "ask": 1.13,
        "referenceAsOf": "2026-11-03",
        "referenceTimestamp": "2026-11-03T17:19:24.319",
        "valuationKind": "dated source-day ask reference, not a live or simultaneous quote",
        "referencePredatesOpening": false,
        "sourceStatus": "received_unqualified"
      },
      {
        "account": "Portfolio B",
        "ticker": "ACN",
        "contract": "-ACN261127C260",
        "description": "-ACN261127C260",
        "qty": -1,
        "last": 10.5,
        "liability": -1050,
        "gl": -405.68,
        "gl_pct": -62.96,
        "cost": 644.32,
        "expiration": "2026-11-27",
        "strike": "260",
        "bid": 8.5,
        "ask": 10.5,
        "referenceAsOf": "2026-11-03",
        "referenceTimestamp": "2026-11-03T17:20:01.181",
        "valuationKind": "dated source-day ask reference, not a live or simultaneous quote",
        "referencePredatesOpening": false,
        "sourceStatus": "received_unqualified"
      },
      {
        "account": "Portfolio B",
        "ticker": "DECK",
        "contract": "-DECK261127C85",
        "description": "-DECK261127C85",
        "qty": -1,
        "last": 3.2,
        "liability": -320,
        "gl": -146.66,
        "gl_pct": -84.61,
        "cost": 173.34,
        "expiration": "2026-11-27",
        "strike": "85",
        "bid": 1.85,
        "ask": 3.2,
        "referenceAsOf": "2026-11-03",
        "referenceTimestamp": "2026-11-03T17:17:20.244",
        "valuationKind": "dated source-day ask reference, not a live or simultaneous quote",
        "referencePredatesOpening": false,
        "sourceStatus": "received_unqualified"
      },
      {
        "account": "Portfolio B",
        "ticker": "KHC",
        "contract": "-KHC261127C26",
        "description": "-KHC261127C26",
        "qty": -2,
        "last": 0.44,
        "liability": -88,
        "gl": -51.33,
        "gl_pct": -139.98,
        "cost": 36.67,
        "expiration": "2026-11-27",
        "strike": "26",
        "bid": 0.27,
        "ask": 0.44,
        "referenceAsOf": "2026-11-03",
        "referenceTimestamp": "2026-11-03T17:15:34.376",
        "valuationKind": "dated source-day ask reference, not a live or simultaneous quote",
        "referencePredatesOpening": false,
        "sourceStatus": "received_unqualified"
      },
      {
        "account": "Portfolio B",
        "ticker": "SLB",
        "contract": "-SLB261127C58",
        "description": "-SLB261127C58",
        "qty": -1,
        "last": 0.46,
        "liability": -46,
        "gl": 42.34,
        "gl_pct": 47.93,
        "cost": 88.34,
        "expiration": "2026-11-27",
        "strike": "58",
        "bid": 0.13,
        "ask": 0.46,
        "referenceAsOf": "2026-11-03",
        "referenceTimestamp": "2026-11-03T17:16:15.694",
        "valuationKind": "dated source-day ask reference, not a live or simultaneous quote",
        "referencePredatesOpening": false,
        "sourceStatus": "received_unqualified"
      }
    ],
    "combined": {
      "alias": "Combined Household",
      "total": 103692.04,
      "cash": 8483.04,
      "stock_val": 96808,
      "opt_val": -1772,
      "stock_gl": -2926.57,
      "opt_gl": null,
      "premiums": 7642.66,
      "gross_premiums": 7684,
      "option_expenses": 41.34,
      "dividends": 1238.8,
      "interest": 63.53,
      "deposits": 74026.92,
      "purchases": 257881.5,
      "sales": 183382.88,
      "transactions": 179,
      "realized_sale_gains": 5807.65,
      "return_baseline": 93464.97,
      "fees": 0,
      "optionMtmAvailable": true,
      "strategy_total_return": 10227.07,
      "strategy_return_pct": 10.942142280685479,
      "called_stock_val": 93253,
      "reserve_val": 3555,
      "recorded_total": 103519.04,
      "dividend_receivables": 173,
      "valuationKind": "November 3 source-day estimate with known dividend receivables",
      "gross_asset_value": 105291.04
    },
    "accounts": [
      {
        "alias": "Portfolio A",
        "total": 55997.2,
        "cash": 3439.2,
        "stock_val": 52826,
        "opt_val": -268,
        "stock_gl": -3679.08,
        "opt_gl": null,
        "premiums": 3397.99,
        "gross_premiums": 3424,
        "option_expenses": 26.01,
        "dividends": 719.2,
        "interest": 26.87,
        "deposits": 33590.94,
        "purchases": 98435.01,
        "sales": 64135.37,
        "transactions": 109,
        "realized_sale_gains": 2777.14,
        "called_stock_val": 49271,
        "reserve_val": 3555,
        "recorded_total": 55997.2,
        "dividend_receivables": 0,
        "return_baseline": 53023.08,
        "strategy_total_return": 2974.12,
        "strategy_return_pct": 5.609104563522148,
        "valuationKind": "November 3 source-day estimate with known dividend receivables"
      },
      {
        "alias": "Portfolio B",
        "total": 47694.84,
        "cash": 5043.84,
        "stock_val": 43982,
        "opt_val": -1504,
        "stock_gl": 752.51,
        "opt_gl": null,
        "premiums": 4244.67,
        "gross_premiums": 4260,
        "option_expenses": 15.33,
        "dividends": 519.6,
        "interest": 36.66,
        "deposits": 40435.98,
        "purchases": 159446.49,
        "sales": 119247.51,
        "transactions": 70,
        "realized_sale_gains": 3030.51,
        "called_stock_val": 43982,
        "reserve_val": 0,
        "recorded_total": 47521.84,
        "dividend_receivables": 173,
        "return_baseline": 40441.89,
        "strategy_total_return": 7252.95,
        "strategy_return_pct": 17.93425084732687,
        "valuationKind": "November 3 source-day estimate with known dividend receivables"
      }
    ],
    "fosSnapshot": true,
    "fosCommonPeriod": true,
    "releaseCommentary": "March experiment through November 3. Source-day estimate includes known earned, unpaid dividends and remains before unreported WMT fees."
  },
  "cashBridge": {
    "historicalDate": "2026-09-04",
    "historicalCashBalance": 3315.68,
    "currentDate": "2026-11-03",
    "currentCashBalance": 8483.04,
    "currentCashByAccount": {
      "Portfolio A": 3439.2,
      "Portfolio B": 5043.84
    },
    "postSeptemberCategories": {
      "Sell Call": 2348.39,
      "Buy Stock": -68647.78,
      "Assigned Stock Sale": 71048.75,
      "Noncash Capital Allocation": 0,
      "Expired Call": 0,
      "Dividend": 418,
      "Assigned Option": 0
    },
    "postSeptemberRowCount": 46,
    "periodInterest": 63.53,
    "periodCashIncome": 8944.99,
    "legacyRollingIncome": 8945.03,
    "preMarchInterestCarry": 0.04,
    "november3Movements": [
      {
        "account": "Portfolio A",
        "category": "Sell Call",
        "ticker": "MDT",
        "amount": 55.34
      },
      {
        "account": "Portfolio A",
        "category": "Buy Stock",
        "ticker": "WFC",
        "amount": -8547.99
      },
      {
        "account": "Portfolio A",
        "category": "Sell Call",
        "ticker": "WFC",
        "amount": 94.34
      }
    ]
  },
  "receivables": {
    "knownEligibleUnpaidReceivables": 173,
    "totalEligibleUnpaidReceivables": 173,
    "completenessVerified": true,
    "status": "closed_period_review_complete_known_receivables",
    "events": [
      {
        "ticker": "ABBV",
        "account": "Portfolio B",
        "shares": 100,
        "amountPerShare": 1.73,
        "amount": 173,
        "exDate": "2026-10-15",
        "recordDate": "2026-10-15",
        "paymentDate": "2026-11-16",
        "sourceUrl": "https://news.abbvie.com/2026-09-10-AbbVie-Declares-Quarterly-Dividend",
        "exDateBasis": "NYSE normal-distribution T+1 rule applied to ordinary cashdividendrecorddate; corroboratedexistingcachedexdate"
      }
    ],
    "knownByAccount": {
      "Portfolio A": 0,
      "Portfolio B": 173
    }
  },
  "provenance": {
    "ledgerSha256": "d6a63367caebca82765d52baa3fbafefceaf0698198dfd219ce411fb2c592482",
    "marketEvidenceSha256": "1e8da8da6dcf416ae821a8aa4906fb3cd89660175a28a1f5a6a2854ea3616595",
    "benchmarkSourcesSha256": "7715aa09cde2940614a764f22b20a5df4edc1afcdfe87b65481250e82c349ffc",
    "cashAuditSha256": "7fc500c12b1e798ad4ee86b4921c3ed59992d1e168899a0a5e31f0af5eba19ab",
    "receivablesAuditSha256": "04f2c651269384ae3600f357d013c96349fa94958b64b20ff344864c79655516",
    "sourceDay": "2026-11-03",
    "historicalBaselineDate": "2026-09-04",
    "historicalBaselineCommit": "dcd06df934db45e4f12f6192cea99bc2e32e9e7c"
  }
};
