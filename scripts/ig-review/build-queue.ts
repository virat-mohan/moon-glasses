// @ts-nocheck
// Builds data/ig-review/queue.json: one entry per live product, captions checked with checkVoice().
// Run: node --experimental-strip-types scripts/ig-review/build-queue.ts
import fs from "node:fs";
import { checkVoice, hasBlock, BRAND_VOICE } from "../../lib/brand-voice.ts";

const src = JSON.parse(fs.readFileSync("scripts/ig-review/products.source.json", "utf8"));
const SLOTS = [8, 14, 20]; // IST hours: 6 hours apart, nothing between 11pm and 7am
const START = new Date("2026-10-07T00:00:00+05:30"); // proposed first day, Virat can change it
const pad = (n: number) => String(n).padStart(2, "0");

const items = src.map((o: any, i: number) => {
  const [model, colour = ""] = o.name.split(" — ");
  const limited = o.collection === "limited";
  const frame = o.series === "Metal" ? "Metal frame" : "Acetate frame";
  const [first, ...rest] = model.split(" ");
  const line1 = `${[first, ...rest.map((w: string) => w.toLowerCase())].join(" ")}, ${colour.toLowerCase()}.`;
  const line2 = `${frame}. ${limited ? "From the limited edit, a small run, no noise." : "From the main edit."}`;
  const line3 = `₹${o.price.toLocaleString("en-IN")}, GST included. Free shipping across India.`;
  const link = o.url;
  const caption = [line1, "", `${line2} ${line3}`, "", link, "", BRAND_VOICE.hashtags.join(" ")].join("\n");
  const day = new Date(START.getTime() + Math.floor(i / 3) * 86400000);
  const ymd = day.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const hour = SLOTS[i % 3];
  const feed_at = `${ymd}T${pad(hour)}:00:00+05:30`;
  const story_at = `${ymd}T${pad(hour)}:15:00+05:30`;
  const findings = checkVoice(caption, "social", { format: "post" });
  const flags: string[] = [];
  if (/^(Aviator)\b/.test(model)) flags.push("No Moonglasses model name on the store (shows only the shape), confirm the name");
  if (hasBlock(findings)) flags.push("Voice check BLOCKED");
  return {
    id: o.slug, position: i + 1, name: o.name, model, colour, price: o.price, collection: limited ? "Limited Series" : "Collection",
    url: link, caption, caption_chars: caption.length,
    slides: [`/ig-review/${o.slug}/slide1.jpg`, `/ig-review/${o.slug}/slide2.jpg`],
    story: `/ig-review/${o.slug}/story.jpg`, story_link: link, story_sticker_label: "Make it yours",
    feed_at, story_at, status: "review",
    voice: { ok: !hasBlock(findings), findings }, flags,
  };
});
fs.writeFileSync("data/ig-review/queue.json", JSON.stringify({ generated_for: "2026-10-05", handle: "@moonglassesonline", slots_ist: "08:00, 14:00, 20:00; story 15 min after the post", items }, null, 1));
const bad = items.filter((x: any) => x.voice.findings.length);
console.log(items.length, "items; max chars", Math.max(...items.map((x: any) => x.caption_chars)), "; with findings", bad.length);
for (const b of bad) console.log(b.id, JSON.stringify(b.voice.findings));
console.log(items[0].caption); console.log(items.filter((x:any)=>x.flags.length).map((x:any)=>x.id+": "+x.flags));
