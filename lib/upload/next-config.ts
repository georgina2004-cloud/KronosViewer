import fs from "fs";
import path from "path";

const MINIMAL_EXPORT_CONFIG =
  "const nextConfig = { output: 'export' };\nexport default nextConfig;\n";

export function stripTurbopackFromConfigContent(content: string): string {
  let result = content;

  result = result.replace(/withTurbopack\s*\(/g, "(");
  result = result.replace(/,?\s*turbopack\s*:\s*true\b/g, "");
  result = result.replace(/,?\s*turbopack\s*:\s*\{[\s\S]*?\}\s*(?=,|\})/g, "");
  result = result.replace(/,?\s*['"]turbo['"]\s*:\s*\{[\s\S]*?\}\s*(?=,|\})/g, "");
  result = result.replace(/,?\s*turbo\s*:\s*\{[\s\S]*?\}\s*(?=,|\})/g, "");
  result = result.replace(
    /experimental\s*:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    (_match, inner: string) => {
      const cleaned = inner
        .replace(/,?\s*turbo\s*:\s*[^,\n}]+/g, "")
        .replace(/,?\s*turbopack\s*:\s*[^,\n}]+/g, "")
        .replace(/,?\s*['"]turbo['"]\s*:\s*[^,\n}]+/g, "");
      if (!cleaned.trim()) return "";
      return `experimental: {${cleaned}}`;
    },
  );

  return result;
}

export function injectExportIntoConfig(content: string): string {
  if (/output\s*:\s*['"]export['"]/.test(content)) {
    return content;
  }

  if (/export\s+default\s+{/.test(content)) {
    return content.replace(
      /export\s+default\s+{/,
      "export default {\n  output: 'export',",
    );
  }

  if (/module\.exports\s*=\s*{/.test(content)) {
    return content.replace(
      /module\.exports\s*=\s*{/,
      "module.exports = {\n  output: 'export',",
    );
  }

  if (/const\s+nextConfig\s*=\s*{/.test(content)) {
    return content.replace(
      /const\s+nextConfig\s*=\s*{/,
      "const nextConfig = {\n  output: 'export',",
    );
  }

  return `${content}\nexport const output = 'export';\n`;
}

export function ensureNextExportOutput(projectRoot: string): void {
  const configNames = [
    "next.config.mjs",
    "next.config.js",
    "next.config.ts",
    "next.config.cjs",
  ];

  const existing = configNames
    .map((name) => path.join(projectRoot, name))
    .find((filePath) => fs.existsSync(filePath));

  if (!existing) {
    fs.writeFileSync(
      path.join(projectRoot, "next.config.mjs"),
      "const nextConfig = { output: 'export' };\nexport default nextConfig;\n",
      "utf8",
    );
    return;
  }

  const raw = fs.readFileSync(existing, "utf8");
  let patched = stripTurbopackFromConfigContent(raw);
  if (!/output\s*:\s*['"]export['"]/.test(patched)) {
    patched = injectExportIntoConfig(patched);
  }
  patched = stripTurbopackFromConfigContent(patched);

  if (/turbopack|withTurbopack/i.test(patched)) {
    const backupPath = `${existing}.kronos-backup`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(existing, backupPath);
    }
    const overridePath = path.join(projectRoot, "next.config.mjs");
    fs.writeFileSync(overridePath, MINIMAL_EXPORT_CONFIG, "utf8");
    if (path.resolve(existing) !== path.resolve(overridePath)) {
      fs.unlinkSync(existing);
    }
    return;
  }

  fs.writeFileSync(existing, patched, "utf8");
}
