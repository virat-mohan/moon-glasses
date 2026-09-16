import { NextResponse } from "next/server";
import { getDropDateIso, formatDropDateLabel } from "@/lib/dropDate";
import { getPreorderAmountRupees } from "@/lib/preorders";

export async function GET() {
  const dropDateIso = await getDropDateIso();
  return NextResponse.json({
    dropDateIso,
    dropDateLabel: formatDropDateLabel(dropDateIso),
    amountRupees: await getPreorderAmountRupees(),
  });
}
