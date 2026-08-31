CREATE INDEX `schedules_user_day_start_idx` ON `schedules` (`user_id`, `day_of_week`, `start_time`);
--> statement-breakpoint
CREATE INDEX `attendance_schedule_date_idx` ON `attendance` (`schedule_id`, `date`);
