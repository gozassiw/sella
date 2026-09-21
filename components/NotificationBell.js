"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NotificationBell({ children, userId = null }) {
  const [unread, setUnread] = useState(0);
  const userRef = useRef(null);

  useEffect(() => {
    let channel;
    let supabase;
    let active = true;
    const load = async () => {
      const response = await fetch("/api/notifications?summary=1", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (active && response.ok) setUnread(Number(data.unreadCount || 0));
    };
    const connect = async () => {
      supabase = createClient();
      const currentUserId = userId || (await supabase.auth.getUser()).data?.user?.id;
      if (!active || !currentUserId) return;
      userRef.current = currentUserId;
      channel = supabase.channel(`sella-notification-badge-${currentUserId}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${currentUserId}` }, load);
      channel.subscribe();
      await load();
    };
    connect();
    return () => { active = false; if (channel && supabase) supabase.removeChannel(channel); };
  }, [userId]);

  return <span className="relative inline-flex">{children}{unread > 0 && <span aria-label={`${unread} unread notifications`} className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-mango px-1 text-[9px] font-extrabold leading-none text-kola-dark">{unread > 9 ? "9+" : unread}</span>}</span>;
}
