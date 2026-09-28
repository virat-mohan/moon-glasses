import crypto from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";

// Admin credentials live in app_settings under keys deliberately NOT in
// lib/settings.ts's SETTINGS_KEYS, so the generic /api/admin/settings
// endpoint can never read or overwrite them.
const PASSWORD_HASH_KEY = "ADMIN_PASSWORD_HASH";
const SESSION_SECRET_KEY = "ADMIN_SESSION_SECRET";
const SETUP_CODE_HASH_KEY = "ADMIN_SETUP_CODE_HASH";
const TEAM_KEY = "ADMIN_TEAM";
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

async function readKey(key: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

async function writeKey(key: string, value: string) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function deleteKey(key: string) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("app_settings").delete().eq("key", key);
  if (error) throw error;
}

function hashSecret(value: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(value, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifySecret(value: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(value, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function sign(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export type AdminAuthMode = "login" | "setup" | "unconfigured";

/** login = a password exists; setup = no password yet but a one-time setup code was issued; unconfigured = neither (admin stays locked). */
export async function getAdminAuthMode(): Promise<AdminAuthMode> {
  if (process.env.ADMIN_PASSWORD || (await readKey(PASSWORD_HASH_KEY))) return "login";
  if (await readKey(SETUP_CODE_HASH_KEY)) return "setup";
  return "unconfigured";
}

export type AdminRole = "owner" | "team";

type TeamState = {
  members: { email: string; hash: string; addedAt: string }[];
  invites: { email: string; codeHash: string; expiresAt: string }[];
};

async function readTeam(): Promise<TeamState> {
  const raw = await readKey(TEAM_KEY);
  const parsed = raw ? (JSON.parse(raw) as Partial<TeamState>) : {};
  return { members: parsed.members ?? [], invites: parsed.invites ?? [] };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Which role a password belongs to, or null. The owner password wins over any team password. */
export async function roleForPassword(password: string): Promise<AdminRole | null> {
  if (await checkOwnerPassword(password)) return "owner";
  const team = await readTeam();
  return team.members.some((m) => verifySecret(password, m.hash)) ? "team" : null;
}

/** Team members get their own password through a one-time link instead of sharing the owner's. Returns the plain code once. */
export async function inviteTeamMember(email: string) {
  const address = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("Enter a valid email");
  const code = crypto.randomBytes(18).toString("base64url");
  const team = await readTeam();
  team.invites = team.invites.filter((i) => i.email !== address);
  team.invites.push({ email: address, codeHash: hashSecret(code), expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString() });
  await writeKey(TEAM_KEY, JSON.stringify(team));
  return code;
}

export async function acceptTeamInvite(email: string, code: string, password: string) {
  const address = normalizeEmail(email);
  const team = await readTeam();
  const invite = team.invites.find((i) => i.email === address);
  if (!invite || new Date(invite.expiresAt) < new Date() || !verifySecret(code.trim(), invite.codeHash)) {
    throw new Error("This invite link is invalid or has expired. Ask for a new one.");
  }
  if (password.length < 10) throw new Error("Use at least 10 characters");
  team.invites = team.invites.filter((i) => i.email !== address);
  team.members = team.members.filter((m) => m.email !== address);
  team.members.push({ email: address, hash: hashSecret(password), addedAt: new Date().toISOString() });
  await writeKey(TEAM_KEY, JSON.stringify(team));
}

export async function listTeam() {
  const team = await readTeam();
  return {
    members: team.members.map((m) => ({ email: m.email, addedAt: m.addedAt })),
    invites: team.invites
      .filter((i) => new Date(i.expiresAt) > new Date())
      .map((i) => ({ email: i.email, expiresAt: i.expiresAt })),
  };
}

/** Removes a member or pending invite. Rotates the session secret so a removed member is signed out at once (everyone else signs in again). */
export async function removeTeamMember(email: string) {
  const address = normalizeEmail(email);
  const team = await readTeam();
  team.members = team.members.filter((m) => m.email !== address);
  team.invites = team.invites.filter((i) => i.email !== address);
  await writeKey(TEAM_KEY, JSON.stringify(team));
  await writeKey(SESSION_SECRET_KEY, crypto.randomBytes(32).toString("hex"));
}

export async function checkOwnerPassword(password: string) {
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword) {
    const a = Buffer.from(password);
    const b = Buffer.from(envPassword);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  const stored = await readKey(PASSWORD_HASH_KEY);
  return stored ? verifySecret(password, stored) : false;
}

async function getOrCreateSessionSecret() {
  const existing = await readKey(SESSION_SECRET_KEY);
  if (existing) return existing;
  const secret = crypto.randomBytes(32).toString("hex");
  await writeKey(SESSION_SECRET_KEY, secret);
  return secret;
}

/** Stateless signed session: "<expiry>.<hmac>". Rotating the secret (on password change) invalidates every session. */
export async function createAdminSessionValue(role: AdminRole = "owner") {
  const secret = await getOrCreateSessionSecret();
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS}-${role}`;
  return { value: `${payload}.${sign(secret, payload)}`, maxAge: SESSION_TTL_SECONDS };
}

/** The signed-in role, or null. Sessions minted before roles existed ("<expiry>.<mac>") count as owner. */
export async function getAdminSessionRole(value: string | undefined): Promise<AdminRole | null> {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac || !/^[0-9a-f]{64}$/.test(mac)) return null;
  const [expiry, role = "owner"] = payload.split("-");
  if (Number(expiry) < Date.now() / 1000) return null;
  if (role !== "owner" && role !== "team") return null;
  const secret = await readKey(SESSION_SECRET_KEY);
  if (!secret) return null;
  const expected = Buffer.from(sign(secret, payload), "hex");
  return crypto.timingSafeEqual(Buffer.from(mac, "hex"), expected) ? role : null;
}

export async function isValidAdminSession(value: string | undefined) {
  return (await getAdminSessionRole(value)) !== null;
}

/** First-run only: exchanges the one-time setup code for the real password, then burns the code. */
export async function completeAdminSetup(setupCode: string, password: string) {
  if ((await getAdminAuthMode()) !== "setup") throw new Error("Admin is already set up");
  const codeHash = await readKey(SETUP_CODE_HASH_KEY);
  if (!codeHash || !verifySecret(setupCode.trim(), codeHash)) throw new Error("Wrong setup code");
  await setAdminPassword(password);
  await deleteKey(SETUP_CODE_HASH_KEY);
}

export async function setAdminPassword(password: string) {
  if (password.length < 10) throw new Error("Use at least 10 characters");
  await writeKey(PASSWORD_HASH_KEY, hashSecret(password));
  // New secret = every existing session (including a stolen cookie) is logged out.
  await writeKey(SESSION_SECRET_KEY, crypto.randomBytes(32).toString("hex"));
}

/** Issues a fresh one-time setup code (only meaningful while no password exists). Returns the plain code once. */
export async function issueAdminSetupCode() {
  const code = crypto.randomBytes(9).toString("base64url");
  await writeKey(SETUP_CODE_HASH_KEY, hashSecret(code));
  return code;
}
