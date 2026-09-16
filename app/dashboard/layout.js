import Link from "next/link";
import { getMyStore } from "@/lib/store";
import DashboardNav from "@/components/DashboardNav";
import LiveWorkspaceRefresh from "@/components/LiveWorkspaceRefresh";
import SellerCommissionAcknowledgement from "@/components/SellerCommissionAcknowledgement";

function AccessNotice({ held, store }) {
  if (held) return <div className="mx-auto max-w-xl rounded-[28px] bg-amber-50 p-7 text-center sm:p-10"><p className="eyebrow text-warning">Account on hold</p><h1 className="display mt-3 text-3xl">Your seller account is temporarily paused</h1><p className="mt-4 text-sm leading-6 text-muted">Sella Team has placed this account on hold. Store operations, orders, payouts, and publishing are paused while we review the account.</p><Link href="/account/profile" className="btn-soft mt-6 inline-flex">Open account support</Link></div>;
  if (store.approval_status !== "approved") return <div className="mx-auto max-w-2xl rounded-[28px] bg-white p-7 sm:p-10"><p className="eyebrow text-kola">Seller verification</p><h1 className="display mt-3 text-3xl">{store.approval_status === "rejected" ? "Update your submission" : "Submission successful"}</h1><p className="mt-4 text-sm leading-6 text-muted">{store.approval_status === "rejected" ? "Sella Team has requested an update before your store can go live." : "Your seller information was submitted successfully. Please wait for verification from the Sella Team."} Your store remains private and cannot add orders, publish products, or receive buyer payments until approval.</p>{store.approval_status === "pending" && <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-warning"><strong>Waiting for verification</strong><br />After approval, your free Starter plan will be ready with up to 40 active product listings.</div>}{store.rejection_reason && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-danger"><strong>Update requested:</strong> {store.rejection_reason}</div>}<div className="mt-6 flex flex-wrap gap-3"><Link href="/onboarding" className="btn-primary">{store.approval_status === "rejected" ? "Update and resubmit" : "Review submitted information"}</Link></div></div>;
  return null;
}

export default async function DashboardLayout({ children }) {
  const { supabase, store, held } = await getMyStore();
  const blocked = held || store.approval_status !== "approved";
  const { data: renewalReminder } = !blocked ? await supabase.rpc("create_combined_renewal_reminder", { p_store_id: store.id }) : { data: null };
  const reminder = renewalReminder?.show ? renewalReminder : null;
  return <div className="min-h-screen bg-surface md:flex"><LiveWorkspaceRefresh scope="seller" storeId={store.id} ownerId={store.owner_id} /><DashboardNav store={{ name: store.name, slug: store.slug, seller_code: store.seller_code, logo_url: store.logo_url, approval_status: store.approval_status }} /><main className="min-w-0 flex-1 pb-28 md:pb-0 md:pt-20"><div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{blocked ? <AccessNotice held={held} store={store} /> : <>{reminder && <div className="mb-6 rounded-[20px] bg-amber-50 p-4 text-sm text-warning"><p className="font-extrabold">Your Sella renewals are coming up</p><p className="mt-1 leading-6">{reminder.body}</p><div className="mt-3 flex flex-wrap gap-3"><Link href="/dashboard/billing" className="font-bold underline">Manage plan</Link><Link href="/dashboard/verification-badge" className="font-bold underline">Manage checkmark</Link></div></div>}{children}</>}</div></main>{!blocked && !store.commission_acknowledged_at && <SellerCommissionAcknowledgement />}</div>;
}
