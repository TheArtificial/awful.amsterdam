# awful.amsterdam

The Atelier Awful website.

## Editing content

Content lives in `src/`:

- `index.html`: home page.
- `events/`: event pages.
- `img/`: shared images.

Use nearby pages as templates for frontmatter and image paths. Preserve existing permalinks when updating published pages. Edit source files, not the generated `_site/` directory.

## Previewing changes

With Node.js 22.15 or newer installed, run from this directory:

```sh
npm ci
npm start
```

Open the local URL printed by the server.

Architecture and deployment notes are in [AGENTS.md](AGENTS.md).
