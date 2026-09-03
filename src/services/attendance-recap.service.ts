import { db } from "../db";
import { listStudentsByClass } from "./student.service";
import { listSchedulesByUser } from "./schedule.service";

export type RecapRow = {
  nis: string | null;
  name: string;
  h: number;
  s: number;
  i: number;
  a: number;
  total: number;
  pct: number | null;
};

export type ClassRecap = {
  classId: number;
  className: string;
  subjects: string[];
  rows: RecapRow[];
  totals: { h: number; s: number; i: number; a: number };
};

export type ScheduleRecap = {
  scheduleId: number;
  classId: number;
  totalMeetings: number;
  rows: RecapRow[];
  totals: { h: number; s: number; i: number; a: number };
};

/** Rekap satu jadwal (kelas + mapel) dalam rentang tanggal tertentu. */
export async function getAttendanceScheduleRecap(
  scheduleId: number,
  classId: number,
  start: string,
  end: string,
): Promise<ScheduleRecap> {
  const [students, records] = await Promise.all([
    listStudentsByClass(classId),
    db.query.attendance.findMany({
      where: (a, { eq, gte, lte, and: andFn }) =>
        andFn(eq(a.scheduleId, scheduleId), gte(a.date, start), lte(a.date, end)),
    }),
  ]);

  const studentsById = new Map(students.map((student) => [student.id, student]));
  const dates = new Set<string>();
  const rowsByStudent = new Map<number, RecapRow>();

  for (const record of records) {
    const student = studentsById.get(record.studentId);
    if (!student) continue;

    dates.add(record.date);
    const row = rowsByStudent.get(student.id) ?? {
      nis: student.nis,
      name: student.name,
      h: 0,
      s: 0,
      i: 0,
      a: 0,
      total: 0,
      pct: null,
    };
    if (record.status === "H") row.h++;
    else if (record.status === "S") row.s++;
    else if (record.status === "I") row.i++;
    else if (record.status === "A") row.a++;
    row.total++;
    rowsByStudent.set(student.id, row);
  }

  const totalMeetings = dates.size;
  const rows = students.map((student) => {
    const row = rowsByStudent.get(student.id) ?? {
      nis: student.nis,
      name: student.name,
      h: 0,
      s: 0,
      i: 0,
      a: 0,
      total: 0,
      pct: null,
    };
    row.total = totalMeetings;
    row.pct = totalMeetings > 0 ? Math.round((row.h / totalMeetings) * 100) : null;
    return row;
  });
  rows.sort((a, b) => a.name.localeCompare(b.name, "id"));

  const totals = rows.reduce(
    (result, row) => ({
      h: result.h + row.h,
      s: result.s + row.s,
      i: result.i + row.i,
      a: result.a + row.a,
    }),
    { h: 0, s: 0, i: 0, a: 0 },
  );

  return {
    scheduleId,
    classId,
    totalMeetings,
    rows,
    totals,
  };
}

/**
 * Rekapitulasi absensi untuk satu guru: per kelas (agregasi semua jadwal
 * guru untuk kelas itu), per murid, dalam rentang tanggal [start, end].
 * Semua murid aktif di kelas tetap ditampilkan (0 jika tanpa catatan).
 */
export async function getAttendanceRecap(
  userId: number,
  start: string,
  end: string,
): Promise<ClassRecap[]> {
  const schedules = await listSchedulesByUser(userId);
  if (schedules.length === 0) return [];

  const scheduleIds = schedules.map((s) => s.id);
  const classIds = [...new Set(schedules.map((s) => s.classId))];

  const classNameById = new Map<number, string>();
  const subjectsByClass = new Map<number, Set<string>>();
  const scheduleClass = new Map<number, number>();
  for (const s of schedules) {
    classNameById.set(s.classId, s.class.name);
    if (!subjectsByClass.has(s.classId)) {
      subjectsByClass.set(s.classId, new Set());
    }
    subjectsByClass.get(s.classId)!.add(s.subject);
    scheduleClass.set(s.id, s.classId);
  }

  const records = await db.query.attendance.findMany({
    where: (a, { inArray, gte, lte, and: andFn }) =>
      andFn(inArray(a.scheduleId, scheduleIds), gte(a.date, start), lte(a.date, end)),
    with: { student: true },
  });

  const acc = new Map<number, Map<number, RecapRow>>();
  for (const cid of classIds) acc.set(cid, new Map());

  for (const rec of records) {
    const cid = scheduleClass.get(rec.scheduleId);
    if (cid === undefined) continue;
    const map = acc.get(cid)!;
    const st = rec.student;
    let row = map.get(st.id);
    if (!row) {
      row = { nis: st.nis, name: st.name, h: 0, s: 0, i: 0, a: 0, total: 0, pct: null };
      map.set(st.id, row);
    }
    if (rec.status === "H") row.h++;
    else if (rec.status === "S") row.s++;
    else if (rec.status === "I") row.i++;
    else if (rec.status === "A") row.a++;
    row.total++;
  }

  const out: ClassRecap[] = [];
  for (const cid of classIds) {
    const map = acc.get(cid)!;
    const students = await listStudentsByClass(cid);
    const rows: RecapRow[] = students.map((st) => {
      const r =
        map.get(st.id) ?? {
          nis: st.nis,
          name: st.name,
          h: 0,
          s: 0,
          i: 0,
          a: 0,
          total: 0,
          pct: null,
        };
      r.pct = r.total > 0 ? Math.round((r.h / r.total) * 100) : null;
      return r;
    });
    rows.sort((x, y) => x.name.localeCompare(y.name, "id"));

    const totals = rows.reduce(
      (t, r) => ({ h: t.h + r.h, s: t.s + r.s, i: t.i + r.i, a: t.a + r.a }),
      { h: 0, s: 0, i: 0, a: 0 },
    );

    out.push({
      classId: cid,
      className: classNameById.get(cid)!,
      subjects: [...(subjectsByClass.get(cid) ?? [])],
      rows,
      totals,
    });
  }

  out.sort((a, b) => a.className.localeCompare(b.className, "id"));
  return out;
}
