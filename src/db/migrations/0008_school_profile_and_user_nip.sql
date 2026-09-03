ALTER TABLE `users` ADD `nip` text;
--> statement-breakpoint
CREATE TABLE `school_profiles` (
	`id` integer PRIMARY KEY NOT NULL,
	`school_name` text,
	`address` text,
	`city` text,
	`principal_name` text,
	`principal_nip` text,
	`default_academic_year` text,
	`default_semester` text DEFAULT '1' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
