import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { build, loadConfig, loadLocales } from "../build.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...path) => readFile(join(...path), "utf8");
const placeholders = (text) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("messages", () => {
  it("exist for exactly the languages the site is configured to show", async () => {
    const files = (await readdir(join(root, "src/locales")))
      .map((file) => file.replace(/\.json$/, ""))
      .sort();
    assert.deepEqual(files, [...(await loadConfig()).languages].sort());
  });

  it("are the same set in every language", async () => {
    const locales = await loadLocales((await loadConfig()).languages);
    const [reference, ...others] = Object.keys(locales);
    for (const code of others) {
      assert.deepEqual(
        Object.keys(locales[code]).sort(),
        Object.keys(locales[reference]).sort(),
        code,
      );
      for (const key of Object.keys(locales[code]))
        assert.deepEqual(
          placeholders(locales[code][key]),
          placeholders(locales[reference][key]),
          `${code} ${key}`,
        );
    }
  });

  it("cover everything the page asks for, with nothing left over", async () => {
    const locales = await loadLocales((await loadConfig()).languages);
    const template = await read(root, "src/index.html");
    const asked = new Set(
      [...template.matchAll(/\{\{([\w.-]+)\}\}/g)].map((match) => match[1]),
    );
    // Each language's own name is shown in the language menu, which the build writes.
    asked.add("common.languageName");
    for (const [code, messages] of Object.entries(locales)) {
      for (const key of asked)
        assert.ok(key in messages, `${code} lacks ${key}`);
      assert.deepEqual(
        Object.keys(messages).filter((key) => !asked.has(key)),
        [],
        code + " has unused messages",
      );
    }
  });

  it("are the only place where the page's wording lives", async () => {
    const template = await read(root, "src/index.html");
    assert.deepEqual(
      template.split("\n").filter((line) => /[\u3400-\u9fff]/.test(line)),
      [],
    );
    const words = template
      .replace(/<(script|style|pre)[\s\S]*?<\/\1>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\{\{[^}]+\}\}/g, " ")
      .split(/\s+/)
      // Plain words are prose; names, addresses, paths and times are not.
      .filter((word) => /^[A-Za-z]{2,}$/.test(word))
      .filter((word) => !["Magpie", "api"].includes(word));
    assert.deepEqual(words, []);
  });
});

describe("the built site", () => {
  let dist;
  let config;
  let locales;
  before(async () => {
    dist = await mkdtemp(join(tmpdir(), "magpie-website-"));
    config = await loadConfig();
    locales = await loadLocales(config.languages);
    await build({ outDir: dist });
  });
  after(() => rm(dist, { recursive: true, force: true }));
  const page = (code) =>
    read(dist, code === config.defaultLanguage ? "" : code, "index.html");

  it("has a complete page for every language", async () => {
    for (const code of Object.keys(locales)) {
      const html = await page(code);
      assert.match(html, new RegExp(`<html lang="${code}"`));
      assert.equal(html.match(/\{\{[^}]*\}\}/g), null, code);
      assert.ok(html.includes(locales[code]["site.hero.title"]), code);
      // The language menu marks the language being read.
      assert.ok(
        html.includes(
          'aria-current="true">' + locales[code]["common.languageName"],
        ),
        code,
      );
    }
  });

  it("uses only addresses that work wherever the folder is put", async () => {
    for (const code of Object.keys(locales)) {
      const html = await page(code);
      const folder = join(dist, code === config.defaultLanguage ? "" : code);
      for (const [, address] of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
        if (/^(https?:|data:|#)/.test(address)) continue;
        assert.ok(
          !address.startsWith("/"),
          `${code}: ${address} starts at the top of the domain`,
        );
        // A relative address leads to a file that was built.
        const target = join(folder, address.split(/[?#]/)[0]);
        const file =
          target.endsWith("/") || !/\.\w+$/.test(target)
            ? join(target, "index.html")
            : target;
        await assert.doesNotReject(
          readFile(file),
          `${code}: ${address} leads nowhere`,
        );
      }
      // Links within the page point at parts that exist.
      for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g))
        assert.ok(html.includes(`id="${anchor}"`), `${code}: #${anchor}`);
    }
  });

  it("sends sign-in and the privacy notice to the app", async () => {
    const html = await page(config.defaultLanguage);
    assert.ok(html.includes(`href="${config.appUrl}/login"`));
    assert.ok(html.includes(`href="${config.appUrl}/privacy"`));
  });

  it("loads its files under a fingerprint of their content", async () => {
    const html = await page(config.defaultLanguage);
    const files = await readdir(join(dist, "assets"));
    for (const file of files)
      assert.match(
        html,
        new RegExp(`assets/${file.replace(".", "\\.")}\\?v=[0-9a-f]{12}"`),
      );
  });

  it("names its address to search engines only once it has one", async () => {
    const quiet = await page(config.defaultLanguage);
    if (!config.siteUrl) {
      assert.ok(!quiet.includes('rel="canonical"'));
      assert.ok(!quiet.includes('rel="alternate"'));
    }
    const other = await mkdtemp(join(tmpdir(), "magpie-website-"));
    try {
      await build({ outDir: other, siteUrl: "https://magpie.example.org/" });
      const html = await read(other, "index.html");
      assert.ok(
        html.includes(
          '<link rel="canonical" href="https://magpie.example.org/" />',
        ),
      );
      for (const code of Object.keys(locales))
        assert.ok(
          html.includes(
            `<link rel="alternate" hreflang="${code}" href="https://magpie.example.org/${code === config.defaultLanguage ? "" : code + "/"}" />`,
          ),
          code,
        );
      assert.ok(
        (await read(other, "robots.txt")).includes(
          "Sitemap: https://magpie.example.org/sitemap.xml",
        ),
      );
      assert.ok(
        (await read(other, "sitemap.xml")).includes(
          "<loc>https://magpie.example.org/</loc>",
        ),
      );
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });
});
