import { db } from "./index";
import { students } from "./schema";
import { eq } from "drizzle-orm";

/**
 * Backfill `loginId` (username login siswa) dari kolom `nis` yang sudah ada.
 *
 * Aturan:
 * - Jika NIS berformat "NISN/NIS-lokal" (mis. "0125774157/10127"), pakai
 *   bagian setelah "/" (NIS lokal sekolah, lebih pendek dan mudah diingat).
 * - Jika NIS hanya berupa NISN saja (tanpa "/"), pakai NIS tersebut apa adanya.
 * - Siswa tanpa NIS dilewati (perlu diisi manual oleh guru sebelum bisa login).
 *
 * Script ini idempotent: siswa yang sudah punya `loginId` tidak akan diubah.
 */
async function main() {
  const all = await db.query.students.findMany();

  let updated = 0;
  let skippedNoNis = 0;
  let skippedAlreadySet = 0;
  const conflicts: string[] = [];

  const seen = new Set(
    all.map((s) => s.loginId).filter((v): v is string => !!v),
  );

  for (const student of all) {
    if (student.loginId) {
      skippedAlreadySet++;
      continue;
    }

    if (!student.nis || !student.nis.trim()) {
      skippedNoNis++;
      continue;
    }

    const nis = student.nis.trim();
    const loginId = nis.includes("/") ? nis.split("/")[1]!.trim() : nis;

    if (!loginId) {
      skippedNoNis++;
      continue;
    }

    if (seen.has(loginId)) {
      conflicts.push(
        `Siswa id=${student.id} (${student.name}) -> loginId "${loginId}" sudah dipakai siswa lain. Dilewati, perlu diisi manual.`,
      );
      continue;
    }

    await db
      .update(students)
      .set({ loginId, updatedAt: Date.now() })
      .where(eq(students.id, student.id));

    seen.add(loginId);
    updated++;
  }

  console.log(`Backfill loginId selesai.`);
  console.log(`  Diupdate           : ${updated}`);
  console.log(`  Sudah punya loginId: ${skippedAlreadySet}`);
  console.log(`  Dilewati (tanpa NIS): ${skippedNoNis}`);
  if (conflicts.length > 0) {
    console.log(`  Konflik (${conflicts.length}):`);
    for (const c of conflicts) console.log(`    - ${c}`);
  }
}

main();
