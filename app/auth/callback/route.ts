import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Si hay un parámetro "next" en la URL redirigimos allí, de lo contrario al dashboard
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // En caso de error de autenticación, redirigimos al login con un parámetro de error
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
