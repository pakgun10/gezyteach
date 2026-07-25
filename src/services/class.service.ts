import { eq } from "drizzle-orm";
import { db } from "../db";
import { classes } from "../db/schema";

/**
 * Kelas adalah data bersama sekolah: semua guru bisa melihat & mengelola
 * kelas dan siswanya, tidak dibatasi hanya milik pembuatnya.
 */
export async function listClassesWithStudentCount() {
  const rows = await db.query.classes.findMany({
    orderBy: (c, { asc }) => asc(c.name),
    with: {
      students: true,
      createdBy: { columns: { id: true, name: true } },
    },
  });

  return rows.map((row) => ({
    ...row,
    studentCount: row.students.length,
  }));
}

export async function getClassById(classId: number) {
  return db.query.classes.findFirst({
    where: (c, { eq: eqFn }) => eqFn(c.id, classId),
    with: {
      createdBy: { columns: { id: true, name: true } },
    },
  });
}

export async function createClass(
  createdByUserId: number,
  data: { name: string; level?: string; academicYear?: string },
) {
  const [created] = await db
    .insert(classes)
    .values({
      createdByUserId,
      name: data.name,
      level: data.level || null,
      academicYear: data.academicYear || null,
    })
    .returning();

  return created;
}

export async function deleteClass(classId: number) {
  await db.delete(classes).where(eq(classes.id, classId));
}
