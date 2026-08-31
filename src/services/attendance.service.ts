import { and, countDistinct, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { attendance, classes, schedules } from "../db/schema";
import { listStudentsByClass } from "./student.service";

export type AttendanceStatus = "H" | "S" | "I" | "A";

export async function listAttendanceExecutions(
  userId: number,
  classId: number,
  month?: string,
) {
  const selectedMonth = month && /^(0[1-9]|1[0-2])$/.test(month) ? month : undefined;

  return db
    .select({
      date: attendance.date,
      classId: schedules.classId,
      className: classes.name,
      subjects: sql<string>`group_concat(distinct ${schedules.subject})`,
      studentCount: countDistinct(attendance.studentId),
      absentCount: sql<number>`count(distinct case when ${attendance.status} <> 'H' then ${attendance.studentId} end)`,
    })
    .from(attendance)
    .innerJoin(schedules, eq(attendance.scheduleId, schedules.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .where(
      and(
        eq(schedules.userId, userId),
        eq(schedules.classId, classId),
        selectedMonth
          ? sql`substr(${attendance.date}, 6, 2) = ${selectedMonth}`
          : undefined,
      ),
    )
    .groupBy(attendance.date, schedules.classId, classes.name)
    .orderBy(desc(attendance.date));
}

export async function listAttendanceExecutionsPage(
  userId: number,
  classId: number,
  month: string | undefined,
  pagination: { page: number; pageSize: number },
) {
  const selectedMonth = month && /^(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
  const where = and(
    eq(schedules.userId, userId),
    eq(schedules.classId, classId),
    selectedMonth
      ? sql`substr(${attendance.date}, 6, 2) = ${selectedMonth}`
      : undefined,
  );
  const pageSize = Math.min(Math.max(Math.trunc(pagination.pageSize) || 20, 1), 100);
  const requestedPage = Math.max(Math.trunc(pagination.page) || 1, 1);
  const [totalRow] = await db
    .select({ total: countDistinct(attendance.date) })
    .from(attendance)
    .innerJoin(schedules, eq(attendance.scheduleId, schedules.id))
    .where(where);
  const total = totalRow?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const page = Math.min(requestedPage, Math.max(totalPages, 1));
  const executions = await db
    .select({
      date: attendance.date,
      classId: schedules.classId,
      className: classes.name,
      subjects: sql<string>`group_concat(distinct ${schedules.subject})`,
      studentCount: countDistinct(attendance.studentId),
      absentCount: sql<number>`count(distinct case when ${attendance.status} <> 'H' then ${attendance.studentId} end)`,
    })
    .from(attendance)
    .innerJoin(schedules, eq(attendance.scheduleId, schedules.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .where(where)
    .groupBy(attendance.date, schedules.classId, classes.name)
    .orderBy(desc(attendance.date))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { executions, pagination: { page, pageSize, total, totalPages } };
}

export async function getAttendanceForSchedule(
  scheduleId: number,
  classId: number,
  date: string,
) {
  const [studentsInClass, existing] = await Promise.all([
    listStudentsByClass(classId),
    db.query.attendance.findMany({
      where: (a, { eq: eqFn, and: andFn }) =>
        andFn(eqFn(a.scheduleId, scheduleId), eqFn(a.date, date)),
    }),
  ]);

  const statusByStudent = new Map(existing.map((a) => [a.studentId, a]));

  return studentsInClass.map((student) => ({
    student,
    status: statusByStudent.get(student.id)?.status ?? null,
    note: statusByStudent.get(student.id)?.note ?? null,
  }));
}

export async function saveAttendance(
  scheduleId: number,
  date: string,
  entries: { studentId: number; status: AttendanceStatus; note?: string }[],
) {
  for (const entry of entries) {
    const existing = await db.query.attendance.findFirst({
      where: (a, { eq: eqFn, and: andFn }) =>
        andFn(
          eqFn(a.studentId, entry.studentId),
          eqFn(a.scheduleId, scheduleId),
          eqFn(a.date, date),
        ),
    });

    if (existing) {
      await db
        .update(attendance)
        .set({
          status: entry.status,
          note: entry.note || null,
          updatedAt: Date.now(),
        })
        .where(
          and(
            eq(attendance.studentId, entry.studentId),
            eq(attendance.scheduleId, scheduleId),
            eq(attendance.date, date),
          ),
        );
    } else {
      await db.insert(attendance).values({
        studentId: entry.studentId,
        scheduleId,
        date,
        status: entry.status,
        note: entry.note || null,
      });
    }
  }
}
