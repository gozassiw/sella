import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { data, error } = await supabase.rpc("close_my_account");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    const admin = createAdminClient();
    const metadata = { ...(user.user_metadata || {}), account_closed: true, account_closed_at: new Date().toISOString() };
    await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h", user_metadata: metadata });
    await admin.auth.admin.signOut(user.id, "global");
  } catch (adminError) {
    console.error("[account-close] auth ban failed", adminError);
    return NextResponse.json({ error: "Your account data was closed, but the permanent sign-in block could not be completed. Please contact Sella support." }, { status: 500 });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ closed: true, result: data });
}
