import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FX/Gold Trading Signal Engine",
  description: "Forex + XAU/USD day-trading signal engine — H1 trend filter, M15 setup, M5 trigger, OANDA market data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}