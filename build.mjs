// Builds the site into dist/: one page per language, plain files that any static host can serve.
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The settings in site.config.json; SITE_URL and APP_URL in the environment take precedence. */
export async function loadConfig(overrides = {}) {
  const config = JSON.parse(
    await readFile(join(root, "site.config.json"), "utf8"),
  );
  const merged = {
    ...config,
    siteUrl: process.env.SITE_URL ?? config.siteUrl,
    appUrl: process.env.APP_URL ?? config.appUrl,
    ...overrides,
  };
  merged.siteUrl = merged.siteUrl.replace(/\/+$/, "");
  merged.appUrl = merged.appUrl.replace(/\/+$/, "");
  return merged;
}

/** The messages of each language the configuration lists, in the order the language menu shows them. */
export async function loadLocales(languages) {
  const locales = {};
  for (const code of languages)
    locales[code] = JSON.parse(
      await readFile(join(root, "src/locales", code + ".json"), "utf8"),
    );
  return locales;
}

/** Where a language's page lives: the default language at the top, the others in a folder each. */
const folderOf = (code, config) =>
  code === config.defaultLanguage ? "" : code + "/";

export async function build({
  outDir = join(root, "dist"),
  ...overrides
} = {}) {
  const config = await loadConfig(overrides);
  const locales = await loadLocales(config.languages);
  const codes = config.languages;
  if (!codes.includes(config.defaultLanguage))
    throw new Error(
      "No messages for the default language " + config.defaultLanguage,
    );
  const template = await readFile(join(root, "src/index.html"), "utf8");

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(join(root, "src/assets"), join(outDir, "assets"), {
    recursive: true,
  });

  // A file's address carries a fingerprint of its content, so hosts may cache it for good.
  const fingerprints = {};
  for (const file of await readdir(join(root, "src/assets")))
    fingerprints[file] = createHash("sha256")
      .update(await readFile(join(root, "src/assets", file)))
      .digest("hex")
      .slice(0, 12);

  for (const code of codes) {
    const messages = locales[code];
    const folder = folderOf(code, config);
    // Every address inside the site is relative, so it works at a domain's top or in a sub-folder.
    const up = folder ? "../" : "";
    const pathTo = (other) => up + folderOf(other, config) || "./";
    const address = (other) => config.siteUrl + "/" + folderOf(other, config);
    const values = {
      lang: code,
      home: "./",
      app: escapeHtml(config.appUrl),
      pages:
        `data-pages="${escapeHtml(JSON.stringify(Object.fromEntries(codes.map((other) => [other, pathTo(other)]))))}"` +
        (folder ? "" : " data-default"),
      languages: codes
        .map(
          (other) =>
            `<a href="${pathTo(other)}" lang="${other}" hreflang="${other}" data-lang="${other}"${
              other === code ? ' aria-current="true"' : ""
            }>${escapeHtml(locales[other]["common.languageName"])}</a>`,
        )
        .join(""),
      // Search engines need full addresses. Until the site has one, the page says nothing.
      seo: config.siteUrl
        ? [
            `<meta property="og:url" content="${escapeHtml(address(code))}" />`,
            `<link rel="canonical" href="${escapeHtml(address(code))}" />`,
            ...codes.map(
              (other) =>
                `<link rel="alternate" hreflang="${other}" href="${escapeHtml(address(other))}" />`,
            ),
            `<link rel="alternate" hreflang="x-default" href="${escapeHtml(address(config.defaultLanguage))}" />`,
          ].join("\n    ")
        : "",
    };
    for (const [name, link] of Object.entries(config.links))
      values[name] = escapeHtml(link);
    for (const [file, fingerprint] of Object.entries(fingerprints))
      values["asset." + file] = `${up}assets/${file}?v=${fingerprint}`;

    const html = template.replace(/\{\{(@?[\w.-]+)\}\}/g, (token, name) => {
      if (name.startsWith("@")) return values[name.slice(1)] ?? token;
      return name in messages ? escapeHtml(messages[name]) : token;
    });
    const missing = html.match(/\{\{[^}]*\}\}/g);
    if (missing)
      throw new Error(
        `${code}: nothing to fill ${[...new Set(missing)].join(", ")}`,
      );
    await mkdir(join(outDir, folder), { recursive: true });
    await writeFile(join(outDir, folder, "index.html"), html);
  }

  await writeFile(
    join(outDir, "robots.txt"),
    "User-agent: *\nAllow: /\n" +
      (config.siteUrl ? `Sitemap: ${config.siteUrl}/sitemap.xml\n` : ""),
  );
  if (config.siteUrl)
    await writeFile(
      join(outDir, "sitemap.xml"),
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        codes
          .map(
            (code) =>
              `  <url><loc>${escapeHtml(config.siteUrl + "/" + folderOf(code, config))}</loc></url>\n`,
          )
          .join("") +
        "</urlset>\n",
    );
  return { outDir, languages: codes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { outDir, languages } = await build();
  console.log(`Built ${languages.join(", ")} into ${outDir}`);
}
