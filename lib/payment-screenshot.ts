import { getSetting } from "@/lib/settings";

// Reads a UPI payment-confirmation screenshot with Claude's vision and
// returns STRUCTURED fields only, via a forced tool call — never free text
// to parse. This is one input to lib/payment-auto-confirm.ts's matching
// logic; it is never treated as proof of payment by itself.

export type ExtractedPayment = {
  isPaymentScreenshot: boolean;
  amountRupees: number | null;
  utr: string | null;
  payee: string | null;
  paymentDateTime: string | null;
  notes: string;
};

const EXTRACT_TOOL = {
  name: "submit_extracted_payment",
  description: "Submit what you can read from this image about a UPI payment. Use null for anything not clearly visible — never guess.",
  input_schema: {
    type: "object" as const,
    properties: {
      isPaymentScreenshot: {
        type: "boolean",
        description: "True only if this is clearly a UPI/bank payment success screen or receipt — not a product photo, chat, or unrelated image.",
      },
      amountRupees: { type: ["number", "null"], description: "The rupee amount paid, as a plain number (e.g. 1499), or null if not clearly visible." },
      utr: {
        type: ["string", "null"],
        description: "The UPI transaction/reference number (sometimes labelled UTR, Txn ID, Reference No, or UPI transaction ID) — the unique alphanumeric code, or null if not visible.",
      },
      payee: { type: ["string", "null"], description: "The payee name or UPI VPA the payment was made TO, or null if not visible." },
      paymentDateTime: { type: ["string", "null"], description: "The date/time shown on the screenshot, as plain text exactly as shown, or null." },
      notes: { type: "string", description: "One short sentence on anything ambiguous or worth a human double-checking." },
    },
    required: ["isPaymentScreenshot", "amountRupees", "utr", "payee", "paymentDateTime", "notes"],
  },
};

export async function extractPaymentFromScreenshot(imageBase64: string, mediaType: string): Promise<ExtractedPayment> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — add it in /admin/settings first");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            {
              type: "text",
              text: "This image was sent to a business's WhatsApp number as a claimed proof of a UPI payment. Read only what's actually visible — call submit_extracted_payment with your findings. Never infer or guess a value that isn't clearly shown.",
            },
          ],
        },
      ],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "submit_extracted_payment" },
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const toolUse = (data.content ?? []).find((b: { type: string; name?: string }) => b.type === "tool_use" && b.name === "submit_extracted_payment");
  if (!toolUse) throw new Error("Claude did not return submit_extracted_payment");
  return toolUse.input as ExtractedPayment;
}
