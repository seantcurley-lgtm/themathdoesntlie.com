#!/usr/bin/env node
/** Explicitly authorized, exactly-one-issuer authoritative Evidence Engine publication. */
import { execFileSync } from "node:child_process";
import {
  parseSingleIssuerPublicationArguments,
  publishSingleIssuer,
  renderPrePublicationSummary,
  renderQualificationResult,
  singleIssuerPublicationHelp,
} from "../lib/single-issuer-publication.mjs";

function exactCodeRevision() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  if (status.trim()) throw new Error("Authoritative publication requires a clean committed working tree.");
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

try {
  const options = parseSingleIssuerPublicationArguments(process.argv.slice(2));
  if (options.help) {
    console.log(singleIssuerPublicationHelp());
  } else {
    const completed = await publishSingleIssuer({
      ticker: options.ticker,
      endpoint: process.env.EVIDENCE_ENGINE_STATE_ENDPOINT,
      token: process.env.EVIDENCE_ENGINE_PUBLICATION_TOKEN,
      confirmed: options.confirmed,
      revision: exactCodeRevision(),
      onPrepared: (summary) => {
        const rendered = renderPrePublicationSummary(summary);
        if (options.json) console.error(rendered);
        else process.stdout.write(`${rendered}\n\n`);
      },
    });
    process.stdout.write(options.json
      ? `${JSON.stringify(completed, null, 2)}\n`
      : `${renderQualificationResult(completed.result)}\n`);
  }
} catch (error) {
  const code = error?.code ? ` [${error.code}]` : "";
  console.error(`Single-issuer authoritative publication failed closed${code}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
