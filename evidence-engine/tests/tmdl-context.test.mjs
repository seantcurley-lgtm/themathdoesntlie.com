import test from "node:test";
import assert from "node:assert/strict";
import { parseTmdlMarketContext } from "../lib/tmdl-context.mjs";

test("TMDL launch context preserves validated dated market evidence", () => {
  const context = parseTmdlMarketContext(
    "?source=TMDL&ticker=duk&company=Duke%20Energy&price=125.40&marketDate=2026-08-10&marketUrl=https%3A%2F%2Fthemathdoesntlie.com%2Fcovered-call-lab%2Fmarket-data.json",
  );
  assert.deepEqual(context, {
    ticker: "DUK",
    company: "Duke Energy",
    price: "125.4",
    marketDate: "2026-08-10",
    marketUrl: "https://themathdoesntlie.com/covered-call-lab/market-data.json",
    source: "TMDL",
  });
});

test("non-TMDL query parameters cannot activate the integration path", () => {
  assert.deepEqual(parseTmdlMarketContext("?ticker=DUK&price=125"), {
    ticker: "", company: "", price: "", marketDate: "", marketUrl: "", source: "",
  });
});

test("invalid market values are discarded without discarding company identity", () => {
  const context = parseTmdlMarketContext(
    "?source=TMDL&ticker=GL&price=-1&marketDate=August-10&marketUrl=http%3A%2F%2Fexample.com",
  );
  assert.equal(context.ticker, "GL");
  assert.equal(context.price, "");
  assert.equal(context.marketDate, "");
  assert.equal(context.marketUrl, "");
});
