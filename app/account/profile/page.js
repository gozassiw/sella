import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Heart, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { formatNaira } from "@/lib/utils";
import BuyerProfileForm from "@/components/BuyerProfileForm";
import BuyerSignOutButton from "@/components/BuyerSignOutButton";
import UnfollowStoreButton from "@/components/UnfollowStoreButton";
import CloseAccountForm from "@/components/CloseAccountForm";

export default async function BuyerProfilePage() {
  const { supabase, user } = await getCurrentUser();
  const [{ data: profile }, { data: follows }, { data: orders }] = await Promise.all([
    supabase.from("buyer_profiles").select("full_name,call_number,whatsapp,delivery_address").eq("user_id", user.id).maybeSingle(),
    supabase.from("buyer_store_follows").select("store_id,stores(id,name,slug,logo_url,category)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("orders").select("id,total,payment_status,store_id,stores(name,slug,logo_url,category)").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(500),
  ]);
  const spendByStore = new Map();
  (orders || []).filter((order) => order.payment_status === "paid").forEach((order) => {
    const current = spendByStore.get(order.store_id) || { store: order.stores, total: 0, count: 0 };
    current.total += Number(order.total || 0);
    current.count += 1;
    spendByStore.set(order.store_id, current);
  });
  return <div className="mx-auto max-w-3xl space-y-8">
    <header className="flex items-center justify-between gap-4"><div><p className="eyebrow text-kola">Account</p><h1 className="display mt-2 text-3xl">Your profile</h1></div><BuyerSignOutButton /></header>
    <section className="app-card overflow-hidden"><div className="flex items-center gap-4 border-b border-line p-5"><span className="grid h-14 w-14 place-items-center rounded-[20px] bg-kola text-white"><UserRound size={23} /></span><div className="min-w-0"><p className="truncate text-base font-extrabold">{profile?.full_name || "Sella buyer"}</p><p className="mt-1 truncate text-xs text-muted">{user.email}</p></div></div><div className="p-5"><BuyerProfileForm profile={profile} /></div></section>
    <section><div className="flex items-center justify-between"><div><p className="eyebrow text-kola">Spending</p><h2 className="display mt-2 text-2xl">What you spend by store</h2></div><span className="chip">{formatNaira([...spendByStore.values()].reduce((sum, item) => sum + item.total, 0))}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{spendByStore.size ? [...spendByStore.values()].map(({ store, total, count }) => <Link key={store?.slug || total} href={store?.slug ? `/s/${store.slug}` : "/account/orders"} className="app-card flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate text-sm font-extrabold">{store?.name || "Store"}</p><p className="mt-1 text-xs text-muted">{count} paid {count === 1 ? "order" : "orders"}</p></div><p className="shrink-0 text-sm font-extrabold text-kola">{formatNaira(total)}</p></Link>) : <div className="app-card p-6 text-center text-sm text-muted sm:col-span-2">Your paid store spending will appear here after your first completed payment.</div>}</div></section>
    <section><div className="flex items-center justify-between"><div><p className="eyebrow text-kola">Trusted stores</p><h2 className="display mt-2 text-2xl">Your trusted stores</h2></div><span className="chip"><Heart size={13} className="mr-1.5" />{follows?.length || 0}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{follows?.length ? follows.map((follow) => <div key={follow.store_id} className="app-card flex items-center gap-3 p-4"><Link href={`/s/${follow.stores.slug}`} className="flex min-w-0 flex-1 items-center gap-3">{follow.stores.logo_url ? <Image src={follow.stores.logo_url} alt="" width={48} height={48} className="h-12 w-12 rounded-[17px] object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-[17px] bg-kola text-sm font-extrabold text-white">{follow.stores.name.charAt(0)}</span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{follow.stores.name}</span><span className="mt-1 block truncate text-xs text-muted">{follow.stores.category || "Trusted Sella store"}</span></span><ChevronRight size={16} className="text-muted" /></Link><UnfollowStoreButton storeId={follow.store_id} /></div>) : <div className="app-card p-8 text-center sm:col-span-2"><Heart size={22} className="mx-auto text-kola" /><p className="mt-4 text-sm font-extrabold">No trusted stores yet</p><p className="mt-2 text-xs text-muted">Enter a seller’s unique store ID on your Sella home page to open and trust a store.</p><Link href="/account#store-access" className="btn-soft mt-5">Open a store</Link></div>}</div></section>
    <CloseAccountForm role="buyer" />
  </div>;
}
