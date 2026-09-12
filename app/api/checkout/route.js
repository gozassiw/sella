import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createVirtualAccount, providerConfigured } from "@/lib/payments/transactpay";

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please log in before checking out." }, { status: 401 });
    const { data: held } = await supabase.rpc("is_account_held", { p_user_id: user.id });
    if (held) return NextResponse.json({ error: "Your account is on hold. Checkout is paused while Sella Team reviews it." }, { status: 403 });

    const body = await request.json();
    const { storeId, items, customer, fulfilmentMethod = "delivery", paymentMethod = "transfer" } = body;
    if (!storeId || !Array.isArray(items) || !items.length || !customer?.name || !customer?.phone || !customer?.email) {
      return NextResponse.json({ error: "Complete your contact details and add at least one item." }, { status: 400 });
    }
    if (fulfilmentMethod === "delivery" && !customer.address) {
      return NextResponse.json({ error: "Add a delivery address or choose pickup." }, { status: 400 });
    }

    const { data: order, error } = await supabase.rpc("create_checkout_order", {
      p_store_id: storeId,
      p_buyer_id: user.id,
      p_items: items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
      p_customer: customer,
      p_fulfilment_method: fulfilmentMethod,
      p_payment_method: paymentMethod,
    });
    if (error) throw new Error(error.message);

    if (paymentMethod === "wallet") {
      const { error: walletError } = await supabase.rpc("pay_order_from_wallet", { p_order_id: order.id });
      if (walletError) throw new Error(walletError.message);
      return NextResponse.json({ orderId: order.id, paid: true });
    }

    if (!(await providerConfigured())) {
      return NextResponse.json({ orderId: order.id, paid: false, providerConfigured: false });
    }

    const account = await createVirtualAccount({
      alias: `sella-order-${order.id}`,
      reference: order.id,
      narration: `Sella order #${order.order_number}`,
    });
    const accountNumber = account.accountNumber || account.data?.account_number || account.data?.accountNumber;
    if (!accountNumber) throw new Error("TransactPay did not return an account number");

    const accountReference = account.accountReference || account.data?.accountReference || order.id;
    const { error: accountSaveError } = await supabase.rpc("set_order_payment_account", {
      p_order_id: order.id,
      p_account_number: accountNumber,
      p_account_name: account.accountName || account.data?.account_name || account.data?.accountName || null,
      p_bank_name: account.bank || account.data?.bank_name || account.data?.bank || null,
      p_payment_reference: accountReference,
    });
    if (accountSaveError) throw new Error(accountSaveError.message);

    return NextResponse.json({
      orderId: order.id,
      paid: false,
      account: {
        number: accountNumber,
        name: account.accountName || account.data?.account_name || account.data?.accountName || null,
        bank: account.bank || account.data?.bank_name || account.data?.bank || null,
      },
    });
  } catch (error) {
    console.error("Checkout error", error);
    return NextResponse.json({ error: error.message || "Unable to create your order." }, { status: 400 });
  }
}
