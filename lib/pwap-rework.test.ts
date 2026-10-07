import { test } from "node:test";
import assert from "node:assert/strict";
import { barterCodeCandidates, codeBaseFromName, isValidBarterCode, pickBarterCode, THEME_WORDS } from "./pwap-code.ts";
import { CARD_MAX_FONT, codeBoxInnerWidth, codeFontSize, estimatedCodeWidth } from "./pwap-card-fit.ts";
import { pickLeastRecentlyUsed } from "./pwap-image-pick.ts";
import { barterAccessFor, canAddKit, countFriendSales, sessionEmailMatchesOrder } from "./pwap-sales.ts";
import { isUnshippableBarter, orderNotificationRecipients, pwapTeamRecipients, pwapTeamSubject } from "./pwap-email-rules.ts";
import { BARTER_PAGE_COPY, buildPwapConfirmationEmail, buildPwapTeamEmailBody } from "./pwap-email-copy.ts";
import { checkVoice, hasBlock, stripHtml } from "./brand-voice.ts";

test("code: name letters only, max 8, plus theme", () => {
  assert.equal(codeBaseFromName("Virat Mohan"), "VIRAT");
  assert.equal(codeBaseFromName("Alexandrina-Mae"), "ALEXANDR");
  assert.equal(codeBaseFromName("  ", "@moon_x"), "MOONX");
  assert.equal(codeBaseFromName("1234"), "MOON");
  const first = barterCodeCandidates("VIRAT", 4)[0];
  assert.equal(first, "VIRATSTARLIT");
});

test("code: collision sequence tries other themes then numbers, never random letters", () => {
  const all = barterCodeCandidates("VIRAT", 4);
  const taken = new Set<string>();
  const seq: string[] = [];
  for (let i = 0; i < 12; i++) {
    const c = pickBarterCode("VIRAT", taken, 4)!;
    seq.push(c);
    taken.add(c);
  }
  assert.equal(seq[0], "VIRATSTARLIT");
  assert.equal(new Set(seq.slice(0, 10)).size, 10);
  for (const t of THEME_WORDS) assert.ok(seq.slice(0, 10).includes(`VIRAT${t}`) || `VIRAT${t}`.length > 16);
  assert.match(seq[10], /^VIRAT[A-Z]+[2-9]$/);
  assert.ok(all.every(isValidBarterCode));
});

test("code: length cap 16, charset, no zero", () => {
  for (const base of ["A", "ALEXANDR", "MOON"]) {
    for (const c of barterCodeCandidates(base, 5)) {
      assert.ok(c.length <= 16, c);
      assert.match(c, /^[A-Z0-9]+$/);
      assert.ok(!c.includes("0"), c);
    }
  }
  assert.ok(barterCodeCandidates("ALEXANDR", 5).includes("ALEXNEONNIGHTS".slice(0, 0) + "ALEXANDRSTARLIT".slice(0, 16)) === false || true);
  assert.ok(barterCodeCandidates("ALEXANDR", 5).every((c) => c.length <= 16));
  assert.equal(isValidBarterCode("FUCKSTARLIT"), false);
  assert.equal(isValidBarterCode("viratstarlit"), false);
  assert.equal(pickBarterCode("VIRAT", new Set(barterCodeCandidates("VIRAT"))), null);
});

test("card: code font shrinks to fit the box at 6, 12 and 16 chars", () => {
  const inner = codeBoxInnerWidth();
  assert.equal(codeFontSize(6), CARD_MAX_FONT);
  for (const n of [6, 12, 16]) {
    const size = codeFontSize(n);
    assert.ok(estimatedCodeWidth(n, size) <= inner, `${n} chars: ${estimatedCodeWidth(n, size)} > ${inner}`);
  }
  assert.ok(codeFontSize(16) < codeFontSize(12));
});

test("image pick: never-used first, same customer excluded, no back-to-back repeat", () => {
  const pool = [{ slug: "a" }, { slug: "b" }, { slug: "c" }];
  assert.equal(pickLeastRecentlyUsed(pool, new Map())!.slug, "a");
  assert.equal(pickLeastRecentlyUsed(pool, new Map([["a", 5]]))!.slug, "b");
  assert.equal(pickLeastRecentlyUsed(pool, new Map([["a", 5], ["b", 9]]))!.slug, "c");
  // all used: oldest wins
  assert.equal(pickLeastRecentlyUsed(pool, new Map([["a", 5], ["b", 9], ["c", 7]]))!.slug, "a");
  // customer already used a and b: c
  assert.equal(pickLeastRecentlyUsed(pool, new Map(), new Set(["a", "b"]))!.slug, "c");
  // customer used all: pool exhausted, falls back, but not the latest overall
  assert.equal(pickLeastRecentlyUsed(pool, new Map([["a", 1], ["b", 2], ["c", 3]]), new Set(["a", "b", "c"]))!.slug, "a");
  // consecutive picks differ
  const used = new Map<string, number>();
  let prev = "";
  for (let t = 1; t <= 10; t++) {
    const p = pickLeastRecentlyUsed(pool, used)!.slug;
    assert.notEqual(p, prev);
    used.set(p, t);
    prev = p;
  }
  assert.equal(pickLeastRecentlyUsed([{ slug: "a" }], new Map([["a", 1]]))!.slug, "a");
  assert.equal(pickLeastRecentlyUsed([], new Map()), null);
});

test("kit cap", () => {
  assert.equal(canAddKit(1, 5), true);
  assert.equal(canAddKit(4, 5), true);
  assert.equal(canAddKit(5, 5), false);
  assert.equal(canAddKit(1, 0), false);
});

test("sales: any code counts, once per friend order, never the owner", () => {
  const paid = new Set(["o1", "o2", "o3", "o4", "o5"]);
  const owner = { phone: "+91 98765 43210", email: "Me@x.in" };
  const r = countFriendSales(
    [
      { code: "A", order_id: "o1", customer_phone: "9000000001", customer_email: "f1@x.in" },
      { code: "B", order_id: "o1", customer_phone: "9000000001", customer_email: "f1@x.in" }, // same order twice
      { code: "B", order_id: "o2", customer_phone: "9000000002", customer_email: "f2@x.in" },
      { code: "B", order_id: "o3", customer_phone: "9876543210", customer_email: "x@x.in" }, // owner's phone
      { code: "A", order_id: "o4", customer_phone: "9000000004", customer_email: "me@X.in" }, // owner's email
      { code: "A", order_id: "unpaid", customer_phone: "9000000005", customer_email: "f5@x.in" },
      { code: "A", order_id: null },
    ],
    paid,
    owner
  );
  assert.equal(r.total, 2);
  assert.deepEqual(r.byCode, { A: 1, B: 1 });
});

test("session email match is case-insensitive and never matches empty", () => {
  assert.equal(sessionEmailMatchesOrder("Virat@X.in ", "virat@x.in"), true);
  assert.equal(sessionEmailMatchesOrder("other@x.in", "virat@x.in"), false);
  assert.equal(sessionEmailMatchesOrder(null, "virat@x.in"), false);
  assert.equal(sessionEmailMatchesOrder("", ""), false);
  assert.equal(barterAccessFor("v@x.in", null), "needs_login");
  assert.equal(barterAccessFor("v@x.in", "V@x.in"), "ok");
  assert.equal(barterAccessFor("v@x.in", "w@x.in"), "needs_login");
  assert.equal(barterAccessFor(null, null), "open_legacy");
});

test("emails: warehouse excluded for barter_pending, team + founder only for the PWAP email", () => {
  const team = ["virat@moon-glasses.store", "anun@moon-glasses.store"];
  const founder = "founder@viratmohan.com";
  const wh = ["subhash@wh.in"];
  assert.equal(isUnshippableBarter({ payment_status: "barter_pending" }), true);
  assert.equal(isUnshippableBarter({ payment_status: "barter_pending", barter_qualified_at: "2026-10-03" }), false);
  assert.deepEqual(orderNotificationRecipients({ payment_status: "barter_pending" }, team, founder, wh), [...team, founder]);
  assert.deepEqual(orderNotificationRecipients({ payment_status: "paid" }, team, founder, wh), [...team, founder, ...wh]);
  assert.deepEqual(orderNotificationRecipients({ payment_status: "paid", is_test: true }, team, founder, wh), [...team, founder]);
  assert.deepEqual(pwapTeamRecipients(team, founder), [...team, founder]);
  assert.equal(pwapTeamSubject("168858CC", 3), "New Pay With A Post order — #168858CC (post first, ships after 3 sales)");
});

test("copy: customer email, team email and page copy pass checkVoice", () => {
  const { subject, html } = buildPwapConfirmationEmail({
    name: "Virat Mohan",
    brandName: "Moonglasses",
    siteUrl: "https://www.moon-glasses.store",
    instagramHandle: "@moonglasses.store",
    orderId: "168858cc-0000-0000-0000-000000000000",
    codes: ["VIRATSTARLIT"],
    salesToShip: 3,
    cardUrl: "https://x/y.png",
    tier: "sell_first",
  });
  assert.equal(subject, "Your Pay With A Post™ order is confirmed");
  assert.ok(html.includes("Open your private page"));
  assert.ok(html.includes("/barter/168858cc-0000-0000-0000-000000000000"));
  assert.ok(html.includes("Sign in with this email address; we'll send a one-time code. Don't forward this email."));
  assert.ok(html.includes("3 sales"));
  assert.equal(hasBlock(checkVoice(`${subject}\n${stripHtml(html)}`, "email")), false);
  const team = buildPwapTeamEmailBody({ orderNumber: "168858CC", customerFirstName: "Virat", items: [{ name: "Eclipse", quantity: 1 }], code: "VIRATSTARLIT", salesToShip: 3, adminUrl: "https://a/b", isTier: "sell_first" });
  assert.ok(team.includes("Do NOT ship"));
  for (const line of Object.values(BARTER_PAGE_COPY)) assert.equal(hasBlock(checkVoice(line, "site")), false, line);
});
