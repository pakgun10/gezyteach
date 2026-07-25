CREATE TABLE `student_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `students` ADD `login_id` text;--> statement-breakpoint
ALTER TABLE `students` ADD `pin_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `students_login_id_unique` ON `students` (`login_id`);