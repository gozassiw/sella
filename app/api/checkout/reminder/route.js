import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ firstPurchase: false }, { status: 401 });

    const storeId = new URL(request.url).searchParams.get("storeId");
    if (!storeId) return NextResponse.json({ error: "Store is required." }, { status: 400 });

    const [{ data: store, error: storeError }, { data: previousOrder, error: orderError }] = await Promise.all([
      supabase.from("stores").select("id,name,slug,logo_url,delivery_note").eq("id", storeId).eq("is_published", true).eq("approval_status", "approved").maybeSingle(),
      supabase.from("orders").select("id").eq("buyer_id", user.id).eq("store_id", storeId).eq("payment_status", "paid").limit(1).maybeSingle(),
    ]);
    if (storeError) throw new Error(storeError.message);
    if (orderError && orderError.code !== "PGRST116") throw new Error(orderError.message);
    if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });

    return NextResponse.json({
      firstPurchase: !previousOrder,
      store: {
        name: store.name,
        slug: store.slug,
        logoUrl: store.logo_url || null,
        deliveryNote: store.delivery_note || null,
        storeUrl: `/s/${store.slug}`,
        deliveryUrl: store.delivery_note ? `/s/${store.slug}#delivery` : null,
        refundUrl: `/s/${store.slug}#refunds`,
        hasDeliveryTerms: Boolean(store.delivery_note),
        hasRefundPolicy: false,
      },
    });
  } catch (error) {
    console.error("Checkout reminder error", error);
    return NextResponse.json({ error: "Unable to load store safety information." }, { status: 400 });
  }
}
