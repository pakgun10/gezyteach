import { Hono } from "hono";
import { JournalTabs } from "../components/JournalTabs";
import { Layout } from "../components/Layout";
import type { SessionUser } from "../services/auth.service";
import {
  listJournalClasses,
  listJournalSubjects,
  listJournalsForReport,
  normalizeJournalSubject,
} from "../services/journal.service";
import { getSchoolProfile } from "../services/school.service";
import { formatDateLabel, todayIso } from "../utils/dates";

type AppContext = {
  Variables: { user: SessionUser };
};

export const journalReportRoutes = new Hono<AppContext>();

type ReportEntry = Awaited<ReturnType<typeof listJournalsForReport>>[number];

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function defaultAcademicYear() {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

function reportValue(value: string | null) {
  return value?.trim() || "—";
}

function JournalReportPage({
  user,
  profile,
  classes,
  subjects,
  selectedClassId,
  selectedSubject,
  dateFrom,
  dateTo,
  academicYear,
  semester,
  entries,
}: {
  user: SessionUser;
  profile: Awaited<ReturnType<typeof getSchoolProfile>>;
  classes: Awaited<ReturnType<typeof listJournalClasses>>;
  subjects: string[];
  selectedClassId?: number;
  selectedSubject: string;
  dateFrom: string;
  dateTo: string;
  academicYear: string;
  semester: "1" | "2";
  entries: ReportEntry[];
}) {
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const hasInvalidRange = dateFrom > dateTo;
  const canPrint = entries.length > 0 && !hasInvalidRange;

  return (
    <Layout title="Print Laporan Jurnal" user={user} activeNav="journal" printMode>
      <div class="journal-report-page">
        <div class="journal-report-controls">
          <JournalTabs active="report" />
          <div class="flex items-center justify-between gap-3 mb-4">
            <div>
              <h1 class="text-xl font-semibold">Print Laporan Jurnal</h1>
              <p class="gt-muted text-sm mt-1">
                Pilih kelas dan rentang tanggal, lalu simpan hasilnya sebagai PDF.
              </p>
            </div>
            <button
              type="button"
              onclick="window.print()"
              disabled={!canPrint}
              class="gt-btn-primary px-3 py-2 text-sm whitespace-nowrap"
            >
              🖨️ Cetak / Simpan PDF
            </button>
          </div>

          <form method="get" action="/app/journal/report" class="gt-card p-4 mb-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="block">
                <span class="gt-label">Kelas</span>
                <select name="classId" required class="gt-input">
                  <option value="">Pilih kelas</option>
                  {classes.map((item) => (
                    <option value={item.id} selected={item.id === selectedClassId}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label class="block">
                <span class="gt-label">Mata pelajaran</span>
                <select name="subject" required class="gt-input">
                  <option value="">Pilih mata pelajaran</option>
                  {subjects.map((subject) => (
                    <option
                      value={subject}
                      selected={normalizeJournalSubject(subject) === normalizeJournalSubject(selectedSubject)}
                    >
                      {subject}
                    </option>
                  ))}
                </select>
              </label>
              <label class="block">
                <span class="gt-label">Tanggal mulai</span>
                <input type="date" name="dateFrom" value={dateFrom} required class="gt-input" />
              </label>
              <label class="block">
                <span class="gt-label">Tanggal akhir</span>
                <input type="date" name="dateTo" value={dateTo} required class="gt-input" />
              </label>
              <label class="block">
                <span class="gt-label">Tahun pelajaran</span>
                <input
                  name="academicYear"
                  value={academicYear}
                  placeholder="Contoh: 2026/2027"
                  class="gt-input"
                />
              </label>
              <label class="block">
                <span class="gt-label">Semester</span>
                <select name="semester" class="gt-input">
                  <option value="1" selected={semester === "1"}>Semester 1</option>
                  <option value="2" selected={semester === "2"}>Semester 2</option>
                </select>
              </label>
            </div>
            <div class="flex gap-2 mt-4">
              <button type="submit" class="gt-btn-primary flex-1 py-2.5">
                Tampilkan Laporan
              </button>
              <a href="/app/journal/report" class="gt-btn-secondary px-4 py-2.5">
                Reset
              </a>
            </div>
          </form>

          {hasInvalidRange && (
            <div class="gt-badge-red rounded-lg px-3 py-2 text-sm mb-4">
              Tanggal mulai tidak boleh lebih besar dari tanggal akhir.
            </div>
          )}
          {!profile.schoolName && (
            <div class="gt-badge-amber rounded-lg px-3 py-2 text-sm mb-4">
              Nama sekolah belum diatur. Admin dapat melengkapinya di menu Data Sekolah.
            </div>
          )}
          {classes.length === 0 && (
            <div class="gt-badge-amber rounded-lg px-3 py-2 text-sm mb-4">
              Belum ada jadwal mengajar yang dapat dibuatkan laporan.
            </div>
          )}
          {selectedClass && subjects.length === 0 && (
            <div class="gt-badge-amber rounded-lg px-3 py-2 text-sm mb-4">
              Belum ada mata pelajaran pada kelas ini.
            </div>
          )}
        </div>

        <article class="journal-report-paper">
          <header class="journal-report-header">
            <p class="journal-report-title">LAPORAN JURNAL MENGAJAR</p>
            <h2>{profile.schoolName || "Nama Sekolah"}</h2>
            {profile.address && <p>{profile.address}</p>}
          </header>

          <div class="journal-report-meta">
            <div><span>Kelas</span><strong>{selectedClass?.name || "—"}</strong></div>
            <div><span>Mata Pelajaran</span><strong>{selectedSubject || "—"}</strong></div>
            <div><span>Tahun Pelajaran</span><strong>{academicYear || "—"}</strong></div>
            <div><span>Semester</span><strong>{semester}</strong></div>
            <div class="journal-report-meta-wide">
              <span>Periode</span>
              <strong>{formatDateLabel(dateFrom)} s.d. {formatDateLabel(dateTo)}</strong>
            </div>
          </div>

          <div class="journal-report-table-wrap">
            <table class="journal-report-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Tanggal</th>
                  <th>Materi / Topik</th>
                  <th>Capaian Pembelajaran</th>
                  <th>Hadir</th>
                  <th>Tidak Hadir</th>
                  <th>Refleksi</th>
                  <th>Kendala</th>
                  <th>Rencana Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr>
                    <td>{index + 1}</td>
                    <td>{formatDateLabel(entry.date)}</td>
                    <td class="journal-report-text">{reportValue(entry.topic)}</td>
                    <td class="journal-report-text">{reportValue(entry.achievement)}</td>
                    <td>{entry.presentCount ?? "—"}</td>
                    <td>{entry.absentCount ?? "—"}</td>
                    <td class="journal-report-text">{reportValue(entry.reflection)}</td>
                    <td class="journal-report-text">{reportValue(entry.obstacle)}</td>
                    <td class="journal-report-text">{reportValue(entry.followUpPlan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {entries.length === 0 && (
            <p class="journal-report-empty">
              Tidak ada jurnal pada filter yang dipilih.
            </p>
          )}

          <div class="journal-report-signatures">
            <div class="journal-report-signature">
              <p>Mengetahui,<br />Kepala Sekolah</p>
              <div class="journal-report-signature-space" />
              <strong>{profile.principalName || "................................................"}</strong>
              <p>NIP. {profile.principalNip || "................................"}</p>
            </div>
            <div class="journal-report-signature">
              <p>{profile.city || "................"}, {formatDateLabel(todayIso())}<br />Guru Mata Pelajaran</p>
              <div class="journal-report-signature-space" />
              <strong>{user.name}</strong>
              <p>NIP. {user.nip || "................................"}</p>
            </div>
          </div>
        </article>

        <footer class="journal-report-footer" aria-hidden="true">
          <span>Jurnal Mengajar</span>
          <span class="journal-report-page-number" />
        </footer>
      </div>
    </Layout>
  );
}

journalReportRoutes.get("/app/journal/report", async (c) => {
  const user = c.get("user");
  const [profile, classes] = await Promise.all([
    getSchoolProfile(),
    listJournalClasses(user.id),
  ]);

  const requestedClassId = Number(c.req.query("classId"));
  const selectedClassId = classes.some((item) => item.id === requestedClassId)
    ? requestedClassId
    : classes[0]?.id;
  const subjects = selectedClassId
    ? await listJournalSubjects(user.id, selectedClassId)
    : [];
  const requestedSubject = c.req.query("subject")?.trim();
  const selectedSubject = subjects.find(
    (subject) => normalizeJournalSubject(subject) === normalizeJournalSubject(requestedSubject ?? ""),
  ) ?? subjects[0] ?? "";

  const today = todayIso();
  const requestedDateFrom = c.req.query("dateFrom") ?? "";
  const requestedDateTo = c.req.query("dateTo") ?? "";
  const dateFrom = isIsoDate(requestedDateFrom) ? requestedDateFrom : `${today.slice(0, 7)}-01`;
  const dateTo = isIsoDate(requestedDateTo) ? requestedDateTo : today;
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const academicYear = c.req.query("academicYear")?.trim()
    || selectedClass?.academicYear
    || profile.defaultAcademicYear
    || defaultAcademicYear();
  const requestedSemester = c.req.query("semester");
  const semester: "1" | "2" = requestedSemester === "1" || requestedSemester === "2"
    ? requestedSemester
    : profile.defaultSemester;
  const entries = selectedClassId && selectedSubject && dateFrom <= dateTo
    ? await listJournalsForReport(user.id, selectedClassId, selectedSubject, dateFrom, dateTo)
    : [];

  return c.html(
    <JournalReportPage
      user={user}
      profile={profile}
      classes={classes}
      subjects={subjects}
      selectedClassId={selectedClassId}
      selectedSubject={selectedSubject}
      dateFrom={dateFrom}
      dateTo={dateTo}
      academicYear={academicYear}
      semester={semester}
      entries={entries}
    />,
  );
});
