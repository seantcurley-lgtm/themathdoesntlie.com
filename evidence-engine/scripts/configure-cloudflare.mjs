import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

const configPath = new URL("../dist/server/wrangler.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));

config.name = "tmdl-evidence-engine";
config.topLevelName = "tmdl-evidence-engine";
config.compatibility_date = "2026-08-11";
config.compatibility_flags = ["nodejs_compat"];
delete config.routes;

const databaseId = process.env.EVIDENCE_ENGINE_D1_DATABASE_ID;
if (!databaseId) {
  throw new Error("EVIDENCE_ENGINE_D1_DATABASE_ID is required; refusing to deploy an unbound authoritative state service.");
}
config.d1_databases = [{
  binding: "DB",
  database_name: "tmdl-evidence-engine",
  database_id: databaseId,
  migrations_dir: "drizzle",
}];

const readerVars = {
  EVIDENCE_ENGINE_READER_HOST: process.env.EVIDENCE_ENGINE_READER_HOST,
  CF_ACCESS_TEAM_DOMAIN: process.env.CF_ACCESS_TEAM_DOMAIN,
  CF_ACCESS_AUD: process.env.CF_ACCESS_AUD,
};
const configuredReaderVars = Object.values(readerVars).filter(Boolean).length;
if (configuredReaderVars > 0 && configuredReaderVars < Object.keys(readerVars).length) {
  throw new Error("Reader authentication variables must be configured together; refusing a partial Access configuration.");
}
if (configuredReaderVars === Object.keys(readerVars).length) {
  config.vars = { ...(config.vars ?? {}), ...readerVars };
}

const migrationTarget = new URL("../dist/server/drizzle/", import.meta.url);
await mkdir(migrationTarget, { recursive: true });
await cp(new URL("../drizzle/", import.meta.url), migrationTarget, { recursive: true });

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
