/**
 * Escape satu nilai untuk kolom CSV: bungkus dengan tanda kutip jika
 * mengandung koma, tanda kutip, atau baris baru.
 */
function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Bangun teks CSV dari header dan baris data. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ];
  return lines.join("\r\n");
}

/** Sanitasi nama file: ganti karakter non-alfanumerik dengan tanda hubung. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
