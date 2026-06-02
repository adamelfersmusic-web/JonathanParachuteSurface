# Vault Deck

A personal command-center SPA for a [Parachute](https://parachute.computer) Vault.
Static, no backend — it talks directly to your vault's HTTP API from the browser.
Built for **one brain**: pinned anchors, open todos, a content-script production
board, recent activity, and one-word full-text search, all on a single screen.

## What it does

- **Command center** (landing): Pinned notes · Open TODOs · Scripts kanban
  (draft → approved → filmed → edited → published) · Recent activity.
- **Search**: one box, full-text via the vault's `?search=` param.
- **Tag rail**: click any tag to slice the vault.
- **Full CRUD**: open any note to read rendered markdown (with clickable
  `[[wikilinks]]`), edit content / tags / metadata inline, move scripts across
  the board, capture new notes (defaulting into `capture/`), and delete.

No graph view yet — there are only a handful of links in the vault today. It's a
clean thing to add once the link clusters are built out.

## Auth & privacy

There's no backend and nothing is hardcoded. On first load you paste:

- **Vault URL** — the full vault base, e.g. `https://your-hub.fly.dev/vault/jonathan`
  (everything before `/api`).
- **API token** — a hub JWT with `vault:write` scope.

Both are stored **only in this browser's `localStorage`** and sent **only to your
vault**, as `Authorization: Bearer <token>` on each request. Use the ⏻ button to
disconnect (clears them) and ⚙ to re-enter them. The cross-origin call works
because the vault sends `Access-Control-Allow-Origin: *`.

## Develop

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run preview    # serve the built dist/ locally
npm run typecheck  # tsc --noEmit
```

## Deploy to GitHub Pages

1. Create the repo (public) and push this code.
2. In the repo: **Settings → Pages → Source = GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and publishes
   `dist/` on every push to **`main`** (or via "Run workflow"). The Vite `base`
   is relative, so it works at `https://<username>.github.io/<repo>/` with no
   extra config. A custom domain is optional.

> Note: deploy runs on pushes to `main`. While you're on a feature branch it
> won't publish until merged — trigger it manually from the Actions tab if you
> want a preview build sooner.

## Dependencies

Deliberately small:

- **react / react-dom** — UI.
- **react-markdown** + **remark-gfm** — render note bodies (GFM = tables,
  task lists, strikethrough). `remark-gfm` is the standard GitHub-flavored
  plugin for `react-markdown`.
- **vite / typescript** + types — build tooling.

No state library, no UI kit, no CSS framework — plain CSS and hand-rolled
`fetch`. All endpoint logic lives in `src/api.ts`, so if your vault's REST
contract differs slightly that's the one file to adjust.
