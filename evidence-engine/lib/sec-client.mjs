import {
  resolveTicker,
  validateTicker,
} from "./sec-xbrl.mjs";

export const SEC_TICKER_DIRECTORY_PATH = "/sec/company-tickers.json";

async function fetchJson(fetchImpl, url, label, cache, mode = "same-origin") {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      cache,
      mode,
    });
  } catch (error) {
    throw new Error(
      `${label} could not be reached from this browser. ${error instanceof Error ? error.message : "Network request failed."}`,
    );
  }
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}. Wait briefly and try again.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned data that was not valid JSON.`);
  }
}

export async function acquireSecCompany(requestedTicker, options = {}) {
  const ticker = validateTicker(requestedTicker);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("This browser cannot retrieve SEC data.");

  const directory = await fetchJson(
    fetchImpl,
    SEC_TICKER_DIRECTORY_PATH,
    "The bundled SEC ticker directory",
    "force-cache",
  );
  const tickerRecord = resolveTicker(directory, ticker);
  const acquisition = await fetchJson(
    fetchImpl,
    `/api/sec?ticker=${encodeURIComponent(tickerRecord.ticker)}`,
    "The Evidence Engine SEC acquisition service",
    "no-store",
  );
  const directoryRecord = {
    schemaVersion: directory.schemaVersion ?? "unknown",
    sourceUrl: directory.sourceUrl ?? "https://www.sec.gov/files/company_tickers.json",
    retrievedAt: directory.retrievedAt ?? null,
    sourceSha256: directory.sourceSha256 ?? null,
    recordCount: directory.recordCount ?? directory.records?.length ?? null,
  };
  acquisition.directory = directoryRecord;
  acquisition.inputs.acquisition = {
    ...acquisition.inputs.acquisition,
    tickerDirectory: directoryRecord,
  };
  return acquisition;
}
