import { getMyStore } from "@/lib/store";
import { VerificationForm } from "@/components/OperationsForm";

export default async function VerificationPage() {
  const { store } = await getMyStore();
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Verification</h1><p className="mt-1 text-sm text-muted">Verification is optional during trial and can be completed later.</p></div><section className="panel max-w-2xl"><p className="text-sm text-muted">Current status: <strong className="capitalize text-ink">{store.verification_approved ? "Approved" : store.nin_status || "Not started"}</strong></p><div className="mt-5"><VerificationForm storeId={store.id} store={store} /></div></section></div>;
}
