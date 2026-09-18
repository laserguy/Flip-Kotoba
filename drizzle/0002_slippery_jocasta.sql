PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_words` (
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
	`reverse_box_level` integer DEFAULT 1 NOT NULL,
	`reverse_right_streak` integer DEFAULT 0 NOT NULL,
	`reverse_next_due_at` integer DEFAULT (unixepoch()) NOT NULL,
	`reverse_last_reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`origin_deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "words_box_level_range" CHECK("__new_words"."box_level" between 1 and 5),
	CONSTRAINT "words_right_streak_range" CHECK("__new_words"."right_streak" between 0 and 10),
	CONSTRAINT "words_reverse_box_level_range" CHECK("__new_words"."reverse_box_level" between 1 and 5),
	CONSTRAINT "words_reverse_right_streak_range" CHECK("__new_words"."reverse_right_streak" between 0 and 10),
	CONSTRAINT "words_sentence_translation_pairing" CHECK("__new_words"."example_sentence_jp" is null or "__new_words"."example_sentence_en" is not null)
);
--> statement-breakpoint
INSERT INTO `__new_words`("id", "deck_id", "origin_deck_id", "kanji", "furigana", "english_meaning", "example_sentence_jp", "example_sentence_en", "box_level", "right_streak", "next_due_at", "last_reviewed_at", "reverse_box_level", "reverse_right_streak", "reverse_next_due_at", "reverse_last_reviewed_at", "created_at") SELECT "id", "deck_id", "origin_deck_id", "kanji", "furigana", "english_meaning", "example_sentence_jp", "example_sentence_en", "box_level", "right_streak", "next_due_at", "last_reviewed_at", 1, 0, unixepoch(), NULL, "created_at" FROM `words`;--> statement-breakpoint
DROP TABLE `words`;--> statement-breakpoint
ALTER TABLE `__new_words` RENAME TO `words`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `words_deck_id_idx` ON `words` (`deck_id`);--> statement-breakpoint
CREATE INDEX `words_deck_due_idx` ON `words` (`deck_id`,`next_due_at`);--> statement-breakpoint
CREATE INDEX `words_deck_reverse_due_idx` ON `words` (`deck_id`,`reverse_next_due_at`);