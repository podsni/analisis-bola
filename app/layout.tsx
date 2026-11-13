import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CommandBar } from "@/components/CommandBar";
import { StatusBar } from "@/components/StatusBar";
import { Ticker } from "@/components/Ticker";

export const maxDuration = 60;

export const metadata: Metadata = {
  title: {
    default: "ANALISIS-BOLA TERMINAL",
    template: "%s · ANALISIS-BOLA",
  },
  description:
    "Terminal analisis sepak bola: klasemen, riwayat, dan estimasi statistik Dixon-Coles. Bukan situs taruhan.",
  robots: { index: true, follow: true },
};

export const revalidate = 300;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="bb-shell">
          <CommandBar />
          <Ticker />
          <main className="bb-main">{children}</main>
          <StatusBar />
        </div>
      </body>
    </html>
  );
}
