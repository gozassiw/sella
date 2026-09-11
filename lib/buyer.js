import { createAdminClient } from "@/lib/supabase/admin";
import { createVirtualAccount, providerConfigured } from "@/lib/payments/transactpay";

export async function ensureBuyerWallet(user) {
  if (!user || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("buyer_wallets").upsert({ user_id: user.id }, { onConflict: "user_id" }).select("*").single();
  return data;
}

export async function generateBuyerWallet(user) {
  const wallet = await ensureBuyerWallet(user);
  if (!wallet) throw new Error("Wallet service is not configured yet.");
  if (wallet.dedicated_account_number) return wallet;
  if (!providerConfigured()) throw new Error("Dedicated account generation is not available yet. Add the TransactPay keys first.");
  const account = await createVirtualAccount({ alias: `sella-buyer-${user.id}`, reference: user.id, narration: `Sella wallet for ${user.email}` });
  const accountNumber = account.accountNumber || account.data?.account_number || account.data?.accountNumber;
  if (!accountNumber) throw new Error("TransactPay did not return an account number.");
  const updated = { dedicated_account_number: accountNumber, dedicated_account_name: account.accountName || account.data?.account_name || account.data?.accountName || null, dedicated_bank_name: account.bank || account.data?.bank_name || account.data?.bank || null, dedicated_account_reference: account.accountReference || account.data?.accountReference || user.id };
  const admin = createAdminClient();
  const { data, error } = await admin.from("buyer_wallets").update(updated).eq("id", wallet.id).select("*").single();
  if (error) throw error;
  return data;
}
