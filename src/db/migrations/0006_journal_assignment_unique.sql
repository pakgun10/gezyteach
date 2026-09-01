-- Simpan identitas guru + kelas + mapel pada jurnal agar satu kombinasi hanya
-- memiliki satu jurnal per tanggal, meskipun ada lebih dari satu baris jadwal.
-- Jika data lama sudah mengandung duplikat, pertahankan jurnal selesai yang
-- paling baru (atau draft paling baru jika belum ada yang selesai).
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_journals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`schedule_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`class_id` integer NOT NULL,
	`subject_key` text NOT NULL,
	`date` text NOT NULL,
	`topic` text,
	`achievement` text,
	`reflection` text,
	`obstacle` text,
	`present_count` integer,
	`absent_count` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_journals` (
	`id`, `schedule_id`, `user_id`, `class_id`, `subject_key`, `date`,
	`topic`, `achievement`, `reflection`, `obstacle`, `present_count`,
	`absent_count`, `status`, `created_at`, `updated_at`
)
SELECT
	`id`, `schedule_id`, `journal_user_id`, `journal_class_id`,
	`journal_subject_key`, `date`, `topic`, `achievement`, `reflection`,
	`obstacle`, `present_count`, `absent_count`, `status`, `created_at`, `updated_at`
FROM (
	SELECT
		j.*,
		s.user_id AS `journal_user_id`,
		s.class_id AS `journal_class_id`,
		lower(trim(s.subject)) AS `journal_subject_key`,
		row_number() OVER (
			PARTITION BY s.user_id, s.class_id, lower(trim(s.subject)), j.date
			ORDER BY
				CASE WHEN j.status = 'completed' THEN 0 ELSE 1 END,
				j.updated_at DESC,
				j.id DESC
		) AS `duplicate_rank`
	FROM `journals` j
	INNER JOIN `schedules` s ON s.id = j.schedule_id
)
WHERE `duplicate_rank` = 1;
--> statement-breakpoint
DROP TABLE `journals`;
--> statement-breakpoint
ALTER TABLE `__new_journals` RENAME TO `journals`;
--> statement-breakpoint
CREATE UNIQUE INDEX `journals_schedule_id_date_unique` ON `journals` (`schedule_id`, `date`);
--> statement-breakpoint
CREATE UNIQUE INDEX `journals_user_id_class_id_subject_key_date_unique` ON `journals` (`user_id`, `class_id`, `subject_key`, `date`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
