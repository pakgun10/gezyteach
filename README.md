# GezyTeach

Aplikasi web ringan untuk guru: kelola jadwal mengajar, jurnal harian, nilai, absensi, data siswa per kelas, dan perangkat KBM (tautan Google Drive). Didesain mobile-first agar nyaman dipakai di HP.

Detail rencana fitur dan arsitektur lengkap ada di [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md).

## Stack

- **Runtime:** [Bun](https://bun.sh)
- **Backend:** [Hono](https://hono.dev)
- **Database:** SQLite (`bun:sqlite`) + [Drizzle ORM](https://orm.drizzle.team)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com)

## Persiapan

Install dependencies:

```bash
bun install
```

Jalankan migrasi database (membuat `data/gezyteach.db`):

```bash
bun run db:migrate
```

Buat akun guru default:

```bash
bun run db:seed
```

Secara default akun dibuat dengan:

- email: `guru@gezyteach.local`
- password: `gezyteach123`

Ganti kredensial default lewat environment variable `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NAME` sebelum menjalankan `db:seed`, atau ubah password setelah login pertama kali.

## Menjalankan Aplikasi

Build CSS Tailwind (sekali, atau `dev:css` untuk watch mode):

```bash
bun run build:css
```

Jalankan server development (hot reload):

```bash
bun run dev
```

Aplikasi berjalan di [http://localhost:3000](http://localhost:3000).

## Struktur Proyek

```
gezyteach/
├── docs/                   # Dokumentasi (implementation plan, dsb.)
├── src/
│   ├── index.ts            # Entry point Hono + Bun
│   ├── db/
│   │   ├── schema.ts       # Skema tabel Drizzle
│   │   ├── index.ts        # Koneksi database
│   │   ├── migrate.ts      # Runner migrasi
│   │   ├── seed.ts         # Seeder user default
│   │   └── migrations/     # File migrasi hasil drizzle-kit
│   ├── routes/              # Handler route per fitur
│   ├── components/          # Komponen JSX (Hono JSX)
│   ├── services/            # Logika bisnis per fitur
│   ├── utils/                # Helper (validasi, tanggal, csv)
│   └── static/               # CSS hasil build Tailwind
├── templates/                # Template import (mis. CSV siswa)
├── data/                      # File database SQLite (di-gitignore)
├── drizzle.config.ts
└── package.json
```

## Skrip yang Tersedia

| Skrip | Fungsi |
|-------|--------|
| `bun run dev` | Jalankan server dengan hot reload |
| `bun run start` | Jalankan server tanpa hot reload |
| `bun run db:generate` | Generate file migrasi baru dari `schema.ts` |
| `bun run db:migrate` | Terapkan migrasi ke database |
| `bun run db:seed` | Buat user guru default |
| `bun run build:css` | Build CSS Tailwind (minified) |
| `bun run dev:css` | Build CSS Tailwind (watch mode) |

## Status Pengembangan

Proyek ini sedang dalam tahap pengembangan aktif mengikuti milestone di [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md). Saat ini: fondasi proyek (database, server, styling) sudah berjalan.
