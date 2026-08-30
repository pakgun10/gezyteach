import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { anecdotalDevelopmentThresholds, anecdotalRecords, anecdotalRecordValues, anecdotalSemesterSummaries, classes, schedules, students, visionValues } from "../db/schema";

export type RecordCategory = "positive" | "needs_guidance";

export async function listTeachingClasses(userId: number) {
  const rows = await db.select({ id: classes.id, name: classes.name, level: classes.level, academicYear: classes.academicYear })
    .from(schedules).innerJoin(classes, eq(schedules.classId, classes.id))
    .where(eq(schedules.userId, userId)).orderBy(asc(classes.name));
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

export async function listActiveStudentsForTeacher(userId: number, classId: number) {
  const allowed = (await listTeachingClasses(userId)).some((item) => item.id === classId);
  if (!allowed) return [];
  return db.query.students.findMany({ where: (s, { and, eq }) => and(eq(s.classId, classId), eq(s.active, true)), orderBy: (s, { asc }) => asc(s.name) });
}

export async function listVisionValues() {
  return db.query.visionValues.findMany({ orderBy: (v, { asc }) => asc(v.sortOrder) });
}

export async function getRecordForTeacher(userId: number, recordId: number) {
  const record = await db.query.anecdotalRecords.findFirst({
    where: (r, { eq }) => eq(r.id, recordId),
    with: { student: { with: { class: true } }, values: { with: { visionValue: true } } },
  });
  if (!record || record.teacherId !== userId) return null;
  return record;
}

export async function listRecords(userId: number, filters: { classId?: number; month?: string }) {
  const rows = await db.query.anecdotalRecords.findMany({
    where: (r, { eq }) => eq(r.teacherId, userId),
    orderBy: (r, { desc }) => [desc(r.eventDate), desc(r.eventTime), desc(r.id)],
    with: { student: { with: { class: true } }, values: { with: { visionValue: true } } },
  });
  return rows.filter((row) => (!filters.classId || row.student.classId === filters.classId) && (!filters.month || row.eventDate.startsWith(filters.month)));
}

export async function createRecord(userId: number, data: { studentId: number; eventDate: string; eventTime?: string; location?: string; description: string; category: RecordCategory; followUpNotes?: string; visionValueIds: number[] }) {
  const student = await db.query.students.findFirst({ where: (s, { eq }) => eq(s.id, data.studentId) });
  if (!student || !student.active || !(await listTeachingClasses(userId)).some((item) => item.id === student.classId)) return null;
  const allowedValues = new Set((await listVisionValues()).map((value) => value.id));
  const valueIds = [...new Set(data.visionValueIds)].filter((id) => allowedValues.has(id));
  if (!data.description || valueIds.length === 0) return null;
  const [record] = await db.insert(anecdotalRecords).values({ studentId: data.studentId, teacherId: userId, eventDate: data.eventDate, eventTime: data.eventTime || null, location: data.location || null, description: data.description, category: data.category, followUpNotes: data.followUpNotes || null }).returning();
  await db.insert(anecdotalRecordValues).values(valueIds.map((visionValueId) => ({ anecdotalRecordId: record!.id, visionValueId })));
  return record;
}

export async function updateRecord(userId: number, recordId: number, data: { eventDate: string; eventTime?: string; location?: string; description: string; category: RecordCategory; followUpNotes?: string; visionValueIds: number[] }) {
  const record = await getRecordForTeacher(userId, recordId);
  const allowedValues = new Set((await listVisionValues()).map((value) => value.id));
  const valueIds = [...new Set(data.visionValueIds)].filter((id) => allowedValues.has(id));
  if (!record || !data.description || valueIds.length === 0) return false;
  await db.update(anecdotalRecords).set({ eventDate: data.eventDate, eventTime: data.eventTime || null, location: data.location || null, description: data.description, category: data.category, followUpNotes: data.followUpNotes || null, updatedAt: Date.now() }).where(eq(anecdotalRecords.id, recordId));
  await db.delete(anecdotalRecordValues).where(eq(anecdotalRecordValues.anecdotalRecordId, recordId));
  await db.insert(anecdotalRecordValues).values(valueIds.map((visionValueId) => ({ anecdotalRecordId: recordId, visionValueId })));
  return true;
}

export async function deleteRecord(userId: number, recordId: number) {
  const record = await getRecordForTeacher(userId, recordId);
  if (!record) return false;
  await db.delete(anecdotalRecords).where(eq(anecdotalRecords.id, recordId));
  return true;
}

export function semesterDateRange(semester: string, academicYear: string) {
  const startYear = Number(academicYear.split("/")[0]) || new Date().getFullYear();
  return semester === "2"
    ? { from: `${startYear + 1}-01-01`, to: `${startYear + 1}-06-30` }
    : { from: `${startYear}-07-01`, to: `${startYear}-12-31` };
}

export async function monthlyRecap(userId: number, classId: number, month: string) {
  const records = await listRecords(userId, { classId, month });
  return aggregateRecords(records);
}

export async function semesterRecap(userId: number, classId: number, semester: string, academicYear: string) {
  const range = semesterDateRange(semester, academicYear);
  const records = (await listRecords(userId, { classId })).filter((r) => r.eventDate >= range.from && r.eventDate <= range.to);
  const studentsInClass = await listActiveStudentsForTeacher(userId, classId);
  const values = await listVisionValues();
  const thresholds = await db.query.anecdotalDevelopmentThresholds.findMany({ orderBy: (t, { asc }) => asc(t.minimumPositiveCount) });
  const summary = new Map<string, { positiveCount: number; needsGuidanceCount: number }>();
  for (const record of records) for (const value of record.values) {
    const key = `${record.studentId}:${value.visionValueId}`;
    const current = summary.get(key) ?? { positiveCount: 0, needsGuidanceCount: 0 };
    record.category === "positive" ? current.positiveCount++ : current.needsGuidanceCount++;
    summary.set(key, current);
  }
  const cached = await db.query.anecdotalSemesterSummaries.findMany({ where: (s, { and, eq }) => and(eq(s.semester, semester), eq(s.academicYear, academicYear)), with: { student: true } });
  const narratives = new Map(cached.map((s) => [`${s.studentId}:${s.visionValueId}`, s.narrativeDescription]));
  const categoryFor = (positiveCount: number) => (thresholds.filter((t) => positiveCount >= t.minimumPositiveCount).at(-1)?.category ?? "BT") as "BT" | "MT" | "MB" | "SM";
  const rows = studentsInClass.map((student) => ({ student, values: values.map((value) => {
    const counts = summary.get(`${student.id}:${value.id}`) ?? { positiveCount: 0, needsGuidanceCount: 0 };
    return { visionValue: value, ...counts, developmentCategory: categoryFor(counts.positiveCount), narrativeDescription: narratives.get(`${student.id}:${value.id}`) ?? null };
  }) }));
  const attentionByValue = values.map((visionValue) => ({
    visionValue,
    btCount: rows.filter((row) => row.values.find((item) => item.visionValue.id === visionValue.id)?.developmentCategory === "BT").length,
    mtCount: rows.filter((row) => row.values.find((item) => item.visionValue.id === visionValue.id)?.developmentCategory === "MT").length,
  }));
  const observed = new Set(records.map((r) => r.studentId)).size;
  return { rows, totalRecords: records.length, observedStudents: observed, observedPercent: studentsInClass.length ? Math.round((observed / studentsInClass.length) * 100) : 0, attentionByValue, range };
}

function aggregateRecords(records: Awaited<ReturnType<typeof listRecords>>) {
  const recap = new Map<string, { studentId: number; studentName: string; visionValueId: number; visionValueName: string; positiveCount: number; needsGuidanceCount: number }>();
  for (const record of records) for (const value of record.values) {
    const key = `${record.studentId}:${value.visionValueId}`;
    const current = recap.get(key) ?? { studentId: record.studentId, studentName: record.student.name, visionValueId: value.visionValueId, visionValueName: value.visionValue.name, positiveCount: 0, needsGuidanceCount: 0 };
    record.category === "positive" ? current.positiveCount++ : current.needsGuidanceCount++;
    recap.set(key, current);
  }
  return [...recap.values()].sort((a, b) => a.studentName.localeCompare(b.studentName) || a.visionValueName.localeCompare(b.visionValueName));
}

export async function saveNarrative(userId: number, studentId: number, visionValueId: number, semester: string, academicYear: string, narrativeDescription: string) {
  const student = await db.query.students.findFirst({ where: (s, { eq }) => eq(s.id, studentId) });
  if (!student || !(await listTeachingClasses(userId)).some((item) => item.id === student.classId)) return false;
  const recap = await semesterRecap(userId, student.classId, semester, academicYear);
  const item = recap.rows.find((r) => r.student.id === studentId)?.values.find((v) => v.visionValue.id === visionValueId);
  if (!item) return false;
  await db.insert(anecdotalSemesterSummaries).values({ studentId, visionValueId, semester, academicYear, positiveCount: item.positiveCount, needsGuidanceCount: item.needsGuidanceCount, developmentCategory: item.developmentCategory, narrativeDescription: narrativeDescription || null, generatedAt: Date.now(), updatedAt: Date.now() }).onConflictDoUpdate({ target: [anecdotalSemesterSummaries.studentId, anecdotalSemesterSummaries.visionValueId, anecdotalSemesterSummaries.semester, anecdotalSemesterSummaries.academicYear], set: { positiveCount: item.positiveCount, needsGuidanceCount: item.needsGuidanceCount, developmentCategory: item.developmentCategory, narrativeDescription: narrativeDescription || null, generatedAt: Date.now(), updatedAt: Date.now() } });
  return true;
}
