import { createAdminClient } from "@/lib/supabase/admin";
import { createVirtualAccount, providerConfigured } from "@/lib/payments/transactpay";

export async function ensureBuyerWallet(user) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin = createAdminClient();
  const { data: existing } = await admin.from("buyer_wallets").select("*").eq("user_id", user.id).maybeSingle();
  if (existing?.dedicated_account_number || !providerConfigured()) {
    if (existing) return existing;
    const { data } = await admin.from("buyer_wallets").upsert({ user_id: user.id }, { onConflict: "user_id" }).select("*").single();
    return data;
  }
  const { data: wallet } = await admin.from("buyer_wallets").upsert({ user_id: user.id }, { onConflict: "user_id" }).select("*").single();
  const account = await createVirtualAccount({ alias: `sella-buyer-${user.id}`, reference: user.id, narration: `Sella wallet for ${user.email}` });
  const accountNumber = account.accountNumber || account.data?.account_number || account.data?.accountNumber;
  const updated = {
    dedicated_account_number: accountNumber,
    dedicated_account_name: account.accountName || account.data?.account_name || account.data?.accountName || null,
    dedicated_bank_name: account.bank || account.data?.bank_name || account.data?.bank || null,
    dedicated_account_reference: account.accountReference || account.data?.accountReference || user.id,
  };
  const { data } = await admin.from("buyer_wallets").update(updated).eq("id", wallet.id).select("*").single();
  return data;
}
