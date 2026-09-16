import { NextResponse } from "next/server";
import { runLegacyWinbackSweep } from "@/lib/legacy-winback";

export async function POST() {
  try {
    const result = await runLegacyWinbackSweep();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Legacy win-back sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
