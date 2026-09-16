import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateWeeklyReport } from "@/lib/roas-report";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const [{ data: reports, error }, { data: whatsapp }] = await Promise.all([
      supabase.from("weekly_reports").select("*").order("week_end", { ascending: false }).limit(26),
      supabase.from("whatsapp_messages").select("template_name, status, converted"),
    ]);
    if (error) throw error;

    const byTemplate = new Map<string, { sent: number; delivered: number; read: number; converted: number }>();
    for (const msg of whatsapp ?? []) {
      const row = byTemplate.get(msg.template_name) ?? { sent: 0, delivered: 0, read: 0, converted: 0 };
      row.sent += 1;
      if (msg.status === "delivered" || msg.status === "read") row.delivered += 1;
      if (msg.status === "read") row.read += 1;
      if (msg.converted) row.converted += 1;
      byTemplate.set(msg.template_name, row);
    }

    return NextResponse.json({
      reports: reports ?? [],
      whatsapp: Object.fromEntries(byTemplate),
    });
  } catch (err) {
    console.error("Failed to list weekly reports", err);
    return NextResponse.json({ reports: [], whatsapp: {} }, { status: 500 });
  }
}

export async function POST() {
  try {
    const report = await generateWeeklyReport();
    return NextResponse.json({ report });
  } catch (err) {
    console.error("Failed to generate weekly report", err);
    return NextResponse.json({ error: "Could not generate report" }, { status: 500 });
  }
}
