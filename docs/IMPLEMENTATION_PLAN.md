# Implementation Plan: GezyTeach

## 1. Visi Produk

GezyTeach adalah aplikasi web ringan, modern, dan responsif untuk guru guna mengelola jadwal mengajar, jurnal harian, nilai, absensi siswa, data siswa per kelas, serta perangkat KBM (berupa tautan Google Drive). Aplikasi dioptimalkan untuk penggunaan di ponsel (HP) tanpa harus di-install sebagai PWA.

---

## 2. Stack Teknologi

| Lapisan | Pilihan | Alasan |
|---------|---------|--------|
| Runtime | **Bun** | Cepat, bundler + test runner built-in, SQLite native |
| Backend Framework | **Hono** | Ringan, TypeScript-native, middleware ekosistem matang |
| Database | **SQLite** via `bun:sqlite` + **Drizzle ORM** | Ringan, zero-config, migrasi & query type-safe |
| Frontend | **Hono JSX** + **HTMX** + **Tailwind CSS** | SSR ringan, interaktivitas tanpa banyak JS, UI modern responsif |
| Auth | Cookie-based session (`hono/cookie` + session store sederhana) | Mudah diimplementasikan, bisa diskalakan ke multi-user |
| Validasi | **Zod** | Type-safe schema validation untuk form/API |
| Impor Siswa | **PapaParse** / parsing CSV manual + template Excel (.xlsx opsional) | CSV paling ringan; Excel via `xlsx` library jika diperlukan |

> **Catatan migrasi:** SQLite dipilih sebagai database default untuk MVP. Struktur tabel dirancang agar migrasi ke MySQL/MariaDB di kemudian hari hanya memerlukan sedikit penyesuaian tipe data.

---

## 3. Struktur Proyek

```
gezyteach/
├── docs/
│   └── IMPLEMENTATION_PLAN.md
├── src/
│   ├── index.ts              # Entry point Bun + Hono app
│   ├── db/
│   │   ├── index.ts          # SQLite connection singleton
│   │   ├── schema.ts         # Definisi tabel Drizzle
│   │   └── migrations/       # File migrasi Drizzle
│   ├── routes/
│   │   ├── auth.ts           # Login/logout
│   │   ├── dashboard.ts      # Halaman utama
│   │   ├── schedule.ts       # Jadwal mingguan
│   │   ├── journal.ts        # Jurnal mengajar
│   │   ├── score.ts          # Rencana & pengisian nilai
│   │   ├── attendance.ts     # Absensi siswa
│   │   ├── students.ts       # Data siswa + import
│   │   └── resources.ts      # Perangkat KBM (Google Drive)
│   ├── components/
│   │   ├── Layout.tsx        # Layout dasar HTML
│   │   ├── Navbar.tsx        # Navigasi mobile-first
│   │   ├── FormInput.tsx
│   │   ├── Toast.tsx
│   │   └── ...
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── schedule.service.ts
│   │   ├── journal.service.ts
│   │   ├── score.service.ts
│   │   ├── attendance.service.ts
│   │   ├── student.service.ts
│   │   └── resource.service.ts
│   ├── utils/
│   │   ├── validators.ts     # Zod schemas
│   │   ├── dates.ts          # Helper tanggal & hari
│   │   └── csv.ts            # Parser/template CSV
│   └── static/
│       └── style.css         # Hasil build Tailwind
├── public/
│   └── (static assets)
├── templates/
│   └── students-import.csv
├── drizzle.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 4. Skema Database (SQLite)

### 4.1 Tabel Users (guru)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | INTEGER PK | Auto increment |
| name | TEXT | Nama lengkap guru |
| email | TEXT UNIQUE | Untuk login |
| passwordHash | TEXT | Hashed password (bcrypt) |
| createdAt | TEXT/INTEGER | Timestamp |

> Untuk MVP diizinkan single user; tabel ini mempersiapkan multi-user.

### 4.2 Tabel Classes (Kelas)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | INTEGER PK | Auto increment |
| userId | INTEGER FK | Pemilik kelas |
| name | TEXT | Contoh: "VIII-1" |
| level | TEXT | Contoh: "VII", "VIII", "IX" (opsional) |
| academicYear | TEXT | Tahun ajaran (opsional) |

### 4.3 Tabel Students (Siswa)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | INTEGER PK | Auto increment |
| classId | INTEGER FK | Kelas siswa |
| nis | TEXT | Nomor induk siswa |
| name | TEXT | Nama siswa |
| gender | TEXT | L/P |
| active | INTEGER DEFAULT 1 | 1 = aktif, 0 = non-aktif |

### 4.4 Tabel Schedules (Jadwal Mingguan)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | INTEGER PK | Auto increment |
| userId | INTEGER FK | Pemilik jadwal |
| classId | INTEGER FK | Kelas |
| subject | TEXT | Mata pelajaran |
| dayOfWeek | INTEGER | 0 = Minggu, 1 = Senin, ..., 6 = Sabtu |
| startTime | TEXT | Format HH:MM |
| endTime | TEXT | Format HH:MM |
| room | TEXT | Ruang kelas (opsional) |

### 4.5 Tabel Journals (Jurnal Mengajar)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | INTEGER PK | Auto increment |
| scheduleId | INTEGER FK | Jadwal yang menjadi dasar |
| date | TEXT | Format YYYY-MM-DD |
| topic | TEXT | Materi/pembelajaran |
| achievement | TEXT | Capaian pembelajaran |
| reflection | TEXT | Refleksi guru (opsional) |
| obstacle | TEXT | Kendala (opsional) |
| presentCount | INTEGER | Jumlah hadir |
| absentCount | INTEGER | Jumlah tidak hadir |
| status | TEXT | draft / completed |

> Unique constraint: `(scheduleId, date)` agar tidak ada duplikat jurnal untuk sesi yang sama di hari yang sama.

### 4.6 Tabel AssessmentPlans (Rencana Nilai)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | INTEGER PK | Auto increment |
| classId | INTEGER FK | Kelas |
| subject | TEXT | Mapel |
| name | TEXT | Nama komponen: UH, Tugas, PTS, PAS, Praktik |
| weight | REAL | Bobot komponen |
| sortOrder | INTEGER | Urutan tampilan (`order` dihindari karena reserved keyword SQL) |

### 4.7 Tabel Scores (Nilai Siswa)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | INTEGER PK | Auto increment |
| studentId | INTEGER FK | Siswa |
| assessmentPlanId | INTEGER FK | Komponen nilai |
| value | REAL | Nilai |

### 4.8 Tabel Attendance (Absensi)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | INTEGER PK | Auto increment |
| studentId | INTEGER FK | Siswa |
| scheduleId | INTEGER FK | Sesi mengajar (kelas + mapel) terkait, agar absensi tidak ambigu jika satu kelas punya lebih dari satu sesi di hari yang sama |
| date | TEXT | YYYY-MM-DD |
| status | TEXT | H (Hadir), S (Sakit), I (Izin), A (Alpa) |
| note | TEXT | Keterangan (opsional) |

> Unique constraint: `(studentId, scheduleId, date)` agar tidak ada absensi ganda untuk sesi yang sama.

### 4.9 Tabel Resources (Perangkat KBM)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | INTEGER PK | Auto increment |
| userId | INTEGER FK | Pemilik |
| category | TEXT | PPT, Video, LKPD, Bank Soal, Lainnya |
| title | TEXT | Judul perangkat |
| url | TEXT | Tautan Google Drive |
| description | TEXT | Deskripsi singkat |

### 4.10 Tabel Sessions (Sesi Login)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | TEXT PK | Session token (UUID/random string) |
| userId | INTEGER FK | Pemilik sesi |
| expiresAt | INTEGER | Timestamp kadaluarsa (epoch ms) |
| createdAt | INTEGER | Timestamp dibuat |

> **Catatan umum:** seluruh tabel di atas (kecuali `Sessions`) disarankan menambahkan kolom `createdAt` dan `updatedAt` (INTEGER, epoch ms) untuk audit dasar. Ditulis sekali di sini agar tidak diulang di setiap tabel.

---

## 5. Fitur & Alur Implementasi

### 5.1 Autentikasi

- **MVP:** satu akun guru default yang dibuat saat pertama kali aplikasi dijalankan (seeding).
- **Nanti:** registrasi tambahan guru dengan `email` unik.
- Login menggunakan cookie session dengan `httpOnly` dan flag `secure` saat production.
- Middleware autentikasi melindungi semua route di bawah `/app`.

### 5.2 Dashboard

- Ringkasan hari ini: jadwal mengajar berdasarkan hari, jurnal yang belum dilengkapi, jumlah kelas dan siswa.
- Navigasi mobile-first dengan ikon dan label jelas.

### 5.3 Jadwal (Schedule)

- Guru dapat menambahkan, mengedit, dan menghapus jadwal mingguan.
- Tampilan default: tabel mingguan (Senin–Sabtu) dengan slot waktu.
- Tampilan alternatif: daftar kartu per hari untuk HP.
- Validasi bentrok jam di kelas yang sama tidak diwajibkan untuk MVP, tetapi diperhitungkan di iterasi berikutnya.

### 5.4 Jurnal (Journal)

- Saat guru membuka halaman jurnal pada suatu hari, sistem menampilkan daftar jadwal hari tersebut yang belum memiliki jurnal.
- Guru memilih jadwal → sistem membuat draft jurnal otomatis (berdasarkan `scheduleId` dan tanggal hari ini).
- Guru melengkapi: materi, capaian pembelajaran, refleksi, kendala, jumlah hadir/tidak hadir.
- Jurnal dapat diedit kapan saja.

### 5.5 Nilai (Score)

- **Rencana nilai:** guru menambahkan komponen penilaian per kelas per mapel beserta bobotnya.
- **Pengisian nilai:** satu halaman berupa tabel, baris = siswa, kolom = komponen nilai. Input inline (HTMX) atau submit sekaligus.
- Nilai akhir dihitung otomatis berdasarkan bobot saat ditampilkan (tidak perlu disimpan sebagai kolom terpisah).
- KKM dan cetak rapor tidak dibuat untuk MVP.

### 5.6 Absensi (Attendance)

- Guru memilih kelas dan tanggal.
- Sistem menampilkan daftar siswa dengan pilihan status: Hadir, Sakit, Izin, Alpa.
- Tombol "Semua Hadir" untuk menghemat waktu.
- Data disimpan per siswa per tanggal.

### 5.7 Data Siswa (Students)

- CRUD siswa per kelas.
- **Import CSV** dengan template yang disediakan (`templates/students-import.csv`).
- Proses import: upload → preview → konfirmasi simpan.
- Validasi duplikasi NIS dalam satu kelas.

### 5.8 Perangkat KBM (Resources)

- CRUD tautan Google Drive dengan kategori: PPT, Video, LKPD, Bank Soal, Lainnya.
- Tampilan dikelompokkan berdasarkan kategori.
- Tombol buka link membuka tab baru.

---

## 6. Endpoint API / Route (Hono)

### Autentikasi
- `GET /login` → halaman login
- `POST /login` → proses login
- `POST /logout` → logout

### Aplikasi (setelah login)
- `GET /app` → dashboard
- `GET /app/schedule` → daftar jadwal
- `POST /app/schedule` → simpan jadwal
- `PUT /app/schedule/:id` → edit jadwal
- `DELETE /app/schedule/:id` → hapus jadwal
- `GET /app/journal` → jurnal hari ini / daftar jurnal
- `GET /app/journal/new?scheduleId=&date=` → draft jurnal
- `POST /app/journal` → simpan jurnal
- `PUT /app/journal/:id` → update jurnal
- `GET /app/scores/plans` → rencana nilai
- `POST /app/scores/plans` → tambah komponen
- `DELETE /app/scores/plans/:id` → hapus komponen
- `GET /app/scores/entry?classId=&subject=` → halaman input nilai
- `POST /app/scores/entry` → simpan nilai
- `GET /app/attendance` → halaman absensi
- `POST /app/attendance` → simpan absensi
- `GET /app/students` → daftar kelas & siswa
- `POST /app/students` → tambah siswa
- `POST /app/students/import` → import CSV
- `DELETE /app/students/:id` → hapus siswa
- `GET /app/resources` → daftar perangkat
- `POST /app/resources` → tambah perangkat
- `PUT /app/resources/:id` → edit perangkat
- `DELETE /app/resources/:id` → hapus perangkat

---

## 7. UI/UX

- **Mobile-first:** semua halaman didesain untuk lebar 320px ke atas.
- **Navigasi bawah (bottom nav)** untuk akses cepat menu utama di HP.
- **Tailwind CSS** untuk styling modern, ringan, dan konsisten.
- **HTMX** untuk:
  - Submit form tanpa reload penuh
  - Switch tab/hari pada jadwal
  - Input nilai inline
  - Update absensi instan
- **Toast notifikasi** untuk konfirmasi simpan/hapus.

---

## 8. Tahapan Pengembangan (Milestones)

### Milestone 1 — Foundation (minggu ke-1)
- Setup proyek Hono + Bun + Tailwind + Drizzle ORM
- Konfigurasi database SQLite dan skema tabel
- Implementasi auth session & layout dasar
- Seeder user default

### Milestone 2 — Master Data (minggu ke-1/2)
- CRUD kelas
- CRUD siswa + import CSV
- Halaman data siswa per kelas

### Milestone 3 — Jadwal & Jurnal (minggu ke-2)
- CRUD jadwal mingguan (tabel + kartu HP)
- Draft jurnal otomatis dari jadwal
- Pengisian dan riwayat jurnal

### Milestone 4 — Nilai & Absensi (minggu ke-3)
- Rencana komponen nilai
- Halaman input nilai satu tabel
- Absensi per kelas per tanggal

### Milestone 5 — Perangkat & Polish (minggu ke-3/4)
- CRUD perangkat KBM dengan kategori
- Dashboard ringkasan
- Review responsive HP
- Testing manual & perbaikan bug

### Milestone 6 — Multi-user Prep (opsional, setelah MVP)
- Registrasi/login multi-guru
- Isolasi data per userId
- Migrasi ke MySQL/MariaDB jika diperlukan

---

## 9. Keputusan Arsitektur Penting

| Keputusan | Penjelasan |
|-----------|------------|
| SQLite default | Ringan, cukup untuk 1 guru dan data sekolah menengah. File `.db` mudah di-backup. |
| Drizzle ORM | Query type-safe, migrasi sederhana, kompatibel dengan SQLite/MySQL/MariaDB. |
| Hono JSX + HTMX | Tidak perlu build frontend terpisah; cukup cepat untuk MVP dan mudah dirawat. |
| Server-side session | Cookie `httpOnly`; state disimpan di SQLite tabel `sessions` untuk skalabilitas. |
| Import CSV (bukan Excel) | Lebih ringan; template tetap bisa dibuka di Excel/LibreOffice. |
| Tidak ada KKM/cetak rapor | Sesuai batasan MVP; bisa ditambahkan di iterasi berikutnya. |

---

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| SQLite kurang cocok untuk multi-user bersamaan | Untuk MVP single-user tidak masalah; jika multi-user nanti, migrasi ke MySQL/MariaDB. |
| `bun:sqlite` masih relatif baru | Pantau stabilitas; fallback ke `better-sqlite3` jika diperlukan (tetap SQLite). |
| Tampilan ramai di layar kecil | Desain mobile-first, bottom nav, card-based layout, scroll horizontal untuk tabel nilai. |
| Import CSV format salah | Validasi kolom wajib dan tampilkan preview sebelum konfirmasi. |

---

## 11. Cara Menjalankan (Target Akhir)

```bash
# Install dependencies
bun install

# Jalankan migrasi database
bun run db:migrate

# Seed user default
bun run db:seed

# Jalankan dev server
bun run dev

# Build CSS Tailwind
bun run build:css
```

Akses aplikasi di `http://localhost:3000`.

---

## 12. Catatan Pengembangan Berikutnya

Setelah MVP stabil, fitur yang dapat dipertimbangkan:
- Multi-guru dengan registrasi dan isolasi data.
- Export rekap nilai dan absensi ke PDF/Excel.
- Notifikasi jurnal belum diisi.
- Kalender integrasi.
- Migrasi database ke MySQL/MariaDB untuk deployment bersama.

## 13. Akses 
Setelah ready production, maka akan dijalankan:
- VPS di : 107.172.27.102 untuk masuknya ssh pgun@107.172.27.102
- subdomain: teach.gezytech.web.id
- Pakai SSL NGINX
