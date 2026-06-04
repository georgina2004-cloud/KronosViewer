"use client";

import { useCallback, useRef, useState } from "react";

export type DropzoneStatus = "idle" | "dragging" | "uploading" | "success" | "error";

type DropzoneProps = {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  status?: DropzoneStatus;
  message?: string;
};

export function Dropzone({
  onFileSelect,
  disabled = false,
  status = "idle",
  message,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setLocalError(null);
      if (!file.name.toLowerCase().endsWith(".zip")) {
        setLocalError("Solo se permiten archivos .zip");
        return;
      }
      setFileName(file.name);
      onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (disabled || status === "uploading") return;

      const file = e.dataTransfer.files?.[0];
      if (file) validateAndSelect(file);
    },
    [disabled, status, validateAndSelect],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  };

  const isUploading = status === "uploading";
  const displayMessage =
    message ?? localError ?? (status === "success" ? "Carga completada" : null);

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        className={[
          "flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragActive || status === "dragging"
            ? "border-indigo-500 bg-indigo-50"
            : "border-zinc-300 bg-zinc-50 hover:border-indigo-400 hover:bg-indigo-50/50",
          disabled || isUploading ? "pointer-events-none opacity-60" : "",
          status === "error" ? "border-red-400 bg-red-50" : "",
          status === "success" ? "border-emerald-400 bg-emerald-50" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          disabled={disabled || isUploading}
          onChange={handleChange}
        />

        {isUploading ? (
          <>
            <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-sm font-medium text-zinc-700">
              Subiendo y desplegando…
            </p>
            {fileName && (
              <p className="mt-1 text-xs text-zinc-500">{fileName}</p>
            )}
          </>
        ) : (
          <>
            <svg
              className="mb-3 h-10 w-10 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-medium text-zinc-800">
              Arrastra tu archivo .zip aquí
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              o haz clic para seleccionar · debe incluir index.html en la raíz
            </p>
            {fileName && !localError && (
              <p className="mt-3 rounded-md bg-white px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm">
                {fileName}
              </p>
            )}
          </>
        )}
      </div>

      {displayMessage && (
        <p
          className={`mt-2 text-sm ${
            status === "error" || localError
              ? "text-red-600"
              : status === "success"
                ? "text-emerald-600"
                : "text-zinc-600"
          }`}
        >
          {displayMessage}
        </p>
      )}
    </div>
  );
}
