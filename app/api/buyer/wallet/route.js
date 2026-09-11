import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBuyerWallet } from "@/lib/buyer";
export async function POST() { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 }); try { const wallet = await generateBuyerWallet(user); return NextResponse.json(wallet); } catch (error) { return NextResponse.json({ error: error.message || "Unable to generate a funding account." }, { status: 400 }); } }
