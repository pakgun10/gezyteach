/**
 * Penyimpanan sementara (in-memory) untuk hasil aktivasi PIN massal.
 *
 * PIN plaintext hanya ada sesaat setelah dibuat (tidak disimpan di database
 * dalam bentuk terbaca). Supaya guru bisa mengunduh CSV berisi PIN yang baru
 * saja digenerate, hasilnya disimpan singkat di memori proses, diberi token
 * acak, dan otomatis kedaluwarsa.
 *
 * Catatan: karena ini in-memory, batch akan hilang jika proses di-restart.
 * Itu wajar, sesuai sifat PIN yang memang hanya boleh dilihat sekali.
 */

type BatchRow = { name: string; loginId: string; pin: string };

type Batch = {
  classId: number;
  createdAt: number;
  rows: BatchRow[];
};

const TTL_MS = 30 * 60 * 1000; // 30 menit
const batches = new Map<string, Batch>();

function sweepExpired() {
  const now = Date.now();
  for (const [token, batch] of batches) {
    if (now - batch.createdAt > TTL_MS) {
      batches.delete(token);
    }
  }
}

export function createActivationBatch(classId: number, rows: BatchRow[]): string {
  sweepExpired();
  const token = crypto.randomUUID();
  batches.set(token, { classId, createdAt: Date.now(), rows });
  return token;
}

export function getActivationBatch(token: string, classId: number): BatchRow[] | null {
  sweepExpired();
  const batch = batches.get(token);
  if (!batch || batch.classId !== classId) return null;
  return batch.rows;
}
