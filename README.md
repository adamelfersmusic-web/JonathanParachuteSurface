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

There's no backend and nothing is hardcoded. On first load you enter your
**vault URL** (the root, e.g. `https://your-hub.fly.dev/vault/jonathan` —
everything before `/api`) and connect one of two ways:

- **OAuth (default)** — the same flow the Notes reference app uses:
  OAuth 2.1 + PKCE (S256), RFC 8414 metadata discovery, and RFC 7591 dynamic
  client registration against your hub. You click **Connect with OAuth**, sign
  in / consent on the hub, and get bounced back. Access tokens are refreshed
  silently (refresh-token rotation) and on any `401`. If your hub requires admin
  approval of the app, you'll see an "approval page" link.
- **Token paste (fallback)** — under *Advanced*, paste a hub JWT with
  `vault:write` scope. Useful for hubs without OAuth enabled, or quick use.

The token (and OAuth refresh material) is stored **only in this browser's
`localStorage`** and sent **only to your vault**, as `Authorization: Bearer
<token>` on each request. Use the ⏻ button to disconnect (clears everything).
The cross-origin call works because the vault sends
`Access-Control-Allow-Origin: *`.

### OAuth redirect URI

The app uses **its own served index URL** as the OAuth `redirect_uri`
(computed at runtime — no repo name hardcoded). On a static host like GitHub
Pages there's no separate `/oauth/callback` route to 404 on; the hub redirects
back to the app root with `?code&state`, which the app detects on load,
exchanges for a token, and then strips from the URL. OAuth requires a secure
context, which `https://<username>.github.io/...` satisfies.

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
   `dist/` on every push to the default branch (or via "Run workflow"). The
   Vite `base` is relative, so it works at `https://<username>.github.io/<repo>/`
   with no extra config. A custom domain is optional.

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
