import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import { listClassesWithStudentCount } from "../services/class.service";
import {
  createAssessmentPlan,
  deleteAssessmentPlan,
  getScoreMatrix,
  listSubjectsByClass,
  upsertScore,
} from "../services/score.service";
import { Layout } from "../components/Layout";

type AppContext = {
  Variables: { user: SessionUser };
};

export const scoresRoutes = new Hono<AppContext>();

scoresRoutes.get("/app/scores", async (c) => {
  const user = c.get("user");
  const classes = await listClassesWithStudentCount();
  const classId = c.req.query("classId")
    ? Number(c.req.query("classId"))
    : classes[0]?.id;
  const selectedClass = classes.find((k) => k.id === classId);

  const subjects = selectedClass
    ? await listSubjectsByClass(selectedClass.id)
    : [];
  const subject = c.req.query("subject") || subjects[0];

  const { plans, rows } =
    selectedClass && subject
      ? await getScoreMatrix(selectedClass.id, subject)
      : { plans: [], rows: [] };

  return c.html(
    <Layout title="Nilai" user={user} activeNav="scores">
      <h1 class="text-xl font-semibold mb-4">Nilai</h1>

      <form
        method="get"
        action="/app/scores"
        class="bg-white rounded-2xl border border-slate-200 p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        <select
          name="classId"
          onchange="this.form.submit()"
          class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {classes.map((k) => (
            <option value={k.id} selected={k.id === classId}>
              {k.name}
            </option>
          ))}
        </select>
        <select
          name="subject"
          onchange="this.form.submit()"
          class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {subjects.length === 0 && <option value="">Belum ada mapel</option>}
          {subjects.map((s) => (
            <option value={s} selected={s === subject}>
              {s}
            </option>
          ))}
        </select>
      </form>

      {classes.length === 0 && (
        <p class="text-sm text-slate-500 text-center py-8">
          Tambahkan kelas dan siswa terlebih dahulu.
        </p>
      )}

      {selectedClass && subjects.length === 0 && (
        <p class="text-sm text-slate-500 text-center py-8">
          Belum ada mata pelajaran. Tambahkan jadwal terlebih dahulu di menu
          Jadwal agar mapel tersedia di sini.
        </p>
      )}

      {selectedClass && subject && (
        <>
          <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
            <h2 class="font-medium mb-3">Rencana Komponen Nilai</h2>
            <form
              method="post"
              action={`/app/scores/plans?classId=${selectedClass.id}&subject=${encodeURIComponent(
                subject,
              )}`}
              class="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3"
            >
              <input
                type="text"
                name="name"
                placeholder="Nama komponen (UH, Tugas, dst)"
                required
                class="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="number"
                name="weight"
                placeholder="Bobot"
                min="0"
                step="0.1"
                required
                value="1"
                class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                class="bg-emerald-600 text-white rounded-lg py-2 font-medium hover:bg-emerald-700"
              >
                Tambah
              </button>
            </form>

            <div class="flex flex-wrap gap-2">
              {plans.map((plan) => (
                <span class="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-sm rounded-full px-3 py-1">
                  {plan.name} (bobot {plan.weight})
                  <button
                    hx-delete={`/app/scores/plans/${plan.id}?classId=${selectedClass.id}&subject=${encodeURIComponent(
                      subject,
                    )}`}
                    hx-confirm={`Hapus komponen "${plan.name}"? Semua nilai pada komponen ini akan ikut terhapus.`}
                    hx-target="body"
                    class="text-slate-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              {plans.length === 0 && (
                <p class="text-sm text-slate-400">
                  Belum ada komponen nilai untuk mapel ini.
                </p>
              )}
            </div>
          </div>

          {plans.length > 0 && (
            <div class="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
              <form
                method="post"
                action={`/app/scores/entry?classId=${selectedClass.id}&subject=${encodeURIComponent(
                  subject,
                )}`}
              >
                <table class="w-full text-sm">
                  <thead class="bg-slate-50 text-slate-500">
                    <tr>
                      <th class="text-left px-3 py-2 sticky left-0 bg-slate-50">
                        Nama
                      </th>
                      {plans.map((plan) => (
                        <th class="text-center px-2 py-2 whitespace-nowrap">
                          {plan.name}
                        </th>
                      ))}
                      <th class="text-center px-3 py-2">Akhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr class="border-t border-slate-100">
                        <td class="px-3 py-2 sticky left-0 bg-white whitespace-nowrap">
                          {row.student.name}
                        </td>
                        {plans.map((plan) => (
                          <td class="px-2 py-2">
                            <input
                              type="number"
                              name={`score_${row.student.id}_${plan.id}`}
                              min="0"
                              max="100"
                              step="0.1"
                              value={row.values[plan.id] ?? ""}
                              class="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </td>
                        ))}
                        <td class="px-3 py-2 text-center font-medium">
                          {row.finalScore !== null
                            ? row.finalScore.toFixed(1)
                            : "-"}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colspan={plans.length + 2}
                          class="px-3 py-6 text-center text-slate-400"
                        >
                          Belum ada siswa di kelas ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {rows.length > 0 && (
                  <div class="p-3">
                    <button
                      type="submit"
                      class="w-full bg-emerald-600 text-white rounded-lg py-2.5 font-medium hover:bg-emerald-700"
                    >
                      Simpan Nilai
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </>
      )}
    </Layout>,
  );
});

scoresRoutes.post("/app/scores/plans", async (c) => {
  const classId = Number(c.req.query("classId"));
  const subject = String(c.req.query("subject") ?? "");
  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();
  const weight = Number(body.weight);

  if (classId && subject && name && !Number.isNaN(weight)) {
    await createAssessmentPlan({ classId, subject, name, weight });
  }

  return c.redirect(
    `/app/scores?classId=${classId}&subject=${encodeURIComponent(subject)}`,
  );
});

scoresRoutes.delete("/app/scores/plans/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const classId = c.req.query("classId");
  const subject = c.req.query("subject");
  await deleteAssessmentPlan(id);
  c.header(
    "HX-Redirect",
    `/app/scores?classId=${classId}&subject=${encodeURIComponent(subject ?? "")}`,
  );
  return c.body(null);
});

scoresRoutes.post("/app/scores/entry", async (c) => {
  const classId = Number(c.req.query("classId"));
  const subject = String(c.req.query("subject") ?? "");
  const body = await c.req.parseBody();

  for (const [key, value] of Object.entries(body)) {
    if (!key.startsWith("score_")) continue;
    const [, studentIdStr, planIdStr] = key.split("_");
    const studentId = Number(studentIdStr);
    const assessmentPlanId = Number(planIdStr);
    const raw = String(value).trim();
    const numericValue = raw === "" ? null : Number(raw);

    if (
      !Number.isNaN(studentId) &&
      !Number.isNaN(assessmentPlanId) &&
      (numericValue === null || !Number.isNaN(numericValue))
    ) {
      await upsertScore(studentId, assessmentPlanId, numericValue);
    }
  }

  return c.redirect(
    `/app/scores?classId=${classId}&subject=${encodeURIComponent(subject)}`,
  );
});
