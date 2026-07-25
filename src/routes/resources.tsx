import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import {
  RESOURCE_CATEGORIES,
  createResource,
  deleteResource,
  listResourcesByUser,
  type ResourceCategory,
} from "../services/resource.service";
import { Layout } from "../components/Layout";

type AppContext = {
  Variables: { user: SessionUser };
};

export const resourcesRoutes = new Hono<AppContext>();

resourcesRoutes.get("/app/resources", async (c) => {
  const user = c.get("user");
  const items = await listResourcesByUser(user.id);

  const grouped = new Map<ResourceCategory, typeof items>();
  for (const category of RESOURCE_CATEGORIES) {
    grouped.set(
      category,
      items.filter((i) => i.category === category),
    );
  }

  return c.html(
    <Layout title="Perangkat KBM" user={user} activeNav="resources">
      <h1 class="text-xl font-semibold mb-4">Perangkat KBM</h1>

      <div class="gt-card p-4 mb-4">
        <h2 class="font-medium mb-3">Tambah Perangkat</h2>
        <form
          method="post"
          action="/app/resources"
          class="grid grid-cols-1 sm:grid-cols-2 gap-2"
        >
          <select name="category" required class="gt-input">
            {RESOURCE_CATEGORIES.map((cat) => (
              <option value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="text"
            name="title"
            placeholder="Judul perangkat"
            required
            class="gt-input"
          />
          <input
            type="url"
            name="url"
            placeholder="Tautan Google Drive"
            required
            class="gt-input sm:col-span-2"
          />
          <input
            type="text"
            name="description"
            placeholder="Deskripsi (opsional)"
            class="gt-input sm:col-span-2"
          />
          <button type="submit" class="gt-btn-primary sm:col-span-2 py-2">
            Tambah
          </button>
        </form>
      </div>

      <div class="space-y-4">
        {RESOURCE_CATEGORIES.map((category) => {
          const categoryItems = grouped.get(category) ?? [];
          if (categoryItems.length === 0) return null;

          return (
            <div>
              <h3 class="gt-muted text-sm font-semibold mb-2 uppercase tracking-wide">
                {category}
              </h3>
              <div class="space-y-2">
                {categoryItems.map((item) => (
                  <div class="gt-card p-3 flex items-center justify-between gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="min-w-0 flex-1"
                    >
                      <p class="font-medium truncate">{item.title}</p>
                      {item.description && (
                        <p class="gt-muted text-sm truncate">
                          {item.description}
                        </p>
                      )}
                    </a>
                    <div class="flex items-center gap-2 shrink-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="gt-badge-emerald text-xs font-medium px-2 py-1.5 rounded-lg"
                      >
                        Buka
                      </a>
                      <button
                        hx-delete={`/app/resources/${item.id}`}
                        hx-confirm={`Hapus perangkat "${item.title}"?`}
                        hx-target="closest div.gt-card"
                        hx-swap="outerHTML"
                        class="gt-link-red text-xs font-medium"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <p class="gt-muted text-sm text-center py-8">
            Belum ada perangkat KBM. Tambahkan tautan Google Drive pertama Anda
            di atas.
          </p>
        )}
      </div>
    </Layout>,
  );
});

resourcesRoutes.post("/app/resources", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const category = String(body.category ?? "") as ResourceCategory;
  const title = String(body.title ?? "").trim();
  const url = String(body.url ?? "").trim();
  const description = String(body.description ?? "").trim() || undefined;

  if (RESOURCE_CATEGORIES.includes(category) && title && url) {
    await createResource(user.id, { category, title, url, description });
  }

  return c.redirect("/app/resources");
});

resourcesRoutes.delete("/app/resources/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  await deleteResource(user.id, id);
  return c.body(null);
});
