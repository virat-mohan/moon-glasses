import { PDFDocument, degrees, type PDFEmbeddedPage } from "pdf-lib";
import { generateShiprocketLabelsBatch } from "@/lib/shiprocket";
import { getSupabaseServerClient } from "@/lib/supabase";

// Landscape A4.
const A4_WIDTH = 841.89;
const A4_HEIGHT = 595.28;

/**
 * Rotates the label 90° into each half-page slot and scales it to fill that
 * slot edge to edge (no margin) — the label itself is portrait-shaped, so
 * rotating it 90° lets it fill a short, wide landscape slot far more fully
 * than laying it out unrotated ever could.
 *
 * pdf-lib's drawPage rotates the content around the (x, y) anchor rather
 * than the box center, so with rotate=90° a box drawn with local
 * {width, height} actually lands on the page spanning
 * x: [x - height, x], y: [y, y + width] — i.e. the on-page footprint has
 * width = local height and height = local width. The math below picks a
 * scale/local-size pair so that on-page footprint exactly fills the slot,
 * then solves x/y backwards from that footprint's top-left corner.
 */
function drawDuplicatedPage(outDoc: PDFDocument, embedded: PDFEmbeddedPage) {
  const page = outDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  const halfHeight = A4_HEIGHT / 2;
  const slotWidth = A4_WIDTH;
  const slotHeight = halfHeight;

  // Swapped vs. an unrotated fit, since the rendered footprint is transposed.
  const scale = Math.min(slotWidth / embedded.height, slotHeight / embedded.width);
  const drawWidth = embedded.width * scale;
  const drawHeight = embedded.height * scale;
  const footprintWidth = drawHeight;
  const footprintHeight = drawWidth;

  for (const slotBottom of [0, halfHeight]) {
    const footprintX = (slotWidth - footprintWidth) / 2;
    const footprintY = slotBottom + (slotHeight - footprintHeight) / 2;
    const x = footprintX + footprintWidth;
    const y = footprintY;
    page.drawPage(embedded, { x, y, width: drawWidth, height: drawHeight, rotate: degrees(90) });
  }

  // A faint cut line across the middle, between the two identical copies.
  page.drawLine({
    start: { x: 0, y: halfHeight },
    end: { x: A4_WIDTH, y: halfHeight },
    thickness: 0.5,
    dashArray: [4, 4],
    opacity: 0.4,
  });
}

/**
 * Fetches each given order's Shiprocket shipping label — in ONE batch call
 * for all of them together (see generateShiprocketLabelsBatch: calling it
 * once per order separately can return the same cached label_url for each,
 * which is a real trap here) — and builds one landscape A4 page PER
 * shipment, with that shipment's own label printed TWICE stacked top/bottom
 * (two copies to cut apart: one for the parcel, one to keep). A single-shipment
 * call (the normal ship-time case) returns a one-page PDF with two copies
 * of that one label.
 */
export async function buildDuplicatedLabelSheet(shipmentIds: string[]): Promise<Uint8Array> {
  if (shipmentIds.length === 0) {
    throw new Error("No Shiprocket shipment ids given");
  }

  const batchLabelUrl = await generateShiprocketLabelsBatch(shipmentIds);
  if (!batchLabelUrl) {
    throw new Error("Shiprocket did not return a label for the given shipment(s)");
  }

  const res = await fetch(batchLabelUrl);
  if (!res.ok) throw new Error(`Could not fetch the generated label PDF: ${res.status}`);
  const srcBytes = await res.arrayBuffer();
  const srcDoc = await PDFDocument.load(srcBytes);
  const pageCount = srcDoc.getPageCount();
  if (pageCount === 0) throw new Error("The generated label PDF had no pages");

  const outDoc = await PDFDocument.create();
  const embeddedPages = await outDoc.embedPdf(srcDoc, Array.from({ length: pageCount }, (_, i) => i));
  for (const embedded of embeddedPages) {
    drawDuplicatedPage(outDoc, embedded);
  }

  return outDoc.save();
}

/** Builds and uploads a single shipment's duplicated (2-copy) label sheet, returning its public URL — for attaching to the ship-time warehouse email. */
export async function buildAndUploadDuplicatedLabel(shipmentId: string, orderId: string): Promise<string | null> {
  try {
    const bytes = await buildDuplicatedLabelSheet([shipmentId]);
    const supabase = getSupabaseServerClient();
    const path = `labels/${orderId}-${Date.now()}.pdf`;
    const { error } = await supabase.storage
      .from("ad-creatives")
      .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("Failed to build/upload duplicated label sheet", orderId, err);
    return null;
  }
}
