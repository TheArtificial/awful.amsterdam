const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const markdownIt = require("markdown-it");
const footnotes = require("markdown-it-footnote");
const sass = require("sass");

// Keep authored Markdown features intact when the shared parser is updated.
test("patched Markdown preserves typography, trusted HTML, and footnotes", () =>
{
  const markdown = markdownIt({ html: true, typographer: true, quotes: "“”‘’" }).use(footnotes);
  const html = markdown.render('A "quoted" thought with <strong>trusted markup</strong>.[^note]\n\n[^note]: Supporting text.\n');

  assert.match(html, /“quoted”/);
  assert.match(html, /<strong>trusted markup<\/strong>/);
  assert.match(html, /class="footnote-ref"/);
  assert.match(html, /Supporting text\./);
});

test("the site's Sass entry compiles without deprecation warnings", async () =>
{
  const inputFile = fs.existsSync("src/css/site.scss") ? "src/css/site.scss" : "src/css/style.scss";
  const warnings = [];
  const { css } = await sass.compileAsync(inputFile, {
    style: "compressed",
    logger: {
      warn: (message) => warnings.push(message)
    }
  });

  assert.ok(css.length > 0);
  assert.deepEqual(warnings, []);
});
