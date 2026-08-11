import { readFile, writeFile } from "node:fs/promises";

const configPath = new URL("../dist/server/wrangler.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));

config.name = "tmdl-evidence-engine";
config.topLevelName = "tmdl-evidence-engine";
config.compatibility_date = "2026-08-11";
config.compatibility_flags = ["nodejs_compat"];
delete config.routes;

// The public release deliberately has no cloud record store. Evaluation,
// SEC acquisition, browser drafts, and exports remain available, while the
// immutable-record API returns 403 for anonymous visitors.
config.d1_databases = [];

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
