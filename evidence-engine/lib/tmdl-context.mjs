const EMPTY_CONTEXT = Object.freeze({
  ticker: "",
  company: "",
  price: "",
  marketDate: "",
  marketUrl: "",
  source: "",
});

export function parseTmdlMarketContext(search = "") {
  const params = new URLSearchParams(search);
  const source = params.get("source")?.trim() ?? "";
  if (source.toUpperCase() !== "TMDL") return { ...EMPTY_CONTEXT };

  const price = Number(params.get("price"));
  const marketDate = params.get("marketDate")?.trim() ?? "";
  const marketUrl = params.get("marketUrl")?.trim() ?? "";
  return {
    ticker: (params.get("ticker") ?? "").trim().toUpperCase(),
    company: (params.get("company") ?? "").trim(),
    price: Number.isFinite(price) && price > 0 ? String(price) : "",
    marketDate: /^\d{4}-\d{2}-\d{2}$/.test(marketDate) ? marketDate : "",
    marketUrl: /^https:\/\//i.test(marketUrl) ? marketUrl : "",
    source,
  };
}
