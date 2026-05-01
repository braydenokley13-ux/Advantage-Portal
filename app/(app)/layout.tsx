import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { MobileTabbar } from "@/components/shell/mobile-tabbar";
import { AuthGate } from "@/components/shell/auth-gate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="min-h-screen flex bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 min-w-0 pb-20 md:pb-6">{children}</main>
          <MobileTabbar />
        </div>
      </div>
    </AuthGate>
  );
}
