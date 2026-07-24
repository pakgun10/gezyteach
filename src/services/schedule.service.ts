import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { schedules } from "../db/schema";

export async function listSchedulesByUser(userId: number) {
  return db.query.schedules.findMany({
    where: (s, { eq }) => eq(s.userId, userId),
    orderBy: (s, { asc }) => [asc(s.dayOfWeek), asc(s.startTime)],
    with: { class: true },
  });
}

export async function listSchedulesByUserAndDay(
  userId: number,
  dayOfWeek: number,
) {
  return db.query.schedules.findMany({
    where: (s, { eq, and: andFn }) =>
      andFn(eq(s.userId, userId), eq(s.dayOfWeek, dayOfWeek)),
    orderBy: (s, { asc }) => asc(s.startTime),
    with: { class: true },
  });
}

export async function getScheduleForUser(userId: number, scheduleId: number) {
  return db.query.schedules.findFirst({
    where: (s, { eq, and: andFn }) =>
      andFn(eq(s.id, scheduleId), eq(s.userId, userId)),
    with: { class: true },
  });
}

export async function createSchedule(
  userId: number,
  data: {
    classId: number;
    subject: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
  },
) {
  const [created] = await db
    .insert(schedules)
    .values({
      userId,
      classId: data.classId,
      subject: data.subject,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      room: data.room || null,
    })
    .returning();

  return created;
}

export async function updateSchedule(
  userId: number,
  scheduleId: number,
  data: {
    classId: number;
    subject: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
  },
) {
  await db
    .update(schedules)
    .set({
      classId: data.classId,
      subject: data.subject,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      room: data.room || null,
      updatedAt: Date.now(),
    })
    .where(and(eq(schedules.id, scheduleId), eq(schedules.userId, userId)));
}

export async function deleteSchedule(userId: number, scheduleId: number) {
  await db
    .delete(schedules)
    .where(and(eq(schedules.id, scheduleId), eq(schedules.userId, userId)));
}
