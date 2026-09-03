import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { classes, journals, schedules } from "../db/schema";

export function normalizeJournalSubject(subject: string) {
  return subject.trim().toLocaleLowerCase("id-ID");
}

export async function listJournalClasses(userId: number) {
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      level: classes.level,
      academicYear: classes.academicYear,
    })
    .from(schedules)
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .where(eq(schedules.userId, userId))
    .orderBy(asc(classes.name));

  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

export async function listJournalSubjects(userId: number, classId: number) {
  const rows = await db
    .select({ subject: schedules.subject })
    .from(schedules)
    .where(and(eq(schedules.userId, userId), eq(schedules.classId, classId)))
    .orderBy(asc(schedules.subject));

  const uniqueSubjects = new Map<string, string>();
  for (const row of rows) {
    const subject = row.subject.trim();
    if (subject) uniqueSubjects.set(normalizeJournalSubject(subject), subject);
  }
  return [...uniqueSubjects.values()];
}

export async function listJournalsForReport(
  userId: number,
  classId: number,
  subject: string,
  dateFrom: string,
  dateTo: string,
) {
  return db.query.journals.findMany({
    where: (journal, { and: andFn, eq: eqFn, gte: gteFn, lte: lteFn }) =>
      andFn(
        eqFn(journal.userId, userId),
        eqFn(journal.classId, classId),
        eqFn(journal.subjectKey, normalizeJournalSubject(subject)),
        gteFn(journal.date, dateFrom),
        lteFn(journal.date, dateTo),
      ),
    orderBy: (journal, { asc: ascFn }) => [ascFn(journal.date), ascFn(journal.id)],
    with: { schedule: { columns: { subject: true } } },
  });
}

export async function listJournalsByDate(userId: number, date: string) {
  return db.query.journals.findMany({
    where: (j, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(j.userId, userId), eqFn(j.date, date)),
    with: {
      schedule: { with: { class: true } },
    },
  });
}

export async function getJournalForUser(userId: number, journalId: number) {
  const journal = await db.query.journals.findFirst({
    where: (j, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(j.id, journalId), eqFn(j.userId, userId)),
    with: {
      schedule: { with: { class: true } },
    },
  });

  return journal ?? null;
}

export async function getOrCreateDraftJournal(
  userId: number,
  scheduleId: number,
  date: string,
) {
  const schedule = await db.query.schedules.findFirst({
    where: (s, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(s.id, scheduleId), eqFn(s.userId, userId)),
  });
  if (!schedule) return null;

  const subjectKey = normalizeJournalSubject(schedule.subject);
  const [created] = await db
    .insert(journals)
    .values({
      scheduleId,
      userId,
      classId: schedule.classId,
      subjectKey,
      date,
      status: "draft",
    })
    .onConflictDoNothing({
      target: [
        journals.userId,
        journals.classId,
        journals.subjectKey,
        journals.date,
      ],
    })
    .returning();

  if (created) return created;

  return db.query.journals.findFirst({
    where: (j, { eq: eqFn, and: andFn }) =>
      andFn(
        eqFn(j.userId, userId),
        eqFn(j.classId, schedule.classId),
        eqFn(j.subjectKey, subjectKey),
        eqFn(j.date, date),
      ),
  });
}

export async function updateJournal(
  journalId: number,
  data: {
    topic?: string;
    achievement?: string;
    reflection?: string;
    obstacle?: string;
    followUpPlan?: string;
    presentCount?: number;
    absentCount?: number;
    status: "draft" | "completed";
  },
) {
  await db
    .update(journals)
    .set({
      topic: data.topic || null,
      achievement: data.achievement || null,
      reflection: data.reflection || null,
      obstacle: data.obstacle || null,
      followUpPlan: data.followUpPlan || null,
      presentCount: data.presentCount ?? null,
      absentCount: data.absentCount ?? null,
      status: data.status,
      updatedAt: Date.now(),
    })
    .where(eq(journals.id, journalId));
}
