CREATE TABLE `vision_values` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vision_values_name_unique` ON `vision_values` (`name`);
--> statement-breakpoint
INSERT OR IGNORE INTO `vision_values` (`name`, `sort_order`) VALUES
  ('Bertakwa', 1), ('Cerdas', 2), ('Terampil', 3),
  ('Sehat', 4), ('Ramah', 5), ('Berbudaya', 6);
--> statement-breakpoint
CREATE TABLE `anecdotal_records` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `student_id` integer NOT NULL,
  `teacher_id` integer NOT NULL,
  `event_date` text NOT NULL,
  `event_time` text,
  `location` text,
  `description` text NOT NULL,
  `category` text NOT NULL,
  `follow_up_notes` text,
  `created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `anecdotal_records_teacher_date_idx` ON `anecdotal_records` (`teacher_id`, `event_date`);
--> statement-breakpoint
CREATE INDEX `anecdotal_records_student_date_idx` ON `anecdotal_records` (`student_id`, `event_date`);
--> statement-breakpoint
CREATE TABLE `anecdotal_record_values` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `anecdotal_record_id` integer NOT NULL,
  `vision_value_id` integer NOT NULL,
  FOREIGN KEY (`anecdotal_record_id`) REFERENCES `anecdotal_records`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`vision_value_id`) REFERENCES `vision_values`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anecdotal_record_values_record_value_unique` ON `anecdotal_record_values` (`anecdotal_record_id`, `vision_value_id`);
--> statement-breakpoint
CREATE TABLE `anecdotal_semester_summaries` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `student_id` integer NOT NULL,
  `vision_value_id` integer NOT NULL,
  `semester` text NOT NULL,
  `academic_year` text NOT NULL,
  `positive_count` integer DEFAULT 0 NOT NULL,
  `needs_guidance_count` integer DEFAULT 0 NOT NULL,
  `development_category` text NOT NULL,
  `narrative_description` text,
  `generated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`vision_value_id`) REFERENCES `vision_values`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anecdotal_semester_summaries_unique` ON `anecdotal_semester_summaries` (`student_id`, `vision_value_id`, `semester`, `academic_year`);
--> statement-breakpoint
CREATE TABLE `anecdotal_development_thresholds` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `category` text NOT NULL,
  `minimum_positive_count` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anecdotal_development_thresholds_category_unique` ON `anecdotal_development_thresholds` (`category`);
--> statement-breakpoint
INSERT OR IGNORE INTO `anecdotal_development_thresholds` (`category`, `minimum_positive_count`) VALUES
  ('BT', 0), ('MT', 1), ('MB', 3), ('SM', 6);
