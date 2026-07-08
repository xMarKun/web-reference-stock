import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return path.join(publicRoot, normalized);
}

const server = createServer(async (request, response) => {
  try {
    let filePath = safePath(request.url || "/");
    const info = existsSync(filePath) ? await stat(filePath) : null;

    if (info?.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!existsSync(filePath)) {
      filePath = path.join(publicRoot, "404.html");
      response.statusCode = 404;
    }

    response.setHeader("Content-Type", contentTypes[path.extname(filePath)] || "application/octet-stream");
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end(error instanceof Error ? error.message : "Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`Preview: http://${host}:${port}/`);
});
