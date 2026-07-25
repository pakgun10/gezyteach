import { Hono } from "hono";
import { Alert } from "../components/Alert";
import { Layout } from "../components/Layout";
import type { SessionUser, UserRole } from "../services/auth.service";
import {
  createUser,
  deleteUser,
  listUsers,
  resetPassword,
  updateUser,
} from "../services/user.service";

type AppContext = {
  Variables: { user: SessionUser };
};

export const adminRoutes = new Hono<AppContext>();

const ERROR_MESSAGES: Record<string, string> = {
  email_taken: "Email sudah dipakai oleh user lain.",
  too_short: "Password minimal 8 karakter.",
  invalid: "Nama dan email wajib diisi.",
  last_admin: "Tidak bisa mengubah/menghapus admin terakhir.",
  not_found: "User tidak ditemukan.",
};

function AdminUsersPage({
  currentUser,
  users,
  error,
  success,
}: {
  currentUser: SessionUser;
  users: Awaited<ReturnType<typeof listUsers>>;
  error?: string;
  success?: string;
}) {
  return (
    <Layout title="Kelola User" user={currentUser}>
      <div class="flex items-center gap-2 mb-4">
        <a href="/app" class="text-slate-400">
          ‹
        </a>
        <h1 class="text-xl font-semibold">Kelola User</h1>
      </div>

      {success && <Alert variant="success">{success}</Alert>}
      {error && (
        <Alert variant="error">
          {ERROR_MESSAGES[error] ?? "Terjadi kesalahan."}
        </Alert>
      )}

      <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <h2 class="font-medium mb-3">Tambah User</h2>
        <form
          method="post"
          action="/app/admin/users"
          class="grid grid-cols-1 sm:grid-cols-2 gap-2"
        >
          <input
            type="text"
            name="name"
            placeholder="Nama"
            required
            class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="password"
            name="password"
            placeholder="Password (min. 8 karakter)"
            required
            class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            name="role"
            class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="guru">Guru</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            class="sm:col-span-2 bg-emerald-600 text-white rounded-lg py-2 font-medium hover:bg-emerald-700"
          >
            Tambah User
          </button>
        </form>
      </div>

      <div class="space-y-3">
        {users.map((u) => (
          <div class="bg-white rounded-2xl border border-slate-200 p-4">
            <form
              method="post"
              action={`/app/admin/users/${u.id}`}
              class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2"
            >
              <input
                type="text"
                name="name"
                value={u.name}
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                name="email"
                value={u.email}
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                name="role"
                disabled={u.id === currentUser.id}
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="guru" selected={u.role === "guru"}>
                  Guru
                </option>
                <option value="admin" selected={u.role === "admin"}>
                  Admin
                </option>
              </select>
              <button
                type="submit"
                class="sm:col-span-3 text-sm font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 self-start"
              >
                Simpan Perubahan
              </button>
            </form>

            <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <form
                method="post"
                action={`/app/admin/users/${u.id}/reset-password`}
                class="flex items-center gap-2"
              >
                <input
                  type="password"
                  name="newPassword"
                  placeholder="Password baru (min. 8)"
                  required
                  class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-44"
                />
                <button
                  type="submit"
                  class="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700"
                >
                  Reset Password
                </button>
              </form>
              {u.id !== currentUser.id && (
                <button
                  hx-delete={`/app/admin/users/${u.id}`}
                  hx-confirm={`Hapus user "${u.name}"? Semua data (kelas, siswa, jadwal, dst) milik user ini akan ikut terhapus.`}
                  hx-target="body"
                  class="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 ml-auto"
                >
                  Hapus User
                </button>
              )}
              {u.id === currentUser.id && (
                <span class="text-xs text-slate-400 ml-auto">
                  Ini akun Anda
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

adminRoutes.get("/app/admin/users", async (c) => {
  const currentUser = c.get("user");
  const allUsers = await listUsers();
  const success = c.req.query("success");
  return c.html(
    <AdminUsersPage
      currentUser={currentUser}
      users={allUsers}
      success={success}
    />,
  );
});

adminRoutes.post("/app/admin/users", async (c) => {
  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const role = (
    String(body.role ?? "guru") === "admin" ? "admin" : "guru"
  ) as UserRole;

  const result = await createUser({ name, email, password, role });

  if (!result.ok) {
    return c.redirect(`/app/admin/users?error=${result.error}`);
  }

  return c.redirect("/app/admin/users?success=User berhasil ditambahkan.");
});

adminRoutes.post("/app/admin/users/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const role = (
    String(body.role ?? "guru") === "admin" ? "admin" : "guru"
  ) as UserRole;

  const result = await updateUser(id, { name, email, role });

  if (!result.ok) {
    return c.redirect(`/app/admin/users?error=${result.error}`);
  }

  return c.redirect("/app/admin/users?success=User berhasil diperbarui.");
});

adminRoutes.post("/app/admin/users/:id/reset-password", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const newPassword = String(body.newPassword ?? "");

  const result = await resetPassword(id, newPassword);

  if (!result.ok) {
    return c.redirect(`/app/admin/users?error=${result.error}`);
  }

  return c.redirect("/app/admin/users?success=Password berhasil direset.");
});

adminRoutes.delete("/app/admin/users/:id", async (c) => {
  const currentUser = c.get("user");
  const id = Number(c.req.param("id"));

  if (id === currentUser.id) {
    c.header("HX-Redirect", "/app/admin/users?error=invalid");
    return c.body(null);
  }

  const result = await deleteUser(id);

  c.header(
    "HX-Redirect",
    result.ok
      ? "/app/admin/users?success=User berhasil dihapus."
      : `/app/admin/users?error=${result.error}`,
  );
  return c.body(null);
});
