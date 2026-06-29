import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "public");
const dataDir = resolve(__dirname, "data");
const fillersFile = join(dataDir, "fillers.json");
const port = Number(process.env.PORT || 5174);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

async function ensureFillersFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(fillersFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(
      fillersFile,
      JSON.stringify({ version: 1, fillers: [] }, null, 2) + "\n",
      "utf8"
    );
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function handleApi(request, response) {
  if (request.method === "GET" && request.url === "/api/fillers") {
    await ensureFillersFile();
    const content = await readFile(fillersFile, "utf8");
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(content);
    return;
  }

  sendJson(response, 404, { error: "API를 찾을 수 없습니다." });
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
  const stream = createReadStream(filePath);
  stream.on("open", () => response.writeHead(200, { "content-type": contentType }));
  stream.on("error", () => {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
  stream.pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    if (request.url?.startsWith("/api/")) {
      await handleApi(request, response);
      return;
    }
    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 400, { error: error.message || "요청을 처리할 수 없습니다." });
  }
});

await ensureFillersFile();
server.listen(port, host, () => {
  console.log(`OPIc study app: http://${host}:${port}`);
});
