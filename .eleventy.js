const pluginMetagen = require('eleventy-plugin-metagen');

module.exports = function(eleventyConfig) {
  eleventyConfig.setQuietMode(true);

  eleventyConfig.addWatchTarget("./src/css/");

  eleventyConfig.setDataDeepMerge(true);

  // plugins
  eleventyConfig.addPlugin(pluginMetagen);

  // template filters
  eleventyConfig.addFilter("date", require("./filters/date.js") );
  eleventyConfig.addFilter("limit", require("./filters/limit.js") );

  // excerpts for posts
  eleventyConfig.setFrontMatterParsingOptions({
    excerpt: true,
    excerpt_separator: "<!-- excerpt -->",
    excerpt_alias: 'intro'
  });

  // manually configure markdown-it
  let markdownIt = require("markdown-it");
  let markdownItFootnote = require("markdown-it-footnote");
  let options = {
    html: true,
    typographer: true,
    quotes: '“”‘’'
  };
  let markdownLib = markdownIt(options).use(markdownItFootnote);
  eleventyConfig.setLibrary("md", markdownLib);

  eleventyConfig.addPassthroughCopy("src/**/*.gif");
  eleventyConfig.addPassthroughCopy("src/**/*.jpg");
  eleventyConfig.addPassthroughCopy("src/**/*.jpeg");
  eleventyConfig.addPassthroughCopy("src/**/*.png");
  eleventyConfig.addPassthroughCopy("src/**/*.svg");
  eleventyConfig.addPassthroughCopy("src/**/*.pdf");
  eleventyConfig.addPassthroughCopy("src/js/");
  eleventyConfig.addPassthroughCopy({"src/_meta": "/"});

  return {
    dir: {
      input: "src",
      output: "_site",
      // includes: "/_includes",
      layouts: "/_layouts"
    },
    templateFormats : [
      "html",
      "njk",
      "md",
      "11ty.js"
    ],

    // always Nunjuk so we can use dynamic permalinks in the template
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",

    passthroughFileCopy: true // unhandled types above will be simply copied
  };

};
