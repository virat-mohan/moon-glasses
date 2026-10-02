import { NextResponse } from "next/server";
import { skipTag } from "@/lib/grid-post-server";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await skipTag(id);
  return NextResponse.json(r.ok ? { ok: true } : { error: r.error }, { status: r.ok ? 200 : (r.status ?? 500) });
}
