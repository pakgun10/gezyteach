import { relations, sql } from "drizzle-orm";
import {
  integer,
  index,
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

/** Guru/pengguna aplikasi. Role "admin" bisa mengelola user lain. */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  nip: text("nip"),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "guru"] })
    .notNull()
    .default("guru"),
  ...timestamps,
});

/** Identitas sekolah dan default metadata laporan, satu profil per instalasi. */
export const schoolProfiles = sqliteTable("school_profiles", {
  id: integer("id").primaryKey(),
  schoolName: text("school_name"),
  address: text("address"),
  city: text("city"),
  principalName: text("principal_name"),
  principalNip: text("principal_nip"),
  defaultAcademicYear: text("default_academic_year"),
  defaultSemester: text("default_semester", { enum: ["1", "2"] })
    .notNull()
    .default("1"),
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

/**
 * Kelas sekolah. Data bersama, bisa dilihat & dipakai oleh semua guru
 * (bukan milik eksklusif satu guru), karena satu kelas biasanya diajar oleh
 * beberapa guru mapel berbeda.
 * `createdByUserId` hanya mencatat siapa yang membuat kelas ini untuk audit,
 * bukan pembatas akses. Null jika pembuatnya sudah dihapus dari sistem.
 */
export const classes = sqliteTable("classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdByUserId: integer("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
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
    /** Username login siswa: NIS lokal sekolah (bagian pendek), unik antar-kelas. */
    loginId: text("login_id").unique(),
    /** Hash PIN login siswa. Null = akun belum diaktifkan oleh guru. */
    pinHash: text("pin_hash"),
    ...timestamps,
  },
  (table) => [unique().on(table.classId, table.nis)],
);

/** Sesi login siswa (cookie session token -> student), terpisah dari sesi guru. */
export const studentSessions = sqliteTable("student_sessions", {
  id: text("id").primaryKey(), // random token
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

/** Jadwal mengajar mingguan (satu baris = satu sesi kelas+mapel). */
export const schedules = sqliteTable(
  "schedules",
  {
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
  },
  (table) => [
    index("schedules_user_day_start_idx").on(
      table.userId,
      table.dayOfWeek,
      table.startTime,
    ),
  ],
);

/** Jurnal mengajar harian, dibuat dari sebuah jadwal. */
export const journals = sqliteTable(
  "journals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scheduleId: integer("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    /** Mapel yang dinormalisasi untuk mencegah jurnal ganda lintas jadwal. */
    subjectKey: text("subject_key").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    topic: text("topic"),
    achievement: text("achievement"),
    reflection: text("reflection"),
    obstacle: text("obstacle"),
    followUpPlan: text("follow_up_plan"),
    presentCount: integer("present_count"),
    absentCount: integer("absent_count"),
    status: text("status", { enum: ["draft", "completed"] })
      .notNull()
      .default("draft"),
    ...timestamps,
  },
  (table) => [
    unique().on(table.scheduleId, table.date),
    unique().on(table.userId, table.classId, table.subjectKey, table.date),
  ],
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
  (table) => [
    unique().on(table.studentId, table.scheduleId, table.date),
    index("attendance_schedule_date_idx").on(table.scheduleId, table.date),
  ],
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

/** Nilai visi sekolah. Dapat dikelola admin, dengan enam nilai awal dari seed. */
export const visionValues = sqliteTable("vision_values", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

/** Catatan observasi harian siswa oleh guru. */
export const anecdotalRecords = sqliteTable("anecdotal_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time"),
  location: text("location"),
  description: text("description").notNull(),
  category: text("category", { enum: ["positive", "needs_guidance"] }).notNull(),
  followUpNotes: text("follow_up_notes"),
  ...timestamps,
});

/** Nilai visi yang terkait ke satu catatan observasi. */
export const anecdotalRecordValues = sqliteTable("anecdotal_record_values", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  anecdotalRecordId: integer("anecdotal_record_id").notNull().references(() => anecdotalRecords.id, { onDelete: "cascade" }),
  visionValueId: integer("vision_value_id").notNull().references(() => visionValues.id, { onDelete: "cascade" }),
}, (table) => [unique().on(table.anecdotalRecordId, table.visionValueId)]);

/** Cache rekap akhir semester yang narasinya dapat dilengkapi guru. */
export const anecdotalSemesterSummaries = sqliteTable("anecdotal_semester_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  visionValueId: integer("vision_value_id").notNull().references(() => visionValues.id, { onDelete: "cascade" }),
  semester: text("semester").notNull(),
  academicYear: text("academic_year").notNull(),
  positiveCount: integer("positive_count").notNull().default(0),
  needsGuidanceCount: integer("needs_guidance_count").notNull().default(0),
  developmentCategory: text("development_category", { enum: ["BT", "MT", "MB", "SM"] }).notNull(),
  narrativeDescription: text("narrative_description"),
  generatedAt: integer("generated_at").notNull().default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch('now') * 1000)`),
}, (table) => [unique().on(table.studentId, table.visionValueId, table.semester, table.academicYear)]);

/** Ambang jumlah catatan positif untuk kategori perkembangan, dapat diubah admin. */
export const anecdotalDevelopmentThresholds = sqliteTable("anecdotal_development_thresholds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category", { enum: ["BT", "MT", "MB", "SM"] }).notNull().unique(),
  minimumPositiveCount: integer("minimum_positive_count").notNull(),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Relasi (dipakai oleh Drizzle query API, mis. db.query.classes.findMany({ with }))
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  createdClasses: many(classes),
  schedules: many(schedules),
  resources: many(resources),
  anecdotalRecords: many(anecdotalRecords),
  sessions: many(sessions),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [classes.createdByUserId],
    references: [users.id],
  }),
  students: many(students),
  schedules: many(schedules),
  assessmentPlans: many(assessmentPlans),
  anecdotalRecords: many(anecdotalRecords),
  anecdotalSemesterSummaries: many(anecdotalSemesterSummaries),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  scores: many(scores),
  attendance: many(attendance),
  sessions: many(studentSessions),
  anecdotalRecords: many(anecdotalRecords),
  anecdotalSemesterSummaries: many(anecdotalSemesterSummaries),
}));

export const studentSessionsRelations = relations(
  studentSessions,
  ({ one }) => ({
    student: one(students, {
      fields: [studentSessions.studentId],
      references: [students.id],
    }),
  }),
);

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

export const visionValuesRelations = relations(visionValues, ({ many }) => ({
  recordValues: many(anecdotalRecordValues),
  semesterSummaries: many(anecdotalSemesterSummaries),
}));

export const anecdotalRecordsRelations = relations(anecdotalRecords, ({ one, many }) => ({
  student: one(students, { fields: [anecdotalRecords.studentId], references: [students.id] }),
  teacher: one(users, { fields: [anecdotalRecords.teacherId], references: [users.id] }),
  values: many(anecdotalRecordValues),
}));

export const anecdotalRecordValuesRelations = relations(anecdotalRecordValues, ({ one }) => ({
  record: one(anecdotalRecords, { fields: [anecdotalRecordValues.anecdotalRecordId], references: [anecdotalRecords.id] }),
  visionValue: one(visionValues, { fields: [anecdotalRecordValues.visionValueId], references: [visionValues.id] }),
}));

export const anecdotalSemesterSummariesRelations = relations(anecdotalSemesterSummaries, ({ one }) => ({
  student: one(students, { fields: [anecdotalSemesterSummaries.studentId], references: [students.id] }),
  visionValue: one(visionValues, { fields: [anecdotalSemesterSummaries.visionValueId], references: [visionValues.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
