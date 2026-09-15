import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { getMyStore } from "@/lib/store";
import PaidVerificationForm from "@/components/PaidVerificationForm";

export default async function VerificationBadgePage() {
  const { supabase, store } = await getMyStore();
  await supabase.rpc("sync_store_verification_status", { p_store_id: store.id });
  const [{ data: setting }, { data: wallet }, { data: purchase }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "paid_verification_fee").maybeSingle(),
    supabase.from("wallets").select("available").eq("store_id", store.id).maybeSingle(),
    supabase.from("store_verification_purchases").select("status,amount,paid_at,reviewed_at,expires_at,payment_account_number,payment_account_name,payment_bank_name,payment_account_expires_at,payment_reference").eq("store_id", store.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const price = Number(setting?.value?.amount || 0);
  const approvedAndActive = purchase?.status === "approved" && purchase.expires_at && new Date(purchase.expires_at) > new Date();
  const currentStatus = approvedAndActive ? "approved" : purchase?.status === "paid" ? "paid" : purchase?.status === "approved" ? "expired" : purchase?.status === "pending" ? "pending_review" : null;
  const purchaseForForm = purchase ? { ...purchase, amount: Number(purchase.amount), accountNumber: purchase.payment_account_number, accountName: purchase.payment_account_name, bankName: purchase.payment_bank_name, paymentAccountExpiresAt: purchase.payment_account_expires_at, reference: purchase.payment_reference } : null;
  return <div className="space-y-6"><div><p className="eyebrow text-[#2563EB]">Separate seller tool</p><h1 className="display mt-2 text-3xl">Verification checkmark</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">This is its own six-month verification purchase, separate from Basic, Plus, and Premium plans. Admin approval is required before the checkmark and verified-store discovery visibility activate.</p></div><section className="panel max-w-2xl"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#2563EB]"><BadgeCheck size={23} fill="currentColor" /></span><div><h2 className="font-extrabold">Get Sella&apos;s verification checkmark</h2><p className="mt-2 text-sm leading-6 text-muted">The current price is billed every 6 months from the date of payment. Your price is controlled by Sella Admin and may change for a future renewal. Approved verification expires automatically if the next six-month payment is not completed.</p></div></div>{price > 0 ? <><p className="mt-6 text-3xl font-extrabold text-kola">₦{price.toLocaleString("en-NG")}</p><p className="mt-1 text-xs text-muted">6 months from payment · current seller balance: ₦{Number(wallet?.available || 0).toLocaleString("en-NG")}</p><div className="mt-5"><PaidVerificationForm storeId={store.id} price={price} balance={Number(wallet?.available || 0)} currentStatus={currentStatus} purchase={purchaseForForm} /></div></> : <div className="mt-6 rounded-2xl bg-surface p-4 text-sm text-muted">The verification price has not been set yet. Sella Admin will make this available here once configured.</div>}</section><Link href="/dashboard" className="text-sm font-bold text-kola">← Back to overview</Link></div>;
}
