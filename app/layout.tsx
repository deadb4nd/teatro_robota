import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grafik Teatro",
  description:
    "Grafik weekendowy, dostępność osób, godziny wyjścia i miesięczne podsumowanie.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
