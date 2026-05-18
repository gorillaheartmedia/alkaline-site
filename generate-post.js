const fs = require("fs");
const path = require("path");

const root = __dirname;
const firstArg = process.argv[2];
const command = firstArg === "delete" || firstArg === "publish" ? firstArg : "publish";
const publishInput = command === "publish" && firstArg === "publish" ? process.argv[3] : firstArg;
const inputPath = path.resolve(root, publishInput || "post.json");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function archiveTime(readTime, category) {
  const minutes = String(readTime || "").match(/\d+/);
  return minutes ? `${minutes[0]} min` : category;
}

function normalizePost(raw) {
  const title = String(raw.title || "").trim();
  if (!title) {
    throw new Error("post.json needs a title.");
  }

  const paragraphs = Array.isArray(raw.paragraphs)
    ? raw.paragraphs.map((paragraph) => String(paragraph).trim()).filter(Boolean)
    : String(raw.body || "")
        .split(/\n\s*\n|\r?\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

  if (!paragraphs.length) {
    throw new Error("post.json needs paragraphs or body text.");
  }

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
    : String(raw.tags || "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);

  const slug = slugify(raw.slug || title);

  return {
    title,
    slug,
    fileName: `${slug}.html`,
    date: String(raw.date || "Undated").trim(),
    readTime: String(raw.readTime || raw.read_time || "5 minute read").trim(),
    category: String(raw.category || "Essay").trim(),
    tags,
    image: String(raw.image || "").trim(),
    excerpt: String(raw.excerpt || paragraphs[0]).trim(),
    paragraphs
  };
}

function buildArticle(post) {
  const tagMeta = post.tags
    .map((tag) => `        <span>${escapeHtml(titleCase(tag))}</span>`)
    .join("\n");
  const imageMarkup = post.image
    ? `\n        <img class="article-image" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" />\n`
    : "";
  const paragraphs = post.paragraphs
    .map((paragraph) => `        <p>${escapeHtml(paragraph)}</p>`)
    .join("\n\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(post.title)} | Alkaline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      font-family: Arial, Helvetica, sans-serif;
      background:
        radial-gradient(circle at 18% 58%, rgba(94, 10, 88, 0.5), transparent 29%),
        radial-gradient(circle at 72% 28%, rgba(13, 24, 105, 0.54), transparent 31%),
        linear-gradient(115deg, #080b15 0%, #050509 48%, #100316 100%);
      color: #fff;
    }
    nav {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      padding: 22px 7vw;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
      background: linear-gradient(to bottom, rgba(7, 7, 11, 0.88), rgba(7, 7, 11, 0));
    }
    nav h2 {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.16em;
    }
    nav h2::before {
      content: "\\1F736";
      display: inline-block;
      width: 1.15em;
      margin-right: 9px;
      font-size: 1.25rem;
      line-height: 1;
      text-align: center;
      text-shadow: 0 0 18px rgba(216, 67, 201, 0.75);
      vertical-align: -2px;
    }
    nav a {
      color: rgba(255, 255, 255, 0.72);
      text-decoration: none;
      margin-left: 26px;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    nav a:hover,
    nav a.active { color: #fff; }
    main {
      min-height: 100vh;
      padding: 150px 7vw 90px;
    }
    .article-shell {
      max-width: 980px;
    }
    .label {
      color: #97dcff;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    h1 {
      max-width: 960px;
      margin-top: 22px;
      font-size: clamp(3.2rem, 8.8vw, 9rem);
      line-height: 0.86;
      text-transform: uppercase;
      color: rgba(151, 220, 255, 0.18);
      -webkit-text-fill-color: rgba(151, 220, 255, 0.18);
      -webkit-text-stroke: 2px rgba(151, 220, 255, 0.94);
      text-shadow: 0 20px 48px rgba(50, 148, 255, 0.3);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
      color: rgba(255, 255, 255, 0.56);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .article-image {
      display: block;
      width: min(100%, 780px);
      max-height: 420px;
      margin-top: 44px;
      object-fit: cover;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: #000;
    }
    .article-body {
      max-width: 780px;
      margin-top: 54px;
      padding: 34px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.055);
      backdrop-filter: blur(16px);
      box-shadow: 0 26px 70px rgba(0, 0, 0, 0.34);
    }
    .article-body p {
      color: rgba(255, 255, 255, 0.78);
      font-size: 1.06rem;
      line-height: 1.82;
    }
    .article-body p + p {
      margin-top: 24px;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      margin-top: 34px;
      padding: 0 20px;
      border: 1px solid rgba(151, 220, 255, 0.42);
      background: rgba(151, 220, 255, 0.1);
      color: #fff;
      text-decoration: none;
      font-size: 0.78rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .back-link:hover {
      border-color: rgba(151, 220, 255, 0.82);
      background: rgba(151, 220, 255, 0.18);
    }
    @media (max-width: 700px) {
      nav { position: absolute; align-items: flex-start; flex-direction: column; gap: 14px; padding: 18px 5vw; }
      nav a { margin: 0 16px 0 0; }
      main { padding: 132px 5vw 64px; }
      .article-body { padding: 24px; }
    }
  </style>
</head>
<body>
  <nav>
    <h2><a href="index.html" style="color: inherit; text-decoration: none;">Alkaline</a></h2>
    <div>
      <a class="active" href="readings.html">Readings</a>
      <a href="book-reviews.html">Book Reviews</a>
      <a href="videos.html">Videos</a>
      <a href="programs.html">Programs</a>
    </div>
  </nav>

  <main>
    <article class="article-shell">
      <span class="label">${escapeHtml(post.category)}</span>
      <h1>${escapeHtml(post.title)}</h1>
      <div class="meta">
        <span>${escapeHtml(post.date)}</span>
        <span>${escapeHtml(post.readTime)}</span>
${tagMeta}
      </div>${imageMarkup}

      <div class="article-body">
${paragraphs}
      </div>

      <a class="back-link" href="readings.html">Back to Readings</a>
    </article>
  </main>
</body>
</html>
`;
}

function buildRecentEntry(post) {
  const activeClass = "post-link active";
  return `          <a class="${activeClass}" href="${post.fileName}" data-url="${post.fileName}" data-tags="${escapeHtml(post.tags.join(" "))}" data-title="${escapeHtml(post.title)}" data-type="${escapeHtml(post.category)}" data-time="${escapeHtml(post.readTime)}" data-preview="${escapeHtml(post.excerpt)}">
            <span>${escapeHtml(post.category)}</span>
            <strong>${escapeHtml(post.title)}</strong>
          </a>`;
}

function buildArchiveEntry(post) {
  return `      <a class="archive-link" href="${post.fileName}"><span>${escapeHtml(post.date)}</span><strong>${escapeHtml(post.title)}</strong><span>${escapeHtml(archiveTime(post.readTime, post.category))}</span></a>`;
}

function replaceBetween(content, start, end, replacement) {
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end, startIndex);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Could not find section markers: ${start} ... ${end}`);
  }

  return `${content.slice(0, startIndex + start.length)}${replacement}${content.slice(endIndex)}`;
}

function stripExistingRecent(html, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`\\n\\s*<(a|button)[^>]*(?:href|data-url)="${escaped}"[\\s\\S]*?</\\1>`, "g"),
    ""
  );
}

function stripExistingArchive(html, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`\\n\\s*<a class="archive-link" href="${escaped}"[\\s\\S]*?</a>`, "g"),
    ""
  );
}

function getAttribute(attributes, name) {
  const match = attributes.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : "";
}

function getFirstPost(list) {
  const match = list.match(/<(?:a|button)\s+([^>]*class="post-link[^"]*"[^>]*)>[\s\S]*?<\/(?:a|button)>/);
  if (!match) {
    return null;
  }

  return {
    fileName: getAttribute(match[1], "data-url") || getAttribute(match[1], "href"),
    category: getAttribute(match[1], "data-type"),
    title: getAttribute(match[1], "data-title"),
    readTime: getAttribute(match[1], "data-time"),
    excerpt: getAttribute(match[1], "data-preview")
  };
}

function updatePreviewMarkup(html, post) {
  if (!post) {
    return html;
  }

  html = replaceBetween(
    html,
    '<span class="label" id="preview-type">',
    "</span>",
    escapeHtml(post.category)
  );
  html = replaceBetween(
    html,
    '<h3 id="preview-title">',
    "</h3>",
    escapeHtml(post.title)
  );
  html = replaceBetween(
    html,
    '<p id="preview-copy">',
    "</p>",
    `\n            ${escapeHtml(post.excerpt)}\n          `
  );
  html = replaceBetween(
    html,
    '<span id="preview-time">',
    "</span>",
    escapeHtml(post.readTime)
  );
  return html.replace(
    /<a class="page-link" id="preview-link" href="[^"]*">Open Post<\/a>/,
    `<a class="page-link" id="preview-link" href="${post.fileName}">Open Post</a>`
  );
}

function updateReadings(post) {
  const file = path.join(root, "readings.html");
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/class="post-link active"/g, 'class="post-link"');

  const listStart = '        <div class="post-list" role="list">';
  const listEnd = "        </div>";
  const startIndex = html.indexOf(listStart);
  const endIndex = html.indexOf(listEnd, startIndex);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Could not find the recent post list in readings.html.");
  }

  let list = html.slice(startIndex + listStart.length, endIndex);
  list = stripExistingRecent(list, post.fileName);
  list = `\n${buildRecentEntry(post)}${list}`;
  html = `${html.slice(0, startIndex + listStart.length)}${list}${html.slice(endIndex)}`;
  html = updatePreviewMarkup(html, post);

  fs.writeFileSync(file, html);
}

function updateArchive(post) {
  const file = path.join(root, "readings-archive.html");
  let html = fs.readFileSync(file, "utf8");

  const listStart = '    <div class="archive-list">';
  const listEnd = "    </div>";
  const startIndex = html.indexOf(listStart);
  const endIndex = html.indexOf(listEnd, startIndex);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Could not find the archive list in readings-archive.html.");
  }

  let list = html.slice(startIndex + listStart.length, endIndex);
  list = stripExistingArchive(list, post.fileName);
  list = `\n${buildArchiveEntry(post)}${list}`;
  html = `${html.slice(0, startIndex + listStart.length)}${list}${html.slice(endIndex)}`;

  fs.writeFileSync(file, html);
}

function deleteFromReadings(fileName) {
  const file = path.join(root, "readings.html");
  let html = fs.readFileSync(file, "utf8");

  const listStart = '        <div class="post-list" role="list">';
  const listEnd = "        </div>";
  const startIndex = html.indexOf(listStart);
  const endIndex = html.indexOf(listEnd, startIndex);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Could not find the recent post list in readings.html.");
  }

  let list = html.slice(startIndex + listStart.length, endIndex);
  list = stripExistingRecent(list, fileName);
  list = list.replace(/class="post-link active"/g, 'class="post-link"');
  list = list.replace(/class="post-link"/, 'class="post-link active"');
  html = `${html.slice(0, startIndex + listStart.length)}${list}${html.slice(endIndex)}`;
  html = updatePreviewMarkup(html, getFirstPost(list));

  fs.writeFileSync(file, html);
}

function deleteFromArchive(fileName) {
  const file = path.join(root, "readings-archive.html");
  let html = fs.readFileSync(file, "utf8");

  const listStart = '    <div class="archive-list">';
  const listEnd = "    </div>";
  const startIndex = html.indexOf(listStart);
  const endIndex = html.indexOf(listEnd, startIndex);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Could not find the archive list in readings-archive.html.");
  }

  let list = html.slice(startIndex + listStart.length, endIndex);
  list = stripExistingArchive(list, fileName);
  html = `${html.slice(0, startIndex + listStart.length)}${list}${html.slice(endIndex)}`;

  fs.writeFileSync(file, html);
}

function publishRaw(raw) {
  const post = normalizePost(raw);
  fs.writeFileSync(path.join(root, post.fileName), buildArticle(post));
  updateReadings(post);
  updateArchive(post);
  return post;
}

function publish() {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const post = publishRaw(raw);

  console.log(`Generated ${post.fileName}`);
  console.log("Updated readings.html");
  console.log("Updated readings-archive.html");
}

function deleteSlug(slugValue) {
  const slug = slugify(slugValue || "");
  if (!slug) {
    throw new Error("Give the post slug to delete.");
  }

  const fileName = `${slug}.html`;
  const articlePath = path.join(root, fileName);
  const deletedFile = fs.existsSync(articlePath);
  if (fs.existsSync(articlePath)) {
    fs.unlinkSync(articlePath);
  }

  deleteFromReadings(fileName);
  deleteFromArchive(fileName);
  return { fileName, deletedFile };
}

function deletePost() {
  const result = deleteSlug(process.argv[3] || "");
  if (result.deletedFile) {
    console.log(`Deleted ${result.fileName}`);
  } else {
    console.log(`${result.fileName} was not found; removing list/archive entries only.`);
  }
  console.log("Updated readings.html");
  console.log("Updated readings-archive.html");
}

module.exports = {
  buildArticle,
  deleteSlug,
  normalizePost,
  publishRaw,
  slugify
};

if (require.main === module) {
  if (command === "publish") {
    publish();
  } else if (command === "delete") {
    deletePost();
  } else {
    throw new Error("Unknown command. Use: node generate-post.js publish [post.json] or node generate-post.js delete post-slug");
  }
}
