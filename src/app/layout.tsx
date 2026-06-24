import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SplashRemover } from "@/components/app/splash-remover";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RK Global - Fabric ERP",
  description: "ERP for polymer fabric manufacturing",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RK Global ERP",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e1b4b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SplashRemover />
        {children}
      </body>
    </html>
  );
}
