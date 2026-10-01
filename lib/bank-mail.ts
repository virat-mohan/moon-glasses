import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getSupabaseServerClient } from "@/lib/supabase";
import { handleBankSms } from "@/lib/bank-sms";

/**
 * Reads the owner's inboxes where the bank sends credit alerts (Yahoo and/or
 * Gmail, each with an app password) over IMAP, and feeds each new HDFC credit
 * email to the same matcher the SMS route uses. Never marks mail as read or
 * moves it: progress is tracked per inbox by IMAP UID, so inboxes are untouched.
 * A payment alert seen twice can't double-confirm: the order is already paid.
 */
export const BANK_MAIL_ACCOUNTS_KEY = "BANK_MAIL_ACCOUNTS";

type Account = {
  address: string;
  appPassword: string;
  lastUid?: number;
  lastCheck?: { at: string; ok: boolean; error?: string; processed?: number };
};

const IMAP_HOSTS: Record<string, string> = {
  "gmail.com": "imap.gmail.com",
  "googlemail.com": "imap.gmail.com",
  "yahoo.com": "imap.mail.yahoo.com",
  "yahoo.co.in": "imap.mail.yahoo.com",
  "ymail.com": "imap.mail.yahoo.com",
  "rocketmail.com": "imap.mail.yahoo.com",
};

export function imapHostFor(address: string) {
  return IMAP_HOSTS[address.split("@")[1]?.toLowerCase() ?? ""] ?? null;
}

export async function readBankMailAccounts(): Promise<Account[]> {
  const { data } = await getSupabaseServerClient().from("app_settings").select("value").eq("key", BANK_MAIL_ACCOUNTS_KEY).maybeSingle();
  try {
    return data?.value ? (JSON.parse(data.value) as Account[]) : [];
  } catch {
    return [];
  }
}

export async function writeBankMailAccounts(accounts: Account[]) {
  await getSupabaseServerClient()
    .from("app_settings")
    .upsert({ key: BANK_MAIL_ACCOUNTS_KEY, value: JSON.stringify(accounts) }, { onConflict: "key" });
}

async function checkAccount(account: Account): Promise<Account> {
  const host = imapHostFor(account.address);
  if (!host) return { ...account, lastCheck: { at: new Date().toISOString(), ok: false, error: "Only Gmail and Yahoo inboxes are supported" } };

  const client = new ImapFlow({ host, port: 993, secure: true, auth: { user: account.address, pass: account.appPassword }, logger: false });
  let processed = 0;
  let lastUid = account.lastUid ?? 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      // Yahoo's IMAP search doesn't do partial sender matches ("hdfcbank" won't
      // find alerts@hdfcbank.bank.in), so list recent mail and check the sender here.
      const recent = ((await client.search({ since }, { uid: true })) || []).filter((u) => u > lastUid);
      const uids: number[] = [];
      if (recent.length) {
        for await (const m of client.fetch(recent, { envelope: true }, { uid: true })) {
          const from = m.envelope?.from?.[0]?.address ?? "";
          if (/hdfcbank/i.test(from) && /alert/i.test(from)) uids.push(m.uid);
          else lastUid = Math.max(lastUid, m.uid);
        }
      }
      for (const uid of uids.sort((a, b) => a - b)) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (msg && msg.source) {
          const parsed = await simpleParser(msg.source);
          const text = parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ") : "");
          if (/credited/i.test(text)) {
            await handleBankSms(text);
            processed++;
          }
        }
        lastUid = Math.max(lastUid, uid);
      }
    } finally {
      lock.release();
    }
    await client.logout();
    return { ...account, lastUid, lastCheck: { at: new Date().toISOString(), ok: true, processed } };
  } catch (err) {
    try {
      await client.logout();
    } catch {
      // already closed
    }
    const error = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    return { ...account, lastUid, lastCheck: { at: new Date().toISOString(), ok: false, error } };
  }
}

export async function checkBankMail() {
  const accounts = await readBankMailAccounts();
  if (!accounts.length) return { status: "not_configured" as const };
  const updated: Account[] = [];
  for (const a of accounts) updated.push(await checkAccount(a));
  // Re-read before writing so a mailbox added mid-check isn't lost.
  const latest = await readBankMailAccounts();
  await writeBankMailAccounts(latest.map((a) => updated.find((u) => u.address === a.address && u.appPassword === a.appPassword) ?? a));
  return { status: "ok" as const, accounts: updated.map((a) => ({ address: a.address, lastCheck: a.lastCheck })) };
}
