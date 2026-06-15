# Demo mode

The landing page (`/`) includes a **Demo controls** card that seeds a rich
demo dataset (folders, documents across every sensitivity/status, approvals +
notarizations, threaded comments, a share link, templates — all RAG-indexed) or
clears the workspace back to an empty state. This lets you show the app either
full of realistic content or as a fresh install.

Everything operates on the caller's workspace only.

## How to remove demo mode for production

Demo mode is fully self-contained. To remove it, delete these files:

1. `src/lib/demo-data.ts` — seed/clear logic
2. `src/app/api/demo/route.ts` — the `GET`/`POST /api/demo` endpoint
3. `src/components/DemoControls.tsx` — the landing-page buttons

Then remove the demo block from `src/app/page.tsx`:

- the import: `import { DemoControls } from "@/components/DemoControls";`
- the JSX block marked `{/* DEMO MODE — remove this block for production ... */}`
  (the `<DemoControls />` line inside the hero)

Nothing else imports any of the above, so the app builds and runs unchanged.
You may also delete this `DEMO.md`.

> Note: removing demo mode does not affect normal document/folder/template
> creation — only the one-click seed/clear shortcut goes away.
