import { ApiTokensCard } from "@/components/perfil/ApiTokensCard";
import { ProfileView } from "@/components/perfil/ProfileView";
import { DeleteAccountCard } from "@/components/perfil/DeleteAccountCard";

export default function PerfilPage() {
  return (
    <div className="min-h-full bg-[#F0EFFF]">
      <ProfileView />
      <ApiTokensCard />
      <DeleteAccountCard />
    </div>
  );
}
