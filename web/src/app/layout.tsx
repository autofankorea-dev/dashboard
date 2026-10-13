import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationPendingProvider } from "@/components/layout/navigation-pending-provider";
import { ViewportPreviewBootstrap } from "@/components/layout/viewport-preview-bootstrap";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "스마트 축사 IoT",
  description: "스마트 축사 IoT 모니터링 및 제어 대시보드",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "축사 IoT",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      data-viewport-preview="desktop"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-muted/30 dark:bg-background">
        <Script id="dashboard-theme-init" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("dashboard-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}`}
        </Script>
        <Script id="dashboard-viewport-init" strategy="beforeInteractive">
          {`try{var k="dashboard-viewport-preview";var v=localStorage.getItem(k);var pref=(v==="mobile"||v==="desktop")?v:"auto";var mobile=window.matchMedia("(max-width: 767px)").matches;var mode=pref==="auto"?(mobile?"mobile":"desktop"):pref;document.documentElement.dataset.viewportPreview=mode}catch(e){document.documentElement.dataset.viewportPreview=window.matchMedia("(max-width: 767px)").matches?"mobile":"desktop"}try{var w=window.innerWidth;document.documentElement.dataset.pcBand=w>=1920?"wide":w>=1280?"desk":"narrow"}catch(e){}`}
        </Script>
        <ViewportPreviewBootstrap />
        <TooltipProvider>
          <NavigationPendingProvider>{children}</NavigationPendingProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
