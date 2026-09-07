import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Immutable, self-contained evaluation publications.
 *
 * `record_json` is the exact publication accepted by the service. The
 * surrounding columns are a query index, not a second source of financial
 * truth. There are deliberately no update or delete routes for these rows.
 */
export const evaluationRecords = sqliteTable(
  "evaluation_records",
  {
    id: text("id").primaryKey(),
    recordSchemaVersion: text("record_schema_version").notNull(),
    recordKind: text("record_kind").notNull().default("evaluation"),
    sourceRecordId: text("source_record_id"),
    // Nullable only so any dormant Release-6 rows survive the additive migration.
    // The controlled publication route requires every authority field for new rows.
    securityId: text("security_id"),
    knownAt: text("known_at"),
    publishedAt: text("published_at"),
    sourceMaxPublishedAt: text("source_max_published_at"),
    eventType: text("event_type"),
    supersedesResultId: text("supersedes_result_id"),
    sourceManifestId: text("source_manifest_id"),
    stateFingerprint: text("state_fingerprint"),
    label: text("label").notNull(),
    companyName: text("company_name").notNull(),
    ticker: text("ticker").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    savedAt: text("saved_at").notNull(),
    fingerprint: text("fingerprint").notNull(),
    recordHash: text("record_hash").notNull(),
    engineVersion: text("engine_version").notNull(),
    publicationSchemaVersion: text("publication_schema_version").notNull(),
    canonicalRegistryVersion: text("canonical_registry_version").notNull(),
    calculationRegistryVersion: text("calculation_registry_version").notNull(),
    aliasRegistryVersion: text("alias_registry_version").notNull(),
    scoringVersion: text("scoring_version").notNull(),
    scoringStatus: text("scoring_status").notNull(),
    overallScore: text("overall_score"),
    coveragePercent: text("coverage_percent"),
    tier: text("tier"),
    filingDate: text("filing_date"),
    accessionNumber: text("accession_number"),
    marketObservationDate: text("market_observation_date"),
    marketObservationId: text("market_observation_id"),
    oldestEvidenceDate: text("oldest_evidence_date"),
    metricCount: integer("metric_count").notNull(),
    unavailableMetricCount: integer("unavailable_metric_count").notNull(),
    recordJson: text("record_json").notNull(),
  },
  (table) => [
    uniqueIndex("evaluation_records_state_fingerprint_uq").on(table.stateFingerprint),
    index("evaluation_records_security_known_idx").on(table.securityId, table.knownAt),
    index("evaluation_records_ticker_period_idx").on(
      table.ticker,
      table.periodEnd,
      table.savedAt,
    ),
    index("evaluation_records_saved_at_idx").on(table.savedAt),
  ],
);

export const sourceManifests = sqliteTable("source_manifests", {
  id: text("id").primaryKey(),
  securityId: text("security_id").notNull(),
  manifestHash: text("manifest_hash").notNull(),
  acquiredAt: text("acquired_at").notNull(),
  manifestJson: text("manifest_json").notNull(),
}, (table) => [uniqueIndex("source_manifests_hash_uq").on(table.manifestHash)]);

export const securityAliases = sqliteTable("security_aliases", {
  id: text("id").primaryKey(),
  securityId: text("security_id").notNull(),
  ticker: text("ticker").notNull(),
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to"),
}, (table) => [
  uniqueIndex("security_aliases_identity_uq").on(table.securityId, table.ticker, table.validFrom),
  index("security_aliases_ticker_time_idx").on(table.ticker, table.validFrom, table.validTo),
]);

export const generationManifests = sqliteTable("generation_manifests", {
  id: text("id").primaryKey(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status").notNull(),
  manifestHash: text("manifest_hash"),
  manifestJson: text("manifest_json").notNull(),
}, (table) => [index("generation_manifests_started_idx").on(table.startedAt)]);

export const generationEvents = sqliteTable("generation_events", {
  id: text("id").primaryKey(),
  generationId: text("generation_id").notNull(),
  occurredAt: text("occurred_at").notNull(),
  securityId: text("security_id"),
  outcome: text("outcome").notNull(),
  resultId: text("result_id"),
  detailJson: text("detail_json").notNull(),
}, (table) => [index("generation_events_generation_idx").on(table.generationId, table.occurredAt)]);
