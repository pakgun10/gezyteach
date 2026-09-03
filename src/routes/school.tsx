import { Hono } from "hono";
import { Alert } from "../components/Alert";
import { Layout } from "../components/Layout";
import type { SessionUser } from "../services/auth.service";
import {
  getSchoolProfile,
  updateSchoolProfile,
} from "../services/school.service";

type AppContext = {
  Variables: { user: SessionUser };
};

export const schoolRoutes = new Hono<AppContext>();

type SchoolPageProps = {
  user: SessionUser;
  profile: Awaited<ReturnType<typeof getSchoolProfile>>;
  error?: string;
  success?: boolean;
};

function SchoolPage({ user, profile, error, success }: SchoolPageProps) {
  return (
    <Layout title="Data Sekolah" user={user}>
      <div class="flex items-center gap-2 mb-4">
        <a href="/app/profile" class="gt-subtle">
          ‹
        </a>
        <h1 class="text-xl font-semibold">Data Sekolah</h1>
      </div>

      <p class="gt-muted text-sm mb-4">
        Data ini dipakai otomatis pada header dan bagian tanda tangan laporan.
      </p>

      {success && <Alert variant="success">Data sekolah berhasil disimpan.</Alert>}
      {error === "school_name_required" && (
        <Alert variant="error">Nama sekolah wajib diisi.</Alert>
      )}

      <form method="post" action="/app/admin/school" class="gt-card p-4 space-y-4">
        <div>
          <h2 class="font-medium mb-3">Identitas Sekolah</h2>
          <label class="block mb-3">
            <span class="gt-label">Nama sekolah</span>
            <input
              name="schoolName"
              value={profile.schoolName ?? ""}
              required
              class="gt-input"
            />
          </label>
          <label class="block mb-3">
            <span class="gt-label">Alamat sekolah (opsional)</span>
            <textarea name="address" rows={2} class="gt-input journal-textarea">
              {profile.address ?? ""}
            </textarea>
          </label>
          <label class="block">
            <span class="gt-label">Kota/Kabupaten (opsional)</span>
            <input
              name="city"
              value={profile.city ?? ""}
              placeholder="Contoh: Kabupaten Bandung"
              class="gt-input"
            />
          </label>
        </div>

        <div>
          <h2 class="font-medium mb-3">Kepala Sekolah</h2>
          <label class="block mb-3">
            <span class="gt-label">Nama kepala sekolah (opsional)</span>
            <input
              name="principalName"
              value={profile.principalName ?? ""}
              class="gt-input"
            />
          </label>
          <label class="block">
            <span class="gt-label">NIP kepala sekolah (opsional)</span>
            <input
              name="principalNip"
              value={profile.principalNip ?? ""}
              class="gt-input"
            />
          </label>
        </div>

        <div>
          <h2 class="font-medium mb-3">Default Laporan</h2>
          <label class="block mb-3">
            <span class="gt-label">Tahun pelajaran default</span>
            <input
              name="defaultAcademicYear"
              value={profile.defaultAcademicYear ?? ""}
              placeholder="Contoh: 2026/2027"
              class="gt-input"
            />
          </label>
          <label class="block">
            <span class="gt-label">Semester default</span>
            <select name="defaultSemester" class="gt-input">
              <option value="1" selected={profile.defaultSemester === "1"}>
                Semester 1
              </option>
              <option value="2" selected={profile.defaultSemester === "2"}>
                Semester 2
              </option>
            </select>
          </label>
        </div>

        <button type="submit" class="gt-btn-primary w-full py-2.5">
          Simpan Data Sekolah
        </button>
      </form>
    </Layout>
  );
}

schoolRoutes.get("/app/admin/school", async (c) => {
  const profile = await getSchoolProfile();
  return c.html(
    <SchoolPage
      user={c.get("user")}
      profile={profile}
      success={c.req.query("success") === "1"}
    />,
  );
});

schoolRoutes.post("/app/admin/school", async (c) => {
  const body = await c.req.parseBody();
  const schoolName = String(body.schoolName ?? "").trim();
  if (!schoolName) {
    return c.html(
      <SchoolPage
        user={c.get("user")}
        profile={await getSchoolProfile()}
        error="school_name_required"
      />,
      400,
    );
  }

  await updateSchoolProfile({
    schoolName,
    address: String(body.address ?? ""),
    city: String(body.city ?? ""),
    principalName: String(body.principalName ?? ""),
    principalNip: String(body.principalNip ?? ""),
    defaultAcademicYear: String(body.defaultAcademicYear ?? ""),
    defaultSemester: body.defaultSemester === "2" ? "2" : "1",
  });

  return c.redirect("/app/admin/school?success=1");
});

