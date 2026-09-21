"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Keep live updates focused on records that belong to the current workspace.
// Public product/store changes are intentionally not subscribed to globally:
// that pattern refreshed every buyer dashboard for every seller's edit.
const buyerTables = [
  { table: "buyer_wallets", filterKey: "user_id" },
  { table: "buyer_wallet_transactions", filterKey: "buyer_wallet_id", valueKey: "walletId" },
  { table: "orders", filterKey: "buyer_id" },
  { table: "notifications", filterKey: "user_id" },
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
  const refreshTimer = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    const channelName = `sella-live-${scope}-${userId || storeId || "workspace"}`;
    const channel = supabase.channel(channelName);
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh.current < 1500) return;
      lastRefresh.current = now;
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => router.refresh(), 120);
    };

    if (scope === "admin") {
      adminTables.forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh));
    } else {
      const tables = scope === "seller" ? sellerTables : scope === "store" ? storeTables : buyerTables;
      tables.forEach(({ table, filterKey, valueKey }) => {
        const value = valueKey === "ownerId" ? ownerId : valueKey === "walletId" ? walletId : scope === "seller" || scope === "store" ? storeId : userId;
        if (value) channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `${filterKey}=eq.${value}` }, refresh);
      });
    }

    channel.subscribe();

    // Realtime is the primary update path. Do not refresh on every focus or
    // visibility event; mobile browsers fire those frequently and make page
    // navigation feel like a full reload. A slower fallback covers missed events.
    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 120000);

    return () => {
      window.clearInterval(fallback);
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [ownerId, router, scope, storeId, userId, walletId]);

  return null;
}
