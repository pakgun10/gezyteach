import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import {
  createClass,
  deleteClass,
  getClassById,
  listClassesWithStudentCount,
} from "../services/class.service";
import {
  createStudent,
  deleteStudent,
  deleteStudents,
  importStudentsFromCsv,
  listStudentsByClass,
  updateStudent,
} from "../services/student.service";
import {
  activateOrResetLoginForStudents,
  activateOrResetStudentLogin,
  disableStudentLogin,
} from "../services/student-auth.service";
import {
  createActivationBatch,
  getActivationBatch,
} from "../services/activation-batch.store";
import { toCsv } from "../utils/csv";
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
                  {klass.createdBy && ` · dibuat oleh ${klass.createdBy.name}`}
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
  const classes = await listClassesWithStudentCount();
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
  const classId = Number(c.req.param("classId"));
  await deleteClass(classId);
  c.header("HX-Redirect", "/app/students");
  return c.body(null);
});

function ClassDetailPage({
  user,
  klass,
  students,
  importResult,
  activatedPin,
  activationError,
  activateAllResult,
  exportToken,
}: {
  user: SessionUser;
  klass: {
    id: number;
    name: string;
    createdBy?: { id: number; name: string } | null;
  };
  students: Awaited<ReturnType<typeof listStudentsByClass>>;
  importResult?: { imported: number; skipped: number; errors: string[] };
  activatedPin?: { studentName: string; loginId: string; pin: string };
  activationError?: string;
  activateAllResult?: {
    activatedCount: number;
    failed: { studentName: string; error: string }[];
  };
  exportToken?: string;
}) {
  return (
    <Layout title={klass.name} user={user} activeNav="students">
      <div class="mb-4">
        <div class="flex items-center gap-2">
          <a href="/app/students" class="text-slate-400">
            ‹
          </a>
          <h1 class="text-xl font-semibold">{klass.name}</h1>
        </div>
        {klass.createdBy && (
          <p class="text-xs text-slate-400 mt-0.5">
            Dibuat oleh {klass.createdBy.name}
          </p>
        )}
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

      {activatedPin && (
        <Alert variant="success">
          Akun login untuk <strong>{activatedPin.studentName}</strong> aktif.
          <br />
          NIS (username): <strong>{activatedPin.loginId}</strong>
          <br />
          PIN: <strong>{activatedPin.pin}</strong>
          <br />
          <span class="text-xs">
            Catat PIN ini sekarang, PIN tidak akan ditampilkan lagi.
          </span>
        </Alert>
      )}

      {activationError === "no_nis" && (
        <Alert variant="error">
          Siswa belum punya NIS. Isi NIS terlebih dahulu sebelum mengaktifkan
          login.
        </Alert>
      )}
      {activationError === "login_id_taken" && (
        <Alert variant="error">
          NIS lokal siswa ini sudah dipakai siswa lain sebagai username login.
          Periksa kembali data NIS.
        </Alert>
      )}

      {activateAllResult && (
        <Alert variant={activateAllResult.failed.length ? "error" : "success"}>
          {activateAllResult.activatedCount} akun berhasil diaktifkan/reset.{" "}
          Unduh daftar NIS &amp; PIN lewat tombol "Export CSV" di bawah.
          {activateAllResult.failed.length > 0 && (
            <>
              <br />
              {activateAllResult.failed.length} siswa gagal diaktifkan:
              <ul class="mt-1 list-disc list-inside">
                {activateAllResult.failed.map((f) => (
                  <li>
                    {f.studentName} —{" "}
                    {f.error === "no_nis"
                      ? "belum punya NIS"
                      : "NIS lokal bentrok dengan siswa lain"}
                  </li>
                ))}
              </ul>
            </>
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
          <a
            href="/templates/students-import.csv"
            class="text-emerald-700 underline"
          >
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

      <div class="flex flex-wrap items-center gap-2 mb-2">
        <form
          method="post"
          action={`/app/students/${klass.id}/activate-all`}
          onsubmit="return confirm('Aktifkan/reset login untuk SEMUA siswa di kelas ini? PIN lama (jika ada) akan diganti.')"
        >
          <button
            type="submit"
            class="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-700"
          >
            Aktifkan Semua Login
          </button>
        </form>
        {exportToken ? (
          <a
            href={`/app/students/${klass.id}/export-logins.csv?token=${exportToken}`}
            class="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-800"
          >
            Export NIS &amp; PIN (CSV)
          </a>
        ) : (
          <span class="bg-slate-200 text-slate-400 rounded-lg px-4 py-2 text-sm font-medium cursor-not-allowed">
            Export NIS &amp; PIN (CSV)
          </span>
        )}
      </div>
      <p class="text-xs text-slate-500 mb-4">
        Tombol export hanya aktif setelah Anda mengaktifkan/reset login siswa
        (satuan atau massal), karena PIN tidak disimpan dalam bentuk terbaca
        setelah dibuat. Unduh segera, tautan berlaku 30 menit.
      </p>

      <form
        id="bulk-delete-form"
        method="post"
        action={`/app/students/${klass.id}/bulk-delete`}
        onsubmit={`return confirm('Hapus siswa terpilih? Tindakan ini tidak bisa dibatalkan.')`}
      >
        <div class="flex items-center justify-between mb-2">
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              onclick="document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = this.checked)"
              class="rounded border-slate-300"
            />
            Pilih semua
          </label>
          <button
            type="submit"
            class="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none"
          >
            Hapus Terpilih
          </button>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-3 py-2 w-8"></th>
                <th class="text-left px-3 py-2">NIS</th>
                <th class="text-left px-3 py-2">Nama</th>
                <th class="text-left px-3 py-2">Gender</th>
                <th class="text-left px-3 py-2">Login</th>
                <th class="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr class="border-t border-slate-100">
                  <td class="px-3 py-2">
                    <input
                      type="checkbox"
                      name="studentId"
                      value={s.id}
                      class="student-checkbox rounded border-slate-300"
                    />
                  </td>
                  <td class="px-3 py-2">{s.nis ?? "-"}</td>
                  <td class="px-3 py-2">{s.name}</td>
                  <td class="px-3 py-2">{s.gender ?? "-"}</td>
                  <td class="px-3 py-2">
                    {s.pinHash ? (
                      <span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                        Aktif
                      </span>
                    ) : (
                      <span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td class="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="submit"
                      form={`activate-${s.id}`}
                      class="text-emerald-700 text-xs font-medium mr-3"
                    >
                      {s.pinHash ? "Reset PIN" : "Aktifkan"}
                    </button>
                    {s.pinHash && (
                      <button
                        type="submit"
                        form={`disable-${s.id}`}
                        class="text-slate-500 text-xs font-medium mr-3"
                      >
                        Nonaktifkan
                      </button>
                    )}
                    <button
                      type="button"
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
                  <td colspan={6} class="px-3 py-6 text-center text-slate-400">
                    Belum ada siswa di kelas ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>

      {students.map((s) => (
        <form
          id={`activate-${s.id}`}
          method="post"
          action={`/app/students/${klass.id}/${s.id}/activate-login`}
          class="hidden"
        />
      ))}
      {students.map((s) => (
        <form
          id={`disable-${s.id}`}
          method="post"
          action={`/app/students/${klass.id}/${s.id}/disable-login`}
          class="hidden"
        />
      ))}
    </Layout>
  );
}

studentsRoutes.get("/app/students/:classId", async (c) => {
  const user = c.get("user");
  const classId = Number(c.req.param("classId"));
  const klass = await getClassById(classId);

  if (!klass) {
    return c.redirect("/app/students");
  }

  const students = await listStudentsByClass(classId);
  return c.html(
    <ClassDetailPage user={user} klass={klass} students={students} />,
  );
});

studentsRoutes.post(
  "/app/students/:classId/:studentId/activate-login",
  async (c) => {
    const user = c.get("user");
    const classId = Number(c.req.param("classId"));
    const studentId = Number(c.req.param("studentId"));
    const klass = await getClassById(classId);
    if (!klass) return c.redirect("/app/students");

    const students = await listStudentsByClass(classId);
    const target = students.find((s) => s.id === studentId);
    if (!target) return c.redirect(`/app/students/${classId}`);

    const result = await activateOrResetStudentLogin(studentId);

    if (!result.ok) {
      return c.html(
        <ClassDetailPage
          user={user}
          klass={klass}
          students={await listStudentsByClass(classId)}
          activationError={result.error}
        />,
        400,
      );
    }

    const exportToken = createActivationBatch(classId, [
      { name: target.name, loginId: result.loginId, pin: result.pin },
    ]);

    return c.html(
      <ClassDetailPage
        user={user}
        klass={klass}
        students={await listStudentsByClass(classId)}
        activatedPin={{
          studentName: target.name,
          loginId: result.loginId,
          pin: result.pin,
        }}
        exportToken={exportToken}
      />,
    );
  },
);

studentsRoutes.post(
  "/app/students/:classId/:studentId/disable-login",
  async (c) => {
    const user = c.get("user");
    const classId = Number(c.req.param("classId"));
    const studentId = Number(c.req.param("studentId"));
    const klass = await getClassById(classId);
    if (!klass) return c.redirect("/app/students");

    await disableStudentLogin(studentId);

    return c.redirect(`/app/students/${classId}`);
  },
);

studentsRoutes.post("/app/students/:classId/activate-all", async (c) => {
  const user = c.get("user");
  const classId = Number(c.req.param("classId"));
  const klass = await getClassById(classId);
  if (!klass) return c.redirect("/app/students");

  const students = await listStudentsByClass(classId);
  const result = await activateOrResetLoginForStudents(
    students.map((s) => ({ id: s.id, name: s.name })),
  );

  const exportToken =
    result.activated.length > 0
      ? createActivationBatch(
          classId,
          result.activated.map((a) => ({
            name: a.studentName,
            loginId: a.loginId,
            pin: a.pin,
          })),
        )
      : undefined;

  return c.html(
    <ClassDetailPage
      user={user}
      klass={klass}
      students={await listStudentsByClass(classId)}
      activateAllResult={{
        activatedCount: result.activated.length,
        failed: result.failed.map((f) => ({
          studentName: f.studentName,
          error: f.error,
        })),
      }}
      exportToken={exportToken}
    />,
  );
});

studentsRoutes.get("/app/students/:classId/export-logins.csv", async (c) => {
  const user = c.get("user");
  const classId = Number(c.req.param("classId"));
  const klass = await getClassById(classId);
  if (!klass) return c.redirect("/app/students");

  const token = c.req.query("token") ?? "";
  const rows = getActivationBatch(token, classId);

  if (!rows) {
    return c.text(
      "Tautan export sudah tidak berlaku (kedaluwarsa atau sudah dipakai). Aktifkan/reset login lagi untuk membuat tautan baru.",
      404,
    );
  }

  const csv = toCsv(
    ["nama", "nis", "pin"],
    rows.map((r) => [r.name, r.loginId, r.pin]),
  );

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header(
    "Content-Disposition",
    `attachment; filename="login-siswa-${klass.name.replace(/[^a-zA-Z0-9]+/g, "-")}.csv"`,
  );
  return c.body(csv);
});

studentsRoutes.post("/app/students/:classId", async (c) => {
  const user = c.get("user");
  const classId = Number(c.req.param("classId"));
  const klass = await getClassById(classId);
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
  const klass = await getClassById(classId);
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
  const klass = await getClassById(classId);

  if (klass) {
    await deleteStudent(classId, studentId);
  }

  return c.body(null);
});

studentsRoutes.post("/app/students/:classId/bulk-delete", async (c) => {
  const user = c.get("user");
  const classId = Number(c.req.param("classId"));
  const klass = await getClassById(classId);
  if (!klass) return c.redirect("/app/students");

  const body = await c.req.parseBody({ all: true });
  const raw = body.studentId;
  const ids = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length > 0) {
    await deleteStudents(classId, ids);
  }

  return c.redirect(`/app/students/${classId}`);
});
