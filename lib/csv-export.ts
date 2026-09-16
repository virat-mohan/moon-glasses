/** Quotes a CSV field only when it actually needs it — commas, quotes, or newlines. */
function csvField(value: string | number) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((row) => row.map(csvField).join(",")).join("\n");
}

/** Client-only — triggers a browser download of the given rows as a CSV file. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
