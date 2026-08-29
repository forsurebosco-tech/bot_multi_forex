import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OANDA Signal Terminal · FX / XAU",
  description:
    "Forex + XAU/USD day-trading signal terminal — H1 trend filter, M15 setup, M5 trigger, structure sweeps, AI commentary, OANDA practice data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}