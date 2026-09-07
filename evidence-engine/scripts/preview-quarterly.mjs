#!/usr/bin/env node
/** Local read-only single-ticker quarterly Evidence Engine preview. */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createLiveQuarterlyPreview,
  parseQuarterlyPreviewArguments,
  quarterlyPreviewHelp,
  readPriorResultArtifact,
  renderQuarterlyPreview,
  serializeQuarterlyPreview,
} from "../lib/quarterly-preview.mjs";

try {
  const options = parseQuarterlyPreviewArguments(process.argv.slice(2));
  if (options.help) {
    console.log(quarterlyPreviewHelp());
    process.exitCode = 0;
  } else {
    const priorAnnualPublication = options.priorResult
      ? await readPriorResultArtifact(resolve(options.priorResult))
      : null;
    const preview = await createLiveQuarterlyPreview({ ticker: options.ticker, priorAnnualPublication });
    const json = serializeQuarterlyPreview(preview);
    if (options.out) await writeFile(resolve(options.out), json, { encoding: "utf8", flag: "w" });
    process.stdout.write(options.json ? json : `${renderQuarterlyPreview(preview)}${options.out ? `\n\nJSON saved to ${resolve(options.out)}` : ""}\n`);
  }
} catch (error) {
  console.error(`Quarterly preview failed closed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
