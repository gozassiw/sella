"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Package, ShoppingBag, Settings, ExternalLink, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/config";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardNav({ store }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white p-4 md:flex">
        <span className="px-2 text-lg font-bold text-kola">{BRAND}</span>
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-surface p-3">
          {store.logo_url ? (
            <img src={store.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kola font-bold text-white">
              {store.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate text-sm font-semibold">{store.name}</span>
        </div>
        <nav className="mt-6 space-y-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive(href) ? "bg-kola-light text-kola" : "text-muted hover:bg-surface"}`}
            >
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-1">
          <a href={`/s/${store.slug}`} target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface">
            <ExternalLink size={18} /> View my store
          </a>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface">
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar + bottom tabs */}
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
        <span className="truncate font-semibold">{store.name}</span>
        <a href={`/s/${store.slug}`} target="_blank" className="flex items-center gap-1 text-sm font-semibold text-kola">
          View store <ExternalLink size={14} />
        </a>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white md:hidden">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${isActive(href) ? "text-kola" : "text-muted"}`}>
            <Icon size={20} /> {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
