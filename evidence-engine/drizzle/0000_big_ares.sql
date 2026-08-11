CREATE TABLE `evaluation_records` (
	`id` text PRIMARY KEY NOT NULL,
	`record_schema_version` text NOT NULL,
	`record_kind` text DEFAULT 'evaluation' NOT NULL,
	`source_record_id` text,
	`label` text NOT NULL,
	`company_name` text NOT NULL,
	`ticker` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`saved_at` text NOT NULL,
	`fingerprint` text NOT NULL,
	`record_hash` text NOT NULL,
	`engine_version` text NOT NULL,
	`publication_schema_version` text NOT NULL,
	`canonical_registry_version` text NOT NULL,
	`calculation_registry_version` text NOT NULL,
	`alias_registry_version` text NOT NULL,
	`scoring_version` text NOT NULL,
	`scoring_status` text NOT NULL,
	`overall_score` text,
	`tier` text,
	`metric_count` integer NOT NULL,
	`unavailable_metric_count` integer NOT NULL,
	`record_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_records_fingerprint_uq` ON `evaluation_records` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `evaluation_records_ticker_period_idx` ON `evaluation_records` (`ticker`,`period_end`,`saved_at`);--> statement-breakpoint
CREATE INDEX `evaluation_records_saved_at_idx` ON `evaluation_records` (`saved_at`);