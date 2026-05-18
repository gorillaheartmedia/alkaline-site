const fs = require("fs");
const http = require("http");
const path = require("path");
const { deleteSlug, publishRaw, slugify } = require("./generate-post");

const root = __dirname;
const port = Number(process.env.PORT || 4321);

function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function getAttribute(attributes, name) {
  const match = attributes.match(new RegExp(`${name}="([^"]*)"`));
  return match ? decodeHtml(match[1]) : "";
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, "").trim());
}

function listPosts() {
  const readingsPath = path.join(root, "readings.html");
  if (!fs.existsSync(readingsPath)) {
    return [];
  }

  const html = fs.readFileSync(readingsPath, "utf8");
  const posts = [];
  const regex = /<(?:a|button)\s+([^>]*class="post-link[^"]*"[^>]*)>([\s\S]*?)<\/(?:a|button)>/g;
  let match;

  while ((match = regex.exec(html))) {
    const attributes = match[1];
    const fileName = getAttribute(attributes, "data-url") || getAttribute(attributes, "href");
    if (!fileName || fileName === "readings-archive.html") {
      continue;
    }

    posts.push({
      slug: fileName.replace(/\.html$/, ""),
      fileName,
      title: getAttribute(attributes, "data-title") || stripTags(match[2]),
      category: getAttribute(attributes, "data-type"),
      readTime: getAttribute(attributes, "data-time"),
      excerpt: getAttribute(attributes, "data-preview"),
      tags: getAttribute(attributes, "data-tags").split(/\s+/).filter(Boolean)
    });
  }

  return posts;
}

function parseArticle(slug) {
  const cleanSlug = slugify(slug);
  const fileName = `${cleanSlug}.html`;
  const articlePath = path.join(root, fileName);
  const summary = listPosts().find((post) => post.slug === cleanSlug) || {};

  if (!fs.existsSync(articlePath)) {
    return { ...summary, slug: cleanSlug, fileName, paragraphs: [] };
  }

  const html = fs.readFileSync(articlePath, "utf8");
  const meta = [...html.matchAll(/<div class="meta">([\s\S]*?)<\/div>/g)]
    .flatMap((block) => [...block[1].matchAll(/<span>([\s\S]*?)<\/span>/g)].map((item) => stripTags(item[1])));
  const bodyMatch = html.match(/<div class="article-body">([\s\S]*?)<\/div>/);
  const paragraphs = bodyMatch
    ? [...bodyMatch[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((item) => stripTags(item[1]))
    : [];
  const imageMatch = html.match(/<img[^>]+class="article-image"[^>]+src="([^"]*)"/);

  return {
    slug: cleanSlug,
    fileName,
    title: stripTags((html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1]) || summary.title || "",
    date: meta[0] || "",
    readTime: meta[1] || summary.readTime || "",
    category: stripTags((html.match(/<span class="label">([\s\S]*?)<\/span>/) || [])[1]) || summary.category || "Essay",
    tags: meta.slice(2).map((tag) => tag.toLowerCase()),
    image: imageMatch ? decodeHtml(imageMatch[1]) : "",
    excerpt: summary.excerpt || paragraphs[0] || "",
    paragraphs
  };
}

function serveFile(res, pathname) {
  const filePath = pathname === "/" ? path.join(root, "editor.html") : path.join(root, pathname);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    send(res, 404, "Not found", "text/plain");
    return;
  }

  const ext = path.extname(resolved).toLowerCase();
  const type = ext === ".html" ? "text/html" : ext === ".js" ? "text/javascript" : "text/plain";
  send(res, 200, fs.readFileSync(resolved), type);
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return;
  }

  if (url.pathname === "/api/posts" && req.method === "GET") {
    send(res, 200, { posts: listPosts() });
    return;
  }

  if (url.pathname === "/api/posts" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const post = publishRaw(body);
    send(res, 200, { post, message: `Saved ${post.fileName}` });
    return;
  }

  const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (postMatch && req.method === "GET") {
    send(res, 200, { post: parseArticle(postMatch[1]) });
    return;
  }

  if (postMatch && req.method === "DELETE") {
    const result = deleteSlug(postMatch[1]);
    send(res, 200, { result, message: `Deleted ${result.fileName}` });
    return;
  }

  send(res, 404, { error: "API route not found." });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    serveFile(res, decodeURIComponent(url.pathname.replace(/^\/+/, "")));
  } catch (error) {
    send(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Alkaline editor running at http://localhost:${port}/editor.html`);
});

const keepAlive = setInterval(() => {}, 60 * 60 * 1000);

function shutdown() {
  clearInterval(keepAlive);
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
