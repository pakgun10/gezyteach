import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import type { UserRole } from "./auth.service";

const MIN_PASSWORD_LENGTH = 8;

export async function listUsers() {
  return db.query.users.findMany({
    orderBy: (u, { asc }) => asc(u.name),
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
}

export async function getUserById(id: number) {
  return db.query.users.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.id, id),
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
}

export type CreateUserResult =
  | { ok: true; id: number }
  | { ok: false; error: "email_taken" | "too_short" | "invalid" };

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<CreateUserResult> {
  if (!data.name.trim() || !data.email.trim()) {
    return { ok: false, error: "invalid" };
  }

  if (data.password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: "too_short" };
  }

  const existing = await db.query.users.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.email, data.email),
  });

  if (existing) {
    return { ok: false, error: "email_taken" };
  }

  const passwordHash = await Bun.password.hash(data.password);

  const [created] = await db
    .insert(users)
    .values({
      name: data.name.trim(),
      email: data.email.trim(),
      passwordHash,
      role: data.role,
    })
    .returning({ id: users.id });

  return { ok: true, id: created!.id };
}

export type UpdateUserResult =
  | { ok: true }
  | { ok: false; error: "email_taken" | "invalid" | "last_admin" };

export async function updateUser(
  id: number,
  data: { name: string; email: string; role: UserRole },
): Promise<UpdateUserResult> {
  if (!data.name.trim() || !data.email.trim()) {
    return { ok: false, error: "invalid" };
  }

  const existing = await db.query.users.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.email, data.email),
  });

  if (existing && existing.id !== id) {
    return { ok: false, error: "email_taken" };
  }

  if (data.role !== "admin") {
    const admins = await db.query.users.findMany({
      where: (u, { eq: eqFn }) => eqFn(u.role, "admin"),
    });
    const isOnlyAdmin = admins.length === 1 && admins[0]!.id === id;
    if (isOnlyAdmin) {
      return { ok: false, error: "last_admin" };
    }
  }

  await db
    .update(users)
    .set({
      name: data.name.trim(),
      email: data.email.trim(),
      role: data.role,
      updatedAt: Date.now(),
    })
    .where(eq(users.id, id));

  return { ok: true };
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: "too_short" };

export async function resetPassword(
  id: number,
  newPassword: string,
): Promise<ResetPasswordResult> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: "too_short" };
  }

  const passwordHash = await Bun.password.hash(newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: Date.now() })
    .where(eq(users.id, id));

  return { ok: true };
}

export type DeleteUserResult =
  | { ok: true }
  | { ok: false; error: "last_admin" | "not_found" };

export async function deleteUser(id: number): Promise<DeleteUserResult> {
  const target = await db.query.users.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.id, id),
  });

  if (!target) return { ok: false, error: "not_found" };

  if (target.role === "admin") {
    const admins = await db.query.users.findMany({
      where: (u, { eq: eqFn }) => eqFn(u.role, "admin"),
    });
    if (admins.length === 1) {
      return { ok: false, error: "last_admin" };
    }
  }

  await db.delete(users).where(eq(users.id, id));
  return { ok: true };
}
