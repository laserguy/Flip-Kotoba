CREATE TABLE `decks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'normal' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `decks_single_memorized_deck` ON `decks` (`kind`) WHERE "decks"."kind" = 'memorized';--> statement-breakpoint
CREATE TABLE `words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deck_id` integer NOT NULL,
	`origin_deck_id` integer,
	`kanji` text,
	`furigana` text NOT NULL,
	`english_meaning` text NOT NULL,
	`example_sentence_jp` text,
	`example_sentence_en` text,
	`box_level` integer DEFAULT 1 NOT NULL,
	`right_streak` integer DEFAULT 0 NOT NULL,
	`next_due_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`origin_deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "words_box_level_range" CHECK("words"."box_level" between 1 and 5),
	CONSTRAINT "words_right_streak_range" CHECK("words"."right_streak" between 0 and 10),
	CONSTRAINT "words_sentence_translation_pairing" CHECK("words"."example_sentence_jp" is null or "words"."example_sentence_en" is not null)
);
--> statement-breakpoint
CREATE INDEX `words_deck_id_idx` ON `words` (`deck_id`);--> statement-breakpoint
CREATE INDEX `words_deck_due_idx` ON `words` (`deck_id`,`next_due_at`);