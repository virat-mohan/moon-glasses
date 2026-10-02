import { test } from "node:test";
import assert from "node:assert/strict";
import { canReplyFreeForm, statusesFromWebhook } from "./whatsapp-window.ts";

const now = new Date("2026-10-02T12:00:00Z");

test("free text allowed within 24h of the last inbound message", () => {
  assert.equal(canReplyFreeForm([{ direction: "inbound", created_at: "2026-10-02T00:00:00Z" }], now), true);
});

test("template only after 24h, even if we replied since", () => {
  assert.equal(
    canReplyFreeForm(
      [
        { direction: "inbound", created_at: "2026-09-30T10:00:00Z" },
        { direction: "outbound", created_at: "2026-10-02T11:00:00Z" },
      ],
      now
    ),
    false
  );
});

test("no inbound message means no free text", () => {
  assert.equal(canReplyFreeForm([], now), false);
});

test("reads Cloud-style statuses, including a JSON string", () => {
  assert.deepEqual(statusesFromWebhook({ statuses: JSON.stringify([{ id: "w1", status: "delivered" }]) }), [
    { providerMessageId: "w1", status: "delivered" },
  ]);
  assert.deepEqual(statusesFromWebhook({ statuses: [{ id: "w2", status: "read" }, { id: "w3", status: "failed" }] }), [
    { providerMessageId: "w2", status: "read" },
    { providerMessageId: "w3", status: "failed" },
  ]);
});

test("reads a flat MSG91 report, ignores inbound messages", () => {
  assert.deepEqual(statusesFromWebhook({ uuid: "u1", eventName: "undelivered" }), [{ providerMessageId: "u1", status: "failed" }]);
  assert.deepEqual(statusesFromWebhook({ messages: "[]", from: "91x", text: "hi" }), []);
});
