import { relations, sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
};

/** Guru. MVP hanya 1 baris, tapi struktur sudah siap multi-user. */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  ...timestamps,
});

/** Sesi login (cookie session token -> user). */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // random token
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

/** Kelas yang diampu guru. */
export const classes = sqliteTable("classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  level: text("level"),
  academicYear: text("academic_year"),
  ...timestamps,
});

/** Siswa dalam suatu kelas. */
export const students = sqliteTable(
  "students",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    nis: text("nis"),
    name: text("name").notNull(),
    gender: text("gender", { enum: ["L", "P"] }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [unique().on(table.classId, table.nis)],
);

/** Jadwal mengajar mingguan (satu baris = satu sesi kelas+mapel). */
export const schedules = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  classId: integer("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  /** 0 = Minggu, 1 = Senin, ..., 6 = Sabtu */
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(), // HH:MM
  room: text("room"),
  ...timestamps,
});

/** Jurnal mengajar harian, dibuat dari sebuah jadwal. */
export const journals = sqliteTable(
  "journals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scheduleId: integer("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    topic: text("topic"),
    achievement: text("achievement"),
    reflection: text("reflection"),
    obstacle: text("obstacle"),
    presentCount: integer("present_count"),
    absentCount: integer("absent_count"),
    status: text("status", { enum: ["draft", "completed"] })
      .notNull()
      .default("draft"),
    ...timestamps,
  },
  (table) => [unique().on(table.scheduleId, table.date)],
);

/** Rencana komponen nilai per kelas + mapel (mis. UH, Tugas, PTS, PAS). */
export const assessmentPlans = sqliteTable("assessment_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  classId: integer("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  name: text("name").notNull(),
  weight: real("weight").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

/** Nilai siswa untuk suatu komponen penilaian. */
export const scores = sqliteTable(
  "scores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    assessmentPlanId: integer("assessment_plan_id")
      .notNull()
      .references(() => assessmentPlans.id, { onDelete: "cascade" }),
    value: real("value"),
    ...timestamps,
  },
  (table) => [unique().on(table.studentId, table.assessmentPlanId)],
);

/** Absensi siswa per sesi jadwal per tanggal. */
export const attendance = sqliteTable(
  "attendance",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    scheduleId: integer("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    status: text("status", { enum: ["H", "S", "I", "A"] }).notNull(),
    note: text("note"),
    ...timestamps,
  },
  (table) => [unique().on(table.studentId, table.scheduleId, table.date)],
);

/** Tautan perangkat KBM (disimpan di Google Drive), dikelompokkan per kategori. */
export const resources = sqliteTable("resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category", {
    enum: ["PPT", "Video", "LKPD", "Bank Soal", "Lainnya"],
  }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Relasi (dipakai oleh Drizzle query API, mis. db.query.classes.findMany({ with }))
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  classes: many(classes),
  schedules: many(schedules),
  resources: many(resources),
  sessions: many(sessions),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  user: one(users, { fields: [classes.userId], references: [users.id] }),
  students: many(students),
  schedules: many(schedules),
  assessmentPlans: many(assessmentPlans),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  scores: many(scores),
  attendance: many(attendance),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  user: one(users, { fields: [schedules.userId], references: [users.id] }),
  class: one(classes, {
    fields: [schedules.classId],
    references: [classes.id],
  }),
  journals: many(journals),
  attendance: many(attendance),
}));

export const journalsRelations = relations(journals, ({ one }) => ({
  schedule: one(schedules, {
    fields: [journals.scheduleId],
    references: [schedules.id],
  }),
}));

export const assessmentPlansRelations = relations(
  assessmentPlans,
  ({ one, many }) => ({
    class: one(classes, {
      fields: [assessmentPlans.classId],
      references: [classes.id],
    }),
    scores: many(scores),
  }),
);

export const scoresRelations = relations(scores, ({ one }) => ({
  student: one(students, {
    fields: [scores.studentId],
    references: [students.id],
  }),
  assessmentPlan: one(assessmentPlans, {
    fields: [scores.assessmentPlanId],
    references: [assessmentPlans.id],
  }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  student: one(students, {
    fields: [attendance.studentId],
    references: [students.id],
  }),
  schedule: one(schedules, {
    fields: [attendance.scheduleId],
    references: [schedules.id],
  }),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  user: one(users, { fields: [resources.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
