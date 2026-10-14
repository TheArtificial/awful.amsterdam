const { createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const sass = require("sass");

// Compile before rendering so every page uses the same content-addressed CSS URL.
module.exports = (eleventyConfig, { inputFile, outputFile }) =>
{
  let assetPaths = { styles: {} };

  // Eleventy 4 matches watch patterns literally, so include files below the directory.
  eleventyConfig.addWatchTarget(path.join(path.dirname(inputFile), "**/*"));
  eleventyConfig.on("eleventy.before", async ({ directories }) =>
  {
    const { css } = await sass.compileAsync(inputFile, { style: "compressed" });
    const hash = createHash("sha256").update(css).digest("hex").slice(0, 8);
    const parsedOutput = path.posix.parse(outputFile);
    const hashedFile = path.posix.join(parsedOutput.dir, `${parsedOutput.name}.${hash}.css`);
    const outputDirectory = path.join(directories.output, parsedOutput.dir);

    await fs.mkdir(outputDirectory, { recursive: true });

    // Keep the original URL working for existing links and previously cached HTML.
    await fs.writeFile(path.join(directories.output, outputFile), css);
    await fs.writeFile(path.join(directories.output, hashedFile), css);

    assetPaths = { styles: { [`/${outputFile}`]: `/${hashedFile}` } };
  });

  eleventyConfig.addGlobalData("assetPaths", () => assetPaths);
};
