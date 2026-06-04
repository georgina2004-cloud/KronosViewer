import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PRIVADO } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get("versionId");

    if (!versionId) {
      return NextResponse.json(
        { error: "versionId es obligatorio" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: version, error } = await admin
      .from("versiones")
      .select("ruta_zip_storage, version_tag")
      .eq("id", versionId)
      .single();

    if (error || !version?.ruta_zip_storage) {
      return NextResponse.json(
        { error: "Versión no encontrada" },
        { status: 404 },
      );
    }

    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET_PRIVADO)
      .createSignedUrl(version.ruta_zip_storage as string, 3600);

    if (signError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signError?.message ?? "No se pudo generar la URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      signedUrl: signed.signedUrl,
      filename: `${version.version_tag}.zip`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
