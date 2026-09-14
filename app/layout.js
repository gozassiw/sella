import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/config";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: `${BRAND} — Shop independent. Sell simply.`,
  description: "Sell and buy with people you can trust, with store access, payments, fulfilment, and business tools in one simple app.",
  icons: { icon: "/brand/sella-favicon.png", apple: "/brand/sella-favicon.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: BRAND, statusBarStyle: "default" },
};

export default function RootLayout({ children }) {
  return <html lang="en" className={jakarta.variable}><body className="font-sans"><ServiceWorkerRegister />{children}</body></html>;
}
