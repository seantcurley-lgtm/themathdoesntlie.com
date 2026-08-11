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
    tier: text("tier"),
    metricCount: integer("metric_count").notNull(),
    unavailableMetricCount: integer("unavailable_metric_count").notNull(),
    recordJson: text("record_json").notNull(),
  },
  (table) => [
    uniqueIndex("evaluation_records_fingerprint_uq").on(table.fingerprint),
    index("evaluation_records_ticker_period_idx").on(
      table.ticker,
      table.periodEnd,
      table.savedAt,
    ),
    index("evaluation_records_saved_at_idx").on(table.savedAt),
  ],
);
