import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // No incluir /api/*: el middleware de Supabase reescribe el request y rompe
  // el parseo de multipart/form-data (error "Failed to parse body as FormData").
  matcher: [
    "/dashboard/:path*",
    "/proyectos/:path*",
    "/perfil/:path*",
    "/login",
  ],
};
