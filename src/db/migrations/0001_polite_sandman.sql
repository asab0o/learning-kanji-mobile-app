ALTER TABLE `sentence_lines` ADD `segments` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `sentence_lines` DROP COLUMN `furigana`;