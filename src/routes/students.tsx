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

      <div class="gt-card p-4 mb-4">
        <h2 class="font-medium mb-3">Tambah Kelas</h2>
        <form method="post" action="/app/students" class="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="Nama kelas, contoh: VIII-1"
            required
            class="gt-input flex-1"
          />
          <button type="submit" class="gt-btn-primary px-4 py-2">
            Tambah
          </button>
        </form>
      </div>

      <div class="space-y-2">
        {classes.length === 0 && (
          <p class="gt-muted text-sm text-center py-8">
            Belum ada kelas. Tambahkan kelas pertama Anda di atas.
          </p>
        )}
        {classes.map((klass) => (
          <a
            href={`/app/students/${klass.id}`}
            class="gt-card gt-card-hover block p-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{klass.name}</p>
                <p class="gt-muted text-sm">
                  {klass.studentCount} siswa
                  {klass.createdBy && ` · dibuat oleh ${klass.createdBy.name}`}
                </p>
              </div>
              <span class="gt-subtle">›</span>
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
          <a href="/app/students" class="gt-subtle">
            ‹
          </a>
          <h1 class="text-xl font-semibold">{klass.name}</h1>
        </div>
        {klass.createdBy && (
          <p class="gt-subtle text-xs mt-0.5">
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

      <div class="gt-card p-4 mb-4">
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
            class="gt-input"
          />
          <input
            type="text"
            name="name"
            placeholder="Nama siswa"
            required
            class="gt-input sm:col-span-2"
          />
          <select name="gender" class="gt-input">
            <option value="">Gender</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
          <button type="submit" class="gt-btn-primary sm:col-span-4 py-2">
            Tambah Siswa
          </button>
        </form>
      </div>

      <div class="gt-card p-4 mb-4">
        <h2 class="font-medium mb-1">Import CSV</h2>
        <p class="gt-muted text-xs mb-3">
          Kolom: <code>nis,name,gender</code>. Unduh{" "}
          <a
            href="/templates/students-import.csv"
            class="gt-link-emerald underline"
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
          <button type="submit" class="gt-btn-secondary px-4 py-2">
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
          <button type="submit" class="gt-btn-primary px-4 py-2 text-sm">
            Aktifkan Semua Login
          </button>
        </form>
        {exportToken ? (
          <a
            href={`/app/students/${klass.id}/export-logins.csv?token=${exportToken}`}
            class="gt-btn-secondary px-4 py-2 text-sm"
          >
            Export NIS &amp; PIN (CSV)
          </a>
        ) : (
          <span class="gt-badge-slate rounded-lg px-4 py-2 text-sm font-medium cursor-not-allowed">
            Export NIS &amp; PIN (CSV)
          </span>
        )}
      </div>
      <p class="gt-muted text-xs mb-4">
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
          <label class="gt-muted flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              onclick="document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = this.checked)"
              class="gt-checkbox rounded"
            />
            Pilih semua
          </label>
          <button
            type="submit"
            class="gt-btn-danger px-4 py-2 text-sm disabled:opacity-40 disabled:pointer-events-none"
          >
            Hapus Terpilih
          </button>
        </div>

        <div class="gt-card overflow-hidden">
          <table class="w-full text-sm">
            <thead class="gt-table-head">
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
                <tr class="gt-table-row-border">
                  <td class="px-3 py-2">
                    <input
                      type="checkbox"
                      name="studentId"
                      value={s.id}
                      class="student-checkbox gt-checkbox rounded"
                    />
                  </td>
                  <td class="px-3 py-2">{s.nis ?? "-"}</td>
                  <td class="px-3 py-2">{s.name}</td>
                  <td class="px-3 py-2">{s.gender ?? "-"}</td>
                  <td class="px-3 py-2">
                    {s.pinHash ? (
                      <span class="gt-badge-emerald inline-block rounded-full px-2 py-0.5 text-xs font-medium">
                        Aktif
                      </span>
                    ) : (
                      <span class="gt-badge-slate inline-block rounded-full px-2 py-0.5 text-xs font-medium">
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td class="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="submit"
                      form={`activate-${s.id}`}
                      class="gt-link-emerald text-xs font-medium mr-3"
                    >
                      {s.pinHash ? "Reset PIN" : "Aktifkan"}
                    </button>
                    {s.pinHash && (
                      <button
                        type="submit"
                        form={`disable-${s.id}`}
                        class="gt-link-muted text-xs font-medium mr-3"
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
                      class="gt-link-red text-xs font-medium"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colspan={6} class="px-3 py-6 text-center gt-subtle">
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
