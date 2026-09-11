import crypto from "node:crypto";

const BASE_URL = process.env.TRANSACTPAY_BASE_URL || "https://payment-api-service.transactpay.ai";

function getConfig() {
  const publicKey = process.env.TRANSACTPAY_PUBLIC_KEY;
  const encryptionKey = process.env.TRANSACTPAY_ENCRYPTION_KEY || publicKey;
  if (!publicKey || !encryptionKey) {
    throw new Error("TransactPay public/encryption key is not configured");
  }
  return { publicKey, encryptionKey };
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
    const jwk = {
      kty: "RSA",
      n: Buffer.from(modulus, "base64").toString("base64url"),
      e: Buffer.from(exponent, "base64").toString("base64url"),
    };
    pem = crypto.createPublicKey({ key: jwk, format: "jwk" });
  }
  return crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(raw)).toString("base64");
}

async function transactpayRequest(path, payload) {
  const { publicKey, encryptionKey } = getConfig();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "api-key": publicKey, encryption: "RSA" },
    body: JSON.stringify({ data: encryptPayload(payload, encryptionKey) }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status === false) {
    throw new Error(body.message || `TransactPay request failed (${response.status})`);
  }
  return body;
}

export async function createVirtualAccount({ alias, reference, narration }) {
  return transactpayRequest("/payment/virtual-account/generate", {
    Alias: alias,
    Reference: reference,
    Narration: narration,
  });
}

export function providerConfigured() {
  return Boolean(process.env.TRANSACTPAY_PUBLIC_KEY && (process.env.TRANSACTPAY_ENCRYPTION_KEY || process.env.TRANSACTPAY_PUBLIC_KEY));
}
