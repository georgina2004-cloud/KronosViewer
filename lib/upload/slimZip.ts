import JSZip from "jszip";

// Carpetas que el servidor NUNCA despliega (las ignora en processor.ts) y que
// solo inflan el ZIP. Se eliminan en el navegador antes de subir para no chocar
// con el límite de tamaño de Supabase Storage.
const SKIP_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".cache",
  "__MACOSX",
  ".turbo",
  ".vercel",
]);

export type LargeFile = { name: string; size: number };

export type SlimZipResult = {
  blob: Blob;
  fileName: string;
  removedHeavyDirs: boolean;
  originalSize: number;
  slimSize: number;
  largestFiles: LargeFile[];
};

function shouldSkip(relativePath: string): boolean {
  const segments = relativePath.split("/");
  return segments.some((segment) => SKIP_SEGMENTS.has(segment));
}

// Reempaqueta el ZIP omitiendo node_modules, .git, .next, etc. Solo se leen
// (descomprimen) los archivos que se conservan, así que aunque node_modules sea
// enorme no se procesa: el reempaquetado es rápido.
export async function slimZipFile(file: File): Promise<SlimZipResult> {
  const source = await JSZip.loadAsync(file);
  const output = new JSZip();

  let removedHeavyDirs = false;
  let keptFiles = 0;
  const sizes: LargeFile[] = [];

  const entries = Object.values(source.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    if (shouldSkip(entry.name)) {
      removedHeavyDirs = true;
      continue;
    }
    const content = await entry.async("uint8array");
    output.file(entry.name, content, {
      date: entry.date ?? undefined,
    });
    sizes.push({ name: entry.name, size: content.byteLength });
    keptFiles += 1;
  }

  if (keptFiles === 0) {
    throw new Error(
      "El ZIP no contiene archivos desplegables tras excluir node_modules y carpetas de build.",
    );
  }

  const blob = await output.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  const largestFiles = sizes
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  return {
    blob,
    fileName: file.name,
    removedHeavyDirs,
    originalSize: file.size,
    slimSize: blob.size,
    largestFiles,
  };
}
