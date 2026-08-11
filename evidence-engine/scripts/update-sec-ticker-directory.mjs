import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourcePath = process.argv[2];
const retrievedAt = process.argv[3];

if (!sourcePath || !/^\d{4}-\d{2}-\d{2}$/.test(retrievedAt ?? "")) {
  console.error(
    "Usage: node scripts/update-sec-ticker-directory.mjs <company_tickers.json> <YYYY-MM-DD>",
  );
  process.exit(64);
}

const sourceText = await readFile(resolve(sourcePath), "utf8");
const source = JSON.parse(sourceText);
const records = Object.values(source)
  .map((record) => ({
    cik_str: Number(record?.cik_str),
    ticker: String(record?.ticker ?? "").trim().toUpperCase(),
    title: String(record?.title ?? "").trim(),
  }))
  .filter(
    (record) =>
      Number.isInteger(record.cik_str) &&
      record.cik_str > 0 &&
      /^[A-Z0-9.-]{1,10}$/.test(record.ticker) &&
      record.title,
  )
  .sort((left, right) => left.ticker.localeCompare(right.ticker));

if (records.length < 5_000) {
  throw new Error(`Refusing to publish an incomplete ticker directory (${records.length} records).`);
}

const payload = {
  schemaVersion: "1.0",
  sourceUrl: "https://www.sec.gov/files/company_tickers.json",
  retrievedAt,
  sourceSha256: createHash("sha256").update(sourceText).digest("hex"),
  recordCount: records.length,
  records,
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(projectRoot, "public/sec/company-tickers.json");
await writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log(
  `Published ${records.length} SEC ticker records to ${outputPath} (${payload.sourceSha256}).`,
);
