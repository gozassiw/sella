import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DURATIONS = new Set(["1h", "1d", "7d", "30d"]);
const DURATION_MS = { "1h": 60 * 60 * 1000, "1d": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000 };

async function requireAdmin() {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  const { data: authorized } = user ? await auth.rpc("is_platform_admin") : { data: false };
  return { user, authorized: authorized === true };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET() {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("launch_preview_tokens").select("id,expires_at,revoked_at,last_used_at,created_at").order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    return NextResponse.json({ links: data || [] });
  } catch (error) {
    console.error("Preview links could not load", error);
    return NextResponse.json({ error: "Preview links could not load." }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, authorized } = await requireAdmin();
  if (!authorized || !user) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const duration = DURATIONS.has(body.duration) ? body.duration : "1d";
  const expiresAt = new Date(Date.now() + DURATION_MS[duration]);
  const token = crypto.randomBytes(32).toString("hex");

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("launch_preview_tokens").insert({ token_hash: hashToken(token), created_by: user.id, expires_at: expiresAt.toISOString() });
    if (error) throw error;
    const origin = new URL(request.url).origin;
    return NextResponse.json({ link: `${origin}/preview?token=${token}`, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error("Preview link generation failed", error);
    return NextResponse.json({ error: "Preview link could not be generated." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(body.id || ""))) return NextResponse.json({ error: "Preview link not found." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("launch_preview_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", body.id).is("revoked_at", null);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Preview link revocation failed", error);
    return NextResponse.json({ error: "Preview link could not be revoked." }, { status: 500 });
  }
}
