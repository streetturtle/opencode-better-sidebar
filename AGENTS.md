# AGENTS.md

OpenCode TUI sidebar plugins, published to npm as `@streetturtle/opencode-*`.

## Layout

- npm workspaces monorepo; each plugin lives in `plugins/<name>/`
- Each plugin has a single source file `index.ts` (Solid JSX via `@opentui/solid`), a `package.json`, and a `README.md`
- Plugins use the OpenCode V2 plugin API: `Plugin.define({ id, setup })` from `@opencode/plugin/tui`
- `package.json` exports `"./tui": "./dist/tui.tsx"`; `dist/` is git-ignored

## Build

- `npm run build` copies `index.ts` to `dist/tui.tsx` (all workspaces from the root, or one plugin from its folder)
- When OpenCode loads a plugin by folder path, it reads `dist/tui.tsx`, so rebuild after every change to `index.ts`

## Versioning (required)

Every change to a plugin that should ship (new feature, fix, behavior or UI change) must bump that plugin's version in the same PR:

```sh
npm version patch --no-git-tag-version -w plugins/<name>   # fixes
npm version minor --no-git-tag-version -w plugins/<name>   # new features
```

This also updates `package-lock.json`; commit both files.

`.github/workflows/publish-npm.yml` publishes on push to `main` and skips versions that already exist on npm, so a change without a version bump is never released.

## Conventions

- Conventional commit messages, e.g. `fix(recap): ...`, `feat: ...`, `chore: bump plugin versions ...`
- Clickable sidebar text uses `selectable={false}`
- Use theme colors from `context.theme`, not hardcoded colors
- Persist UI state (e.g. collapsed/expanded) with `context.storage.store`
- Update the plugin's `README.md`, and the root `README.md` for new plugins, when behavior changes
