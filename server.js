import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "public");
const dataDir = resolve(__dirname, "data");
const dataFile = join(dataDir, "scripts.json");
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

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(
      dataFile,
      JSON.stringify({ version: 1, scripts: [] }, null, 2) + "\n",
      "utf8"
    );
  }
}

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

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        rejectBody(new Error("요청 본문이 너무 큽니다."));
        request.destroy();
      }
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.scripts)) {
    throw new Error("scripts 배열이 필요합니다.");
  }

  const seenIds = new Set();
  const now = new Date().toISOString();

  const scripts = payload.scripts.map((script, index) => {
    if (!script || typeof script !== "object") {
      throw new Error(`${index + 1}번째 스크립트 형식이 올바르지 않습니다.`);
    }

    const title = cleanText(script.title);
    const topic = cleanText(script.topic);
    const type = cleanText(script.type);

    if (!title) throw new Error(`${index + 1}번째 스크립트 제목이 필요합니다.`);
    if (!topic) throw new Error(`${title}: 주제가 필요합니다.`);
    if (!type) throw new Error(`${title}: 유형이 필요합니다.`);
    if (!Array.isArray(script.sentences) || script.sentences.length === 0) {
      throw new Error(`${title}: 문장이 1개 이상 필요합니다.`);
    }

    let id = createSlug(script.id || title);
    if (!id) id = `script-${index + 1}`;
    let uniqueId = id;
    let suffix = 2;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${id}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(uniqueId);

    const sentences = script.sentences.map((sentence, sentenceIndex) => {
      const korean = cleanText(sentence?.korean);
      const english = cleanText(sentence?.english);
      const note = cleanText(sentence?.note);

      if (!korean || !english) {
        throw new Error(`${title}: ${sentenceIndex + 1}번째 문장의 한글/영어가 필요합니다.`);
      }

      return note ? { korean, english, note } : { korean, english };
    });

    const tags = Array.isArray(script.tags)
      ? script.tags.map(cleanText).filter(Boolean)
      : [];

    return {
      id: uniqueId,
      title,
      topic,
      type,
      tags: [...new Set(tags)],
      createdAt: cleanText(script.createdAt) || now,
      updatedAt: now,
      sentences
    };
  });

  return {
    version: 1,
    updatedAt: now,
    scripts
  };
}

async function handleApi(request, response) {
  if (request.method === "GET" && request.url === "/api/scripts") {
    await ensureDataFile();
    const content = await readFile(dataFile, "utf8");
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(content);
    return;
  }

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

  if (request.method === "PUT" && request.url === "/api/scripts") {
    const body = await readBody(request);
    const payload = validatePayload(JSON.parse(body));
    await ensureDataFile();
    await writeFile(dataFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
    sendJson(response, 200, payload);
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

await ensureDataFile();
await ensureFillersFile();
server.listen(port, host, () => {
  console.log(`OPIc study app: http://${host}:${port}`);
});
