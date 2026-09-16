import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

type ColumnMapping = {
  name?: string;
  phone: string;
  email?: string;
  purchaseDate?: string;
  purchaseValue?: string;
  quantity?: string;
  orderId?: string;
  status?: string;
};

function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "").slice(-10);
}

function parseNumber(raw: unknown) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseDate(raw: unknown) {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rows = body?.rows as Record<string, string>[] | undefined;
  const mapping = body?.mapping as ColumnMapping | undefined;
  const sourceFile = body?.sourceFile as string | undefined;
  // Statuses to actually count as a completed sale — everything else
  // (cancelled, rejected, failed, pending) is dropped before it ever
  // touches spend/order-count/Miles. Case-insensitive exact match.
  const includeStatuses = (body?.includeStatuses as string[] | undefined)?.map((s) => s.toLowerCase());

  if (!rows?.length || !mapping?.phone) {
    return NextResponse.json({ error: "Missing rows or phone column mapping" }, { status: 400 });
  }

  // Filter by status first, then group line items into one record per
  // (phone, orderId) — a multi-item order must count as ONE purchase, not
  // one per line item, or order counts and Miles both get inflated.
  type Group = {
    name: string | null;
    phone: string;
    email: string | null;
    orderId: string | null;
    dates: string[];
    value: number;
    quantity: number;
  };
  const groups = new Map<string, Group>();
  let statusFiltered = 0;
  let noPhone = 0;

  for (const row of rows) {
    if (mapping.status && includeStatuses?.length) {
      const status = (row[mapping.status] ?? "").trim().toLowerCase();
      if (!includeStatuses.includes(status)) {
        statusFiltered++;
        continue;
      }
    }

    const phone = normalizePhone(row[mapping.phone] ?? "");
    if (phone.length !== 10) {
      noPhone++;
      continue;
    }

    const orderId = mapping.orderId ? row[mapping.orderId] || null : null;
    const groupKey = orderId ? `${phone}::${orderId}` : `${phone}::${crypto.randomUUID()}`;

    const value = mapping.purchaseValue ? parseNumber(row[mapping.purchaseValue]) ?? 0 : 0;
    const quantity = mapping.quantity ? parseNumber(row[mapping.quantity]) ?? 0 : 0;
    const date = mapping.purchaseDate ? parseDate(row[mapping.purchaseDate]) : null;

    const existing = groups.get(groupKey);
    if (existing) {
      existing.value += value;
      existing.quantity += quantity;
      if (date) existing.dates.push(date);
    } else {
      groups.set(groupKey, {
        name: mapping.name ? row[mapping.name] || null : null,
        phone,
        email: mapping.email ? row[mapping.email] || null : null,
        orderId,
        dates: date ? [date] : [],
        value,
        quantity,
      });
    }
  }

  const records = [...groups.values()].map((g) => ({
    name: g.name,
    phone: g.phone,
    email: g.email,
    purchase_date: g.dates.sort().at(-1) ?? null,
    purchase_value: g.value,
    quantity: g.quantity,
    order_id: g.orderId,
    source_file: sourceFile ?? null,
  }));

  if (records.length === 0) {
    return NextResponse.json(
      { error: "Nothing left to import after filtering — check your status selection and phone mapping" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    // Insert in chunks — a large file as one request can hit payload/row limits.
    const CHUNK = 500;
    for (let i = 0; i < records.length; i += CHUNK) {
      const { error } = await supabase.from("imported_customer_records").insert(records.slice(i, i + CHUNK));
      if (error) throw error;
    }

    return NextResponse.json({
      imported: records.length,
      skippedNoPhone: noPhone,
      skippedByStatus: statusFiltered,
    });
  } catch (err) {
    console.error("Failed to import customer records", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
