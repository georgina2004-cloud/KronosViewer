import { AppShell } from "@/components/layout/AppShell";

export default function ProyectosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
