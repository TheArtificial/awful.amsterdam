const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const cssPlugin = require("../eleventy/css.js");

const createFixture = async (context) =>
{
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "eleventy-css-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));

  const inputFile = path.join(directory, "input.scss");
  const outputDirectory = path.join(directory, "output");
  const events = new Map();
  const globalData = new Map();
  const watchTargets = [];

  cssPlugin({
    addWatchTarget: (target) => watchTargets.push(target),
    on: (name, callback) => events.set(name, callback),
    addGlobalData: (name, callback) => globalData.set(name, callback)
  }, { inputFile, outputFile: "css/site.css" });

  return {
    inputFile,
    outputDirectory,
    watchTargets,
    build: () => events.get("eleventy.before")({ directories: { output: outputDirectory } }),
    assets: () => globalData.get("assetPaths")()
  };
};

test("CSS is compressed, content-addressed, and available at its original URL", async (context) =>
{
  const fixture = await createFixture(context);
  await fs.writeFile(fixture.inputFile, "$color: red; .example { color: $color; }");
  await fixture.build();

  const css = await fs.readFile(path.join(fixture.outputDirectory, "css/site.css"), "utf8");
  const hash = createHash("sha256").update(css).digest("hex").slice(0, 8);
  const assetUrl = fixture.assets().styles["/css/site.css"];

  assert.equal(css, ".example{color:red}");
  assert.equal(assetUrl, `/css/site.${hash}.css`);
  assert.equal(await fs.readFile(path.join(fixture.outputDirectory, assetUrl.slice(1)), "utf8"), css);
  assert.deepEqual(fixture.watchTargets, [path.join(path.dirname(fixture.inputFile), "**/*")]);

  await fixture.build();
  assert.equal(fixture.assets().styles["/css/site.css"], assetUrl);
});

test("rebuilds refresh CSS URLs while retaining previously generated immutable files", async (context) =>
{
  const fixture = await createFixture(context);
  await fs.writeFile(fixture.inputFile, ".example { color: red; }");
  await fixture.build();
  const oldUrl = fixture.assets().styles["/css/site.css"];

  await fs.writeFile(fixture.inputFile, ".example { color: blue; }");
  await fixture.build();
  const newUrl = fixture.assets().styles["/css/site.css"];

  assert.notEqual(newUrl, oldUrl);
  assert.equal(await fs.readFile(path.join(fixture.outputDirectory, "css/site.css"), "utf8"), ".example{color:blue}");
  assert.equal(await fs.readFile(path.join(fixture.outputDirectory, oldUrl.slice(1)), "utf8"), ".example{color:red}");
  assert.equal(await fs.readFile(path.join(fixture.outputDirectory, newUrl.slice(1)), "utf8"), ".example{color:blue}");
});

test("Eleventy renders refreshed stylesheet URLs during watch-style rebuilds with a CLI output override", async (context) =>
{
  const { default: Eleventy } = await import("@11ty/eleventy");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "eleventy-css-render-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const inputDirectory = path.join(directory, "src");
  const outputDirectory = path.join(directory, "output");
  const inputFile = path.join(inputDirectory, "site.scss");
  await fs.mkdir(inputDirectory);
  await fs.writeFile(inputFile, ".example { color: red; }");
  await fs.writeFile(path.join(inputDirectory, "index.njk"), '{{ assetPaths.styles["/css/site.css"] }}');

  const configPath = path.join(directory, "eleventy.cjs");
  await fs.writeFile(configPath, `module.exports = () => (${JSON.stringify({
    dir: { input: inputDirectory, output: path.join(directory, "configured-output") }
  })});`);

  const eleventy = new Eleventy(inputDirectory, outputDirectory, {
    source: "cli",
    configPath,
    quietMode: true,
    config: (config) => config.addPlugin(cssPlugin, { inputFile, outputFile: "css/site.css" })
  });
  eleventy.disableLogger();
  await eleventy.write();
  const oldUrl = await fs.readFile(path.join(outputDirectory, "index.html"), "utf8");
  await assert.rejects(fs.access(path.join(directory, "configured-output")), { code: "ENOENT" });

  await fs.writeFile(inputFile, ".example { color: blue; }");
  // Match Eleventy's watch lifecycle, which recreates its template/data caches.
  await eleventy.restart();
  await eleventy.init();
  await eleventy.write();
  const newUrl = await fs.readFile(path.join(outputDirectory, "index.html"), "utf8");

  assert.match(oldUrl, /^\/css\/site\.[a-f0-9]{8}\.css$/);
  assert.match(newUrl, /^\/css\/site\.[a-f0-9]{8}\.css$/);
  assert.notEqual(newUrl, oldUrl);
  assert.equal(await fs.readFile(path.join(outputDirectory, newUrl.slice(1)), "utf8"), ".example{color:blue}");
});

test("the live watcher rebuilds entry styles and nested Sass modules", { timeout: 15000 }, async (context) =>
{
  const { default: Eleventy } = await import("@11ty/eleventy");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "eleventy-css-watch-"));
  let eleventy;
  context.after(async () =>
  {
    await eleventy?.close();
    await fs.rm(directory, { recursive: true, force: true });
  });

  const inputDirectory = path.join(directory, "src");
  const outputDirectory = path.join(directory, "output");
  const stylesDirectory = path.join(inputDirectory, "styles");
  const inputFile = path.join(stylesDirectory, "site.scss");
  const partialFile = path.join(stylesDirectory, "partials", "_colors.scss");
  const entrySource = '@use "partials/colors"; .example { color: colors.$color; }';
  await fs.mkdir(path.dirname(partialFile), { recursive: true });
  await fs.writeFile(partialFile, "$color: red;");
  await fs.writeFile(inputFile, entrySource);
  await fs.writeFile(path.join(inputDirectory, "index.njk"), '{{ assetPaths.styles["/css/site.css"] }}');

  const configPath = path.join(directory, "eleventy.cjs");
  await fs.writeFile(configPath, `module.exports = () => (${JSON.stringify({
    dir: { input: inputDirectory, output: outputDirectory },
    templateFormats: ["njk"]
  })});`);

  eleventy = new Eleventy(inputDirectory, outputDirectory, {
    configPath,
    quietMode: true,
    runMode: "watch",
    config: (config) =>
    {
      config.setWatchJavaScriptDependencies(false);
      config.addPlugin(cssPlugin, { inputFile, outputFile: "css/site.css" });
    }
  });
  eleventy.disableLogger();
  await eleventy.init();
  await eleventy.watch();

  // Wait for the nested file registration before emitting the first edit.
  const watchDeadline = Date.now() + 5000;
  let partialIsWatched = false;
  while (Date.now() < watchDeadline)
  {
    const watched = await eleventy.watcher.getWatched();
    partialIsWatched = Object.values(watched).some((files) => files.includes(path.basename(partialFile)));
    if (partialIsWatched)
    {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(partialIsWatched, "The nested Sass module was not registered with the watcher");

  const stylesheetUrl = () => fs.readFile(path.join(outputDirectory, "index.html"), "utf8");
  const originalUrl = await stylesheetUrl();
  const waitForRebuild = async (previousUrl, expectedCss) =>
  {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline)
    {
      const currentUrl = await stylesheetUrl();
      if (currentUrl !== previousUrl)
      {
        const css = await fs.readFile(path.join(outputDirectory, currentUrl.slice(1)), "utf8");
        assert.equal(css, expectedCss);
        assert.equal(await fs.readFile(path.join(outputDirectory, "css/site.css"), "utf8"), css);
        return currentUrl;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.fail("A stylesheet edit did not refresh the rendered CSS URL");
  };

  // Exercise real filesystem events, rather than manually restarting the builder.
  await fs.writeFile(partialFile, "$color: blue;");
  const partialUrl = await waitForRebuild(originalUrl, ".example{color:blue}");
  await fs.writeFile(inputFile, `${entrySource} .example { font-weight: bold; }`);
  await waitForRebuild(partialUrl, ".example{color:blue}.example{font-weight:bold}");

  assert.equal(await fs.readFile(path.join(outputDirectory, originalUrl.slice(1)), "utf8"), ".example{color:red}");
});

test("Sass errors fail the build rather than publishing an invalid asset URL", async (context) =>
{
  const fixture = await createFixture(context);
  await fs.writeFile(fixture.inputFile, ".example { color: $undefined; }");

  await assert.rejects(fixture.build(), /Undefined variable/);
  assert.deepEqual(fixture.assets(), { styles: {} });
});
