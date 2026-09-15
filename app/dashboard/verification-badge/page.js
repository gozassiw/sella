import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { getMyStore } from "@/lib/store";
import PaidVerificationForm from "@/components/PaidVerificationForm";

export default async function VerificationBadgePage() {
  const { supabase, store } = await getMyStore();
  const [{ data: setting }, { data: wallet }, { data: purchase }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "paid_verification_fee").maybeSingle(),
    supabase.from("wallets").select("available").eq("store_id", store.id).maybeSingle(),
    supabase.from("store_verification_purchases").select("status,amount,paid_at,reviewed_at,payment_account_number,payment_account_name,payment_bank_name,payment_account_expires_at,payment_reference").eq("store_id", store.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const price = Number(setting?.value?.amount || 0);
  const currentStatus = store.paid_verification_approved ? "approved" : purchase?.status === "paid" ? "paid" : purchase?.status === "approved" ? "approved" : purchase?.status === "pending" ? "pending_review" : null;
  const purchaseForForm = purchase ? { ...purchase, amount: Number(purchase.amount), accountNumber: purchase.payment_account_number, accountName: purchase.payment_account_name, bankName: purchase.payment_bank_name, paymentAccountExpiresAt: purchase.payment_account_expires_at, reference: purchase.payment_reference } : null;
  return <div className="space-y-6"><div><p className="eyebrow text-kola">Seller tools</p><h1 className="display mt-2 text-3xl">Blue checkmark verification</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">This is a separate paid review, not part of Basic, Plus, or Premium. After Sella Team approves your store, the blue checkmark appears on your storefront and buyer-facing store listings.</p></div><section className="panel max-w-2xl"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#2563EB]"><BadgeCheck size={23} fill="currentColor" /></span><div><h2 className="font-extrabold">Get Sella&apos;s blue checkmark</h2><p className="mt-2 text-sm leading-6 text-muted">Verified stores can be eligible to appear in buyer discovery feeds. Unverified stores remain invite-only and are still found through a shared store link or Seller ID.</p></div></div>{price > 0 ? <><p className="mt-6 text-3xl font-extrabold text-kola">₦{price.toLocaleString("en-NG")}</p><p className="mt-1 text-xs text-muted">One separate review payment · current seller balance: ₦{Number(wallet?.available || 0).toLocaleString("en-NG")}</p><div className="mt-5"><PaidVerificationForm storeId={store.id} price={price} balance={Number(wallet?.available || 0)} currentStatus={currentStatus} purchase={purchaseForForm} /></div></> : <div className="mt-6 rounded-2xl bg-surface p-4 text-sm text-muted">The verification price has not been set yet. Sella Team will make this available here once configured.</div>}</section><Link href="/dashboard" className="text-sm font-bold text-kola">← Back to overview</Link></div>;
}
