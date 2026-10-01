import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getSupabaseServerClient } from "@/lib/supabase";
import { handleBankSms } from "@/lib/bank-sms";

/**
 * Reads the owner's Yahoo inbox (where HDFC sends credit alerts) over IMAP
 * with a Yahoo app password, and feeds each new HDFC credit email to the same
 * matcher the SMS route uses. Never marks mail as read or moves it: progress
 * is tracked by IMAP UID in app_settings so the owner's inbox is untouched.
 */
export const BANK_MAIL_KEYS = {
  address: "BANK_MAIL_ADDRESS",
  appPassword: "BANK_MAIL_APP_PASSWORD",
  lastUid: "BANK_MAIL_LAST_UID",
  lastCheck: "BANK_MAIL_LAST_CHECK",
} as const;

async function readSettings(keys: string[]) {
  const { data } = await getSupabaseServerClient().from("app_settings").select("key, value").in("key", keys);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value as string]));
}

async function writeSetting(key: string, value: string) {
  await getSupabaseServerClient().from("app_settings").upsert({ key, value }, { onConflict: "key" });
}

export async function checkBankMail() {
  const s = await readSettings(Object.values(BANK_MAIL_KEYS));
  const address = s[BANK_MAIL_KEYS.address];
  const password = s[BANK_MAIL_KEYS.appPassword];
  if (!address || !password) return { status: "not_configured" as const };

  const client = new ImapFlow({
    host: "imap.mail.yahoo.com",
    port: 993,
    secure: true,
    auth: { user: address, pass: password },
    logger: false,
  });

  const results: { uid: number; status: string }[] = [];
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const lastUid = Number(s[BANK_MAIL_KEYS.lastUid] ?? 0);
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const uids = ((await client.search({ since, from: "hdfcbank" }, { uid: true })) || []).filter((u) => u > lastUid);
      let maxUid = lastUid;
      for (const uid of uids.sort((a, b) => a - b)) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (msg && msg.source) {
          const parsed = await simpleParser(msg.source);
          const text = parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ") : "");
          if (/credited/i.test(text)) {
            const r = await handleBankSms(text);
            results.push({ uid, status: r.status });
          }
        }
        maxUid = Math.max(maxUid, uid);
      }
      if (maxUid > lastUid) await writeSetting(BANK_MAIL_KEYS.lastUid, String(maxUid));
    } finally {
      lock.release();
    }
    await client.logout();
    await writeSetting(BANK_MAIL_KEYS.lastCheck, JSON.stringify({ at: new Date().toISOString(), ok: true, processed: results.length }));
    return { status: "ok" as const, results };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeSetting(BANK_MAIL_KEYS.lastCheck, JSON.stringify({ at: new Date().toISOString(), ok: false, error: message.slice(0, 200) }));
    try {
      await client.logout();
    } catch {
      // already closed
    }
    return { status: "error" as const, error: message };
  }
}
