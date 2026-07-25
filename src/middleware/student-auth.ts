import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import {
  getSessionStudent,
  type SessionStudent,
} from "../services/student-auth.service";

export const STUDENT_SESSION_COOKIE = "gezyteach_student_session";

declare module "hono" {
  interface ContextVariableMap {
    student: SessionStudent;
  }
}

export async function requireStudentAuth(c: Context, next: Next) {
  const sessionId = getCookie(c, STUDENT_SESSION_COOKIE);
  const student = await getSessionStudent(sessionId);

  if (!student) {
    return c.redirect("/siswa/login");
  }

  c.set("student", student);
  await next();
}
