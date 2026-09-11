"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function BuyerSignOutButton() { const router = useRouter(); async function signOut() { await createClient().auth.signOut(); router.push("/"); router.refresh(); } return <button type="button" onClick={signOut} className="text-sm font-semibold text-muted hover:text-kola">Log out</button>; }
