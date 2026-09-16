"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";

type Mapping = {
  name: string;
  phone: string;
  email: string;
  purchaseDate: string;
  purchaseValue: string;
  quantity: string;
  orderId: string;
  status: string;
};

const EMPTY_MAPPING: Mapping = {
  name: "",
  phone: "",
  email: "",
  purchaseDate: "",
  purchaseValue: "",
  quantity: "",
  orderId: "",
  status: "",
};

const FIELD_LABELS: { key: keyof Mapping; label: string; required?: boolean; hint?: string }[] = [
  { key: "phone", label: "Phone", required: true },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "orderId", label: "Order ID", hint: "Groups multi-item orders into one purchase instead of one per line item." },
  { key: "purchaseDate", label: "Purchase Date" },
  { key: "purchaseValue", label: "Purchase Value (₹)", hint: "Per line item — summed within an order." },
  { key: "quantity", label: "Quantity / Caps Bought" },
  { key: "status", label: "Order Status", hint: "Pick which statuses count as a real sale below." },
];

function guessColumn(headers: string[], candidates: string[]) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return headers[idx];
  }
  return "";
}

const LIKELY_COMPLETED = ["delivered", "shipped", "completed", "accepted"];

export function CustomerImport({ onImported }: { onImported: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [includedStatuses, setIncludedStatuses] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusCounts = useMemo(() => {
    if (!mapping.status) return [];
    const counts = new Map<string, number>();
    for (const row of rows) {
      const val = (row[mapping.status] || "(blank)").trim();
      counts.set(val, (counts.get(val) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, mapping.status]);

  const includedRowCount = useMemo(() => {
    if (!mapping.status) return rows.length;
    return rows.filter((r) => includedStatuses.has((r[mapping.status] || "(blank)").trim())).length;
  }, [rows, mapping.status, includedStatuses]);

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const detectedHeaders = results.meta.fields ?? [];
        setHeaders(detectedHeaders);
        setRows(results.data);
        const statusCol = guessColumn(detectedHeaders, ["status"]);
        setMapping({
          name: guessColumn(detectedHeaders, ["name"]),
          phone: guessColumn(detectedHeaders, ["phone", "mobile", "contact"]),
          email: guessColumn(detectedHeaders, ["email"]),
          purchaseDate: guessColumn(detectedHeaders, ["date"]),
          purchaseValue: guessColumn(detectedHeaders, ["line item value", "value", "amount", "spend"]),
          quantity: guessColumn(detectedHeaders, ["qty", "quantity", "units", "caps"]),
          orderId: guessColumn(detectedHeaders, ["order id"]),
          status: statusCol,
        });

        if (statusCol) {
          const seen = new Set<string>();
          for (const row of results.data) {
            const val = (row[statusCol] || "(blank)").trim();
            if (LIKELY_COMPLETED.some((s) => val.toLowerCase().includes(s))) seen.add(val);
          }
          setIncludedStatuses(seen);
        } else {
          setIncludedStatuses(new Set());
        }
      },
      error: (err) => setError(err.message),
    });
  }

  function toggleStatus(status: string) {
    setIncludedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  async function runImport() {
    if (!mapping.phone) {
      setError("Map a Phone column before importing — it's how customers get deduplicated.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          mapping,
          sourceFile: fileName,
          includeStatuses: mapping.status ? [...includedStatuses] : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(
        `Imported ${data.imported} purchase(s).` +
          (data.skippedByStatus ? ` Skipped ${data.skippedByStatus} by status.` : "") +
          (data.skippedNoPhone ? ` Skipped ${data.skippedNoPhone} without a valid phone.` : "")
      );
      setRows([]);
      setHeaders([]);
      setFileName(null);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="border-t border-divider pt-6">
      <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
        Import Customer Data (CSV)
      </p>
      <p className="mt-1 max-w-lg text-micro text-secondary-text/70">
        Works with any export — map your file&apos;s columns below. Imported purchases are kept
        separate from real orders but merged into the customer totals here.
      </p>

      <label className="mt-4 block cursor-pointer border border-dashed border-ink/30 px-6 py-8 text-center transition-colors hover:border-ink">
        <span className="block font-sans text-body-s uppercase tracking-[0.1em] text-ink">
          {fileName ?? "Choose CSV File"}
        </span>
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>

      {headers.length > 0 && (
        <div className="mt-6">
          <p className="text-caption text-secondary-text">{rows.length} rows detected. Map columns:</p>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
            {FIELD_LABELS.map((field) => (
              <div key={field.key}>
                <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">
                  {field.label}
                  {field.required && " *"}
                </label>
                <select
                  value={mapping[field.key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  className="mt-1 w-full border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
                >
                  <option value="">— none —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                {field.hint && <p className="mt-0.5 text-micro text-secondary-text/60">{field.hint}</p>}
              </div>
            ))}
          </div>

          {mapping.status && statusCounts.length > 0 && (
            <div className="mt-5 border border-divider p-4">
              <p className="text-caption uppercase tracking-[0.05em] text-secondary-text">
                Which statuses count as a real sale?
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {statusCounts.map(([status, count]) => (
                  <label key={status} className="flex items-center gap-2 text-body-s">
                    <input
                      type="checkbox"
                      checked={includedStatuses.has(status)}
                      onChange={() => toggleStatus(status)}
                      className="h-4 w-4 accent-ink"
                    />
                    <span className="text-ink">{status}</span>
                    <span className="text-micro text-secondary-text">({count})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-caption text-secondary-text">
            {includedRowCount.toLocaleString("en-IN")} of {rows.length.toLocaleString("en-IN")} rows
            will be imported{mapping.orderId ? " (grouped into orders)" : ""}.
          </p>

          <button
            onClick={runImport}
            disabled={importing || includedRowCount === 0}
            className="mt-3 border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      )}

      {result && <p className="mt-3 text-body-s text-tan-gold">{result}</p>}
      {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}
    </div>
  );
}
