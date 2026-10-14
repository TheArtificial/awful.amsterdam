# Technical notes for awful.amsterdam

Keep `README.md` focused on content maintenance; architecture and operational notes belong here. Preserve published URLs and the existing CSS cascade. Do not edit generated `_site/` files.

## Architecture

- Node.js ≥22.15; `.nvmrc` selects Node 22. Eleventy is pinned to `4.0.0-alpha.10`; prerelease upgrades should be deliberate.
- `.eleventy.js` and local helpers use CommonJS. Source is `src/`; output is `_site/`. Shared Nunjucks layouts are in `src/_layouts/`, and template filters are in `filters/`.
- Markdown uses the directly declared patched parser and supports footnotes. No dependency overrides are required.
- Metadata is native Nunjucks markup in `src/_layouts/base.njk`, with explicit title/URL escaping. Preserve the existing relative canonical/social URLs and `en_NL` locale. Do not reintroduce the legacy metadata wrapper, which pulled in an older generator.
- `eleventy/css.js` compiles `src/css/site.scss` before rendering, using modern Sass modules. It writes compressed `/css/site.<hash>.css` and the stable `/css/site.css` alias, exposing the hashed URL through `assetPaths.styles`.

## Validation

Run from the repository root:

```sh
npm ci
npm run build
npm test
npm audit --include=dev
```

`npm start` runs the local preview server. Tests cover CSS hashing/rebuilds, output overrides, Sass warnings, Markdown, and metadata rendering/escaping. Check rendered output and public paths when changing the generator or dependencies.

## Deployment

- `Dockerfile` uses a Node 22 Alpine build stage and an Nginx Alpine runtime. Package manifests are copied before source, and BuildKit caches npm downloads. The build sets `ELEVENTY_ENV=production`; only static output and Nginx configuration enter the runtime.
- `nginx/default.conf.template` preserves directory redirects and extensionless HTML URLs, with relative redirects for reverse-proxy HTTPS.
- In Coolify, use the Dockerfile build pack, repository root (`.`), container port `80`, and health-check path `/healthz`.
- Hashed CSS receives one-year immutable caching. HTML and unversioned assets must revalidate; do not mark unversioned media immutable. `/healthz` returns plain text with `no-store`.

With Docker available:

```sh
docker build -t awful-amsterdam .
docker run --rm awful-amsterdam nginx -t
```
