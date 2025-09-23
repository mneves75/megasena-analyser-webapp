import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Mega-Sena Analyzer",
  description:
    "Dashboard estatístico e gerador de apostas otimizadas para a Mega-Sena.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="bg-[rgb(var(--background))]">
      <body
        className={`${inter.variable} antialiased min-h-screen bg-[rgb(var(--background))]`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
