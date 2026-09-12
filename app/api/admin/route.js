import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveTransactPayConfig } from "@/lib/payments/transactpay";

export async function POST(request) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  const { data: authorized } = user ? await auth.rpc("is_platform_admin") : { data: false };
  if (!user || authorized !== true) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "payment_config") {
      await saveTransactPayConfig({ baseUrl: body.baseUrl, publicKey: body.publicKey, secretKey: body.secretKey, encryptionKey: body.encryptionKey });
    } else {
      const { error } = await auth.rpc("admin_apply_action", { p_action: body.action, p_payload: body });
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Admin operation failed." }, { status: 400 });
  }
}
