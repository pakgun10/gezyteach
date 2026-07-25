import { db } from "../db";

export async function getStudentProfile(studentId: number) {
  return db.query.students.findFirst({
    where: (s, { eq }) => eq(s.id, studentId),
    with: { class: true },
  });
}

const STATUS_LABELS: Record<string, string> = {
  H: "Hadir",
  S: "Sakit",
  I: "Izin",
  A: "Alpa",
};

export type AttendanceSummary = {
  total: number;
  countByStatus: Record<string, number>;
  recent: {
    date: string;
    status: string;
    statusLabel: string;
    subject: string;
    note: string | null;
  }[];
};

/** Rekap absensi siswa: total per status + daftar terbaru. */
export async function getAttendanceSummary(
  studentId: number,
): Promise<AttendanceSummary> {
  const rows = await db.query.attendance.findMany({
    where: (a, { eq }) => eq(a.studentId, studentId),
    orderBy: (a, { desc }) => desc(a.date),
    with: { schedule: true },
  });

  const countByStatus: Record<string, number> = { H: 0, S: 0, I: 0, A: 0 };
  for (const row of rows) {
    countByStatus[row.status] = (countByStatus[row.status] ?? 0) + 1;
  }

  return {
    total: rows.length,
    countByStatus,
    recent: rows.slice(0, 30).map((row) => ({
      date: row.date,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status] ?? row.status,
      subject: row.schedule.subject,
      note: row.note,
    })),
  };
}

export type StudentScoreSubject = {
  subject: string;
  components: { name: string; weight: number; value: number | null }[];
  finalScore: number | null;
};

/** Rekap nilai siswa per mata pelajaran, dikelompokkan berdasarkan komponen nilai kelasnya. */
export async function getScoresForStudent(
  studentId: number,
  classId: number,
): Promise<StudentScoreSubject[]> {
  const [plans, studentScores] = await Promise.all([
    db.query.assessmentPlans.findMany({
      where: (p, { eq }) => eq(p.classId, classId),
      orderBy: (p, { asc }) => asc(p.sortOrder),
    }),
    db.query.scores.findMany({
      where: (s, { eq }) => eq(s.studentId, studentId),
    }),
  ]);

  const valueByPlanId = new Map(studentScores.map((s) => [s.assessmentPlanId, s.value]));

  const bySubject = new Map<string, typeof plans>();
  for (const plan of plans) {
    const list = bySubject.get(plan.subject) ?? [];
    list.push(plan);
    bySubject.set(plan.subject, list);
  }

  const result: StudentScoreSubject[] = [];
  for (const [subject, subjectPlans] of bySubject) {
    let weightedSum = 0;
    let totalWeight = 0;
    let hasAnyValue = false;

    const components = subjectPlans.map((plan) => {
      const value = valueByPlanId.get(plan.id) ?? null;
      totalWeight += plan.weight;
      if (value !== null) {
        weightedSum += value * plan.weight;
        hasAnyValue = true;
      }
      return { name: plan.name, weight: plan.weight, value };
    });

    result.push({
      subject,
      components,
      finalScore: hasAnyValue && totalWeight > 0 ? weightedSum / totalWeight : null,
    });
  }

  return result.sort((a, b) => a.subject.localeCompare(b.subject));
}
