CREATE TABLE `content_meta` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`seeded_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kanji` (
	`id` text PRIMARY KEY NOT NULL,
	`character` text NOT NULL,
	`meaning` text NOT NULL,
	`order_index` integer NOT NULL,
	`chapter` integer NOT NULL,
	`illustration_key` text NOT NULL,
	`readings` text NOT NULL,
	`reading_introduction` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kanji_character_unique` ON `kanji` (`character`);--> statement-breakpoint
CREATE INDEX `kanji_order_index` ON `kanji` (`order_index`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`item_key` text NOT NULL,
	`result` text NOT NULL,
	`attempted_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reveal_shown` (
	`id` text PRIMARY KEY NOT NULL,
	`kanji_id` text NOT NULL,
	`shown_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reveal_shown_kanji_id_unique` ON `reveal_shown` (`kanji_id`);--> statement-breakpoint
CREATE TABLE `review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kanji_id` text NOT NULL,
	`sentence_id` text NOT NULL,
	`result` text NOT NULL,
	`reviewed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_events_kanji_id_index` ON `review_events` (`kanji_id`,`reviewed_at`);--> statement-breakpoint
CREATE TABLE `sentence_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`sentence_id` text NOT NULL,
	`line_index` integer NOT NULL,
	`speaker` text NOT NULL,
	`japanese` text NOT NULL,
	`furigana` text NOT NULL,
	`romaji` text NOT NULL,
	`english` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sentence_lines_sentence_id_index` ON `sentence_lines` (`sentence_id`,`line_index`);--> statement-breakpoint
CREATE TABLE `sentences` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter` integer NOT NULL,
	`order_index` integer NOT NULL,
	`scene` text NOT NULL,
	`new_kanji_id` text,
	`reencounters` text NOT NULL,
	`is_free` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sentences_order_index` ON `sentences` (`order_index`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`romaji_enabled` integer NOT NULL,
	`theme_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `words` (
	`id` text PRIMARY KEY NOT NULL,
	`kanji_id` text NOT NULL,
	`surface` text NOT NULL,
	`kana` text NOT NULL,
	`meaning` text NOT NULL,
	`reading_type` text NOT NULL,
	`encountered_in_sentence_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `words_kanji_id_index` ON `words` (`kanji_id`);