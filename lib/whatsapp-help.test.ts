import { test } from "node:test";
import assert from "node:assert/strict";
import { helpLink, SUPPORT_WHATSAPP_DEFAULT, shortOrderId } from "./whatsapp-help.ts";
import { checkVoice } from "./brand-voice.ts";

test("uses the default number, or a configured one", () => {
  assert.ok(helpLink({ topic: "x" }).startsWith(`https://wa.me/${SUPPORT_WHATSAPP_DEFAULT}?text=`));
  assert.ok(helpLink({ topic: "x", number: "+91 98765 43210" }).startsWith("https://wa.me/919876543210?text="));
  assert.ok(helpLink({ topic: "x", number: "abc" }).startsWith(`https://wa.me/${SUPPORT_WHATSAPP_DEFAULT}?`));
});

test("encodes the prefilled text", () => {
  const url = helpLink({ topic: "payment & checkout", lines: ["Eclipse × 2", "total ₹2,998"] });
  const text = decodeURIComponent(url.split("?text=")[1]);
  assert.ok(!url.split("?text=")[1].includes(" "));
  assert.ok(!url.split("?text=")[1].includes("&"));
  assert.match(text, /payment & checkout\nEclipse × 2\ntotal ₹2,998$/);
});

test("carries only topic and lines, no PII fields", () => {
  const ctx = { topic: "order", lines: [shortOrderId("abcdef12-3456")], phone: "9999999999", email: "a@b.c" };
  const text = decodeURIComponent(helpLink(ctx as never).split("?text=")[1]);
  assert.match(text, /#ABCDEF12/);
  assert.ok(!text.includes("9999999999") && !text.includes("a@b.c"));
});

test("help copy passes the brand voice gate", () => {
  for (const s of [
    "payment not going through? whatsapp us",
    "paid but not confirmed? whatsapp us your screenshot",
    "something not working? whatsapp us",
    "need a hand? whatsapp us",
    "stuck posting or with your code? whatsapp us",
    "code not working? whatsapp us",
    "We couldn't load your orders just now.",
    "this page wandered off.",
    "something slipped on our side.",
    "try again",
    "back to the home page",
  ]) {
    const bad = checkVoice(s, "site").filter((f) => f.level === "block" || f.level === "warn");
    assert.deepEqual(bad, [], `${s}: ${JSON.stringify(bad)}`);
  }
  const mail = checkVoice("Code not working? WhatsApp us", "email").filter((f) => f.level !== "info" && f.rule !== "missing-sign-off"); // sign-off is a whole-email rule
  assert.deepEqual(mail, []);
});
