import { db } from "./index";
import { users } from "./schema";

const DEFAULT_EMAIL = process.env.SEED_EMAIL ?? "guru@gezyteach.local";
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? "gezyteach123";
const DEFAULT_NAME = process.env.SEED_NAME ?? "Guru GezyTeach";

async function main() {
  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, DEFAULT_EMAIL),
  });

  if (existing) {
    console.log(`User default sudah ada: ${DEFAULT_EMAIL}`);
    return;
  }

  const passwordHash = await Bun.password.hash(DEFAULT_PASSWORD);

  await db.insert(users).values({
    name: DEFAULT_NAME,
    email: DEFAULT_EMAIL,
    passwordHash,
    role: "admin",
  });

  console.log("User default dibuat:");
  console.log(`  email    : ${DEFAULT_EMAIL}`);
  console.log(`  password : ${DEFAULT_PASSWORD}`);
  console.log("Segera ganti password setelah login pertama kali.");
}

main();
