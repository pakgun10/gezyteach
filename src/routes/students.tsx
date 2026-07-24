import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import {
  createClass,
  deleteClass,
  getClassForUser,
  listClassesWithStudentCount,
} from "../services/class.service";
import {
  createStudent,
  deleteStudent,
  importStudentsFromCsv,
  listStudentsByClass,
  updateStudent,
} from "../services/student.service";
import { Layout } from "../components/Layout";
import { Alert } from "../components/Alert";

type AppContext = {
  Variables: { user: SessionUser };
};

export const studentsRoutes = new Hono<AppContext>();

function ClassListPage({
  user,
  classes,
}: {
  user: SessionUser;
  classes: Awaited<ReturnType<typeof listClassesWithStudentCount>>;
}) {
  return (
    <Layout title="Data Siswa" user={user} activeNav="students">
      <h1 class="text-xl font-semibold mb-4">Data Siswa</h1>

      <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <h2 class="font-medium mb-3">Tambah Kelas</h2>
        <form method="post" action="/app/students" class="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="Nama kelas, contoh: VIII-1"
            required
            class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            class="bg-emerald-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-emerald-700"
          >
            Tambah
          </button>
        </form>
      </div>

      <div class="space-y-2">
        {classes.length === 0 && (
          <p class="text-sm text-slate-500 text-center py-8">
            Belum ada kelas. Tambahkan kelas pertama Anda di atas.
          </p>
        )}
        {classes.map((klass) => (
          <a
            href={`/app/students/${klass.id}`}
            class="block bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 transition"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{klass.name}</p>
                <p class="text-sm text-slate-500">
                  {klass.studentCount} siswa
                </p>
              </div>
              <span class="text-slate-400">›</span>
            </div>
          </a>
        ))}
      </div>
    </Layout>
  );
}

studentsRoutes.get("/app/students", async (c) => {
  const user = c.get("user");
  const classes = await listClassesWithStudentCount(user.id);
  return c.html(<ClassListPage user={user} classes={classes} />);
});

studentsRoutes.post("/app/students", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();

  if (name) {
    await createClass(user.id, { name });
  }

  return c.redirect("/app/students");
});

studentsRoutes.delete("/app/students/:classId", async (c) => {
  const user = c.get("user");
  const classId = Number(c.req.param("classId"));
  await deleteClass(user.id, classId);
  c.header("HX-Redirect", "/app/students");
  return c.body(null);
});

function ClassDetailPage({
  user,
  klass,
  students,
  importResult,
}: {
  user: SessionUser;
  klass: { id: number; name: string };
  students: Awaited<ReturnType<typeof listStudentsByClass>>;
  importResult?: { imported: number; skipped: number; errors: string[] };
}) {
  return (
    <Layout title={klass.name} user={user} activeNav="students">
      <div class="flex items-center gap-2 mb-4">
        <a href="/app/students" class="text-slate-400">
          ‹
        </a>
        <h1 class="text-xl font-semibold">{klass.name}</h1>
      </div>

      {importResult && (
        <Alert variant={importResult.errors.length ? "error" : "success"}>
          Berhasil impor {importResult.imported} siswa
          {importResult.skipped > 0 && `, ${importResult.skipped} dilewati`}.
          {importResult.errors.length > 0 && (
            <ul class="mt-1 list-disc list-inside">
              {importResult.errors.map((e) => (
                <li>{e}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <h2 class="font-medium mb-3">Tambah Siswa</h2>
        <form
          method="post"
          action={`/app/students/${klass.id}`}
          class="grid grid-cols-1 sm:grid-cols-4 gap-2"
        >
          <input
            type="text"
            name="nis"
            placeholder="NIS (opsional)"
            class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="text"
            name="name"
            placeholder="Nama siswa"
            required
            class="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            name="gender"
            class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Gender</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
          <button
            type="submit"
            class="sm:col-span-4 bg-emerald-600 text-white rounded-lg py-2 font-medium hover:bg-emerald-700"
          >
            Tambah Siswa
          </button>
        </form>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <h2 class="font-medium mb-1">Import CSV</h2>
        <p class="text-xs text-slate-500 mb-3">
          Kolom: <code>nis,name,gender</code>. Unduh{" "}
          <a href="/templates/students-import.csv" class="text-emerald-700 underline">
            template
          </a>
          .
        </p>
        <form
          method="post"
          action={`/app/students/${klass.id}/import`}
          enctype="multipart/form-data"
          class="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            class="flex-1 text-sm"
          />
          <button
            type="submit"
            class="bg-slate-700 text-white rounded-lg px-4 py-2 font-medium hover:bg-slate-800"
          >
            Import
          </button>
        </form>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="text-left px-3 py-2">NIS</th>
              <th class="text-left px-3 py-2">Nama</th>
              <th class="text-left px-3 py-2">Gender</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr class="border-t border-slate-100">
                <td class="px-3 py-2">{s.nis ?? "-"}</td>
                <td class="px-3 py-2">{s.name}</td>
                <td class="px-3 py-2">{s.gender ?? "-"}</td>
                <td class="px-3 py-2 text-right">
                  <button
                    hx-delete={`/app/students/${klass.id}/${s.id}`}
                    hx-confirm={`Hapus siswa "${s.name}"?`}
                    hx-target="closest tr"
                    hx-swap="outerHTML"
                    class="text-red-600 text-xs font-medium"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colspan={4} class="px-3 py-6 text-center text-slate-400">
                  Belum ada siswa di kelas ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

studentsRoutes.get("/app/students/:classId", async (c) => {
  const user = c.get("user");
  const classId = Number(c.req.param("classId"));
  const klass = await getClassForUser(user.id, classId);

  if (!klass) {
    return c.redirect("/app/students");
  }

  const students = await listStudentsByClass(classId);
  return c.html(
    <ClassDetailPage user={user} klass={klass} students={students} />,
  );
});

studentsRoutes.post("/app/students/:classId", async (c) => {
  const user = c.get("user");
  const classId = Number(c.req.param("classId"));
  const klass = await getClassForUser(user.id, classId);
  if (!klass) return c.redirect("/app/students");

  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();
  const nis = String(body.nis ?? "").trim() || undefined;
  const genderRaw = String(body.gender ?? "").trim();
  const gender = genderRaw === "L" || genderRaw === "P" ? genderRaw : undefined;

  if (name) {
    await createStudent(classId, { nis, name, gender });
  }

  return c.redirect(`/app/students/${classId}`);
});

studentsRoutes.post("/app/students/:classId/import", async (c) => {
  const user = c.get("user");
  const classId = Number(c.req.param("classId"));
  const klass = await getClassForUser(user.id, classId);
  if (!klass) return c.redirect("/app/students");

  const body = await c.req.parseBody();
  const file = body.file;

  let importResult;
  if (file instanceof File) {
    const text = await file.text();
    importResult = await importStudentsFromCsv(classId, text);
  } else {
    importResult = { imported: 0, skipped: 0, errors: ["File tidak valid."] };
  }

  const students = await listStudentsByClass(classId);
  return c.html(
    <ClassDetailPage
      user={user}
      klass={klass}
      students={students}
      importResult={importResult}
    />,
  );
});

studentsRoutes.delete("/app/students/:classId/:studentId", async (c) => {
  const user = c.get("user");
  const classId = Number(c.req.param("classId"));
  const studentId = Number(c.req.param("studentId"));
  const klass = await getClassForUser(user.id, classId);

  if (klass) {
    await deleteStudent(classId, studentId);
  }

  return c.body(null);
});
