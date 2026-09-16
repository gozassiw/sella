import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";
import SubscriptionForm from "@/components/SubscriptionForm";

const plans = [
  { id: "starter", name: "Starter", label: "Free · no expiry", amount: 0, commission: "3.2%", benefit: "40 active product listings, core store tools, orders, wallet and withdrawals.", rank: 0 },
  { id: "basic", name: "Basic", label: "3 months", amount: 7500, commission: "2.8%", benefit: "150 active product listings plus analytics, expenses, invoices and customer records.", rank: 1 },
  { id: "plus", name: "Plus", label: "6 months", amount: 14000, commission: "2.6%", benefit: "500 active product listings and everything in Basic for a growing store.", rank: 2 },
  { id: "premium", name: "Premium", label: "12 months", amount: 25000, commission: "2.4%", benefit: "Unlimited active product listings and the lowest commission rate.", rank: 3 },
];
const planRanks = { starter: 0, basic: 1, plus: 2, premium: 3, quarterly: 1, biannual: 2, yearly: 3 };
const planNames = { starter: "Starter", basic: "Basic", plus: "Plus", premium: "Premium", quarterly: "Basic", biannual: "Plus", yearly: "Premium" };

function StatusBadge({ status }) {
  const tone = status === "paid" || status === "active" ? "bg-green-50 text-success" : status === "pending" ? "bg-amber-50 text-warning" : "bg-surface text-muted";
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>{status || "pending"}</span>;
}

function dateLabel(value) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date not recorded" : date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default async function BillingPage() {
  const { supabase, store } = await getMyStore();
  const [{ data: wallet }, { data: subscriptions }] = await Promise.all([
    supabase.from("wallets").select("available").eq("store_id", store.id).maybeSingle(),
    supabase.from("subscriptions").select("id,plan,amount,paid_with,started_at,expires_at,status,payment_reference,paid_at,payment_account_expires_at").eq("store_id", store.id).order("started_at", { ascending: false }).limit(50),
  ]);
  const balance = Number(wallet?.available || 0);
  const activePlan = (subscriptions || []).find((item) => ["paid", "active"].includes(item.status) && item.expires_at && new Date(item.expires_at) > new Date());
  const currentPlanId = activePlan ? (planNames[activePlan.plan] || "Basic").toLowerCase() : "starter";
  const activeRank = planRanks[currentPlanId] ?? 0;

  return <div className="space-y-6">
    <div><p className="eyebrow text-kola">Plans & billing</p><h1 className="display mt-2 text-3xl">Keep your store moving</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Every approved seller starts on the free Starter plan. Upgrade when you need more active listings, more business tools, or a lower commission rate.</p></div>
    {activePlan ? <div className="rounded-2xl bg-green-50 p-4 text-sm font-extrabold text-success">{planNames[activePlan.plan]} plan active until {dateLabel(activePlan.expires_at)}.</div> : <div className="rounded-2xl bg-kola-light p-4 text-sm text-kola"><strong>Starter plan active</strong> · 40 active product listings with no expiry. Upgrade whenever your store needs more capacity or a lower commission rate.</div>}
    <section className="panel max-w-3xl"><h2 className="font-semibold">Why upgrade from Starter?</h2><p className="mt-2 text-sm leading-6 text-muted">Starter gives every approved seller a proper free store with the core tools to begin. Paid plans are optional upgrades that increase your active product limit, add more business capacity, and reduce the commission taken from each paid order.</p></section>
    <section><div className="mb-4 rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted">Available seller balance</p><p className="mt-1 text-2xl font-extrabold text-kola">{formatNaira(balance)}</p><p className="mt-1 text-xs text-muted">You can pay a plan directly from this balance when it covers the full plan price.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan) => { const isCurrent = plan.id === currentPlanId; const isDowngrade = Boolean(activePlan && plan.rank < activeRank); const actionLabel = isDowngrade ? "Downgrade" : activePlan && plan.rank > activeRank ? "Upgrade" : "Choose plan & pay"; return <div key={plan.id} className={`panel flex flex-col ${isCurrent ? "border-2 border-kola" : ""}`}><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{plan.name}</p><p className="mt-1 text-sm text-muted">{plan.label}</p></div>{isCurrent && <span className="rounded-full bg-kola-light px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-kola">Current plan</span>}</div><p className="mt-2 text-2xl font-bold">{plan.amount ? formatNaira(plan.amount) : "Free"}</p><div className="mt-4 flex-1 rounded-xl bg-kola-light p-3"><p className="text-xs font-extrabold uppercase tracking-wide text-kola">Plan benefit</p><p className="mt-1 text-sm font-semibold text-kola">{plan.commission} commission per paid order</p><p className="mt-1 text-xs leading-5 text-muted">{plan.benefit}</p></div><div className="mt-4">{plan.id === "starter" ? <div className="rounded-2xl bg-surface p-4 text-sm font-extrabold text-muted">{isCurrent ? "Free plan active" : "Downgrade"}</div> : <SubscriptionForm storeId={store.id} plan={plan.id} amount={plan.amount} balance={balance} actionLabel={actionLabel} isCurrent={isCurrent} isDowngrade={isDowngrade} />}</div></div>; })}</div><p className="mt-4 text-xs leading-5 text-muted">Commission is calculated from the seller&apos;s active plan: Starter 3.2%, Basic 2.8%, Plus 2.6%, or Premium 2.4%.</p></section>
    <section className="panel"><div className="flex items-center justify-between gap-4"><h2 className="font-semibold">Subscription history</h2><span className="chip">{subscriptions?.length || 0} records</span></div><div className="mt-4 space-y-3">{subscriptions?.length ? subscriptions.map((item, index) => <div key={item.id || `${item.plan}-${item.started_at || index}`} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4"><div><p className="text-sm font-extrabold">{planNames[item.plan] || item.plan} <span className="font-normal text-muted">· {item.paid_with || "transfer"}</span></p><p className="mt-1 text-xs text-muted">{item.paid_at ? `Paid ${dateLabel(item.paid_at)}` : `Started ${dateLabel(item.started_at)}`}{item.expires_at ? ` · Ends ${dateLabel(item.expires_at)}` : ""}</p></div><StatusBadge status={item.status} /></div>) : <p className="text-sm text-muted">No paid subscription payments yet. Your free Starter plan does not create a subscription-history record.</p>}</div></section>
  </div>;
}
