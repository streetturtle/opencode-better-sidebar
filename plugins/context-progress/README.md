# @streetturtle/opencode-context-progress

Compact context usage widget for the OpenCode sidebar.

<img src="https://raw.githubusercontent.com/streetturtle/opencode-better-sidebar/main/assets/context-progress-screenshot.png" alt="Context Progress sidebar screenshot" width="520" />

## What it shows

- **Line 1:** context progress bar + percentage used
- **Line 2:** consumed tokens / model context window / session cost

## How it works

- Uses the latest assistant response with token data
- Token count formula: `input + output + reasoning + cache.read + cache.write`
- Context window is read from the active provider/model metadata
- Bar color changes with usage:
  - normal (theme accent color): `< 70%`
  - warning: `>= 70%`
  - danger: `>= 90%`

## Install

Requires OpenCode 2.0 or newer.

```sh
opencode plugin add @streetturtle/opencode-context-progress
```

Project-only: add `"@streetturtle/opencode-context-progress"` to `plugins` in `opencode.jsonc`.
