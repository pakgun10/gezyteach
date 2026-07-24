import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { attendance } from "../db/schema";
import { listStudentsByClass } from "./student.service";

export type AttendanceStatus = "H" | "S" | "I" | "A";

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
