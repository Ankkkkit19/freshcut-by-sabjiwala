import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "FreshCut by Sabjiwala — Fresh vegetables, fresh cuts, delivered fresh",
    template: "%s | FreshCut",
  },
  description:
    "Order farm fresh vegetables, fruits, leafy greens, ready-to-cook cut vegetables, salads and dairy from FreshCut by Sabjiwala. Delivered in 45 minutes in Mumbai, Bengaluru and Delhi.",
  keywords: [
    "fresh vegetables online",
    "cut vegetables delivery",
    "sabji delivery",
    "ready to cook",
    "FreshCut",
    "Sabjiwala",
  ],
  openGraph: {
    title: "FreshCut by Sabjiwala",
    description: "Fresh vegetables. Fresh cuts. Delivered fresh.",
    type: "website",
    images: ["/images/hero-basket.jpg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1c6d3d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-cream font-sans text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
