import AdmZip from "adm-zip";
import { execSync } from "child_process";
import fs from "fs";
import mime from "mime-types";
import os from "os";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createIsolatedBuildEnv } from "@/lib/upload/build-env";
import { removeWorkDirectory } from "@/lib/upload/cleanup";
import { ensureNextExportOutput } from "@/lib/upload/nextExportConfig";
import {
  BUCKET_PRIVADO,
  BUCKET_PUBLICO,
  mimeFromPath,
  viewerPathForObject,
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
  existingZipStoragePath?: string;
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
  const extractDir = path.join(/*turbopackIgnore: true*/ workDir, "extracted");

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
      deployDir = resolveExistingBuildOutputDir(packageRoot) ?? "";
      if (!deployDir) {
        prepareNextProjectForExport(packageRoot);
        try {
          runNextProductionBuild(packageRoot);
        } catch (error) {
          throw withPrebuiltFallbackHint(error);
        }
        deployDir = path.join(packageRoot, "out");
        if (!fs.existsSync(deployDir)) {
          throw new Error(
            "El build de Next.js no generó la carpeta 'out'. Verifica que el proyecto soporte export estático.",
          );
        }
      }
      mainHtmlRelative = resolveMainHtmlPath(deployDir);
    } else if (packageRoot && shouldBuildFramework(packageRoot)) {
      // Si el ZIP ya incluye una salida estática (dist/build/out), se usa
      // directamente y se evita instalar node_modules en el entorno serverless.
      deployDir = resolveExistingBuildOutputDir(packageRoot) ?? "";
      if (!deployDir) {
        // Framework que requiere build (Vite, CRA, Angular, Vue, Astro, etc.):
        // se ejecuta su comando de build y se despliega la carpeta de salida.
        try {
          runGenericBuild(packageRoot);
        } catch (error) {
          throw withPrebuiltFallbackHint(error);
        }
        deployDir = resolveBuildOutputDir(packageRoot);
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

    let zipStoragePath = input.existingZipStoragePath;
    if (!zipStoragePath) {
      zipStoragePath = `${storagePrefix}/${sanitizeFileName(input.zipFileName)}`;
      const { error: zipBackupError } = await input.admin.storage
        .from(BUCKET_PRIVADO)
        .upload(zipStoragePath, input.zipBuffer, {
          contentType: "application/zip",
          upsert: true,
        });

      if (zipBackupError) {
        throw new Error(`Error al respaldar ZIP: ${zipBackupError.message}`);
      }
    }

    const rutaVisor = viewerPathForObject(
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
    return path.join(/*turbopackIgnore: true*/ extractDir, entries[0].name);
  }

  return extractDir;
}

function findPackageJsonRoot(dir: string, depth = 0): string | null {
  if (depth > 4) return null;

  const packagePath = path.join(/*turbopackIgnore: true*/ dir, "package.json");
  if (fs.existsSync(packagePath)) {
    return dir;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const nested = findPackageJsonRoot(
      path.join(/*turbopackIgnore: true*/ dir, entry.name),
      depth + 1,
    );
    if (nested) return nested;
  }

  return null;
}

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readPackageJson(projectRoot: string): PackageJson {
  const packagePath = path.join(
    /*turbopackIgnore: true*/ projectRoot,
    "package.json",
  );
  const raw = fs.readFileSync(packagePath, "utf8");
  return JSON.parse(raw) as PackageJson;
}

function allDeps(pkg: PackageJson): Record<string, string> {
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

function isNextJsProject(projectRoot: string): boolean {
  return Boolean(allDeps(readPackageJson(projectRoot)).next);
}

function hasBuildScript(projectRoot: string): boolean {
  const build = readPackageJson(projectRoot).scripts?.build;
  return typeof build === "string" && build.trim().length > 0;
}

// Dependencias de frameworks que SIEMPRE requieren un build aunque traigan un
// index.html en la raíz (p. ej. Vite usa index.html como entrada de desarrollo).
const FRAMEWORK_DEPS = new Set([
  "vite",
  "react-scripts",
  "@craco/craco",
  "@angular/cli",
  "@angular-devkit/build-angular",
  "@vue/cli-service",
  "@sveltejs/kit",
  "svelte",
  "astro",
  "gatsby",
  "parcel",
  "@parcel/core",
  "nuxt",
  "@11ty/eleventy",
  "vitepress",
  "vuepress",
  "preact-cli",
]);

function isFrameworkProject(projectRoot: string): boolean {
  const deps = allDeps(readPackageJson(projectRoot));
  return Object.keys(deps).some((dep) => FRAMEWORK_DEPS.has(dep));
}

function hasTopLevelIndexHtml(dir: string): boolean {
  return fs.existsSync(path.join(/*turbopackIgnore: true*/ dir, "index.html"));
}

// Decide si hay que construir: el proyecto debe tener un script de build y, o
// bien no incluye un index.html listo en la raíz, o es un framework conocido
// que igual necesita compilarse.
function shouldBuildFramework(projectRoot: string): boolean {
  if (!hasBuildScript(projectRoot)) return false;
  return !hasTopLevelIndexHtml(projectRoot) || isFrameworkProject(projectRoot);
}

function prepareNextProjectForExport(projectRoot: string): void {
  ensureNextExportOutput(projectRoot);
  sanitizePackageJsonScripts(projectRoot);
}

function sanitizePackageJsonScripts(projectRoot: string): void {
  const packagePath = path.join(
    /*turbopackIgnore: true*/ projectRoot,
    "package.json",
  );
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

// Importante: el build necesita las devDependencies (tailwindcss, postcss,
// tipos, etc.). Como NODE_ENV=production hace que npm las omita, se fuerza su
// instalación con --include=dev / --production=false.
const INSTALL_COMMAND =
  "npm install --include=dev --no-audit --no-fund";

type ProjectBuildEnvPaths = {
  cacheDir: string;
  homeDir: string;
  tmpDir: string;
};

function createProjectBuildEnvPaths(projectRoot: string): ProjectBuildEnvPaths {
  const envRoot = path.join(
    /*turbopackIgnore: true*/ projectRoot,
    ".kronos-build-env",
  );
  const paths = {
    cacheDir: path.join(/*turbopackIgnore: true*/ envRoot, "npm-cache"),
    homeDir: path.join(/*turbopackIgnore: true*/ envRoot, "home"),
    tmpDir: path.join(/*turbopackIgnore: true*/ envRoot, "tmp"),
  };

  fs.mkdirSync(paths.cacheDir, { recursive: true });
  fs.mkdirSync(paths.homeDir, { recursive: true });
  fs.mkdirSync(paths.tmpDir, { recursive: true });
  return paths;
}

function cleanupBuildEnvPaths(projectRoot: string): void {
  const envRoot = path.join(
    /*turbopackIgnore: true*/ projectRoot,
    ".kronos-build-env",
  );
  fs.rmSync(/*turbopackIgnore: true*/ envRoot, {
    recursive: true,
    force: true,
  });
}

function cleanupLegacyNpmCache(): void {
  // Versiones anteriores usaban /tmp/.npm como cache global. En Vercel esa
  // carpeta puede sobrevivir en lambdas calientes y provocar ENOSPC.
  if (process.platform === "win32") return;
  fs.rmSync("/tmp/.npm", { recursive: true, force: true });
}

function execInProject(
  command: string,
  projectRoot: string,
  timeoutMs: number,
  envPaths: ProjectBuildEnvPaths,
): void {
  try {
    execSync(command, {
      cwd: projectRoot,
      stdio: "pipe",
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      env: createIsolatedBuildEnv(envPaths),
      shell: getExecShell(),
    });
  } catch (error) {
    throw formatExecError(command, error);
  }
}

function installDependencies(projectRoot: string): ProjectBuildEnvPaths {
  cleanupLegacyNpmCache();
  const envPaths = createProjectBuildEnvPaths(projectRoot);
  try {
    execInProject(INSTALL_COMMAND, projectRoot, NPM_TIMEOUT_MS, envPaths);
  } catch (error) {
    cleanupBuildEnvPaths(projectRoot);
    throw error;
  }

  // La cache ya no se necesita después de instalar y puede ocupar cientos de MB.
  fs.rmSync(/*turbopackIgnore: true*/ envPaths.cacheDir, {
    recursive: true,
    force: true,
  });
  return envPaths;
}

function runNextProductionBuild(projectRoot: string): void {
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

  const envPaths = installDependencies(projectRoot);
  try {
    execInProject(buildCommand, projectRoot, BUILD_TIMEOUT_MS, envPaths);
  } finally {
    cleanupBuildEnvPaths(projectRoot);
  }
}

// Build genérico para frameworks no-Next (Vite, CRA, Angular, Vue, Astro, ...).
function runGenericBuild(projectRoot: string): void {
  const envPaths = installDependencies(projectRoot);
  try {
    execInProject("npm run build", projectRoot, BUILD_TIMEOUT_MS, envPaths);
  } finally {
    cleanupBuildEnvPaths(projectRoot);
  }
}

// Carpetas donde los frameworks suelen dejar el sitio estático ya compilado.
const BUILD_OUTPUT_CANDIDATES = [
  "dist",
  "build",
  "out",
  "public",
  "www",
  "_site",
  ".output/public",
  ".vitepress/dist",
  "docs/.vitepress/dist",
];

const PREBUILT_OUTPUT_CANDIDATES = BUILD_OUTPUT_CANDIDATES.filter(
  (candidate) => candidate !== "public",
);

function resolveExistingBuildOutputDir(projectRoot: string): string | null {
  for (const candidate of PREBUILT_OUTPUT_CANDIDATES) {
    const base = path.join(/*turbopackIgnore: true*/ projectRoot, candidate);
    if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) continue;
    const indexDir = findDirWithIndexHtml(base);
    if (indexDir) return indexDir;
  }

  return null;
}

function resolveBuildOutputDir(projectRoot: string): string {
  for (const candidate of BUILD_OUTPUT_CANDIDATES) {
    const base = path.join(/*turbopackIgnore: true*/ projectRoot, candidate);
    if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) continue;
    const indexDir = findDirWithIndexHtml(base);
    if (indexDir) return indexDir;
  }

  throw new Error(
    "El build se ejecutó pero no se encontró una carpeta de salida con index.html " +
      "(se buscó en dist, build, out, public, .output/public, etc.). " +
      "Revisa el comando o la configuración de build del framework.",
  );
}

function withPrebuiltFallbackHint(error: unknown): Error {
  const message =
    error instanceof Error ? error.message : "Error desconocido durante el build.";

  if (/ENOSPC|no space left on device/i.test(message)) {
    return new Error(
      `${message}\n\n` +
        "Este prototipo necesita más espacio del disponible para instalar dependencias en Vercel. " +
        "Solución recomendada: ejecuta el build localmente (por ejemplo `npm install && npm run build`) " +
        "y sube un ZIP que incluya la carpeta generada (`dist`, `build` u `out`) o sube directamente esa carpeta comprimida.",
    );
  }

  return error instanceof Error ? error : new Error(message);
}

// Devuelve el directorio que contiene el index.html menos profundo (maneja
// salidas anidadas como dist/<app>/browser de Angular).
function findDirWithIndexHtml(rootDir: string): string | null {
  const indexFiles = collectHtmlFiles(rootDir, rootDir)
    .filter((file) => path.basename(file.rel).toLowerCase() === "index.html")
    .sort((a, b) => a.depth - b.depth);

  if (indexFiles.length === 0) return null;

  return path.join(
    /*turbopackIgnore: true*/ rootDir,
    path.dirname(indexFiles[0].rel),
  );
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
    if (detail && /ENOSPC|no space left on device/i.test(detail)) {
      return new Error(
        `Falló ${command}: el servidor se quedó sin espacio temporal durante la instalación/build. ` +
          "Se limpió la cache de npm por upload, pero este prototipo aún puede tener dependencias demasiado pesadas para el entorno serverless. " +
          `Detalle: ${detail}`,
      );
    }
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

    const absolute = path.join(/*turbopackIgnore: true*/ dir, entry.name);

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

    const absolute = path.join(/*turbopackIgnore: true*/ dir, entry.name);
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
