import { ApiTokensCard } from "@/components/perfil/ApiTokensCard";
import { ProfileView } from "@/components/perfil/ProfileView";

export default function PerfilPage() {
  return (
    <div className="min-h-full bg-[#F0EFFF]">
      <ProfileView />
      <ApiTokensCard />
    </div>
  );
}
