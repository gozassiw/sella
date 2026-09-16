"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ChatBadge({ children }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    let channel;
    const supabase = createClient();
    const load = async () => {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (active && response.ok) setUnread((data.notifications || []).filter((item) => item.type === "chat" && !item.read_at).length);
    };
    (async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) return; channel = supabase.channel(`sella-chat-badge-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load).subscribe(); await load(); })();
    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, []);
  return <span className="relative flex w-full min-w-0">{children}{unread > 0 && <span aria-label={`${unread} unread messages`} className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-mango px-1 text-[9px] font-extrabold leading-none text-kola-dark">{unread > 9 ? "9+" : unread}</span>}</span>;
}
