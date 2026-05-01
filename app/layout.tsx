import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/lib/role-context";
import { StoreProvider } from "@/lib/store";
import { SessionProvider } from "@/lib/session";
import { ApiClientProvider } from "@/lib/api/provider";

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <StoreProvider>
          <SessionProvider>
            <ApiClientProvider>
              <RoleProvider>{children}</RoleProvider>
            </ApiClientProvider>
          </SessionProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
