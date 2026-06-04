"use client";

import { Camera, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { uploadProfileAvatar } from "@/lib/profile-avatar";

const SIZE_CLASSES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-28 w-28",
} as const;

const SIZE_PX = {
  sm: 32,
  md: 40,
  lg: 112,
} as const;

type ProfileAvatarProps = {
  src: string;
  alt: string;
  size?: keyof typeof SIZE_CLASSES;
  editable?: boolean;
  className?: string;
  ringClassName?: string;
  onUploaded?: (url: string) => void;
  onError?: (message: string) => void;
};

export function ProfileAvatar({
  src,
  alt,
  size = "md",
  editable = false,
  className = "",
  ringClassName = "",
  onUploaded,
  onError,
}: ProfileAvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const displaySrc = preview ?? src;

  const handleFile = async (file: File | undefined) => {
    if (!file || uploading) return;

    setUploading(true);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const url = await uploadProfileAvatar(file);
      URL.revokeObjectURL(localPreview);
      setPreview(url);
      onUploaded?.(url);
    } catch (error) {
      setPreview(null);
      URL.revokeObjectURL(localPreview);
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo subir la foto de perfil.";
      onError?.(message);
    } finally {
      setUploading(false);
    }
  };

  const avatarImage = (
    <Image
      src={displaySrc}
      alt={alt}
      width={SIZE_PX[size]}
      height={SIZE_PX[size]}
      unoptimized
      className="h-full w-full object-cover"
    />
  );

  const core = (
    <div
      className={[
        "relative shrink-0 overflow-hidden rounded-full bg-[#635BFF]",
        SIZE_CLASSES[size],
        ringClassName,
        className,
      ].join(" ")}
    >
      {avatarImage}
      {editable && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/35">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <Camera className="h-5 w-5 text-white opacity-0 transition group-hover:opacity-100" />
          )}
        </span>
      )}
    </div>
  );

  if (!editable) {
    return core;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus-visible:ring-offset-2 disabled:opacity-70"
        aria-label="Cambiar foto de perfil"
      >
        {core}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}
