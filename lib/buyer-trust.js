import crypto from "node:crypto";

export const TRUST_NOTICE_VERSION = "trust-store-2026-09-16";
const NONCE_TTL_SECONDS = 10 * 60;

function secret() {
  const value = process.env.TRUST_NOTICE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("A server signing secret is required for Trust Store notices.");
  return value;
}

function signature(payload) {
  return crypto.createHmac("sha256", secret()).update(`sella:trust-notice:v1:${payload}`).digest("base64url");
}

export function issueTrustNoticeNonce({ userId, storeId }) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    storeId,
    noticeVersion: TRUST_NOTICE_VERSION,
    expiresAt: Math.floor(Date.now() / 1000) + NONCE_TTL_SECONDS,
  })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyTrustNoticeNonce(nonce, { userId, storeId }) {
  if (typeof nonce !== "string" || nonce.length > 2000 || nonce.split(".").length !== 2) return false;
  const [payload, provided] = nonce.split(".");
  if (!payload || !provided) return false;
  const expected = signature(payload);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return false;
  let data;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return false; }
  return data.userId === userId && data.storeId === storeId && data.noticeVersion === TRUST_NOTICE_VERSION && Number(data.expiresAt) >= Math.floor(Date.now() / 1000);
}
