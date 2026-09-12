import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/config";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: `${BRAND} — Shop independent. Sell simply.`,
  description: "Discover independent stores, follow products you love, and run your own business from one simple app.",
  icons: { icon: "/brand/sella-mark.png", apple: "/brand/sella-mark.png" },
};

export default function RootLayout({ children }) {
  return <html lang="en" className={jakarta.variable}><body className="font-sans">{children}</body></html>;
}
