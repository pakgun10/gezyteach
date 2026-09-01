Perubahan jurnal sudah ada di `origin/main` (commit `52e2132`). Jalankan langkah berikut di VPS.

1. Login ke VPS:

```bash
ssh pgun@107.172.27.102
cd ~/gezyteach
```

2. Pastikan tidak ada perubahan lokal:

```bash
git status --short
pm2 status
```

`git status --short` sebaiknya kosong.

3. Backup database sebelum migrasi:

```bash
BACKUP_TAG=$(date +%Y%m%d-%H%M%S)
mkdir -p "$HOME/backup-gezyteach/manual"

sqlite3 "$HOME/gezyteach/data/gezyteach.db" \
  ".backup '$HOME/backup-gezyteach/manual/gezyteach-$BACKUP_TAG.db'"
```

4. Hentikan aplikasi sementara:

```bash
pm2 stop gezyteach
```

5. Ambil kode terbaru:

```bash
git pull --ff-only origin main
bun install --frozen-lockfile
```

6. Jalankan migrasi jurnal:

```bash
bun run db:migrate
```

Pastikan kolom baru sudah ada:

```bash
sqlite3 data/gezyteach.db \
  "PRAGMA table_info(journals);"
```

Cari kolom `user_id`, `class_id`, dan `subject_key`.

7. Build CSS:

```bash
bun run build:css
```

8. Jalankan kembali aplikasi:

```bash
pm2 restart gezyteach
pm2 save
```

9. Periksa log:

```bash
pm2 logs gezyteach --lines 100
```

10. Buka `https://teach.gezytech.web.id/app/journal`, lalu uji:

- klik kartu jurnal yang sudah ada;
- edit dan simpan kembali;
- klik “Buat Jurnal” berulang pada kelas/mapel/tanggal yang sama;
- pastikan tetap membuka jurnal yang sama, bukan membuat jurnal baru.

Jangan menjalankan `bun run db:generate` di VPS. File migrasi sudah dibuat dan cukup diterapkan dengan `bun run db:migrate`.
