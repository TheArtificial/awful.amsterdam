const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const packageJson = require("../package.json");

const projectDirectory = path.resolve(__dirname, "..");
// Eleventy 4's supplied generator coerces its version without the prerelease suffix.
const generator = `Eleventy (Build Awesome) v${packageJson.devDependencies["@11ty/eleventy"].split("-")[0]}`;

const headTags = (html) =>
{
  const head = html.match(/<head>([\s\S]*?)<\/head>/);
  assert.ok(head, "The rendered page must have a head");
  return head[1].match(/<title>[\s\S]*?<\/title>|<(?:meta|link)\b[^>]*>/g);
};

// Preserve the legacy head's coverage and identity, not just its title.
const expectedHead = (title, url, stylesheet) => [
  '<meta charset="utf-8">',
  '<meta http-equiv="X-UA-Compatible" content="IE=edge">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  `<title>${title}</title>`,
  `<meta name="title" content="${title}">`,
  '<meta name="author" content="Atelier Awful">',
  '<meta name="description" content="An awe-inspiring place.">',
  `<meta name="generator" content="${generator}">`,
  '<meta property="og:type" content="website">',
  `<meta property="og:url" content="${url}">`,
  '<meta property="og:locale" content="en_NL">',
  `<meta property="og:title" content="${title}">`,
  '<meta property="og:description" content="An awe-inspiring place.">',
  '<meta property="og:image" content="/favicon.png">',
  '<meta name="twitter:card" content="summary">',
  `<meta name="twitter:url" content="${url}">`,
  `<meta name="twitter:title" content="${title}">`,
  '<meta name="twitter:description" content="An awe-inspiring place.">',
  '<meta name="twitter:image" content="/favicon.png">',
  `<link rel="canonical" href="${url}">`,
  '<meta name="msapplication-TileColor" content="#12265C">',
  '<meta name="theme-color" content="#12265C">',
  `<link rel="stylesheet" href="${stylesheet}" />`
];

const renderSourceLayout = async (context, title, url) =>
{
  const directory = await fs.mkdtemp(path.join(__dirname, ".metadata-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const inputDirectory = path.join(directory, "src");
  const outputDirectory = path.join(directory, "output");
  await fs.mkdir(path.join(inputDirectory, "_layouts"), { recursive: true });
  await fs.copyFile(
    path.join(projectDirectory, "src/_layouts/base.njk"),
    path.join(inputDirectory, "_layouts/base.njk")
  );
  await fs.writeFile(path.join(inputDirectory, "index.njk"), [
    "---",
    "layout: base.njk",
    `title: ${JSON.stringify(title)}`,
    `permalink: ${JSON.stringify(url)}`,
    "---",
    "<p>Fixture body</p>"
  ].join("\n"));

  const configPath = path.join(directory, "eleventy.cjs");
  await fs.writeFile(configPath, `module.exports = () => (${JSON.stringify({
    dir: { input: inputDirectory, output: outputDirectory, layouts: "_layouts" },
    templateFormats: ["njk"]
  })});`);

  const { default: Eleventy } = await import("@11ty/eleventy");
  const eleventy = new Eleventy(inputDirectory, outputDirectory, {
    configPath,
    quietMode: true,
    config: (config) => config.addGlobalData("assetPaths", {
      styles: { "/css/site.css": "/css/site.fixture.css" }
    })
  });
  eleventy.disableLogger();
  await eleventy.init();
  const pages = await eleventy.toJSON();
  assert.equal(pages.length, 1);
  assert.equal(pages[0].url, url);
  return pages[0].content;
};

test("the source layout escapes metadata titles and page URLs", async (context) =>
{
  const html = await renderSourceLayout(
    context,
    'Awful "quotes" & <art> \'today\'',
    '/events/art"&<.html'
  );

  assert.deepEqual(headTags(html), expectedHead(
    "Awful &quot;quotes&quot; &amp; &lt;art&gt; &#39;today&#39;",
    "/events/art&quot;&amp;&lt;.html",
    "/css/site.fixture.css"
  ));
});

test("the source layout preserves the relative home URL", async (context) =>
{
  const html = await renderSourceLayout(context, "This is Awful", "/");
  assert.deepEqual(headTags(html), expectedHead("This is Awful", "/", "/css/site.fixture.css"));
});

test("generated home and event heads preserve the legacy metadata", async (context) =>
{
  const outputDirectory = await fs.mkdtemp(path.join(__dirname, ".metadata-site-"));
  context.after(() => fs.rm(outputDirectory, { recursive: true, force: true }));
  const { default: Eleventy } = await import("@11ty/eleventy");
  const eleventy = new Eleventy("src", outputDirectory, {
    source: "cli",
    configPath: path.join(projectDirectory, ".eleventy.js"),
    quietMode: true
  });
  eleventy.disableLogger();
  await eleventy.write();

  const css = await fs.readFile(path.join(outputDirectory, "css/site.css"));
  const hash = createHash("sha256").update(css).digest("hex").slice(0, 8);

  for (const [file, url] of [
    ["index.html", "/"],
    ["events/holidaymarket.html", "/events/holidaymarket.html"]
  ])
  {
    const html = await fs.readFile(path.join(outputDirectory, file), "utf8");
    assert.deepEqual(headTags(html), expectedHead("This is Awful", url, `/css/site.${hash}.css`));
  }
});
