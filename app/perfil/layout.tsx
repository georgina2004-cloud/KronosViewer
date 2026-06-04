import { AppShell } from "@/components/layout/AppShell";

export default function PerfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
