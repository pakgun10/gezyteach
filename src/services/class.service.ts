import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { classes, students } from "../db/schema";

export async function listClassesWithStudentCount(userId: number) {
  const rows = await db.query.classes.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
    orderBy: (c, { asc }) => asc(c.name),
    with: {
      students: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    studentCount: row.students.length,
  }));
}

export async function getClassForUser(userId: number, classId: number) {
  return db.query.classes.findFirst({
    where: (c, { eq, and: andFn }) =>
      andFn(eq(c.id, classId), eq(c.userId, userId)),
  });
}

export async function createClass(
  userId: number,
  data: { name: string; level?: string; academicYear?: string },
) {
  const [created] = await db
    .insert(classes)
    .values({
      userId,
      name: data.name,
      level: data.level || null,
      academicYear: data.academicYear || null,
    })
    .returning();

  return created;
}

export async function deleteClass(userId: number, classId: number) {
  await db
    .delete(classes)
    .where(and(eq(classes.id, classId), eq(classes.userId, userId)));
}
