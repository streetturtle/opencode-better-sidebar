# opencode-better-sidebar

Small, focused OpenCode sidebar plugins that make daily coding sessions faster.

If this helps your workflow, please star the repo.

<p align="center">
  <img src="assets/screenshot.png" alt="opencode-better-sidebar screenshot" width="980" />
</p>

## Install

Requires OpenCode 2.0 or newer.

```sh
opencode plugin add @streetturtle/opencode-open-in
opencode plugin add @streetturtle/opencode-context-progress
opencode plugin add @streetturtle/opencode-recap
opencode plugin add @streetturtle/opencode-session-tokens
opencode plugin add @streetturtle/opencode-current-prompt
opencode plugin add @streetturtle/opencode-current-model
```

or from OpenCode, press <kbd>ctrl</kbd>+<kbd>p</kbd> -> "Install Plugin" -> "@streetturtle/opencode-open-in"

## Plugin Pack

- [`@streetturtle/opencode-open-in`](./plugins/open-in) - quick buttons to open the current session folder in Zed, VS Code, or Cursor.
- [`@streetturtle/opencode-context-progress`](./plugins/context-progress)` - context usage progress bar with token usage, window limit, and spend.
- [`@streetturtle/opencode-recap`](./plugins/recap) - one-click AI recap for the current session.
- [`@streetturtle/opencode-session-tokens`](./plugins/session-tokens) - collapsible session token totals with per-model breakdown.
- [`@streetturtle/opencode-current-prompt`](./plugins/current-prompt) - keeps the latest user prompt visible in the sidebar.
- [`@streetturtle/opencode-current-model`](./plugins/current-model) - shows the current model and provider; click to open the model picker.
