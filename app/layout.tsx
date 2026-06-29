import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RoleProvider } from "@/lib/role-context";
import { StoreProvider } from "@/lib/store";
import { SessionProvider } from "@/lib/session";
import { ApiClientProvider } from "@/lib/api/provider";
import { SiteConfigProvider } from "@/lib/site-config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Advantage Portal",
  description: "Journal Writing Team Management Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <StoreProvider>
          <SessionProvider>
            <ApiClientProvider>
              <SiteConfigProvider>
                <RoleProvider>{children}</RoleProvider>
              </SiteConfigProvider>
            </ApiClientProvider>
          </SessionProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
