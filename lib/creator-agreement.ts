import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getBrandProfile } from "@/lib/brand";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { Creator } from "@/lib/creators";

const AGREEMENT_VERSION = "v1";

/**
 * Plain-language creator gifting agreement, dynamically populated per
 * creator. Deliberately a single fixed template rather than a
 * campaign-configurable template engine — this program has one flow (product
 * gifting for a tagged/collab post), so a templating system would be
 * unused flexibility. Returned as HTML for on-screen review AND is the exact
 * string snapshotted into creator_agreements.agreement_html at signing time.
 */
export function renderAgreementHtml(creator: Pick<Creator, "name" | "instagram_handle" | "product_name">, brandName: string) {
  const product = creator.product_name?.trim() || "the selected product";
  return `
    <h2>${brandName} Creator Collaboration Agreement</h2>
    <p><strong>Creator:</strong> ${creator.name} (@${creator.instagram_handle.replace(/^@/, "")})</p>
    <p><strong>Brand:</strong> ${brandName}</p>
    <p><strong>Product:</strong> ${product}, provided to the creator at no cost.</p>
    <h3>What the creator agrees to</h3>
    <ul>
      <li>Wear/use the product genuinely before posting about it.</li>
      <li>Post at least one piece of content (feed post, Reel, or Story) featuring the product within 14 days of delivery.</li>
      <li>Tag ${brandName}'s official Instagram account in the post and, where the platform supports it, add ${brandName} as a collaborator.</li>
      <li>Clearly disclose the gifted relationship where required by applicable advertising/influencer disclosure guidelines (e.g. "#gifted" or a paid-partnership label where applicable).</li>
      <li>Keep the content posted on their public profile for at least 60 days.</li>
    </ul>
    <h3>What the creator grants ${brandName}</h3>
    <ul>
      <li>The right to reshare, repost, or feature the creator's tagged/collaborator content on ${brandName}'s own Instagram account and website, with credit to the creator.</li>
      <li>This usage right is organic (non-paid) only, for the content described above, and lasts for 12 months from the post date unless otherwise agreed in writing.</li>
    </ul>
    <h3>Terms</h3>
    <ul>
      <li>This agreement is compensated entirely by the product provided — no cash payment is included unless separately agreed.</li>
      <li>${brandName} may end this collaboration and request the product be returned if no content is posted within 30 days of delivery with no communication from the creator.</li>
      <li>Nothing here restricts the creator from working with other brands.</li>
    </ul>
    <p>By typing your full name below and submitting, you confirm you have read and agree to the terms above.</p>
  `.trim();
}

export async function getOrCreateDraftAgreement(creator: Creator) {
  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("creator_agreements")
    .select("*")
    .eq("creator_id", creator.id)
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (existing && !existing.signed_at) return existing;
  if (existing?.signed_at) return existing;

  const brand = await getBrandProfile();
  const agreementHtml = renderAgreementHtml(creator, brand.brandName);
  const { data, error } = await supabase
    .from("creator_agreements")
    .insert({ creator_id: creator.id, version: AGREEMENT_VERSION, agreement_html: agreementHtml })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Strips the light HTML markup from renderAgreementHtml down to plain paragraphs/bullets for the PDF record — the PDF is the legal artifact, the HTML is just for on-screen review. */
function htmlToPlainLines(html: string): string[] {
  return html
    .replace(/<li>/g, "• ")
    .replace(/<\/li>/g, "")
    .replace(/<h[23]>/g, "\n")
    .replace(/<\/h[23]>/g, "\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Builds a simple signed-record PDF: the agreement text plus the signature
 * block (typed name, IP, timestamp). This IS the e-signature artifact — no
 * third-party vendor, deliberately simple for a fast-moving single-brand
 * gifting program. Mirrors the plain draw-text pattern already used for
 * shipping labels in lib/label-print.ts.
 */
export async function generateSignedAgreementPdf(params: {
  agreementHtml: string;
  creatorName: string;
  instagramHandle: string;
  signedName: string;
  signedAt: string;
  signerIp: string;
  brandName: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4 portrait
  const pageHeight = 841.89;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  const bodySize = 11;
  const lineHeight = 16;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  page.drawText(`${params.brandName} — Creator Collaboration Agreement`, {
    x: margin,
    y,
    size: 15,
    font: boldFont,
    color: rgb(0.06, 0.09, 0.13),
  });
  y -= lineHeight * 2;

  for (const rawLine of htmlToPlainLines(params.agreementHtml)) {
    const isHeading = rawLine.length < 60 && /^[A-Z][a-z]/.test(rawLine) && !rawLine.startsWith("•");
    const useFont = isHeading ? boldFont : font;
    const wrapped = wrapText(rawLine, useFont, bodySize, maxWidth);
    for (const line of wrapped) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: margin, y, size: bodySize, font: useFont, color: rgb(0.1, 0.1, 0.1) });
      y -= lineHeight;
    }
    y -= 4;
  }

  ensureSpace(lineHeight * 6);
  y -= lineHeight;
  page.drawText("Signed", { x: margin, y, size: 13, font: boldFont, color: rgb(0.06, 0.09, 0.13) });
  y -= lineHeight * 1.5;
  const signatureLines = [
    `Signed by: ${params.signedName}`,
    `Creator account: @${params.instagramHandle.replace(/^@/, "")}`,
    `Signed at: ${params.signedAt}`,
    `IP address: ${params.signerIp}`,
  ];
  for (const line of signatureLines) {
    ensureSpace(lineHeight);
    page.drawText(line, { x: margin, y, size: bodySize, font, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight;
  }

  return doc.save();
}

export async function uploadSignedAgreementPdf(creatorId: string, bytes: Uint8Array): Promise<string> {
  const supabase = getSupabaseServerClient();
  const path = `creator-agreements/${creatorId}-${Date.now()}.pdf`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
