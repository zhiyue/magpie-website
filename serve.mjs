// Serves dist/ for a look before publishing: node serve.mjs [port] [folder]
// Give a folder such as /magpie to check that the site also works below a domain's top.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.argv[2] ?? 4321);
const base = (process.argv[3] ?? "").replace(/\/+$/, "");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

createServer(async (request, response) => {
  let path = decodeURIComponent(
    new URL(request.url, "http://localhost").pathname,
  );
  if (base && !path.startsWith(base + "/")) {
    response.writeHead(404).end("Not found");
    return;
  }
  path = normalize(path.slice(base.length));
  if (path.endsWith("/")) path += "index.html";
  try {
    const body = await readFile(join(dist, path));
    response.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`http://localhost:${port}${base}/`));
