CREATE TABLE `kanji` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deck_id` integer NOT NULL,
	`origin_deck_id` integer,
	`character` text NOT NULL,
	`on_readings` text DEFAULT '[]' NOT NULL,
	`kun_readings` text DEFAULT '[]' NOT NULL,
	`meanings` text DEFAULT '[]' NOT NULL,
	`example_words` text DEFAULT '[]' NOT NULL,
	`box_level` integer DEFAULT 1 NOT NULL,
	`right_streak` integer DEFAULT 0 NOT NULL,
	`next_due_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`origin_deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "kanji_box_level_range" CHECK("kanji"."box_level" between 1 and 5),
	CONSTRAINT "kanji_right_streak_range" CHECK("kanji"."right_streak" between 0 and 10)
);
--> statement-breakpoint
CREATE INDEX `kanji_deck_id_idx` ON `kanji` (`deck_id`);--> statement-breakpoint
CREATE INDEX `kanji_deck_due_idx` ON `kanji` (`deck_id`,`next_due_at`);--> statement-breakpoint
DROP INDEX `decks_single_memorized_deck`;--> statement-breakpoint
ALTER TABLE `decks` ADD `content` text DEFAULT 'words' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `decks_single_memorized_deck_per_content` ON `decks` (`content`) WHERE "decks"."kind" = 'memorized';