import { NextResponse } from "next/server";
import { listPreorders } from "@/lib/preorders";

export async function GET() {
  const preorders = await listPreorders();
  return NextResponse.json({ preorders });
}
