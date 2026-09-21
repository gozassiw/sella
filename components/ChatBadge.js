"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ChatBadge({ children, userId = null }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    let channel;
    const supabase = createClient();
    const load = async () => {
      const response = await fetch("/api/notifications?summary=1", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (active && response.ok) setUnread(Number(data.chatUnreadCount || 0));
    };
    (async () => { const currentUserId = userId || (await supabase.auth.getUser()).data?.user?.id; if (!currentUserId) return; channel = supabase.channel(`sella-chat-badge-${currentUserId}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${currentUserId}` }, load).subscribe(); await load(); })();
    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, [userId]);
  return <span className="relative flex w-full min-w-0">{children}{unread > 0 && <span aria-label={`${unread} unread messages`} className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-mango px-1 text-[9px] font-extrabold leading-none text-kola-dark">{unread > 9 ? "9+" : unread}</span>}</span>;
}
