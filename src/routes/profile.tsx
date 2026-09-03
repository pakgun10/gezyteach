import { Hono } from "hono";
import { Alert } from "../components/Alert";
import { FormInput } from "../components/FormInput";
import { Layout } from "../components/Layout";
import type { SessionUser } from "../services/auth.service";
import { changePassword } from "../services/auth.service";

type AppContext = {
  Variables: { user: SessionUser };
};

export const profileRoutes = new Hono<AppContext>();

function ProfilePage({
  user,
  error,
  success,
}: {
  user: SessionUser;
  error?: string;
  success?: boolean;
}) {
  return (
    <Layout title="Profil" user={user}>
      <div class="flex items-center gap-2 mb-4">
        <a href="/app" class="gt-subtle">
          ‹
        </a>
        <h1 class="text-xl font-semibold">Profil & Ganti Password</h1>
      </div>

      <div class="gt-card p-4 mb-4">
        <p class="gt-muted text-sm">Nama</p>
        <p class="font-medium mb-2">{user.name}</p>
        <p class="gt-muted text-sm">Email</p>
        <p class="font-medium mb-2">{user.email}</p>
        <p class="gt-muted text-sm">NIP</p>
        <p class="font-medium mb-2">{user.nip || "Belum diatur"}</p>
        <p class="gt-muted text-sm">Role</p>
        <p class="font-medium capitalize">{user.role}</p>
      </div>

      {user.role === "admin" && (
        <>
          <a href="/app/admin/school" class="gt-card gt-card-hover block p-4 mb-3">
            <p class="font-medium">🏫 Data Sekolah</p>
            <p class="gt-muted text-sm">
              Atur identitas sekolah, kepala sekolah, dan default laporan
            </p>
          </a>
          <a href="/app/admin/users" class="gt-card gt-card-hover block p-4 mb-4">
            <p class="font-medium">⚙️ Kelola User</p>
            <p class="gt-muted text-sm">
              Tambah, edit, atau hapus akun guru lain
            </p>
          </a>
        </>
      )}

      <div class="gt-card p-4">
        <h2 class="font-medium mb-3">Ganti Password</h2>

        {success && <Alert variant="success">Password berhasil diubah.</Alert>}
        {error === "invalid_current" && (
          <Alert variant="error">Password saat ini salah.</Alert>
        )}
        {error === "too_short" && (
          <Alert variant="error">Password baru minimal 8 karakter.</Alert>
        )}
        {error === "mismatch" && (
          <Alert variant="error">Konfirmasi password baru tidak sama.</Alert>
        )}

        <form method="post" action="/app/profile/password">
          <FormInput
            label="Password Saat Ini"
            name="currentPassword"
            type="password"
            required
            autofocus
          />
          <FormInput
            label="Password Baru"
            name="newPassword"
            type="password"
            required
          />
          <FormInput
            label="Konfirmasi Password Baru"
            name="confirmPassword"
            type="password"
            required
          />
          <button type="submit" class="gt-btn-primary w-full py-2.5 transition">
            Simpan Password Baru
          </button>
        </form>
      </div>

      <form method="post" action="/logout">
        <button
          type="submit"
          class="gt-btn-secondary w-full mt-4 py-2.5 transition"
        >
          Keluar
        </button>
      </form>
    </Layout>
  );
}

profileRoutes.get("/app/profile", (c) => {
  const user = c.get("user");
  return c.html(<ProfilePage user={user} />);
});

profileRoutes.post("/app/profile/password", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (newPassword !== confirmPassword) {
    return c.html(<ProfilePage user={user} error="mismatch" />, 400);
  }

  const result = await changePassword(user.id, currentPassword, newPassword);

  if (!result.ok) {
    return c.html(<ProfilePage user={user} error={result.error} />, 400);
  }

  return c.html(<ProfilePage user={user} success />);
});
