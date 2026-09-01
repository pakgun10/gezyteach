import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { journals } from "../db/schema";

export function normalizeJournalSubject(subject: string) {
  return subject.trim().toLocaleLowerCase("id-ID");
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
      presentCount: data.presentCount ?? null,
      absentCount: data.absentCount ?? null,
      status: data.status,
      updatedAt: Date.now(),
    })
    .where(eq(journals.id, journalId));
}
