"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const buyerTables = [
  { table: "buyer_wallets", filterKey: "user_id" },
  { table: "buyer_wallet_transactions", filterKey: "buyer_wallet_id", valueKey: "walletId" },
  { table: "orders", filterKey: "buyer_id" },
  { table: "notifications", filterKey: "user_id" },
  { table: "products", public: true },
  { table: "stores", public: true },
];

const sellerTables = [
  { table: "orders", filterKey: "store_id" },
  { table: "products", filterKey: "store_id" },
  { table: "wallets", filterKey: "store_id" },
  { table: "notifications", filterKey: "user_id", valueKey: "ownerId" },
];

const adminTables = [
  "stores",
  "orders",
  "products",
  "wallets",
  "subscriptions",
  "withdrawals",
  "reports",
  "notifications",
  "payment_webhook_events",
  "account_holds",
];

const storeTables = [
  { table: "stores", filterKey: "id" },
  { table: "products", filterKey: "store_id" },
];

export default function LiveWorkspaceRefresh({ scope, userId, storeId, ownerId, walletId }) {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const channelName = `sella-live-${scope}-${userId || storeId || "workspace"}`;
    const channel = supabase.channel(channelName);
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh.current < 800) return;
      lastRefresh.current = now;
      router.refresh();
    };

    if (scope === "admin") {
      adminTables.forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh));
    } else {
      const tables = scope === "seller" ? sellerTables : scope === "store" ? storeTables : buyerTables;
      tables.forEach(({ table, filterKey, valueKey, public: publicTable }) => {
        const value = valueKey === "ownerId" ? ownerId : valueKey === "walletId" ? walletId : scope === "seller" || scope === "store" ? storeId : userId;
        if (publicTable) channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
        else if (value) channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `${filterKey}=eq.${value}` }, refresh);
      });
    }

    channel.subscribe();
    const onFocus = () => refresh();
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const fallback = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 45000);

    return () => {
      window.clearInterval(fallback);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [ownerId, router, scope, storeId, userId, walletId]);

  return null;
}
