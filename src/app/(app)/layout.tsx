import AppShell from "@/components/AppShell";
import { UserProvider } from "@/components/UserProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}
