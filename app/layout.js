import { DM_Serif_Display, Manrope } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/config";
const display = DM_Serif_Display({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: "400" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap", weight: ["400", "500", "600", "700"] });
export const metadata = { title: `${BRAND} — Your business, online and organised`, description: "Create an online store, record sales, track stock and manage customers from one app.", icons: { icon: "/brand/sella-mark.png", apple: "/brand/sella-mark.png" } };
export default function RootLayout({ children }) { return <html lang="en" className={`${display.variable} ${body.variable}`}><body className="font-sans">{children}</body></html>; }
