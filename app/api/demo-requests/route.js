import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPlatformAdmins } from "@/lib/notifications";

const TIME_SLOTS = new Set(["10am–12pm", "12pm–2pm", "2pm–4pm", "4pm–6pm"]);

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 120);
  const whatsapp = String(body.whatsapp || "").trim().slice(0, 40);
  const requestedDay = String(body.requestedDay || "").trim();
  const timeSlot = String(body.timeSlot || "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (whatsapp.length < 7) return NextResponse.json({ error: "Enter a valid WhatsApp number." }, { status: 400 });
  if (!validDate(requestedDay)) return NextResponse.json({ error: "Choose a valid demo day." }, { status: 400 });
  if (timeSlot.length === 0 || !TIME_SLOTS.has(timeSlot)) return NextResponse.json({ error: "Choose one of the available time slots." }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data: requestId, error } = await admin.rpc("create_demo_request", { p_name: name, p_whatsapp: whatsapp, p_requested_day: requestedDay, p_time_slot: timeSlot });
    if (error) throw error;
    const message = `${name} requested a WhatsApp demo for ${requestedDay} (${timeSlot}). WhatsApp: ${whatsapp}`;
    const { error: inAppError } = await admin.rpc("notify_platform_admins", { p_type: "demo", p_title: "New demo request", p_body: message, p_link: "/admin?section=demos" });
    if (inAppError) console.error("Demo request admin notification record failed", inAppError);
    await notifyPlatformAdmins({ type: "demo", title: "New demo request", body: message, link: "/admin?section=demos" });
    return NextResponse.json({ success: true, id: requestId });
  } catch (error) {
    console.error("Demo request failed", error);
    return NextResponse.json({ error: "We could not save your demo request right now. Please try again." }, { status: 500 });
  }
}
