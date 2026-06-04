export async function uploadProfileAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/profile/avatar", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as { url?: string; error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo subir la foto de perfil.");
  }

  if (!payload.url) {
    throw new Error("La respuesta del servidor no incluyó la URL del avatar.");
  }

  return payload.url;
}
