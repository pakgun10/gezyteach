import { and, eq } from "drizzle-orm";
import Papa from "papaparse";
import { db } from "../db";
import { students } from "../db/schema";

export type StudentGender = "L" | "P" | undefined;

export async function listStudentsByClass(classId: number) {
  return db.query.students.findMany({
    where: (s, { eq }) => eq(s.classId, classId),
    orderBy: (s, { asc }) => asc(s.name),
  });
}

export async function createStudent(
  classId: number,
  data: { nis?: string; name: string; gender?: StudentGender },
) {
  const [created] = await db
    .insert(students)
    .values({
      classId,
      nis: data.nis || null,
      name: data.name,
      gender: data.gender || null,
    })
    .returning();

  return created;
}

export async function updateStudent(
  classId: number,
  studentId: number,
  data: { nis?: string; name: string; gender?: StudentGender },
) {
  await db
    .update(students)
    .set({
      nis: data.nis || null,
      name: data.name,
      gender: data.gender || null,
      updatedAt: Date.now(),
    })
    .where(and(eq(students.id, studentId), eq(students.classId, classId)));
}

export async function deleteStudent(classId: number, studentId: number) {
  await db
    .delete(students)
    .where(and(eq(students.id, studentId), eq(students.classId, classId)));
}

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

/**
 * Import siswa dari teks CSV dengan header: nis,name,gender
 * `gender` opsional, hanya menerima "L" atau "P" (case-insensitive).
 */
export async function importStudentsFromCsv(
  classId: number,
  csvText: string,
): Promise<ImportResult> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  const existing = await listStudentsByClass(classId);
  const existingNis = new Set(
    existing.map((s) => s.nis).filter((nis): nis is string => !!nis),
  );

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowNumber = i + 2; // +1 header, +1 for 1-based
    const name = row?.name?.trim();

    if (!name) {
      result.skipped++;
      result.errors.push(`Baris ${rowNumber}: kolom "name" wajib diisi`);
      continue;
    }

    const nis = row?.nis?.trim() || undefined;
    const genderRaw = row?.gender?.trim().toUpperCase();
    const gender: StudentGender =
      genderRaw === "L" || genderRaw === "P" ? genderRaw : undefined;

    if (nis && existingNis.has(nis)) {
      result.skipped++;
      result.errors.push(`Baris ${rowNumber}: NIS "${nis}" sudah ada`);
      continue;
    }

    await createStudent(classId, { nis, name, gender });
    if (nis) existingNis.add(nis);
    result.imported++;
  }

  return result;
}
