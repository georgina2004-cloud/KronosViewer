import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_AVATARS, publicAvatarUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debes enviar un archivo de imagen" },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Formato no válido. Usa JPG, PNG, WebP o GIF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen no puede superar 2 MB." },
        { status: 400 },
      );
    }

    const ext = EXT_BY_TYPE[file.type] ?? "jpg";
    const objectPath = `${user.id}/avatar.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from(BUCKET_AVATARS)
      .upload(objectPath, buffer, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("[api/profile/avatar] Storage:", uploadError.message);
      return NextResponse.json(
        {
          error:
            uploadError.message.includes("Bucket not found") ||
            uploadError.message.includes("not found")
              ? "El bucket de avatares no está configurado en Supabase. Ejecuta supabase/migrations/0002_avatars_bucket.sql."
              : "No se pudo guardar la imagen.",
        },
        { status: 500 },
      );
    }

    const avatarUrl = `${publicAvatarUrl(objectPath)}?t=${Date.now()}`;

    const { error: updateError } = await supabaseAuth.auth.updateUser({
      data: { avatar_url: avatarUrl },
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ url: avatarUrl });
  } catch (error) {
    console.error("[api/profile/avatar]", error);
    return NextResponse.json(
      { error: "Error interno al subir la foto de perfil." },
      { status: 500 },
    );
  }
}
