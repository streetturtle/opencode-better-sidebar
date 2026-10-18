import { Plugin } from "@opencode/plugin"

// Server-side entrypoint. This plugin is a terminal (TUI) extension, so all of
// its behavior lives in the `./tui` export; this stub only registers the
// package so it can also be listed in `opencode.json` under `plugins`.
export default Plugin.define({
  id: "streetturtle.session-tokens",
  setup() {},
})
