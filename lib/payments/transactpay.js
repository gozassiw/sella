import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const ENV_BASE_URL = process.env.TRANSACTPAY_BASE_URL || "https://payment-api-service.transactpay.ai";
const SETTING_KEY = "transactpay_credentials";

function encryptionKey() {
  return crypto.createHash("sha256").update(process.env.ADMIN_SETTINGS_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "sella-admin-settings").digest();
}

function encrypt(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decrypt(value) {
  if (!value) return "";
  if (!String(value).startsWith("v1:")) return String(value);
  try {
    const [, ivText, tagText, encryptedText] = String(value).split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

async function storedConfig() {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("app_settings").select("value,updated_at").eq("key", SETTING_KEY).maybeSingle();
    const value = data?.value || {};
    return {
      baseUrl: value.baseUrl || "",
      publicKey: decrypt(value.publicKey),
      secretKey: decrypt(value.secretKey),
      encryptionKey: decrypt(value.encryptionKey),
      updatedAt: data?.updated_at || null,
    };
  } catch {
    return null;
  }
}

export async function getTransactPayConfig() {
  const stored = await storedConfig();
  return {
    baseUrl: stored?.baseUrl || ENV_BASE_URL,
    publicKey: stored?.publicKey || process.env.TRANSACTPAY_PUBLIC_KEY || "",
    secretKey: stored?.secretKey || process.env.TRANSACTPAY_SECRET_KEY || "",
    encryptionKey: stored?.encryptionKey || process.env.TRANSACTPAY_ENCRYPTION_KEY || "",
    updatedAt: stored?.updatedAt || null,
  };
}

export async function saveTransactPayConfig({ baseUrl, publicKey, secretKey, encryptionKey: rsaKey }) {
  const admin = createAdminClient();
  const current = await storedConfig();
  const value = {
    baseUrl: String(baseUrl || ENV_BASE_URL).trim(),
    publicKey: encrypt(publicKey) || current?.publicKey || null,
    secretKey: encrypt(secretKey) || current?.secretKey || null,
    encryptionKey: encrypt(rsaKey) || current?.encryptionKey || null,
  };
  const { error } = await admin.from("app_settings").upsert({ key: SETTING_KEY, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

function encryptPayload(payload, key) {
  const raw = JSON.stringify(payload);
  let pem = key;
  if (!key.includes("BEGIN")) {
    const decoded = Buffer.from(key, "base64").toString("utf8");
    const xml = decoded.split("!").pop();
    const modulus = xml.match(/<Modulus>([^<]+)<\/Modulus>/)?.[1];
    const exponent = xml.match(/<Exponent>([^<]+)<\/Exponent>/)?.[1];
    if (!modulus || !exponent) throw new Error("Invalid TransactPay encryption key");
    const jwk = { kty: "RSA", n: Buffer.from(modulus, "base64").toString("base64url"), e: Buffer.from(exponent, "base64").toString("base64url") };
    pem = crypto.createPublicKey({ key: jwk, format: "jwk" });
  }
  return crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(raw)).toString("base64");
}

async function transactpayRequest(path, payload) {
  const config = await getTransactPayConfig();
  if (!config.publicKey || !config.encryptionKey) throw new Error("TransactPay public key and encryption key are not configured for virtual accounts");
  const response = await fetch(`${config.baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", "api-key": config.publicKey, ...(config.secretKey ? { "secret-key": config.secretKey } : {}), encryption: "RSA" }, body: JSON.stringify({ data: encryptPayload(payload, config.encryptionKey) }), cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status === false) throw new Error(body.message || `TransactPay request failed (${response.status})`);
  return body;
}

export async function createVirtualAccount({ alias, reference, narration }) { return transactpayRequest("/payment/virtual-account/generate", { Alias: alias, Reference: reference, Narration: narration }); }
export async function getPaymentTransactionDetails(sessionId) {
  const config = await getTransactPayConfig();
  if (!config.publicKey) throw new Error("TransactPay public key is not configured");
  const response = await fetch(`${config.baseUrl}/payment/transaction-details/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: { "api-key": config.publicKey, ...(config.secretKey ? { "secret-key": config.secretKey } : {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `TransactPay status check failed (${response.status})`);
  return body;
}
export async function providerConfigured() { const config = await getTransactPayConfig(); return Boolean(config.publicKey && config.encryptionKey); }
export async function paymentConfigStatus() { const config = await getTransactPayConfig(); return { baseUrl: config.baseUrl, publicKey: Boolean(config.publicKey), secretKey: Boolean(config.secretKey), encryptionKey: Boolean(config.encryptionKey), updatedAt: config.updatedAt }; }
