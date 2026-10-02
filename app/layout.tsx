import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ME ON GO",
  description: "Your life, in motion. A private, personal timeline.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#090a0b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
