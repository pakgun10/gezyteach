import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { assessmentPlans, scores } from "../db/schema";
import { listStudentsByClass } from "./student.service";

export async function listSubjectsByClass(classId: number): Promise<string[]> {
  const rows = await db.query.schedules.findMany({
    where: (s, { eq: eqFn }) => eqFn(s.classId, classId),
  });

  const subjects = new Set(rows.map((r) => r.subject));
  return Array.from(subjects).sort();
}

export async function listAssessmentPlans(classId: number, subject: string) {
  return db.query.assessmentPlans.findMany({
    where: (p, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(p.classId, classId), eqFn(p.subject, subject)),
    orderBy: (p, { asc }) => asc(p.sortOrder),
  });
}

export async function createAssessmentPlan(data: {
  classId: number;
  subject: string;
  name: string;
  weight: number;
}) {
  const existing = await listAssessmentPlans(data.classId, data.subject);
  const nextOrder = existing.length;

  const [created] = await db
    .insert(assessmentPlans)
    .values({
      classId: data.classId,
      subject: data.subject,
      name: data.name,
      weight: data.weight,
      sortOrder: nextOrder,
    })
    .returning();

  return created;
}

export async function deleteAssessmentPlan(id: number) {
  await db.delete(assessmentPlans).where(eq(assessmentPlans.id, id));
}

export type ScoreMatrixRow = {
  student: { id: number; name: string; nis: string | null };
  values: Record<number, number | null>; // assessmentPlanId -> value
  finalScore: number | null;
};

export async function getScoreMatrix(
  classId: number,
  subject: string,
): Promise<{
  plans: Awaited<ReturnType<typeof listAssessmentPlans>>;
  rows: ScoreMatrixRow[];
}> {
  const [plans, studentsInClass] = await Promise.all([
    listAssessmentPlans(classId, subject),
    listStudentsByClass(classId),
  ]);

  const planIds = plans.map((p) => p.id);
  const allScores =
    planIds.length === 0
      ? []
      : await db.query.scores.findMany({
          where: (s, { inArray }) => inArray(s.assessmentPlanId, planIds),
        });

  const scoresByStudent = new Map<number, Map<number, number>>();
  for (const s of allScores) {
    if (s.value === null) continue;
    const map = scoresByStudent.get(s.studentId) ?? new Map();
    map.set(s.assessmentPlanId, s.value);
    scoresByStudent.set(s.studentId, map);
  }

  const totalWeight = plans.reduce((sum, p) => sum + p.weight, 0);

  const rows: ScoreMatrixRow[] = studentsInClass.map((student) => {
    const studentScores = scoresByStudent.get(student.id) ?? new Map();
    const values: Record<number, number | null> = {};
    let weightedSum = 0;
    let hasAnyValue = false;

    for (const plan of plans) {
      const value = studentScores.get(plan.id) ?? null;
      values[plan.id] = value;
      if (value !== null) {
        weightedSum += value * plan.weight;
        hasAnyValue = true;
      }
    }

    const finalScore =
      hasAnyValue && totalWeight > 0 ? weightedSum / totalWeight : null;

    return {
      student: { id: student.id, name: student.name, nis: student.nis },
      values,
      finalScore,
    };
  });

  return { plans, rows };
}

export async function upsertScore(
  studentId: number,
  assessmentPlanId: number,
  value: number | null,
) {
  const existing = await db.query.scores.findFirst({
    where: (s, { eq: eqFn, and: andFn }) =>
      andFn(
        eqFn(s.studentId, studentId),
        eqFn(s.assessmentPlanId, assessmentPlanId),
      ),
  });

  if (existing) {
    await db
      .update(scores)
      .set({ value, updatedAt: Date.now() })
      .where(
        and(
          eq(scores.studentId, studentId),
          eq(scores.assessmentPlanId, assessmentPlanId),
        ),
      );
  } else {
    await db.insert(scores).values({ studentId, assessmentPlanId, value });
  }
}
