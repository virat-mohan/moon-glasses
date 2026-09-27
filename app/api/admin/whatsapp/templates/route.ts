import { NextResponse } from "next/server";
import { createMsg91Templates, listMsg91TemplateStatuses } from "@/lib/msg91-templates";

export async function GET() {
  try {
    return NextResponse.json({ templates: await listMsg91TemplateStatuses() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load templates" }, { status: 500 });
  }
}

export async function POST() {
  try {
    return NextResponse.json(await createMsg91Templates());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create templates" }, { status: 400 });
  }
}
