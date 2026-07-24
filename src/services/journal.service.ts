import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { journals } from "../db/schema";

export async function listJournalsByDate(userId: number, date: string) {
  return db.query.journals.findMany({
    where: (j, { eq: eqFn }) => eqFn(j.date, date),
    with: {
      schedule: { with: { class: true } },
    },
  }).then((rows) => rows.filter((r) => r.schedule.userId === userId));
}

export async function getJournalForUser(userId: number, journalId: number) {
  const journal = await db.query.journals.findFirst({
    where: (j, { eq: eqFn }) => eqFn(j.id, journalId),
    with: {
      schedule: { with: { class: true } },
    },
  });

  if (!journal || journal.schedule.userId !== userId) return null;
  return journal;
}

export async function getJournalByScheduleAndDate(
  scheduleId: number,
  date: string,
) {
  return db.query.journals.findFirst({
    where: (j, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(j.scheduleId, scheduleId), eqFn(j.date, date)),
  });
}

export async function createDraftJournal(scheduleId: number, date: string) {
  const [created] = await db
    .insert(journals)
    .values({ scheduleId, date, status: "draft" })
    .returning();

  return created;
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
