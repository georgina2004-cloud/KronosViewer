import AdmZip from "adm-zip";
import { execSync } from "child_process";
import fs from "fs";
import mime from "mime-types";
import os from "os";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createIsolatedBuildEnv } from "@/lib/upload/build-env";
import { removeWorkDirectory } from "@/lib/upload/cleanup";
import { ensureNextExportOutput } from "@/lib/upload/next-config";
import {
  BUCKET_PRIVADO,
  BUCKET_PUBLICO,
  mimeFromPath,
  publicStorageUrl,
} from "@/lib/utils";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "__MACOSX",
  ".cache",
]);

const NPM_TIMEOUT_MS = 10 * 60 * 1000;
const BUILD_TIMEOUT_MS = 15 * 60 * 1000;

export type ProcessUploadInput = {
  zipBuffer: Buffer;
  zipFileName: string;
  proyectoId: string;
  versionTag: string;
  slug: string;
  admin: SupabaseClient;
};

export type ProcessUploadResult = {
  version: Record<string, unknown>;
  ruta_visor: string;
};

export async function processZipUpload(
  input: ProcessUploadInput,
): Promise<ProcessUploadResult> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "kronos-upload-"));
  const extractDir = path.join(workDir, "extracted");

  try {
    fs.mkdirSync(extractDir, { recursive: true });
    const zip = new AdmZip(input.zipBuffer);
    zip.extractAllTo(extractDir, true);

    const contentRoot = resolveContentRoot(extractDir);
    const packageRoot = findPackageJsonRoot(contentRoot);
    const storagePrefix = `${input.slug}/${input.versionTag}`;

    let deployDir: string;
    let mainHtmlRelative: string;

    if (packageRoot && isNextJsProject(packageRoot)) {
      prepareNextProjectForExport(packageRoot);
      runNextProductionBuild(packageRoot);
      deployDir = path.join(packageRoot, "out");
      if (!fs.existsSync(deployDir)) {
        throw new Error(
          "El build de Next.js no generó la carpeta 'out'. Verifica que el proyecto soporte export estático.",
        );
      }
      mainHtmlRelative = resolveMainHtmlPath(deployDir);
    } else {
      deployDir = contentRoot;
      mainHtmlRelative = resolveMainHtmlPath(deployDir);
    }

    await uploadDirectoryRecursive(
      input.admin,
      deployDir,
      storagePrefix,
    );

    const zipStoragePath = `${storagePrefix}/${sanitizeFileName(input.zipFileName)}`;
    const { error: zipBackupError } = await input.admin.storage
      .from(BUCKET_PRIVADO)
      .upload(zipStoragePath, input.zipBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    if (zipBackupError) {
      throw new Error(`Error al respaldar ZIP: ${zipBackupError.message}`);
    }

    const rutaVisor = publicStorageUrl(
      `${storagePrefix}/${mainHtmlRelative}`,
    );

    const { data: version, error: insertError } = await input.admin
      .from("versiones")
      .insert({
        proyecto_id: input.proyectoId,
        version_tag: input.versionTag,
        ruta_visor: rutaVisor,
        ruta_zip_storage: zipStoragePath,
      })
      .select(
        "id, proyecto_id, version_tag, ruta_visor, ruta_zip_storage, fecha_subida",
      )
      .single();

    if (insertError) {
      throw new Error(`Error al registrar versión: ${insertError.message}`);
    }

    return {
      version: version as Record<string, unknown>,
      ruta_visor: rutaVisor,
    };
  } finally {
    await removeWorkDirectory(workDir);
  }
}

function resolveContentRoot(extractDir: string): string {
  const entries = fs
    .readdirSync(extractDir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && entry.name !== "__MACOSX");

  if (entries.length === 1 && entries[0].isDirectory()) {
    return path.join(extractDir, entries[0].name);
  }

  return extractDir;
}

function findPackageJsonRoot(dir: string, depth = 0): string | null {
  if (depth > 4) return null;

  const packagePath = path.join(dir, "package.json");
  if (fs.existsSync(packagePath)) {
    return dir;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const nested = findPackageJsonRoot(path.join(dir, entry.name), depth + 1);
    if (nested) return nested;
  }

  return null;
}

function isNextJsProject(projectRoot: string): boolean {
  const packagePath = path.join(projectRoot, "package.json");
  const raw = fs.readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Boolean(deps.next);
}

function prepareNextProjectForExport(projectRoot: string): void {
  ensureNextExportOutput(projectRoot);
  sanitizePackageJsonScripts(projectRoot);
}

function sanitizePackageJsonScripts(projectRoot: string): void {
  const packagePath = path.join(projectRoot, "package.json");
  const raw = fs.readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(raw) as {
    scripts?: Record<string, string>;
  };

  if (!pkg.scripts) return;

  for (const scriptName of Object.keys(pkg.scripts)) {
    const script = pkg.scripts[scriptName];
    if (typeof script !== "string") continue;
    pkg.scripts[scriptName] = script
      .replace(/\s*--turbopack\b/g, "")
      .replace(/\s*--turbo\b/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

function runNextProductionBuild(projectRoot: string): void {
  const env = createIsolatedBuildEnv();
  const nextBin = path.join(
    projectRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const buildCommand = fs.existsSync(nextBin)
    ? `node "${nextBin}" build`
    : "npx --no-install next build";

  try {
    execSync("npm install", {
      cwd: projectRoot,
      stdio: "pipe",
      encoding: "utf8",
      timeout: NPM_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      env,
      shell: getExecShell(),
    });
  } catch (error) {
    throw formatExecError("npm install", error);
  }

  try {
    execSync(buildCommand, {
      cwd: projectRoot,
      stdio: "pipe",
      encoding: "utf8",
      timeout: BUILD_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      env,
      shell: getExecShell(),
    });
  } catch (error) {
    throw formatExecError(buildCommand, error);
  }
}

function getExecShell(): string {
  return process.platform === "win32"
    ? process.env.ComSpec ?? "cmd.exe"
    : "/bin/sh";
}

function formatExecError(command: string, error: unknown): Error {
  if (error && typeof error === "object") {
    const execError = error as {
      stderr?: string | Buffer;
      stdout?: string | Buffer;
      message?: string;
    };
    const stderr =
      typeof execError.stderr === "string"
        ? execError.stderr
        : execError.stderr?.toString();
    const stdout =
      typeof execError.stdout === "string"
        ? execError.stdout
        : execError.stdout?.toString();
    const detail = stderr?.trim() || stdout?.trim() || execError.message;
    return new Error(`Falló ${command}: ${detail ?? "error desconocido"}`);
  }
  return new Error(`Falló ${command}`);
}

function resolveMainHtmlPath(rootDir: string): string {
  const htmlFiles = collectHtmlFiles(rootDir, rootDir);

  if (htmlFiles.length === 0) {
    throw new Error(
      "No se encontró ningún archivo HTML en el contenido desplegable.",
    );
  }

  const indexMatch = htmlFiles.find(
    (file) => path.basename(file.rel).toLowerCase() === "index.html",
  );
  if (indexMatch) {
    return indexMatch.rel;
  }

  htmlFiles.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.rel.localeCompare(b.rel);
  });

  return htmlFiles[0].rel;
}

function collectHtmlFiles(
  dir: string,
  baseDir: string,
  depth = 0,
): { rel: string; depth: number }[] {
  const results: { rel: string; depth: number }[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;

    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(absolute, baseDir, depth + 1));
      continue;
    }

    if (!/\.html?$/i.test(entry.name)) continue;

    const rel = path.relative(baseDir, absolute).split(path.sep).join("/");
    results.push({ rel, depth: rel.split("/").length });
  }

  return results;
}

async function uploadDirectoryRecursive(
  admin: SupabaseClient,
  localDir: string,
  storagePrefix: string,
): Promise<void> {
  const files = collectFiles(localDir);

  for (const absolutePath of files) {
    const relativePath = path
      .relative(localDir, absolutePath)
      .split(path.sep)
      .join("/");
    const storagePath = `${storagePrefix}/${relativePath}`;
    const fileBuffer = fs.readFileSync(absolutePath);
    const contentType = resolveContentType(relativePath);

    const { error } = await admin.storage
      .from(BUCKET_PUBLICO)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Error al subir ${relativePath}: ${error.message}`);
    }
  }
}

function collectFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolute));
    } else {
      files.push(absolute);
    }
  }

  return files;
}

function resolveContentType(relativePath: string): string {
  const fromMimeTypes = mime.lookup(relativePath);
  if (typeof fromMimeTypes === "string") {
    return fromMimeTypes;
  }
  return mimeFromPath(relativePath);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
