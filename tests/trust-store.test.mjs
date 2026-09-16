import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

process.env.TRUST_NOTICE_SECRET = "trust-test-secret";
const { TRUST_NOTICE_VERSION, issueTrustNoticeNonce, verifyTrustNoticeNonce } = await import("../lib/buyer-trust.js");
const root = new URL("..", import.meta.url).pathname;
const migration = fs.readFileSync(`${root}supabase/stage-75-trust-acknowledgement.sql`, "utf8");
const route = fs.readFileSync(`${root}app/api/buyer/follow/route.js`, "utf8");
const button = fs.readFileSync(`${root}components/TrustStoreButton.js`, "utf8");

test("notice nonce is signed, actor/store scoped, version scoped, and expires", () => {
  const userId = "buyer-1";
  const storeId = "store-1";
  const nonce = issueTrustNoticeNonce({ userId, storeId });
  assert.equal(verifyTrustNoticeNonce(nonce, { userId, storeId }), true);
  assert.equal(verifyTrustNoticeNonce(nonce, { userId: "seller-1", storeId }), false);
  assert.equal(verifyTrustNoticeNonce(nonce, { userId, storeId: "store-2" }), false);
  const [payload] = nonce.split(".");
  const expiredPayload = Buffer.from(JSON.stringify({ userId, storeId, noticeVersion: TRUST_NOTICE_VERSION, expiresAt: 1 })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.TRUST_NOTICE_SECRET).update(`sella:trust-notice:v1:${expiredPayload}`).digest("base64url");
  assert.equal(verifyTrustNoticeNonce(`${expiredPayload}.${signature}`, { userId, storeId }), false);
  const original = process.env.TRUST_NOTICE_SECRET; delete process.env.TRUST_NOTICE_SECRET;
  assert.throws(() => issueTrustNoticeNonce({ userId, storeId }), /server signing secret is required/);
  process.env.TRUST_NOTICE_SECRET = original;
  assert.equal(verifyTrustNoticeNonce(`${payload}.tampered`, { userId, storeId }), false);
});

test("API validates acknowledgement and nonce, then uses a server-only RPC", () => {
  assert.match(route, /body\.acknowledged !== true/);
  assert.match(route, /body\.noticeVersion !== TRUST_NOTICE_VERSION/);
  assert.match(route, /verifyTrustNoticeNonce\(body\.noticeNonce, \{ userId: user\.id, storeId: store\.id \}\)/);
  assert.match(route, /createAdminClient\(\)/);
  assert.match(route, /p_buyer_id: user\.id/);
  assert.doesNotMatch(route, /supabase\.rpc\("set_store_trust"/);
});

test("trust migration enforces unique evidence, RLS reads, no browser writes, legacy removal, and service-only mutation", () => {
  assert.match(migration, /unique \(buyer_id, store_id\)/);
  assert.match(migration, /alter table public\.buyer_store_follows enable row level security/);
  assert.match(migration, /using \(user_id = auth\.uid\(\)\)/);
  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger on table public\.buyer_store_follows from anon, authenticated/);
  assert.match(migration, /grant execute on function public\.set_store_trust\(uuid, uuid, boolean, boolean, text\) to service_role/);
  assert.match(migration, /drop function if exists public\.set_store_trust\(uuid, boolean\)/);
  assert.match(migration, /drop function if exists public\.set_store_trust\(uuid, boolean, boolean, text\)/);
  assert.match(migration, /Grandfather existing relationships/);
  assert.match(migration, /set status = 'removed'/);
});

test("modal contains the required safety copy and gates confirmation on acknowledgement and nonce", () => {
  assert.match(button, /Trust this store\?/);
  assert.match(button, /Before you continue/);
  assert.match(button, /I understand and choose to trust this store\./);
  assert.match(button, /disabled=\{busy \|\| !acknowledged \|\| !notice\?\.nonce\}/);
  assert.match(button, /Store added to My Trusted Stores\./);
});
