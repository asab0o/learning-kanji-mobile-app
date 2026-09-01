CREATE TABLE `lesson_events` (
	`id` text PRIMARY KEY NOT NULL,
	`sentence_id` text NOT NULL,
	`kanji_id` text,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lesson_events_sentence_id_index` ON `lesson_events` (`sentence_id`);--> statement-breakpoint
CREATE INDEX `lesson_events_completed_at_index` ON `lesson_events` (`completed_at`);