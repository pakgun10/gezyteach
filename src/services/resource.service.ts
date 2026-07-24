import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { resources } from "../db/schema";

export const RESOURCE_CATEGORIES = [
  "PPT",
  "Video",
  "LKPD",
  "Bank Soal",
  "Lainnya",
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export async function listResourcesByUser(userId: number) {
  return db.query.resources.findMany({
    where: (r, { eq: eqFn }) => eqFn(r.userId, userId),
    orderBy: (r, { asc }) => [asc(r.category), asc(r.title)],
  });
}

export async function createResource(
  userId: number,
  data: {
    category: ResourceCategory;
    title: string;
    url: string;
    description?: string;
  },
) {
  const [created] = await db
    .insert(resources)
    .values({
      userId,
      category: data.category,
      title: data.title,
      url: data.url,
      description: data.description || null,
    })
    .returning();

  return created;
}

export async function deleteResource(userId: number, resourceId: number) {
  await db
    .delete(resources)
    .where(and(eq(resources.id, resourceId), eq(resources.userId, userId)));
}
