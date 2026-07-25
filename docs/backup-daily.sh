#!/usr/bin/env bash
#
# Backup harian GezyTeach: database SQLite, config nginx, SSL cert, config PM2,
# dan config acme.sh. Hasil di-upload ke Google Drive (rclone) dan notifikasi
# dikirim ke Telegram.
#
# Dijalankan via cron sebagai user pgun di VPS.

set -uo pipefail

BACKUP_DIR="$HOME/backup-gezyteach"
TMP_DIR="$BACKUP_DIR/tmp"
LOG_DIR="$BACKUP_DIR/logs"
ENV_FILE="$BACKUP_DIR/.env"

DATE=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/backup-$DATE.log"
ARCHIVE_NAME="gezyteach-backup-$DATE.tar.gz"
ARCHIVE_PATH="$TMP_DIR/$ARCHIVE_NAME"

RETENTION_DAYS=14

mkdir -p "$TMP_DIR" "$LOG_DIR"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

RCLONE="$HOME/bin/rclone"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive-gezyteach:gezyteach}"

exec > "$LOG_FILE" 2>&1

echo "=== Backup GezyTeach dimulai: $(date) ==="

send_telegram() {
  local message="$1"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=${message}" \
      --data-urlencode "parse_mode=HTML" > /dev/null
  fi
}

# Telegram Bot API membatasi upload file via bot maksimal 50MB.
TELEGRAM_MAX_SIZE=$((50 * 1024 * 1024))

send_telegram_file() {
  local file_path="$1"
  local caption="$2"

  if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
    return 0
  fi

  local file_size
  file_size=$(stat -c%s "$file_path" 2>/dev/null || echo 0)

  if [ "$file_size" -gt "$TELEGRAM_MAX_SIZE" ]; then
    echo "PERINGATAN: archive backup (${ARCHIVE_SIZE}) melebihi batas 50MB Telegram, file tidak dikirim."
    send_telegram "⚠️ <b>Backup GezyTeach berhasil, tapi file tidak dikirim ke Telegram</b>%0AUkuran ${ARCHIVE_SIZE} melebihi batas 50MB bot Telegram.%0AFile tetap tersimpan di Google Drive."
    return 0
  fi

  local response
  response=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" \
    -F "chat_id=${TELEGRAM_CHAT_ID}" \
    -F "caption=${caption}" \
    -F "parse_mode=HTML" \
    -F "document=@${file_path}")

  if ! echo "$response" | grep -q '"ok":true'; then
    echo "PERINGATAN: gagal mengirim file backup ke Telegram. Response: $response"
  fi
}

fail() {
  echo "GAGAL: $1"
  send_telegram "❌ <b>Backup GezyTeach GAGAL</b>%0A$1%0AWaktu: $(date '+%Y-%m-%d %H:%M:%S')"
  exit 1
}

STAGE_DIR="$TMP_DIR/stage-$DATE"
mkdir -p "$STAGE_DIR"

# 1. Backup database SQLite (pakai sqlite3 .backup, aman walau app sedang jalan)
echo "-- Backup database..."
if [ -f "$HOME/gezyteach/data/gezyteach.db" ]; then
  sqlite3 "$HOME/gezyteach/data/gezyteach.db" ".backup '$STAGE_DIR/gezyteach.db'" \
    || fail "Backup database SQLite gagal."
else
  fail "File database tidak ditemukan di ~/gezyteach/data/gezyteach.db"
fi

# 2. Backup config nginx untuk gezyteach
echo "-- Backup config nginx..."
mkdir -p "$STAGE_DIR/nginx"
if [ -f /etc/nginx/sites-available/gezyteach ]; then
  cp /etc/nginx/sites-available/gezyteach "$STAGE_DIR/nginx/gezyteach.conf" \
    || echo "PERINGATAN: gagal copy config nginx (lanjut tanpa ini)."
else
  echo "PERINGATAN: config nginx gezyteach tidak ditemukan."
fi

# 3. Backup SSL certificate (dipakai bersama beberapa domain)
echo "-- Backup SSL certificate..."
mkdir -p "$STAGE_DIR/ssl"
if [ -d "$HOME/nginx-ssl" ]; then
  cp "$HOME/nginx-ssl/gezytech.crt" "$STAGE_DIR/ssl/" 2>/dev/null
  cp "$HOME/nginx-ssl/gezytech.key" "$STAGE_DIR/ssl/" 2>/dev/null
else
  echo "PERINGATAN: folder nginx-ssl tidak ditemukan."
fi

# 4. Backup config acme.sh (akun Let's Encrypt & renewal config)
echo "-- Backup config acme.sh..."
if [ -d "$HOME/.acme.sh" ]; then
  mkdir -p "$STAGE_DIR/acme.sh"
  cp -r "$HOME/.acme.sh/account.conf" "$STAGE_DIR/acme.sh/" 2>/dev/null
  cp -r "$HOME/.acme.sh/aios.gezytech.web.id_ecc" "$STAGE_DIR/acme.sh/" 2>/dev/null
else
  echo "PERINGATAN: folder .acme.sh tidak ditemukan."
fi

# 5. Backup dump PM2 (daftar proses)
echo "-- Backup dump PM2..."
if [ -f "$HOME/.pm2/dump.pm2" ]; then
  cp "$HOME/.pm2/dump.pm2" "$STAGE_DIR/pm2-dump.pm2"
else
  echo "PERINGATAN: dump PM2 tidak ditemukan. Jalankan 'pm2 save' terlebih dahulu."
fi

# 6. Kompres semua jadi satu archive
echo "-- Membuat archive..."
tar -czf "$ARCHIVE_PATH" -C "$STAGE_DIR" . || fail "Gagal membuat archive tar."
rm -rf "$STAGE_DIR"

ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)
echo "Archive dibuat: $ARCHIVE_PATH ($ARCHIVE_SIZE)"

# 7. Upload ke Google Drive
echo "-- Upload ke Google Drive..."
"$RCLONE" copy "$ARCHIVE_PATH" "$GDRIVE_REMOTE" --no-traverse \
  || fail "Upload ke Google Drive gagal."

# 8. Hapus backup lama di Google Drive (retensi)
echo "-- Membersihkan backup lama di Google Drive (retensi $RETENTION_DAYS hari)..."
"$RCLONE" delete "$GDRIVE_REMOTE" --min-age "${RETENTION_DAYS}d" \
  --include "gezyteach-backup-*.tar.gz" 2>&1 || echo "PERINGATAN: gagal bersihkan backup lama di Drive."

# 9. Kirim archive ke Telegram (jika ukurannya di bawah limit 50MB bot)
echo "-- Kirim archive ke Telegram..."
send_telegram_file "$ARCHIVE_PATH" "💾 Backup GezyTeach $DATE (${ARCHIVE_SIZE})"

# 10. Hapus file lokal sementara (archive tidak disimpan lokal, cukup di Drive)
rm -f "$ARCHIVE_PATH"

# 11. Hapus log lama (retensi sama)
find "$LOG_DIR" -name "backup-*.log" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null

echo "=== Backup GezyTeach selesai: $(date) ==="

send_telegram "✅ <b>Backup GezyTeach berhasil</b>%0AUkuran: ${ARCHIVE_SIZE}%0AWaktu: $(date '+%Y-%m-%d %H:%M:%S')%0ATersimpan di Google Drive folder: gezyteach"
