import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(root, ".codex", "skills", "stock-reference-site", "assets", "entry-template");
const sitesRoot = path.join(root, "sites");

function parseArgs(argv) {
  const args = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=");
    const key = rawKey.trim();
    const next = argv[index + 1];

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

function todayJst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "参考サイト";
  }
}

function sanitizeUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value;
  }
}

function slugFrom(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "reference-site";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src);

  for (const entry of entries) {
    const sourcePath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const info = await stat(sourcePath);

    if (info.isDirectory()) {
      await copyDir(sourcePath, destPath);
    } else {
      await copyFile(sourcePath, destPath);
    }
  }
}

async function replaceInFile(filePath, replacements) {
  let content = await readFile(filePath, "utf8");

  for (const [key, value] of Object.entries(replacements)) {
    content = content.split(`{{${key}}}`).join(value);
  }

  await writeFile(filePath, content);
}

async function walkFiles(dir) {
  const files = [];
  const entries = await readdir(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const info = await stat(fullPath);

    if (info.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function uniqueEntryDir(basePath) {
  if (!existsSync(basePath)) return basePath;

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${basePath}-${index}`;
    if (!existsSync(candidate)) return candidate;
  }

  throw new Error(`Could not find a free folder name for ${basePath}`);
}

const args = parseArgs(process.argv.slice(2));
const rawUrl = args.url || args._[0] || "未設定";
const url = args["keep-query"] ? rawUrl : sanitizeUrl(rawUrl);
const date = args.date || todayJst();
const title = args.title || titleFromUrl(url);
const detail = args.detail || "今回抜き出す要素をここに書く";
const tags = args.tags || "layout";
const slugBase = args.slug || titleFromUrl(url);
const entryDir = uniqueEntryDir(path.join(sitesRoot, `${date}-${slugFrom(slugBase)}`));

if (!existsSync(templateRoot)) {
  throw new Error(`Template directory not found: ${templateRoot}`);
}

await mkdir(sitesRoot, { recursive: true });
await copyDir(templateRoot, entryDir);

const replacements = {
  SITE_NAME: title,
  URL: url,
  "YYYY-MM-DD": date,
  TAGS: tags,
  GOOD_POINT_1: "良かった点を具体的に書く",
  GOOD_POINT_2: "余白・タイポグラフィ・色・動きなどを分けて書く",
  GOOD_POINT_3: "実案件で使えそうな観点を書く",
  SELECTED_DETAIL: detail,
  USE_CASES: "どんな案件・画面・文脈で使えそうかを書く",
  NEXT_IDEA: "次に深掘りするなら何を見るかを書く",
  DEMO_TITLE: escapeHtml(detail),
  REFERENCE_LABEL: escapeHtml(title),
  DEMO_DESCRIPTION: "参考サイトから抽出した要素を、使い回しやすい最小単位で再現するデモです。",
  DEMO_MARKUP: `<div class="placeholder-demo">
            <button class="placeholder-button" type="button">
              <span>ここに動きを作る</span>
            </button>
          </div>`,
};

for (const filePath of await walkFiles(entryDir)) {
  if (/\.(html|css|js|md)$/.test(filePath)) {
    await replaceInFile(filePath, replacements);
  }
}

console.log(`Created ${path.relative(root, entryDir)}`);
console.log(`Memo: ${path.relative(root, path.join(entryDir, "memo.md"))}`);
console.log(`Demo: ${path.relative(root, path.join(entryDir, "demo", "index.html"))}`);
