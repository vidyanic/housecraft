# Publish and share Atelier Plan

This is a static app with local assets and no build step.

1. Push the application to a GitHub repository, with `index.html` at its root. Include `css/`, `js/`, `vendor/`, `renderer3d.js`, `default-layout.js` and `.nojekyll`.
2. In GitHub, open **Settings → Pages → Build and deployment**. Select **Deploy from a branch**, your published branch (usually `main`), and **/(root)**; click Save.
3. After deployment finishes, open `https://USERNAME.github.io/REPOSITORY/`.

GitHub instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Share a layout

Export JSON from the editor. Put that file in the repository, for example `layouts/house.json`, and push it. Share:

```text
https://USERNAME.github.io/REPOSITORY/?readonly=1&layout=layouts/house.json
```

`?readonly=1` alone opens the bundled reference layout. The viewer does not read or overwrite the recipient's local saved project. Editing controls, placement, transforms, imports, history and editor shortcuts are disabled; pan, zoom, workspace/floor navigation and 3D orbit remain available. Layout paths must resolve to the same origin and pass the existing project validator. An invalid/unavailable layout shows an error instead of silently opening another layout.

Each person's editable projects remain in their own browser; publishing the app does not upload your local saved projects. Published JSON is downloadable, and the URL flag is a viewer convenience, not security or permission enforcement. Publish only layouts intended for public sharing. Removing the flag opens the ordinary local editor, without loading the shared JSON.
