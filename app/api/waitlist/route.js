import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPlatformAdmins } from "@/lib/notifications";

function validEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const fullName = String(body.fullName || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 320);
  const whatsapp = String(body.whatsapp || "").trim().slice(0, 40);

  if (fullName.length < 2) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (!validEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (whatsapp.length < 7) return NextResponse.json({ error: "Enter a valid WhatsApp number." }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("create_launch_waitlist_signup", { p_full_name: fullName, p_email: email, p_whatsapp: whatsapp });
    if (error) throw error;

    if (data?.created) {
      const { error: notificationError } = await admin.rpc("notify_platform_admins", {
        p_type: "waitlist",
        p_title: "New launch waitlist signup",
        p_body: "A new person joined the Sella launch waitlist.",
        p_link: "/admin?section=waitlist",
      });
      if (notificationError) console.error("Waitlist admin notification record failed", notificationError);
      await notifyPlatformAdmins({ type: "waitlist", title: "New launch waitlist signup", body: "A new person joined the Sella launch waitlist.", link: "/admin?section=waitlist" });
    }

    return NextResponse.json({ success: true, created: Boolean(data?.created) });
  } catch (error) {
    console.error("Waitlist signup failed", error);
    return NextResponse.json({ error: "We could not save your details right now. Please try again." }, { status: 500 });
  }
}
