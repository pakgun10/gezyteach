-- Kelas jadi data bersama sekolah: kolom `user_id` (wajib, pemilik eksklusif)
-- diganti jadi `created_by_user_id` (opsional, hanya untuk audit siapa yang
-- membuat kelas). SQLite tidak mendukung ALTER COLUMN langsung untuk ubah
-- constraint & foreign key, jadi tabel `classes` di-recreate.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_classes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_by_user_id` integer,
	`name` text NOT NULL,
	`level` text,
	`academic_year` text,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_classes` (`id`, `created_by_user_id`, `name`, `level`, `academic_year`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `name`, `level`, `academic_year`, `created_at`, `updated_at` FROM `classes`;
--> statement-breakpoint
DROP TABLE `classes`;
--> statement-breakpoint
ALTER TABLE `__new_classes` RENAME TO `classes`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
