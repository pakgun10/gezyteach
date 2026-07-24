export const DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

export const DAY_NAMES_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

/** Mengembalikan tanggal hari ini dalam format YYYY-MM-DD (zona waktu lokal server). */
export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Mengembalikan dayOfWeek (0=Minggu..6=Sabtu) dari string tanggal YYYY-MM-DD. */
export function dayOfWeekFromIso(dateIso: string): number {
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(year!, month! - 1, day!).getDay();
}

export function formatDateLabel(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return `${DAY_NAMES[date.getDay()]}, ${date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
}
