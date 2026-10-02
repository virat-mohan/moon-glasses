import { NextResponse } from "next/server";
import { approveTag } from "@/lib/grid-post-server";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await approveTag(id);
  return NextResponse.json(r.ok ? { ok: true, postId: r.postId } : { error: r.error }, { status: r.ok ? 200 : (r.status ?? 500) });
}
