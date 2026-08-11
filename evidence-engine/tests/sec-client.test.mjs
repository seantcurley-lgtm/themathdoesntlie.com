import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { acquireSecCompany, SEC_TICKER_DIRECTORY_PATH } from "../lib/sec-client.mjs";
import { resolveTicker } from "../lib/sec-xbrl.mjs";

test("bundled official ticker snapshot resolves AAPL, KO, and O", async () => {
  const directory = JSON.parse(
    await readFile(new URL("../public/sec/company-tickers.json", import.meta.url), "utf8"),
  );
  assert.ok(directory.recordCount > 5_000);
  assert.match(directory.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(resolveTicker(directory, "AAPL").cik, "0000320193");
  assert.equal(resolveTicker(directory, "KO").cik, "0000021344");
  assert.equal(resolveTicker(directory, "O").cik, "0000726728");
});

test("invalid Apple spelling stops before external SEC API requests", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return new Response(
      JSON.stringify({
        records: [{ cik_str: 320193, ticker: "AAPL", title: "Apple Inc." }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  await assert.rejects(
    () => acquireSecCompany("APPL", { fetchImpl }),
    /No SEC company record was found for APPL/,
  );
  assert.deepEqual(calls, [SEC_TICKER_DIRECTORY_PATH]);
});

test("valid ticker uses the same-origin acquisition service after local resolution", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url === SEC_TICKER_DIRECTORY_PATH) {
      return Response.json({
        schemaVersion: "1.0",
        retrievedAt: "2026-08-05",
        sourceSha256: "a".repeat(64),
        recordCount: 1,
        records: [{ cik_str: 320193, ticker: "AAPL", title: "Apple Inc." }],
      });
    }
    return Response.json({
      company: { ticker: "AAPL" },
      inputs: { acquisition: { transport: "hybrid-same-origin-sec-data" } },
    });
  };
  const result = await acquireSecCompany("AAPL", { fetchImpl });
  assert.deepEqual(calls, [SEC_TICKER_DIRECTORY_PATH, "/api/sec?ticker=AAPL"]);
  assert.equal(result.company.ticker, "AAPL");
  assert.equal(result.inputs.acquisition.transport, "hybrid-same-origin-sec-data");
  assert.equal(result.inputs.acquisition.tickerDirectory.retrievedAt, "2026-08-05");
});
