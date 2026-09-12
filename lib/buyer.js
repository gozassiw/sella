import { createClient } from "@/lib/supabase/server";
import { createVirtualAccount, providerConfigured } from "@/lib/payments/transactpay";

export async function ensureBuyerWallet(user) {
  if (!user) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_or_create_buyer_wallet");
  if (error) throw error;
  return data;
}

export async function generateBuyerWallet(user) {
  const wallet = await ensureBuyerWallet(user);
  if (!wallet) throw new Error("Wallet service is not configured yet.");
  if (wallet.dedicated_account_number) return wallet;
  if (!(await providerConfigured())) throw new Error("Dedicated account generation is not available yet. Add the TransactPay public and encryption keys first.");
  const account = await createVirtualAccount({ alias: `sella-buyer-${user.id}`, reference: user.id, narration: `Sella wallet for ${user.email}` });
  const accountNumber = account.accountNumber || account.data?.account_number || account.data?.accountNumber;
  if (!accountNumber) throw new Error("TransactPay did not return an account number.");
  const supabase = createClient();
  const { data, error } = await supabase.rpc("set_buyer_wallet_account", {
    p_account_number: accountNumber,
    p_account_name: account.accountName || account.data?.account_name || account.data?.accountName || null,
    p_bank_name: account.bank || account.data?.bank_name || account.data?.bank || null,
    p_account_reference: account.accountReference || account.data?.accountReference || user.id,
  });
  if (error) throw error;
  return data;
}
