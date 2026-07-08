import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanTargets = [
  ".github",
  ".gitignore",
  "README.md",
  "index.md",
  "netlify.toml",
  "package.json",
  "public",
  "scripts",
  "sites",
  "templates",
  "vercel.json",
];

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".toml",
  ".txt",
  ".yml",
  ".yaml",
]);

const attachmentExtensions = new Set([
  ".avif",
  ".gif",
  ".heic",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp4",
  ".pdf",
  ".png",
  ".webp",
]);

const denyPatterns = [
  {
    name: "private key",
    pattern: /-----BEGIN (?:RSA |OPENSSH |DSA |EC |PGP )?PRIVATE KEY-----/i,
  },
  {
    name: "GitHub token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  },
  {
    name: "AWS access key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: "OpenAI-style API key",
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    name: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    name: "sensitive assignment",
    pattern: /\b(?:password|passwd|secret|api[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["']?[^"'\s][^"'\n]{3,}/i,
  },
  {
    name: "local absolute path",
    pattern: /(?:\/Users\/[^/\s"'<>]+|C:\\Users\\[^\\\s"'<>]+)/,
  },
  {
    name: "sensitive URL query",
    pattern: /https?:\/\/[^\s"'<>)]*\?(?=[^\s"'<>)]*(?:token|key|secret|password|signature|x-amz|expires=))/i,
  },
];

async function collectFiles(target) {
  const fullPath = path.join(root, target);
  if (!existsSync(fullPath)) return [];

  const info = await stat(fullPath);
  if (info.isFile()) return [fullPath];

  const files = [];
  const entries = await readdir(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".codex") continue;

    const child = path.join(target, entry.name);
    files.push(...(await collectFiles(child)));
  }

  return files;
}

function lineNumberFor(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

const files = (await Promise.all(scanTargets.map(collectFiles))).flat();
const findings = [];
const attachmentWarnings = [];

for (const filePath of files) {
  const relative = path.relative(root, filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (attachmentExtensions.has(ext)) {
    attachmentWarnings.push(relative);
    continue;
  }

  if (!textExtensions.has(ext)) continue;

  const content = await readFile(filePath, "utf8");

  for (const { name, pattern } of denyPatterns) {
    const match = pattern.exec(content);
    if (match) {
      findings.push({
        file: relative,
        line: lineNumberFor(content, match.index),
        name,
      });
    }
  }
}

if (attachmentWarnings.length) {
  console.warn("Review attachments before publishing:");
  for (const file of attachmentWarnings) {
    console.warn(`- ${file}`);
  }
}

if (findings.length) {
  console.error("Potential publish-sensitive content found:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} (${finding.name})`);
  }
  process.exit(1);
}

console.log(`Publish audit passed (${files.length} files scanned).`);
