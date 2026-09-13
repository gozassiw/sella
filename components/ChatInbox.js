"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Flag, ImagePlus, MessageCircle, Send } from "lucide-react";

function timeLabel(value) {
  try { return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return ""; }
}

export default function ChatInbox({ initialThreads = [], userId, role = "buyer", startStoreId = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState(searchParams.get("conversation") || initialThreads[0]?.id || "");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const selected = useMemo(() => threads.find((item) => item.id === activeId), [threads, activeId]);

  async function loadThreads() {
    const response = await fetch("/api/chat", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setThreads(data.threads || []);
      if (!activeId && data.threads?.[0]) setActiveId(data.threads[0].id);
    }
  }
  async function loadConversation(id) {
    if (!id) return;
    const response = await fetch(`/api/chat?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error || "Chat could not be loaded.");
    setConversation(data.conversation); setMessages(data.messages || []); setError("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }
  useEffect(() => { loadThreads(); }, []);
  useEffect(() => {
    if (activeId) {
      loadConversation(activeId);
      router.replace(`${role === "seller" ? "/dashboard" : "/account"}/messages?conversation=${encodeURIComponent(activeId)}`);
    }
  }, [activeId]);
  useEffect(() => {
    if (!activeId) return;
    fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "chat" }) }).catch(() => {});
    const supabase = createClient();
    const channel = supabase.channel(`sella-chat-${activeId}`).on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${activeId}` }, () => loadConversation(activeId)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId]);
  useEffect(() => {
    if (!startStoreId || role !== "buyer") return;
    (async () => {
      setBusy(true);
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", storeId: startStoreId }) });
      const data = await response.json().catch(() => ({}));
      setBusy(false);
      if (!response.ok) return setError(data.error || "Chat unlocks after a paid order with this store.");
      await loadThreads(); setActiveId(data.conversation.id);
    })();
  }, [startStoreId]);

  async function send(event) {
    event.preventDefault();
    if (!activeId || (!draft.trim() && !file)) return;
    setBusy(true); setError("");
    const form = new FormData(); form.append("conversationId", activeId); form.append("body", draft); if (file) form.append("image", file);
    const response = await fetch("/api/chat", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "Message could not be sent.");
    setDraft(""); setFile(null); const input = document.getElementById("chat-image"); if (input) input.value = ""; await loadConversation(activeId); await loadThreads();
  }
  async function report(messageId) {
    const reason = window.prompt("Why are you reporting this message?", "Inappropriate or unsafe message");
    if (!reason) return;
    const response = await fetch("/api/chat/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId, reason }) });
    const data = await response.json().catch(() => ({}));
    setError(response.ok ? "Message reported to Sella Team." : data.error || "Message could not be reported.");
  }

  return <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
    <section className="app-card overflow-hidden"><div className="border-b border-line p-5"><p className="eyebrow text-kola">Messages</p><h1 className="display mt-2 text-2xl">Your chats</h1><p className="mt-2 text-xs leading-5 text-muted">Chat unlocks after a paid order. One thread stays open for future orders with the same store.</p></div><div className="divide-y divide-line">{threads.length ? threads.map((thread) => <button key={thread.id} type="button" onClick={() => setActiveId(thread.id)} className={`flex w-full items-start gap-3 p-4 text-left ${activeId === thread.id ? "bg-kola-light" : "hover:bg-surface"}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-kola text-sm font-extrabold text-white">{thread.stores?.name?.charAt(0)?.toUpperCase() || "S"}</span><span className="min-w-0"><strong className="block truncate text-sm">{thread.stores?.name || "Store"}</strong><span className="mt-1 block text-[11px] text-muted">{timeLabel(thread.last_message_at)}</span></span></button>) : <div className="p-6 text-center"><MessageCircle size={24} className="mx-auto text-muted" /><p className="mt-3 text-sm font-extrabold">No unlocked chats yet</p><p className="mt-2 text-xs leading-5 text-muted">After your first paid order with a store, you can message its seller here.</p></div>}</div></section>
    <section className="app-card flex min-h-[560px] flex-col overflow-hidden">{conversation ? <><header className="flex items-center gap-3 border-b border-line p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-kola text-lg font-extrabold text-white">{conversation.stores?.name?.charAt(0)?.toUpperCase() || "S"}</span><div><h2 className="font-extrabold">{conversation.stores?.name || "Store"}</h2><p className="mt-1 text-xs text-muted">Order questions and updates stay inside Sella.</p></div></header><div className="flex-1 space-y-3 overflow-y-auto bg-surface/50 p-4 sm:p-6">{messages.map((message) => message.kind === "system" ? <div key={message.id} className="mx-auto max-w-md rounded-2xl bg-kola-light px-4 py-3 text-center text-xs font-semibold leading-5 text-kola">{message.body}<p className="mt-1 text-[10px] font-normal opacity-70">{timeLabel(message.created_at)}</p></div> : <div key={message.id} className={`group flex ${message.sender_id === userId ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.sender_id === userId ? "bg-kola text-white" : "bg-white text-ink"}`}>{message.image_url && <img src={message.image_url} alt="Chat attachment" className="mb-2 max-h-64 rounded-xl object-cover" />}{message.body && <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>}<div className="mt-2 flex items-center justify-between gap-4 text-[10px] opacity-70"><span>{timeLabel(message.created_at)}</span><button type="button" onClick={() => report(message.id)} className="inline-flex items-center gap-1 hover:opacity-100" title="Report this message"><Flag size={11} />Report</button></div></div></div>)}<div ref={bottomRef} /></div><form onSubmit={send} className="border-t border-line p-4"><div className="flex items-end gap-2"><label htmlFor="chat-image" className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-surface text-kola" title="Attach image"><ImagePlus size={18} /><input id="chat-image" type="file" accept="image/*" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} placeholder={file ? `Ready to send ${file.name}` : "Write a message…"} className="input min-h-11 flex-1 resize-none" /><button type="submit" disabled={busy || (!draft.trim() && !file)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-kola text-white disabled:opacity-40" aria-label="Send message"><Send size={17} /></button></div>{error && <p className="mt-3 text-xs font-bold text-kola">{error}</p>}</form></> : <div className="m-auto max-w-sm px-6 text-center"><MessageCircle size={32} className="mx-auto text-muted" /><h2 className="mt-4 text-lg font-extrabold">Select a conversation</h2><p className="mt-2 text-sm leading-6 text-muted">{role === "buyer" ? "Open chat from a paid order, or choose a conversation on the left." : "Paid buyer conversations will appear here."}</p>{error && <p className="mt-4 text-xs font-bold text-kola">{error}</p>}</div>}</section>
  </div>;
}
