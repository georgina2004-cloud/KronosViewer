'use client';

import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { createClient } from "@/lib/supabase/client"; // <-- Importación corregida apuntando a la estructura de Cursor

export default function LoginPage() {
  // Inicializamos el cliente usando la función oficial de tu archivo lib
  const supabase = createClient(); 

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`, 
      },
    });
    
    if (error) console.error("Error al conectar con Google:", error.message);
  };

  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-zinc-500">
          Cargando…
        </div>
      }
    >
      <LoginForm onGoogleLogin={handleGoogleLogin} />
    </Suspense>
  );
}