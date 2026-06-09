const TURBO_ENV_KEY =
  /^(NEXT_)?TURBO(PACK)?($|_)|TURBOPACK|__NEXT_PRIVATE.*TURBO/i;

const SAFE_ENV_KEYS = new Set([
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "WINDIR",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "PROGRAMW6432",
  "ComSpec",
  "NODE_PATH",
  "NPM_CONFIG_CACHE",
  "NPM_CONFIG_PREFIX",
  "NPM_CONFIG_USERCONFIG",
  "npm_config_cache",
  "npm_config_prefix",
  "npm_config_user_agent",
  "npm_config_noproxy",
  "npm_execpath",
  "npm_node_execpath",
  "npm_package_json",
  "INIT_CWD",
  "LANG",
  "LC_ALL",
  "TZ",
  "OS",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "PROCESSOR_IDENTIFIER",
  "PROCESSOR_LEVEL",
  "PROCESSOR_REVISION",
]);

export type BuildEnvOptions = {
  cacheDir?: string;
  homeDir?: string;
  tmpDir?: string;
};

export function createIsolatedBuildEnv(
  options: BuildEnvOptions = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    CI: "true",
    NODE_ENV: "production",
    npm_config_fund: "false",
    npm_config_audit: "false",
    NEXT_DISABLE_TURBOPACK: "1",
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (TURBO_ENV_KEY.test(key)) continue;

    const isSafe =
      SAFE_ENV_KEYS.has(key) ||
      key.startsWith("npm_config_") ||
      key.startsWith("NPM_CONFIG_");

    if (isSafe) {
      env[key] = sanitizeEnvValue(key, value);
    }
  }

  if (!env.PATH && process.env.Path) {
    env.PATH = process.env.Path;
  }

  // Debe ir después de copiar variables seguras para evitar que Vercel/host
  // reinyecte una cache global persistente en /tmp. Cada upload usa su propio
  // directorio temporal y se limpia al finalizar.
  if (options.homeDir) {
    env.HOME = options.homeDir;
    env.USERPROFILE = options.homeDir;
  }
  if (options.cacheDir) {
    env.npm_config_cache = options.cacheDir;
    env.NPM_CONFIG_CACHE = options.cacheDir;
  }
  if (options.tmpDir) {
    env.TMPDIR = options.tmpDir;
    env.TEMP = options.tmpDir;
    env.TMP = options.tmpDir;
  }

  return env;
}

function sanitizeEnvValue(key: string, value: string): string {
  if (key !== "NODE_OPTIONS") return value;
  return value
    .split(/\s+/)
    .filter((token) => !/--turbo(pack)?\b/i.test(token))
    .join(" ")
    .trim();
}
