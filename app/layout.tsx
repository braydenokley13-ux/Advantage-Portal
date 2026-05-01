import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/lib/role-context";
import { StoreProvider } from "@/lib/store";

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
          <RoleProvider>{children}</RoleProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
