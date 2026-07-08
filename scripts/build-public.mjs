import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitesRoot = path.join(root, "sites");
const publicRoot = path.join(root, "public");
const templatePublic = path.join(root, "templates", "public");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripMarkdown(value) {
  return String(value || "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function field(markdown, label) {
  const line = markdown
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${label}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

function section(markdown, title) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start === -1) return "";

  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) break;
    body.push(lines[index]);
  }

  return body.join("\n").trim();
}

function tagsFrom(value) {
  return String(value || "")
    .split(/[,、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
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

async function readEntries() {
  if (!existsSync(sitesRoot)) return [];

  const dirents = await readdir(sitesRoot, { withFileTypes: true });
  const entries = [];

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;

    const slug = dirent.name;
    const entryRoot = path.join(sitesRoot, slug);
    const memoPath = path.join(entryRoot, "memo.md");
    const demoRoot = path.join(entryRoot, "demo");
    const demoIndex = path.join(demoRoot, "index.html");

    if (!existsSync(memoPath) || !existsSync(demoIndex)) continue;

    const markdown = await readFile(memoPath, "utf8");
    const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || slug;
    const url = field(markdown, "URL");
    const date = field(markdown, "見た日") || slug.slice(0, 10);
    const tags = tagsFrom(field(markdown, "タグ"));
    const detail = stripMarkdown(section(markdown, "今回抜き出す要素"));
    const goodPoints = section(markdown, "良かったところ")
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);

    entries.push({
      slug,
      title,
      url,
      date,
      tags,
      detail,
      goodPoints,
      demoRoot,
      demoHref: `./sites/${slug}/index.html`,
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
}

function renderTagButtons(entries) {
  const tags = [...new Set(entries.flatMap((entry) => entry.tags))].sort((a, b) => a.localeCompare(b));
  const buttons = [
    '<button class="filter-button is-active" type="button" data-filter="all">すべて</button>',
  ];

  for (const tag of tags) {
    buttons.push(
      `<button class="filter-button" type="button" data-filter="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`,
    );
  }

  return buttons.join("\n            ");
}

function renderCard(entry) {
  const tags = entry.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const tagData = entry.tags.map(escapeHtml).join(" ");
  const goodPoints = entry.goodPoints.length
    ? `<p class="detail">${escapeHtml(entry.goodPoints.join(" / "))}</p>`
    : "";
  const sourceLink =
    entry.url && entry.url !== "未設定"
      ? `<a class="link-button" href="${escapeHtml(entry.url)}" target="_blank" rel="noreferrer">参考サイト</a>`
      : "";

  return `<article class="stock-card" data-card data-tags="${tagData}">
          <div class="preview" aria-hidden="true">
            <iframe src="${entry.demoHref}" title="${escapeHtml(entry.title)} preview" loading="lazy"></iframe>
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span>${escapeHtml(entry.date)}</span>
              <span>${escapeHtml(entry.slug)}</span>
            </div>
            <h2 class="card-title">${escapeHtml(entry.title)}</h2>
            <p class="detail">${escapeHtml(entry.detail || "抜き出した要素を memo.md に記録してください。")}</p>
            ${goodPoints}
            <div class="tags">${tags}</div>
            <div class="links">
              <a class="link-button primary" href="${entry.demoHref}">デモを見る</a>
              ${sourceLink}
            </div>
          </div>
        </article>`;
}

function renderIndex(entries) {
  const latest = entries[0]?.date || "-";
  const cards = entries.map(renderCard).join("\n        ");
  const empty = entries.length
    ? '<p class="empty is-hidden" data-empty>条件に一致するストックがありません。</p>'
    : '<p class="empty">まだストックがありません。<code>npm run new -- --url ...</code> で最初のエントリーを作成してください。</p>';

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Web参考サイト</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23f7f2df'/%3E%3Cpath d='M2 2h12v12H2z' fill='%23d73d2f'/%3E%3Cpath d='M4 4h8v8H4z' fill='%23f1c84b'/%3E%3C/svg%3E">
    <link rel="stylesheet" href="./assets/site.css">
  </head>
  <body>
    <div class="site-shell">
      <header class="site-header">
        <div>
          <p class="eyebrow">Reference Stock</p>
          <h1>Web参考サイト</h1>
          <p class="lead">日々見つけたデザイン、アニメーション、UIの気持ちよさを、あとから使える小さなデモとして保存する場所です。</p>
        </div>
        <div class="stats" aria-label="ストック概要">
          <div class="stat">
            <strong>${entries.length}</strong>
            <span>entries</span>
          </div>
          <div class="stat">
            <strong>${escapeHtml(latest)}</strong>
            <span>latest</span>
          </div>
        </div>
      </header>

      <section class="toolbar" aria-label="検索と絞り込み">
        <input class="search" type="search" placeholder="サイト名・タグ・メモを検索" data-search>
        <div class="filters">
            ${renderTagButtons(entries)}
        </div>
      </section>

      <main>
        <section class="grid" aria-label="ストック一覧">
        ${cards}
        </section>
        ${empty}
      </main>
    </div>
    <script src="./assets/site.js"></script>
  </body>
</html>
`;
}

function renderMarkdownIndex(entries) {
  const rows = entries.map((entry) => {
    const tags = entry.tags.join(", ");
    const detail = entry.detail || "未記入";
    const memoPath = `sites/${entry.slug}/memo.md`;

    return `| ${entry.date} | ${entry.title} | ${detail} | ${tags} | [memo](${memoPath}) |`;
  });

  return `# Web参考サイト ストック一覧

このファイルは \`npm run build\` で再生成されます。公開用の一覧は \`public/index.html\` です。

| 日付 | サイト | 抜き出す要素 | タグ | メモ |
| --- | --- | --- | --- | --- |
${rows.join("\n")}
`;
}

const entries = await readEntries();

await rm(publicRoot, { recursive: true, force: true });
await mkdir(path.join(publicRoot, "assets"), { recursive: true });
await mkdir(path.join(publicRoot, "sites"), { recursive: true });

if (existsSync(templatePublic)) {
  await copyDir(templatePublic, publicRoot);
}

for (const entry of entries) {
  await copyDir(entry.demoRoot, path.join(publicRoot, "sites", entry.slug));
}

await writeFile(path.join(publicRoot, "index.html"), renderIndex(entries));
await writeFile(path.join(publicRoot, ".nojekyll"), "");
await writeFile(path.join(publicRoot, "404.html"), renderIndex(entries));
await writeFile(path.join(publicRoot, "data.json"), `${JSON.stringify(entries.map(({ demoRoot, ...entry }) => entry), null, 2)}\n`);
await writeFile(path.join(root, "index.md"), renderMarkdownIndex(entries));

console.log(`Built public site with ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`);
