import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import {
  getJournalByScheduleAndDate,
  getJournalForUser,
  listJournalsByDate,
  createDraftJournal,
  updateJournal,
} from "../services/journal.service";
import { listSchedulesByUserAndDay } from "../services/schedule.service";
import { Layout } from "../components/Layout";
import { Alert } from "../components/Alert";
import {
  dayOfWeekFromIso,
  formatDateLabel,
  todayIso,
} from "../utils/dates";

type AppContext = {
  Variables: { user: SessionUser };
};

export const journalRoutes = new Hono<AppContext>();

journalRoutes.get("/app/journal", async (c) => {
  const user = c.get("user");
  const date = c.req.query("date") || todayIso();
  const dayOfWeek = dayOfWeekFromIso(date);

  const [schedulesToday, journalsToday] = await Promise.all([
    listSchedulesByUserAndDay(user.id, dayOfWeek),
    listJournalsByDate(user.id, date),
  ]);

  const journalByScheduleId = new Map(
    journalsToday.map((j) => [j.scheduleId, j]),
  );

  return c.html(
    <Layout title="Jurnal" user={user} activeNav="journal">
      <h1 class="text-xl font-semibold mb-1">Jurnal Mengajar</h1>
      <p class="text-sm text-slate-500 mb-4">{formatDateLabel(date)}</p>

      <form method="get" action="/app/journal" class="mb-4">
        <input
          type="date"
          name="date"
          value={date}
          onchange="this.form.submit()"
          class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </form>

      <div class="space-y-2">
        {schedulesToday.map((s) => {
          const journal = journalByScheduleId.get(s.id);
          const isComplete = journal?.status === "completed";

          return (
            <div class="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p class="font-medium">
                  {s.subject} · {s.class.name}
                </p>
                <p class="text-sm text-slate-500">
                  {s.startTime}–{s.endTime}
                </p>
              </div>
              {journal ? (
                <a
                  href={`/app/journal/${journal.id}`}
                  class={`text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 ml-2 ${
                    isComplete
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {isComplete ? "Selesai" : "Lengkapi"}
                </a>
              ) : (
                <form
                  method="post"
                  action="/app/journal"
                  class="shrink-0 ml-2"
                >
                  <input type="hidden" name="scheduleId" value={s.id} />
                  <input type="hidden" name="date" value={date} />
                  <button
                    type="submit"
                    class="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700"
                  >
                    Buat Jurnal
                  </button>
                </form>
              )}
            </div>
          );
        })}

        {schedulesToday.length === 0 && (
          <p class="text-sm text-slate-500 text-center py-8">
            Tidak ada jadwal mengajar pada tanggal ini.
          </p>
        )}
      </div>
    </Layout>,
  );
});

journalRoutes.post("/app/journal", async (c) => {
  const body = await c.req.parseBody();
  const scheduleId = Number(body.scheduleId);
  const date = String(body.date ?? todayIso());

  const existing = await getJournalByScheduleAndDate(scheduleId, date);
  const journal = existing ?? (await createDraftJournal(scheduleId, date));

  return c.redirect(`/app/journal/${journal!.id}`);
});

journalRoutes.get("/app/journal/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const journal = await getJournalForUser(user.id, id);

  if (!journal) return c.redirect("/app/journal");

  return c.html(
    <Layout title="Jurnal" user={user} activeNav="journal">
      <div class="flex items-center gap-2 mb-1">
        <a href="/app/journal" class="text-slate-400">
          ‹
        </a>
        <h1 class="text-xl font-semibold">
          {journal.schedule.subject} · {journal.schedule.class.name}
        </h1>
      </div>
      <p class="text-sm text-slate-500 mb-4">{formatDateLabel(journal.date)}</p>

      <form
        method="post"
        action={`/app/journal/${journal.id}`}
        class="bg-white rounded-2xl border border-slate-200 p-4 space-y-4"
      >
        <label class="block">
          <span class="block text-sm font-medium text-slate-700 mb-1">
            Materi / Topik Pembelajaran
          </span>
          <textarea
            name="topic"
            rows={2}
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {journal.topic ?? ""}
          </textarea>
        </label>

        <label class="block">
          <span class="block text-sm font-medium text-slate-700 mb-1">
            Capaian Pembelajaran
          </span>
          <textarea
            name="achievement"
            rows={2}
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {journal.achievement ?? ""}
          </textarea>
        </label>

        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="block text-sm font-medium text-slate-700 mb-1">
              Jumlah Hadir
            </span>
            <input
              type="number"
              name="presentCount"
              min="0"
              value={journal.presentCount ?? ""}
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-slate-700 mb-1">
              Jumlah Tidak Hadir
            </span>
            <input
              type="number"
              name="absentCount"
              min="0"
              value={journal.absentCount ?? ""}
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
        </div>

        <label class="block">
          <span class="block text-sm font-medium text-slate-700 mb-1">
            Refleksi (opsional)
          </span>
          <textarea
            name="reflection"
            rows={2}
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {journal.reflection ?? ""}
          </textarea>
        </label>

        <label class="block">
          <span class="block text-sm font-medium text-slate-700 mb-1">
            Kendala (opsional)
          </span>
          <textarea
            name="obstacle"
            rows={2}
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {journal.obstacle ?? ""}
          </textarea>
        </label>

        <div class="flex gap-2">
          <button
            type="submit"
            name="status"
            value="draft"
            class="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2.5 font-medium hover:bg-slate-200"
          >
            Simpan Draft
          </button>
          <button
            type="submit"
            name="status"
            value="completed"
            class="flex-1 bg-emerald-600 text-white rounded-lg py-2.5 font-medium hover:bg-emerald-700"
          >
            Selesai
          </button>
        </div>
      </form>
    </Layout>,
  );
});

journalRoutes.post("/app/journal/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const journal = await getJournalForUser(user.id, id);

  if (!journal) return c.redirect("/app/journal");

  const body = await c.req.parseBody();
  const status = body.status === "completed" ? "completed" : "draft";

  await updateJournal(id, {
    topic: String(body.topic ?? "").trim() || undefined,
    achievement: String(body.achievement ?? "").trim() || undefined,
    reflection: String(body.reflection ?? "").trim() || undefined,
    obstacle: String(body.obstacle ?? "").trim() || undefined,
    presentCount: body.presentCount ? Number(body.presentCount) : undefined,
    absentCount: body.absentCount ? Number(body.absentCount) : undefined,
    status,
  });

  return c.redirect(`/app/journal/${id}`);
});
