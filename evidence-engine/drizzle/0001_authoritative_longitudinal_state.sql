CREATE TABLE `generation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	`security_id` text,
	`outcome` text NOT NULL,
	`result_id` text,
	`detail_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generation_events_generation_idx` ON `generation_events` (`generation_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `generation_manifests` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`manifest_hash` text,
	`manifest_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generation_manifests_started_idx` ON `generation_manifests` (`started_at`);--> statement-breakpoint
CREATE TABLE `security_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`security_id` text NOT NULL,
	`ticker` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `security_aliases_identity_uq` ON `security_aliases` (`security_id`,`ticker`,`valid_from`);--> statement-breakpoint
CREATE INDEX `security_aliases_ticker_time_idx` ON `security_aliases` (`ticker`,`valid_from`,`valid_to`);--> statement-breakpoint
CREATE TABLE `source_manifests` (
	`id` text PRIMARY KEY NOT NULL,
	`security_id` text NOT NULL,
	`manifest_hash` text NOT NULL,
	`acquired_at` text NOT NULL,
	`manifest_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_manifests_hash_uq` ON `source_manifests` (`manifest_hash`);--> statement-breakpoint
DROP INDEX `evaluation_records_fingerprint_uq`;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `security_id` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `known_at` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `published_at` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `source_max_published_at` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `event_type` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `supersedes_result_id` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `source_manifest_id` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `state_fingerprint` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `coverage_percent` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `filing_date` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `accession_number` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `market_observation_date` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `market_observation_id` text;--> statement-breakpoint
ALTER TABLE `evaluation_records` ADD `oldest_evidence_date` text;--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_records_state_fingerprint_uq` ON `evaluation_records` (`state_fingerprint`);--> statement-breakpoint
CREATE INDEX `evaluation_records_security_known_idx` ON `evaluation_records` (`security_id`,`known_at`);